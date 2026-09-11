-- =============================================================================
-- PlanetU HRMS - Prototype Database Schema (PostgreSQL 16)
-- Reference DDL for Foundation & Module 1: Employee Management
-- =============================================================================
--
-- DELIBERATE DEVIATIONS / ARCHITECTURE DECISION LOG:
-- -------------------------------------------------
-- 1. [DEVIATION - APPROVED BY DEVELOPER (2026-09-11)]:
--    Field `full_name` on table `employees` was replaced with separate
--    `first_name` (VARCHAR(100)) and `last_name` (VARCHAR(100)) columns.
--    Rationale: Allows sorting directories by last name, generates formal
--    salutations/payslips, and aligns with statutory reporting formats (EPF/ESIC).
--    *ACTION REQUIRED ON SRS & SYSTEM DESIGN DOCS*: Update `full_name` -> `first_name`, `last_name`.
--
-- 2. [COMPENSATION ARCHITECTURE - RULE #4 ALIGNMENT]:
--    Direct mutable salary columns (`base_salary`) are EXCLUDED from `employees`.
--    Per Architecture Rule #4 (Append-only ledgers for auditable state), salary
--    is versioned with `effective_from` / `effective_to` in a dedicated
--    `salary_structure` table created during Module 6 (Payroll).
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE "Role" AS ENUM (
    'CLIENT_SUPER_ADMIN',
    'HR_ADMIN',
    'MANAGER',
    'FINANCE',
    'EMPLOYEE'
);

CREATE TYPE "EmploymentType" AS ENUM (
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'INTERN'
);

CREATE TYPE "EmploymentStatus" AS ENUM (
    'ACTIVE',
    'PROBATION',
    'NOTICE_PERIOD',
    'TERMINATED',
    'RESIGNED'
);

CREATE TYPE "Gender" AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER',
    'PREFER_NOT_TO_SAY'
);

CREATE TYPE "DocumentType" AS ENUM (
    'RESUME',
    'ID_PROOF',
    'OFFER_LETTER',
    'EXPERIENCE_LETTER',
    'EDUCATION_CERTIFICATE',
    'OTHER'
);

-- -----------------------------------------------------------------------------
-- 1. organizations (Tenant Root)
-- -----------------------------------------------------------------------------
CREATE TABLE "organizations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) UNIQUE NOT NULL,
    "plan_tier" VARCHAR(50) NOT NULL DEFAULT 'internal',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. users (Authentication & RBAC Identity)
-- -----------------------------------------------------------------------------
CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "employee_id" UUID UNIQUE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_org_email_unique" UNIQUE ("organization_id", "email")
);

-- -----------------------------------------------------------------------------
-- 3. Tenant Master Lookup Tables
-- -----------------------------------------------------------------------------
CREATE TABLE "departments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR(150) NOT NULL,
    "code_prefix" VARCHAR(10) NOT NULL, -- e.g. 'ENG', 'HR'
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "departments_org_name_unique" UNIQUE ("organization_id", "name"),
    CONSTRAINT "departments_org_prefix_unique" UNIQUE ("organization_id", "code_prefix")
);

CREATE TABLE "designations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "designations_org_name_unique" UNIQUE ("organization_id", "name")
);

CREATE TABLE "grades" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR(50) NOT NULL, -- e.g. 'L1', 'L2', 'M1'
    "level" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grades_org_name_unique" UNIQUE ("organization_id", "name")
);

CREATE TABLE "locations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR(150) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "country" VARCHAR(100) DEFAULT 'India',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "locations_org_name_unique" UNIQUE ("organization_id", "name")
);

