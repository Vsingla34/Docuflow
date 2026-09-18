// ---------------------------------------------------------------------------
// Identity & access
// ---------------------------------------------------------------------------

/**
 * The four personas the brief calls for. Screens and the DOA matrix key off
 * this enum; Employee is the default persona for anyone without elevated
 * access (they still see their own assigned assets and can raise requests).
 */
export enum UserRole {
  ADMIN = 'Admin',
  MANAGEMENT = 'Management',
  EMPLOYEE = 'Employee',
  AUDITOR = 'Auditor',
}

/** The signed-in session user. Most people also have an Employee master record. */
export interface User {
  id: string;
  name: string;
  role: UserRole;
  employeeId?: string;
}

// ---------------------------------------------------------------------------
// Organisation masters
// ---------------------------------------------------------------------------

export enum EmployeeStatus {
  Active = 'Active',
  OnLeave = 'On Leave',
  Exited = 'Exited',
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  designation: string;
  grade: string;
  departmentId: string;
  locationId: string;
  reportsTo?: string;
  role: UserRole;
  status: EmployeeStatus;
  joinedOn: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  costCenter: string;
  headEmployeeId?: string;
}

export enum LocationType {
  HeadOffice = 'Head Office',
  Branch = 'Branch',
  Warehouse = 'Warehouse / Store',
  Plant = 'Plant',
  ClientSite = 'Client Site',
  Remote = 'Remote / WFH',
}

export interface AssetLocation {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  parentId?: string;
  address: string;
  city: string;
  state: string;
}

export enum VendorStatus {
  Active = 'Active',
  Blacklisted = 'Blacklisted',
  Inactive = 'Inactive',
}

export interface Vendor {
  id: string;
  code: string;
  name: string;
  gstin: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  services: string[];
  isAmcPartner: boolean;
  rating: number;
  status: VendorStatus;
}

// ---------------------------------------------------------------------------
// Asset masters: categories, variants, components
// ---------------------------------------------------------------------------

export enum DepreciationMethod {
  SLM = 'Straight Line (SLM)',
  WDV = 'Written Down Value (WDV)',
  None = 'Not Depreciated',
}

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  description: string;
  depreciationMethod: DepreciationMethod;
  usefulLifeYears: number;
  salvageValuePct: number;
  capitalizationThreshold: number;
  requiresAmc: boolean;
  requiresSerialNumber: boolean;
  trackComponents: boolean;
  active: boolean;
}

export interface Specification {
  label: string;
  value: string;
}

/** A purchasable model/configuration under a category (e.g. "ThinkPad T14 / i7 / 16GB"). */
export interface AssetVariant {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  manufacturer: string;
  modelNumber: string;
  specifications: Specification[];
  standardCost: number;
  warrantyMonths: number;
  uom: string;
  active: boolean;
}

export enum ComponentStatus {
  Installed = 'Installed',
  Removed = 'Removed',
  Faulty = 'Faulty',
  Replaced = 'Replaced',
}

/** A sub-part fitted into an asset (RAM, SSD, battery, tyre, compressor...). */
export interface AssetComponent {
  id: string;
  assetId: string;
  name: string;
  partNumber?: string;
  serialNumber?: string;
  categoryId?: string;
  cost: number;
  installedOn: string;
  removedOn?: string;
  status: ComponentStatus;
  warrantyExpiry?: string;
  replacedByComponentId?: string;
  source: 'Purchase' | 'Repair' | 'Transfer' | 'Manual';
  remarks?: string;
}

// ---------------------------------------------------------------------------
// The asset itself
// ---------------------------------------------------------------------------

export enum AssetStatus {
  InStore = 'In Store',
  InUse = 'In Use',
  UnderRepair = 'Under Repair',
  InTransit = 'In Transit',
  IssuedOut = 'Issued Out',
  AwaitingDisposal = 'Awaiting Disposal',
  Sold = 'Sold',
  Scrapped = 'Scrapped',
  WrittenOff = 'Written Off',
  Lost = 'Lost / Stolen',
  Retired = 'Retired',
}

