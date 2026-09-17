import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { AssetCondition, AuditPlan, DocStatus, VerificationLine, VerificationResult } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { Pill, StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import Icon from '../components/icons/Icon';
import { formatDate, today, uid } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const RESULT_TONE: Record<VerificationResult, 'slate' | 'green' | 'red' | 'amber'> = {
  [VerificationResult.Pending]: 'slate',
  [VerificationResult.Found]: 'green',
  [VerificationResult.NotFound]: 'red',
  [VerificationResult.LocationMismatch]: 'amber',
  [VerificationResult.CustodianMismatch]: 'amber',
  [VerificationResult.ConditionIssue]: 'amber',
};

const Audits: React.FC = () => {
  const { state, currentUser, me, createAuditPlan, recordVerification, signOffAudit } = useAssetStore();
  const showToast = useToast();
  const { auditPlans, assets, locations, departments, categories, employees } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<AuditPlan | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [signOffOpen, setSignOffOpen] = useState(false);

  const filtered = statusFilter === 'all' ? auditPlans : auditPlans.filter(p => p.status === statusFilter);
  const selectedLive = selected ? auditPlans.find(p => p.id === selected.id) || selected : null;
  const assetOf = (id: string) => assets.find(a => a.id === id);
  const foundCount = selectedLive?.lines.filter(l => l.result !== VerificationResult.Pending).length || 0;

  return (
    <div>
      <ListToolbar title="Physical Verification Audits" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(DocStatus).filter(s => auditPlans.some(p => p.status === s)).map(s => ({ value: s, label: s }))]} />
        <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New Audit Plan</PrimaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="scan" title="No audit plans" /> : (
        <TableCard>
          <THead columns={['Audit No.', 'Title', 'Scope', 'Auditor', 'Coverage', 'Status', '']} />
          <tbody>
            {filtered.map(p => (
              <Tr key={p.id} onClick={() => setSelected(p)}>
                <Td className="font-mono text-xs">{p.auditNo}</Td>
                <Td className="font-medium">{p.title}</Td>
                <Td>{p.scopeType}</Td>
                <Td>{employees.find(e => e.id === p.auditorId)?.name}</Td>
                <Td>{p.lines.filter(l => l.result !== VerificationResult.Pending).length}/{p.lines.length}</Td>
                <Td><StatusBadge status={p.status} /></Td>
                <Td><button className="text-primary text-sm font-semibold">View</button></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.auditNo || ''} subtitle={selectedLive?.title}>
        {selectedLive && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selectedLive.status} />
              <Pill label={`${foundCount}/${selectedLive.lines.length} verified`} tone={foundCount === selectedLive.lines.length ? 'green' : 'amber'} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-light">Planned Window</dt><dd className="text-right font-medium">{formatDate(selectedLive.plannedFrom)} – {formatDate(selectedLive.plannedTo)}</dd>
              <dt className="text-text-light">Auditor</dt><dd className="text-right font-medium">{employees.find(e => e.id === selectedLive.auditorId)?.name}</dd>
            </dl>
            <section>
              <h3 className="text-sm font-semibold mb-2">Assets in Scope</h3>
              <div className="space-y-2">
                {selectedLive.lines.map(line => (
                  <VerificationRow
                    key={line.assetId}
                    line={line}
                    assetLabel={`${assetOf(line.assetId)?.assetTag} · ${assetOf(line.assetId)?.name}`}
                    locations={locations}
                    employees={employees}
                    readOnly={selectedLive.status === DocStatus.SignedOff}
                    onSave={updated => recordVerification(selectedLive.id, updated)}
                  />
                ))}
              </div>
            </section>
            {selectedLive.observations && (
              <section className="rounded-lg bg-slate-50 border border-border p-3">
                <p className="text-sm font-semibold">Sign-off Observations</p>
                <p className="text-sm text-text-light mt-1">{selectedLive.observations}</p>
                <p className="text-xs text-text-light mt-2">Signed off by {selectedLive.signedOffBy} on {formatDate(selectedLive.signedOffOn)}</p>
              </section>
            )}
            {selectedLive.status !== DocStatus.SignedOff && (
              <PrimaryButton icon={<Icon name="check" className="w-4 h-4" />} onClick={() => setSignOffOpen(true)}>Sign Off Audit</PrimaryButton>
            )}
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New Audit Plan" wide>
        <NewAuditForm
          locations={locations}
          departments={departments}
          categories={categories}
          employees={employees}
          defaultAuditorId={me?.id}
          onSubmit={draft => { createAuditPlan(draft); showToast('Audit plan created with assets in scope.'); setNewOpen(false); }}
        />
      </Modal>

      {selectedLive && (
        <Modal isOpen={signOffOpen} onClose={() => setSignOffOpen(false)} title="Sign Off Audit">
          <SignOffForm
            pendingCount={selectedLive.lines.filter(l => l.result === VerificationResult.Pending).length}
            onSubmit={observations => { signOffAudit(selectedLive.id, observations); showToast('Audit signed off.'); setSignOffOpen(false); }}
          />
        </Modal>
      )}
    </div>
  );
};

const VerificationRow: React.FC<{
  line: VerificationLine;
  assetLabel: string;
  locations: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  readOnly: boolean;
  onSave: (line: VerificationLine) => void;
}> = ({ line, assetLabel, locations, employees, readOnly, onSave }) => {
  const [result, setResult] = useState(line.result);
  const [actualLocationId, setActualLocationId] = useState(line.actualLocationId || line.expectedLocationId);
  const [actualCustodianId, setActualCustodianId] = useState(line.actualCustodianId || line.expectedCustodianId || '');
  const [condition, setCondition] = useState<AssetCondition>(line.condition || AssetCondition.Good);
  const [remarks, setRemarks] = useState(line.remarks || '');
  const dirty = result !== line.result;

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{assetLabel}</p>
        <Pill label={line.result} tone={RESULT_TONE[line.result]} />
      </div>
      {!readOnly && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Select value={result} onChange={e => setResult(e.target.value as VerificationResult)}>
              {Object.values(VerificationResult).map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
            {result === VerificationResult.ConditionIssue && (
              <Select value={condition} onChange={e => setCondition(e.target.value as AssetCondition)}>{Object.values(AssetCondition).map(c => <option key={c} value={c}>{c}</option>)}</Select>
            )}
            {result === VerificationResult.LocationMismatch && (
              <Select value={actualLocationId} onChange={e => setActualLocationId(e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
            )}
            {result === VerificationResult.CustodianMismatch && (
              <Select value={actualCustodianId} onChange={e => setActualCustodianId(e.target.value)}><option value="">— None —</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
            )}
          </div>
          <Input placeholder="Remarks (optional)" value={remarks} onChange={e => setRemarks(e.target.value)} />
          {dirty && (
            <SecondaryButton
              onClick={() => onSave({ ...line, result, actualLocationId, actualCustodianId: actualCustodianId || undefined, condition, remarks: remarks || undefined })}
            >
              Save Finding
            </SecondaryButton>
          )}
        </>
      )}
    </div>
  );
};

const NewAuditForm: React.FC<{
  locations: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  defaultAuditorId?: string;
  onSubmit: (draft: Omit<AuditPlan, 'id' | 'auditNo' | 'status' | 'lines' | 'createdOn'>) => void;
}> = ({ locations, departments, categories, employees, defaultAuditorId, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [scopeType, setScopeType] = useState<AuditPlan['scopeType']>('Location');
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [plannedFrom, setPlannedFrom] = useState(today());
  const [plannedTo, setPlannedTo] = useState(today());
  const [auditorId, setAuditorId] = useState(defaultAuditorId || employees[0]?.id || '');

  const options = scopeType === 'Location' ? locations : scopeType === 'Department' ? departments : scopeType === 'Category' ? categories : [];
  const toggle = (id: string) => setScopeIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  return (
    <div className="space-y-4">
      <Field label="Title" required><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q3 Cyclical Audit - Bengaluru Branch" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Scope Type"><Select value={scopeType} onChange={e => { setScopeType(e.target.value as AuditPlan['scopeType']); setScopeIds([]); }}><option value="All">All Assets</option><option value="Location">By Location</option><option value="Department">By Department</option><option value="Category">By Category</option></Select></Field>
        <Field label="Auditor"><Select value={auditorId} onChange={e => setAuditorId(e.target.value)}>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        <Field label="Planned From"><Input type="date" value={plannedFrom} onChange={e => setPlannedFrom(e.target.value)} /></Field>
        <Field label="Planned To"><Input type="date" value={plannedTo} onChange={e => setPlannedTo(e.target.value)} /></Field>
      </div>
      {scopeType !== 'All' && (
        <Field label={`Scope (${scopeIds.length} selected)`} required>
          <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y divide-border">
            {options.map(o => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={scopeIds.includes(o.id)} onChange={() => toggle(o.id)} className="rounded border-border text-primary" />
                {o.name}
              </label>
            ))}
          </div>
        </Field>
      )}
      <div className="flex justify-end">
        <PrimaryButton disabled={!title || (scopeType !== 'All' && scopeIds.length === 0)} onClick={() => onSubmit({ title, scopeType, scopeIds, plannedFrom, plannedTo, auditorId })}>
          Create Audit Plan
        </PrimaryButton>
      </div>
    </div>
  );
};

const SignOffForm: React.FC<{ pendingCount: number; onSubmit: (observations: string) => void }> = ({ pendingCount, onSubmit }) => {
  const [observations, setObservations] = useState('');
  return (
    <div className="space-y-4">
      {pendingCount > 0 && <p className="text-sm text-amber-600">{pendingCount} asset(s) still unverified. You can still sign off, but consider completing verification first.</p>}
      <Field label="Observations" required><TextArea rows={3} value={observations} onChange={e => setObservations(e.target.value)} /></Field>
      <div className="flex justify-end"><PrimaryButton disabled={!observations} onClick={() => onSubmit(observations)}>Sign Off</PrimaryButton></div>
    </div>
  );
};

export default Audits;
