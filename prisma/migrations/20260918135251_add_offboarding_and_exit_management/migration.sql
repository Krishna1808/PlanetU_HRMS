-- CreateEnum
CREATE TYPE "ExitType" AS ENUM ('RESIGNATION', 'TERMINATION', 'RETIREMENT', 'CONTRACT_END');

-- CreateEnum
CREATE TYPE "ExitStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CLEARANCE_IN_PROGRESS', 'SETTLEMENT_PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExitClearanceDepartment" AS ENUM ('IT', 'FINANCE', 'ADMIN', 'MANAGER', 'HR');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('PENDING', 'CLEARED', 'WAIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExitReasonCategory" AS ENUM ('BETTER_OPPORTUNITY', 'CAREER_GROWTH', 'HIGHER_COMPENSATION', 'HEALTH_PERSONAL', 'RELOCATION', 'WORK_CULTURE', 'MANAGEMENT_ISSUES', 'OTHER');

-- CreateEnum
CREATE TYPE "FnFStatus" AS ENUM ('DRAFT', 'APPROVED', 'PROCESSED');

-- CreateTable
CREATE TABLE "exit_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "exit_type" "ExitType" NOT NULL DEFAULT 'RESIGNATION',
    "resignation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "notice_period_days" INTEGER NOT NULL DEFAULT 30,
    "proposed_last_working_day" TIMESTAMP(3) NOT NULL,
    "approved_last_working_day" TIMESTAMP(3),
    "status" "ExitStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "manager_approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "manager_comments" TEXT,
    "manager_approved_at" TIMESTAMP(3),
    "hr_approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "hr_comments" TEXT,
    "hr_approved_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "finalized_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_clearance_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "exit_request_id" UUID NOT NULL,
    "department_type" "ExitClearanceDepartment" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "cleared_by_user_id" UUID,
    "cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exit_clearance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_interviews" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "exit_request_id" UUID NOT NULL,
    "reason_category" "ExitReasonCategory" NOT NULL,
    "company_culture_rating" INTEGER NOT NULL,
    "management_rating" INTEGER NOT NULL,
    "work_life_balance_rating" INTEGER NOT NULL,
    "compensation_rating" INTEGER NOT NULL,
    "would_recommend_company" BOOLEAN NOT NULL,
    "feedback" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exit_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fnf_settlements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "exit_request_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "settlement_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_working_day" TIMESTAMP(3) NOT NULL,
    "payable_days" DECIMAL(5,2) NOT NULL,
    "earned_basic" DECIMAL(12,2) NOT NULL,
    "earned_hra" DECIMAL(12,2) NOT NULL,
    "earned_special_allowance" DECIMAL(12,2) NOT NULL,
    "earned_gross" DECIMAL(12,2) NOT NULL,
    "encashable_leave_days" DECIMAL(5,2) NOT NULL,
    "daily_basic_rate" DECIMAL(12,2) NOT NULL,
    "leave_encashment_amount" DECIMAL(12,2) NOT NULL,
    "gratuity_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_additions" DECIMAL(12,2) NOT NULL,
    "notice_shortfall_days" INTEGER NOT NULL DEFAULT 0,
    "notice_deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employee_pf" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "professional_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_deductions_remarks" TEXT,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_settlement_amount" DECIMAL(12,2) NOT NULL,
    "status" "FnFStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fnf_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exit_requests_organization_id_status_idx" ON "exit_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "exit_requests_organization_id_employee_id_idx" ON "exit_requests"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "exit_clearance_tasks_organization_id_exit_request_id_idx" ON "exit_clearance_tasks"("organization_id", "exit_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "exit_interviews_exit_request_id_key" ON "exit_interviews"("exit_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "fnf_settlements_exit_request_id_key" ON "fnf_settlements"("exit_request_id");

-- AddForeignKey
ALTER TABLE "exit_requests" ADD CONSTRAINT "exit_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_requests" ADD CONSTRAINT "exit_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_clearance_tasks" ADD CONSTRAINT "exit_clearance_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_clearance_tasks" ADD CONSTRAINT "exit_clearance_tasks_exit_request_id_fkey" FOREIGN KEY ("exit_request_id") REFERENCES "exit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_interviews" ADD CONSTRAINT "exit_interviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_interviews" ADD CONSTRAINT "exit_interviews_exit_request_id_fkey" FOREIGN KEY ("exit_request_id") REFERENCES "exit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fnf_settlements" ADD CONSTRAINT "fnf_settlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fnf_settlements" ADD CONSTRAINT "fnf_settlements_exit_request_id_fkey" FOREIGN KEY ("exit_request_id") REFERENCES "exit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fnf_settlements" ADD CONSTRAINT "fnf_settlements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