-- -----------------------------------------------------------------------------
-- 4. employee_code_sequences (Atomic Counter for Rule #7)
-- -----------------------------------------------------------------------------
CREATE TABLE "employee_code_sequences" (
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "department_id" UUID NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("organization_id", "department_id")
);

-- -----------------------------------------------------------------------------
-- 5. employees (Core Employee Record)
-- Note: first_name and last_name used instead of single full_name (see deviation log)
-- Note: compensation/salary omitted (handled in salary_structure ledger in Module 6)
-- -----------------------------------------------------------------------------
CREATE TABLE "employees" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "employee_code" VARCHAR(50) NOT NULL, -- e.g. ENG-0001

    -- Personal Info (first_name / last_name split)
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "personal_email" VARCHAR(255),
    "phone" VARCHAR(50),
    "date_of_birth" DATE,
    "gender" "Gender",
    "current_address" TEXT,
    "permanent_address" TEXT,
    "emergency_contact_name" VARCHAR(150),
    "emergency_contact_phone" VARCHAR(50),
    "emergency_contact_relation" VARCHAR(50),

    -- Employment Details
    "department_id" UUID NOT NULL REFERENCES "departments"("id"),
    "designation_id" UUID NOT NULL REFERENCES "designations"("id"),
    "grade_id" UUID REFERENCES "grades"("id"),
    "location_id" UUID REFERENCES "locations"("id"),
    "reporting_manager_id" UUID REFERENCES "employees"("id"),
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "date_of_joining" DATE NOT NULL,
    "date_of_exit" DATE,
    "probation_end_date" DATE,

    -- Statutory / Identity
    "pan_number" VARCHAR(50),
    "uan_number" VARCHAR(50),

    -- Soft Deletion & Audit
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_org_code_unique" UNIQUE ("organization_id", "employee_code")
);

-- Add foreign key back to users table
ALTER TABLE "users" ADD CONSTRAINT "fk_users_employee"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 6. employee_job_histories (Append-Only Audit Ledger per Rule #4)
-- -----------------------------------------------------------------------------
CREATE TABLE "employee_job_histories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "employee_id" UUID NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "department_id" UUID NOT NULL REFERENCES "departments"("id"),
    "designation_id" UUID NOT NULL REFERENCES "designations"("id"),
    "grade_id" UUID REFERENCES "grades"("id"),
    "reporting_manager_id" UUID REFERENCES "employees"("id"),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3), -- NULL = current active state
    "reason" VARCHAR(255),
    "changed_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 7. employee_documents (Object storage pointers)
-- -----------------------------------------------------------------------------
CREATE TABLE "employee_documents" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "employee_id" UUID NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "document_type" "DocumentType" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "uploaded_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance & multi-tenant isolation
CREATE INDEX "idx_employees_org_deleted" ON "employees"("organization_id", "deleted_at");
CREATE INDEX "idx_employees_reporting_manager" ON "employees"("reporting_manager_id");
CREATE INDEX "idx_job_histories_org_emp" ON "employee_job_histories"("organization_id", "employee_id");
CREATE INDEX "idx_documents_org_emp" ON "employee_documents"("organization_id", "employee_id");

-- -----------------------------------------------------------------------------
-- 8. shifts (Module 3: Shift Management Templates)
-- -----------------------------------------------------------------------------
CREATE TYPE "DayOfWeek" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);

CREATE TABLE "shifts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50) NOT NULL, -- e.g. 'GEN', 'MORN', 'NGT'
    "start_time" VARCHAR(5) NOT NULL, -- 'HH:mm' 24h format, e.g. '09:00'
    "end_time" VARCHAR(5) NOT NULL,   -- 'HH:mm' 24h format, e.g. '18:00'
    "is_overnight" BOOLEAN NOT NULL DEFAULT false,
    "grace_period_minutes" INTEGER NOT NULL DEFAULT 15,
    "break_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "half_day_threshold_minutes" INTEGER NOT NULL DEFAULT 240, -- 4 hours
    "full_day_threshold_minutes" INTEGER NOT NULL DEFAULT 480, -- 8 hours
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shifts_org_code_unique" UNIQUE ("organization_id", "code"),
    CONSTRAINT "shifts_org_name_unique" UNIQUE ("organization_id", "name")
);

-- -----------------------------------------------------------------------------
-- 9. employee_shift_assignments (Versioned Append-Only Shift Schedule)
-- -----------------------------------------------------------------------------
CREATE TABLE "employee_shift_assignments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "employee_id" UUID NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "shift_id" UUID NOT NULL REFERENCES "shifts"("id") ON DELETE RESTRICT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3), -- NULL = current active assignment
    "weekly_off_days" "DayOfWeek"[] NOT NULL DEFAULT ARRAY['SATURDAY'::"DayOfWeek", 'SUNDAY'::"DayOfWeek"],
    "assigned_by_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_shifts_org_active" ON "shifts"("organization_id", "is_active");
CREATE INDEX "idx_shift_assignments_org_emp" ON "employee_shift_assignments"("organization_id", "employee_id", "effective_to");

