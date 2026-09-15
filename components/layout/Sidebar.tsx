import React from 'react';
import { User } from '../../types';
import { NAV_SECTIONS, PageKey } from './nav';
import Icon from '../icons/Icon';

const Sidebar: React.FC<{ currentPage: PageKey; setCurrentPage: (page: PageKey) => void; currentUser: User }> = ({
  currentPage, setCurrentPage, currentUser,
}) => {
  return (
    <aside className="w-64 bg-sidebar text-white flex flex-col shrink-0 hidden md:flex">
      <div className="flex items-center h-20 px-6 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <Icon name="box" className="w-5 h-5 text-white" />
        </div>
        <div className="ml-3 leading-tight">
          <h1 className="text-base font-bold">AssetFlow</h1>
          <p className="text-[11px] text-slate-400">Lifecycle Manager</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(item => item.roles.includes(currentUser.role));
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
              <ul className="space-y-0.5">
                {items.map(item => (
                  <li key={item.key}>
                    <button
                      onClick={() => setCurrentPage(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        currentPage === item.key ? 'bg-primary text-white font-medium' : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                      }`}
                    >
                      <Icon name={item.icon as any} className="w-4.5 h-4.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 text-[11px] text-slate-500">
        Signed in as <span className="text-slate-300">{currentUser.role}</span>
      </div>
    </aside>
  );
};

export default Sidebar;
