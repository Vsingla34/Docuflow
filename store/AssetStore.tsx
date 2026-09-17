import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
  Department,
  DepreciationMethod,
  Disposal,
  DisposalMode,
  DoaDelegation,
  DoaRule,
  DocStatus,
  Employee,
  Grn,
  GrnLine,
  GatePass,
  PartReplacement,
  PurchaseOrder,
  Replacement,
  Requisition,
  ServiceTicket,
  Transfer,
  User,
  UserRole,
  Vendor,
  VerificationLine,
  VerificationResult,
} from '../types';
import { applyDecision, chainOutcome, resolveApprovalChain } from '../lib/doa';
import { nextAssetTag, nextDocNo } from '../lib/numbering';
import { nowStamp, today, uid } from '../lib/format';
import { buildSeedState, SEED_USERS } from '../data/seed';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const setAndPersist: React.Dispatch<React.SetStateAction<T>> = useCallback(
    value => {
      setState(prev => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage full or unavailable; keep working in-memory */
        }
        return next;
      });
    },
    [key],
  );
  return [state, setAndPersist];
}

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
  users: User[];
  setCurrentUser: (user: User) => void;
  me: Employee | undefined;

  // Masters
  saveCategory: (category: AssetCategory) => void;
  saveVariant: (variant: AssetVariant) => void;
  saveLocation: (location: AssetLocation) => void;
  saveDepartment: (department: Department) => void;
  saveVendor: (vendor: Vendor) => void;
  saveEmployee: (employee: Employee) => void;

  // Asset register
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
  postGrn: (draft: Omit<Grn, 'id' | 'grnNo' | 'status' | 'createdAssetIds'>) => string;

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

  // Audit
  createAuditPlan: (draft: Omit<AuditPlan, 'id' | 'auditNo' | 'status' | 'lines' | 'createdOn'>) => string;
  recordVerification: (auditId: string, line: VerificationLine) => void;
  signOffAudit: (auditId: string, observations: string) => void;
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
  const [state, setState] = usePersistentState<AssetState>('asset-lifecycle-state', buildSeedState());
  const [users] = usePersistentState<User[]>('asset-lifecycle-users', SEED_USERS);
  const [currentUser, setCurrentUser] = usePersistentState<User>('asset-lifecycle-current-user', SEED_USERS[0]);

  const me = useMemo(() => state.employees.find(e => e.id === currentUser.employeeId), [state.employees, currentUser]);

  const log = useCallback((entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
    setState(prev => ({ ...prev, activity: [activityEntry(entry), ...prev.activity].slice(0, 300) }));
  }, [setState]);

  const actorName = currentUser.name;
  const actorRole = currentUser.role;

  // -- Masters -----------------------------------------------------------

  const upsert = <T extends { id: string }>(list: T[], row: T): T[] =>
    list.some(r => r.id === row.id) ? list.map(r => (r.id === row.id ? row : r)) : [{ ...row, id: row.id || uid('row') }, ...list];

  const saveCategory = useCallback((category: AssetCategory) => {
    const row = { ...category, id: category.id || uid('cat') };
    setState(prev => ({ ...prev, categories: upsert(prev.categories, row) }));
  }, [setState]);

  const saveVariant = useCallback((variant: AssetVariant) => {
    const row = { ...variant, id: variant.id || uid('var') };
    setState(prev => ({ ...prev, variants: upsert(prev.variants, row) }));
  }, [setState]);

  const saveLocation = useCallback((location: AssetLocation) => {
    const row = { ...location, id: location.id || uid('loc') };
    setState(prev => ({ ...prev, locations: upsert(prev.locations, row) }));
  }, [setState]);

  const saveDepartment = useCallback((department: Department) => {
    const row = { ...department, id: department.id || uid('dept') };
    setState(prev => ({ ...prev, departments: upsert(prev.departments, row) }));
  }, [setState]);

  const saveVendor = useCallback((vendor: Vendor) => {
    const row = { ...vendor, id: vendor.id || uid('ven') };
    setState(prev => ({ ...prev, vendors: upsert(prev.vendors, row) }));
  }, [setState]);

  const saveEmployee = useCallback((employee: Employee) => {
    const row = { ...employee, id: employee.id || uid('emp') };
    setState(prev => ({ ...prev, employees: upsert(prev.employees, row) }));
  }, [setState]);

  // -- Asset register ------------------------------------------------------

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
      const approvals = resolveApprovalChain(prev.doaRules, ApprovalDocType.PurchaseOrder, draft.grandTotal, { categoryIds, locationIds: [draft.deliverToLocationId] });
      const po: PurchaseOrder = { ...draft, id, poNo: docNo, status: approvals.length ? DocStatus.PendingApproval : DocStatus.Approved, approvals };
      return { ...prev, purchaseOrders: [po, ...prev.purchaseOrders], counters };
    });
    log({ actor: actorName, actorRole, action: 'Purchase order raised', entityType: 'PurchaseOrder', entityId: id, summary: `Raised PO worth ${draft.grandTotal}.`, severity: 'info' });
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

  const postGrn = useCallback((draft: Omit<Grn, 'id' | 'grnNo' | 'status' | 'createdAssetIds'>): string => {
    const id = uid('grn');
    setState(prev => {
      const po = prev.purchaseOrders.find(p => p.id === draft.poId);
      if (!po) return prev;
      const { docNo, counters: c1 } = nextDocNo(prev.counters, 'grn');
      let counters = c1;
      const createdAssetIds: string[] = [];
      const newAssets: Asset[] = [];

      draft.lines.forEach((line: GrnLine) => {
        const category = prev.categories.find(cat => cat.id === line.categoryId);
        const categoryCode = category?.code || 'GEN';
        const locationCode = prev.locations.find(l => l.id === draft.locationId)?.code || 'LOC';
        for (let i = 0; i < line.acceptedQty; i += 1) {
          const tagResult = nextAssetTag(counters, categoryCode, locationCode);
          counters = tagResult.counters;
          const assetId = uid('asset');
          const asset: Asset = {
            id: assetId,
            assetTag: tagResult.assetTag,
            name: line.description,
            categoryId: line.categoryId,
            variantId: line.variantId,
            serialNumber: line.serialNumbers[i] || `${tagResult.assetTag}-SN`,
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
    return id;
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

  const value: AssetContextValue = {
    state, currentUser, users, setCurrentUser, me,
    saveCategory, saveVariant, saveLocation, saveDepartment, saveVendor, saveEmployee,
    addComponent, retireComponent, updateAssetFields,
    submitRequisition, saveRequisitionDraft, actOnRequisition, convertRequisitionToPo,
    createPurchaseOrder, actOnPurchaseOrder, postGrn,
    createTransfer, actOnTransfer, dispatchTransfer, receiveTransfer,
    createGatePass, actOnGatePass, issueGatePass, returnGatePass,
    createAmcContract, actOnAmc, logAmcVisit, renewAmcContract,
    createServiceTicket, actOnServiceTicket, startServiceTicket, closeServiceTicket,
    createReplacement, actOnReplacement, completeReplacement,
    createDisposal, actOnDisposal, completeDisposal,
    saveDoaRule, toggleDoaRule, saveDelegation, toggleDelegation,
    createAuditPlan, recordVerification, signOffAudit,
  };

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
};
