import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import {
  ApprovalDocType, ApprovalStatus, AssetStatus, DocStatus, PartReplacement, ReplacementReason, ServiceTicket, TicketPriority, TicketType, UserRole,
} from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { Pill, StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, Checkbox, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import ApprovalChain from '../components/ui/ApprovalChain';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today, uid } from '../lib/format';
import { useToast } from '../components/ui/Toast';
import { PageKey } from '../components/layout/nav';

const LIVE_FOR_TICKET = [AssetStatus.InUse, AssetStatus.InStore, AssetStatus.IssuedOut, AssetStatus.UnderRepair];

const ServiceTickets: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser, me, createServiceTicket, actOnServiceTicket, startServiceTicket, closeServiceTicket, createReplacement } = useAssetStore();
  const showToast = useToast();
  const { serviceTickets, assets, vendors, employees, amcContracts } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<ServiceTicket | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const visible = currentUser.role === UserRole.EMPLOYEE && me ? serviceTickets.filter(t => t.reportedById === me.id) : serviceTickets;
  const filtered = statusFilter === 'all' ? visible : visible.filter(t => t.status === statusFilter);
  const selectedLive = selected ? serviceTickets.find(t => t.id === selected.id) || selected : null;
  const assetOf = (id: string) => assets.find(a => a.id === id);

  return (
    <div>
      <ListToolbar title="Repairs & Service Tickets" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => serviceTickets.some(t => t.status === s)).map(s => ({ value: s, label: s }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>Report Fault</PrimaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="wrench" title="No service tickets" /> : (
        <TableCard>
          <THead columns={['Ticket No.', 'Asset', 'Priority', 'Fault', 'Est. Cost', 'AMC', 'Status', '']} />
          <tbody>
            {filtered.map(t => (
              <Tr key={t.id} onClick={() => setSelected(t)}>
                <Td className="font-mono text-xs">{t.ticketNo}</Td>
                <Td className="font-mono text-xs">{assetOf(t.assetId)?.assetTag}</Td>
                <Td><Pill label={t.priority} tone={t.priority === TicketPriority.Critical ? 'red' : t.priority === TicketPriority.High ? 'amber' : 'slate'} /></Td>
                <Td className="max-w-xs truncate">{t.faultDescription}</Td>
                <Td>{formatCurrency(t.actualCost ?? t.estimatedCost)}</Td>
                <Td>{t.underAmc ? <Pill label="Covered" tone="green" /> : <Pill label="Chargeable" tone="gray" />}</Td>
                <Td><StatusBadge status={t.status} /></Td>
                <Td><button className="text-primary text-sm font-semibold">View</button></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.ticketNo || ''} subtitle={selectedLive ? assetOf(selectedLive.assetId)?.name : ''}>
        {selectedLive && (
          <>
            <div className="flex gap-2 flex-wrap"><StatusBadge status={selectedLive.status} /><Pill label={selectedLive.priority} tone={selectedLive.priority === TicketPriority.Critical ? 'red' : 'amber'} />{selectedLive.underAmc && <Pill label="Under AMC" tone="green" />}</div>
            <p className="text-sm text-text-light">{selectedLive.faultDescription}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-light">Reported By</dt><dd className="text-right font-medium">{employees.find(e => e.id === selectedLive.reportedById)?.name}</dd>
              <dt className="text-text-light">Reported On</dt><dd className="text-right font-medium">{formatDate(selectedLive.reportedOn)}</dd>
              {selectedLive.vendorId && <><dt className="text-text-light">Vendor</dt><dd className="text-right font-medium">{vendors.find(v => v.id === selectedLive.vendorId)?.name}</dd></>}
              {selectedLive.assignedTo && <><dt className="text-text-light">Assigned To</dt><dd className="text-right font-medium">{selectedLive.assignedTo}</dd></>}
              <dt className="text-text-light">Estimated Cost</dt><dd className="text-right font-medium">{formatCurrency(selectedLive.estimatedCost)}</dd>
              {selectedLive.actualCost !== undefined && <><dt className="text-text-light">Actual Cost</dt><dd className="text-right font-medium">{formatCurrency(selectedLive.actualCost)}</dd></>}
              {selectedLive.gatePassNo && <><dt className="text-text-light">Gate Pass</dt><dd className="text-right font-medium">{selectedLive.gatePassNo}</dd></>}
            </dl>
            {selectedLive.resolution && (
              <section className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-sm font-semibold text-emerald-800">Resolution</p>
                <p className="text-sm text-emerald-700">{selectedLive.resolution}</p>
              </section>
            )}
            {selectedLive.partsReplaced.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Parts Replaced</h3>
                <div className="space-y-1.5">
                  {selectedLive.partsReplaced.map((p: PartReplacement) => (
                    <div key={p.id} className="text-sm border border-border rounded-lg px-3 py-2 flex justify-between">
                      <span>{p.componentName} {p.oldSerial && `(${p.oldSerial} → ${p.newSerial})`}</span>
                      <span className="font-medium">{formatCurrency(p.cost)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h3 className="text-sm font-semibold mb-2">Approval Chain</h3>
              <ApprovalChain
                approvals={selectedLive.approvals}
                docType={ApprovalDocType.ServiceTicket}
                amount={selectedLive.estimatedCost}
                initiatorId={selectedLive.reportedById}
                currentUser={currentUser}
                employees={employees}
                delegations={state.delegations}
                onDecide={(decision, remarks) => {
                  actOnServiceTicket(selectedLive.id, decision, remarks);
                  showToast(`Ticket ${decision.toLowerCase()}.`, decision === ApprovalStatus.Rejected ? 'error' : 'success');
                }}
              />
            </section>
            <div className="flex flex-wrap gap-3">
              {selectedLive.status === DocStatus.Open && (
                <PrimaryButton icon={<Icon name="wrench" className="w-4 h-4" />} onClick={() => { startServiceTicket(selectedLive.id); showToast('Ticket moved to in-progress.'); }}>Start Work</PrimaryButton>
              )}
              {selectedLive.status === DocStatus.InProgress && (
                <PrimaryButton icon={<Icon name="check" className="w-4 h-4" />} onClick={() => setCloseOpen(true)}>Close Ticket</PrimaryButton>
              )}
              {selectedLive.status === DocStatus.Completed && selectedLive.recommendReplacement && !selectedLive.replacementNo && (
                <SecondaryButton
                  icon={<Icon name="swap" className="w-4 h-4" />}
                  onClick={() => {
                    createReplacement({
                      oldAssetId: selectedLive.assetId, newAssetSource: 'From Store', reason: ReplacementReason.BeyondRepair,
                      requestedById: selectedLive.reportedById, requestedOn: today(), oldAssetDisposition: 'Scrap',
                      estimatedCost: 0, ticketNo: selectedLive.ticketNo,
                    });
                    showToast('Replacement request raised.');
                    onNavigate('replacements');
                  }}
                >
                  Raise Replacement Request
                </SecondaryButton>
              )}
            </div>
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="Report a Fault / Repair Need" wide>
        <NewTicketForm
          assets={assets.filter(a => LIVE_FOR_TICKET.includes(a.status))}
          amcContracts={amcContracts}
          vendors={vendors}
          reporterId={me?.id || currentUser.id}
          onSubmit={draft => { createServiceTicket(draft); showToast('Service ticket raised.'); setNewOpen(false); }}
        />
      </Modal>

      {selectedLive && (
        <Modal isOpen={closeOpen} onClose={() => setCloseOpen(false)} title="Close Service Ticket" wide>
          <CloseTicketForm
            estimatedCost={selectedLive.estimatedCost}
            onSubmit={(resolution, actualCost, parts, recommendReplacement) => {
              closeServiceTicket(selectedLive.id, resolution, actualCost, parts, recommendReplacement);
              showToast('Ticket closed.');
              setCloseOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

const NewTicketForm: React.FC<{
  assets: { id: string; assetTag: string; name: string; amcContractId?: string; locationId: string; categoryId: string }[];
  amcContracts: { id: string; contractNo: string; vendorId: string; assetIds: string[] }[];
  vendors: { id: string; name: string }[];
  reporterId: string;
  onSubmit: (draft: Omit<ServiceTicket, 'id' | 'ticketNo' | 'status' | 'approvals' | 'partsReplaced'>) => void;
}> = ({ assets, amcContracts, vendors, reporterId, onSubmit }) => {
  const [assetId, setAssetId] = useState(assets[0]?.id || '');
  const asset = assets.find(a => a.id === assetId);
  const coveringAmc = asset?.amcContractId ? amcContracts.find(c => c.id === asset.amcContractId) : undefined;
  const [type, setType] = useState<TicketType>(TicketType.Breakdown);
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.Medium);
  const [faultDescription, setFaultDescription] = useState('');
  const [underAmc, setUnderAmc] = useState(!!coveringAmc);
  const [vendorId, setVendorId] = useState(coveringAmc?.vendorId || vendors[0]?.id || '');
  const [estimatedCost, setEstimatedCost] = useState(0);

  React.useEffect(() => { setUnderAmc(!!coveringAmc); setVendorId(coveringAmc?.vendorId || vendors[0]?.id || ''); }, [assetId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Asset" required><Select value={assetId} onChange={e => setAssetId(e.target.value)}>{assets.map(a => <option key={a.id} value={a.id}>{a.assetTag} · {a.name}</option>)}</Select></Field>
        <Field label="Type"><Select value={type} onChange={e => setType(e.target.value as TicketType)}>{Object.values(TicketType).map(t => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Priority"><Select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}>{Object.values(TicketPriority).map(p => <option key={p} value={p}>{p}</option>)}</Select></Field>
        <Field label="Vendor"><Select value={vendorId} onChange={e => setVendorId(e.target.value)}>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        <Field label="Estimated Cost (₹)"><Input type="number" min={0} value={estimatedCost} onChange={e => setEstimatedCost(Number(e.target.value))} /></Field>
      </div>
      <Checkbox label={coveringAmc ? `Covered under AMC (${coveringAmc.contractNo})` : 'Cover under AMC'} checked={underAmc} onChange={setUnderAmc} />
      <Field label="Fault Description" required><TextArea rows={3} value={faultDescription} onChange={e => setFaultDescription(e.target.value)} /></Field>
      <div className="flex justify-end">
        <PrimaryButton
          disabled={!assetId || !faultDescription}
          onClick={() => onSubmit({ assetId, type, priority, reportedById: reporterId, reportedOn: today(), faultDescription, underAmc, amcContractId: underAmc ? coveringAmc?.id : undefined, vendorId, estimatedCost, downtimeStart: today(), recommendReplacement: false })}
        >
          Raise Ticket
        </PrimaryButton>
      </div>
    </div>
  );
};

const CloseTicketForm: React.FC<{ estimatedCost: number; onSubmit: (resolution: string, actualCost: number, parts: PartReplacement[], recommendReplacement: boolean) => void }> = ({ estimatedCost, onSubmit }) => {
  const [resolution, setResolution] = useState('');
  const [actualCost, setActualCost] = useState(estimatedCost);
  const [recommendReplacement, setRecommendReplacement] = useState(false);
  const [parts, setParts] = useState<PartReplacement[]>([]);

  const addPart = () => setParts(prev => [...prev, { id: uid('pr'), componentName: '', cost: 0, warrantyMonths: 0 }]);
  const updatePart = (id: string, patch: Partial<PartReplacement>) => setParts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  const removePart = (id: string) => setParts(prev => prev.filter(p => p.id !== id));

  return (
    <div className="space-y-4">
      <Field label="Resolution" required><TextArea rows={2} value={resolution} onChange={e => setResolution(e.target.value)} /></Field>
      <Field label="Actual Cost (₹)"><Input type="number" min={0} value={actualCost} onChange={e => setActualCost(Number(e.target.value))} /></Field>
      <div>
        <div className="flex justify-between items-center mb-2"><p className="text-sm font-medium">Parts Replaced</p><SecondaryButton onClick={addPart} icon={<Icon name="plus" className="w-4 h-4" />}>Add Part</SecondaryButton></div>
        <div className="space-y-2">
          {parts.map(p => (
            <div key={p.id} className="grid grid-cols-12 gap-2 items-end border border-border rounded-lg p-2">
              <div className="col-span-4"><Input placeholder="Component" value={p.componentName} onChange={e => updatePart(p.id, { componentName: e.target.value })} /></div>
              <div className="col-span-3"><Input placeholder="Old serial" value={p.oldSerial || ''} onChange={e => updatePart(p.id, { oldSerial: e.target.value })} /></div>
              <div className="col-span-3"><Input placeholder="New serial" value={p.newSerial || ''} onChange={e => updatePart(p.id, { newSerial: e.target.value })} /></div>
              <div className="col-span-1"><Input type="number" placeholder="Cost" value={p.cost} onChange={e => updatePart(p.id, { cost: Number(e.target.value) })} /></div>
              <div className="col-span-1 flex justify-center"><button onClick={() => removePart(p.id)} className="text-red-500"><Icon name="trash" className="w-4 h-4" /></button></div>
            </div>
          ))}
        </div>
      </div>
      <Checkbox label="Recommend replacing this asset instead of further repair" checked={recommendReplacement} onChange={setRecommendReplacement} />
      <div className="flex justify-end">
        <PrimaryButton disabled={!resolution} onClick={() => onSubmit(resolution, actualCost, parts.filter(p => p.componentName), recommendReplacement)}>Close Ticket</PrimaryButton>
      </div>
    </div>
  );
};

export default ServiceTickets;
