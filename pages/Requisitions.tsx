import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { ApprovalDocType, ApprovalStatus, DocStatus, Requisition, RequisitionLine, UserRole } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import ApprovalChain from '../components/ui/ApprovalChain';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today, uid } from '../lib/format';
import { useToast } from '../components/ui/Toast';
import { PageKey } from '../components/layout/nav';

const Requisitions: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser, me, submitRequisition, actOnRequisition, convertRequisitionToPo } = useAssetStore();
  const showToast = useToast();
  const { requisitions, employees, departments, locations, categories, variants, vendors } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const visible = currentUser.role === UserRole.EMPLOYEE && me ? requisitions.filter(r => r.requestedById === me.id) : requisitions;
  const filtered = statusFilter === 'all' ? visible : visible.filter(r => r.status === statusFilter);

  const empName = (id: string) => employees.find(e => e.id === id)?.name || '—';
  const selectedLive = selected ? requisitions.find(r => r.id === selected.id) || selected : null;

  return (
    <div>
      <ListToolbar title="Purchase Requisitions" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => requisitions.some(r => r.status === s)).map(s => ({ value: s, label: s }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New Requisition</PrimaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="clipboard" title="No requisitions" /> : (
        <TableCard>
          <THead columns={['PR No.', 'Requested By', 'Department', 'Value', 'Required By', 'Status', '']} />
          <tbody>
            {filtered.map(r => (
              <Tr key={r.id} onClick={() => setSelected(r)}>
                <Td className="font-mono text-xs">{r.prNo}</Td>
                <Td>{empName(r.requestedById)}</Td>
                <Td>{departments.find(d => d.id === r.departmentId)?.name}</Td>
                <Td className="font-medium">{formatCurrency(r.estimatedValue)}</Td>
                <Td>{formatDate(r.requiredBy)}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td><button className="text-primary text-sm font-semibold">View</button></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.prNo || ''} subtitle={selectedLive ? `Raised by ${empName(selectedLive.requestedById)}` : ''}>
        {selectedLive && (
          <>
            <StatusBadge status={selectedLive.status} />
            <section>
              <h3 className="text-sm font-semibold mb-2">Details</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-text-light">Department</dt><dd className="text-right font-medium">{departments.find(d => d.id === selectedLive.departmentId)?.name}</dd>
                <dt className="text-text-light">Location</dt><dd className="text-right font-medium">{locations.find(l => l.id === selectedLive.locationId)?.name}</dd>
                <dt className="text-text-light">Required By</dt><dd className="text-right font-medium">{formatDate(selectedLive.requiredBy)}</dd>
                <dt className="text-text-light">Estimated Value</dt><dd className="text-right font-medium">{formatCurrency(selectedLive.estimatedValue)}</dd>
              </dl>
              <p className="text-sm text-text-light mt-2">{selectedLive.justification}</p>
            </section>
            <section>
              <h3 className="text-sm font-semibold mb-2">Line Items</h3>
              <div className="space-y-1.5">
                {selectedLive.lines.map((l: RequisitionLine) => (
                  <div key={l.id} className="flex justify-between text-sm border border-border rounded-lg px-3 py-2">
                    <span>{l.description} × {l.quantity}</span>
                    <span className="font-medium">{formatCurrency(l.estimatedUnitCost * l.quantity)}</span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold mb-2">Approval Chain</h3>
              <ApprovalChain
                approvals={selectedLive.approvals}
                docType={ApprovalDocType.Requisition}
                amount={selectedLive.estimatedValue}
                initiatorId={selectedLive.requestedById}
                currentUser={currentUser}
                employees={employees}
                delegations={state.delegations}
                onDecide={(decision, remarks) => {
                  actOnRequisition(selectedLive.id, decision, remarks);
                  showToast(`Requisition ${decision.toLowerCase()}.`, decision === ApprovalStatus.Rejected ? 'error' : 'success');
                }}
              />
            </section>
            {selectedLive.status === DocStatus.Approved && (
              <PrimaryButton icon={<Icon name="cart" className="w-4 h-4" />} onClick={() => setConvertOpen(true)}>Convert to Purchase Order</PrimaryButton>
            )}
            {selectedLive.status === DocStatus.Converted && (
              <button onClick={() => onNavigate('purchaseOrders')} className="text-primary text-sm font-semibold hover:underline">
                View Purchase Order {selectedLive.poNo} →
              </button>
            )}
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New Purchase Requisition" wide>
        <NewRequisitionForm
          categories={categories}
          variants={variants}
          departments={departments}
          locations={locations}
          defaultDepartmentId={me?.departmentId}
          defaultLocationId={me?.locationId}
          onSubmit={draft => {
            submitRequisition({ ...draft, requestedById: me?.id || currentUser.id });
            showToast('Requisition submitted for approval.');
            setNewOpen(false);
          }}
        />
      </Modal>

      {selectedLive && (
        <Modal isOpen={convertOpen} onClose={() => setConvertOpen(false)} title="Convert to Purchase Order">
          <ConvertForm
            vendors={vendors}
            onSubmit={(vendorId, expectedDeliveryDate) => {
              convertRequisitionToPo(selectedLive.id, vendorId, expectedDeliveryDate);
              showToast('Purchase order created.');
              setConvertOpen(false);
              setSelected(null);
              onNavigate('purchaseOrders');
            }}
          />
        </Modal>
      )}
    </div>
  );
};

const NewRequisitionForm: React.FC<{
  categories: { id: string; name: string; parentId?: string }[];
  variants: { id: string; categoryId: string; name: string; standardCost: number }[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  defaultDepartmentId?: string;
  defaultLocationId?: string;
  onSubmit: (draft: Omit<Requisition, 'id' | 'prNo' | 'status' | 'approvals' | 'createdOn' | 'requestedById'>) => void;
}> = ({ categories, variants, departments, locations, defaultDepartmentId, defaultLocationId, onSubmit }) => {
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId || departments[0]?.id || '');
  const [locationId, setLocationId] = useState(defaultLocationId || locations[0]?.id || '');
  const [requiredBy, setRequiredBy] = useState(today());
  const [justification, setJustification] = useState('');
  const [lines, setLines] = useState<RequisitionLine[]>([{ id: uid('rl'), categoryId: categories[0]?.id || '', quantity: 1, estimatedUnitCost: 0, description: '' }]);

  const updateLine = (id: string, patch: Partial<RequisitionLine>) => setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () => setLines(prev => [...prev, { id: uid('rl'), categoryId: categories[0]?.id || '', quantity: 1, estimatedUnitCost: 0, description: '' }]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));
  const estimatedValue = lines.reduce((t, l) => t + l.quantity * l.estimatedUnitCost, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Department" required><Select value={departmentId} onChange={e => setDepartmentId(e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Location" required><Select value={locationId} onChange={e => setLocationId(e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Required By" required><Input type="date" value={requiredBy} onChange={e => setRequiredBy(e.target.value)} /></Field>
      </div>
      <Field label="Justification" required><TextArea rows={2} value={justification} onChange={e => setJustification(e.target.value)} placeholder="Why is this needed?" /></Field>

      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Line Items</p>
          <SecondaryButton onClick={addLine} icon={<Icon name="plus" className="w-4 h-4" />}>Add Line</SecondaryButton>
        </div>
        <div className="space-y-2">
          {lines.map(line => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-end border border-border rounded-lg p-2">
              <div className="col-span-3">
                <Select value={line.categoryId} onChange={e => updateLine(line.id, { categoryId: e.target.value, variantId: undefined })}>
                  {categories.filter(c => !categories.some(x => x.parentId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="col-span-3">
                <Select value={line.variantId || ''} onChange={e => {
                  const variant = variants.find(v => v.id === e.target.value);
                  updateLine(line.id, { variantId: e.target.value || undefined, description: variant?.name || line.description, estimatedUnitCost: variant?.standardCost || line.estimatedUnitCost });
                }}>
                  <option value="">Custom description</option>
                  {variants.filter(v => v.categoryId === line.categoryId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </div>
              <div className="col-span-3"><Input placeholder="Description" value={line.description} onChange={e => updateLine(line.id, { description: e.target.value })} /></div>
              <div className="col-span-1"><Input type="number" min={1} value={line.quantity} onChange={e => updateLine(line.id, { quantity: Number(e.target.value) })} /></div>
              <div className="col-span-1"><Input type="number" min={0} value={line.estimatedUnitCost} onChange={e => updateLine(line.id, { estimatedUnitCost: Number(e.target.value) })} /></div>
              <div className="col-span-1 flex justify-center">
                <button onClick={() => removeLine(line.id)} className="text-red-500 hover:text-red-700"><Icon name="trash" className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-border">
        <p className="text-sm font-semibold">Estimated Total: {formatCurrency(estimatedValue)}</p>
        <PrimaryButton
          disabled={!justification || lines.some(l => !l.description)}
          onClick={() => onSubmit({ departmentId, locationId, requiredBy, justification, lines, estimatedValue })}
        >
          Submit for Approval
        </PrimaryButton>
      </div>
    </div>
  );
};

const ConvertForm: React.FC<{ vendors: { id: string; name: string }[]; onSubmit: (vendorId: string, expectedDeliveryDate: string) => void }> = ({ vendors, onSubmit }) => {
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(today());
  return (
    <div className="space-y-4">
      <Field label="Vendor" required><Select value={vendorId} onChange={e => setVendorId(e.target.value)}>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
      <Field label="Expected Delivery Date" required><Input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} /></Field>
      <div className="flex justify-end"><PrimaryButton disabled={!vendorId} onClick={() => onSubmit(vendorId, expectedDeliveryDate)}>Create Purchase Order</PrimaryButton></div>
    </div>
  );
};

export default Requisitions;
