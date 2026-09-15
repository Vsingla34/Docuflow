import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { DocStatus, Grn, GrnLine, PurchaseOrder } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today } from '../lib/format';
import { useToast } from '../components/ui/Toast';
import { PageKey } from '../components/layout/nav';

const Grns: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser, me, postGrn } = useAssetStore();
  const showToast = useToast();
  const { grns, purchaseOrders, vendors, locations, assets } = state;

  const [selected, setSelected] = useState<Grn | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const receivablePOs = purchaseOrders.filter(po => [DocStatus.Approved, DocStatus.PartiallyReceived].includes(po.status) && po.lines.some(l => l.receivedQty < l.quantity));
  const vendorName = (id: string) => vendors.find(v => v.id === id)?.name || '—';

  return (
    <div>
      <ListToolbar title="Goods Receipt Notes (GRN)" count={grns.length}>
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} disabled={receivablePOs.length === 0} onClick={() => setNewOpen(true)}>
          Record Receipt
        </PrimaryButton>
      </ListToolbar>

      {grns.length === 0 ? <EmptyState icon="receipt" title="No goods received yet" /> : (
        <TableCard>
          <THead columns={['GRN No.', 'PO No.', 'Vendor', 'Received On', 'Invoice Value', 'Assets Created', '']} />
          <tbody>
            {grns.map(g => (
              <Tr key={g.id} onClick={() => setSelected(g)}>
                <Td className="font-mono text-xs">{g.grnNo}</Td>
                <Td className="font-mono text-xs">{g.poNo}</Td>
                <Td>{vendorName(g.vendorId)}</Td>
                <Td>{formatDate(g.receivedOn)}</Td>
                <Td className="font-medium">{formatCurrency(g.invoiceValue)}</Td>
                <Td>{g.createdAssetIds.length}</Td>
                <Td><button className="text-primary text-sm font-semibold">View</button></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.grnNo || ''} subtitle={selected ? `Against ${selected.poNo}` : ''}>
        {selected && (
          <>
            <StatusBadge status={selected.status} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-light">Vendor</dt><dd className="text-right font-medium">{vendorName(selected.vendorId)}</dd>
              <dt className="text-text-light">Received On</dt><dd className="text-right font-medium">{formatDate(selected.receivedOn)}</dd>
              <dt className="text-text-light">Invoice No.</dt><dd className="text-right font-medium">{selected.invoiceNo}</dd>
              <dt className="text-text-light">Invoice Value</dt><dd className="text-right font-medium">{formatCurrency(selected.invoiceValue)}</dd>
            </dl>
            <section>
              <h3 className="text-sm font-semibold mb-2">Lines</h3>
              <div className="space-y-1.5">
                {selected.lines.map(l => (
                  <div key={l.id} className="border border-border rounded-lg px-3 py-2 text-sm">
                    <div className="flex justify-between"><span>{l.description}</span><span className="font-medium">{formatCurrency(l.unitPrice)} / unit</span></div>
                    <p className="text-xs text-text-light mt-1">Accepted {l.acceptedQty} · Rejected {l.rejectedQty} · Serials: {l.serialNumbers.join(', ') || '—'}</p>
                  </div>
                ))}
              </div>
              {selected.inspectionRemarks && <p className="text-xs text-text-light italic mt-2">{selected.inspectionRemarks}</p>}
            </section>
            <section>
              <h3 className="text-sm font-semibold mb-2">Assets Created</h3>
              <div className="flex flex-wrap gap-1.5">
                {selected.createdAssetIds.map(id => {
                  const asset = assets.find(a => a.id === id);
                  return asset ? <button key={id} onClick={() => onNavigate('assets')} className="text-xs font-mono bg-slate-100 hover:bg-slate-200 rounded px-2 py-1">{asset.assetTag}</button> : null;
                })}
              </div>
            </section>
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="Record Goods Receipt" wide>
        <NewGrnForm
          purchaseOrders={receivablePOs}
          locations={locations}
          defaultReceivedById={me?.id || currentUser.id}
          onSubmit={draft => {
            postGrn(draft);
            showToast('GRN posted; assets added to the register.');
            setNewOpen(false);
            onNavigate('assets');
          }}
        />
      </Modal>
    </div>
  );
};

const NewGrnForm: React.FC<{
  purchaseOrders: PurchaseOrder[];
  locations: { id: string; name: string }[];
  defaultReceivedById: string;
  onSubmit: (draft: Omit<Grn, 'id' | 'grnNo' | 'status' | 'createdAssetIds'>) => void;
}> = ({ purchaseOrders, locations, defaultReceivedById, onSubmit }) => {
  const [poId, setPoId] = useState(purchaseOrders[0]?.id || '');
  const po = purchaseOrders.find(p => p.id === poId);
  const [locationId, setLocationId] = useState(po?.deliverToLocationId || locations[0]?.id || '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [remarks, setRemarks] = useState('');
  const [lineState, setLineState] = useState<Record<string, { acceptedQty: number; rejectedQty: number; serials: string }>>({});

  const pending = po?.lines.filter(l => l.receivedQty < l.quantity) || [];

  const getLine = (id: string) => lineState[id] || { acceptedQty: 0, rejectedQty: 0, serials: '' };
  const setLine = (id: string, patch: Partial<{ acceptedQty: number; rejectedQty: number; serials: string }>) =>
    setLineState(prev => ({ ...prev, [id]: { ...getLine(id), ...patch } }));

  const invoiceValue = pending.reduce((t, l) => t + getLine(l.id).acceptedQty * l.unitPrice, 0);
  const canSubmit = !!po && !!invoiceNo && pending.some(l => getLine(l.id).acceptedQty > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Purchase Order" required>
          <Select value={poId} onChange={e => { setPoId(e.target.value); setLineState({}); }}>
            {purchaseOrders.length === 0 && <option value="">No POs pending receipt</option>}
            {purchaseOrders.map(p => <option key={p.id} value={p.id}>{p.poNo}</option>)}
          </Select>
        </Field>
        <Field label="Received At"><Select value={locationId} onChange={e => setLocationId(e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Invoice No." required><Input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} /></Field>
        <Field label="Invoice Date" required><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></Field>
      </div>

      {po && (
        <div>
          <p className="text-sm font-medium mb-2">Lines Pending Receipt</p>
          <div className="space-y-2">
            {pending.map(line => {
              const remaining = line.quantity - line.receivedQty;
              const ls = getLine(line.id);
              return (
                <div key={line.id} className="border border-border rounded-lg p-3">
                  <p className="text-sm font-medium">{line.description}</p>
                  <p className="text-xs text-text-light mb-2">Ordered {line.quantity} · Already received {line.receivedQty} · Remaining {remaining}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Accepted Qty"><Input type="number" min={0} max={remaining} value={ls.acceptedQty} onChange={e => setLine(line.id, { acceptedQty: Math.min(Number(e.target.value), remaining) })} /></Field>
                    <Field label="Rejected Qty"><Input type="number" min={0} value={ls.rejectedQty} onChange={e => setLine(line.id, { rejectedQty: Number(e.target.value) })} /></Field>
                    <Field label="Serial Numbers" hint="Comma-separated, one per accepted unit"><Input value={ls.serials} onChange={e => setLine(line.id, { serials: e.target.value })} /></Field>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Field label="Inspection Remarks"><TextArea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></Field>

      <div className="flex justify-between items-center pt-2 border-t border-border">
        <p className="text-sm font-semibold">Invoice Value: {formatCurrency(invoiceValue)}</p>
        <PrimaryButton
          disabled={!canSubmit}
          onClick={() => {
            if (!po) return;
            const lines: GrnLine[] = pending.filter(l => getLine(l.id).acceptedQty > 0).map(l => {
              const ls = getLine(l.id);
              return {
                id: l.id, poLineId: l.id, categoryId: l.categoryId, variantId: l.variantId, description: l.description,
                orderedQty: l.quantity, receivedQty: ls.acceptedQty + ls.rejectedQty, acceptedQty: ls.acceptedQty, rejectedQty: ls.rejectedQty,
                unitPrice: l.unitPrice, serialNumbers: ls.serials.split(',').map(s => s.trim()).filter(Boolean),
              };
            });
            onSubmit({ poId: po.id, poNo: po.poNo, vendorId: po.vendorId, receivedOn: today(), receivedById: defaultReceivedById, locationId, departmentId: po.departmentId, invoiceNo, invoiceDate, invoiceValue, lines, inspectionRemarks: remarks || undefined });
          }}
        >
          Post GRN &amp; Create Assets
        </PrimaryButton>
      </div>
    </div>
  );
};

export default Grns;
