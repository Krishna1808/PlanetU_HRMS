import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import {
  AttendanceStatus,
  DayOfWeek,
  LeaveRequestStatus,
  LeaveTransactionType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShiftService } from '../shifts/shift.service';
import { NotificationEventBusService } from '../notifications/notification-event-bus.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ActionLeaveDto } from './dto/action-leave.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { AllocateDepartmentLeavesDto } from './dto/allocate-department-leaves.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftService: ShiftService,
    @Optional() private readonly eventBus?: NotificationEventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helper: Shift-Aware Working Days Calculation
  // ---------------------------------------------------------------------------

  /**
   * Calculates actual working days in a date range by checking the employee's
   * shift assignment and excluding non-working weekly offs (e.g. Saturdays & Sundays).
   */
  async calculateWorkingDays(
    organizationId: string,
    employeeId: string,
    startDate: Date,
    endDate: Date,
    isHalfDay = false,
  ): Promise<{
    workingDays: number;
    nonWorkingDays: number;
    details: Array<{ date: string; dayOfWeek: DayOfWeek; isWorkingDay: boolean; reason?: string }>;
  }> {
    if (startDate > endDate) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const dayOfWeekMap: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];

    if (isHalfDay) {
      // Half-day leave must fall on a single day
      const isSameDay =
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate();

      if (!isSameDay) {
        throw new BadRequestException(
          'Half-day leave must start and end on the same calendar date',
        );
      }

      // Check if this single date is a working day
      const shiftInfo = await this.shiftService.getEmployeeShiftForDate(
        organizationId,
        employeeId,
        startDate,
      );

      const dayEnum = dayOfWeekMap[startDate.getDay()];
      const isWeeklyOff = shiftInfo.weeklyOffDays.includes(dayEnum);

      if (isWeeklyOff) {
        throw new BadRequestException(
          `Cannot apply for half-day leave on a designated weekly off day (${dayEnum})`,
        );
      }

      return {
        workingDays: 0.5,
        nonWorkingDays: 0,
        details: [
          {
            date: startDate.toISOString().split('T')[0],
            dayOfWeek: dayEnum,
            isWorkingDay: true,
          },
        ],
      };
    }

    // Multi-day calculation: iterate day by day
    let workingDays = 0;
    let nonWorkingDays = 0;
    const details: Array<{
      date: string;
      dayOfWeek: DayOfWeek;
      isWorkingDay: boolean;
      reason?: string;
    }> = [];

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      const dayEnum = dayOfWeekMap[current.getDay()];
      const shiftInfo = await this.shiftService.getEmployeeShiftForDate(
        organizationId,
        employeeId,
        current,
      );

      const isWeeklyOff = shiftInfo.weeklyOffDays.includes(dayEnum);
      const dateStr = current.toISOString().split('T')[0];

      if (isWeeklyOff) {
        nonWorkingDays += 1;
        details.push({
          date: dateStr,
          dayOfWeek: dayEnum,
          isWorkingDay: false,
          reason: 'Weekly Off',
        });
      } else {
        workingDays += 1;
        details.push({
          date: dateStr,
          dayOfWeek: dayEnum,
          isWorkingDay: true,
        });
      }

      // Move to next calendar day
      current.setDate(current.getDate() + 1);
    }

    return {
      workingDays,
      nonWorkingDays,
      details,
    };
  }

  // ---------------------------------------------------------------------------
  // Leave Type Management (Master Configuration)
  // ---------------------------------------------------------------------------

  async createLeaveType(organizationId: string, dto: CreateLeaveTypeDto) {
    const normalizedCode = dto.code.trim().toUpperCase();

    // Check code uniqueness within tenant
    const existingCode = await this.prisma.leaveType.findFirst({
      where: { organizationId, code: normalizedCode },
    });
    if (existingCode) {
      throw new ConflictException(
        `Leave type with code '${normalizedCode}' already exists for this organization`,
      );
    }

    // Check name uniqueness within tenant
    const existingName = await this.prisma.leaveType.findFirst({
      where: {
        organizationId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });
    if (existingName) {
      throw new ConflictException(
        `Leave type with name '${dto.name}' already exists for this organization`,
      );
    }

    return this.prisma.leaveType.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        code: normalizedCode,
        description: dto.description?.trim(),
        isPaid: dto.isPaid ?? true,
        daysAllowedPerYear: dto.daysAllowedPerYear ?? 0,
        accrualFrequency: dto.accrualFrequency,
        carryForwardLimit: dto.carryForwardLimit ?? 0,
        requiresApproval: dto.requiresApproval ?? true,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listLeaveTypes(organizationId: string, includeInactive = false) {
    return this.prisma.leaveType.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isPaid: 'desc' }, { name: 'asc' }],
    });
  }

  async getLeaveTypeById(organizationId: string, id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id, organizationId },
    });

    if (!leaveType) {
      throw new NotFoundException(`Leave type with ID '${id}' not found`);
    }

    return leaveType;
  }

  async updateLeaveType(
    organizationId: string,
    id: string,
    dto: UpdateLeaveTypeDto,
  ) {
    const existing = await this.getLeaveTypeById(organizationId, id);

    const normalizedCode = dto.code ? dto.code.trim().toUpperCase() : undefined;
    if (normalizedCode && normalizedCode !== existing.code) {
      const conflict = await this.prisma.leaveType.findFirst({
        where: { organizationId, code: normalizedCode, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(
          `Leave type with code '${normalizedCode}' already exists for this organization`,
        );
      }
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const conflict = await this.prisma.leaveType.findFirst({
        where: {
          organizationId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Leave type with name '${dto.name}' already exists for this organization`,
        );
      }
    }

    return this.prisma.leaveType.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(normalizedCode ? { code: normalizedCode } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
        ...(dto.daysAllowedPerYear !== undefined
          ? { daysAllowedPerYear: dto.daysAllowedPerYear }
          : {}),
        ...(dto.accrualFrequency ? { accrualFrequency: dto.accrualFrequency } : {}),
        ...(dto.carryForwardLimit !== undefined
          ? { carryForwardLimit: dto.carryForwardLimit }
          : {}),
        ...(dto.requiresApproval !== undefined
          ? { requiresApproval: dto.requiresApproval }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deactivateLeaveType(organizationId: string, id: string) {
    await this.getLeaveTypeById(organizationId, id);
    return this.prisma.leaveType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------------------------------------------------------------
  // Append-Only Leave Balance Ledger (Architecture Rule #4)
  // ---------------------------------------------------------------------------

  /**
   * Retrieves live leave balances for an employee.
   * Balances are dynamically calculated from the append-only ledger (SUM of transaction days),
   * never mutated in place.
   */
  async getEmployeeLeaveBalances(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${employeeId}' not found`);
    }

    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });

    const balances = await Promise.all(
      leaveTypes.map(async (lt) => {
        // 1. Current balance from ledger (sum of credits and debits)
        const aggregate = await this.prisma.leaveTransaction.aggregate({
          where: {
            organizationId,
            employeeId,
            leaveTypeId: lt.id,
          },
          _sum: { days: true },
        });

        const balance = aggregate._sum.days ? Number(aggregate._sum.days) : 0;

        // 2. Pending applications currently awaiting approval
        const pendingAggregate = await this.prisma.leaveRequest.aggregate({
          where: {
            organizationId,
            employeeId,
            leaveTypeId: lt.id,
            status: LeaveRequestStatus.PENDING,
          },
          _sum: { totalDays: true },
        });

        const pendingDays = pendingAggregate._sum.totalDays
          ? Number(pendingAggregate._sum.totalDays)
          : 0;

        return {
          leaveTypeId: lt.id,
          leaveTypeName: lt.name,
          leaveTypeCode: lt.code,
          isPaid: lt.isPaid,
          daysAllowedPerYear: Number(lt.daysAllowedPerYear),
          currentBalance: balance,
          pendingDays,
          availableBalance: balance - pendingDays,
        };
      }),
    );

    return {
      employee,
      balances,
    };
  }

  /**
   * Manual credit/debit adjustment into the append-only ledger by HR/Admin.
   */
  async adjustBalance(
    organizationId: string,
    dto: AdjustBalanceDto,
    actingUserId?: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException(`Employee with ID '${dto.employeeId}' not found`);
    }

    const leaveType = await this.getLeaveTypeById(organizationId, dto.leaveTypeId);

    return this.prisma.$transaction(async (tx) => {
      // Find latest balance snapshot
      const latestTx = await tx.leaveTransaction.findFirst({
        where: {
          organizationId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
        },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = latestTx ? Number(latestTx.balanceAfter) : 0;
      const newBalance = currentBalance + dto.days;

      const transactionType =
        dto.days > 0
          ? LeaveTransactionType.CREDIT_ADJUSTMENT
          : LeaveTransactionType.DEBIT_ADJUSTMENT;

      const transaction = await tx.leaveTransaction.create({
        data: {
          organizationId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          transactionType,
          days: dto.days,
          balanceAfter: newBalance,
          effectiveDate: new Date(),
          notes: dto.reason + (dto.notes ? ` - ${dto.notes}` : ''),
          createdByUserId: actingUserId,
        },
      });

      return {
        success: true,
        transaction,
        leaveType: leaveType.name,
        previousBalance: currentBalance,
        newBalance,
      };
    });
  }

  /**
   * Bulk allocate or adjust leave balances for all active employees in a department (HR/Admin).
   */
  async allocateDepartmentLeaves(
    organizationId: string,
    dto: AllocateDepartmentLeavesDto,
    actingUserId?: string,
  ) {
    const dept = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, organizationId },
    });
    if (!dept) {
      throw new NotFoundException('Department not found in this organization');
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        departmentId: dto.departmentId,
        organizationId,
        deletedAt: null,
        employmentStatus: 'ACTIVE',
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });

    if (employees.length === 0) {
      throw new BadRequestException(`No active employees found in department '${dept.name}'`);
    }

    const transactions = [];
    for (const emp of employees) {
      const tx = await this.adjustBalance(
        organizationId,
        {
          employeeId: emp.id,
          leaveTypeId: dto.leaveTypeId,
          days: dto.days,
          reason: `${dto.reason} [Department Allocation: ${dept.name}]`,
        },
        actingUserId,
      );
      transactions.push(tx);
    }

    return {
      success: true,
      departmentId: dept.id,
      departmentName: dept.name,
      allocatedCount: employees.length,
      employees: employees.map((e) => `${e.employeeCode} - ${e.firstName} ${e.lastName}`),
      daysPerEmployee: dto.days,
      transactions,
    };
  }

  // ---------------------------------------------------------------------------
  // Leave Applications & Approval Workflow
  // ---------------------------------------------------------------------------

  /**
   * Submit a new leave request.
   * Excludes shift weekly offs from totalDays, validates balance sufficiency, and prevents date collisions.
   */
  async applyLeave(
    organizationId: string,
    dto: ApplyLeaveDto,
    currentUser: AuthenticatedUser,
  ) {
    // Determine target employee: either specified by HR/Admin, or defaults to current user's employeeId
    let employeeId = dto.employeeId;
    if (!employeeId) {
      if (!currentUser.employeeId) {
        throw new BadRequestException(
          'No employeeId provided and current user account is not linked to an employee record',
        );
      }
      employeeId = currentUser.employeeId;
    } else if (
      currentUser.role === Role.EMPLOYEE &&
      currentUser.employeeId !== employeeId
    ) {
      throw new ForbiddenException(
        'Employees can only submit leave applications for themselves',
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException(`Employee with ID '${employeeId}' not found`);
    }

    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, organizationId, isActive: true },
    });
    if (!leaveType) {
      throw new NotFoundException(
        `Active leave type with ID '${dto.leaveTypeId}' not found`,
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format for startDate or endDate');
    }

    // 1. Calculate shift-aware working days (skipping weekly offs)
    const { workingDays, nonWorkingDays } = await this.calculateWorkingDays(
      organizationId,
      employeeId,
      startDate,
      endDate,
      dto.isHalfDay,
    );

    if (workingDays === 0) {
      throw new BadRequestException(
        `Selected date range contains 0 working days (${nonWorkingDays} weekly off days). No leave deduction required.`,
      );
    }

    // 2. Prevent overlapping pending or approved requests
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        organizationId,
        employeeId,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `You already have an existing ${overlapping.status.toLowerCase()} leave request overlapping with this date range`,
      );
    }

    // 3. Balance sufficiency guard for paid leaves
    if (leaveType.isPaid) {
      const balanceData = await this.getEmployeeLeaveBalances(
        organizationId,
        employeeId,
      );
      const targetBalance = balanceData.balances.find(
        (b) => b.leaveTypeId === leaveType.id,
      );

      const available = targetBalance ? targetBalance.availableBalance : 0;
      if (workingDays > available) {
        throw new BadRequestException(
          `Insufficient leave balance for '${leaveType.name}'. Requested: ${workingDays} days, Available: ${available} days`,
        );
      }
    }

    // 4. Create the leave application
    return this.prisma.leaveRequest.create({
      data: {
        organizationId,
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        isHalfDay: dto.isHalfDay ?? false,
        halfDaySession: dto.halfDaySession,
        totalDays: workingDays,
        reason: dto.reason.trim(),
        status: LeaveRequestStatus.PENDING,
      },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
    });
  }

  /**
   * Action a pending leave request (Approve or Reject).
   * Authorized for HR_ADMIN, CLIENT_SUPER_ADMIN, or the employee's direct reporting manager.
   * If approved: atomically updates request status and writes a debit row into the append-only ledger.
   */
  async actionLeave(
    organizationId: string,
    requestId: string,
    dto: ActionLeaveDto,
    currentUser: AuthenticatedUser,
  ) {
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, organizationId },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            reportingManagerId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request with ID '${requestId}' not found`);
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(
        `Leave request has already been actioned (Current status: ${leaveRequest.status})`,
      );
    }

    // Permission check: Must be HR, Super Admin, or direct reporting manager
    const isSuperAdmin = currentUser.role === Role.CLIENT_SUPER_ADMIN;
    const isHrAdmin = currentUser.role === Role.HR_ADMIN;
    const isManager =
      currentUser.role === Role.MANAGER &&
      currentUser.employeeId &&
      leaveRequest.employee.reportingManagerId === currentUser.employeeId;

    if (!isSuperAdmin && !isHrAdmin && !isManager) {
      throw new ForbiddenException(
        'You are not authorized to approve or reject this leave request',
      );
    }

    // 1. Handling Rejection
    if (dto.status === LeaveRequestStatus.REJECTED) {
      const rejected = await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: LeaveRequestStatus.REJECTED,
          actionedByUserId: currentUser.id,
          actionedAt: new Date(),
          rejectionReason: dto.rejectionReason?.trim() ?? 'Rejected by manager/HR',
        },
        include: { leaveType: true },
      });

      if (this.eventBus) {
        try {
          const empUser = await this.prisma.user.findFirst({
            where: { employeeId: leaveRequest.employeeId, organizationId },
            select: { id: true },
          });
          if (empUser) {
            this.eventBus.emitLeaveStatus({
              organizationId,
              recipientUserId: empUser.id,
              leaveRequestId: leaveRequest.id,
              status: LeaveRequestStatus.REJECTED,
              leaveTypeName: leaveRequest.leaveType.name,
              startDate: leaveRequest.startDate.toISOString().split('T')[0],
              endDate: leaveRequest.endDate.toISOString().split('T')[0],
            });
          }
        } catch {
          // ignore notification errors
        }
      }

      return rejected;
    }

    // 2. Handling Approval (Atomic transaction with append-only ledger debit)
    const result = await this.prisma.$transaction(async (tx) => {
      // Double-check balance if paid leave
      if (leaveRequest.leaveType.isPaid) {
        const aggregate = await tx.leaveTransaction.aggregate({
          where: {
            organizationId,
            employeeId: leaveRequest.employeeId,
            leaveTypeId: leaveRequest.leaveTypeId,
          },
          _sum: { days: true },
        });
        const currentBalance = aggregate._sum.days
          ? Number(aggregate._sum.days)
          : 0;

        if (Number(leaveRequest.totalDays) > currentBalance) {
          throw new BadRequestException(
            `Cannot approve request. Employee balance is insufficient (${currentBalance} days available, request requires ${leaveRequest.totalDays} days)`,
          );
        }
      }

      // Update request status
      const updatedRequest = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: LeaveRequestStatus.APPROVED,
          actionedByUserId: currentUser.id,
          actionedAt: new Date(),
        },
        include: { leaveType: true },
      });

      // Calculate running balance snapshot
      const latestTx = await tx.leaveTransaction.findFirst({
        where: {
          organizationId,
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
        },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = latestTx ? Number(latestTx.balanceAfter) : 0;
      const newBalance = currentBalance - Number(leaveRequest.totalDays);

      // Create immutable debit record in leave_transactions
      await tx.leaveTransaction.create({
        data: {
          organizationId,
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          transactionType: LeaveTransactionType.DEBIT_APPLICATION,
          days: -Number(leaveRequest.totalDays),
          balanceAfter: newBalance,
          leaveRequestId: leaveRequest.id,
          effectiveDate: leaveRequest.startDate,
          notes: `Approved leave from ${leaveRequest.startDate.toISOString().split('T')[0]} to ${leaveRequest.endDate.toISOString().split('T')[0]}`,
          createdByUserId: currentUser.id,
        },
      });

      // Upsert attendance_records for covered working days with status ON_LEAVE (FR-ATT-006 display sync)
      const { details: dayDetails } = await this.calculateWorkingDays(
        organizationId,
        leaveRequest.employeeId,
        leaveRequest.startDate,
        leaveRequest.endDate,
        leaveRequest.isHalfDay,
      );

      for (const day of dayDetails) {
        if (day.isWorkingDay) {
          const recordDate = new Date(day.date + 'T00:00:00.000Z');
          await tx.attendanceRecord.upsert({
            where: {
              organizationId_employeeId_date: {
                organizationId,
                employeeId: leaveRequest.employeeId,
                date: recordDate,
              },
            },
            update: {
              status: AttendanceStatus.ON_LEAVE,
              isHalfDay: leaveRequest.isHalfDay,
              isPaid: leaveRequest.leaveType.isPaid,
              leaveRequestId: leaveRequest.id,
              remarks: `Approved leave: ${leaveRequest.leaveType.name}`,
            },
            create: {
              organizationId,
              employeeId: leaveRequest.employeeId,
              date: recordDate,
              status: AttendanceStatus.ON_LEAVE,
              isHalfDay: leaveRequest.isHalfDay,
              isPaid: leaveRequest.leaveType.isPaid,
              leaveRequestId: leaveRequest.id,
              remarks: `Approved leave: ${leaveRequest.leaveType.name}`,
            },
          });
        }
      }

      return updatedRequest;
    });

    if (this.eventBus) {
      try {
        const empUser = await this.prisma.user.findFirst({
          where: { employeeId: leaveRequest.employeeId, organizationId },
          select: { id: true },
        });
        if (empUser) {
          this.eventBus.emitLeaveStatus({
            organizationId,
            recipientUserId: empUser.id,
            leaveRequestId: leaveRequest.id,
            status: LeaveRequestStatus.APPROVED,
            leaveTypeName: leaveRequest.leaveType.name,
            startDate: leaveRequest.startDate.toISOString().split('T')[0],
            endDate: leaveRequest.endDate.toISOString().split('T')[0],
          });
        }
      } catch {
        // ignore notification errors
      }
    }

    return result;
  }

  /**
   * Cancel an existing leave request.
   * If the request was previously APPROVED, an atomic compensatory credit is written to the ledger.
   */
  async cancelLeave(
    organizationId: string,
    requestId: string,
    currentUser: AuthenticatedUser,
  ) {
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, organizationId },
      include: { leaveType: true },
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request with ID '${requestId}' not found`);
    }

    // Permission check: Can be cancelled by the employee themselves, or HR/Super Admin
    const isOwner =
      currentUser.employeeId && leaveRequest.employeeId === currentUser.employeeId;
    const isHrOrAdmin =
      currentUser.role === Role.HR_ADMIN ||
      currentUser.role === Role.CLIENT_SUPER_ADMIN;

    if (!isOwner && !isHrOrAdmin) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    if (
      leaveRequest.status === LeaveRequestStatus.CANCELLED ||
      leaveRequest.status === LeaveRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot cancel leave request that is already ${leaveRequest.status}`,
      );
    }

    // If PENDING: simply mark CANCELLED
    if (leaveRequest.status === LeaveRequestStatus.PENDING) {
      return this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: { status: LeaveRequestStatus.CANCELLED },
      });
    }

    // If APPROVED: Mark CANCELLED and issue compensatory credit in leave_transactions
    return this.prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: LeaveRequestStatus.CANCELLED },
      });

      const latestTx = await tx.leaveTransaction.findFirst({
        where: {
          organizationId,
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
        },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = latestTx ? Number(latestTx.balanceAfter) : 0;
      const newBalance = currentBalance + Number(leaveRequest.totalDays);

      await tx.leaveTransaction.create({
        data: {
          organizationId,
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          transactionType: LeaveTransactionType.CREDIT_ADJUSTMENT,
          days: Number(leaveRequest.totalDays),
          balanceAfter: newBalance,
          leaveRequestId: leaveRequest.id,
          effectiveDate: new Date(),
          notes: `Compensatory credit for cancelled approved leave (${leaveRequest.id})`,
          createdByUserId: currentUser.id,
        },
      });

      // Remove attendance ON_LEAVE records that were created for this leave request
      await tx.attendanceRecord.deleteMany({
        where: {
          organizationId,
          leaveRequestId: leaveRequest.id,
        },
      });

      return updatedRequest;
    });
  }

  // ---------------------------------------------------------------------------
  // Queries & History
  // ---------------------------------------------------------------------------

  /**
   * List pending leave requests awaiting approval (filtered for manager or org-wide for HR).
   */
  async listPendingRequests(organizationId: string, currentUser: AuthenticatedUser) {
    const whereClause: any = {
      organizationId,
      status: LeaveRequestStatus.PENDING,
    };

    // If Manager: only view direct reports
    if (currentUser.role === Role.MANAGER && currentUser.employeeId) {
      whereClause.employee = {
        reportingManagerId: currentUser.employeeId,
      };
    }

    return this.prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { appliedAt: 'asc' },
    });
  }

  /**
   * List an employee's own leave requests.
   */
  async listEmployeeRequests(organizationId: string, employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { organizationId, employeeId },
      include: { leaveType: true },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Get full audit ledger of leave transactions for an employee.
   */
  async getEmployeeLedger(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${employeeId}' not found`);
    }

    const transactions = await this.prisma.leaveTransaction.findMany({
      where: { organizationId, employeeId },
      include: {
        leaveType: { select: { name: true, code: true, isPaid: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      employee,
      transactions,
    };
  }

  // ---------------------------------------------------------------------------
  // Module 6 Payroll Interface
  // ---------------------------------------------------------------------------

  /**
   * Computes total approved Leave Without Pay (LWP) days for an employee within a pay period.
   * Directly consumed by Payroll engine: Payable Days = Month Days - LWP Days.
   */
  async getEmployeeLwpDaysForPeriod(
    organizationId: string,
    employeeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const approvedLwp = await this.prisma.leaveRequest.findMany({
      where: {
        organizationId,
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        leaveType: { isPaid: false },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    return approvedLwp.reduce((sum, req) => sum + Number(req.totalDays), 0);
  }
}
