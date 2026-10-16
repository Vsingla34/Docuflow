import { PermissionModule, UserRole } from '../../types';
import type { IconProps } from '../icons/Icon';

export type PageKey =
  | 'dashboard'
  | 'assets'
  | 'categories'
  | 'requisitions'
  | 'purchaseOrders'
  | 'grns'
  | 'transfers'
  | 'gatePasses'
  | 'amc'
  | 'serviceTickets'
  | 'replacements'
  | 'disposals'
  | 'audits'
  | 'doa'
  | 'masters'
  | 'employees'
  | 'activity'
  | 'lookup'
  | 'companyManagement'
  | 'userManagement'
  | 'masterUploads'
  | 'projects'
  | 'roles'
  | 'reports'
  | 'settings';

export interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
  roles: UserRole[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL: UserRole[] = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EMPLOYEE, UserRole.AUDITOR];
const OPS: UserRole[] = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGEMENT];
const REPORT_ROLES: UserRole[] = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.AUDITOR];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'home', roles: ALL },
      { key: 'employees', label: 'Employees & Users', icon: 'users', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
      { key: 'activity', label: 'Activity Log', icon: 'history', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.AUDITOR] },
      { key: 'masterUploads', label: 'Data Master Uploads', icon: 'arrowLeft', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGEMENT] },
    ],
  },
  {
    title: 'Assets',
    items: [
      { key: 'assets', label: 'Asset Register', icon: 'box', roles: ALL },
      { key: 'reports', label: 'Reports', icon: 'receipt', roles: REPORT_ROLES },
      { key: 'projects', label: 'Projects (CWIP)', icon: 'hammer', roles: OPS },
      { key: 'categories', label: 'Categories & Variants', icon: 'tag', roles: OPS },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { key: 'requisitions', label: 'Requisitions', icon: 'clipboard', roles: ALL },
      { key: 'purchaseOrders', label: 'Purchase Orders', icon: 'cart', roles: OPS },
      { key: 'grns', label: 'Goods Receipt (GRN)', icon: 'receipt', roles: OPS },
    ],
  },
  {
    title: 'Movement',
    items: [
      { key: 'transfers', label: 'Transfers', icon: 'swap', roles: ALL },
      { key: 'gatePasses', label: 'Gate Passes', icon: 'truck', roles: OPS },
    ],
  },
  {
    title: 'Maintenance',
    items: [
      { key: 'amc', label: 'AMC Contracts', icon: 'shield', roles: OPS },
      { key: 'serviceTickets', label: 'Repairs & Service', icon: 'wrench', roles: ALL },
      { key: 'replacements', label: 'Replacements', icon: 'swap', roles: OPS },
      { key: 'disposals', label: 'Disposal & Sale', icon: 'trash', roles: OPS },
    ],
  },
  {
    title: 'Governance',
    items: [
      { key: 'audits', label: 'Physical Audit', icon: 'scan', roles: [UserRole.SUPERADMIN, UserRole.AUDITOR, UserRole.ADMIN, UserRole.MANAGEMENT] },
      { key: 'doa', label: 'Delegation of Authority', icon: 'shield', roles: OPS },
    ],
  },
  {
    title: 'Organisation',
    items: [
      { key: 'roles', label: 'Custom Roles', icon: 'shield', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
      { key: 'masters', label: 'Locations, Depts & Vendors', icon: 'building', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
      { key: 'settings', label: 'Settings', icon: 'settings', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
    ],
  },
  {
    title: 'Asset Tag & QR',
    items: [
      { key: 'lookup', label: 'Tag / QR Lookup', icon: 'scan', roles: ALL },
    ],
  },
];

// Real, bookmarkable URLs for every page — added so each section of the app lives on its own
// browser-navigable path (deep links, refresh-in-place, back/forward) instead of all sharing a
// single URL and being swapped in by in-memory state. See PAGE_ROLES below for the matching
// route guard: a real URL is typeable/shareable in a way an in-memory page key never was, so
// routes are now access-gated the same way the sidebar already was.
export const PAGE_PATHS: Record<PageKey, string> = {
  dashboard: '/dashboard',
  assets: '/assets',
  categories: '/categories',
  requisitions: '/requisitions',
  purchaseOrders: '/purchase-orders',
  grns: '/grns',
  transfers: '/transfers',
  gatePasses: '/gate-passes',
  amc: '/amc',
  serviceTickets: '/service-tickets',
  replacements: '/replacements',
  disposals: '/disposals',
  audits: '/audits',
  doa: '/doa',
  masters: '/masters',
  employees: '/employees',
  activity: '/activity',
  lookup: '/lookup',
  companyManagement: '/company-management',
  userManagement: '/user-management',
  masterUploads: '/master-uploads',
  projects: '/projects',
  roles: '/roles',
  reports: '/reports',
  settings: '/settings',
};

const PATH_TO_PAGE: Record<string, PageKey> = Object.fromEntries(
  Object.entries(PAGE_PATHS).map(([key, path]) => [path, key as PageKey]),
) as Record<string, PageKey>;

export function pageKeyFromPath(pathname: string): PageKey | undefined {
  return PATH_TO_PAGE[pathname];
}

// Role gate per route. Mirrors the roles already used to decide sidebar visibility for each item
// (ALL/OPS groups above) — a page that was only reachable by clicking a visible sidebar button is
// now also reachable by typing its URL directly, so the same role check now has to be enforced on
// the route itself, not just on whether the button was rendered. companyManagement/userManagement
// were never wired into the sidebar at all (userManagement is only reached as an in-page modal
// from CompanySelection, gated there to Superadmin) — restricted to Superadmin here too so a bare
// URL doesn't open a page that previously had no way in.
export const PAGE_ROLES: Record<PageKey, UserRole[]> = {
  dashboard: ALL,
  assets: ALL,
  categories: OPS,
  requisitions: ALL,
  purchaseOrders: OPS,
  grns: OPS,
  transfers: ALL,
  gatePasses: OPS,
  amc: OPS,
  serviceTickets: ALL,
  replacements: OPS,
  disposals: OPS,
  audits: [UserRole.SUPERADMIN, UserRole.AUDITOR, UserRole.ADMIN, UserRole.MANAGEMENT],
  doa: OPS,
  masters: [UserRole.SUPERADMIN, UserRole.ADMIN],
  employees: [UserRole.SUPERADMIN, UserRole.ADMIN],
  activity: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.AUDITOR],
  lookup: ALL,
  companyManagement: [UserRole.SUPERADMIN],
  userManagement: [UserRole.SUPERADMIN],
  masterUploads: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGEMENT],
  projects: OPS,
  roles: [UserRole.SUPERADMIN, UserRole.ADMIN],
  reports: REPORT_ROLES,
  settings: [UserRole.SUPERADMIN, UserRole.ADMIN],
};

