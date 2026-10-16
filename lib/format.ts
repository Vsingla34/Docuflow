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

/**
 * Generates a RFC4122 v4 UUID. The `prefix` argument is accepted only for call-site
 * readability; ids must be real UUIDs so they can be stored in Supabase `uuid` columns.
 */
export const uid = (_prefix?: string): string => {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/**
 * Generates a random, unique temporary password for a newly created login (bulk user import,
 * admin-created account). Never reused across users and never a fixed string — see AUDIT fix
 * BUG-02, which replaced a hardcoded 'Password123!' default with this. The account this is
 * issued to must also be created with `must_change_password = true` (the default on
 * public.profiles as of supabase/12_force_password_reset.sql) so the temporary value is only
 * ever valid for the very first sign-in.
 */
export const generateTempPassword = (): string => {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  // Guarantee at least one of each character class so it always clears a typical complexity
  // policy, then fill the rest randomly from the full alphabet.
  const pick = (set: string, byte: number) => set[byte % set.length];
  const upper = pick('ABCDEFGHJKLMNPQRSTUVWXYZ', bytes[0]);
  const lower = pick('abcdefghijkmnopqrstuvwxyz', bytes[1]);
  const digit = pick('23456789', bytes[2]);
  const symbol = pick('!@#$%', bytes[3]);
  const rest = Array.from(bytes.slice(4), b => alphabet[b % alphabet.length]).join('');
  return `${upper}${lower}${digit}${symbol}${rest}`;
};

export const sum = <T,>(rows: T[], pick: (row: T) => number): number =>
  rows.reduce((total, row) => total + (pick(row) || 0), 0);

export const pct = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);