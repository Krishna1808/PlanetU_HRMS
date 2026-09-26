import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { NotificationEventBusService } from '../src/modules/notifications/notification-event-bus.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('Department-Scoped Announcements & Auto-Expiration', () => {
  let service: NotificationService;
  let eventBus: NotificationEventBusService;
  let mockPrisma: any;

  const orgId = 'org-dept-123';
  const engineeringDeptId = 'dept-eng-1';
  const salesDeptId = 'dept-sales-2';

  const mockAdminUser: AuthenticatedUser = {
    id: 'user-admin',
    organizationId: orgId,
    email: 'admin@planetu.com',
    role: Role.CLIENT_SUPER_ADMIN,
  };

  const mockEngineeringManager: AuthenticatedUser = {
    id: 'user-mgr-eng',
    organizationId: orgId,
    email: 'eng.lead@planetu.com',
    role: Role.MANAGER,
    employeeId: 'emp-eng-lead',
  };

  const mockNormalEmployee: AuthenticatedUser = {
    id: 'user-emp-regular',
    organizationId: orgId,
    email: 'dev@planetu.com',
    role: Role.EMPLOYEE,
    employeeId: 'emp-regular',
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: 'u-1', email: 'emp1@planetu.com', employee: { firstName: 'Alice', lastName: 'A' } },
        ]),
        findUnique: jest.fn(),
      },
      department: {
        findFirst: jest.fn().mockImplementation((args: any) => {
          if (args.where.id === engineeringDeptId) {
            return Promise.resolve({ id: engineeringDeptId, name: 'Engineering', headId: 'emp-eng-lead' });
          }
          if (args.where.id === salesDeptId) {
            return Promise.resolve({ id: salesDeptId, name: 'Sales', headId: 'emp-sales-lead' });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation((args: any) => {
          if (args.where?.headId === 'emp-eng-lead') {
            return Promise.resolve([{ id: engineeringDeptId, name: 'Engineering' }]);
          }
          return Promise.resolve([]);
        }),
      },
      employee: {
        findUnique: jest.fn().mockImplementation((args: any) => {
          if (args.where.id === 'emp-eng-lead') {
            return Promise.resolve({ id: 'emp-eng-lead', departmentId: engineeringDeptId });
          }
          if (args.where.id === 'emp-regular') {
            return Promise.resolve({ id: 'emp-regular', departmentId: engineeringDeptId });
          }
          return Promise.resolve(null);
        }),
      },
      notification: {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      announcement: {
        create: jest.fn().mockImplementation((args: any) => ({
          id: 'ann-1',
          ...args.data,
          targetDepartment: { id: args.data.targetDepartmentId, name: 'Engineering' },
          createdBy: { id: args.data.createdByUserId, email: 'user@planetu.com', role: Role.MANAGER },
        })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation((args: any) => ({ id: args.where.id, ...args.data })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    eventBus = new NotificationEventBusService();
    service = new NotificationService(mockPrisma as any, eventBus);
    service.onModuleInit();
  });

  describe('createAnnouncement permissions & department scoping', () => {
    it('should allow Manager/Dept Head to publish an announcement for their own department with default 24h expiration', async () => {
      const beforeDate = Date.now();
      const result = await service.createAnnouncement(orgId, mockEngineeringManager, {
        title: 'Sprint Planning at 2 PM',
        content: 'Please prepare Jira backlog items before the sync.',
        targetDepartmentId: engineeringDeptId,
        priority: 'HIGH' as any,
      });

      expect(result).toBeDefined();
      expect(mockPrisma.announcement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            targetDepartmentId: engineeringDeptId,
            title: 'Sprint Planning at 2 PM',
            createdByUserId: mockEngineeringManager.id,
            expiresAt: expect.any(Date),
          }),
        }),
      );

      // Verify expiration is set ~24 hours from now
      const createCall = mockPrisma.announcement.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt.getTime();
      const diffHours = (expiresAt - beforeDate) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(24);
    });

    it('should reject Manager attempting to publish company-wide (missing targetDepartmentId)', async () => {
      await expect(
        service.createAnnouncement(orgId, mockEngineeringManager, {
          title: 'Company Wide Notice',
          content: 'This should be rejected for non-admins',
          // no targetDepartmentId
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject Manager attempting to publish for a different department', async () => {
      await expect(
        service.createAnnouncement(orgId, mockEngineeringManager, {
          title: 'Sales Strategy',
          content: 'Engineering lead cannot publish to Sales',
          targetDepartmentId: salesDeptId,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Super Admin or HR Admin to publish company-wide or any department', async () => {
      const result = await service.createAnnouncement(orgId, mockAdminUser, {
        title: 'Annual Holiday Calendar',
        content: 'Official holiday calendar published.',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.announcement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetDepartmentId: null,
          }),
        }),
      );
    });

    it('should reject a regular employee without manager or department head status', async () => {
      await expect(
        service.createAnnouncement(orgId, mockNormalEmployee, {
          title: 'Unauthorized Post',
          content: 'Regular employees cannot post announcements',
          targetDepartmentId: engineeringDeptId,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Auto-Expiration filtering in getAnnouncements', () => {
    it('should filter out expired announcements when querying active notices', async () => {
      await service.getAnnouncements(orgId, mockAdminUser, { isActive: 'true' });

      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            isActive: true,
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { expiresAt: null },
                  { expiresAt: { gt: expect.any(Date) } },
                ]),
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('Instant Bonus Awarded Event Listener', () => {
    it('should handle payroll.bonus_awarded event and dispatch celebration notification', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u-bonus',
        email: 'alice@planetu.com',
        employee: { firstName: 'Alice', lastName: 'Smith' },
      });

      eventBus.emitBonusAwarded({
        organizationId: orgId,
        recipientUserId: 'u-bonus',
        employeeName: 'Alice Smith',
        amount: 15000,
        type: 'BONUS',
        month: 9,
        year: 2026,
        reason: 'Exceptional Q3 delivery',
      });

      // Allow event loop to process event listener
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            recipientUserId: 'u-bonus',
            type: 'BONUS_AWARDED',
            title: expect.stringContaining('15,000'),
          }),
        }),
      );
    });
  });
});
