import React from 'react';
import { AssetEvent, AssetEventType } from '../../types';
import { formatDate } from '../../lib/format';
import Icon from '../icons/Icon';

const EVENT_ICON: Partial<Record<AssetEventType, React.ComponentProps<typeof Icon>['name']>> = {
  [AssetEventType.Created]: 'box',
  [AssetEventType.Received]: 'box',
  [AssetEventType.Assigned]: 'users',
  [AssetEventType.Transferred]: 'swap',
  [AssetEventType.Returned]: 'swap',
  [AssetEventType.RepairRaised]: 'wrench',
  [AssetEventType.RepairCompleted]: 'wrench',
  [AssetEventType.ComponentAdded]: 'layers',
  [AssetEventType.ComponentRemoved]: 'layers',
  [AssetEventType.AmcLinked]: 'shield',
  [AssetEventType.GatePassIssued]: 'truck',
  [AssetEventType.GatePassReturned]: 'truck',
  [AssetEventType.Replaced]: 'swap',
  [AssetEventType.Disposed]: 'trash',
  [AssetEventType.Verified]: 'check',
  [AssetEventType.Updated]: 'pencil',
};

/** Vertical audit-trail timeline for an asset's full lifecycle history. */
export const Timeline: React.FC<{ events: AssetEvent[] }> = ({ events }) => {
  const sorted = [...events].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (sorted.length === 0) return <p className="text-sm text-text-light">No history recorded yet.</p>;
  return (
    <ol className="relative border-l-2 border-border ml-3">
      {sorted.map(event => (
        <li key={event.id} className="mb-6 ml-6 last:mb-0">
          <span className="absolute flex items-center justify-center w-7 h-7 bg-primary/10 text-primary rounded-full -left-3.5 ring-4 ring-background">
            <Icon name={EVENT_ICON[event.type] || 'clock'} className="w-3.5 h-3.5" />
          </span>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="font-semibold text-sm text-text-main">{event.title}</p>
            <time className="text-xs text-text-light">{formatDate(event.date)}</time>
          </div>
          <p className="text-sm text-text-light mt-0.5">{event.detail}</p>
          <p className="text-xs text-text-light mt-1">
            by <span className="font-medium text-text-main">{event.actor}</span>
            {event.refNo && <span> · Ref: {event.refNo}</span>}
          </p>
        </li>
      ))}
    </ol>
  );
};

export default Timeline;
