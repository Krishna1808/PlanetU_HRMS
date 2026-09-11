import { jest } from '@jest/globals';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { ShiftService } from '../src/modules/shifts/shift.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ShiftService (Module 3: Shift Management & Architecture Rule 4)', () => {
  let service: ShiftService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      shift: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      employeeShiftAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    service = new ShiftService(mockPrisma as unknown as PrismaService);
  });

  describe('Duration & Overnight Math (calculateNetWorkMinutes)', () => {
    it('calculates regular day shift duration (09:00 to 18:00 with 60 min break = 480 mins / 8 hrs)', () => {
      const netMinutes = service.calculateNetWorkMinutes('09:00', '18:00', 60, false);
      expect(netMinutes).toBe(480);
    });

    it('calculates cross-midnight overnight shift duration (22:00 to 06:00 with 60 min break = 420 mins / 7 hrs)', () => {
      const netMinutes = service.calculateNetWorkMinutes('22:00', '06:00', 60, true);
      expect(netMinutes).toBe(420);
    });

    it('auto-detects overnight span when endTime < startTime without explicit isOvernight flag', () => {
      const netMinutes = service.calculateNetWorkMinutes('21:30', '05:30', 45);
      // Span: (1440 - 1290) + 330 = 150 + 330 = 480 mins. Net: 480 - 45 = 435 mins
      expect(netMinutes).toBe(435);
    });
  });

  describe('createShift (Uniqueness & Threshold Validation)', () => {
    const orgId = 'org-test-123';

    it('throws ConflictException if shift code already exists in the organization', async () => {
      mockPrisma.shift.findFirst.mockResolvedValueOnce({ id: 'shift-1', code: 'GEN' });

      await expect(
        service.createShift(orgId, {
          name: 'General Day Shift',
          code: 'gen',
          startTime: '09:00',
          endTime: '18:00',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if shift name already exists in the organization', async () => {
      mockPrisma.shift.findFirst
        .mockResolvedValueOnce(null) // code check
        .mockResolvedValueOnce({ id: 'shift-1', name: 'General Day Shift' }); // name check

      await expect(
        service.createShift(orgId, {
          name: 'General Day Shift',
          code: 'GEN2',
          startTime: '09:00',
          endTime: '18:00',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if fullDayThreshold exceeds net work duration', async () => {
      mockPrisma.shift.findFirst.mockResolvedValue(null);

      // 09:00 to 14:00 (5h = 300m) - 60m break = 240m net. fullDayThreshold = 300m (exceeds 240)
      await expect(
        service.createShift(orgId, {
          name: 'Part-Time Shift',
          code: 'PT',
          startTime: '09:00',
          endTime: '14:00',
          breakDurationMinutes: 60,
          fullDayThresholdMinutes: 300,
          halfDayThresholdMinutes: 120,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates shift template and unsets existing default if new shift is default', async () => {
      mockPrisma.shift.findFirst.mockResolvedValue(null);
      mockPrisma.shift.create.mockResolvedValue({
        id: 'shift-new',
        organizationId: orgId,
        code: 'GEN',
        name: 'General Shift',
        isDefault: true,
      });

      const result = await service.createShift(orgId, {
        name: 'General Shift',
        code: 'GEN',
        startTime: '09:00',
        endTime: '18:00',
        isDefault: true,
      });

      expect(mockPrisma.shift.updateMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
      expect(result.id).toBe('shift-new');
    });
  });

  describe('assignShift (Append-Only Ledger - Architecture Rule #4)', () => {
    const orgId = 'org-test-123';
    const empId = 'emp-456';
    const shiftId = 'shift-789';

    it('closes prior active assignment (setting effectiveTo) and inserts new active assignment', async () => {
      mockPrisma.shift.findFirst.mockResolvedValue({
        id: shiftId,
        organizationId: orgId,
        isActive: true,
      });
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: empId,
        organizationId: orgId,
        deletedAt: null,
      });

      const existingActiveAssignment = {
        id: 'assign-old',
        employeeId: empId,
        shiftId: 'shift-old',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      };
      mockPrisma.employeeShiftAssignment.findFirst.mockResolvedValue(existingActiveAssignment);

      const newEffectiveFrom = '2026-09-01T00:00:00.000Z';
      mockPrisma.employeeShiftAssignment.create.mockResolvedValue({
        id: 'assign-new',
        employeeId: empId,
        shiftId,
        effectiveFrom: new Date(newEffectiveFrom),
        effectiveTo: null,
        weeklyOffDays: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
      });

      const result = await service.assignShift(orgId, {
        employeeId: empId,
        shiftId,
        effectiveFrom: newEffectiveFrom,
        weeklyOffDays: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
      });

      // 1. Verify old assignment was closed with effectiveTo set to new effectiveFrom
      expect(mockPrisma.employeeShiftAssignment.update).toHaveBeenCalledWith({
        where: { id: 'assign-old' },
        data: { effectiveTo: new Date(newEffectiveFrom) },
      });

      // 2. Verify new active assignment was inserted with effectiveTo = null
      expect(mockPrisma.employeeShiftAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: empId,
            shiftId,
            effectiveTo: null,
          }),
        }),
      );

      expect(result.id).toBe('assign-new');
    });

    it('throws NotFoundException if shift is inactive or does not exist', async () => {
      mockPrisma.shift.findFirst.mockResolvedValue(null);

      await expect(
        service.assignShift(orgId, {
          employeeId: empId,
          shiftId: 'non-existent',
          effectiveFrom: '2026-09-01',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEmployeeShiftForDate (Roster Lookup & Default Fallback)', () => {
    const orgId = 'org-test-123';
    const empId = 'emp-456';

    it('returns custom assigned shift when assignment covers the date', async () => {
      const mockShift = { id: 'shift-custom', name: 'Morning Shift', code: 'MORN' };
      mockPrisma.employeeShiftAssignment.findFirst.mockResolvedValue({
        shift: mockShift,
        weeklyOffDays: [DayOfWeek.SUNDAY],
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: null,
      });

      const result = await service.getEmployeeShiftForDate(orgId, empId, new Date('2026-09-11'));
      expect(result.isDefaultFallback).toBe(false);
      expect(result.shift.code).toBe('MORN');
      expect(result.weeklyOffDays).toEqual([DayOfWeek.SUNDAY]);
    });

    it('falls back to organization default shift when employee has no custom assignment', async () => {
      mockPrisma.employeeShiftAssignment.findFirst.mockResolvedValue(null);
      const defaultShift = { id: 'shift-gen', name: 'General Shift', code: 'GEN', isDefault: true };
      mockPrisma.shift.findFirst.mockResolvedValue(defaultShift);

      const result = await service.getEmployeeShiftForDate(orgId, empId, new Date('2026-09-11'));
      expect(result.isDefaultFallback).toBe(true);
      expect(result.shift.code).toBe('GEN');
      expect(result.weeklyOffDays).toEqual([DayOfWeek.SATURDAY, DayOfWeek.SUNDAY]);
    });
  });
});
