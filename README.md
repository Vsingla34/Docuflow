# Asset Lifecycle Manager

A single-page application that manages the complete lifecycle of company
assets — from requisition through purchase, receipt, deployment, movement,
maintenance, and final disposal — with a configurable Delegation of
Authority (DOA) approval matrix at every step.

## Covers

- **Procurement**: Purchase Requisition → Purchase Order → Goods Receipt Note (GRN), with GRN automatically registering serialised assets into the register.
- **Asset Register**: categories, variants (models/configurations) and components (sub-parts), full history timeline, and SLM/WDV depreciation.
- **Movement**: custodian issue, department/location transfers and inter-branch transfers, with acknowledgement on receipt.
- **Gate Pass**: returnable/non-returnable outward passes for repairs, demos, WFH, sale handover, or scrap — with due-date tracking for returnables.
- **Maintenance**: AMC contracts (with visit schedules and renewal reminders) and repair/service tickets, linked to warranty/AMC coverage.
- **Replacement**: retiring an asset and issuing a replacement, with disposition of the old unit.
- **Disposal**: sale, scrap, donation, write-off, buyback and trade-in, with gain/loss against book value.
- **Audit**: physical verification plans/cycles with per-asset findings and sign-off, plus a running activity log.
- **DOA**: a configurable authority matrix (role, value band, category/location scope) that builds each document's approval chain automatically, plus temporary delegation of signing authority.
- **Roles**: Employee, Admin, Management, Auditor — navigation and actions are scoped by role.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Run the app: `npm run dev`
3. Build for production: `npm run build`

All data is seeded with a realistic demo dataset and persisted to
`localStorage` in the browser — there is no backend.
