import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { ApprovalDocType, ApprovalStatus, AssetStatus, Disposal, DisposalLine, DisposalMode, DocStatus } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import ApprovalChain from '../components/ui/ApprovalChain';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today } from '../lib/format';
import { computeDepreciation } from '../lib/depreciation';
import { useToast } from '../components/ui/Toast';

const DISPOSABLE = [AssetStatus.AwaitingDisposal, AssetStatus.InStore, AssetStatus.UnderRepair, AssetStatus.Retired];

const Disposals: React.FC = () => {
  const { state, currentUser, me, createDisposal, actOnDisposal, completeDisposal } = useAssetStore();
  const showToast = useToast();
  const { disposals, assets } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Disposal | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const filtered = statusFilter === 'all' ? disposals : disposals.filter(d => d.status === statusFilter);
  const selectedLive = selected ? disposals.find(d => d.id === selected.id) || selected : null;
  const assetOf = (id: string) => assets.find(a => a.id === id);

  return (
    <div>
      <ListToolbar title="Disposal & Sale" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => disposals.some(d => d.status === s)).map(s => ({ value: s, label: s }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New Disposal</PrimaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="trash" title="No disposal records" /> : (
        <TableCard>
          <THead columns={['Disposal No.', 'Mode', 'Assets', 'Book Value', 'Realised', 'Gain/Loss', 'Status', '']} />
          <tbody>
            {filtered.map(d => (
              <Tr key={d.id} onClick={() => setSelected(d)}>
                <Td className="font-mono text-xs">{d.disposalNo}</Td>
                <Td>{d.mode}</Td>
                <Td>{d.lines.length}</Td>
                <Td>{formatCurrency(d.totalBookValue)}</Td>
                <Td>{formatCurrency(d.totalRealisedValue)}</Td>
                <Td className={d.gainLoss < 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(d.gainLoss)}</Td>
                <Td><StatusBadge status={d.status} /></Td>
                <Td><button className="text-primary text-sm font-semibold">View</button></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.disposalNo || ''} subtitle={selectedLive?.mode}>
        {selectedLive && (
          <>
            <StatusBadge status={selectedLive.status} />
            <p className="text-sm text-text-light">{selectedLive.reason}</p>
            <section>
              <h3 className="text-sm font-semibold mb-2">Assets</h3>
              <div className="space-y-1.5">
                {selectedLive.lines.map((l: DisposalLine) => (
                  <div key={l.assetId} className="border border-border rounded-lg px-3 py-2 text-sm flex justify-between">
                    <span className="font-mono text-xs">{assetOf(l.assetId)?.assetTag} · {assetOf(l.assetId)?.name}</span>
                    <span>Book {formatCurrency(l.bookValue)} → Realised {formatCurrency(l.realisedValue)}</span>
                  </div>
                ))}
              </div>
            </section>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-light">Total Book Value</dt><dd className="text-right font-medium">{formatCurrency(selectedLive.totalBookValue)}</dd>
              <dt className="text-text-light">Total Realised</dt><dd className="text-right font-medium">{formatCurrency(selectedLive.totalRealisedValue)}</dd>
              <dt className="text-text-light">Gain / (Loss)</dt><dd className={`text-right font-medium ${selectedLive.gainLoss < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(selectedLive.gainLoss)}</dd>
              {selectedLive.buyerName && <><dt className="text-text-light">Buyer</dt><dd className="text-right font-medium">{selectedLive.buyerName}</dd></>}
              {selectedLive.disposalDate && <><dt className="text-text-light">Disposal Date</dt><dd className="text-right font-medium">{formatDate(selectedLive.disposalDate)}</dd></>}
              {selectedLive.gatePassNo && <><dt className="text-text-light">Gate Pass</dt><dd className="text-right font-medium">{selectedLive.gatePassNo}</dd></>}
            </dl>
            <section>
              <h3 className="text-sm font-semibold mb-2">Approval Chain</h3>
              <ApprovalChain
                approvals={selectedLive.approvals}
                docType={ApprovalDocType.Disposal}
                amount={selectedLive.totalRealisedValue}
                initiatorId={selectedLive.requestedById}
                currentUser={currentUser}
                employees={state.employees}
                delegations={state.delegations}
                onDecide={(decision, remarks) => {
                  actOnDisposal(selectedLive.id, decision, remarks);
                  showToast(`Disposal ${decision.toLowerCase()}.`, decision === ApprovalStatus.Rejected ? 'error' : 'success');
                }}
              />
            </section>
            {selectedLive.status === DocStatus.Approved && (
              <PrimaryButton icon={<Icon name="check" className="w-4 h-4" />} onClick={() => setCompleteOpen(true)}>Complete Disposal</PrimaryButton>
            )}
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New Disposal" wide>
        <NewDisposalForm
          assets={assets.filter(a => DISPOSABLE.includes(a.status))}
          requesterId={me?.id || currentUser.id}
          onSubmit={draft => { createDisposal(draft); showToast('Disposal request submitted.'); setNewOpen(false); }}
        />
      </Modal>

      {selectedLive && (
        <Modal isOpen={completeOpen} onClose={() => setCompleteOpen(false)} title="Complete Disposal">
          <CompleteDisposalForm onSubmit={(date, invoiceNo) => { completeDisposal(selectedLive.id, date, invoiceNo); showToast('Disposal completed.'); setCompleteOpen(false); }} />
        </Modal>
      )}
    </div>
  );
};

const NewDisposalForm: React.FC<{
  assets: { id: string; assetTag: string; name: string; purchaseCost: number }[];
  requesterId: string;
  onSubmit: (draft: Omit<Disposal, 'id' | 'disposalNo' | 'status' | 'approvals'>) => void;
}> = ({ assets, requesterId, onSubmit }) => {
  const { state } = useAssetStore();
  const [mode, setMode] = useState<DisposalMode>(DisposalMode.Sale);
  const [reason, setReason] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [lineState, setLineState] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (id: string) => setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const bookValueOf = (id: string) => {
    const asset = state.assets.find(a => a.id === id);
    return asset ? computeDepreciation(asset).netBookValue : 0;
  };
  const totalBookValue = selectedIds.reduce((t, id) => t + bookValueOf(id), 0);
  const totalRealisedValue = selectedIds.reduce((t, id) => t + (lineState[id] || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Disposal Mode"><Select value={mode} onChange={e => setMode(e.target.value as DisposalMode)}>{Object.values(DisposalMode).map(m => <option key={m} value={m}>{m}</option>)}</Select></Field>
        {mode === DisposalMode.Sale && (
          <>
            <Field label="Buyer Name"><Input value={buyerName} onChange={e => setBuyerName(e.target.value)} /></Field>
            <Field label="Buyer Contact"><Input value={buyerContact} onChange={e => setBuyerContact(e.target.value)} /></Field>
          </>
        )}
      </div>
      <Field label="Reason" required><TextArea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <Field label={`Select Assets (${selectedIds.length} selected)`} required>
        <div className="border border-border rounded-lg max-h-64 overflow-y-auto divide-y divide-border">
          {assets.map(a => (
            <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggle(a.id)} className="rounded border-border text-primary" />
              <span className="font-mono text-xs text-text-light">{a.assetTag}</span>
              <span className="flex-1">{a.name}</span>
              <span className="text-xs text-text-light">Book: {formatCurrency(bookValueOf(a.id))}</span>
              {selectedIds.includes(a.id) && (
                <input
                  type="number" placeholder="Realised value" value={lineState[a.id] || 0}
                  onChange={e => setLineState(prev => ({ ...prev, [a.id]: Number(e.target.value) }))}
                  className="w-28 px-2 py-1 border border-border rounded text-xs"
                />
              )}
            </div>
          ))}
        </div>
      </Field>
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <p className="text-sm font-semibold">Book {formatCurrency(totalBookValue)} → Realised {formatCurrency(totalRealisedValue)}</p>
        <PrimaryButton
          disabled={selectedIds.length === 0 || !reason}
          onClick={() => onSubmit({
            mode, reason, requestedById: requesterId, requestedOn: today(), buyerName: buyerName || undefined, buyerContact: buyerContact || undefined,
            lines: selectedIds.map(id => ({ assetId: id, bookValue: bookValueOf(id), realisedValue: lineState[id] || 0 })),
            totalBookValue, totalRealisedValue, gainLoss: totalRealisedValue - totalBookValue,
          })}
        >
          Submit Disposal
        </PrimaryButton>
      </div>
    </div>
  );
};

const CompleteDisposalForm: React.FC<{ onSubmit: (date: string, invoiceNo?: string) => void }> = ({ onSubmit }) => {
  const [date, setDate] = useState(today());
  const [invoiceNo, setInvoiceNo] = useState('');
  return (
    <div className="space-y-4">
      <Field label="Disposal Date" required><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Invoice / Receipt No."><Input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} /></Field>
      <div className="flex justify-end"><PrimaryButton onClick={() => onSubmit(date, invoiceNo || undefined)}>Complete Disposal</PrimaryButton></div>
    </div>
  );
};

export default Disposals;
