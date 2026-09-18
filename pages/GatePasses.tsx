import React, { useMemo, useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { ApprovalDocType, ApprovalStatus, AssetStatus, DocStatus, DocumentEntityType, GatePass, GatePassPurpose, GatePassType } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { Pill, StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, PrimaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import ApprovalChain from '../components/ui/ApprovalChain';
import DocumentsPanel from '../components/ui/DocumentsPanel';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, daysFromToday, today } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const OUT_ELIGIBLE = [AssetStatus.InStore, AssetStatus.InUse, AssetStatus.AwaitingDisposal, AssetStatus.UnderRepair];

const GatePasses: React.FC = () => {
  const { state, currentUser, me, createGatePass, actOnGatePass, issueGatePass, returnGatePass } = useAssetStore();
  const showToast = useToast();
  const { gatePasses, assets, locations, employees, vendors } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<GatePass | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const filtered = statusFilter === 'all' ? gatePasses : gatePasses.filter(g => g.status === statusFilter);
  const selectedLive = selected ? gatePasses.find(g => g.id === selected.id) || selected : null;

  return (
    <div>
      <ListToolbar title="Gate Passes" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => gatePasses.some(g => g.status === s)).map(s => ({ value: s, label: s }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New Gate Pass</PrimaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="truck" title="No gate passes" /> : (
        <TableCard>
          <THead columns={['Pass No.', 'Type', 'Purpose', 'Issued To', 'Return Due', 'Status', '']} />
          <tbody>
            {filtered.map(g => {
              const overdue = g.type === GatePassType.Returnable && g.status === DocStatus.Issued && g.expectedReturnDate && (daysFromToday(g.expectedReturnDate) ?? 0) < 0;
              return (
                <Tr key={g.id} onClick={() => setSelected(g)}>
                  <Td className="font-mono text-xs">{g.gatePassNo}</Td>
                  <Td>{g.type}</Td>
                  <Td>{g.purpose}</Td>
                  <Td>{g.issuedToName}</Td>
                  <Td>{g.expectedReturnDate ? formatDate(g.expectedReturnDate) : '—'} {overdue && <Pill label="Overdue" tone="red" className="ml-1" />}</Td>
                  <Td><StatusBadge status={g.status} /></Td>
                  <Td><button className="text-primary text-sm font-semibold">View</button></Td>
                </Tr>
              );
            })}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.gatePassNo || ''} subtitle={selectedLive ? `${selectedLive.type} · ${selectedLive.purpose}` : ''}>
        {selectedLive && (
          <>
            <StatusBadge status={selectedLive.status} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-light">Issued To</dt><dd className="text-right font-medium">{selectedLive.issuedToName}</dd>
              <dt className="text-text-light">Destination</dt><dd className="text-right font-medium">{selectedLive.destination}</dd>
              <dt className="text-text-light">From</dt><dd className="text-right font-medium">{locations.find(l => l.id === selectedLive.fromLocationId)?.name}</dd>
              <dt className="text-text-light">Issue Date</dt><dd className="text-right font-medium">{formatDate(selectedLive.issueDate)}</dd>
              {selectedLive.expectedReturnDate && <><dt className="text-text-light">Expected Return</dt><dd className="text-right font-medium">{formatDate(selectedLive.expectedReturnDate)}</dd></>}
              {selectedLive.actualReturnDate && <><dt className="text-text-light">Actual Return</dt><dd className="text-right font-medium">{formatDate(selectedLive.actualReturnDate)}</dd></>}
              {selectedLive.linkedRefNo && <><dt className="text-text-light">Linked To</dt><dd className="text-right font-medium">{selectedLive.linkedRefNo}</dd></>}
            </dl>
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
                docType={ApprovalDocType.GatePass}
                amount={selectedLive.value}
                initiatorId={selectedLive.issuedById}
                currentUser={currentUser}
                employees={employees}
                delegations={state.delegations}
                onDecide={(decision, remarks) => {
                  actOnGatePass(selectedLive.id, decision, remarks);
                  showToast(`Gate pass ${decision.toLowerCase()}.`, decision === ApprovalStatus.Rejected ? 'error' : 'success');
                }}
              />
            </section>
            {selectedLive.status === DocStatus.Approved && (
              <PrimaryButton icon={<Icon name="truck" className="w-4 h-4" />} onClick={() => { issueGatePass(selectedLive.id); showToast('Gate pass issued; asset marked as moved out.'); }}>Issue Gate Pass</PrimaryButton>
            )}
            {selectedLive.status === DocStatus.Issued && selectedLive.type === GatePassType.Returnable && (
              <PrimaryButton icon={<Icon name="check" className="w-4 h-4" />} onClick={() => { returnGatePass(selectedLive.id, 'Returned in good condition.'); showToast('Gate pass closed; asset returned.'); }}>
                Mark Returned
              </PrimaryButton>
            )}
            <section>
              <h3 className="text-sm font-semibold mb-2">Documents</h3>
              <DocumentsPanel
                entityType={DocumentEntityType.GatePass}
                entityId={selectedLive.id}
                entityLabel={selectedLive.gatePassNo}
                canEdit
              />
            </section>
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New Gate Pass" wide>
        <NewGatePassForm
          assets={assets.filter(a => OUT_ELIGIBLE.includes(a.status))}
          locations={locations}
          employees={employees}
          vendors={vendors}
          issuerId={me?.id || currentUser.id}
          onSubmit={draft => {
            createGatePass(draft);
            showToast('Gate pass requested.');
            setNewOpen(false);
          }}
        />
      </Modal>
    </div>
  );
};

const NewGatePassForm: React.FC<{
  assets: { id: string; assetTag: string; name: string; purchaseCost: number }[];
  locations: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  issuerId: string;
  onSubmit: (draft: Omit<GatePass, 'id' | 'gatePassNo' | 'status' | 'approvals' | 'createdOn'>) => void;
}> = ({ assets, locations, employees, vendors, issuerId, onSubmit }) => {
  const [type, setType] = useState<GatePassType>(GatePassType.Returnable);
  const [purpose, setPurpose] = useState<GatePassPurpose>(GatePassPurpose.Repair);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [issuedToType, setIssuedToType] = useState<'Employee' | 'Vendor' | 'External'>('Vendor');
  const [issuedToEmployeeId, setIssuedToEmployeeId] = useState('');
  const [issuedToVendorId, setIssuedToVendorId] = useState(vendors[0]?.id || '');
  const [issuedToName, setIssuedToName] = useState('');
  const [issuedToContact, setIssuedToContact] = useState('');
  const [fromLocationId, setFromLocationId] = useState(locations[0]?.id || '');
  const [destination, setDestination] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  const toggleAsset = (id: string) => setAssetIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const value = assets.filter(a => assetIds.includes(a.id)).reduce((t, a) => t + a.purchaseCost, 0);

  const resolvedName = issuedToType === 'Employee' ? employees.find(e => e.id === issuedToEmployeeId)?.name || '' : issuedToType === 'Vendor' ? vendors.find(v => v.id === issuedToVendorId)?.name || '' : issuedToName;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type"><Select value={type} onChange={e => setType(e.target.value as GatePassType)}>{Object.values(GatePassType).map(t => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Purpose"><Select value={purpose} onChange={e => setPurpose(e.target.value as GatePassPurpose)}>{Object.values(GatePassPurpose).map(p => <option key={p} value={p}>{p}</option>)}</Select></Field>
        <Field label="Issued To"><Select value={issuedToType} onChange={e => setIssuedToType(e.target.value as any)}><option value="Employee">Employee</option><option value="Vendor">Vendor</option><option value="External">External Party</option></Select></Field>
        {issuedToType === 'Employee' && <Field label="Employee"><Select value={issuedToEmployeeId} onChange={e => setIssuedToEmployeeId(e.target.value)}><option value="">Select...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>}
        {issuedToType === 'Vendor' && <Field label="Vendor"><Select value={issuedToVendorId} onChange={e => setIssuedToVendorId(e.target.value)}>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>}
        {issuedToType === 'External' && (
          <div className="grid grid-cols-2 gap-3 col-span-1">
            <Field label="Name"><Input value={issuedToName} onChange={e => setIssuedToName(e.target.value)} /></Field>
            <Field label="Contact"><Input value={issuedToContact} onChange={e => setIssuedToContact(e.target.value)} /></Field>
          </div>
        )}
        <Field label="From Location"><Select value={fromLocationId} onChange={e => setFromLocationId(e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Destination" required><Input value={destination} onChange={e => setDestination(e.target.value)} /></Field>
        <Field label="Carrier / Vehicle"><Input value={carrierName} onChange={e => setCarrierName(e.target.value)} /></Field>
        {type === GatePassType.Returnable && <Field label="Expected Return Date"><Input type="date" value={expectedReturnDate} onChange={e => setExpectedReturnDate(e.target.value)} /></Field>}
      </div>

      <Field label={`Select Assets (${assetIds.length} selected)`} required>
        <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
          {assets.map(a => (
            <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={assetIds.includes(a.id)} onChange={() => toggleAsset(a.id)} className="rounded border-border text-primary" />
              <span className="font-mono text-xs text-text-light">{a.assetTag}</span>
              <span>{a.name}</span>
            </label>
          ))}
        </div>
      </Field>

      <div className="flex justify-between items-center pt-2 border-t border-border">
        <p className="text-sm font-semibold">Value: {formatCurrency(value)}</p>
        <PrimaryButton
          disabled={assetIds.length === 0 || !destination || !resolvedName}
          onClick={() => onSubmit({
            type, purpose, assetIds, issuedToType, issuedToEmployeeId: issuedToEmployeeId || undefined, issuedToVendorId: issuedToVendorId || undefined,
            issuedToName: resolvedName, issuedToContact: issuedToContact || undefined, fromLocationId, destination, carrierName: carrierName || undefined,
            issuedById: issuerId, issueDate: today(), expectedReturnDate: type === GatePassType.Returnable ? expectedReturnDate || undefined : undefined, value,
          })}
        >
          Submit Gate Pass
        </PrimaryButton>
      </div>
    </div>
  );
};

export default GatePasses;
