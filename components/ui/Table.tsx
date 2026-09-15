import React from 'react';

/** A consistent card-wrapped table shell reused across every list page. */
export const TableCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-card rounded-xl shadow-sm overflow-hidden ${className}`}>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  </div>
);

export const THead: React.FC<{ columns: string[]; className?: string }> = ({ columns, className = '' }) => (
  <thead className={`bg-slate-50 border-b border-border text-xs text-text-light uppercase tracking-wide ${className}`}>
    <tr>
      {columns.map(col => (
        <th key={col} className="py-3 px-4 font-semibold whitespace-nowrap">{col}</th>
      ))}
    </tr>
  </thead>
);

export const Tr: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
  <tr onClick={onClick} className={`border-b border-border last:border-0 hover:bg-slate-50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}>
    {children}
  </tr>
);

export const Td: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`py-3 px-4 align-middle ${className}`}>{children}</td>
);

/** Simple toolbar row for a list page: title + count on the left, filters/actions on the right. */
export const ListToolbar: React.FC<{ title: string; count?: number; children?: React.ReactNode }> = ({ title, count, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
    <div className="flex items-baseline gap-2">
      <h2 className="text-xl font-bold text-text-main">{title}</h2>
      {typeof count === 'number' && <span className="text-sm text-text-light">({count})</span>}
    </div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

export const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder = 'Search...' }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-56 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition bg-white"
  />
);

export const FilterSelect: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary outline-none">
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);
