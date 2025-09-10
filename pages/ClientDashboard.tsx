import React from 'react';
import { Client, Document, DocumentRequest, ComplianceTemplate, DocumentStatus } from '../types';
import DashboardCard from '../components/DashboardCard';
import DocumentIcon from '../components/icons/DocumentIcon';
import RequestIcon from '../components/icons/RequestIcon';
import ClockIcon from '../components/icons/ClockIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import XCircleIcon from '../components/icons/XCircleIcon';
import GoogleDriveIcon from '../components/icons/GoogleDriveIcon';

interface ClientDashboardProps {
  client: Client;
  onBack: () => void;
  allDocuments: Document[];
  setAllDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  allRequests: DocumentRequest[];
  compliances: ComplianceTemplate[];
}

const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return 'valid';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = (expiry.getTime() - today.getTime()) / (1000 * 3600 * 24);
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 30) return 'expiring_soon';
    return 'valid';
}

const StatusIndicator: React.FC<{ status: DocumentStatus }> = ({ status }) => {
    const baseClasses = "flex items-center space-x-2 text-sm font-medium";
    switch (status) {
        case DocumentStatus.Approved:
            return <div className={`${baseClasses} text-green-600`}><CheckCircleIcon /><span>Approved</span></div>;
        case DocumentStatus.Rejected:
            return <div className={`${baseClasses} text-red-600`}><XCircleIcon /><span>Rejected</span></div>;
        case DocumentStatus.Received:
            return <div className={`${baseClasses} text-blue-600`}><DocumentIcon className="w-5 h-5"/><span>Received</span></div>;
        case DocumentStatus.Under_Review:
             return <div className={`${baseClasses} text-purple-600`}><ClockIcon/><span>Under Review</span></div>;
        case DocumentStatus.Pending:
            return <div className={`${baseClasses} text-yellow-600`}><ClockIcon /><span>Pending</span></div>;
        default:
            return <div className={`${baseClasses} text-gray-600`}><ClockIcon /><span>{status.replace('_', ' ')}</span></div>;
    }
};

const ClientDashboard: React.FC<ClientDashboardProps> = ({ client, onBack, allDocuments, setAllDocuments, allRequests, compliances }) => {
  const documents = allDocuments.filter(doc => doc.clientId === client.id);
  const requests = allRequests.filter(req => req.clientId === client.id);

  const pendingRequests = requests.filter(r => r.status !== DocumentStatus.Approved);
  const totalDocuments = documents.length;
  const approvedDocuments = documents.filter(d => d.status === DocumentStatus.Approved).length;

  const handleApproveAndSave = (docId: string) => {
    const docToUpdate = documents.find(d => d.id === docId);
    if (!docToUpdate) return;

    const updatedDoc: Document = {
      ...docToUpdate,
      status: DocumentStatus.Approved,
      driveLink: `https://drive.google.com/d/${client.name.replace(/\s/g, '_')}/${docToUpdate.requestId}/${docToUpdate.name.replace(/\s/g, '_')}`
    };

    setAllDocuments(allDocuments.map(d => d.id === docId ? updatedDoc : d));
  };


  return (
    <div className="animate-fade-in-up space-y-8">
      <button onClick={onBack} className="flex items-center text-sm text-primary mb-4 font-semibold hover:underline">
        &larr; Back to all clients
      </button>

      <div className="flex items-center space-x-4">
        <img src={`https://i.pravatar.cc/80?u=${client.id}`} alt={client.name} className="w-20 h-20 rounded-full" />
        <div>
          <h1 className="text-3xl font-bold text-text-main">{client.name}</h1>
          <p className="text-text-light">{client.company} | {client.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard title="Total Documents" value={totalDocuments} icon={<DocumentIcon className="w-6 h-6 text-white"/>} color="bg-blue-400" />
        <DashboardCard title="Approved Documents" value={approvedDocuments} icon={<CheckCircleIcon className="w-6 h-6 text-white"/>} color="bg-green-400" />
        <DashboardCard title="Pending Requests" value={pendingRequests.length} icon={<RequestIcon className="w-6 h-6 text-white"/>} color="bg-yellow-400" />
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-card p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-text-main">Pending Requests</h2>
            <div className="space-y-4">
                {pendingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                        <div>
                            <p className="font-semibold">{compliances.find(c => c.id === req.complianceId)?.name}</p>
                            <p className="text-sm text-text-light">{req.documents.length} documents requested</p>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-yellow-600">
                            <ClockIcon />
                            <span>Due: {req.dueDate}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-text-main">Documents for {client.name}</h2>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b-2 border-border text-sm text-text-light uppercase tracking-wider">
                        <th className="py-3 px-4">Document Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Expiry Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {documents.map(doc => {
                        const expiryStatus = getExpiryStatus(doc.expiryDate);
                        const rowClass = {
                            'expired': 'bg-red-50 text-red-800',
                            'expiring_soon': 'bg-yellow-50 text-yellow-800',
                            'valid': ''
                        }[expiryStatus];

                        return (
                             <tr key={doc.id} className={`border-b border-border hover:bg-background transition-colors ${rowClass}`}>
                                <td className="py-3 px-4 font-medium">{doc.name}</td>
                                <td className="py-3 px-4">
                                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">{doc.type}</span>
                                </td>
                                <td className="py-3 px-4 font-mono">{doc.expiryDate || 'N/A'}</td>
                                <td className="py-3 px-4">
                                   <StatusIndicator status={doc.status} />
                                </td>
                                <td className="py-3 px-4">
                                    {doc.status === DocumentStatus.Received && (
                                        <button onClick={() => handleApproveAndSave(doc.id)} className="text-primary hover:underline text-sm font-semibold">
                                            Approve & Save
                                        </button>
                                    )}
                                    {doc.driveLink && (
                                        <a href={doc.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-blue-600 hover:underline text-sm font-semibold">
                                            <GoogleDriveIcon className="w-4 h-4" />
                                            <span>View on Drive</span>
                                        </a>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    </div>
  </div>
  );
};

export default ClientDashboard;
