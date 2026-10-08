# GS HRMS — Employee Management (Frontend)

React (Next.js 16, App Router) + TypeScript + Tailwind CSS frontend for the Employee Management module of GS HRMS, for Global Surf IT Pvt Ltd (Kerala, India · Dubai, UAE).

This is a **frontend-only prototype**: all data lives in an in-memory mock dataset (`lib/data.ts`) and location/role selection persists to `localStorage` for a consistent demo experience. There is no backend, authentication, or database yet — see "Next phase" below.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It redirects to `/dashboard`.

```bash
npm run build   # production build + type-check
npm run lint     # eslint
```

## Location switcher (Dubai / Kochi)

The top bar's location selector is the source of truth for every module: Directory, Dashboard, Org Chart, Departments & Designations, Documents, Visa & Expiry and Requests all filter to the selected location.

- **Dubai** — shows Emirates ID / residence visa / WPS bank fields; Visa & Expiry Management is fully active.
- **Kochi** — shows PAN / Aadhaar / UAN (PF) fields, INR bank format; Visa & Expiry Management shows a "Not applicable for Kochi" state instead of UAE-only fields.

Selection is stored in `localStorage` (`gsit.location`) so it survives a page refresh.

## Roles (RBAC — UI-level only)

Use the persona switcher (top-right avatar) to preview the app as each role. **This is a frontend demo of scoping — there is no server enforcing these rules yet**; the original spec requires RBAC to be enforced at the API layer once the NestJS backend exists.

| Role | Preview persona | Scope |
|---|---|---|
| Super Admin | Rania Aziz (GS-120) | Every module |
| HR | Aisha Khan (GS-119) | Directory, onboarding, offboarding, visa, documents, requests |
| Office Admin | Lina Fahmy (GS-101) | Org structure, files, requests, document expiry |
| Team Lead | Marcus Silva (GS-058) | Own workspace + direct reports only (Directory auto-scopes) |
| Employee | Priya Nair (GS-087) | My Profile only |

Navigating to a module not permitted for the current role redirects to the dashboard.

## Modules implemented

- Dashboard — location-scoped headcount, onboarding pipeline, expiry watchlist, pending requests
- Employee Directory — search/filter, list & grid views, role-scoped (Team Lead sees direct reports only)
- Employee Profile — tabbed detail view (Overview, Employment, Personal, Passport/Visa/EID, Documents, Bank & Salary) with Dubai/Kochi field branching
- Onboarding — 5-step wizard (Personal → Employment → Bank/Salary → Documents → Review & Approve), location-aware fields
- Offboarding — clearance checklist workflow, inactive employee register
- Departments & Designations — CRUD master data, location-scoped
- Organization Structure — reporting hierarchy tree derived from the manager field
- Employee Documents — per-employee document vault with expiry tagging
- Visa & Expiry Management — Dubai-only register with a 90/60/30/7-day reminder ladder; gated for Kochi
- Employee Requests — approval queue (approve/reject)
- My Profile — self-service view with a locked vs. editable field split

## Next phase (not in this build)

Per the original module spec, still to build:

- NestJS REST API with JWT auth and server-enforced RBAC (the UI-level role scoping here must not be trusted as the real access control)
- MongoDB (or MySQL) persistence, replacing `lib/data.ts`
- Real file upload/storage for documents
- Audit trail on record changes
- Seed script and role/test-account credentials
- Handoff wiring to Payroll (bank/salary) and Renewal Management (document expiries) on onboarding approval

## Project structure

```
app/                 Routes (App Router) — one folder per module
components/shell/     Sidebar, Topbar, AppShell
components/ui/        Reusable Card, Badge, PageHeader, StatCard, Button
context/AppContext.tsx  Location + role global state (localStorage-backed)
lib/types.ts          Domain types
lib/data.ts            Mock dataset (employees, departments, requests, etc.)
lib/nav.ts             Role-gated navigation config
```
