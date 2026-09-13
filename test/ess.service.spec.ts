import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, DayOfWeek, Role } from '@prisma/client';
import { EssService } from '../src/modules/ess/ess.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmployeeService } from '../src/modules/employees/services/employee.service';
import { ShiftService } from '../src/modules/shifts/shift.service';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { LeaveService } from '../src/modules/leaves/leave.service';
import { PayrollService } from '../src/modules/payroll/payroll.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('EssService (Module 7: Employee Self-Service Aggregation Engine)', () => {
  let service: EssService;
  let mockPrisma: any;
  let mockEmployeeService: any;
  let mockShiftService: any;
  let mockAttendanceService: any;
  let mockLeaveService: any;
  let mockPayrollService: any;

  const orgId = 'org-test-123';
  const empId = 'emp-456';
  const managerEmpId = 'mgr-789';

  const regularEmployeeUser: AuthenticatedUser = {
    id: 'user-1',
    organizationId: orgId,
    email: 'john@planetu.com',
    role: Role.EMPLOYEE,
    employeeId: empId,
  };

  const managerUser: AuthenticatedUser = {
    id: 'user-2',
    organizationId: orgId,
    email: 'sarah@planetu.com',
    role: Role.MANAGER,
    employeeId: managerEmpId,
  };

  beforeEach(() => {
    mockPrisma = {
      employee: {
        count: jest.fn().mockResolvedValue(3),
      },
    };

    mockEmployeeService = {
      getEmployeeById: jest.fn().mockResolvedValue({
        id: empId,
        organizationId: orgId,
        employeeCode: 'ENG-0001',
        firstName: 'John',
        lastName: 'Doe',
        personalEmail: 'john.personal@example.com',
        phone: '+919876543210',
        dateOfJoining: new Date('2025-01-15'),
        department: { name: 'Engineering' },
        designation: { name: 'Senior Software Engineer' },
        grade: { name: 'L3' },
        location: { name: 'Mumbai HQ' },
        reportingManager: { firstName: 'Sarah', lastName: 'Connor' },
      }),
      updateEmployee: jest.fn().mockResolvedValue({
        id: empId,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+919999988888',
      }),
    };

    mockShiftService = {
      getEmployeeShiftForDate: jest.fn().mockResolvedValue({
        shift: {
          id: 'shift-gen',
          name: 'General Day Shift',
          code: 'GEN',
          startTime: '09:00',
          endTime: '18:00',
          isOvernight: false,
          gracePeriodMinutes: 15,
        },
        weeklyOffDays: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
      }),
    };

    mockAttendanceService = {
      getTodayAttendance: jest.fn().mockResolvedValue({
        date: new Date('2026-09-13'),
        status: AttendanceStatus.PRESENT,
        checkInTime: new Date('2026-09-13T09:05:00Z'),
        checkOutTime: null,
        totalActiveMinutes: 180,
        isLate: false,
        isHalfDay: false,
        isWeeklyOff: false,
      }),
      getFinalizedPayableDays: jest.fn().mockResolvedValue({
        employeeId: empId,
        year: 2026,
        month: 9,
        totalMonthDays: 30,
        payableDays: 28,
        unexcusedAbsenceDays: 0,
        lwpDays: 2,
      }),
      getEmployeeAttendanceHistory: jest.fn().mockResolvedValue([
        {
          date: new Date('2026-09-12'),
          status: AttendanceStatus.PRESENT,
          checkInTime: new Date('2026-09-12T09:00:00Z'),
          checkOutTime: new Date('2026-09-12T18:00:00Z'),
        },
      ]),
    };

    mockLeaveService = {
      getEmployeeLeaveBalances: jest.fn().mockResolvedValue({
        balances: [
          {
            leaveTypeId: 'lt-cl',
            leaveTypeName: 'Casual Leave',
            leaveTypeCode: 'CL',
            isPaid: true,
            daysAllowedPerYear: 12,
            currentBalance: 12,
            pendingDays: 1,
            availableBalance: 11,
          },
          {
            leaveTypeId: 'lt-sl',
            leaveTypeName: 'Sick Leave',
            leaveTypeCode: 'SL',
            isPaid: true,
            daysAllowedPerYear: 12,
            currentBalance: 10,
            pendingDays: 0,
            availableBalance: 10,
          },
        ],
      }),
      listEmployeeRequests: jest.fn().mockResolvedValue([
        {
          id: 'lr-1',
          leaveType: { name: 'Casual Leave', code: 'CL' },
          startDate: new Date('2026-09-20'),
          endDate: new Date('2026-09-20'),
          totalDays: 1,
          status: 'PENDING',
          reason: 'Personal errand',
          appliedAt: new Date('2026-09-10'),
        },
      ]),
      listPendingRequests: jest.fn().mockResolvedValue([
        {
          id: 'lr-sub-1',
          employee: { firstName: 'Alice', lastName: 'Smith' },
          totalDays: 2,
        },
      ]),
    };

    mockPayrollService = {
      getMyPayslips: jest.fn().mockResolvedValue([
        {
          id: 'ps-1',
          payableDays: 30,
          earnedGross: 50000.0,
          totalDeductions: 2000.0,
          netPay: 48000.0,
          payrollBatch: {
            year: 2026,
            month: 8,
            status: 'DISBURSED',
          },
        },
      ]),
    };

    service = new EssService(
      mockPrisma as unknown as PrismaService,
      mockEmployeeService as unknown as EmployeeService,
      mockShiftService as unknown as ShiftService,
      mockAttendanceService as unknown as AttendanceService,
      mockLeaveService as unknown as LeaveService,
      mockPayrollService as unknown as PayrollService,
    );
  });

  // ---------------------------------------------------------------------------
  // 1. Unified Home Dashboard Aggregation
  // ---------------------------------------------------------------------------
  describe('getDashboard (Unified Single Round-Trip Aggregation)', () => {
    it('should aggregate profile, shift, attendance, leaves, and payslips for standard employee', async () => {
      const dashboard = await service.getDashboard(orgId, regularEmployeeUser);

      expect(dashboard).toBeDefined();

      // Profile verification
      expect(dashboard.profile).toEqual(
        expect.objectContaining({
          employeeCode: 'ENG-0001',
          firstName: 'John',
          lastName: 'Doe',
          department: 'Engineering',
          designation: 'Senior Software Engineer',
          reportingManager: 'Sarah Connor',
        }),
      );

      // Shift verification
      expect(dashboard.shift).toEqual(
        expect.objectContaining({
          shiftName: 'General Day Shift',
          shiftCode: 'GEN',
          startTime: '09:00',
          endTime: '18:00',
        }),
      );

      // Today attendance verification
      expect(dashboard.todayAttendance).toEqual(
        expect.objectContaining({
          status: AttendanceStatus.PRESENT,
          totalActiveMinutes: 180,
          isLate: false,
        }),
      );

      // Leave balances verification
      expect(dashboard.leaveBalances.length).toBe(2);
      expect(dashboard.leaveBalances[0]).toEqual(
        expect.objectContaining({
          name: 'Casual Leave',
          code: 'CL',
          availableBalance: 11,
        }),
      );

      // Recent requests verification
      expect(dashboard.recentLeaveRequests.length).toBe(1);
      expect(dashboard.recentLeaveRequests[0].leaveTypeCode).toBe('CL');

      // Latest payslip snapshot
      expect(dashboard.latestPayslip).toEqual(
        expect.objectContaining({
          year: 2026,
          month: 8,
          netPay: 48000.0,
          status: 'DISBURSED',
        }),
      );

      // Manager overview must be omitted for regular employee
      expect(dashboard.managerOverview).toBeUndefined();
    });

    it('should include manager overview with direct reports count & pending approvals for MANAGER role', async () => {
      const dashboard = await service.getDashboard(orgId, managerUser);

      expect(dashboard.managerOverview).toBeDefined();
      expect(dashboard.managerOverview).toEqual({
        isManager: true,
        directReportsCount: 3,
        pendingLeaveApprovalsCount: 1,
      });

      expect(mockPrisma.employee.count).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          reportingManagerId: managerEmpId,
          deletedAt: null,
        },
      });
      expect(mockLeaveService.listPendingRequests).toHaveBeenCalledWith(orgId, managerUser);
    });

    it('should throw BadRequestException if user is not linked to an employee profile', async () => {
      const unlinkedUser: AuthenticatedUser = {
        id: 'u-unlinked',
        organizationId: orgId,
        email: 'unlinked@planetu.com',
        role: Role.EMPLOYEE,
        employeeId: null,
      };

      await expect(service.getDashboard(orgId, unlinkedUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Profile Viewing & Self-Service Edit (FR-EMP-006)
  // ---------------------------------------------------------------------------
  describe('Profile Self-Service (FR-EMP-006)', () => {
    it('should return profile with editableFields and restrictedFields metadata', async () => {
      const result = await service.getMyProfile(orgId, regularEmployeeUser);

      expect(result.profile).toBeDefined();
      expect(result.editableFields).toContain('phone');
      expect(result.editableFields).toContain('personalEmail');
      expect(result.editableFields).toContain('emergencyContactName');
      expect(result.restrictedFields).toContain('baseSalary');
      expect(result.restrictedFields).toContain('department');
      expect(result.restrictedFields).toContain('employeeCode');
    });

    it('should delegate low-risk field updates to EmployeeService', async () => {
      const updateDto = {
        phone: '+919999988888',
        emergencyContactName: 'Jane Doe',
      };

      await service.updateMyProfile(orgId, updateDto, regularEmployeeUser);

      expect(mockEmployeeService.updateEmployee).toHaveBeenCalledWith(
        orgId,
        empId,
        updateDto,
        regularEmployeeUser,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Attendance, Leaves, and Payslips Sub-Views
  // ---------------------------------------------------------------------------
  describe('Sub-Views Aggregation', () => {
    it('should retrieve month attendance history and finalized summary', async () => {
      const att = await service.getMyAttendance(orgId, regularEmployeeUser, 2026, 9);

      expect(att.year).toBe(2026);
      expect(att.month).toBe(9);
      expect(att.finalizedSummary).toBeDefined();
      expect(att.records.length).toBe(1);
      expect(mockAttendanceService.getFinalizedPayableDays).toHaveBeenCalledWith(
        orgId,
        empId,
        2026,
        9,
      );
    });

    it('should retrieve leave balances and application history', async () => {
      const leaves = await service.getMyLeaves(orgId, regularEmployeeUser);

      expect(leaves.balances.length).toBe(2);
      expect(leaves.requests.length).toBe(1);
    });

    it('should retrieve personal payslips', async () => {
      const payslips = await service.getMyPayslips(orgId, regularEmployeeUser);

      expect(payslips.length).toBe(1);
      expect(payslips[0].netPay).toBe(48000.0);
    });

    it('should allow manager to view pending subordinate approvals', async () => {
      const approvals = await service.getManagerPendingApprovals(orgId, managerUser);

      expect(approvals.length).toBe(1);
      expect(mockLeaveService.listPendingRequests).toHaveBeenCalledWith(orgId, managerUser);
    });

    it('should block non-manager from accessing manager pending approvals queue', async () => {
      await expect(
        service.getManagerPendingApprovals(orgId, regularEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
