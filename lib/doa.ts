import {
  ApprovalDocType,
  ApprovalStatus,
  ApprovalStep,
  DoaDelegation,
  DoaRule,
  DocStatus,
  Employee,
  User,
  UserRole,
} from '../types';
import { nowStamp, today } from './format';

export interface DoaScope {
  categoryIds?: string[];
  locationIds?: string[];
}

/**
 * A rule with no category/location list applies to every document. A scoped
 * rule only applies when the document touches one of the listed masters.
 */
const scopeMatches = (rule: DoaRule, scope: DoaScope): boolean => {
  const categoryOk =
    rule.categoryIds.length === 0 || (scope.categoryIds || []).some(id => rule.categoryIds.includes(id));
  const locationOk =
    rule.locationIds.length === 0 || (scope.locationIds || []).some(id => rule.locationIds.includes(id));
  return categoryOk && locationOk;
};

/**
 * Builds the approval chain for a document from the authority matrix. Every
 * active rule whose value band contains the document amount contributes one
 * step, ordered by level. An empty chain means the document is within the
 * initiating function's own authority and needs no counter-signature.
 */
export const resolveApprovalChain = (
  rules: DoaRule[],
  docType: ApprovalDocType,
  amount: number,
  scope: DoaScope = {},
): ApprovalStep[] =>
  rules
    .filter(rule => rule.active && rule.docType === docType)
    .filter(rule => amount >= rule.minAmount && (rule.maxAmount === null || amount <= rule.maxAmount))
    .filter(rule => scopeMatches(rule, scope))
    .sort((a, b) => a.level - b.level)
    .map(rule => ({
      level: rule.level,
      ruleId: rule.id,
      approverTitle: rule.approverTitle,
      approverRole: rule.approverRole,
      status: ApprovalStatus.Pending,
    }));

/** The step awaiting action, i.e. the lowest level still pending. */
export const currentStep = (approvals: ApprovalStep[]): ApprovalStep | undefined =>
  approvals.filter(step => step.status === ApprovalStatus.Pending).sort((a, b) => a.level - b.level)[0];

export const chainOutcome = (approvals: ApprovalStep[]): DocStatus => {
  if (approvals.some(step => step.status === ApprovalStatus.Rejected)) return DocStatus.Rejected;
  if (approvals.some(step => step.status === ApprovalStatus.Pending)) return DocStatus.PendingApproval;
  return DocStatus.Approved;
};

/** Delegations that are live today and cover the document type. */
export const activeDelegations = (
  delegations: DoaDelegation[],
  docType: ApprovalDocType,
  asOf: string = today(),
): DoaDelegation[] =>
  delegations.filter(
    d => d.active && d.docTypes.includes(docType) && d.fromDate <= asOf && d.toDate >= asOf,
  );

export interface ActRight {
  allowed: boolean;
  /** Set when the user is acting under a delegation rather than their own authority. */
  onBehalfOf?: string;
  reason?: string;
}

/**
 * Decides whether the signed-in user may action the pending step: either the
 * step's role is theirs, or an approver holding that role has delegated it to
 * them for the period. Initiators can never approve their own document.
 */
export const canAct = (
  user: User,
  step: ApprovalStep | undefined,
  options: {
    docType: ApprovalDocType;
    delegations: DoaDelegation[];
    employees: Employee[];
    initiatorId?: string;
  },
): ActRight => {
  if (!step) return { allowed: false, reason: 'No pending approval step.' };

  const me = options.employees.find(e => e.id === user.employeeId);
  if (me && options.initiatorId && me.id === options.initiatorId) {
    return { allowed: false, reason: 'Initiators cannot approve their own document (segregation of duty).' };
  }

  if (user.role === step.approverRole) return { allowed: true };

  if (me) {
    const delegation = activeDelegations(options.delegations, options.docType).find(d => {
      if (d.toEmployeeId !== me.id) return false;
      const from = options.employees.find(e => e.id === d.fromEmployeeId);
      return from?.role === step.approverRole;
    });
    if (delegation) {
      const from = options.employees.find(e => e.id === delegation.fromEmployeeId);
      return { allowed: true, onBehalfOf: from?.name };
    }
  }

  return {
    allowed: false,
    reason: `This step must be actioned by ${step.approverTitle} (${step.approverRole}).`,
  };
};

/** Records a decision against the current step and returns the updated chain. */
export const applyDecision = (
  approvals: ApprovalStep[],
  decision: ApprovalStatus.Approved | ApprovalStatus.Rejected,
  actor: string,
  remarks?: string,
  onBehalfOf?: string,
): ApprovalStep[] => {
  const step = currentStep(approvals);
  if (!step) return approvals;
  return approvals.map(row =>
    row.level === step.level && row.status === ApprovalStatus.Pending
      ? { ...row, status: decision, actedBy: actor, actedOn: nowStamp(), remarks, onBehalfOf }
      : decision === ApprovalStatus.Rejected && row.status === ApprovalStatus.Pending
        ? { ...row, status: ApprovalStatus.Skipped }
        : row,
  );
};

/** Highest value a role can clear for a document type — used by the DOA matrix view. */
export const authorityLimit = (
  rules: DoaRule[],
  role: UserRole,
  docType: ApprovalDocType,
): number | null => {
  const matching = rules.filter(r => r.active && r.docType === docType && r.approverRole === role);
  if (matching.length === 0) return 0;
  if (matching.some(r => r.maxAmount === null)) return null;
  return Math.max(...matching.map(r => r.maxAmount || 0));
};

export const describeChain = (approvals: ApprovalStep[]): string => {
  if (approvals.length === 0) return 'No approval required (within DOA limit)';
  return approvals.map(step => `L${step.level} ${step.approverTitle}`).join(' → ');
};
