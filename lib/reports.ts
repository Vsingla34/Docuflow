import { ApprovalDocType, AssetState, AssetStatus, DocStatus, LIVE_ASSET_STATUSES } from '../types';
import { computeDepreciation } from './depreciation';
import { daysFromToday } from './format';

export interface ValuationRow {
  label: string;
  assetCount: number;
  purchaseCost: number;
  bookValue: number;
}

/** Rolls live-asset book value up by top-level category. */
export const valuationByCategory = (state: AssetState): ValuationRow[] => {
  const topLevel = state.categories.filter(c => !c.parentId);
  const live = state.assets.filter(a => LIVE_ASSET_STATUSES.includes(a.status));
  return topLevel
    .map(cat => {
      const descendantIds = new Set([cat.id, ...state.categories.filter(c => c.parentId === cat.id).map(c => c.id)]);
      const rows = live.filter(a => descendantIds.has(a.categoryId));
      return {
        label: cat.name,
        assetCount: rows.length,
        purchaseCost: rows.reduce((t, a) => t + a.purchaseCost, 0),
        bookValue: rows.reduce((t, a) => t + computeDepreciation(a).netBookValue, 0),
      };
    })
    .filter(r => r.assetCount > 0);
};

/** Rolls live-asset book value up by location. */
export const valuationByLocation = (state: AssetState): ValuationRow[] => {
  const live = state.assets.filter(a => LIVE_ASSET_STATUSES.includes(a.status));
  return state.locations
    .map(loc => {
      const rows = live.filter(a => a.locationId === loc.id);
      return {
        label: loc.name,
        assetCount: rows.length,
        purchaseCost: rows.reduce((t, a) => t + a.purchaseCost, 0),
        bookValue: rows.reduce((t, a) => t + computeDepreciation(a).netBookValue, 0),
      };
    })
    .filter(r => r.assetCount > 0);
};

export interface AmcRenewalRow {
  contractNo: string;
  vendorName: string;
  type: string;
  startDate: string;
  endDate: string;
  daysRemaining: number | null;
  contractValue: number;
  status: DocStatus;
}

export const amcRenewalCalendar = (state: AssetState): AmcRenewalRow[] =>
  state.amcContracts
    .map(c => ({
      contractNo: c.contractNo,
      vendorName: state.vendors.find(v => v.id === c.vendorId)?.name || '—',
      type: c.type,
      startDate: c.startDate,
      endDate: c.endDate,
      daysRemaining: c.status === DocStatus.Active ? daysFromToday(c.endDate) : null,
      contractValue: c.contractValue,
      status: c.status,
    }))
    .sort((a, b) => (a.endDate < b.endDate ? -1 : 1));

export interface ApprovalReportRow {
  docType: ApprovalDocType;
  docNo: string;
  title: string;
  amount: number;
  status: DocStatus;
  pendingWith: string;
}

/** Every approvable document in the system (any status), flattened for the DOA & Approvals report. */
export const allApprovalDocuments = (state: AssetState): ApprovalReportRow[] => {
  const pendingStep = (approvals: { status: string; approverTitle: string }[]) =>
    approvals.find(s => s.status === 'Pending')?.approverTitle || '—';

  const rows: ApprovalReportRow[] = [];
  state.requisitions.forEach(r => rows.push({ docType: ApprovalDocType.Requisition, docNo: r.prNo, title: r.justification, amount: r.estimatedValue, status: r.status, pendingWith: r.status === DocStatus.PendingApproval ? pendingStep(r.approvals) : '—' }));
  state.purchaseOrders.forEach(p => rows.push({ docType: ApprovalDocType.PurchaseOrder, docNo: p.poNo, title: `PO to ${state.vendors.find(v => v.id === p.vendorId)?.name || 'vendor'}`, amount: p.grandTotal, status: p.status, pendingWith: p.status === DocStatus.PendingApproval ? pendingStep(p.approvals) : '—' }));
  state.transfers.forEach(t => rows.push({ docType: ApprovalDocType.Transfer, docNo: t.transferNo, title: t.reason, amount: t.value, status: t.status, pendingWith: t.status === DocStatus.PendingApproval ? pendingStep(t.approvals) : '—' }));
  state.gatePasses.forEach(g => rows.push({ docType: ApprovalDocType.GatePass, docNo: g.gatePassNo, title: `${g.purpose} - ${g.issuedToName}`, amount: g.value, status: g.status, pendingWith: g.status === DocStatus.PendingApproval ? pendingStep(g.approvals) : '—' }));
  state.amcContracts.forEach(c => rows.push({ docType: ApprovalDocType.AmcContract, docNo: c.contractNo, title: `AMC - ${state.vendors.find(v => v.id === c.vendorId)?.name || ''}`, amount: c.contractValue, status: c.status, pendingWith: c.status === DocStatus.PendingApproval ? pendingStep(c.approvals) : '—' }));
  state.serviceTickets.forEach(t => rows.push({ docType: ApprovalDocType.ServiceTicket, docNo: t.ticketNo, title: t.faultDescription, amount: t.estimatedCost, status: t.status, pendingWith: t.status === DocStatus.PendingApproval ? pendingStep(t.approvals) : '—' }));
  state.replacements.forEach(r => rows.push({ docType: ApprovalDocType.Replacement, docNo: r.replacementNo, title: r.reason, amount: r.estimatedCost, status: r.status, pendingWith: r.status === DocStatus.PendingApproval ? pendingStep(r.approvals) : '—' }));
  state.disposals.forEach(d => rows.push({ docType: ApprovalDocType.Disposal, docNo: d.disposalNo, title: d.reason, amount: d.totalRealisedValue, status: d.status, pendingWith: d.status === DocStatus.PendingApproval ? pendingStep(d.approvals) : '—' }));
  return rows;
};

export interface DepreciationSummaryRow {
  assetTag: string;
  name: string;
  category: string;
  status: AssetStatus;
  purchaseCost: number;
  method: string;
  accumulated: number;
  netBookValue: number;
  percentDepreciated: number;
}

export const depreciationSummary = (state: AssetState): DepreciationSummaryRow[] =>
  state.assets
    .filter(a => LIVE_ASSET_STATUSES.includes(a.status))
    .map(a => {
      const dep = computeDepreciation(a);
      return {
        assetTag: a.assetTag,
        name: a.name,
        category: state.categories.find(c => c.id === a.categoryId)?.name || '—',
        status: a.status,
        purchaseCost: dep.cost,
        method: a.depreciationMethod,
        accumulated: Math.round(dep.accumulated),
        netBookValue: Math.round(dep.netBookValue),
        percentDepreciated: dep.percentDepreciated,
      };
    });