// Which custom-role permission module (if any) governs a page. A page with no entry here is
// gated only by the account's base UserRole (PAGE_ROLES above) and is never restricted further
// by a custom role — that's deliberate for dashboard/lookup (everyone needs them) and for
// employees/userManagement/companyManagement/roles (already Superadmin/Admin-only, and letting a
// custom role touch who can manage users/roles would be a privilege-escalation risk).
export const PAGE_PERMISSION_MODULE: Partial<Record<PageKey, PermissionModule>> = {
  assets: 'assets',
  categories: 'categories',
  projects: 'projects',
  requisitions: 'requisitions',
  purchaseOrders: 'purchaseOrders',
  grns: 'grns',
  transfers: 'transfers',
  gatePasses: 'gatePasses',
  amc: 'amc',
  serviceTickets: 'serviceTickets',
  replacements: 'replacements',
  disposals: 'disposals',
  audits: 'audits',
  doa: 'doa',
  masters: 'masters',
  masterUploads: 'masterUploads',
  activity: 'activity',
};

export const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  assets: 'Asset Register',
  categories: 'Categories & Variants',
  requisitions: 'Purchase Requisitions',
  purchaseOrders: 'Purchase Orders',
  grns: 'Goods Receipt Notes',
  transfers: 'Asset Transfers',
  gatePasses: 'Gate Passes',
  amc: 'AMC Contracts',
  serviceTickets: 'Repairs & Service Tickets',
  replacements: 'Asset Replacements',
  disposals: 'Disposal & Sale',
  audits: 'Physical Verification Audits',
  doa: 'Delegation of Authority',
  masters: 'Locations, Departments & Vendors',
  employees: 'Employees & User Access',
  activity: 'Activity Log',
  lookup: 'Asset Tag & QR Lookup',
  userManagement: 'User Management',
  companyManagement: 'Company Management',
  masterUploads: 'Data Master Uploads',
  projects: 'Projects (CWIP)',
  roles: 'Custom Roles',
  reports: 'Reports',
  settings: 'Settings',
};