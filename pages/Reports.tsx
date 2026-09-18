import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAssetStore } from '../store/AssetStore';
import { Tabs } from '../components/ui/Tabs';
import { TableCard, THead, Tr, Td } from '../components/ui/Table';
import { StatusBadge, Pill } from '../components/ui/Badge';
import { SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import Icon from '../components/icons/Icon';
import { formatCurrency, formatDate } from '../lib/format';
import { computeDepreciation } from '../lib/depreciation';
import { exportToCsv } from '../lib/csv';
import { exportTableToPdf } from '../lib/pdf';
import { allApprovalDocuments, amcRenewalCalendar, depreciationSummary, valuationByCategory, valuationByLocation } from '../lib/reports';
import { Asset } from '../types';

const COLORS = ['#4F46E5', '#0D9488', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B', '#10B981'];

const ReportToolbar: React.FC<{ onCsv: () => void; onPdf: () => void }> = ({ onCsv, onPdf }) => (
  <div className="flex justify-end gap-2 mb-3">
    <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={onCsv}>Export CSV</SecondaryButton>
    <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={onPdf}>Export PDF</SecondaryButton>
  </div>
);

const Reports: React.FC = () => {
  const { state } = useAssetStore();
  const [tab, setTab] = useState('depreciation');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const depRows = depreciationSummary(state);
  const amcRows = amcRenewalCalendar(state);
  const approvalRows = allApprovalDocuments(state);
  const byCategory = valuationByCategory(state);
  const byLocation = valuationByLocation(state);

  return (
    <div>
      <h2 className="text-xl font-bold text-text-main mb-5">Reports</h2>
      <Tabs
        className="mb-5"
        active={tab}
        onChange={setTab}
        items={[
          { key: 'depreciation', label: 'Depreciation Schedule', count: depRows.length },
          { key: 'amc', label: 'AMC Renewal Calendar', count: amcRows.length },
          { key: 'valuation', label: 'Valuation Summary' },
          { key: 'doa', label: 'DOA & Approvals', count: approvalRows.length },
        ]}
      />

      {tab === 'depreciation' && (
        <div>
          <ReportToolbar
            onCsv={() => exportToCsv('depreciation-schedule', [
              { header: 'Tag', value: (r: typeof depRows[0]) => r.assetTag },
              { header: 'Name', value: r => r.name },
              { header: 'Category', value: r => r.category },
              { header: 'Purchase Cost', value: r => r.purchaseCost },
              { header: 'Method', value: r => r.method },
              { header: 'Accumulated Depreciation', value: r => r.accumulated },
              { header: 'Net Book Value', value: r => r.netBookValue },
              { header: '% Depreciated', value: r => r.percentDepreciated },
            ], depRows)}
            onPdf={() => exportTableToPdf('depreciation-schedule', 'Depreciation Schedule', [
              { header: 'Tag', value: r => r.assetTag },
              { header: 'Name', value: r => r.name },
              { header: 'Category', value: r => r.category },
              { header: 'Cost', value: r => formatCurrency(r.purchaseCost) },
              { header: 'Method', value: r => r.method },
              { header: 'Accum. Dep.', value: r => formatCurrency(r.accumulated) },
              { header: 'NBV', value: r => formatCurrency(r.netBookValue) },
              { header: '% Dep.', value: r => `${r.percentDepreciated}%` },
            ], depRows)}
          />
          <TableCard>
            <THead columns={['Tag', 'Name', 'Category', 'Cost', 'Method', 'Accum. Depreciation', 'Net Book Value', '% Dep.']} />
            <tbody>
              {depRows.map(r => {
                const asset = state.assets.find(a => a.assetTag === r.assetTag);
                return (
                  <Tr key={r.assetTag} onClick={() => asset && setSelectedAsset(asset)}>
                    <Td className="font-mono text-xs">{r.assetTag}</Td>
                    <Td>{r.name}</Td>
                    <Td>{r.category}</Td>
                    <Td>{formatCurrency(r.purchaseCost)}</Td>
                    <Td>{r.method}</Td>
                    <Td>{formatCurrency(r.accumulated)}</Td>
                    <Td className="font-medium">{formatCurrency(r.netBookValue)}</Td>
                    <Td>{r.percentDepreciated}%</Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableCard>

          {selectedAsset && (
            <div className="mt-4 bg-card rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-text-main">Year-by-Year Schedule · {selectedAsset.assetTag} — {selectedAsset.name}</h3>
                <button onClick={() => setSelectedAsset(null)} className="text-text-light hover:text-text-main"><Icon name="close" className="w-4 h-4" /></button>
              </div>
              <TableCard>
                <THead columns={['Year', 'Opening', 'Charge', 'Closing']} />
                <tbody>
                  {computeDepreciation(selectedAsset).schedule.map(row => (
                    <Tr key={row.year}>
                      <Td>{row.label} ({row.year})</Td>
                      <Td>{formatCurrency(row.openingValue)}</Td>
                      <Td>{formatCurrency(row.charge)}</Td>
                      <Td>{formatCurrency(row.closingValue)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableCard>
            </div>
          )}
        </div>
      )}

      {tab === 'amc' && (
        <div>
          <ReportToolbar
            onCsv={() => exportToCsv('amc-renewal-calendar', [
              { header: 'Contract No.', value: (r: typeof amcRows[0]) => r.contractNo },
              { header: 'Vendor', value: r => r.vendorName },
              { header: 'Type', value: r => r.type },
              { header: 'Start', value: r => r.startDate },
              { header: 'End', value: r => r.endDate },
              { header: 'Days Remaining', value: r => r.daysRemaining ?? '' },
              { header: 'Value', value: r => r.contractValue },
              { header: 'Status', value: r => r.status },
            ], amcRows)}
            onPdf={() => exportTableToPdf('amc-renewal-calendar', 'AMC Renewal Calendar', [
              { header: 'Contract No.', value: r => r.contractNo },
              { header: 'Vendor', value: r => r.vendorName },
              { header: 'Type', value: r => r.type },
              { header: 'End Date', value: r => formatDate(r.endDate) },
              { header: 'Days Left', value: r => (r.daysRemaining ?? '—').toString() },
              { header: 'Value', value: r => formatCurrency(r.contractValue) },
              { header: 'Status', value: r => r.status },
            ], amcRows)}
          />
          {amcRows.length === 0 ? <EmptyState icon="shield" title="No AMC contracts" /> : (
            <TableCard>
              <THead columns={['Contract No.', 'Vendor', 'Type', 'Start', 'End', 'Days Remaining', 'Value', 'Status']} />
              <tbody>
                {amcRows.map(r => (
                  <Tr key={r.contractNo}>
                    <Td className="font-mono text-xs">{r.contractNo}</Td>
                    <Td>{r.vendorName}</Td>
                    <Td>{r.type}</Td>
                    <Td>{formatDate(r.startDate)}</Td>
                    <Td>{formatDate(r.endDate)}</Td>
                    <Td>{r.daysRemaining === null ? '—' : (
                      <Pill label={`${r.daysRemaining} days`} tone={r.daysRemaining < 30 ? 'red' : r.daysRemaining < 60 ? 'amber' : 'green'} />
                    )}</Td>
                    <Td>{formatCurrency(r.contractValue)}</Td>
                    <Td><StatusBadge status={r.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      )}

      {tab === 'valuation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-text-main">By Category</h3>
                <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={() => exportToCsv('valuation-by-category', [
                  { header: 'Category', value: (r: typeof byCategory[0]) => r.label },
                  { header: 'Assets', value: r => r.assetCount },
                  { header: 'Purchase Cost', value: r => r.purchaseCost },
                  { header: 'Book Value', value: r => Math.round(r.bookValue) },
                ], byCategory)}>CSV</SecondaryButton>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byCategory} dataKey="bookValue" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {byCategory.map((entry, i) => <Cell key={entry.label} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <TableCard className="mt-3">
                <THead columns={['Category', 'Assets', 'Book Value']} />
                <tbody>
                  {byCategory.map(r => <Tr key={r.label}><Td>{r.label}</Td><Td>{r.assetCount}</Td><Td className="font-medium">{formatCurrency(r.bookValue)}</Td></Tr>)}
                </tbody>
              </TableCard>
            </div>

            <div className="bg-card rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-text-main">By Location</h3>
                <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={() => exportToCsv('valuation-by-location', [
                  { header: 'Location', value: (r: typeof byLocation[0]) => r.label },
                  { header: 'Assets', value: r => r.assetCount },
                  { header: 'Purchase Cost', value: r => r.purchaseCost },
                  { header: 'Book Value', value: r => Math.round(r.bookValue) },
                ], byLocation)}>CSV</SecondaryButton>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byLocation} dataKey="bookValue" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {byLocation.map((entry, i) => <Cell key={entry.label} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <TableCard className="mt-3">
                <THead columns={['Location', 'Assets', 'Book Value']} />
                <tbody>
                  {byLocation.map(r => <Tr key={r.label}><Td>{r.label}</Td><Td>{r.assetCount}</Td><Td className="font-medium">{formatCurrency(r.bookValue)}</Td></Tr>)}
                </tbody>
              </TableCard>
            </div>
          </div>
        </div>
      )}

      {tab === 'doa' && (
        <div>
          <ReportToolbar
            onCsv={() => exportToCsv('doa-approvals', [
              { header: 'Type', value: (r: typeof approvalRows[0]) => r.docType },
              { header: 'Doc No.', value: r => r.docNo },
              { header: 'Title', value: r => r.title },
              { header: 'Amount', value: r => r.amount },
              { header: 'Status', value: r => r.status },
              { header: 'Pending With', value: r => r.pendingWith },
            ], approvalRows)}
            onPdf={() => exportTableToPdf('doa-approvals', 'DOA & Approvals Report', [
              { header: 'Type', value: r => r.docType },
              { header: 'Doc No.', value: r => r.docNo },
              { header: 'Title', value: r => r.title },
              { header: 'Amount', value: r => formatCurrency(r.amount) },
              { header: 'Status', value: r => r.status },
              { header: 'Pending With', value: r => r.pendingWith },
            ], approvalRows, { orientation: 'landscape' })}
          />
          <TableCard>
            <THead columns={['Type', 'Doc No.', 'Title', 'Amount', 'Status', 'Pending With']} />
            <tbody>
              {approvalRows.map(r => (
                <Tr key={r.docNo}>
                  <Td>{r.docType}</Td>
                  <Td className="font-mono text-xs">{r.docNo}</Td>
                  <Td className="max-w-xs truncate">{r.title}</Td>
                  <Td>{formatCurrency(r.amount)}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td>{r.pendingWith}</Td>
                </Tr>
              ))}
            </tbody>
          </TableCard>
        </div>
      )}
    </div>
  );
};

export default Reports;
