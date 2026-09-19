import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  Role,
  EmploymentStatus,
  LeaveRequestStatus,
  ExitStatus,
  AttendanceStatus,
  OnboardingStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { generateCsv } from './utils/csv-exporter';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. Executive Overview & KPI Cards
  // ---------------------------------------------------------------------------

  /**
   * Retrieves high-level company overview metrics across headcount, today's attendance,
   * current month payroll expense, and pending operational approvals.
   */
  async getExecutiveOverview(
    organizationId: string,
    currentUser: AuthenticatedUser,
  ) {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59));

    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
    );
    const todayEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59),
    );

    // 1. Total active headcount & new hires / exits this month
    const [activeHeadcount, newHiresThisMonth, exitsThisMonth] = await Promise.all([
      this.prisma.employee.count({
        where: {
          organizationId,
          deletedAt: null,
          employmentStatus: {
            notIn: [EmploymentStatus.RESIGNED, EmploymentStatus.TERMINATED],
          },
        },
      }),
      this.prisma.employee.count({
        where: {
          organizationId,
          dateOfJoining: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      this.prisma.employee.count({
        where: {
          organizationId,
          dateOfExit: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
    ]);

    // 2. Today's presence & lateness
    const [todayPunches, todayLatePunches] = await Promise.all([
      this.prisma.attendanceRecord.count({
        where: {
          organizationId,
          date: { gte: todayStart, lte: todayEnd },
          status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY] },
        },
      }),
      this.prisma.attendanceRecord.count({
        where: {
          organizationId,
          date: { gte: todayStart, lte: todayEnd },
          isLate: true,
        },
      }),
    ]);

    const presenceRate =
      activeHeadcount > 0
        ? Number(((todayPunches / activeHeadcount) * 100).toFixed(1))
        : 0;

    // 3. Current month payroll expense (if user has permission to see financial data)
    let currentMonthPayrollExpense = 0;
    const canSeePayroll =
      currentUser.role === Role.CLIENT_SUPER_ADMIN ||
      currentUser.role === Role.HR_ADMIN ||
      currentUser.role === Role.FINANCE;

    if (canSeePayroll) {
      const latestBatch = await this.prisma.payrollBatch.findFirst({
        where: {
          organizationId,
          year: currentYear,
          month: currentMonth,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (latestBatch) {
        currentMonthPayrollExpense = Number(latestBatch.totalNetPay);
      }
    }

    // 4. Pending approvals count
    const [pendingLeaves, pendingExits, pendingOnboarding] = await Promise.all([
      this.prisma.leaveRequest.count({
        where: { organizationId, status: LeaveRequestStatus.PENDING },
      }),
      this.prisma.exitRequest.count({
        where: { organizationId, status: ExitStatus.PENDING_APPROVAL },
      }),
      this.prisma.onboardingCandidate.count({
        where: {
          organizationId,
          status: { in: [OnboardingStatus.INVITED, OnboardingStatus.IN_PROGRESS, OnboardingStatus.SUBMITTED] },
        },
      }),
    ]);

    return {
      activeHeadcount,
      newHiresThisMonth,
      exitsThisMonth,
      todayPunches,
      todayLatePunches,
      presenceRate,
      currentMonthPayrollExpense: canSeePayroll ? currentMonthPayrollExpense : null,
      pendingApprovals: {
        leaves: pendingLeaves,
        exits: pendingExits,
        onboardingCandidates: pendingOnboarding,
        total: pendingLeaves + pendingExits,
      },
      updatedAt: now,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Workforce Demographics Analytics
  // ---------------------------------------------------------------------------

  /**
   * Generates demographic breakdowns across departments, designations, grades,
   * gender diversity, and employment types.
   */
  async getWorkforceAnalytics(
    organizationId: string,
    currentUser: AuthenticatedUser,
  ) {
    const activeWhere: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      employmentStatus: {
        notIn: [EmploymentStatus.RESIGNED, EmploymentStatus.TERMINATED],
      },
    };

    const [
      totalActive,
      departmentGroups,
      departments,
      designationGroups,
      designations,
      gradeGroups,
      grades,
      genderGroups,
      employmentTypeGroups,
    ] = await Promise.all([
      this.prisma.employee.count({ where: activeWhere }),
      this.prisma.employee.groupBy({
        by: ['departmentId'],
        where: activeWhere,
        _count: true,
      }),
      this.prisma.department.findMany({
        where: { organizationId },
        select: { id: true, name: true, codePrefix: true },
      }),
      this.prisma.employee.groupBy({
        by: ['designationId'],
        where: activeWhere,
        _count: true,
      }),
      this.prisma.designation.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
      this.prisma.employee.groupBy({
        by: ['gradeId'],
        where: activeWhere,
        _count: true,
      }),
      this.prisma.grade.findMany({
        where: { organizationId },
        select: { id: true, name: true, level: true },
      }),
      this.prisma.employee.groupBy({
        by: ['gender'],
        where: activeWhere,
        _count: true,
      }),
      this.prisma.employee.groupBy({
        by: ['employmentType'],
        where: activeWhere,
        _count: true,
      }),
    ]);

    // Map department names
    const departmentMap = new Map(departments.map((d) => [d.id, d.name]));
    const byDepartment = departmentGroups.map((g) => ({
      departmentId: g.departmentId,
      name: departmentMap.get(g.departmentId) || 'Unknown',
      count: g._count,
      percentage:
        totalActive > 0 ? Number(((g._count / totalActive) * 100).toFixed(1)) : 0,
    }));

    // Map designation names
    const designationMap = new Map(designations.map((d) => [d.id, d.name]));
    const byDesignation = designationGroups.map((g) => ({
      designationId: g.designationId,
      name: designationMap.get(g.designationId) || 'Unknown',
      count: g._count,
      percentage:
        totalActive > 0 ? Number(((g._count / totalActive) * 100).toFixed(1)) : 0,
    }));

    // Map grade names
    const gradeMap = new Map(grades.map((g) => [g.id, g.name]));
    const byGrade = gradeGroups.map((g) => ({
      gradeId: g.gradeId,
      name: g.gradeId ? gradeMap.get(g.gradeId) || 'Unassigned' : 'Unassigned',
      count: g._count,
      percentage:
        totalActive > 0 ? Number(((g._count / totalActive) * 100).toFixed(1)) : 0,
    }));

    // Gender diversity
    const byGender = genderGroups.map((g) => ({
      gender: g.gender || 'UNSPECIFIED',
      count: g._count,
      percentage:
        totalActive > 0 ? Number(((g._count / totalActive) * 100).toFixed(1)) : 0,
    }));

    // Employment types
    const byEmploymentType = employmentTypeGroups.map((g) => ({
      employmentType: g.employmentType,
      count: g._count,
      percentage:
        totalActive > 0 ? Number(((g._count / totalActive) * 100).toFixed(1)) : 0,
    }));

    return {
      totalActive,
      byDepartment,
      byDesignation,
      byGrade,
      byGender,
      byEmploymentType,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Attendance & Absence Analytics
  // ---------------------------------------------------------------------------

  /**
   * Generates presence, lateness, and absence patterns for a given year and month.
   */
  async getAttendanceAnalytics(
    organizationId: string,
    query: ReportQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    const now = new Date();
    const year = query.year || now.getUTCFullYear();
    const month = query.month || now.getUTCMonth() + 1;

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const where: Prisma.AttendanceRecordWhereInput = {
      organizationId,
      date: { gte: startOfMonth, lte: endOfMonth },
    };

    if (query.departmentId) {
      where.employee = { departmentId: query.departmentId };
    }

    // Role scoping: Managers without admin rights only see their team
    if (
      currentUser.role === Role.MANAGER &&
      currentUser.employeeId &&
      !query.departmentId
    ) {
      where.employee = {
        OR: [
          { reportingManagerId: currentUser.employeeId },
          { id: currentUser.employeeId },
        ],
      };
    }

    const [statusGroups, latenessStats, records] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.attendanceRecord.aggregate({
        where: { ...where, isLate: true },
        _count: { id: true },
        _sum: { lateMinutes: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where,
        select: { date: true, status: true },
      }),
    ]);

    const totalRecords = statusGroups.reduce((acc, g) => acc + g._count, 0);

    const statusCounts: Record<string, number> = {
      PRESENT: 0,
      HALF_DAY: 0,
      ABSENT: 0,
      ON_LEAVE: 0,
      WEEKLY_OFF: 0,
      HOLIDAY: 0,
    };

    for (const g of statusGroups) {
      statusCounts[g.status] = g._count;
    }

    const presenceCount = statusCounts.PRESENT + statusCounts.HALF_DAY * 0.5;
    const overallPresenceRate =
      totalRecords > 0 ? Number(((presenceCount / totalRecords) * 100).toFixed(1)) : 0;

    // Day-by-day punch volume for chart
    const dailyMap = new Map<string, { present: number; absent: number; onLeave: number }>();
    for (const r of records) {
      const dayKey = r.date.toISOString().split('T')[0];
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { present: 0, absent: 0, onLeave: 0 });
      }
      const entry = dailyMap.get(dayKey)!;
      if (r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.HALF_DAY) {
        entry.present += 1;
      } else if (r.status === AttendanceStatus.ABSENT) {
        entry.absent += 1;
      } else if (r.status === AttendanceStatus.ON_LEAVE) {
        entry.onLeave += 1;
      }
    }

    const dailyTimeline = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        ...counts,
      }));

    return {
      year,
      month,
      totalRecords,
      statusCounts,
      overallPresenceRate,
      lateness: {
        lateCount: latenessStats._count.id,
        totalLateMinutes: latenessStats._sum.lateMinutes || 0,
      },
      dailyTimeline,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Leave Utilization Analytics
  // ---------------------------------------------------------------------------

  /**
   * Generates leave consumption metrics by leave type, approval ratios, and department comparisons.
   */
  async getLeaveAnalytics(
    organizationId: string,
    query: ReportQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    const year = query.year || new Date().getUTCFullYear();
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const where: Prisma.LeaveRequestWhereInput = {
      organizationId,
      startDate: { gte: startOfYear, lte: endOfYear },
    };

    if (query.departmentId) {
      where.employee = { departmentId: query.departmentId };
    }

    const [requests, leaveTypes] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
          employee: { select: { departmentId: true, department: { select: { name: true } } } },
        },
      }),
      this.prisma.leaveType.findMany({
        where: { organizationId },
        select: { id: true, name: true, code: true, isPaid: true },
      }),
    ]);

    // Grouping by status
    const statusCounts = {
      APPROVED: 0,
      PENDING: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };

    // Grouping by leave type
    const byLeaveType: Record<string, { name: string; code: string; isPaid: boolean; totalDays: number; count: number }> = {};
    for (const lt of leaveTypes) {
      byLeaveType[lt.id] = {
        name: lt.name,
        code: lt.code,
        isPaid: lt.isPaid,
        totalDays: 0,
        count: 0,
      };
    }

    // Grouping by department
    const byDepartment: Record<string, { name: string; totalDays: number }> = {};

    for (const req of requests) {
      statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;

      if (req.status === LeaveRequestStatus.APPROVED) {
        const days = Number(req.totalDays);

        if (byLeaveType[req.leaveTypeId]) {
          byLeaveType[req.leaveTypeId].totalDays += days;
          byLeaveType[req.leaveTypeId].count += 1;
        }

        const deptName = req.employee?.department?.name || 'General';
        if (!byDepartment[deptName]) {
          byDepartment[deptName] = { name: deptName, totalDays: 0 };
        }
        byDepartment[deptName].totalDays += days;
      }
    }

    return {
      year,
      totalRequests: requests.length,
      statusCounts,
      byLeaveType: Object.values(byLeaveType),
      byDepartment: Object.values(byDepartment),
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Payroll & Statutory Liabilities Analytics
  // ---------------------------------------------------------------------------

  /**
   * Generates month-on-month payroll cost trends, gross/net distribution, and
   * statutory EPF and Professional Tax liabilities. Restricted to Finance, HR, and Super Admin.
   */
  async getPayrollAnalytics(
    organizationId: string,
    query: ReportQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    if (
      currentUser.role !== Role.CLIENT_SUPER_ADMIN &&
      currentUser.role !== Role.HR_ADMIN &&
      currentUser.role !== Role.FINANCE
    ) {
      throw new ForbiddenException('You do not have permission to view financial payroll analytics');
    }

    const year = query.year || new Date().getUTCFullYear();

    const batches = await this.prisma.payrollBatch.findMany({
      where: { organizationId, year },
      orderBy: { month: 'asc' },
      include: {
        payslips: {
          select: {
            nominalGross: true,
            earnedGross: true,
            earnedBasic: true,
            employeePf: true,
            employerPf: true,
            professionalTax: true,
            totalDeductions: true,
            netPay: true,
            employee: { select: { department: { select: { name: true } } } },
          },
        },
      },
    });

    let totalYearGross = 0;
    let totalYearNet = 0;
    let totalYearDeductions = 0;
    let totalEmployeePf = 0;
    let totalEmployerPf = 0;
    let totalProfessionalTax = 0;

    const monthlyTrends: Array<{
      month: number;
      batchName: string;
      status: string;
      totalGross: number;
      totalDeductions: number;
      totalNetPay: number;
      employeeCount: number;
    }> = [];

    const departmentCostMap = new Map<string, number>();

    for (const batch of batches) {
      const gross = Number(batch.totalGrossPay);
      const deductions = Number(batch.totalDeductions);
      const net = Number(batch.totalNetPay);

      totalYearGross += gross;
      totalYearDeductions += deductions;
      totalYearNet += net;

      monthlyTrends.push({
        month: batch.month,
        batchName: `Payroll ${batch.year}-${String(batch.month).padStart(2, '0')}`,
        status: batch.status,
        totalGross: gross,
        totalDeductions: deductions,
        totalNetPay: net,
        employeeCount: batch.totalEmployees,
      });

      for (const slip of batch.payslips) {
        totalEmployeePf += Number(slip.employeePf);
        totalEmployerPf += Number(slip.employerPf);
        totalProfessionalTax += Number(slip.professionalTax);

        const deptName = slip.employee?.department?.name || 'General';
        departmentCostMap.set(
          deptName,
          (departmentCostMap.get(deptName) || 0) + Number(slip.netPay),
        );
      }
    }

    const departmentDistribution = Array.from(departmentCostMap.entries()).map(
      ([department, totalNet]) => ({
        department,
        totalNet: Number(totalNet.toFixed(2)),
        percentage:
          totalYearNet > 0
            ? Number(((totalNet / totalYearNet) * 100).toFixed(1))
            : 0,
      }),
    );

    return {
      year,
      summary: {
        totalYearGross: Number(totalYearGross.toFixed(2)),
        totalYearDeductions: Number(totalYearDeductions.toFixed(2)),
        totalYearNet: Number(totalYearNet.toFixed(2)),
        batchCount: batches.length,
      },
      statutoryLiabilities: {
        totalEmployeePf: Number(totalEmployeePf.toFixed(2)),
        totalEmployerPf: Number(totalEmployerPf.toFixed(2)),
        totalCombinedPf: Number((totalEmployeePf + totalEmployerPf).toFixed(2)),
        totalProfessionalTax: Number(totalProfessionalTax.toFixed(2)),
        totalStatutoryLiabilities: Number(
          (totalEmployeePf + totalEmployerPf + totalProfessionalTax).toFixed(2),
        ),
      },
      monthlyTrends,
      departmentDistribution,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Talent Lifecycle & Attrition Analytics
  // ---------------------------------------------------------------------------

  /**
   * Generates Onboarding funnel conversion rates, exit reasons, and average
   * exit interview feedback ratings.
   */
  async getLifecycleAnalytics(
    organizationId: string,
    currentUser: AuthenticatedUser,
  ) {
    const [
      onboardingStatusGroups,
      totalCandidates,
      exitTypeGroups,
      exitReasonGroups,
      interviewStats,
    ] = await Promise.all([
      this.prisma.onboardingCandidate.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.onboardingCandidate.count({ where: { organizationId } }),
      this.prisma.exitRequest.groupBy({
        by: ['exitType'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.exitInterview.groupBy({
        by: ['reasonCategory'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.exitInterview.aggregate({
        where: { organizationId },
        _count: { id: true },
        _avg: {
          companyCultureRating: true,
          managementRating: true,
          workLifeBalanceRating: true,
          compensationRating: true,
        },
      }),
    ]);

    // Onboarding conversion funnel
    const onboardingFunnel: Record<string, number> = {
      INVITED: 0,
      PREBOARDING_SUBMITTED: 0,
      VERIFICATION_IN_PROGRESS: 0,
      READY_FOR_CONVERSION: 0,
      CONVERTED: 0,
      REJECTED: 0,
    };

    for (const g of onboardingStatusGroups) {
      onboardingFunnel[g.status] = g._count;
    }

    const convertedCount = onboardingFunnel.CONVERTED || 0;
    const conversionRate =
      totalCandidates > 0
        ? Number(((convertedCount / totalCandidates) * 100).toFixed(1))
        : 0;

    // Exit reason distribution
    const exitReasons = exitReasonGroups.map((g) => ({
      reasonCategory: g.reasonCategory,
      count: g._count,
    }));

    const exitTypes = exitTypeGroups.map((g) => ({
      exitType: g.exitType,
      count: g._count,
    }));

    return {
      onboarding: {
        totalCandidates,
        convertedCount,
        conversionRate,
        funnel: onboardingFunnel,
      },
      offboarding: {
        totalExitInterviews: interviewStats._count.id,
        exitTypes,
        exitReasons,
        averageRatings: {
          culture: Number((interviewStats._avg.companyCultureRating || 0).toFixed(1)),
          management: Number((interviewStats._avg.managementRating || 0).toFixed(1)),
          workLifeBalance: Number((interviewStats._avg.workLifeBalanceRating || 0).toFixed(1)),
          compensation: Number((interviewStats._avg.compensationRating || 0).toFixed(1)),
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 7. CSV Export Generator
  // ---------------------------------------------------------------------------

  /**
   * Generates a downloadable RFC 4180 CSV string for the requested report domain.
   */
  async exportReportCsv(
    organizationId: string,
    reportType: string,
    query: ReportQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ filename: string; csv: string }> {
    const timestamp = new Date().toISOString().split('T')[0];

    switch (reportType.toLowerCase()) {
      case 'headcount': {
        const employees = await this.prisma.employee.findMany({
          where: { organizationId, deletedAt: null },
          orderBy: { employeeCode: 'asc' },
          include: {
            department: { select: { name: true } },
            designation: { select: { name: true } },
            grade: { select: { name: true } },
            location: { select: { name: true } },
          },
        });

        const columns = [
          { header: 'Employee Code', key: 'employeeCode' },
          { header: 'First Name', key: 'firstName' },
          { header: 'Last Name', key: 'lastName' },
          { header: 'Email', key: 'personalEmail' },
          { header: 'Department', key: 'department' },
          { header: 'Designation', key: 'designation' },
          { header: 'Grade', key: 'grade' },
          { header: 'Location', key: 'location' },
          { header: 'Employment Type', key: 'employmentType' },
          { header: 'Status', key: 'employmentStatus' },
          { header: 'Date of Joining', key: 'dateOfJoining' },
        ];

        const rows = employees.map((emp) => ({
          employeeCode: emp.employeeCode,
          firstName: emp.firstName,
          lastName: emp.lastName,
          personalEmail: emp.personalEmail || '',
          department: emp.department?.name || '',
          designation: emp.designation?.name || '',
          grade: emp.grade?.name || '',
          location: emp.location?.name || '',
          employmentType: emp.employmentType,
          employmentStatus: emp.employmentStatus,
          dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.toISOString().split('T')[0] : '',
        }));

        return {
          filename: `planetu_headcount_master_${timestamp}.csv`,
          csv: generateCsv(columns, rows),
        };
      }

      case 'attendance': {
        const year = query.year || new Date().getUTCFullYear();
        const month = query.month || new Date().getUTCMonth() + 1;
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));

        const records = await this.prisma.attendanceRecord.findMany({
          where: {
            organizationId,
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          orderBy: [{ date: 'asc' }, { employee: { employeeCode: 'asc' } }],
          include: {
            employee: {
              select: {
                employeeCode: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
        });

        const columns = [
          { header: 'Date', key: 'date' },
          { header: 'Employee Code', key: 'employeeCode' },
          { header: 'Employee Name', key: 'employeeName' },
          { header: 'Department', key: 'department' },
          { header: 'Check In', key: 'checkIn' },
          { header: 'Check Out', key: 'checkOut' },
          { header: 'Active Minutes', key: 'activeMinutes' },
          { header: 'Status', key: 'status' },
          { header: 'Is Late', key: 'isLate' },
        ];

        const rows = records.map((r) => ({
          date: r.date.toISOString().split('T')[0],
          employeeCode: r.employee.employeeCode,
          employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
          department: r.employee.department?.name || '',
          checkIn: r.checkInTime ? r.checkInTime.toISOString() : '',
          checkOut: r.checkOutTime ? r.checkOutTime.toISOString() : '',
          activeMinutes: r.totalActiveMinutes || 0,
          status: r.status,
          isLate: r.isLate ? 'YES' : 'NO',
        }));

        return {
          filename: `planetu_attendance_${year}_${month}_${timestamp}.csv`,
          csv: generateCsv(columns, rows),
        };
      }

      case 'payroll': {
        if (
          currentUser.role !== Role.CLIENT_SUPER_ADMIN &&
          currentUser.role !== Role.HR_ADMIN &&
          currentUser.role !== Role.FINANCE
        ) {
          throw new ForbiddenException('Access denied to payroll export');
        }

        const batches = await this.prisma.payrollBatch.findMany({
          where: { organizationId },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        });

        const columns = [
          { header: 'Batch Name', key: 'batchName' },
          { header: 'Year', key: 'year' },
          { header: 'Month', key: 'month' },
          { header: 'Employees Count', key: 'totalEmployees' },
          { header: 'Total Gross', key: 'totalGross' },
          { header: 'Total Deductions', key: 'totalDeductions' },
          { header: 'Total Net Pay', key: 'totalNetPay' },
          { header: 'Status', key: 'status' },
        ];

        const rows = batches.map((b) => ({
          batchName: `Payroll ${b.year}-${String(b.month).padStart(2, '0')}`,
          year: b.year,
          month: b.month,
          totalEmployees: b.totalEmployees,
          totalGross: Number(b.totalGrossPay),
          totalDeductions: Number(b.totalDeductions),
          totalNetPay: Number(b.totalNetPay),
          status: b.status,
        }));

        return {
          filename: `planetu_payroll_batches_${timestamp}.csv`,
          csv: generateCsv(columns, rows),
        };
      }

      case 'leaves': {
        const year = query.year || new Date().getUTCFullYear();
        const startOfYear = new Date(Date.UTC(year, 0, 1));
        const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

        const leaves = await this.prisma.leaveRequest.findMany({
          where: { organizationId, startDate: { gte: startOfYear, lte: endOfYear } },
          orderBy: { startDate: 'desc' },
          include: {
            leaveType: { select: { name: true, code: true } },
            employee: {
              select: {
                employeeCode: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
        });

        const columns = [
          { header: 'Employee Code', key: 'employeeCode' },
          { header: 'Employee Name', key: 'employeeName' },
          { header: 'Department', key: 'department' },
          { header: 'Leave Type', key: 'leaveType' },
          { header: 'Start Date', key: 'startDate' },
          { header: 'End Date', key: 'endDate' },
          { header: 'Total Days', key: 'totalDays' },
          { header: 'Status', key: 'status' },
          { header: 'Reason', key: 'reason' },
        ];

        const rows = leaves.map((l) => ({
          employeeCode: l.employee.employeeCode,
          employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
          department: l.employee.department?.name || '',
          leaveType: l.leaveType.name,
          startDate: l.startDate.toISOString().split('T')[0],
          endDate: l.endDate.toISOString().split('T')[0],
          totalDays: Number(l.totalDays),
          status: l.status,
          reason: l.reason,
        }));

        return {
          filename: `planetu_leave_applications_${year}_${timestamp}.csv`,
          csv: generateCsv(columns, rows),
        };
      }

      default:
        throw new BadRequestException(
          `Unsupported reportType '${reportType}'. Supported: headcount, attendance, payroll, leaves`,
        );
    }
  }
}
