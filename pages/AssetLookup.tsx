import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssetStore } from '../store/AssetStore';
import { Asset, UserRole, AssetStatus, AssetCondition, Criticality } from '../types';
import { PageKey, PAGE_PATHS } from '../components/layout/nav';
import { formatDate, formatCurrency } from '../lib/format';
import { computeDepreciation } from '../lib/depreciation';
import { AssetStatusBadge, ConditionBadge, CriticalityBadge } from '../components/ui/Badge';
import Timeline from '../components/ui/Timeline';
import AssetLabel from '../components/ui/AssetLabel';
import Icon from '../components/icons/Icon';
import QrScannerModal from '../components/ui/QrScannerModal';

/**
 * A scanned QR code is either a bare tag/serial (if someone encoded one directly) or — far more
 * commonly, since that's what lib/qr.ts's assetLookupUrl produces for every printed label — a
 * full URL ending in #lookup/<tag>. Pull the tag out of either shape instead of assuming one.
 */
const parseScannedValue = (raw: string): string => {
  const trimmed = raw.trim();
  const hashMatch = trimmed.match(/#lookup\/([^/?#]+)/i);
  if (hashMatch) {
    try {
      return decodeURIComponent(hashMatch[1]);
    } catch {
      return hashMatch[1];
    }
  }
  // Not a lookup URL — could still be some other URL a QR happens to encode, in which case
  // there's no tag to extract. Otherwise treat the raw text as the tag itself.
  if (/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
};

const AssetLookup: React.FC<{ onNavigate: (page: PageKey) => void }> = () => {
  const { state, currentUser, companyName: storeCompanyName, companyLogoUrl: storeCompanyLogoUrl } = useAssetStore();
  const { assets, categories, locations, departments, employees, vendors } = state;
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Asset | null | 'not-found'>(null);
  const [showLabel, setShowLabel] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-read hash-based deep-link: #lookup/ITL-HO-0001
  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#lookup\/(.+)$/);
      if (match) {
        const tag = decodeURIComponent(match[1]);
        setQuery(tag);
        doSearch(tag);
      }
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [assets]);

  const doSearch = (tag: string) => {
    const q = tag.trim().toUpperCase();
    if (!q) { setFound(null); return; }
    const asset = assets.find(
      a => a.assetTag.toUpperCase() === q || a.serialNumber.toUpperCase() === q
    );
    setFound(asset || 'not-found');
  };

  const handleSearch = () => doSearch(query);

  const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const handleScanDetected = (raw: string) => {
    const tag = parseScannedValue(raw);
    setScanning(false);
    if (!tag) {
      setFound('not-found');
      return;
    }
    setQuery(tag.toUpperCase());
    doSearch(tag);
  };

  // Helpers
  const nameOf = (id: string | undefined, list: { id: string; name: string }[], fallback = '—') =>
    list.find(x => x.id === id)?.name || fallback;

  const isEmployee = currentUser.role === UserRole.EMPLOYEE;
  const isAuditor = currentUser.role === UserRole.AUDITOR || currentUser.role === UserRole.SUPERADMIN;
  const isAdmin = currentUser.role === UserRole.SUPERADMIN || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGEMENT;

  const asset = found && found !== 'not-found' ? found : null;
  const dep = asset ? computeDepreciation(asset, undefined, state.depreciationRateRules) : null;

  const companyName: string = storeCompanyName || 'Your Company';
  const companyLogoUrl: string | undefined = storeCompanyLogoUrl || undefined;

  const categoryName = asset ? nameOf(asset.categoryId, categories) : '';
  const locationName = asset ? nameOf(asset.locationId, locations) : '';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Search bar */}
      <div className="bg-card rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="scan" className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-main">Asset Tag Lookup</h2>
            <p className="text-xs text-text-light">Enter an asset tag or serial number, or scan a QR code</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="e.g.  ITL-HO-0007  or  SN-ABC123"
            className="flex-1 px-4 py-3 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
          />
          <button
            onClick={handleSearch}
            className="bg-primary text-white px-5 py-3 rounded-lg font-semibold text-sm hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <Icon name="search" className="w-4 h-4" />
            Look Up
          </button>
          {cameraSupported && (
            <button
              onClick={() => setScanning(true)}
              className="bg-slate-100 text-slate-700 px-5 py-3 rounded-lg font-semibold text-sm hover:bg-slate-200 transition-colors flex items-center gap-2 shrink-0"
              title="Scan a QR code with your camera"
            >
              <Icon name="camera" className="w-4 h-4" />
              Scan QR
            </button>
          )}
        </div>

        <p className="text-xs text-text-light mt-2">
          <Icon name="scan" className="w-3.5 h-3.5 inline mr-1" />
          {cameraSupported
            ? 'Click "Scan QR" to use your device camera, or scan a printed label with your phone\'s camera app — either way it auto-fills and searches'
            : 'Scan a printed label with your phone\'s camera app — it will open this page with the tag auto-filled and searched'}
        </p>
      </div>

      {scanning && (
        <QrScannerModal onDetected={handleScanDetected} onClose={() => setScanning(false)} />
      )}

      {/* Not found */}
      {found === 'not-found' && (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <Icon name="alert" className="w-7 h-7 text-red-500" />
          </div>
          <p className="font-semibold text-text-main">No asset found</p>
          <p className="text-sm text-text-light mt-1">
            Tag <span className="font-mono text-slate-800">"{query}"</span> does not match any asset in the system.
          </p>
        </div>
      )}

      {/* Found asset */}
      {asset && dep && (
        <div className="space-y-4">
          {/* Identity card */}
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-2xl font-black tracking-wider">{asset.assetTag}</p>
                  <p className="text-white/80 text-sm mt-1">{asset.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <AssetStatusBadge status={asset.status} className="text-xs" />
                  {isAdmin && (
                    <button
                      onClick={() => navigate(`${PAGE_PATHS.assets}?asset=${encodeURIComponent(asset.id)}`)}
                      className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Open Record →
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Basic info — visible to all */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                <InfoRow label="Category" value={categoryName} />
                <InfoRow label="Location" value={locationName} />
                <InfoRow label="Department" value={nameOf(asset.departmentId, departments)} />
                <InfoRow label="Condition" value={<ConditionBadge condition={asset.condition} />} />
                <InfoRow label="Criticality" value={<CriticalityBadge criticality={asset.criticality} />} />
                {asset.warrantyExpiry && (
                  <InfoRow label="Warranty Expiry" value={formatDate(asset.warrantyExpiry)} />
                )}
              </div>

              {/* Employee-restricted: hide financial details */}
              {!isEmployee && (
                <>
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">Financial Details</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                      <InfoRow label="Purchase Cost" value={formatCurrency(asset.purchaseCost)} />
                      <InfoRow label="Net Book Value" value={formatCurrency(dep.netBookValue)} />
                      <InfoRow label="Depreciation" value={`${dep.percentDepreciated}% (${asset.depreciationMethod})`} />
                      <InfoRow label="Capitalised On" value={formatDate(asset.capitalizedOn)} />
                      <InfoRow label="Purchase Date" value={formatDate(asset.purchaseDate)} />
                      {asset.serialNumber && <InfoRow label="Serial No." value={<span className="font-mono">{asset.serialNumber}</span>} />}
                    </div>
                  </div>

                  {/* Procurement refs — Admin / Mgmt / Auditor */}
                  {(isAdmin || isAuditor) && (
                    <div className="border-t border-border pt-4">
                      <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">Procurement References</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                        {asset.poNo && <InfoRow label="PO No." value={<span className="font-mono">{asset.poNo}</span>} />}
                        {asset.grnNo && <InfoRow label="GRN No." value={<span className="font-mono">{asset.grnNo}</span>} />}
                        {asset.invoiceNo && <InfoRow label="Invoice No." value={<span className="font-mono">{asset.invoiceNo}</span>} />}
                        {asset.vendorId && <InfoRow label="Vendor" value={nameOf(asset.vendorId, vendors)} />}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Custodian info — everyone can see this */}
              {asset.custodianId && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">Current Custodian</p>
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://i.pravatar.cc/40?u=${asset.custodianId}`}
                      alt=""
                      className="w-9 h-9 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-sm">{nameOf(asset.custodianId, employees)}</p>
                      <p className="text-xs text-text-light">{nameOf(asset.departmentId, departments)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Asset history / timeline — visible to all (events are generic) */}
          <div className="bg-card rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-main">Asset History</h3>
              <span className="text-xs text-text-light">{asset.history.length} event{asset.history.length !== 1 ? 's' : ''}</span>
            </div>
            {asset.history.length > 0 ? (
              <Timeline events={asset.history} />
            ) : (
              <p className="text-sm text-text-light">No history recorded yet.</p>
            )}
          </div>

          {/* Print label — Admin / Mgmt only */}
          {isAdmin && (
            <div className="bg-card rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-text-main mb-4">Asset Label</h3>
              <button
                onClick={() => setShowLabel(v => !v)}
                className="text-sm text-primary font-semibold hover:underline mb-4 block"
              >
                {showLabel ? 'Hide label preview' : 'Show label preview & print'}
              </button>
              {showLabel && (
                <AssetLabel
                  asset={asset}
                  companyName={companyName}
                  companyLogoUrl={companyLogoUrl}
                  categoryName={categoryName}
                  locationName={locationName}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-text-light">{label}</p>
    <div className="font-medium text-text-main mt-0.5">{value}</div>
  </div>
);

export default AssetLookup; 