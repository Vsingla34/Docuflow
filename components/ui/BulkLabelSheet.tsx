import React, { useEffect, useState } from 'react';
import { Asset } from '../../types';
import { generateQrDataUrl, assetLookupUrl } from '../../lib/qr';
import { formatDate } from '../../lib/format';
import Icon from '../icons/Icon';

// Every value interpolated into the print window's HTML below is user-entered somewhere else in
// the app (asset name, serial number, category/location names, company name) — none of it is
// React-escaped here the way JSX normally would be, since this builds a raw HTML string for
// `document.write`. Escaping it is what stops an asset/category/vendor name containing `<` or
// `"` from corrupting the printed layout or, worse, running as markup in the opened print window.
const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface BulkLabelSheetProps {
  assets: Asset[];
  companyName: string;
  companyLogoUrl?: string;
  categoryMap: Record<string, string>;  // categoryId -> name
  locationMap: Record<string, string>;  // locationId -> name
}

/**
 * A full-sheet (A4) print of multiple asset labels — used after posting a GRN
 * so the storekeeper can print one sheet covering all newly created assets.
 */
const BulkLabelSheet: React.FC<BulkLabelSheetProps> = ({
  assets, companyName, companyLogoUrl, categoryMap, locationMap,
}) => {
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assets.length) return;
    setLoading(true);
    Promise.all(
      assets.map(a =>
        generateQrDataUrl(assetLookupUrl(a.assetTag)).then(url => [a.id, url] as [string, string])
      )
    ).then(pairs => {
      setQrUrls(Object.fromEntries(pairs));
      setLoading(false);
    });
  }, [assets]);

  const handlePrint = () => {
    const labels = assets.map(a => {
      const qr = qrUrls[a.id] || '';
      return `
        <div class="label">
          <div class="header">
            ${companyLogoUrl ? `<img src="${escapeHtml(companyLogoUrl)}" class="logo" alt="logo"/>` : '<div class="logo-placeholder"></div>'}
            <div>
              <p class="company">${escapeHtml(companyName)}</p>
              <p class="sub">Asset Lifecycle Management</p>
            </div>
          </div>
          <div class="body-row">
            ${qr ? `<img src="${qr}" class="qr" alt="QR"/>` : '<div class="qr-placeholder"></div>'}
            <div class="meta">
              <p class="tag">${escapeHtml(a.assetTag)}</p>
              <p class="name">${escapeHtml(a.name)}</p>
              <p class="detail"><b>Category:</b> ${escapeHtml(categoryMap[a.categoryId] || '—')}</p>
              <p class="detail"><b>Location:</b> ${escapeHtml(locationMap[a.locationId] || '—')}</p>
              ${a.serialNumber ? `<p class="detail"><b>S/N:</b> ${escapeHtml(a.serialNumber)}</p>` : ''}
              <p class="detail"><b>Cap. Date:</b> ${escapeHtml(formatDate(a.capitalizedOn))}</p>
            </div>
          </div>
          <div class="footer">Scan QR or enter tag at Asset Portal</div>
        </div>
      `;
    }).join('');

    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (!printWin) return;
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Labels – Bulk Print</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; padding: 10mm; }
            @page { size: A4; margin: 10mm; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
            .label {
              border: 1.5px solid #0F172A; border-radius: 5px;
              padding: 8px 10px; display: flex; flex-direction: column; gap: 5px;
              break-inside: avoid;
            }
            .header { display: flex; align-items: center; gap: 7px; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; }
            .logo { width: 28px; height: 28px; object-fit: contain; }
            .logo-placeholder { width: 28px; height: 28px; background: #4F46E5; border-radius: 4px; }
            .company { font-size: 10px; font-weight: 700; color: #0F172A; }
            .sub { font-size: 8px; color: #94A3B8; }
            .body-row { display: flex; gap: 8px; align-items: flex-start; }
            .qr { width: 60px; height: 60px; flex-shrink: 0; }
            .qr-placeholder { width: 60px; height: 60px; background: #F1F5F9; border-radius: 4px; }
            .meta { flex: 1; }
            .tag { font-size: 15px; font-weight: 800; color: #0F172A; font-family: monospace; letter-spacing: 0.5px; }
            .name { font-size: 9px; color: #334155; margin-top: 2px; }
            .detail { font-size: 8px; color: #64748B; }
            .footer { font-size: 8px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 4px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="grid">${labels}</div>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  if (!assets.length) return null;

  return (
    <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-emerald-800">
            {assets.length} asset{assets.length !== 1 ? 's' : ''} created — labels ready
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Print all labels on A4 paper (3-column grid). Stick on each asset after capitalisation.
          </p>
        </div>
        <button
          onClick={handlePrint}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50"
        >
          <Icon name="download" className="w-4 h-4" />
          {loading ? 'Generating QR codes…' : `Print ${assets.length} Labels`}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {assets.map(a => (
          <span key={a.id} className="font-mono text-xs bg-white border border-emerald-200 rounded px-2 py-1 text-emerald-800">
            {a.assetTag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default BulkLabelSheet;