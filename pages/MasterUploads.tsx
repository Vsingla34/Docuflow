import React, { useCallback, useEffect, useState } from 'react';
import { PageKey } from '../components/layout/nav';
import { useAssetStore } from '../store/AssetStore';
import { EmployeeStatus, UserRole } from '../types';
import { Field, Select, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import { useToast } from '../components/ui/Toast';
import Icon from '../components/icons/Icon';
import { supabase } from '../lib/supabase';
import { generateTempPassword } from '../lib/format';
import { canEditModule, getCustomRole } from '../lib/permissions';

type EntityType = 'Users' | 'Locations' | 'Departments' | 'Sub Locations';

interface UploadHistory {
  id: string;
  entity_type: string;
  file_name: string;
  record_count: number;
  created_at: string;
  created_by: string;
}

const TEMPLATES: Record<EntityType, { headers: string[]; filename: string; exampleRows: string[][] }> = {
  Users: {
    headers: ['Email', 'FullName', 'Role', 'Phone', 'Designation'],
    filename: 'users_template.csv',
    exampleRows: [
      ['john.doe@example.com', 'John Doe', 'Employee', '1234567890', 'Developer'],
      ['jane.smith@example.com', 'Jane Smith', 'Admin', '0987654321', 'Manager'],
      ['bob.jones@example.com', 'Bob Jones', 'Employee', '1112223333', 'Designer'],
      ['alice.wong@example.com', 'Alice Wong', 'Employee', '4445556666', 'Analyst'],
      ['charlie.brown@example.com', 'Charlie Brown', 'Management', '7778889999', 'Director']
    ]
  },
  Locations: {
    headers: ['Code', 'Name', 'Type', 'Address', 'City', 'State'],
    filename: 'locations_template.csv',
    exampleRows: [
      ['LOC-01', 'Main Office', 'Head Office', '123 Main St', 'New York', 'NY'],
      ['LOC-02', 'West Branch', 'Branch', '456 West Ave', 'Los Angeles', 'CA'],
      ['LOC-03', 'East Warehouse', 'Warehouse / Store', '789 East Blvd', 'Chicago', 'IL'],
      ['LOC-04', 'Plant Alpha', 'Plant', '101 Factory Rd', 'Detroit', 'MI'],
      ['LOC-05', 'Remote Staff', 'Remote / WFH', 'NA', 'NA', 'NA']
    ]
  },
  Departments: {
    headers: ['Code', 'Name', 'CostCenter'],
    filename: 'departments_template.csv',
    exampleRows: [
      ['DEPT-IT', 'Information Technology', 'CC-100'],
      ['DEPT-HR', 'Human Resources', 'CC-200'],
      ['DEPT-FIN', 'Finance', 'CC-300'],
      ['DEPT-SALES', 'Sales', 'CC-400'],
      ['DEPT-MKT', 'Marketing', 'CC-500']
    ]
  },
  'Sub Locations': {
    headers: ['Code', 'Name', 'Type', 'ParentLocationCode', 'Address', 'City', 'State'],
    filename: 'sub_locations_template.csv',
    exampleRows: [
      ['SUBLOC-01', 'Floor 1', 'Floor', 'LOC-01', '123 Main St', 'New York', 'NY'],
      ['SUBLOC-02', 'Floor 2', 'Floor', 'LOC-01', '123 Main St', 'New York', 'NY'],
      ['SUBLOC-03', 'Storage Room A', 'Room', 'LOC-03', '789 East Blvd', 'Chicago', 'IL'],
      ['SUBLOC-04', 'Server Room', 'Room', 'LOC-01', '123 Main St', 'New York', 'NY'],
      ['SUBLOC-05', 'Loading Dock', 'Dock', 'LOC-03', '789 East Blvd', 'Chicago', 'IL']
    ]
  },
};

const MasterUploads: React.FC<{ onNavigate: (page: PageKey) => void }> = () => {
  const { currentUser, currentCompany, saveEmployee, saveLocation, saveDepartment, state } = useAssetStore();
  const showToast = useToast();
  const customRole = getCustomRole(currentUser, state.customRoles);

  const [entityType, setEntityType] = useState<EntityType>('Users');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [createLogins, setCreateLogins] = useState(true);
  const [history, setHistory] = useState<UploadHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  // Temporary passwords generated for this specific upload, shown once so the admin can hand
  // them to the new users — never persisted, never reused, and cleared on the next upload.
  // See AUDIT fix BUG-02: this replaces the old fixed 'Password123!' default.
  const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string; tempPassword: string }[]>([]);

  const canManage = (currentUser.role === UserRole.SUPERADMIN || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGEMENT)
    && canEditModule(customRole, 'masterUploads');

  // Saved passwords for a "Users" upload, fetched on demand when its row is expanded.
  // undefined = not fetched yet, 'loading' = fetch in flight, array = loaded (possibly empty).
  const [credentialsByUpload, setCredentialsByUpload] = useState<Record<string, { email: string; tempPassword: string }[] | 'loading'>>({});

  const toggleHistoryCredentials = useCallback(async (uploadId: string) => {
    if (credentialsByUpload[uploadId] !== undefined) {
      setCredentialsByUpload(prev => {
        const next = { ...prev };
        delete next[uploadId];
        return next;
      });
      return;
    }
    setCredentialsByUpload(prev => ({ ...prev, [uploadId]: 'loading' }));
    const { data, error } = await supabase
      .from('upload_credentials')
      .select('email, temp_password')
      .eq('upload_id', uploadId)
      .order('email');
    if (error) {
      showToast(error.message, 'error');
      setCredentialsByUpload(prev => {
        const next = { ...prev };
        delete next[uploadId];
        return next;
      });
      return;
    }
    setCredentialsByUpload(prev => ({ ...prev, [uploadId]: (data || []).map(d => ({ email: d.email, tempPassword: d.temp_password })) }));
  }, [credentialsByUpload, showToast]);

  const loadHistory = useCallback(async () => {
    if (!currentCompany) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('upload_history')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });
    if (!error && data) setHistory(data);
    setLoadingHistory(false);
  }, [currentCompany]);

  useEffect(() => {
    if (canManage) loadHistory();
  }, [canManage, loadHistory]);

  const downloadTemplate = () => {
    const { headers, filename, exampleRows } = TEMPLATES[entityType];
    const headerRow = headers.join(',') + '\n';
    const dataRows = exampleRows.map(row => row.join(',')).join('\n');
    const csv = headerRow + dataRows + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Basic parser: assumes no commas inside values for simplicity
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || '';
      });
      return obj;
    });
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setGeneratedCredentials([]);
    const newCredentials: { email: string; tempPassword: string }[] = [];
    try {
      const text = await file.text();
      const records = parseCSV(text);
      if (records.length === 0) throw new Error("No data found in the file.");

      // 1. Create history record
      const { data: historyRow, error: hError } = await supabase
        .from('upload_history')
        .insert({
          entity_type: entityType,
          file_name: file.name,
          record_count: records.length,
          created_by: currentUser.id,
          company_id: currentCompany?.id
        })
        .select()
        .single();

      if (hError || !historyRow) throw new Error(hError?.message || "Failed to create history record");

      const uploadId = historyRow.id;

      // 2. Insert records based on entity type
      if (entityType === 'Departments') {
        const payload = records.map(r => ({
          code: r.Code, name: r.Name, cost_center: r.CostCenter, upload_id: uploadId, company_id: currentCompany?.id
        }));
        const { data, error } = await supabase.from('departments').insert(payload).select();
        if (error) throw error;
        if (data) {
          data.forEach(d => saveDepartment({
            id: d.id,
            code: d.code,
            name: d.name,
            costCenter: d.cost_center || ''
          }));
        }
      }
      else if (entityType === 'Locations') {
        const payload = records.map(r => ({
          code: r.Code, name: r.Name, type: r.Type, address: r.Address, city: r.City, state: r.State, upload_id: uploadId, company_id: currentCompany?.id
        }));
        const { data, error } = await supabase.from('locations').insert(payload).select();
        if (error) throw error;
        if (data) {
          data.forEach(d => saveLocation({
            id: d.id,
            code: d.code,
            name: d.name,
            type: d.type as any,
            address: d.address,
            city: d.city,
            state: d.state
          }));
        }
      }
      else if (entityType === 'Sub Locations') {
        // Need to resolve parent_id from ParentLocationCode
        const { data: parents, error: pErr } = await supabase.from('locations').select('id, code').eq('company_id', currentCompany?.id);
        if (pErr) throw pErr;
        const parentMap = new Map(parents.map(p => [p.code.trim().toLowerCase(), p.id]));

        const payload = records.map(r => {
          const rawParentCode = (r.ParentLocationCode || '').trim().toLowerCase();
          const parent_id = parentMap.get(rawParentCode);
          if (!parent_id) {
            const availableCodes = Array.from(parentMap.keys()).join(', ');
            throw new Error(`Parent location code "${r.ParentLocationCode}" not found for ${r.Code}. Fetched ${parents?.length || 0} locations from DB. Available parent codes in DB: [${availableCodes}]. Please ensure the parent location is already uploaded and you ran fix_rls.sql.`);
          }
          return {
            code: r.Code, name: r.Name, type: r.Type, address: r.Address, city: r.City, state: r.State, parent_id, upload_id: uploadId, company_id: currentCompany?.id
          };
        });
        const { data, error } = await supabase.from('locations').insert(payload).select();
        if (error) throw error;
        if (data) {
          data.forEach(d => saveLocation({
            id: d.id,
            code: d.code,
            name: d.name,
            type: d.type as any,
            parentId: d.parent_id,
            address: d.address,
            city: d.city,
            state: d.state
          }));
        }
      }
      else if (entityType === 'Users') {
        // A random 4-digit suffix alone (~1 in 9000 per row) collides often enough in a batch of
        // any real size; mixing in the row's position within THIS upload makes every code in the
        // batch distinct from every other row in it, even if two random suffixes happen to match.
        let rowIndex = 0;
        for (const r of records) {
          rowIndex += 1;
          if (createLogins) {
            // A fresh, random password per user — never the same value twice, never a fixed
            // string. public.profiles.must_change_password defaults to true (see
            // supabase/12_force_password_reset.sql), so this value is only ever valid for the
            // account's very first sign-in; the app then forces a real password to be set.
            const tempPassword = generateTempPassword();
            const { error: rpcError } = await supabase.rpc('create_app_user', {
              p_email: r.Email,
              p_password: tempPassword,
              p_full_name: r.FullName,
              p_role: r.Role || 'Employee',
              p_phone: r.Phone || null,
              p_designation: r.Designation || null,
              p_company_id: currentCompany?.id ?? null,
            });
            if (rpcError) throw rpcError;

            await supabase.from('profiles').update({ upload_id: uploadId }).eq('email', r.Email.toLowerCase());
            newCredentials.push({ email: r.Email, tempPassword });
          }

          // Add to local employees state for display in Employees table
          const empResult = await saveEmployee({
            id: crypto.randomUUID(),
            code: `EMP-${Date.now().toString().slice(-6)}${rowIndex}`, // Unique within this upload batch
            name: r.FullName,
            email: r.Email,
            phone: r.Phone || undefined,
            designation: r.Designation || 'Employee',
            grade: 'L1', // Default grade
            departmentId: state.departments[0]?.id || '', // Default to first available dept
            locationId: state.locations[0]?.id || '', // Default to first available location
            role: (r.Role as UserRole) || UserRole.EMPLOYEE,
            status: EmployeeStatus.Active,
            joinedOn: new Date().toISOString().split('T')[0]
          });
          if (!empResult.ok) throw new Error(empResult.error || `Could not save employee record for ${r.FullName}.`);
        }
      }

      if (newCredentials.length > 0) {
        // Persist the generated temp passwords against this upload so they can be pulled back up
        // from Upload History later — previously they only ever lived in `generatedCredentials`
        // component state, so navigating away (or a page refresh) lost them for good with no way
        // to hand them to the affected users short of resetting every password again.
        const { error: credError } = await supabase.from('upload_credentials').insert(
          newCredentials.map(c => ({ upload_id: uploadId, email: c.email, temp_password: c.tempPassword })),
        );
        if (credError) {
          console.error('Failed to save generated passwords to upload history', credError);
          showToast(`Users created, but the passwords below could not be saved to history: ${credError.message}`, 'error');
        }
      }

      showToast(`Successfully uploaded ${records.length} ${entityType}.`);
      setFile(null);
      if (newCredentials.length > 0) setGeneratedCredentials(newCredentials);
      loadHistory();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteHistory = async (id: string, entityType: string) => {
    const isUsersUpload = entityType === 'Users';
    if (!confirm(
      isUsersUpload
        ? 'Are you sure? This will delete the uploaded file record AND the login accounts (auth) it created for every user in this upload. This cannot be undone.'
        : 'Are you sure? This will delete the uploaded file record AND cascade delete all associated master data.'
    )) return;

    // Delegates to a SECURITY DEFINER RPC (see supabase/delete_upload_history.sql) instead of
    // deleting the row directly. A raw `.delete()` here could silently affect 0 rows if RLS
    // didn't allow it (no error raised), and it never touched auth.users at all — profiles
    // cascaded off upload_history, but the actual login account in Supabase Auth was left
    // behind forever. The RPC deletes auth.users first (which cascades to profiles/
    // user_companies), then the upload_history row itself, and raises a real error on any
    // failure instead of failing silently.
    const { error } = await supabase.rpc('delete_upload_history', { p_upload_id: id });
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(isUsersUpload ? 'Upload, its master data, and the login accounts it created were deleted.' : 'Upload history and associated data deleted.');
      loadHistory();
      setCredentialsByUpload(prev => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  if (!canManage) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
          <Icon name="shield" className="w-7 h-7 text-red-500" />
        </div>
        <p className="font-semibold text-text-main">Access Restricted</p>
        <p className="text-sm text-text-light mt-1">You do not have permission to upload master data.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-card rounded-2xl shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-text-main">Data Master Uploads</h2>
          <p className="text-sm text-text-light">Upload bulk data for master entities using CSV files.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Field label="Entity Type">
              <Select value={entityType} onChange={e => setEntityType(e.target.value as EntityType)}>
                {(Object.keys(TEMPLATES) as EntityType[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>

            <div>
              <p className="text-sm font-medium text-text-main mb-2">Step 1: Download Template</p>
              <SecondaryButton onClick={downloadTemplate} icon={<Icon name="download" className="w-4 h-4" />}>
                Download {entityType} CSV Template
              </SecondaryButton>
            </div>

            <div>
              <p className="text-sm font-medium text-text-main mb-2">Step 2: Upload Data</p>
              <input
                type="file"
                accept=".csv"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-primary
                  hover:file:bg-indigo-100 cursor-pointer border border-border rounded-lg p-1"
              />
            </div>

            {entityType === 'Users' && (
              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded focus:ring-primary border-border"
                    checked={createLogins}
                    onChange={e => setCreateLogins(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-text-main">Create Login Accounts</span>
                </label>

                {createLogins && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                    <Icon name="info" className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">
                      Each user will be created with a unique, randomly generated temporary password, shown to you once after the upload completes. They must set their own password before they can use the app.
                    </p>
                  </div>
                )}
              </div>
            )}

            <PrimaryButton
              onClick={handleUpload}
              disabled={!file || uploading}
              icon={<Icon name="arrowLeft" className="w-4 h-4 rotate-90" />} // Using an upload-like icon temporarily
            >
              {uploading ? 'Uploading...' : 'Upload CSV'}
            </PrimaryButton>

            {generatedCredentials.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <Icon name="info" className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Share these temporary passwords now — they will not be shown again.</p>
                    <p className="text-xs text-red-700 mt-1">Send each one to its user over a secure, 1:1 channel (not this screen, not a shared chat). Every account must set its own password on first login before it can be used.</p>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-red-700">
                        <th className="pb-1 pr-4 font-medium">Email</th>
                        <th className="pb-1 font-medium">Temporary password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedCredentials.map(c => (
                        <tr key={c.email} className="border-t border-red-200">
                          <td className="py-1 pr-4 text-red-900">{c.email}</td>
                          <td className="py-1 font-mono text-red-900">{c.tempPassword}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <SecondaryButton onClick={() => setGeneratedCredentials([])}>I've saved these — dismiss</SecondaryButton>
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-border">
            <h3 className="font-semibold text-text-main mb-2">Instructions & Notes</h3>
            <ul className="text-sm text-text-light space-y-2 list-disc pl-4">
              <li>Ensure your CSV columns strictly match the downloaded template.</li>
              <li>Do not include commas inside the column values (e.g. use "New York" instead of "New York, NY").</li>
              <li>For <strong>Users</strong>: If <em>"Create Login Accounts"</em> is checked, each user gets a unique, randomly generated temporary password shown to you once after upload, and must set their own password on first login. If unchecked, they will only be listed in the Employees table.</li>
              <li>For <strong>Sub Locations</strong>, ensure the <code>ParentLocationCode</code> exists in the Locations master first.</li>
              <li>Deleting an upload from history will automatically remove all associated records.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm p-6 flex flex-col">
        <h2 className="text-lg font-semibold text-text-main mb-4">Upload History</h2>

        <div className="flex-1 overflow-y-auto">
          {loadingHistory ? (
            <div className="space-y-2">
              {[0, 1].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="history" className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-text-light mt-2">No past uploads found.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {history.map(h => {
                const creds = credentialsByUpload[h.id];
                return (
                  <li key={h.id} className="rounded-xl border border-border hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-semibold text-text-main text-sm">{h.entity_type}</p>
                        <p className="text-xs text-text-light mt-0.5">
                          {h.file_name} · {h.record_count} records · {new Date(h.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {h.entity_type === 'Users' && (
                          <button
                            onClick={() => toggleHistoryCredentials(h.id)}
                            className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                            title="View saved temporary passwords from this upload"
                          >
                            <Icon name="key" className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteHistory(h.id, h.entity_type)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Upload & Associated Data"
                        >
                          <Icon name="trash" className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {creds !== undefined && (
                      <div className="px-4 pb-4">
                        {creds === 'loading' ? (
                          <p className="text-xs text-text-light">Loading passwords…</p>
                        ) : creds.length === 0 ? (
                          <p className="text-xs text-text-light">No passwords were saved for this upload (either "Create Login Accounts" was off, or this upload predates password history).</p>
                        ) : (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs text-red-700 mb-2">
                              These were each account's FIRST-login password — if someone has already signed in and set their own password, this one no longer works for them.
                            </p>
                            <div className="max-h-48 overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-red-700">
                                    <th className="pb-1 pr-4 font-medium">Email</th>
                                    <th className="pb-1 font-medium">Temporary password</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {creds.map(c => (
                                    <tr key={c.email} className="border-t border-red-200">
                                      <td className="py-1 pr-4 text-red-900">{c.email}</td>
                                      <td className="py-1 font-mono text-red-900">{c.tempPassword}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default MasterUploads;