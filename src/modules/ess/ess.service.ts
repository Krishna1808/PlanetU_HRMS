import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeService } from '../employees/services/employee.service';
import { ShiftService } from '../shifts/shift.service';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveService } from '../leaves/leave.service';
import { PayrollService } from '../payroll/payroll.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import {
  EssDashboardResponse,
  EssProfileSummary,
  EssShiftCard,
  EssTodayAttendance,
  EssLeaveBalanceItem,
  EssRecentLeaveItem,
  EssLatestPayslipItem,
  EssManagerOverview,
} from './dto/ess-dashboard.dto';

@Injectable()
export class EssService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeService: EmployeeService,
    private readonly shiftService: ShiftService,
    private readonly attendanceService: AttendanceService,
    private readonly leaveService: LeaveService,
    private readonly payrollService: PayrollService,
  ) {}

  /**
   * Aggregated home dashboard payload.
   * Concurrent retrieval via Promise.all with 0 round-trip cascading.
   */
  async getDashboard(
    organizationId: string,
    currentUser: AuthenticatedUser,
  ): Promise<EssDashboardResponse> {
    const employeeId = currentUser.employeeId;
    if (!employeeId) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }

    const today = new Date();

    // Concurrently fetch all core module state in parallel
    const [
      employeeProfile,
      shiftInfo,
      todayAttendance,
      leaveBalancesData,
      leaveRequests,
      payslips,
    ] = await Promise.all([
      this.employeeService.getEmployeeById(organizationId, employeeId, currentUser),
      this.shiftService.getEmployeeShiftForDate(organizationId, employeeId, today),
      this.attendanceService.getTodayAttendance(organizationId, employeeId),
      this.leaveService.getEmployeeLeaveBalances(organizationId, employeeId),
      this.leaveService.listEmployeeRequests(organizationId, employeeId),
      this.payrollService.getMyPayslips(organizationId, employeeId),
    ]);

    // 1. Profile Summary
    const profile: EssProfileSummary = {
      id: employeeProfile.id,
      employeeCode: employeeProfile.employeeCode,
      firstName: employeeProfile.firstName,
      lastName: employeeProfile.lastName,
      personalEmail: employeeProfile.personalEmail || null,
      phone: employeeProfile.phone || null,
      department: employeeProfile.department?.name || 'Unassigned',
      designation: employeeProfile.designation?.name || 'Unassigned',
      grade: employeeProfile.grade?.name || null,
      location: employeeProfile.location?.name || null,
      reportingManager: employeeProfile.reportingManager
        ? `${employeeProfile.reportingManager.firstName} ${employeeProfile.reportingManager.lastName}`.trim()
        : null,
      dateOfJoining: employeeProfile.dateOfJoining
        ? new Date(employeeProfile.dateOfJoining).toISOString()
        : '',
    };

    // 2. Shift Card
    const shift: EssShiftCard = {
      shiftId: shiftInfo.shift.id,
      shiftName: shiftInfo.shift.name,
      shiftCode: shiftInfo.shift.code,
      startTime: shiftInfo.shift.startTime,
      endTime: shiftInfo.shift.endTime,
      isOvernight: shiftInfo.shift.isOvernight,
      gracePeriodMinutes: shiftInfo.shift.gracePeriodMinutes,
      weeklyOffDays: shiftInfo.weeklyOffDays.map((d: any) => d.toString()),
    };

    // 3. Today's Attendance State
    const todayAttendanceTyped = todayAttendance as any;
    const todayState: EssTodayAttendance = {
      date: todayAttendanceTyped.date
        ? new Date(todayAttendanceTyped.date).toISOString().split('T')[0]
        : today.toISOString().split('T')[0],
      status: todayAttendanceTyped.status || 'NOT_CHECKED_IN',
      checkInTime: todayAttendanceTyped.checkInTime
        ? new Date(todayAttendanceTyped.checkInTime).toISOString()
        : null,
      checkOutTime: todayAttendanceTyped.checkOutTime
        ? new Date(todayAttendanceTyped.checkOutTime).toISOString()
        : null,
      totalActiveMinutes: todayAttendanceTyped.totalActiveMinutes ?? null,
      isLate: Boolean(todayAttendanceTyped.isLate),
      isHalfDay: Boolean(todayAttendanceTyped.isHalfDay),
      isWeeklyOff: Boolean(todayAttendanceTyped.isWeeklyOff),
    };

    // 4. Leave Balances
    const leaveBalances: EssLeaveBalanceItem[] = (
      leaveBalancesData.balances || []
    ).map((b: any) => ({
      leaveTypeId: b.leaveTypeId,
      name: b.leaveTypeName,
      code: b.leaveTypeCode,
      isPaid: b.isPaid,
      daysAllowedPerYear: b.daysAllowedPerYear,
      accruedDays: b.currentBalance,
      usedDays: b.daysAllowedPerYear - b.availableBalance,
      availableBalance: b.availableBalance,
    }));

    // 5. Recent Leave Requests (Last 3)
    const recentLeaveRequests: EssRecentLeaveItem[] = (leaveRequests || [])
      .slice(0, 3)
      .map((r: any) => ({
        id: r.id,
        leaveTypeName: r.leaveType?.name || 'Leave',
        leaveTypeCode: r.leaveType?.code || 'LV',
        startDate: new Date(r.startDate).toISOString().split('T')[0],
        endDate: new Date(r.endDate).toISOString().split('T')[0],
        totalDays: Number(r.totalDays),
        status: r.status,
        reason: r.reason,
        appliedAt: new Date(r.appliedAt).toISOString(),
      }));

    // 6. Latest Payslip Snapshot
    let latestPayslip: EssLatestPayslipItem | null = null;
    if (payslips && payslips.length > 0) {
      const p = payslips[0];
      latestPayslip = {
        id: p.id,
        year: p.payrollBatch.year,
        month: p.payrollBatch.month,
        payableDays: Number(p.payableDays),
        earnedGross: Number(p.earnedGross),
        totalDeductions: Number(p.totalDeductions),
        netPay: Number(p.netPay),
        status: p.payrollBatch.status,
      };
    }

    // 7. Manager Overview (if user has MANAGER role)
    let managerOverview: EssManagerOverview | undefined;
    if (currentUser.role === Role.MANAGER) {
      const [reportsCount, pendingApprovals] = await Promise.all([
        this.prisma.employee.count({
          where: {
            organizationId,
            reportingManagerId: employeeId,
            deletedAt: null,
          },
        }),
        this.leaveService.listPendingRequests(organizationId, currentUser),
      ]);

      managerOverview = {
        isManager: true,
        directReportsCount: reportsCount,
        pendingLeaveApprovalsCount: pendingApprovals.length,
      };
    }

    return {
      profile,
      shift,
      todayAttendance: todayState,
      leaveBalances,
      recentLeaveRequests,
      latestPayslip,
      ...(managerOverview && { managerOverview }),
    };
  }

  /**
   * Full employee profile with field-level editability metadata (FR-EMP-006).
   */
  async getMyProfile(organizationId: string, currentUser: AuthenticatedUser) {
    if (!currentUser.employeeId) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }

    const profile = await this.employeeService.getEmployeeById(
      organizationId,
      currentUser.employeeId,
      currentUser,
    );

    return {
      profile,
      editableFields: [
        'phone',
        'personalEmail',
        'currentAddress',
        'permanentAddress',
        'emergencyContactName',
        'emergencyContactPhone',
        'emergencyContactRelation',
      ],
      restrictedFields: [
        'employeeCode',
        'department',
        'designation',
        'grade',
        'location',
        'reportingManager',
        'dateOfJoining',
        'employmentType',
        'employmentStatus',
        'baseSalary',
        'bankName',
        'accountNumber',
        'ifscOrRouting',
        'panNumber',
        'uanNumber',
      ],
    };
  }

  /**
   * Self-update personal contact and emergency details (FR-EMP-006).
   */
  async updateMyProfile(
    organizationId: string,
    dto: UpdateMyProfileDto,
    currentUser: AuthenticatedUser,
  ) {
    if (!currentUser.employeeId) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }

    return this.employeeService.updateEmployee(
      organizationId,
      currentUser.employeeId,
      dto,
      currentUser,
    );
  }

  /**
   * Month-to-date personal attendance history and reconciliation.
   */
  async getMyAttendance(
    organizationId: string,
    currentUser: AuthenticatedUser,
    year?: number,
    month?: number,
  ) {
    if (!currentUser.employeeId) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    const [finalizedDays, records] = await Promise.all([
      this.attendanceService.getFinalizedPayableDays(
        organizationId,
        currentUser.employeeId,
        targetYear,
        targetMonth,
      ),
      this.attendanceService.getEmployeeAttendanceHistory(
        organizationId,
        currentUser.employeeId,
      ),
    ]);

    return {
      year: targetYear,
      month: targetMonth,
      finalizedSummary: finalizedDays,
      records,
    };
  }

  /**
   * Live leave balances and application history.
   */
  async getMyLeaves(organizationId: string, currentUser: AuthenticatedUser) {
    if (!currentUser.employeeId) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }

    const [balances, requests] = await Promise.all([
      this.leaveService.getEmployeeLeaveBalances(organizationId, currentUser.employeeId),
      this.leaveService.listEmployeeRequests(organizationId, currentUser.employeeId),
    ]);

    return {
      balances: balances.balances,
      requests,
    };
  }

  /**
   * Personal historical payslips.
   */
  async getMyPayslips(organizationId: string, currentUser: AuthenticatedUser) {
    if (!currentUser.employeeId) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }

    return this.payrollService.getMyPayslips(organizationId, currentUser.employeeId);
  }

  /**
   * Manager actions: Pending approval requests from direct reports.
   */
  async getManagerPendingApprovals(
    organizationId: string,
    currentUser: AuthenticatedUser,
  ) {
    if (
      currentUser.role !== Role.MANAGER &&
      currentUser.role !== Role.HR_ADMIN &&
      currentUser.role !== Role.CLIENT_SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only managers and administrators have pending approval queues');
    }

    return this.leaveService.listPendingRequests(organizationId, currentUser);
  }
}
