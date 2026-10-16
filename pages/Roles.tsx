import React, { useState } from 'react';
import { PageKey } from '../components/layout/nav';
import { useAssetStore } from '../store/AssetStore';
import { CustomRole, Permissions, PermissionModule } from '../types';
import { DEFAULT_PERMISSIONS } from '../lib/permissions';
import Icon from '../components/icons/Icon';
import { useToast } from '../components/ui/Toast';
import { PrimaryButton } from '../components/ui/FormControls';

// Grouped the same way the sidebar groups its pages, so "more access" maps 1:1 onto something
// the admin already recognises, instead of the old 7 broad, section-wide toggles (one of which,
// "movement", silently covered both Transfers AND Gate Passes with no way to grant just one).
const MODULE_GROUPS: { title: string; modules: { key: PermissionModule; label: string }[] }[] = [
  {
    title: 'Assets', modules: [
      { key: 'assets', label: 'Asset Register' },
      { key: 'categories', label: 'Categories & Variants' },
      { key: 'projects', label: 'Projects (CWIP)' },
    ]
  },
  {
    title: 'Procurement', modules: [
      { key: 'requisitions', label: 'Requisitions' },
      { key: 'purchaseOrders', label: 'Purchase Orders' },
      { key: 'grns', label: 'Goods Receipt (GRN)' },
    ]
  },
  {
    title: 'Movement', modules: [
      { key: 'transfers', label: 'Transfers' },
      { key: 'gatePasses', label: 'Gate Passes' },
    ]
  },
  {
    title: 'Maintenance', modules: [
      { key: 'amc', label: 'AMC Contracts' },
      { key: 'serviceTickets', label: 'Repairs & Service' },
      { key: 'replacements', label: 'Replacements' },
      { key: 'disposals', label: 'Disposal & Sale' },
    ]
  },
  {
    title: 'Governance', modules: [
      { key: 'audits', label: 'Physical Audit' },
      { key: 'doa', label: 'Delegation of Authority' },
    ]
  },
  {
    title: 'Organisation', modules: [
      { key: 'masters', label: 'Locations, Depts & Vendors' },
      { key: 'masterUploads', label: 'Data Master Uploads' },
      { key: 'activity', label: 'Activity Log' },
    ]
  },
];

const Roles: React.FC<{ onNavigate: (page: PageKey) => void }> = () => {
  const { state, saveCustomRole, deleteCustomRole } = useAssetStore();
  const showToast = useToast();

  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

  const [form, setForm] = useState<{ name: string, description: string, permissions: Permissions }>({
    name: '',
    description: '',
    permissions: DEFAULT_PERMISSIONS,
  });

  const roles = state.customRoles || [];

  const handleEdit = (role: CustomRole) => {
    setEditingRole(role);
    setForm({ name: role.name, description: role.description, permissions: role.permissions });
    setIsCreating(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;

    const newRole: CustomRole = {
      id: editingRole?.id || crypto.randomUUID(),
      name: form.name.trim(),
      description: form.description.trim(),
      permissions: form.permissions,
    };

    setSaving(true);
    const result = await saveCustomRole(newRole);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error || 'Could not save the role.');
      return;
    }
    showToast(editingRole ? 'Role updated successfully.' : 'Role created successfully.');
    setIsCreating(false);
    setEditingRole(null);
    setForm({ name: '', description: '', permissions: DEFAULT_PERMISSIONS });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role? Users assigned to this role will lose their custom access.')) return;
    const result = await deleteCustomRole(id);
    showToast(result.ok ? 'Role deleted.' : (result.error || 'Could not delete the role.'));
  };

  const togglePermission = (module: keyof Permissions, type: 'view' | 'edit') => {
    setForm(f => {
      const p = { ...f.permissions };
      p[module] = { ...p[module], [type]: !p[module][type] };
      // If edit is enabled, automatically enable view
      if (type === 'edit' && p[module].edit) {
        p[module].view = true;
      }
      // If view is disabled, automatically disable edit
      if (type === 'view' && !p[module].view) {
        p[module].edit = false;
      }
      return { ...f, permissions: p };
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Custom Roles</h1>
          <p className="text-sm text-slate-500 mt-1">Define granular access permissions for your workspace users.</p>
        </div>
        <PrimaryButton onClick={() => { setForm({ name: '', description: '', permissions: DEFAULT_PERMISSIONS }); setEditingRole(null); setIsCreating(true); }}>
          <Icon name="plus" className="w-4 h-4 mr-2" />
          Create Role
        </PrimaryButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.length === 0 && !isCreating && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
            No custom roles defined. Create one to get started.
          </div>
        )}
        {roles.map(role => (
          <div key={role.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Icon name="shield" className="w-5 h-5 text-primary" />
                  {role.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{role.description || 'No description provided'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(role)} className="p-1.5 text-slate-400 hover:text-primary transition-colors bg-slate-50 rounded">
                  <Icon name="pencil" className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(role.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded">
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {MODULE_GROUPS.flatMap(g => g.modules).map(({ key, label }) => {
                const perms = role.permissions[key];
                if (!perms || (!perms.view && !perms.edit)) return null;
                return (
                  <div key={key} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="font-semibold text-slate-600">{label}</span>
                    <div className="flex gap-3">
                      {perms.view && <span className="text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">View</span>}
                      {perms.edit && <span className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded font-medium">Edit</span>}
                    </div>
                  </div>
                );
              })}
              {Object.values(role.permissions).every(p => !p.view && !p.edit) && (
                <p className="text-xs text-slate-400 italic">No module access granted.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">{editingRole ? 'Edit Role' : 'Create Custom Role'}</h2>
              <button onClick={() => setIsCreating(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto p-6 flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Role Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder="e.g. IT Procurement Manager"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder="Brief description of this role's responsibilities"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1 border-b border-slate-100 pb-2">Access Permissions</h3>
                <p className="text-[11px] text-slate-400 mb-4">
                  Granted per page, not per section — turn on exactly the pages this role needs. "Edit" also turns on "View" (you can't edit something you can't see); turning "View" off turns "Edit" off too.
                </p>
                <div className="space-y-4">
                  {MODULE_GROUPS.map(group => (
                    <div key={group.title} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{group.title}</span>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {group.modules.map(({ key: modKey, label }) => {
                          const perms = form.permissions[modKey];
                          return (
                            <div key={modKey} className="flex items-center justify-between p-4 hover:bg-white transition-colors">
                              <span className="font-semibold text-slate-700">{label}</span>
                              <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className="relative flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      className="peer sr-only"
                                      checked={perms.view}
                                      onChange={() => togglePermission(modKey, 'view')}
                                    />
                                    <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                                      {perms.view && <Icon name="check" className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                  </div>
                                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">View</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className="relative flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      className="peer sr-only"
                                      checked={perms.edit}
                                      onChange={() => togglePermission(modKey, 'edit')}
                                    />
                                    <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white peer-checked:bg-green-600 peer-checked:border-green-600 transition-colors flex items-center justify-center">
                                      {perms.edit && <Icon name="check" className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                  </div>
                                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Edit</span>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-2.5 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <PrimaryButton type="submit" disabled={saving} className="flex-1 justify-center py-2.5">
                  {saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roles;