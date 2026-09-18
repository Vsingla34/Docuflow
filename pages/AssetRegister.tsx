import React, { useMemo, useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import {
  Asset, AssetCondition, AssetStatus, ComponentStatus, Criticality, DocStatus, DocumentEntityType, UserRole,
} from '../types';
import { ListToolbar, SearchInput, FilterSelect, TableCard, THead, Tr, Td } from '../components/ui/Table';
import { AssetStatusBadge, ConditionBadge, CriticalityBadge, Pill } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, Input, Select, PrimaryButton, SecondaryButton, TextArea } from '../components/ui/FormControls';
import Timeline from '../components/ui/Timeline';
import { Tabs } from '../components/ui/Tabs';
import DocumentsPanel from '../components/ui/DocumentsPanel';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today } from '../lib/format';
import { computeDepreciation } from '../lib/depreciation';
import { exportToCsv } from '../lib/csv';
import { exportTableToPdf } from '../lib/pdf';
import { PageKey } from '../components/layout/nav';
import { useToast } from '../components/ui/Toast';

const AssetRegister: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser, me, addComponent, updateAssetFields } = useAssetStore();
  const showToast = useToast();
  const { assets, categories, locations, departments, employees, vendors, components } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [selected, setSelected] = useState<Asset | null>(null);
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [componentOpen, setComponentOpen] = useState(false);

  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGEMENT;
  const openAsset = (a: Asset) => { setSelected(a); setTab('overview'); };

  const scoped = useMemo(() => {
    if (currentUser.role !== UserRole.EMPLOYEE || !me) return assets;
    return assets.filter(a => a.custodianId === me.id || a.departmentId === me.departmentId);
  }, [assets, currentUser, me]);

  const filtered = scoped.filter(a => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || a.assetTag.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.serialNumber.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || a.categoryId === categoryFilter;
    const matchesLocation = locationFilter === 'all' || a.locationId === locationFilter;
    return matchesSearch && matchesStatus && matchesCategory && matchesLocation;
  });

  const nameOf = (id: string | undefined, list: { id: string; name: string }[], fallback = '—') => list.find(x => x.id === id)?.name || fallback;
  const empName = (id?: string) => (id ? employees.find(e => e.id === id)?.name || '—' : '—');

  const openRefs = (assetId: string): { label: string; page: PageKey }[] => {
    const refs: { label: string; page: PageKey }[] = [];
    state.serviceTickets.filter(t => t.assetId === assetId && ![DocStatus.Completed, DocStatus.Cancelled, DocStatus.Rejected].includes(t.status))
      .forEach(t => refs.push({ label: `Service ticket ${t.ticketNo} (${t.status})`, page: 'serviceTickets' }));
    state.transfers.filter(t => t.assetIds.includes(assetId) && ![DocStatus.Completed, DocStatus.Cancelled, DocStatus.Rejected].includes(t.status))
      .forEach(t => refs.push({ label: `Transfer ${t.transferNo} (${t.status})`, page: 'transfers' }));
    state.gatePasses.filter(g => g.assetIds.includes(assetId) && ![DocStatus.Returned, DocStatus.Cancelled, DocStatus.Rejected].includes(g.status))
      .forEach(g => refs.push({ label: `Gate pass ${g.gatePassNo} (${g.status})`, page: 'gatePasses' }));
    state.replacements.filter(r => r.oldAssetId === assetId && ![DocStatus.Completed, DocStatus.Cancelled, DocStatus.Rejected].includes(r.status))
      .forEach(r => refs.push({ label: `Replacement ${r.replacementNo} (${r.status})`, page: 'replacements' }));
    state.disposals.filter(d => d.lines.some(l => l.assetId === assetId) && ![DocStatus.Completed, DocStatus.Cancelled, DocStatus.Rejected].includes(d.status))
      .forEach(d => refs.push({ label: `Disposal ${d.disposalNo} (${d.status})`, page: 'disposals' }));
    return refs;
  };

  const depreciation = selected ? computeDepreciation(selected) : null;
  const assetComponents = selected ? components.filter(c => c.assetId === selected.id) : [];

  const exportColumns = [
    { header: 'Tag', value: (a: Asset) => a.assetTag },
    { header: 'Name', value: (a: Asset) => a.name },
    { header: 'Serial No.', value: (a: Asset) => a.serialNumber },
    { header: 'Category', value: (a: Asset) => nameOf(a.categoryId, categories) },
    { header: 'Custodian', value: (a: Asset) => empName(a.custodianId) },
    { header: 'Location', value: (a: Asset) => nameOf(a.locationId, locations) },
    { header: 'Status', value: (a: Asset) => a.status },
    { header: 'Condition', value: (a: Asset) => a.condition },
    { header: 'Purchase Cost', value: (a: Asset) => a.purchaseCost },
    { header: 'Book Value', value: (a: Asset) => Math.round(computeDepreciation(a).netBookValue) },
  ];

  return (
    <div>
      <ListToolbar title="Asset Register" count={filtered.length}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tag, name, serial..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(AssetStatus).map(s => ({ value: s, label: s }))]} />
        <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={[{ value: 'all', label: 'All categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} />
        <FilterSelect value={locationFilter} onChange={setLocationFilter} options={[{ value: 'all', label: 'All locations' }, ...locations.map(l => ({ value: l.id, label: l.name }))]} />
        <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={() => exportToCsv('asset-register', exportColumns, filtered)}>CSV</SecondaryButton>
        <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={() => exportTableToPdf('asset-register', 'Asset Register', exportColumns.map(c => ({ header: c.header, value: (a: Asset) => String(c.value(a)) })), filtered)}>PDF</SecondaryButton>
      </ListToolbar>

      {filtered.length === 0 ? (
        <TableCard><tbody><tr><td><EmptyState icon="box" title="No assets found" message="Try adjusting your filters." /></td></tr></tbody></TableCard>
      ) : (
        <TableCard>
          <THead columns={['Tag', 'Asset', 'Category', 'Custodian', 'Location', 'Status', 'Condition', 'Book Value']} />
          <tbody>
            {filtered.map(a => (
              <Tr key={a.id} onClick={() => openAsset(a)}>
                <Td className="font-mono text-xs">{a.assetTag}</Td>
                <Td>
                  <p className="font-medium text-text-main">{a.name}</p>
                  <p className="text-xs text-text-light">{a.serialNumber}</p>
                </Td>
                <Td>{nameOf(a.categoryId, categories)}</Td>
                <Td>{empName(a.custodianId)}</Td>
                <Td>{nameOf(a.locationId, locations)}</Td>
                <Td><AssetStatusBadge status={a.status} /></Td>
                <Td><ConditionBadge condition={a.condition} /></Td>
                <Td className="font-medium">{formatCurrency(computeDepreciation(a).netBookValue)}</Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name || ''}
        subtitle={selected ? `${selected.assetTag} · ${selected.serialNumber}` : ''}
        actions={selected && canEdit ? (
          <>
            <SecondaryButton icon={<Icon name="layers" className="w-4 h-4" />} onClick={() => setComponentOpen(true)}>Add Component</SecondaryButton>
            <PrimaryButton icon={<Icon name="pencil" className="w-4 h-4" />} onClick={() => setEditOpen(true)}>Edit</PrimaryButton>
          </>
        ) : undefined}
      >
        {selected && depreciation && (
          <>
            <div className="flex flex-wrap gap-2">
              <AssetStatusBadge status={selected.status} />
              <ConditionBadge condition={selected.condition} />
              <CriticalityBadge criticality={selected.criticality} />
              {selected.amcContractId && <Pill label="Under AMC" tone="green" />}
            </div>

            {openRefs(selected.id).length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                {openRefs(selected.id).map(ref => (
                  <button key={ref.label} onClick={() => onNavigate(ref.page)} className="block text-sm text-amber-800 hover:underline">→ {ref.label}</button>
                ))}
              </div>
            )}

            <Tabs
              active={tab}
              onChange={setTab}
              items={[
                { key: 'overview', label: 'Overview' },
                { key: 'financials', label: 'Financials' },
                { key: 'components', label: 'Components', count: assetComponents.length },
                { key: 'documents', label: 'Documents', count: state.documents.filter(d => d.entityType === DocumentEntityType.Asset && d.entityId === selected.id).length },
                { key: 'history', label: 'History', count: selected.history.length },
              ]}
            />

            {tab === 'overview' && (
              <section>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <InfoRow label="Category" value={nameOf(selected.categoryId, categories)} />
                  <InfoRow label="Custodian" value={empName(selected.custodianId)} />
                  <InfoRow label="Department" value={nameOf(selected.departmentId, departments)} />
                  <InfoRow label="Location" value={nameOf(selected.locationId, locations) + (selected.subLocation ? ` (${selected.subLocation})` : '')} />
                  <InfoRow label="Vendor" value={nameOf(selected.vendorId, vendors)} />
                  <InfoRow label="PO / GRN" value={`${selected.poNo || '—'} / ${selected.grnNo || '—'}`} />
                  <InfoRow label="Purchase Date" value={formatDate(selected.purchaseDate)} />
                  <InfoRow label="Warranty Expiry" value={formatDate(selected.warrantyExpiry)} />
                  {selected.insuranceExpiry && <InfoRow label="Insurance Expiry" value={formatDate(selected.insuranceExpiry)} />}
                  <InfoRow label="Last Verified" value={selected.lastVerifiedOn ? `${formatDate(selected.lastVerifiedOn)} by ${selected.lastVerifiedBy}` : 'Not yet verified'} />
                </dl>
                {selected.disposal && (
                  <div className="rounded-lg bg-slate-50 border border-border p-3 mt-4">
                    <h3 className="text-sm font-semibold text-text-main mb-1">Disposal</h3>
                    <p className="text-sm text-text-light">{selected.disposal.mode} on {formatDate(selected.disposal.date)} · Realised {formatCurrency(selected.disposal.realisedValue)} · Ref {selected.disposal.refNo}</p>
                  </div>
                )}
              </section>
            )}

            {tab === 'financials' && (
              <section>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <InfoRow label="Purchase Cost" value={formatCurrency(depreciation.cost)} />
                  <InfoRow label="Depreciation Method" value={selected.depreciationMethod} />
                  <InfoRow label="Accumulated Depreciation" value={formatCurrency(depreciation.accumulated)} />
                  <InfoRow label="Net Book Value" value={formatCurrency(depreciation.netBookValue)} />
                  <InfoRow label="% Depreciated" value={`${depreciation.percentDepreciated}%`} />
                  <InfoRow label="Useful Life" value={`${selected.usefulLifeYears} years`} />
                </dl>
                {depreciation.schedule.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-text-main mb-2">Depreciation Schedule</h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <THead columns={['Year', 'Opening', 'Charge', 'Closing']} />
                        <tbody>
                          {depreciation.schedule.map(row => (
                            <Tr key={row.year}>
                              <Td>{row.label} ({row.year})</Td>
                              <Td>{formatCurrency(row.openingValue)}</Td>
                              <Td>{formatCurrency(row.charge)}</Td>
                              <Td>{formatCurrency(row.closingValue)}</Td>
                            </Tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === 'components' && (
              assetComponents.length === 0 ? (
                <p className="text-sm text-text-light">No components tracked for this asset.</p>
              ) : (
                <div className="space-y-2">
                  {assetComponents.map(c => (
                    <div key={c.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-text-main">{c.name}</p>
                        <p className="text-xs text-text-light">{c.partNumber || c.serialNumber || '—'} · Installed {formatDate(c.installedOn)} · {formatCurrency(c.cost)}</p>
                        {c.remarks && <p className="text-xs text-text-light italic mt-0.5">{c.remarks}</p>}
                      </div>
                      <Pill label={c.status} tone={c.status === ComponentStatus.Installed ? 'green' : c.status === ComponentStatus.Faulty ? 'amber' : 'gray'} />
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'documents' && (
              <DocumentsPanel entityType={DocumentEntityType.Asset} entityId={selected.id} entityLabel={`${selected.assetTag} · ${selected.name}`} canEdit={canEdit} />
            )}

            {tab === 'history' && <Timeline events={selected.history} />}
          </>
        )}
      </Drawer>

      {selected && (
        <EditAssetModal
          asset={selected}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={patch => {
            updateAssetFields(selected.id, patch, 'Details updated from asset register.');
            setSelected({ ...selected, ...patch });
            showToast('Asset updated.');
            setEditOpen(false);
          }}
        />
      )}

      {selected && (
        <Modal isOpen={componentOpen} onClose={() => setComponentOpen(false)} title="Add Component">
          <AddComponentForm
            onSubmit={comp => {
              addComponent(selected.id, comp);
              showToast('Component added.');
              setComponentOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <>
    <dt className="text-text-light">{label}</dt>
    <dd className="text-text-main font-medium text-right">{value}</dd>
  </>
);

const EditAssetModal: React.FC<{ asset: Asset; isOpen: boolean; onClose: () => void; onSave: (patch: Partial<Asset>) => void }> = ({ asset, isOpen, onClose, onSave }) => {
  const { state } = useAssetStore();
  const [condition, setCondition] = useState(asset.condition);
  const [criticality, setCriticality] = useState(asset.criticality);
  const [locationId, setLocationId] = useState(asset.locationId);
  const [subLocation, setSubLocation] = useState(asset.subLocation || '');
  const [remarks, setRemarks] = useState(asset.remarks || '');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${asset.assetTag}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Condition">
            <Select value={condition} onChange={e => setCondition(e.target.value as AssetCondition)}>
              {Object.values(AssetCondition).map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Criticality">
            <Select value={criticality} onChange={e => setCriticality(e.target.value as Criticality)}>
              {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Location">
          <Select value={locationId} onChange={e => setLocationId(e.target.value)}>
            {state.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <Field label="Sub-location" hint="Optional, e.g. floor, room, rack.">
          <Input value={subLocation} onChange={e => setSubLocation(e.target.value)} />
        </Field>
        <Field label="Remarks">
          <TextArea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <PrimaryButton onClick={() => onSave({ condition, criticality, locationId, subLocation: subLocation || undefined, remarks: remarks || undefined })}>Save Changes</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
};

const AddComponentForm: React.FC<{ onSubmit: (c: { name: string; partNumber?: string; serialNumber?: string; cost: number; installedOn: string; status: ComponentStatus; source: 'Manual'; remarks?: string }) => void }> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [cost, setCost] = useState(0);
  const [remarks, setRemarks] = useState('');

  return (
    <div className="space-y-4">
      <Field label="Component Name" required><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. RAM module, tyre, battery" /></Field>
      <Field label="Part Number"><Input value={partNumber} onChange={e => setPartNumber(e.target.value)} /></Field>
      <Field label="Cost (₹)"><Input type="number" value={cost} onChange={e => setCost(Number(e.target.value))} /></Field>
      <Field label="Remarks"><TextArea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></Field>
      <div className="flex justify-end">
        <PrimaryButton
          disabled={!name}
          onClick={() => onSubmit({ name, partNumber: partNumber || undefined, cost, installedOn: today(), status: ComponentStatus.Installed, source: 'Manual', remarks: remarks || undefined })}
        >
          Add Component
        </PrimaryButton>
      </div>
    </div>
  );
};

export default AssetRegister;
