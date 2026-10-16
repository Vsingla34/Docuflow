import { AssetState } from '../types';
import { PageKey } from '../components/layout/nav';

export interface SearchResult {
    id: string;
    type: string;
    label: string;
    sublabel: string;
    page: PageKey;
    /** Only Assets currently support a deep link straight to the record (see AssetRegister.tsx's
     *  `?asset=<id>` handling); every other type just lands on its list page for now. */
    assetId?: string;
}

const MAX_PER_TYPE = 6;

const matches = (q: string, ...fields: (string | undefined | null)[]) =>
    fields.some(f => !!f && f.toLowerCase().includes(q));

/**
 * Searches across the entity types a user would actually look someone/something up by, directly
 * from the already-loaded client state — no extra round-trip to Supabase needed since everything
 * here is already in memory for the current company. Case-insensitive substring match on each
 * type's natural identifiers (tag/code/number/name), capped per type so one noisy match (e.g. a
 * category name that also matches a dozen assets) doesn't crowd out everything else.
 */
export const globalSearch = (state: AssetState, query: string): SearchResult[] => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: SearchResult[] = [];

    state.assets
        .filter(a => matches(q, a.assetTag, a.name, a.serialNumber))
        .slice(0, MAX_PER_TYPE)
        .forEach(a => results.push({ id: a.id, type: 'Asset', label: a.assetTag, sublabel: a.name, page: 'assets', assetId: a.id }));

    state.employees
        .filter(e => matches(q, e.name, e.code, e.email))
        .slice(0, MAX_PER_TYPE)
        .forEach(e => results.push({ id: e.id, type: 'Employee', label: e.name, sublabel: `${e.code} · ${e.email || 'no email'}`, page: 'employees' }));

    state.vendors
        .filter(v => matches(q, v.name, v.code, v.gstin))
        .slice(0, MAX_PER_TYPE)
        .forEach(v => results.push({ id: v.id, type: 'Vendor', label: v.name, sublabel: v.code, page: 'masters' }));

    state.locations
        .filter(l => matches(q, l.name, l.code, l.city))
        .slice(0, MAX_PER_TYPE)
        .forEach(l => results.push({ id: l.id, type: 'Location', label: l.name, sublabel: l.code, page: 'masters' }));

    state.departments
        .filter(d => matches(q, d.name, d.code))
        .slice(0, MAX_PER_TYPE)
        .forEach(d => results.push({ id: d.id, type: 'Department', label: d.name, sublabel: d.code, page: 'masters' }));

    state.categories
        .filter(c => matches(q, c.name, c.code))
        .slice(0, MAX_PER_TYPE)
        .forEach(c => results.push({ id: c.id, type: 'Category', label: c.name, sublabel: c.code, page: 'categories' }));

    state.purchaseOrders
        .filter(po => matches(q, po.poNo))
        .slice(0, MAX_PER_TYPE)
        .forEach(po => results.push({ id: po.id, type: 'Purchase Order', label: po.poNo, sublabel: po.status, page: 'purchaseOrders' }));

    state.requisitions
        .filter(r => matches(q, r.prNo, r.justification))
        .slice(0, MAX_PER_TYPE)
        .forEach(r => results.push({ id: r.id, type: 'Requisition', label: r.prNo, sublabel: r.justification?.slice(0, 60) || r.status, page: 'requisitions' }));

    state.serviceTickets
        .filter(t => matches(q, t.ticketNo, t.faultDescription))
        .slice(0, MAX_PER_TYPE)
        .forEach(t => results.push({ id: t.id, type: 'Service Ticket', label: t.ticketNo, sublabel: t.faultDescription?.slice(0, 60) || t.status, page: 'serviceTickets' }));

    return results;
};