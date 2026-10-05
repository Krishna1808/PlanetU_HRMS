# 🪐 PlanetU HRMS — Enterprise Multi-Tenant Human Resource Management System

PlanetU HRMS is a comprehensive, production-ready enterprise Human Resource Management System built with **NestJS**, **Prisma ORM**, **PostgreSQL**, **Redis / BullMQ**, and **React + Vite + TypeScript**.

---

## 🚀 Quick Setup Guide (New Device)

Follow these steps to set up and run PlanetU HRMS locally on any Windows, macOS, or Linux machine.

### 📋 Prerequisites

Ensure the following tools are installed:
- **Node.js**: v18+ or v20+ LTS ([Download Node.js](https://nodejs.org/))
- **Git**: ([Download Git](https://git-scm.com/))
- **Docker Desktop** (Recommended for instant PostgreSQL + Redis setup) **OR** local PostgreSQL 16 & Redis.

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/Krishna1808/PlanetU_HRMS.git
cd PlanetU_HRMS
```

---

### Step 2: Configure Environment Variables

Create your local `.env` file by copying `.env.example`:

**On Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**On macOS / Linux / Bash:**
```bash
cp .env.example .env
```

The default values in `.env.example` are pre-configured to work out of the box with the included Docker Compose services:
```env
PORT=3000
DATABASE_URL="postgresql://planetu:devpassword@localhost:5432/planetu_hrms"
JWT_SECRET="planetudevsecretkey_change_in_production"
JWT_EXPIRES_IN="1d"
REDIS_HOST="localhost"
REDIS_PORT=6379
FRONTEND_URL="http://localhost:5173"
```

---

### Step 3: Start PostgreSQL & Redis

#### Option A: Using Docker (Fastest & Recommended)
Run the bundled `docker-compose.yaml` to spin up PostgreSQL and Redis with matching credentials:
```bash
docker compose up -d
```
*(Verify both containers are running with `docker compose ps`)*

#### Option B: Without Docker (Local or Cloud Database)
- Install PostgreSQL locally and create a database named `planetu_hrms`.
- Update `DATABASE_URL` in `.env` to match your PostgreSQL credentials (e.g. `postgresql://postgres:yourpassword@localhost:5432/planetu_hrms` or a free cloud database URI from [Neon.tech](https://neon.tech) / [Supabase](https://supabase.com)).

---

### Step 4: Install Dependencies

Install packages for both the NestJS backend and the React frontend:

```bash
# 1. Install Backend Dependencies
npm install

# 2. Install Frontend Dependencies
npm --prefix frontend install
```

---

### Step 5: Database Migration & Seeding

Sync the database schema and populate it with master lookups and demo accounts:

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Push Schema to Database
npx prisma db push

# 3. Seed Master Data & Test Accounts
npm run db:seed
```

---

### Step 6: Start Development Servers

You will run the backend and frontend in two separate terminals:

#### Terminal 1 — Backend (NestJS API on port 3000):
```bash
npm run start:dev
```
Backend API will be live at: `http://localhost:3000`

#### Terminal 2 — Frontend (Vite on port 5173):
```bash
npm run frontend
```
Frontend UI will be live at: `http://localhost:5173`

Open **http://localhost:5173** in your browser.

---

## 🔑 Pre-Configured Demo Credentials

All test accounts use the password: **`DevPassword123!`**

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Client Super Admin** | `admin@planetu.com` | `DevPassword123!` | Complete system control, tenant settings, all modules |
| **HR Admin** | `hr@planetu.com` | `DevPassword123!` | Workforce, onboarding, leaves, grievances, letters |
| **Manager** | `manager@planetu.com` | `DevPassword123!` | Direct report approvals, shift management, ESS |
| **Finance Admin** | `finance@planetu.com` | `DevPassword123!` | Payroll processing, salary structures, payslips, FnF |
| **Employee** | `employee@planetu.com` | `DevPassword123!` | ESS, documents download/upload, attendance, grievance filing |

---

## 🧪 Testing & Verification

Run the automated test suite across all 21 service domains:

```bash
# Run all 243 unit tests
npm test

# Run specific domain test (e.g. Grievances)
npm test -- test/grievance.service.spec.ts
```

---

## 🛠️ Common Troubleshooting

- **PowerShell Script Execution Error (Windows):**
  If you get `File cannot be loaded because running scripts is disabled on this system`, run PowerShell as Administrator and execute:
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- **Port 5432 / 6379 Already in Use:**
  If a local PostgreSQL or Redis service is already running on your machine, either stop it or change the host port mapping in `docker-compose.yaml` and update `DATABASE_URL` in `.env`.
- **Windows File Lock on Prisma Query Engine:**
  If `npx prisma generate` gives an `EPERM` error, temporarily terminate running NestJS watch processes (`npm run start:dev`) before regenerating the client.
