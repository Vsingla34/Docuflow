import { Client, ComplianceTemplate, Document, DocumentRequest, DocumentStatus, DocumentType, User, UserRole, ComplianceFrequency, Comment } from '../types';

export const MOCK_USERS: User[] = [
  { id: 'user1', name: 'Sanjay Sharma', role: UserRole.ADMIN },
  { id: 'user2', name: 'Priya Patel', role: UserRole.MANAGER },
  { id: 'user3', name: 'Amit Kumar', role: UserRole.STAFF },
  { id: 'user4', name: 'John Doe (Client)', role: UserRole.CLIENT, clientId: 'cli1' },
];

export const MOCK_CLIENTS: Client[] = [
  { id: 'cli1', name: 'John Doe', company: 'Innovate Inc.', email: 'john.doe@innovate.com', joinedDate: '2023-01-15' },
  { id: 'cli2', name: 'Jane Smith', company: 'Solutions Co.', email: 'jane.smith@solutions.co', joinedDate: '2022-11-20' },
  { id: 'cli3', name: 'Peter Jones', company: 'Creative LLC', email: 'peter.j@creative.llc', joinedDate: '2023-03-10' },
  { id: 'cli4', name: 'Mary Garcia', company: 'Tech Forward', email: 'mary.g@techforward.com', joinedDate: '2021-08-05' },
];

export const MOCK_COMPLIANCE_TEMPLATES: ComplianceTemplate[] = [
  { 
    id: 'com-gst', 
    name: 'GSTR-3B Monthly Filing', 
    description: 'Monthly Goods and Services Tax return filing.',
    requiredDocuments: [
      { id: 'gst-doc-1', name: 'Sales Ledger', type: DocumentType.GST },
      { id: 'gst-doc-2', name: 'Purchase Ledger', type: DocumentType.GST },
      { id: 'gst-doc-3', name: 'E-Way Bills Report', type: DocumentType.GST },
    ],
    frequency: ComplianceFrequency.MONTHLY,
    dueDateRule: { day: 20, month_offset: 1 }, // 20th of the following month
    autoRecurrence: true,
  },
  { 
    id: 'com-roc', 
    name: 'ROC Annual Filing (AOC-4)', 
    description: 'Registrar of Companies annual financial statement filing.',
    requiredDocuments: [
      { id: 'roc-doc-1', name: 'Audited Balance Sheet', type: DocumentType.FINANCIAL },
      { id: 'roc-doc-2', name: 'Profit & Loss Statement', type: DocumentType.FINANCIAL },
      { id: 'roc-doc-3', name: 'Director\'s Report', type: DocumentType.LEGAL },
    ],
    frequency: ComplianceFrequency.ANNUALLY,
    dueDateRule: { day: 30, month_offset: 10 }, // 30th October
    autoRecurrence: true,
  },
  { 
    id: 'com-it', 
    name: 'Income Tax Return (ITR)', 
    description: 'Annual income tax return filing for the company.',
    requiredDocuments: [
      { id: 'it-doc-1', name: 'Form 26AS', type: DocumentType.IT },
      { id: 'it-doc-2', name: 'Capital Gains Statement', type: DocumentType.FINANCIAL },
    ],
    frequency: ComplianceFrequency.ANNUALLY,
    dueDateRule: { day: 31, month_offset: 7 }, // 31st July
    autoRecurrence: true,
  },
  { 
    id: 'com-kyc', 
    name: 'KYC Verification', 
    description: 'One-time Know Your Customer identity verification.',
    requiredDocuments: [
      { id: 'kyc-doc-1', name: 'PAN Card Copy', type: DocumentType.ID_PROOF },
      { id: 'kyc-doc-2', name: 'Proof of Address (Utility Bill)', type: DocumentType.ID_PROOF },
      { id: 'kyc-doc-3', name: 'GST Registration Certificate', type: DocumentType.LICENSE },
    ],
    frequency: ComplianceFrequency.ONE_TIME,
    dueDateRule: { day: 15, month_offset: 0 }, // 15 days from request
    autoRecurrence: false,
  },
];

const mockComments: Comment[] = [
    { id: 'cmt1', author: 'John Doe', text: 'I have uploaded the sales ledger, but the purchase ledger for last week is still pending from my accounts team. Will upload by EOD.', timestamp: '2024-06-18 10:30 AM' },
    { id: 'cmt2', author: 'Amit Kumar', text: 'Thanks for the update, John. Please upload it as soon as possible to avoid delays.', timestamp: '2024-06-18 11:00 AM' },
]

