import React, { useState } from 'react';
import { useAssetStore } from '../../store/AssetStore';
import { supabase } from '../../lib/supabase';
import { listAlerts, myPendingApprovals } from '../../lib/notifications';
import { getVerifiedTotpFactor, removeTotpFactor, MFA_REQUIRED_ROLES } from '../../lib/mfa';
import { Modal } from '../ui/Overlay';
import { PrimaryButton, SecondaryButton } from '../ui/FormControls';
import MfaSetup from '../ui/MfaSetup';
import { useToast } from '../ui/Toast';
import { PageKey } from './nav';
import Icon from '../icons/Icon';
import { UserRole } from '../../types';
import GlobalSearch from './GlobalSearch';

/**
 * Self-service two-factor entry point for any role — Superadmin/Admin have this forced on them
 * before they can even reach the app (App.tsx's RequireMfa), but it's otherwise voluntary, so
 * Management/Employee/Auditor need some way to turn it on if they want it. Reuses the same
 * MfaSetup enrollment flow the mandatory gate uses.
 */
const SecuritySettings: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { currentUser, refreshMfaStatus } = useAssetStore();
  const showToast = useToast();
  const [disabling, setDisabling] = useState(false);

  const handleDisable = async () => {
    setDisabling(true);
    const factor = await getVerifiedTotpFactor();
    if (factor) {
      const result = await removeTotpFactor(factor.id);
      if (!result.ok) {
        showToast(result.error);
        setDisabling(false);
        return;
      }
    }
    await refreshMfaStatus();
    setDisabling(false);
    showToast('Two-factor authentication turned off.');
    onClose();
  };

  const required = MFA_REQUIRED_ROLES.includes(currentUser.role);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Two-Factor Authentication">
      {currentUser.mfaEnrolled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <Icon name="check" className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800">Two-factor authentication is on for your account.</p>
          </div>
          {required ? (
            <p className="text-sm text-text-light">Your role ({currentUser.role}) requires two-factor authentication, so it can't be turned off here.</p>
          ) : (
            <p className="text-sm text-text-light">
              Turning this off means signing in will only require your password. You can re-enable it any time.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
            {!required && (
              <PrimaryButton onClick={handleDisable} disabled={disabling} className="!bg-red-600 hover:!opacity-90">
                {disabling ? 'Turning off...' : 'Turn Off 2FA'}
              </PrimaryButton>
            )}
          </div>
        </div>
      ) : (
        <MfaSetup onEnrolled={() => { void refreshMfaStatus(); onClose(); }} onCancel={onClose} />
      )}
    </Modal>
  );
};

const Header: React.FC<{ title: string; onNavigate: (page: PageKey) => void }> = ({ title, onNavigate }) => {
  const { state, currentUser, setCurrentCompany } = useAssetStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const alerts = listAlerts(state);
  const myApprovals = myPendingApprovals(state, currentUser);
  const notifCount = alerts.length + myApprovals.length;

  const isSuperadmin = currentUser.role === UserRole.SUPERADMIN;
  const [hasMultipleCompanies, setHasMultipleCompanies] = useState(false);

  React.useEffect(() => {
    // Superadmin is always allowed; the profile is still loading when id is empty.
    if (isSuperadmin || !currentUser.id) {
      setHasMultipleCompanies(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('user_companies')
      .select('company_id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .then(({ count, error }) => {
        if (cancelled || error) return;
        setHasMultipleCompanies((count || 0) > 1);
      });
    return () => { cancelled = true; };
  }, [currentUser.id, isSuperadmin]);

  // Superadmins, and users assigned to more than one company, can switch workspace.
  const canSwitch = isSuperadmin || hasMultipleCompanies;


  return (
    <header className="flex items-center justify-between h-20 px-5 lg:px-8 bg-card border-b border-border shrink-0 gap-4">
      {title === 'Dashboard' ? (
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 truncate shrink-0">
          Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">{currentUser?.name?.split(' ')[0] || 'User'}</span>!
        </h1>
      ) : (
        <h1 className="text-xl lg:text-2xl font-bold text-text-main truncate shrink-0">{title}</h1>
      )}
      <div className="hidden md:block flex-1 max-w-xs">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-3 lg:gap-4">
        <div className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)} className="relative text-gray-500 hover:text-primary p-1.5">
            <Icon name="bell" className="w-5 h-5" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[10px] items-center justify-center font-semibold">{notifCount}</span>
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-96 bg-card border border-border rounded-lg shadow-xl z-20 max-h-[28rem] overflow-y-auto">
              <div className="p-3 font-semibold text-sm border-b border-border sticky top-0 bg-card">Notifications</div>
              {notifCount === 0 ? (
                <p className="p-4 text-sm text-text-light">You're all caught up.</p>
              ) : (
                <div className="divide-y divide-border">
                  {alerts.map(a => (
                    <button key={a.id} onClick={() => { onNavigate(a.page); setNotifOpen(false); }} className="w-full text-left p-3 hover:bg-slate-50">
                      <p className={`text-sm font-medium ${a.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{a.title}</p>
                      <p className="text-xs text-text-light mt-0.5">{a.detail}</p>
                    </button>
                  ))}
                  {myApprovals.map(item => (
                    <button key={item.id} onClick={() => { onNavigate(item.page); setNotifOpen(false); }} className="w-full text-left p-3 hover:bg-slate-50">
                      <p className="text-sm font-medium text-primary">Awaiting your approval · {item.docNo}</p>
                      <p className="text-xs text-text-light mt-0.5 truncate">{item.title}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="font-semibold text-sm leading-tight">{currentUser.name}</p>
            <p className="text-xs text-text-light leading-tight">{currentUser.role}</p>
          </div>
          <button
            onClick={() => setSecurityOpen(true)}
            className={`relative text-gray-500 hover:text-primary p-1.5 ${currentUser.mfaEnrolled ? 'text-emerald-600 hover:text-emerald-700' : ''}`}
            title={currentUser.mfaEnrolled ? 'Two-factor authentication is on' : 'Set up two-factor authentication'}
          >
            <Icon name="key" className="w-5 h-5" />
          </button>
          {canSwitch && (
            <button
              onClick={() => setCurrentCompany?.(null)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors"
              title="Switch Workspace"
            >
              <Icon name="building" className="w-4 h-4" />
              Switch
            </button>
          )}
          <button
            id="header-logout"
            onClick={() => {
              setCurrentCompany(null);
              supabase.auth.signOut();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
          >
            <Icon name="arrowLeft" className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>
      <SecuritySettings isOpen={securityOpen} onClose={() => setSecurityOpen(false)} />
    </header>
  );
};

export default Header;