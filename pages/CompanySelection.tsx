import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Company, UserRole } from '../types';
import Icon from '../components/icons/Icon';
import { useAssetStore } from '../store/AssetStore';
import { useToast } from '../components/ui/Toast';
import UserManagement from './UserManagement';

interface CompanySelectionProps {
  onCompanySelect: (company: Company) => void;
}

const CompanySelection: React.FC<CompanySelectionProps> = ({ onCompanySelect }) => {
  const { currentUser } = useAssetStore();
  const showToast = useToast();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Superadmin global states
  const [isCreating, setIsCreating] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDisplayId, setNewCompanyDisplayId] = useState('');
  const [newCompanyLogo, setNewCompanyLogo] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showManageCompanies, setShowManageCompanies] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [gridSearch, setGridSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    if (isCreating || editingCompany) {
      const loadUsers = async () => {
        const { data: usersData } = await supabase.from('profiles').select('*');
        const { data: ucData } = await supabase.from('user_companies').select('user_id, companies(name, display_id)');
        
        const combined = (usersData || []).map(u => ({
          ...u,
          user_companies: (ucData || []).filter((uc: any) => uc.user_id === u.id)
        }));
        
        setAllUsers(combined);
      };
      loadUsers();
    }
  }, [isCreating, editingCompany]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setNewCompanyLogo(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const formattedCompanies = (data || []).map(d => ({ id: d.id, name: d.name, code: d.code, displayId: d.display_id, logoUrl: d.logo_url }));
      
      // If a non-superadmin is only assigned to exactly 1 company, bypass selection screen
      if (formattedCompanies.length === 1 && currentUser.role !== UserRole.SUPERADMIN) {
        onCompanySelect(formattedCompanies[0]);
      } else {
        setCompanies(formattedCompanies);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName) return;

    setCreatingLoading(true);
    try {
      // Auto-generate code from name (e.g. Acme Corporation -> ACMECORPOR)
      let generatedCode = newCompanyName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
      if (!generatedCode) generatedCode = `COMP${Math.floor(Math.random() * 10000)}`;

      const { data: company, error: cErr } = await supabase
        .from('companies')
        .insert({ name: newCompanyName, code: generatedCode })
        .select()
        .single();

      if (cErr) throw cErr;

      // Always assign the creator (Superadmin) so they can manage it
      const { error: ucErr } = await supabase
        .from('user_companies')
        .insert({ user_id: currentUser.id, company_id: company.id });

      if (ucErr) throw ucErr;

      // Also assign the selected user if it's different from current user
      if (assignUserId && assignUserId !== currentUser.id) {
        await supabase.from('user_companies').insert({ user_id: assignUserId, company_id: company.id });
      }

      showToast('Workspace created successfully!');
      setIsCreating(false);
      setNewCompanyName('');
      setNewCompanyDisplayId('');
      setNewCompanyLogo('');
      setAssignUserId('');
      fetchCompanies();
    } catch (err: any) {
      showToast(err.message || 'Failed to create workspace', 'error');
    } finally {
      setCreatingLoading(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !newCompanyName) return;

    setCreatingLoading(true);
    try {
      const { error: uErr } = await supabase
        .from('companies')
        .update({ name: newCompanyName, logo_url: newCompanyLogo })
        .eq('id', editingCompany.id);

      if (uErr) throw uErr;

      // Assign user if selected
      if (assignUserId) {
         const { data: existing } = await supabase.from('user_companies').select('id').eq('user_id', assignUserId).eq('company_id', editingCompany.id);
         if (!existing || existing.length === 0) {
             await supabase.from('user_companies').insert({ user_id: assignUserId, company_id: editingCompany.id });
         }
      }

      showToast('Workspace updated successfully!');
      setEditingCompany(null);
      setNewCompanyName('');
      setNewCompanyDisplayId('');
      setNewCompanyLogo('');
      setAssignUserId('');
      fetchCompanies();
    } catch (err: any) {
      showToast(err.message || 'Failed to update workspace', 'error');
    } finally {
      setCreatingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-400">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="tracking-wide">Loading workspace...</p>
      </div>
    );
  }

  const isSuperadmin = currentUser.role === UserRole.SUPERADMIN;

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Global Superadmin Toolbar */}
      {isSuperadmin && (
        <div className="absolute top-6 right-6 flex gap-3 z-20">
          <button onClick={() => setShowManageCompanies(true)} className="px-4 py-2 bg-white border border-primary/20 text-slate-700 font-semibold text-sm rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Icon name="building" className="w-4 h-4" />
            Manage Companies
          </button>
          <button onClick={() => setShowUsers(true)} className="px-4 py-2 bg-white border border-primary/20 text-slate-700 font-semibold text-sm rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Icon name="users" className="w-4 h-4" />
            Global Users
          </button>
          <button onClick={() => setIsCreating(true)} className="px-4 py-2 bg-white border border-primary/20 text-primary font-semibold text-sm rounded-lg shadow-sm hover:bg-primary/5 transition-colors flex items-center gap-2">
            <Icon name="plus" className="w-4 h-4" />
            New Workspace
          </button>
        </div>
      )}

      <div className="relative z-10 w-full max-w-5xl p-6 flex flex-col items-center">

        <div className="mb-10 text-center animate-fade-in-up w-full max-w-2xl">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20">
            <Icon name="building" className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">{currentUser?.name?.split(' ')[0] || 'User'}</span>!
          </h1>
          <p className="text-slate-500 text-lg">
            Choose the workspace you want to manage or monitor today.
          </p>

          <div className="mt-8 relative max-w-md mx-auto">
            <Icon name="search" className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search workspaces by name or ID..."
              value={gridSearch}
              onChange={e => setGridSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-sm bg-white/60 backdrop-blur-md text-slate-700 font-medium"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl shadow-sm border border-red-200 mb-8 w-full max-w-2xl text-center">
            {error}
          </div>
        )}

        <div className="grid gap-5 w-full sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 max-w-6xl">
          {companies
            .filter(c => c.name.toLowerCase().includes(gridSearch.toLowerCase()) || (c.displayId || '').toLowerCase().includes(gridSearch.toLowerCase()))
            .map((c, idx) => (
              <div key={c.id} className="relative group" style={{ animationDelay: `${idx * 100}ms` }}>
                <button
                  onClick={() => onCompanySelect(c)}
                  className="w-full h-full relative bg-white text-left p-5 rounded-xl shadow-sm border border-slate-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/5 transition-all duration-300 overflow-hidden">
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-slate-400 group-hover:text-primary transition-colors">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-primary transition-colors line-clamp-1 w-full mb-1">{c.name}</h3>
                  {c.displayId && (
                    <p className="text-[11px] text-slate-500 font-semibold mb-1.5">
                      ID: {c.displayId}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase bg-slate-100 px-2 py-0.5 rounded-full">
                    {c.code}
                  </p>
                </button>

                {isSuperadmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCompany(c);
                      setNewCompanyName(c.name);
                      setNewCompanyDisplayId(c.displayId || '');
                      setNewCompanyLogo(c.logoUrl || '');
                    }}
                    className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-slate-200/80 text-slate-400 hover:text-primary hover:bg-white hover:border-primary/30 opacity-0 group-hover:opacity-100 transition-all z-10 hover:scale-110"
                    title="Edit Workspace"
                  >
                    <Icon name="pencil" className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
        </div>

        <div className="mt-16">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Icon name="arrowLeft" className="w-4 h-4" />
            Sign out of AssetFlow
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Create Workspace</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Company Name</label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={e => setNewCompanyName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="e.g. Acme Corporation"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">Company code will be automatically generated.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Assign User (Optional)</label>
                  <div className="relative mb-2">
                    <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm bg-slate-50"
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-inner">
                    <div 
                      onClick={() => setAssignUserId('')}
                      className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${!assignUserId ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                    >
                      <span className={`text-sm font-semibold ${!assignUserId ? 'text-primary' : 'text-slate-600'}`}>-- No user assigned --</span>
                      {!assignUserId && <Icon name="check" className="w-4 h-4 text-primary" />}
                    </div>
                    {allUsers
                      .filter(u => {
                        const term = userSearch.toLowerCase();
                        const userMatch = u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term) || u.role?.toLowerCase().includes(term);
                        const compMatch = u.user_companies?.some((uc: any) => uc.companies?.name?.toLowerCase().includes(term) || uc.companies?.display_id?.toLowerCase().includes(term));
                        return userMatch || compMatch;
                      })
                      .map(u => (
                        <div
                          key={u.id}
                          onClick={() => setAssignUserId(u.id)}
                          className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${assignUserId === u.id ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                        >
                          <div>
                            <p className={`text-sm font-semibold ${assignUserId === u.id ? 'text-primary' : 'text-slate-700'}`}>{u.full_name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                          {assignUserId === u.id && <Icon name="check" className="w-4 h-4 text-primary" />}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingLoading || !newCompanyName}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creatingLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Edit Workspace</h3>
              <button onClick={() => setEditingCompany(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="p-6 overflow-y-auto">
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Workspace Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                      {newCompanyLogo ? (
                        <img src={newCompanyLogo} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <Icon name="image" className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="text-sm font-semibold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-primary/20"
                      >
                        Upload Image
                      </button>
                      {newCompanyLogo && (
                        <button
                          type="button"
                          onClick={() => setNewCompanyLogo('')}
                          className="text-xs text-red-500 hover:text-red-700 font-medium text-left px-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Company Name</label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={e => setNewCompanyName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Company ID</label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-medium cursor-not-allowed">
                    {editingCompany?.displayId || 'Pending...'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Assign User (Optional)</label>
                  <div className="relative mb-2">
                    <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm bg-slate-50"
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-inner">
                    <div 
                      onClick={() => setAssignUserId('')}
                      className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${!assignUserId ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                    >
                      <span className={`text-sm font-semibold ${!assignUserId ? 'text-primary' : 'text-slate-600'}`}>-- No user assigned --</span>
                      {!assignUserId && <Icon name="check" className="w-4 h-4 text-primary" />}
                    </div>
                    {allUsers
                      .filter(u => {
                        const term = userSearch.toLowerCase();
                        const userMatch = u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term) || u.role?.toLowerCase().includes(term);
                        const compMatch = u.user_companies?.some((uc: any) => uc.companies?.name?.toLowerCase().includes(term) || uc.companies?.display_id?.toLowerCase().includes(term));
                        return userMatch || compMatch;
                      })
                      .map(u => (
                        <div
                          key={u.id}
                          onClick={() => setAssignUserId(u.id)}
                          className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${assignUserId === u.id ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                        >
                          <div>
                            <p className={`text-sm font-semibold ${assignUserId === u.id ? 'text-primary' : 'text-slate-700'}`}>{u.full_name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                          {assignUserId === u.id && <Icon name="check" className="w-4 h-4 text-primary" />}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingLoading || !newCompanyName}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creatingLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUsers && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="p-6">
            <button onClick={() => setShowUsers(false)} className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
              <Icon name="arrowLeft" className="w-4 h-4" />
              Back to Workspaces
            </button>
            <UserManagement onNavigate={() => { }} />
          </div>
        </div>
      )}

      {showManageCompanies && (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto animate-fade-in">
          <div className="p-6 max-w-7xl mx-auto min-h-screen flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowManageCompanies(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors bg-white shadow-sm border border-slate-200">
                  <Icon name="arrowLeft" />
                </button>
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Manage Companies</h1>
                  <p className="text-sm text-slate-500 font-medium">Directory of all workspaces on this instance.</p>
                </div>
              </div>
              <div className="relative w-80">
                <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Workspace</th>
                    <th className="px-6 py-4 font-semibold">Company ID</th>
                    <th className="px-6 py-4 font-semibold">System Code</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies
                    .filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()) || (c.displayId || '').toLowerCase().includes(companySearch.toLowerCase()))
                    .map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                              {c.logoUrl ? (
                                <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-bold text-slate-400">{c.name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <span className="font-bold text-slate-800">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{c.displayId || '-'}</td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold font-mono">
                            {c.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setEditingCompany(c);
                              setNewCompanyName(c.name);
                              setNewCompanyDisplayId(c.displayId || '');
                              setNewCompanyLogo(c.logoUrl || '');
                              setShowManageCompanies(false); // Close overlay to show modal
                            }}
                            className="text-primary hover:text-blue-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors text-xs"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  {companies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        No companies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySelection;