export const LIVE_ASSET_STATUSES: AssetStatus[] = [
  AssetStatus.InStore,
  AssetStatus.InUse,
  AssetStatus.UnderRepair,
  AssetStatus.InTransit,
  AssetStatus.IssuedOut,
  AssetStatus.AwaitingDisposal,
];

export enum AssetCondition {
  New = 'New',
  Good = 'Good',
  Fair = 'Fair',
  Poor = 'Poor',
  Unserviceable = 'Unserviceable',
}

export enum Criticality {
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

export enum AssetEventType {
  Created = 'Created',
  Received = 'Received',
  Assigned = 'Assigned',
  Transferred = 'Transferred',
  Returned = 'Returned',
  RepairRaised = 'Repair Raised',
  RepairCompleted = 'Repair Completed',
  ComponentAdded = 'Component Added',
  ComponentRemoved = 'Component Removed',
  AmcLinked = 'AMC Linked',
  GatePassIssued = 'Gate Pass Issued',
  GatePassReturned = 'Gate Pass Returned',
  Replaced = 'Replaced',
  Disposed = 'Disposed',
  Verified = 'Verified',
  Updated = 'Updated',
}

export interface AssetEvent {
  id: string;
  date: string;
  type: AssetEventType;
  title: string;
  detail: string;
  actor: string;
  refNo?: string;
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  variantId?: string;
  serialNumber: string;
  status: AssetStatus;
  condition: AssetCondition;
  criticality: Criticality;

  custodianId?: string;
  departmentId: string;
  locationId: string;
  subLocation?: string;

  vendorId?: string;
  poNo?: string;
  grnNo?: string;
  invoiceNo?: string;

  purchaseDate: string;
  capitalizedOn: string;
  purchaseCost: number;
  warrantyExpiry?: string;

  usefulLifeYears: number;
  salvageValuePct: number;
  depreciationMethod: DepreciationMethod;

  amcContractId?: string;
  parentAssetId?: string;

  insurancePolicyNo?: string;
  insuranceExpiry?: string;

  lastVerifiedOn?: string;
  lastVerifiedBy?: string;

  disposal?: { mode: DisposalMode; date: string; realisedValue: number; refNo: string };
  remarks?: string;
  history: AssetEvent[];
}

// ---------------------------------------------------------------------------
// Delegation of Authority (DOA)
// ---------------------------------------------------------------------------

export enum ApprovalDocType {
  Requisition = 'Purchase Requisition',
  PurchaseOrder = 'Purchase Order',
  Transfer = 'Asset Transfer',
  GatePass = 'Gate Pass',
  AmcContract = 'AMC Contract',
  ServiceTicket = 'Repair / Service',
  Replacement = 'Asset Replacement',
  Disposal = 'Disposal / Sale',
}

export enum ApprovalStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Skipped = 'Skipped',
}

/** One row of the authority matrix: who signs off on what, within which value band. */
export interface DoaRule {
  id: string;
  docType: ApprovalDocType;
  level: number;
  approverTitle: string;
  approverRole: UserRole;
  minAmount: number;
  /** null means "and above" */
  maxAmount: number | null;
  categoryIds: string[];
  locationIds: string[];
  active: boolean;
  effectiveFrom: string;
  notes?: string;
}

/** Temporary hand-over of signing authority while an approver is away. */
export interface DoaDelegation {
  id: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  docTypes: ApprovalDocType[];
  fromDate: string;
  toDate: string;
  reason: string;
  active: boolean;
}

export interface ApprovalStep {
  level: number;
  ruleId: string;
  approverTitle: string;
  approverRole: UserRole;
  status: ApprovalStatus;
  actedBy?: string;
  actedOn?: string;
  remarks?: string;
  onBehalfOf?: string;
}

/** Common shape every approvable document shares. */
export interface Approvable {
  id: string;
  status: DocStatus;
  approvals: ApprovalStep[];
}

// ---------------------------------------------------------------------------
// Workflow statuses (shared across document types)
// ---------------------------------------------------------------------------

