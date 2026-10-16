import { fiscalYear } from './format';
import { NumberingEntityKind, NumberingRule, NumberingRules } from '../types';

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
  project: 'CWIP',
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
 * Legacy asset tag scheme: CATEGORY-LOCATION-SEQUENCE, e.g. ITL-HO-0007, scoped per category
 * *and* location. No longer called by any creation path (superseded below by a single
 * company-wide running sequence wrapped in the admin's configured prefix/suffix, per the
 * Settings page) -- kept only so a counter key already written under this scheme is never
 * reused/collided with by something else.
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

/**
 * Single company-wide running sequence for auto-generated asset tags (used when the admin
 * leaves the Asset Tag field blank). Replaces the old CATEGORY-LOCATION-SEQUENCE scheme above:
 * the admin's Settings-page prefix/suffix is the whole format now (e.g. "AST-" + this sequence
 * + "" -> AST-0001, AST-0002, ...), the same as Employee ID, Vendor Code and every other ID
 * type on that page, rather than a special composite tag only Asset Tag got.
 */
export const ASSET_TAG_SEQUENCE_KEY = 'TAG-SEQ';

export const nextAssetTagSequence = (
  counters: Record<string, number>,
): { seq: number; counters: Record<string, number> } => {
  const next = (counters[ASSET_TAG_SEQUENCE_KEY] || 0) + 1;
  return { seq: next, counters: { ...counters, [ASSET_TAG_SEQUENCE_KEY]: next } };
};

/** Returns the numeric body of `tag` if it matches `rule`'s prefix/suffix exactly, else null. */
const matchRuleBody = (tag: string, rule: NumberingRule | undefined): number | null => {
  const prefix = (rule?.prefix || '').toUpperCase();
  const suffix = (rule?.suffix || '').toUpperCase();
  const upper = tag.toUpperCase();
  if (prefix && !upper.startsWith(prefix)) return null;
  if (suffix && !upper.endsWith(suffix)) return null;
  const body = upper.slice(prefix.length, suffix ? upper.length - suffix.length : undefined);
  if (!/^\d+$/.test(body)) return null;
  return parseInt(body, 10);
};

/**
 * Catches the counter up to reality. ASSET_TAG_SEQUENCE_KEY is a brand-new counter -- it starts
 * at 0 regardless of whatever asset tags already exist in the database (seed data, the old
 * CATEGORY-LOCATION-SEQUENCE scheme, hand-typed tags, bulk-imported serial numbers, etc.), so the
 * very first auto-generated tag can collide with an existing one (23505 unique-constraint
 * violation on assets_asset_tag_key).
 *
 * Fix: before drawing the next number, find the highest existing tag that actually matches the
 * CURRENTLY CONFIGURED prefix/suffix (e.g. with prefix "AST-", only AST-1001...AST-1006 count --
 * an unrelated tag from a bulk import, like one ending in 4301 with no "AST-" prefix, is ignored,
 * so the sequence stays a tidy continuation of the admin's own scheme instead of jumping to
 * whatever random number happens to exist elsewhere in the register). Only when NOTHING matches
 * the current rule at all (a brand-new rule, or no rule configured yet) does this fall back to
 * scanning every tag's trailing digit run, purely so the very first auto-generated tag still can't
 * collide with something pre-existing. Math.max against the stored counter either way, so this
 * never regresses a counter that's already ahead.
 */
export const seedAssetTagCounter = (
  counters: Record<string, number>,
  assets: { assetTag?: string | null }[],
  rule?: NumberingRule,
): Record<string, number> => {
  let highestMatching = 0;
  let matchedAny = false;
  for (const a of assets) {
    const tag = a.assetTag;
    if (!tag) continue;
    const n = matchRuleBody(tag, rule);
    if (n === null) continue;
    matchedAny = true;
    if (n > highestMatching) highestMatching = n;
  }

  let highestExisting = highestMatching;
  if (!matchedAny) {
    for (const a of assets) {
      const tag = a.assetTag;
      if (!tag) continue;
      const match = tag.match(/(\d+)(?!.*\d)/); // trailing run of digits, if any
      if (!match) continue;
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n) && n > highestExisting) highestExisting = n;
    }
  }

  const current = counters[ASSET_TAG_SEQUENCE_KEY] || 0;
  if (highestExisting > current) {
    return { ...counters, [ASSET_TAG_SEQUENCE_KEY]: highestExisting };
  }
  return counters;
};

// ---------------------------------------------------------------------------
// Admin-configurable prefix/suffix rules (Settings page)
// ---------------------------------------------------------------------------
//
// SERIES/nextDocNo/nextAssetTag above are the app's own fixed, baked-in schemes
// for transaction documents and asset tags. What follows is a second, simpler
// layer on top: an admin can attach a free-text prefix and/or suffix (and an
// optional zero-pad width) to any of the "master" ID types below, so that
// creating a record only requires typing the distinguishing part — the code
// field wraps it automatically. It is deliberately NOT another auto-increment
// sequence (the app already has one of those, per counters/nextAssetTag); it
// is a text-templating convenience on top of whatever the user types.

export const NUMBERING_ENTITY_KINDS: NumberingEntityKind[] = [
  'assetTag', 'employee', 'category', 'location', 'department', 'vendor',
];

export const NUMBERING_ENTITY_LABELS: Record<NumberingEntityKind, string> = {
  assetTag: 'Asset Tag',
  employee: 'Employee ID',
  category: 'Category Code',
  location: 'Location Code',
  department: 'Department Code',
  vendor: 'Vendor Code',
};

const BLANK_RULE: NumberingRule = { prefix: '', suffix: '', padDigits: 0 };

/** Sensible, non-intrusive starting point — every rule is a no-op until an admin edits it, except
 *  Asset Tag, which keeps a 4-digit pad by default so a fresh company still gets 0001, 0002, ...
 *  instead of bare 1, 2, 3 (matching the width the old built-in scheme always used). */
export const DEFAULT_NUMBERING_RULES: NumberingRules = {
  assetTag: { ...BLANK_RULE, padDigits: 4 },
  employee: { ...BLANK_RULE },
  category: { ...BLANK_RULE },
  location: { ...BLANK_RULE },
  department: { ...BLANK_RULE },
  vendor: { ...BLANK_RULE },
};

/** Merges freshly-loaded rules with the defaults so a brand-new entity kind never breaks old data. */
export const mergeNumberingRules = (loaded?: Partial<NumberingRules> | null): NumberingRules => {
  const merged = { ...DEFAULT_NUMBERING_RULES };
  if (loaded) {
    for (const kind of NUMBERING_ENTITY_KINDS) {
      if (loaded[kind]) merged[kind] = { ...BLANK_RULE, ...loaded[kind] };
    }
  }
  return merged;
};

/**
 * Wraps whatever the admin typed with the configured prefix/suffix (and pads it with
 * leading zeros if it's a bare number and padDigits is set). Safe to call with an
 * undefined rule or blank input — both just pass the value through unchanged.
 */
export const applyNumberingRule = (rule: NumberingRule | undefined, raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const isNumeric = /^\d+$/.test(trimmed);
  const body = rule && rule.padDigits > 0 && isNumeric ? trimmed.padStart(rule.padDigits, '0') : trimmed;
  const prefix = rule?.prefix || '';
  const suffix = rule?.suffix || '';
  return `${prefix}${body}${suffix}`.toUpperCase();
};

/** True once an admin has set at least a prefix or a suffix for this kind. */
export const hasNumberingRule = (rule: NumberingRule | undefined): boolean =>
  !!rule && (!!rule.prefix || !!rule.suffix || rule.padDigits > 0);