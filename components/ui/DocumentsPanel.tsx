import React, { useRef, useState } from 'react';
import { DocumentCategory, DocumentEntityType } from '../../types';
import { useAssetStore } from '../../store/AssetStore';
import { useToast } from './Toast';
import { Field, Select, TextArea, SecondaryButton } from './FormControls';
import { Pill } from './Badge';
import Icon from '../icons/Icon';
import { ACCEPTED_FILE_TYPES, MAX_FILE_BYTES, downloadDataUrl, formatBytes, iconForFile, isImageFile, readFileAsDataUrl } from '../../lib/files';
import { formatDate } from '../../lib/format';

/** Attach-and-list panel for files linked to any entity (asset, PO, GRN, AMC contract, ticket, ...). */
export const DocumentsPanel: React.FC<{
  entityType: DocumentEntityType;
  entityId: string;
  entityLabel: string;
  canEdit: boolean;
}> = ({ entityType, entityId, entityLabel, canEdit }) => {
  const { state, uploadDocument, deleteDocument } = useAssetStore();
  const showToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<DocumentCategory>(DocumentCategory.Other);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const docs = state.documents.filter(d => d.entityType === entityType && d.entityId === entityId);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      showToast(`"${file.name}" is ${formatBytes(file.size)} — max ${formatBytes(MAX_FILE_BYTES)} per file.`, 'error');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      uploadDocument({ entityType, entityId, entityLabel, category, fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, dataUrl, remarks: remarks || undefined });
      showToast('File attached.');
      setRemarks('');
    } catch {
      showToast('Could not read that file.', 'error');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {docs.length === 0 ? (
        <p className="text-sm text-text-light">No files attached yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2">
              {isImageFile(doc.mimeType) ? (
                <img src={doc.dataUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0 border border-border" />
              ) : (
                <span className="text-2xl shrink-0" aria-hidden>{iconForFile(doc.mimeType, doc.fileName)}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-text-main truncate">{doc.fileName}</p>
                  <Pill label={doc.category} tone="blue" />
                </div>
                <p className="text-xs text-text-light">{formatBytes(doc.sizeBytes)} · {doc.uploadedBy} · {formatDate(doc.uploadedOn)}</p>
                {doc.remarks && <p className="text-xs text-text-light italic mt-0.5">{doc.remarks}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => downloadDataUrl(doc.dataUrl, doc.fileName)} title="Download" className="text-primary hover:text-primary-dark">
                  <Icon name="download" className="w-4 h-4" />
                </button>
                {canEdit && (
                  <button onClick={() => deleteDocument(doc.id)} title="Delete" className="text-red-500 hover:text-red-700">
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category">
              <Select value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
                {Object.values(DocumentCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Remarks (optional)"><TextArea rows={1} value={remarks} onChange={e => setRemarks(e.target.value)} /></Field>
          </div>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          <SecondaryButton icon={<Icon name="plus" className="w-4 h-4" />} disabled={busy} onClick={() => fileInputRef.current?.click()}>
            {busy ? 'Uploading…' : 'Attach File'}
          </SecondaryButton>
          <p className="text-xs text-text-light">PDF, image, Word or Excel — up to {formatBytes(MAX_FILE_BYTES)}.</p>
        </div>
      )}
    </div>
  );
};

export default DocumentsPanel;
