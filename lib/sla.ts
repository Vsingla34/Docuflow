import { DocStatus, ServiceTicket, TicketPriority } from '../types';
import { addDays, daysBetween, daysFromToday } from './format';

/**
 * Service-ticket SLA tracking. Part of the Week 2-4 remediation backlog: tickets already carried
 * a `priority` field, but nothing turned that into an actual time commitment or surfaced when one
 * was missed — a Critical and a Low priority fault were tracked identically once raised. This adds
 * a response/resolution-time commitment per priority, in calendar days from when the fault was
 * reported, consistent with the rest of the app's day-level (not hour-level) date model.
 *
 * The day counts below are reasonable defaults, not numbers pulled from any existing policy —
 * adjust SLA_DAYS_BY_PRIORITY to match your organisation's actual commitments.
 */
export const SLA_DAYS_BY_PRIORITY: Record<TicketPriority, number> = {
  [TicketPriority.Critical]: 1,
  [TicketPriority.High]: 3,
  [TicketPriority.Medium]: 7,
  [TicketPriority.Low]: 14,
};

const OPEN_STATUSES: DocStatus[] = [DocStatus.Open, DocStatus.InProgress, DocStatus.PendingApproval];
// Terminal states that aren't a real outcome to grade against the SLA (the fault was never
// actually worked, so there's nothing to call "on time" or "late").
const NOT_APPLICABLE_STATUSES: DocStatus[] = [DocStatus.Rejected, DocStatus.Cancelled];

export const slaDueDate = (ticket: ServiceTicket): string => addDays(ticket.reportedOn, SLA_DAYS_BY_PRIORITY[ticket.priority]);

export type SlaState = 'on-track' | 'due-soon' | 'breached' | 'met' | 'not-applicable';

/** Where a ticket stands against its SLA right now (open tickets) or ended up (closed ones). */
export const slaState = (ticket: ServiceTicket): SlaState => {
  if (NOT_APPLICABLE_STATUSES.includes(ticket.status)) return 'not-applicable';

  const due = slaDueDate(ticket);

  if (!OPEN_STATUSES.includes(ticket.status)) {
    // Resolved (or any other terminal status) — grade against the day it was actually closed,
    // not today. No recorded close date is treated as met rather than guessed at.
    if (!ticket.closedOn) return 'met';
    return daysBetween(due, ticket.closedOn) > 0 ? 'breached' : 'met';
  }

  const daysLeft = daysFromToday(due);
  if (daysLeft === null) return 'on-track';
  if (daysLeft < 0) return 'breached';
  if (daysLeft <= 1) return 'due-soon';
  return 'on-track';
};

/** Short, human label for the SLA pill shown on the ticket list and detail drawer. */
export const slaLabel = (ticket: ServiceTicket): string => {
  const state = slaState(ticket);
  const due = slaDueDate(ticket);
  const daysLeft = daysFromToday(due) ?? 0;

  switch (state) {
    case 'breached': {
      const over = Math.abs(daysLeft);
      return OPEN_STATUSES.includes(ticket.status)
        ? `SLA breached · ${over} day${over === 1 ? '' : 's'} overdue`
        : 'Closed — SLA breached';
    }
    case 'due-soon':
      return daysLeft <= 0 ? 'SLA due today' : `SLA due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    case 'on-track':
      return `SLA due in ${daysLeft} days`;
    case 'met':
      return 'Closed within SLA';
    case 'not-applicable':
    default:
      return '—';
  }
};

export const slaTone = (state: SlaState): 'red' | 'amber' | 'slate' | 'green' | 'gray' => {
  switch (state) {
    case 'breached': return 'red';
    case 'due-soon': return 'amber';
    case 'met': return 'green';
    case 'on-track': return 'slate';
    case 'not-applicable':
    default: return 'gray';
  }
};

/** Every currently-open ticket that has missed its SLA — used for the dashboard count and the
 *  notification bell, same shape as the existing AMC-renewal / overdue-gate-pass alerts. */
export const breachedOpenTickets = (tickets: ServiceTicket[]): ServiceTicket[] =>
  tickets.filter(t => OPEN_STATUSES.includes(t.status) && slaState(t) === 'breached');