import React, { useState } from 'react';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

/** A small controlled or self-managed tab strip, reused for detail-view tabs and report categories alike. */
export const Tabs: React.FC<{
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}> = ({ items, active, onChange, className = '' }) => (
  <div className={`flex gap-1 border-b border-border overflow-x-auto ${className}`}>
    {items.map(item => (
      <button
        key={item.key}
        onClick={() => onChange(item.key)}
        className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
          active === item.key ? 'border-primary text-primary' : 'border-transparent text-text-light hover:text-text-main'
        }`}
      >
        {item.label}
        {typeof item.count === 'number' && <span className="ml-1.5 text-xs opacity-70">({item.count})</span>}
      </button>
    ))}
  </div>
);

/** Convenience wrapper for the common case: owns its own active-tab state. */
export const useTabs = (items: TabItem[], defaultKey?: string) => {
  const [active, setActive] = useState(defaultKey || items[0]?.key || '');
  return { active, setActive, items };
};

export default Tabs;
