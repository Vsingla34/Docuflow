import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { ActivityEntry, UserRole } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, SearchInput, FilterSelect } from '../components/ui/Table';
import { Pill } from '../components/ui/Badge';
import { SecondaryButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import Icon from '../components/icons/Icon';
import { formatDate } from '../lib/format';
import { exportToCsv } from '../lib/csv';
import { exportTableToPdf } from '../lib/pdf';

const SEVERITY_TONE: Record<string, 'red' | 'amber' | 'slate'> = { critical: 'red', warning: 'amber', info: 'slate' };

const exportColumns = [
  { header: 'When', value: (a: ActivityEntry) => a.timestamp },
  { header: 'Actor', value: (a: ActivityEntry) => a.actor },
  { header: 'Role', value: (a: ActivityEntry) => a.actorRole },
  { header: 'Action', value: (a: ActivityEntry) => a.action },
  { header: 'Entity Type', value: (a: ActivityEntry) => a.entityType },
  { header: 'Reference', value: (a: ActivityEntry) => a.entityNo || '' },
  { header: 'Summary', value: (a: ActivityEntry) => a.summary },
  { header: 'Severity', value: (a: ActivityEntry) => a.severity },
];

const ActivityLog: React.FC = () => {
  const { state } = useAssetStore();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  const entityTypes = Array.from(new Set(state.activity.map(a => a.entityType))).sort();

  const filtered = state.activity.filter(a => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || a.summary.toLowerCase().includes(q) || a.actor.toLowerCase().includes(q) || (a.entityNo || '').toLowerCase().includes(q);
    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;
    const matchesEntity = entityFilter === 'all' || a.entityType === entityFilter;
    return matchesSearch && matchesSeverity && matchesEntity;
  });

  return (
    <div>
      <ListToolbar title="Activity Log" count={filtered.length}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search activity..." />
        <FilterSelect value={entityFilter} onChange={setEntityFilter} options={[{ value: 'all', label: 'All types' }, ...entityTypes.map(t => ({ value: t, label: t }))]} />
        <FilterSelect value={severityFilter} onChange={setSeverityFilter} options={[{ value: 'all', label: 'All severities' }, { value: 'critical', label: 'Critical' }, { value: 'warning', label: 'Warning' }, { value: 'info', label: 'Info' }]} />
        <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={() => exportToCsv('activity-log', exportColumns, filtered)}>CSV</SecondaryButton>
        <SecondaryButton icon={<Icon name="download" className="w-4 h-4" />} onClick={() => exportTableToPdf('activity-log', 'Activity Log', exportColumns, filtered)}>PDF</SecondaryButton>
      </ListToolbar>

      {filtered.length === 0 ? <EmptyState icon="history" title="No activity found" /> : (
        <TableCard>
          <THead columns={['When', 'Actor', 'Action', 'Reference', 'Summary', 'Severity']} />
          <tbody>
            {filtered.map(a => (
              <Tr key={a.id}>
                <Td className="whitespace-nowrap text-text-light">{a.timestamp}</Td>
                <Td>
                  <p className="font-medium">{a.actor}</p>
                  <p className="text-xs text-text-light">{a.actorRole}</p>
                </Td>
                <Td>{a.action}</Td>
                <Td className="font-mono text-xs">{a.entityNo || a.entityType}</Td>
                <Td className="max-w-md">{a.summary}</Td>
                <Td><Pill label={a.severity} tone={SEVERITY_TONE[a.severity]} /></Td>
              </Tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
};

export default ActivityLog;
