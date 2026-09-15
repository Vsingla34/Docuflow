import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { Employee, EmployeeStatus, UserRole } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, SearchInput, FilterSelect } from '../components/ui/Table';
import { Pill } from '../components/ui/Badge';
import { Modal } from '../components/ui/Overlay';
import { Field, Input, Select, PrimaryButton, SecondaryButton, LinkButton } from '../components/ui/FormControls';
import Icon from '../components/icons/Icon';
import { formatDate, uid } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const ROLE_TONE: Record<UserRole, 'purple' | 'blue' | 'slate' | 'green'> = {
  [UserRole.ADMIN]: 'purple',
  [UserRole.MANAGEMENT]: 'blue',
  [UserRole.EMPLOYEE]: 'slate',
  [UserRole.AUDITOR]: 'green',
};

const STATUS_TONE: Record<EmployeeStatus, 'green' | 'amber' | 'gray'> = {
  [EmployeeStatus.Active]: 'green',
  [EmployeeStatus.OnLeave]: 'amber',
  [EmployeeStatus.Exited]: 'gray',
};

const emptyEmployee = (departmentId: string, locationId: string): Employee => ({
  id: '', code: '', name: '', email: '', designation: '', grade: '', departmentId, locationId, role: UserRole.EMPLOYEE, status: EmployeeStatus.Active, joinedOn: new Date().toISOString().split('T')[0],
});

const Employees: React.FC = () => {
  const { state, users, saveEmployee } = useAssetStore();
  const showToast = useToast();
  const { employees, departments, locations, assets } = state;

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [modal, setModal] = useState<Employee | null>(null);

  const filtered = employees.filter(e => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || e.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const assetCount = (id: string) => assets.filter(a => a.custodianId === id).length;
  const isDemoLoginUser = (id: string) => users.some(u => u.employeeId === id);

  return (
    <div>
      <ListToolbar title="Employees & User Access" count={filtered.length}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, code, email..." />
        <FilterSelect value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: 'All roles' }, ...Object.values(UserRole).map(r => ({ value: r, label: r }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setModal(emptyEmployee(departments[0]?.id || '', locations[0]?.id || ''))}>New Employee</PrimaryButton>
      </ListToolbar>

      <TableCard>
        <THead columns={['Code', 'Name', 'Designation', 'Department', 'Location', 'System Role', 'Status', 'Assets Held', '']} />
        <tbody>
          {filtered.map(e => (
            <Tr key={e.id}>
              <Td className="font-mono text-xs">{e.code}</Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <img src={`https://i.pravatar.cc/32?u=${e.id}`} className="w-6 h-6 rounded-full" alt="" />
                  <span className="font-medium">{e.name}</span>
                  {isDemoLoginUser(e.id) && <Pill label="Demo login" tone="blue" />}
                </div>
              </Td>
              <Td>{e.designation}</Td>
              <Td>{departments.find(d => d.id === e.departmentId)?.name}</Td>
              <Td>{locations.find(l => l.id === e.locationId)?.name}</Td>
              <Td><Pill label={e.role} tone={ROLE_TONE[e.role]} /></Td>
              <Td><Pill label={e.status} tone={STATUS_TONE[e.status]} /></Td>
              <Td>{assetCount(e.id)}</Td>
              <Td><LinkButton onClick={() => setModal(e)}>Edit</LinkButton></Td>
            </Tr>
          ))}
        </tbody>
      </TableCard>

      {modal && (
        <EmployeeModal
          employee={modal}
          departments={departments}
          locations={locations}
          employees={employees}
          onClose={() => setModal(null)}
          onSave={emp => { saveEmployee(emp); showToast('Employee saved.'); setModal(null); }}
        />
      )}
    </div>
  );
};

const EmployeeModal: React.FC<{
  employee: Employee;
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  employees: Employee[];
  onClose: () => void;
  onSave: (e: Employee) => void;
}> = ({ employee, departments, locations, employees, onClose, onSave }) => {
  const [form, setForm] = useState(employee);
  return (
    <Modal isOpen onClose={onClose} title={employee.id ? 'Edit Employee' : 'New Employee'} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Employee Code" required><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Full Name" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Designation"><Input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} /></Field>
        <Field label="Grade"><Input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} /></Field>
        <Field label="Department"><Select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Location"><Select value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Reports To"><Select value={form.reportsTo || ''} onChange={e => setForm({ ...form, reportsTo: e.target.value || undefined })}><option value="">None</option>{employees.filter(e => e.id !== form.id).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        <Field label="System Role" hint="Controls navigation and approval authority."><Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>{Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}</Select></Field>
        <Field label="Status"><Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as EmployeeStatus })}>{Object.values(EmployeeStatus).map(s => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Joined On"><Input type="date" value={form.joinedOn} onChange={e => setForm({ ...form, joinedOn: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end gap-3 pt-5">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={!form.code || !form.name} onClick={() => onSave({ ...form, id: form.id || uid('emp') })}>Save Employee</PrimaryButton>
      </div>
    </Modal>
  );
};

export default Employees;
