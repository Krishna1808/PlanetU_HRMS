import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { EmployeeRbacService } from '../src/modules/employees/services/employee-rbac.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';
import { UpdateEmployeeDto } from '../src/modules/employees/dto/update-employee.dto';

describe('EmployeeRbacService (FR-EMP-006 & FR-EMP-008)', () => {
  let rbacService: EmployeeRbacService;

  beforeEach(() => {
    rbacService = new EmployeeRbacService();
  });

  const mockFullEmployee = {
    id: 'emp-100',
    employeeCode: 'ENG-0001',
    firstName: 'John',
    lastName: 'Doe',
    personalEmail: 'john@example.com',
    phone: '9876543210',
    department: { id: 'dept-1', name: 'Engineering', codePrefix: 'ENG' },
    designation: { id: 'des-1', name: 'Software Engineer' },
    reportingManagerId: 'mgr-200',
    currency: 'INR',
    baseSalary: '150000.00',
    bankName: 'HDFC Bank',
    accountNumber: '123456789012',
    ifscOrRouting: 'HDFC0001234',
    panNumber: 'ABCDE1234F',
    uanNumber: '100000000001',
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
    dateOfJoining: new Date('2026-01-01'),
  };

  describe('sanitizeEmployeeProfile (Field-level Read Access)', () => {
    it('HR_ADMIN can view full profile including salary and bank details', () => {
      const hrViewer: AuthenticatedUser = {
        id: 'user-hr',
        organizationId: 'org-1',
        email: 'hr@example.com',
        role: Role.HR_ADMIN,
        employeeId: 'emp-hr',
      };

      const result = rbacService.sanitizeEmployeeProfile(mockFullEmployee, hrViewer);
      expect(result.baseSalary).toBe('150000.00');
      expect(result.bankName).toBe('HDFC Bank');
      expect(result.accountNumber).toBe('123456789012');
    });

    it('CLIENT_SUPER_ADMIN can view full profile', () => {
      const adminViewer: AuthenticatedUser = {
        id: 'user-admin',
        organizationId: 'org-1',
        email: 'admin@example.com',
        role: Role.CLIENT_SUPER_ADMIN,
        employeeId: null,
      };

      const result = rbacService.sanitizeEmployeeProfile(mockFullEmployee, adminViewer);
      expect(result.baseSalary).toBe('150000.00');
      expect(result.bankName).toBe('HDFC Bank');
    });

    it('Employee viewing their OWN profile can view their salary and bank details', () => {
      const selfViewer: AuthenticatedUser = {
        id: 'user-john',
        organizationId: 'org-1',
        email: 'john@example.com',
        role: Role.EMPLOYEE,
        employeeId: 'emp-100',
      };

      const result = rbacService.sanitizeEmployeeProfile(mockFullEmployee, selfViewer);
      expect(result.baseSalary).toBe('150000.00');
      expect(result.bankName).toBe('HDFC Bank');
    });

    it('Manager viewing a DIRECT REPORT sees work fields but salary/bank details are stripped', () => {
      const managerViewer: AuthenticatedUser = {
        id: 'user-mgr',
        organizationId: 'org-1',
        email: 'manager@example.com',
        role: Role.MANAGER,
        employeeId: 'mgr-200', // matches mockFullEmployee.reportingManagerId
      };

      const result = rbacService.sanitizeEmployeeProfile(
        mockFullEmployee,
        managerViewer,
        true, // isDirectReport
      );

      expect(result.firstName).toBe('John');
      expect(result.department.name).toBe('Engineering');
      // Must be stripped
      expect(result.baseSalary).toBeUndefined();
      expect(result.bankName).toBeUndefined();
      expect(result.accountNumber).toBeUndefined();
      expect(result.ifscOrRouting).toBeUndefined();
      expect(result.panNumber).toBeUndefined();
      expect(result.uanNumber).toBeUndefined();
    });

    it('Colleague viewing peer employee sees public directory info only', () => {
      const peerViewer: AuthenticatedUser = {
        id: 'user-peer',
        organizationId: 'org-1',
        email: 'peer@example.com',
        role: Role.EMPLOYEE,
        employeeId: 'emp-300',
      };

      const result = rbacService.sanitizeEmployeeProfile(
        mockFullEmployee,
        peerViewer,
        false,
      );

      expect(result.id).toBe('emp-100');
      expect(result.employeeCode).toBe('ENG-0001');
      expect(result.firstName).toBe('John');
      expect(result.department.name).toBe('Engineering');
      expect(result.baseSalary).toBeUndefined();
      expect(result.bankName).toBeUndefined();
    });
  });

  describe('validateUpdatePermissions (FR-EMP-006 Field-level Edit Policy)', () => {
    it('HR_ADMIN can edit high-risk fields like baseSalary and department', () => {
      const hrUser: AuthenticatedUser = {
        id: 'user-hr',
        organizationId: 'org-1',
        email: 'hr@example.com',
        role: Role.HR_ADMIN,
        employeeId: 'emp-hr',
      };

      const dto: UpdateEmployeeDto = {
        baseSalary: 180000,
        departmentId: 'dept-new',
      };

      expect(() =>
        rbacService.validateUpdatePermissions(hrUser, 'emp-100', dto),
      ).not.toThrow();
    });

    it('Employee can self-edit low-risk personal fields', () => {
      const selfUser: AuthenticatedUser = {
        id: 'user-john',
        organizationId: 'org-1',
        email: 'john@example.com',
        role: Role.EMPLOYEE,
        employeeId: 'emp-100',
      };

      const dto: UpdateEmployeeDto = {
        phone: '9123456780',
        personalEmail: 'newpersonal@example.com',
        currentAddress: 'Flat 101, Horizon Towers',
      };

      expect(() =>
        rbacService.validateUpdatePermissions(selfUser, 'emp-100', dto),
      ).not.toThrow();
    });

    it('Employee attempting to edit high-risk field (baseSalary) throws ForbiddenException', () => {
      const selfUser: AuthenticatedUser = {
        id: 'user-john',
        organizationId: 'org-1',
        email: 'john@example.com',
        role: Role.EMPLOYEE,
        employeeId: 'emp-100',
      };

      const dto: UpdateEmployeeDto = {
        phone: '9123456780',
        baseSalary: 999999, // restricted!
      };

      expect(() =>
        rbacService.validateUpdatePermissions(selfUser, 'emp-100', dto),
      ).toThrow(ForbiddenException);
    });

    it('Employee attempting to edit someone elses record throws ForbiddenException', () => {
      const selfUser: AuthenticatedUser = {
        id: 'user-john',
        organizationId: 'org-1',
        email: 'john@example.com',
        role: Role.EMPLOYEE,
        employeeId: 'emp-100',
      };

      const dto: UpdateEmployeeDto = {
        phone: '9123456780',
      };

      expect(() =>
        rbacService.validateUpdatePermissions(selfUser, 'emp-999', dto),
      ).toThrow(ForbiddenException);
    });
  });
});
