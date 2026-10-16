import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { Project, ProjectStatus, ProjectEntry } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, FilterSelect } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, PrimaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate, today } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const Projects: React.FC = () => {
  const { state, currentUser, createProject, addProjectEntry, completeProject } = useAssetStore();
  const showToast = useToast();
  const { projects = [], locations = [], categories = [], departments = [], employees = [], assets = [] } = state;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Project | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const customRole = currentUser.customRoleId ? state.customRoles?.find(r => r.id === currentUser.customRoleId) : null;
  const canEdit = customRole ? customRole.permissions.projects?.edit : true; // Default true as Projects is an OPS restricted page normally

  const filtered = statusFilter === 'all' ? projects : projects.filter(p => p.status === statusFilter);
  const selectedLive = selected ? projects.find(p => p.id === selected.id) || selected : null;

  const getManagerName = (id: string) => employees.find(e => e.id === id)?.name || id;
  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || id;

  return (
    <div>
      <ListToolbar title="Projects (CWIP)" count={filtered.length}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.values(ProjectStatus).map(s => ({ value: s, label: s }))]} />
        {canEdit && <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setNewOpen(true)}>New Project</PrimaryButton>}
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="hammer" title="No projects found" /> : (
        <TableCard>
          <THead columns={['Project No.', 'Title', 'Location', 'Budget', 'Spent', 'Progress', 'Status', '']} />
          <tbody>
            {filtered.map(p => {
              const pct = p.budget > 0 ? Math.min(100, Math.round((p.totalSpent / p.budget) * 100)) : 0;
              return (
                <Tr key={p.id} onClick={() => setSelected(p)}>
                  <Td className="font-mono text-xs">{p.projectNo}</Td>
                  <Td className="font-semibold">{p.title}</Td>
                  <Td>{getLocationName(p.locationId)}</Td>
                  <Td>{formatCurrency(p.budget)}</Td>
                  <Td>{formatCurrency(p.totalSpent)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${pct > 100 ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-xs text-text-light w-8 text-right">{pct}%</span>
                    </div>
                  </Td>
                  <Td><StatusBadge status={p.status as any} /></Td>
                  <Td><button className="text-primary text-sm font-semibold">View</button></Td>
                </Tr>
              );
            })}
          </tbody>
        </TableCard>
      )}

      <Drawer isOpen={!!selectedLive} onClose={() => setSelected(null)} title={selectedLive?.title || ''} subtitle={selectedLive?.projectNo}>
        {selectedLive && (
          <>
            <StatusBadge status={selectedLive.status as any} />
            <p className="text-sm text-text-light mt-2">{selectedLive.description}</p>
            
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-4">
              <dt className="text-text-light">Manager</dt><dd className="text-right font-medium">{getManagerName(selectedLive.managerId)}</dd>
              <dt className="text-text-light">Location</dt><dd className="text-right font-medium">{getLocationName(selectedLive.locationId)}</dd>
              <dt className="text-text-light">Start Date</dt><dd className="text-right font-medium">{formatDate(selectedLive.startDate)}</dd>
              {selectedLive.endDate && <><dt className="text-text-light">Target End Date</dt><dd className="text-right font-medium">{formatDate(selectedLive.endDate)}</dd></>}
              <dt className="text-text-light">Budget</dt><dd className="text-right font-medium text-emerald-600">{formatCurrency(selectedLive.budget)}</dd>
              <dt className="text-text-light">Total Spent</dt><dd className={`text-right font-medium ${selectedLive.totalSpent > selectedLive.budget ? 'text-red-600' : 'text-primary'}`}>{formatCurrency(selectedLive.totalSpent)}</dd>
            </dl>

            <section className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Expenditure Entries</h3>
                {canEdit && (selectedLive.status === ProjectStatus.Draft || selectedLive.status === ProjectStatus.InProgress) && (
                  <button className="text-xs text-primary font-medium hover:underline flex items-center gap-1" onClick={() => setEntryOpen(true)}>
                    <Icon name="plus" className="w-3 h-3" /> Add Entry
                  </button>
                )}
              </div>
              {selectedLive.entries.length === 0 ? (
                <p className="text-sm text-text-light italic">No expenses recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedLive.entries.map(e => (
                    <div key={e.id} className="border border-border rounded-lg p-3 text-sm flex justify-between items-center bg-slate-50">
                      <div>
                        <p className="font-medium">{e.description}</p>
                        <p className="text-xs text-text-light">{formatDate(e.date)} · by {e.recordedBy}</p>
                      </div>
                      <span className="font-semibold">{formatCurrency(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {canEdit && (selectedLive.status === ProjectStatus.Draft || selectedLive.status === ProjectStatus.InProgress) && (
              <div className="mt-8 pt-4 border-t border-border flex justify-end gap-3">
                <PrimaryButton icon={<Icon name="check" className="w-4 h-4" />} onClick={() => setCompleteOpen(true)}>Complete & Capitalise</PrimaryButton>
              </div>
            )}

            {selectedLive.status === ProjectStatus.Completed && selectedLive.resultAssetId && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-800">
                <p className="font-semibold mb-1 flex items-center gap-2"><Icon name="checkCircle" className="w-4 h-4" /> Capitalised to Asset Register</p>
                <p>Asset Tag: <span className="font-mono font-medium">{assets.find(a => a.id === selectedLive.resultAssetId)?.assetTag}</span></p>
                <p>Capitalised On: <span className="font-medium">{formatDate(selectedLive.completedOn || '')}</span></p>
              </div>
            )}
          </>
        )}
      </Drawer>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="New Project (CWIP)">
        <NewProjectForm
          locations={locations}
          employees={employees}
          onSubmit={draft => { createProject(draft); showToast('Project created.', 'success'); setNewOpen(false); }}
        />
      </Modal>

      {selectedLive && (
        <Modal isOpen={entryOpen} onClose={() => setEntryOpen(false)} title="Add Expenditure">
          <ProjectEntryForm onSubmit={(entry) => { addProjectEntry(selectedLive.id, entry); showToast('Expense added.', 'success'); setEntryOpen(false); }} />
        </Modal>
      )}

      {selectedLive && (
        <Modal isOpen={completeOpen} onClose={() => setCompleteOpen(false)} title="Complete & Capitalise">
          <CompleteProjectForm
            categories={categories}
            departments={departments}
            locations={locations}
            defaultLocationId={selectedLive.locationId}
            totalCost={selectedLive.totalSpent}
            onSubmit={(categoryId, variantId, locationId, departmentId) => { 
              completeProject(selectedLive.id, categoryId, variantId, locationId, departmentId); 
              showToast('Project capitalised as new Asset.', 'success'); 
              setCompleteOpen(false); 
            }}
          />
        </Modal>
      )}
    </div>
  );
};

const NewProjectForm: React.FC<{
  locations: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  onSubmit: (draft: Omit<Project, 'id' | 'projectNo' | 'status' | 'totalSpent' | 'entries' | 'createdOn'>) => void;
}> = ({ locations, employees, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState(0);
  const [managerId, setManagerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');

  return (
    <div className="space-y-4">
      <Field label="Project Title" required><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Description"><TextArea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></Field>
      
      <div className="grid grid-cols-2 gap-4">
        <Field label="Budget" required><Input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} min={0} /></Field>
        <Field label="Manager" required>
          <Select value={managerId} onChange={e => setManagerId(e.target.value)}>
            <option value="">Select Manager</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Location" required>
        <Select value={locationId} onChange={e => setLocationId(e.target.value)}>
          <option value="">Select Location</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date" required><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
        <Field label="Target End Date"><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
      </div>

      <div className="flex justify-end pt-4">
        <PrimaryButton
          disabled={!title || !budget || !managerId || !locationId || !startDate}
          onClick={() => onSubmit({ title, description, budget, managerId, locationId, startDate, endDate: endDate || undefined })}
        >
          Create Project
        </PrimaryButton>
      </div>
    </div>
  );
};

const ProjectEntryForm: React.FC<{ onSubmit: (entry: Omit<ProjectEntry, 'id' | 'recordedBy'>) => void }> = ({ onSubmit }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());

  return (
    <div className="space-y-4">
      <Field label="Date" required><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Description / Particulars" required><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Cabin woodwork" /></Field>
      <Field label="Amount Spent" required><Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} min={0} /></Field>
      <div className="flex justify-end pt-4">
        <PrimaryButton disabled={!description || amount <= 0 || !date} onClick={() => onSubmit({ description, amount, date })}>
          Record Expense
        </PrimaryButton>
      </div>
    </div>
  );
};

const CompleteProjectForm: React.FC<{
  categories: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  defaultLocationId: string;
  totalCost: number;
  onSubmit: (categoryId: string, variantId: string | undefined, locationId: string, departmentId: string) => void;
}> = ({ categories, departments, locations, defaultLocationId, totalCost, onSubmit }) => {
  const [categoryId, setCategoryId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [locationId, setLocationId] = useState(defaultLocationId);

  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-50 border border-border rounded-lg text-sm mb-4">
        <p className="text-text-light mb-1">Total Capitalised Value</p>
        <p className="text-lg font-semibold">{formatCurrency(totalCost)}</p>
      </div>

      <Field label="Asset Category" required>
        <Select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">Select Category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>

      <Field label="Department" required>
        <Select value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
          <option value="">Select Department</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </Field>

      <Field label="Asset Location" required>
        <Select value={locationId} onChange={e => setLocationId(e.target.value)}>
          <option value="">Select Location</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      </Field>

      <div className="flex justify-end pt-4">
        <PrimaryButton disabled={!categoryId || !departmentId || !locationId} onClick={() => onSubmit(categoryId, undefined, locationId, departmentId)}>
          Capitalise Asset
        </PrimaryButton>
      </div>
    </div>
  );
};

export default Projects;
