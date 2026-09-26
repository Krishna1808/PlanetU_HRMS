import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MastersService } from '../src/modules/masters/masters.service';

describe('Holiday Calendar Master (MastersService)', () => {
  let service: MastersService;
  let mockPrisma: any;

  const orgId = 'org-hol-123';

  beforeEach(() => {
    mockPrisma = {
      holiday: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
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

    service = new MastersService(mockPrisma);
  });

  describe('getHolidays', () => {
    it('returns holidays filtered by organization and year', async () => {
      const mockHolidays = [
        {
          id: 'h-1',
          organizationId: orgId,
          name: 'Republic Day',
          date: new Date('2026-01-26'),
          year: 2026,
          isRestricted: false,
          location: null,
        },
        {
          id: 'h-2',
          organizationId: orgId,
          name: 'Diwali',
          date: new Date('2026-11-08'),
          year: 2026,
          isRestricted: false,
          location: null,
        },
      ];

      mockPrisma.holiday.findMany.mockResolvedValue(mockHolidays);

      const result = await service.getHolidays(orgId, { year: 2026 });

      expect(mockPrisma.holiday.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, year: 2026 },
        orderBy: { date: 'asc' },
        include: {
          location: {
            select: { id: true, name: true, city: true },
          },
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Republic Day');
    });

    it('filters by locationId including company-wide holidays', async () => {
      mockPrisma.holiday.findMany.mockResolvedValue([]);

      await service.getHolidays(orgId, { locationId: 'loc-blr' });

      expect(mockPrisma.holiday.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          OR: [{ locationId: 'loc-blr' }, { locationId: null }],
        },
        orderBy: { date: 'asc' },
        include: {
          location: {
            select: { id: true, name: true, city: true },
          },
        },
      });
    });
  });

  describe('createHoliday', () => {
    it('creates a mandatory public holiday successfully', async () => {
      mockPrisma.holiday.findFirst.mockResolvedValue(null);
      mockPrisma.holiday.create.mockResolvedValue({
        id: 'h-new',
        organizationId: orgId,
        name: 'Independence Day',
        date: new Date('2026-08-15'),
        year: 2026,
        isRestricted: false,
        location: null,
      });

      const result = await service.createHoliday(orgId, {
        name: 'Independence Day',
        date: '2026-08-15',
        isRestricted: false,
        description: 'National public holiday',
      });

      expect(result.name).toBe('Independence Day');
      expect(mockPrisma.holiday.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgId,
          name: 'Independence Day',
          year: 2026,
          isRestricted: false,
        }),
        include: expect.any(Object),
      });
    });

    it('throws ConflictException if holiday on the same date with same name exists', async () => {
      mockPrisma.holiday.findFirst.mockResolvedValue({
        id: 'h-existing',
        name: 'Republic Day',
      });

      await expect(
        service.createHoliday(orgId, {
          name: 'Republic Day',
          date: '2026-01-26',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('validates location exists if locationId is passed', async () => {
      mockPrisma.location.findFirst.mockResolvedValue(null);

      await expect(
        service.createHoliday(orgId, {
          name: 'Regional Karnataka Rajyotsava',
          date: '2026-11-01',
          locationId: 'loc-invalid',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateHoliday', () => {
    it('updates holiday details', async () => {
      mockPrisma.holiday.findFirst
        .mockResolvedValueOnce({
          id: 'h-1',
          organizationId: orgId,
          name: 'Gandhi Jayanti',
          date: new Date('2026-10-02'),
          year: 2026,
        })
        .mockResolvedValueOnce(null); // No duplicate

      mockPrisma.holiday.update.mockResolvedValue({
        id: 'h-1',
        name: 'Mahatma Gandhi Jayanti',
        description: 'National Gazetted Holiday',
      });

      const updated = await service.updateHoliday(orgId, 'h-1', {
        name: 'Mahatma Gandhi Jayanti',
        description: 'National Gazetted Holiday',
      });

      expect(updated.name).toBe('Mahatma Gandhi Jayanti');
      expect(mockPrisma.holiday.update).toHaveBeenCalled();
    });

    it('throws NotFoundException if holiday does not exist', async () => {
      mockPrisma.holiday.findFirst.mockResolvedValue(null);

      await expect(
        service.updateHoliday(orgId, 'h-nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteHoliday', () => {
    it('deletes an existing holiday', async () => {
      mockPrisma.holiday.findFirst.mockResolvedValue({
        id: 'h-1',
        organizationId: orgId,
        name: 'Optional Holiday',
      });
      mockPrisma.holiday.delete.mockResolvedValue({ id: 'h-1' });

      const res = await service.deleteHoliday(orgId, 'h-1');

      expect(res.success).toBe(true);
      expect(mockPrisma.holiday.delete).toHaveBeenCalledWith({ where: { id: 'h-1' } });
    });

    it('throws NotFoundException when deleting non-existent holiday', async () => {
      mockPrisma.holiday.findFirst.mockResolvedValue(null);

      await expect(service.deleteHoliday(orgId, 'h-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
