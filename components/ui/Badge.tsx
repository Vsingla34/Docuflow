import React from 'react';
import { AssetCondition, AssetStatus, Criticality, DocStatus } from '../../types';

const TONE_CLASSES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  teal: 'bg-teal-100 text-teal-700',
  gray: 'bg-gray-100 text-gray-600',
};

/** Generic colored pill for any label. Pick `tone` explicitly, or use the status-aware badges below. */
export const Pill: React.FC<{ label: string; tone?: keyof typeof TONE_CLASSES; className?: string }> = ({ label, tone = 'slate', className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}>{label}</span>
);

const DOC_STATUS_TONE: Record<string, keyof typeof TONE_CLASSES> = {
  [DocStatus.Draft]: 'gray',
  [DocStatus.PendingApproval]: 'amber',
  [DocStatus.Approved]: 'green',
  [DocStatus.Rejected]: 'red',
  [DocStatus.Cancelled]: 'gray',
  [DocStatus.PartiallyReceived]: 'amber',
  [DocStatus.Received]: 'green',
  [DocStatus.Closed]: 'slate',
  [DocStatus.InTransit]: 'blue',
  [DocStatus.Completed]: 'green',
  [DocStatus.Issued]: 'blue',
  [DocStatus.Returned]: 'teal',
  [DocStatus.Overdue]: 'red',
  [DocStatus.Active]: 'green',
  [DocStatus.Expired]: 'red',
  [DocStatus.Terminated]: 'gray',
  [DocStatus.Renewed]: 'purple',
  [DocStatus.Open]: 'amber',
  [DocStatus.InProgress]: 'blue',
  [DocStatus.SentToVendor]: 'indigo',
  [DocStatus.Posted]: 'green',
  [DocStatus.Planned]: 'slate',
  [DocStatus.SignedOff]: 'green',
  [DocStatus.Converted]: 'purple',
};

export const StatusBadge: React.FC<{ status: DocStatus | string; className?: string }> = ({ status, className }) => (
  <Pill label={status} tone={DOC_STATUS_TONE[status] || 'slate'} className={className} />
);

const ASSET_STATUS_TONE: Record<string, keyof typeof TONE_CLASSES> = {
  [AssetStatus.InStore]: 'slate',
  [AssetStatus.InUse]: 'green',
  [AssetStatus.UnderRepair]: 'amber',
  [AssetStatus.InTransit]: 'blue',
  [AssetStatus.IssuedOut]: 'indigo',
  [AssetStatus.AwaitingDisposal]: 'purple',
  [AssetStatus.Sold]: 'gray',
  [AssetStatus.Scrapped]: 'gray',
  [AssetStatus.WrittenOff]: 'red',
  [AssetStatus.Lost]: 'red',
  [AssetStatus.Retired]: 'gray',
};

export const AssetStatusBadge: React.FC<{ status: AssetStatus; className?: string }> = ({ status, className }) => (
  <Pill label={status} tone={ASSET_STATUS_TONE[status] || 'slate'} className={className} />
);

const CONDITION_TONE: Record<string, keyof typeof TONE_CLASSES> = {
  [AssetCondition.New]: 'green',
  [AssetCondition.Good]: 'teal',
  [AssetCondition.Fair]: 'amber',
  [AssetCondition.Poor]: 'red',
  [AssetCondition.Unserviceable]: 'gray',
};

export const ConditionBadge: React.FC<{ condition: AssetCondition; className?: string }> = ({ condition, className }) => (
  <Pill label={condition} tone={CONDITION_TONE[condition] || 'slate'} className={className} />
);

const CRITICALITY_TONE: Record<string, keyof typeof TONE_CLASSES> = {
  [Criticality.High]: 'red',
  [Criticality.Medium]: 'amber',
  [Criticality.Low]: 'slate',
};

export const CriticalityBadge: React.FC<{ criticality: Criticality; className?: string }> = ({ criticality, className }) => (
  <Pill label={criticality} tone={CRITICALITY_TONE[criticality] || 'slate'} className={className} />
);
