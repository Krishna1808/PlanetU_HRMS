import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MastersService } from '../src/modules/masters/masters.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MastersService (Module 2: Org Masters — Departments, Designations, Grades, Locations)', () => {
  let service: MastersService;
  let mockPrisma: any;

  const orgId = 'org-test-1';

  beforeEach(() => {
    mockPrisma = {
      employee: {
        findFirst: jest.fn(),
      },
      department: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'dept-new',
          organizationId: orgId,
          ...args.data,
        })),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: args.where.id,
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
    it('returns all departments for the organization ordered by name with head and count', async () => {
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
        include: expect.objectContaining({
          head: expect.any(Object),
          _count: expect.any(Object),
        }),
        orderBy: { name: 'asc' },
      });
    });

    it('returns empty array when no departments exist', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      const result = await service.getDepartments(orgId);
      expect(result).toEqual([]);
    });
  });

  describe('getDepartmentById', () => {
    it('returns department with head and employees roster', async () => {
      const mockDept = {
        id: 'dept-1',
        organizationId: orgId,
        name: 'Engineering',
        codePrefix: 'ENG',
        head: { id: 'emp-mgr', firstName: 'Vikram', lastName: 'Singhania' },
        employees: [{ id: 'emp-1', firstName: 'Aarav', lastName: 'Sharma' }],
        _count: { employees: 1 },
      };
      mockPrisma.department.findFirst.mockResolvedValue(mockDept);

      const result = await service.getDepartmentById(orgId, 'dept-1');
      expect(result).toEqual(mockDept);
      expect(mockPrisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: 'dept-1', organizationId: orgId },
        include: expect.objectContaining({
          head: expect.any(Object),
          employees: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
    });

    it('throws NotFoundException if department does not exist', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await expect(service.getDepartmentById(orgId, 'dept-invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setDepartmentHead', () => {
    it('successfully assigns an employee as department head', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({ id: 'dept-1', organizationId: orgId });
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: orgId });

      await service.setDepartmentHead(orgId, 'dept-1', 'emp-1');

      expect(mockPrisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: { headId: 'emp-1' },
        include: expect.objectContaining({
          head: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
    });

    it('allows unassigning head by setting null', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({ id: 'dept-1', organizationId: orgId });

      await service.setDepartmentHead(orgId, 'dept-1', null);

      expect(mockPrisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: { headId: null },
        include: expect.objectContaining({
          head: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
    });

    it('throws NotFoundException if department does not exist', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await expect(service.setDepartmentHead(orgId, 'dept-none', 'emp-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if head employee does not exist', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({ id: 'dept-1', organizationId: orgId });
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.setDepartmentHead(orgId, 'dept-1', 'emp-nonexistent')).rejects.toThrow(NotFoundException);
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
        include: expect.objectContaining({
          head: expect.any(Object),
          _count: expect.any(Object),
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
        include: expect.objectContaining({
          head: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
    });

    it('creates department without manager or head (headId omitted or null)', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await service.createDepartment(orgId, {
        name: 'Quality Assurance',
        codePrefix: 'QA',
        headId: undefined,
      });

      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgId,
          name: 'Quality Assurance',
          codePrefix: 'QA',
          headId: undefined,
        }),
        include: expect.objectContaining({
          head: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
      expect(mockPrisma.employee.findFirst).not.toHaveBeenCalled();
    });

    it('creates department with initial manager/head when headId is provided', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-mgr', organizationId: orgId });

      await service.createDepartment(orgId, {
        name: 'Design',
        codePrefix: 'DES',
        headId: 'emp-mgr',
      });

      expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith({
        where: { id: 'emp-mgr', organizationId: orgId, deletedAt: null },
      });
      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgId,
          name: 'Design',
          codePrefix: 'DES',
          headId: 'emp-mgr',
        }),
        include: expect.objectContaining({
          head: expect.any(Object),
          _count: expect.any(Object),
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