export enum DocStatus {
  Draft = 'Draft',
  PendingApproval = 'Pending Approval',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Cancelled = 'Cancelled',
  PartiallyReceived = 'Partially Received',
  Received = 'Received',
  Closed = 'Closed',
  InTransit = 'In Transit',
  Completed = 'Completed',
  Issued = 'Issued',
  Returned = 'Returned',
  Overdue = 'Overdue',
  Active = 'Active',
  Expired = 'Expired',
  Terminated = 'Terminated',
  Renewed = 'Renewed',
  Open = 'Open',
  InProgress = 'In Progress',
  SentToVendor = 'Sent to Vendor',
  Posted = 'Posted',
  Planned = 'Planned',
  SignedOff = 'Signed Off',
  Converted = 'Converted to PO',
}

// ---------------------------------------------------------------------------
// Procurement: requisition -> purchase order -> GRN
// ---------------------------------------------------------------------------

export interface RequisitionLine {
  id: string;
  categoryId: string;
  variantId?: string;
  description: string;
  quantity: number;
  estimatedUnitCost: number;
  forEmployeeId?: string;
}

export interface Requisition extends Approvable {
  prNo: string;
  requestedById: string;
  departmentId: string;
  locationId: string;
  requiredBy: string;
  justification: string;
  lines: RequisitionLine[];
  estimatedValue: number;
  createdOn: string;
  poId?: string;
  poNo?: string;
}

export interface PurchaseOrderLine {
  id: string;
  categoryId: string;
  variantId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  receivedQty: number;
}

export interface PurchaseOrder extends Approvable {
  poNo: string;
  prId?: string;
  prNo?: string;
  vendorId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  deliverToLocationId: string;
  departmentId: string;
  lines: PurchaseOrderLine[];
  subTotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentTerms: string;
  warrantyTerms: string;
  createdById: string;
  remarks?: string;
}

export interface GrnLine {
  id: string;
  poLineId: string;
  categoryId: string;
  variantId?: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  unitPrice: number;
  serialNumbers: string[];
  remarks?: string;
}

export interface Grn {
  id: string;
  grnNo: string;
  poId: string;
  poNo: string;
  vendorId: string;
  receivedOn: string;
  receivedById: string;
  locationId: string;
  departmentId: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceValue: number;
  lines: GrnLine[];
  status: DocStatus;
  inspectionRemarks?: string;
  createdAssetIds: string[];
}

// ---------------------------------------------------------------------------
// Movement: transfers, issues and gate passes
// ---------------------------------------------------------------------------

export enum TransferType {
  Custodian = 'Issue / Custodian Change',
  Location = 'Location Transfer',
  Department = 'Department Transfer',
  InterBranch = 'Inter-Branch Transfer',
  ReturnToStore = 'Return to Store',
}

export interface Transfer extends Approvable {
  transferNo: string;
  type: TransferType;
  assetIds: string[];
  fromLocationId: string;
  toLocationId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  fromCustodianId?: string;
  toCustodianId?: string;
  requestedById: string;
  reason: string;
  requiresGatePass: boolean;
  gatePassId?: string;
  gatePassNo?: string;
  createdOn: string;
  dispatchedOn?: string;
  receivedOn?: string;
  acknowledgedById?: string;
  acknowledgementRemarks?: string;
  value: number;
}

export enum GatePassType {
  Returnable = 'Returnable',
  NonReturnable = 'Non-Returnable',
}

export enum GatePassPurpose {
  Repair = 'Sent for Repair',
  Demo = 'Demo / Exhibition',
  WorkFromHome = 'Work From Home',
  Transfer = 'Inter-Branch Transfer',
  Sale = 'Sale / Handover to Buyer',
  Disposal = 'Scrap / Disposal',
  Other = 'Other',
}

