import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { AssetLocation, Department, LocationType, Vendor, VendorStatus } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td } from '../components/ui/Table';
import { Pill } from '../components/ui/Badge';
import { Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, Checkbox, PrimaryButton, SecondaryButton, LinkButton } from '../components/ui/FormControls';
import Icon from '../components/icons/Icon';
import { uid } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const emptyLocation = (): AssetLocation => ({ id: '', code: '', name: '', type: LocationType.Branch, address: '', city: '', state: '' });
const emptyDepartment = (): Department => ({ id: '', code: '', name: '', costCenter: '' });
const emptyVendor = (): Vendor => ({ id: '', code: '', name: '', gstin: '', contactPerson: '', email: '', phone: '', address: '', services: [], isAmcPartner: false, rating: 3, status: VendorStatus.Active });

const VENDOR_TONE: Record<VendorStatus, 'green' | 'red' | 'gray'> = { [VendorStatus.Active]: 'green', [VendorStatus.Blacklisted]: 'red', [VendorStatus.Inactive]: 'gray' };

const Masters: React.FC = () => {
  const { state, saveLocation, saveDepartment, saveVendor } = useAssetStore();
  const showToast = useToast();
  const { locations, departments, vendors, employees, assets } = state;

  const [tab, setTab] = useState<'locations' | 'departments' | 'vendors'>('locations');
  const [locModal, setLocModal] = useState<AssetLocation | null>(null);
  const [deptModal, setDeptModal] = useState<Department | null>(null);
  const [venModal, setVenModal] = useState<Vendor | null>(null);

  return (
    <div>
      <div className="flex gap-1 mb-5 bg-slate-200/60 p-1 rounded-lg w-fit">
        {(['locations', 'departments', 'vendors'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-semibold rounded-md capitalize transition-colors ${tab === t ? 'bg-white shadow-sm text-primary' : 'text-text-light'}`}>{t}</button>
        ))}
      </div>

      {tab === 'locations' && (
        <>
          <ListToolbar title="Locations" count={locations.length}>
            <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setLocModal(emptyLocation())}>New Location</PrimaryButton>
          </ListToolbar>
          <TableCard>
            <THead columns={['Code', 'Name', 'Type', 'City', 'Parent', 'Assets', '']} />
            <tbody>
              {locations.map(l => (
                <Tr key={l.id}>
                  <Td className="font-mono text-xs">{l.code}</Td>
                  <Td className="font-medium">{l.name}</Td>
                  <Td>{l.type}</Td>
                  <Td>{l.city}, {l.state}</Td>
                  <Td className="text-text-light">{locations.find(p => p.id === l.parentId)?.name || '—'}</Td>
                  <Td>{assets.filter(a => a.locationId === l.id).length}</Td>
                  <Td><LinkButton onClick={() => setLocModal(l)}>Edit</LinkButton></Td>
                </Tr>
              ))}
            </tbody>
          </TableCard>
        </>
      )}

      {tab === 'departments' && (
        <>
          <ListToolbar title="Departments" count={departments.length}>
            <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setDeptModal(emptyDepartment())}>New Department</PrimaryButton>
          </ListToolbar>
          <TableCard>
            <THead columns={['Code', 'Name', 'Cost Center', 'Head', 'Employees', 'Assets', '']} />
            <tbody>
              {departments.map(d => (
                <Tr key={d.id}>
                  <Td className="font-mono text-xs">{d.code}</Td>
                  <Td className="font-medium">{d.name}</Td>
                  <Td>{d.costCenter}</Td>
                  <Td>{employees.find(e => e.id === d.headEmployeeId)?.name || '—'}</Td>
                  <Td>{employees.filter(e => e.departmentId === d.id).length}</Td>
                  <Td>{assets.filter(a => a.departmentId === d.id).length}</Td>
                  <Td><LinkButton onClick={() => setDeptModal(d)}>Edit</LinkButton></Td>
                </Tr>
              ))}
            </tbody>
          </TableCard>
        </>
      )}

      {tab === 'vendors' && (
        <>
          <ListToolbar title="Vendors" count={vendors.length}>
            <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setVenModal(emptyVendor())}>New Vendor</PrimaryButton>
          </ListToolbar>
          <TableCard>
            <THead columns={['Code', 'Name', 'Services', 'Contact', 'AMC Partner', 'Rating', 'Status', '']} />
            <tbody>
              {vendors.map(v => (
                <Tr key={v.id}>
                  <Td className="font-mono text-xs">{v.code}</Td>
                  <Td className="font-medium">{v.name}</Td>
                  <Td><div className="flex flex-wrap gap-1">{v.services.map(s => <Pill key={s} label={s} tone="slate" />)}</div></Td>
                  <Td>{v.contactPerson}<br /><span className="text-xs text-text-light">{v.phone}</span></Td>
                  <Td>{v.isAmcPartner ? <Pill label="Yes" tone="green" /> : <Pill label="No" tone="gray" />}</Td>
                  <Td>★ {v.rating.toFixed(1)}</Td>
                  <Td><Pill label={v.status} tone={VENDOR_TONE[v.status]} /></Td>
                  <Td><LinkButton onClick={() => setVenModal(v)}>Edit</LinkButton></Td>
                </Tr>
              ))}
            </tbody>
          </TableCard>
        </>
      )}

      {locModal && <LocationModal location={locModal} locations={locations} onClose={() => setLocModal(null)} onSave={l => { saveLocation(l); showToast('Location saved.'); setLocModal(null); }} />}
      {deptModal && <DepartmentModal department={deptModal} employees={employees} onClose={() => setDeptModal(null)} onSave={d => { saveDepartment(d); showToast('Department saved.'); setDeptModal(null); }} />}
      {venModal && <VendorModal vendor={venModal} onClose={() => setVenModal(null)} onSave={v => { saveVendor(v); showToast('Vendor saved.'); setVenModal(null); }} />}
    </div>
  );
};

const LocationModal: React.FC<{ location: AssetLocation; locations: AssetLocation[]; onClose: () => void; onSave: (l: AssetLocation) => void }> = ({ location, locations, onClose, onSave }) => {
  const [form, setForm] = useState(location);
  return (
    <Modal isOpen onClose={onClose} title={location.id ? 'Edit Location' : 'New Location'} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" required><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Name" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Type"><Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as LocationType })}>{Object.values(LocationType).map(t => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Parent Location"><Select value={form.parentId || ''} onChange={e => setForm({ ...form, parentId: e.target.value || undefined })}><option value="">None</option>{locations.filter(l => l.id !== form.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="City"><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field>
        <Field label="State"><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></Field>
        <Field label="Address" className="col-span-2"><TextArea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end gap-3 pt-5"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={!form.code || !form.name} onClick={() => onSave({ ...form, id: form.id || uid('loc') })}>Save Location</PrimaryButton></div>
    </Modal>
  );
};

const DepartmentModal: React.FC<{ department: Department; employees: { id: string; name: string }[]; onClose: () => void; onSave: (d: Department) => void }> = ({ department, employees, onClose, onSave }) => {
  const [form, setForm] = useState(department);
  return (
    <Modal isOpen onClose={onClose} title={department.id ? 'Edit Department' : 'New Department'}>
      <div className="space-y-4">
        <Field label="Code" required><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Name" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Cost Center"><Input value={form.costCenter} onChange={e => setForm({ ...form, costCenter: e.target.value })} /></Field>
        <Field label="Head"><Select value={form.headEmployeeId || ''} onChange={e => setForm({ ...form, headEmployeeId: e.target.value || undefined })}><option value="">None</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
      </div>
      <div className="flex justify-end gap-3 pt-5"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={!form.code || !form.name} onClick={() => onSave({ ...form, id: form.id || uid('dept') })}>Save Department</PrimaryButton></div>
    </Modal>
  );
};

const VendorModal: React.FC<{ vendor: Vendor; onClose: () => void; onSave: (v: Vendor) => void }> = ({ vendor, onClose, onSave }) => {
  const [form, setForm] = useState(vendor);
  const [servicesText, setServicesText] = useState(vendor.services.join(', '));
  return (
    <Modal isOpen onClose={onClose} title={vendor.id ? 'Edit Vendor' : 'New Vendor'} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" required><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Name" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="GSTIN"><Input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} /></Field>
        <Field label="Contact Person"><Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Services" hint="Comma-separated" className="col-span-2"><Input value={servicesText} onChange={e => setServicesText(e.target.value)} /></Field>
        <Field label="Address" className="col-span-2"><TextArea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Status"><Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as VendorStatus })}>{Object.values(VendorStatus).map(s => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Rating (1-5)"><Input type="number" min={1} max={5} step={0.1} value={form.rating} onChange={e => setForm({ ...form, rating: Number(e.target.value) })} /></Field>
        <div className="col-span-2"><Checkbox label="Approved AMC service partner" checked={form.isAmcPartner} onChange={v => setForm({ ...form, isAmcPartner: v })} /></div>
      </div>
      <div className="flex justify-end gap-3 pt-5">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={!form.code || !form.name} onClick={() => onSave({ ...form, services: servicesText.split(',').map(s => s.trim()).filter(Boolean), id: form.id || uid('ven') })}>Save Vendor</PrimaryButton>
      </div>
    </Modal>
  );
};

export default Masters;
