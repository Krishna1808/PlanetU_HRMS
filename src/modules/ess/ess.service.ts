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
   * Ensures the current user has an associated Employee profile.
   * In PlanetU HRMS, every user in the organisation (Super Admin, HR, Manager, Finance, Employee)
   * is fundamentally an employee entitled to full ESS self-service.
   */
  async ensureEmployee(
    organizationId: string,
    currentUser: AuthenticatedUser,
  ): Promise<string> {
    if (currentUser.employeeId) {
      return currentUser.employeeId;
    }

    if (!this.prisma.employee?.findFirst) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }

    // Check if an employee with personalEmail matching the user's email already exists
    let employee = await this.prisma.employee.findFirst({
      where: {
        organizationId,
        personalEmail: { equals: currentUser.email, mode: 'insensitive' },
        deletedAt: null,
      },
    });

    if (!employee) {
      // Find fallback master records
      const defaultDept = await this.prisma.department.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });
      const defaultDesig = await this.prisma.designation.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });

      if (!defaultDept || !defaultDesig) {
        throw new BadRequestException(
          'Organization master records (Department/Designation) must be configured first',
        );
      }

      const rolePrefix =
        currentUser.role === Role.CLIENT_SUPER_ADMIN
          ? 'ADM'
          : currentUser.role === Role.HR_ADMIN
          ? 'HR'
          : currentUser.role === Role.FINANCE
          ? 'FIN'
          : currentUser.role === Role.MANAGER
          ? 'MGR'
          : defaultDept.codePrefix || 'EMP';

      const count = await this.prisma.employee.count({ where: { organizationId } });
      const employeeCode = `${rolePrefix}-${String(count + 1).padStart(4, '0')}`;

      const emailUsername = currentUser.email.split('@')[0];
      const parts = emailUsername.split(/[._-]/);
      const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const lastName =
        parts.length > 1
          ? parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
          : currentUser.role.replace(/_/g, ' ');

      employee = await this.prisma.employee.create({
        data: {
          organizationId,
          employeeCode,
          firstName,
          lastName,
          personalEmail: currentUser.email,
          departmentId: defaultDept.id,
          designationId: defaultDesig.id,
          dateOfJoining: new Date('2024-01-01'),
          employmentStatus: 'ACTIVE',
          employmentType: 'FULL_TIME',
        },
      });

      // Assign default shift
      const defaultShift = await this.prisma.shift.findFirst({
        where: { organizationId, isDefault: true },
      });
      if (defaultShift) {
        await this.prisma.employeeShiftAssignment.create({
          data: {
            organizationId,
            employeeId: employee.id,
            shiftId: defaultShift.id,
            effectiveFrom: new Date('2024-01-01'),
            weeklyOffDays: ['SATURDAY', 'SUNDAY'],
          },
        }).catch(() => {});
      }
    }

    // Link employee to user in database
    await this.prisma.user.update({
      where: { id: currentUser.id },
      data: { employeeId: employee.id },
    });
    currentUser.employeeId = employee.id;

    return employee.id;
  }

  /**
   * Aggregated home dashboard payload.
   * Concurrent retrieval via Promise.all with 0 round-trip cascading.
   */
  async getDashboard(
    organizationId: string,
    currentUser: AuthenticatedUser,
  ): Promise<EssDashboardResponse> {
    const employeeId = await this.ensureEmployee(organizationId, currentUser);

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

    // 7. Manager Overview (if user is MANAGER, HR_ADMIN, or CLIENT_SUPER_ADMIN)
    let managerOverview: EssManagerOverview | undefined;
    if (
      currentUser.role === Role.MANAGER ||
      currentUser.role === Role.HR_ADMIN ||
      currentUser.role === Role.CLIENT_SUPER_ADMIN
    ) {
      const [reportsCount, pendingApprovals] = await Promise.all([
        this.prisma.employee.count({
          where: {
            organizationId,
            ...(currentUser.role === Role.MANAGER ? { reportingManagerId: employeeId } : {}),
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
    const employeeId = await this.ensureEmployee(organizationId, currentUser);

    const profile = await this.employeeService.getEmployeeById(
      organizationId,
      employeeId,
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
    const employeeId = await this.ensureEmployee(organizationId, currentUser);

    return this.employeeService.updateEmployee(
      organizationId,
      employeeId,
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
    const employeeId = await this.ensureEmployee(organizationId, currentUser);

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    const [finalizedDays, records] = await Promise.all([
      this.attendanceService.getFinalizedPayableDays(
        organizationId,
        employeeId,
        targetYear,
        targetMonth,
      ),
      this.attendanceService.getEmployeeAttendanceHistory(
        organizationId,
        employeeId,
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
    const employeeId = await this.ensureEmployee(organizationId, currentUser);

    const [balances, requests] = await Promise.all([
      this.leaveService.getEmployeeLeaveBalances(organizationId, employeeId),
      this.leaveService.listEmployeeRequests(organizationId, employeeId),
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
    const employeeId = await this.ensureEmployee(organizationId, currentUser);

    return this.payrollService.getMyPayslips(organizationId, employeeId);
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
