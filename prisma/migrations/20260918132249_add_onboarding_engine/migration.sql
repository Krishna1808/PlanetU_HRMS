-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('INVITED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "onboarding_candidates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "personal_email" TEXT NOT NULL,
    "phone" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "gender" "Gender",
    "current_address" TEXT,
    "permanent_address" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relation" TEXT,
    "department_id" UUID NOT NULL,
    "designation_id" UUID NOT NULL,
    "grade_id" UUID,
    "location_id" UUID,
    "reporting_manager_id" UUID,
    "proposed_joining_date" TIMESTAMP(3) NOT NULL,
    "offered_ctc" DECIMAL(12,2),
    "bank_name" TEXT,
    "account_number" TEXT,
    "ifsc_or_routing" TEXT,
    "pan_number" TEXT,
    "uan_number" TEXT,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'INVITED',
    "converted_employee_id" UUID,
    "notes" TEXT,
    "invited_by_user_id" UUID,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completed_by_user_id" UUID,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_candidates_converted_employee_id_key" ON "onboarding_candidates"("converted_employee_id");

-- CreateIndex
CREATE INDEX "onboarding_candidates_organization_id_status_idx" ON "onboarding_candidates"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_candidates_organization_id_personal_email_key" ON "onboarding_candidates"("organization_id", "personal_email");

-- CreateIndex
CREATE INDEX "onboarding_tasks_organization_id_candidate_id_idx" ON "onboarding_tasks"("organization_id", "candidate_id");

-- AddForeignKey
ALTER TABLE "onboarding_candidates" ADD CONSTRAINT "onboarding_candidates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_candidates" ADD CONSTRAINT "onboarding_candidates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_candidates" ADD CONSTRAINT "onboarding_candidates_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_candidates" ADD CONSTRAINT "onboarding_candidates_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_candidates" ADD CONSTRAINT "onboarding_candidates_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_candidates" ADD CONSTRAINT "onboarding_candidates_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_candidates" ADD CONSTRAINT "onboarding_candidates_converted_employee_id_fkey" FOREIGN KEY ("converted_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "onboarding_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
