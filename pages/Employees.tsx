import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAssetStore } from '../store/AssetStore';
import { Employee, EmployeeStatus, UserRole, CustomRole } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, SearchInput, FilterSelect } from '../components/ui/Table';
import { Pill } from '../components/ui/Badge';
import { Modal } from '../components/ui/Overlay';
import { Field, Input, Select, PrimaryButton, SecondaryButton, LinkButton } from '../components/ui/FormControls';
import { CodeField } from '../components/ui/CodeField';
import Icon from '../components/icons/Icon';
import { formatDate, uid } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const ROLE_TONE: Record<UserRole, 'purple' | 'blue' | 'slate' | 'green'> = {
  [UserRole.SUPERADMIN]: 'purple',
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
  const { state, users, saveEmployee, deleteEmployee } = useAssetStore();
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

  const [systemEmails, setSystemEmails] = useState<Set<string>>(new Set());
  const { currentCompany } = useAssetStore();

  const loadSystemUsers = useCallback(async () => {
    if (!currentCompany) return;
    const { data: ucData } = await supabase.from('user_companies').select('user_id').eq('company_id', currentCompany.id);
    if (!ucData || ucData.length === 0) return;
    const userIds = ucData.map(uc => uc.user_id);
    const { data } = await supabase.from('profiles').select('email, full_name').in('id', userIds);
    if (data) {
      console.log("Loaded system profiles:", data);
      setSystemEmails(new Set(data.filter(u => u.email).map(u => u.email.toLowerCase())));
      // Also store names as a fallback for the demo if emails are empty
      setSystemNames(new Set(data.filter(u => u.full_name).map(u => u.full_name.toLowerCase())));
    }
  }, [currentCompany]);

  const [systemNames, setSystemNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSystemUsers();
  }, [loadSystemUsers]);

  const isSystemUser = (e: Employee) => {
    if (e.email && systemEmails.has(e.email.toLowerCase())) return true;
    if (e.name && systemNames.has(e.name.toLowerCase())) return true;
    return false;
  };

  return (
    <div>
      <ListToolbar title="Employees & User Access" count={filtered.length}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, code, email..." />
        <FilterSelect value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: 'All roles' }, ...Object.values(UserRole).filter(r => r !== UserRole.SUPERADMIN).map(r => ({ value: r, label: r }))]} />
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
                  <span className="font-medium">{e.name}</span>
                  {isSystemUser(e) && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wider">
                      <Icon name="check" className="w-3 h-3" /> User
                    </span>
                  )}
                </div>
              </Td>
              <Td>{e.designation}</Td>
              <Td>{departments.find(d => d.id === e.departmentId)?.name}</Td>
              <Td>{locations.find(l => l.id === e.locationId)?.name}</Td>
              <Td><Pill label={e.role} tone={ROLE_TONE[e.role]} /></Td>
              <Td><Pill label={e.status} tone={STATUS_TONE[e.status]} /></Td>
              <Td>{assetCount(e.id)}</Td>
              <Td>
                <div className="flex gap-3">
                  <LinkButton onClick={() => setModal(e)}>Edit</LinkButton>
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete ${e.name}?`)) {
                        deleteEmployee(e.id);
                        showToast(`${e.name} deleted.`);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 font-medium text-sm"
                  >
                    Delete
                  </button>
                </div>
              </Td>
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
          customRoles={state.customRoles}
          numberingRule={state.numberingRules.employee}
          onClose={() => setModal(null)}
          onSave={async (emp, createLogin, password) => {
            if (createLogin && currentCompany) {
              const { error } = await supabase.rpc('create_app_user', {
                p_email: emp.email,
                p_password: password,
                p_full_name: emp.name,
                p_role: emp.role || UserRole.EMPLOYEE,
                p_phone: emp.phone || null,
                p_designation: emp.designation || null,
                p_company_id: currentCompany.id,
                p_custom_role_id: emp.customRoleId || null
              });
              if (error) {
                showToast(error.message, 'error');
                return;
              }
              showToast('System login created successfully!', 'success');
            }
            saveEmployee(emp);
            showToast('Employee saved.');
            setModal(null);
          }}
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
  customRoles?: CustomRole[];
  numberingRule?: import('../types').NumberingRule;
  onClose: () => void;
  onSave: (e: Employee, createLogin: boolean, password?: string) => void;
}> = ({ employee, departments, locations, employees, customRoles = [], numberingRule, onClose, onSave }) => {
  const [form, setForm] = useState(employee);
  const [createLogin, setCreateLogin] = useState(false);
  const [password, setPassword] = useState('');

  return (
    <Modal isOpen onClose={onClose} title={employee.id ? 'Edit Employee' : 'New Employee'} wide>
      <div className="grid grid-cols-2 gap-4">
        <CodeField value={form.code} onChange={v => setForm({ ...form, code: v })} rule={numberingRule} isNew={!employee.id} label="Employee Code" />
        <Field label="Full Name" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Designation"><Input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} /></Field>
        <Field label="Grade"><Input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} /></Field>
        <Field label="Department"><Select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Location"><Select value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Reports To"><Select value={form.reportsTo || ''} onChange={e => setForm({ ...form, reportsTo: e.target.value || undefined })}><option value="">None</option>{employees.filter(e => e.id !== form.id).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        <Field label="System Role" hint="Controls navigation and approval authority.">
          <Select
            value={form.customRoleId || form.role}
            onChange={e => {
              const val = e.target.value;
              if (Object.values(UserRole).includes(val as UserRole)) {
                setForm({ ...form, role: val as UserRole, customRoleId: undefined });
              } else {
                setForm({ ...form, role: UserRole.EMPLOYEE, customRoleId: val });
              }
            }}
          >
            <optgroup label="System Roles">
              {Object.values(UserRole).filter(r => r !== UserRole.SUPERADMIN).map(r => <option key={r} value={r}>{r}</option>)}
            </optgroup>
            {customRoles.length > 0 && (
              <optgroup label="Custom Roles">
                {customRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </optgroup>
            )}
          </Select>
        </Field>
        <Field label="Status"><Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as EmployeeStatus })}>{Object.values(EmployeeStatus).map(s => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Joined On"><Input type="date" value={form.joinedOn} onChange={e => setForm({ ...form, joinedOn: e.target.value })} /></Field>

        <div className="col-span-2 border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-text-main mb-3">Emergency Contact <span className="font-normal text-text-light">(optional)</span></h4>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name"><Input value={form.emergencyContactName || ''} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} /></Field>
            <Field label="Contact Phone"><Input value={form.emergencyContactPhone || ''} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} /></Field>
          </div>
        </div>

        {(!employee.id) && (
          <div className="col-span-2 pt-2 pb-1 border-t border-slate-100 mt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input type="checkbox" checked={createLogin} onChange={e => setCreateLogin(e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4" />
              Generate System Login (Auth) for this Employee
            </label>
            {createLogin && (
              <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-200 w-1/2">
                <Field label="Set Password" required hint="Minimum 8 characters">
                  <Input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter initial password" />
                </Field>
                <p className="text-xs text-slate-500 mt-2">
                  This will create an active login credential. The role selected above will determine their system access level.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-5">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton
          disabled={!form.code || !form.name || (createLogin && (!password || password.length < 8 || !form.email))}
          onClick={() => onSave({ ...form, id: form.id || uid('emp') }, createLogin, password)}
        >
          Save Employee
        </PrimaryButton>
      </div>
    </Modal>
  );
};

export default Employees;