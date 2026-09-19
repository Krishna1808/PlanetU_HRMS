import { jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role, EmploymentStatus } from '@prisma/client';
import { EmployeeService } from '../src/modules/employees/services/employee.service';
import { EmployeeRbacService } from '../src/modules/employees/services/employee-rbac.service';
import { EmployeeSequenceService } from '../src/modules/employees/services/employee-sequence.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const orgId = 'org-test-1';
const empId = 'emp-100';
const deptId = 'dept-eng';
const desigId = 'desig-swe';

const hrAdmin: AuthenticatedUser = {
  id: 'user-hr-1',
  organizationId: orgId,
  email: 'hr@planetu.com',
  role: Role.HR_ADMIN,
  employeeId: null,
};

const employeeUser: AuthenticatedUser = {
  id: 'user-emp-1',
  organizationId: orgId,
  email: 'john@planetu.com',
  role: Role.EMPLOYEE,
  employeeId: empId,
};

const mockEmployee = {
  id: empId,
  organizationId: orgId,
  employeeCode: 'ENG-0001',
  firstName: 'John',
  lastName: 'Doe',
  personalEmail: 'john.personal@gmail.com',
  phone: '9876543210',
  departmentId: deptId,
  designationId: desigId,
  reportingManagerId: null,
  employmentType: 'FULL_TIME',
  employmentStatus: EmploymentStatus.ACTIVE,
  dateOfJoining: new Date('2026-01-01'),
  deletedAt: null,
  baseSalary: 100000,
  bankName: 'HDFC Bank',
  accountNumber: '1234567890',
  ifscOrRouting: 'HDFC0001',
  panNumber: 'ABCDE1234F',
  uanNumber: '100000000001',
  currency: 'INR',
  department: { id: deptId, name: 'Engineering', codePrefix: 'ENG' },
  designation: { id: desigId, name: 'Software Engineer' },
  grade: null,
  location: null,
  reportingManager: null,
};

