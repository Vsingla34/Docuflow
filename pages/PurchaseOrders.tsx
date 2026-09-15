import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { ApprovalDocType, ApprovalStatus, DocStatus, PurchaseOrder, PurchaseOrderLine } from '../types';
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

const PurchaseOrders: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser, me, createPurchaseOrder, actOnPurchaseOrder } = useAssetStore();
  const showToast = useToast();
  const { purchaseOrders, vendors, departments, locations, categories, variants } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const filtered = statusFilter === 'all' ? purchaseOrders : purchaseOrders.filter(p => p.status === statusFilter);
  const selectedLive = selected ? purchaseOrders.find(p => p.id === selected.id) || selected : null;
  const vendorName = (id: string) => vendors.find(v => v.id === id)?.name || '—';

  return (
    <div>
      <ListToolbar title="Purchase Orders" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => purchaseOrders.some(p => p.status === s)).map(s => ({ value: s, label: s }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New Purchase Order</PrimaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="cart" title="No purchase orders" /> : (
        <TableCard>
          <THead columns={['PO No.', 'Vendor', 'Order Date', 'Grand Total', 'Deliver To', 'Status', '']} />
          <tbody>
            {filtered.map(po => (
              <Tr key={po.id} onClick={() => setSelected(po)}>
                <Td className="font-mono text-xs">{po.poNo}</Td>
                <Td>{vendorName(po.vendorId)}</Td>
                <Td>{formatDate(po.orderDate)}</Td>
                <Td className="font-medium">{formatCurrency(po.grandTotal)}</Td>
                <Td>{locations.find(l => l.id === po.deliverToLocationId)?.name}</Td>
                <Td><StatusBadge status={po.status} /></Td>
                <Td><button className="text-primary text-sm font-semibold">View</button></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.poNo || ''} subtitle={selectedLive ? vendorName(selectedLive.vendorId) : ''}>
        {selectedLive && (
          <>
            <StatusBadge status={selectedLive.status} />
            <section>
              <h3 className="text-sm font-semibold mb-2">Details</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-text-light">Order Date</dt><dd className="text-right font-medium">{formatDate(selectedLive.orderDate)}</dd>
                <dt className="text-text-light">Expected Delivery</dt><dd className="text-right font-medium">{formatDate(selectedLive.expectedDeliveryDate)}</dd>
                <dt className="text-text-light">Deliver To</dt><dd className="text-right font-medium">{locations.find(l => l.id === selectedLive.deliverToLocationId)?.name}</dd>
                <dt className="text-text-light">Payment Terms</dt><dd className="text-right font-medium">{selectedLive.paymentTerms}</dd>
                {selectedLive.prNo && <><dt className="text-text-light">Source Requisition</dt><dd className="text-right font-medium">{selectedLive.prNo}</dd></>}
              </dl>
            </section>
            <section>
              <h3 className="text-sm font-semibold mb-2">Line Items</h3>
              <div className="space-y-1.5">
                {selectedLive.lines.map((l: PurchaseOrderLine) => (
                  <div key={l.id} className="flex justify-between text-sm border border-border rounded-lg px-3 py-2">
                    <span>{l.description} · {l.receivedQty}/{l.quantity} received</span>
                    <span className="font-medium">{formatCurrency(l.quantity * l.unitPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-6 text-sm mt-2 text-text-light">
                <span>Subtotal: {formatCurrency(selectedLive.subTotal)}</span>
                <span>Tax: {formatCurrency(selectedLive.taxTotal)}</span>
                <span className="font-semibold text-text-main">Grand Total: {formatCurrency(selectedLive.grandTotal)}</span>
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold mb-2">Approval Chain</h3>
              <ApprovalChain
                approvals={selectedLive.approvals}
                docType={ApprovalDocType.PurchaseOrder}
                amount={selectedLive.grandTotal}
                initiatorId={selectedLive.createdById}
                currentUser={currentUser}
                employees={state.employees}
                delegations={state.delegations}
                onDecide={(decision, remarks) => {
                  actOnPurchaseOrder(selectedLive.id, decision, remarks);
                  showToast(`Purchase order ${decision.toLowerCase()}.`, decision === ApprovalStatus.Rejected ? 'error' : 'success');
                }}
              />
            </section>
            {[DocStatus.Approved, DocStatus.PartiallyReceived].includes(selectedLive.status) && selectedLive.lines.some(l => l.receivedQty < l.quantity) && (
              <button onClick={() => onNavigate('grns')} className="text-primary text-sm font-semibold hover:underline">Record goods receipt (GRN) →</button>
            )}
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New Purchase Order" wide>
        <NewPoForm
          vendors={vendors}
          departments={departments}
          locations={locations}
          categories={categories}
          variants={variants}
          defaultDepartmentId={me?.departmentId}
          defaultLocationId={me?.locationId}
          onSubmit={draft => {
            createPurchaseOrder({ ...draft, createdById: me?.id || currentUser.id });
            showToast('Purchase order raised.');
            setNewOpen(false);
          }}
        />
      </Modal>
    </div>
  );
};

const NewPoForm: React.FC<{
  vendors: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  categories: { id: string; name: string; parentId?: string }[];
  variants: { id: string; categoryId: string; name: string; standardCost: number }[];
  defaultDepartmentId?: string;
  defaultLocationId?: string;
  onSubmit: (draft: Omit<PurchaseOrder, 'id' | 'poNo' | 'status' | 'approvals' | 'createdById'>) => void;
}> = ({ vendors, departments, locations, categories, variants, defaultDepartmentId, defaultLocationId, onSubmit }) => {
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId || departments[0]?.id || '');
  const [deliverToLocationId, setDeliverToLocationId] = useState(defaultLocationId || locations[0]?.id || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(today());
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [warrantyTerms, setWarrantyTerms] = useState('Standard manufacturer warranty');
  const [lines, setLines] = useState<PurchaseOrderLine[]>([{ id: uid('pol'), categoryId: categories[0]?.id || '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18, receivedQty: 0 }]);

  const updateLine = (id: string, patch: Partial<PurchaseOrderLine>) => setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () => setLines(prev => [...prev, { id: uid('pol'), categoryId: categories[0]?.id || '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18, receivedQty: 0 }]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const subTotal = lines.reduce((t, l) => t + l.quantity * l.unitPrice, 0);
  const taxTotal = lines.reduce((t, l) => t + (l.quantity * l.unitPrice * l.taxPercent) / 100, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Vendor" required><Select value={vendorId} onChange={e => setVendorId(e.target.value)}>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        <Field label="Expected Delivery" required><Input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} /></Field>
        <Field label="Department"><Select value={departmentId} onChange={e => setDepartmentId(e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Deliver To"><Select value={deliverToLocationId} onChange={e => setDeliverToLocationId(e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Payment Terms"><Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} /></Field>
        <Field label="Warranty Terms"><Input value={warrantyTerms} onChange={e => setWarrantyTerms(e.target.value)} /></Field>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Line Items</p>
          <SecondaryButton onClick={addLine} icon={<Icon name="plus" className="w-4 h-4" />}>Add Line</SecondaryButton>
        </div>
        <div className="space-y-2">
          {lines.map(line => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-end border border-border rounded-lg p-2">
              <div className="col-span-2">
                <Select value={line.categoryId} onChange={e => updateLine(line.id, { categoryId: e.target.value, variantId: undefined })}>
                  {categories.filter(c => !categories.some(x => x.parentId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="col-span-3">
                <Select value={line.variantId || ''} onChange={e => {
                  const variant = variants.find(v => v.id === e.target.value);
                  updateLine(line.id, { variantId: e.target.value || undefined, description: variant?.name || line.description, unitPrice: variant?.standardCost || line.unitPrice });
                }}>
                  <option value="">Custom description</option>
                  {variants.filter(v => v.categoryId === line.categoryId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </div>
              <div className="col-span-3"><Input placeholder="Description" value={line.description} onChange={e => updateLine(line.id, { description: e.target.value })} /></div>
              <div className="col-span-1"><Input type="number" min={1} value={line.quantity} onChange={e => updateLine(line.id, { quantity: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Input type="number" min={0} value={line.unitPrice} onChange={e => updateLine(line.id, { unitPrice: Number(e.target.value) })} /></div>
              <div className="col-span-1"><Input type="number" min={0} max={28} value={line.taxPercent} onChange={e => updateLine(line.id, { taxPercent: Number(e.target.value) })} /></div>
              <div className="col-span-12 flex justify-end">
                <button onClick={() => removeLine(line.id)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"><Icon name="trash" className="w-3.5 h-3.5" /> Remove line</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-border">
        <p className="text-sm font-semibold">Grand Total: {formatCurrency(subTotal + taxTotal)}</p>
        <PrimaryButton
          disabled={!vendorId || lines.some(l => !l.description)}
          onClick={() => onSubmit({ vendorId, orderDate: today(), expectedDeliveryDate, deliverToLocationId, departmentId, lines, subTotal, taxTotal, grandTotal: subTotal + taxTotal, paymentTerms, warrantyTerms })}
        >
          Raise Purchase Order
        </PrimaryButton>
      </div>
    </div>
  );
};

export default PurchaseOrders;