export const MOCK_DOCUMENTS: Document[] = [
  { id: 'doc1', name: 'Sales Ledger', clientId: 'cli1', complianceId: 'com-gst', requestId: 'req3', status: DocumentStatus.Approved, submittedDate: '2024-03-05', type: DocumentType.GST, versionHistory: [
      { version: 1, status: DocumentStatus.Received, notes: 'Initial submission by client.', updatedAt: '2024-03-05', updatedBy: 'John Doe' },
      { version: 2, status: DocumentStatus.Under_Review, notes: 'Review started.', updatedAt: '2024-03-06', updatedBy: 'Amit Kumar' },
      { version: 3, status: DocumentStatus.Approved, notes: 'Looks good.', updatedAt: '2024-03-07', updatedBy: 'Priya Patel' },
  ], driveLink: 'https://drive.google.com/d/Innovate_Inc/req3/Sales_Ledger' },
  { id: 'doc2', name: 'PAN Card Copy', clientId: 'cli2', complianceId: 'com-kyc', requestId: 'req2', status: DocumentStatus.Under_Review, submittedDate: '2024-05-20', type: DocumentType.ID_PROOF, expiryDate: '2028-08-15', versionHistory: [
      { version: 1, status: DocumentStatus.Received, notes: 'Client uploaded.', updatedAt: '2024-05-20', updatedBy: 'Jane Smith' },
      { version: 2, status: DocumentStatus.Under_Review, notes: 'Pending verification.', updatedAt: '2024-05-21', updatedBy: 'Amit Kumar' },
  ] },
  { id: 'doc3', name: 'Audited Balance Sheet', clientId: 'cli3', complianceId: 'com-roc', requestId: 'req1', status: DocumentStatus.Pending, submittedDate: '', type: DocumentType.FINANCIAL, versionHistory: [] },
  { id: 'doc5', name: 'Utility Bill', clientId: 'cli2', complianceId: 'com-kyc', requestId: 'req2', status: DocumentStatus.Rejected, submittedDate: '2024-05-18', type: DocumentType.ID_PROOF, rejectionReason: 'Bill is older than 3 months. Please provide a recent one.', versionHistory: [
      { version: 1, status: DocumentStatus.Received, notes: 'Submitted.', updatedAt: '2024-05-18', updatedBy: 'Jane Smith' },
      { version: 2, status: DocumentStatus.Rejected, notes: 'Bill is too old.', updatedAt: '2024-05-19', updatedBy: 'Amit Kumar' },
  ] },
  { id: 'doc7', name: 'Shop & Establishment License', clientId: 'cli3', complianceId: 'com-kyc', requestId: 'req1', status: DocumentStatus.Approved, submittedDate: '2024-01-10', type: DocumentType.LICENSE, expiryDate: '2024-04-30', versionHistory: [], driveLink: '#' }, // Expired
  { id: 'doc8', name: 'Driver\'s License', clientId: 'cli4', complianceId: 'com-kyc', requestId: 'req4', status: DocumentStatus.Received, submittedDate: '2024-06-15', type: DocumentType.ID_PROOF, expiryDate: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0], versionHistory: [] }, // Expiring soon
];

export const MOCK_REQUESTS: DocumentRequest[] = [
  { 
    id: 'req1', 
    clientId: 'cli3', 
    complianceId: 'com-roc', 
    documents: [{id: 'd1', name: 'Audited Balance Sheet'}, {id: 'd2', name: 'Director\'s Report'}], 
    status: DocumentStatus.Pending, 
    requestDate: '2024-06-01', 
    dueDate: '2024-06-30',
    portalToken: 'ab-cd-ef',
    clarificationThread: [],
  },
  { 
    id: 'req2', 
    clientId: 'cli2', 
    complianceId: 'com-kyc', 
    documents: [{id: 'd3', name: 'PAN Card Copy'}, {id: 'd4', name: 'Recent Utility Bill'}], 
    status: DocumentStatus.Approved, 
    requestDate: '2024-05-10', 
    dueDate: '2024-05-25',
    portalToken: 'gh-ij-kl',
    clarificationThread: [],
  },
  { 
    id: 'req3', 
    clientId: 'cli1', 
    complianceId: 'com-gst', 
    documents: [{id: 'd5', name: 'Sales Ledger'}, {id: 'd6', name: 'Purchase Ledger'}], 
    status: DocumentStatus.Clarification_Needed, 
    requestDate: '2024-02-20', 
    dueDate: '2024-03-15',
    portalToken: 'mn-op-qr',
    clarificationThread: mockComments,
  },
];
