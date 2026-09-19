import { jest } from '@jest/globals';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  Role,
  EmploymentStatus,
  LeaveRequestStatus,
  ExitStatus,
  AttendanceStatus,
} from '@prisma/client';
import { ReportsService } from '../src/modules/reports/reports.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('ReportsService (Module 10: Reports & Dashboards Engine)', () => {
  let service: ReportsService;
  let mockPrisma: any;

  const orgId = 'org-rep-100';

  const mockAdminUser: AuthenticatedUser = {
    id: 'user-admin-1',
    organizationId: orgId,
    email: 'admin@planetu.com',
    role: Role.CLIENT_SUPER_ADMIN,
  };

  const mockFinanceUser: AuthenticatedUser = {
    id: 'user-fin-1',
    organizationId: orgId,
    email: 'finance@planetu.com',
    role: Role.FINANCE,
  };

  const mockManagerUser: AuthenticatedUser = {
    id: 'user-mgr-1',
    organizationId: orgId,
    email: 'manager@planetu.com',
    role: Role.MANAGER,
    employeeId: 'emp-mgr-1',
  };

  beforeEach(() => {
    mockPrisma = {
      employee: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      attendanceRecord: {
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      leaveRequest: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      leaveType: {
        findMany: jest.fn(),
      },
      payrollBatch: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      exitRequest: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      exitInterview: {
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      onboardingCandidate: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      department: {
        findMany: jest.fn(),
      },
      designation: {
        findMany: jest.fn(),
      },
      grade: {
        findMany: jest.fn(),
      },
    };

    service = new ReportsService(mockPrisma);
  });

  // ---------------------------------------------------------------------------
  // 1. Executive Overview
  // ---------------------------------------------------------------------------
  describe('getExecutiveOverview', () => {
    it('returns real-time KPI overview metrics across modules', async () => {
      mockPrisma.employee.count
        .mockResolvedValueOnce(50) // activeHeadcount
        .mockResolvedValueOnce(5) // newHiresThisMonth
        .mockResolvedValueOnce(2); // exitsThisMonth

      mockPrisma.attendanceRecord.count
        .mockResolvedValueOnce(45) // todayPunches
        .mockResolvedValueOnce(4); // todayLatePunches

      mockPrisma.payrollBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        totalNetPay: 1250000,
      });

      mockPrisma.leaveRequest.count.mockResolvedValue(3); // pendingLeaves
      mockPrisma.exitRequest.count.mockResolvedValue(1); // pendingExits
      mockPrisma.onboardingCandidate.count.mockResolvedValue(4); // pendingOnboarding

      const overview = await service.getExecutiveOverview(orgId, mockAdminUser);

      expect(overview.activeHeadcount).toBe(50);
      expect(overview.newHiresThisMonth).toBe(5);
      expect(overview.exitsThisMonth).toBe(2);
      expect(overview.presenceRate).toBe(90); // 45/50 = 90%
      expect(overview.currentMonthPayrollExpense).toBe(1250000);
      expect(overview.pendingApprovals.total).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Workforce Demographics
  // ---------------------------------------------------------------------------
  describe('getWorkforceAnalytics', () => {
    it('aggregates demographics by department, grade, gender, and employment type', async () => {
      mockPrisma.employee.count.mockResolvedValue(20);

      mockPrisma.employee.groupBy
        .mockResolvedValueOnce([{ departmentId: 'd-1', _count: 15 }, { departmentId: 'd-2', _count: 5 }])
        .mockResolvedValueOnce([{ designationId: 'des-1', _count: 20 }])
        .mockResolvedValueOnce([{ gradeId: 'g-1', _count: 20 }])
        .mockResolvedValueOnce([{ gender: 'MALE', _count: 12 }, { gender: 'FEMALE', _count: 8 }])
        .mockResolvedValueOnce([{ employmentType: 'FULL_TIME', _count: 20 }]);

      mockPrisma.department.findMany.mockResolvedValue([
        { id: 'd-1', name: 'Engineering', codePrefix: 'ENG' },
        { id: 'd-2', name: 'Human Resources', codePrefix: 'HR' },
      ]);
      mockPrisma.designation.findMany.mockResolvedValue([{ id: 'des-1', name: 'Software Engineer' }]);
      mockPrisma.grade.findMany.mockResolvedValue([{ id: 'g-1', name: 'L2', level: 2 }]);

      const workforce = await service.getWorkforceAnalytics(orgId, mockAdminUser);

      expect(workforce.totalActive).toBe(20);
      expect(workforce.byDepartment.length).toBe(2);
      expect(workforce.byDepartment[0].name).toBe('Engineering');
      expect(workforce.byDepartment[0].percentage).toBe(75);
      expect(workforce.byGender.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Attendance Analytics
  // ---------------------------------------------------------------------------
  describe('getAttendanceAnalytics', () => {
    it('computes presence rates, lateness metrics, and day-by-day punch volume', async () => {
      mockPrisma.attendanceRecord.groupBy.mockResolvedValue([
        { status: AttendanceStatus.PRESENT, _count: 80 },
        { status: AttendanceStatus.HALF_DAY, _count: 10 },
        { status: AttendanceStatus.ABSENT, _count: 10 },
      ]);

      mockPrisma.attendanceRecord.aggregate.mockResolvedValue({
        _count: { id: 12 },
        _sum: { lateMinutes: 180 },
      });

      mockPrisma.attendanceRecord.findMany.mockResolvedValue([
        { date: new Date('2026-09-01'), status: AttendanceStatus.PRESENT },
        { date: new Date('2026-09-01'), status: AttendanceStatus.ABSENT },
      ]);

      const analytics = await service.getAttendanceAnalytics(orgId, { year: 2026, month: 9 }, mockAdminUser);

      expect(analytics.totalRecords).toBe(100);
      expect(analytics.overallPresenceRate).toBe(85); // (80 + 5) / 100 = 85%
      expect(analytics.lateness.lateCount).toBe(12);
      expect(analytics.lateness.totalLateMinutes).toBe(180);
      expect(analytics.dailyTimeline.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Leave Utilization Analytics
  // ---------------------------------------------------------------------------
  describe('getLeaveAnalytics', () => {
    it('computes leave consumption grouped by leave type and department', async () => {
      mockPrisma.leaveType.findMany.mockResolvedValue([
        { id: 'lt-1', name: 'Casual Leave', code: 'CL', isPaid: true },
        { id: 'lt-2', name: 'Sick Leave', code: 'SL', isPaid: true },
      ]);

      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'lr-1',
          status: LeaveRequestStatus.APPROVED,
          totalDays: 2,
          leaveTypeId: 'lt-1',
          employee: { department: { name: 'Engineering' } },
        },
        {
          id: 'lr-2',
          status: LeaveRequestStatus.APPROVED,
          totalDays: 3,
          leaveTypeId: 'lt-1',
          employee: { department: { name: 'Engineering' } },
        },
        {
          id: 'lr-3',
          status: LeaveRequestStatus.REJECTED,
          totalDays: 1,
          leaveTypeId: 'lt-2',
          employee: { department: { name: 'HR' } },
        },
      ]);

      const leaves = await service.getLeaveAnalytics(orgId, { year: 2026 }, mockAdminUser);

      expect(leaves.totalRequests).toBe(3);
      expect(leaves.statusCounts.APPROVED).toBe(2);
      expect(leaves.statusCounts.REJECTED).toBe(1);

      const cl = leaves.byLeaveType.find((l) => l.code === 'CL');
      expect(cl?.totalDays).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Payroll & Statutory Liabilities Analytics
  // ---------------------------------------------------------------------------
  describe('getPayrollAnalytics', () => {
    it('throws ForbiddenException if accessed by a manager without financial role', async () => {
      await expect(
        service.getPayrollAnalytics(orgId, { year: 2026 }, mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('computes monthly trends and statutory liabilities for Finance / HR users', async () => {
      mockPrisma.payrollBatch.findMany.mockResolvedValue([
        {
          id: 'pb-1',
          year: 2026,
          month: 8,
          batchName: 'Payroll 2026-08',
          status: 'DISBURSED',
          totalEmployees: 10,
          totalGrossPay: 500000,
          totalDeductions: 50000,
          totalNetPay: 450000,
          payslips: [
            {
              earnedGross: 500000,
              employeePf: 30000,
              employerPf: 30000,
              professionalTax: 2000,
              netPay: 450000,
              employee: { department: { name: 'Engineering' } },
            },
          ],
        },
      ]);

      const payroll = await service.getPayrollAnalytics(orgId, { year: 2026 }, mockFinanceUser);

      expect(payroll.summary.totalYearGross).toBe(500000);
      expect(payroll.summary.totalYearNet).toBe(450000);
      expect(payroll.statutoryLiabilities.totalEmployeePf).toBe(30000);
      expect(payroll.statutoryLiabilities.totalEmployerPf).toBe(30000);
      expect(payroll.statutoryLiabilities.totalProfessionalTax).toBe(2000);
      expect(payroll.statutoryLiabilities.totalCombinedPf).toBe(60000);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Talent Lifecycle Analytics
  // ---------------------------------------------------------------------------
  describe('getLifecycleAnalytics', () => {
    it('computes onboarding funnel conversion rate and exit interview ratings', async () => {
      mockPrisma.onboardingCandidate.groupBy.mockResolvedValue([
        { status: 'INVITED', _count: 10 },
        { status: 'CONVERTED', _count: 7 },
      ]);
      mockPrisma.onboardingCandidate.count.mockResolvedValue(10);

      mockPrisma.exitRequest.groupBy.mockResolvedValue([
        { exitType: 'RESIGNATION', _count: 2 },
      ]);
      mockPrisma.exitInterview.groupBy.mockResolvedValue([
        { reasonCategory: 'CAREER_GROWTH', _count: 2 },
      ]);
      mockPrisma.exitInterview.aggregate.mockResolvedValue({
        _count: { id: 2 },
        _avg: {
          companyCultureRating: 4.5,
          managementRating: 4.0,
          workLifeBalanceRating: 4.0,
          compensationRating: 3.5,
        },
      });

      const lifecycle = await service.getLifecycleAnalytics(orgId, mockAdminUser);

      expect(lifecycle.onboarding.conversionRate).toBe(70); // 7/10 = 70%
      expect(lifecycle.offboarding.totalExitInterviews).toBe(2);
      expect(lifecycle.offboarding.averageRatings.culture).toBe(4.5);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. CSV Export Generator
  // ---------------------------------------------------------------------------
  describe('exportReportCsv', () => {
    it('serializes headcount master report into RFC 4180 CSV format', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([
        {
          employeeCode: 'ENG-0001',
          firstName: 'Rohan',
          lastName: 'Sharma',
          personalEmail: 'rohan@planetu.com',
          department: { name: 'Engineering' },
          designation: { name: 'Software Engineer' },
          grade: { name: 'L2' },
          location: { name: 'Bengaluru' },
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          dateOfJoining: new Date('2026-01-15'),
        },
      ]);

      const result = await service.exportReportCsv(orgId, 'headcount', {}, mockAdminUser);

      expect(result.filename).toContain('planetu_headcount_master');
      expect(result.csv).toContain('Employee Code,First Name,Last Name');
      expect(result.csv).toContain('ENG-0001,Rohan,Sharma');
    });

    it('rejects unsupported report types with BadRequestException', async () => {
      await expect(
        service.exportReportCsv(orgId, 'unknown_type', {}, mockAdminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
