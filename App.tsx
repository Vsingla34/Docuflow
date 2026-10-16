import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AssetStoreProvider, useAssetStore } from './store/AssetStore';
import { ToastProvider } from './components/ui/Toast';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import { PAGE_TITLES, PAGE_PATHS, PAGE_PERMISSION_MODULE, PAGE_ROLES, PageKey, pageKeyFromPath } from './components/layout/nav';
import { User } from './types';
import MfaSetup from './components/ui/MfaSetup';
import { getVerifiedTotpFactor, sessionNeedsMfaChallenge, verifyLoginChallenge, MFA_REQUIRED_ROLES } from './lib/mfa';
import { canViewModule, getCustomRole } from './lib/permissions';

import Dashboard from './pages/Dashboard';
import AssetRegister from './pages/AssetRegister';
import Categories from './pages/Categories';
import Requisitions from './pages/Requisitions';
import PurchaseOrders from './pages/PurchaseOrders';
import Grns from './pages/Grns';
import Transfers from './pages/Transfers';
import GatePasses from './pages/GatePasses';
import Amc from './pages/Amc';
import ServiceTickets from './pages/ServiceTickets';
import Replacements from './pages/Replacements';
import Disposals from './pages/Disposals';
import Audits from './pages/Audits';
import Doa from './pages/Doa';
import Masters from './pages/Masters';
import Employees from './pages/Employees';
import ActivityLog from './pages/ActivityLog';
import AssetLookup from './pages/AssetLookup';
import CompanyManagement from './pages/CompanyManagement';
import UserManagement from './pages/UserManagement';
import MasterUploads from './pages/MasterUploads';
import Projects from './pages/Projects';
import Roles from './pages/Roles';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import CompanySelection from './pages/CompanySelection';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';

const PAGES: Record<PageKey, React.ComponentType<{ onNavigate: (page: PageKey) => void }>> = {
  dashboard: Dashboard,
  assets: AssetRegister,
  categories: Categories,
  requisitions: Requisitions,
  purchaseOrders: PurchaseOrders,
  grns: Grns,
  transfers: Transfers,
  gatePasses: GatePasses,
  amc: Amc,
  serviceTickets: ServiceTickets,
  replacements: Replacements,
  disposals: Disposals,
  audits: Audits,
  doa: Doa,
  masters: Masters,
  employees: Employees,
  activity: ActivityLog,
  lookup: AssetLookup,
  companyManagement: CompanyManagement,
  userManagement: UserManagement,
  masterUploads: MasterUploads,
  projects: Projects,
  roles: Roles,
  reports: Reports,
  settings: Settings,
};

/**
 * Blocking screen for an account whose password must be changed before it can be used — e.g. it
 * was created with a system-generated temporary password (see pages/MasterUploads.tsx and
 * supabase/12_force_password_reset.sql). Fixes AUDIT finding BUG-02: previously there was no
 * way to force this, so a temporary password could remain valid indefinitely.
 */
const ForcePasswordChange: React.FC = () => {
  const { completePasswordReset } = useAssetStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    const result = await completePasswordReset(password);
    setSubmitting(false);
    if (!result.ok) setError(result.error || 'Could not set your new password. Please try again.');
    // On success, currentUser.mustChangePassword flips to false and Shell re-renders past this screen.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
        <div>
          <h1 className="text-lg font-bold text-text-main">Set a new password</h1>
          <p className="text-sm text-text-light mt-1">Your account was created with a temporary password. Choose a new one to continue.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="text-sm font-medium text-text-main">New password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-text-main">Confirm new password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Setting password...' : 'Set password and continue'}
        </button>
      </form>
    </div>
  );
};

/**
 * Blocking screen for a Superadmin/Admin account with no verified MFA factor yet. Mirrors
 * ForcePasswordChange's shape and placement in the gate order: this is account-security setup
 * that has to happen before anything else, not a page the role-based route guard can just hide.
 */
const RequireMfa: React.FC = () => {
  const { refreshMfaStatus } = useAssetStore();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-sm bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
        <div>
          <h1 className="text-lg font-bold text-text-main">Set up two-factor authentication</h1>
          <p className="text-sm text-text-light mt-1">
            Your role requires two-factor authentication before you can continue. It takes about a minute with any authenticator app.
          </p>
        </div>
        <MfaSetup
          mandatory
          onEnrolled={() => { void refreshMfaStatus(); }}
          onCancel={() => { void supabase.auth.signOut(); }}
        />
      </div>
    </div>
  );
};

