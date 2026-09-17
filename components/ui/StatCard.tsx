import React from 'react';
import Icon from '../icons/Icon';

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Icon>['name'];
  tone?: 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'slate';
  hint?: string;
  onClick?: () => void;
}> = ({ label, value, icon, tone = 'blue', hint, onClick }) => {
  const toneClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div
      className={`bg-card p-5 rounded-xl shadow-sm flex items-center justify-between transition-transform duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-light uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-text-main mt-1 truncate">{value}</p>
        {hint && <p className="text-xs text-text-light mt-1">{hint}</p>}
      </div>
      <div className={`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center ${toneClasses[tone]}`}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
    </div>
  );
};

export default StatCard;
