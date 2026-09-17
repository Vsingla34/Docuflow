import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { UserRole } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td, SearchInput, FilterSelect } from '../components/ui/Table';
import { Pill } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../lib/format';

const SEVERITY_TONE: Record<string, 'red' | 'amber' | 'slate'> = { critical: 'red', warning: 'amber', info: 'slate' };

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
