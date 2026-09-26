import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PayrollBatchStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { NotificationEventBusService } from '../notifications/notification-event-bus.service';
import { PayslipPdfService, PayslipPdfData } from './services/payslip-pdf.service';
import { SetSalaryStructureDto } from './dto/set-salary-structure.dto';
import { UpdatePayrollConfigDto } from './dto/update-payroll-config.dto';
import { CalculatePayrollBatchDto } from './dto/calculate-payroll-batch.dto';
import { DisburseBatchDto } from './dto/disburse-batch.dto';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    @Optional() private readonly payslipPdfService?: PayslipPdfService,
    @Optional() private readonly eventBus?: NotificationEventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Tenant Payroll Configuration
  // ---------------------------------------------------------------------------

  /**
   * Retrieves tenant compliance configuration, initializing default Indian
   * reference values if none exists yet.
   */
  async getConfiguration(organizationId: string) {
    let config = await this.prisma.payrollConfiguration.findUnique({
      where: { organizationId },
    });

    if (!config) {
      config = await this.prisma.payrollConfiguration.create({
        data: {
          organizationId,
          pfCeilingAmount: 15000.0,
          applyPfCeiling: true,
          pfEmployeeRate: 12.0,
          pfEmployerRate: 12.0,
          applyEsi: true,
          esiThresholdAmount: 21000.0,
          esiEmployeeRate: 0.75,
          esiEmployerRate: 3.25,
          ptAmount: 200.0,
          ptSalaryThreshold: 10000.0,
          roundToWholeRupee: true,
          basicPercentage: 50.0,
          hraPercentage: 25.0,
          specialAllowancePercentage: 25.0,
        },
      });
    }

    return config;
  }

  /**
   * Updates tenant compliance & statutory parameters (Finance role only).
   */
  async updateConfiguration(organizationId: string, dto: UpdatePayrollConfigDto) {
    // Ensure config exists first
    await this.getConfiguration(organizationId);

    return this.prisma.payrollConfiguration.update({
      where: { organizationId },
      data: {
        ...(dto.pfCeilingAmount !== undefined && { pfCeilingAmount: dto.pfCeilingAmount }),
        ...(dto.applyPfCeiling !== undefined && { applyPfCeiling: dto.applyPfCeiling }),
        ...(dto.pfEmployeeRate !== undefined && { pfEmployeeRate: dto.pfEmployeeRate }),
        ...(dto.pfEmployerRate !== undefined && { pfEmployerRate: dto.pfEmployerRate }),
        ...(dto.applyEsi !== undefined && { applyEsi: dto.applyEsi }),
        ...(dto.esiThresholdAmount !== undefined && { esiThresholdAmount: dto.esiThresholdAmount }),
        ...(dto.esiEmployeeRate !== undefined && { esiEmployeeRate: dto.esiEmployeeRate }),
        ...(dto.esiEmployerRate !== undefined && { esiEmployerRate: dto.esiEmployerRate }),
        ...(dto.ptAmount !== undefined && { ptAmount: dto.ptAmount }),
        ...(dto.ptSalaryThreshold !== undefined && { ptSalaryThreshold: dto.ptSalaryThreshold }),
        ...(dto.roundToWholeRupee !== undefined && { roundToWholeRupee: dto.roundToWholeRupee }),
        ...(dto.basicPercentage !== undefined && { basicPercentage: dto.basicPercentage }),
        ...(dto.hraPercentage !== undefined && { hraPercentage: dto.hraPercentage }),
        ...(dto.specialAllowancePercentage !== undefined && {
          specialAllowancePercentage: dto.specialAllowancePercentage,
        }),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Append-Only Salary Structure Management
  // ---------------------------------------------------------------------------

  /**
   * Defines or revises an employee's salary structure using an append-only ledger pattern.
   * Derives components based on tenant percentages (Default: 50% Basic, 25% HRA, 25% Special).
   */
  async setSalaryStructure(
    organizationId: string,
    dto: SetSalaryStructureDto,
    userId?: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${dto.employeeId}' not found`);
    }

    const config = await this.getConfiguration(organizationId);

    const annualCtc = Number(dto.annualCtc);
    const monthlyGross = Number((annualCtc / 12).toFixed(2));

    const basicPct = Number(config.basicPercentage) / 100;
    const hraPct = Number(config.hraPercentage) / 100;

    const basicSalary = Number((monthlyGross * basicPct).toFixed(2));
    const hra = Number((monthlyGross * hraPct).toFixed(2));
    // Balancing item to avoid precision leakage
    const specialAllowance = Number((monthlyGross - basicSalary - hra).toFixed(2));

    const effectiveFromDate = new Date(dto.effectiveFrom);

    return this.prisma.$transaction(async (tx) => {
      // Find currently active salary structure (effectiveTo is null)
      const currentActive = await tx.salaryStructure.findFirst({
        where: {
          organizationId,
          employeeId: dto.employeeId,
          effectiveTo: null,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (currentActive) {
        if (new Date(currentActive.effectiveFrom) >= effectiveFromDate) {
          throw new BadRequestException(
            `New effectiveFrom date (${dto.effectiveFrom}) must be after current structure's effectiveFrom date (${currentActive.effectiveFrom.toISOString().split('T')[0]})`,
          );
        }

        // Close the previous active record
        await tx.salaryStructure.update({
          where: { id: currentActive.id },
          data: { effectiveTo: effectiveFromDate },
        });
      }

      // Insert new active salary structure
      return tx.salaryStructure.create({
        data: {
          organizationId,
          employeeId: dto.employeeId,
          annualCtc,
          monthlyGross,
          basicSalary,
          hra,
          specialAllowance,
          effectiveFrom: effectiveFromDate,
          effectiveTo: null,
          revisionReason: dto.revisionReason,
          revisedByUserId: userId,
        },
      });
    });
  }

  /**
   * Retrieves salary structure revision history for an employee.
   */
  async getSalaryHistory(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${employeeId}' not found`);
    }

    return this.prisma.salaryStructure.findMany({
      where: { organizationId, employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Monthly Payroll Batch Calculation (Attendance Single Source of Truth)
  // ---------------------------------------------------------------------------

  /**
   * Calculates or refreshes a DRAFT payroll batch for a month.
   * Strictly consumes AttendanceService.getFinalizedPayableDays for payable and absence days.
   * Performs Prorated-then-PF calculations with tenant compliance rules.
   */
  async calculateBatch(
    organizationId: string,
    dto: CalculatePayrollBatchDto,
    _userId?: string,
  ) {
    const { year, month } = dto;

    // 1. Check existing batch
    const existingBatch = await this.prisma.payrollBatch.findUnique({
      where: {
        organizationId_year_month: { organizationId, year, month },
      },
    });

    if (existingBatch) {
      if (
        existingBatch.status === PayrollBatchStatus.LOCKED ||
        existingBatch.status === PayrollBatchStatus.DISBURSED
      ) {
        throw new BadRequestException(
          `Payroll batch for ${year}-${month.toString().padStart(2, '0')} is ${existingBatch.status} and cannot be recalculated.`,
        );
      }
    }

    const config = await this.getConfiguration(organizationId);

    // Number of days in calendar month
    const totalMonthDays = new Date(year, month, 0).getDate();
    const periodStartDate = new Date(Date.UTC(year, month - 1, 1));
    const periodEndDate = new Date(Date.UTC(year, month - 1, totalMonthDays));

    // 2. Fetch all active employees in organization
    const activeEmployees = await this.prisma.employee.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        salaryStructures: {
          where: {
            effectiveFrom: { lte: periodEndDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: periodStartDate } },
            ],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    // 2b. Fetch pending adjustments for this month (Bonuses, Arrears, TDS, Overtime)
    const pendingAdjustments = await this.prisma.payrollAdjustment.findMany({
      where: {
        organizationId,
        year,
        month,
      },
    });

    // 3. Compute payslips for each employee who has a salary structure
    const calculatedPayslips: Array<{
      employeeId: string;
      salaryStructureId: string;
      totalMonthDays: number;
      payableDays: number;
      lwpDays: number;
      unexcusedAbsenceDays: number;
      nominalGross: number;
      nominalBasic: number;
      nominalHra: number;
      nominalSpecialAllowance: number;
      earnedBasic: number;
      earnedHra: number;
      earnedSpecialAllowance: number;
      earnedGross: number;
      bonusAmount: number;
      arrearsAmount: number;
      otherAdditions: number;
      employeePf: number;
      employerPf: number;
      employeeEsi: number;
      employerEsi: number;
      professionalTax: number;
      tdsDeduction: number;
      otherDeductions: number;
      totalDeductions: number;
      netPay: number;
    }> = [];

    for (const emp of activeEmployees) {
      const activeStructure = emp.salaryStructures[0];
      if (!activeStructure) {
        // Skip employees without an assigned salary structure
        continue;
      }

      // Authoritative Single Source of Truth: call AttendanceService
      const attendance = await this.attendanceService.getFinalizedPayableDays(
        organizationId,
        emp.id,
        year,
        month,
      );

      const payableDays = Number(attendance.payableDays);
      const lwpDays = Number(attendance.lwpDays);
      const unexcusedAbsenceDays = Number(attendance.unexcusedAbsenceDays);

      const payableRatio = totalMonthDays > 0 ? payableDays / totalMonthDays : 0;

      const nominalGross = Number(activeStructure.monthlyGross);
      const nominalBasic = Number(activeStructure.basicSalary);
      const nominalHra = Number(activeStructure.hra);
      const nominalSpecialAllowance = Number(activeStructure.specialAllowance);

      // Prorated-then-PF: Calculate earned components first
      const earnedBasic = Number((nominalBasic * payableRatio).toFixed(2));
      const earnedHra = Number((nominalHra * payableRatio).toFixed(2));
      const earnedSpecialAllowance = Number(
        (nominalSpecialAllowance * payableRatio).toFixed(2),
      );
      const earnedGross = Number(
        (earnedBasic + earnedHra + earnedSpecialAllowance).toFixed(2),
      );

      // Adjustments (Bonuses, Arrears, TDS, Overtime) for this employee
      const empAdjustments = pendingAdjustments.filter((a) => a.employeeId === emp.id);
      let bonusAmount = 0.0;
      let arrearsAmount = 0.0;
      let otherAdditions = 0.0;
      let tdsDeduction = 0.0;
      let otherDeductions = 0.0;

      for (const adj of empAdjustments) {
        const val = Number(adj.amount);
        switch (adj.type) {
          case 'BONUS':
            bonusAmount += val;
            break;
          case 'ARREARS':
            arrearsAmount += val;
            break;
          case 'OVERTIME':
          case 'REIMBURSEMENT':
            otherAdditions += val;
            break;
          case 'TDS':
            tdsDeduction += val;
            break;
          case 'OTHER_DEDUCTION':
            otherDeductions += val;
            break;
        }
      }

      bonusAmount = Number(bonusAmount.toFixed(2));
      arrearsAmount = Number(arrearsAmount.toFixed(2));
      otherAdditions = Number(otherAdditions.toFixed(2));
      tdsDeduction = Number(tdsDeduction.toFixed(2));
      otherDeductions = Number(otherDeductions.toFixed(2));

      // PF Calculation on Earned Basic
      const pfCeiling = Number(config.pfCeilingAmount);
      const pfBasis = config.applyPfCeiling
        ? Math.min(earnedBasic, pfCeiling)
        : earnedBasic;

      const employeePfRate = Number(config.pfEmployeeRate) / 100;
      const employerPfRate = Number(config.pfEmployerRate) / 100;

      const employeePf = Number((pfBasis * employeePfRate).toFixed(2));
      const employerPf = Number((pfBasis * employerPfRate).toFixed(2));

      // ESI Calculation (Statutory threshold default 21,000 INR on earned gross)
      let employeeEsi = 0.0;
      let employerEsi = 0.0;
      const esiThreshold = Number(config.esiThresholdAmount || 21000.0);
      if (config.applyEsi && earnedGross <= esiThreshold) {
        const eeRate = Number(config.esiEmployeeRate || 0.75) / 100;
        const erRate = Number(config.esiEmployerRate || 3.25) / 100;
        employeeEsi = Number((earnedGross * eeRate).toFixed(2));
        employerEsi = Number((earnedGross * erRate).toFixed(2));
      }

      // Professional Tax (PT) Calculation
      const ptThreshold = Number(config.ptSalaryThreshold);
      const professionalTax =
        earnedGross >= ptThreshold ? Number(config.ptAmount) : 0.0;

      // Deductions
      const totalDeductions = Number(
        (employeePf + employeeEsi + professionalTax + tdsDeduction + otherDeductions).toFixed(2),
      );

      // Net Pay with rounding policy applied strictly at the final figure
      const totalEarnings = Number(
        (earnedGross + bonusAmount + arrearsAmount + otherAdditions).toFixed(2),
      );
      const rawNetPay = totalEarnings - totalDeductions;
      let netPay = config.roundToWholeRupee
        ? Math.round(rawNetPay)
        : Number(rawNetPay.toFixed(2));
      netPay = Math.max(0, netPay);

      calculatedPayslips.push({
        employeeId: emp.id,
        salaryStructureId: activeStructure.id,
        totalMonthDays,
        payableDays,
        lwpDays,
        unexcusedAbsenceDays,
        nominalGross,
        nominalBasic,
        nominalHra,
        nominalSpecialAllowance,
        earnedBasic,
        earnedHra,
        earnedSpecialAllowance,
        earnedGross,
        bonusAmount,
        arrearsAmount,
        otherAdditions,
        employeePf,
        employerPf,
        employeeEsi,
        employerEsi,
        professionalTax,
        tdsDeduction,
        otherDeductions,
        totalDeductions,
        netPay,
      });
    }

    // 4. Batch totals
    const totalEmployees = calculatedPayslips.length;
    const totalGrossPay = Number(
      calculatedPayslips.reduce((sum, p) => sum + p.earnedGross + p.bonusAmount + p.arrearsAmount + p.otherAdditions, 0).toFixed(2),
    );
    const totalDeductions = Number(
      calculatedPayslips.reduce((sum, p) => sum + p.totalDeductions, 0).toFixed(2),
    );
    const totalNetPay = Number(
      calculatedPayslips.reduce((sum, p) => sum + p.netPay, 0).toFixed(2),
    );
    const totalEmployerPf = Number(
      calculatedPayslips.reduce((sum, p) => sum + p.employerPf, 0).toFixed(2),
    );

    // 5. Database transaction to create/update batch & payslips idempotently
    return this.prisma.$transaction(async (tx) => {
      let batchId: string;

      if (existingBatch) {
        batchId = existingBatch.id;
        // Clean out existing payslips for draft recalculation
        await tx.payslip.deleteMany({ where: { payrollBatchId: batchId } });

        await tx.payrollBatch.update({
          where: { id: batchId },
          data: {
            totalEmployees,
            totalGrossPay,
            totalDeductions,
            totalNetPay,
            totalEmployerPf,
            status: PayrollBatchStatus.DRAFT,
          },
        });
      } else {
        const createdBatch = await tx.payrollBatch.create({
          data: {
            organizationId,
            year,
            month,
            status: PayrollBatchStatus.DRAFT,
            totalEmployees,
            totalGrossPay,
            totalDeductions,
            totalNetPay,
            totalEmployerPf,
          },
        });
        batchId = createdBatch.id;
      }

      // Create individual payslips
      if (calculatedPayslips.length > 0) {
        await tx.payslip.createMany({
          data: calculatedPayslips.map((p) => ({
            organizationId,
            payrollBatchId: batchId,
            ...p,
          })),
        });

        // Mark processed adjustments
        await tx.payrollAdjustment.updateMany({
          where: {
            organizationId,
            year,
            month,
            employeeId: { in: calculatedPayslips.map((p) => p.employeeId) },
          },
          data: {
            isProcessed: true,
            payrollBatchId: batchId,
          },
        });
      }

      return tx.payrollBatch.findUnique({
        where: { id: batchId },
        include: {
          payslips: {
            include: {
              employee: {
                select: {
                  id: true,
                  employeeCode: true,
                  firstName: true,
                  lastName: true,
                  department: { select: { name: true } },
                  designation: { select: { name: true } },
                },
              },
            },
          },
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Batch Lifecycle (List, View, Lock, Disburse)
  // ---------------------------------------------------------------------------

  /**
   * Lists all payroll batches for tenant.
   */
  async getBatches(organizationId: string) {
    return this.prisma.payrollBatch.findMany({
      where: { organizationId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  /**
   * Retrieves full details of a specific payroll batch including payslips.
   */
  async getBatchById(organizationId: string, batchId: string) {
    const batch = await this.prisma.payrollBatch.findFirst({
      where: { id: batchId, organizationId },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                bankName: true,
                accountNumber: true,
                ifscOrRouting: true,
                department: { select: { name: true } },
                designation: { select: { name: true } },
              },
            },
          },
          orderBy: { employee: { employeeCode: 'asc' } },
        },
        adjustments: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Payroll batch with ID '${batchId}' not found`);
    }

    return batch;
  }

  /**
   * Transitions a DRAFT batch to LOCKED.
   * Enforces immutability: once locked, records cannot be altered or recalculated.
   */
  async lockBatch(organizationId: string, batchId: string, userId?: string) {
    const batch = await this.prisma.payrollBatch.findFirst({
      where: { id: batchId, organizationId },
    });

    if (!batch) {
      throw new NotFoundException(`Payroll batch with ID '${batchId}' not found`);
    }

    if (batch.status !== PayrollBatchStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT batches can be locked. Current status: ${batch.status}`,
      );
    }

    return this.prisma.payrollBatch.update({
      where: { id: batchId },
      data: {
        status: PayrollBatchStatus.LOCKED,
        lockedAt: new Date(),
        lockedByUserId: userId,
      },
    });
  }

  /**
   * Transitions a LOCKED batch to DISBURSED.
   * Records transaction reference and timestamp.
   */
  async disburseBatch(
    organizationId: string,
    batchId: string,
    dto: DisburseBatchDto,
    userId?: string,
  ) {
    const batch = await this.prisma.payrollBatch.findFirst({
      where: { id: batchId, organizationId },
    });

    if (!batch) {
      throw new NotFoundException(`Payroll batch with ID '${batchId}' not found`);
    }

    if (batch.status !== PayrollBatchStatus.LOCKED) {
      throw new BadRequestException(
        `Only LOCKED batches can be disbursed. Current status: ${batch.status}`,
      );
    }

    const updatedBatch = await this.prisma.payrollBatch.update({
      where: { id: batchId },
      data: {
        status: PayrollBatchStatus.DISBURSED,
        disbursedAt: new Date(),
        disbursedByUserId: userId,
        paymentReference: dto.paymentReference,
      },
    });

    if (this.eventBus) {
      try {
        const payslips = await this.prisma.payslip.findMany({
          where: { batchId, organizationId },
          include: {
            employee: {
              include: {
                user: { select: { id: true } },
              },
            },
          },
        });

        for (const ps of payslips) {
          if (ps.employee?.user?.id) {
            this.eventBus.emitPayslipReleased({
              organizationId,
              recipientUserId: ps.employee.user.id,
              payslipId: ps.id,
              month: batch.month,
              year: batch.year,
              netPayable: Number(ps.netPay),
            });
          }
        }
      } catch {
        // ignore notification dispatch failure in batch
      }
    }

    return updatedBatch;
  }

  // ---------------------------------------------------------------------------
  // 5. Corporate Bank Advice Export
  // ---------------------------------------------------------------------------

  /**
   * Generates bank payment advice in structured JSON or CSV format
   * for corporate internet banking bulk upload.
   */
  async getBankAdvice(
    organizationId: string,
    batchId: string,
    format: 'json' | 'csv' = 'json',
  ) {
    const batch = await this.getBatchById(organizationId, batchId);

    const records = batch.payslips.map((ps) => ({
      employeeCode: ps.employee.employeeCode,
      employeeName: `${ps.employee.firstName} ${ps.employee.lastName}`.trim(),
      bankName: ps.employee.bankName || 'N/A',
      accountNumber: ps.employee.accountNumber || 'N/A',
      ifscCode: ps.employee.ifscOrRouting || 'N/A',
      netPay: Number(ps.netPay),
    }));

    if (format === 'csv') {
      const header = 'Employee Code,Employee Name,Bank Name,Account Number,IFSC Code,Net Pay (INR)\n';
      const rows = records
        .map(
          (r) =>
            `"${r.employeeCode}","${r.employeeName}","${r.bankName}","${r.accountNumber}","${r.ifscCode}",${r.netPay}`,
        )
        .join('\n');
      return header + rows;
    }

    return {
      batchId: batch.id,
      year: batch.year,
      month: batch.month,
      status: batch.status,
      totalEmployees: batch.totalEmployees,
      totalDisbursement: Number(batch.totalNetPay),
      records,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Payslip Viewing & Printable HTML Representation
  // ---------------------------------------------------------------------------

  /**
   * Retrieves single payslip with employee and batch details, enforcing RBAC scoping.
   */
  async getPayslipById(
    organizationId: string,
    payslipId: string,
    currentUser: AuthenticatedUser,
  ) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, organizationId },
      include: {
        payrollBatch: true,
        salaryStructure: true,
        employee: {
          include: {
            department: true,
            designation: true,
            organization: true,
          },
        },
      },
    });

    if (!payslip) {
      throw new NotFoundException(`Payslip with ID '${payslipId}' not found`);
    }

    // Role-based visibility scoping
    if (
      currentUser.role === Role.EMPLOYEE &&
      currentUser.employeeId !== payslip.employeeId
    ) {
      throw new ForbiddenException('You are not authorized to view this payslip');
    }

    return payslip;
  }

  /**
   * Retrieves payslips for the authenticated employee (ESS).
   */
  async getMyPayslips(organizationId: string, employeeId: string) {
    return this.prisma.payslip.findMany({
      where: {
        organizationId,
        employeeId,
        payrollBatch: {
          status: { in: [PayrollBatchStatus.LOCKED, PayrollBatchStatus.DISBURSED] },
        },
      },
      include: {
        payrollBatch: {
          select: { year: true, month: true, status: true, disbursedAt: true },
        },
      },
      orderBy: [
        { payrollBatch: { year: 'desc' } },
        { payrollBatch: { month: 'desc' } },
      ],
    });
  }

  /**
   * Generates a clean, professional HTML document for browser printing / PDF export.
   * Free from any heavy external binary dependencies.
   */
  async renderPrintablePayslip(
    organizationId: string,
    payslipId: string,
    currentUser: AuthenticatedUser,
  ): Promise<string> {
    const p = await this.getPayslipById(organizationId, payslipId, currentUser);
    const emp = p.employee;
    const org = emp.organization;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const monthStr = monthNames[p.payrollBatch.month - 1];

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${emp.firstName} ${emp.lastName} (${monthStr} ${p.payrollBatch.year})</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1f2937;
      margin: 0;
      padding: 24px;
      background: #f9fafb;
    }
    .payslip-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 24px;
      color: #111827;
    }
    .header .subtitle {
      font-size: 14px;
      color: #6b7280;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
      font-size: 13px;
      margin-bottom: 24px;
      background: #f3f4f6;
      padding: 16px;
      border-radius: 6px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
    }
    .info-label {
      color: #4b5563;
      font-weight: 500;
    }
    .info-val {
      font-weight: 600;
      color: #111827;
    }
    .table-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #f3f4f6;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid #d1d5db;
    }
    th.text-right, td.text-right {
      text-align: right;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #f3f4f6;
    }
    .total-row td {
      font-weight: 700;
      border-top: 1px solid #9ca3af;
      border-bottom: 1px solid #9ca3af;
      background: #f9fafb;
    }
    .net-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .net-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e40af;
    }
    .net-amount {
      font-size: 24px;
      font-weight: 800;
      color: #1d4ed8;
    }
    .footnote {
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
      margin-top: 24px;
      text-align: center;
    }
    @media print {
      body { background: white; padding: 0; }
      .payslip-card { box-shadow: none; border: none; padding: 0; }
      .net-box { border-color: #3b82f6; }
    }
  </style>
</head>
<body>
  <div class="payslip-card">
    <div class="header">
      <h1>${org.name}</h1>
      <div class="subtitle">Payslip for the month of <strong>${monthStr} ${p.payrollBatch.year}</strong></div>
    </div>

    <div class="info-grid">
      <div class="info-row"><span class="info-label">Employee Code:</span><span class="info-val">${emp.employeeCode}</span></div>
      <div class="info-row"><span class="info-label">Payable Days:</span><span class="info-val">${p.payableDays} / ${p.totalMonthDays}</span></div>
      <div class="info-row"><span class="info-label">Employee Name:</span><span class="info-val">${emp.firstName} ${emp.lastName}</span></div>
      <div class="info-row"><span class="info-label">Unexcused Absences:</span><span class="info-val">${p.unexcusedAbsenceDays}</span></div>
      <div class="info-row"><span class="info-label">Department:</span><span class="info-val">${emp.department.name}</span></div>
      <div class="info-row"><span class="info-label">LWP Days:</span><span class="info-val">${p.lwpDays}</span></div>
      <div class="info-row"><span class="info-label">Designation:</span><span class="info-val">${emp.designation.name}</span></div>
      <div class="info-row"><span class="info-label">PAN Number:</span><span class="info-val">${emp.panNumber || 'N/A'}</span></div>
      <div class="info-row"><span class="info-label">Bank Account:</span><span class="info-val">${emp.accountNumber ? '••••' + emp.accountNumber.slice(-4) : 'N/A'}</span></div>
      <div class="info-row"><span class="info-label">UAN:</span><span class="info-val">${emp.uanNumber || 'N/A'}</span></div>
    </div>

    <div class="table-container">
      <div>
        <table>
          <thead>
            <tr>
              <th>Earnings</th>
              <th class="text-right">Nominal</th>
              <th class="text-right">Earned</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td class="text-right">₹${Number(p.nominalBasic).toFixed(2)}</td>
              <td class="text-right">₹${Number(p.earnedBasic).toFixed(2)}</td>
            </tr>
            <tr>
              <td>House Rent Allowance (HRA)</td>
              <td class="text-right">₹${Number(p.nominalHra).toFixed(2)}</td>
              <td class="text-right">₹${Number(p.earnedHra).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Special Allowance</td>
              <td class="text-right">₹${Number(p.nominalSpecialAllowance).toFixed(2)}</td>
              <td class="text-right">₹${Number(p.earnedSpecialAllowance).toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Gross Earnings</td>
              <td class="text-right">₹${Number(p.nominalGross).toFixed(2)}</td>
              <td class="text-right">₹${Number(p.earnedGross).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <table>
          <thead>
            <tr>
              <th>Deductions</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Employee Provident Fund (PF)</td>
              <td class="text-right">₹${Number(p.employeePf).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Professional Tax (PT)</td>
              <td class="text-right">₹${Number(p.professionalTax).toFixed(2)}</td>
            </tr>
            <tr>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
            <tr class="total-row">
              <td>Total Deductions</td>
              <td class="text-right">₹${Number(p.totalDeductions).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="net-box">
      <div class="net-title">Net Take-Home Pay</div>
      <div class="net-amount">₹${Number(p.netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    </div>

    <div style="font-size: 12px; color: #4b5563; margin-top: 8px;">
      <em>Employer Contributions: PF ₹${Number(p.employerPf).toFixed(2)}</em>
    </div>

    <div class="footnote">
      This is a computer-generated payslip issued by ${org.name} via PlanetU HRMS. No physical signature is required.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  // ---------------------------------------------------------------------------
  // 7. Binary PDF Payslip Generation (pdfkit)
  // ---------------------------------------------------------------------------

  /**
   * Generates a binary PDF buffer for a monthly payslip.
   */
  async generatePayslipPdf(
    organizationId: string,
    payslipId: string,
    currentUser: AuthenticatedUser,
  ): Promise<Buffer> {
    const p = await this.getPayslipById(organizationId, payslipId, currentUser);
    const emp = p.employee;

    const data: PayslipPdfData = {
      organizationName: emp.organization?.name || 'PlanetU HRMS',
      month: p.payrollBatch.month,
      year: p.payrollBatch.year,
      employee: {
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        employeeCode: emp.employeeCode,
        department: emp.department?.name || 'General',
        designation: emp.designation?.name || 'Employee',
        dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.toISOString().split('T')[0] : 'N/A',
        bankName: emp.bankName || undefined,
        accountNumber: emp.accountNumber || undefined,
        panNumber: emp.panNumber || undefined,
        uanNumber: emp.uanNumber || undefined,
      },
      attendance: {
        totalMonthDays: p.totalMonthDays,
        payableDays: Number(p.payableDays),
        lwpDays: Number(p.lwpDays),
      },
      earnings: {
        basic: Number(p.earnedBasic),
        hra: Number(p.earnedHra),
        specialAllowance: Number(p.earnedSpecialAllowance),
        bonus: Number(p.bonusAmount || 0),
        arrears: Number(p.arrearsAmount || 0),
        otherAdditions: Number(p.otherAdditions || 0),
        totalEarnings: Number(
          (
            Number(p.earnedGross) +
            Number(p.bonusAmount || 0) +
            Number(p.arrearsAmount || 0) +
            Number(p.otherAdditions || 0)
          ).toFixed(2),
        ),
      },
      deductions: {
        employeePf: Number(p.employeePf),
        employeeEsi: Number(p.employeeEsi || 0),
        professionalTax: Number(p.professionalTax),
        tds: Number(p.tdsDeduction || 0),
        otherDeductions: Number(p.otherDeductions || 0),
        totalDeductions: Number(p.totalDeductions),
      },
      netPay: Number(p.netPay),
      employerPf: Number(p.employerPf || 0),
      employerEsi: Number(p.employerEsi || 0),
    };

    if (this.payslipPdfService) {
      return this.payslipPdfService.generatePdf(data);
    }

    throw new BadRequestException('PDF generator service is not available');
  }

  // ---------------------------------------------------------------------------
  // 8. One-Time Monthly Adjustments & Bonuses Ledger
  // ---------------------------------------------------------------------------

  /**
   * Adds a one-time adjustment (bonus, arrears, overtime, or TDS deduction) to an employee.
   */
  async createAdjustment(
    organizationId: string,
    userId: string,
    dto: CreateAdjustmentDto,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException(`Employee not found in this organization.`);
    }

    // Check if payroll batch for this month is already locked
    const lockedBatch = await this.prisma.payrollBatch.findFirst({
      where: {
        organizationId,
        year: dto.year,
        month: dto.month,
        status: { in: [PayrollBatchStatus.LOCKED, PayrollBatchStatus.DISBURSED] },
      },
    });

    if (lockedBatch) {
      throw new BadRequestException(
        `Cannot add adjustments to locked or disbursed batch (${dto.month}/${dto.year}).`,
      );
    }

    const adjustment = await this.prisma.payrollAdjustment.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        year: dto.year,
        month: dto.month,
        type: dto.type,
        amount: dto.amount,
        description: dto.description || dto.reason || null,
        createdByUserId: userId,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            user: { select: { id: true } },
          },
        },
      },
    });

    if (this.eventBus && ['BONUS', 'ARREARS', 'OVERTIME', 'REIMBURSEMENT'].includes(dto.type)) {
      if (adjustment.employee?.user?.id) {
        try {
          this.eventBus.emitBonusAwarded({
            organizationId,
            recipientUserId: adjustment.employee.user.id,
            employeeName: `${adjustment.employee.firstName} ${adjustment.employee.lastName}`.trim(),
            amount: Number(dto.amount),
            type: dto.type,
            month: dto.month,
            year: dto.year,
            reason: dto.description || dto.reason,
          });
        } catch {
          // non-blocking notification failure
        }
      }
    }

    return adjustment;
  }

  /**
   * Lists all adjustments for a given month and year.
   */
  async getAdjustments(
    organizationId: string,
    year: number,
    month: number,
    employeeId?: string,
  ) {
    return this.prisma.payrollAdjustment.findMany({
      where: {
        organizationId,
        year,
        month,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Deletes an unprocessed adjustment.
   */
  async deleteAdjustment(organizationId: string, id: string) {
    const adjustment = await this.prisma.payrollAdjustment.findFirst({
      where: { id, organizationId },
      include: { payrollBatch: true },
    });

    if (!adjustment) {
      throw new NotFoundException(`Payroll adjustment not found.`);
    }

    if (adjustment.payrollBatch && adjustment.payrollBatch.status !== PayrollBatchStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot delete adjustment because the payroll batch for this period is already ${adjustment.payrollBatch.status}.`,
      );
    }

    return this.prisma.payrollAdjustment.delete({
      where: { id },
    });
  }
}
