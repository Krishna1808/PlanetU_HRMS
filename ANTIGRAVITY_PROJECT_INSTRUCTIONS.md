# PlanetU HRMS — Project Instructions for AI Coding Agent

**Read this entire file before writing any code.** This is the authoritative context for building the PlanetU HRMS platform. Do not skip modules, do not build ahead of what's specified as ready, and do not introduce technologies not listed here without flagging it to the developer first.

---

## 1. What This Project Is

A **multi-tenant HRMS/Workforce Management SaaS product**, built and owned by **PlanetU**, to be licensed to client organizations. This is **not** an internal tool — it's a real commercial product. Phase 1 (current phase) is an **internal prototype** for PlanetU's own ~50 employees, before any external client onboarding.

The developer building this is a **solo, early-career developer** working on their first production-level project, learning backend engineering deliberately. **Prioritize clarity and standard, well-documented patterns over cleverness.** Explain non-obvious decisions in code comments.

---

## 2. Current Setup Status — What's Already Done

Do not redo these steps. Verify they exist before assuming they need setup:

- ✅ Git repository initialized and connected to GitHub (`main` branch, remote `origin` configured)
- ✅ Docker Desktop installed and working (WSL2 + BIOS virtualization enabled)
- ✅ `docker-compose.yaml` created with two services: `planetu_postgres` (Postgres 16, port 5432) and `planetu_redis` (Redis 7, port 6379)
- ✅ NestJS project scaffolded via `nest new .` — CommonJS (CJS) module system, Jest for testing, `@nestjs/mau` removed (it pulled in unwanted AWS SDK/heavy dependencies — do not reinstall it)
- ✅ Prisma installed and pinned to **stable v6** (`prisma@6.19.3`, `@prisma/client@6.19.3` — do NOT install `latest`/unpinned, a prior attempt pulled in an unstable `8.0.0-rc` release that broke the CLI)
- ✅ `npx prisma init --datasource-provider postgresql` run successfully — `prisma/schema.prisma` and `.env` exist
- ✅ `.env` configured: `DATABASE_URL="postgresql://planetu:devpassword@localhost:5432/planetu_hrms"`
- ✅ Prisma confirmed able to connect to the running Postgres container (`npx prisma db pull` connects successfully, currently reports zero tables — expected, since no schema has been written into `schema.prisma` yet)

## 3. What's Left To Do (start here)

1. **Write the actual Prisma schema** (`prisma/schema.prisma`) — translate the SQL structure in Section 7 below into Prisma models
2. Run the first migration: `npx prisma migrate dev --name init_foundation_and_employee_management`
3. Build the Employee Management module fully (NestJS controllers/services/DTOs, auth, RBAC guards) — see Section 8, fully specified
4. Then proceed module-by-module per the build order in Section 9 — **do not start a new module until the previous one is genuinely working end-to-end**

---

## 4. Confirmed Tech Stack — Do Not Substitute

| Layer | Technology | Notes |
|---|---|---|
| Backend framework | **NestJS** (TypeScript, CJS module system) | Not Express directly, not Fastify |
| ORM | **Prisma v6** (pinned) | Not TypeORM, not raw SQL |
| Database | **PostgreSQL** (via Docker, `postgres:16` image) | Not MySQL, not MongoDB |
| Cache/Queue | **Redis 7** (via Docker) + **BullMQ** for background jobs | Used for job queue, not response caching (no measured need yet) |
| Object storage | S3-compatible (not yet provisioned — stub with local filesystem path or a placeholder for now) | |
| Web frontend | **React + TypeScript** (not yet started) | |
| Mobile | **React Native** (not yet started, not needed for internal prototype) | |
| Containerization | **Docker Compose** | **Not Kubernetes** — do not introduce Kubernetes configs, Helm charts, or multi-node orchestration. This is explicitly out of scope at this stage. |
| Testing | **Jest** | |
| Hosting | Local Docker for now. **No AWS setup needed yet** — do not create AWS credentials, RDS instances, or cloud infrastructure code until explicitly instructed. |

