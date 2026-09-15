import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { AmcContract, AmcType, ApprovalDocType, ApprovalStatus, DocStatus, PaymentFrequency } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { Pill, StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import ApprovalChain from '../components/ui/ApprovalChain';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, daysFromToday, today } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const Amc: React.FC = () => {
  const { state, currentUser, me, createAmcContract, actOnAmc, logAmcVisit, renewAmcContract } = useAssetStore();
  const showToast = useToast();
  const { amcContracts, assets, vendors } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<AmcContract | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  const filtered = statusFilter === 'all' ? amcContracts : amcContracts.filter(c => c.status === statusFilter);
  const selectedLive = selected ? amcContracts.find(c => c.id === selected.id) || selected : null;
  const vendorName = (id: string) => vendors.find(v => v.id === id)?.name || '—';

  return (
    <div>
      <ListToolbar title="AMC Contracts" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => amcContracts.some(c => c.status === s)).map(s => ({ value: s, label: s }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New AMC Contract</PrimaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="shield" title="No AMC contracts" /> : (
        <TableCard>
          <THead columns={['Contract No.', 'Vendor', 'Type', 'Assets', 'Value', 'Ends', 'Status', '']} />
          <tbody>
            {filtered.map(c => {
              const days = daysFromToday(c.endDate);
              const expiring = c.status === DocStatus.Active && days !== null && days <= c.renewalReminderDays;
              return (
                <Tr key={c.id} onClick={() => setSelected(c)}>
                  <Td className="font-mono text-xs">{c.contractNo}</Td>
                  <Td>{vendorName(c.vendorId)}</Td>
                  <Td>{c.type}</Td>
                  <Td>{c.assetIds.length}</Td>
                  <Td className="font-medium">{formatCurrency(c.contractValue)}</Td>
                  <Td>{formatDate(c.endDate)} {expiring && <Pill label={days! < 0 ? 'Expired' : 'Expiring'} tone="red" className="ml-1" />}</Td>
                  <Td><StatusBadge status={c.status} /></Td>
                  <Td><button className="text-primary text-sm font-semibold">View</button></Td>
                </Tr>
              );
            })}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.contractNo || ''} subtitle={selectedLive ? `${vendorName(selectedLive.vendorId)} · ${selectedLive.type}` : ''}>
        {selectedLive && (
          <>
            <StatusBadge status={selectedLive.status} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-light">Coverage Period</dt><dd className="text-right font-medium">{formatDate(selectedLive.startDate)} – {formatDate(selectedLive.endDate)}</dd>
              <dt className="text-text-light">Contract Value</dt><dd className="text-right font-medium">{formatCurrency(selectedLive.contractValue)}</dd>
              <dt className="text-text-light">Payment Frequency</dt><dd className="text-right font-medium">{selectedLive.paymentFrequency}</dd>
              <dt className="text-text-light">SLA Response</dt><dd className="text-right font-medium">{selectedLive.slaResponseHours} hrs</dd>
              <dt className="text-text-light">Preventive Visits/Year</dt><dd className="text-right font-medium">{selectedLive.preventiveVisitsPerYear}</dd>
            </dl>
            <p className="text-sm text-text-light">{selectedLive.coverageNotes}</p>
            <section>
              <h3 className="text-sm font-semibold mb-2">Covered Assets ({selectedLive.assetIds.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {selectedLive.assetIds.map(id => {
                  const a = assets.find(x => x.id === id);
                  return a ? <span key={id} className="text-xs font-mono bg-slate-100 rounded px-2 py-1">{a.assetTag}</span> : null;
                })}
              </div>
            </section>
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Service Visits</h3>
                {selectedLive.status === DocStatus.Active && <SecondaryButton onClick={() => setVisitOpen(true)} icon={<Icon name="plus" className="w-4 h-4" />}>Log Visit</SecondaryButton>}
              </div>
              {selectedLive.visits.length === 0 ? <p className="text-sm text-text-light">No visits logged yet.</p> : (
                <div className="space-y-1.5">
                  {selectedLive.visits.map(v => (
                    <div key={v.id} className="border border-border rounded-lg px-3 py-2 text-sm flex justify-between">
                      <div><p className="font-medium">{v.type} visit</p><p className="text-xs text-text-light">{v.technician}{v.remarks ? ` · ${v.remarks}` : ''}</p></div>
                      <div className="text-right text-xs text-text-light shrink-0 ml-2">
                        <p>Sched: {formatDate(v.scheduledOn)}</p>
                        {v.completedOn ? <p className="text-emerald-600">Done: {formatDate(v.completedOn)}</p> : <p className="text-amber-600">Pending</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h3 className="text-sm font-semibold mb-2">Approval Chain</h3>
              <ApprovalChain
                approvals={selectedLive.approvals}
                docType={ApprovalDocType.AmcContract}
                amount={selectedLive.contractValue}
                initiatorId={selectedLive.ownerId}
                currentUser={currentUser}
                employees={state.employees}
                delegations={state.delegations}
                onDecide={(decision, remarks) => {
                  actOnAmc(selectedLive.id, decision, remarks);
                  showToast(`AMC contract ${decision.toLowerCase()}.`, decision === ApprovalStatus.Rejected ? 'error' : 'success');
                }}
              />
            </section>
            {selectedLive.status === DocStatus.Active && !amcContracts.some(c => c.renewedFromId === selectedLive.id) && (
              <SecondaryButton icon={<Icon name="history" className="w-4 h-4" />} onClick={() => setRenewOpen(true)}>Draft Renewal</SecondaryButton>
            )}
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New AMC Contract" wide>
        <NewAmcForm
          vendors={vendors}
          assets={assets}
          ownerId={me?.id || currentUser.id}
          onSubmit={draft => { createAmcContract(draft); showToast('AMC contract drafted.'); setNewOpen(false); }}
        />
      </Modal>

      {selectedLive && (
        <Modal isOpen={visitOpen} onClose={() => setVisitOpen(false)} title="Log Service Visit">
          <VisitForm onSubmit={visit => { logAmcVisit(selectedLive.id, visit); showToast('Visit logged.'); setVisitOpen(false); }} />
        </Modal>
      )}

      {selectedLive && (
        <Modal isOpen={renewOpen} onClose={() => setRenewOpen(false)} title="Draft AMC Renewal">
          <RenewForm
            contract={selectedLive}
            onSubmit={updates => { renewAmcContract(selectedLive.id, updates); showToast('Renewal drafted for approval.'); setRenewOpen(false); }}
          />
        </Modal>
      )}
    </div>
  );
};

const NewAmcForm: React.FC<{
  vendors: { id: string; name: string }[];
  assets: { id: string; assetTag: string; name: string }[];
  ownerId: string;
  onSubmit: (draft: Omit<AmcContract, 'id' | 'contractNo' | 'status' | 'approvals' | 'createdOn'>) => void;
}> = ({ vendors, assets, ownerId, onSubmit }) => {
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [type, setType] = useState<AmcType>(AmcType.Comprehensive);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [contractValue, setContractValue] = useState(0);
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(PaymentFrequency.Annual);
  const [slaResponseHours, setSlaResponseHours] = useState(24);
  const [preventiveVisitsPerYear, setPreventiveVisitsPerYear] = useState(2);
  const [coverageNotes, setCoverageNotes] = useState('');

  const toggleAsset = (id: string) => setAssetIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Vendor" required><Select value={vendorId} onChange={e => setVendorId(e.target.value)}>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        <Field label="Type"><Select value={type} onChange={e => setType(e.target.value as AmcType)}>{Object.values(AmcType).map(t => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Start Date" required><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
        <Field label="End Date" required><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
        <Field label="Contract Value (₹)"><Input type="number" min={0} value={contractValue} onChange={e => setContractValue(Number(e.target.value))} /></Field>
        <Field label="Payment Frequency"><Select value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value as PaymentFrequency)}>{Object.values(PaymentFrequency).map(f => <option key={f} value={f}>{f}</option>)}</Select></Field>
        <Field label="SLA Response (hours)"><Input type="number" min={1} value={slaResponseHours} onChange={e => setSlaResponseHours(Number(e.target.value))} /></Field>
        <Field label="Preventive Visits/Year"><Input type="number" min={0} value={preventiveVisitsPerYear} onChange={e => setPreventiveVisitsPerYear(Number(e.target.value))} /></Field>
      </div>
      <Field label="Coverage Notes"><TextArea rows={2} value={coverageNotes} onChange={e => setCoverageNotes(e.target.value)} /></Field>
      <Field label={`Covered Assets (${assetIds.length} selected)`} required>
        <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
          {assets.map(a => (
            <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={assetIds.includes(a.id)} onChange={() => toggleAsset(a.id)} className="rounded border-border text-primary" />
              <span className="font-mono text-xs text-text-light">{a.assetTag}</span><span>{a.name}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="flex justify-end">
        <PrimaryButton
          disabled={!vendorId || !endDate || assetIds.length === 0}
          onClick={() => onSubmit({ vendorId, type, assetIds, startDate, endDate, contractValue, paymentFrequency, slaResponseHours, preventiveVisitsPerYear, visits: [], coverageNotes, ownerId, renewalReminderDays: 30 })}
        >
          Submit AMC Contract
        </PrimaryButton>
      </div>
    </div>
  );
};

const VisitForm: React.FC<{ onSubmit: (v: { scheduledOn: string; completedOn?: string; type: 'Preventive' | 'Breakdown'; technician?: string; remarks?: string }) => void }> = ({ onSubmit }) => {
  const [scheduledOn, setScheduledOn] = useState(today());
  const [type, setType] = useState<'Preventive' | 'Breakdown'>('Preventive');
  const [technician, setTechnician] = useState('');
  const [remarks, setRemarks] = useState('');
  const [completed, setCompleted] = useState(true);
  return (
    <div className="space-y-4">
      <Field label="Visit Date" required><Input type="date" value={scheduledOn} onChange={e => setScheduledOn(e.target.value)} /></Field>
      <Field label="Type"><Select value={type} onChange={e => setType(e.target.value as any)}><option value="Preventive">Preventive</option><option value="Breakdown">Breakdown</option></Select></Field>
      <Field label="Technician"><Input value={technician} onChange={e => setTechnician(e.target.value)} /></Field>
      <Field label="Remarks"><TextArea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></Field>
      <div className="flex justify-end">
        <PrimaryButton onClick={() => onSubmit({ scheduledOn, completedOn: completed ? scheduledOn : undefined, type, technician: technician || undefined, remarks: remarks || undefined })}>Log Visit</PrimaryButton>
      </div>
    </div>
  );
};

const RenewForm: React.FC<{ contract: AmcContract; onSubmit: (u: { startDate: string; endDate: string; contractValue: number }) => void }> = ({ contract, onSubmit }) => {
  const [startDate, setStartDate] = useState(contract.endDate);
  const [endDate, setEndDate] = useState('');
  const [contractValue, setContractValue] = useState(contract.contractValue);
  return (
    <div className="space-y-4">
      <Field label="New Start Date"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
      <Field label="New End Date" required><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
      <Field label="Renewed Value (₹)"><Input type="number" value={contractValue} onChange={e => setContractValue(Number(e.target.value))} /></Field>
      <div className="flex justify-end"><PrimaryButton disabled={!endDate} onClick={() => onSubmit({ startDate, endDate, contractValue })}>Draft Renewal</PrimaryButton></div>
    </div>
  );
};

export default Amc;
