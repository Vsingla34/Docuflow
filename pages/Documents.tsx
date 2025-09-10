import React, { useState } from 'react';
import { Document, Client, DocumentStatus } from '../types';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import XCircleIcon from '../components/icons/XCircleIcon';
import ClockIcon from '../components/icons/ClockIcon';
import DocumentIcon from '../components/icons/DocumentIcon';
import GoogleDriveIcon from '../components/icons/GoogleDriveIcon';
import HistoryIcon from '../components/icons/HistoryIcon';
import VersionHistoryModal from '../components/VersionHistoryModal';
import Modal from '../components/Modal';

interface DocumentsProps {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  clients: Client[];
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

const Documents: React.FC<DocumentsProps> = ({ documents, setDocuments, clients }) => {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'Unknown';

  const updateDocumentStatus = (docId: string, newStatus: DocumentStatus, notes: string) => {
    setDocuments(docs => docs.map(d => {
        if (d.id === docId) {
            const newVersion = {
                version: d.versionHistory.length + 1,
                status: newStatus,
                notes: notes,
                updatedAt: new Date().toISOString().split('T')[0],
                updatedBy: 'Current User' // Replace with actual user
            };
            const updatedDoc = {...d, status: newStatus, versionHistory: [...d.versionHistory, newVersion]};

            if (newStatus === DocumentStatus.Approved) {
                 const client = clients.find(c => c.id === d.clientId);
                 updatedDoc.driveLink = `https://drive.google.com/d/${client?.name.replace(/\s/g, '_')}/${d.requestId}/${d.name.replace(/\s/g, '_')}`;
            }
            if (newStatus === DocumentStatus.Rejected) {
                updatedDoc.rejectionReason = notes;
            }
            return updatedDoc;
        }
        return d;
    }));
  };
  
  const handleRejectSubmit = () => {
      if (selectedDocument && rejectionReason) {
          updateDocumentStatus(selectedDocument.id, DocumentStatus.Rejected, rejectionReason);
          setIsRejectModalOpen(false);
          setRejectionReason("");
          setSelectedDocument(null);
      }
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-text-main">All Documents</h2>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="border-b-2 border-border text-sm text-text-light uppercase tracking-wider">
                    <tr>
                        <th className="py-3 px-4">Document Name</th>
                        <th className="py-3 px-4">Client</th>
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
                                <td className="py-3 px-4">{getClientName(doc.clientId)}</td>
                                <td className="py-3 px-4">
                                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">{doc.type}</span>
                                </td>
                                <td className="py-3 px-4 font-mono">{doc.expiryDate || 'N/A'}</td>
                                <td className="py-3 px-4">
                                   <StatusIndicator status={doc.status} />
                                </td>
                                <td className="py-3 px-4 space-x-2">
                                    <div className="flex items-center space-x-3">
                                        {doc.status === DocumentStatus.Received && (
                                            <button onClick={() => updateDocumentStatus(doc.id, DocumentStatus.Under_Review, 'Review started.')} className="text-purple-600 hover:underline text-sm font-semibold">Start Review</button>
                                        )}
                                        {doc.status === DocumentStatus.Under_Review && (
                                            <>
                                            <button onClick={() => updateDocumentStatus(doc.id, DocumentStatus.Approved, 'Document approved.')} className="text-green-600 hover:underline text-sm font-semibold">Approve</button>
                                            <button onClick={() => { setSelectedDocument(doc); setIsRejectModalOpen(true); }} className="text-red-600 hover:underline text-sm font-semibold">Reject</button>
                                            </>
                                        )}
                                        {doc.driveLink && (
                                            <a href={doc.driveLink} target="_blank" rel="noopener noreferrer" title="View on Drive"><GoogleDriveIcon className="w-5 h-5 text-blue-600"/></a>
                                        )}
                                        <button onClick={() => { setSelectedDocument(doc); setIsHistoryModalOpen(true); }} title="View History"><HistoryIcon className="w-5 h-5 text-gray-500"/></button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
        
        {selectedDocument && <VersionHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} document={selectedDocument} />}

        <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Reject Document">
            <div className="space-y-4">
                <p>Please provide a reason for rejecting the document: <strong>{selectedDocument?.name}</strong></p>
                <textarea 
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., Document is blurry, incorrect information..."
                />
                <div className="flex justify-end">
                    <button onClick={handleRejectSubmit} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Confirm Rejection</button>
                </div>
            </div>
        </Modal>

    </div>
  );
};

export default Documents;
