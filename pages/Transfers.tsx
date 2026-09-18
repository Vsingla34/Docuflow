import React, { useMemo, useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { ApprovalDocType, ApprovalStatus, AssetStatus, DocStatus, DocumentEntityType, LIVE_ASSET_STATUSES, Transfer, TransferType, UserRole } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, Checkbox, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import ApprovalChain from '../components/ui/ApprovalChain';
import DocumentsPanel from '../components/ui/DocumentsPanel';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today } from '../lib/format';
import { useToast } from '../components/ui/Toast';
import { PageKey } from '../components/layout/nav';

const Transfers: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser, me, createTransfer, actOnTransfer, dispatchTransfer, receiveTransfer } = useAssetStore();
  const showToast = useToast();
  const { transfers, assets, locations, departments, employees } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const visible = currentUser.role === UserRole.EMPLOYEE && me ? transfers.filter(t => t.requestedById === me.id || t.toCustodianId === me.id || t.fromCustodianId === me.id) : transfers;
  const filtered = statusFilter === 'all' ? visible : visible.filter(t => t.status === statusFilter);
  const selectedLive = selected ? transfers.find(t => t.id === selected.id) || selected : null;

  const empName = (id?: string) => (id ? employees.find(e => e.id === id)?.name || '—' : '—');
  const locName = (id: string) => locations.find(l => l.id === id)?.name || '—';

  return (
    <div>
      <ListToolbar title="Asset Transfers" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => transfers.some(t => t.status === s)).map(s => ({ value: s, label: s }))]} />
        {currentUser.role !== UserRole.AUDITOR && (
          <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New Transfer</PrimaryButton>
        )}
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="swap" title="No transfers" /> : (
        <TableCard>
          <THead columns={['Transfer No.', 'Type', 'From → To', 'Assets', 'Value', 'Status', '']} />
          <tbody>
            {filtered.map(t => (
              <Tr key={t.id} onClick={() => setSelected(t)}>
                <Td className="font-mono text-xs">{t.transferNo}</Td>
                <Td>{t.type}</Td>
                <Td>{locName(t.fromLocationId)} → {locName(t.toLocationId)}</Td>
                <Td>{t.assetIds.length}</Td>
                <Td className="font-medium">{formatCurrency(t.value)}</Td>
                <Td><StatusBadge status={t.status} /></Td>
                <Td><button className="text-primary text-sm font-semibold">View</button></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.transferNo || ''} subtitle={selectedLive?.type}>
        {selectedLive && (
          <>
            <StatusBadge status={selectedLive.status} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-light">From</dt><dd className="text-right font-medium">{locName(selectedLive.fromLocationId)} / {departments.find(d => d.id === selectedLive.fromDepartmentId)?.name}</dd>
              <dt className="text-text-light">To</dt><dd className="text-right font-medium">{locName(selectedLive.toLocationId)} / {departments.find(d => d.id === selectedLive.toDepartmentId)?.name}</dd>
              <dt className="text-text-light">New Custodian</dt><dd className="text-right font-medium">{empName(selectedLive.toCustodianId)}</dd>
              <dt className="text-text-light">Requested By</dt><dd className="text-right font-medium">{empName(selectedLive.requestedById)}</dd>
            </dl>
            <p className="text-sm text-text-light">{selectedLive.reason}</p>
            <section>
              <h3 className="text-sm font-semibold mb-2">Assets</h3>
              <div className="flex flex-wrap gap-1.5">
                {selectedLive.assetIds.map(id => {
                  const a = assets.find(x => x.id === id);
                  return a ? <span key={id} className="text-xs font-mono bg-slate-100 rounded px-2 py-1">{a.assetTag}</span> : null;
                })}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold mb-2">Approval Chain</h3>
              <ApprovalChain
                approvals={selectedLive.approvals}
                docType={ApprovalDocType.Transfer}
                amount={selectedLive.value}
                initiatorId={selectedLive.requestedById}
                currentUser={currentUser}
                employees={employees}
                delegations={state.delegations}
                onDecide={(decision, remarks) => {
                  actOnTransfer(selectedLive.id, decision, remarks);
                  showToast(`Transfer ${decision.toLowerCase()}.`, decision === ApprovalStatus.Rejected ? 'error' : 'success');
                }}
              />
            </section>
            {selectedLive.status === DocStatus.Approved && currentUser.role !== UserRole.AUDITOR && (
              <PrimaryButton icon={<Icon name="truck" className="w-4 h-4" />} onClick={() => { dispatchTransfer(selectedLive.id); showToast('Marked as dispatched.'); }}>Mark Dispatched</PrimaryButton>
            )}
            {selectedLive.status === DocStatus.InTransit && currentUser.role !== UserRole.AUDITOR && (
              <PrimaryButton icon={<Icon name="check" className="w-4 h-4" />} onClick={() => { receiveTransfer(selectedLive.id, 'Received in good condition.'); showToast('Transfer completed.'); }}>
                Acknowledge Receipt
              </PrimaryButton>
            )}
            {selectedLive.status === DocStatus.Completed && selectedLive.acknowledgementRemarks && (
              <p className="text-xs text-text-light">Acknowledgement: "{selectedLive.acknowledgementRemarks}"</p>
            )}
            <section>
              <h3 className="text-sm font-semibold mb-2">Documents</h3>
              <DocumentsPanel
                entityType={DocumentEntityType.Transfer}
                entityId={selectedLive.id}
                entityLabel={selectedLive.transferNo}
                canEdit={currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGEMENT}
              />
            </section>
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New Asset Transfer" wide>
        <NewTransferForm
          assets={assets}
          locations={locations}
          departments={departments}
          employees={employees}
          requesterId={me?.id || currentUser.id}
          onSubmit={draft => {
            createTransfer(draft);
            showToast('Transfer request submitted.');
            setNewOpen(false);
          }}
        />
      </Modal>
    </div>
  );
};

const NewTransferForm: React.FC<{
  assets: { id: string; assetTag: string; name: string; status: AssetStatus; locationId: string; departmentId: string; purchaseCost: number }[];
  locations: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  requesterId: string;
  onSubmit: (draft: Omit<Transfer, 'id' | 'transferNo' | 'status' | 'approvals' | 'createdOn'>) => void;
}> = ({ assets, locations, departments, employees, requesterId, onSubmit }) => {
  const movable = useMemo(() => assets.filter(a => [AssetStatus.InStore, AssetStatus.InUse].includes(a.status)), [assets]);
  const [type, setType] = useState<TransferType>(TransferType.Custodian);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [fromLocationId, setFromLocationId] = useState(locations[0]?.id || '');
  const [toLocationId, setToLocationId] = useState(locations[0]?.id || '');
  const [fromDepartmentId, setFromDepartmentId] = useState(departments[0]?.id || '');
  const [toDepartmentId, setToDepartmentId] = useState(departments[0]?.id || '');
  const [toCustodianId, setToCustodianId] = useState('');
  const [reason, setReason] = useState('');
  const [requiresGatePass, setRequiresGatePass] = useState(false);

  const toggleAsset = (id: string) => setAssetIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const value = assets.filter(a => assetIds.includes(a.id)).reduce((t, a) => t + a.purchaseCost, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Transfer Type"><Select value={type} onChange={e => setType(e.target.value as TransferType)}>{Object.values(TransferType).map(t => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="New Custodian" hint="Leave blank to move to store/pool."><Select value={toCustodianId} onChange={e => setToCustodianId(e.target.value)}><option value="">— None (to store) —</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        <Field label="From Location"><Select value={fromLocationId} onChange={e => setFromLocationId(e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="To Location"><Select value={toLocationId} onChange={e => setToLocationId(e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="From Department"><Select value={fromDepartmentId} onChange={e => setFromDepartmentId(e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="To Department"><Select value={toDepartmentId} onChange={e => setToDepartmentId(e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
      </div>
      <Field label="Reason" required><TextArea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <Checkbox label="Requires a formal gate pass for physical movement" checked={requiresGatePass} onChange={setRequiresGatePass} />

      <Field label={`Select Assets (${assetIds.length} selected)`} required>
        <div className="border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border">
          {movable.map(a => (
            <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={assetIds.includes(a.id)} onChange={() => toggleAsset(a.id)} className="rounded border-border text-primary" />
              <span className="font-mono text-xs text-text-light">{a.assetTag}</span>
              <span>{a.name}</span>
              <span className="ml-auto text-xs text-text-light">{formatCurrency(a.purchaseCost)}</span>
            </label>
          ))}
        </div>
      </Field>

      <div className="flex justify-between items-center pt-2 border-t border-border">
        <p className="text-sm font-semibold">Value: {formatCurrency(value)}</p>
        <PrimaryButton
          disabled={assetIds.length === 0 || !reason}
          onClick={() => onSubmit({ type, assetIds, fromLocationId, toLocationId, fromDepartmentId, toDepartmentId, toCustodianId: toCustodianId || undefined, requestedById: requesterId, reason, requiresGatePass, value })}
        >
          Submit Transfer
        </PrimaryButton>
      </div>
    </div>
  );
};

export default Transfers;
