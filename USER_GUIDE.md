# Docuflow: Asset Lifecycle Manager - User Guide

Welcome to **Docuflow**, an end-to-end multi-tenant system for managing fixed assets, capital work-in-progress (CWIP), procurement, maintenance, and governance. 

This step-by-step guide walks you through the entire lifecycle of using the application.

---

## 1. Logging In & Workspace Selection
1. **Login**: Enter your credentials on the login screen. 
2. **Select a Workspace**: If you are a Superadmin or a user assigned to multiple companies, you will be taken to the **Workspace Selection** screen. Click on the company you want to manage.
   - *Superadmin Only*: You can click **"New Workspace"** to create a new company, or **"Manage Companies"** to view and edit existing ones. You can also assign Global Users to different companies.
3. **Dashboard**: You will land on the Dashboard showing high-level metrics (Total Asset Value, Capitalised vs WIP, active tickets, etc.).

---

## 2. Setting Up Master Data (Admin / Operations)
Before making transactions, you must set up your master data.
1. **Data Master Uploads**: Navigate to *Data Master Uploads* in the sidebar to bulk upload Locations, Departments, Sub-Locations, and Users using CSV.
2. **Categories & Variants**: Navigate to *Assets -> Categories & Variants*. Create categories (e.g., IT Equipment, Furniture) and define their useful life and depreciation method. You can also create specific variants under each category (e.g., "ThinkPad T14" under "Laptops").
3. **User Management**: Add employees, assign them roles (e.g., Dept Head, Operations, Finance, Employee), and configure their access.
4. **DOA Rules (Delegation of Authority)**: Navigate to *Governance -> DOA Rules*. Set up approval limits (e.g., "Dept Heads can approve Requisitions up to ₹50,000; Finance approves above that").

---

## 3. Procurement Workflow (Acquiring New Assets)
Docuflow strictly follows a compliant procurement flow:
1. **Requisitions**:
   - An employee creates a new **Purchase Requisition (PR)** for needed items.
   - Based on the DOA rules, the requisition goes through approvals (Pending -> Approved).
2. **Purchase Orders**:
   - Operations converts approved PRs into **Purchase Orders (PO)**.
   - The PO defines the Vendor, negotiated price, and expected delivery date.
3. **Goods Receipt Notes (GRN)**:
   - When the goods arrive, create a **GRN** against the PO.
   - Enter the accepted quantities and exact serial numbers.
   - **Capitalisation**: Accepting the GRN automatically creates the Fixed Assets and adds them to the Asset Register.

---

## 4. Projects & Capital Work In Progress (CWIP)
For assets that take time to build (like office interiors or custom machinery):
1. **Create Project**: Navigate to *Assets -> Projects (CWIP)* and create a new project with a budget.
2. **Add Expenditures**: As money is spent (e.g., on raw materials, contractor labor), click the project and use **"+ Add Entry"** to record daily/weekly expenses.
3. **Capitalisation**: Once the project is physically complete, click **"Complete & Capitalise"**. Select an Asset Category and Location. The system will convert the total accumulated project expenses into a single Fixed Asset in the register.

---

## 5. Asset Management & Movement
1. **Asset Register**: View all your capitalised assets here. Click "View" on any asset to see its exact Location, Custodian, current book value, and full lifecycle history (from PO to current state).
2. **Transfers**: 
   - Need to move a laptop from HR to Engineering? Create an **Asset Transfer**.
   - Select the asset, the new department/location, and the new custodian.
   - The transfer requires a "Dispatch" and "Receive" handshake to complete.
3. **Returnable Gate Passes (RGP)**:
   - If an asset needs to leave the premises (e.g., an employee taking a laptop home, or sending a monitor for external repair), issue a **Gate Pass**.
   - When the asset comes back, mark the Gate Pass as **Returned**.

---

## 6. Maintenance & Servicing
1. **AMC (Annual Maintenance Contracts)**:
   - Go to *Maintenance -> AMC*. Record your external service contracts.
   - Link specific assets to the contract.
   - Log routine maintenance visits performed by the vendor under that contract.
2. **Service Tickets**:
   - If an asset breaks down, an employee raises a **Service Ticket**.
   - Operations can assign the ticket, log the repair costs, and mark it as Resolved. The repair cost is appended to the asset's history.

---

## 7. End of Life (Replacements & Disposals)
1. **Replacements**:
   - If an asset is irreparable but under warranty, navigate to *Maintenance -> Replacements*.
   - Return the old asset to the vendor and receive a new one. The system automatically retires the old Asset Tag and generates a new one.
2. **Disposals**:
   - For end-of-life assets, navigate to *Governance -> Disposals*.
   - Create a disposal request (Scrap, Sale, or E-Waste).
   - Enter the salvage/sale value. Once approved by Finance, the asset is marked as "Disposed" and removed from active tracking.

---

## 8. Physical Verification (Auditing)
1. **Audit Plans**: Go to *Governance -> Audits*.
2. Create an Audit Plan for a specific location (e.g., "Q4 IT Audit - Head Office").
3. The system generates a checklist of all assets supposed to be at that location.
4. The auditor walks around and marks each asset as "Found", "Missing", or "Location Mismatch".
5. Signing off the audit automatically updates the Asset Register to reflect the ground reality (e.g., automatically changing an asset's location if it was found somewhere else).

---

## Quick Navigation Tips
- **Switch Workspace**: If you manage multiple companies, click the "Switch" button next to the Logout button to jump to a different company's data.
- **Search**: Use the global search and filters in every module to quickly locate assets by their Tag (e.g., `ITL-HO-0001`) or Serial Number.
- **Activity Log**: Superadmins and Auditors can view the *Activity Log* at the bottom of the sidebar to see an immutable trail of who did what across the system.