describe('EmployeeService (Module 3: Employee Lifecycle)', () => {
  let service: EmployeeService;
  let mockPrisma: any;
  let mockSequenceService: any;
  let mockRbacService: any;

  beforeEach(() => {
    mockPrisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(mockEmployee),
        findMany: jest.fn().mockResolvedValue([mockEmployee]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(mockEmployee),
        update: jest.fn().mockResolvedValue(mockEmployee),
      },
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: deptId, organizationId: orgId, name: 'Engineering' }),
      },
      designation: {
        findFirst: jest.fn().mockResolvedValue({ id: desigId, organizationId: orgId, name: 'Software Engineer' }),
      },
      grade: { findFirst: jest.fn().mockResolvedValue(null) },
      location: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        create: jest.fn().mockResolvedValue({ id: 'user-new' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      employeeJobHistory: {
        create: jest.fn().mockResolvedValue({ id: 'jh-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      employeeDocument: {
        create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    mockSequenceService = {
      generateEmployeeCode: jest.fn().mockResolvedValue('ENG-0001'),
    };

    // Real RBAC service for proper field-level security testing
    mockRbacService = new EmployeeRbacService();

    service = new EmployeeService(
      mockPrisma as unknown as PrismaService,
      mockSequenceService as unknown as EmployeeSequenceService,
      mockRbacService,
    );
  });

  // -------------------------------------------------------------------------
  // 1. createEmployee
  // -------------------------------------------------------------------------
  describe('createEmployee (FR-EMP-001 & FR-EMP-002)', () => {
    const baseCreateDto = {
      firstName: 'Jane',
      lastName: 'Smith',
      departmentId: deptId,
      designationId: desigId,
      employmentType: 'FULL_TIME' as const,
      employmentStatus: EmploymentStatus.ACTIVE,
      dateOfJoining: '2026-09-01',
    };

    it('creates employee, generates code, and writes initial job history entry', async () => {
      mockPrisma.employee.create.mockResolvedValue({
        ...mockEmployee,
        id: 'emp-new',
        employeeCode: 'ENG-0001',
      });

      const result = await service.createEmployee(orgId, baseCreateDto, 'user-hr-1');

      expect(mockSequenceService.generateEmployeeCode).toHaveBeenCalledWith(
        orgId,
        deptId,
        mockPrisma, // transaction client
      );
      expect(mockPrisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            employeeCode: 'ENG-0001',
            firstName: 'Jane',
            lastName: 'Smith',
          }),
        }),
      );
      expect(mockPrisma.employeeJobHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: 'Initial Employment Hire',
            effectiveTo: null, // open-ended (active)
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('creates User login account if workEmail and initialPassword are provided', async () => {
      mockPrisma.employee.create.mockResolvedValue({ ...mockEmployee, id: 'emp-new' });

      await service.createEmployee(orgId, {
        ...baseCreateDto,
        workEmail: 'jane@planetu.com',
        initialPassword: 'Temp@1234',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'jane@planetu.com',
            role: Role.EMPLOYEE,
            isActive: true,
          }),
        }),
      );
    });

    it('does NOT create a User login account when workEmail is omitted', async () => {
      mockPrisma.employee.create.mockResolvedValue({ ...mockEmployee, id: 'emp-new' });

      await service.createEmployee(orgId, baseCreateDto);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when department does not exist in the org', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.createEmployee(orgId, { ...baseCreateDto, departmentId: 'dept-invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when designation does not exist in the org', async () => {
      mockPrisma.designation.findFirst.mockResolvedValue(null);

      await expect(
        service.createEmployee(orgId, { ...baseCreateDto, designationId: 'desig-invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when optional gradeId is invalid', async () => {
      mockPrisma.grade.findFirst.mockResolvedValue(null);

      await expect(
        service.createEmployee(orgId, { ...baseCreateDto, gradeId: 'grade-invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when optional locationId is invalid', async () => {
      mockPrisma.location.findFirst.mockResolvedValue(null);

      await expect(
        service.createEmployee(orgId, { ...baseCreateDto, locationId: 'loc-invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when reportingManagerId points to a deleted employee', async () => {
      // department and designation are on separate Prisma models (mockPrisma.department / .designation)
      // The employee.findFirst mock is used for manager lookup only
      // Override: reporting manager search on employee returns null (deleted/not found)
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createEmployee(orgId, { ...baseCreateDto, reportingManagerId: 'mgr-deleted' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // 2. getEmployeeById
  // -------------------------------------------------------------------------
  describe('getEmployeeById (FR-EMP-008)', () => {
    it('returns sanitized profile for HR viewing any employee', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);

      const result = await service.getEmployeeById(orgId, empId, hrAdmin);

      expect(result).toBeDefined();
      expect(result.id).toBe(empId);
      // HR sees salary
      expect(result.baseSalary).toBeDefined();
    });

    it('returns full profile for employee viewing their own record', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);

      const result = await service.getEmployeeById(orgId, empId, employeeUser);

      expect(result.bankName).toBe('HDFC Bank');
      expect(result.panNumber).toBe('ABCDE1234F');
    });

    it('strips financial data for manager viewing non-direct-report peer', async () => {
      const peerManager: AuthenticatedUser = {
        id: 'user-mgr-2',
        organizationId: orgId,
        email: 'mgr2@planetu.com',
        role: Role.MANAGER,
        employeeId: 'mgr-other',
      };
      mockPrisma.employee.findFirst.mockResolvedValue({
        ...mockEmployee,
        reportingManagerId: 'mgr-different', // not the viewer
      });

      const result = await service.getEmployeeById(orgId, empId, peerManager);

      // General peer view: no financial fields
      expect(result.baseSalary).toBeUndefined();
      expect(result.bankName).toBeUndefined();
    });

    it('throws NotFoundException for deleted or non-existent employee', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.getEmployeeById(orgId, 'emp-ghost', hrAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // 3. updateEmployee
  // -------------------------------------------------------------------------
  describe('updateEmployee (FR-EMP-006 & FR-EMP-005)', () => {
    it('allows HR_ADMIN to update high-risk fields like baseSalary and departmentId', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockResolvedValue({
        ...mockEmployee,
        baseSalary: 120000,
        departmentId: 'dept-finance',
      });

      const result = await service.updateEmployee(
        orgId,
        empId,
        { baseSalary: 120000, departmentId: 'dept-finance' },
        hrAdmin,
      );

      expect(mockPrisma.employee.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('creates new job history entry when department changes (append-only ledger)', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockResolvedValue({
        ...mockEmployee,
        departmentId: 'dept-marketing',
      });

      await service.updateEmployee(
        orgId,
        empId,
        { departmentId: 'dept-marketing' },
        hrAdmin,
      );

      // Should close old job history record
      expect(mockPrisma.employeeJobHistory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: empId, effectiveTo: null }),
          data: expect.objectContaining({ effectiveTo: expect.any(Date) }),
        }),
      );

      // Should create new active job history record
      expect(mockPrisma.employeeJobHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: empId,
            effectiveTo: null,
          }),
        }),
      );
    });

    it('does NOT create job history entry when only personal fields change', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockResolvedValue({
        ...mockEmployee,
        phone: '9000000000',
      });

      await service.updateEmployee(
        orgId,
        empId,
        { phone: '9000000000' }, // personal, non-job field
        hrAdmin,
      );

      expect(mockPrisma.employeeJobHistory.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.employeeJobHistory.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when employee tries to modify baseSalary (restricted field)', async () => {
      await expect(
        service.updateEmployee(orgId, empId, { baseSalary: 200000 }, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when employee tries to update another employee record', async () => {
      await expect(
        service.updateEmployee(
          orgId,
          'emp-other',
          { phone: '9000000001' },
          employeeUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when target employee does not exist or is deleted', async () => {
      // First call for RBAC check (no DB call), second for DB fetch returns null
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEmployee(orgId, 'emp-ghost', { phone: '9111111111' }, hrAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // 4. softDeleteEmployee (FR-EMP-007)
  // -------------------------------------------------------------------------
  describe('softDeleteEmployee (FR-EMP-007 — Soft Delete, Never Hard Delete)', () => {
    it('marks employee as TERMINATED, sets deletedAt, deactivates linked user, and closes job history', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockResolvedValue({
        ...mockEmployee,
        deletedAt: new Date(),
        employmentStatus: EmploymentStatus.TERMINATED,
        employeeCode: 'ENG-0001',
      });

      const result = await service.softDeleteEmployee(orgId, empId, hrAdmin);

      expect(mockPrisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: empId },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            employmentStatus: EmploymentStatus.TERMINATED,
          }),
        }),
      );
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, employeeId: empId },
          data: { isActive: false },
        }),
      );
      expect(mockPrisma.employeeJobHistory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: empId, effectiveTo: null }),
        }),
      );
      expect(result.message).toContain('ENG-0001');
      expect(result.deactivatedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when trying to delete an already deactivated employee', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.softDeleteEmployee(orgId, 'emp-already-gone', hrAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // 5. listEmployees (FR-EMP-010 — Paginated Directory)
  // -------------------------------------------------------------------------
  describe('listEmployees (FR-EMP-010 — Paginated Filterable Directory)', () => {
    it('returns paginated results with correct page/limit/total fields', async () => {
      mockPrisma.employee.count.mockResolvedValue(35);
      mockPrisma.employee.findMany.mockResolvedValue([mockEmployee]);

      const result = await service.listEmployees(orgId, { page: 2, limit: 10 }, hrAdmin);

      expect(result.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: 35,
        totalPages: 4,
      });
      expect(result.data).toHaveLength(1);
    });

    it('clamps page to minimum of 1 and limit to maximum of 100', async () => {
      mockPrisma.employee.count.mockResolvedValue(0);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await service.listEmployees(orgId, { page: -5, limit: 500 }, hrAdmin);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(100);
    });

    it('defaults page=1, limit=20 when not provided', async () => {
      mockPrisma.employee.count.mockResolvedValue(0);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await service.listEmployees(orgId, {}, hrAdmin);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('filters by departmentId when provided in query', async () => {
      mockPrisma.employee.count.mockResolvedValue(0);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await service.listEmployees(orgId, { departmentId: deptId }, hrAdmin);

      // Verify the where clause passed to Prisma includes departmentId
      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            departmentId: deptId,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. getJobHistory (FR-EMP-005)
  // -------------------------------------------------------------------------
  describe('getJobHistory (FR-EMP-005 — Append-Only Ledger Access)', () => {
    it('HR_ADMIN can view any employee job history', async () => {
      mockPrisma.employeeJobHistory.findMany.mockResolvedValue([
        { id: 'jh-1', employeeId: empId, effectiveFrom: new Date('2026-01-01'), effectiveTo: null },
      ]);

      const result = await service.getJobHistory(orgId, empId, hrAdmin);

      expect(result).toHaveLength(1);
    });

    it('Employee can view only their own job history', async () => {
      mockPrisma.employeeJobHistory.findMany.mockResolvedValue([
        { id: 'jh-1', employeeId: empId },
      ]);

      const result = await service.getJobHistory(orgId, empId, employeeUser);

      expect(result).toBeDefined();
    });

    it('throws ForbiddenException when employee tries to view another employee job history', async () => {
      await expect(
        service.getJobHistory(orgId, 'emp-other', employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // 7. addDocument & getDocuments (FR-EMP-009)
  // -------------------------------------------------------------------------
  describe('addDocument & getDocuments (FR-EMP-009 — Document Management)', () => {
    it('HR_ADMIN can upload a document for any employee', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employeeDocument.create.mockResolvedValue({
        id: 'doc-1',
        documentType: 'AADHAR_CARD',
        fileName: 'aadhar.pdf',
        fileUrl: 'https://cdn.example.com/aadhar.pdf',
      });

      const result = await service.addDocument(
        orgId,
        empId,
        {
          documentType: 'AADHAR_CARD',
          fileName: 'aadhar.pdf',
          fileUrl: 'https://cdn.example.com/aadhar.pdf',
          fileSize: 200000,
        },
        hrAdmin,
      );

      expect(mockPrisma.employeeDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            employeeId: empId,
            documentType: 'AADHAR_CARD',
            uploadedByUserId: hrAdmin.id,
          }),
        }),
      );
      expect(result.id).toBe('doc-1');
    });

    it('Employee can upload documents for themselves', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employeeDocument.create.mockResolvedValue({ id: 'doc-self' });

      await service.addDocument(
        orgId,
        empId,
        { documentType: 'PAN_CARD', fileName: 'pan.pdf', fileUrl: 'https://cdn.example.com/pan.pdf' },
        employeeUser,
      );

      expect(mockPrisma.employeeDocument.create).toHaveBeenCalled();
    });

    it('throws ForbiddenException when employee tries to upload document for another employee', async () => {
      await expect(
        service.addDocument(
          orgId,
          'emp-other',
          { documentType: 'PAN_CARD', fileName: 'pan.pdf', fileUrl: 'url' },
          employeeUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when employee does not exist for document upload', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.addDocument(
          orgId,
          empId,
          { documentType: 'PAN_CARD', fileName: 'pan.pdf', fileUrl: 'url' },
          hrAdmin,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('HR_ADMIN can list all documents for any employee', async () => {
      mockPrisma.employeeDocument.findMany.mockResolvedValue([
        { id: 'doc-1', documentType: 'AADHAR_CARD' },
        { id: 'doc-2', documentType: 'PAN_CARD' },
      ]);

      const result = await service.getDocuments(orgId, empId, hrAdmin);

      expect(result).toHaveLength(2);
    });

    it('throws ForbiddenException when employee tries to view another employee documents', async () => {
      await expect(
        service.getDocuments(orgId, 'emp-other', employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // 8. getOrgChart (FR-EMP-004)
  // -------------------------------------------------------------------------
  describe('getOrgChart (FR-EMP-004 — Org Hierarchy Tree)', () => {
    it('builds correct hierarchy tree with root nodes and direct reports', async () => {
      const ceo = { id: 'emp-ceo', employeeCode: 'CEO-0001', firstName: 'Alice', lastName: 'Brown', reportingManagerId: null, department: { id: 'dept-1', name: 'Executive' }, designation: { id: 'des-1', name: 'CEO' } };
      const vp = { id: 'emp-vp', employeeCode: 'ENG-0001', firstName: 'Bob', lastName: 'Smith', reportingManagerId: 'emp-ceo', department: { id: 'dept-2', name: 'Engineering' }, designation: { id: 'des-2', name: 'VP Engineering' } };
      const dev = { id: 'emp-dev', employeeCode: 'ENG-0002', firstName: 'Charlie', lastName: 'Dev', reportingManagerId: 'emp-vp', department: { id: 'dept-2', name: 'Engineering' }, designation: { id: 'des-3', name: 'Engineer' } };

      mockPrisma.employee.findMany.mockResolvedValue([ceo, vp, dev]);

      const result = await service.getOrgChart(orgId);

      // Root should only be CEO (no reportingManagerId)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('emp-ceo');

      // CEO should have VP as direct report
      expect(result[0].directReports).toHaveLength(1);
      expect(result[0].directReports[0].id).toBe('emp-vp');

      // VP should have Dev as direct report
      expect(result[0].directReports[0].directReports).toHaveLength(1);
      expect(result[0].directReports[0].directReports[0].id).toBe('emp-dev');
    });

    it('returns all employees as root nodes when none have a reporting manager', async () => {
      const employees = [
        { id: 'emp-1', reportingManagerId: null, firstName: 'A', lastName: 'B', employeeCode: 'HR-0001', department: { id: 'd1', name: 'HR' }, designation: { id: 'd2', name: 'HR Manager' } },
        { id: 'emp-2', reportingManagerId: null, firstName: 'C', lastName: 'D', employeeCode: 'ENG-0001', department: { id: 'd3', name: 'Eng' }, designation: { id: 'd4', name: 'Engineer' } },
      ];
      mockPrisma.employee.findMany.mockResolvedValue(employees);

      const result = await service.getOrgChart(orgId);

      expect(result).toHaveLength(2);
      expect(result.every((r: any) => r.directReports.length === 0)).toBe(true);
    });

    it('returns empty array when organization has no employees', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await service.getOrgChart(orgId);

      expect(result).toEqual([]);
    });
  });
});
