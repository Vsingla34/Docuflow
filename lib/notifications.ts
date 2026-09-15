import { ApprovalDocType, ApprovalStep, AssetState, DocStatus, GatePassType, User } from '../types';
import { canAct, currentStep } from './doa';
import { daysFromToday } from './format';
import { PageKey } from '../components/layout/nav';

export interface PendingApprovalItem {
  docType: ApprovalDocType;
  id: string;
  docNo: string;
  title: string;
  amount: number;
  page: PageKey;
}

/** Every open document across the whole state, flattened with a common shape so the
 * header/dashboard can list "things awaiting approval" without one branch per type. */
export const listPendingApprovals = (state: AssetState): PendingApprovalItem[] => {
  const items: PendingApprovalItem[] = [];

  state.requisitions.forEach(r => {
    if (r.status === DocStatus.PendingApproval) items.push({ docType: ApprovalDocType.Requisition, id: r.id, docNo: r.prNo, title: r.justification, amount: r.estimatedValue, page: 'requisitions' });
  });
  state.purchaseOrders.forEach(po => {
    if (po.status === DocStatus.PendingApproval) items.push({ docType: ApprovalDocType.PurchaseOrder, id: po.id, docNo: po.poNo, title: `PO to vendor`, amount: po.grandTotal, page: 'purchaseOrders' });
  });
  state.transfers.forEach(t => {
    if (t.status === DocStatus.PendingApproval) items.push({ docType: ApprovalDocType.Transfer, id: t.id, docNo: t.transferNo, title: t.reason, amount: t.value, page: 'transfers' });
  });
  state.gatePasses.forEach(g => {
    if (g.status === DocStatus.PendingApproval) items.push({ docType: ApprovalDocType.GatePass, id: g.id, docNo: g.gatePassNo, title: `${g.purpose} - ${g.issuedToName}`, amount: g.value, page: 'gatePasses' });
  });
  state.amcContracts.forEach(c => {
    if (c.status === DocStatus.PendingApproval) items.push({ docType: ApprovalDocType.AmcContract, id: c.id, docNo: c.contractNo, title: `AMC contract`, amount: c.contractValue, page: 'amc' });
  });
  state.serviceTickets.forEach(t => {
    if (t.status === DocStatus.PendingApproval) items.push({ docType: ApprovalDocType.ServiceTicket, id: t.id, docNo: t.ticketNo, title: t.faultDescription, amount: t.estimatedCost, page: 'serviceTickets' });
  });
  state.replacements.forEach(r => {
    if (r.status === DocStatus.PendingApproval) items.push({ docType: ApprovalDocType.Replacement, id: r.id, docNo: r.replacementNo, title: r.reason, amount: r.estimatedCost, page: 'replacements' });
  });
  state.disposals.forEach(d => {
    if (d.status === DocStatus.PendingApproval) items.push({ docType: ApprovalDocType.Disposal, id: d.id, docNo: d.disposalNo, title: d.reason, amount: d.totalRealisedValue, page: 'disposals' });
  });

  return items;
};

/** Narrows the full pending list to the ones this signed-in user (directly, or via delegation) can act on right now. */
export const myPendingApprovals = (state: AssetState, user: User): PendingApprovalItem[] => {
  const all = listPendingApprovals(state);
  const approvalsById = new Map<string, { approvals: ApprovalStep[]; initiatorId?: string }>();
  state.requisitions.forEach(r => approvalsById.set(r.id, { approvals: r.approvals, initiatorId: r.requestedById }));
  state.purchaseOrders.forEach(r => approvalsById.set(r.id, { approvals: r.approvals, initiatorId: r.createdById }));
  state.transfers.forEach(r => approvalsById.set(r.id, { approvals: r.approvals, initiatorId: r.requestedById }));
  state.gatePasses.forEach(r => approvalsById.set(r.id, { approvals: r.approvals, initiatorId: r.issuedById }));
  state.amcContracts.forEach(r => approvalsById.set(r.id, { approvals: r.approvals, initiatorId: r.ownerId }));
  state.serviceTickets.forEach(r => approvalsById.set(r.id, { approvals: r.approvals, initiatorId: r.reportedById }));
  state.replacements.forEach(r => approvalsById.set(r.id, { approvals: r.approvals, initiatorId: r.requestedById }));
  state.disposals.forEach(r => approvalsById.set(r.id, { approvals: r.approvals, initiatorId: r.requestedById }));

  return all.filter(item => {
    const doc = approvalsById.get(item.id);
    if (!doc) return false;
    const step = currentStep(doc.approvals);
    return canAct(user, step, { docType: item.docType, delegations: state.delegations, employees: state.employees, initiatorId: doc.initiatorId }).allowed;
  });
};

export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  severity: 'warning' | 'critical';
  page: PageKey;
}

/** AMC renewals due soon and overdue returnable gate passes — the two "watch this" categories shown in the bell. */
export const listAlerts = (state: AssetState): AlertItem[] => {
  const alerts: AlertItem[] = [];

  state.amcContracts.forEach(c => {
    if (c.status !== DocStatus.Active) return;
    const days = daysFromToday(c.endDate);
    if (days !== null && days <= c.renewalReminderDays) {
      alerts.push({
        id: `amc-${c.id}`,
        title: days < 0 ? `${c.contractNo} has expired` : `${c.contractNo} expires in ${days} day${days === 1 ? '' : 's'}`,
        detail: 'AMC renewal due — raise a renewal before cover lapses.',
        severity: days < 0 ? 'critical' : 'warning',
        page: 'amc',
      });
    }
  });

  state.gatePasses.forEach(g => {
    if (g.type !== GatePassType.Returnable || g.status !== DocStatus.Issued || !g.expectedReturnDate) return;
    const days = daysFromToday(g.expectedReturnDate);
    if (days !== null && days < 0) {
      alerts.push({
        id: `gp-${g.id}`,
        title: `${g.gatePassNo} overdue for return`,
        detail: `Expected back ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago from ${g.issuedToName}.`,
        severity: 'critical',
        page: 'gatePasses',
      });
    }
  });

  return alerts;
};
