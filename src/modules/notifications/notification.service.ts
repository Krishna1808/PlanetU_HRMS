import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationEventBusService } from './notification-event-bus.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { QueryAnnouncementsDto } from './dto/query-announcements.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: NotificationEventBusService,
  ) {}

  onModuleInit() {
    this.registerDomainEventListeners();
  }

  private registerDomainEventListeners() {
    // 1. Leave Status Changed
    this.eventBus.on('leave.status_changed', async (payload) => {
      try {
        await this.createNotification(payload.organizationId, {
          recipientUserId: payload.recipientUserId,
          type: 'LEAVE_STATUS' as any,
          title: `Leave Request ${payload.status}`,
          message: `Your leave request for ${payload.leaveTypeName} (${payload.startDate} to ${payload.endDate}) has been marked as ${payload.status}.`,
          actionUrl: '/leaves',
          metadata: { leaveRequestId: payload.leaveRequestId, status: payload.status },
        });
      } catch (err: any) {
        this.logger.error(`Failed to handle leave.status_changed: ${err?.message}`);
      }
    });

    // 2. Attendance Alert
    this.eventBus.on('attendance.alert', async (payload) => {
      try {
        await this.createNotification(payload.organizationId, {
          recipientUserId: payload.recipientUserId,
          type: 'ATTENDANCE_ALERT' as any,
          title: `Attendance Alert: ${payload.alertType.replace('_', ' ')}`,
          message: `${payload.details} on ${payload.date}.`,
          actionUrl: '/attendance',
          metadata: { alertType: payload.alertType, date: payload.date },
        });
      } catch (err: any) {
        this.logger.error(`Failed to handle attendance.alert: ${err?.message}`);
      }
    });

    // 3. Payroll Payslip Released
    this.eventBus.on('payroll.payslip_released', async (payload) => {
      try {
        await this.createNotification(payload.organizationId, {
          recipientUserId: payload.recipientUserId,
          type: 'PAYSLIP_RELEASED' as any,
          title: `Payslip Released: ${payload.month}/${payload.year}`,
          message: `Your salary payslip for ${payload.month}/${payload.year} has been published. Net Payable: ₹${Number(payload.netPayable).toLocaleString('en-IN')}`,
          actionUrl: '/payroll',
          metadata: { payslipId: payload.payslipId, month: payload.month, year: payload.year },
        });
      } catch (err: any) {
        this.logger.error(`Failed to handle payroll.payslip_released: ${err?.message}`);
      }
    });

    // 4. Shift Assigned
    this.eventBus.on('shift.assigned', async (payload) => {
      try {
        await this.createNotification(payload.organizationId, {
          recipientUserId: payload.recipientUserId,
          type: 'SHIFT_ASSIGNED' as any,
          title: `Shift Schedule Assigned: ${payload.shiftName}`,
          message: `You have been assigned to shift '${payload.shiftName}' starting ${payload.effectiveDate}.`,
          actionUrl: '/shifts',
          metadata: { shiftName: payload.shiftName, effectiveDate: payload.effectiveDate },
        });
      } catch (err: any) {
        this.logger.error(`Failed to handle shift.assigned: ${err?.message}`);
      }
    });

    // 5. Clearance Task Assigned
    this.eventBus.on('clearance.task_assigned', async (payload) => {
      try {
        await this.createNotification(payload.organizationId, {
          recipientUserId: payload.recipientUserId,
          type: 'CLEARANCE_TASK' as any,
          title: `Exit Clearance Action Required: ${payload.department}`,
          message: `Pending clearance task '${payload.taskName}' for employee ${payload.employeeName}.`,
          actionUrl: '/offboarding',
          metadata: { department: payload.department, taskName: payload.taskName },
        });
      } catch (err: any) {
        this.logger.error(`Failed to handle clearance.task_assigned: ${err?.message}`);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Notifications CRUD & Retrieval
  // -------------------------------------------------------------------------

  async createNotification(organizationId: string, dto: CreateNotificationDto) {
    const recipient = await this.prisma.user.findFirst({
      where: { id: dto.recipientUserId, organizationId },
    });

    if (!recipient) {
      throw new NotFoundException(`Recipient user not found in this organization.`);
    }

    const notification = await this.prisma.notification.create({
      data: {
        organizationId,
        recipientUserId: dto.recipientUserId,
        senderUserId: dto.senderUserId || null,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        actionUrl: dto.actionUrl || null,
        metadata: dto.metadata || null,
      },
    });

    // Zero external API cost - simulate delivery in console envelope
    this.simulateEmailDispatch(notification, recipient.email);

    return notification;
  }

  async getUserNotifications(userId: string, organizationId: string, query: QueryNotificationsDto) {
    const whereClause: any = {
      organizationId,
      recipientUserId: userId,
    };

    if (query.isRead !== undefined) {
      whereClause.isRead = query.isRead === 'true';
    }

    if (query.type) {
      whereClause.type = query.type;
    }

    const limit = query.limit ? Math.min(Math.max(1, parseInt(query.limit, 10)), 100) : 50;
    const offset = query.offset ? Math.max(0, parseInt(query.offset, 10)) : 0;

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where: whereClause }),
      this.prisma.notification.count({
        where: { organizationId, recipientUserId: userId, isRead: false },
      }),
    ]);

    return {
      data,
      total,
      unreadCount,
      limit,
      offset,
    };
  }

  async getUnreadCount(userId: string, organizationId: string) {
    const count = await this.prisma.notification.count({
      where: {
        organizationId,
        recipientUserId: userId,
        isRead: false,
      },
    });
    return { unreadCount: count };
  }

  async markAsRead(notificationId: string, userId: string, organizationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientUserId: userId,
        organizationId,
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notification not found or access denied.`);
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string, organizationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        organizationId,
        recipientUserId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      updatedCount: result.count,
    };
  }

  // -------------------------------------------------------------------------
  // Announcements (Broadcasts)
  // -------------------------------------------------------------------------

  async createAnnouncement(
    organizationId: string,
    user: AuthenticatedUser,
    dto: CreateAnnouncementDto,
  ) {
    if (user.role !== Role.CLIENT_SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
      throw new ForbiddenException('Only HR Admins or Super Admins can publish broadcast announcements.');
    }

    if (dto.targetDepartmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.targetDepartmentId, organizationId },
      });
      if (!dept) {
        throw new NotFoundException('Target department does not exist in this organization.');
      }
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        organizationId,
        createdByUserId: user.id,
        title: dto.title,
        content: dto.content,
        priority: dto.priority || 'NORMAL',
        targetDepartmentId: dto.targetDepartmentId || null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        targetDepartment: { select: { id: true, name: true, codePrefix: true } },
        createdBy: { select: { id: true, email: true, role: true } },
      },
    });

    // Fan-out notifications to users if requested
    if (dto.fanOutNotifications !== false) {
      const targetUsers = await this.prisma.user.findMany({
        where: {
          organizationId,
          isActive: true,
          ...(dto.targetDepartmentId
            ? { employee: { departmentId: dto.targetDepartmentId } }
            : {}),
        },
        select: { id: true, email: true },
      });

      if (targetUsers.length > 0) {
        await this.prisma.notification.createMany({
          data: targetUsers.map((u) => ({
            organizationId,
            recipientUserId: u.id,
            senderUserId: user.id,
            type: 'ANNOUNCEMENT' as any,
            title: `Announcement: ${dto.title}`,
            message: dto.content.length > 150 ? `${dto.content.substring(0, 147)}...` : dto.content,
            actionUrl: '/',
            metadata: { announcementId: announcement.id, priority: announcement.priority },
          })),
        });

        this.logger.log(
          `Broadcast announcement fanned out to ${targetUsers.length} in-app notification recipients ($0 cost).`,
        );
      }
    }

    this.eventBus.emitAnnouncementPublished({
      organizationId,
      announcementId: announcement.id,
      title: announcement.title,
      priority: announcement.priority,
      targetDepartmentId: announcement.targetDepartmentId || undefined,
      createdByUserId: user.id,
    });

    return announcement;
  }

  async getAnnouncements(
    organizationId: string,
    user: AuthenticatedUser,
    query: QueryAnnouncementsDto,
  ) {
    const isAdmin =
      user.role === Role.CLIENT_SUPER_ADMIN || user.role === Role.HR_ADMIN;

    const whereClause: any = { organizationId };

    if (query.isActive !== undefined) {
      whereClause.isActive = query.isActive === 'true';
    } else if (!isAdmin) {
      whereClause.isActive = true;
    }

    if (!isAdmin) {
      // Find employee's department if exists
      let userDepartmentId: string | null = null;
      if (user.employeeId) {
        const emp = await this.prisma.employee.findUnique({
          where: { id: user.employeeId },
          select: { departmentId: true },
        });
        userDepartmentId = emp?.departmentId || null;
      }

      whereClause.OR = [
        { targetDepartmentId: null },
        ...(userDepartmentId ? [{ targetDepartmentId: userDepartmentId }] : []),
      ];
    }

    return this.prisma.announcement.findMany({
      where: whereClause,
      include: {
        targetDepartment: { select: { id: true, name: true, codePrefix: true } },
        createdBy: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async deactivateAnnouncement(
    announcementId: string,
    organizationId: string,
    user: AuthenticatedUser,
  ) {
    if (user.role !== Role.CLIENT_SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
      throw new ForbiddenException('Only HR Admins or Super Admins can deactivate announcements.');
    }

    const announcement = await this.prisma.announcement.findFirst({
      where: { id: announcementId, organizationId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found.');
    }

    return this.prisma.announcement.update({
      where: { id: announcementId },
      data: { isActive: false },
    });
  }

  // -------------------------------------------------------------------------
  // Zero-Cost Local Email Simulation Engine
  // -------------------------------------------------------------------------

  simulateEmailDispatch(notification: any, recipientEmail: string) {
    const timestamp = new Date().toISOString();
    const border = '═'.repeat(68);
    const line = '─'.repeat(68);

    const logMessage = `
╔${border}╗
║ [EMAIL DISPATCH SIMULATOR] — $0 API Cost Delivery Engine            ║
╠${border}╣
║ To:         ${recipientEmail.padEnd(54)}║
║ Type:       ${String(notification.type).padEnd(54)}║
║ Subject:    [PlanetU HRMS] ${notification.title.substring(0, 42).padEnd(42)}║
║ Timestamp:  ${timestamp.padEnd(54)}║
║ Action URL: ${(notification.actionUrl || 'N/A').padEnd(54)}║
╠${line}╣
║ Message:                                                           ║
║ ${notification.message.padEnd(67)}║
╚${border}╝`;

    this.logger.log(logMessage);
  }
}
