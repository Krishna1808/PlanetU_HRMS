import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PayrollController } from '../src/modules/payroll/payroll.controller';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('PayrollController RBAC Guard (RolesGuard on /payroll/configuration)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user: Partial<AuthenticatedUser>): ExecutionContext => {
    return {
      getHandler: () => PayrollController.prototype.updateConfiguration,
      getClass: () => PayrollController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  it('rejects CLIENT_SUPER_ADMIN with 403 Forbidden on PATCH /payroll/configuration', () => {
    const superAdminUser: AuthenticatedUser = {
      id: 'admin-user-id',
      organizationId: 'org-test-1',
      email: 'admin@planetu.com',
      role: Role.CLIENT_SUPER_ADMIN,
      employeeId: null,
    };

    const context = createMockContext(superAdminUser);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Access denied. Requires one of roles: [FINANCE]. Current role: CLIENT_SUPER_ADMIN',
    );
  });

  it('rejects HR_ADMIN with 403 Forbidden on PATCH /payroll/configuration', () => {
    const hrUser: AuthenticatedUser = {
      id: 'hr-user-id',
      organizationId: 'org-test-1',
      email: 'hr@planetu.com',
      role: Role.HR_ADMIN,
      employeeId: 'emp-1',
    };

    const context = createMockContext(hrUser);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Access denied. Requires one of roles: [FINANCE]. Current role: HR_ADMIN',
    );
  });

  it('rejects EMPLOYEE with 403 Forbidden on PATCH /payroll/configuration', () => {
    const employeeUser: AuthenticatedUser = {
      id: 'emp-user-id',
      organizationId: 'org-test-1',
      email: 'emp@planetu.com',
      role: Role.EMPLOYEE,
      employeeId: 'emp-2',
    };

    const context = createMockContext(employeeUser);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Access denied. Requires one of roles: [FINANCE]. Current role: EMPLOYEE',
    );
  });

  it('allows FINANCE role on PATCH /payroll/configuration', () => {
    const financeUser: AuthenticatedUser = {
      id: 'finance-user-id',
      organizationId: 'org-test-1',
      email: 'finance@planetu.com',
      role: Role.FINANCE,
      employeeId: 'emp-3',
    };

    const context = createMockContext(financeUser);
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allows CLIENT_SUPER_ADMIN, HR_ADMIN, and FINANCE on GET /payroll/configuration', () => {
    const createGetContext = (user: Partial<AuthenticatedUser>): ExecutionContext => {
      return {
        getHandler: () => PayrollController.prototype.getConfiguration,
        getClass: () => PayrollController,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => ({}),
          getNext: () => ({}),
        }),
      } as unknown as ExecutionContext;
    };

    const superAdmin: AuthenticatedUser = {
      id: 'admin-id',
      organizationId: 'org-test-1',
      email: 'admin@planetu.com',
      role: Role.CLIENT_SUPER_ADMIN,
      employeeId: null,
    };
    const hrAdmin: AuthenticatedUser = {
      id: 'hr-id',
      organizationId: 'org-test-1',
      email: 'hr@planetu.com',
      role: Role.HR_ADMIN,
      employeeId: 'emp-1',
    };
    const finance: AuthenticatedUser = {
      id: 'fin-id',
      organizationId: 'org-test-1',
      email: 'fin@planetu.com',
      role: Role.FINANCE,
      employeeId: 'emp-2',
    };

    expect(guard.canActivate(createGetContext(superAdmin))).toBe(true);
    expect(guard.canActivate(createGetContext(hrAdmin))).toBe(true);
    expect(guard.canActivate(createGetContext(finance))).toBe(true);
  });
});
