import React from 'react';
import { Page, User, UserRole } from '../types';
import HomeIcon from './icons/HomeIcon';
import ComplianceIcon from './icons/ComplianceIcon';
import DocumentIcon from './icons/DocumentIcon';
import ClientIcon from './icons/ClientIcon';
import RequestIcon from './icons/RequestIcon';
import UsersIcon from './icons/UsersIcon';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  currentUser: User;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: Page;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <li
    onClick={onClick}
    className={`flex items-center p-3 my-1 rounded-lg cursor-pointer transition-colors duration-200 ${
      isActive
        ? 'bg-primary text-white'
        : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
    }`}
  >
    {icon}
    <span className="ml-4 font-medium">{label}</span>
  </li>
);

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, currentUser }) => {
  const navItems = [
    { icon: <HomeIcon />, label: Page.Dashboard, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
    { icon: <ComplianceIcon />, label: Page.Templates, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { icon: <DocumentIcon />, label: Page.Documents, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
    { icon: <ClientIcon />, label: Page.Clients, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { icon: <RequestIcon />, label: Page.Requests, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
    { icon: <UsersIcon />, label: Page.UserManagement, roles: [UserRole.ADMIN] },
  ];
  
  const visibleNavItems = navItems.filter(item => item.roles.includes(currentUser.role));

  if (currentUser.role === UserRole.CLIENT) {
      // Client view is handled differently, maybe show nothing or a specific client sidebar
      return null; 
  }

  return (
    <aside className="w-64 bg-sidebar text-white flex flex-col">
      <div className="flex items-center justify-center h-20 border-b border-gray-700">
        <ComplianceIcon className="w-8 h-8 text-primary" />
        <h1 className="text-xl font-bold ml-2">DocuFlow</h1>
      </div>
      <nav className="flex-1 px-4 py-4">
        <ul>
          {visibleNavItems.map((item) => (
            <NavItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              isActive={currentPage === item.label}
              onClick={() => setCurrentPage(item.label)}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;