/**
 * Shared chrome (sidebar + header) for every real page route. Each PageKey now has its own URL
 * (see components/layout/nav.ts PAGE_PATHS) instead of all pages living behind one path and being
 * swapped in by in-memory state — this is just the layout they all render inside of, via <Outlet/>.
 */
const Layout: React.FC<{ currentUser: User; syncError: string | null; onNavigate: (page: PageKey) => void }> = ({
  currentUser, syncError, onNavigate,
}) => {
  const location = useLocation();
  const currentPage = pageKeyFromPath(location.pathname) ?? 'dashboard';

  return (
    <div className="flex h-screen bg-background font-sans text-text-main">
      <Sidebar currentPage={currentPage} setCurrentPage={onNavigate} currentUser={currentUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={PAGE_TITLES[currentPage]} onNavigate={onNavigate} />
        {syncError && (
          <div role="alert" className="bg-red-50 border-b border-red-200 text-red-700 text-sm px-5 lg:px-8 py-2">
            <strong className="font-semibold">Database sync problem:</strong> {syncError}
          </div>
        )}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/**
 * Renders the page for one PageKey, or bounces to the dashboard if the signed-in role isn't
 * allowed on it. Needed now that every page has a real, typeable/shareable URL: previously a
 * role-inappropriate page was simply never offered as a sidebar button, which was enough because
 * there was no other way to reach it. See PAGE_ROLES in nav.ts.
 */
const PageRoute: React.FC<{ pageKey: PageKey; currentUser: User; onNavigate: (page: PageKey) => void }> = ({
  pageKey, currentUser, onNavigate,
}) => {
  const { state } = useAssetStore();

  if (!PAGE_ROLES[pageKey].includes(currentUser.role)) {
    return <Navigate to={PAGE_PATHS.dashboard} replace />;
  }

  // A custom role can narrow what its holder sees beyond their base role — previously this only
  // hid the sidebar link, so typing or bookmarking the URL directly still opened the page. Now
  // the route itself is gated the same way the sidebar is (see Sidebar.tsx / PAGE_PERMISSION_MODULE).
  const module = PAGE_PERMISSION_MODULE[pageKey];
  if (module) {
    const customRole = getCustomRole(currentUser, state.customRoles);
    if (customRole && !canViewModule(customRole, module)) {
      return <Navigate to={PAGE_PATHS.dashboard} replace />;
    }
  }

  const PageComponent = PAGES[pageKey];
  return <PageComponent onNavigate={onNavigate} />;
};

const Shell: React.FC = () => {
  const { currentUser, currentCompany, setCurrentCompany, syncError, profileLoading, profileError, retryProfileLoad, mfaStatusLoading } = useAssetStore();
  const navigate = useNavigate();
  const onNavigate = (page: PageKey) => navigate(PAGE_PATHS[page]);

  // Gate EVERYTHING role-aware — including CompanySelection, whose "Global Superadmin Toolbar"
  // reads currentUser.role — behind the real profile having loaded. Fixes BUG-01: previously
  // currentUser.role held its placeholder 'Employee' value here on every fresh mount, so
  // Superadmin-only UI would flash hidden, and a failed profile fetch used to fall back to
  // guessing a role instead of stopping here.
  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-red-600 font-semibold">Couldn't verify your access</p>
          <p className="text-sm text-slate-500">{profileError}</p>
          <button
            onClick={retryProfileLoad}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading Docuflow...</div>;
  }

  // Block everything else — including company selection — until a temporary password has been
  // replaced. Checked here, not just at login, so it also catches a session that was already
  // open when an admin flagged the account (or on first login right after bulk creation).
  if (currentUser.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  // Same "never guess" discipline as the profile/role check above, scoped to the roles that
  // actually require MFA: don't render the enrollment screen OR let a Superadmin/Admin into the
  // app while their factor status is still being confirmed, and don't make every other role wait
  // on a check that will never block them.
  if (MFA_REQUIRED_ROLES.includes(currentUser.role)) {
    if (mfaStatusLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Checking your account security...</div>;
    }
    if (!currentUser.mfaEnrolled) {
      return <RequireMfa />;
    }
  }

  if (!currentCompany) {
    return <CompanySelection onCompanySelect={setCurrentCompany} />;
  }

  return (
    <Routes>
      <Route element={<Layout currentUser={currentUser} syncError={syncError} onNavigate={onNavigate} />}>
        {(Object.keys(PAGES) as PageKey[]).map(key => (
          <Route
            key={key}
            path={PAGE_PATHS[key]}
            element={<PageRoute pageKey={key} currentUser={currentUser} onNavigate={onNavigate} />}
          />
        ))}
        <Route path="/" element={<Navigate to={PAGE_PATHS.dashboard} replace />} />
        <Route path="*" element={<Navigate to={PAGE_PATHS.dashboard} replace />} />
      </Route>
    </Routes>
  );
};

/**
 * Second-factor login challenge, shown between "password accepted" and "app rendered" for an
 * account with two-factor already turned on. This has to live here, at the top of App — not
 * inside Login.tsx — because a correct password alone already makes Supabase fire a SIGNED_IN
 * auth-state event and hand back a session (at aal1); App's own session state below reacts to
 * that event directly, not to anything Login.tsx decides to show. Putting the challenge inside
 * Login.tsx would have meant App already swapped away from the login screen — this component is
 * the only thing standing between a correct password and a fully-admitted session.
 */
const MfaChallenge: React.FC<{ onVerified: () => void }> = ({ onVerified }) => {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getVerifiedTotpFactor().then(factor => {
      if (cancelled) return;
      if (!factor) { setLookupFailed(true); return; }
      setFactorId(factor.id);
    });
    return () => { cancelled = true; };
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    setError(null);
    const result = await verifyLoginChallenge(factorId, code);
    setVerifying(false);
    if (!result.ok) { setError(result.error); setCode(''); return; }
    onVerified();
  };

  const handleBack = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
        <div>
          <h1 className="text-lg font-bold text-text-main">Enter your two-factor code</h1>
          <p className="text-sm text-text-light mt-1">Your password was correct — enter the 6-digit code from your authenticator app to finish signing in.</p>
        </div>
        {lookupFailed ? (
          <>
            <p className="text-sm text-red-600">Could not start two-factor verification. Please try signing in again.</p>
            <button onClick={handleBack} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">
              Back to sign in
            </button>
          </>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-center tracking-[0.3em] font-mono"
            />
            <div className="flex gap-3">
              <button type="button" onClick={handleBack} disabled={verifying} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-60">
                Back
              </button>
              <button type="submit" disabled={verifying || code.length !== 6} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 disabled:opacity-60">
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  // Whether the CURRENT session still needs the MfaChallenge screen before anything else renders.
  // null = not yet checked (treated the same as "needed" below, never as "not needed" — see the
  // mfaCheckDone guard in the render logic). Re-checked on every auth-state change, not just once
  // at load, so completing the challenge (which doesn't change `session` itself) is what actually
  // clears this and lets the app through.
  const [needsMfaChallenge, setNeedsMfaChallenge] = React.useState<boolean | null>(null);

  const evaluateSession = React.useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession) { setNeedsMfaChallenge(null); return; }
    setNeedsMfaChallenge(await sessionNeedsMfaChallenge());
  }, []);

  React.useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await evaluateSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void evaluateSession(session);
    });

    return () => subscription.unsubscribe();
  }, [evaluateSession]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading Docuflow...</div>;
  }

  if (!session) {
    return (
      <ToastProvider>
        <Login onLoginSuccess={() => { }} />
      </ToastProvider>
    );
  }

  // Never fall through to the signed-in app while the AAL check is still in flight (null) or has
  // come back "needed" (true) — only a confirmed false lets anything past this. Same "don't guess"
  // discipline as profileLoading/mfaStatusLoading inside Shell, applied at the one point upstream
  // of all of it: the raw Supabase session itself.
  if (needsMfaChallenge !== false) {
    return (
      <ToastProvider>
        {needsMfaChallenge === null
          ? <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Checking your account security...</div>
          : <MfaChallenge onVerified={() => setNeedsMfaChallenge(false)} />}
      </ToastProvider>
    );
  }

  return (
    <BrowserRouter>
      <AssetStoreProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AssetStoreProvider>
    </BrowserRouter>
  );
};
export default App;