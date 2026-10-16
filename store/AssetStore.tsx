import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityEntry,
  AmcContract,
  AmcVisit,
  ApprovalDocType,
  ApprovalStatus,
  Asset,
  AssetCategory,
  AssetComponent,
  AssetCondition,
  AssetEvent,
  AssetEventType,
  AssetLocation,
  AssetState,
  AssetStatus,
  AssetVariant,
  AuditPlan,
  ComponentStatus,
  Criticality,
  CustomRole,
  Department,
  DepreciationMethod,
  Disposal,
  DisposalMode,
  DoaDelegation,
  DoaRule,
  DepreciationRateRule,
  DepreciationRateType,
  DocStatus,
  Employee,
  Grn,
  GrnLine,
  GatePass,
  NumberingRules,
  PartReplacement,
  PurchaseOrder,
  Replacement,
  Requisition,
  ServiceTicket,
  Transfer,
  Project,
  ProjectEntry,
  ProjectStatus,
  User,
  UserRole,
  Vendor,
  VerificationLine,
  VerificationResult,
  Company
} from '../types';
import { applyDecision, chainOutcome, forceTopLevelStep, hasActiveRulesFor, resolveApprovalChain } from '../lib/doa';
import { nextAssetTagSequence, seedAssetTagCounter, ASSET_TAG_SEQUENCE_KEY, nextDocNo, mergeNumberingRules, applyNumberingRule, DEFAULT_NUMBERING_RULES } from '../lib/numbering';
import { formatCurrency, nowStamp, today, uid } from '../lib/format';
import { hasVerifiedTotpFactor } from '../lib/mfa';
import { normalizePermissions } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import {
  ASSET_META_COLLECTION, COUNTERS_COLLECTION, NUMBERING_RULES_COLLECTION, DOC_COLLECTIONS, SyncEngine,
  fetchAppRecords, isUuid, rowToAsset,
} from './dbSync';

// ---------------------------------------------------------------------------
// Persistence
//
// All business data lives in Supabase (see store/dbSync.ts). The only thing read from the
// browser is the *selected company* (a UI preference) -- and Supabase's own auth session.
// ---------------------------------------------------------------------------

function readStored<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === 'undefined') return defaultValue;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
        return { ...defaultValue, ...parsed } as T;
      }
      return parsed as T;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * localStorage-backed state that is bound to `key`. When `key` changes (e.g. the
 * user switches company) the value for the NEW key is loaded immediately, so data
 * stored under one key can never be shown, mutated or written under another key.
 */
function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [slot, setSlot] = useState<{ key: string; value: T }>(() => ({ key, value: readStored(key, defaultValue) }));

  // Key changed: re-hydrate synchronously during render (before children see stale data).
  let current = slot;
  if (slot.key !== key) {
    current = { key, value: readStored(key, defaultValue) };
    setSlot(current);
  }

  const setAndPersist: React.Dispatch<React.SetStateAction<T>> = useCallback(
    value => {
      setSlot(prev => {
        // Ignore updates queued against a previous key (stale closure after a company switch).
        if (prev.key !== key) return prev;
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev.value) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage full or unavailable; keep working in-memory */
        }
        return { key, value: next };
      });
    },
    [key],
  );
  return [current.value, setAndPersist];
}

/**
 * In-memory state that is bound to `key`. When `key` changes (e.g. the user switches company)
 * the value is reset immediately, so data of one company can never be shown, mutated or
 * written under another. Persistence to the database is handled by SyncEngine.
 */
function useScopedState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [slot, setSlot] = useState<{ key: string; value: T }>(() => ({ key, value: defaultValue }));

  let current = slot;
  if (slot.key !== key) {
    current = { key, value: defaultValue };
    setSlot(current);
  }

  const set: React.Dispatch<React.SetStateAction<T>> = useCallback(
    value => {
      setSlot(prev => {
        // Ignore updates queued against a previous key (stale closure after a company switch).
        if (prev.key !== key) return prev;
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev.value) : value;
        return { key, value: next };
      });
    },
    [key],
  );
  return [current.value, set];
}

const stateKeyFor = (companyId: string | undefined | null) => `company-state:${companyId ?? 'none'}`;

const EMPTY_STATE: AssetState = {
  counters: { asset: 1, requisition: 1, purchaseOrder: 1, grn: 1, transfer: 1, gatePass: 1, amc: 1, serviceTicket: 1, replacement: 1, disposal: 1, audit: 1, project: 1 },
  numberingRules: DEFAULT_NUMBERING_RULES,
  depreciationRateRules: [],
  categories: [], variants: [], locations: [], departments: [], vendors: [], employees: [],
  assets: [], components: [], requisitions: [], purchaseOrders: [], grns: [],
  transfers: [], gatePasses: [], amcContracts: [], amcVisits: [], serviceTickets: [],
  replacements: [], disposals: [], doaRules: [], delegations: [], auditPlans: [], projects: [], customRoles: [], activity: []
};

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

const activityEntry = (
  partial: Omit<ActivityEntry, 'id' | 'timestamp'>,
): ActivityEntry => ({ id: uid('act'), timestamp: nowStamp(), ...partial });

const pushHistory = (asset: Asset, event: Omit<AssetEvent, 'id'>): Asset => ({
  ...asset,
  history: [...asset.history, { id: uid('evt'), ...event }],
});

