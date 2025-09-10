import React, { useState } from 'react';
import { DocumentRequest, Client, ComplianceTemplate, DocumentStatus, User } from '../types';
import Modal from '../components/Modal';
import PlusIcon from '../components/icons/PlusIcon';
import BellIcon from '../components/icons/BellIcon';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import TrashIcon from '../components/icons/TrashIcon';

interface RequestsProps {
  requests: DocumentRequest[];
  setRequests: React.Dispatch<React.SetStateAction<DocumentRequest[]>>;
  clients: Client[];
  templates: ComplianceTemplate[];
  currentUser: User;
  onOpenPortal: (token: string) => void;
}

const Requests: React.FC<RequestsProps> = ({ requests, setRequests, clients, templates, currentUser, onOpenPortal }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({ clientId: '', templateId: '', dueDate: '' });
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error'} | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<DocumentRequest | null>(null);
  const [portalLink, setPortalLink] = useState<string | null>(null);

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'Unknown';
  const getComplianceName = (complianceId: string) => templates.find(c => c.id === complianceId)?.name || 'Unknown';
  
  const handleAddRequest = () => {
    if (newRequest.clientId && newRequest.templateId && newRequest.dueDate) {
        const selectedTemplate = templates.find(c => c.id === newRequest.templateId);
        if (!selectedTemplate) return;

        const docsToRequest = selectedTemplate.requiredDocuments.map(d => ({id: d.id, name: d.name})) || [];

        const requestToAdd: DocumentRequest = {
            id: `req${Date.now()}`,
            clientId: newRequest.clientId,
            complianceId: newRequest.templateId,
            documents: docsToRequest,
            status: DocumentStatus.Pending,
            requestDate: new Date().toISOString().split('T')[0],
            dueDate: newRequest.dueDate,
            portalToken: `${Date.now().toString(36)}-${Math.random().toString(36).substr(2)}`,
            clarificationThread: [],
        };
        setRequests([requestToAdd, ...requests]);
        setIsModalOpen(false);
        setNewRequest({ clientId: '', templateId: '', dueDate: '' });
    }
  };

  const handleDeleteRequest = (id: string) => {
    setRequests(requests.filter(req => req.id !== id));
  }
  
  const handleSendReminder = (requestId: string) => {
    console.log(`Sending reminder for request: ${requestId}`);
    setToast({ message: "Reminder sent successfully!", type: 'success'});
  };

  const getStatusBadge = (status: DocumentStatus) => {
    const statusText = status.replace('_', ' ');
    switch (status) {
      case DocumentStatus.Pending:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">{statusText}</span>;
      case DocumentStatus.Received:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">{statusText}</span>;
      case DocumentStatus.Under_Review:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">{statusText}</span>;
      case DocumentStatus.Approved:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">{statusText}</span>;
      case DocumentStatus.Rejected:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">{statusText}</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">{statusText}</span>;
    }
  };
  
  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Document Requests</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
          <PlusIcon className="mr-2" />
          New Request
        </button>
      </div>

      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="p-4 font-semibold">Client</th>
              <th className="p-4 font-semibold">Compliance Type</th>
              <th className="p-4 font-semibold">Due Date</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="p-4 font-medium">{getClientName(request.clientId)}</td>
                <td className="p-4 text-text-light">{getComplianceName(request.complianceId)}</td>
                <td className="p-4 text-text-light">{request.dueDate}</td>
                <td className="p-4">{getStatusBadge(request.status)}</td>
                <td className="p-4">
                  <div className="flex items-center space-x-4">
                    <button onClick={() => setPortalLink(`${window.location.origin}?portal_token=${request.portalToken}`)} className="text-sm text-primary hover:underline font-semibold">Get Client Link</button>
                    {request.status !== DocumentStatus.Approved && (
                      <button onClick={() => handleSendReminder(request.id)} className="flex items-center space-x-1 text-sm text-yellow-600 hover:text-yellow-800 font-semibold" title="Send Reminder">
                        <BellIcon className="w-4 h-4" />
                      </button>
                    )}
                     <button 
                        onClick={() => setRequestToDelete(request)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Delete request for ${getClientName(request.clientId)}`}
                        title="Delete Request"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Document Request">
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Client</label>
                <select value={newRequest.clientId} onChange={e => setNewRequest({...newRequest, clientId: e.target.value})} className="mt-1 block w-full p-2 border border-border rounded">
                    <option value="">Select a client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Compliance Template</label>
                <select value={newRequest.templateId} onChange={e => setNewRequest({...newRequest, templateId: e.target.value})} className="mt-1 block w-full p-2 border border-border rounded">
                    <option value="">Select a template</option>
                    {templates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Due Date</label>
                <input type="date" value={newRequest.dueDate} onChange={e => setNewRequest({...newRequest, dueDate: e.target.value})} className="mt-1 block w-full p-2 border border-border rounded"/>
            </div>
            <div className="flex justify-end pt-2">
                <button onClick={handleAddRequest} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">
                    Send Request
                </button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={!!portalLink} onClose={() => setPortalLink(null)} title="Client Portal Link">
          <p className="mb-4 text-text-light">Share this secure link with your client to upload their documents:</p>
          <input type="text" readOnly value={portalLink || ''} className="w-full p-2 border rounded bg-gray-100" />
          <div className="flex justify-end pt-4">
              <button onClick={() => { navigator.clipboard.writeText(portalLink || ''); setToast({message: 'Link copied!', type: 'success'}) }} className="bg-secondary text-white px-4 py-2 rounded-lg hover:bg-green-600">Copy Link</button>
          </div>
      </Modal>

       <ConfirmModal 
        isOpen={!!requestToDelete}
        onClose={() => setRequestToDelete(null)}
        onConfirm={() => requestToDelete && handleDeleteRequest(requestToDelete.id)}
        title="Delete Request"
        message={`Are you sure you want to delete this request for ${getClientName(requestToDelete?.clientId || '')}? This action cannot be undone.`}
      />
    </div>
  );
};

export default Requests;
