import React, { useEffect, useRef, useState } from 'react';
import { Asset } from '../../types';
import { generateQrDataUrl, assetLookupUrl } from '../../lib/qr';
import { formatDate, formatCurrency } from '../../lib/format';
import Icon from '../icons/Icon';

export interface AssetLabelProps {
  asset: Asset;
  companyName: string;
  companyLogoUrl?: string;
  categoryName: string;
  locationName: string;
}

/**
 * Renders a physical asset label card (on-screen preview) and provides a
 * "Download / Print" button that opens the browser print dialog showing only
 * the label in a clean A6-portrait format.
 */
const AssetLabel: React.FC<AssetLabelProps> = ({
  asset, companyName, companyLogoUrl, categoryName, locationName,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const lookupUrl = assetLookupUrl(asset.assetTag);
    generateQrDataUrl(lookupUrl)
      .then(url => { setQrUrl(url); setLoading(false); })
      .catch(() => setLoading(false));
  }, [asset.assetTag]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const printWin = window.open('', '_blank', 'width=420,height=600');
    if (!printWin) return;
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Label – ${asset.assetTag}</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
            .label-wrap {
              width: 90mm; min-height: 55mm;
              border: 1.5px solid #0F172A;
              border-radius: 6px;
              padding: 10px 12px;
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            .header {
              display: flex;
              align-items: center;
              gap: 8px;
              border-bottom: 1px solid #E2E8F0;
              padding-bottom: 6px;
            }
            .logo { width: 32px; height: 32px; object-fit: contain; }
            .company { font-size: 11px; font-weight: 700; color: #0F172A; }
            .body-row {
              display: flex;
              align-items: flex-start;
              gap: 10px;
            }
            .qr { width: 72px; height: 72px; flex-shrink: 0; }
            .meta { flex: 1; }
            .tag { font-size: 17px; font-weight: 800; color: #0F172A; letter-spacing: 0.5px; }
            .name { font-size: 10px; color: #334155; margin-top: 2px; }
            .detail { font-size: 9px; color: #64748B; margin-top: 1px; }
            .footer {
              border-top: 1px solid #E2E8F0;
              padding-top: 5px;
              font-size: 9px;
              color: #94A3B8;
              text-align: center;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${content}
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-4">
      {/* On-screen preview */}
      <div
        ref={printRef}
        className="label-wrap bg-white border-2 border-slate-800 rounded-xl p-4 w-[340px] shadow-md"
        style={{ fontFamily: "'Inter','Segoe UI',sans-serif" }}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt="logo" className="w-9 h-9 object-contain rounded" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white">
              <Icon name="box" className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="company text-[11px] font-bold text-slate-800 leading-tight uppercase tracking-wide">{companyName}</p>
            <p className="text-[9px] text-slate-400 leading-none">Asset Lifecycle Management</p>
          </div>
        </div>

        {/* Body: QR + meta */}
        <div className="flex items-start gap-3 py-2">
          {loading ? (
            <div className="w-20 h-20 bg-slate-100 rounded animate-pulse shrink-0" />
          ) : qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="qr w-20 h-20 shrink-0 rounded border border-slate-200" />
          ) : null}
          <div className="flex-1 min-w-0">
            <p className="tag text-[18px] font-black text-slate-900 tracking-wide font-mono leading-tight">{asset.assetTag}</p>
            <p className="name text-[11px] text-slate-600 mt-1 leading-tight line-clamp-2">{asset.name}</p>
            <div className="mt-2 space-y-0.5">
              <p className="detail text-[9px] text-slate-400"><span className="font-semibold text-slate-600">Category:</span> {categoryName}</p>
              <p className="detail text-[9px] text-slate-400"><span className="font-semibold text-slate-600">Location:</span> {locationName}</p>
              {asset.serialNumber && (
                <p className="detail text-[9px] text-slate-400"><span className="font-semibold text-slate-600">S/N:</span> {asset.serialNumber}</p>
              )}
              <p className="detail text-[9px] text-slate-400"><span className="font-semibold text-slate-600">Cap. Date:</span> {formatDate(asset.capitalizedOn)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-2 text-center">
          <p className="footer text-[9px] text-slate-400">Scan QR or enter tag at Asset Portal for full details</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrint}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          <Icon name="download" className="w-4 h-4" />
          Print / Download Label
        </button>
        <p className="text-xs text-text-light">Opens browser print dialog — use "Save as PDF" to download</p>
      </div>
    </div>
  );
};

export default AssetLabel;
