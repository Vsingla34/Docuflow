import { fiscalYear } from './format';

/** Document number prefixes, one per transaction series. */
export const SERIES = {
  requisition: 'PR',
  purchaseOrder: 'PO',
  grn: 'GRN',
  transfer: 'TRF',
  gatePass: 'GP',
  amc: 'AMC',
  ticket: 'SRV',
  replacement: 'RPL',
  disposal: 'DSP',
  audit: 'PV',
} as const;

export type SeriesKey = keyof typeof SERIES;

/**
 * Returns the next document number for a series along with the updated counter
 * map. Numbers are scoped to the financial year, e.g. PO/2026-27/0042.
 */
export const nextDocNo = (
  counters: Record<string, number>,
  series: SeriesKey,
): { docNo: string; counters: Record<string, number> } => {
  const prefix = SERIES[series];
  const key = `${prefix}-${fiscalYear()}`;
  const next = (counters[key] || 0) + 1;
  return {
    docNo: `${prefix}/${fiscalYear()}/${String(next).padStart(4, '0')}`,
    counters: { ...counters, [key]: next },
  };
};

/**
 * Asset tags read CATEGORY-LOCATION-SEQUENCE so a tag alone tells a storekeeper
 * what the item is and where it was booked in, e.g. ITL-HO-0007. The sequence
 * is scoped per category *and* location, so every site's tags start at 0001
 * instead of sharing one company-wide counter.
 */
export const nextAssetTag = (
  counters: Record<string, number>,
  categoryCode: string,
  locationCode: string,
): { assetTag: string; counters: Record<string, number> } => {
  const key = `TAG-${categoryCode}-${locationCode}`;
  const next = (counters[key] || 0) + 1;
  return {
    assetTag: `${categoryCode}-${locationCode}-${String(next).padStart(4, '0')}`,
    counters: { ...counters, [key]: next },
  };
};
