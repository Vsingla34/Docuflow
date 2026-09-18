import { UserRole } from '../../types';
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
  | 'reports'
  | 'documents';

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

const ALL: UserRole[] = [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EMPLOYEE, UserRole.AUDITOR];
const OPS: UserRole[] = [UserRole.ADMIN, UserRole.MANAGEMENT];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: 'home', roles: ALL }],
  },
  {
    title: 'Assets',
    items: [
      { key: 'assets', label: 'Asset Register', icon: 'box', roles: ALL },
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
      { key: 'audits', label: 'Physical Audit', icon: 'scan', roles: [UserRole.AUDITOR, UserRole.ADMIN, UserRole.MANAGEMENT] },
      { key: 'doa', label: 'Delegation of Authority', icon: 'shield', roles: OPS },
      { key: 'activity', label: 'Activity Log', icon: 'history', roles: [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.AUDITOR] },
    ],
  },
  {
    title: 'Reports & Documents',
    items: [
      { key: 'reports', label: 'Reports', icon: 'spark', roles: [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.AUDITOR] },
      { key: 'documents', label: 'Document Library', icon: 'clipboard', roles: [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.AUDITOR] },
    ],
  },
  {
    title: 'Organisation',
    items: [
      { key: 'masters', label: 'Locations, Depts & Vendors', icon: 'building', roles: [UserRole.ADMIN] },
      { key: 'employees', label: 'Employees & Users', icon: 'users', roles: [UserRole.ADMIN] },
    ],
  },
];

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
  reports: 'Reports',
  documents: 'Document Library',
};