export interface GatePass extends Approvable {
  gatePassNo: string;
  type: GatePassType;
  purpose: GatePassPurpose;
  assetIds: string[];
  issuedToType: 'Employee' | 'Vendor' | 'External';
  issuedToEmployeeId?: string;
  issuedToVendorId?: string;
  issuedToName: string;
  issuedToContact?: string;
  fromLocationId: string;
  destination: string;
  carrierName?: string;
  vehicleNo?: string;
  issuedById: string;
  issueDate: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  linkedRefType?: string;
  linkedRefNo?: string;
  securityRemarks?: string;
  value: number;
  createdOn: string;
}

// ---------------------------------------------------------------------------
// Maintenance: AMC, repairs, replacements
// ---------------------------------------------------------------------------

export enum AmcType {
  Comprehensive = 'Comprehensive AMC',
  NonComprehensive = 'Non-Comprehensive AMC',
  WarrantyExtension = 'Extended Warranty',
  ServiceContract = 'Service Contract',
}

export enum PaymentFrequency {
  Monthly = 'Monthly',
  Quarterly = 'Quarterly',
  HalfYearly = 'Half-Yearly',
  Annual = 'Annual',
  OneTime = 'One-Time',
}

export interface AmcVisit {
  id: string;
  scheduledOn: string;
  completedOn?: string;
  type: 'Preventive' | 'Breakdown';
  technician?: string;
  remarks?: string;
}

export interface AmcContract extends Approvable {
  contractNo: string;
  vendorId: string;
  type: AmcType;
  assetIds: string[];
  startDate: string;
  endDate: string;
  contractValue: number;
  paymentFrequency: PaymentFrequency;
  slaResponseHours: number;
  preventiveVisitsPerYear: number;
  visits: AmcVisit[];
  coverageNotes: string;
  ownerId: string;
  renewedFromId?: string;
  renewalReminderDays: number;
  createdOn: string;
}

export enum TicketType {
  Breakdown = 'Breakdown',
  Preventive = 'Preventive Maintenance',
  Inspection = 'Inspection',
  Upgrade = 'Upgrade',
}

