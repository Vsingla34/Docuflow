import React, { useState } from 'react';
import { ApprovalDocType, ApprovalStatus, ApprovalStep, DoaDelegation, Employee, User } from '../../types';
import { canAct, currentStep } from '../../lib/doa';
import { formatCurrency } from '../../lib/format';
import { Icon } from '../icons/Icon';
import { PrimaryButton, SecondaryButton, TextArea } from './FormControls';

const STEP_TONE: Record<ApprovalStatus, string> = {
  [ApprovalStatus.Pending]: 'border-amber-300 bg-amber-50 text-amber-700',
  [ApprovalStatus.Approved]: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  [ApprovalStatus.Rejected]: 'border-red-300 bg-red-50 text-red-700',
  [ApprovalStatus.Skipped]: 'border-slate-200 bg-slate-50 text-slate-400',
};

/**
 * Renders a document's DOA approval chain and, when the signed-in user (or
 * someone who has delegated to them) is the current pending approver, an
 * inline Approve / Reject action.
 */
export const ApprovalChain: React.FC<{
  approvals: ApprovalStep[];
  docType: ApprovalDocType;
  amount?: number;
  initiatorId?: string;
  currentUser: User;
  employees: Employee[];
  delegations: DoaDelegation[];
  onDecide?: (decision: ApprovalStatus.Approved | ApprovalStatus.Rejected, remarks?: string) => void;
}> = ({ approvals, docType, amount, initiatorId, currentUser, employees, delegations, onDecide }) => {
  const [remarks, setRemarks] = useState('');
  const step = currentStep(approvals);
  const right = canAct(currentUser, step, { docType, delegations, employees, initiatorId });

  if (approvals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-sm text-text-light">
        No approval required{typeof amount === 'number' ? ` — ${formatCurrency(amount)} is within initiator's own authority.` : ' (within DOA limit).'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {approvals.map(s => (
          <li key={s.level} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${STEP_TONE[s.status]}`}>
            <div className="min-w-0">
              <p className="font-semibold">
                L{s.level} · {s.approverTitle} <span className="font-normal opacity-70">({s.approverRole})</span>
              </p>
              {s.actedBy && (
                <p className="text-xs mt-0.5 opacity-80">
                  {s.status} by {s.actedBy}{s.onBehalfOf ? ` (on behalf of ${s.onBehalfOf})` : ''} · {s.actedOn}
                </p>
              )}
              {s.remarks && <p className="text-xs mt-0.5 italic opacity-80">"{s.remarks}"</p>}
            </div>
            <span className="shrink-0 text-xs font-bold uppercase tracking-wide">{s.status}</span>
          </li>
        ))}
      </ol>

      {step && onDecide && (
        <div className="rounded-lg border border-border bg-slate-50 p-3 space-y-2">
          {right.allowed ? (
            <>
              <p className="text-xs text-text-light">
                Acting as <span className="font-semibold text-text-main">{step.approverTitle}</span>
                {right.onBehalfOf && <span> on behalf of {right.onBehalfOf} (delegated)</span>}
              </p>
              <TextArea rows={2} placeholder="Remarks (optional)" value={remarks} onChange={e => setRemarks(e.target.value)} />
              <div className="flex gap-2">
                <PrimaryButton icon={<Icon name="check" className="w-4 h-4" />} onClick={() => { onDecide(ApprovalStatus.Approved, remarks); setRemarks(''); }}>
                  Approve
                </PrimaryButton>
                <SecondaryButton className="!text-red-600 !border-red-200 hover:!bg-red-50" icon={<Icon name="close" className="w-4 h-4" />} onClick={() => { onDecide(ApprovalStatus.Rejected, remarks); setRemarks(''); }}>
                  Reject
                </SecondaryButton>
              </div>
            </>
          ) : (
            <p className="text-xs text-text-light flex items-center gap-1.5">
              <Icon name="clock" className="w-4 h-4 shrink-0" /> {right.reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ApprovalChain;
