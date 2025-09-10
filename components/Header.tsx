import React, { useState } from 'react';
import { User, Document } from '../types';
import BellIcon from './icons/BellIcon';

interface HeaderProps {
  title: string;
  currentUser: User;
  users: User[];
  setCurrentUser: (user: User) => void;
  documents: Document[];
}

const Header: React.FC<HeaderProps> = ({ title, currentUser, users, setCurrentUser, documents }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleUserChange = (user: User) => {
    setCurrentUser(user);
    setIsDropdownOpen(false);
  };

  const expiringDocuments = documents.filter(doc => {
    if (!doc.expiryDate) return false;
    const expiry = new Date(doc.expiryDate);
    const today = new Date();
    const daysUntilExpiry = (expiry.getTime() - today.getTime()) / (1000 * 3600 * 24);
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  });

  return (
    <header className="flex items-center justify-between h-20 px-6 lg:px-8 bg-card border-b border-border">
      <h1 className="text-2xl font-bold text-text-main">{title}</h1>
      <div className="flex items-center space-x-4">
        <input
          type="text"
          placeholder="Global Search (Clients, Docs...)"
          className="hidden md:block w-64 px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none transition"
        />
        <div className="relative">
            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative text-gray-500 hover:text-primary">
                <BellIcon className="w-6 h-6"/>
                {expiringDocuments.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-xs items-center justify-center">
                            {expiringDocuments.length}
                        </span>
                    </span>
                )}
            </button>
            {isNotificationsOpen && (
                 <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-xl z-10">
                    <div className="p-3 font-semibold border-b">Expiring Soon</div>
                    <div className="max-h-64 overflow-y-auto">
                    {expiringDocuments.length > 0 ? expiringDocuments.map(doc => (
                        <div key={doc.id} className="p-3 border-b hover:bg-gray-50">
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-red-600">Expires: {doc.expiryDate}</p>
                        </div>
                    )) : <p className="p-4 text-sm text-gray-500">No notifications.</p>}
                    </div>
                </div>
            )}
        </div>
        <div className="relative">
          <div 
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <img src={`https://i.pravatar.cc/40?u=${currentUser.id}`} alt={currentUser.name} className="w-10 h-10 rounded-full" />
            <div>
              <p className="font-semibold text-sm">{currentUser.name}</p>
              <p className="text-xs text-text-light">{currentUser.role}</p>
            </div>
          </div>
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-xl z-10">
              <p className="p-2 text-xs text-text-light border-b border-border">Switch User</p>
              {users.map(user => (
                <a
                  key={user.id}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleUserChange(user);
                  }}
                  className={`block px-4 py-2 text-sm hover:bg-background ${currentUser.id === user.id ? 'font-bold text-primary' : 'text-text-main'}`}
                >
                  {user.name} ({user.role})
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
