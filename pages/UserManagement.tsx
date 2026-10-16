import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageKey } from '../components/layout/nav';
import { useAssetStore } from '../store/AssetStore';
import { UserRole } from '../types';
import Icon from '../components/icons/Icon';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  designation: string | null;
  is_active: boolean;
  created_at: string;
  customRoleId?: string;
  companies?: { id: string; name: string }[];
  employeeCode?: string;
}

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  designation: '',
  role: UserRole.EMPLOYEE as UserRole,
  customRoleId: '',
  password: '',
  confirmPassword: '',
};

const passwordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Too weak', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-red-400' },
    { label: 'Fair', color: 'bg-amber-400' },
    { label: 'Good', color: 'bg-lime-500' },
    { label: 'Strong', color: 'bg-emerald-500' },
    { label: 'Very strong', color: 'bg-emerald-600' },
  ];
  return { score, ...levels[Math.min(score, 5)] };
};

const generatePassword = () => {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const rand = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  };
  const chars = sets.map(s => s[rand(s.length)]);
  while (chars.length < 14) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const UserManagement: React.FC<{ onNavigate: (page: PageKey) => void }> = () => {
  const { state, currentUser, currentCompany } = useAssetStore();
  const showToast = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'All'>('All');
  const [companyFilter, setCompanyFilter] = useState<string>('All');
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);

  // Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', designation: '', role: UserRole.EMPLOYEE as UserRole, customRoleId: '', companyIds: [] as string[], employeeCode: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Saved-password lookup — the password an account was created or reset with is persisted
  // to user_credentials (see supabase/13_persist_created_user_passwords.sql) specifically so
  // it isn't lost forever once the Create User modal closes. Toggled open per-row, same pattern
  // as MasterUploads' Upload History credential viewer.
  const [credentialsByUser, setCredentialsByUser] = useState<Record<string, { email: string; tempPassword: string; setBy: string; createdAt: string }[] | 'loading'>>({});

  // Reset Password modal state — lets a Superadmin set (and immediately see) a brand new
  // password for any user, which is the only way back in if the original was never saved
  // (e.g. it was created before this feature existed) or was simply lost.
  const [resettingUser, setResettingUser] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const isSuperadmin = currentUser.role === UserRole.SUPERADMIN;

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);

    if (currentCompany) {
      const { data: ucData } = await supabase
        .from('user_companies')
        .select('user_id, custom_role_id')
        .eq('company_id', currentCompany.id);

      const userIds = (ucData || []).map(uc => uc.user_id);
      const roleMap = new Map((ucData || []).map(uc => [uc.user_id, uc.custom_role_id]));

      if (userIds.length > 0) {
        const [{ data, error: err }, { data: empData }] = await Promise.all([
          supabase.from('profiles').select('id, email, full_name, role, phone, designation, is_active, created_at').in('id', userIds).order('created_at', { ascending: false }),
          supabase.from('employees').select('email, code').eq('company_id', currentCompany.id)
        ]);

        if (!err && data) {
          const empMap = new Map((empData || []).filter(e => e.email).map(e => [e.email.toLowerCase(), e.code]));
          setUsers((data as Profile[]).map(u => ({
            ...u,
            customRoleId: roleMap.get(u.id) || undefined,
            companies: [{ id: currentCompany.id, name: currentCompany.name }],
            employeeCode: empMap.get(u.email.toLowerCase())
          })));
        } else setUsers([]);
      } else {
        setUsers([]);
      }
    } else if (isSuperadmin) {
      // Global user management
      const [{ data, error: err }, { data: ucData }, { data: empData }, { data: compData }] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, role, phone, designation, is_active, created_at').order('created_at', { ascending: false }),
        supabase.from('user_companies').select('user_id, companies(id, name)'),
        supabase.from('employees').select('email, code'),
        supabase.from('companies').select('id, name').order('name')
      ]);

      if (compData) setAllCompanies(compData);

      if (!err && data) {
        const compMap = new Map<string, { id: string; name: string }[]>();
        if (ucData) {
          ucData.forEach(uc => {
            if (uc.companies) {
              const list = compMap.get(uc.user_id) || [];
              list.push(uc.companies as any);
              compMap.set(uc.user_id, list);
            }
          });
        }

        const empMap = new Map<string, string>();
        if (empData) {
          empData.forEach(e => {
            if (e.email && e.code) empMap.set(e.email.toLowerCase(), e.code);
          });
        }

        setUsers((data as Profile[]).map(u => ({
          ...u,
          companies: compMap.get(u.id) || [],
          employeeCode: empMap.get(u.email.toLowerCase())
        })));
      } else {
        setUsers([]);
      }
    } else {
      setUsers([]);
    }

    setLoadingUsers(false);
  }, [currentCompany, isSuperadmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleFilter !== 'All') {
      result = result.filter(u => u.role === roleFilter);
    }
    if (companyFilter !== 'All') {
      result = result.filter(u => u.companies?.some(c => c.id === companyFilter));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(u =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.employeeCode && u.employeeCode.toLowerCase().includes(q))
      );
    }
    return result;
  }, [users, search, roleFilter, companyFilter]);

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) => setForm(f => ({ ...f, [k]: v }));
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;
  const canSubmit = form.fullName.trim() && emailValid && form.password.length >= 8 && passwordsMatch && !submitting;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    if (!currentCompany) {
      setSubmitting(false);
      setError('Select a company workspace before creating users.');
      return;
    }

    // The RPC creates the login AND links it to this company in one transaction.
    const { error: rpcError } = await supabase.rpc('create_app_user', {
      p_email: form.email.trim(),
      p_password: form.password,
      p_full_name: form.fullName.trim(),
      p_role: form.role,
      p_phone: form.phone.trim() || null,
      p_designation: form.designation.trim() || null,
      p_company_id: currentCompany.id,
      p_custom_role_id: form.customRoleId || null,
    });

    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }

    setSubmitting(false);

    showToast(`User ${form.fullName.trim()} created securely.`);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setIsCreating(false);
    loadUsers();
  };

  const toggleActive = async (u: Profile) => {
    const { error: err } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
    if (err) {
      showToast(err.message, 'error');
      return;
    }
    setUsers(list => list.map(x => (x.id === u.id ? { ...x, is_active: !u.is_active } : x)));
    showToast(`${u.full_name} ${u.is_active ? 'deactivated' : 'activated'}`);
  };

  const openEdit = async (u: Profile) => {
    setEditingUser(u);
    setEditError(null);
    setEditForm({
      fullName: u.full_name || '',
      phone: u.phone || '',
      designation: u.designation || '',
      role: u.role,
      customRoleId: u.customRoleId || '',
      companyIds: (u.companies || []).map(c => c.id),
      employeeCode: u.employeeCode || '',
    });
    if (allCompanies.length === 0) {
      const { data } = await supabase.from('companies').select('id, name').order('name');
      if (data) setAllCompanies(data);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editForm.fullName.trim()) return;
    setEditSaving(true);
    setEditError(null);

    const isProtected = editingUser.role === UserRole.SUPERADMIN;
    const updates: Record<string, any> = {
      full_name: editForm.fullName.trim(),
      phone: editForm.phone.trim() || null,
      designation: editForm.designation.trim() || null,
    };
    if (!isProtected) updates.role = editForm.role;

    const { error: err } = await supabase.from('profiles').update(updates).eq('id', editingUser.id);
    if (err) {
      setEditSaving(false);
      setEditError(err.message);
      return;
    }

    if (!isProtected) {
      const original = (editingUser.companies || []).map(c => c.id);
      const selected = editForm.companyIds;
      const toRemove = original.filter(id => !selected.includes(id));
      const toAdd = selected.filter(id => !original.includes(id));
      const kept = selected.filter(id => original.includes(id));

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('user_companies')
          .delete()
          .eq('user_id', editingUser.id)
          .in('company_id', toRemove);
        if (delErr) {
          setEditSaving(false);
          setEditError(delErr.message);
          return;
        }
      }
      if (toAdd.length > 0) {
        const { error: insErr } = await supabase
          .from('user_companies')
          .insert(toAdd.map(id => ({
            user_id: editingUser.id,
            company_id: id,
            custom_role_id: currentCompany && id === currentCompany.id ? (editForm.customRoleId || null) : null,
          })));
        if (insErr) {
          setEditSaving(false);
          setEditError(insErr.message);
          return;
        }
      }
      // Custom roles belong to the active workspace, so only update that row
      if (currentCompany && kept.includes(currentCompany.id)) {
        const { error: ucErr } = await supabase
          .from('user_companies')
          .update({ custom_role_id: editForm.customRoleId || null })
          .eq('user_id', editingUser.id)
          .eq('company_id', currentCompany.id);
        if (ucErr) {
          setEditSaving(false);
          setEditError(ucErr.message);
          return;
        }
      }
    }

    // Employee ID lives on the employees record (matched by email)
    const newCode = editForm.employeeCode.trim();
    if (newCode !== (editingUser.employeeCode || '')) {
      if (!newCode) {
        setEditSaving(false);
        setEditError('Employee ID cannot be empty.');
        return;
      }
      const { data: updated, error: empErr } = await supabase
        .from('employees')
        .update({ code: newCode })
        .ilike('email', editingUser.email)
        .select('id');
      if (empErr) {
        setEditSaving(false);
        setEditError(empErr.message);
        return;
      }
      if (!updated || updated.length === 0) {
        setEditSaving(false);
        setEditError('No employee record found for this email, so the Employee ID could not be saved.');
        return;
      }
    }

    setEditSaving(false);
    showToast(`${editForm.fullName.trim()} updated successfully.`);
    setEditingUser(null);
    loadUsers();
  };

  const deleteUser = async (u: Profile) => {
    // NOTE: deleting a user is a global action (delete_app_user wipes the auth.users row
    // directly and isn't scoped to a company), so this must NOT require currentCompany to be
    // set. The old `if (!currentCompany) return;` guard here silently did nothing — no RPC
    // call, no error, no console output — whenever Superadmin was viewing "All Workspaces"
    // (currentCompany === null), which is exactly why the Delete button looked broken.
    if (!window.confirm(`Are you sure you want to delete ${u.full_name}?\n\nThis will completely remove their account and login access.`)) return;

    // In UserManagement, we are the Superadmin, so we call delete_app_user to completely wipe them
    const { error: rpcError } = await supabase.rpc('delete_app_user', { p_user_id: u.id });

    if (rpcError) {
      showToast(rpcError.message, 'error');
    } else {
      showToast(`${u.full_name} deleted successfully.`, 'success');
      loadUsers();
    }
  };

  const toggleUserCredentials = useCallback(async (userId: string) => {
    if (credentialsByUser[userId] !== undefined) {
      setCredentialsByUser(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }
    setCredentialsByUser(prev => ({ ...prev, [userId]: 'loading' }));
    const { data, error: err } = await supabase
      .from('user_credentials')
      .select('email, temp_password, set_by, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (err) {
      showToast(err.message, 'error');
      setCredentialsByUser(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }
    setCredentialsByUser(prev => ({
      ...prev,
      [userId]: (data || []).map(d => ({ email: d.email, tempPassword: d.temp_password, setBy: d.set_by, createdAt: d.created_at })),
    }));
  }, [credentialsByUser, showToast]);

  const openResetPassword = (u: Profile) => {
    setResettingUser(u);
    setResetPassword('');
    setResetShowPassword(false);
    setResetError(null);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || resetPassword.length < 8) return;
    setResetSubmitting(true);
    setResetError(null);

    const { error: rpcError } = await supabase.rpc('admin_reset_user_password', {
      p_user_id: resettingUser.id,
      p_new_password: resetPassword,
    });

    setResetSubmitting(false);
    if (rpcError) {
      setResetError(rpcError.message);
      return;
    }

    showToast(`Password reset for ${resettingUser.full_name}. They'll be asked to set their own on next login.`, 'success');
    // Refresh the saved-password panel if it's currently open for this user, so the new
    // password shows up immediately instead of needing a second click to see it.
    if (credentialsByUser[resettingUser.id] !== undefined) {
      setCredentialsByUser(prev => {
        const next = { ...prev };
        delete next[resettingUser.id];
        return next;
      });
    }
    setResettingUser(null);
  };

  if (!isSuperadmin) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
          <Icon name="shield" className="w-7 h-7 text-red-500" />
        </div>
        <p className="font-semibold text-text-main">Access Restricted</p>
        <p className="text-sm text-text-light mt-1">Only the Superadmin can manage system users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">User Management</h1>
          <p className="text-sm text-text-light mt-1">Manage system logins, roles, and access controls.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Icon name="userPlus" className="w-5 h-5" />
          Create User
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:max-w-md">
            <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Icon name="filter" className="w-4 h-4 text-slate-400" />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
              className="bg-white border border-slate-200 text-sm rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-slate-700"
            >
              <option value="All">All Roles</option>
              <option value={UserRole.SUPERADMIN}>Superadmin</option>
              <option value={UserRole.ADMIN}>Admin</option>
              <option value={UserRole.MANAGEMENT}>Management</option>
              <option value={UserRole.EMPLOYEE}>Employee</option>
              <option value={UserRole.AUDITOR}>Auditor</option>
            </select>
            {isSuperadmin && (
              <>
                <Icon name="building" className="w-4 h-4 text-slate-400 ml-2" />
                <select
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-sm rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-slate-700 max-w-[200px]"
                >
                  <option value="All">All Workspaces</option>
                  {allCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          {loadingUsers ? (
            <div className="p-12 flex justify-center text-slate-400">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Icon name="users" className="w-8 h-8 mx-auto mb-3 opacity-20" />
              No users found matching your filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">Workspace & ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(u => {
                  const initials = u.full_name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
                  const isSelf = u.id === currentUser.id;

                  // Tone badge
                  let badgeColor = 'bg-slate-100 text-slate-700';
                  if (u.role === UserRole.SUPERADMIN) badgeColor = 'bg-amber-100 text-amber-700';
                  if (u.role === UserRole.ADMIN) badgeColor = 'bg-indigo-100 text-indigo-700';
                  if (u.role === UserRole.EMPLOYEE) badgeColor = 'bg-emerald-100 text-emerald-700';

                  return (
                    <React.Fragment key={u.id}>
                      <tr className={`hover:bg-slate-50/50 transition-colors ${!u.is_active ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {initials || '?'}
                            </div>
                            <div>
                              <p className="font-semibold text-text-main text-sm">
                                {u.full_name} {isSelf && <span className="text-xs text-text-light ml-1">(you)</span>}
                              </p>
                              <p className="text-xs text-text-light">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${badgeColor}`}>
                            {u.role}
                          </span>
                          {u.customRoleId && (
                            <div className="mt-1">
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                {state.customRoles?.find(r => r.id === u.customRoleId)?.name || 'Custom Role'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {u.companies && u.companies.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {u.companies.map((c, i) => (
                                <span key={i} className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[150px]">
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                          {u.employeeCode && (
                            <div className="mt-1.5">
                              <span className="text-[10px] font-mono font-bold text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
                                ID: {u.employeeCode}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{u.designation || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1.5 text-xs font-medium ${u.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleUserCredentials(u.id)}
                              className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                              title="View saved passwords for this account"
                            >
                              <Icon name="key" className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEdit(u)}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                          {!isSelf && (
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <button
                                onClick={() => openResetPassword(u)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                              >
                                Reset Password
                              </button>
                              {u.role !== UserRole.SUPERADMIN && (
                                <>
                                  <button
                                    onClick={() => toggleActive(u)}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${u.is_active ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                                  >
                                    {u.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => deleteUser(u)}
                                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {credentialsByUser[u.id] !== undefined && (
                        <tr>
                          <td colSpan={6} className="px-6 pb-4">
                            {credentialsByUser[u.id] === 'loading' ? (
                              <p className="text-xs text-text-light">Loading passwords…</p>
                            ) : (credentialsByUser[u.id] as any[]).length === 0 ? (
                              <p className="text-xs text-text-light">No password is saved for this account (it was created before this feature existed — use "Reset Password" to set and save a new one).</p>
                            ) : (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-[11px] text-red-700 font-semibold mb-2">
                                  These were each FIRST-login password — if {u.full_name.split(' ')[0]} has already signed in and set their own password, the most recent one below no longer works for them.
                                </p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-red-600 text-left">
                                      <th className="pr-4 pb-1 font-semibold">Password</th>
                                      <th className="pr-4 pb-1 font-semibold">Set</th>
                                      <th className="pb-1 font-semibold">Date</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(credentialsByUser[u.id] as any[]).map((c, i) => (
                                      <tr key={i}>
                                        <td className="pr-4 py-0.5 font-mono text-red-800">{c.tempPassword}</td>
                                        <td className="pr-4 py-0.5 text-red-700">{c.setBy === 'reset' ? 'On reset' : 'At creation'}</td>
                                        <td className="py-0.5 text-red-700">{new Date(c.createdAt).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Create System User</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 overflow-y-auto">
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input type="text" required value={form.fullName} onChange={e => set('fullName', e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input type="email" required value={form.email} onChange={e => set('email', e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">System Role</label>
                    <select
                      value={form.customRoleId || form.role}
                      onChange={e => {
                        const val = e.target.value;
                        if (Object.values(UserRole).includes(val as UserRole)) {
                          set('role', val as UserRole);
                          set('customRoleId', '');
                        } else {
                          set('role', UserRole.EMPLOYEE);
                          set('customRoleId', val);
                        }
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none bg-white"
                    >
                      <optgroup label="System Roles">
                        <option value={UserRole.ADMIN}>Admin</option>
                        <option value={UserRole.EMPLOYEE}>Employee</option>
                        <option value={UserRole.MANAGEMENT}>Management</option>
                        <option value={UserRole.AUDITOR}>Auditor</option>
                      </optgroup>
                      {(state.customRoles || []).length > 0 && (
                        <optgroup label="Custom Roles">
                          {state.customRoles?.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
                    <input type="text" value={form.designation} onChange={e => set('designation', e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none" placeholder="e.g. Manager" />
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Set Password</label>
                    <button type="button" onClick={() => { const pw = generatePassword(); set('password', pw); set('confirmPassword', pw); setShowPassword(true); }} className="text-xs font-semibold text-primary hover:underline">
                      Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required minLength={8} value={form.password} onChange={e => set('password', e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <Icon name={showPassword ? 'eyeOff' : 'eye'} className="w-4 h-4" />
                    </button>
                  </div>

                  {form.password && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-slate-100'}`} />
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">{strength.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                  <input type={showPassword ? 'text' : 'password'} required value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} className={`w-full px-4 py-2 rounded-xl border outline-none ${form.confirmPassword && !passwordsMatch ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-primary'}`} />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!canSubmit} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 overflow-y-auto">
              {editError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{editError}</div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input type="text" required value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input type="email" disabled value={editingUser.email} className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
                  <input type="text" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
                  <input type="text" value={editForm.designation} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Employee ID</label>
                  <input type="text" value={editForm.employeeCode} onChange={e => setEditForm(f => ({ ...f, employeeCode: e.target.value }))} placeholder="e.g. EMP-001" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none font-mono" />
                </div>
                {editingUser.role !== UserRole.SUPERADMIN && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Companies / Workspaces <span className="normal-case font-normal text-slate-400">({editForm.companyIds.length} selected)</span>
                    </label>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                      {allCompanies.length === 0 && (
                        <p className="px-4 py-3 text-sm text-slate-400">No companies found.</p>
                      )}
                      {allCompanies.map(c => {
                        const checked = editForm.companyIds.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setEditForm(f => ({
                                ...f,
                                companyIds: checked ? f.companyIds.filter(id => id !== c.id) : [...f.companyIds, c.id],
                              }))}
                              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            {c.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {editingUser.role !== UserRole.SUPERADMIN && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">System Role</label>
                    <select
                      value={editForm.customRoleId || editForm.role}
                      onChange={e => {
                        const val = e.target.value;
                        if (Object.values(UserRole).includes(val as UserRole)) {
                          setEditForm(f => ({ ...f, role: val as UserRole, customRoleId: '' }));
                        } else {
                          setEditForm(f => ({ ...f, role: UserRole.EMPLOYEE, customRoleId: val }));
                        }
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none bg-white"
                    >
                      <optgroup label="System Roles">
                        <option value={UserRole.ADMIN}>Admin</option>
                        <option value={UserRole.EMPLOYEE}>Employee</option>
                        <option value={UserRole.MANAGEMENT}>Management</option>
                        <option value={UserRole.AUDITOR}>Auditor</option>
                      </optgroup>
                      {currentCompany && (state.customRoles || []).length > 0 && (
                        <optgroup label="Custom Roles">
                          {state.customRoles?.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}
              </div>
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving || !editForm.fullName.trim()} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Reset Password</h3>
              <button onClick={() => setResettingUser(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6">
              <p className="text-sm text-text-light mb-4">
                Set a new password for <span className="font-semibold text-text-main">{resettingUser.full_name}</span> ({resettingUser.email}).
                It'll be saved here so you can look it up again, and they'll be asked to set their own password the next time they sign in.
              </p>
              {resetError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{resetError}</div>
              )}
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">New Password</label>
                <button type="button" onClick={() => { const pw = generatePassword(); setResetPassword(pw); setResetShowPassword(true); }} className="text-xs font-semibold text-primary hover:underline">
                  Generate
                </button>
              </div>
              <div className="relative">
                <input
                  type={resetShowPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none pr-10 font-mono"
                />
                <button type="button" onClick={() => setResetShowPassword(!resetShowPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <Icon name={resetShowPassword ? 'eyeOff' : 'eye'} className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">At least 8 characters. Copy it down now — it's also saved under the key icon on this user's row.</p>

              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setResettingUser(null)} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={resetSubmitting || resetPassword.length < 8} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {resetSubmitting ? 'Saving...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;