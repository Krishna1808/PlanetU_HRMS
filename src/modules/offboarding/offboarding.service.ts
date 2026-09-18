import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  ExitType,
  ExitStatus,
  ApprovalStatus,
  ExitClearanceDepartment,
  ClearanceStatus,
  EmploymentStatus,
  FnFStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveService } from '../leaves/leave.service';
import { PayrollService } from '../payroll/payroll.service';
import { ApplyResignationDto } from './dto/apply-resignation.dto';
import { ActionResignationDto } from './dto/action-resignation.dto';
import { UpdateClearanceTaskDto } from './dto/update-clearance-task.dto';
import { SubmitExitInterviewDto } from './dto/submit-exit-interview.dto';
import { CalculateFnFDto } from './dto/calculate-fnf.dto';
import { QueryExitRequestsDto } from './dto/query-exit-requests.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Injectable()
export class OffboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly leaveService: LeaveService,
    private readonly payrollService: PayrollService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Resignation & Exit Submission
  // ---------------------------------------------------------------------------

  /**
   * Submit an exit/resignation request.
   * Self-service for employees, or initiated directly by HR / Client Super Admin.
   */
  async applyResignation(
    organizationId: string,
    dto: ApplyResignationDto,
    currentUser: AuthenticatedUser,
  ) {
    let employeeId = dto.employeeId;

    if (currentUser.role === Role.EMPLOYEE) {
      if (!currentUser.employeeId) {
        throw new BadRequestException('Current user account is not linked to an employee record');
      }
      employeeId = currentUser.employeeId;
    } else if (!employeeId) {
      if (currentUser.employeeId) {
        employeeId = currentUser.employeeId;
      } else {
        throw new BadRequestException('employeeId must be provided by administrator');
      }
    }

    // Verify employee exists and is currently active
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      include: {
        department: true,
        designation: true,
        reportingManager: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${employeeId}' not found or already exited`);
    }

    if (
      employee.employmentStatus === EmploymentStatus.RESIGNED ||
      employee.employmentStatus === EmploymentStatus.TERMINATED
    ) {
      throw new BadRequestException('Employee is already processed as exited');
    }

    // Check for existing pending or active exit requests
    const existingActive = await this.prisma.exitRequest.findFirst({
      where: {
        organizationId,
        employeeId,
        status: {
          in: [
            ExitStatus.PENDING_APPROVAL,
            ExitStatus.APPROVED,
            ExitStatus.CLEARANCE_IN_PROGRESS,
            ExitStatus.SETTLEMENT_PENDING,
          ],
        },
      },
    });

    if (existingActive) {
      throw new ConflictException(
        `An active exit request is already in progress for this employee (Status: ${existingActive.status})`,
      );
    }

    const proposedLwd = new Date(dto.proposedLastWorkingDay);
    const noticePeriodDays = dto.noticePeriodDays ?? 30;

    // If initiated directly by HR / Super Admin (e.g. involuntary termination or pre-agreed exit)
    const isHrInitiated =
      currentUser.role === Role.CLIENT_SUPER_ADMIN || currentUser.role === Role.HR_ADMIN;

    return this.prisma.$transaction(async (tx) => {
      const exitRequest = await tx.exitRequest.create({
        data: {
          organizationId,
          employeeId,
          exitType: dto.exitType ?? ExitType.RESIGNATION,
          reason: dto.reason.trim(),
          noticePeriodDays,
          proposedLastWorkingDay: proposedLwd,
          status: isHrInitiated ? ExitStatus.APPROVED : ExitStatus.PENDING_APPROVAL,
          approvedLastWorkingDay: isHrInitiated ? proposedLwd : null,
          hrApprovalStatus: isHrInitiated ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
          hrApprovedAt: isHrInitiated ? new Date() : null,
          hrComments: isHrInitiated ? 'Exit initiated and approved by Administrator' : null,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              personalEmail: true,
              department: { select: { name: true } },
              designation: { select: { name: true } },
            },
          },
        },
      });

      // If HR initiated, transition employee to NOTICE_PERIOD and seed standard clearance tasks
      if (isHrInitiated) {
        await tx.employee.update({
          where: { id: employeeId },
          data: { employmentStatus: EmploymentStatus.NOTICE_PERIOD },
        });

        await this.seedClearanceTasks(organizationId, exitRequest.id, tx);
      }

      return exitRequest;
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Resignation Action (Manager & HR Approval)
  // ---------------------------------------------------------------------------

  /**
   * Action (Approve / Reject) a pending resignation.
   * Can be acted on by the employee's direct reporting Manager, HR_ADMIN, or CLIENT_SUPER_ADMIN.
   */
  async actionResignation(
    organizationId: string,
    requestId: string,
    dto: ActionResignationDto,
    currentUser: AuthenticatedUser,
  ) {
    const exitRequest = await this.prisma.exitRequest.findFirst({
      where: { id: requestId, organizationId },
      include: {
        employee: true,
      },
    });

    if (!exitRequest) {
      throw new NotFoundException(`Exit request '${requestId}' not found`);
    }

    if (
      exitRequest.status !== ExitStatus.PENDING_APPROVAL &&
      exitRequest.status !== ExitStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Exit request cannot be actioned in status '${exitRequest.status}'`,
      );
    }

    const isSuperAdmin = currentUser.role === Role.CLIENT_SUPER_ADMIN;
    const isHrAdmin = currentUser.role === Role.HR_ADMIN;
    const isReportingManager =
      currentUser.role === Role.MANAGER &&
      currentUser.employeeId != null &&
      exitRequest.employee.reportingManagerId === currentUser.employeeId;

    if (!isSuperAdmin && !isHrAdmin && !isReportingManager) {
      throw new ForbiddenException(
        'Only the direct reporting manager, HR Admin, or Client Super Admin can action this resignation',
      );
    }

    const now = new Date();
    const approvedLwd = dto.approvedLastWorkingDay
      ? new Date(dto.approvedLastWorkingDay)
      : (exitRequest.approvedLastWorkingDay ?? exitRequest.proposedLastWorkingDay);

    return this.prisma.$transaction(async (tx) => {
      let updateData: Prisma.ExitRequestUpdateInput = {};

      if (dto.decision === ApprovalStatus.REJECTED) {
        if (isReportingManager) {
          updateData = {
            managerApprovalStatus: ApprovalStatus.REJECTED,
            managerComments: dto.comments,
            managerApprovedAt: now,
            status: ExitStatus.REJECTED,
          };
        } else {
          updateData = {
            hrApprovalStatus: ApprovalStatus.REJECTED,
            hrComments: dto.comments,
            hrApprovedAt: now,
            status: ExitStatus.REJECTED,
          };
        }

        return tx.exitRequest.update({
          where: { id: requestId },
          data: updateData,
          include: { employee: true, clearanceTasks: true },
        });
      }

      // Decision is APPROVED
      if (isReportingManager) {
        updateData.managerApprovalStatus = ApprovalStatus.APPROVED;
        updateData.managerComments = dto.comments;
        updateData.managerApprovedAt = now;
      }

      if (isHrAdmin || isSuperAdmin) {
        updateData.hrApprovalStatus = ApprovalStatus.APPROVED;
        updateData.hrComments = dto.comments;
        updateData.hrApprovedAt = now;
        updateData.approvedLastWorkingDay = approvedLwd;
        updateData.status = ExitStatus.CLEARANCE_IN_PROGRESS;

        // Transition Employee to NOTICE_PERIOD
        await tx.employee.update({
          where: { id: exitRequest.employeeId },
          data: { employmentStatus: EmploymentStatus.NOTICE_PERIOD },
        });

        // Seed clearance tasks if not already created
        await this.seedClearanceTasks(organizationId, requestId, tx);
      } else {
        // Manager approved, still awaiting HR final approval
        updateData.status = ExitStatus.APPROVED;
        if (!exitRequest.approvedLastWorkingDay) {
          updateData.approvedLastWorkingDay = approvedLwd;
        }
      }

      return tx.exitRequest.update({
        where: { id: requestId },
        data: updateData,
        include: {
          employee: true,
          clearanceTasks: true,
        },
      });
    });
  }

  /**
   * Helper: Seeds standard multi-department clearance tasks for an exit request
   */
  private async seedClearanceTasks(
    organizationId: string,
    exitRequestId: string,
    tx: Prisma.TransactionClient,
  ) {
    const existing = await tx.exitClearanceTask.count({
      where: { organizationId, exitRequestId },
    });
    if (existing > 0) return;

    const standardTasks = [
      {
        departmentType: ExitClearanceDepartment.IT,
        title: 'Hardware Return (Laptop & Peripherals)',
        description: 'Collect company laptop, charger, monitors, and security tokens.',
        isMandatory: true,
      },
      {
        departmentType: ExitClearanceDepartment.IT,
        title: 'Revoke Cloud, SSO & Email Access',
        description: 'Deprovision Google Workspace / Microsoft 365, VPN, AWS/GCP, and Github accounts.',
        isMandatory: true,
      },
      {
        departmentType: ExitClearanceDepartment.FINANCE,
        title: 'Travel Advance & Pending Claims Settlement',
        description: 'Verify zero outstanding travel advances and process pending reimbursement vouchers.',
        isMandatory: true,
      },
      {
        departmentType: ExitClearanceDepartment.FINANCE,
        title: 'Corporate Credit Card Cancellation',
        description: 'Ensure corporate credit card is surrendered and cancelled.',
        isMandatory: false,
      },
      {
        departmentType: ExitClearanceDepartment.ADMIN,
        title: 'Building Access Card & Locker Key Surrender',
        description: 'Collect physical entry pass, smart card, and desk/locker keys.',
        isMandatory: true,
      },
      {
        departmentType: ExitClearanceDepartment.MANAGER,
        title: 'Knowledge Transfer & Codebase Handover',
        description: 'Complete KT sessions, transfer repository admin rights, and review handover document.',
        isMandatory: true,
      },
      {
        departmentType: ExitClearanceDepartment.HR,
        title: 'Exit Interview & Document Handover',
        description: 'Conduct confidential exit interview and provide service certificate/relieving guidance.',
        isMandatory: true,
      },
    ];

    await tx.exitClearanceTask.createMany({
      data: standardTasks.map((t) => ({
        organizationId,
        exitRequestId,
        departmentType: t.departmentType,
        title: t.title,
        description: t.description,
        isMandatory: t.isMandatory,
        status: ClearanceStatus.PENDING,
      })),
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Department Clearance Checklists
  // ---------------------------------------------------------------------------

  /**
   * Update clearance task status (CLEARED, WAIVED, REJECTED).
   */
  async updateClearanceTask(
    organizationId: string,
    taskId: string,
    dto: UpdateClearanceTaskDto,
    currentUser: AuthenticatedUser,
  ) {
    const task = await this.prisma.exitClearanceTask.findFirst({
      where: { id: taskId, organizationId },
      include: { exitRequest: true },
    });

    if (!task) {
      throw new NotFoundException(`Clearance task '${taskId}' not found`);
    }

    const updatedTask = await this.prisma.exitClearanceTask.update({
      where: { id: taskId },
      data: {
        status: dto.status,
        remarks: dto.remarks,
        clearedByUserId: currentUser.id,
        clearedAt: new Date(),
      },
    });

    // Check if all mandatory tasks are now CLEARED or WAIVED
    const remainingMandatory = await this.prisma.exitClearanceTask.count({
      where: {
        organizationId,
        exitRequestId: task.exitRequestId,
        isMandatory: true,
        status: { in: [ClearanceStatus.PENDING, ClearanceStatus.REJECTED] },
      },
    });

    if (remainingMandatory === 0) {
      // Advance exit request to SETTLEMENT_PENDING if currently in CLEARANCE_IN_PROGRESS
      await this.prisma.exitRequest.updateMany({
        where: {
          id: task.exitRequestId,
          organizationId,
          status: ExitStatus.CLEARANCE_IN_PROGRESS,
        },
        data: { status: ExitStatus.SETTLEMENT_PENDING },
      });
    }

    return updatedTask;
  }

  // ---------------------------------------------------------------------------
  // 4. Confidential Exit Interview
  // ---------------------------------------------------------------------------

  /**
   * Submit confidential exit interview feedback and ratings.
   */
  async submitExitInterview(
    organizationId: string,
    requestId: string,
    dto: SubmitExitInterviewDto,
    currentUser: AuthenticatedUser,
  ) {
    const exitRequest = await this.prisma.exitRequest.findFirst({
      where: { id: requestId, organizationId },
    });

    if (!exitRequest) {
      throw new NotFoundException(`Exit request '${requestId}' not found`);
    }

    // Must be either the exiting employee or an HR administrator
    if (
      currentUser.role === Role.EMPLOYEE &&
      currentUser.employeeId !== exitRequest.employeeId
    ) {
      throw new ForbiddenException('You can only submit an exit interview for your own exit request');
    }

    return this.prisma.exitInterview.upsert({
      where: { exitRequestId: requestId },
      update: {
        reasonCategory: dto.reasonCategory,
        companyCultureRating: dto.companyCultureRating,
        managementRating: dto.managementRating,
        workLifeBalanceRating: dto.workLifeBalanceRating,
        compensationRating: dto.compensationRating,
        wouldRecommendCompany: dto.wouldRecommendCompany,
        feedback: dto.feedback,
        submittedAt: new Date(),
      },
      create: {
        organizationId,
        exitRequestId: requestId,
        reasonCategory: dto.reasonCategory,
        companyCultureRating: dto.companyCultureRating,
        managementRating: dto.managementRating,
        workLifeBalanceRating: dto.workLifeBalanceRating,
        compensationRating: dto.compensationRating,
        wouldRecommendCompany: dto.wouldRecommendCompany,
        feedback: dto.feedback,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Full and Final (FnF) Settlement Calculation Engine
  // ---------------------------------------------------------------------------

  /**
   * Calculates or recalculates the statutory Full & Final (FnF) settlement.
   * Integrates with Attendance, Leaves, and Payroll configuration.
   */
  async calculateFnFSettlement(
    organizationId: string,
    requestId: string,
    dto: CalculateFnFDto = {},
  ) {
    const exitRequest = await this.prisma.exitRequest.findFirst({
      where: { id: requestId, organizationId },
      include: { employee: true },
    });

    if (!exitRequest) {
      throw new NotFoundException(`Exit request '${requestId}' not found`);
    }

    const employee = exitRequest.employee;
    const lastWorkingDay =
      exitRequest.approvedLastWorkingDay ?? exitRequest.proposedLastWorkingDay;

    // 1. Fetch active Salary Structure
    const salaryStructure = await this.prisma.salaryStructure.findFirst({
      where: {
        organizationId,
        employeeId: employee.id,
        effectiveTo: null,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!salaryStructure) {
      throw new BadRequestException(
        `Employee '${employee.employeeCode}' does not have an active salary structure to calculate FnF`,
      );
    }

    // 2. Fetch tenant payroll configuration
    const config = await this.payrollService.getConfiguration(organizationId);

    // 3. Calculate final month payable days
    const exitYear = lastWorkingDay.getUTCFullYear();
    const exitMonth = lastWorkingDay.getUTCMonth() + 1;
    const totalMonthDays = new Date(Date.UTC(exitYear, exitMonth, 0)).getUTCDate();
    const lwdDay = lastWorkingDay.getUTCDate();

    // Pull finalized payable days from AttendanceService
    const attendance = await this.attendanceService.getFinalizedPayableDays(
      organizationId,
      employee.id,
      exitYear,
      exitMonth,
    );

    // Net payable days in final month capped at LWD day
    const payableDays = Math.min(Number(attendance.payableDays), lwdDay);
    const payableRatio = totalMonthDays > 0 ? payableDays / totalMonthDays : 0;

    const nominalBasic = Number(salaryStructure.basicSalary);
    const nominalHra = Number(salaryStructure.hra);
    const nominalSpecialAllowance = Number(salaryStructure.specialAllowance);
    const nominalGross = Number(salaryStructure.monthlyGross);

    // Earned salary components
    const earnedBasic = Number((nominalBasic * payableRatio).toFixed(2));
    const earnedHra = Number((nominalHra * payableRatio).toFixed(2));
    const earnedSpecialAllowance = Number(
      (nominalSpecialAllowance * payableRatio).toFixed(2),
    );
    const earnedGross = Number(
      (earnedBasic + earnedHra + earnedSpecialAllowance).toFixed(2),
    );

    // 4. Leave Encashment Calculation
    const leaveBalancesData = await this.leaveService.getEmployeeLeaveBalances(
      organizationId,
      employee.id,
    );

    // Sum encashable paid leave balance
    const encashableLeaveDays = leaveBalancesData.balances
      .filter((b) => b.isPaid)
      .reduce((sum, b) => sum + Math.max(Number(b.availableBalance), 0), 0);

    const dailyBasicRate = Number((nominalBasic / 30).toFixed(2));
    const leaveEncashmentAmount = Number(
      (encashableLeaveDays * dailyBasicRate).toFixed(2),
    );

    // 5. Notice Period Shortfall Deduction
    const resignationDate = exitRequest.resignationDate;
    const daysServed = Math.max(
      0,
      Math.floor(
        (lastWorkingDay.getTime() - resignationDate.getTime()) / (1000 * 3600 * 24),
      ),
    );
    const noticeShortfallDays = Math.max(0, exitRequest.noticePeriodDays - daysServed);
    const dailyGrossRate = Number((nominalGross / 30).toFixed(2));
    const noticeDeductionAmount = Number(
      (noticeShortfallDays * dailyGrossRate).toFixed(2),
    );

    // 6. Statutory Deductions (EPF & PT)
    const pfCeiling = Number(config.pfCeilingAmount);
    const pfBasis = config.applyPfCeiling
      ? Math.min(earnedBasic, pfCeiling)
      : earnedBasic;
    const employeePfRate = Number(config.pfEmployeeRate) / 100;
    const employeePf = Number((pfBasis * employeePfRate).toFixed(2));

    const ptThreshold = Number(config.ptSalaryThreshold);
    const professionalTax =
      earnedGross >= ptThreshold ? Number(config.ptAmount) : 0.0;

    // 7. Additions & Deductions
    const gratuityAmount = Number((dto.gratuityAmount ?? 0).toFixed(2));
    const bonusAmount = Number((dto.bonusAmount ?? 0).toFixed(2));
    const totalAdditions = Number(
      (earnedGross + leaveEncashmentAmount + gratuityAmount + bonusAmount).toFixed(2),
    );

    const otherDeductions = Number((dto.otherDeductions ?? 0).toFixed(2));
    const totalDeductions = Number(
      (
        noticeDeductionAmount +
        employeePf +
        professionalTax +
        otherDeductions
      ).toFixed(2),
    );

    let netSettlementAmount = Number(
      (totalAdditions - totalDeductions).toFixed(2),
    );
    if (config.roundToWholeRupee) {
      netSettlementAmount = Math.round(netSettlementAmount);
    }

    // Upsert FnFSettlement record
    return this.prisma.fnFSettlement.upsert({
      where: { exitRequestId: requestId },
      update: {
        lastWorkingDay,
        payableDays: new Prisma.Decimal(payableDays),
        earnedBasic: new Prisma.Decimal(earnedBasic),
        earnedHra: new Prisma.Decimal(earnedHra),
        earnedSpecialAllowance: new Prisma.Decimal(earnedSpecialAllowance),
        earnedGross: new Prisma.Decimal(earnedGross),
        encashableLeaveDays: new Prisma.Decimal(encashableLeaveDays),
        dailyBasicRate: new Prisma.Decimal(dailyBasicRate),
        leaveEncashmentAmount: new Prisma.Decimal(leaveEncashmentAmount),
        gratuityAmount: new Prisma.Decimal(gratuityAmount),
        bonusAmount: new Prisma.Decimal(bonusAmount),
        totalAdditions: new Prisma.Decimal(totalAdditions),
        noticeShortfallDays,
        noticeDeductionAmount: new Prisma.Decimal(noticeDeductionAmount),
        employeePf: new Prisma.Decimal(employeePf),
        professionalTax: new Prisma.Decimal(professionalTax),
        otherDeductions: new Prisma.Decimal(otherDeductions),
        otherDeductionsRemarks: dto.otherDeductionsRemarks,
        totalDeductions: new Prisma.Decimal(totalDeductions),
        netSettlementAmount: new Prisma.Decimal(netSettlementAmount),
        remarks: dto.remarks,
        status: FnFStatus.DRAFT,
      },
      create: {
        organizationId,
        exitRequestId: requestId,
        employeeId: employee.id,
        lastWorkingDay,
        payableDays: new Prisma.Decimal(payableDays),
        earnedBasic: new Prisma.Decimal(earnedBasic),
        earnedHra: new Prisma.Decimal(earnedHra),
        earnedSpecialAllowance: new Prisma.Decimal(earnedSpecialAllowance),
        earnedGross: new Prisma.Decimal(earnedGross),
        encashableLeaveDays: new Prisma.Decimal(encashableLeaveDays),
        dailyBasicRate: new Prisma.Decimal(dailyBasicRate),
        leaveEncashmentAmount: new Prisma.Decimal(leaveEncashmentAmount),
        gratuityAmount: new Prisma.Decimal(gratuityAmount),
        bonusAmount: new Prisma.Decimal(bonusAmount),
        totalAdditions: new Prisma.Decimal(totalAdditions),
        noticeShortfallDays,
        noticeDeductionAmount: new Prisma.Decimal(noticeDeductionAmount),
        employeePf: new Prisma.Decimal(employeePf),
        professionalTax: new Prisma.Decimal(professionalTax),
        otherDeductions: new Prisma.Decimal(otherDeductions),
        otherDeductionsRemarks: dto.otherDeductionsRemarks,
        totalDeductions: new Prisma.Decimal(totalDeductions),
        netSettlementAmount: new Prisma.Decimal(netSettlementAmount),
        remarks: dto.remarks,
        status: FnFStatus.DRAFT,
      },
    });
  }

  /**
   * Approve FnF Settlement (FINANCE, CLIENT_SUPER_ADMIN, or HR_ADMIN).
   */
  async approveFnFSettlement(
    organizationId: string,
    requestId: string,
    currentUser: AuthenticatedUser,
  ) {
    const fnf = await this.prisma.fnFSettlement.findFirst({
      where: { exitRequestId: requestId, organizationId },
    });

    if (!fnf) {
      throw new NotFoundException(`FnF settlement for exit request '${requestId}' not found`);
    }

    return this.prisma.fnFSettlement.update({
      where: { id: fnf.id },
      data: {
        status: FnFStatus.APPROVED,
        approvedByUserId: currentUser.id,
        approvedAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Atomic Exit Finalization & Soft Deletion
  // ---------------------------------------------------------------------------

  /**
   * Atomically finalizes the employee's departure:
   * 1. Checks that all mandatory clearance tasks are CLEARED or WAIVED.
   * 2. Checks that FnF settlement is APPROVED.
   * 3. Sets Employee.employmentStatus = RESIGNED, sets dateOfExit, soft-deletes Employee.
   * 4. Deactivates linked User login account (isActive: false).
   * 5. Closes active row in EmployeeJobHistory.
   * 6. Marks ExitRequest and FnFSettlement as COMPLETED / PROCESSED.
   */
  async finalizeExit(
    organizationId: string,
    requestId: string,
    currentUser: AuthenticatedUser,
  ) {
    const exitRequest = await this.prisma.exitRequest.findFirst({
      where: { id: requestId, organizationId },
      include: {
        employee: true,
        clearanceTasks: true,
        fnfSettlement: true,
      },
    });

    if (!exitRequest) {
      throw new NotFoundException(`Exit request '${requestId}' not found`);
    }

    if (exitRequest.status === ExitStatus.COMPLETED) {
      throw new BadRequestException('Exit request has already been finalized and completed');
    }

    // Guardrail 1: Check mandatory clearance tasks
    const pendingMandatory = exitRequest.clearanceTasks.filter(
      (t) =>
        t.isMandatory &&
        t.status !== ClearanceStatus.CLEARED &&
        t.status !== ClearanceStatus.WAIVED,
    );

    if (pendingMandatory.length > 0) {
      throw new BadRequestException(
        `Cannot finalize exit: ${pendingMandatory.length} mandatory clearance tasks are still pending or rejected (${pendingMandatory.map((t) => t.title).join(', ')})`,
      );
    }

    // Guardrail 2: Check FnF settlement
    if (!exitRequest.fnfSettlement) {
      throw new BadRequestException(
        'Cannot finalize exit: FnF settlement has not been calculated yet',
      );
    }

    if (exitRequest.fnfSettlement.status === FnFStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot finalize exit: FnF settlement must be approved before final exit execution',
      );
    }

    const now = new Date();
    const approvedLwd =
      exitRequest.approvedLastWorkingDay ?? exitRequest.proposedLastWorkingDay;

    const finalStatus =
      exitRequest.exitType === ExitType.TERMINATION
        ? EmploymentStatus.TERMINATED
        : EmploymentStatus.RESIGNED;

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Employee: set employmentStatus, dateOfExit, and soft-delete
      const updatedEmployee = await tx.employee.update({
        where: { id: exitRequest.employeeId },
        data: {
          employmentStatus: finalStatus,
          dateOfExit: approvedLwd,
          deletedAt: now,
        },
      });

      // 2. Deactivate linked User login accounts
      await tx.user.updateMany({
        where: { organizationId, employeeId: exitRequest.employeeId },
        data: { isActive: false },
      });

      // 3. Close active job history ledger
      await tx.employeeJobHistory.updateMany({
        where: {
          organizationId,
          employeeId: exitRequest.employeeId,
          effectiveTo: null,
        },
        data: {
          effectiveTo: now,
          reason: `Exit Finalized: ${exitRequest.exitType}`,
          changedByUserId: currentUser.id,
        },
      });

      // 4. Update ExitRequest to COMPLETED
      const completedRequest = await tx.exitRequest.update({
        where: { id: requestId },
        data: {
          status: ExitStatus.COMPLETED,
          finalizedAt: now,
          finalizedByUserId: currentUser.id,
        },
      });

      // 5. Update FnF settlement to PROCESSED
      await tx.fnFSettlement.update({
        where: { id: exitRequest.fnfSettlement!.id },
        data: {
          status: FnFStatus.PROCESSED,
          processedByUserId: currentUser.id,
          processedAt: now,
        },
      });

      return {
        message: `Employee ${updatedEmployee.employeeCode} (${updatedEmployee.firstName} ${updatedEmployee.lastName}) exit finalized successfully`,
        exitRequestId: completedRequest.id,
        employeeId: updatedEmployee.id,
        status: completedRequest.status,
        finalizedAt: now,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Queries & Detail Lookups
  // ---------------------------------------------------------------------------

  /**
   * List exit requests with filtering & pagination.
   */
  async listExitRequests(
    organizationId: string,
    query: QueryExitRequestsDto,
    currentUser: AuthenticatedUser,
  ) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ExitRequestWhereInput = {
      organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.departmentId) {
      where.employee = { departmentId: query.departmentId };
    }

    // Role-based visibility scoping
    if (currentUser.role === Role.EMPLOYEE) {
      where.employeeId = currentUser.employeeId ?? undefined;
    } else if (currentUser.role === Role.MANAGER && currentUser.employeeId) {
      where.OR = [
        { employeeId: currentUser.employeeId },
        { employee: { reportingManagerId: currentUser.employeeId } },
      ];
    }

    if (query.search) {
      const search = query.search.trim();
      where.employee = {
        ...(where.employee as Prisma.EmployeeWhereInput),
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.exitRequest.count({ where }),
      this.prisma.exitRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              personalEmail: true,
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, name: true } },
              reportingManager: {
                select: { id: true, employeeCode: true, firstName: true, lastName: true },
              },
            },
          },
          clearanceTasks: true,
          fnfSettlement: true,
          exitInterview: true,
        },
      }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single exit request details.
   */
  async getExitRequestById(
    organizationId: string,
    requestId: string,
    currentUser: AuthenticatedUser,
  ) {
    const exitRequest = await this.prisma.exitRequest.findFirst({
      where: { id: requestId, organizationId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            personalEmail: true,
            phone: true,
            dateOfJoining: true,
            employmentStatus: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
            reportingManager: {
              select: { id: true, employeeCode: true, firstName: true, lastName: true },
            },
          },
        },
        clearanceTasks: {
          orderBy: { createdAt: 'asc' },
        },
        exitInterview: true,
        fnfSettlement: true,
      },
    });

    if (!exitRequest) {
      throw new NotFoundException(`Exit request '${requestId}' not found`);
    }

    // Visibility guard
    if (
      currentUser.role === Role.EMPLOYEE &&
      currentUser.employeeId !== exitRequest.employeeId
    ) {
      throw new ForbiddenException('Access denied to other employees exit requests');
    }

    return exitRequest;
  }
}
