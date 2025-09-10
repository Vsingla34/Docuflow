import React, { useState } from 'react';
import { ComplianceTemplate, User, DocumentType, ComplianceFrequency } from '../types';
import Modal from '../components/Modal';
import PlusIcon from '../components/icons/PlusIcon';
import CloseIcon from '../components/icons/CloseIcon';
import TrashIcon from '../components/icons/TrashIcon';
import ConfirmModal from '../components/ConfirmModal';

interface TemplateLibraryProps {
  templates: ComplianceTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<ComplianceTemplate[]>>;
  currentUser: User;
}

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ templates, setTemplates, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  
  const [selectedTemplate, setSelectedTemplate] = useState<ComplianceTemplate | null>(null);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [newDocumentType, setNewDocumentType] = useState<DocumentType>(DocumentType.OTHER);

  const [templateToDelete, setTemplateToDelete] = useState<ComplianceTemplate | null>(null);
  
  const isAdmin = currentUser.role === 'Admin';

  const handleAddTemplate = () => {
    if (!isAdmin) return;
    if (newTemplateName.trim() && newTemplateDesc.trim()) {
      const newTemplate: ComplianceTemplate = {
        id: `com${Date.now()}`,
        name: newTemplateName,
        description: newTemplateDesc,
        requiredDocuments: [],
        frequency: ComplianceFrequency.ONE_TIME,
        dueDateRule: { day: 15, month_offset: 0 },
        autoRecurrence: false,
      };
      setTemplates([...templates, newTemplate]);
      setIsModalOpen(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
    }
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter(c => c.id !== id));
  };
  
  const handleAddDocument = () => {
    if (!isAdmin || !newDocumentName.trim() || !selectedTemplate) return;

    const newDocument = {
      id: `doc-req-${Date.now()}`,
      name: newDocumentName.trim(),
      type: newDocumentType,
    };

    const updatedTemplates = templates.map(c => 
      c.id === selectedTemplate.id 
        ? { ...c, requiredDocuments: [...(c.requiredDocuments || []), newDocument] }
        : c
    );
    setTemplates(updatedTemplates);
    setSelectedTemplate(updatedTemplates.find(c => c.id === selectedTemplate.id) || null);
    setNewDocumentName('');
    setNewDocumentType(DocumentType.OTHER);
  };

  const handleDeleteDocument = (docId: string) => {
    if (!isAdmin || !selectedTemplate) return;

    const updatedTemplates = templates.map(c =>
      c.id === selectedTemplate.id
        ? { ...c, requiredDocuments: (c.requiredDocuments || []).filter(doc => doc.id !== docId) }
        : c
    );
    setTemplates(updatedTemplates);
    setSelectedTemplate(updatedTemplates.find(c => c.id === selectedTemplate.id) || null);
  };

  if (selectedTemplate) {
    return (
      <div className="bg-card p-6 rounded-xl shadow-sm animate-fade-in-up">
        <div className="flex justify-between items-start">
            <div>
                <button onClick={() => setSelectedTemplate(null)} className="flex items-center text-sm text-primary mb-4 font-semibold hover:underline">
                  &larr; Back to all templates
                </button>
                <h2 className="text-2xl font-bold text-text-main">{selectedTemplate.name}</h2>
                <p className="text-text-light mt-1 mb-6">{selectedTemplate.description}</p>
                <div className="flex items-center space-x-4 text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">{selectedTemplate.frequency}</span>
                    <span className="text-text-light">Auto-Recurrence: <span className={selectedTemplate.autoRecurrence ? 'font-bold text-green-600' : 'font-bold text-red-600'}>{selectedTemplate.autoRecurrence ? 'On' : 'Off'}</span></span>
                </div>
            </div>
            {isAdmin && (
                 <button 
                    onClick={() => setTemplateToDelete(selectedTemplate)}
                    className="flex items-center text-sm text-red-500 hover:text-red-700 font-semibold space-x-1"
                >
                    <TrashIcon className="w-4 h-4" />
                    <span>Delete Template</span>
                </button>
            )}
        </div>
        
        <div className="mt-6 border-t border-border pt-6">
          <h3 className="text-lg font-semibold mb-4">Required Documents Checklist</h3>
          <div className="space-y-3 mb-4">
            {(selectedTemplate.requiredDocuments || []).map(doc => (
              <div key={doc.id} className="flex justify-between items-center bg-background p-3 rounded-md">
                <div>
                    <p>{doc.name}</p>
                    <p className="text-xs text-text-light px-2 py-0.5 bg-gray-200 rounded-full inline-block mt-1">{doc.type}</p>
                </div>
                {isAdmin && (
                  <button onClick={() => handleDeleteDocument(doc.id)} className="text-red-500 hover:text-red-700">
                    <CloseIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            {(!selectedTemplate.requiredDocuments || selectedTemplate.requiredDocuments.length === 0) && (
              <p className="text-text-light text-center py-4">No required documents have been added yet.</p>
            )}
          </div>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <input
                type="text"
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
                placeholder="Enter new document name"
                className="flex-grow px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              />
              <select 
                value={newDocumentType} 
                onChange={(e) => setNewDocumentType(e.target.value as DocumentType)}
                className="px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-white"
              >
                  {Object.values(DocumentType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <button onClick={handleAddDocument} className="flex items-center justify-center bg-secondary text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors">
                <PlusIcon className="mr-1" />
                Add
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Compliance Template Library</h2>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
          >
            <PlusIcon className="mr-2" />
            Add Template
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template, index) => (
          <div 
            key={template.id} 
            onClick={() => setSelectedTemplate(template)} 
            className="bg-card p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms`}}
          >
            <h3 className="font-bold text-lg text-text-main">{template.name}</h3>
            <p className="text-text-light mt-2 h-10 overflow-hidden">{template.description}</p>
            <div className="flex justify-between items-center mt-4">
                 <p className="text-sm font-semibold text-primary">
                    {template.requiredDocuments?.length || 0} required docs
                 </p>
                 <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">{template.frequency}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Template">
        <div className="space-y-4">
          <div>
            <label htmlFor="templateName" className="block text-sm font-medium text-gray-700">Template Name</label>
            <input
              type="text"
              id="templateName"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="templateDesc" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="templateDesc"
              rows={3}
              value={newTemplateDesc}
              onChange={(e) => setNewTemplateDesc(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleAddTemplate}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
            >
              Save Template
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        onConfirm={() => {
            if(templateToDelete) {
                handleDeleteTemplate(templateToDelete.id);
                setSelectedTemplate(null);
            }
        }}
        title="Delete Template"
        message={`Are you sure you want to delete the template "${templateToDelete?.name}"? This action cannot be undone.`}
      />
    </div>
  );
};

export default TemplateLibrary;
