import React from 'react';
import { User } from '../../types';
import { NAV_SECTIONS, PAGE_PERMISSION_MODULE, PageKey } from './nav';
import Icon from '../icons/Icon';
import { supabase } from '../../lib/supabase';
import { useAssetStore } from '../../store/AssetStore';
import { canViewModule, getCustomRole } from '../../lib/permissions';

const Sidebar: React.FC<{ currentPage: PageKey; setCurrentPage: (page: PageKey) => void; currentUser: User }> = ({
  currentPage, setCurrentPage, currentUser,
}) => {
  const { state, currentCompany } = useAssetStore();

  const customRole = getCustomRole(currentUser, state.customRoles);

  // A page with no entry in PAGE_PERMISSION_MODULE (dashboard, lookup, employees, ...) is never
  // restricted by a custom role — only by the base-role check (item.roles) below. A page that
  // does have a module is hidden the moment that module's "view" permission is off. A section
  // itself is only ever hidden as a consequence of every one of its items being hidden (see the
  // items.length === 0 check below) — there's no separate, easy-to-miss section-level switch to
  // keep in sync with the page list, which is what let most pages slip through unrestricted
  // before.
  const hasItemAccess = (itemKey: PageKey): boolean => {
    const module = PAGE_PERMISSION_MODULE[itemKey];
    if (!module) return true;
    return canViewModule(customRole, module);
  };

  return (
    <aside className="w-64 bg-sidebar text-white flex flex-col shrink-0 hidden md:flex">
      <div className="flex flex-col border-b border-white/10 p-5 gap-4 shrink-0">
        <div className="flex items-center">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Icon name="box" className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3 leading-tight">
            <h1 className="text-base font-bold">AssetFlow</h1>
            <p className="text-[11px] text-slate-400">Lifecycle Manager</p>
          </div>
        </div>

        {currentCompany && (
          <div className="flex items-center bg-slate-800/50 rounded-xl p-2 border border-white/5">
            <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex items-center justify-center shrink-0 p-1 shadow-inner">
              {currentCompany.logoUrl ? (
                <img src={currentCompany.logoUrl} alt={currentCompany.name} className="w-full h-full object-contain" />
              ) : (
                <Icon name="building" className="w-6 h-6 text-slate-300" />
              )}
            </div>
            <div className="ml-3 min-w-0 flex-1 pr-1">
              <p className="text-sm font-semibold truncate text-slate-100">{currentCompany.name}</p>
              <p className="text-[10px] text-slate-400 truncate tracking-widest font-medium uppercase">{currentCompany.displayId}</p>
            </div>
          </div>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-2">
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(item =>
            item.roles.includes(currentUser.role) && hasItemAccess(item.key)
          );
          if (items.length === 0) return null;

          const isCurrentSection = items.some(i => i.key === currentPage);

          return (
            <div key={section.title} className="group flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 text-slate-400 cursor-default transition-colors group-hover:text-slate-200">
                <span className={`uppercase transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] origin-left ${isCurrentSection
                    ? 'text-[10px] font-semibold tracking-wider text-primary'
                    : 'text-sm font-bold tracking-normal group-hover:text-[10px] group-hover:font-semibold group-hover:tracking-wider group-hover:text-primary'
                  }`}>
                  {section.title}
                </span>
                <Icon
                  name="chevronDown"
                  className={`w-3.5 h-3.5 transition-all duration-300 ${isCurrentSection ? 'rotate-180 opacity-100 text-primary' : 'opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:rotate-180 group-hover:text-primary'}`}
                />
              </div>
              <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isCurrentSection
                  ? 'grid-rows-[1fr] opacity-100 mt-1'
                  : 'grid-rows-[0fr] opacity-0 mt-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-hover:mt-1'
                }`}>
                <ul className="space-y-0.5 overflow-hidden">
                  {items.map(item => (
                    <li key={item.key}>
                      <button
                        onClick={() => setCurrentPage(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentPage === item.key ? 'bg-primary text-white font-medium' : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                          }`}
                      >
                        <Icon name={item.icon as any} className="w-5 h-5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 text-[11px] text-slate-500 flex flex-col gap-2">
        <p>Signed in as <span className="text-slate-300">{currentUser.role}</span></p>
      </div>
    </aside>
  );
};

export default Sidebar;