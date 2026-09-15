import {
  ActivityEntry,
  AmcContract,
  AmcType,
  ApprovalDocType,
  ApprovalStatus,
  Asset,
  AssetCategory,
  AssetComponent,
  AssetCondition,
  AssetEventType,
  AssetLocation,
  AssetState,
  AssetStatus,
  ComponentStatus,
  Criticality,
  Department,
  DepreciationMethod,
  Disposal,
  DisposalMode,
  DoaDelegation,
  DoaRule,
  DocStatus,
  Employee,
  EmployeeStatus,
  GatePass,
  GatePassPurpose,
  GatePassType,
  Grn,
  LocationType,
  PaymentFrequency,
  PurchaseOrder,
  Replacement,
  ReplacementReason,
  Requisition,
  ServiceTicket,
  TicketPriority,
  TicketType,
  Transfer,
  TransferType,
  AuditPlan,
  User,
  UserRole,
  Vendor,
  VendorStatus,
  VerificationResult,
  AssetVariant,
} from '../types';

// ---------------------------------------------------------------------------
// Organisation masters
// ---------------------------------------------------------------------------

export const SEED_DEPARTMENTS: Department[] = [
  { id: 'dept-it', code: 'IT', name: 'Information Technology', costCenter: 'CC-100', headEmployeeId: 'emp-mgmt2' },
  { id: 'dept-fin', code: 'FIN', name: 'Finance & Accounts', costCenter: 'CC-200', headEmployeeId: 'emp-mgmt1' },
  { id: 'dept-hr', code: 'HR', name: 'Human Resources', costCenter: 'CC-300' },
  { id: 'dept-admin', code: 'ADM', name: 'Administration & Facilities', costCenter: 'CC-400', headEmployeeId: 'emp-admin1' },
  { id: 'dept-sales', code: 'SAL', name: 'Sales & Marketing', costCenter: 'CC-500' },
  { id: 'dept-ops', code: 'OPS', name: 'Operations', costCenter: 'CC-600' },
];

export const SEED_LOCATIONS: AssetLocation[] = [
  { id: 'loc-ho', code: 'HO', name: 'Head Office - Mumbai', type: LocationType.HeadOffice, address: '14th Floor, Prestige Tower, BKC', city: 'Mumbai', state: 'Maharashtra' },
  { id: 'loc-del', code: 'DEL', name: 'Delhi Branch', type: LocationType.Branch, parentId: 'loc-ho', address: '2nd Floor, DLF Cyber Hub', city: 'New Delhi', state: 'Delhi' },
  { id: 'loc-blr', code: 'BLR', name: 'Bengaluru Branch', type: LocationType.Branch, parentId: 'loc-ho', address: 'Block C, Embassy Tech Village', city: 'Bengaluru', state: 'Karnataka' },
  { id: 'loc-pwh', code: 'PWH', name: 'Pune Central Warehouse', type: LocationType.Warehouse, parentId: 'loc-ho', address: 'Plot 12, MIDC Industrial Area, Hinjewadi', city: 'Pune', state: 'Maharashtra' },
  { id: 'loc-chn', code: 'CHN', name: 'Chennai Client Site', type: LocationType.ClientSite, address: 'Tidel Park, Taramani', city: 'Chennai', state: 'Tamil Nadu' },
];

export const SEED_VENDORS: Vendor[] = [
  { id: 'ven-dell', code: 'VEN-01', name: 'Dell Technologies India Pvt Ltd', gstin: '27AAECD1234F1Z5', contactPerson: 'Suresh Iyer', email: 'accounts@delltech.example.in', phone: '022-6612-3000', address: 'World Trade Centre, Mumbai', services: ['Laptops', 'Desktops', 'Networking Equipment', 'IT AMC'], isAmcPartner: true, rating: 4.5, status: VendorStatus.Active },
  { id: 'ven-coolcare', code: 'VEN-02', name: 'CoolCare Engineering Services', gstin: '27AACCC5678G1Z2', contactPerson: 'Ramesh Pillai', email: 'service@coolcare.example.in', phone: '022-4123-8800', address: 'Andheri East, Mumbai', services: ['HVAC Installation', 'AC AMC'], isAmcPartner: true, rating: 4.2, status: VendorStatus.Active },
  { id: 'ven-fleet', code: 'VEN-03', name: 'Apex Fleet Solutions', gstin: '29AAEFA4321H1Z9', contactPerson: 'Ganesh Rao', email: 'fleet@apexfleet.example.in', phone: '080-4567-1200', address: 'Whitefield, Bengaluru', services: ['Vehicle Leasing', 'Vehicle Maintenance'], isAmcPartner: true, rating: 4.0, status: VendorStatus.Active },
  { id: 'ven-office', code: 'VEN-04', name: 'OfficeFirst Interiors', gstin: '27AAOFI8765I1Z3', contactPerson: 'Priyanka Shetty', email: 'sales@officefirst.example.in', phone: '022-2988-4400', address: 'Lower Parel, Mumbai', services: ['Office Furniture', 'Interior Fit-outs'], isAmcPartner: false, rating: 3.8, status: VendorStatus.Active },
  { id: 'ven-secure', code: 'VEN-05', name: 'SecureMove Logistics', gstin: '27AASML2468J1Z7', contactPerson: 'Manoj Tiwari', email: 'ops@securemove.example.in', phone: '022-3311-9900', address: 'Bhandup, Mumbai', services: ['Courier', 'Relocation'], isAmcPartner: false, rating: 2.6, status: VendorStatus.Blacklisted },
];

export const SEED_EMPLOYEES: Employee[] = [
  { id: 'emp-mgmt1', code: 'EMP1001', name: 'Ananya Rao', email: 'ananya.rao@company.example', phone: '+91 98200 11001', designation: 'Chief Financial Officer', grade: 'M1', departmentId: 'dept-fin', locationId: 'loc-ho', role: UserRole.MANAGEMENT, status: EmployeeStatus.Active, joinedOn: '2019-04-01' },
  { id: 'emp-mgmt2', code: 'EMP1002', name: 'Vikram Shah', email: 'vikram.shah@company.example', phone: '+91 98200 11002', designation: 'Head of IT & Operations', grade: 'M2', departmentId: 'dept-it', locationId: 'loc-ho', reportsTo: 'emp-mgmt1', role: UserRole.MANAGEMENT, status: EmployeeStatus.Active, joinedOn: '2020-01-15' },
  { id: 'emp-admin1', code: 'EMP1003', name: 'Rohit Verma', email: 'rohit.verma@company.example', phone: '+91 98200 11003', designation: 'Asset & Procurement Manager', grade: 'M3', departmentId: 'dept-admin', locationId: 'loc-ho', reportsTo: 'emp-mgmt2', role: UserRole.ADMIN, status: EmployeeStatus.Active, joinedOn: '2020-06-10' },
  { id: 'emp-admin2', code: 'EMP1004', name: 'Kavita Desai', email: 'kavita.desai@company.example', phone: '+91 98200 11004', designation: 'Store & Inventory Executive', grade: 'E3', departmentId: 'dept-admin', locationId: 'loc-pwh', reportsTo: 'emp-admin1', role: UserRole.ADMIN, status: EmployeeStatus.Active, joinedOn: '2022-02-01' },
  { id: 'emp-aud1', code: 'EMP1005', name: 'Meera Iyer', email: 'meera.iyer@company.example', phone: '+91 98200 11005', designation: 'Internal Auditor', grade: 'M2', departmentId: 'dept-fin', locationId: 'loc-ho', reportsTo: 'emp-mgmt1', role: UserRole.AUDITOR, status: EmployeeStatus.Active, joinedOn: '2021-08-20' },
  { id: 'emp-e1', code: 'EMP1006', name: 'Karan Mehta', email: 'karan.mehta@company.example', phone: '+91 98200 11006', designation: 'Senior Software Engineer', grade: 'E4', departmentId: 'dept-it', locationId: 'loc-ho', reportsTo: 'emp-mgmt2', role: UserRole.EMPLOYEE, status: EmployeeStatus.Active, joinedOn: '2021-03-05' },
  { id: 'emp-e2', code: 'EMP1007', name: 'Sneha Joshi', email: 'sneha.joshi@company.example', phone: '+91 98200 11007', designation: 'HR Executive', grade: 'E2', departmentId: 'dept-hr', locationId: 'loc-ho', reportsTo: 'emp-mgmt1', role: UserRole.EMPLOYEE, status: EmployeeStatus.Active, joinedOn: '2022-07-18' },
  { id: 'emp-e3', code: 'EMP1008', name: 'Arjun Nair', email: 'arjun.nair@company.example', phone: '+91 98200 11008', designation: 'Regional Sales Manager', grade: 'E4', departmentId: 'dept-sales', locationId: 'loc-blr', reportsTo: 'emp-mgmt2', role: UserRole.EMPLOYEE, status: EmployeeStatus.Active, joinedOn: '2019-11-11' },
  { id: 'emp-e4', code: 'EMP1009', name: 'Divya Menon', email: 'divya.menon@company.example', phone: '+91 98200 11009', designation: 'Field Service Engineer', grade: 'E3', departmentId: 'dept-ops', locationId: 'loc-chn', reportsTo: 'emp-mgmt2', role: UserRole.EMPLOYEE, status: EmployeeStatus.Active, joinedOn: '2023-01-09' },
  { id: 'emp-e5', code: 'EMP1010', name: 'Rahul Kapoor', email: 'rahul.kapoor@company.example', phone: '+91 98200 11010', designation: 'Accounts Executive', grade: 'E2', departmentId: 'dept-fin', locationId: 'loc-ho', reportsTo: 'emp-mgmt1', role: UserRole.EMPLOYEE, status: EmployeeStatus.Active, joinedOn: '2023-05-22' },
  { id: 'emp-e6', code: 'EMP1011', name: 'Farhan Sheikh', email: 'farhan.sheikh@company.example', phone: '+91 98200 11011', designation: 'Branch Coordinator', grade: 'E3', departmentId: 'dept-sales', locationId: 'loc-del', reportsTo: 'emp-mgmt2', role: UserRole.EMPLOYEE, status: EmployeeStatus.Active, joinedOn: '2020-09-14' },
  { id: 'emp-e7', code: 'EMP1012', name: 'Neha Kulkarni', email: 'neha.kulkarni@company.example', phone: '+91 98200 11012', designation: 'Graphic Designer', grade: 'E2', departmentId: 'dept-sales', locationId: 'loc-ho', reportsTo: 'emp-mgmt2', role: UserRole.EMPLOYEE, status: EmployeeStatus.OnLeave, joinedOn: '2024-02-01' },
  { id: 'emp-e8', code: 'EMP1013', name: 'Sameer Qureshi', email: 'sameer.qureshi@company.example', phone: '+91 98200 11013', designation: 'Operations Executive', grade: 'E2', departmentId: 'dept-ops', locationId: 'loc-pwh', reportsTo: 'emp-mgmt2', role: UserRole.EMPLOYEE, status: EmployeeStatus.Exited, joinedOn: '2018-04-01' },
];

/** The demo login roster shown in the header's "switch user" menu. */
export const SEED_USERS: User[] = [
  { id: 'user-admin', name: 'Rohit Verma', role: UserRole.ADMIN, employeeId: 'emp-admin1' },
  { id: 'user-mgmt', name: 'Ananya Rao', role: UserRole.MANAGEMENT, employeeId: 'emp-mgmt1' },
  { id: 'user-mgmt2', name: 'Vikram Shah', role: UserRole.MANAGEMENT, employeeId: 'emp-mgmt2' },
  { id: 'user-emp', name: 'Karan Mehta', role: UserRole.EMPLOYEE, employeeId: 'emp-e1' },
  { id: 'user-aud', name: 'Meera Iyer', role: UserRole.AUDITOR, employeeId: 'emp-aud1' },
];

// ---------------------------------------------------------------------------
// Categories & variants
// ---------------------------------------------------------------------------

