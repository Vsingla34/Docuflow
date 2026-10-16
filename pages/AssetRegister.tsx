import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAssetStore } from '../store/AssetStore';
import {
  Asset, AssetCondition, AssetStatus, ComponentStatus, Criticality, DocStatus, UserRole,
} from '../types';
import { ListToolbar, SearchInput, FilterSelect, TableCard, THead, Tr, Td } from '../components/ui/Table';
import { AssetStatusBadge, ConditionBadge, CriticalityBadge, Pill } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, Input, Select, PrimaryButton, SecondaryButton, TextArea } from '../components/ui/FormControls';
import { CodeField } from '../components/ui/CodeField';
import { TwoStepDeleteButton } from '../components/ui/TwoStepDeleteButton';
import Timeline from '../components/ui/Timeline';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today } from '../lib/format';
import { computeDepreciation } from '../lib/depreciation';
import { downloadCsv, CsvColumn } from '../lib/csvExport';
import { PageKey } from '../components/layout/nav';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';

interface AssetUploadHistoryRow {
  id: string;
  file_name: string;
  record_count: number;
  created_at: string;
}

const AssetRegister: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser, currentCompany, me, addComponent, updateAssetFields, deleteAsset, deleteAssetUploadBatch } = useAssetStore();
  const showToast = useToast();
  const { assets, categories, locations, departments, employees, vendors, components } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [selected, setSelected] = useState<Asset | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [componentOpen, setComponentOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<AssetUploadHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadUploadHistory = useCallback(async () => {
    if (!currentCompany) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('upload_history')
      .select('id, file_name, record_count, created_at')
      .eq('company_id', currentCompany.id)
      .eq('entity_type', 'Assets')
      .order('created_at', { ascending: false });
    if (!error && data) setUploadHistory(data as AssetUploadHistoryRow[]);
    setLoadingHistory(false);
  }, [currentCompany]);

  useEffect(() => {
    if (historyOpen) loadUploadHistory();
  }, [historyOpen, loadUploadHistory]);

  const handleDeleteAsset = async (asset: Asset) => {
    const result = await deleteAsset(asset.id);
    if (result.ok) {
      showToast(`${asset.assetTag || asset.name} deleted.`);
      setSelected(null);
    } else {
      showToast(result.error || 'Could not delete this asset.', 'error');
    }
  };

  const handleDeleteUploadBatch = async (h: AssetUploadHistoryRow) => {
    const result = await deleteAssetUploadBatch(h.id);
    if (result.ok) {
      showToast(`Deleted "${h.file_name}" and the ${h.record_count} asset(s) it created.`);
      setUploadHistory(prev => prev.filter(x => x.id !== h.id));
    } else {
      showToast(result.error || 'Could not delete this upload.', 'error');
    }
  };

  // Deep link from Asset Tag & QR Lookup's "Open Record →" button: before this, that button just
  // navigated to this page with no way to say *which* asset, so the admin had to search for and
  // click the row themselves all over again to see its details (including the open-reference
  // "notifications" banner below, which only renders once an asset is `selected`). The lookup
  // page now links here as /assets?asset=<id>; this opens that asset's drawer automatically the
  // moment it's found, then strips the query param so it doesn't linger in the URL or re-fire.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const assetId = searchParams.get('asset');
    if (!assetId) return;
    const match = assets.find(a => a.id === assetId);
    if (match) {
      setSelected(match);
    } else if (assets.length === 0) {
      // The asset list may still be loading (e.g. this page was just opened via the deep link,
      // before the store's initial Supabase fetch resolves) — wait for the next run of this
      // effect once `assets` actually has data, instead of giving up and stripping the param
      // before a real lookup was even possible.
      return;
    }
    // Either found it, or assets have loaded and it genuinely isn't there (deleted, wrong id,
    // etc.) — strip the param either way so it doesn't linger in the URL or re-fire on its own.
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('asset');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, assets]);

  const customRole = currentUser.customRoleId ? state.customRoles?.find(r => r.id === currentUser.customRoleId) : null;
  const canEdit = customRole ? customRole.permissions.assets?.edit : (currentUser.role === UserRole.SUPERADMIN || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGEMENT);

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

  const depreciation = selected ? computeDepreciation(selected, undefined, state.depreciationRateRules) : null;
  const assetComponents = selected ? components.filter(c => c.assetId === selected.id) : [];

  // Week 2-4 backlog: export/reporting. Exports exactly what's on screen — the role-scoped,
  // search- and filter-applied `filtered` list — not the whole register, so what an Employee
  // downloads matches what they're allowed to see, and a filtered view exports just that slice.
  const exportColumns: CsvColumn<Asset>[] = [
    { header: 'Asset Tag', value: a => a.assetTag },
    { header: 'Name', value: a => a.name },
    { header: 'Serial Number', value: a => a.serialNumber },
    { header: 'Category', value: a => nameOf(a.categoryId, categories) },
    { header: 'Custodian', value: a => empName(a.custodianId) },
    { header: 'Department', value: a => nameOf(a.departmentId, departments) },
    { header: 'Location', value: a => nameOf(a.locationId, locations) },
    { header: 'Status', value: a => a.status },
    { header: 'Condition', value: a => a.condition },
    { header: 'Criticality', value: a => a.criticality },
    { header: 'Purchase Date', value: a => a.purchaseDate },
    { header: 'Purchase Cost', value: a => a.purchaseCost },
    { header: 'Net Book Value', value: a => computeDepreciation(a, undefined, state.depreciationRateRules).netBookValue },
    { header: 'Vendor', value: a => (a.vendorId ? nameOf(a.vendorId, vendors) : '') },
    { header: 'PO No.', value: a => a.poNo || '' },
    { header: 'Warranty Expiry', value: a => a.warrantyExpiry || '' },
    { header: 'Last Verified On', value: a => a.lastVerifiedOn || '' },
  ];
  const exportAssets = () => {
    downloadCsv(`asset_register_${today()}`, filtered, exportColumns);
    showToast(`Exported ${filtered.length} asset${filtered.length === 1 ? '' : 's'} to CSV.`);
  };

  return (
    <div>
      <ListToolbar title="Asset Register" count={filtered.length}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tag, name, serial..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(AssetStatus).map(s => ({ value: s, label: s }))]} />
        <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={[{ value: 'all', label: 'All categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} />
        <FilterSelect value={locationFilter} onChange={setLocationFilter} options={[{ value: 'all', label: 'All locations' }, ...locations.map(l => ({ value: l.id, label: l.name }))]} />
        <div className="flex items-center gap-2">
          <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={exportAssets} disabled={filtered.length === 0}>
            Export CSV
          </SecondaryButton>
          {canEdit && (
            <>
              <SecondaryButton icon={<Icon name="history" className="w-4 h-4" />} onClick={() => setHistoryOpen(true)}>
                Upload History
              </SecondaryButton>
              <SecondaryButton icon={<Icon name="arrowLeft" className="w-4 h-4 rotate-90" />} onClick={() => setBulkOpen(true)}>
                Bulk Upload
              </SecondaryButton>
              <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setManualOpen(true)}>
                Add Asset
              </PrimaryButton>
            </>
          )}
        </div>
      </ListToolbar>

      {filtered.length === 0 ? (
        <TableCard><tbody><tr><td><EmptyState icon="box" title="No assets found" message="Try adjusting your filters." /></td></tr></tbody></TableCard>
      ) : (
        <TableCard>
          <THead columns={['Tag', 'Asset', 'Category', 'Custodian', 'Location', 'Status', 'Condition', 'Book Value']} />
          <tbody>
            {filtered.map(a => (
              <Tr key={a.id} onClick={() => setSelected(a)}>
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
                <Td className="font-medium">{formatCurrency(computeDepreciation(a, undefined, state.depreciationRateRules).netBookValue)}</Td>
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
            <TwoStepDeleteButton label="Delete" confirmLabel="Confirm delete?" onConfirm={() => handleDeleteAsset(selected)} />
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

            <section>
              <h3 className="text-sm font-semibold text-text-main mb-2">Details</h3>
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
            </section>

            <section>
              <h3 className="text-sm font-semibold text-text-main mb-2">Financials</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <InfoRow label="Purchase Cost" value={formatCurrency(depreciation.cost)} />
                <InfoRow label="Depreciation Method" value={selected.depreciationMethod} />
                <InfoRow label="Accumulated Depreciation" value={formatCurrency(depreciation.accumulated)} />
                <InfoRow label="Net Book Value" value={formatCurrency(depreciation.netBookValue)} />
                <InfoRow label="% Depreciated" value={`${depreciation.percentDepreciated}%`} />
                <InfoRow label="Useful Life" value={`${selected.usefulLifeYears} years`} />
              </dl>
            </section>

            {selected.disposal && (
              <section className="rounded-lg bg-slate-50 border border-border p-3">
                <h3 className="text-sm font-semibold text-text-main mb-1">Disposal</h3>
                <p className="text-sm text-text-light">{selected.disposal.mode} on {formatDate(selected.disposal.date)} · Realised {formatCurrency(selected.disposal.realisedValue)} · Ref {selected.disposal.refNo}</p>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-text-main">Components</h3>
              </div>
              {assetComponents.length === 0 ? (
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
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-text-main mb-3">History</h3>
              <Timeline events={selected.history} />
            </section>
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

      <ManualAssetModal
        isOpen={manualOpen}
        onClose={() => setManualOpen(false)}
      />

      <BulkAssetUploadModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
      />

      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Asset Upload History">
        <div className="space-y-3">
          <p className="text-sm text-text-light">
            Every CSV bulk upload made through "Bulk Upload" above is listed here. Deleting an upload removes its history
            entry AND every asset it created — this cannot be undone, so it asks you to confirm twice.
          </p>
          {loadingHistory ? (
            <div className="space-y-2">
              {[0, 1].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : uploadHistory.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="history" className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-text-light mt-2">No asset bulk uploads yet.</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {uploadHistory.map(h => (
                <li key={h.id} className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <p className="font-semibold text-text-main text-sm">{h.file_name}</p>
                    <p className="text-xs text-text-light mt-0.5">{h.record_count} asset{h.record_count === 1 ? '' : 's'} · {new Date(h.created_at).toLocaleString()}</p>
                  </div>
                  <TwoStepDeleteButton
                    iconOnly
                    title="Delete this upload and its assets"
                    onConfirm={() => handleDeleteUploadBatch(h)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end pt-5">
          <SecondaryButton onClick={() => setHistoryOpen(false)}>Close</SecondaryButton>
        </div>
      </Modal>
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
  const [warrantyExpiry, setWarrantyExpiry] = useState(asset.warrantyExpiry || '');
  const [insurancePolicyNo, setInsurancePolicyNo] = useState(asset.insurancePolicyNo || '');
  const [insuranceExpiry, setInsuranceExpiry] = useState(asset.insuranceExpiry || '');

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

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-text-main mb-3">Warranty &amp; Insurance</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Warranty Expiry">
              <Input type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} />
            </Field>
            <Field label="Insurance Policy No.">
              <Input value={insurancePolicyNo} onChange={e => setInsurancePolicyNo(e.target.value)} placeholder="e.g. POL-2026-00123" />
            </Field>
            <Field label="Insurance Expiry">
              <Input type="date" value={insuranceExpiry} onChange={e => setInsuranceExpiry(e.target.value)} />
            </Field>
          </div>
        </div>

        <Field label="Remarks">
          <TextArea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <PrimaryButton onClick={() => onSave({
            condition, criticality, locationId, subLocation: subLocation || undefined, remarks: remarks || undefined,
            warrantyExpiry: warrantyExpiry || undefined,
            insurancePolicyNo: insurancePolicyNo || undefined,
            insuranceExpiry: insuranceExpiry || undefined,
          })}>Save Changes</PrimaryButton>
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

const ManualAssetModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { state, createAssetManually } = useAssetStore();
  const showToast = useToast();

  const [assetTag, setAssetTag] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [purchaseCost, setPurchaseCost] = useState(0);
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [insurancePolicyNo, setInsurancePolicyNo] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');

  const handleSave = async () => {
    const cat = state.categories.find(c => c.id === categoryId);
    const id = await createAssetManually({
      // Left blank, the store generates the next tag in that category+location's own running
      // sequence (same scheme GRN receipts use) instead of a random placeholder.
      assetTag: assetTag.trim(),
      name,
      categoryId,
      locationId,
      departmentId,
      status: AssetStatus.InStore,
      condition: AssetCondition.New,
      criticality: Criticality.Low,
      purchaseDate: today(),
      purchaseCost,
      capitalizedOn: today(),
      serialNumber: '',
      usefulLifeYears: cat?.usefulLifeYears ?? 5,
      salvageValuePct: cat?.salvageValuePct ?? 5,
      depreciationMethod: cat?.depreciationMethod as any,
      warrantyExpiry: warrantyExpiry || undefined,
      insurancePolicyNo: insurancePolicyNo || undefined,
      insuranceExpiry: insuranceExpiry || undefined,
    });
    if (!id) { showToast('Failed to save asset to the database. Check the console for details.', 'error'); return; }
    showToast('Asset added manually.');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Asset Manually">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Asset Name" required><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dell XPS 15" /></Field>
        <CodeField
          label="Asset Tag (Optional)"
          required={false}
          value={assetTag}
          onChange={setAssetTag}
          rule={state.numberingRules.assetTag}
          isNew
          placeholder="Leave blank to auto-generate"
        />
        <Field label="Category" required>
          <Select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Select Category</option>
            {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Location" required>
          <Select value={locationId} onChange={e => setLocationId(e.target.value)}>
            <option value="">Select Location</option>
            {state.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <Field label="Department" required>
          <Select value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
            <option value="">Select Department</option>
            {state.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Purchase Cost (₹)" required><Input type="number" value={purchaseCost} onChange={e => setPurchaseCost(Number(e.target.value))} /></Field>
        <Field label="Warranty Expiry" hint="Optional"><Input type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} /></Field>
        <Field label="Insurance Policy No." hint="Optional"><Input value={insurancePolicyNo} onChange={e => setInsurancePolicyNo(e.target.value)} placeholder="e.g. POL-2026-00123" /></Field>
        <Field label="Insurance Expiry" hint="Optional"><Input type="date" value={insuranceExpiry} onChange={e => setInsuranceExpiry(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={!name || !categoryId || !locationId || !departmentId || purchaseCost <= 0} onClick={handleSave}>Create Asset</PrimaryButton>
      </div>
    </Modal>
  );
};

const BulkAssetUploadModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { bulkUploadAssets, state } = useAssetStore();
  const showToast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const downloadTemplate = () => {
    const headers = ['AssetTag', 'Name', 'CategoryCode', 'LocationCode', 'DepartmentCode', 'PurchaseCost', 'PurchaseDate'];
    const exampleRows = [
      ['AST-1001', 'MacBook Pro 16', 'CAT-LAPTOP', 'LOC-01', 'DEPT-IT', '120000', '2023-01-15'],
      ['AST-1002', 'Office Chair', 'CAT-FURN', 'LOC-02', 'DEPT-HR', '8500', '2023-05-20']
    ];
    const csv = [headers.join(','), ...exampleRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assets_template.csv';
    a.click();
  };

  const handleUpload = () => {
    if (!file) return;
    setUploadErrors([]);
    const reader = new FileReader();
    reader.onload = async e => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      if (lines.length <= 1) return;

      const drafts: Omit<Asset, 'id' | 'history'>[] = [];
      const headers = lines[0].split(',');
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < headers.length) continue;

        const norm = (s: string) => (s || '').trim().toLowerCase();
        const find = <T extends { id: string; code: string; name: string }>(list: T[], key: string) =>
          list.find(x => norm(x.code) === norm(key)) || list.find(x => x.id === key.trim()) || list.find(x => norm(x.name) === norm(key)) || list.find(x => norm(key) && norm(x.name).includes(norm(key)));
        const cat = find(state.categories, cols[2]) || state.categories[0];
        const loc = find(state.locations, cols[3]) || state.locations[0];
        const dept = find(state.departments, cols[4]) || state.departments[0];

        if (!cat) { errors.push(`Row ${i}: Category '${cols[2]}' not found, and no default category exists.`); continue; }
        if (!loc) { errors.push(`Row ${i}: Location '${cols[3]}' not found, and no default location exists.`); continue; }
        if (!dept) { errors.push(`Row ${i}: Department '${cols[4]}' not found, and no default department exists.`); continue; }

        drafts.push({
          assetTag: cols[0],
          name: cols[1],
          categoryId: cat.id,
          locationId: loc.id,
          departmentId: dept.id,
          purchaseCost: Number(cols[5]) || 0,
          purchaseDate: cols[6] || today(),
          capitalizedOn: cols[6] || today(),
          status: AssetStatus.InStore,
          condition: AssetCondition.New,
          criticality: Criticality.Low,
          serialNumber: '',
          usefulLifeYears: cat.usefulLifeYears,
          salvageValuePct: cat.salvageValuePct,
          depreciationMethod: cat.depreciationMethod,
        });
      }

      if (drafts.length > 0) {
        const result = await bulkUploadAssets(drafts, file.name);
        if (!result.ok) {
          setUploadErrors([result.error || 'Upload failed.', ...errors]);
          showToast('Upload failed: ' + (result.error || 'database error'), 'error');
        } else if (errors.length > 0) {
          setUploadErrors(errors);
          showToast(`Uploaded ${drafts.length} assets, but ${errors.length} failed.`, 'info');
        } else {
          showToast(`Successfully uploaded ${drafts.length} assets.`, 'success');
          onClose();
        }
      } else {
        if (errors.length > 0) {
          setUploadErrors(errors);
          showToast(`Upload failed. See details below.`, 'error');
        } else {
          showToast('No valid assets found in CSV.', 'error');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload Assets">
      <div className="space-y-4">
        <p className="text-sm text-text-light">Upload a CSV file to add multiple assets at once. Download the template below to ensure correct formatting.</p>
        <button onClick={downloadTemplate} className="text-sm font-medium text-primary hover:underline flex items-center gap-2">
          <Icon name="arrowLeft" className="w-4 h-4 rotate-[-90deg]" /> Download CSV Template
        </button>
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-slate-50">
          <input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={e => { setFile(e.target.files?.[0] || null); setUploadErrors([]); }} />
          <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <Icon name="arrowLeft" className="w-6 h-6 rotate-90" />
            </div>
            <span className="font-semibold text-text-main">
              {file ? file.name : 'Click to select CSV file'}
            </span>
          </label>
        </div>

        {uploadErrors.length > 0 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-2">
              <Icon name="alertCircle" className="w-4 h-4" /> Import Errors ({uploadErrors.length})
            </h4>
            <div className="max-h-40 overflow-y-auto text-xs text-red-700 space-y-1">
              {uploadErrors.map((err, idx) => <p key={idx}>{err}</p>)}
            </div>
            <p className="text-xs text-red-600 mt-3 font-medium">Please correct these issues in your CSV and try uploading again.</p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-5">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={!file} onClick={handleUpload}>Upload Assets</PrimaryButton>
      </div>
    </Modal>
  );
};

export default AssetRegister;