---

## 5. Non-Negotiable Architecture Rules

These are correctness/safety rules, not style preferences. Violating them creates real data-integrity or security risk in an HR/payroll system:

1. **Multi-tenancy:** Every tenant-owned table has an `organizationId` (tenant) column. Every database query MUST be scoped by `organizationId`, enforced in the service layer (ideally via a shared mechanism, not ad-hoc per query) — never trust a client-supplied tenant identifier for scoping.
2. **Money fields:** Always `Decimal` type in Prisma (`@db.Decimal(12,2)` in Postgres) — **never** `Float` or `Int` for currency. Floating-point arithmetic on money is a correctness bug.
3. **Soft deletes:** Employee records use a nullable `deletedAt` timestamp. **Never hard-delete** employee data.
4. **Append-only ledgers for auditable state:** Job history, leave balances, and salary structure are **never overwritten in place**. Each change is a new row with `effectiveFrom`/`effectiveTo` (nullable = current), not a mutated field. This applies to: `employee_job_history`, `leave_transaction` (future), `salary_structure` (future).
5. **RBAC — two layers, both required:**
   - **Route-level** (NestJS Guards): can this role hit this endpoint at all
   - **Field-level** (service-layer logic): can this role see this specific field (e.g., a Manager can view a team member's attendance but never their salary/bank details) — this must be enforced in code, not left to the frontend to hide fields
6. **Payroll runs are immutable once locked** (future module) — corrections happen via linked adjustment records, never by mutating a locked payslip.
7. **Employee code generation** must be atomic under concurrency — use a per-`(organizationId, departmentId)` counter table with an atomic increment (e.g., `UPDATE ... RETURNING` or a transaction), not a naive "count existing rows + 1" approach, which race-conditions under concurrent creation.

---

## 6. Full Module List (20 total) — Build Order & Priority

**Build in this order.** Do not jump ahead. Employee Management is the only module with a fully finalized spec (Section 8) — everything after it should follow the same pattern (schema → service → controller → RBAC → test) once its turn comes, and the developer will provide/confirm detailed requirements before each one starts.

### Prototype scope (build these, in this order)
1. **Employee Management** — ✅ fully specified, build first (Section 8)
2. **Identity & Access (Auth/RBAC)** — build alongside Employee Management; needed for everything else
3. **Shift Management** — defines expected work hours/rosters
4. **Attendance** — punch capture, status computation, payable days
5. **Leave Management** — leave types, accrual ledger, apply/approve
6. **Payroll** — salary structure, payable days → net pay, payslips
7. **Employee Self-Service (ESS)** — presentation layer only, **no own database tables** — routes through the above modules' services

### Must Have, not yet in prototype scope (confirm with developer before building)
8. Employee Onboarding
9. Offboarding / Exit
10. Reports & Dashboards (basic)
11. Notification Engine (cross-cutting)
12. Audit Logging (cross-cutting)
13. Tenant Management Console (PlanetU vendor-side admin)

### Should Have (later)
14. Reimbursements & Expenses
15. Insurance
16. Asset Management
17. Helpdesk / Grievance

### Future (not scoped yet — do not build)
18. Recruitment / ATS
19. Performance Management
20. LMS (Learning & Development)

**Explicitly parked as future scope, do not build now:** AI features (payroll anomaly detection, attrition risk flagging, natural-language reporting, smart approval assistant) — these come after the core system works, per developer's explicit decision.

---

## 7. Database Schema — Foundation + Employee Management

Translate this into `prisma/schema.prisma`. This mirrors `prototype_schema.sql` already reviewed and approved by the developer.

**Tables required now:**
- `organizations` — tenant table. Seed one row for `PlanetU (Internal Prototype)`, slug `planetu-internal`, plan_tier `internal`
- `users` — auth identity, separate from `employees` on purpose (a user is a login; an employee is an HR record). Fields: `id`, `organizationId`, `email` (unique per org), `passwordHash`, `role` (enum: `client_super_admin` | `hr_admin` | `manager` | `finance` | `employee`), `employeeId` (nullable FK), `isActive`, `lastLoginAt`
- `departments`, `designations`, `grades`, `locations` — tenant-scoped master/lookup tables, each with `organizationId` FK and unique constraint on `(organizationId, name)`
- `employee_code_sequence` — composite PK `(organizationId, departmentId)`, `lastNumber` int, used for atomic employee code generation (Rule #7 above)
- `employees` — the core record. All fields per `prototype_schema.sql`: personal info, identity (encrypt at app layer — flag this as a TODO if encryption isn't implemented yet, don't skip silently), employment (department/designation/grade/location FKs, self-referencing `reportingManagerId`, `employmentType`, `employmentStatus`, `dateOfJoining`, `dateOfExit`), bank details (also flag for encryption), `deletedAt` (soft delete), unique `(organizationId, employeeCode)`
- `employee_job_history` — append-only ledger, references `employees`, tracks department/designation/grade/manager changes over time with `effectiveFrom`/`effectiveTo`/`reason`/`changedBy`
- `employee_documents` — pointers to object storage (not blobs), `documentType`, `fileUrl`, `uploadedBy`

**Do not add Attendance, Leave, Shift, or Payroll tables yet** — those come with their respective modules, confirmed with the developer first.

---

## 8. Employee Management — Fully Specified Functional Requirements

Build these exactly. This is the one module the developer has already fully designed and approved.

- **FR-EMP-001:** HR/Admin and Client Super Admin can create an employee record scoped to their tenant.
- **FR-EMP-002:** `employeeCode` auto-generated as `<DEPT_PREFIX>-<sequential_number>` (e.g., `ENG-0001`), uniquely scoped within `(organizationId, department)`, using an atomic per-department, per-tenant counter.
- **FR-EMP-003:** Department, designation, grade, location are tenant-scoped, independently configurable by Client Super Admin/HR Admin.
- **FR-EMP-004:** Org hierarchy via self-referencing `reportingManagerId`; derive an org chart view from it.
- **FR-EMP-005:** `employee_job_history` is append-only, records every change to department/designation/grade/manager with `effectiveFrom`/`effectiveTo`, acting user, and reason code.
- **FR-EMP-006:** Per-field, per-tenant configurable edit policy. Default: low-risk fields (phone, personal email, address, emergency contact) are self-editable by the employee; identity, bank, and employment fields require HR/Admin action.
- **FR-EMP-007:** Soft-delete on exit — never hard-delete.
- **FR-EMP-008:** Field-level RBAC — Managers see team members' basic/job fields but not salary/bank; Employees see only their own full profile.
- **FR-EMP-009:** Document upload/storage linked to employee record, tenant-scoped storage paths.
- **FR-EMP-010:** Paginated, filterable employee directory, scoped to tenant and role-appropriate field visibility.

**API endpoints to build:**
```
POST   /api/v1/employees                → create (HR/Admin, Client Super Admin only)
GET    /api/v1/employees/:id            → get profile (RBAC-scoped response)
PATCH  /api/v1/employees/:id            → update (scoped: self-edit vs HR-edit per FR-EMP-006)
GET    /api/v1/employees                → directory/list (paginated, filtered)
GET    /api/v1/employees/:id/history    → job history (HR/Admin, or own history only for Employee)
POST   /api/v1/employees/:id/documents  → upload document
GET    /api/v1/employees/org-chart      → hierarchy view
```

**RBAC matrix for this module:**

| Action | Client Super Admin | HR/Admin | Manager | Employee |
|---|---|---|---|---|
| Create/deactivate employee | ✅ | ✅ | ❌ | ❌ |
| Edit any field | ✅ | ✅ | ❌ | ❌ |
| Edit own low-risk fields | — | — | ✅ (own) | ✅ (own) |
| View own full profile | — | — | ✅ | ✅ |
| View team profiles (no salary/bank) | — | — | ✅ | ❌ |
| View org-wide directory | ✅ | ✅ | ✅ (basic fields) | ✅ (basic fields) |
| View job history | ✅ | ✅ | ❌ | ✅ (own only) |

---

## 9. Development Process Rules

1. **One module at a time.** After finishing Employee Management, stop and let the developer confirm before starting the next module (Shift Management). Do not pre-build Attendance/Leave/Payroll schemas speculatively.
2. **Write tests alongside features**, using Jest — at minimum, cover: employee code generation under concurrent creation, RBAC field-scoping logic, and any date/numeric calculation logic.
3. **Every non-trivial architectural choice gets a one-line comment or a `DECISIONS.md` entry** explaining *why*, not just *what* (e.g., "used a ledger table here instead of a mutable column — audit trail requirement").
4. **Do not introduce new dependencies without flagging them** — the project already had one incident (`@nestjs/mau`) where an unnecessary dependency pulled in a large, slow, irrelevant package tree. Keep `package.json` lean.
5. **Do not implement AI/LLM features** at this stage — explicitly deferred (Section 6).
6. **Do not set up Kubernetes, AWS, or cloud deployment configs** — explicitly deferred until after the internal pilot (Section 4).
7. **Idempotency matters for anything touching money** — even in prototype form, design payroll-related endpoints (once built) to be safe against duplicate execution on retry.

---

## 10. Reference Documents (developer has these; ask for them if context is needed)

- `PlanetU_HRMS_Business_Analysis.md` — full module-by-module business analysis
- `PlanetU_HRMS_SRS.md` — v1.0 functional requirements for all 20 modules
- `PlanetU_HRMS_System_Design.md` — architecture patterns, original ERD
- `PlanetU_HRMS_Phase_Plan.md` — detailed phase checklist
- `PlanetU_HRMS_Master_Roadmap.md` — top-level scratch-to-production narrative
- `prototype_schema.sql` — the SQL this Prisma schema should match

---

## 11. Learning Mode — Standing Rule (Applies to Every Module From Now On)

The developer is a **rookie, learning backend/full-stack development live through this project.** This is a constraint on *how* you work, not just what you build. Apply all of the following for every module going forward, not just when reminded:

1. **Before writing code for a pattern not yet used in this project** (e.g., the first Guard, Interceptor, a new Prisma pattern, a queue/job, a new auth mechanism), give a short plain-language explanation of what it does and why it's needed here — **before** the code, not buried in a comment likely to be skimmed past.
2. **Flag any decision that deviates from what's already been agreed** (schema fields, architecture rules in Section 5, prior module patterns) **before** writing it, with reasoning — do not wait to be caught after the fact. (Precedent: the `firstName`/`lastName` vs. `full_name` deviation, which should have been flagged proactively.)
3. **When generating a file, briefly summarize what each significant piece does** in the response — enough for the developer to decide whether to read closely or trust it as-is.
4. **When there are two reasonable implementation approaches, present both with a recommendation** — do not silently pick one, especially for anything architectural.
5. **Code comments should explain "why," not just "what,"** for anything non-obvious — consistent with the `DECISIONS.md`-style reasoning already expected elsewhere in this document.

**The goal:** the developer should finish this project able to explain how it works and maintain it themselves — not just end up with a working app they can't extend or debug independently. If asked, retroactively flag anything already built that the developer should go back and deliberately understand, rather than assuming prior acceptance means full understanding.

---

## 12. If Anything Is Ambiguous

Stop and ask the developer rather than guessing — especially for:
- Anything touching money (Payroll) or statutory compliance rules (geography not yet confirmed)
- Anything touching authentication/security
- Any schema change to already-built tables (Employee Management is considered locked; changes should be flagged, not made silently)

This is a first production project for a solo, early-career developer who explicitly wants to understand the system, not just receive a finished black box. Favor readable, conventional code and clear explanations over maximal cleverness or brevity.