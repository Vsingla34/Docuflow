import React, { useState } from 'react';
import { User } from '../../types';
import { useAssetStore } from '../../store/AssetStore';
import { listAlerts, myPendingApprovals } from '../../lib/notifications';
import { PageKey } from './nav';
import Icon from '../icons/Icon';

const Header: React.FC<{ title: string; onNavigate: (page: PageKey) => void }> = ({ title, onNavigate }) => {
  const { state, currentUser, users, setCurrentUser } = useAssetStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const alerts = listAlerts(state);
  const myApprovals = myPendingApprovals(state, currentUser);
  const notifCount = alerts.length + myApprovals.length;

  const handleUserChange = (user: User) => {
    setCurrentUser(user);
    setUserMenuOpen(false);
  };

  return (
    <header className="flex items-center justify-between h-20 px-5 lg:px-8 bg-card border-b border-border shrink-0">
      <h1 className="text-xl lg:text-2xl font-bold text-text-main truncate">{title}</h1>
      <div className="flex items-center gap-3 lg:gap-4">
        <div className="relative">
          <button onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }} className="relative text-gray-500 hover:text-primary p-1.5">
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
        <div className="relative">
          <button
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
          >
            <img src={`https://i.pravatar.cc/40?u=${currentUser.id}`} alt="" className="w-9 h-9 rounded-full" />
            <div className="hidden sm:block text-left">
              <p className="font-semibold text-sm leading-tight">{currentUser.name}</p>
              <p className="text-xs text-text-light leading-tight">{currentUser.role}</p>
            </div>
            <Icon name="chevronDown" className="w-4 h-4 text-text-light hidden sm:block" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-card border border-border rounded-lg shadow-xl z-20">
              <p className="p-2.5 text-xs text-text-light border-b border-border">Switch role (demo)</p>
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleUserChange(user)}
                  className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 ${currentUser.id === user.id ? 'font-bold text-primary' : 'text-text-main'}`}
                >
                  {user.name} <span className="text-text-light font-normal">· {user.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
