import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DayOfWeek,
  LeaveRequestStatus,
  LeaveTransactionType,
  Role,
} from '@prisma/client';
import { LeaveService } from '../src/modules/leaves/leave.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ShiftService } from '../src/modules/shifts/shift.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('LeaveService (Module 5: Leave Management & Architecture Rule 4)', () => {
  let service: LeaveService;
  let mockPrisma: any;
  let mockShiftService: any;

  const orgId = 'org-test-123';
  const empId = 'emp-456';
  const managerId = 'mgr-789';

  beforeEach(() => {
    mockPrisma = {
      leaveType: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      leaveRequest: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalDays: 0 } }),
      },
      leaveTransaction: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { days: 0 } }),
      },
      employee: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    mockShiftService = {
      getEmployeeShiftForDate: jest.fn().mockImplementation(async (_orgId: string, _empId: string, date: Date) => {
        // Standard weekend: Saturday & Sunday
        return {
          isDefaultFallback: true,
          shift: { id: 'shift-gen', name: 'General Shift', code: 'GEN' },
          weeklyOffDays: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
          effectiveFrom: null,
          effectiveTo: null,
        };
      }),
    };

    service = new LeaveService(
      mockPrisma as unknown as PrismaService,
      mockShiftService as unknown as ShiftService,
    );
  });

  // ---------------------------------------------------------------------------
  // 1. Shift-Aware Working Days Calculation
  // ---------------------------------------------------------------------------

  describe('calculateWorkingDays (Shift-Aware Roster Integration)', () => {
    it('excludes Saturday and Sunday weekly offs from a 4-day leave request (Fri to Mon = 2 working days)', async () => {
      // Friday 2026-09-11 to Monday 2026-09-14
      const start = new Date('2026-09-11T00:00:00.000Z');
      const end = new Date('2026-09-14T00:00:00.000Z');

      const result = await service.calculateWorkingDays(orgId, empId, start, end, false);

      expect(result.workingDays).toBe(2);
      expect(result.nonWorkingDays).toBe(2);
      expect(result.details).toHaveLength(4);

      // Verify Friday is working, Sat/Sun are weekly off, Monday is working
      expect(result.details[0].isWorkingDay).toBe(true);
      expect(result.details[1].isWorkingDay).toBe(false);
      expect(result.details[1].reason).toBe('Weekly Off');
      expect(result.details[2].isWorkingDay).toBe(false);
      expect(result.details[2].reason).toBe('Weekly Off');
      expect(result.details[3].isWorkingDay).toBe(true);
    });

    it('calculates 0.5 working days for half-day on a valid working day', async () => {
      const wednesday = new Date('2026-09-09T00:00:00.000Z');
      const result = await service.calculateWorkingDays(orgId, empId, wednesday, wednesday, true);

      expect(result.workingDays).toBe(0.5);
      expect(result.nonWorkingDays).toBe(0);
    });

    it('throws BadRequestException for half-day spanning different dates', async () => {
      const day1 = new Date('2026-09-09T00:00:00.000Z');
      const day2 = new Date('2026-09-10T00:00:00.000Z');

      await expect(
        service.calculateWorkingDays(orgId, empId, day1, day2, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for half-day on a designated weekly off', async () => {
      const sunday = new Date('2026-09-13T00:00:00.000Z');

      await expect(
        service.calculateWorkingDays(orgId, empId, sunday, sunday, true),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Leave Application & Balance Guards
  // ---------------------------------------------------------------------------

  describe('applyLeave (Validation & Overlap Prevention)', () => {
    const mockUser: AuthenticatedUser = {
      id: 'user-emp',
      organizationId: orgId,
      email: 'john@example.com',
      role: Role.EMPLOYEE,
      employeeId: empId,
    };

    it('throws ConflictException if dates overlap with existing pending/approved leave', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: empId, organizationId: orgId, deletedAt: null });
      mockPrisma.leaveType.findFirst.mockResolvedValue({ id: 'lt-cl', name: 'Casual Leave', isPaid: true, isActive: true });
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'req-existing',
        status: LeaveRequestStatus.PENDING,
      });

      await expect(
        service.applyLeave(
          orgId,
          {
            leaveTypeId: 'lt-cl',
            startDate: '2026-09-15',
            endDate: '2026-09-16',
            reason: 'Personal work',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if requesting more paid leave days than available balance', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: empId, organizationId: orgId, deletedAt: null });
      mockPrisma.leaveType.findFirst.mockResolvedValue({
        id: 'lt-cl',
        name: 'Casual Leave',
        code: 'CL',
        isPaid: true,
        daysAllowedPerYear: 12,
        isActive: true,
      });
      mockPrisma.leaveType.findMany.mockResolvedValue([
        { id: 'lt-cl', name: 'Casual Leave', code: 'CL', isPaid: true, daysAllowedPerYear: 12 },
      ]);
      // Balance is only 1.0 day
      mockPrisma.leaveTransaction.aggregate.mockResolvedValue({ _sum: { days: 1.0 } });
      mockPrisma.leaveRequest.aggregate.mockResolvedValue({ _sum: { totalDays: 0 } });
      mockPrisma.leaveRequest.findFirst.mockResolvedValue(null); // No overlap

      // Requesting 3 working days (Tuesday to Thursday)
      await expect(
        service.applyLeave(
          orgId,
          {
            leaveTypeId: 'lt-cl',
            startDate: '2026-09-15',
            endDate: '2026-09-17',
            reason: 'Vacation',
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates leave request successfully when balance is sufficient', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: empId, organizationId: orgId, deletedAt: null });
      mockPrisma.leaveType.findFirst.mockResolvedValue({
        id: 'lt-cl',
        name: 'Casual Leave',
        code: 'CL',
        isPaid: true,
        daysAllowedPerYear: 12,
        isActive: true,
      });
      mockPrisma.leaveType.findMany.mockResolvedValue([
        { id: 'lt-cl', name: 'Casual Leave', code: 'CL', isPaid: true, daysAllowedPerYear: 12 },
      ]);
      mockPrisma.leaveTransaction.aggregate.mockResolvedValue({ _sum: { days: 10.0 } });
      mockPrisma.leaveRequest.aggregate.mockResolvedValue({ _sum: { totalDays: 0 } });
      mockPrisma.leaveRequest.findFirst.mockResolvedValue(null);

      mockPrisma.leaveRequest.create.mockResolvedValue({
        id: 'req-new',
        employeeId: empId,
        leaveTypeId: 'lt-cl',
        totalDays: 2.0,
        status: LeaveRequestStatus.PENDING,
      });

      const result = await service.applyLeave(
        orgId,
        {
          leaveTypeId: 'lt-cl',
          startDate: '2026-09-15',
          endDate: '2026-09-16',
          reason: 'Family event',
        },
        mockUser,
      );

      expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: empId,
            totalDays: 2,
            status: LeaveRequestStatus.PENDING,
          }),
        }),
      );
      expect(result.id).toBe('req-new');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Approval Workflow & Append-Only Ledger (Rule #4)
  // ---------------------------------------------------------------------------

  describe('actionLeave (Approve & Debit Transaction)', () => {
    const mockManagerUser: AuthenticatedUser = {
      id: 'user-mgr',
      organizationId: orgId,
      email: 'manager@example.com',
      role: Role.MANAGER,
      employeeId: managerId,
    };

    it('approves request and writes immutable debit record into leave_transactions', async () => {
      const mockRequest = {
        id: 'req-100',
        organizationId: orgId,
        employeeId: empId,
        leaveTypeId: 'lt-cl',
        totalDays: 2.0,
        status: LeaveRequestStatus.PENDING,
        startDate: new Date('2026-09-15'),
        endDate: new Date('2026-09-16'),
        leaveType: { id: 'lt-cl', name: 'Casual Leave', isPaid: true },
        employee: { id: empId, reportingManagerId: managerId },
      };

      mockPrisma.leaveRequest.findFirst.mockResolvedValue(mockRequest);
      mockPrisma.leaveTransaction.aggregate.mockResolvedValue({ _sum: { days: 5.0 } }); // 5 days balance
      mockPrisma.leaveRequest.update.mockResolvedValue({ ...mockRequest, status: LeaveRequestStatus.APPROVED });
      mockPrisma.leaveTransaction.findFirst.mockResolvedValue({ balanceAfter: 5.0 });

      await service.actionLeave(
        orgId,
        'req-100',
        { status: 'APPROVED' },
        mockManagerUser,
      );

      // Verify request updated to APPROVED
      expect(mockPrisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-100' },
          data: expect.objectContaining({ status: LeaveRequestStatus.APPROVED }),
        }),
      );

      // Verify immutable debit transaction created with -2.0 days and new balance (5.0 - 2.0 = 3.0)
      expect(mockPrisma.leaveTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: empId,
            leaveTypeId: 'lt-cl',
            transactionType: LeaveTransactionType.DEBIT_APPLICATION,
            days: -2.0,
            balanceAfter: 3.0,
            leaveRequestId: 'req-100',
          }),
        }),
      );
    });

    it('throws ForbiddenException if user is not authorized to approve (not manager or HR)', async () => {
      const mockPeerUser: AuthenticatedUser = {
        id: 'user-peer',
        organizationId: orgId,
        email: 'peer@example.com',
        role: Role.EMPLOYEE,
        employeeId: 'emp-other',
      };

      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'req-100',
        organizationId: orgId,
        status: LeaveRequestStatus.PENDING,
        employee: { reportingManagerId: managerId },
      });

      await expect(
        service.actionLeave(orgId, 'req-100', { status: 'APPROVED' }, mockPeerUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Compensatory Credit on Cancellation
  // ---------------------------------------------------------------------------

  describe('cancelLeave (Compensatory Credit Restoration)', () => {
    it('cancels approved leave and restores balance via credit adjustment row in ledger', async () => {
      const mockApprovedRequest = {
        id: 'req-200',
        organizationId: orgId,
        employeeId: empId,
        leaveTypeId: 'lt-cl',
        totalDays: 2.0,
        status: LeaveRequestStatus.APPROVED,
        leaveType: { id: 'lt-cl', name: 'Casual Leave' },
      };

      mockPrisma.leaveRequest.findFirst.mockResolvedValue(mockApprovedRequest);
      mockPrisma.leaveRequest.update.mockResolvedValue({ ...mockApprovedRequest, status: LeaveRequestStatus.CANCELLED });
      mockPrisma.leaveTransaction.findFirst.mockResolvedValue({ balanceAfter: 3.0 });

      const empUser: AuthenticatedUser = {
        id: 'user-emp',
        organizationId: orgId,
        email: 'john@example.com',
        role: Role.EMPLOYEE,
        employeeId: empId,
      };

      await service.cancelLeave(orgId, 'req-200', empUser);

      // Verify request marked CANCELLED
      expect(mockPrisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-200' },
          data: { status: LeaveRequestStatus.CANCELLED },
        }),
      );

      // Verify compensatory CREDIT_ADJUSTMENT row (+2.0 days) created
      expect(mockPrisma.leaveTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: empId,
            transactionType: LeaveTransactionType.CREDIT_ADJUSTMENT,
            days: 2.0,
            balanceAfter: 5.0, // 3.0 + 2.0
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Payroll LWP Interface (Module 6 Link)
  // ---------------------------------------------------------------------------

  describe('getEmployeeLwpDaysForPeriod (Payroll Payable Days Integration)', () => {
    it('correctly aggregates approved LWP days for the payroll period', async () => {
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'req-lwp-1', totalDays: 2.0 },
        { id: 'req-lwp-2', totalDays: 1.5 },
      ]);

      const lwpDays = await service.getEmployeeLwpDaysForPeriod(
        orgId,
        empId,
        new Date('2026-09-01'),
        new Date('2026-09-30'),
      );

      expect(lwpDays).toBe(3.5);
    });
  });
});
