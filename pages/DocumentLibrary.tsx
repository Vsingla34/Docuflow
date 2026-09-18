import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { DocumentCategory, DocumentEntityType, UserRole } from '../types';
import { ListToolbar, SearchInput, FilterSelect, TableCard, THead, Tr, Td } from '../components/ui/Table';
import { Pill } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/Overlay';
import { EmptyState } from '../components/ui/EmptyState';
import Icon from '../components/icons/Icon';
import { formatDate } from '../lib/format';
import { downloadDataUrl, formatBytes, iconForFile, isImageFile } from '../lib/files';
import { PageKey } from '../components/layout/nav';

const ENTITY_PAGE: Record<DocumentEntityType, PageKey> = {
  [DocumentEntityType.Asset]: 'assets',
  [DocumentEntityType.Requisition]: 'requisitions',
  [DocumentEntityType.PurchaseOrder]: 'purchaseOrders',
  [DocumentEntityType.Grn]: 'grns',
  [DocumentEntityType.Transfer]: 'transfers',
  [DocumentEntityType.GatePass]: 'gatePasses',
  [DocumentEntityType.AmcContract]: 'amc',
  [DocumentEntityType.ServiceTicket]: 'serviceTickets',
  [DocumentEntityType.Replacement]: 'replacements',
  [DocumentEntityType.Disposal]: 'disposals',
  [DocumentEntityType.Vendor]: 'masters',
  [DocumentEntityType.Employee]: 'employees',
};

const DocumentLibrary: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser, deleteDocument } = useAssetStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [toDelete, setToDelete] = useState<string | null>(null);

  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGEMENT;

  const filtered = state.documents.filter(d => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || d.fileName.toLowerCase().includes(q) || d.entityLabel.toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'all' || d.category === categoryFilter;
    const matchesEntity = entityFilter === 'all' || d.entityType === entityFilter;
    return matchesSearch && matchesCategory && matchesEntity;
  });

  return (
    <div>
      <ListToolbar title="Document Library" count={filtered.length}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search file or linked record..." />
        <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={[{ value: 'all', label: 'All categories' }, ...Object.values(DocumentCategory).map(c => ({ value: c, label: c }))]} />
        <FilterSelect value={entityFilter} onChange={setEntityFilter} options={[{ value: 'all', label: 'All record types' }, ...Object.values(DocumentEntityType).map(t => ({ value: t, label: t }))]} />
      </ListToolbar>

      {filtered.length === 0 ? (
        <EmptyState icon="clipboard" title="No documents found" message="Files attached to assets, purchase orders, AMC contracts and more will show up here." />
      ) : (
        <TableCard>
          <THead columns={['File', 'Category', 'Linked To', 'Uploaded By', 'Date', 'Size', '']} />
          <tbody>
            {filtered.map(doc => (
              <Tr key={doc.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    {isImageFile(doc.mimeType) ? (
                      <img src={doc.dataUrl} alt="" className="w-8 h-8 rounded object-cover border border-border" />
                    ) : (
                      <span className="text-xl" aria-hidden>{iconForFile(doc.mimeType, doc.fileName)}</span>
                    )}
                    <span className="font-medium text-text-main">{doc.fileName}</span>
                  </div>
                  {doc.remarks && <p className="text-xs text-text-light mt-0.5 ml-10">{doc.remarks}</p>}
                </Td>
                <Td><Pill label={doc.category} tone="blue" /></Td>
                <Td>
                  <button onClick={() => onNavigate(ENTITY_PAGE[doc.entityType])} className="text-primary hover:underline text-sm text-left">
                    {doc.entityType} · {doc.entityLabel}
                  </button>
                </Td>
                <Td>{doc.uploadedBy}</Td>
                <Td>{formatDate(doc.uploadedOn)}</Td>
                <Td>{formatBytes(doc.sizeBytes)}</Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <button onClick={() => downloadDataUrl(doc.dataUrl, doc.fileName)} title="Download" className="text-primary hover:text-primary-dark">
                      <Icon name="download" className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button onClick={() => setToDelete(doc.id)} title="Delete" className="text-red-500 hover:text-red-700">
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteDocument(toDelete)}
        title="Delete Document"
        message="This file will be permanently removed from the record it's attached to."
        tone="danger"
        confirmLabel="Delete"
      />
    </div>
  );
};

export default DocumentLibrary;
