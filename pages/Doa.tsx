import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { ApprovalDocType, DoaDelegation, DoaRule, UserRole } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td } from '../components/ui/Table';
import { Pill } from '../components/ui/Badge';
import { Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, Checkbox, PrimaryButton, SecondaryButton, LinkButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today, uid } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const emptyRule = (): DoaRule => ({
  id: '', docType: ApprovalDocType.Requisition, level: 1, approverTitle: '', approverRole: UserRole.MANAGEMENT,
  minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: today(),
});

const Doa: React.FC = () => {
  const { state, currentUser, saveDoaRule, toggleDoaRule, saveDelegation, toggleDelegation } = useAssetStore();
  const showToast = useToast();
  const { doaRules, delegations, employees, categories, locations } = state;
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const [tab, setTab] = useState<'matrix' | 'delegations'>('matrix');
  const [ruleModal, setRuleModal] = useState<DoaRule | null>(null);
  const [delModal, setDelModal] = useState<DoaDelegation | null>(null);

  const grouped = Object.values(ApprovalDocType).map(docType => ({ docType, rules: doaRules.filter(r => r.docType === docType).sort((a, b) => a.level - b.level) }));
  const empName = (id: string) => employees.find(e => e.id === id)?.name || '—';

  return (
    <div>
      <div className="flex gap-1 mb-5 bg-slate-200/60 p-1 rounded-lg w-fit">
        {(['matrix', 'delegations'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-semibold rounded-md capitalize transition-colors ${tab === t ? 'bg-white shadow-sm text-primary' : 'text-text-light'}`}>
            {t === 'matrix' ? 'Authority Matrix' : 'Delegations'}
          </button>
        ))}
      </div>

      {tab === 'matrix' ? (
        <>
          <ListToolbar title="Delegation of Authority Matrix" count={doaRules.length}>
            {!isAdmin && <Pill label="View only — Admin manages this matrix" tone="slate" />}
            {isAdmin && (
              <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setRuleModal(emptyRule())}>New Rule</PrimaryButton>
            )}
          </ListToolbar>
          <div className="space-y-6">
            {grouped.filter(g => g.rules.length > 0).map(g => (
              <div key={g.docType} className="bg-card rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-slate-50 font-semibold text-sm">{g.docType}</div>
                <table className="w-full text-left text-sm">
                  <THead columns={['Level', 'Approver', 'Role', 'Value Band', 'Scope', 'Active', '']} />
                  <tbody>
                    {g.rules.map(r => (
                      <Tr key={r.id}>
                        <Td>L{r.level}</Td>
                        <Td className="font-medium">{r.approverTitle}</Td>
                        <Td>{r.approverRole}</Td>
                        <Td>{formatCurrency(r.minAmount)} {r.maxAmount ? `– ${formatCurrency(r.maxAmount)}` : 'and above'}</Td>
                        <Td>
                          {r.categoryIds.length === 0 && r.locationIds.length === 0 ? <span className="text-text-light">All</span> : (
                            <div className="flex flex-wrap gap-1">
                              {r.categoryIds.map(id => <Pill key={id} label={categories.find(c => c.id === id)?.name || id} tone="blue" />)}
                              {r.locationIds.map(id => <Pill key={id} label={locations.find(l => l.id === id)?.name || id} tone="purple" />)}
                            </div>
                          )}
                        </Td>
                        <Td>
                          {isAdmin ? (
                            <button onClick={() => toggleDoaRule(r.id, !r.active)}>
                              <Pill label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'green' : 'gray'} />
                            </button>
                          ) : (
                            <Pill label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'green' : 'gray'} />
                          )}
                        </Td>
                        <Td>{isAdmin && <LinkButton onClick={() => setRuleModal(r)}>Edit</LinkButton>}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <ListToolbar title="Temporary Delegations" count={delegations.length}>
            <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setDelModal({ id: '', fromEmployeeId: employees[0]?.id || '', toEmployeeId: employees[1]?.id || '', docTypes: [], fromDate: today(), toDate: today(), reason: '', active: true })}>
              New Delegation
            </PrimaryButton>
          </ListToolbar>
          {delegations.length === 0 ? <EmptyState icon="users" title="No delegations configured" /> : (
            <TableCard>
              <THead columns={['From', 'To', 'Document Types', 'Period', 'Reason', 'Active', '']} />
              <tbody>
                {delegations.map(d => (
                  <Tr key={d.id}>
                    <Td className="font-medium">{empName(d.fromEmployeeId)}</Td>
                    <Td className="font-medium">{empName(d.toEmployeeId)}</Td>
                    <Td><div className="flex flex-wrap gap-1">{d.docTypes.map(t => <Pill key={t} label={t} tone="blue" />)}</div></Td>
                    <Td>{formatDate(d.fromDate)} – {formatDate(d.toDate)}</Td>
                    <Td className="max-w-xs truncate">{d.reason}</Td>
                    <Td><button onClick={() => toggleDelegation(d.id, !d.active)}><Pill label={d.active ? 'Active' : 'Inactive'} tone={d.active ? 'green' : 'gray'} /></button></Td>
                    <Td><LinkButton onClick={() => setDelModal(d)}>Edit</LinkButton></Td>
                  </Tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </>
      )}

      {ruleModal && (
        <RuleModal
          rule={ruleModal}
          categories={categories}
          locations={locations}
          onClose={() => setRuleModal(null)}
          onSave={rule => { saveDoaRule(rule); showToast('DOA rule saved.'); setRuleModal(null); }}
        />
      )}
      {delModal && (
        <DelegationModal
          delegation={delModal}
          employees={employees}
          onClose={() => setDelModal(null)}
          onSave={d => { saveDelegation(d); showToast('Delegation saved.'); setDelModal(null); }}
        />
      )}
    </div>
  );
};

const RuleModal: React.FC<{ rule: DoaRule; categories: { id: string; name: string }[]; locations: { id: string; name: string }[]; onClose: () => void; onSave: (r: DoaRule) => void }> = ({ rule, categories, locations, onClose, onSave }) => {
  const [form, setForm] = useState(rule);
  const toggleCat = (id: string) => setForm(f => ({ ...f, categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter(x => x !== id) : [...f.categoryIds, id] }));
  const toggleLoc = (id: string) => setForm(f => ({ ...f, locationIds: f.locationIds.includes(id) ? f.locationIds.filter(x => x !== id) : [...f.locationIds, id] }));

  return (
    <Modal isOpen onClose={onClose} title={rule.id ? 'Edit DOA Rule' : 'New DOA Rule'} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Document Type"><Select value={form.docType} onChange={e => setForm({ ...form, docType: e.target.value as ApprovalDocType })}>{Object.values(ApprovalDocType).map(t => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Level"><Input type="number" min={1} value={form.level} onChange={e => setForm({ ...form, level: Number(e.target.value) })} /></Field>
        <Field label="Approver Title" required><Input value={form.approverTitle} onChange={e => setForm({ ...form, approverTitle: e.target.value })} placeholder="e.g. Department Manager" /></Field>
        <Field label="Approver Role"><Select value={form.approverRole} onChange={e => setForm({ ...form, approverRole: e.target.value as UserRole })}><option value={UserRole.ADMIN}>Admin</option><option value={UserRole.MANAGEMENT}>Management</option></Select></Field>
        <Field label="Min Amount (₹)"><Input type="number" min={0} value={form.minAmount} onChange={e => setForm({ ...form, minAmount: Number(e.target.value) })} /></Field>
        <Field label="Max Amount (₹)" hint="Leave blank for 'and above'"><Input type="number" min={0} value={form.maxAmount ?? ''} onChange={e => setForm({ ...form, maxAmount: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        <Field label="Effective From"><Input type="date" value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} /></Field>
        <Field label="Active"><div className="pt-2"><Checkbox label="Rule is active" checked={form.active} onChange={v => setForm({ ...form, active: v })} /></div></Field>
      </div>
      <Field label="Scope to Categories (optional — empty = all)" className="mt-4">
        <div className="border border-border rounded-lg max-h-32 overflow-y-auto p-2 flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button key={c.id} onClick={() => toggleCat(c.id)} type="button">
              <Pill label={c.name} tone={form.categoryIds.includes(c.id) ? 'blue' : 'gray'} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Scope to Locations (optional — empty = all)" className="mt-4">
        <div className="border border-border rounded-lg max-h-32 overflow-y-auto p-2 flex flex-wrap gap-1.5">
          {locations.map(l => (
            <button key={l.id} onClick={() => toggleLoc(l.id)} type="button">
              <Pill label={l.name} tone={form.locationIds.includes(l.id) ? 'purple' : 'gray'} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Notes" className="mt-4"><TextArea rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
      <div className="flex justify-end gap-3 pt-5">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={!form.approverTitle} onClick={() => onSave({ ...form, id: form.id || uid('doa') })}>Save Rule</PrimaryButton>
      </div>
    </Modal>
  );
};

const DelegationModal: React.FC<{ delegation: DoaDelegation; employees: { id: string; name: string }[]; onClose: () => void; onSave: (d: DoaDelegation) => void }> = ({ delegation, employees, onClose, onSave }) => {
  const [form, setForm] = useState(delegation);
  const toggleType = (t: ApprovalDocType) => setForm(f => ({ ...f, docTypes: f.docTypes.includes(t) ? f.docTypes.filter(x => x !== t) : [...f.docTypes, t] }));

  return (
    <Modal isOpen onClose={onClose} title={delegation.id ? 'Edit Delegation' : 'New Delegation'} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="From (delegating authority)"><Select value={form.fromEmployeeId} onChange={e => setForm({ ...form, fromEmployeeId: e.target.value })}>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        <Field label="To (acting approver)"><Select value={form.toEmployeeId} onChange={e => setForm({ ...form, toEmployeeId: e.target.value })}>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        <Field label="From Date"><Input type="date" value={form.fromDate} onChange={e => setForm({ ...form, fromDate: e.target.value })} /></Field>
        <Field label="To Date"><Input type="date" value={form.toDate} onChange={e => setForm({ ...form, toDate: e.target.value })} /></Field>
      </div>
      <Field label="Document Types Covered" className="mt-4">
        <div className="flex flex-wrap gap-1.5">
          {Object.values(ApprovalDocType).map(t => (
            <button key={t} onClick={() => toggleType(t)} type="button"><Pill label={t} tone={form.docTypes.includes(t) ? 'blue' : 'gray'} /></button>
          ))}
        </div>
      </Field>
      <Field label="Reason" className="mt-4"><TextArea rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></Field>
      <div className="flex justify-end gap-3 pt-5">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={form.docTypes.length === 0 || !form.reason} onClick={() => onSave({ ...form, id: form.id || uid('del') })}>Save Delegation</PrimaryButton>
      </div>
    </Modal>
  );
};

export default Doa;
