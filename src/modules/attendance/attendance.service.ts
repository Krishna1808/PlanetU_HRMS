import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  DayOfWeek,
  LeaveRequestStatus,
  PunchSource,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShiftService } from '../shifts/shift.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { RegularizeAttendanceDto } from './dto/regularize-attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { FinalizedPayableDaysDto } from './dto/finalized-payable-days.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftService: ShiftService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Truncates a date to UTC midnight (YYYY-MM-DD) for uniform date indexing
   */
  private truncateToDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // ---------------------------------------------------------------------------
  // Web Punch: Clock-In & Clock-Out
  // ---------------------------------------------------------------------------

  /**
   * Web clock-in for the current employee.
   * Resolves active shift, calculates grace period lateness, and upserts today's attendance record.
   */
  async checkIn(
    organizationId: string,
    employeeId: string,
    dto: CheckInDto,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException(`Employee with ID '${employeeId}' not found`);
    }

    const checkInTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const dateOnly = this.truncateToDateOnly(checkInTime);

    // Look up today's active shift
    const shiftInfo = await this.shiftService.getEmployeeShiftForDate(
      organizationId,
      employeeId,
      dateOnly,
    );

    // Calculate lateness based on shift start time & grace period
    const [startH, startM] = shiftInfo.shift.startTime.split(':').map(Number);
    const shiftStartMinutes = startH * 60 + startM;
    const graceMinutes = shiftInfo.shift.gracePeriodMinutes ?? 15;
    const lateCutoffMinutes = shiftStartMinutes + graceMinutes;

    const punchMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    const isLate = punchMinutes > lateCutoffMinutes;
    const lateMinutes = isLate ? punchMinutes - shiftStartMinutes : 0;

    // Check if an existing record already has checkInTime
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: {
        organizationId_employeeId_date: {
          organizationId,
          employeeId,
          date: dateOnly,
        },
      },
    });

    if (existing && existing.checkInTime) {
      throw new BadRequestException('You have already clocked in for today');
    }

    return this.prisma.attendanceRecord.upsert({
      where: {
        organizationId_employeeId_date: {
          organizationId,
          employeeId,
          date: dateOnly,
        },
      },
      update: {
        checkInTime,
        shiftId: shiftInfo.shift.id,
        isLate,
        lateMinutes,
        punchSource: PunchSource.WEB,
        remarks: dto.remarks,
        status: AttendanceStatus.PRESENT, // Tentative present pending check-out
        isPaid: true,
      },
      create: {
        organizationId,
        employeeId,
        date: dateOnly,
        checkInTime,
        shiftId: shiftInfo.shift.id,
        isLate,
        lateMinutes,
        punchSource: PunchSource.WEB,
        remarks: dto.remarks,
        status: AttendanceStatus.PRESENT,
        isPaid: true,
      },
    });
  }

  /**
   * Web clock-out for the current employee.
   * Calculates net active minutes and evaluates half-day vs full-day thresholds against the active shift.
   */
  async checkOut(
    organizationId: string,
    employeeId: string,
    dto: CheckOutDto,
  ) {
    const checkOutTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const dateOnly = this.truncateToDateOnly(checkOutTime);

    const record = await this.prisma.attendanceRecord.findUnique({
      where: {
        organizationId_employeeId_date: {
          organizationId,
          employeeId,
          date: dateOnly,
        },
      },
    });

    if (!record || !record.checkInTime) {
      throw new BadRequestException(
        'No check-in record found for today. Please clock in first.',
      );
    }

    if (record.checkOutTime) {
      throw new BadRequestException('You have already clocked out for today');
    }

    // Resolve shift info to evaluate thresholds
    const shiftInfo = await this.shiftService.getEmployeeShiftForDate(
      organizationId,
      employeeId,
      dateOnly,
    );

    const spanMinutes = Math.floor(
      (checkOutTime.getTime() - record.checkInTime.getTime()) / (1000 * 60),
    );
    const breakMinutes = shiftInfo.shift.breakDurationMinutes ?? 60;
    const totalActiveMinutes = Math.max(0, spanMinutes - breakMinutes);

    const fullDayThreshold = shiftInfo.shift.fullDayThresholdMinutes ?? 480;
    const halfDayThreshold = shiftInfo.shift.halfDayThresholdMinutes ?? 240;

    let finalStatus: AttendanceStatus;
    let isHalfDay = false;
    let isPaid = true;

    if (totalActiveMinutes >= fullDayThreshold) {
      finalStatus = AttendanceStatus.PRESENT;
    } else if (totalActiveMinutes >= halfDayThreshold) {
      finalStatus = AttendanceStatus.HALF_DAY;
      isHalfDay = true;
    } else {
      // Insufficient active hours to qualify even for half-day credit
      finalStatus = AttendanceStatus.ABSENT;
      isPaid = false;
    }

    return this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkOutTime,
        totalActiveMinutes,
        status: finalStatus,
        isHalfDay,
        isPaid,
        remarks: dto.remarks ? `${record.remarks ? record.remarks + '; ' : ''}${dto.remarks}` : record.remarks,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /**
   * Retrieve today's attendance status for an employee.
   */
  async getTodayAttendance(organizationId: string, employeeId: string) {
    const todayOnly = this.truncateToDateOnly(new Date());

    const record = await this.prisma.attendanceRecord.findUnique({
      where: {
        organizationId_employeeId_date: {
          organizationId,
          employeeId,
          date: todayOnly,
        },
      },
      include: { shift: true },
    });

    if (record) {
      return record;
    }

    // If no punch record, check if today is a weekly off or on approved leave
    const shiftInfo = await this.shiftService.getEmployeeShiftForDate(
      organizationId,
      employeeId,
      todayOnly,
    );

    const dayOfWeekMap: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    const isWeeklyOff = shiftInfo.weeklyOffDays.includes(dayOfWeekMap[todayOnly.getUTCDay()]);

    return {
      date: todayOnly,
      status: isWeeklyOff ? AttendanceStatus.WEEKLY_OFF : 'NOT_CHECKED_IN',
      isWeeklyOff,
      shift: shiftInfo.shift,
      checkInTime: null,
      checkOutTime: null,
    };
  }

  /**
   * Retrieve personal monthly attendance history for an employee.
   */
  async getEmployeeAttendanceHistory(
    organizationId: string,
    employeeId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const whereClause: any = {
      organizationId,
      employeeId,
    };

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = this.truncateToDateOnly(new Date(startDate));
      if (endDate) whereClause.date.lte = this.truncateToDateOnly(new Date(endDate));
    }

    return this.prisma.attendanceRecord.findMany({
      where: whereClause,
      include: { shift: true },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Query attendance records for HR / Managers with optional filters.
   */
  async queryAttendanceRecords(
    organizationId: string,
    query: QueryAttendanceDto,
    currentUser: AuthenticatedUser,
  ) {
    const whereClause: any = { organizationId };

    // Managers can view their department plus direct reports in other departments.
    // This is read-only scope; regularization remains separately restricted to direct reports.
    if (currentUser.role === Role.MANAGER) {
      if (!currentUser.employeeId) {
        throw new ForbiddenException('Manager account is not linked to an employee record');
      }
      const managerEmployee = await this.prisma.employee.findFirst({
        where: { id: currentUser.employeeId, organizationId, deletedAt: null },
        select: { departmentId: true },
      });
      whereClause.AND = [{
        OR: [
          ...(managerEmployee?.departmentId
            ? [{ employee: { departmentId: managerEmployee.departmentId } }]
            : []),
          { employee: { reportingManagerId: currentUser.employeeId } },
        ],
      }];
    }

    if (query.employeeId) {
      whereClause.employeeId = query.employeeId;
    }

    if (query.departmentId) {
      whereClause.employee = {
        ...whereClause.employee,
        departmentId: query.departmentId,
      };
    }

    if (query.status) {
      whereClause.status = query.status;
    }

    if (query.startDate || query.endDate) {
      whereClause.date = {};
      if (query.startDate) whereClause.date.gte = this.truncateToDateOnly(new Date(query.startDate));
      if (query.endDate) whereClause.date.lte = this.truncateToDateOnly(new Date(query.endDate));
    }

    return this.prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
        shift: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Regularization (Manual Override by Manager / HR)
  // ---------------------------------------------------------------------------

  /**
   * Manually regularize/correct an attendance record with full audit metadata.
   */
  async regularizeAttendance(
    organizationId: string,
    dto: RegularizeAttendanceDto,
    currentUser: AuthenticatedUser,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${dto.employeeId}' not found`);
    }

    // Manager authorization check
    if (currentUser.role === Role.MANAGER && currentUser.employeeId) {
      if (employee.reportingManagerId !== currentUser.employeeId) {
        throw new ForbiddenException(
          'Managers can only regularize attendance for their direct reports',
        );
      }
    }

    const dateOnly = this.truncateToDateOnly(new Date(dto.date));
    const checkInTime = dto.checkInTime ? new Date(dto.checkInTime) : undefined;
    const checkOutTime = dto.checkOutTime ? new Date(dto.checkOutTime) : undefined;

    const isPaid =
      dto.status === AttendanceStatus.PRESENT ||
      dto.status === AttendanceStatus.HALF_DAY ||
      dto.status === AttendanceStatus.WEEKLY_OFF ||
      dto.status === AttendanceStatus.HOLIDAY;

    const isHalfDay = dto.status === AttendanceStatus.HALF_DAY;

    return this.prisma.attendanceRecord.upsert({
      where: {
        organizationId_employeeId_date: {
          organizationId,
          employeeId: dto.employeeId,
          date: dateOnly,
        },
      },
      update: {
        status: dto.status,
        checkInTime,
        checkOutTime,
        isHalfDay,
        isPaid,
        punchSource: PunchSource.MANUAL_OVERRIDE,
        remarks: dto.remarks,
        regularizedByUserId: currentUser.id,
        regularizedAt: new Date(),
      },
      create: {
        organizationId,
        employeeId: dto.employeeId,
        date: dateOnly,
        status: dto.status,
        checkInTime,
        checkOutTime,
        isHalfDay,
        isPaid,
        punchSource: PunchSource.MANUAL_OVERRIDE,
        remarks: dto.remarks,
        regularizedByUserId: currentUser.id,
        regularizedAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Authoritative Single Source of Truth for Payroll
  // ---------------------------------------------------------------------------

  /**
   * Finalizes payable days for an employee in a given month/year.
   * Evaluates all calendar days, factoring in punches, shift weekly offs, approved leaves,
   * and catches UNEXCUSED ABSENCES so Payroll never pays absent employees.
   */
  async getFinalizedPayableDays(
    organizationId: string,
    employeeId: string,
    year: number,
    month: number, // 1 to 12
  ): Promise<FinalizedPayableDaysDto> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, locationId: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${employeeId}' not found`);
    }

    // Number of days in month (e.g. Sept 2026 = 30)
    const totalMonthDays = new Date(year, month, 0).getDate();

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month - 1, totalMonthDays));

    // 1. Fetch all existing attendance records for the month
    const existingRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        organizationId,
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });
    const recordMap = new Map<string, typeof existingRecords[0]>();
    for (const rec of existingRecords) {
      const dStr = rec.date.toISOString().split('T')[0];
      recordMap.set(dStr, rec);
    }

    // 2. Fetch approved leaves covering any part of this month
    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        organizationId,
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { leaveType: true },
    });

    // 3. Fetch company holidays in this calendar month
    const holidays = (this.prisma as any).holiday
      ? await (this.prisma as any).holiday.findMany({
          where: {
            organizationId,
            date: { gte: startDate, lte: endDate },
            isRestricted: false,
            OR: [
              { locationId: null },
              ...(employee.locationId ? [{ locationId: employee.locationId }] : []),
            ],
          },
        })
      : [];
    const holidayMap = new Map<string, any>();
    for (const h of holidays) {
      const hStr = h.date.toISOString().split('T')[0];
      holidayMap.set(hStr, h);
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

    // Determine current month bounds to prevent future dates from becoming false absences
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const currentDay = now.getUTCDate();
    const isCurrentMonth = (year === currentYear && month === currentMonth);

    let presentDays = 0;
    let halfDays = 0;
    let weeklyOffDays = 0;
    let paidLeaveDays = 0;
    let lwpDays = 0;
    let holidayDays = 0;
    let unexcusedAbsenceDays = 0;
    let upcomingScheduledDays = 0;

    // 4. Reconcile day-by-day
    for (let day = 1; day <= totalMonthDays; day++) {
      const currentCalDate = new Date(Date.UTC(year, month - 1, day));
      const dateKey = currentCalDate.toISOString().split('T')[0];
      const isFutureDate = isCurrentMonth && day > currentDay;

      const record = recordMap.get(dateKey);

      if (record) {
        // Evaluate recorded punch status
        if (record.status === AttendanceStatus.PRESENT) {
          presentDays += 1;
        } else if (record.status === AttendanceStatus.HALF_DAY) {
          halfDays += 1;
        } else if (record.status === AttendanceStatus.WEEKLY_OFF) {
          weeklyOffDays += 1;
        } else if (record.status === AttendanceStatus.HOLIDAY) {
          holidayDays += 1;
        } else if (record.status === AttendanceStatus.ON_LEAVE) {
          if (record.isPaid) {
            paidLeaveDays += record.isHalfDay ? 0.5 : 1.0;
          } else {
            lwpDays += record.isHalfDay ? 0.5 : 1.0;
          }
        } else if (record.status === AttendanceStatus.ABSENT) {
          unexcusedAbsenceDays += 1;
        }
      } else {
        // 1. Check if date is an official company holiday
        if (holidayMap.has(dateKey)) {
          holidayDays += 1;
          continue;
        }

        // 2. Check Shift Roster for Weekly Off
        const shiftInfo = await this.shiftService.getEmployeeShiftForDate(
          organizationId,
          employeeId,
          currentCalDate,
        );
        const dayEnum = dayOfWeekMap[currentCalDate.getUTCDay()];
        const isWeeklyOff = shiftInfo.weeklyOffDays.includes(dayEnum);

        if (isWeeklyOff) {
          weeklyOffDays += 1;
        } else {
          // 3. Check if employee has an approved leave covering this date
          const matchingLeave = approvedLeaves.find(
            (l) =>
              this.truncateToDateOnly(l.startDate) <= currentCalDate &&
              this.truncateToDateOnly(l.endDate) >= currentCalDate,
          );

          if (matchingLeave) {
            if (matchingLeave.leaveType.isPaid) {
              paidLeaveDays += matchingLeave.isHalfDay ? 0.5 : 1.0;
            } else {
              lwpDays += matchingLeave.isHalfDay ? 0.5 : 1.0;
            }
          } else {
            if (isFutureDate) {
              // Future date in active ongoing cycle: scheduled, not an unexcused absence
              upcomingScheduledDays += 1;
            } else {
              // Working day, no punch, no approved leave, elapsed = UNEXCUSED ABSENCE
              unexcusedAbsenceDays += 1;
            }
          }
        }
      }
    }

    // Authoritative Payable Days:
    // Every present day + half days (at 0.5) + paid leaves + weekly offs + paid holidays
    const payableDays =
      presentDays + halfDays * 0.5 + paidLeaveDays + weeklyOffDays + holidayDays;

    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      year,
      month,
      totalMonthDays,
      presentDays,
      weeklyOffDays,
      paidLeaveDays,
      halfDays,
      holidayDays,
      unexcusedAbsenceDays,
      lwpDays,
      upcomingScheduledDays,
      payableDays: Math.min(totalMonthDays, payableDays),
    };
  }

  /**
   * Retrieves today's attendance roll call summary across the organization (or direct reports for Manager).
   */
  async getRollCallSummary(organizationId: string, currentUser: AuthenticatedUser) {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

    const empWhere: any = {
      organizationId,
      deletedAt: null,
      employmentStatus: 'ACTIVE',
    };

    if (currentUser.role === Role.MANAGER && currentUser.employeeId) {
      empWhere.OR = [
        { reportingManagerId: currentUser.employeeId },
        { id: currentUser.employeeId },
      ];
    }

    const [totalScheduled, todayRecords, activeLeaves] = await Promise.all([
      this.prisma.employee.count({ where: empWhere }),
      this.prisma.attendanceRecord.findMany({
        where: {
          organizationId,
          date: { gte: todayStart, lte: todayEnd },
          employee: empWhere,
        },
        select: { status: true, isLate: true, isHalfDay: true },
      }),
      this.prisma.leaveRequest.count({
        where: {
          organizationId,
          status: LeaveRequestStatus.APPROVED,
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
          employee: empWhere,
        },
      }),
    ]);

    let present = 0;
    let late = 0;
    let halfDay = 0;
    let explicitAbsent = 0;

    for (const r of todayRecords) {
      if (r.status === AttendanceStatus.PRESENT) {
        present++;
      } else if (r.status === AttendanceStatus.HALF_DAY) {
        halfDay++;
      } else if (r.status === AttendanceStatus.ABSENT) {
        explicitAbsent++;
      }
      if (r.isLate) late++;
    }

    const totalPunched = present + halfDay;
    const presenceRate = totalScheduled > 0
      ? Number(((totalPunched / totalScheduled) * 100).toFixed(1))
      : 0;

    const onLeave = activeLeaves;
    const unrecorded = Math.max(0, totalScheduled - totalPunched - onLeave);

    return {
      todayDate: todayStart.toISOString().split('T')[0],
      totalScheduled,
      present,
      halfDay,
      late,
      onLeave,
      unrecorded,
      explicitAbsent,
      presenceRate,
    };
  }
}
