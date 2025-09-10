import React from 'react';
import { Document, DocumentStatus } from '../types';
import Modal from './Modal';
import CheckCircleIcon from './icons/CheckCircleIcon';
import XCircleIcon from './icons/XCircleIcon';
import DocumentIcon from './icons/DocumentIcon';
import ClockIcon from './icons/ClockIcon';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
}

const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
        case DocumentStatus.Approved: return <CheckCircleIcon className="w-5 h-5 text-green-500"/>;
        case DocumentStatus.Rejected: return <XCircleIcon className="w-5 h-5 text-red-500"/>;
        case DocumentStatus.Received: return <DocumentIcon className="w-5 h-5 text-blue-500"/>;
        default: return <ClockIcon className="w-5 h-5 text-gray-500"/>;
    }
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ isOpen, onClose, document }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`History for ${document.name}`}>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {document.versionHistory.length > 0 ? (
            document.versionHistory.slice().reverse().map(version => (
                <div key={version.version} className="flex space-x-4">
                    <div className="flex flex-col items-center">
                        <span className="flex items-center justify-center w-8 h-8 bg-background rounded-full">
                           {getStatusIcon(version.status)}
                        </span>
                        <div className="w-px h-full bg-border"></div>
                    </div>
                    <div>
                        <p className="font-semibold">{version.status.replace('_', ' ')}</p>
                        <p className="text-sm text-text-light">by {version.updatedBy} on {version.updatedAt}</p>
                        <p className="text-sm mt-1 p-2 bg-gray-50 rounded-md">{version.notes}</p>
                    </div>
                </div>
            ))
        ) : (
            <p className="text-text-light text-center py-4">No history available for this document.</p>
        )}
      </div>
    </Modal>
  );
};

export default VersionHistoryModal;
