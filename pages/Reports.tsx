import React, { useMemo, useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { Asset, DepreciationRateType } from '../types';
import { Field, Select, PrimaryButton, SecondaryButton } from '../components/ui/FormControls';
import Icon from '../components/icons/Icon';
import { useToast } from '../components/ui/Toast';
import { downloadCsv, CsvColumn } from '../lib/csvExport';
// Type-only import: exceljs (lib/xlsxExport.ts's one real dependency) is a large library and
// this app doesn't code-split routes, so pulling it in at the top level would add it to every
// page's initial bundle, not just Reports. downloadFormattedXlsx itself is loaded dynamically
// inside the two handlers below instead, so it — and exceljs with it — is only fetched the
// moment someone actually clicks "Download Excel (Formatted)".
import type { XlsxColumn } from '../lib/xlsxExport';
import { computeDepreciation } from '../lib/depreciation';
import { fiscalYear, formatCurrency, sum, today } from '../lib/format';

/** "2025-26" -> { start: '2025-04-01', end: '2026-03-31' } (Indian financial year, Apr–Mar). */
const fyRange = (fy: string) => {
  const startYear = parseInt(fy.slice(0, 4), 10);
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` };
};

const dayBefore = (date: string) => {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const fyLabel = (startYear: number) => `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

interface DepRow {
  asset: Asset;
  category: string;
  openingNbv: number;
  charge: number;
  accumulated: number;
  closingNbv: number;
  /** Same closing-date calculation, run against the Income Tax basis of the Depreciation Rate
   *  Master instead of Companies Act (see Settings → Depreciation Rate Master). Still the same
   *  SLM/WDV engine, not actual Income Tax Act block-of-assets rules. */
  closingNbvIncomeTax: number;
}

const Reports: React.FC = () => {
  const { state, currentCompany } = useAssetStore();
  const showToast = useToast();

  const currentFy = fiscalYear();
  const fyOptions = useMemo(() => {
    const years = state.assets
      .map(a => new Date(a.capitalizedOn || a.purchaseDate).getFullYear())
      .filter(y => !Number.isNaN(y));
    const first = Math.min(parseInt(currentFy.slice(0, 4), 10) - 2, ...(years.length ? years : [9999]) );
    const last = parseInt(currentFy.slice(0, 4), 10);
    const list: string[] = [];
    for (let y = last; y >= first; y -= 1) list.push(fyLabel(y));
    return list;
  }, [state.assets, currentFy]);

  const [fy, setFy] = useState(currentFy);
  const { start, end } = fyRange(fy);

  const catName = (id: string) => state.categories.find(c => c.id === id)?.name || '';
  const deptName = (id?: string) => state.departments.find(d => d.id === id)?.name || '';
  const locName = (id?: string) => state.locations.find(l => l.id === id)?.name || '';
  const vendorName = (id?: string) => state.vendors.find(v => v.id === id)?.name || '';
  const custodianName = (id?: string) => state.employees.find(e => e.id === id)?.name || '';

  // Assets that already existed by the end of the selected financial year.
  const inScope = useMemo(
    () => state.assets.filter(a => (a.capitalizedOn || a.purchaseDate) <= end),
    [state.assets, end],
  );

  const depRows: DepRow[] = useMemo(() => inScope.map(asset => {
    const opening = (asset.capitalizedOn || asset.purchaseDate) > dayBefore(start)
      ? null
      : computeDepreciation(asset, dayBefore(start), state.depreciationRateRules);
    const closing = computeDepreciation(asset, end, state.depreciationRateRules);
    const closingIncomeTax = computeDepreciation(asset, end, state.depreciationRateRules, DepreciationRateType.IncomeTax);
    const openingNbv = opening ? opening.netBookValue : asset.purchaseCost;
    const openingAcc = opening ? opening.accumulated : 0;
    return {
      asset,
      category: catName(asset.categoryId),
      openingNbv,
      charge: Math.max(0, closing.accumulated - openingAcc),
      accumulated: closing.accumulated,
      closingNbv: closing.netBookValue,
      closingNbvIncomeTax: closingIncomeTax.netBookValue,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [inScope, start, end, state.categories, state.depreciationRateRules]);

  const totals = {
    cost: sum(inScope, a => a.purchaseCost),
    opening: sum(depRows, r => r.openingNbv),
    charge: sum(depRows, r => r.charge),
    accumulated: sum(depRows, r => r.accumulated),
    closing: sum(depRows, r => r.closingNbv),
    closingIncomeTax: sum(depRows, r => r.closingNbvIncomeTax),
  };

  const companyTag = (currentCompany?.code || 'company').toString().replace(/\s+/g, '_');

  const registerColumns: CsvColumn<Asset>[] = [
    { header: 'Asset Tag', value: a => a.assetTag },
    { header: 'Name', value: a => a.name },
    { header: 'Category', value: a => catName(a.categoryId) },
    { header: 'Serial Number', value: a => a.serialNumber },
    { header: 'Status', value: a => a.status },
    { header: 'Condition', value: a => a.condition },
    { header: 'Department', value: a => deptName(a.departmentId) },
    { header: 'Location', value: a => locName(a.locationId) },
    { header: 'Custodian', value: a => custodianName(a.custodianId) },
    { header: 'Vendor', value: a => vendorName(a.vendorId) },
    { header: 'PO No', value: a => a.poNo },
    { header: 'Invoice No', value: a => a.invoiceNo },
    { header: 'Purchase Date', value: a => a.purchaseDate },
    { header: 'Capitalized On', value: a => a.capitalizedOn },
    { header: 'Purchase Cost', value: a => a.purchaseCost },
    { header: 'Depreciation Method', value: a => a.depreciationMethod },
    { header: 'Useful Life (Yrs)', value: a => a.usefulLifeYears },
    { header: `Net Book Value (as on ${end})`, value: a => Math.round(computeDepreciation(a, end, state.depreciationRateRules).netBookValue * 100) / 100 },
    { header: 'Warranty Expiry', value: a => a.warrantyExpiry },
  ];

  const depColumns: CsvColumn<DepRow>[] = [
    { header: 'Asset Tag', value: r => r.asset.assetTag },
    { header: 'Name', value: r => r.asset.name },
    { header: 'Category', value: r => r.category },
    { header: 'Method', value: r => r.asset.depreciationMethod },
    { header: 'Capitalized On', value: r => r.asset.capitalizedOn || r.asset.purchaseDate },
    { header: 'Useful Life (Yrs)', value: r => r.asset.usefulLifeYears },
    { header: 'Gross Cost', value: r => r.asset.purchaseCost },
    { header: `Opening NBV (${start})`, value: r => Math.round(r.openingNbv * 100) / 100 },
    { header: `Depreciation for FY ${fy}`, value: r => Math.round(r.charge * 100) / 100 },
    { header: 'Accumulated Depreciation', value: r => Math.round(r.accumulated * 100) / 100 },
    { header: `Closing NBV (${end})`, value: r => Math.round(r.closingNbv * 100) / 100 },
    { header: `Closing NBV — Income Tax (${end})`, value: r => Math.round(r.closingNbvIncomeTax * 100) / 100 },
  ];

  const downloadRegister = () => {
    downloadCsv(`asset_register_${companyTag}_FY${fy}_${today()}`, inScope, registerColumns);
    showToast(`Downloaded asset register — ${inScope.length} assets.`);
  };

  const downloadDepreciation = () => {
    downloadCsv(`depreciation_report_${companyTag}_FY${fy}_${today()}`, depRows, depColumns);
    showToast(`Downloaded depreciation report for FY ${fy}.`);
  };

  // Formatted (.xlsx) exports — the plain CSVs above are great for re-importing elsewhere, but
  // not what "a designed, formatted report" means: a title banner, a styled header row, proper
  // currency formatting, and a totals row, all in an actual Excel workbook. Built with exceljs
  // (lib/xlsxExport.ts) rather than the CSV helper, since CSV has no concept of styling at all.
  const companyDisplayName = currentCompany?.name || 'Your Company';
  const [exportingRegister, setExportingRegister] = useState(false);
  const [exportingDepreciation, setExportingDepreciation] = useState(false);

  const registerXlsxColumns: XlsxColumn<Asset>[] = [
    { header: 'Asset Tag', value: a => a.assetTag, width: 16 },
    { header: 'Name', value: a => a.name, width: 24 },
    { header: 'Category', value: a => catName(a.categoryId), width: 16 },
    { header: 'Serial Number', value: a => a.serialNumber, width: 18 },
    { header: 'Status', value: a => a.status, width: 12 },
    { header: 'Condition', value: a => a.condition, width: 12 },
    { header: 'Department', value: a => deptName(a.departmentId), width: 16 },
    { header: 'Location', value: a => locName(a.locationId), width: 16 },
    { header: 'Custodian', value: a => custodianName(a.custodianId), width: 18 },
    { header: 'Vendor', value: a => vendorName(a.vendorId), width: 18 },
    { header: 'PO No', value: a => a.poNo, width: 14 },
    { header: 'Invoice No', value: a => a.invoiceNo, width: 14 },
    { header: 'Purchase Date', value: a => a.purchaseDate, type: 'date', width: 14 },
    { header: 'Capitalized On', value: a => a.capitalizedOn, type: 'date', width: 14 },
    { header: 'Purchase Cost', value: a => a.purchaseCost, type: 'currency', width: 16 },
    { header: 'Depreciation Method', value: a => a.depreciationMethod, width: 16 },
    { header: 'Useful Life (Yrs)', value: a => a.usefulLifeYears, type: 'number', width: 14 },
    { header: `Net Book Value (as on ${end})`, value: a => Math.round(computeDepreciation(a, end, state.depreciationRateRules).netBookValue * 100) / 100, type: 'currency', width: 20 },
    { header: 'Warranty Expiry', value: a => a.warrantyExpiry, type: 'date', width: 14 },
  ];

  const depXlsxColumns: XlsxColumn<DepRow>[] = [
    { header: 'Asset Tag', value: r => r.asset.assetTag, width: 16 },
    { header: 'Name', value: r => r.asset.name, width: 24 },
    { header: 'Category', value: r => r.category, width: 16 },
    { header: 'Method', value: r => r.asset.depreciationMethod, width: 14 },
    { header: 'Capitalized On', value: r => r.asset.capitalizedOn || r.asset.purchaseDate, type: 'date', width: 14 },
    { header: 'Useful Life (Yrs)', value: r => r.asset.usefulLifeYears, type: 'number', width: 14 },
    { header: 'Gross Cost', value: r => r.asset.purchaseCost, type: 'currency', width: 16 },
    { header: `Opening NBV (${start})`, value: r => Math.round(r.openingNbv * 100) / 100, type: 'currency', width: 18 },
    { header: `Depreciation for FY ${fy}`, value: r => Math.round(r.charge * 100) / 100, type: 'currency', width: 18 },
    { header: 'Accumulated Depreciation', value: r => Math.round(r.accumulated * 100) / 100, type: 'currency', width: 20 },
    { header: `Closing NBV (${end})`, value: r => Math.round(r.closingNbv * 100) / 100, type: 'currency', width: 18 },
    { header: `Closing NBV — Income Tax (${end})`, value: r => Math.round(r.closingNbvIncomeTax * 100) / 100, type: 'currency', width: 22 },
  ];

  const downloadRegisterXlsx = async () => {
    setExportingRegister(true);
    try {
      const { downloadFormattedXlsx } = await import('../lib/xlsxExport');
      await downloadFormattedXlsx({
        filename: `asset_register_${companyTag}_FY${fy}_${today()}`,
        sheetName: 'Asset Register',
        reportTitle: 'Asset Register',
        companyName: companyDisplayName,
        subtitleLines: [`All assets capitalised up to ${end}`],
        columns: registerXlsxColumns,
        rows: inScope,
        totals: { columns: ['Purchase Cost', `Net Book Value (as on ${end})`] },
      });
      showToast(`Downloaded formatted asset register — ${inScope.length} assets.`);
    } catch (err: any) {
      showToast(err?.message || 'Could not generate the Excel file.', 'error');
    } finally {
      setExportingRegister(false);
    }
  };

  const downloadDepreciationXlsx = async () => {
    setExportingDepreciation(true);
    try {
      const { downloadFormattedXlsx } = await import('../lib/xlsxExport');
      await downloadFormattedXlsx({
        filename: `depreciation_report_${companyTag}_FY${fy}_${today()}`,
        sheetName: 'Depreciation',
        reportTitle: `Depreciation Report — FY ${fy}`,
        companyName: companyDisplayName,
        subtitleLines: [`Period: ${start} to ${end}`],
        columns: depXlsxColumns,
        rows: depRows,
        totals: { columns: ['Gross Cost', `Opening NBV (${start})`, `Depreciation for FY ${fy}`, 'Accumulated Depreciation', `Closing NBV (${end})`, `Closing NBV — Income Tax (${end})`] },
      });
      showToast(`Downloaded formatted depreciation report for FY ${fy}.`);
    } catch (err: any) {
      showToast(err?.message || 'Could not generate the Excel file.', 'error');
    } finally {
      setExportingDepreciation(false);
    }
  };

  const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-slate-50 rounded-lg px-4 py-3">
      <p className="text-xs text-text-light">{label}</p>
      <p className="text-base font-bold text-text-main mt-0.5">{value}</p>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-main">Reports</h2>
          <p className="text-sm text-text-light mt-1">Download reports for the selected financial year — as plain CSV, or as a formatted Excel workbook.</p>
        </div>
        <Field label="Financial Year" className="w-48">
          <Select id="reports-fy" value={fy} onChange={e => setFy(e.target.value)}>
            {fyOptions.map(o => <option key={o} value={o}>FY {o}</option>)}
          </Select>
        </Field>
      </div>

      <p className="text-xs text-text-light mb-4">Period: {start} to {end}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-card rounded-xl shadow-sm p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon name="box" /></div>
            <div>
              <h3 className="font-semibold text-text-main">Assets Register</h3>
              <p className="text-xs text-text-light">All assets capitalised up to {end}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="Assets" value={String(inScope.length)} />
            <Stat label="Gross Cost" value={formatCurrency(totals.cost, true)} />
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <PrimaryButton id="download-asset-register" icon={<Icon name="download" className="w-4 h-4" />} onClick={downloadRegister} disabled={inScope.length === 0}>
              Download CSV
            </PrimaryButton>
            <SecondaryButton
              id="download-asset-register-xlsx"
              icon={<Icon name="box" className="w-4 h-4" />}
              onClick={downloadRegisterXlsx}
              disabled={inScope.length === 0 || exportingRegister}
            >
              {exportingRegister ? 'Preparing…' : 'Download Excel (Formatted)'}
            </SecondaryButton>
          </div>
        </section>

        <section className="bg-card rounded-xl shadow-sm p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon name="layers" /></div>
            <div>
              <h3 className="font-semibold text-text-main">Depreciation Report</h3>
              <p className="text-xs text-text-light">Opening, charge and closing book value for FY {fy}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="Opening NBV" value={formatCurrency(totals.opening, true)} />
            <Stat label="Depreciation for FY" value={formatCurrency(totals.charge, true)} />
            <Stat label="Accumulated" value={formatCurrency(totals.accumulated, true)} />
            <Stat label="Closing NBV" value={formatCurrency(totals.closing, true)} />
            <Stat label="Closing NBV (Income Tax)" value={formatCurrency(totals.closingIncomeTax, true)} />
          </div>
          <p className="text-xs text-text-light mb-2 -mt-2">
            Income Tax figures use the rates set under Settings → Depreciation Rate Master → Income Tax.
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <PrimaryButton id="download-depreciation-report" icon={<Icon name="download" className="w-4 h-4" />} onClick={downloadDepreciation} disabled={depRows.length === 0}>
              Download CSV
            </PrimaryButton>
            <SecondaryButton
              id="download-depreciation-report-xlsx"
              icon={<Icon name="layers" className="w-4 h-4" />}
              onClick={downloadDepreciationXlsx}
              disabled={depRows.length === 0 || exportingDepreciation}
            >
              {exportingDepreciation ? 'Preparing…' : 'Download Excel (Formatted)'}
            </SecondaryButton>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Reports;