import React, { useEffect, useMemo, useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { DepreciationMethod, DepreciationRateRule, DepreciationRateType, NumberingRule, NumberingRules } from '../types';
import { NUMBERING_ENTITY_KINDS, NUMBERING_ENTITY_LABELS, applyNumberingRule } from '../lib/numbering';
import { ListToolbar, TableCard, THead, Tr, Td } from '../components/ui/Table';
import { Field, Input, Select, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import Icon from '../components/icons/Icon';
import { useToast } from '../components/ui/Toast';

/**
 * Settings page: admin/Superadmin-only configuration that other pages read from, rather than
 * a workflow of its own. Two sections, per the brief that created this page:
 *
 *  1. Numbering / Prefix-Suffix — a free-text prefix/suffix (and optional zero-pad width) per
 *     ID type (Asset Tag, Employee, Category, Location, Department, Vendor). Creation forms
 *     elsewhere in the app (Masters, Categories, Employees, Asset Register) read these rules
 *     via lib/numbering.ts's applyNumberingRule so the admin only types the distinguishing
 *     part of the code and the configured wrapper is applied automatically.
 *
 *  2. Depreciation Rate Master — one row per category, editable inline or bulk-loaded from an
 *     uploaded .xlsx. When present, a row here overrides whatever method/useful-life/salvage
 *     value is stored on each individual asset of that category, so the Reports page's
 *     depreciation calculation can be re-priced for a whole category with a single update
 *     instead of re-saving every asset by hand (see lib/depreciation.ts's `overrides` param).
 */
const Settings: React.FC = () => {
  const [tab, setTab] = useState<'numbering' | 'depreciation'>('numbering');
  return (
    <div>
      <div className="flex gap-1 mb-5 bg-slate-200/60 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('numbering')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${tab === 'numbering' ? 'bg-white shadow-sm text-primary' : 'text-text-light'}`}>Numbering & Prefix/Suffix</button>
        <button onClick={() => setTab('depreciation')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${tab === 'depreciation' ? 'bg-white shadow-sm text-primary' : 'text-text-light'}`}>Depreciation Rate Master</button>
      </div>
      {tab === 'numbering' ? <NumberingSection /> : <DepreciationRateSection />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Numbering / Prefix-Suffix section
// ---------------------------------------------------------------------------

const NumberingSection: React.FC = () => {
  const { state, saveNumberingRules } = useAssetStore();
  const showToast = useToast();
  const [draft, setDraft] = useState<NumberingRules>(state.numberingRules);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState<Record<string, string>>({ assetTag: '7', employee: '12', category: 'ITL', location: 'HO', department: 'IT', vendor: '21' });

  // state.numberingRules loads asynchronously after this page mounts (it comes from the
  // database fetch, which hasn't resolved yet on first render), so the useState initial value
  // above only ever captures whatever was loaded *before* this component existed -- on a fresh
  // page load that's still the all-blank default. Re-sync whenever the loaded rules change (on
  // load, and after this component's own save -- both just set `draft` back to the same value,
  // so this never clobbers an in-progress edit the user hasn't saved yet).
  useEffect(() => { setDraft(state.numberingRules); }, [state.numberingRules]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(state.numberingRules);

  const updateRule = (kind: keyof NumberingRules, patch: Partial<NumberingRule>) => {
    setDraft(prev => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await saveNumberingRules(draft);
    setSaving(false);
    if (res.ok) showToast('Numbering rules saved. New records will use the updated prefix/suffix.');
    else showToast(res.error || 'Could not save the numbering rules — they only exist on this screen until it does.', 'error');
  };

  return (
    <div>
      <ListToolbar title="Numbering & Prefix/Suffix" count={NUMBERING_ENTITY_KINDS.length}>
        <SecondaryButton disabled={!dirty || saving} onClick={() => setDraft(state.numberingRules)}>Discard changes</SecondaryButton>
        <PrimaryButton disabled={!dirty || saving} icon={<Icon name="check" className="w-4 h-4" />} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Numbering Rules'}
        </PrimaryButton>
      </ListToolbar>
      <p className="text-sm text-text-light mb-4 max-w-3xl">
        Set a prefix and/or suffix for each ID type below. Once saved, the matching "New …" form elsewhere in
        the app only asks for the distinguishing name or number — the configured prefix/suffix is applied
        automatically. Leaving Asset Tag blank on the Asset Register's "Add Asset" form (or on a GRN receipt, or
        a completed CWIP project) auto-fills it from one running company-wide sequence, wrapped in the prefix
        and suffix below — e.g. prefix "AST-", pad 4 digits → AST-0001, AST-0002, and so on. The only three
        columns that actually get saved are Prefix, Pad Digits and Suffix — "Try a value" is just a scratch box
        for the Preview column and is never stored, so it's normal for it to reset on its own.
      </p>
      <TableCard>
        <THead columns={['ID Type', 'Prefix', 'Try a value (preview only)', 'Pad Digits', 'Suffix', 'Preview']} />
        <tbody>
          {NUMBERING_ENTITY_KINDS.map(kind => {
            const rule = draft[kind];
            return (
              <Tr key={kind}>
                <Td className="font-medium">{NUMBERING_ENTITY_LABELS[kind]}</Td>
                <Td><Input className="w-28" value={rule.prefix} onChange={e => updateRule(kind, { prefix: e.target.value.toUpperCase() })} placeholder="e.g. EMP-" /></Td>
                <Td><Input className="w-24 italic" value={sample[kind] || ''} onChange={e => setSample(prev => ({ ...prev, [kind]: e.target.value }))} placeholder="try a value" /></Td>
                <Td>
                  <Select className="w-24" value={rule.padDigits} onChange={e => updateRule(kind, { padDigits: Number(e.target.value) })}>
                    {[0, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 0 ? 'None' : n}</option>)}
                  </Select>
                </Td>
                <Td><Input className="w-28" value={rule.suffix} onChange={e => updateRule(kind, { suffix: e.target.value.toUpperCase() })} placeholder="e.g. -HQ" /></Td>
                <Td className="font-mono text-xs text-primary font-semibold">{applyNumberingRule(rule, sample[kind] || '') || '—'}</Td>
              </Tr>
            );
          })}
        </tbody>
      </TableCard>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Depreciation Rate Master section
// ---------------------------------------------------------------------------

const DEP_METHODS = Object.values(DepreciationMethod);

const RATE_TYPE_LABELS: Record<DepreciationRateType, string> = {
  [DepreciationRateType.CompaniesAct]: 'Companies Act',
  [DepreciationRateType.IncomeTax]: 'Income Tax',
};

/** Short note shown under each tab so it's clear which figure each basis actually feeds. */
const RATE_TYPE_HINTS: Record<DepreciationRateType, string> = {
  [DepreciationRateType.CompaniesAct]: 'Drives the Net Book Value shown everywhere in the app — Asset Register, Dashboard, Disposals, and the main Reports figures.',
  [DepreciationRateType.IncomeTax]: 'Kept separately for the Reports page\'s Income Tax Net Book Value column. Uses the same Straight Line / Written Down Value calculation as Companies Act — not the Income Tax Act\'s own block-of-assets rules (rate slabs, the 180-day half-year rule, block additions/deletions).',
};

const DepreciationRateSection: React.FC = () => {
  const { state, saveDepreciationRateRule, deleteDepreciationRateRule } = useAssetStore();
  const showToast = useToast();
  const [rateType, setRateType] = useState<DepreciationRateType>(DepreciationRateType.CompaniesAct);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);

  // One row per category, for whichever basis tab is active: the existing override for THAT
  // basis if saved, otherwise the category's own defaults (shown as a starting point — saving
  // it turns it into a real override row). Companies Act and Income Tax are independent rows,
  // so switching tabs is a different slice of state.depreciationRateRules, not a different view
  // of the same one.
  const rows = useMemo(() => state.categories.map(cat => {
    const override = state.depreciationRateRules.find(r => r.categoryId === cat.id && r.rateType === rateType);
    return {
      category: cat,
      override,
      method: override?.method ?? cat.depreciationMethod,
      usefulLifeYears: override?.usefulLifeYears ?? cat.usefulLifeYears,
      salvageValuePct: override?.salvageValuePct ?? cat.salvageValuePct,
    };
  }), [state.categories, state.depreciationRateRules, rateType]);

  // Keyed by `${categoryId}:${rateType}` so an unsaved edit on one tab never leaks into the
  // other when switching between Companies Act and Income Tax.
  const [edits, setEdits] = useState<Record<string, { method: DepreciationMethod; usefulLifeYears: number; salvageValuePct: number }>>({});
  const editKey = (categoryId: string) => `${categoryId}:${rateType}`;

  const valueFor = (categoryId: string) => edits[editKey(categoryId)] || rows.find(r => r.category.id === categoryId)!;

  const updateEdit = (categoryId: string, patch: Partial<{ method: DepreciationMethod; usefulLifeYears: number; salvageValuePct: number }>) => {
    const base = valueFor(categoryId);
    setEdits(prev => ({ ...prev, [editKey(categoryId)]: { method: base.method, usefulLifeYears: base.usefulLifeYears, salvageValuePct: base.salvageValuePct, ...patch } }));
  };

  const handleSaveRow = async (categoryId: string) => {
    const v = valueFor(categoryId);
    const existing = state.depreciationRateRules.find(r => r.categoryId === categoryId && r.rateType === rateType);
    setSavingId(categoryId);
    const res = await saveDepreciationRateRule({ id: existing?.id, categoryId, rateType, method: v.method, usefulLifeYears: v.usefulLifeYears, salvageValuePct: v.salvageValuePct });
    setSavingId(null);
    if (res.ok) {
      showToast(`${RATE_TYPE_LABELS[rateType]} depreciation rate saved.`);
      setEdits(prev => { const next = { ...prev }; delete next[editKey(categoryId)]; return next; });
    } else showToast(res.error || 'Could not save the depreciation rate.', 'error');
  };

  const handleClearOverride = async (categoryId: string) => {
    const existing = state.depreciationRateRules.find(r => r.categoryId === categoryId && r.rateType === rateType);
    if (!existing) return;
    if (!window.confirm(`Remove this ${RATE_TYPE_LABELS[rateType]} override? The category will fall back to each asset's own stored depreciation fields for this basis.`)) return;
    const res = await deleteDepreciationRateRule(existing.id);
    if (res.ok) showToast('Override removed.');
    else showToast(res.error || 'Could not remove the override.', 'error');
  };

  // --- Excel upload: bulk-apply rates (for the active basis) by matching Category Code --------
  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadSummary(null);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('The workbook has no worksheet.');

      const headerRow = sheet.getRow(1).values as any[];
      const colIndex = (name: string) => headerRow.findIndex(h => String(h || '').trim().toLowerCase() === name.toLowerCase());
      const codeCol = colIndex('Category Code');
      const methodCol = colIndex('Depreciation Method');
      const lifeCol = colIndex('Useful Life (Years)');
      const salvageCol = colIndex('Salvage Value (%)');
      if (codeCol < 1) throw new Error('Could not find a "Category Code" column. Use the downloaded template.');

      let applied = 0;
      const skipped: string[] = [];
      for (let r = 2; r <= sheet.rowCount; r += 1) {
        const row = sheet.getRow(r);
        const codeRaw = row.getCell(codeCol).value;
        const code = String(codeRaw ?? '').trim();
        if (!code) continue;
        const category = state.categories.find(c => c.code.toLowerCase() === code.toLowerCase());
        if (!category) { skipped.push(code); continue; }

        const methodRaw = methodCol > 0 ? String(row.getCell(methodCol).value ?? '').trim() : '';
        const method = DEP_METHODS.find(m => m.toLowerCase() === methodRaw.toLowerCase())
          || DEP_METHODS.find(m => methodRaw && m.toLowerCase().startsWith(methodRaw.toLowerCase()))
          || category.depreciationMethod;
        const lifeRaw = lifeCol > 0 ? Number(row.getCell(lifeCol).value) : NaN;
        const salvageRaw = salvageCol > 0 ? Number(row.getCell(salvageCol).value) : NaN;
        const usefulLifeYears = Number.isFinite(lifeRaw) && lifeRaw > 0 ? lifeRaw : category.usefulLifeYears;
        const salvageValuePct = Number.isFinite(salvageRaw) ? salvageRaw : category.salvageValuePct;

        const existing = state.depreciationRateRules.find(r2 => r2.categoryId === category.id && r2.rateType === rateType);
        // eslint-disable-next-line no-await-in-loop
        const res = await saveDepreciationRateRule({ id: existing?.id, categoryId: category.id, rateType, method, usefulLifeYears, salvageValuePct });
        if (res.ok) applied += 1;
        else skipped.push(code);
      }

      setUploadSummary(
        `Applied ${applied} ${RATE_TYPE_LABELS[rateType]} rate${applied === 1 ? '' : 's'}.` +
        (skipped.length ? ` Skipped ${skipped.length} row(s) with an unrecognised category code: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}.` : ''),
      );
      showToast(`${RATE_TYPE_LABELS[rateType]} depreciation rates updated from ${file.name}.`);
    } catch (err: any) {
      console.error('Failed to parse depreciation rate workbook', err);
      showToast(err?.message || 'Could not read that file. Make sure it is a .xlsx workbook.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${RATE_TYPE_LABELS[rateType]} Depreciation Rates`);
    sheet.addRow(['Category Code', 'Depreciation Method', 'Useful Life (Years)', 'Salvage Value (%)']);
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) {
      sheet.addRow([row.category.code, row.method, row.usefulLifeYears, row.salvageValuePct]);
    }
    sheet.columns.forEach(c => { c.width = 24; });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depreciation_rate_template_${rateType === DepreciationRateType.IncomeTax ? 'income_tax' : 'companies_act'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex gap-1 mb-3 bg-slate-200/60 p-1 rounded-lg w-fit">
        {Object.values(DepreciationRateType).map(rt => (
          <button
            key={rt}
            onClick={() => setRateType(rt)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${rateType === rt ? 'bg-white shadow-sm text-primary' : 'text-text-light'}`}
          >
            {RATE_TYPE_LABELS[rt]}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-light mb-4 max-w-3xl">{RATE_TYPE_HINTS[rateType]}</p>
      <ListToolbar title={`${RATE_TYPE_LABELS[rateType]} Rates`} count={state.categories.length}>
        <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={downloadTemplate}>Download Template</SecondaryButton>
        <input
          type="file"
          accept=".xlsx"
          disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
          className="block text-sm text-slate-500
            file:mr-2 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-indigo-50 file:text-primary
            hover:file:bg-indigo-100 cursor-pointer border border-border rounded-lg disabled:opacity-50"
        />
        {uploading && <span className="text-xs text-text-light">Uploading…</span>}
      </ListToolbar>
      <p className="text-sm text-text-light mb-2 max-w-3xl">
        A rate set here overrides whatever method, useful life and salvage value is stored on each individual
        asset of that category, for the {RATE_TYPE_LABELS[rateType]} basis only. Edit a row inline and save it,
        or upload a .xlsx workbook with columns "Category Code", "Depreciation Method", "Useful Life (Years)"
        and "Salvage Value (%)" (download the template above to get the exact format, pre-filled with this
        tab's current rates). Companies Act and Income Tax rates are saved separately — switch tabs to manage
        the other one.
      </p>
      {uploadSummary && (
        <div className="mb-4 text-sm bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-3 py-2">{uploadSummary}</div>
      )}
      <TableCard>
        <THead columns={['Category', 'Method', 'Useful Life (Yrs)', 'Salvage Value (%)', 'Status', '']} />
        <tbody>
          {rows.map(({ category, override }) => {
            const v = valueFor(category.id);
            const isEdited = !!edits[editKey(category.id)];
            return (
              <Tr key={category.id}>
                <Td className="font-medium">{category.name} <span className="text-xs text-text-light font-mono">({category.code})</span></Td>
                <Td>
                  <Select className="w-44" value={v.method} onChange={e => updateEdit(category.id, { method: e.target.value as DepreciationMethod })}>
                    {DEP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </Td>
                <Td><Input type="number" min={1} className="w-20" value={v.usefulLifeYears} onChange={e => updateEdit(category.id, { usefulLifeYears: Number(e.target.value) })} /></Td>
                <Td><Input type="number" min={0} max={100} step={0.5} className="w-20" value={v.salvageValuePct} onChange={e => updateEdit(category.id, { salvageValuePct: Number(e.target.value) })} /></Td>
                <Td>{override ? <span className="text-xs font-semibold text-primary">Override active</span> : <span className="text-xs text-text-light">Using category default</span>}</Td>
                <Td>
                  <div className="flex gap-3 items-center">
                    <button
                      disabled={!isEdited || savingId === category.id}
                      onClick={() => handleSaveRow(category.id)}
                      className="text-primary hover:text-primary-dark font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingId === category.id ? 'Saving…' : 'Save'}
                    </button>
                    {override && (
                      <button onClick={() => handleClearOverride(category.id)} className="text-red-500 hover:text-red-700 font-medium text-sm">Clear</button>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </TableCard>
      {state.categories.length === 0 && (
        <p className="text-sm text-text-light mt-4">No categories yet — create one under Categories & Variants first.</p>
      )}
    </div>
  );
};

export default Settings;