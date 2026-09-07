import { Injectable, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';

// Low-risk personal fields self-editable by the employee
const LOW_RISK_FIELDS = new Set([
  'firstName',
  'lastName',
  'personalEmail',
  'phone',
  'dateOfBirth',
  'gender',
  'currentAddress',
  'permanentAddress',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelation',
]);

// Sensitive financial/statutory fields hidden from Managers and Peers
const SENSITIVE_FINANCIAL_FIELDS = [
  'baseSalary',
  'currency',
  'bankName',
  'accountNumber',
  'ifscOrRouting',
  'panNumber',
  'uanNumber',
];

@Injectable()
export class EmployeeRbacService {
  /**
   * Enforces field-level edit restrictions based on user role.
   * - HR_ADMIN & CLIENT_SUPER_ADMIN can edit all fields.
   * - Employees/Managers can only edit their own profile, and only low-risk personal fields.
   */
  validateUpdatePermissions(
    user: AuthenticatedUser,
    targetEmployeeId: string,
    updateDto: UpdateEmployeeDto,
  ): void {
    const isHrOrAdmin =
      user.role === Role.CLIENT_SUPER_ADMIN || user.role === Role.HR_ADMIN;

    if (isHrOrAdmin) {
      return; // Admins can edit all fields
    }

    // Non-admins can ONLY edit their own employee profile
    if (!user.employeeId || user.employeeId !== targetEmployeeId) {
      throw new ForbiddenException('You are only authorized to edit your own employee profile');
    }

    // Inspect keys being updated to verify no restricted fields are modified
    const attemptedKeys = Object.keys(updateDto).filter(
      (k) => (updateDto as any)[k] !== undefined,
    );

    const unauthorizedKeys = attemptedKeys.filter((key) => !LOW_RISK_FIELDS.has(key));

    if (unauthorizedKeys.length > 0) {
      throw new ForbiddenException(
        `Field-level security violation: You do not have permission to modify: [${unauthorizedKeys.join(', ')}]. ` +
          `Only HR or Super Admins can update employment, statutory, or financial data.`,
      );
    }
  }

  /**
   * Sanitizes employee record based on viewing user's role and relationship.
   * - HR/Super Admin: sees everything.
   * - Manager: sees team member's job/personal info, but financial fields are stripped.
   * - Peer/Employee: sees public directory fields only when viewing other employees.
   */
  sanitizeEmployeeProfile(
    employee: any,
    viewer: AuthenticatedUser,
    isDirectReport = false,
  ): any {
    if (!employee) return null;

    const isHrOrAdmin =
      viewer.role === Role.CLIENT_SUPER_ADMIN || viewer.role === Role.HR_ADMIN;

    const isViewingSelf = viewer.employeeId && viewer.employeeId === employee.id;

    // Admins or users viewing their own profile see all fields
    if (isHrOrAdmin || isViewingSelf) {
      return employee;
    }

    // Clone record to avoid mutating internal objects
    const sanitized = { ...employee };

    // If Manager viewing a direct subordinate
    if (viewer.role === Role.MANAGER && isDirectReport) {
      // Strip financial/bank data
      for (const field of SENSITIVE_FINANCIAL_FIELDS) {
        delete sanitized[field];
      }
      return sanitized;
    }

    // General peer view (Employee directory scope)
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      personalEmail: employee.personalEmail,
      phone: employee.phone,
      department: employee.department,
      designation: employee.designation,
      grade: employee.grade,
      location: employee.location,
      reportingManager: employee.reportingManager
        ? {
            id: employee.reportingManager.id,
            employeeCode: employee.reportingManager.employeeCode,
            firstName: employee.reportingManager.firstName,
            lastName: employee.reportingManager.lastName,
          }
        : null,
      employmentType: employee.employmentType,
      employmentStatus: employee.employmentStatus,
      dateOfJoining: employee.dateOfJoining,
    };
  }
}