export const SEED_CATEGORIES: AssetCategory[] = [
  { id: 'cat-it', code: 'IT', name: 'IT Assets', description: 'All computing and networking hardware', depreciationMethod: DepreciationMethod.SLM, usefulLifeYears: 4, salvageValuePct: 5, capitalizationThreshold: 5000, requiresAmc: false, requiresSerialNumber: false, trackComponents: false, active: true },
  { id: 'cat-laptop', code: 'ITL', name: 'Laptops & Notebooks', parentId: 'cat-it', description: 'Employee-issued laptops and notebooks', depreciationMethod: DepreciationMethod.SLM, usefulLifeYears: 4, salvageValuePct: 5, capitalizationThreshold: 5000, requiresAmc: true, requiresSerialNumber: true, trackComponents: true, active: true },
  { id: 'cat-desktop', code: 'ITD', name: 'Desktops & Workstations', parentId: 'cat-it', description: 'Fixed desktop workstations', depreciationMethod: DepreciationMethod.SLM, usefulLifeYears: 5, salvageValuePct: 5, capitalizationThreshold: 5000, requiresAmc: true, requiresSerialNumber: true, trackComponents: true, active: true },
  { id: 'cat-mobile', code: 'ITM', name: 'Mobile Phones & Tablets', parentId: 'cat-it', description: 'Company-issued mobile handsets and tablets', depreciationMethod: DepreciationMethod.WDV, usefulLifeYears: 3, salvageValuePct: 10, capitalizationThreshold: 3000, requiresAmc: false, requiresSerialNumber: true, trackComponents: false, active: true },
  { id: 'cat-network', code: 'ITN', name: 'Networking Equipment', parentId: 'cat-it', description: 'Switches, routers, access points', depreciationMethod: DepreciationMethod.SLM, usefulLifeYears: 5, salvageValuePct: 5, capitalizationThreshold: 10000, requiresAmc: true, requiresSerialNumber: true, trackComponents: true, active: true },
  { id: 'cat-facilities', code: 'FAC', name: 'Facilities Assets', description: 'Office furniture and building equipment', depreciationMethod: DepreciationMethod.SLM, usefulLifeYears: 7, salvageValuePct: 5, capitalizationThreshold: 3000, requiresAmc: false, requiresSerialNumber: false, trackComponents: false, active: true },
  { id: 'cat-furniture', code: 'FACF', name: 'Furniture & Fixtures', parentId: 'cat-facilities', description: 'Desks, chairs, cabinets', depreciationMethod: DepreciationMethod.SLM, usefulLifeYears: 7, salvageValuePct: 5, capitalizationThreshold: 3000, requiresAmc: false, requiresSerialNumber: false, trackComponents: false, active: true },
  { id: 'cat-hvac', code: 'FACH', name: 'HVAC & Electrical Equipment', parentId: 'cat-facilities', description: 'Air conditioning and electrical plant', depreciationMethod: DepreciationMethod.WDV, usefulLifeYears: 10, salvageValuePct: 5, capitalizationThreshold: 10000, requiresAmc: true, requiresSerialNumber: true, trackComponents: true, active: true },
  { id: 'cat-vehicle', code: 'VEH', name: 'Vehicles', description: 'Company-owned vehicles', depreciationMethod: DepreciationMethod.WDV, usefulLifeYears: 8, salvageValuePct: 15, capitalizationThreshold: 50000, requiresAmc: true, requiresSerialNumber: true, trackComponents: true, active: true },
];

export const SEED_VARIANTS: AssetVariant[] = [
  { id: 'var-dell-5440', categoryId: 'cat-laptop', code: 'VAR-ITL-01', name: 'Dell Latitude 5440', manufacturer: 'Dell', modelNumber: 'Latitude-5440', specifications: [{ label: 'CPU', value: 'Intel Core i5-1335U' }, { label: 'RAM', value: '16GB' }, { label: 'Storage', value: '512GB SSD' }], standardCost: 78000, warrantyMonths: 36, uom: 'Nos', active: true },
  { id: 'var-mac-14', categoryId: 'cat-laptop', code: 'VAR-ITL-02', name: 'Apple MacBook Pro 14" (M3)', manufacturer: 'Apple', modelNumber: 'MBP14-M3', specifications: [{ label: 'Chip', value: 'Apple M3' }, { label: 'RAM', value: '18GB' }, { label: 'Storage', value: '512GB SSD' }], standardCost: 195000, warrantyMonths: 12, uom: 'Nos', active: true },
  { id: 'var-hp-elite', categoryId: 'cat-laptop', code: 'VAR-ITL-03', name: 'HP EliteBook 840 G10', manufacturer: 'HP', modelNumber: 'EliteBook-840-G10', specifications: [{ label: 'CPU', value: 'Intel Core i5-1335U' }, { label: 'RAM', value: '16GB' }, { label: 'Storage', value: '512GB SSD' }], standardCost: 82000, warrantyMonths: 36, uom: 'Nos', active: true },
  { id: 'var-dell-optiplex', categoryId: 'cat-desktop', code: 'VAR-ITD-01', name: 'Dell OptiPlex 7010 Tower', manufacturer: 'Dell', modelNumber: 'OptiPlex-7010', specifications: [{ label: 'CPU', value: 'Intel Core i5-13500' }, { label: 'RAM', value: '16GB' }, { label: 'Storage', value: '1TB HDD' }], standardCost: 62000, warrantyMonths: 36, uom: 'Nos', active: true },
  { id: 'var-iphone14', categoryId: 'cat-mobile', code: 'VAR-ITM-01', name: 'Apple iPhone 14 128GB', manufacturer: 'Apple', modelNumber: 'iPhone14-128', specifications: [{ label: 'Storage', value: '128GB' }], standardCost: 69900, warrantyMonths: 12, uom: 'Nos', active: true },
  { id: 'var-samsung-a54', categoryId: 'cat-mobile', code: 'VAR-ITM-02', name: 'Samsung Galaxy A54', manufacturer: 'Samsung', modelNumber: 'Galaxy-A54', specifications: [{ label: 'Storage', value: '128GB' }], standardCost: 34999, warrantyMonths: 12, uom: 'Nos', active: true },
  { id: 'var-cisco-9200', categoryId: 'cat-network', code: 'VAR-ITN-01', name: 'Cisco Catalyst 9200 24-Port Switch', manufacturer: 'Cisco', modelNumber: 'C9200-24P', specifications: [{ label: 'Ports', value: '24 x 1GbE' }], standardCost: 285000, warrantyMonths: 60, uom: 'Nos', active: true },
  { id: 'var-ergo-chair', categoryId: 'cat-furniture', code: 'VAR-FACF-01', name: 'Godrej Ergo Pro Chair', manufacturer: 'Godrej Interio', modelNumber: 'ErgoPro', specifications: [{ label: 'Type', value: 'High-back mesh, adjustable' }], standardCost: 12500, warrantyMonths: 24, uom: 'Nos', active: true },
  { id: 'var-workstation-desk', categoryId: 'cat-furniture', code: 'VAR-FACF-02', name: 'Featherlite L-Shape Workstation', manufacturer: 'Featherlite', modelNumber: 'LShape-WS', specifications: [{ label: 'Size', value: '5ft x 4ft' }], standardCost: 18500, warrantyMonths: 12, uom: 'Nos', active: true },
  { id: 'var-voltas-ac', categoryId: 'cat-hvac', code: 'VAR-FACH-01', name: 'Voltas 1.5 Ton Split AC (5 Star)', manufacturer: 'Voltas', modelNumber: 'SAC-183V', specifications: [{ label: 'Capacity', value: '1.5 Ton' }, { label: 'Rating', value: '5 Star' }], standardCost: 45000, warrantyMonths: 12, uom: 'Nos', active: true },
  { id: 'var-xuv700', categoryId: 'cat-vehicle', code: 'VAR-VEH-01', name: 'Mahindra XUV700 AX7', manufacturer: 'Mahindra', modelNumber: 'XUV700-AX7', specifications: [{ label: 'Fuel', value: 'Diesel' }, { label: 'Transmission', value: 'Automatic' }], standardCost: 2450000, warrantyMonths: 36, uom: 'Nos', active: true },
];

// ---------------------------------------------------------------------------
// Asset register
// ---------------------------------------------------------------------------

