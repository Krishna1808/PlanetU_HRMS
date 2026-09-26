import { jest } from '@jest/globals';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { NotificationEventBusService } from '../src/modules/notifications/notification-event-bus.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('NotificationService (Module 11: Notification Engine & Announcements)', () => {
  let service: NotificationService;
  let eventBus: NotificationEventBusService;
  let mockPrisma: any;

  const orgId = 'org-notif-100';

  const mockHrUser: AuthenticatedUser = {
    id: 'user-hr-1',
    organizationId: orgId,
    email: 'hr@planetu.com',
    role: Role.HR_ADMIN,
    employeeId: 'emp-hr-1',
  };

  const mockEmployeeUser: AuthenticatedUser = {
    id: 'user-emp-1',
    organizationId: orgId,
    email: 'employee@planetu.com',
    role: Role.EMPLOYEE,
    employeeId: 'emp-1',
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      department: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      employee: {
        findUnique: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      announcement: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = new NotificationEventBusService();
    service = new NotificationService(mockPrisma as any, eventBus);
    service.onModuleInit();
  });

  // ---------------------------------------------------------------------------
  // 1. Notification Creation & Retrieval
  // ---------------------------------------------------------------------------
  describe('createNotification', () => {
    it('should create an in-app notification and simulate email dispatch', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: mockEmployeeUser.id,
        email: mockEmployeeUser.email,
        organizationId: orgId,
      });

      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        organizationId: orgId,
        recipientUserId: mockEmployeeUser.id,
        type: 'LEAVE_STATUS',
        title: 'Leave Request Approved',
        message: 'Your leave has been approved.',
        actionUrl: '/leaves',
        isRead: false,
        createdAt: new Date(),
      });

      const result = await service.createNotification(orgId, {
        recipientUserId: mockEmployeeUser.id,
        type: 'LEAVE_STATUS' as any,
        title: 'Leave Request Approved',
        message: 'Your leave has been approved.',
        actionUrl: '/leaves',
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: mockEmployeeUser.id, organizationId: orgId },
        include: {
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
      });
      expect(mockPrisma.notification.create).toHaveBeenCalled();
      expect(result.id).toBe('notif-1');
      expect(result.isRead).toBe(false);
    });

    it('should throw NotFoundException if recipient does not belong to organization', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.createNotification(orgId, {
          recipientUserId: 'non-existent',
          type: 'SYSTEM' as any,
          title: 'Hello',
          message: 'World',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Unread Count & Query
  // ---------------------------------------------------------------------------
  describe('getUserNotifications and getUnreadCount', () => {
    it('should retrieve user notifications with unread count and pagination metadata', async () => {
      const mockList = [
        { id: 'notif-1', title: 'N1', isRead: false },
        { id: 'notif-2', title: 'N2', isRead: true },
      ];
      mockPrisma.notification.findMany.mockResolvedValue(mockList);
      mockPrisma.notification.count
        .mockResolvedValueOnce(2) // total matching
        .mockResolvedValueOnce(1); // unread count

      const result = await service.getUserNotifications(mockEmployeeUser.id, orgId, {
        limit: '10',
        offset: '0',
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.unreadCount).toBe(1);
    });

    it('should compute unread count accurately for the user', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(mockEmployeeUser.id, orgId);
      expect(result.unreadCount).toBe(5);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          recipientUserId: mockEmployeeUser.id,
          isRead: false,
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Mark as Read
  // ---------------------------------------------------------------------------
  describe('markAsRead & markAllAsRead', () => {
    it('should mark single notification as read if owned by user', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        recipientUserId: mockEmployeeUser.id,
        organizationId: orgId,
        isRead: false,
      });

      mockPrisma.notification.update.mockResolvedValue({
        id: 'notif-1',
        isRead: true,
        readAt: new Date(),
      });

      const updated = await service.markAsRead('notif-1', mockEmployeeUser.id, orgId);
      expect(updated.isRead).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if notification does not belong to user or tenant', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead('notif-foreign', mockEmployeeUser.id, orgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark all unread notifications as read for current user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const res = await service.markAllAsRead(mockEmployeeUser.id, orgId);
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(4);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          recipientUserId: mockEmployeeUser.id,
          isRead: false,
        },
        data: expect.objectContaining({ isRead: true }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Announcements Broadcasting & RBAC
  // ---------------------------------------------------------------------------
  describe('createAnnouncement & RBAC', () => {
    it('should allow HR Admin to create company-wide announcement and fan out notifications', async () => {
      mockPrisma.announcement.create.mockResolvedValue({
        id: 'ann-1',
        organizationId: orgId,
        title: 'Town Hall Meeting',
        content: 'All hands meeting this Friday.',
        priority: 'HIGH',
        targetDepartmentId: null,
      });

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'u1@test.com' },
        { id: 'user-2', email: 'u2@test.com' },
      ]);

      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const announcement = await service.createAnnouncement(orgId, mockHrUser, {
        title: 'Town Hall Meeting',
        content: 'All hands meeting this Friday.',
        priority: 'HIGH' as any,
        fanOutNotifications: true,
      });

      expect(announcement.id).toBe('ann-1');
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, isActive: true },
        select: expect.objectContaining({ id: true, email: true }),
      });
      expect(mockPrisma.notification.createMany).toHaveBeenCalled();
    });

    it('should prevent EMPLOYEE role from publishing announcements (RBAC)', async () => {
      await expect(
        service.createAnnouncement(orgId, mockEmployeeUser, {
          title: 'Illegal Announcement',
          content: 'I should not be able to do this',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow HR Admin to deactivate an announcement', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue({
        id: 'ann-1',
        organizationId: orgId,
        isActive: true,
      });

      mockPrisma.announcement.update.mockResolvedValue({
        id: 'ann-1',
        isActive: false,
      });

      const updated = await service.deactivateAnnouncement('ann-1', orgId, mockHrUser);
      expect(updated.isActive).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Domain Event Emitter Integration
  // ---------------------------------------------------------------------------
  describe('Domain Event Bus Integration', () => {
    it('should handle leave.status_changed domain event', async () => {
      const createSpy = jest.spyOn(service, 'createNotification').mockResolvedValue({} as any);

      eventBus.emitLeaveStatus({
        organizationId: orgId,
        recipientUserId: mockEmployeeUser.id,
        leaveRequestId: 'lr-123',
        status: 'APPROVED',
        leaveTypeName: 'Sick Leave',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
      });

      // wait for microtask / event dispatch
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(createSpy).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          recipientUserId: mockEmployeeUser.id,
          type: 'LEAVE_STATUS',
          title: 'Leave Request APPROVED',
          actionUrl: '/leaves',
        }),
      );
    });

    it('should handle payroll.payslip_released domain event', async () => {
      const createSpy = jest.spyOn(service, 'createNotification').mockResolvedValue({} as any);

      eventBus.emitPayslipReleased({
        organizationId: orgId,
        recipientUserId: mockEmployeeUser.id,
        payslipId: 'ps-888',
        month: 9,
        year: 2026,
        netPayable: 65000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(createSpy).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          recipientUserId: mockEmployeeUser.id,
          type: 'PAYSLIP_RELEASED',
          actionUrl: '/payroll',
        }),
      );
    });
  });
});
