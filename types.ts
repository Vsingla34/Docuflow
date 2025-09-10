export enum Page {
  Dashboard = 'Dashboard',
  Templates = 'Compliance Templates',
  Documents = 'Documents',
  Clients = 'Clients',
  Requests = 'Requests',
  ClientDashboard = 'Client Dashboard',
  ClientPortal = 'Client Portal',
  SearchResults = 'Search Results',
  UserManagement = 'User Management',
}

export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  STAFF = 'Staff',
  CLIENT = 'Client',
  VIEWER = 'Viewer',
}

export enum DocumentStatus {
  Pending = 'Pending',
  Received = 'Received',
  Under_Review = 'Under Review',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Clarification_Needed = 'Clarification Needed',
}

export enum DocumentType {
  ID_PROOF = 'ID Proof',
  FINANCIAL = 'Financial Statement',
  LEGAL = 'Legal Agreement',
  OPERATIONAL = 'Operational Form',
  GST = 'GST Filing',
  TDS = 'TDS Filing',
  ROC = 'ROC Filing',
  IT = 'IT Filing',
  LICENSE = 'License/Registration',
  OTHER = 'Other',
}

export enum ComplianceFrequency {
    MONTHLY = 'Monthly',
    QUARTERLY = 'Quarterly',
    ANNUALLY = 'Annually',
    ONE_TIME = 'One-Time',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  clientId?: string; // For client users
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  joinedDate: string;
}

export interface ComplianceTemplate {
  id: string;
  name: string;
  description: string;
  requiredDocuments: { id: string; name: string, type: DocumentType }[];
  frequency: ComplianceFrequency;
  dueDateRule: { day: number; month_offset: number }; // e.g., { day: 15, month_offset: 1 } for 15th of next month
  autoRecurrence: boolean;
}

export interface DocumentVersion {
    version: number;
    status: DocumentStatus;
    notes: string;
    updatedAt: string;
    updatedBy: string;
}

export interface Document {
  id: string;
  name: string;
  clientId: string;
  complianceId: string;
  requestId: string;
  status: DocumentStatus;
  submittedDate: string;
  type: DocumentType;
  expiryDate?: string;
  driveLink?: string;
  versionHistory: DocumentVersion[];
  rejectionReason?: string;
}

export interface Comment {
    id: string;
    author: string;
    text: string;
    timestamp: string;
}

export interface DocumentRequest {
  id: string;
  clientId: string;
  complianceId: string;
  documents: { name: string; id: string }[];
  status: DocumentStatus;
  requestDate: string;
  dueDate: string;
  portalToken: string;
  clarificationThread: Comment[];
}

export interface SavedView {
    id: string;
    name: string;
    filters: Record<string, any>;
}