export enum TicketPriority {
  Critical = 'Critical',
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

export interface PartReplacement {
  id: string;
  componentName: string;
  oldSerial?: string;
  newSerial?: string;
  cost: number;
  warrantyMonths: number;
}

export interface ServiceTicket extends Approvable {
  ticketNo: string;
  assetId: string;
  type: TicketType;
  priority: TicketPriority;
  reportedById: string;
  reportedOn: string;
  faultDescription: string;
  underAmc: boolean;
  amcContractId?: string;
  vendorId?: string;
  estimatedCost: number;
  actualCost?: number;
  assignedTo?: string;
  gatePassId?: string;
  gatePassNo?: string;
  downtimeStart?: string;
  downtimeEnd?: string;
  resolution?: string;
  partsReplaced: PartReplacement[];
  recommendReplacement: boolean;
  replacementNo?: string;
  closedOn?: string;
}

export enum ReplacementReason {
  BeyondRepair = 'Beyond Economic Repair',
  Obsolete = 'Obsolete / End of Life',
  Upgrade = 'Performance Upgrade',
  Damaged = 'Damaged',
  Lost = 'Lost / Stolen',
  Warranty = 'Warranty Replacement',
}

export interface Replacement extends Approvable {
  replacementNo: string;
  oldAssetId: string;
  newAssetId?: string;
  newAssetSource: 'From Store' | 'New Purchase' | 'Vendor Buyback' | 'Vendor Warranty';
  reason: ReplacementReason;
  requestedById: string;
  requestedOn: string;
  oldAssetDisposition: 'Return to Store' | 'Scrap' | 'Sell' | 'Return to Vendor' | 'Write-Off (Lost/Stolen)';
  estimatedCost: number;
  ticketNo?: string;
  completedOn?: string;
  remarks?: string;
}

// ---------------------------------------------------------------------------
// Disposal / sale / write-off
// ---------------------------------------------------------------------------

export enum DisposalMode {
  Sale = 'Sale',
  Scrap = 'Scrap',
  Donation = 'Donation',
  WriteOff = 'Write-Off',
  Buyback = 'Vendor Buyback',
  TradeIn = 'Trade-In',
  Lost = 'Lost / Stolen',
}

export interface DisposalLine {
  assetId: string;
  bookValue: number;
  realisedValue: number;
  remarks?: string;
}

export interface Disposal extends Approvable {
  disposalNo: string;
  mode: DisposalMode;
  lines: DisposalLine[];
  buyerName?: string;
  buyerContact?: string;
  totalBookValue: number;
  totalRealisedValue: number;
  gainLoss: number;
  reason: string;
  requestedById: string;
  requestedOn: string;
  disposalDate?: string;
  invoiceNo?: string;
  gatePassId?: string;
  gatePassNo?: string;
}

// ---------------------------------------------------------------------------
// Audit: physical verification and activity trail
// ---------------------------------------------------------------------------

export enum VerificationResult {
  Pending = 'Pending',
  Found = 'Found',
  NotFound = 'Not Found',
  LocationMismatch = 'Location Mismatch',
  CustodianMismatch = 'Custodian Mismatch',
  ConditionIssue = 'Condition Issue',
}

export interface VerificationLine {
  assetId: string;
  expectedLocationId: string;
  expectedCustodianId?: string;
  result: VerificationResult;
  actualLocationId?: string;
  actualCustodianId?: string;
  condition?: AssetCondition;
  remarks?: string;
  verifiedOn?: string;
}

export interface AuditPlan {
  id: string;
  auditNo: string;
  title: string;
  scopeType: 'Location' | 'Department' | 'Category' | 'All';
  scopeIds: string[];
  plannedFrom: string;
  plannedTo: string;
  auditorId: string;
  status: DocStatus;
  lines: VerificationLine[];
  observations?: string;
  signedOffBy?: string;
  signedOffOn?: string;
  createdOn: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  entityNo?: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical';
}

// ---------------------------------------------------------------------------
// Documents (file attachments) — every transaction/master type they can
// attach to, named exactly as it appears in the UI and in the document
// library's "linked to" column.
// ---------------------------------------------------------------------------

export enum DocumentEntityType {
  Asset = 'Asset',
  Requisition = 'Requisition',
  PurchaseOrder = 'Purchase Order',
  Grn = 'GRN',
  Transfer = 'Transfer',
  GatePass = 'Gate Pass',
  AmcContract = 'AMC Contract',
  ServiceTicket = 'Service Ticket',
  Replacement = 'Replacement',
  Disposal = 'Disposal',
  Vendor = 'Vendor',
  Employee = 'Employee',
}

export enum DocumentCategory {
  Invoice = 'Invoice',
  Warranty = 'Warranty Card',
  Contract = 'Contract',
  Photo = 'Photo',
  Compliance = 'Compliance / Certificate',
  Correspondence = 'Correspondence',
  Other = 'Other',
}

/** A file attached to any entity in the system. Stored inline (base64 data URL) since there is no backend. */
export interface AssetDocument {
  id: string;
  entityType: DocumentEntityType;
  entityId: string;
  /** Denormalised label so the document library can show "linked to" without re-joining every collection. */
  entityLabel: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedBy: string;
  uploadedOn: string;
  remarks?: string;
}

// ---------------------------------------------------------------------------
// Root state
// ---------------------------------------------------------------------------

export interface AssetState {
  employees: Employee[];
  departments: Department[];
  locations: AssetLocation[];
  vendors: Vendor[];
  categories: AssetCategory[];
  variants: AssetVariant[];
  assets: Asset[];
  components: AssetComponent[];
  requisitions: Requisition[];
  purchaseOrders: PurchaseOrder[];
  grns: Grn[];
  transfers: Transfer[];
  gatePasses: GatePass[];
  amcContracts: AmcContract[];
  serviceTickets: ServiceTicket[];
  replacements: Replacement[];
  disposals: Disposal[];
  doaRules: DoaRule[];
  delegations: DoaDelegation[];
  auditPlans: AuditPlan[];
  documents: AssetDocument[];
  activity: ActivityEntry[];
  counters: Record<string, number>;
}
