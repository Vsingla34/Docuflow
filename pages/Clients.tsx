
import React, { useState } from 'react';
import { Client, User } from '../types';
import Modal from '../components/Modal';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import ConfirmModal from '../components/ConfirmModal';

interface ClientsProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  currentUser: User;
  onViewDashboard: (client: Client) => void;
}

const Clients: React.FC<ClientsProps> = ({ clients, setClients, currentUser, onViewDashboard }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', company: '', email: '' });
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const isAdmin = currentUser.role === 'Admin';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewClient({ ...newClient, [name]: value });
  };

  const handleAddClient = () => {
    if (!isAdmin) return;
    if (newClient.name && newClient.company && newClient.email) {
      const clientToAdd: Client = {
        id: `cli${Date.now()}`,
        ...newClient,
        joinedDate: new Date().toISOString().split('T')[0],
      };
      setClients([clientToAdd, ...clients]);
      setIsModalOpen(false);
      setNewClient({ name: '', company: '', email: '' });
    }
  };

  const handleDeleteClient = (id: string) => {
    setClients(clients.filter(client => client.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Client Directory</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={!isAdmin}
          className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          aria-label={isAdmin ? "Add New Client" : "You do not have permission to add clients"}
        >
          <PlusIcon className="mr-2" />
          Add Client
        </button>
      </div>

      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="p-4 font-semibold">Client Name</th>
              <th className="p-4 font-semibold">Company</th>
              <th className="p-4 font-semibold">Email</th>
              <th className="p-4 font-semibold">Joined Date</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="p-4 flex items-center">
                    <img src={`https://i.pravatar.cc/40?u=${client.id}`} alt={client.name} className="w-10 h-10 rounded-full mr-4" />
                    <span className="font-medium">{client.name}</span>
                </td>
                <td className="p-4 text-text-light">{client.company}</td>
                <td className="p-4 text-text-light">{client.email}</td>
                <td className="p-4 text-text-light">{client.joinedDate}</td>
                <td className="p-4">
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => onViewDashboard(client)}
                      className="text-primary hover:underline text-sm font-semibold"
                    >
                      View Dashboard
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => setClientToDelete(client)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Delete ${client.name}`}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Client">
        <div className="space-y-4">
          <input name="name" value={newClient.name} onChange={handleInputChange} placeholder="Full Name" className="w-full p-2 border border-border rounded" />
          <input name="company" value={newClient.company} onChange={handleInputChange} placeholder="Company Name" className="w-full p-2 border border-border rounded" />
          <input name="email" value={newClient.email} onChange={handleInputChange} placeholder="Email Address" className="w-full p-2 border border-border rounded" />
          <div className="flex justify-end pt-2">
            <button
              onClick={handleAddClient}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark"
            >
              Save Client
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={() => clientToDelete && handleDeleteClient(clientToDelete.id)}
        title="Delete Client"
        message={`Are you sure you want to delete ${clientToDelete?.name}? All associated documents and requests will also be removed. This action cannot be undone.`}
      />
    </div>
  );
};

export default Clients;