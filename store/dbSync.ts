/**
 * Database persistence for the application state.
 *
 *  - Master data (categories, variants, locations, departments, vendors, employees, custom
 *    roles) is written directly by the save* functions in AssetStore, each to its own dedicated
 *    table.
 *  - Everything else (assets, requisitions, POs, GRNs, transfers, gate passes, AMC, tickets,
 *    replacements, disposals, DOA, audits, projects, components, activity, counters, asset
 *    history) is persisted by this engine: every change to the in-memory state is detected
 *    and written to Supabase (`assets` table for assets, `app_records` for the rest).
 *
 * Custom roles (`customRoles`) were moved OUT of this generic app_records engine and into their
 * own `custom_roles` table (see AssetStore's saveCustomRole/deleteCustomRole): `user_companies.
 * custom_role_id` and `create_app_user`'s p_custom_role_id both carry a foreign key to
 * `custom_roles.id`, which a JSON blob living in app_records could never satisfy — assigning a
 * role to a user would either never actually persist or fail outright.
 *
 * Nothing is stored in localStorage.
 */
import { supabase } from '../lib/supabase';
import { Asset, AssetState } from '../types';

/** State collections stored one-row-per-record in `app_records`. */
export const DOC_COLLECTIONS = [
  'components', 'requisitions', 'purchaseOrders', 'grns', 'transfers', 'gatePasses',
  'amcContracts', 'amcVisits', 'serviceTickets', 'replacements', 'disposals',
  'doaRules', 'delegations', 'auditPlans', 'projects', 'activity',
] as const;
export type DocCollection = typeof DOC_COLLECTIONS[number];

export const COUNTERS_COLLECTION = 'counters';
export const ASSET_META_COLLECTION = 'assetMeta';
/** Admin-configured prefix/suffix numbering rules (Settings page) — a single JSON-blob doc,
 * persisted and synced exactly like `counters` above (same reasons: it's one small object, not
 * a list of records, so a dedicated table/row-per-record would be overkill). */
export const NUMBERING_RULES_COLLECTION = 'numberingRules';

export const isUuid = (id?: string | null): id is string =>
  !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const uuidOrNull = (id?: string | null) => (isUuid(id) ? id : null);

// ---------------------------------------------------------------------------
// Asset <-> `assets` row mapping
// ---------------------------------------------------------------------------

export function assetToRow(a: Asset, companyId: string) {
  return {
    id: a.id,
    company_id: companyId,
    name: a.name,
    asset_tag: a.assetTag,
    category_id: a.categoryId,
    variant_id: uuidOrNull(a.variantId),
    serial_number: a.serialNumber || null,
    status: a.status,
    condition: a.condition,
    criticality: a.criticality,
    custodian_id: uuidOrNull(a.custodianId),
    department_id: a.departmentId,
    location_id: a.locationId,
    sub_location: a.subLocation || null,
    vendor_id: uuidOrNull(a.vendorId),
    po_no: a.poNo || null,
    grn_no: a.grnNo || null,
    invoice_no: a.invoiceNo || null,
    purchase_date: a.purchaseDate,
    capitalized_on: a.capitalizedOn || a.purchaseDate,
    purchase_cost: a.purchaseCost,
    warranty_expiry: a.warrantyExpiry || null,
    useful_life_years: a.usefulLifeYears,
    salvage_value_pct: a.salvageValuePct,
    depreciation_method: a.depreciationMethod,
    amc_contract_id: uuidOrNull(a.amcContractId),
    parent_asset_id: uuidOrNull(a.parentAssetId),
    insurance_policy_no: a.insurancePolicyNo || null,
    insurance_expiry: a.insuranceExpiry || null,
    last_verified_on: a.lastVerifiedOn || null,
    last_verified_by: a.lastVerifiedBy || null,
    remarks: a.remarks || null,
    upload_id: uuidOrNull(a.uploadId),
  };
}

export function rowToAsset(a: any): Asset {
  return {
    id: a.id,
    assetTag: a.asset_tag || '',
    name: a.name,
    categoryId: a.category_id,
    variantId: a.variant_id || undefined,
    serialNumber: a.serial_number || '',
    status: a.status,
    condition: a.condition,
    criticality: a.criticality,
    custodianId: a.custodian_id || undefined,
    departmentId: a.department_id,
    locationId: a.location_id,
    subLocation: a.sub_location || undefined,
    vendorId: a.vendor_id || undefined,
    poNo: a.po_no || undefined,
    grnNo: a.grn_no || undefined,
    invoiceNo: a.invoice_no || undefined,
    purchaseDate: a.purchase_date,
    capitalizedOn: a.capitalized_on,
    purchaseCost: Number(a.purchase_cost),
    warrantyExpiry: a.warranty_expiry || undefined,
    usefulLifeYears: Number(a.useful_life_years),
    salvageValuePct: Number(a.salvage_value_pct),
    depreciationMethod: a.depreciation_method,
    amcContractId: a.amc_contract_id || undefined,
    parentAssetId: a.parent_asset_id || undefined,
    insurancePolicyNo: a.insurance_policy_no || undefined,
    insuranceExpiry: a.insurance_expiry || undefined,
    lastVerifiedOn: a.last_verified_on || undefined,
    lastVerifiedBy: a.last_verified_by || undefined,
    remarks: a.remarks || undefined,
    uploadId: a.upload_id || undefined,
    history: [],
  };
}

