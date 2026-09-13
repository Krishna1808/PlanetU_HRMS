-- CreateEnum
CREATE TYPE "PayrollBatchStatus" AS ENUM ('DRAFT', 'LOCKED', 'DISBURSED');

-- CreateTable
CREATE TABLE "payroll_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "pf_ceiling_amount" DECIMAL(12,2) NOT NULL DEFAULT 15000.00,
    "apply_pf_ceiling" BOOLEAN NOT NULL DEFAULT true,
    "pf_employee_rate" DECIMAL(5,2) NOT NULL DEFAULT 12.00,
    "pf_employer_rate" DECIMAL(5,2) NOT NULL DEFAULT 12.00,
    "pt_amount" DECIMAL(12,2) NOT NULL DEFAULT 200.00,
    "pt_salary_threshold" DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
    "round_to_whole_rupee" BOOLEAN NOT NULL DEFAULT true,
    "basic_percentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "hra_percentage" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "special_allowance_percentage" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "annual_ctc" DECIMAL(12,2) NOT NULL,
    "monthly_gross" DECIMAL(12,2) NOT NULL,
    "basic_salary" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL,
    "special_allowance" DECIMAL(12,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "revision_reason" TEXT,
    "revised_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PayrollBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "total_gross_pay" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_net_pay" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_employer_pf" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "locked_at" TIMESTAMP(3),
    "locked_by_user_id" UUID,
    "disbursed_at" TIMESTAMP(3),
    "disbursed_by_user_id" UUID,
    "payment_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payroll_batch_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "salary_structure_id" UUID NOT NULL,
    "total_month_days" INTEGER NOT NULL,
    "payable_days" DECIMAL(5,2) NOT NULL,
    "lwp_days" DECIMAL(5,2) NOT NULL,
    "unexcused_absence_days" DECIMAL(5,2) NOT NULL,
    "nominal_gross" DECIMAL(12,2) NOT NULL,
    "nominal_basic" DECIMAL(12,2) NOT NULL,
    "nominal_hra" DECIMAL(12,2) NOT NULL,
    "nominal_special_allowance" DECIMAL(12,2) NOT NULL,
    "earned_basic" DECIMAL(12,2) NOT NULL,
    "earned_hra" DECIMAL(12,2) NOT NULL,
    "earned_special_allowance" DECIMAL(12,2) NOT NULL,
    "earned_gross" DECIMAL(12,2) NOT NULL,
    "employee_pf" DECIMAL(12,2) NOT NULL,
    "professional_tax" DECIMAL(12,2) NOT NULL,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_pay" DECIMAL(12,2) NOT NULL,
    "employer_pf" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_configurations_organization_id_key" ON "payroll_configurations"("organization_id");

-- CreateIndex
CREATE INDEX "salary_structures_organization_id_employee_id_effective_to_idx" ON "salary_structures"("organization_id", "employee_id", "effective_to");

-- CreateIndex
CREATE INDEX "payroll_batches_organization_id_status_idx" ON "payroll_batches"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_batches_organization_id_year_month_key" ON "payroll_batches"("organization_id", "year", "month");

-- CreateIndex
CREATE INDEX "payslips_organization_id_employee_id_idx" ON "payslips"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_batch_id_employee_id_key" ON "payslips"("payroll_batch_id", "employee_id");

-- AddForeignKey
ALTER TABLE "payroll_configurations" ADD CONSTRAINT "payroll_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_batches" ADD CONSTRAINT "payroll_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_batch_id_fkey" FOREIGN KEY ("payroll_batch_id") REFERENCES "payroll_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_salary_structure_id_fkey" FOREIGN KEY ("salary_structure_id") REFERENCES "salary_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