export const SEED_ASSETS: Asset[] = [
  {
    id: 'asset-001', assetTag: 'ITL-HO-0001', name: 'Dell Latitude 5440', categoryId: 'cat-laptop', variantId: 'var-dell-5440',
    serialNumber: 'DL5440-2301', status: AssetStatus.InUse, condition: AssetCondition.Good, criticality: Criticality.Medium,
    custodianId: 'emp-e1', departmentId: 'dept-it', locationId: 'loc-ho',
    vendorId: 'ven-dell', poNo: 'PO/2023-24/LEG-011', grnNo: 'GRN/2023-24/LEG-009', invoiceNo: 'DELL-INV-88213',
    purchaseDate: '2023-06-12', capitalizedOn: '2023-06-15', purchaseCost: 78000, warrantyExpiry: '2026-06-12',
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM, amcContractId: 'amc-001',
    lastVerifiedOn: '2026-03-18', lastVerifiedBy: 'Meera Iyer',
    history: [
      { id: 'evt-001-1', date: '2023-06-15', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register from GRN/2023-24/LEG-009', actor: 'Rohit Verma' },
      { id: 'evt-001-2', date: '2023-06-16', type: AssetEventType.Assigned, title: 'Issued to Karan Mehta', detail: 'Custodian set on joining IT team', actor: 'Rohit Verma' },
      { id: 'evt-001-3', date: '2024-01-15', type: AssetEventType.ComponentAdded, title: 'RAM upgraded', detail: '8GB module added, total 16GB', actor: 'Rohit Verma' },
      { id: 'evt-001-4', date: '2025-09-01', type: AssetEventType.RepairCompleted, title: 'SSD replaced under AMC', detail: 'Ticket SRV/2025-26/0011 closed; 1TB NVMe fitted', actor: 'Rohit Verma', refNo: 'SRV/2025-26/0011' },
      { id: 'evt-001-5', date: '2026-03-18', type: AssetEventType.Verified, title: 'Found during physical verification', detail: 'Confirmed with custodian at Head Office', actor: 'Meera Iyer', refNo: 'PV/2025-26/0001' },
    ],
  },
  {
    id: 'asset-002', assetTag: 'ITL-HO-0002', name: 'Apple MacBook Pro 14"', categoryId: 'cat-laptop', variantId: 'var-mac-14',
    serialNumber: 'MAC14-8891', status: AssetStatus.InUse, condition: AssetCondition.Good, criticality: Criticality.High,
    custodianId: 'emp-mgmt2', departmentId: 'dept-it', locationId: 'loc-ho',
    vendorId: 'ven-dell', poNo: 'PO/2024-25/LEG-004', grnNo: 'GRN/2024-25/LEG-004', invoiceNo: 'DELL-INV-91045',
    purchaseDate: '2024-02-20', capitalizedOn: '2024-02-22', purchaseCost: 195000, warrantyExpiry: '2025-02-20',
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM,
    lastVerifiedOn: '2026-03-18', lastVerifiedBy: 'Meera Iyer',
    remarks: 'Out of warranty; no AMC coverage taken as this is a leadership-only device.',
    history: [
      { id: 'evt-002-1', date: '2024-02-22', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-002-2', date: '2024-02-23', type: AssetEventType.Assigned, title: 'Issued to Vikram Shah', detail: 'Head of IT & Operations', actor: 'Rohit Verma' },
      { id: 'evt-002-3', date: '2026-03-18', type: AssetEventType.Verified, title: 'Found during physical verification', detail: 'Confirmed at Head Office', actor: 'Meera Iyer', refNo: 'PV/2025-26/0001' },
    ],
  },
  {
    id: 'asset-003', assetTag: 'ITL-PWH-0001', name: 'HP EliteBook 840 G10 (Spare)', categoryId: 'cat-laptop', variantId: 'var-hp-elite',
    serialNumber: 'HPEB-1123', status: AssetStatus.InStore, condition: AssetCondition.New, criticality: Criticality.Low,
    departmentId: 'dept-it', locationId: 'loc-pwh', subLocation: 'IT Spares Rack A2',
    vendorId: 'ven-dell', poNo: 'PO/2025-26/0031', grnNo: 'GRN/2025-26/0028', invoiceNo: 'DELL-INV-97721',
    purchaseDate: '2025-01-10', capitalizedOn: '2025-01-12', purchaseCost: 82000, warrantyExpiry: '2028-01-10',
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM, amcContractId: 'amc-001',
    history: [
      { id: 'evt-003-1', date: '2025-01-12', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register as spare stock', actor: 'Kavita Desai' },
      { id: 'evt-003-2', date: '2025-01-12', type: AssetEventType.AmcLinked, title: 'Linked to AMC', detail: 'Added to comprehensive IT AMC', actor: 'Rohit Verma', refNo: 'AMC/2025-26/0001' },
    ],
  },
  {
    id: 'asset-004', assetTag: 'ITL-DEL-0001', name: 'Dell Latitude 5440', categoryId: 'cat-laptop', variantId: 'var-dell-5440',
    serialNumber: 'DL5440-2455', status: AssetStatus.InUse, condition: AssetCondition.Good, criticality: Criticality.Medium,
    custodianId: 'emp-e6', departmentId: 'dept-sales', locationId: 'loc-del',
    vendorId: 'ven-dell', poNo: 'PO/2024-25/LEG-019', grnNo: 'GRN/2024-25/LEG-017', invoiceNo: 'DELL-INV-93390',
    purchaseDate: '2024-08-01', capitalizedOn: '2024-08-04', purchaseCost: 79500, warrantyExpiry: '2027-08-01',
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM, amcContractId: 'amc-001',
    history: [
      { id: 'evt-004-1', date: '2024-08-04', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-004-2', date: '2024-08-10', type: AssetEventType.Transferred, title: 'Transferred to Delhi Branch', detail: 'Issued to Farhan Sheikh on hiring', actor: 'Rohit Verma', refNo: 'TRF/2024-25/0022' },
    ],
  },
  {
    id: 'asset-005', assetTag: 'ITL-HO-0003', name: 'Dell Latitude 5440', categoryId: 'cat-laptop', variantId: 'var-dell-5440',
    serialNumber: 'DL5440-1990', status: AssetStatus.UnderRepair, condition: AssetCondition.Fair, criticality: Criticality.Medium,
    custodianId: 'emp-e5', departmentId: 'dept-fin', locationId: 'loc-ho',
    vendorId: 'ven-dell', poNo: 'PO/2022-23/LEG-007', grnNo: 'GRN/2022-23/LEG-005', invoiceNo: 'DELL-INV-71120',
    purchaseDate: '2022-11-05', capitalizedOn: '2022-11-08', purchaseCost: 76000, warrantyExpiry: '2025-11-05',
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM, amcContractId: 'amc-001',
    history: [
      { id: 'evt-005-1', date: '2022-11-08', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-005-2', date: '2022-11-10', type: AssetEventType.Assigned, title: 'Issued to Rahul Kapoor', detail: 'Finance team allocation', actor: 'Rohit Verma' },
      { id: 'evt-005-3', date: '2026-08-28', type: AssetEventType.RepairRaised, title: 'Breakdown reported', detail: 'Not powering on; suspected motherboard/battery fault', actor: 'Rahul Kapoor', refNo: 'SRV/2026-27/0001' },
      { id: 'evt-005-4', date: '2026-08-29', type: AssetEventType.GatePassIssued, title: 'Sent to Dell Service Center', detail: 'Gate pass raised for outward repair movement', actor: 'Rohit Verma', refNo: 'GP/2026-27/0001' },
    ],
  },
  {
    id: 'asset-006', assetTag: 'ITM-BLR-0001', name: 'Apple iPhone 14', categoryId: 'cat-mobile', variantId: 'var-iphone14',
    serialNumber: 'IMEI-359123456001', status: AssetStatus.InUse, condition: AssetCondition.Good, criticality: Criticality.Low,
    custodianId: 'emp-e3', departmentId: 'dept-sales', locationId: 'loc-blr',
    vendorId: 'ven-dell', poNo: 'PO/2023-24/LEG-026', grnNo: 'GRN/2023-24/LEG-024', invoiceNo: 'DELL-INV-83341',
    purchaseDate: '2023-09-18', capitalizedOn: '2023-09-20', purchaseCost: 69900, warrantyExpiry: '2024-09-18',
    usefulLifeYears: 3, salvageValuePct: 10, depreciationMethod: DepreciationMethod.WDV,
    history: [
      { id: 'evt-006-1', date: '2023-09-20', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-006-2', date: '2023-09-22', type: AssetEventType.Assigned, title: 'Issued to Arjun Nair', detail: 'Regional Sales Manager, Bengaluru', actor: 'Rohit Verma' },
    ],
  },
  {
    id: 'asset-007', assetTag: 'ITM-HO-0001', name: 'Samsung Galaxy A54', categoryId: 'cat-mobile', variantId: 'var-samsung-a54',
    serialNumber: 'IMEI-887766554002', status: AssetStatus.Lost, condition: AssetCondition.Poor, criticality: Criticality.Low,
    custodianId: 'emp-e2', departmentId: 'dept-hr', locationId: 'loc-ho',
    vendorId: 'ven-dell', poNo: 'PO/2023-24/LEG-033', grnNo: 'GRN/2023-24/LEG-030', invoiceNo: 'DELL-INV-84502',
    purchaseDate: '2023-04-22', capitalizedOn: '2023-04-24', purchaseCost: 34999,
    usefulLifeYears: 3, salvageValuePct: 10, depreciationMethod: DepreciationMethod.WDV,
    remarks: 'Reported lost on 2026-08-10; police complaint / FIR obtained. Replacement issued via RPL/2026-27/0001.',
    history: [
      { id: 'evt-007-1', date: '2023-04-24', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-007-2', date: '2023-04-26', type: AssetEventType.Assigned, title: 'Issued to Sneha Joshi', detail: 'HR Executive allocation', actor: 'Rohit Verma' },
      { id: 'evt-007-3', date: '2026-08-10', type: AssetEventType.Updated, title: 'Reported lost', detail: 'Employee reported the handset lost while travelling; FIR copy collected', actor: 'Sneha Joshi', refNo: 'RPL/2026-27/0001' },
      { id: 'evt-007-4', date: '2026-08-20', type: AssetEventType.Replaced, title: 'Replaced', detail: 'Written off and replaced with a new unit', actor: 'Rohit Verma', refNo: 'RPL/2026-27/0001' },
    ],
  },
  {
    id: 'asset-008', assetTag: 'ITM-HO-0002', name: 'Samsung Galaxy A54', categoryId: 'cat-mobile', variantId: 'var-samsung-a54',
    serialNumber: 'IMEI-887799001118', status: AssetStatus.InUse, condition: AssetCondition.New, criticality: Criticality.Low,
    custodianId: 'emp-e2', departmentId: 'dept-hr', locationId: 'loc-ho',
    vendorId: 'ven-dell', poNo: 'PO/2026-27/0002', grnNo: 'GRN/2026-27/0002', invoiceNo: 'DELL-INV-99981',
    purchaseDate: '2026-08-18', capitalizedOn: '2026-08-20', purchaseCost: 35999, warrantyExpiry: '2027-08-18',
    usefulLifeYears: 3, salvageValuePct: 10, depreciationMethod: DepreciationMethod.WDV,
    history: [
      { id: 'evt-008-1', date: '2026-08-20', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Created via replacement purchase RPL/2026-27/0001', actor: 'Rohit Verma', refNo: 'GRN/2026-27/0002' },
      { id: 'evt-008-2', date: '2026-08-20', type: AssetEventType.Assigned, title: 'Issued to Sneha Joshi', detail: 'Replacement for lost handset', actor: 'Rohit Verma', refNo: 'RPL/2026-27/0001' },
    ],
  },
  {
    id: 'asset-009', assetTag: 'ITN-HO-0001', name: 'Cisco Catalyst 9200 Switch', categoryId: 'cat-network', variantId: 'var-cisco-9200',
    serialNumber: 'FCW2419L0XX', status: AssetStatus.InUse, condition: AssetCondition.Good, criticality: Criticality.High,
    departmentId: 'dept-it', locationId: 'loc-ho', subLocation: 'Server Room, 4th Floor',
    vendorId: 'ven-dell', poNo: 'PO/2021-22/LEG-002', grnNo: 'GRN/2021-22/LEG-002', invoiceNo: 'DELL-INV-55021',
    purchaseDate: '2021-07-01', capitalizedOn: '2021-07-05', purchaseCost: 285000, warrantyExpiry: '2026-07-01',
    usefulLifeYears: 5, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM, amcContractId: 'amc-001',
    lastVerifiedOn: '2026-03-18', lastVerifiedBy: 'Meera Iyer',
    history: [
      { id: 'evt-009-1', date: '2021-07-05', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Core network switch commissioned', actor: 'Rohit Verma' },
      { id: 'evt-009-2', date: '2026-03-18', type: AssetEventType.Verified, title: 'Found during physical verification', detail: 'Confirmed in server room', actor: 'Meera Iyer', refNo: 'PV/2025-26/0001' },
    ],
  },
  {
    id: 'asset-010', assetTag: 'FACF-PWH-0001', name: 'Godrej Ergo Pro Chair (Spare)', categoryId: 'cat-furniture', variantId: 'var-ergo-chair',
    serialNumber: 'FAC-CHR-0001', status: AssetStatus.InStore, condition: AssetCondition.New, criticality: Criticality.Low,
    departmentId: 'dept-admin', locationId: 'loc-pwh',
    vendorId: 'ven-office', poNo: 'PO/2023-24/LEG-041', grnNo: 'GRN/2023-24/LEG-038', invoiceNo: 'OFI-INV-2210',
    purchaseDate: '2023-03-01', capitalizedOn: '2023-03-03', purchaseCost: 12500,
    usefulLifeYears: 7, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM,
    history: [{ id: 'evt-010-1', date: '2023-03-03', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into spare furniture stock', actor: 'Kavita Desai' }],
  },
  {
    id: 'asset-011', assetTag: 'FACF-BLR-0001', name: 'Featherlite L-Shape Workstation', categoryId: 'cat-furniture', variantId: 'var-workstation-desk',
    serialNumber: 'FAC-DSK-0002', status: AssetStatus.InUse, condition: AssetCondition.Good, criticality: Criticality.Low,
    departmentId: 'dept-sales', locationId: 'loc-blr',
    vendorId: 'ven-office', poNo: 'PO/2022-23/LEG-018', grnNo: 'GRN/2022-23/LEG-015', invoiceNo: 'OFI-INV-1873',
    purchaseDate: '2022-05-15', capitalizedOn: '2022-05-18', purchaseCost: 18500,
    usefulLifeYears: 7, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM,
    history: [{ id: 'evt-011-1', date: '2022-05-18', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Fitted out at Bengaluru branch launch', actor: 'Kavita Desai' }],
  },
  {
    id: 'asset-012', assetTag: 'FACH-HO-0001', name: 'Voltas 1.5T Split AC - Server Room', categoryId: 'cat-hvac', variantId: 'var-voltas-ac',
    serialNumber: 'VOL-AC-0007', status: AssetStatus.InUse, condition: AssetCondition.Fair, criticality: Criticality.High,
    departmentId: 'dept-admin', locationId: 'loc-ho', subLocation: 'Server Room, 4th Floor',
    vendorId: 'ven-coolcare', poNo: 'PO/2019-20/LEG-014', grnNo: 'GRN/2019-20/LEG-012', invoiceNo: 'CC-INV-2041',
    purchaseDate: '2020-03-10', capitalizedOn: '2020-03-12', purchaseCost: 45000, warrantyExpiry: '2021-03-10',
    usefulLifeYears: 10, salvageValuePct: 5, depreciationMethod: DepreciationMethod.WDV, amcContractId: 'amc-003',
    lastVerifiedOn: '2026-03-18', lastVerifiedBy: 'Meera Iyer',
    history: [
      { id: 'evt-012-1', date: '2020-03-12', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Installed for server room cooling', actor: 'Rohit Verma' },
      { id: 'evt-012-2', date: '2026-03-18', type: AssetEventType.Verified, title: 'Found during physical verification', detail: 'Running condition confirmed', actor: 'Meera Iyer', refNo: 'PV/2025-26/0001' },
    ],
  },
  {
    id: 'asset-013', assetTag: 'FACH-DEL-0001', name: 'Voltas 1.5T Split AC - Pantry', categoryId: 'cat-hvac', variantId: 'var-voltas-ac',
    serialNumber: 'VOL-AC-0011', status: AssetStatus.UnderRepair, condition: AssetCondition.Poor, criticality: Criticality.Medium,
    departmentId: 'dept-admin', locationId: 'loc-del', subLocation: 'Pantry, 2nd Floor',
    vendorId: 'ven-coolcare', poNo: 'PO/2021-22/LEG-009', grnNo: 'GRN/2021-22/LEG-008', invoiceNo: 'CC-INV-2299',
    purchaseDate: '2021-06-20', capitalizedOn: '2021-06-22', purchaseCost: 46500, warrantyExpiry: '2022-06-20',
    usefulLifeYears: 10, salvageValuePct: 5, depreciationMethod: DepreciationMethod.WDV, amcContractId: 'amc-003',
    history: [
      { id: 'evt-013-1', date: '2021-06-22', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Installed at Delhi branch pantry', actor: 'Rohit Verma' },
      { id: 'evt-013-2', date: '2026-09-10', type: AssetEventType.RepairRaised, title: 'Breakdown reported', detail: 'Compressor not cooling, loud noise on startup', actor: 'Farhan Sheikh', refNo: 'SRV/2026-27/0002' },
    ],
  },
  {
    id: 'asset-014', assetTag: 'VEH-HO-0001', name: 'Mahindra XUV700 AX7 - CFO', categoryId: 'cat-vehicle', variantId: 'var-xuv700',
    serialNumber: 'MA1XUV700HO0001', status: AssetStatus.InUse, condition: AssetCondition.Good, criticality: Criticality.High,
    custodianId: 'emp-mgmt1', departmentId: 'dept-admin', locationId: 'loc-ho',
    vendorId: 'ven-fleet', poNo: 'PO/2022-23/LEG-002', grnNo: 'GRN/2022-23/LEG-002', invoiceNo: 'FLEET-INV-0091',
    purchaseDate: '2022-09-01', capitalizedOn: '2022-09-05', purchaseCost: 2450000,
    usefulLifeYears: 8, salvageValuePct: 15, depreciationMethod: DepreciationMethod.WDV, amcContractId: 'amc-004',
    insurancePolicyNo: 'HDFC-ERGO-MV-88213', insuranceExpiry: '2027-08-31',
    lastVerifiedOn: '2026-03-18', lastVerifiedBy: 'Meera Iyer',
    history: [
      { id: 'evt-014-1', date: '2022-09-05', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Company car procured for CFO', actor: 'Rohit Verma' },
      { id: 'evt-014-2', date: '2025-04-10', type: AssetEventType.ComponentAdded, title: 'Tyres replaced', detail: 'Front tyre set replaced during scheduled service', actor: 'Rohit Verma', refNo: 'AMC/2024-25/0001' },
      { id: 'evt-014-3', date: '2026-03-18', type: AssetEventType.Verified, title: 'Found during physical verification', detail: 'Vehicle inspected at Head Office', actor: 'Meera Iyer', refNo: 'PV/2025-26/0001' },
    ],
  },
  {
    id: 'asset-015', assetTag: 'VEH-HO-0002', name: 'Mahindra XUV700 - Pool Vehicle', categoryId: 'cat-vehicle', variantId: 'var-xuv700',
    serialNumber: 'MA1XUV700HO0002', status: AssetStatus.AwaitingDisposal, condition: AssetCondition.Poor, criticality: Criticality.Medium,
    departmentId: 'dept-admin', locationId: 'loc-ho',
    vendorId: 'ven-fleet', poNo: 'PO/2017-18/LEG-006', grnNo: 'GRN/2017-18/LEG-006', invoiceNo: 'FLEET-INV-0032',
    purchaseDate: '2018-01-15', capitalizedOn: '2018-01-20', purchaseCost: 1650000,
    usefulLifeYears: 8, salvageValuePct: 15, depreciationMethod: DepreciationMethod.WDV,
    remarks: 'Being replaced with a newer pool vehicle; sale in progress under DSP/2026-27/0001.',
    history: [
      { id: 'evt-015-1', date: '2018-01-20', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Pool vehicle procured', actor: 'Rohit Verma' },
      { id: 'evt-015-2', date: '2026-09-05', type: AssetEventType.Updated, title: 'Marked for disposal', detail: 'Fully depreciated pool car proposed for sale', actor: 'Rohit Verma', refNo: 'DSP/2026-27/0001' },
    ],
  },
  {
    id: 'asset-016', assetTag: 'ITL-HO-0004', name: 'Dell Latitude 5420 (Sold)', categoryId: 'cat-laptop', variantId: 'var-dell-5440',
    serialNumber: 'DL5420-1102', status: AssetStatus.Sold, condition: AssetCondition.Poor, criticality: Criticality.Low,
    departmentId: 'dept-it', locationId: 'loc-ho',
    vendorId: 'ven-dell', poNo: 'PO/2019-20/LEG-003', grnNo: 'GRN/2019-20/LEG-003', invoiceNo: 'DELL-INV-41220',
    purchaseDate: '2019-05-01', capitalizedOn: '2019-05-04', purchaseCost: 65000,
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM,
    disposal: { mode: DisposalMode.Sale, date: '2025-09-25', realisedValue: 8000, refNo: 'DSP/2025-26/0004' },
    remarks: 'Migrated from legacy register; original disposal case closed before this system went live.',
    history: [
      { id: 'evt-016-1', date: '2019-05-04', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-016-2', date: '2025-09-25', type: AssetEventType.Disposed, title: 'Sold', detail: 'Sold to employee under buy-back scheme', actor: 'Rohit Verma', refNo: 'DSP/2025-26/0004' },
    ],
  },
  {
    id: 'asset-017', assetTag: 'ITD-HO-0001', name: 'Dell OptiPlex 7010 - Reception', categoryId: 'cat-desktop', variantId: 'var-dell-optiplex',
    serialNumber: 'OPX7010-0451', status: AssetStatus.InUse, condition: AssetCondition.Fair, criticality: Criticality.Low,
    departmentId: 'dept-admin', locationId: 'loc-ho', subLocation: 'Reception',
    vendorId: 'ven-dell', poNo: 'PO/2020-21/LEG-011', grnNo: 'GRN/2020-21/LEG-009', invoiceNo: 'DELL-INV-49982',
    purchaseDate: '2021-01-20', capitalizedOn: '2021-01-22', purchaseCost: 62000, warrantyExpiry: '2024-01-20',
    usefulLifeYears: 5, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM,
    lastVerifiedOn: '2026-03-18', lastVerifiedBy: 'Meera Iyer',
    history: [
      { id: 'evt-017-1', date: '2021-01-22', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register for shared reception use', actor: 'Rohit Verma' },
      { id: 'evt-017-2', date: '2026-03-18', type: AssetEventType.Verified, title: 'Found during physical verification', detail: 'Confirmed at reception desk', actor: 'Meera Iyer', refNo: 'PV/2025-26/0001' },
    ],
  },
  {
    id: 'asset-018', assetTag: 'ITD-HO-0002', name: 'Dell OptiPlex 5090 (Written Off)', categoryId: 'cat-desktop', variantId: 'var-dell-optiplex',
    serialNumber: 'OPX5090-0209', status: AssetStatus.WrittenOff, condition: AssetCondition.Unserviceable, criticality: Criticality.Low,
    departmentId: 'dept-admin', locationId: 'loc-ho',
    vendorId: 'ven-dell', poNo: 'PO/2019-20/LEG-021', grnNo: 'GRN/2019-20/LEG-018', invoiceNo: 'DELL-INV-38812',
    purchaseDate: '2020-02-14', capitalizedOn: '2020-02-17', purchaseCost: 58000,
    usefulLifeYears: 5, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM,
    disposal: { mode: DisposalMode.WriteOff, date: '2025-09-20', realisedValue: 0, refNo: 'DSP/2025-26/0001' },
    history: [
      { id: 'evt-018-1', date: '2020-02-17', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-018-2', date: '2025-09-18', type: AssetEventType.Updated, title: 'Water damage reported', detail: 'Ceiling leak damaged the unit beyond economical repair', actor: 'Rohit Verma' },
      { id: 'evt-018-3', date: '2025-09-20', type: AssetEventType.Disposed, title: 'Written off', detail: 'Approved write-off; unit scrapped with no resale value', actor: 'Ananya Rao', refNo: 'DSP/2025-26/0001' },
    ],
  },
  {
    id: 'asset-019', assetTag: 'ITL-HO-0005', name: 'Dell Latitude 5410 (Scrapped)', categoryId: 'cat-laptop', variantId: 'var-dell-5440',
    serialNumber: 'DL5410-0087', status: AssetStatus.Scrapped, condition: AssetCondition.Unserviceable, criticality: Criticality.Low,
    departmentId: 'dept-it', locationId: 'loc-ho',
    vendorId: 'ven-dell', poNo: 'PO/2018-19/LEG-009', grnNo: 'GRN/2018-19/LEG-007', invoiceNo: 'DELL-INV-29981',
    purchaseDate: '2019-08-01', capitalizedOn: '2019-08-03', purchaseCost: 60000,
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM,
    disposal: { mode: DisposalMode.Scrap, date: '2025-11-10', realisedValue: 500, refNo: 'DSP/2025-26/0002' },
    remarks: 'Migrated from legacy register.',
    history: [
      { id: 'evt-019-1', date: '2019-08-03', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-019-2', date: '2025-11-10', type: AssetEventType.Disposed, title: 'Scrapped', detail: 'Chassis damage beyond repair; scrapped for parts', actor: 'Rohit Verma', refNo: 'DSP/2025-26/0002' },
    ],
  },
  {
    id: 'asset-020', assetTag: 'ITL-PWH-0002', name: 'Dell Latitude 5440', categoryId: 'cat-laptop', variantId: 'var-dell-5440',
    serialNumber: 'DL5440-2601', status: AssetStatus.InTransit, condition: AssetCondition.New, criticality: Criticality.Medium,
    departmentId: 'dept-sales', locationId: 'loc-pwh',
    vendorId: 'ven-dell', poNo: 'PO/2026-27/0001', grnNo: 'GRN/2026-27/0001', invoiceNo: 'DELL-INV-99872',
    purchaseDate: '2026-09-02', capitalizedOn: '2026-09-04', purchaseCost: 79500, warrantyExpiry: '2029-09-02',
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM, amcContractId: 'amc-001',
    history: [
      { id: 'evt-020-1', date: '2026-09-04', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Received centrally at Pune warehouse', actor: 'Kavita Desai', refNo: 'GRN/2026-27/0001' },
      { id: 'evt-020-2', date: '2026-09-12', type: AssetEventType.Transferred, title: 'Dispatched to Bengaluru', detail: 'Inter-branch transfer initiated for new hire', actor: 'Kavita Desai', refNo: 'TRF/2026-27/0002' },
    ],
  },
  {
    id: 'asset-021', assetTag: 'ITL-CHN-0001', name: 'Dell Latitude 5440', categoryId: 'cat-laptop', variantId: 'var-dell-5440',
    serialNumber: 'DL5440-2477', status: AssetStatus.IssuedOut, condition: AssetCondition.Good, criticality: Criticality.Medium,
    custodianId: 'emp-e4', departmentId: 'dept-ops', locationId: 'loc-chn',
    vendorId: 'ven-dell', poNo: 'PO/2024-25/LEG-027', grnNo: 'GRN/2024-25/LEG-025', invoiceNo: 'DELL-INV-94410',
    purchaseDate: '2024-09-15', capitalizedOn: '2024-09-18', purchaseCost: 79500, warrantyExpiry: '2027-09-15',
    usefulLifeYears: 4, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM, amcContractId: 'amc-001',
    history: [
      { id: 'evt-021-1', date: '2024-09-18', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Rohit Verma' },
      { id: 'evt-021-2', date: '2026-04-02', type: AssetEventType.GatePassIssued, title: 'Issued for onsite deployment', detail: 'Gate pass raised for Chennai client site posting', actor: 'Rohit Verma', refNo: 'GP/2026-27/0003' },
    ],
  },
  {
    id: 'asset-022', assetTag: 'FACF-PWH-0002', name: 'Godrej Ergo Chair (Retired)', categoryId: 'cat-furniture', variantId: 'var-ergo-chair',
    serialNumber: 'FAC-CHR-0009', status: AssetStatus.Retired, condition: AssetCondition.Unserviceable, criticality: Criticality.Low,
    departmentId: 'dept-admin', locationId: 'loc-pwh', subLocation: 'Dead Stock Room',
    vendorId: 'ven-office', poNo: 'PO/2018-19/LEG-015', grnNo: 'GRN/2018-19/LEG-013', invoiceNo: 'OFI-INV-1102',
    purchaseDate: '2018-11-01', capitalizedOn: '2018-11-03', purchaseCost: 11000,
    usefulLifeYears: 7, salvageValuePct: 5, depreciationMethod: DepreciationMethod.SLM,
    remarks: 'Fully depreciated and broken; kept in dead stock pending a scrap drive, not yet formally disposed.',
    history: [
      { id: 'evt-022-1', date: '2018-11-03', type: AssetEventType.Created, title: 'Asset capitalised', detail: 'Booked into register', actor: 'Kavita Desai' },
      { id: 'evt-022-2', date: '2026-01-15', type: AssetEventType.Updated, title: 'Retired from active use', detail: 'Frame cracked; moved to dead stock room', actor: 'Kavita Desai' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const SEED_COMPONENTS: AssetComponent[] = [
  { id: 'comp-001', assetId: 'asset-001', name: '8GB RAM Module (Upgrade)', partNumber: 'DDR4-8GB-2666', cost: 3200, installedOn: '2024-01-15', status: ComponentStatus.Installed, source: 'Purchase', remarks: 'Upgraded from 8GB to 16GB total RAM.' },
  { id: 'comp-002', assetId: 'asset-001', name: 'Original 512GB SSD', partNumber: 'SSD-512-ORIG', serialNumber: 'SSD-512-ORIG', cost: 0, installedOn: '2023-06-12', removedOn: '2025-09-01', status: ComponentStatus.Replaced, replacedByComponentId: 'comp-003', source: 'Purchase' },
  { id: 'comp-003', assetId: 'asset-001', name: '1TB NVMe SSD (Replacement)', partNumber: 'SSD-1TB-REPL', serialNumber: 'SSD-1TB-REPL', cost: 4800, installedOn: '2025-09-01', status: ComponentStatus.Installed, source: 'Repair', warrantyExpiry: '2026-09-01', remarks: 'Replaced under SRV/2025-26/0011 following SSD failure; covered by AMC.' },
  { id: 'comp-004', assetId: 'asset-005', name: 'Laptop Battery', partNumber: 'DL-BATT-68WH', cost: 0, installedOn: '2022-11-05', status: ComponentStatus.Faulty, source: 'Purchase', remarks: 'Battery swelling detected during current repair visit; flagged for replacement.' },
  { id: 'comp-005', assetId: 'asset-014', name: 'Front Tyres (Set of 2)', partNumber: 'MRF-ZLX-215', cost: 14000, installedOn: '2025-04-10', status: ComponentStatus.Installed, source: 'Repair', remarks: 'Replaced during scheduled AMC service.' },
  { id: 'comp-006', assetId: 'asset-009', name: 'SFP Transceiver Module Bank', partNumber: 'CIS-SFP-4PK', cost: 22000, installedOn: '2021-07-01', status: ComponentStatus.Installed, source: 'Purchase' },
];

// ---------------------------------------------------------------------------
// Procurement: requisition -> purchase order -> GRN
// ---------------------------------------------------------------------------

export const SEED_REQUISITIONS: Requisition[] = [
  {
    id: 'req-001', prNo: 'PR/2026-27/0001', status: DocStatus.Draft, approvals: [],
    requestedById: 'emp-e1', departmentId: 'dept-it', locationId: 'loc-ho', requiredBy: '2026-10-15',
    justification: 'New joiner laptop requirement for the platform engineering team.',
    lines: [{ id: 'rl-001', categoryId: 'cat-laptop', variantId: 'var-dell-5440', description: 'Dell Latitude 5440', quantity: 1, estimatedUnitCost: 80000 }],
    estimatedValue: 80000, createdOn: '2026-09-12',
  },
  {
    id: 'req-002', prNo: 'PR/2026-27/0002', status: DocStatus.PendingApproval,
    approvals: [{ level: 1, ruleId: 'doa-pr-1', approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Pending }],
    requestedById: 'emp-e3', departmentId: 'dept-sales', locationId: 'loc-blr', requiredBy: '2026-10-05',
    justification: 'Field sales team mobile refresh - 3 units for the new Bengaluru hires.',
    lines: [{ id: 'rl-002', categoryId: 'cat-mobile', variantId: 'var-samsung-a54', description: 'Samsung Galaxy A54', quantity: 3, estimatedUnitCost: 35000 }],
    estimatedValue: 105000, createdOn: '2026-09-10',
  },
  {
    id: 'req-003', prNo: 'PR/2026-27/0003', status: DocStatus.Approved,
    approvals: [{ level: 1, ruleId: 'doa-pr-1', approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Approved, actedBy: 'Ananya Rao', actedOn: '2026-08-16 11:20' }],
    requestedById: 'emp-admin1', departmentId: 'dept-hr', locationId: 'loc-ho', requiredBy: '2026-08-25',
    justification: 'Replacement mobile handset for Sneha Joshi following loss of company device (FIR obtained).',
    lines: [{ id: 'rl-003', categoryId: 'cat-mobile', variantId: 'var-samsung-a54', description: 'Samsung Galaxy A54', quantity: 1, estimatedUnitCost: 36000, forEmployeeId: 'emp-e2' }],
    estimatedValue: 36000, createdOn: '2026-08-15', poId: 'po-002', poNo: 'PO/2026-27/0002',
  },
];

export const SEED_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-001', poNo: 'PO/2026-27/0001', status: DocStatus.PartiallyReceived,
    approvals: [
      { level: 1, ruleId: 'doa-po-1', approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-08-25 10:05' },
      { level: 2, ruleId: 'doa-po-2', approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Approved, actedBy: 'Vikram Shah', actedOn: '2026-08-26 09:15' },
    ],
    vendorId: 'ven-dell', orderDate: '2026-08-27', expectedDeliveryDate: '2026-09-10', deliverToLocationId: 'loc-pwh', departmentId: 'dept-it',
    lines: [{ id: 'pol-001', categoryId: 'cat-laptop', variantId: 'var-dell-5440', description: 'Dell Latitude 5440', quantity: 2, unitPrice: 79500, taxPercent: 18, receivedQty: 1 }],
    subTotal: 159000, taxTotal: 28620, grandTotal: 187620, paymentTerms: 'Net 30', warrantyTerms: '3-year onsite warranty', createdById: 'emp-admin1',
  },
  {
    id: 'po-002', poNo: 'PO/2026-27/0002', status: DocStatus.Received,
    approvals: [{ level: 1, ruleId: 'doa-po-1', approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-08-16 15:40' }],
    prId: 'req-003', prNo: 'PR/2026-27/0003',
    vendorId: 'ven-dell', orderDate: '2026-08-17', expectedDeliveryDate: '2026-08-20', deliverToLocationId: 'loc-ho', departmentId: 'dept-hr',
    lines: [{ id: 'pol-002', categoryId: 'cat-mobile', variantId: 'var-samsung-a54', description: 'Samsung Galaxy A54', quantity: 1, unitPrice: 35999, taxPercent: 18, receivedQty: 1 }],
    subTotal: 35999, taxTotal: 6480, grandTotal: 42479, paymentTerms: 'Net 15', warrantyTerms: '1-year manufacturer warranty', createdById: 'emp-admin1',
  },
  {
    id: 'po-003', poNo: 'PO/2026-27/0003', status: DocStatus.PendingApproval,
    approvals: [
      { level: 1, ruleId: 'doa-po-1', approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-09-11 12:00' },
      { level: 2, ruleId: 'doa-po-2', approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Pending },
    ],
    vendorId: 'ven-office', orderDate: '2026-09-11', expectedDeliveryDate: '2026-09-30', deliverToLocationId: 'loc-pwh', departmentId: 'dept-admin',
    lines: [
      { id: 'pol-003', categoryId: 'cat-furniture', variantId: 'var-ergo-chair', description: 'Godrej Ergo Pro Chair', quantity: 4, unitPrice: 12500, taxPercent: 18, receivedQty: 0 },
      { id: 'pol-004', categoryId: 'cat-furniture', variantId: 'var-workstation-desk', description: 'Featherlite L-Shape Workstation', quantity: 2, unitPrice: 18500, taxPercent: 18, receivedQty: 0 },
    ],
    subTotal: 87000, taxTotal: 15660, grandTotal: 102660, paymentTerms: 'Net 30', warrantyTerms: 'Standard manufacturer warranty', createdById: 'emp-admin1',
    remarks: 'Restocking spare furniture pool ahead of Q3 hiring.',
  },
];

export const SEED_GRNS: Grn[] = [
  {
    id: 'grn-001', grnNo: 'GRN/2026-27/0001', poId: 'po-001', poNo: 'PO/2026-27/0001', vendorId: 'ven-dell',
    receivedOn: '2026-09-04', receivedById: 'emp-admin2', locationId: 'loc-pwh', departmentId: 'dept-it',
    invoiceNo: 'DELL-INV-99872', invoiceDate: '2026-09-03', invoiceValue: 93810,
    lines: [{ id: 'gl-001', poLineId: 'pol-001', categoryId: 'cat-laptop', variantId: 'var-dell-5440', description: 'Dell Latitude 5440', orderedQty: 2, receivedQty: 1, acceptedQty: 1, rejectedQty: 0, unitPrice: 79500, serialNumbers: ['DL5440-2601'] }],
    status: DocStatus.Received, inspectionRemarks: 'One unit received in this shipment; balance quantity pending from vendor.',
    createdAssetIds: ['asset-020'],
  },
  {
    id: 'grn-002', grnNo: 'GRN/2026-27/0002', poId: 'po-002', poNo: 'PO/2026-27/0002', vendorId: 'ven-dell',
    receivedOn: '2026-08-20', receivedById: 'emp-admin1', locationId: 'loc-ho', departmentId: 'dept-hr',
    invoiceNo: 'DELL-INV-99981', invoiceDate: '2026-08-19', invoiceValue: 42479,
    lines: [{ id: 'gl-002', poLineId: 'pol-002', categoryId: 'cat-mobile', variantId: 'var-samsung-a54', description: 'Samsung Galaxy A54', orderedQty: 1, receivedQty: 1, acceptedQty: 1, rejectedQty: 0, unitPrice: 35999, serialNumbers: ['IMEI-887799001118'] }],
    status: DocStatus.Received, inspectionRemarks: 'Received in full, inspected and accepted.',
    createdAssetIds: ['asset-008'],
  },
];

// ---------------------------------------------------------------------------
// Movement: transfers & gate passes
// ---------------------------------------------------------------------------

export const SEED_TRANSFERS: Transfer[] = [
  {
    id: 'trf-001', transferNo: 'TRF/2024-25/0022', status: DocStatus.Completed, approvals: [],
    type: TransferType.Custodian, assetIds: ['asset-004'], fromLocationId: 'loc-ho', toLocationId: 'loc-del',
    fromDepartmentId: 'dept-it', toDepartmentId: 'dept-sales', toCustodianId: 'emp-e6',
    requestedById: 'emp-admin1', reason: 'New hire equipment issue - Farhan Sheikh, Delhi Branch.',
    requiresGatePass: false, createdOn: '2024-08-08', dispatchedOn: '2024-08-09', receivedOn: '2024-08-10',
    acknowledgedById: 'emp-e6', acknowledgementRemarks: 'Received in good condition.', value: 79500,
  },
  {
    id: 'trf-002', transferNo: 'TRF/2026-27/0002', status: DocStatus.InTransit,
    approvals: [{ level: 1, ruleId: 'doa-trf-1', approverTitle: 'Asset Custodian / Store Admin', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-09-11 10:00' }],
    type: TransferType.InterBranch, assetIds: ['asset-020'], fromLocationId: 'loc-pwh', toLocationId: 'loc-blr',
    fromDepartmentId: 'dept-it', toDepartmentId: 'dept-sales',
    requestedById: 'emp-admin2', reason: 'New hire - Bengaluru sales team onboarding on 2026-09-20.',
    requiresGatePass: false, createdOn: '2026-09-11', dispatchedOn: '2026-09-12', value: 79500,
  },
  {
    id: 'trf-003', transferNo: 'TRF/2026-27/0003', status: DocStatus.PendingApproval,
    approvals: [{ level: 1, ruleId: 'doa-trf-1', approverTitle: 'Asset Custodian / Store Admin', approverRole: UserRole.ADMIN, status: ApprovalStatus.Pending }],
    type: TransferType.Location, assetIds: ['asset-003'], fromLocationId: 'loc-pwh', toLocationId: 'loc-ho',
    fromDepartmentId: 'dept-it', toDepartmentId: 'dept-it',
    requestedById: 'emp-admin2', reason: 'Move spare laptop to Head Office to cover an upcoming new joiner.',
    requiresGatePass: false, createdOn: '2026-09-14', value: 82000,
  },
];

export const SEED_GATE_PASSES: GatePass[] = [
  {
    id: 'gp-001', gatePassNo: 'GP/2026-27/0001', status: DocStatus.Issued,
    approvals: [{ level: 1, ruleId: 'doa-gp-1', approverTitle: 'Security / Admin Officer', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-08-29 09:30' }],
    type: GatePassType.Returnable, purpose: GatePassPurpose.Repair, assetIds: ['asset-005'],
    issuedToType: 'Vendor', issuedToVendorId: 'ven-dell', issuedToName: 'Dell Technologies India Pvt Ltd - Service Center',
    fromLocationId: 'loc-ho', destination: 'Dell Authorized Service Center, Andheri East, Mumbai', carrierName: 'Dell Logistics',
    issuedById: 'emp-admin1', issueDate: '2026-08-29', expectedReturnDate: '2026-09-08',
    linkedRefType: 'ServiceTicket', linkedRefNo: 'SRV/2026-27/0001', value: 76000, createdOn: '2026-08-29',
  },
  {
    id: 'gp-002', gatePassNo: 'GP/2026-27/0002', status: DocStatus.PendingApproval,
    approvals: [{ level: 1, ruleId: 'doa-gp-1', approverTitle: 'Security / Admin Officer', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-09-06 14:10' }, { level: 2, ruleId: 'doa-gp-2', approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Pending }],
    type: GatePassType.NonReturnable, purpose: GatePassPurpose.Sale, assetIds: ['asset-015'],
    issuedToType: 'External', issuedToName: 'Mr. Suresh Kulkarni (Buyer)', issuedToContact: '+91 98111 22334',
    fromLocationId: 'loc-ho', destination: 'Buyer to collect from Head Office parking',
    issuedById: 'emp-admin1', issueDate: '2026-09-20',
    linkedRefType: 'Disposal', linkedRefNo: 'DSP/2026-27/0001', value: 150000, createdOn: '2026-09-06',
  },
  {
    id: 'gp-003', gatePassNo: 'GP/2026-27/0003', status: DocStatus.Issued,
    approvals: [{ level: 1, ruleId: 'doa-gp-1', approverTitle: 'Security / Admin Officer', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-04-02 09:00' }],
    type: GatePassType.Returnable, purpose: GatePassPurpose.WorkFromHome, assetIds: ['asset-021'],
    issuedToType: 'Employee', issuedToEmployeeId: 'emp-e4', issuedToName: 'Divya Menon',
    fromLocationId: 'loc-ho', destination: 'Chennai Client Site (extended onsite posting)',
    issuedById: 'emp-admin1', issueDate: '2026-04-02', expectedReturnDate: '2027-04-02',
    value: 79500, createdOn: '2026-04-02',
  },
  {
    id: 'gp-004', gatePassNo: 'GP/2025-26/0004', status: DocStatus.Returned,
    approvals: [{ level: 1, ruleId: 'doa-gp-1', approverTitle: 'Security / Admin Officer', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2025-08-20 10:00' }],
    type: GatePassType.Returnable, purpose: GatePassPurpose.Repair, assetIds: ['asset-001'],
    issuedToType: 'Vendor', issuedToVendorId: 'ven-dell', issuedToName: 'Dell Technologies India Pvt Ltd - Service Center',
    fromLocationId: 'loc-ho', destination: 'Dell Authorized Service Center, Andheri East, Mumbai',
    issuedById: 'emp-admin1', issueDate: '2025-08-20', expectedReturnDate: '2025-08-30', actualReturnDate: '2025-09-01',
    linkedRefType: 'ServiceTicket', linkedRefNo: 'SRV/2025-26/0011', value: 78000, createdOn: '2025-08-20',
  },
];

// ---------------------------------------------------------------------------
// Maintenance: AMC, repairs, replacements
// ---------------------------------------------------------------------------

export const SEED_AMC_CONTRACTS: AmcContract[] = [
  {
    id: 'amc-001', contractNo: 'AMC/2025-26/0001', status: DocStatus.Active,
    approvals: [{ level: 1, ruleId: 'doa-amc-1', approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2025-09-20 11:00' }],
    vendorId: 'ven-dell', type: AmcType.Comprehensive, assetIds: ['asset-001', 'asset-003', 'asset-004', 'asset-009', 'asset-020', 'asset-021'],
    startDate: '2025-10-01', endDate: '2026-09-30', contractValue: 145000, paymentFrequency: PaymentFrequency.Annual,
    slaResponseHours: 24, preventiveVisitsPerYear: 2,
    visits: [
      { id: 'visit-001', scheduledOn: '2026-01-15', completedOn: '2026-01-16', type: 'Preventive', technician: 'Dell Field Engineer - S. Kamble', remarks: 'Routine health check, all units healthy.' },
      { id: 'visit-002', scheduledOn: '2026-07-15', completedOn: '2026-07-17', type: 'Preventive', technician: 'Dell Field Engineer - S. Kamble', remarks: 'Cleaned vents, updated firmware on switch.' },
    ],
    coverageNotes: 'Comprehensive parts & labour coverage for covered laptops and the core network switch.',
    ownerId: 'emp-admin1', renewalReminderDays: 30, createdOn: '2025-09-15',
  },
  {
    id: 'amc-002', contractNo: 'AMC/2026-27/0001', status: DocStatus.PendingApproval,
    approvals: [{ level: 1, ruleId: 'doa-amc-1', approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-09-08 10:00' }, { level: 2, ruleId: 'doa-amc-2', approverTitle: 'Chief Financial Officer', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Pending }],
    vendorId: 'ven-dell', type: AmcType.Comprehensive, assetIds: ['asset-001', 'asset-003', 'asset-004', 'asset-009', 'asset-020', 'asset-021'],
    startDate: '2026-10-01', endDate: '2027-09-30', contractValue: 158000, paymentFrequency: PaymentFrequency.Annual,
    slaResponseHours: 24, preventiveVisitsPerYear: 2, visits: [],
    coverageNotes: 'Renewal of AMC/2025-26/0001 with two additional laptops added to scope.',
    ownerId: 'emp-admin1', renewedFromId: 'amc-001', renewalReminderDays: 30, createdOn: '2026-09-08',
  },
  {
    id: 'amc-003', contractNo: 'AMC/2025-26/0002', status: DocStatus.Active,
    approvals: [{ level: 1, ruleId: 'doa-amc-1', approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2025-10-25 09:00' }],
    vendorId: 'ven-coolcare', type: AmcType.NonComprehensive, assetIds: ['asset-012', 'asset-013'],
    startDate: '2025-11-01', endDate: '2026-10-31', contractValue: 28000, paymentFrequency: PaymentFrequency.HalfYearly,
    slaResponseHours: 48, preventiveVisitsPerYear: 4,
    visits: [
      { id: 'visit-003', scheduledOn: '2026-02-01', completedOn: '2026-02-02', type: 'Preventive', technician: 'Ramesh Pillai', remarks: 'Gas top-up and filter cleaning.' },
      { id: 'visit-004', scheduledOn: '2026-05-01', completedOn: '2026-05-03', type: 'Preventive', technician: 'CoolCare Technician', remarks: 'Routine service, no issues found.' },
      { id: 'visit-005', scheduledOn: '2026-09-25', type: 'Breakdown', technician: 'CoolCare Technician', remarks: 'Scheduled against open ticket SRV/2026-27/0002.' },
    ],
    coverageNotes: 'Labour-only coverage; gas and parts billed separately.',
    ownerId: 'emp-admin1', renewalReminderDays: 45, createdOn: '2025-10-20',
  },
  {
    id: 'amc-004', contractNo: 'AMC/2022-23/0003', status: DocStatus.Active,
    approvals: [{ level: 1, ruleId: 'doa-amc-1', approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2022-08-25 10:00' }],
    vendorId: 'ven-fleet', type: AmcType.ServiceContract, assetIds: ['asset-014'],
    startDate: '2022-09-01', endDate: '2027-08-31', contractValue: 60000, paymentFrequency: PaymentFrequency.Annual,
    slaResponseHours: 12, preventiveVisitsPerYear: 3,
    visits: [
      { id: 'visit-006', scheduledOn: '2026-04-08', completedOn: '2026-04-10', type: 'Preventive', technician: 'Apex Fleet Technician', remarks: 'Periodic service; tyres replaced.' },
    ],
    coverageNotes: 'Multi-year fleet maintenance contract covering scheduled service and breakdown support.',
    ownerId: 'emp-admin1', renewalReminderDays: 60, createdOn: '2022-08-20',
  },
];

export const SEED_SERVICE_TICKETS: ServiceTicket[] = [
  {
    id: 'svc-001', ticketNo: 'SRV/2026-27/0001', status: DocStatus.InProgress,
    approvals: [{ level: 1, ruleId: 'doa-srv-1', approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-08-28 16:00' }],
    assetId: 'asset-005', type: TicketType.Breakdown, priority: TicketPriority.High,
    reportedById: 'emp-e5', reportedOn: '2026-08-28', faultDescription: 'Laptop not powering on; suspected motherboard/battery fault.',
    underAmc: true, amcContractId: 'amc-001', vendorId: 'ven-dell', estimatedCost: 4500,
    assignedTo: 'Dell Service Center - Andheri', gatePassId: 'gp-001', gatePassNo: 'GP/2026-27/0001',
    downtimeStart: '2026-08-28', partsReplaced: [], recommendReplacement: false,
  },
  {
    id: 'svc-002', ticketNo: 'SRV/2026-27/0002', status: DocStatus.Open, approvals: [],
    assetId: 'asset-013', type: TicketType.Breakdown, priority: TicketPriority.Critical,
    reportedById: 'emp-e6', reportedOn: '2026-09-10', faultDescription: 'AC compressor not cooling, loud noise on startup.',
    underAmc: true, amcContractId: 'amc-003', vendorId: 'ven-coolcare', estimatedCost: 3500,
    downtimeStart: '2026-09-10', partsReplaced: [], recommendReplacement: false,
  },
  {
    id: 'svc-003', ticketNo: 'SRV/2025-26/0011', status: DocStatus.Completed,
    approvals: [{ level: 1, ruleId: 'doa-srv-1', approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2025-08-20 09:00' }],
    assetId: 'asset-001', type: TicketType.Breakdown, priority: TicketPriority.Medium,
    reportedById: 'emp-e1', reportedOn: '2025-08-20', faultDescription: 'SSD failure - disk not detected on boot.',
    underAmc: true, amcContractId: 'amc-001', vendorId: 'ven-dell', estimatedCost: 5000, actualCost: 4800,
    assignedTo: 'Dell Service Center - Andheri', gatePassId: 'gp-004', gatePassNo: 'GP/2025-26/0004',
    downtimeStart: '2025-08-20', downtimeEnd: '2025-09-01',
    resolution: 'Replaced faulty SSD with a 1TB NVMe unit under AMC parts coverage.',
    partsReplaced: [{ id: 'pr-001', componentName: 'SSD', oldSerial: 'SSD-512-ORIG', newSerial: 'SSD-1TB-REPL', cost: 4800, warrantyMonths: 12 }],
    recommendReplacement: false, closedOn: '2025-09-01',
  },
  {
    id: 'svc-004', ticketNo: 'SRV/2026-27/0003', status: DocStatus.PendingApproval,
    approvals: [
      { level: 1, ruleId: 'doa-srv-1', approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-09-13 11:30' },
      { level: 2, ruleId: 'doa-srv-2', approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Pending },
    ],
    assetId: 'asset-002', type: TicketType.Breakdown, priority: TicketPriority.Medium,
    reportedById: 'emp-mgmt2', reportedOn: '2026-09-13', faultDescription: 'Keyboard sticking on multiple keys.',
    underAmc: false, estimatedCost: 8500, assignedTo: 'External Apple Service Partner',
    partsReplaced: [], recommendReplacement: false,
    resolution: undefined,
  },
];

export const SEED_REPLACEMENTS: Replacement[] = [
  {
    id: 'rpl-001', replacementNo: 'RPL/2026-27/0001', status: DocStatus.Completed,
    approvals: [
      { level: 1, ruleId: 'doa-rpl-1', approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-08-12 10:00' },
      { level: 2, ruleId: 'doa-rpl-2', approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Approved, actedBy: 'Ananya Rao', actedOn: '2026-08-13 09:00' },
    ],
    oldAssetId: 'asset-007', newAssetId: 'asset-008', newAssetSource: 'New Purchase', reason: ReplacementReason.Lost,
    requestedById: 'emp-admin1', requestedOn: '2026-08-11', oldAssetDisposition: 'Write-Off (Lost/Stolen)',
    estimatedCost: 35999, completedOn: '2026-08-20',
    remarks: 'FIR / loss report obtained from employee; replacement approved and issued.',
  },
  {
    id: 'rpl-002', replacementNo: 'RPL/2026-27/0002', status: DocStatus.PendingApproval,
    approvals: [
      { level: 1, ruleId: 'doa-rpl-1', approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-09-09 10:00' },
      { level: 2, ruleId: 'doa-rpl-2', approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Pending },
    ],
    oldAssetId: 'asset-017', newAssetSource: 'From Store', reason: ReplacementReason.Obsolete,
    requestedById: 'emp-admin1', requestedOn: '2026-09-09', oldAssetDisposition: 'Scrap', estimatedCost: 0,
    remarks: 'Proactive upgrade from ageing desktop to spare laptop already in store (asset-003).',
  },
];

// ---------------------------------------------------------------------------
// Disposal
// ---------------------------------------------------------------------------

export const SEED_DISPOSALS: Disposal[] = [
  {
    id: 'dsp-001', disposalNo: 'DSP/2025-26/0001', status: DocStatus.Completed,
    approvals: [
      { level: 1, ruleId: 'doa-dsp-1', approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2025-09-19 10:00' },
      { level: 2, ruleId: 'doa-dsp-2', approverTitle: 'Chief Financial Officer', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Approved, actedBy: 'Ananya Rao', actedOn: '2025-09-20 09:00' },
    ],
    mode: DisposalMode.WriteOff, lines: [{ assetId: 'asset-018', bookValue: 2900, realisedValue: 0, remarks: 'Water damage; no resale value.' }],
    totalBookValue: 2900, totalRealisedValue: 0, gainLoss: -2900,
    reason: 'Water damage beyond economical repair.', requestedById: 'emp-admin1', requestedOn: '2025-09-18', disposalDate: '2025-09-20',
  },
  {
    id: 'dsp-002', disposalNo: 'DSP/2026-27/0001', status: DocStatus.PendingApproval,
    approvals: [
      { level: 1, ruleId: 'doa-dsp-1', approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, status: ApprovalStatus.Approved, actedBy: 'Rohit Verma', actedOn: '2026-09-06 10:00' },
      { level: 2, ruleId: 'doa-dsp-2', approverTitle: 'Chief Financial Officer', approverRole: UserRole.MANAGEMENT, status: ApprovalStatus.Pending },
    ],
    mode: DisposalMode.Sale, lines: [{ assetId: 'asset-015', bookValue: 247500, realisedValue: 150000, remarks: 'Sold as-is; high odometer reading.' }],
    totalBookValue: 247500, totalRealisedValue: 150000, gainLoss: -97500,
    reason: 'Pool vehicle being replaced with a newer model.', requestedById: 'emp-admin1', requestedOn: '2026-09-05',
    gatePassId: 'gp-002', gatePassNo: 'GP/2026-27/0002',
  },
];

// ---------------------------------------------------------------------------
// Delegation of Authority
// ---------------------------------------------------------------------------

export const SEED_DOA_RULES: DoaRule[] = [
  { id: 'doa-pr-1', docType: ApprovalDocType.Requisition, level: 1, approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01', notes: 'Every requisition needs the requesting department’s manager to sign off.' },
  { id: 'doa-pr-2', docType: ApprovalDocType.Requisition, level: 2, approverTitle: 'Chief Financial Officer', approverRole: UserRole.MANAGEMENT, minAmount: 200000, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01', notes: 'High-value requisitions additionally need CFO sign-off.' },

  { id: 'doa-po-1', docType: ApprovalDocType.PurchaseOrder, level: 1, approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-po-2', docType: ApprovalDocType.PurchaseOrder, level: 2, approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, minAmount: 100000, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-po-3', docType: ApprovalDocType.PurchaseOrder, level: 3, approverTitle: 'Chief Financial Officer', approverRole: UserRole.MANAGEMENT, minAmount: 750000, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-po-4', docType: ApprovalDocType.PurchaseOrder, level: 4, approverTitle: 'Chief Financial Officer', approverRole: UserRole.MANAGEMENT, minAmount: 0, maxAmount: null, categoryIds: ['cat-vehicle'], locationIds: [], active: true, effectiveFrom: '2024-04-01', notes: 'Any vehicle purchase, regardless of value, needs CFO sign-off.' },

  { id: 'doa-trf-1', docType: ApprovalDocType.Transfer, level: 1, approverTitle: 'Asset Custodian / Store Admin', approverRole: UserRole.ADMIN, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-trf-2', docType: ApprovalDocType.Transfer, level: 2, approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, minAmount: 50000, maxAmount: null, categoryIds: [], locationIds: ['loc-del', 'loc-blr', 'loc-chn'], active: true, effectiveFrom: '2024-04-01', notes: 'Higher-value transfers into a branch/site additionally need manager sign-off.' },

  { id: 'doa-gp-1', docType: ApprovalDocType.GatePass, level: 1, approverTitle: 'Security / Admin Officer', approverRole: UserRole.ADMIN, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-gp-2', docType: ApprovalDocType.GatePass, level: 2, approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, minAmount: 100000, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },

  { id: 'doa-amc-1', docType: ApprovalDocType.AmcContract, level: 1, approverTitle: 'Procurement Manager', approverRole: UserRole.ADMIN, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-amc-2', docType: ApprovalDocType.AmcContract, level: 2, approverTitle: 'Chief Financial Officer', approverRole: UserRole.MANAGEMENT, minAmount: 100000, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },

  { id: 'doa-srv-1', docType: ApprovalDocType.ServiceTicket, level: 1, approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-srv-2', docType: ApprovalDocType.ServiceTicket, level: 2, approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, minAmount: 5000, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01', notes: 'Repairs above ₹5,000, or any repair outside AMC coverage, need manager sign-off.' },

  { id: 'doa-rpl-1', docType: ApprovalDocType.Replacement, level: 1, approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-rpl-2', docType: ApprovalDocType.Replacement, level: 2, approverTitle: 'Department Manager', approverRole: UserRole.MANAGEMENT, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01', notes: 'Every replacement retires an asset, so manager sign-off is always required.' },

  { id: 'doa-dsp-1', docType: ApprovalDocType.Disposal, level: 1, approverTitle: 'Asset & Procurement Manager', approverRole: UserRole.ADMIN, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01' },
  { id: 'doa-dsp-2', docType: ApprovalDocType.Disposal, level: 2, approverTitle: 'Chief Financial Officer', approverRole: UserRole.MANAGEMENT, minAmount: 0, maxAmount: null, categoryIds: [], locationIds: [], active: true, effectiveFrom: '2024-04-01', notes: 'All disposals carry a financial gain/loss and need CFO sign-off.' },
];

export const SEED_DELEGATIONS: DoaDelegation[] = [
  {
    id: 'del-001', fromEmployeeId: 'emp-mgmt1', toEmployeeId: 'emp-mgmt2',
    docTypes: [ApprovalDocType.PurchaseOrder, ApprovalDocType.Disposal, ApprovalDocType.AmcContract],
    fromDate: '2026-09-10', toDate: '2026-09-25', reason: 'CFO on annual leave; IT & Operations Head to act on Finance approvals.', active: true,
  },
];

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const SEED_AUDIT_PLANS: AuditPlan[] = [
  {
    id: 'aud-001', auditNo: 'PV/2025-26/0001', title: 'H2 FY25-26 Physical Verification - Head Office', status: DocStatus.SignedOff,
    scopeType: 'Location', scopeIds: ['loc-ho'], plannedFrom: '2026-03-10', plannedTo: '2026-03-20', auditorId: 'emp-aud1',
    lines: [
      { assetId: 'asset-001', expectedLocationId: 'loc-ho', expectedCustodianId: 'emp-e1', result: VerificationResult.Found, actualLocationId: 'loc-ho', actualCustodianId: 'emp-e1', condition: AssetCondition.Good, verifiedOn: '2026-03-18' },
      { assetId: 'asset-002', expectedLocationId: 'loc-ho', expectedCustodianId: 'emp-mgmt2', result: VerificationResult.Found, actualLocationId: 'loc-ho', actualCustodianId: 'emp-mgmt2', condition: AssetCondition.Good, verifiedOn: '2026-03-18' },
      { assetId: 'asset-009', expectedLocationId: 'loc-ho', result: VerificationResult.Found, actualLocationId: 'loc-ho', condition: AssetCondition.Good, verifiedOn: '2026-03-18' },
      { assetId: 'asset-012', expectedLocationId: 'loc-ho', result: VerificationResult.Found, actualLocationId: 'loc-ho', condition: AssetCondition.Fair, verifiedOn: '2026-03-18' },
      { assetId: 'asset-014', expectedLocationId: 'loc-ho', expectedCustodianId: 'emp-mgmt1', result: VerificationResult.Found, actualLocationId: 'loc-ho', actualCustodianId: 'emp-mgmt1', condition: AssetCondition.Good, verifiedOn: '2026-03-18' },
      { assetId: 'asset-017', expectedLocationId: 'loc-ho', result: VerificationResult.Found, actualLocationId: 'loc-ho', condition: AssetCondition.Fair, verifiedOn: '2026-03-18' },
    ],
    observations: 'All sampled Head Office assets were located and matched register records. No discrepancies noted.',
    signedOffBy: 'Meera Iyer', signedOffOn: '2026-03-20', createdOn: '2026-03-01',
  },
  {
    id: 'aud-002', auditNo: 'PV/2026-27/0001', title: 'Q2 FY26-27 Cyclical Audit - IT Assets (All Locations)', status: DocStatus.InProgress,
    scopeType: 'Category', scopeIds: ['cat-laptop', 'cat-mobile'], plannedFrom: '2026-09-08', plannedTo: '2026-09-30', auditorId: 'emp-aud1',
    lines: [
      { assetId: 'asset-004', expectedLocationId: 'loc-del', expectedCustodianId: 'emp-e6', result: VerificationResult.Found, actualLocationId: 'loc-del', actualCustodianId: 'emp-e6', condition: AssetCondition.Good, verifiedOn: '2026-09-11' },
      { assetId: 'asset-006', expectedLocationId: 'loc-blr', expectedCustodianId: 'emp-e3', result: VerificationResult.Found, actualLocationId: 'loc-blr', actualCustodianId: 'emp-e3', condition: AssetCondition.Good, verifiedOn: '2026-09-12' },
      { assetId: 'asset-021', expectedLocationId: 'loc-chn', expectedCustodianId: 'emp-e4', result: VerificationResult.Pending },
      { assetId: 'asset-008', expectedLocationId: 'loc-ho', expectedCustodianId: 'emp-e2', result: VerificationResult.Pending },
    ],
    createdOn: '2026-09-05',
  },
];

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export const SEED_ACTIVITY: ActivityEntry[] = [
  { id: 'act-001', timestamp: '2026-09-14 17:40', actor: 'Kavita Desai', actorRole: UserRole.ADMIN, action: 'Transfer requested', entityType: 'Transfer', entityId: 'trf-003', entityNo: 'TRF/2026-27/0003', summary: 'Requested transfer of HP EliteBook (spare) from Pune Warehouse to Head Office.', severity: 'info' },
  { id: 'act-002', timestamp: '2026-09-13 11:30', actor: 'Vikram Shah', actorRole: UserRole.MANAGEMENT, action: 'Service ticket raised', entityType: 'ServiceTicket', entityId: 'svc-004', entityNo: 'SRV/2026-27/0003', summary: 'Reported keyboard fault on MacBook Pro 14"; out-of-AMC repair pending manager approval.', severity: 'warning' },
  { id: 'act-003', timestamp: '2026-09-12 09:15', actor: 'Kavita Desai', actorRole: UserRole.ADMIN, action: 'Transfer dispatched', entityType: 'Transfer', entityId: 'trf-002', entityNo: 'TRF/2026-27/0002', summary: 'Dispatched Dell Latitude 5440 (DL5440-2601) from Pune Warehouse to Bengaluru Branch.', severity: 'info' },
  { id: 'act-004', timestamp: '2026-09-11 10:00', actor: 'Rohit Verma', actorRole: UserRole.ADMIN, action: 'Transfer approved', entityType: 'Transfer', entityId: 'trf-002', entityNo: 'TRF/2026-27/0002', summary: 'Approved inter-branch transfer to Bengaluru for new hire onboarding.', severity: 'info' },
  { id: 'act-005', timestamp: '2026-09-11 12:00', actor: 'Rohit Verma', actorRole: UserRole.ADMIN, action: 'Purchase order submitted', entityType: 'PurchaseOrder', entityId: 'po-003', entityNo: 'PO/2026-27/0003', summary: 'Raised PO to OfficeFirst Interiors for furniture restock; awaiting department manager approval.', severity: 'info' },
  { id: 'act-006', timestamp: '2026-09-10 16:05', actor: 'Farhan Sheikh', actorRole: UserRole.EMPLOYEE, action: 'Breakdown reported', entityType: 'ServiceTicket', entityId: 'svc-002', entityNo: 'SRV/2026-27/0002', summary: 'Reported AC compressor failure at Delhi Branch pantry.', severity: 'critical' },
  { id: 'act-007', timestamp: '2026-09-10 09:00', actor: 'Ananya Rao', actorRole: UserRole.MANAGEMENT, action: 'Delegation granted', entityType: 'DoaDelegation', entityId: 'del-001', summary: 'Delegated Purchase Order, Disposal and AMC approval authority to Vikram Shah while on leave (10-25 Sep).', severity: 'info' },
  { id: 'act-008', timestamp: '2026-09-09 10:00', actor: 'Rohit Verma', actorRole: UserRole.ADMIN, action: 'Replacement requested', entityType: 'Replacement', entityId: 'rpl-002', entityNo: 'RPL/2026-27/0002', summary: 'Proposed replacing an ageing reception desktop with spare laptop stock.', severity: 'info' },
  { id: 'act-009', timestamp: '2026-09-08 10:00', actor: 'Rohit Verma', actorRole: UserRole.ADMIN, action: 'AMC renewal drafted', entityType: 'AmcContract', entityId: 'amc-002', entityNo: 'AMC/2026-27/0001', summary: 'Drafted renewal of comprehensive IT AMC with Dell Technologies, expanded to cover 2 more laptops.', severity: 'warning' },
  { id: 'act-010', timestamp: '2026-09-06 14:10', actor: 'Rohit Verma', actorRole: UserRole.ADMIN, action: 'Gate pass approved (L1)', entityType: 'GatePass', entityId: 'gp-002', entityNo: 'GP/2026-27/0002', summary: 'Cleared security-level approval for outward pass to hand over sold pool vehicle.', severity: 'info' },
  { id: 'act-011', timestamp: '2026-09-05 10:00', actor: 'Rohit Verma', actorRole: UserRole.ADMIN, action: 'Disposal requested', entityType: 'Disposal', entityId: 'dsp-002', entityNo: 'DSP/2026-27/0001', summary: 'Requested sale of pool vehicle VEH-HO-0002; awaiting CFO approval.', severity: 'info' },
  { id: 'act-012', timestamp: '2026-09-04 11:00', actor: 'Kavita Desai', actorRole: UserRole.ADMIN, action: 'GRN posted', entityType: 'Grn', entityId: 'grn-001', entityNo: 'GRN/2026-27/0001', summary: 'Received 1 of 2 Dell Latitude 5440 units against PO/2026-27/0001; asset ITL-PWH-0002 created.', severity: 'info' },
  { id: 'act-013', timestamp: '2026-08-29 09:30', actor: 'Rohit Verma', actorRole: UserRole.ADMIN, action: 'Gate pass issued', entityType: 'GatePass', entityId: 'gp-001', entityNo: 'GP/2026-27/0001', summary: 'Issued returnable gate pass to send faulty laptop to Dell Service Center.', severity: 'info' },
  { id: 'act-014', timestamp: '2026-08-28 16:00', actor: 'Rahul Kapoor', actorRole: UserRole.EMPLOYEE, action: 'Breakdown reported', entityType: 'ServiceTicket', entityId: 'svc-001', entityNo: 'SRV/2026-27/0001', summary: 'Reported laptop not powering on; ticket raised under AMC.', severity: 'warning' },
  { id: 'act-015', timestamp: '2026-08-20 09:00', actor: 'Rohit Verma', actorRole: UserRole.ADMIN, action: 'Replacement completed', entityType: 'Replacement', entityId: 'rpl-001', entityNo: 'RPL/2026-27/0001', summary: 'Issued new Samsung Galaxy A54 to Sneha Joshi to replace lost handset.', severity: 'info' },
  { id: 'act-016', timestamp: '2026-08-10 09:40', actor: 'Sneha Joshi', actorRole: UserRole.EMPLOYEE, action: 'Asset reported lost', entityType: 'Asset', entityId: 'asset-007', entityNo: 'ITM-HO-0001', summary: 'Reported company mobile handset lost while travelling; FIR obtained.', severity: 'critical' },
  { id: 'act-017', timestamp: '2026-03-20 12:00', actor: 'Meera Iyer', actorRole: UserRole.AUDITOR, action: 'Audit signed off', entityType: 'AuditPlan', entityId: 'aud-001', entityNo: 'PV/2025-26/0001', summary: 'Signed off H2 FY25-26 physical verification for Head Office with no discrepancies.', severity: 'info' },
  { id: 'act-018', timestamp: '2026-09-05 08:00', actor: 'System', actorRole: UserRole.AUDITOR, action: 'Cyclical audit scheduled', entityType: 'AuditPlan', entityId: 'aud-002', entityNo: 'PV/2026-27/0001', summary: 'Q2 cyclical audit scope opened for laptops and mobile phones across all locations.', severity: 'info' },
];

// ---------------------------------------------------------------------------
// Counters (keeps live document/tag numbering continuing from seed data)
// ---------------------------------------------------------------------------

export const SEED_COUNTERS: Record<string, number> = {
  'PR-2026-27': 3,
  'PO-2026-27': 3,
  'GRN-2026-27': 2,
  'TRF-2026-27': 3,
  'GP-2026-27': 3,
  'GP-2025-26': 4,
  'AMC-2026-27': 1,
  'AMC-2025-26': 2,
  'AMC-2022-23': 3,
  'SRV-2026-27': 3,
  'SRV-2025-26': 11,
  'RPL-2026-27': 2,
  'DSP-2025-26': 1,
  'DSP-2026-27': 1,
  'PV-2025-26': 1,
  'PV-2026-27': 1,
  'TAG-ITL-HO': 5,
  'TAG-ITL-PWH': 2,
  'TAG-ITL-DEL': 1,
  'TAG-ITL-CHN': 1,
  'TAG-ITM-HO': 2,
  'TAG-ITM-BLR': 1,
  'TAG-ITN-HO': 1,
  'TAG-ITD-HO': 2,
  'TAG-FACF-PWH': 2,
  'TAG-FACF-BLR': 1,
  'TAG-FACH-HO': 1,
  'TAG-FACH-DEL': 1,
  'TAG-VEH-HO': 2,
};

export const buildSeedState = (): AssetState => ({
  employees: SEED_EMPLOYEES,
  departments: SEED_DEPARTMENTS,
  locations: SEED_LOCATIONS,
  vendors: SEED_VENDORS,
  categories: SEED_CATEGORIES,
  variants: SEED_VARIANTS,
  assets: SEED_ASSETS,
  components: SEED_COMPONENTS,
  requisitions: SEED_REQUISITIONS,
  purchaseOrders: SEED_PURCHASE_ORDERS,
  grns: SEED_GRNS,
  transfers: SEED_TRANSFERS,
  gatePasses: SEED_GATE_PASSES,
  amcContracts: SEED_AMC_CONTRACTS,
  serviceTickets: SEED_SERVICE_TICKETS,
  replacements: SEED_REPLACEMENTS,
  disposals: SEED_DISPOSALS,
  doaRules: SEED_DOA_RULES,
  delegations: SEED_DELEGATIONS,
  auditPlans: SEED_AUDIT_PLANS,
  activity: SEED_ACTIVITY,
  counters: SEED_COUNTERS,
});
