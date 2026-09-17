/** Formatting and date helpers shared across the asset module. */

export const formatCurrency = (value: number, compact = false): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  if (compact) {
    if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)} K`;
  }
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export const today = (): string => new Date().toISOString().split('T')[0];

export const nowStamp = (): string => new Date().toISOString().replace('T', ' ').substring(0, 16);

export const formatDate = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);

export const daysFromToday = (value?: string): number | null => {
  if (!value) return null;
  return daysBetween(today(), value);
};

export const addMonths = (value: string, months: number): string => {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
};

export const addDays = (value: string, days: number): string => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const fiscalYear = (value: string = today()): string => {
  const date = new Date(value);
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
};

export const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const sum = <T,>(rows: T[], pick: (row: T) => number): number =>
  rows.reduce((total, row) => total + (pick(row) || 0), 0);

export const pct = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);
