import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAssetStore } from '../store/AssetStore';
import { AssetStatus, DocStatus, LIVE_ASSET_STATUSES } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { listAlerts, myPendingApprovals } from '../lib/notifications';
import { breachedOpenTickets } from '../lib/sla';
import { formatCurrency, formatDate } from '../lib/format';
import { totalBookValue } from '../lib/depreciation';
import { PageKey } from '../components/layout/nav';
import Icon from '../components/icons/Icon';

const COLORS = ['#4F46E5', '#0D9488', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B', '#10B981'];

const Dashboard: React.FC<{ onNavigate: (page: PageKey) => void }> = ({ onNavigate }) => {
  const { state, currentUser } = useAssetStore();
  const { assets, categories, requisitions, transfers, serviceTickets, amcContracts, disposals } = state;

  const liveAssets = assets.filter(a => LIVE_ASSET_STATUSES.includes(a.status));
  const bookValue = totalBookValue(liveAssets, undefined, state.depreciationRateRules);
  // AUDIT fix DASH-01 / ASSET-02: the "Assets in Service" KPI used to read liveAssets.length,
  // which is every non-disposed asset (In Store + In Use + Under Repair + In Transit + Issued
  // Out + Awaiting Disposal) — correct for a financial total like Net Book Value below, but not
  // what "in service" means to someone reading the card. A tenant with 100 freshly registered,
  // never-issued assets would show "100 in service" here when the true number is 0. These two
  // narrower counts replace it and also surface the issuance backlog directly on the dashboard.
  const inServiceAssets = assets.filter(a => a.status === AssetStatus.InUse);
  const inStoreAssets = assets.filter(a => a.status === AssetStatus.InStore);
  const openTickets = serviceTickets.filter(t => [DocStatus.Open, DocStatus.InProgress, DocStatus.PendingApproval].includes(t.status));
  // Week 2-4 backlog: service-ticket SLAs (see lib/sla.ts) — how many open tickets have already
  // missed their priority-based response/resolution commitment, surfaced the same way the other
  // "watch this" counts are.
  const slaBreaches = breachedOpenTickets(serviceTickets);
  const activeAmc = amcContracts.filter(c => c.status === DocStatus.Active);
  const alerts = listAlerts(state);
  const myApprovals = myPendingApprovals(state, currentUser);

  const statusData = Object.values(AssetStatus).map(status => ({ name: status, value: assets.filter(a => a.status === status).length })).filter(d => d.value > 0);

  const categoryData = categories
    .filter(c => !c.parentId)
    .map(cat => {
      const descendantIds = [cat.id, ...categories.filter(c => c.parentId === cat.id).map(c => c.id)];
      return { name: cat.name, value: liveAssets.filter(a => descendantIds.includes(a.categoryId)).length };
    })
    .filter(d => d.value > 0);

  const recentActivity = state.activity.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Assets in Service" value={inServiceAssets.length} icon="box" tone="blue" onClick={() => onNavigate('assets')} hint="Issued and in active use" />
        {/* AUDIT fix ASSET-01 companion: this card is the signal that should have caught the
            issuance workflow being hard to find — a large In Store count alongside a near-zero
            In Service count means assets are being registered but never issued. */}
        <StatCard label="In Store (Unissued)" value={inStoreAssets.length} icon="box" tone="slate" onClick={() => onNavigate('assets')} hint="Registered but not yet issued" />
        <StatCard label="Net Book Value" value={formatCurrency(bookValue, true)} icon="tag" tone="green" hint="Across all live assets" />
        <StatCard label="Open Repairs" value={openTickets.length} icon="wrench" tone="amber" onClick={() => onNavigate('serviceTickets')} />
        <StatCard label="Awaiting Your Approval" value={myApprovals.length} icon="clipboard" tone="purple" onClick={() => myApprovals[0] && onNavigate(myApprovals[0].page)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Open Requisitions" value={requisitions.filter(r => r.status === DocStatus.PendingApproval).length} icon="clipboard" tone="slate" onClick={() => onNavigate('requisitions')} />
        <StatCard label="Transfers In Transit" value={transfers.filter(t => t.status === DocStatus.InTransit).length} icon="swap" tone="blue" onClick={() => onNavigate('transfers')} />
        <StatCard label="Active AMC Contracts" value={activeAmc.length} icon="shield" tone="green" onClick={() => onNavigate('amc')} />
        <StatCard label="Pending Disposals" value={disposals.filter(d => d.status === DocStatus.PendingApproval).length} icon="trash" tone="red" onClick={() => onNavigate('disposals')} />
        <StatCard label="SLA Breaches" value={slaBreaches.length} icon="wrench" tone={slaBreaches.length > 0 ? 'red' : 'slate'} onClick={() => onNavigate('serviceTickets')} hint="Open tickets past their due date" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card p-5 rounded-xl shadow-sm">
          <h2 className="font-semibold text-text-main mb-4">Alerts &amp; Approvals</h2>
          {alerts.length === 0 && myApprovals.length === 0 ? (
            <EmptyState icon="check" title="All clear" message="No overdue items, expiring AMCs, or approvals waiting on you." />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {alerts.map(a => (
                <button key={a.id} onClick={() => onNavigate(a.page)} className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-slate-50">
                  <Icon name="alert" className={`w-5 h-5 shrink-0 mt-0.5 ${a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-sm font-medium text-text-main">{a.title}</p>
                    <p className="text-xs text-text-light">{a.detail}</p>
                  </div>
                </button>
              ))}
              {myApprovals.map(item => (
                <button key={item.id} onClick={() => onNavigate(item.page)} className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-slate-50">
                  <Icon name="clipboard" className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main">Awaiting your approval · {item.docNo}</p>
                    <p className="text-xs text-text-light truncate">{item.title} · {formatCurrency(item.amount)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card p-5 rounded-xl shadow-sm">
          <h2 className="font-semibold text-text-main mb-4">Assets by Status</h2>
          {statusData.length === 0 ? <EmptyState title="No assets yet" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {statusData.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
            {statusData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate text-text-light">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card p-5 rounded-xl shadow-sm">
          <h2 className="font-semibold text-text-main mb-4">Live Assets by Category</h2>
          {categoryData.length === 0 ? <EmptyState title="No assets yet" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4F46E5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card p-5 rounded-xl shadow-sm">
          <h2 className="font-semibold text-text-main mb-4">Recent Activity</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {recentActivity.map(entry => (
              <div key={entry.id} className="text-sm">
                <p className="text-text-main leading-snug">{entry.summary}</p>
                <p className="text-xs text-text-light mt-0.5">{entry.actor} · {formatDate(entry.timestamp.split(' ')[0])}</p>
              </div>
            ))}
            {recentActivity.length === 0 && <EmptyState title="No activity yet" />}
          </div>
          <button onClick={() => onNavigate('activity')} className="text-primary text-sm font-semibold mt-3 hover:underline">View full log →</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;