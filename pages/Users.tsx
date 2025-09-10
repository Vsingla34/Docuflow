import React, { useState } from 'react';
import { User, Client, UserRole } from '../types';
import Modal from '../components/Modal';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import ConfirmModal from '../components/ConfirmModal';

interface UsersProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  clients: Client[];
}

const Users: React.FC<UsersProps> = ({ users, setUsers, clients }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [formData, setFormData] = useState<{name: string; role: UserRole; clientId?: string}>({ name: '', role: UserRole.STAFF, clientId: ''});
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'N/A';
    return clients.find(c => c.id === clientId)?.company || 'Unknown Client';
  }

  const handleOpenModal = (user: User | null = null) => {
    setUserToEdit(user);
    if (user) {
        setFormData({ name: user.name, role: user.role, clientId: user.clientId || '' });
    } else {
        setFormData({ name: '', role: UserRole.STAFF, clientId: clients.length > 0 ? clients[0].id : '' });
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setUserToEdit(null);
    setFormData({ name: '', role: UserRole.STAFF, clientId: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveUser = () => {
    if (!formData.name) return;

    if (userToEdit) { // Editing existing user
        setUsers(users.map(u => u.id === userToEdit.id ? { ...u, ...formData } : u));
    } else { // Adding new user
        const newUser: User = {
            id: `user${Date.now()}`,
            ...formData,
        };
        setUsers([newUser, ...users]);
    }
    handleCloseModal();
  };

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter(user => user.id !== id));
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">User Management</h2>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
          aria-label="Add New User"
        >
          <PlusIcon className="mr-2" />
          Add User
        </button>
      </div>

      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="p-4 font-semibold">User Name</th>
              <th className="p-4 font-semibold">Role</th>
              <th className="p-4 font-semibold">Assigned Client</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="p-4 flex items-center">
                    <img src={`https://i.pravatar.cc/40?u=${user.id}`} alt={user.name} className="w-10 h-10 rounded-full mr-4" />
                    <span className="font-medium">{user.name}</span>
                </td>
                <td className="p-4 text-text-light">{user.role}</td>
                <td className="p-4 text-text-light">{getClientName(user.clientId)}</td>
                <td className="p-4">
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => handleOpenModal(user)}
                      className="text-primary hover:underline text-sm font-semibold"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => setUserToDelete(user)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={`Delete ${user.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={userToEdit ? 'Edit User' : 'Add New User'}>
        <div className="space-y-4">
          <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input name="name" value={formData.name} onChange={handleInputChange} placeholder="John Doe" className="w-full p-2 border border-border rounded mt-1" />
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select name="role" value={formData.role} onChange={handleInputChange} className="w-full p-2 border border-border rounded mt-1">
                  {Object.values(UserRole).filter(r => r !== UserRole.VIEWER).map(role => (
                      <option key={role} value={role}>{role}</option>
                  ))}
              </select>
          </div>
          {formData.role === UserRole.CLIENT && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Assign to Client</label>
                <select name="clientId" value={formData.clientId} onChange={handleInputChange} className="w-full p-2 border border-border rounded mt-1">
                    {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.company}</option>
                    ))}
                </select>
              </div>
          )}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveUser}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark"
            >
              Save User
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => userToDelete && handleDeleteUser(userToDelete.id)}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.name}? This action cannot be undone.`}
      />
    </div>
  );
};

export default Users;