/** Parts of an asset that have no column in `assets` (history timeline, disposal outcome). */
export const buildAssetMeta = (a: Asset) => ({
  id: a.id,
  history: a.history || [],
  ...(a.disposal ? { disposal: a.disposal } : {}),
  ...(a.amcContractId ? { amcContractId: a.amcContractId } : {}),
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export interface AppRecordRow { collection: string; id: string; data: any }

/** Reads every `app_records` row of a company (newest first), paging past the 1000-row API cap. */
export async function fetchAppRecords(companyId: string): Promise<{ rows: AppRecordRow[]; error: any }> {
  const rows: AppRecordRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('app_records')
      .select('collection,id,data')
      .eq('company_id', companyId)
      .order('seq', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return { rows, error };
    rows.push(...((data as AppRecordRow[]) || []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

// ---------------------------------------------------------------------------
// Write-through engine
// ---------------------------------------------------------------------------

type Op =
  | { kind: 'doc'; key: string; collection: string; id: string; data: any; json: string }
  | { kind: 'docDelete'; key: string; collection: string; id: string }
  | { kind: 'asset'; key: string; id: string; row: any; json: string };

const docKey = (collection: string, id: string) => `d|${collection}|${id}`;
const assetKey = (id: string) => `a|${id}`;
const COUNTERS_KEY = `d|${COUNTERS_COLLECTION}|main`;
const NUMBERING_RULES_KEY = `d|${NUMBERING_RULES_COLLECTION}|main`;
const CHUNK = 200;
const PENDING_DELETE = Symbol('pending-delete');
const DEBOUNCE_MS = 350;

export class SyncEngine {
  /** Scanning is disabled until the initial load from the database has completed. */
  loaded = false;

  /** key -> JSON of what the database currently holds. */
  private known = new Map<string, string>();
  /** key -> object last seen in React state (cheap change detection). */
  private refs = new Map<string, unknown>();
  private pending = new Map<string, Op>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(public readonly companyId: string, private onStatus: (error: string | null) => void) { }

  // -- registration of data that came FROM the database (so it is not written back) -------

  registerDoc(collection: string, id: string, item: unknown) {
    this.known.set(docKey(collection, id), JSON.stringify(item));
  }
  registerAssetRow(asset: Asset) {
    this.known.set(assetKey(asset.id), JSON.stringify(assetToRow(asset, this.companyId)));
  }
  registerAssetMeta(asset: Asset) {
    this.known.set(docKey(ASSET_META_COLLECTION, asset.id), JSON.stringify(buildAssetMeta(asset)));
  }

  // -- change detection -------------------------------------------------------------------

  scan(state: AssetState) {
    if (!this.loaded) return;
    const present = new Set<string>();

    for (const c of DOC_COLLECTIONS) {
      const list = ((state as any)[c] as Array<{ id: string }> | undefined) || [];
      for (const item of list) {
        if (!item || !item.id) continue;
        const key = docKey(c, item.id);
        present.add(key);
        if (this.refs.get(key) === item) continue;
        this.refs.set(key, item);
        const json = JSON.stringify(item);
        if (this.known.get(key) !== json) {
          this.enqueue({ kind: 'doc', key, collection: c, id: item.id, data: item, json });
        } else {
          this.pending.delete(key);
        }
      }
    }

    // records removed from state -> delete from the database
    for (const key of Array.from(this.refs.keys())) {
      if (!key.startsWith('d|') || present.has(key)) continue;
      const [, collection, id] = key.split('|');
      this.refs.delete(key);
      if (this.known.has(key)) this.enqueue({ kind: 'docDelete', key, collection, id });
      else this.pending.delete(key);
    }

    // counters (document numbering)
    if (state.counters && this.refs.get(COUNTERS_KEY) !== state.counters) {
      this.refs.set(COUNTERS_KEY, state.counters);
      const json = JSON.stringify(state.counters);
      if (this.known.get(COUNTERS_KEY) !== json) {
        this.enqueue({ kind: 'doc', key: COUNTERS_KEY, collection: COUNTERS_COLLECTION, id: 'main', data: state.counters, json });
      }
    }

    // numbering rules (Settings page prefix/suffix config)
    if (state.numberingRules && this.refs.get(NUMBERING_RULES_KEY) !== state.numberingRules) {
      this.refs.set(NUMBERING_RULES_KEY, state.numberingRules);
      const json = JSON.stringify(state.numberingRules);
      if (this.known.get(NUMBERING_RULES_KEY) !== json) {
        this.enqueue({ kind: 'doc', key: NUMBERING_RULES_KEY, collection: NUMBERING_RULES_COLLECTION, id: 'main', data: state.numberingRules, json });
      }
    }

    // assets (+ their history timeline)
    for (const a of state.assets || []) {
      const key = assetKey(a.id);
      if (this.refs.get(key) === a) continue;
      this.refs.set(key, a);

      const row = assetToRow(a, this.companyId);
      const json = JSON.stringify(row);
      if (this.known.get(key) !== json) {
        if (isUuid(row.id) && isUuid(row.category_id) && isUuid(row.department_id) && isUuid(row.location_id)) {
          this.enqueue({ kind: 'asset', key, id: a.id, row, json });
        } else {
          console.warn('Asset not saved to database: it references a category/location/department that is not in the database.', a);
        }
      }

      const meta = buildAssetMeta(a);
      const mjson = JSON.stringify(meta);
      const mkey = docKey(ASSET_META_COLLECTION, a.id);
      if (this.known.get(mkey) !== mjson) {
        this.enqueue({ kind: 'doc', key: mkey, collection: ASSET_META_COLLECTION, id: a.id, data: meta, json: mjson });
      }
    }
  }

  private enqueue(op: Op) {
    this.pending.set(op.key, op);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, DEBOUNCE_MS);
  }

  // -- writing ----------------------------------------------------------------------------

  flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.pending.size === 0) return this.chain;
    const ops = Array.from(this.pending.values());
    this.pending.clear();
    this.chain = this.chain.then(() => this.send(ops)).catch(() => undefined);
    return this.chain;
  }

  private async send(ops: Op[]) {
    const errors: string[] = [];
    const fail = (list: Op[], message: string, err: unknown) => {
      console.error('Failed to save to database:', message, err);
      errors.push(message);
      // forget what we saw so the next state change re-detects and retries these records
      for (const op of list) {
        if (op.kind === 'docDelete') this.refs.set(op.key, PENDING_DELETE); // stays in `refs` but absent from state -> delete retried
        else this.refs.delete(op.key);
      }
    };

    // 1. assets
    const assetOps = ops.filter((o): o is Extract<Op, { kind: 'asset' }> => o.kind === 'asset');
    for (let i = 0; i < assetOps.length; i += CHUNK) {
      const part = assetOps.slice(i, i + CHUNK);
      const { error } = await supabase.from('assets').upsert(part.map(o => o.row));
      if (error) fail(part, `assets: ${error.message}`, error);
      else part.forEach(o => this.known.set(o.key, o.json));
    }

    // 2. documents
    const docOps = ops.filter((o): o is Extract<Op, { kind: 'doc' }> => o.kind === 'doc');
    for (let i = 0; i < docOps.length; i += CHUNK) {
      const part = docOps.slice(i, i + CHUNK);
      const { error } = await supabase.from('app_records').upsert(
        part.map(o => ({ company_id: this.companyId, collection: o.collection, id: o.id, data: o.data })),
        { onConflict: 'company_id,collection,id' },
      );
      if (error) fail(part, `${error.message}`, error);
      else part.forEach(o => this.known.set(o.key, o.json));
    }

    // 3. deletions
    const delOps = ops.filter((o): o is Extract<Op, { kind: 'docDelete' }> => o.kind === 'docDelete');
    const byCollection = new Map<string, Array<Extract<Op, { kind: 'docDelete' }>>>();
    delOps.forEach(o => byCollection.set(o.collection, [...(byCollection.get(o.collection) || []), o]));
    for (const [collection, list] of byCollection) {
      for (let i = 0; i < list.length; i += CHUNK) {
        const part = list.slice(i, i + CHUNK);
        const { error } = await supabase.from('app_records').delete()
          .eq('company_id', this.companyId).eq('collection', collection).in('id', part.map(o => o.id));
        if (error) fail(part, `${error.message}`, error);
        else part.forEach(o => this.known.delete(o.key));
      }
    }

    this.onStatus(errors.length ? `Some changes could not be saved to the database: ${errors[0]}` : null);
  }
}