/** Terminal DisposalMode -> AssetStatus mapping used once a disposal is completed. */
const DISPOSAL_STATUS: Record<DisposalMode, AssetStatus> = {
  [DisposalMode.Sale]: AssetStatus.Sold,
  [DisposalMode.Buyback]: AssetStatus.Sold,
  [DisposalMode.TradeIn]: AssetStatus.Sold,
  [DisposalMode.Scrap]: AssetStatus.Scrapped,
  [DisposalMode.Donation]: AssetStatus.Scrapped,
  [DisposalMode.WriteOff]: AssetStatus.WrittenOff,
  [DisposalMode.Lost]: AssetStatus.Lost,
};

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AssetContextValue {
  state: AssetState;
  currentUser: User;
  /** True until currentUser.role has been confirmed from the database. Role-gated UI (sidebar,
   *  Switch-workspace button, page guards) must show a loading state instead of reading
   *  currentUser.role while this is true. */
  profileLoading: boolean;
  /** Non-null when the role could not be verified after a retry. The app should show a blocking
   *  retry screen instead of the signed-in experience while this is set. */
  profileError: string | null;
  retryProfileLoad: () => void;
  /** Sets the signed-in user's new password (via Supabase Auth) and clears must_change_password.
   *  Returns ok:false with a message on failure so the forced-reset screen can show it inline. */
  completePasswordReset: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  /** True until currentUser.mfaEnrolled has been confirmed against Supabase Auth's own factor
   *  list for this account (MFA status is never stored in `profiles` — it only ever lives in
   *  Auth). The mandatory-MFA gate (App.tsx) must treat this the same way it already treats
   *  profileLoading: don't render the enrollment screen OR the signed-in app while this is true,
   *  or a Superadmin whose factor check is still in flight would flash as "not enrolled" on
   *  every reload. See AUDIT backlog item "MFA". */
  mfaStatusLoading: boolean;
  /** Re-checks Supabase Auth's factor list and updates currentUser.mfaEnrolled — called after a
   *  successful enrollment or an unenroll, so the gate clears without a full reload. */
  refreshMfaStatus: () => Promise<void>;
  currentCompany: Company | null;
  users: User[];
  setCurrentUser: (user: User) => void;
  setCurrentCompany: (company: Company | null) => void;
  me: Employee | undefined;

  // Masters
  saveCategory: (category: AssetCategory) => Promise<void>;
  saveVariant: (variant: AssetVariant) => Promise<void>;
  saveLocation: (location: AssetLocation) => Promise<void>;
  saveDepartment: (department: Department) => Promise<void>;
  saveVendor: (vendor: Vendor) => Promise<void>;
  saveEmployee: (employee: Employee) => Promise<{ ok: boolean; error?: string }>;
  deleteEmployee: (id: string) => Promise<{ ok: boolean; error?: string }>;
  deleteCategory: (id: string) => Promise<{ ok: boolean; error?: string }>;
  deleteLocation: (id: string) => Promise<{ ok: boolean; error?: string }>;
  deleteVendor: (id: string) => Promise<{ ok: boolean; error?: string }>;
  deleteDepartment: (id: string) => Promise<{ ok: boolean; error?: string }>;

  // Asset register
  createAssetManually: (draft: Omit<Asset, 'id' | 'history'>) => Promise<string>;
  bulkUploadAssets: (drafts: Omit<Asset, 'id' | 'history'>[], fileName?: string) => Promise<{ ok: boolean; error?: string }>;
  deleteAsset: (id: string) => Promise<{ ok: boolean; error?: string }>;
  deleteAssetUploadBatch: (uploadId: string) => Promise<{ ok: boolean; error?: string }>;
  addComponent: (assetId: string, component: Omit<AssetComponent, 'id' | 'assetId'>) => void;
  retireComponent: (assetId: string, componentId: string, status: ComponentStatus.Removed | ComponentStatus.Faulty) => void;
  updateAssetFields: (assetId: string, patch: Partial<Asset>, note?: string) => void;

  // Procurement
  submitRequisition: (draft: Omit<Requisition, 'id' | 'prNo' | 'status' | 'approvals' | 'createdOn'>) => string;
  saveRequisitionDraft: (draft: Omit<Requisition, 'id' | 'prNo' | 'status' | 'approvals' | 'createdOn'>) => string;
  actOnRequisition: (id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
  convertRequisitionToPo: (prId: string, vendorId: string, expectedDeliveryDate: string) => string;
  createPurchaseOrder: (draft: Omit<PurchaseOrder, 'id' | 'poNo' | 'status' | 'approvals'>) => string;
  actOnPurchaseOrder: (id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
  postGrn: (draft: Omit<Grn, 'id' | 'grnNo' | 'status' | 'createdAssetIds'>) => { id: string; createdAssetIds: string[] };

  // Movement
  createTransfer: (draft: Omit<Transfer, 'id' | 'transferNo' | 'status' | 'approvals' | 'createdOn'>) => string;
  actOnTransfer: (id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
  dispatchTransfer: (id: string) => void;
  receiveTransfer: (id: string, remarks?: string) => void;

  createGatePass: (draft: Omit<GatePass, 'id' | 'gatePassNo' | 'status' | 'approvals' | 'createdOn'>) => string;
  actOnGatePass: (id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
  issueGatePass: (id: string) => void;
  returnGatePass: (id: string, remarks?: string) => void;

  // Maintenance
  createAmcContract: (draft: Omit<AmcContract, 'id' | 'contractNo' | 'status' | 'approvals' | 'createdOn'>) => string;
  actOnAmc: (id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
  logAmcVisit: (id: string, visit: Omit<AmcVisit, 'id'>) => void;
  renewAmcContract: (id: string, updates: { startDate: string; endDate: string; contractValue: number }) => string;

  createServiceTicket: (draft: Omit<ServiceTicket, 'id' | 'ticketNo' | 'status' | 'approvals' | 'partsReplaced'>) => string;
  actOnServiceTicket: (id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
  startServiceTicket: (id: string) => void;
  closeServiceTicket: (id: string, resolution: string, actualCost: number, partsReplaced: PartReplacement[], recommendReplacement: boolean) => void;

  createReplacement: (draft: Omit<Replacement, 'id' | 'replacementNo' | 'status' | 'approvals'>) => string;
  actOnReplacement: (id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
  completeReplacement: (id: string, newAssetId: string | undefined) => void;

  createDisposal: (draft: Omit<Disposal, 'id' | 'disposalNo' | 'status' | 'approvals'>) => string;
  actOnDisposal: (id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
  completeDisposal: (id: string, disposalDate: string, invoiceNo?: string) => void;

  // DOA
  saveDoaRule: (rule: DoaRule) => void;
  toggleDoaRule: (id: string, active: boolean) => void;
  saveDelegation: (delegation: DoaDelegation) => void;
  toggleDelegation: (id: string, active: boolean) => void;
  /** True if the DOA matrix has any active rule for this doc type at all. Submission screens
   *  must check this and block submission when false — see AUDIT fix GOV-01. */
  hasActiveDoaRules: (docType: ApprovalDocType) => boolean;

  // Audit
  createAuditPlan: (draft: Omit<AuditPlan, 'id' | 'auditNo' | 'status' | 'lines' | 'createdOn'>) => string;
  recordVerification: (auditId: string, line: VerificationLine) => void;
  signOffAudit: (auditId: string, observations: string) => void;

  // CWIP Projects
  createProject: (draft: Omit<Project, 'id' | 'projectNo' | 'status' | 'totalSpent' | 'entries' | 'createdOn'>) => string;
  updateProject: (id: string, patch: Partial<Omit<Project, 'id' | 'projectNo' | 'totalSpent' | 'entries' | 'createdOn'>>) => void;
  addProjectEntry: (projectId: string, entry: Omit<ProjectEntry, 'id' | 'recordedBy'>) => void;
  completeProject: (projectId: string, categoryId: string, variantId: string | undefined, locationId: string, departmentId: string) => string;

  // Custom Roles
  saveCustomRole: (role: CustomRole) => Promise<{ ok: boolean; error?: string }>;
  deleteCustomRole: (id: string) => Promise<{ ok: boolean; error?: string }>;

  // Settings: numbering / prefix-suffix rules + Depreciation Rate Master
  saveNumberingRules: (rules: NumberingRules) => Promise<{ ok: boolean; error?: string }>;
  saveDepreciationRateRule: (rule: Omit<DepreciationRateRule, 'id' | 'updatedAt'> & { id?: string }) => Promise<{ ok: boolean; error?: string }>;
  deleteDepreciationRateRule: (id: string) => Promise<{ ok: boolean; error?: string }>;

  // Company settings
  companyName: string;
  companyLogoUrl: string;
  saveCompanySettings: (settings: { companyName: string; companyLogoUrl: string }) => void;

  /** Non-null when the last attempt to write to the database failed. */
  syncError: string | null;
}

const AssetContext = createContext<AssetContextValue | null>(null);

export const useAssetStore = (): AssetContextValue => {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error('useAssetStore must be used within AssetStoreProvider');
  return ctx;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const AssetStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [syncError, setSyncError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>({ id: '', name: 'Loading...', role: UserRole.EMPLOYEE });
  // profileLoading starts true and only flips to false once the REAL role has been read back
  // from `profiles` (success or a terminal, surfaced error). Every role-gated UI element
  // (sidebar nav, the Switch-workspace button, page guards) must treat profileLoading=true as
  // "unknown yet", never fall back to reading currentUser.role, which still holds its
  // placeholder EMPLOYEE value during this window. See AUDIT fix BUG-01.
  const [profileLoading, setProfileLoading] = useState(true);
  // Non-null only when the profile could not be loaded after a retry. The app must show a
  // blocking retry screen in this state rather than guessing a role.
  const [profileError, setProfileError] = useState<string | null>(null);
  const [currentCompany, setCurrentCompany] = usePersistentState<Company | null>('af_current_company', null);

  // STRICT TENANT ISOLATION: every record the app works with (assets, requisitions, vendors,
  // employees, categories, DOA rules, activity, counters, ...) belongs to ONE company.
  // Switching company swaps the entire dataset; nothing is ever shared or merged between companies.
  const [state, setState] = useScopedState<AssetState>(stateKeyFor(currentCompany?.id), EMPTY_STATE);

  // Write-through persistence: detects every change to `state` and saves it to Supabase.
  const syncEngine = useMemo(
    () => (currentCompany ? new SyncEngine(currentCompany.id, setSyncError) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentCompany?.id],
  );
  useEffect(() => { setSyncError(null); }, [syncEngine]);
  useEffect(() => { syncEngine?.scan(state); }, [state, syncEngine]);
  useEffect(() => {
    if (!syncEngine) return;
    const flushNow = () => { void syncEngine.flush(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushNow);
      flushNow();
    };
  }, [syncEngine]);

  // Company name / logo always come from the selected company record itself.
  const companySettings = useMemo(
    () => ({ companyName: currentCompany?.name || '', companyLogoUrl: currentCompany?.logoUrl || '' }),
    [currentCompany],
  );
  const setCompanySettings = useCallback(
    (settings: { companyName: string; companyLogoUrl: string }) =>
      setCurrentCompany(prev => (prev ? { ...prev, name: settings.companyName, logoUrl: settings.companyLogoUrl } : prev)),
    [setCurrentCompany],
  );

  React.useEffect(() => {
    let cancelled = false;

    // Fetch actual user + role (from public.profiles) from Supabase. Never assign a role by
    // guessing: until this resolves, profileLoading stays true and every role-gated component
    // must treat the app as "not yet known to be any particular role" (see profileLoading above).
    const loadProfile = async (attempt: number): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { setProfileLoading(false); return; }
      const user = session.user;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, role, is_active, must_change_password')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;

      if (error) {
        // profiles table not created yet (user_management.sql not run) – this is a one-time
        // bootstrap scenario, not a normal runtime error, and must not be reachable by a plain
        // transient failure: distinguish it explicitly, and never let a generic error silently
        // demote the signed-in user to Employee.
        const tableMissing = error.code === '42P01' || error.code === 'PGRST205';
        if (tableMissing) {
          console.warn(
            '[AssetStore] profiles table does not exist yet — granting a ONE-TIME bootstrap ' +
            'Superadmin session so the first account can run user_management.sql. Run that ' +
            'migration immediately; every signed-in user is a de facto Superadmin until you do.',
          );
          setCurrentUser({ id: user.id, name: user.email || 'User', role: UserRole.SUPERADMIN, employeeId: undefined });
          setProfileLoading(false);
          return;
        }

        console.warn(`[AssetStore] Could not load profile (attempt ${attempt}):`, error.message);
        if (attempt < 2) {
          // One retry for a transient network/RLS blip before surfacing a hard error.
          await new Promise(r => setTimeout(r, 800));
          if (!cancelled) await loadProfile(attempt + 1);
          return;
        }
        // Terminal failure: do NOT guess a role (not Employee, not Superadmin). Surface it and
        // let the app render a blocking retry screen instead of the signed-in experience.
        setProfileError(
          `Could not verify your access level (${error.message}). This is a security check, so ` +
          `we won't guess your role — please retry, and contact your administrator if this persists.`,
        );
        setProfileLoading(false);
        return;
      }

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        setProfileLoading(false);
        return;
      }

      setCurrentUser({
        id: user.id,
        name: profile?.full_name || user.email || 'User',
        role: (profile?.role as UserRole) || UserRole.EMPLOYEE,
        employeeId: undefined,
        mustChangePassword: profile?.must_change_password === true,
      });
      setProfileError(null);
      setProfileLoading(false);

      // NOTE: Data fetching is now moved to the currentCompany useEffect
    };

    setProfileLoading(true);
    setProfileError(null);
    void loadProfile(1);

    return () => { cancelled = true; };
  }, []);

  /** Re-runs the profile fetch after a terminal profileError, e.g. from a "Retry" button. */
  const retryProfileLoad = useCallback(() => {
    setProfileLoading(true);
    setProfileError(null);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setProfileLoading(false); return; }
      const user = session.user;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, role, is_active, must_change_password')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        setProfileError(`Could not verify your access level (${error.message}). Please retry.`);
        setProfileLoading(false);
        return;
      }
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        setProfileLoading(false);
        return;
      }
      setCurrentUser({
        id: user.id,
        name: profile?.full_name || user.email || 'User',
        role: (profile?.role as UserRole) || UserRole.EMPLOYEE,
        employeeId: undefined,
        mustChangePassword: profile?.must_change_password === true,
      });
      setProfileLoading(false);
    });
  }, []);

  /**
   * Used by the forced password-change screen (App.tsx) to retire a temporary password. Sets
   * the new password via Supabase Auth, then clears the server-side flag through a narrow RPC
   * (not a general profile UPDATE — see supabase/12_force_password_reset.sql for why), then
   * updates the in-memory user so the app proceeds past the forced-reset screen without a full
   * reload. Stops at the first failure so a password-set error never silently clears the flag.
   */
  const completePasswordReset = useCallback(async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) return { ok: false, error: authError.message };

    const { error: rpcError } = await supabase.rpc('clear_must_change_password');
    if (rpcError) return { ok: false, error: rpcError.message };

    setCurrentUser(prev => ({ ...prev, mustChangePassword: false }));
    return { ok: true };
  }, []);

  // MFA enrollment status. Supabase Auth owns this entirely (it's never a column on `profiles`),
  // so it's checked separately from the profile/role fetch above, once per signed-in user. Starts
  // true and only flips to false once the real status is known — same reasoning as profileLoading
  // (see AUDIT fix BUG-01): a role-gated "you must enroll MFA" screen must never flash based on a
  // stale or default value while the real check is still in flight.
  const [mfaStatusLoading, setMfaStatusLoading] = useState(true);
  const currentUserId = currentUser.id;
  React.useEffect(() => {
    if (profileLoading) return; // wait for the real account/role before checking its factors
    if (!currentUserId) { setMfaStatusLoading(false); return; }
    let cancelled = false;
    setMfaStatusLoading(true);
    hasVerifiedTotpFactor().then(enrolled => {
      if (cancelled) return;
      setCurrentUser(prev => (prev.id === currentUserId ? { ...prev, mfaEnrolled: enrolled } : prev));
      setMfaStatusLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentUserId, profileLoading]);

  /** Re-checks Supabase Auth's factor list — called right after a successful enrollment or an
   *  unenroll so currentUser.mfaEnrolled (and any gate reading it) updates without a full reload. */
  const refreshMfaStatus = useCallback(async () => {
    const enrolled = await hasVerifiedTotpFactor();
    setCurrentUser(prev => ({ ...prev, mfaEnrolled: enrolled }));
  }, []);

  // A persisted company selection must belong to the signed-in user (the browser may have been
  // used by someone else). RLS only returns companies the user is assigned to (or all for Superadmin).
  // Also re-syncs name/logo from the database: the full Company object (not just its id) is what
  // gets cached in localStorage (see usePersistentState/'af_current_company' above), so without
  // this a browser that had the company open before someone else renamed it or changed its logo
  // elsewhere would otherwise keep showing the stale cached name/logo until a fresh pick from
  // CompanySelection.
  const currentCompanyId = currentCompany?.id;
  React.useEffect(() => {
    if (!currentCompanyId) return;
    let cancelled = false;
    supabase.from('companies').select('id, name, code, display_id, logo_url').eq('id', currentCompanyId).maybeSingle().then(({ data, error }) => {
      if (cancelled || error) return;
      if (!data) { setCurrentCompany(null); return; }
      setCurrentCompany(prev => {
        if (!prev || prev.id !== data.id) return prev;
        if (prev.name === data.name && prev.code === data.code && prev.displayId === data.display_id && prev.logoUrl === (data.logo_url || undefined)) return prev;
        return { ...prev, name: data.name, code: data.code, displayId: data.display_id, logoUrl: data.logo_url || undefined };
      });
    });
    return () => { cancelled = true; };
  }, [currentCompanyId, setCurrentCompany]);

  React.useEffect(() => {
    if (!currentCompany) return;
    let cancelled = false;

    const fetchCompanyData = async () => {
      // Sync Master Data for the selected company
      const { data: dbDepartments, error: depErr } = await supabase.from('departments').select('*').eq('company_id', currentCompany.id);
      if (depErr) console.error('Failed to load departments', depErr);
      if (cancelled) return;
      if (dbDepartments) {
        setState(prev => ({
          ...prev,
          departments: dbDepartments.map(d => ({
            id: d.id,
            code: d.code,
            name: d.name,
            costCenter: d.cost_center || ''
          }))
        }));
      }

      const { data: dbLocations, error: locErr } = await supabase.from('locations').select('*').eq('company_id', currentCompany.id);
      if (locErr) console.error('Failed to load locations', locErr);
      if (cancelled) return;
      if (dbLocations) {
        setState(prev => ({
          ...prev,
          locations: dbLocations.map(d => ({
            id: d.id,
            code: d.code,
            name: d.name,
            type: d.type as any,
            parentId: d.parent_id || undefined,
            address: d.address,
            city: d.city,
            state: d.state
          }))
        }));

      } // closes dbLocations

      const { data: dbCategories, error: catErr } = await supabase.from('asset_categories').select('*').eq('company_id', currentCompany.id);
      if (catErr) console.error('Failed to load categories', catErr);
      if (cancelled) return;
      if (dbCategories) {
        setState(prev => ({
          ...prev,
          categories: dbCategories.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            parentId: c.parent_id || undefined,
            description: c.description || undefined,
            depreciationMethod: c.depreciation_method,
            usefulLifeYears: Number(c.useful_life_years),
            salvageValuePct: Number(c.salvage_value_pct),
            capitalizationThreshold: Number(c.capitalization_threshold),
            requiresAmc: c.requires_amc,
            requiresSerialNumber: c.requires_serial_number,
            trackComponents: c.track_components,
            active: c.active
          }))
        }));
      }

      const { data: dbVariants, error: varErr } = await supabase.from('asset_variants').select('*').eq('company_id', currentCompany.id);
      if (varErr) console.error('Failed to load variants', varErr);
      if (cancelled) return;
      if (dbVariants) {
        setState(prev => ({
          ...prev,
          variants: dbVariants.map(v => ({
            id: v.id,
            categoryId: v.category_id,
            code: v.code || '',
            name: v.name || [v.make, v.model].filter(Boolean).join(' '),
            manufacturer: v.make || '',
            modelNumber: v.model || '',
            specifications: Array.isArray(v.specifications) ? v.specifications : [],
            standardCost: Number(v.standard_cost) || 0,
            warrantyMonths: Number(v.warranty_months) || 0,
            uom: v.uom || 'Nos',
            active: v.active ?? true
          }))
        }));
      }

      const { data: dbVendors, error: venErr } = await supabase.from('vendors').select('*').eq('company_id', currentCompany.id);
      if (venErr) console.error('Failed to load vendors', venErr);
      if (cancelled) return;
      if (dbVendors) {
        setState(prev => ({
          ...prev,
          vendors: dbVendors.map(v => ({
            id: v.id,
            code: v.code,
            name: v.name,
            gstin: v.gstin,
            contactPerson: v.contact_person,
            email: v.email,
            phone: v.phone,
            address: v.address,
            services: v.services || [],
            isAmcPartner: v.is_amc_partner,
            rating: Number(v.rating),
            status: v.status,
            bankAccountName: v.bank_account_name || undefined,
            bankAccountNumber: v.bank_account_number || undefined,
            bankIfsc: v.bank_ifsc || undefined,
          }))
        }));
      }

      const { data: dbCustomRoles, error: roleErr } = await supabase.from('custom_roles').select('*').eq('company_id', currentCompany.id);
      if (roleErr) console.error('Failed to load custom roles', roleErr);
      if (cancelled) return;
      if (dbCustomRoles) {
        setState(prev => ({
          ...prev,
          customRoles: dbCustomRoles.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description || '',
            permissions: normalizePermissions(r.permissions),
          }))
        }));
      }

      const { data: dbEmployees, error: empErr } = await supabase.from('employees').select('*').eq('company_id', currentCompany.id);
      if (empErr) console.error('Failed to load employees', empErr);
      if (cancelled) return;
      if (dbEmployees) {
        setState(prev => ({
          ...prev,
          employees: dbEmployees.map(e => ({
            id: e.id,
            code: e.code,
            name: e.name,
            email: e.email,
            phone: e.phone || undefined,
            designation: e.designation,
            grade: e.grade,
            departmentId: e.department_id,
            locationId: e.location_id,
            reportsTo: e.reports_to || undefined,
            role: e.role,
            status: e.status,
            joinedOn: e.joined_on,
            emergencyContactName: e.emergency_contact_name || undefined,
            emergencyContactPhone: e.emergency_contact_phone || undefined,
          }))
        }));
      }

      const { data: dbAssets, error: assetErr } = await supabase.from('assets').select('*').eq('company_id', currentCompany.id);
      if (assetErr) console.error('Failed to load assets', assetErr);
      if (cancelled) return;

      // Workflow data (requisitions, POs, GRNs, transfers, ... activity, counters, asset history)
      const { rows: appRows, error: recErr } = await fetchAppRecords(currentCompany.id);
      if (cancelled) return;
      if (recErr) {
        console.error('Failed to load app_records', recErr);
        const missing = recErr.code === '42P01' || recErr.code === 'PGRST205';
        setSyncError(
          missing
            ? 'The database table "app_records" is missing. Run supabase/11_app_records.sql in the Supabase SQL editor, then reload.'
            : `Could not load saved data from the database: ${recErr.message}`,
        );
      }

      const byCollection: Record<string, any[]> = {};
      const metaById = new Map<string, any>();
      let loadedCounters: any;
      let loadedNumberingRules: any;
      for (const r of appRows) {
        if (r.collection === COUNTERS_COLLECTION) loadedCounters = r.data;
        else if (r.collection === NUMBERING_RULES_COLLECTION) loadedNumberingRules = r.data;
        else if (r.collection === ASSET_META_COLLECTION) metaById.set(r.id, r.data);
        else {
          (byCollection[r.collection] ||= []).push(r.data);
          syncEngine?.registerDoc(r.collection, r.id, r.data);
        }
      }

      let counters = EMPTY_STATE.counters;
      if (loadedCounters) {
        const merged = { ...EMPTY_STATE.counters, ...loadedCounters };
        if (JSON.stringify(merged) === JSON.stringify(loadedCounters)) {
          counters = loadedCounters;
          syncEngine?.registerDoc(COUNTERS_COLLECTION, 'main', loadedCounters);
        } else counters = merged; // new counter keys -> persisted by the first scan
      }

      // numberingRules merges the same way counters does above, so a brand-new entity kind
      // (added in a future update) never breaks an existing company's saved rules.
      let numberingRules = EMPTY_STATE.numberingRules;
      if (loadedNumberingRules) {
        const merged = mergeNumberingRules(loadedNumberingRules);
        if (JSON.stringify(merged) === JSON.stringify(loadedNumberingRules)) {
          numberingRules = loadedNumberingRules;
          syncEngine?.registerDoc(NUMBERING_RULES_COLLECTION, 'main', loadedNumberingRules);
        } else numberingRules = merged; // new entity kinds -> persisted by the first scan
      }

      const { data: dbDepRateRules, error: depRateErr } = await supabase
        .from('depreciation_rate_rules').select('*').eq('company_id', currentCompany.id);
      if (depRateErr) console.error('Failed to load depreciation rate rules', depRateErr);
      const depreciationRateRules: DepreciationRateRule[] = (dbDepRateRules || []).map((r: any) => ({
        id: r.id,
        categoryId: r.category_id,
        // Rows saved before the Companies Act / Income Tax split have no rate_type in the
        // database yet -- treat them as Companies Act, since that's the basis they were always
        // used for (the only one that existed before this column was added).
        rateType: r.rate_type || DepreciationRateType.CompaniesAct,
        method: r.method,
        usefulLifeYears: Number(r.useful_life_years),
        salvageValuePct: Number(r.salvage_value_pct),
        updatedAt: r.updated_at,
      }));

      const loadedAssets = (dbAssets || []).map(row => {
        let asset = rowToAsset(row);
        const meta = metaById.get(asset.id);
        if (meta) {
          asset = { ...asset, history: meta.history || [], disposal: meta.disposal, amcContractId: meta.amcContractId ?? asset.amcContractId };
        }
        syncEngine?.registerAssetRow(asset);
        if (meta) syncEngine?.registerAssetMeta(asset);
        return asset;
      });

      setState(prev => {
        const next: any = { ...prev, depreciationRateRules: depRateErr ? prev.depreciationRateRules : depreciationRateRules };
        // This load runs once per company switch, but it's several sequential round-trips
        // (locations, categories, ..., then this final app_records/assets fetch) and the app is
        // fully interactive the whole time -- nothing blocks a fast admin from opening Settings
        // and saving a new numbering prefix, or creating assets, before this very last step
        // resolves. Only apply what THIS fetch loaded for counters/numberingRules if nothing has
        // changed them locally since mount (still the untouched EMPTY_STATE default): otherwise
        // this stale, already-superseded DB snapshot would silently overwrite the save the user
        // already made and saw take effect, reverting it the instant this promise finally settles
        // (e.g. losing a just-saved Asset Tag prefix with no error or warning). When we skip
        // applying it, we also leave it un-registered with the sync engine (see above), so the
        // normal change-detection scan treats the user's local value as new and persists it.
        next.counters = prev.counters === EMPTY_STATE.counters ? counters : prev.counters;
        next.numberingRules = prev.numberingRules === EMPTY_STATE.numberingRules ? numberingRules : prev.numberingRules;
        if (dbAssets) next.assets = loadedAssets;
        for (const c of DOC_COLLECTIONS) next[c] = recErr ? prev[c] : (byCollection[c] || []);
        return next as AssetState;
      });

      // From here on every change made in the app is written to the database.
      if (syncEngine && !recErr) syncEngine.loaded = true;
    };

    fetchCompanyData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id, setState]);

  const me = useMemo(() => state.employees.find(e => e.id === currentUser.employeeId), [state.employees, currentUser]);

  const log = useCallback((entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
    setState(prev => ({ ...prev, activity: [activityEntry(entry), ...prev.activity].slice(0, 300) }));
  }, [setState]);

  const actorName = currentUser.name;
  const actorRole = currentUser.role;

  // -- Masters -----------------------------------------------------------


  const upsert = <T extends { id: string }>(list: T[], row: T): T[] =>
    list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [{ ...row, id: row.id || uid('row') }, ...list];

  const saveCategory = useCallback(async (category: AssetCategory) => {
    if (!currentCompany) return;
    const isNew = !isUuid(category.id);
    const payload: any = {
      company_id: currentCompany.id,
      code: category.code,
      name: category.name,
      parent_id: category.parentId || null,
      description: category.description || null,
      depreciation_method: category.depreciationMethod,
      useful_life_years: category.usefulLifeYears,
      salvage_value_pct: category.salvageValuePct,
      capitalization_threshold: category.capitalizationThreshold ?? 0,
      requires_amc: category.requiresAmc,
      requires_serial_number: category.requiresSerialNumber,
      track_components: category.trackComponents,
      active: category.active
    };
    if (!isNew) payload.id = category.id;

    const { data, error } = await supabase.from('asset_categories').upsert(payload).select().single();
    if (!error && data) setState(prev => ({ ...prev, categories: upsert(prev.categories, { ...category, id: data.id }) }));
    else console.error("Failed to save category", error);
  }, [setState, currentCompany]);

  const saveVariant = useCallback(async (variant: AssetVariant) => {
    if (!currentCompany) return;
    const isNew = !isUuid(variant.id);
    const payload: any = {
      company_id: currentCompany.id,
      category_id: variant.categoryId,
      code: variant.code,
      name: variant.name,
      make: variant.manufacturer || variant.name || '-',
      model: variant.modelNumber || variant.name || '-',
      specifications: variant.specifications || [],
      standard_cost: variant.standardCost || 0,
      warranty_months: variant.warrantyMonths || 0,
      uom: variant.uom || 'Nos',
      active: variant.active ?? true
    };
    if (!isNew) payload.id = variant.id;

    const { data, error } = await supabase.from('asset_variants').upsert(payload).select().single();
    if (!error && data) setState(prev => ({ ...prev, variants: upsert(prev.variants, { ...variant, id: data.id }) }));
    else console.error("Failed to save variant", error);
  }, [setState, currentCompany]);

  const saveLocation = useCallback(async (location: AssetLocation) => {
    if (!currentCompany) return;
    const isNew = !isUuid(location.id);
    const payload: any = {
      company_id: currentCompany.id,
      code: location.code,
      name: location.name,
      type: location.type,
      parent_id: location.parentId || null,
      address: location.address,
      city: location.city,
      state: location.state
    };
    if (!isNew) payload.id = location.id;

    const { data, error } = await supabase.from('locations').upsert(payload).select().single();
    if (!error && data) setState(prev => ({ ...prev, locations: upsert(prev.locations, { ...location, id: data.id }) }));
    else console.error("Failed to save location", error);
  }, [setState, currentCompany]);

  const saveDepartment = useCallback(async (department: Department) => {
    if (!currentCompany) return;
    const isNew = !isUuid(department.id);
    const payload: any = {
      company_id: currentCompany.id,
      code: department.code,
      name: department.name,
      cost_center: department.costCenter,
      head_employee_id: department.headEmployeeId || null
    };
    if (!isNew) payload.id = department.id;

    const { data, error } = await supabase.from('departments').upsert(payload).select().single();
    if (!error && data) setState(prev => ({ ...prev, departments: upsert(prev.departments, { ...department, id: data.id }) }));
    else console.error("Failed to save department", error);
  }, [setState, currentCompany]);

  const saveVendor = useCallback(async (vendor: Vendor) => {
    if (!currentCompany) return;
    const isNew = !isUuid(vendor.id);
    const payload: any = {
      company_id: currentCompany.id,
      code: vendor.code,
      name: vendor.name,
      gstin: vendor.gstin,
      contact_person: vendor.contactPerson,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      services: vendor.services,
      is_amc_partner: vendor.isAmcPartner,
      rating: vendor.rating,
      status: vendor.status,
      bank_account_name: vendor.bankAccountName || null,
      bank_account_number: vendor.bankAccountNumber || null,
      bank_ifsc: vendor.bankIfsc || null,
    };
    if (!isNew) payload.id = vendor.id;

    const { data, error } = await supabase.from('vendors').upsert(payload).select().single();
    if (!error && data) setState(prev => ({ ...prev, vendors: upsert(prev.vendors, { ...vendor, id: data.id }) }));
    else console.error("Failed to save vendor", error);
  }, [setState, currentCompany]);

  const deleteVendor = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const inUse = state.assets.filter(a => a.vendorId === id).length;
    if (inUse > 0) return { ok: false, error: `Cannot delete: ${inUse} asset(s) reference this vendor.` };
    const openPOs = state.purchaseOrders.filter(p => p.vendorId === id && ![DocStatus.Completed, DocStatus.Cancelled, DocStatus.Rejected].includes(p.status)).length;
    if (openPOs > 0) return { ok: false, error: `Cannot delete: ${openPOs} open purchase order(s) reference this vendor.` };
    const activeAmc = state.amcContracts.filter(c => c.vendorId === id && c.status !== DocStatus.Completed && c.status !== DocStatus.Cancelled).length;
    if (activeAmc > 0) return { ok: false, error: `Cannot delete: ${activeAmc} active AMC contract(s) reference this vendor.` };

    if (isUuid(id)) {
      const { data: del, error } = await supabase.from('vendors').delete().eq('id', id).select('id');
      if (error) { console.error('Failed to delete vendor', error); return { ok: false, error: error.message }; }
      if (!del || del.length === 0) return { ok: false, error: 'Delete was blocked by database permissions (only Admin/Management can delete masters).' };
    }
    setState(prev => ({ ...prev, vendors: prev.vendors.filter(v => v.id !== id) }));
    return { ok: true };
  }, [setState, state.assets, state.purchaseOrders, state.amcContracts]);

  const deleteDepartment = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const inUseAssets = state.assets.filter(a => a.departmentId === id).length;
    if (inUseAssets > 0) return { ok: false, error: `Cannot delete: ${inUseAssets} asset(s) are assigned to this department.` };
    const inUseEmployees = state.employees.filter(e => e.departmentId === id).length;
    if (inUseEmployees > 0) return { ok: false, error: `Cannot delete: ${inUseEmployees} employee(s) belong to this department.` };

    if (isUuid(id)) {
      const { data: del, error } = await supabase.from('departments').delete().eq('id', id).select('id');
      if (error) { console.error('Failed to delete department', error); return { ok: false, error: error.message }; }
      if (!del || del.length === 0) return { ok: false, error: 'Delete was blocked by database permissions (only Admin/Management can delete masters).' };
    }
    setState(prev => ({ ...prev, departments: prev.departments.filter(d => d.id !== id) }));
    return { ok: true };
  }, [setState, state.assets, state.employees]);

  const saveEmployee = useCallback(async (employee: Employee): Promise<{ ok: boolean; error?: string }> => {
    if (!currentCompany) return { ok: false, error: 'No company selected.' };
    const isNew = !isUuid(employee.id);
    const payload: any = {
      company_id: currentCompany.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      phone: employee.phone || null,
      designation: employee.designation,
      grade: employee.grade,
      department_id: employee.departmentId,
      location_id: employee.locationId,
      reports_to: employee.reportsTo || null,
      role: employee.role,
      status: employee.status,
      joined_on: employee.joinedOn,
      emergency_contact_name: employee.emergencyContactName || null,
      emergency_contact_phone: employee.emergencyContactPhone || null,
    };
    if (!isNew) payload.id = employee.id;

    const { data, error } = await supabase.from('employees').upsert(payload).select().single();
    if (error || !data) {
      console.error("Failed to save employee", error);
      return { ok: false, error: error?.message || 'Could not save the employee.' };
    }
    setState(prev => ({ ...prev, employees: upsert(prev.employees, { ...employee, id: data.id }) }));
    return { ok: true };
  }, [setState, currentCompany]);

  const deleteEmployee = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) { console.error("Failed to delete employee", error); return { ok: false, error: error.message }; }
    setState(prev => ({ ...prev, employees: prev.employees.filter(e => e.id !== id) }));
    return { ok: true };
  }, [setState]);

  const deleteCategory = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const inUse = state.assets.filter(a => a.categoryId === id).length;
    if (inUse > 0) return { ok: false, error: `Cannot delete: ${inUse} asset(s) use this category.` };
    if (state.categories.some(c => c.parentId === id)) return { ok: false, error: 'Cannot delete: it has sub-categories. Delete or move them first.' };

    // Records that never reached the database (temporary ids) only exist locally.
    if (isUuid(id)) {
      const { data: del, error } = await supabase.from('asset_categories').delete().eq('id', id).select('id');
      if (error) { console.error('Failed to delete category', error); return { ok: false, error: error.message }; }
      if (!del || del.length === 0) return { ok: false, error: 'Delete was blocked by database permissions (only Admin/Management can delete masters).' };
    }
    setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id), variants: prev.variants.filter(v => v.categoryId !== id) }));
    return { ok: true };
  }, [setState, state.assets, state.categories]);

  const deleteLocation = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const inUse = state.assets.filter(a => a.locationId === id).length;
    if (inUse > 0) return { ok: false, error: `Cannot delete: ${inUse} asset(s) are at this location.` };
    const emps = state.employees.filter(e => e.locationId === id).length;
    if (emps > 0) return { ok: false, error: `Cannot delete: ${emps} employee(s) are assigned to this location.` };
    if (state.locations.some(l => l.parentId === id)) return { ok: false, error: 'Cannot delete: it has child locations. Delete or move them first.' };

    if (isUuid(id)) {
      const { data: del, error } = await supabase.from('locations').delete().eq('id', id).select('id');
      if (error) { console.error('Failed to delete location', error); return { ok: false, error: error.message }; }
      if (!del || del.length === 0) return { ok: false, error: 'Delete was blocked by database permissions (only Admin/Management can delete masters).' };
    }
    setState(prev => ({ ...prev, locations: prev.locations.filter(l => l.id !== id) }));
    return { ok: true };
  }, [setState, state.assets, state.employees, state.locations]);

  // -- Asset register ------------------------------------------------------

  const createAssetManually = useCallback(async (draft: Omit<Asset, 'id' | 'history'>) => {
    if (!currentCompany) return '';

    // Auto-generate a tag that continues the company-wide running sequence (the same scheme
    // GRN receipts and CWIP capitalisation now use too) whenever the admin leaves Asset Tag
    // blank, wrapped in whatever prefix/suffix is configured on the Settings page -- e.g.
    // "AST-" + "0002" -> AST-0002. A tag typed in by hand is left exactly as entered (already
    // wrapped by the same rule via CodeField's onBlur in the form).
    const manualAssetTag = draft.assetTag?.trim();
    let assetTag = manualAssetTag;
    let counterValue = 0;
    // Seed the counter from whatever's already in the register (seed data, the old scheme,
    // hand-typed tags) so a brand-new counter never collides with a pre-existing tag.
    let workingCounters = manualAssetTag
      ? state.counters
      : seedAssetTagCounter(state.counters, state.assets, state.numberingRules.assetTag);

    const buildPayload = (tag: string) => ({
      company_id: currentCompany.id,
      name: draft.name,
      asset_tag: tag,
      category_id: draft.categoryId,
      variant_id: draft.variantId || null,
      serial_number: draft.serialNumber || null,
      status: draft.status,
      condition: draft.condition,
      criticality: draft.criticality,
      department_id: draft.departmentId,
      location_id: draft.locationId,
      sub_location: draft.subLocation || null,
      vendor_id: draft.vendorId || null,
      purchase_date: draft.purchaseDate,
      capitalized_on: draft.capitalizedOn,
      purchase_cost: draft.purchaseCost,
      useful_life_years: draft.usefulLifeYears,
      salvage_value_pct: draft.salvageValuePct,
      depreciation_method: draft.depreciationMethod
    });

    let data: { id: string } | null = null;
    let error: { code?: string; message?: string } | null = null;

    // Up to 5 attempts: if the chosen tag turns out to already exist (23505 -- e.g. another
    // tab/admin grabbed the same number a moment ago, or the seed above still missed something),
    // just draw the next number in the sequence and retry rather than failing the whole save.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!manualAssetTag) {
        const seqResult = nextAssetTagSequence(workingCounters);
        workingCounters = seqResult.counters;
        assetTag = applyNumberingRule(state.numberingRules.assetTag, String(seqResult.seq));
        counterValue = seqResult.seq;
      }

      const res = await supabase.from('assets').insert(buildPayload(assetTag!)).select().single();
      data = res.data;
      error = res.error;

      if (!error) break;
      if (error.code !== '23505' || manualAssetTag) break; // only retry auto-generated tags on a dup-key conflict
    }

    if (error || !data) {
      console.error("Failed to create asset in Supabase:", error);
      return '';
    } else {
      const asset: Asset = {
        ...draft,
        assetTag: assetTag!,
        id: data.id,
        history: [{ id: uid('evt'), date: today(), type: AssetEventType.Created, title: 'Asset registered', detail: 'Manually added to register', actor: actorName }]
      };
      syncEngine?.registerAssetRow(asset);
      setState(prev => ({
        ...prev,
        assets: [asset, ...prev.assets],
        // Merge with Math.max so a concurrent write that already advanced this counter further
        // (another tab, another admin) is never regressed by this one.
        counters: counterValue > 0
          ? { ...prev.counters, [ASSET_TAG_SEQUENCE_KEY]: Math.max(prev.counters[ASSET_TAG_SEQUENCE_KEY] || 0, counterValue) }
          : prev.counters,
      }));
      log({ actor: actorName, actorRole, action: 'Asset Created', entityType: 'Asset', entityId: data.id, summary: `Manually registered asset ${draft.name}`, severity: 'info' });
      return data.id;
    }
  }, [setState, log, actorName, actorRole, currentCompany, syncEngine, state.counters, state.numberingRules, state.assets]);

  const bulkUploadAssets = useCallback(async (drafts: Omit<Asset, 'id' | 'history'>[], fileName?: string): Promise<{ ok: boolean; error?: string }> => {
    if (!currentCompany) return { ok: false, error: 'No company selected.' };

    // Master records must already be saved in Supabase (real UUIDs) before assets can reference them.
    const badRef = drafts.findIndex(a => !isUuid(a.categoryId) || !isUuid(a.locationId) || !isUuid(a.departmentId));
    if (badRef >= 0) {
      const msg = `Row ${badRef + 1} references a category/location/department that is not saved in the database yet. Re-save it under Masters, or reload the page.`;
      console.error(msg, drafts[badRef]);
      return { ok: false, error: msg };
    }

    // Record this upload under Asset Upload History (same `upload_history` table Masters already
    // uses) *before* inserting the assets, so every asset created below can carry its id and the
    // whole batch can later be deleted as one unit from the Asset Register -- deleting this row
    // cascades (ON DELETE CASCADE, see supabase/15_asset_uploads.sql) and removes every asset that
    // was created from it. Not fatal if this insert fails (e.g. older DB without the table/migration
    // applied yet) -- the assets themselves still get created, they just won't be grouped under a
    // deletable batch.
    let uploadId: string | undefined;
    const { data: historyRow, error: historyError } = await supabase
      .from('upload_history')
      .insert({ entity_type: 'Assets', file_name: fileName || 'assets.csv', record_count: drafts.length, created_by: currentUser.id, company_id: currentCompany.id })
      .select()
      .single();
    if (historyError) {
      console.warn('Could not create an Asset Upload History record (assets will still be created without one):', historyError);
    } else {
      uploadId = historyRow?.id;
    }

    // Each row carries its own client-generated id into the insert, rather than letting Postgres
    // assign one and zipping the response back to `drafts` by array position afterwards — a
    // multi-row `INSERT ... RETURNING` is not contractually guaranteed to preserve input order,
    // so matching by index could silently attach one row's returned id/capitalized values to a
    // DIFFERENT row's name/serial/criticality on the rare occasion the order doesn't match.
    // Matching by this id is correct regardless of what order Postgres returns rows in.
    const draftsWithId = drafts.map(a => ({ ...a, id: uid('asset'), uploadId }));
    const dbPayloads = draftsWithId.map(a => {
      const cat = state.categories.find(c => c.id === a.categoryId);
      return {
        id: a.id,
        company_id: currentCompany.id,
        name: a.name,
        asset_tag: a.assetTag || null,
        category_id: a.categoryId,
        variant_id: a.variantId || null,
        serial_number: a.serialNumber || null,
        status: a.status,
        condition: a.condition,
        criticality: a.criticality,
        department_id: a.departmentId,
        location_id: a.locationId,
        sub_location: a.subLocation || null,
        vendor_id: a.vendorId || null,
        purchase_date: a.purchaseDate,
        capitalized_on: a.capitalizedOn || a.purchaseDate,
        purchase_cost: a.purchaseCost,
        useful_life_years: a.usefulLifeYears ?? cat?.usefulLifeYears ?? 5,
        salvage_value_pct: a.salvageValuePct ?? cat?.salvageValuePct ?? 5,
        depreciation_method: a.depreciationMethod ?? cat?.depreciationMethod,
        upload_id: uploadId || null,
      };
    });

    const { data, error } = await supabase.from('assets').insert(dbPayloads).select();

    if (error || !data) {
      console.error("Failed to bulk upload assets to Supabase:", error);
      // Roll back the just-created upload_history row so a failed batch doesn't leave a ghost
      // entry (0 assets, nothing to delete) sitting in Asset Upload History.
      if (uploadId) await supabase.from('upload_history').delete().eq('id', uploadId);
      return { ok: false, error: error?.message || 'Unknown database error.' };
    }

    const byId = new Map(data.map(d => [d.id, d]));
    const newAssets: Asset[] = draftsWithId.map(draft => {
      const d = byId.get(draft.id);
      return {
        ...draft,
        capitalizedOn: d?.capitalized_on ?? draft.capitalizedOn,
        usefulLifeYears: d ? Number(d.useful_life_years) : draft.usefulLifeYears,
        salvageValuePct: d ? Number(d.salvage_value_pct) : draft.salvageValuePct,
        depreciationMethod: d?.depreciation_method ?? draft.depreciationMethod,
        history: [{ id: uid('evt'), date: today(), type: AssetEventType.Created, title: 'Asset bulk uploaded', detail: 'Imported via CSV', actor: actorName }]
      };
    });

    newAssets.forEach(a => syncEngine?.registerAssetRow(a));
    setState(prev => ({ ...prev, assets: [...newAssets, ...prev.assets] }));
    log({ actor: actorName, actorRole, action: 'Bulk Upload', entityType: 'Asset', entityId: 'bulk', summary: `Bulk imported ${drafts.length} assets`, severity: 'info' });
    return { ok: true };
  }, [setState, log, actorName, actorRole, currentCompany, currentUser, state.categories, syncEngine]);

  const deleteAsset = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    // Don't delete an asset something else is still actively pointing at -- that would leave a
    // service ticket, transfer, gate pass, replacement or disposal referencing an asset that no
    // longer exists. The same open-reference check already shown to the admin in the asset
    // drawer (see `openRefs` in AssetRegister.tsx) gates the delete itself here.
    const openDocStatuses = [DocStatus.Completed, DocStatus.Cancelled, DocStatus.Rejected];
    const blockers: string[] = [];
    if (state.serviceTickets.some(t => t.assetId === id && !openDocStatuses.includes(t.status))) blockers.push('an open service ticket');
    if (state.transfers.some(t => t.assetIds.includes(id) && !openDocStatuses.includes(t.status))) blockers.push('an open transfer');
    if (state.gatePasses.some(g => g.assetIds.includes(id) && ![DocStatus.Returned, DocStatus.Cancelled, DocStatus.Rejected].includes(g.status))) blockers.push('an open gate pass');
    if (state.replacements.some(r => r.oldAssetId === id && !openDocStatuses.includes(r.status))) blockers.push('an open replacement');
    if (state.disposals.some(d => d.lines.some(l => l.assetId === id) && !openDocStatuses.includes(d.status))) blockers.push('an open disposal');
    if (blockers.length > 0) {
      return { ok: false, error: `Cannot delete: this asset is referenced by ${blockers.join(', ')}. Close or cancel it first.` };
    }

    if (isUuid(id)) {
      const { data: del, error } = await supabase.from('assets').delete().eq('id', id).select('id');
      if (error) { console.error('Failed to delete asset', error); return { ok: false, error: error.message }; }
      if (!del || del.length === 0) return { ok: false, error: 'Delete was blocked by database permissions (only Admin/Management can delete assets).' };
      // Best-effort cleanup of the asset's history/meta doc in app_records -- an orphaned row here
      // is harmless cruft (nothing reads it without a matching asset), so a failure isn't fatal.
      if (currentCompany) {
        await supabase.from('app_records').delete().match({ company_id: currentCompany.id, collection: ASSET_META_COLLECTION, id });
      }
    }

    setState(prev => ({
      ...prev,
      assets: prev.assets.filter(a => a.id !== id),
      components: prev.components.filter(c => c.assetId !== id),
    }));
    log({ actor: actorName, actorRole, action: 'Asset Deleted', entityType: 'Asset', entityId: id, summary: 'Asset permanently deleted from the register.', severity: 'warning' });
    return { ok: true };
  }, [setState, log, actorName, actorRole, currentCompany, state.serviceTickets, state.transfers, state.gatePasses, state.replacements, state.disposals]);

  const deleteAssetUploadBatch = useCallback(async (uploadId: string): Promise<{ ok: boolean; error?: string }> => {
    // Deletes the upload_history row for this batch; ON DELETE CASCADE on assets.upload_id (see
    // supabase/15_asset_uploads.sql) removes every asset created from that sheet along with it.
    // Unlike a single asset delete, this intentionally does NOT check for open references on each
    // asset first -- the admin is explicitly undoing an entire erroneous upload, and a reference
    // left dangling by that is the same tradeoff the existing Masters "delete upload" already makes.
    const { data: del, error } = await supabase.from('upload_history').delete().eq('id', uploadId).select('id');
    if (error) { console.error('Failed to delete asset upload batch', error); return { ok: false, error: error.message }; }
    if (!del || del.length === 0) return { ok: false, error: 'Delete was blocked by database permissions (only Admin/Management can delete uploads).' };

    const removedIds = new Set(state.assets.filter(a => a.uploadId === uploadId).map(a => a.id));
    setState(prev => ({
      ...prev,
      assets: prev.assets.filter(a => a.uploadId !== uploadId),
      components: prev.components.filter(c => !removedIds.has(c.assetId)),
    }));
    log({ actor: actorName, actorRole, action: 'Asset Upload Deleted', entityType: 'Asset', entityId: uploadId, summary: `Deleted an asset upload batch and the ${removedIds.size} asset(s) it created.`, severity: 'warning' });
    return { ok: true };
  }, [setState, log, actorName, actorRole, state.assets]);

  const addComponent = useCallback((assetId: string, component: Omit<AssetComponent, 'id' | 'assetId'>) => {
    const row: AssetComponent = { ...component, id: uid('comp'), assetId };
    setState(prev => ({
      ...prev,
      components: [row, ...prev.components],
      assets: prev.assets.map(a =>
        a.id === assetId
          ? pushHistory(a, { date: today(), type: AssetEventType.ComponentAdded, title: `${component.name} added`, detail: component.remarks || 'Component recorded against asset.', actor: actorName })
          : a,
      ),
    }));
    log({ actor: actorName, actorRole, action: 'Component added', entityType: 'Asset', entityId: assetId, summary: `Added component "${component.name}".`, severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  const retireComponent = useCallback((assetId: string, componentId: string, status: ComponentStatus.Removed | ComponentStatus.Faulty) => {
    setState(prev => ({
      ...prev,
      components: prev.components.map(c => (c.id === componentId ? { ...c, status, removedOn: status === ComponentStatus.Removed ? today() : c.removedOn } : c)),
      assets: prev.assets.map(a =>
        a.id === assetId
          ? pushHistory(a, { date: today(), type: AssetEventType.ComponentRemoved, title: 'Component update', detail: `Component marked ${status}.`, actor: actorName })
          : a,
      ),
    }));
  }, [setState, actorName]);

  const updateAssetFields = useCallback((assetId: string, patch: Partial<Asset>, note?: string) => {
    setState(prev => ({
      ...prev,
      assets: prev.assets.map(a =>
        a.id === assetId
          ? pushHistory({ ...a, ...patch }, { date: today(), type: AssetEventType.Updated, title: 'Asset updated', detail: note || 'Asset record updated.', actor: actorName })
          : a,
      ),
    }));
  }, [setState, actorName]);

  // -- Procurement: Requisition ---------------------------------------------

  const saveRequisitionDraft = useCallback((draft: Omit<Requisition, 'id' | 'prNo' | 'status' | 'approvals' | 'createdOn'>) => {
    const id = uid('req');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'requisition');
      const row: Requisition = { ...draft, id, prNo: docNo, status: DocStatus.Draft, approvals: [], createdOn: today() };
      return { ...prev, requisitions: [row, ...prev.requisitions], counters };
    });
    return id;
  }, [setState]);

  const submitRequisition = useCallback((draft: Omit<Requisition, 'id' | 'prNo' | 'status' | 'approvals' | 'createdOn'>) => {
    const id = uid('req');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'requisition');
      const categoryIds = draft.lines.map(l => l.categoryId);
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.Requisition, draft.estimatedValue, { categoryIds, locationIds: [draft.locationId] });
      const row: Requisition = { ...draft, id, prNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Approved, approvals, createdOn: today() };
      return { ...prev, requisitions: [row, ...prev.requisitions], counters };
    });
    log({ actor: actorName, actorRole, action: 'Requisition submitted', entityType: 'Requisition', entityId: id, summary: `Submitted requisition for ${draft.justification.slice(0, 80)}`, severity: 'info' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const actOnRequisition = useCallback((id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => {
    setState(prev => ({
      ...prev,
      requisitions: prev.requisitions.map(r => {
        if (r.id !== id) return r;
        const approvals = applyDecision(r.approvals, decision, actorName, remarks);
        return { ...r, approvals, status: chainOutcome(approvals) };
      }),
    }));
    log({ actor: actorName, actorRole, action: `Requisition ${decision.toLowerCase()}`, entityType: 'Requisition', entityId: id, summary: remarks || `${decision} by ${actorName}`, severity: decision === ApprovalStatus.Rejected ? 'warning' : 'info' });
  }, [setState, log, actorName, actorRole]);

  const convertRequisitionToPo = useCallback((prId: string, vendorId: string, expectedDeliveryDate: string): string => {
    const poId = uid('po');
    setState(prev => {
      const req = prev.requisitions.find(r => r.id === prId);
      if (!req || req.status !== DocStatus.Approved) return prev;
      const { docNo, counters } = nextDocNo(prev.counters, 'purchaseOrder');
      const lines = req.lines.map(l => ({
        id: uid('pol'), categoryId: l.categoryId, variantId: l.variantId, description: l.description,
        quantity: l.quantity, unitPrice: l.estimatedUnitCost, taxPercent: 18, receivedQty: 0,
      }));
      const subTotal = lines.reduce((t, l) => t + l.quantity * l.unitPrice, 0);
      const taxTotal = Math.round(subTotal * 0.18);
      const categoryIds = lines.map(l => l.categoryId);
      const amount = subTotal + taxTotal;
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.PurchaseOrder, amount, { categoryIds, locationIds: [req.locationId] });
      const po: PurchaseOrder = {
        id: poId, poNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Approved, approvals,
        prId: req.id, prNo: req.prNo, vendorId, orderDate: today(), expectedDeliveryDate, deliverToLocationId: req.locationId,
        departmentId: req.departmentId, lines, subTotal, taxTotal, grandTotal: amount, paymentTerms: 'Net 30',
        warrantyTerms: 'As per vendor standard warranty', createdById: req.requestedById,
      };
      return {
        ...prev, counters,
        purchaseOrders: [po, ...prev.purchaseOrders],
        requisitions: prev.requisitions.map(r => (r.id === prId ? { ...r, status: DocStatus.Converted, poId, poNo: docNo } : r)),
      };
    });
    log({ actor: actorName, actorRole, action: 'Requisition converted to PO', entityType: 'Requisition', entityId: prId, summary: 'Converted approved requisition into a purchase order.', severity: 'info' });
    return poId;
  }, [setState, log, actorName, actorRole]);

  // -- Procurement: Purchase Order & GRN ------------------------------------

  const createPurchaseOrder = useCallback((draft: Omit<PurchaseOrder, 'id' | 'poNo' | 'status' | 'approvals'>) => {
    const id = uid('po');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'purchaseOrder');
      const categoryIds = draft.lines.map(l => l.categoryId);
      let approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.PurchaseOrder, draft.grandTotal, { categoryIds, locationIds: [draft.deliverToLocationId] });
      // AUDIT fix PROC-01: a PO raised under the emergency-purchase exception (no source
      // Requisition) always needs the highest configured sign-off, regardless of amount — the
      // normal amount-banded chain above might otherwise be empty or low-level for a small-value
      // emergency purchase, which would defeat the point of flagging it as an exception at all.
      if (draft.isEmergencyPurchase) {
        const forced = forceTopLevelStep(prev.doaRules, ApprovalDocType.PurchaseOrder);
        if (forced && !approvals.some(step => step.ruleId === forced.ruleId)) {
          approvals = [...approvals, forced].sort((a, b) => a.level - b.level);
        }
      }
      const po: PurchaseOrder = { ...draft, id, poNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Approved, approvals };
      return {
        ...prev, counters,
        purchaseOrders: [po, ...prev.purchaseOrders],
        // Mark the source requisition Converted so it drops out of the "eligible" pool in
        // pages/PurchaseOrders.tsx and can't be picked for a second PO. convertRequisitionToPo
        // already does this on its own path; this form is the other path to the same outcome.
        requisitions: draft.prId
          ? prev.requisitions.map(r => (r.id === draft.prId ? { ...r, status: DocStatus.Converted, poId: id, poNo: docNo } : r))
          : prev.requisitions,
      };
    });
    log({
      actor: actorName, actorRole, action: 'Purchase order raised', entityType: 'PurchaseOrder', entityId: id,
      summary: draft.isEmergencyPurchase
        ? `Raised EMERGENCY PO (no requisition) worth ${draft.grandTotal}. Justification: ${draft.emergencyJustification || '—'}`
        : `Raised PO worth ${draft.grandTotal} against requisition ${draft.prNo || '—'}.`,
      severity: draft.isEmergencyPurchase ? 'warning' : 'info',
    });
    return id;
  }, [setState, log, actorName, actorRole]);

  const actOnPurchaseOrder = useCallback((id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => {
    setState(prev => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map(po => {
        if (po.id !== id) return po;
        const approvals = applyDecision(po.approvals, decision, actorName, remarks);
        const outcome = chainOutcome(approvals);
        return { ...po, approvals, status: outcome === DocStatus.Approved ? DocStatus.Approved : outcome };
      }),
    }));
    log({ actor: actorName, actorRole, action: `Purchase order ${decision.toLowerCase()}`, entityType: 'PurchaseOrder', entityId: id, summary: remarks || `${decision} by ${actorName}`, severity: decision === ApprovalStatus.Rejected ? 'warning' : 'info' });
  }, [setState, log, actorName, actorRole]);

  const postGrn = useCallback((draft: Omit<Grn, 'id' | 'grnNo' | 'status' | 'createdAssetIds'>): { id: string; createdAssetIds: string[] } => {
    const id = uid('grn');
    let createdAssetIdsResult: string[] = [];
    setState(prev => {
      const po = prev.purchaseOrders.find(p => p.id === draft.poId);
      if (!po) return prev;
      const { docNo, counters: c1 } = nextDocNo(prev.counters, 'grn');
      // Catch the asset-tag counter up to reality before drawing any numbers for this GRN's
      // lines, so a freshly-introduced counter never collides with a pre-existing tag.
      let counters = seedAssetTagCounter(c1, prev.assets, prev.numberingRules.assetTag);
      const createdAssetIds: string[] = [];
      const newAssets: Asset[] = [];

      draft.lines.forEach((line: GrnLine) => {
        const category = prev.categories.find(cat => cat.id === line.categoryId);
        for (let i = 0; i < line.acceptedQty; i += 1) {
          // Company-wide running sequence wrapped in the Settings-configured Asset Tag
          // prefix/suffix, same scheme the manual "Add Asset" and CWIP-capitalisation paths use.
          const seqResult = nextAssetTagSequence(counters);
          counters = seqResult.counters;
          const assetTag = applyNumberingRule(prev.numberingRules.assetTag, String(seqResult.seq));
          const assetId = uid('asset');
          const asset: Asset = {
            id: assetId,
            assetTag,
            name: line.description,
            categoryId: line.categoryId,
            variantId: line.variantId,
            serialNumber: line.serialNumbers[i] || `${assetTag}-SN`,
            status: AssetStatus.InStore,
            condition: AssetCondition.New,
            criticality: category?.trackComponents ? Criticality.Medium : Criticality.Low,
            departmentId: draft.departmentId,
            locationId: draft.locationId,
            vendorId: draft.vendorId,
            poNo: po.poNo,
            grnNo: docNo,
            invoiceNo: draft.invoiceNo,
            purchaseDate: draft.receivedOn,
            capitalizedOn: draft.receivedOn,
            purchaseCost: line.unitPrice,
            usefulLifeYears: category?.usefulLifeYears || 5,
            salvageValuePct: category?.salvageValuePct || 5,
            depreciationMethod: category?.depreciationMethod || DepreciationMethod.SLM,
            history: [{ id: uid('evt'), date: draft.receivedOn, type: AssetEventType.Created, title: 'Asset capitalised', detail: `Received against ${po.poNo}`, actor: actorName, refNo: docNo }],
          };
          newAssets.push(asset);
          createdAssetIds.push(assetId);
        }
      });

      const grn: Grn = { ...draft, id, grnNo: docNo, status: DocStatus.Received, createdAssetIds };
      createdAssetIdsResult = createdAssetIds;

      const updatedPoLines = po.lines.map(pl => {
        const grnLine = draft.lines.find(l => l.poLineId === pl.id);
        return grnLine ? { ...pl, receivedQty: pl.receivedQty + grnLine.acceptedQty } : pl;
      });
      const fullyReceived = updatedPoLines.every(pl => pl.receivedQty >= pl.quantity);
      const partiallyReceived = updatedPoLines.some(pl => pl.receivedQty > 0);

      return {
        ...prev,
        counters,
        grns: [grn, ...prev.grns],
        assets: [...newAssets, ...prev.assets],
        purchaseOrders: prev.purchaseOrders.map(p =>
          p.id === po.id ? { ...p, lines: updatedPoLines, status: fullyReceived ? DocStatus.Received : partiallyReceived ? DocStatus.PartiallyReceived : p.status } : p,
        ),
      };
    });
    log({ actor: actorName, actorRole, action: 'GRN posted', entityType: 'Grn', entityId: id, summary: `Goods received against ${draft.poNo}.`, severity: 'info' });
    // Previously this stashed the ids on `window.__lastGrnCreatedIds__` for the caller to read
    // back 100ms later via setTimeout — a fixed, unsynchronized delay that a second GRN posted
    // within that window (double-click, or two tabs) would overwrite, silently handing the bulk
    // label print the WRONG GRN's asset ids. Returning them directly removes that race entirely.
    return { id, createdAssetIds: createdAssetIdsResult };
  }, [setState, log, actorName, actorRole]);

  // -- Movement: Transfers ---------------------------------------------------

  const createTransfer = useCallback((draft: Omit<Transfer, 'id' | 'transferNo' | 'status' | 'approvals' | 'createdOn'>): string => {
    const id = uid('trf');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'transfer');
      const categoryIds = draft.assetIds.map(aid => prev.assets.find(a => a.id === aid)?.categoryId).filter(Boolean) as string[];
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.Transfer, draft.value, { categoryIds, locationIds: [draft.fromLocationId, draft.toLocationId] });
      const row: Transfer = { ...draft, id, transferNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Approved, approvals, createdOn: today() };
      return { ...prev, transfers: [row, ...prev.transfers], counters };
    });
    log({ actor: actorName, actorRole, action: 'Transfer requested', entityType: 'Transfer', entityId: id, summary: draft.reason, severity: 'info' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const actOnTransfer = useCallback((id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => {
    setState(prev => ({
      ...prev,
      transfers: prev.transfers.map(t => {
        if (t.id !== id) return t;
        const approvals = applyDecision(t.approvals, decision, actorName, remarks);
        return { ...t, approvals, status: chainOutcome(approvals) };
      }),
    }));
    log({ actor: actorName, actorRole, action: `Transfer ${decision.toLowerCase()}`, entityType: 'Transfer', entityId: id, summary: remarks || `${decision} by ${actorName}`, severity: decision === ApprovalStatus.Rejected ? 'warning' : 'info' });
  }, [setState, log, actorName, actorRole]);

  const dispatchTransfer = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      transfers: prev.transfers.map(t => (t.id === id ? { ...t, status: DocStatus.InTransit, dispatchedOn: today() } : t)),
      assets: prev.assets.map(a => {
        const transfer = prev.transfers.find(t => t.id === id);
        return transfer && transfer.assetIds.includes(a.id)
          ? pushHistory({ ...a, status: AssetStatus.InTransit }, { date: today(), type: AssetEventType.Transferred, title: 'Dispatched', detail: `Dispatched under ${transfer.transferNo}`, actor: actorName, refNo: transfer.transferNo })
          : a;
      }),
    }));
    log({ actor: actorName, actorRole, action: 'Transfer dispatched', entityType: 'Transfer', entityId: id, summary: 'Assets dispatched to destination.', severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  const receiveTransfer = useCallback((id: string, remarks?: string) => {
    setState(prev => {
      const transfer = prev.transfers.find(t => t.id === id);
      if (!transfer) return prev;
      return {
        ...prev,
        transfers: prev.transfers.map(t => (t.id === id ? { ...t, status: DocStatus.Completed, receivedOn: today(), acknowledgedById: currentUser.employeeId, acknowledgementRemarks: remarks } : t)),
        assets: prev.assets.map(a =>
          transfer.assetIds.includes(a.id)
            ? pushHistory(
              {
                ...a,
                status: transfer.toCustodianId ? AssetStatus.InUse : AssetStatus.InStore,
                locationId: transfer.toLocationId,
                departmentId: transfer.toDepartmentId,
                custodianId: transfer.toCustodianId,
              },
              { date: today(), type: AssetEventType.Returned, title: 'Received at destination', detail: `Acknowledged under ${transfer.transferNo}`, actor: actorName, refNo: transfer.transferNo },
            )
            : a,
        ),
      };
    });
    log({ actor: actorName, actorRole, action: 'Transfer completed', entityType: 'Transfer', entityId: id, summary: 'Assets acknowledged at destination.', severity: 'info' });
  }, [setState, log, actorName, actorRole, currentUser]);

  // -- Movement: Gate passes --------------------------------------------------

  const createGatePass = useCallback((draft: Omit<GatePass, 'id' | 'gatePassNo' | 'status' | 'approvals' | 'createdOn'>): string => {
    const id = uid('gp');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'gatePass');
      const categoryIds = draft.assetIds.map(aid => prev.assets.find(a => a.id === aid)?.categoryId).filter(Boolean) as string[];
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.GatePass, draft.value, { categoryIds, locationIds: [draft.fromLocationId] });
      const row: GatePass = { ...draft, id, gatePassNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Approved, approvals, createdOn: today() };
      return { ...prev, gatePasses: [row, ...prev.gatePasses], counters };
    });
    log({ actor: actorName, actorRole, action: 'Gate pass requested', entityType: 'GatePass', entityId: id, summary: `${draft.purpose} - ${draft.issuedToName}`, severity: 'info' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const actOnGatePass = useCallback((id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => {
    setState(prev => ({
      ...prev,
      gatePasses: prev.gatePasses.map(g => {
        if (g.id !== id) return g;
        const approvals = applyDecision(g.approvals, decision, actorName, remarks);
        return { ...g, approvals, status: chainOutcome(approvals) };
      }),
    }));
    log({ actor: actorName, actorRole, action: `Gate pass ${decision.toLowerCase()}`, entityType: 'GatePass', entityId: id, summary: remarks || `${decision} by ${actorName}`, severity: decision === ApprovalStatus.Rejected ? 'warning' : 'info' });
  }, [setState, log, actorName, actorRole]);

  const issueGatePass = useCallback((id: string) => {
    setState(prev => {
      const gatePass = prev.gatePasses.find(g => g.id === id);
      if (!gatePass) return prev;
      const nextStatus = gatePass.purpose === 'Sent for Repair' ? AssetStatus.UnderRepair
        : gatePass.purpose === 'Scrap / Disposal' || gatePass.purpose === 'Sale / Handover to Buyer' ? AssetStatus.AwaitingDisposal
          : AssetStatus.IssuedOut;
      return {
        ...prev,
        gatePasses: prev.gatePasses.map(g => (g.id === id ? { ...g, status: DocStatus.Issued } : g)),
        assets: prev.assets.map(a =>
          gatePass.assetIds.includes(a.id)
            ? pushHistory({ ...a, status: nextStatus }, { date: today(), type: AssetEventType.GatePassIssued, title: 'Gate pass issued', detail: `Issued to ${gatePass.issuedToName} - ${gatePass.destination}`, actor: actorName, refNo: gatePass.gatePassNo })
            : a,
        ),
      };
    });
    log({ actor: actorName, actorRole, action: 'Gate pass issued', entityType: 'GatePass', entityId: id, summary: 'Assets physically moved out on gate pass.', severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  const returnGatePass = useCallback((id: string, remarks?: string) => {
    setState(prev => {
      const gatePass = prev.gatePasses.find(g => g.id === id);
      if (!gatePass) return prev;
      return {
        ...prev,
        gatePasses: prev.gatePasses.map(g => (g.id === id ? { ...g, status: DocStatus.Returned, actualReturnDate: today(), securityRemarks: remarks } : g)),
        assets: prev.assets.map(a =>
          gatePass.assetIds.includes(a.id)
            ? pushHistory({ ...a, status: a.custodianId ? AssetStatus.InUse : AssetStatus.InStore }, { date: today(), type: AssetEventType.GatePassReturned, title: 'Gate pass returned', detail: remarks || 'Asset returned to premises.', actor: actorName, refNo: gatePass.gatePassNo })
            : a,
        ),
      };
    });
    log({ actor: actorName, actorRole, action: 'Gate pass returned', entityType: 'GatePass', entityId: id, summary: 'Asset returned to company premises.', severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  // -- Maintenance: AMC --------------------------------------------------------

  const createAmcContract = useCallback((draft: Omit<AmcContract, 'id' | 'contractNo' | 'status' | 'approvals' | 'createdOn'>): string => {
    const id = uid('amc');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'amc');
      const categoryIds = draft.assetIds.map(aid => prev.assets.find(a => a.id === aid)?.categoryId).filter(Boolean) as string[];
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.AmcContract, draft.contractValue, { categoryIds, locationIds: [] });
      const row: AmcContract = { ...draft, id, contractNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Active, approvals, createdOn: today() };
      return { ...prev, amcContracts: [row, ...prev.amcContracts], counters };
    });
    log({ actor: actorName, actorRole, action: 'AMC contract drafted', entityType: 'AmcContract', entityId: id, summary: `Drafted AMC covering ${draft.assetIds.length} asset(s).`, severity: 'info' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const actOnAmc = useCallback((id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => {
    setState(prev => {
      const contract = prev.amcContracts.find(c => c.id === id);
      if (!contract) return prev;
      const approvals = applyDecision(contract.approvals, decision, actorName, remarks);
      const outcome = chainOutcome(approvals);
      const finalStatus = outcome === DocStatus.Approved ? DocStatus.Active : outcome;
      const justActivated = finalStatus === DocStatus.Active;
      return {
        ...prev,
        amcContracts: prev.amcContracts.map(c => {
          if (c.id === id) return { ...c, approvals, status: finalStatus };
          // Once a renewal is fully approved, the contract it supersedes is closed out.
          if (justActivated && contract.renewedFromId && c.id === contract.renewedFromId) return { ...c, status: DocStatus.Renewed };
          return c;
        }),
        assets: justActivated
          ? prev.assets.map(a =>
            contract.assetIds.includes(a.id)
              ? pushHistory({ ...a, amcContractId: contract.id }, { date: today(), type: AssetEventType.AmcLinked, title: 'AMC linked', detail: `Covered under ${contract.contractNo}`, actor: actorName, refNo: contract.contractNo })
              : a,
          )
          : prev.assets,
      };
    });
    log({ actor: actorName, actorRole, action: `AMC ${decision.toLowerCase()}`, entityType: 'AmcContract', entityId: id, summary: remarks || `${decision} by ${actorName}`, severity: decision === ApprovalStatus.Rejected ? 'warning' : 'info' });
  }, [setState, log, actorName, actorRole]);

  const logAmcVisit = useCallback((id: string, visit: Omit<AmcVisit, 'id'>) => {
    setState(prev => ({
      ...prev,
      amcContracts: prev.amcContracts.map(c => (c.id === id ? { ...c, visits: [...c.visits, { ...visit, id: uid('visit') }] } : c)),
    }));
    log({ actor: actorName, actorRole, action: 'AMC visit logged', entityType: 'AmcContract', entityId: id, summary: visit.remarks || `${visit.type} visit recorded.`, severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  const renewAmcContract = useCallback((id: string, updates: { startDate: string; endDate: string; contractValue: number }): string => {
    const newId = uid('amc');
    setState(prev => {
      const old = prev.amcContracts.find(c => c.id === id);
      if (!old) return prev;
      const { docNo, counters } = nextDocNo(prev.counters, 'amc');
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.AmcContract, updates.contractValue, { categoryIds: [], locationIds: [] });
      const renewal: AmcContract = {
        ...old, id: newId, contractNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Active, approvals,
        startDate: updates.startDate, endDate: updates.endDate, contractValue: updates.contractValue,
        visits: [], renewedFromId: old.id, createdOn: today(),
      };
      return { ...prev, amcContracts: [renewal, ...prev.amcContracts], counters };
    });
    log({ actor: actorName, actorRole, action: 'AMC renewal drafted', entityType: 'AmcContract', entityId: newId, summary: 'Drafted renewal for expiring AMC contract.', severity: 'info' });
    return newId;
  }, [setState, log, actorName, actorRole]);

  // -- Maintenance: Service tickets --------------------------------------------

  const createServiceTicket = useCallback((draft: Omit<ServiceTicket, 'id' | 'ticketNo' | 'status' | 'approvals' | 'partsReplaced'>): string => {
    const id = uid('svc');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'ticket');
      const asset = prev.assets.find(a => a.id === draft.assetId);
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.ServiceTicket, draft.estimatedCost, { categoryIds: asset ? [asset.categoryId] : [], locationIds: asset ? [asset.locationId] : [] });
      const row: ServiceTicket = { ...draft, id, ticketNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Open, approvals, partsReplaced: [] };
      return {
        ...prev, counters,
        serviceTickets: [row, ...prev.serviceTickets],
        assets: prev.assets.map(a =>
          a.id === draft.assetId
            ? pushHistory(a, { date: draft.reportedOn, type: AssetEventType.RepairRaised, title: 'Fault reported', detail: draft.faultDescription, actor: actorName, refNo: docNo })
            : a,
        ),
      };
    });
    log({ actor: actorName, actorRole, action: 'Service ticket raised', entityType: 'ServiceTicket', entityId: id, summary: draft.faultDescription, severity: draft.priority === 'Critical' ? 'critical' : 'warning' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const actOnServiceTicket = useCallback((id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => {
    setState(prev => ({
      ...prev,
      serviceTickets: prev.serviceTickets.map(t => {
        if (t.id !== id) return t;
        const approvals = applyDecision(t.approvals, decision, actorName, remarks);
        const outcome = chainOutcome(approvals);
        return { ...t, approvals, status: outcome === DocStatus.Approved ? DocStatus.Open : outcome };
      }),
    }));
    log({ actor: actorName, actorRole, action: `Service ticket ${decision.toLowerCase()}`, entityType: 'ServiceTicket', entityId: id, summary: remarks || `${decision} by ${actorName}`, severity: decision === ApprovalStatus.Rejected ? 'warning' : 'info' });
  }, [setState, log, actorName, actorRole]);

  const startServiceTicket = useCallback((id: string) => {
    setState(prev => ({ ...prev, serviceTickets: prev.serviceTickets.map(t => (t.id === id ? { ...t, status: DocStatus.InProgress } : t)) }));
  }, [setState]);

  const closeServiceTicket = useCallback((id: string, resolution: string, actualCost: number, partsReplaced: PartReplacement[], recommendReplacement: boolean) => {
    setState(prev => {
      const ticket = prev.serviceTickets.find(t => t.id === id);
      if (!ticket) return prev;
      const newComponents: AssetComponent[] = partsReplaced.map(part => ({
        id: uid('comp'), assetId: ticket.assetId, name: part.componentName, serialNumber: part.newSerial, cost: part.cost,
        installedOn: today(), status: ComponentStatus.Installed, source: 'Repair', warrantyExpiry: part.warrantyMonths ? today() : undefined,
        remarks: `Fitted under ${ticket.ticketNo}.`,
      }));
      return {
        ...prev,
        serviceTickets: prev.serviceTickets.map(t => (t.id === id ? { ...t, status: DocStatus.Completed, resolution, actualCost, partsReplaced, recommendReplacement, closedOn: today(), downtimeEnd: today() } : t)),
        components: [...newComponents, ...prev.components],
        assets: prev.assets.map(a =>
          a.id === ticket.assetId
            ? pushHistory({ ...a, status: a.custodianId ? AssetStatus.InUse : AssetStatus.InStore, condition: AssetCondition.Good }, { date: today(), type: AssetEventType.RepairCompleted, title: 'Repair completed', detail: resolution, actor: actorName, refNo: ticket.ticketNo })
            : a,
        ),
      };
    });
    log({ actor: actorName, actorRole, action: 'Service ticket closed', entityType: 'ServiceTicket', entityId: id, summary: resolution, severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  // -- Replacement --------------------------------------------------------------

  const createReplacement = useCallback((draft: Omit<Replacement, 'id' | 'replacementNo' | 'status' | 'approvals'>): string => {
    const id = uid('rpl');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'replacement');
      const asset = prev.assets.find(a => a.id === draft.oldAssetId);
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.Replacement, draft.estimatedCost, { categoryIds: asset ? [asset.categoryId] : [], locationIds: asset ? [asset.locationId] : [] });
      const row: Replacement = { ...draft, id, replacementNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Approved, approvals };
      return { ...prev, replacements: [row, ...prev.replacements], counters };
    });
    log({ actor: actorName, actorRole, action: 'Replacement requested', entityType: 'Replacement', entityId: id, summary: draft.reason, severity: 'info' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const actOnReplacement = useCallback((id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => {
    setState(prev => ({
      ...prev,
      replacements: prev.replacements.map(r => {
        if (r.id !== id) return r;
        const approvals = applyDecision(r.approvals, decision, actorName, remarks);
        return { ...r, approvals, status: chainOutcome(approvals) };
      }),
    }));
    log({ actor: actorName, actorRole, action: `Replacement ${decision.toLowerCase()}`, entityType: 'Replacement', entityId: id, summary: remarks || `${decision} by ${actorName}`, severity: decision === ApprovalStatus.Rejected ? 'warning' : 'info' });
  }, [setState, log, actorName, actorRole]);

  const completeReplacement = useCallback((id: string, newAssetId: string | undefined) => {
    setState(prev => {
      const replacement = prev.replacements.find(r => r.id === id);
      if (!replacement) return prev;
      const oldAsset = prev.assets.find(a => a.id === replacement.oldAssetId);
      if (!oldAsset) return prev;

      const dispositionStatus: AssetStatus | null =
        replacement.oldAssetDisposition === 'Return to Store' ? AssetStatus.InStore
          : replacement.oldAssetDisposition === 'Scrap' ? AssetStatus.Scrapped
            : replacement.oldAssetDisposition === 'Sell' ? AssetStatus.AwaitingDisposal
              : replacement.oldAssetDisposition === 'Return to Vendor' ? AssetStatus.Retired
                : null; // 'Write-Off (Lost/Stolen)' - leave status as-is (already Lost)

      return {
        ...prev,
        replacements: prev.replacements.map(r => (r.id === id ? { ...r, status: DocStatus.Completed, newAssetId, completedOn: today() } : r)),
        assets: prev.assets.map(a => {
          if (a.id === replacement.oldAssetId) {
            const patch: Partial<Asset> = dispositionStatus ? { status: dispositionStatus, custodianId: undefined } : {};
            return pushHistory({ ...a, ...patch }, { date: today(), type: AssetEventType.Replaced, title: 'Replaced', detail: `Replaced under ${replacement.replacementNo}`, actor: actorName, refNo: replacement.replacementNo });
          }
          if (newAssetId && a.id === newAssetId) {
            return pushHistory(
              { ...a, status: AssetStatus.InUse, custodianId: oldAsset.custodianId, departmentId: oldAsset.departmentId, locationId: oldAsset.locationId },
              { date: today(), type: AssetEventType.Assigned, title: 'Issued as replacement', detail: `Issued in place of ${oldAsset.assetTag} under ${replacement.replacementNo}`, actor: actorName, refNo: replacement.replacementNo },
            );
          }
          return a;
        }),
      };
    });
    log({ actor: actorName, actorRole, action: 'Replacement completed', entityType: 'Replacement', entityId: id, summary: 'Old asset retired and replacement issued.', severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  // -- Disposal ----------------------------------------------------------------

  const createDisposal = useCallback((draft: Omit<Disposal, 'id' | 'disposalNo' | 'status' | 'approvals'>): string => {
    const id = uid('dsp');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'disposal');
      const categoryIds = draft.lines.map(l => prev.assets.find(a => a.id === l.assetId)?.categoryId).filter(Boolean) as string[];
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.Disposal, draft.totalRealisedValue, { categoryIds, locationIds: [] });
      const row: Disposal = { ...draft, id, disposalNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Approved, approvals };
      return { ...prev, disposals: [row, ...prev.disposals], counters };
    });
    log({ actor: actorName, actorRole, action: 'Disposal requested', entityType: 'Disposal', entityId: id, summary: draft.reason, severity: 'info' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const actOnDisposal = useCallback((id: string, decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => {
    setState(prev => ({
      ...prev,
      disposals: prev.disposals.map(d => {
        if (d.id !== id) return d;
        const approvals = applyDecision(d.approvals, decision, actorName, remarks);
        return { ...d, approvals, status: chainOutcome(approvals) };
      }),
    }));
    log({ actor: actorName, actorRole, action: `Disposal ${decision.toLowerCase()}`, entityType: 'Disposal', entityId: id, summary: remarks || `${decision} by ${actorName}`, severity: decision === ApprovalStatus.Rejected ? 'warning' : 'info' });
  }, [setState, log, actorName, actorRole]);

  const completeDisposal = useCallback((id: string, disposalDate: string, invoiceNo?: string) => {
    let modeForLog: string = 'Disposal';
    setState(prev => {
      const disposal = prev.disposals.find(d => d.id === id);
      if (!disposal) return prev;
      modeForLog = disposal.mode;
      const assetIds = disposal.lines.map(l => l.assetId);
      const finalStatus = DISPOSAL_STATUS[disposal.mode];
      return {
        ...prev,
        disposals: prev.disposals.map(d => (d.id === id ? { ...d, status: DocStatus.Completed, disposalDate, invoiceNo } : d)),
        assets: prev.assets.map(a => {
          if (!assetIds.includes(a.id)) return a;
          const line = disposal.lines.find(l => l.assetId === a.id)!;
          return pushHistory(
            { ...a, status: finalStatus, custodianId: undefined, disposal: { mode: disposal.mode, date: disposalDate, realisedValue: line.realisedValue, refNo: disposal.disposalNo } },
            { date: disposalDate, type: AssetEventType.Disposed, title: disposal.mode, detail: `Disposed under ${disposal.disposalNo}`, actor: actorName, refNo: disposal.disposalNo },
          );
        }),
      };
    });
    log({ actor: actorName, actorRole, action: 'Disposal completed', entityType: 'Disposal', entityId: id, summary: `${modeForLog} completed.`, severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  // -- DOA -----------------------------------------------------------------------

  const saveDoaRule = useCallback((rule: DoaRule) => {
    const row = { ...rule, id: rule.id || uid('doa') };
    setState(prev => ({ ...prev, doaRules: upsert(prev.doaRules, row) }));
    log({ actor: actorName, actorRole, action: 'DOA rule saved', entityType: 'DoaRule', entityId: row.id, summary: `${row.docType} - L${row.level} ${row.approverTitle}`, severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  const toggleDoaRule = useCallback((id: string, active: boolean) => {
    setState(prev => ({ ...prev, doaRules: prev.doaRules.map(r => (r.id === id ? { ...r, active } : r)) }));
  }, [setState]);

  const saveDelegation = useCallback((delegation: DoaDelegation) => {
    const row = { ...delegation, id: delegation.id || uid('del') };
    setState(prev => ({ ...prev, delegations: upsert(prev.delegations, row) }));
    log({ actor: actorName, actorRole, action: 'Delegation granted', entityType: 'DoaDelegation', entityId: row.id, summary: row.reason, severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  const toggleDelegation = useCallback((id: string, active: boolean) => {
    setState(prev => ({ ...prev, delegations: prev.delegations.map(d => (d.id === id ? { ...d, active } : d)) }));
  }, [setState]);

  /**
   * Whether the DOA matrix has ANY active rule for this document type, at any amount. Submission
   * screens must call this before creating a Requisition, Purchase Order, Disposal, etc. and
   * block submission if it's false — otherwise a document type with zero configured rules
   * silently auto-approves every document, regardless of value. See AUDIT fix GOV-01 and
   * lib/doa.ts's hasActiveRulesFor for why this is a different question from "did a rule match
   * this amount".
   */
  const hasActiveDoaRules = useCallback(
    (docType: ApprovalDocType) => hasActiveRulesFor(state.doaRules, docType),
    [state.doaRules],
  );

  // -- Audit -----------------------------------------------------------------------

  const createAuditPlan = useCallback((draft: Omit<AuditPlan, 'id' | 'auditNo' | 'status' | 'lines' | 'createdOn'>): string => {
    const id = uid('aud');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'audit');
      const inScope = prev.assets.filter(a => {
        if (draft.scopeType === 'All') return true;
        if (draft.scopeType === 'Location') return draft.scopeIds.includes(a.locationId);
        if (draft.scopeType === 'Department') return draft.scopeIds.includes(a.departmentId);
        if (draft.scopeType === 'Category') return draft.scopeIds.includes(a.categoryId);
        return false;
      });
      const lines: VerificationLine[] = inScope.map(a => ({
        assetId: a.id, expectedLocationId: a.locationId, expectedCustodianId: a.custodianId, result: VerificationResult.Pending,
      }));
      const row: AuditPlan = { ...draft, id, auditNo: docNo, status: DocStatus.InProgress, lines, createdOn: today() };
      return { ...prev, auditPlans: [row, ...prev.auditPlans], counters };
    });
    log({ actor: actorName, actorRole, action: 'Audit plan created', entityType: 'AuditPlan', entityId: id, summary: draft.title, severity: 'info' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const recordVerification = useCallback((auditId: string, line: VerificationLine) => {
    setState(prev => ({
      ...prev,
      auditPlans: prev.auditPlans.map(plan =>
        plan.id === auditId ? { ...plan, lines: plan.lines.map(l => (l.assetId === line.assetId ? { ...line, verifiedOn: today() } : l)) } : plan,
      ),
    }));
  }, [setState]);

  const signOffAudit = useCallback((auditId: string, observations: string) => {
    setState(prev => {
      const plan = prev.auditPlans.find(p => p.id === auditId);
      if (!plan) return prev;
      return {
        ...prev,
        auditPlans: prev.auditPlans.map(p => (p.id === auditId ? { ...p, status: DocStatus.SignedOff, observations, signedOffBy: actorName, signedOffOn: today() } : p)),
        assets: prev.assets.map(a => {
          const line = plan.lines.find(l => l.assetId === a.id);
          if (!line) return a;
          if (line.result === VerificationResult.Found) {
            return pushHistory({ ...a, lastVerifiedOn: today(), lastVerifiedBy: actorName }, { date: today(), type: AssetEventType.Verified, title: 'Verified', detail: `Confirmed during ${plan.auditNo}`, actor: actorName, refNo: plan.auditNo });
          }
          if (line.result === VerificationResult.LocationMismatch || line.result === VerificationResult.CustodianMismatch) {
            return pushHistory(
              { ...a, lastVerifiedOn: today(), lastVerifiedBy: actorName, locationId: line.actualLocationId || a.locationId, custodianId: line.actualCustodianId ?? a.custodianId },
              { date: today(), type: AssetEventType.Verified, title: 'Register corrected on audit', detail: `Location/custodian reconciled per ${plan.auditNo} findings`, actor: actorName, refNo: plan.auditNo },
            );
          }
          return a;
        }),
      };
    });
    log({ actor: actorName, actorRole, action: 'Audit signed off', entityType: 'AuditPlan', entityId: auditId, summary: observations.slice(0, 120), severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  // -- Projects (CWIP) -------------------------------------------------------------

  const createProject = useCallback((draft: Omit<Project, 'id' | 'projectNo' | 'status' | 'totalSpent' | 'entries' | 'createdOn'>): string => {
    const id = uid('proj');
    setState(prev => {
      const { docNo, counters } = nextDocNo(prev.counters, 'project');
      const row: Project = { ...draft, id, projectNo: docNo, status: ProjectStatus.Draft, totalSpent: 0, entries: [], createdOn: today() };
      return { ...prev, projects: [row, ...prev.projects], counters };
    });
    log({ actor: actorName, actorRole, action: 'Project created', entityType: 'Project', entityId: id, summary: `Project ${draft.title} initiated.`, severity: 'info' });
    return id;
  }, [setState, log, actorName, actorRole]);

  const updateProject = useCallback((id: string, patch: Partial<Omit<Project, 'id' | 'projectNo' | 'totalSpent' | 'entries' | 'createdOn'>>) => {
    setState(prev => ({
      ...prev,
      projects: prev.projects.map(p => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, [setState]);

  const addProjectEntry = useCallback((projectId: string, entry: Omit<ProjectEntry, 'id' | 'recordedBy'>) => {
    setState(prev => {
      const proj = prev.projects.find(p => p.id === projectId);
      if (!proj) return prev;
      const newEntry: ProjectEntry = { ...entry, id: uid('entry'), recordedBy: actorName };
      return {
        ...prev,
        projects: prev.projects.map(p => (p.id === projectId ? { ...p, entries: [...p.entries, newEntry], totalSpent: p.totalSpent + entry.amount } : p)),
      };
    });
    log({ actor: actorName, actorRole, action: 'Project expense added', entityType: 'Project', entityId: projectId, summary: `${formatCurrency(entry.amount)} spent on ${entry.description}`, severity: 'info' });
  }, [setState, log, actorName, actorRole]);

  const completeProject = useCallback((projectId: string, categoryId: string, variantId: string | undefined, locationId: string, departmentId: string) => {
    let newAssetId = '';
    setState(prev => {
      const proj = prev.projects.find(p => p.id === projectId);
      if (!proj || proj.status === ProjectStatus.Completed) return prev;

      const category = prev.categories.find(cat => cat.id === categoryId);

      // Catch the asset-tag counter up to reality before drawing a number for the capitalised
      // asset, so a freshly-introduced counter never collides with a pre-existing tag.
      const seqResult = nextAssetTagSequence(seedAssetTagCounter(prev.counters, prev.assets, prev.numberingRules.assetTag));
      const counters = seqResult.counters;
      const assetTag = applyNumberingRule(prev.numberingRules.assetTag, String(seqResult.seq));
      newAssetId = uid('asset');

      const asset: Asset = {
        id: newAssetId,
        assetTag,
        name: proj.title,
        categoryId,
        variantId,
        serialNumber: `PRJ-${proj.projectNo}`,
        status: AssetStatus.InStore,
        condition: AssetCondition.New,
        criticality: category?.trackComponents ? Criticality.Medium : Criticality.Low,
        departmentId,
        locationId,
        purchaseDate: today(),
        capitalizedOn: today(),
        purchaseCost: proj.totalSpent,
        usefulLifeYears: category?.usefulLifeYears || 5,
        salvageValuePct: category?.salvageValuePct || 5,
        depreciationMethod: category?.depreciationMethod || DepreciationMethod.SLM,
        history: [{ id: uid('evt'), date: today(), type: AssetEventType.Created, title: 'Project capitalised', detail: `Capitalised from CWIP project ${proj.projectNo}`, actor: actorName, refNo: proj.projectNo }],
      };

      return {
        ...prev,
        counters,
        assets: [asset, ...prev.assets],
        projects: prev.projects.map(p => (p.id === projectId ? { ...p, status: ProjectStatus.Completed, completedOn: today(), resultAssetId: newAssetId } : p)),
      };
    });
    log({ actor: actorName, actorRole, action: 'Project capitalised', entityType: 'Project', entityId: projectId, summary: `Project capitalised to asset register.`, severity: 'info' });
    return newAssetId;
  }, [setState, log, actorName, actorRole]);

  // -- Custom Roles -----------------------------------------------------------
  // Written straight to the dedicated `public.custom_roles` table (like locations/departments/
  // vendors above), NOT through the generic app_records sync engine a custom role used to live
  // in only as an in-memory/JSON-blob document. That mismatch meant a role never actually existed
  // as a row `user_companies.custom_role_id` or `create_app_user`'s p_custom_role_id could point
  // at (both have an FK to custom_roles.id), so assigning a custom role to a user would either
  // silently not persist or fail outright on reload. See supabase/custom_roles.sql for the table
  // + RLS (any signed-in user with company access can read it; only Superadmin/Admin can write).

  const saveCustomRole = useCallback(async (role: CustomRole): Promise<{ ok: boolean; error?: string }> => {
    if (!currentCompany) return { ok: false, error: 'No company selected.' };
    const isNew = !isUuid(role.id);
    const payload: any = {
      company_id: currentCompany.id,
      name: role.name,
      description: role.description || null,
      permissions: role.permissions,
    };
    if (!isNew) payload.id = role.id;

    const { data, error } = await supabase.from('custom_roles').upsert(payload).select().single();
    if (error || !data) {
      console.error('Failed to save custom role', error);
      return { ok: false, error: error?.message || 'Could not save the role.' };
    }

    const saved: CustomRole = { id: data.id, name: data.name, description: data.description || '', permissions: normalizePermissions(data.permissions) };
    setState(prev => ({ ...prev, customRoles: upsert(prev.customRoles || [], saved) }));
    log({ actor: actorName, actorRole, action: 'Save custom role', entityType: 'Security', entityId: saved.id, summary: `Custom role ${saved.name} saved.`, severity: 'info' });
    return { ok: true };
  }, [setState, log, actorName, actorRole, currentCompany]);

  const deleteCustomRole = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    if (isUuid(id)) {
      // user_companies.custom_role_id references this row with ON DELETE SET NULL, so any user
      // currently holding this role simply falls back to their base UserRole once it's gone.
      const { data: del, error } = await supabase.from('custom_roles').delete().eq('id', id).select('id');
      if (error) { console.error('Failed to delete custom role', error); return { ok: false, error: error.message }; }
      if (!del || del.length === 0) return { ok: false, error: 'Delete was blocked by database permissions (only Superadmin/Admin can delete roles).' };
    }
    setState(prev => ({ ...prev, customRoles: (prev.customRoles || []).filter(r => r.id !== id) }));
    log({ actor: actorName, actorRole, action: 'Delete custom role', entityType: 'Security', entityId: id, summary: `Custom role deleted.`, severity: 'warning' });
    return { ok: true };
  }, [setState, log, actorName, actorRole]);

  // -- Settings: numbering rules + Depreciation Rate Master -----------------------

  /** Replaces the whole numbering-rules object and writes it straight to `app_records` (rather
   *  than leaving it to the generic SyncEngine's debounced scan, like `counters`), so the
   *  Settings page can actually confirm the prefix/suffix reached the database before telling
   *  the admin it saved -- a save that only landed in memory would otherwise look identical to
   *  one that's durably persisted, until the next full page load quietly reverted it. */
  const saveNumberingRules = useCallback(async (rules: NumberingRules): Promise<{ ok: boolean; error?: string }> => {
    setState(prev => ({ ...prev, numberingRules: rules }));
    if (!currentCompany) return { ok: false, error: 'No company selected.' };
    const { error } = await supabase.from('app_records').upsert(
      { company_id: currentCompany.id, collection: NUMBERING_RULES_COLLECTION, id: 'main', data: rules },
      { onConflict: 'company_id,collection,id' },
    );
    if (error) {
      console.error('Failed to save numbering rules', error);
      return { ok: false, error: error.message };
    }
    // Tell the generic sync engine this is now what the database holds, so its own debounced
    // scan of this same state change doesn't turn around and send an identical, redundant write.
    syncEngine?.registerDoc(NUMBERING_RULES_COLLECTION, 'main', rules);
    return { ok: true };
  }, [setState, currentCompany, syncEngine]);

  /** Depreciation Rate Master is one row per category, so — unlike numberingRules — it's a
   *  dedicated table (`depreciation_rate_rules`) with its own RLS rather than a JSON blob in
   *  app_records: it's naturally relational (keyed by category_id, unique per company) and
   *  benefits from a real foreign key / unique constraint the generic blob store can't offer. */
  const saveDepreciationRateRule = useCallback(async (
    rule: Omit<DepreciationRateRule, 'id' | 'updatedAt'> & { id?: string },
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentCompany) return { ok: false, error: 'No company selected.' };
    const isNew = !isUuid(rule.id);
    const rateType = rule.rateType || DepreciationRateType.CompaniesAct;
    const payload: any = {
      company_id: currentCompany.id,
      category_id: rule.categoryId,
      rate_type: rateType,
      method: rule.method,
      useful_life_years: rule.usefulLifeYears,
      salvage_value_pct: rule.salvageValuePct,
    };
    if (!isNew) payload.id = rule.id;

    // One override per category *per basis* now -- Companies Act and Income Tax are independent
    // rows, not alternatives for the same slot, so the conflict key includes rate_type.
    const { data, error } = await supabase
      .from('depreciation_rate_rules')
      .upsert(payload, { onConflict: 'company_id,category_id,rate_type' })
      .select()
      .single();
    if (error || !data) {
      console.error('Failed to save depreciation rate rule', error);
      return { ok: false, error: error?.message || 'Could not save the depreciation rate.' };
    }
    const saved: DepreciationRateRule = {
      id: data.id,
      categoryId: data.category_id,
      rateType: data.rate_type || DepreciationRateType.CompaniesAct,
      method: data.method,
      usefulLifeYears: Number(data.useful_life_years),
      salvageValuePct: Number(data.salvage_value_pct),
      updatedAt: data.updated_at,
    };
    setState(prev => ({
      ...prev,
      depreciationRateRules: [
        ...prev.depreciationRateRules.filter(r => !(r.categoryId === saved.categoryId && r.rateType === saved.rateType)),
        saved,
      ],
    }));
    return { ok: true };
  }, [setState, currentCompany]);

  const deleteDepreciationRateRule = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    if (!currentCompany) return { ok: false, error: 'No company selected.' };
    const { error } = await supabase.from('depreciation_rate_rules').delete().eq('id', id).eq('company_id', currentCompany.id);
    if (error) {
      console.error('Failed to delete depreciation rate rule', error);
      return { ok: false, error: error.message };
    }
    setState(prev => ({ ...prev, depreciationRateRules: prev.depreciationRateRules.filter(r => r.id !== id) }));
    return { ok: true };
  }, [setState, currentCompany]);

  // -- Company settings -----------------------------------------------------------

  const saveCompanySettings = useCallback(async (settings: { companyName: string; companyLogoUrl: string }) => {
    if (currentCompany) {
      const { error } = await supabase
        .from('companies')
        .update({ name: settings.companyName, logo_url: settings.companyLogoUrl })
        .eq('id', currentCompany.id);
      if (error) { console.error('Failed to save company settings', error); setSyncError(`Could not save company settings: ${error.message}`); return; }
    }
    setCompanySettings(settings);
  }, [setCompanySettings, currentCompany]);

  const value: AssetContextValue = {
    state, currentUser, profileLoading, profileError, retryProfileLoad, completePasswordReset, mfaStatusLoading, refreshMfaStatus, currentCompany, users, setCurrentUser, setCurrentCompany, me,
    saveCategory, saveVariant, saveLocation, saveDepartment, saveVendor, saveEmployee, deleteEmployee, deleteCategory, deleteLocation, deleteVendor, deleteDepartment,
    createAssetManually, bulkUploadAssets, deleteAsset, deleteAssetUploadBatch, addComponent, retireComponent, updateAssetFields,
    submitRequisition, saveRequisitionDraft, actOnRequisition, convertRequisitionToPo,
    createPurchaseOrder, actOnPurchaseOrder, postGrn,
    createTransfer, actOnTransfer, dispatchTransfer, receiveTransfer,
    createGatePass, actOnGatePass, issueGatePass, returnGatePass,
    createAmcContract, actOnAmc, logAmcVisit, renewAmcContract,
    createServiceTicket, actOnServiceTicket, startServiceTicket, closeServiceTicket,
    createReplacement, actOnReplacement, completeReplacement,
    createDisposal, actOnDisposal, completeDisposal,
    saveDoaRule, toggleDoaRule, saveDelegation, toggleDelegation, hasActiveDoaRules,
    createAuditPlan, recordVerification, signOffAudit,
    createProject, updateProject, addProjectEntry, completeProject,
    saveCustomRole, deleteCustomRole,
    saveNumberingRules, saveDepreciationRateRule, deleteDepreciationRateRule,
    companyName: companySettings.companyName,
    companyLogoUrl: companySettings.companyLogoUrl,
    saveCompanySettings,
    syncError,
  };

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
};