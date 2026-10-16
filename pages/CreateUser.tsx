import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageKey } from '../components/layout/nav';
import { useAssetStore } from '../store/AssetStore';
import { UserRole } from '../types';
import { Field, Input, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { useToast } from '../components/ui/Toast';
import Icon from '../components/icons/Icon';
import { supabase } from '../lib/supabase';

/** Roles a Superadmin may create. Hierarchy: Superadmin > Admin > Employee */
const CREATABLE_ROLES: { role: UserRole; title: string; description: string; accent: string }[] = [
  {
    role: UserRole.ADMIN,
    title: 'Admin',
    description: 'Manages assets, masters & day-to-day operations. Some access will be restricted.',
    accent: 'from-indigo-500 to-violet-500',
  },
  {
    role: UserRole.EMPLOYEE,
    title: 'Employee',
    description: 'Views assigned assets, raises requisitions, transfers and service requests.',
    accent: 'from-emerald-500 to-teal-500',
  },
];

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  designation: string | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  designation: '',
  role: UserRole.EMPLOYEE as UserRole,
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
  return { score, ...levels[score] };
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

const ROLE_BADGE: Record<string, string> = {
  [UserRole.SUPERADMIN]: 'bg-amber-50 text-amber-700 ring-amber-200',
  [UserRole.ADMIN]: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  [UserRole.EMPLOYEE]: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

const CreateUser: React.FC<{ onNavigate: (page: PageKey) => void }> = () => {
  const { currentUser } = useAssetStore();
  const showToast = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string; role: UserRole } | null>(null);

  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');

  const isSuperadmin = currentUser.role === UserRole.SUPERADMIN;

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, designation, is_active, created_at')
      .order('created_at', { ascending: false });
    if (!err && data) setUsers(data as Profile[]);
    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    if (isSuperadmin) loadUsers();
  }, [isSuperadmin, loadUsers]);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) => setForm(f => ({ ...f, [k]: v }));

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;
  const canSubmit = form.fullName.trim() && emailValid && form.password.length >= 8 && passwordsMatch && !submitting;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
  }, [users, search]);

  const counts = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === UserRole.ADMIN).length,
    employees: users.filter(u => u.role === UserRole.EMPLOYEE).length,
  }), [users]);

  if (!isSuperadmin) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
          <Icon name="shield" className="w-7 h-7 text-red-500" />
        </div>
        <p className="font-semibold text-text-main">Access Restricted</p>
        <p className="text-sm text-text-light mt-1">Only the Superadmin can create user accounts.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('create_app_user', {
      p_email: form.email.trim(),
      p_password: form.password,
      p_full_name: form.fullName.trim(),
      p_role: form.role,
      p_phone: form.phone.trim() || null,
      p_designation: form.designation.trim() || null,
    });

    setSubmitting(false);

    if (rpcError) {
      const msg = rpcError.message.includes('create_app_user') || rpcError.code === 'PGRST202'
        ? 'The create_app_user function was not found. Run supabase/user_management.sql in the Supabase SQL Editor first.'
        : rpcError.message;
      setError(msg);
      return;
    }

    setCreated({ email: form.email.trim().toLowerCase(), password: form.password, role: form.role });
    showToast?.(`User ${form.fullName.trim()} created as ${form.role}`);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    loadUsers();
  };

  const toggleActive = async (u: Profile) => {
    const { error: err } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
    if (err) {
      showToast(err.message, 'error');
      return;
    }
    setUsers(list => list.map(x => (x.id === u.id ? { ...x, is_active: !u.is_active } : x)));
    showToast?.(`${u.full_name} ${u.is_active ? 'deactivated' : 'activated'}`);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    showToast?.('Copied to clipboard');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-24 bottom-0 w-32 h-32 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <Icon name="userPlus" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Create User</h1>
              <p className="text-sm text-indigo-100/80">Create login accounts and assign roles. Users can sign in immediately with the password you set.</p>
            </div>
          </div>
          {/* Hierarchy */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            {['Superadmin', 'Admin', 'Employee'].map((r, i) => (
              <React.Fragment key={r}>
                <span className={`px-3 py-1.5 rounded-full ring-1 ring-white/25 ${i === 0 ? 'bg-amber-400/90 text-slate-900' : 'bg-white/10'}`}>{r}</span>
                {i < 2 && <Icon name="chevronRight" className="w-4 h-4 text-white/60" />}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-3 mt-6">
          {[
            { label: 'Total accounts', value: counts.total },
            { label: 'Admins', value: counts.admins },
            { label: 'Employees', value: counts.employees },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white/10 ring-1 ring-white/15 px-4 py-3">
              <p className="text-2xl font-bold">{loadingUsers ? '–' : s.value}</p>
              <p className="text-[11px] uppercase tracking-wide text-indigo-100/70">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 bg-card rounded-2xl shadow-sm p-6 space-y-6" autoComplete="off">
          {created && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 animate-fade-in-up">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Icon name="check" className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900 text-sm">Account created ({created.role})</p>
                    <p className="text-xs text-emerald-800/80 mt-0.5">Share these credentials securely. The password will not be shown again.</p>
                    <div className="mt-2 space-y-1 text-sm font-mono">
                      <button type="button" onClick={() => copy(created.email)} className="block hover:underline text-emerald-900">{created.email}</button>
                      <button type="button" onClick={() => copy(created.password)} className="block hover:underline text-emerald-900">{created.password}</button>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setCreated(null)} className="text-emerald-700 hover:text-emerald-900" aria-label="Dismiss">
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700">
              <Icon name="alert" className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Role */}
          <section>
            <h2 className="font-semibold text-text-main mb-1">1. Choose role</h2>
            <p className="text-xs text-text-light mb-3">Superadmin can create Admins and Employees.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {CREATABLE_ROLES.map(r => {
                const active = form.role === r.role;
                return (
                  <button
                    type="button"
                    id={`role-${r.title.toLowerCase()}`}
                    key={r.role}
                    onClick={() => set('role', r.role)}
                    className={`group text-left rounded-xl border-2 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${r.accent} text-white flex items-center justify-center`}>
                        <Icon name={r.role === UserRole.ADMIN ? 'shield' : 'users'} className="w-5 h-5" />
                      </div>
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${active ? 'border-primary bg-primary' : 'border-slate-300'}`}>
                        {active && <Icon name="check" className="w-3 h-3 text-white" />}
                      </span>
                    </div>
                    <p className="font-semibold text-text-main mt-3">{r.title}</p>
                    <p className="text-xs text-text-light mt-1 leading-relaxed">{r.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Details */}
          <section>
            <h2 className="font-semibold text-text-main mb-3">2. User details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <Input id="cu-full-name" value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="e.g. Priya Sharma" />
              </Field>
              <Field label="Email (login ID)" required hint={form.email && !emailValid ? 'Enter a valid email address' : undefined}>
                <Input id="cu-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@company.com" autoComplete="off" />
              </Field>
              <Field label="Phone">
                <Input id="cu-phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98xxxxxx" />
              </Field>
              <Field label="Designation">
                <Input id="cu-designation" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. IT Executive" />
              </Field>
            </div>
          </section>

          {/* Password */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-text-main">3. Set password</h2>
              <button
                type="button"
                id="cu-generate-password"
                onClick={() => {
                  const pw = generatePassword();
                  setForm(f => ({ ...f, password: pw, confirmPassword: pw }));
                  setShowPassword(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Icon name="spark" className="w-4 h-4" /> Generate strong password
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Password" required>
                <div className="relative">
                  <Input
                    id="cu-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name="eye" className="w-4 h-4" />
                  </button>
                </div>
              </Field>
              <Field
                label="Confirm password"
                required
                hint={form.confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
              >
                <Input
                  id="cu-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="font-mono"
                />
              </Field>
            </div>
            {form.password && (
              <div className="mt-3">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < strength.score ? strength.color : 'bg-slate-200'}`} />
                  ))}
                </div>
                <p className="text-xs text-text-light mt-1">
                  Strength: <span className="font-semibold text-text-main">{strength.label}</span>
                  {form.password.length < 8 && ' · at least 8 characters required'}
                </p>
              </div>
            )}
          </section>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <SecondaryButton type="button" onClick={() => { setForm(EMPTY_FORM); setError(null); }}>
              Clear
            </SecondaryButton>
            <PrimaryButton id="cu-submit" type="submit" disabled={!canSubmit} icon={<Icon name="userPlus" className="w-4 h-4" />}>
              {submitting ? 'Creating…' : 'Create User'}
            </PrimaryButton>
          </div>
        </form>

        {/* Users list */}
        <div className="lg:col-span-2 bg-card rounded-2xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text-main">All accounts</h2>
            <button type="button" onClick={loadUsers} className="text-xs font-semibold text-primary hover:underline">Refresh</button>
          </div>
          <div className="relative mb-3">
            <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input id="cu-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, role" className="pl-9" />
          </div>

          <div className="flex-1 overflow-y-auto -mx-2 max-h-[560px]">
            {loadingUsers ? (
              <div className="space-y-2 px-2">
                {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-10">
                <Icon name="users" className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm text-text-light mt-2">{users.length === 0 ? 'No accounts yet' : 'No matches'}</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredUsers.map(u => {
                  const initials = u.full_name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
                  const isSelf = u.id === currentUser.id;
                  return (
                    <li key={u.id} className={`flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 transition ${!u.is_active ? 'opacity-50' : ''}`}>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {initials || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-main truncate">
                          {u.full_name} {isSelf && <span className="text-xs font-normal text-text-light">(you)</span>}
                        </p>
                        <p className="text-xs text-text-light truncate">{u.email}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${ROLE_BADGE[u.role] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                        {u.role}
                      </span>
                      {u.role !== UserRole.SUPERADMIN && (
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${u.is_active ? 'left-4' : 'left-0.5'}`} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateUser;
