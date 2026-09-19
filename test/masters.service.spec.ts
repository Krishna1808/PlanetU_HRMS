import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { MastersService } from '../src/modules/masters/masters.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MastersService (Module 2: Org Masters — Departments, Designations, Grades, Locations)', () => {
  let service: MastersService;
  let mockPrisma: any;

  const orgId = 'org-test-1';

  beforeEach(() => {
    mockPrisma = {
      department: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'dept-new',
          organizationId: orgId,
          ...args.data,
        })),
      },
      designation: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'des-new',
          organizationId: orgId,
          ...args.data,
        })),
      },
      grade: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'grade-new',
          organizationId: orgId,
          ...args.data,
        })),
      },
      location: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'loc-new',
          organizationId: orgId,
          ...args.data,
        })),
      },
    };

    service = new MastersService(mockPrisma as unknown as PrismaService);
  });

  // -------------------------------------------------------------------------
  // 1. Departments
  // -------------------------------------------------------------------------

  describe('getDepartments', () => {
    it('returns all departments for the organization ordered by name', async () => {
      const mockDepts = [
        { id: 'dept-1', name: 'Engineering', codePrefix: 'ENG' },
        { id: 'dept-2', name: 'HR', codePrefix: 'HR' },
      ];
      mockPrisma.department.findMany.mockResolvedValue(mockDepts);

      const result = await service.getDepartments(orgId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Engineering');
      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        orderBy: { name: 'asc' },
      });
    });

    it('returns empty array when no departments exist', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      const result = await service.getDepartments(orgId);
      expect(result).toEqual([]);
    });
  });

  describe('createDepartment', () => {
    it('creates a department and uppercases codePrefix', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      const result = await service.createDepartment(orgId, {
        name: 'Finance',
        codePrefix: 'fin',
        description: 'Finance Department',
      });

      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgId,
          name: 'Finance',
          codePrefix: 'FIN', // should be uppercased
          description: 'Finance Department',
        }),
      });
      expect(result.codePrefix).toBe('FIN');
    });

    it('throws ConflictException when department name already exists', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({
        id: 'dept-existing',
        name: 'Engineering',
        codePrefix: 'ENG',
      });

      await expect(
        service.createDepartment(orgId, {
          name: 'Engineering',
          codePrefix: 'ENGG',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when codePrefix already exists', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({
        id: 'dept-existing',
        name: 'Engineering-Legacy',
        codePrefix: 'ENG',
      });

      await expect(
        service.createDepartment(orgId, {
          name: 'Engineering New',
          codePrefix: 'ENG',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates department without optional description', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await service.createDepartment(orgId, {
        name: 'Operations',
        codePrefix: 'OPS',
      });

      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Operations',
          codePrefix: 'OPS',
          description: undefined,
        }),
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Designations
  // -------------------------------------------------------------------------

  describe('getDesignations', () => {
    it('returns all designations ordered by name', async () => {
      const mockDesigs = [
        { id: 'des-1', name: 'Manager', organizationId: orgId },
        { id: 'des-2', name: 'Senior Engineer', organizationId: orgId },
      ];
      mockPrisma.designation.findMany.mockResolvedValue(mockDesigs);

      const result = await service.getDesignations(orgId);

      expect(result).toHaveLength(2);
      expect(mockPrisma.designation.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('createDesignation', () => {
    it('creates a new designation successfully', async () => {
      mockPrisma.designation.findUnique.mockResolvedValue(null);

      const result = await service.createDesignation(orgId, {
        name: 'Lead Engineer',
        description: 'Leads the engineering team',
      });

      expect(mockPrisma.designation.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          name: 'Lead Engineer',
          description: 'Leads the engineering team',
        },
      });
      expect(result).toBeDefined();
    });

    it('throws ConflictException when designation with same name already exists', async () => {
      mockPrisma.designation.findUnique.mockResolvedValue({
        id: 'des-existing',
        name: 'Lead Engineer',
      });

      await expect(
        service.createDesignation(orgId, { name: 'Lead Engineer' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.designation.create).not.toHaveBeenCalled();
    });

    it('looks up using composite unique key organizationId_name', async () => {
      mockPrisma.designation.findUnique.mockResolvedValue(null);

      await service.createDesignation(orgId, { name: 'Architect' });

      expect(mockPrisma.designation.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_name: { organizationId: orgId, name: 'Architect' },
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. Grades
  // -------------------------------------------------------------------------

  describe('getGrades', () => {
    it('returns grades ordered by level then name', async () => {
      mockPrisma.grade.findMany.mockResolvedValue([
        { id: 'g-1', name: 'L1', level: 1 },
        { id: 'g-2', name: 'L2', level: 2 },
      ]);

      const result = await service.getGrades(orgId);

      expect(result).toHaveLength(2);
      expect(mockPrisma.grade.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      });
    });
  });

  describe('createGrade', () => {
    it('creates a grade with name, level, and description', async () => {
      mockPrisma.grade.findUnique.mockResolvedValue(null);

      const result = await service.createGrade(orgId, {
        name: 'M1',
        level: 5,
        description: 'Manager Level 1',
      });

      expect(mockPrisma.grade.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          name: 'M1',
          level: 5,
          description: 'Manager Level 1',
        },
      });
      expect(result.name).toBe('M1');
    });

    it('throws ConflictException when grade name already exists in the org', async () => {
      mockPrisma.grade.findUnique.mockResolvedValue({
        id: 'grade-existing',
        name: 'L1',
        level: 1,
      });

      await expect(
        service.createGrade(orgId, { name: 'L1', level: 1 }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates grade without optional fields (level and description)', async () => {
      mockPrisma.grade.findUnique.mockResolvedValue(null);

      await service.createGrade(orgId, { name: 'G1' });

      expect(mockPrisma.grade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'G1',
          level: undefined,
          description: undefined,
        }),
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. Locations
  // -------------------------------------------------------------------------

  describe('getLocations', () => {
    it('returns all locations ordered by name', async () => {
      mockPrisma.location.findMany.mockResolvedValue([
        { id: 'loc-1', name: 'Bangalore HQ', city: 'Bangalore', country: 'India' },
        { id: 'loc-2', name: 'Mumbai Office', city: 'Mumbai', country: 'India' },
      ]);

      const result = await service.getLocations(orgId);

      expect(result).toHaveLength(2);
      expect(mockPrisma.location.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('createLocation', () => {
    it('creates a location with all fields including default country "India"', async () => {
      mockPrisma.location.findUnique.mockResolvedValue(null);

      const result = await service.createLocation(orgId, {
        name: 'Pune Office',
        address: 'SB Road, Shivajinagar',
        city: 'Pune',
      });

      expect(mockPrisma.location.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          name: 'Pune Office',
          address: 'SB Road, Shivajinagar',
          city: 'Pune',
          country: 'India', // default
        },
      });
      expect(result).toBeDefined();
    });

    it('respects explicitly provided country value overriding default', async () => {
      mockPrisma.location.findUnique.mockResolvedValue(null);

      await service.createLocation(orgId, {
        name: 'Dubai Office',
        city: 'Dubai',
        country: 'UAE',
      });

      expect(mockPrisma.location.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          country: 'UAE',
        }),
      });
    });

    it('throws ConflictException when location with same name already exists', async () => {
      mockPrisma.location.findUnique.mockResolvedValue({
        id: 'loc-existing',
        name: 'Bangalore HQ',
      });

      await expect(
        service.createLocation(orgId, { name: 'Bangalore HQ', city: 'Bangalore' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.location.create).not.toHaveBeenCalled();
    });

    it('uses composite unique key organizationId_name for conflict detection', async () => {
      mockPrisma.location.findUnique.mockResolvedValue(null);

      await service.createLocation(orgId, { name: 'Chennai Office' });

      expect(mockPrisma.location.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_name: { organizationId: orgId, name: 'Chennai Office' },
        },
      });
    });

    it('creates location with minimal required field (name only)', async () => {
      mockPrisma.location.findUnique.mockResolvedValue(null);

      await service.createLocation(orgId, { name: 'Remote' });

      expect(mockPrisma.location.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          name: 'Remote',
          address: undefined,
          city: undefined,
          country: 'India',
        },
      });
    });
  });
});
