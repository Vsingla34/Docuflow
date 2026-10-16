import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Company } from '../types';
import Icon from '../components/icons/Icon';
import { useToast } from '../components/ui/Toast';
import { useAssetStore } from '../store/AssetStore';

const CompanyManagement: React.FC = () => {
  const { currentUser } = useAssetStore();
  const showToast = useToast();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast(error.message, 'error');
    } else {
      setCompanies(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newCompanyCode) return;
    
    setCreatingLoading(true);
    try {
      // 1. Insert Company
      const { data: company, error: cErr } = await supabase
        .from('companies')
        .insert({ name: newCompanyName, code: newCompanyCode.toUpperCase() })
        .select()
        .single();
        
      if (cErr) throw cErr;

      // 2. Assign Superadmin to the new company
      const { error: ucErr } = await supabase
        .from('user_companies')
        .insert({ user_id: currentUser.id, company_id: company.id });
        
      if (ucErr) throw ucErr;

      showToast('Company created successfully', 'success');
      setIsCreating(false);
      setNewCompanyName('');
      setNewCompanyCode('');
      fetchCompanies(); // Reload list
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create company');
    } finally {
      setCreatingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Company Management</h1>
          <p className="text-sm text-text-light mt-1">Manage isolated workspaces and tenant companies.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Icon name="plus" className="w-5 h-5" />
          Create Company
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-slate-400">Loading companies...</div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No companies found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">Logo</th>
                <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">Company Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-semibold text-text-light uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map(company => (
                <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                      {company.logoUrl ? (
                        <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">{company.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-text-main">{company.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{company.code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-primary hover:text-primary/80 font-medium text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Company Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Create New Company</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCompany} className="p-6">
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
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Company Code</label>
                  <input
                    type="text"
                    required
                    value={newCompanyCode}
                    onChange={e => setNewCompanyCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all uppercase"
                    placeholder="e.g. ACME"
                    maxLength={10}
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">A short, unique identifier (letters and numbers only).</p>
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
                  disabled={creatingLoading || !newCompanyName || !newCompanyCode}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creatingLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Create Workspace'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;
