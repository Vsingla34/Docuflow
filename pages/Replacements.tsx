import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { ApprovalDocType, ApprovalStatus, AssetStatus, DocStatus, DocumentEntityType, Replacement, ReplacementReason } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, PrimaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import ApprovalChain from '../components/ui/ApprovalChain';
import DocumentsPanel from '../components/ui/DocumentsPanel';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const Replacements: React.FC = () => {
  const { state, currentUser, me, createReplacement, actOnReplacement, completeReplacement } = useAssetStore();
  const showToast = useToast();
  const { replacements, assets, categories } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Replacement | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const filtered = statusFilter === 'all' ? replacements : replacements.filter(r => r.status === statusFilter);
  const selectedLive = selected ? replacements.find(r => r.id === selected.id) || selected : null;
  const assetOf = (id: string) => assets.find(a => a.id === id);

  return (
    <div>
      <ListToolbar title="Asset Replacements" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => replacements.some(r => r.status === s)).map(s => ({ value: s, label: s }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New Replacement</PrimaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="swap" title="No replacement requests" /> : (
        <TableCard>
          <THead columns={['Replacement No.', 'Old Asset', 'Reason', 'Est. Cost', 'New Asset', 'Status', '']} />
          <tbody>
            {filtered.map(r => (
              <Tr key={r.id} onClick={() => setSelected(r)}>
                <Td className="font-mono text-xs">{r.replacementNo}</Td>
                <Td className="font-mono text-xs">{assetOf(r.oldAssetId)?.assetTag}</Td>
                <Td>{r.reason}</Td>
                <Td>{formatCurrency(r.estimatedCost)}</Td>
                <Td className="font-mono text-xs">{r.newAssetId ? assetOf(r.newAssetId)?.assetTag : `— (${r.newAssetSource})`}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td><button className="text-primary text-sm font-semibold">View</button></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.replacementNo || ''} subtitle={selectedLive ? assetOf(selectedLive.oldAssetId)?.name : ''}>
        {selectedLive && (
          <>
            <StatusBadge status={selectedLive.status} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-light">Old Asset</dt><dd className="text-right font-medium">{assetOf(selectedLive.oldAssetId)?.assetTag}</dd>
              <dt className="text-text-light">Reason</dt><dd className="text-right font-medium">{selectedLive.reason}</dd>
              <dt className="text-text-light">New Asset Source</dt><dd className="text-right font-medium">{selectedLive.newAssetSource}</dd>
              <dt className="text-text-light">Old Asset Disposition</dt><dd className="text-right font-medium">{selectedLive.oldAssetDisposition}</dd>
              <dt className="text-text-light">Estimated Cost</dt><dd className="text-right font-medium">{formatCurrency(selectedLive.estimatedCost)}</dd>
              {selectedLive.ticketNo && <><dt className="text-text-light">Source Ticket</dt><dd className="text-right font-medium">{selectedLive.ticketNo}</dd></>}
              {selectedLive.newAssetId && <><dt className="text-text-light">New Asset</dt><dd className="text-right font-medium">{assetOf(selectedLive.newAssetId)?.assetTag}</dd></>}
            </dl>
            {selectedLive.remarks && <p className="text-sm text-text-light italic">{selectedLive.remarks}</p>}
            <section>
              <h3 className="text-sm font-semibold mb-2">Approval Chain</h3>
              <ApprovalChain
                approvals={selectedLive.approvals}
                docType={ApprovalDocType.Replacement}
                amount={selectedLive.estimatedCost}
                initiatorId={selectedLive.requestedById}
                currentUser={currentUser}
                employees={state.employees}
                delegations={state.delegations}
                onDecide={(decision, remarks) => {
                  actOnReplacement(selectedLive.id, decision, remarks);
                  showToast(`Replacement ${decision.toLowerCase()}.`, decision === ApprovalStatus.Rejected ? 'error' : 'success');
                }}
              />
            </section>
            {selectedLive.status === DocStatus.Approved && (
              <PrimaryButton icon={<Icon name="check" className="w-4 h-4" />} onClick={() => setCompleteOpen(true)}>Complete Replacement</PrimaryButton>
            )}
            <section>
              <h3 className="text-sm font-semibold mb-2">Documents</h3>
              <DocumentsPanel
                entityType={DocumentEntityType.Replacement}
                entityId={selectedLive.id}
                entityLabel={selectedLive.replacementNo}
                canEdit
              />
            </section>
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New Replacement Request" wide>
        <NewReplacementForm
          assets={assets.filter(a => a.status !== AssetStatus.Sold && a.status !== AssetStatus.Scrapped && a.status !== AssetStatus.WrittenOff)}
          requesterId={me?.id || currentUser.id}
          onSubmit={draft => { createReplacement(draft); showToast('Replacement request submitted.'); setNewOpen(false); }}
        />
      </Modal>

      {selectedLive && (
        <Modal isOpen={completeOpen} onClose={() => setCompleteOpen(false)} title="Complete Replacement">
          <CompleteForm
            candidates={assets.filter(a => a.status === AssetStatus.InStore && a.categoryId === assetOf(selectedLive.oldAssetId)?.categoryId)}
            source={selectedLive.newAssetSource}
            onSubmit={newAssetId => { completeReplacement(selectedLive.id, newAssetId); showToast('Replacement completed.'); setCompleteOpen(false); }}
          />
        </Modal>
      )}
    </div>
  );
};

const NewReplacementForm: React.FC<{
  assets: { id: string; assetTag: string; name: string; categoryId: string }[];
  requesterId: string;
  onSubmit: (draft: Omit<Replacement, 'id' | 'replacementNo' | 'status' | 'approvals'>) => void;
}> = ({ assets, requesterId, onSubmit }) => {
  const [oldAssetId, setOldAssetId] = useState(assets[0]?.id || '');
  const [reason, setReason] = useState<ReplacementReason>(ReplacementReason.BeyondRepair);
  const [newAssetSource, setNewAssetSource] = useState<Replacement['newAssetSource']>('From Store');
  const [oldAssetDisposition, setOldAssetDisposition] = useState<Replacement['oldAssetDisposition']>('Scrap');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [remarks, setRemarks] = useState('');

  return (
    <div className="space-y-4">
      <Field label="Asset to Replace" required><Select value={oldAssetId} onChange={e => setOldAssetId(e.target.value)}>{assets.map(a => <option key={a.id} value={a.id}>{a.assetTag} · {a.name}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Reason"><Select value={reason} onChange={e => setReason(e.target.value as ReplacementReason)}>{Object.values(ReplacementReason).map(r => <option key={r} value={r}>{r}</option>)}</Select></Field>
        <Field label="New Asset Source"><Select value={newAssetSource} onChange={e => setNewAssetSource(e.target.value as any)}><option>From Store</option><option>New Purchase</option><option>Vendor Buyback</option><option>Vendor Warranty</option></Select></Field>
        <Field label="Old Asset Disposition"><Select value={oldAssetDisposition} onChange={e => setOldAssetDisposition(e.target.value as any)}><option>Return to Store</option><option>Scrap</option><option>Sell</option><option>Return to Vendor</option><option>Write-Off (Lost/Stolen)</option></Select></Field>
        <Field label="Estimated Cost (₹)"><Input type="number" min={0} value={estimatedCost} onChange={e => setEstimatedCost(Number(e.target.value))} /></Field>
      </div>
      <Field label="Remarks"><TextArea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></Field>
      <div className="flex justify-end">
        <PrimaryButton disabled={!oldAssetId} onClick={() => onSubmit({ oldAssetId, reason, newAssetSource, requestedById: requesterId, requestedOn: today(), oldAssetDisposition, estimatedCost, remarks: remarks || undefined })}>
          Submit Request
        </PrimaryButton>
      </div>
    </div>
  );
};

const CompleteForm: React.FC<{ candidates: { id: string; assetTag: string; name: string }[]; source: string; onSubmit: (newAssetId: string | undefined) => void }> = ({ candidates, source, onSubmit }) => {
  const [newAssetId, setNewAssetId] = useState(candidates[0]?.id || '');
  return (
    <div className="space-y-4">
      {source === 'From Store' ? (
        candidates.length === 0 ? (
          <p className="text-sm text-text-light">No matching spare assets in store. You can still complete this and link the new asset later once purchased.</p>
        ) : (
          <Field label="Pick Replacement Asset from Store"><Select value={newAssetId} onChange={e => setNewAssetId(e.target.value)}>{candidates.map(a => <option key={a.id} value={a.id}>{a.assetTag} · {a.name}</option>)}</Select></Field>
        )
      ) : (
        <p className="text-sm text-text-light">Source is "{source}" — record the new asset via GRN/purchase, then link it here once available.</p>
      )}
      <div className="flex justify-end">
        <PrimaryButton onClick={() => onSubmit(source === 'From Store' && newAssetId ? newAssetId : undefined)}>Complete Replacement</PrimaryButton>
      </div>
    </div>
  );
};

export default Replacements;
