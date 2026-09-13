import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  AttendanceStatus,
  DayOfWeek,
  LeaveRequestStatus,
  PunchSource,
} from '@prisma/client';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ShiftService } from '../src/modules/shifts/shift.service';

describe('AttendanceService (Module 4: Attendance & Single Source of Truth for Payable Days)', () => {
  let service: AttendanceService;
  let mockPrisma: any;
  let mockShiftService: any;

  const orgId = 'org-test-123';
  const empId = 'emp-456';

  beforeEach(() => {
    mockPrisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: empId,
          organizationId: orgId,
          employeeCode: 'ENG-0001',
          firstName: 'John',
          lastName: 'Doe',
          deletedAt: null,
        }),
      },
      attendanceRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockShiftService = {
      getEmployeeShiftForDate: jest.fn().mockResolvedValue({
        isDefaultFallback: true,
        shift: {
          id: 'shift-gen',
          name: 'General Day Shift',
          code: 'GEN',
          startTime: '09:00',
          endTime: '18:00',
          gracePeriodMinutes: 15,
          breakDurationMinutes: 60,
          halfDayThresholdMinutes: 240, // 4 hours
          fullDayThresholdMinutes: 480, // 8 hours
        },
        weeklyOffDays: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
        effectiveFrom: null,
        effectiveTo: null,
      }),
    };

    service = new AttendanceService(
      mockPrisma as unknown as PrismaService,
      mockShiftService as unknown as ShiftService,
    );
  });

  // ---------------------------------------------------------------------------
  // 1. Web Check-In & Grace Period Lateness
  // ---------------------------------------------------------------------------

  describe('checkIn (Web Clock-In & Grace Period)', () => {
    it('marks isLate = false when punching in within grace period (09:10 on 09:00 shift with 15m grace)', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.upsert.mockImplementation((args: any) =>
        Promise.resolve({ id: 'rec-1', ...args.create }),
      );

      const checkInTime = new Date('2026-09-15T09:10:00');
      const result = await service.checkIn(orgId, empId, {
        timestamp: checkInTime.toISOString(),
      });

      expect(result.isLate).toBe(false);
      expect(result.lateMinutes).toBe(0);
      expect(result.punchSource).toBe(PunchSource.WEB);
    });

    it('marks isLate = true with accurate lateMinutes when punching in after grace period (09:25 on 09:00 shift)', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.upsert.mockImplementation((args: any) =>
        Promise.resolve({ id: 'rec-2', ...args.create }),
      );

      const checkInTime = new Date('2026-09-15T09:25:00');
      const result = await service.checkIn(orgId, empId, {
        timestamp: checkInTime.toISOString(),
      });

      expect(result.isLate).toBe(true);
      expect(result.lateMinutes).toBe(25);
    });

    it('throws BadRequestException if employee attempts to check in twice on the same calendar day', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-existing',
        checkInTime: new Date('2026-09-15T09:05:00'),
      });

      await expect(
        service.checkIn(orgId, empId, { timestamp: '2026-09-15T09:30:00' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Web Check-Out & Threshold Evaluation
  // ---------------------------------------------------------------------------

  describe('checkOut (Net Active Minutes & Threshold Logic)', () => {
    it('throws BadRequestException if checking out without a prior check-in', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.checkOut(orgId, empId, { timestamp: '2026-09-15T18:00:00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('evaluates status = PRESENT for 9 hours span (540m - 60m break = 480m net active)', async () => {
      const checkInTime = new Date('2026-09-15T09:00:00.000Z');
      const checkOutTime = new Date('2026-09-15T18:00:00.000Z'); // 9 hours = 540m

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-100',
        checkInTime,
        checkOutTime: null,
      });

      mockPrisma.attendanceRecord.update.mockImplementation((args: any) =>
        Promise.resolve({ id: 'rec-100', ...args.data }),
      );

      const result = await service.checkOut(orgId, empId, {
        timestamp: checkOutTime.toISOString(),
      });

      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(result.totalActiveMinutes).toBe(480);
      expect(result.isHalfDay).toBe(false);
      expect(result.isPaid).toBe(true);
    });

    it('evaluates status = HALF_DAY for 6 hours span (360m - 60m break = 300m net active)', async () => {
      const checkInTime = new Date('2026-09-15T09:00:00.000Z');
      const checkOutTime = new Date('2026-09-15T15:00:00.000Z'); // 6 hours = 360m

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-101',
        checkInTime,
        checkOutTime: null,
      });

      mockPrisma.attendanceRecord.update.mockImplementation((args: any) =>
        Promise.resolve({ id: 'rec-101', ...args.data }),
      );

      const result = await service.checkOut(orgId, empId, {
        timestamp: checkOutTime.toISOString(),
      });

      expect(result.status).toBe(AttendanceStatus.HALF_DAY);
      expect(result.totalActiveMinutes).toBe(300);
      expect(result.isHalfDay).toBe(true);
      expect(result.isPaid).toBe(true);
    });

    it('evaluates status = ABSENT if active minutes are below halfDayThreshold (<240 mins)', async () => {
      const checkInTime = new Date('2026-09-15T09:00:00.000Z');
      const checkOutTime = new Date('2026-09-15T11:00:00.000Z'); // 2 hours = 120m - 60m = 60m net

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-102',
        checkInTime,
        checkOutTime: null,
      });

      mockPrisma.attendanceRecord.update.mockImplementation((args: any) =>
        Promise.resolve({ id: 'rec-102', ...args.data }),
      );

      const result = await service.checkOut(orgId, empId, {
        timestamp: checkOutTime.toISOString(),
      });

      expect(result.status).toBe(AttendanceStatus.ABSENT);
      expect(result.isPaid).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. The Authoritative Single Source of Truth for Payroll
  // ---------------------------------------------------------------------------

  describe('getFinalizedPayableDays (Unexcused Absence & Single Source of Truth)', () => {
    it('accurately deducts unexcused absences and calculates payable days for a 30-day month', async () => {
      // Scenario: September 2026 (30 calendar days)
      // - 20 days present (attendance records with PRESENT status)
      // - 8 weekend days (no record, shift weeklyOffDays -> WEEKLY_OFF)
      // - 1 approved paid leave (covered by LeaveRequest -> ON_LEAVE, isPaid: true)
      // - 1 unexcused absence (working day, no punch, no leave -> ABSENT!)

      // 20 recorded present days (Sept 1 to Sept 20, excluding weekends)
      const mockRecords: any[] = [];
      // Let's seed 20 explicit present records on weekdays
      const presentDates = [
        '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', // Tue, Wed, Thu, Fri (4)
        '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', // Mon-Fri (5)
        '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', // Mon-Fri (5)
        '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-28', // Mon-Fri + Mon (6) = 20 total
      ];

      for (const dStr of presentDates) {
        mockRecords.push({
          date: new Date(`${dStr}T00:00:00.000Z`),
          status: AttendanceStatus.PRESENT,
          isPaid: true,
          isHalfDay: false,
        });
      }

      mockPrisma.attendanceRecord.findMany.mockResolvedValue(mockRecords);

      // 1 approved paid leave on Sept 29 (Tuesday)
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        {
          startDate: new Date('2026-09-29T00:00:00.000Z'),
          endDate: new Date('2026-09-29T00:00:00.000Z'),
          status: LeaveRequestStatus.APPROVED,
          isHalfDay: false,
          leaveType: { isPaid: true },
        },
      ]);

      // Sept 30 (Wednesday) is a working day, but employee has NO punch and NO leave request!
      // This will be caught as an UNEXCUSED ABSENCE!

      const result = await service.getFinalizedPayableDays(orgId, empId, 2026, 9);

      expect(result.totalMonthDays).toBe(30);
      expect(result.presentDays).toBe(20);
      expect(result.weeklyOffDays).toBe(8); // 8 weekend days in Sept 2026
      expect(result.paidLeaveDays).toBe(1); // 1 approved paid leave on Sept 29
      expect(result.unexcusedAbsenceDays).toBe(1); // 1 unexcused absence on Sept 30
      expect(result.lwpDays).toBe(0);

      // Payable Days = 20 present + 8 weekly offs + 1 paid leave = 29.0 days!
      expect(result.payableDays).toBe(29.0);
    });
  });
});
