import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationEventBusService } from './notification-event-bus.service';
import { MailService } from '../mail/mail.service';
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
    @Optional() @InjectQueue('mail-queue') private readonly mailQueue?: Queue,
    @Optional() private readonly mailService?: MailService,
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

    // 6. Bonus / Adjustment Awarded
    this.eventBus.on('payroll.bonus_awarded', async (payload) => {
      try {
        const typeLabel = payload.type === 'BONUS' ? 'Performance Bonus' : payload.type.replace('_', ' ');
        await this.createNotification(payload.organizationId, {
          recipientUserId: payload.recipientUserId,
          type: 'BONUS_AWARDED' as any,
          title: `🎉 ${typeLabel} Awarded: ₹${Number(payload.amount).toLocaleString('en-IN')}`,
          message: `Good news! An adjustment of ₹${Number(payload.amount).toLocaleString('en-IN')} (${payload.type}) has been credited to your upcoming ${payload.month}/${payload.year} payroll.${payload.reason ? ` Reason: ${payload.reason}` : ''}`,
          actionUrl: '/ess',
          metadata: { amount: payload.amount, type: payload.type, month: payload.month, year: payload.year },
        });
      } catch (err: any) {
        this.logger.error(`Failed to handle payroll.bonus_awarded: ${err?.message}`);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Notifications CRUD & Retrieval
  // -------------------------------------------------------------------------

  async createNotification(organizationId: string, dto: CreateNotificationDto) {
    const recipient = await this.prisma.user.findFirst({
      where: { id: dto.recipientUserId, organizationId },
      include: {
        employee: {
          select: { firstName: true, lastName: true },
        },
      },
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

    // Real-time asynchronous email notification via BullMQ + Redis
    const recipientName = recipient.employee
      ? `${recipient.employee.firstName} ${recipient.employee.lastName}`.trim()
      : recipient.email.split('@')[0];

    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const actionUrl = dto.actionUrl ? `${frontendBaseUrl}${dto.actionUrl}` : undefined;

    await this.dispatchEmailNotification(
      {
        to: recipient.email,
        recipientName,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        actionUrl,
        metadata: (dto.metadata as Record<string, any>) || undefined,
      },
      notification,
    );

    return notification;
  }

  private async dispatchEmailNotification(
    payload: {
      to: string;
      recipientName: string;
      type: string;
      title: string;
      message: string;
      actionUrl?: string;
      metadata?: Record<string, any>;
    },
    fallbackNotification?: any,
  ) {
    if (this.mailQueue) {
      try {
        await this.mailQueue.add('send-notification-email', payload, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
        this.logger.log(`Email job queued in Redis for ${payload.to}`);
        return;
      } catch (err: any) {
        this.logger.warn(
          `BullMQ queueing unavailable (${err.message}). Attempting direct mail dispatch.`,
        );
      }
    }

    if (this.mailService) {
      await this.mailService.sendNotificationEmail(payload);
    } else if (fallbackNotification) {
      this.simulateEmailDispatch(fallbackNotification, payload.to);
    }
  }

  async sendTestEmail(toEmail: string) {
    if (this.mailService) {
      return this.mailService.sendTestEmail(toEmail);
    }
    return {
      success: true,
      message: 'Mail service not active. Local simulated envelope logged.',
      mode: 'simulation',
    };
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
    const isAdmin =
      user.role === Role.CLIENT_SUPER_ADMIN || user.role === Role.HR_ADMIN;

    let isManagerOrHead = false;
    const allowedDepartmentIds: string[] = [];

    if (!isAdmin) {
      if (user.role === Role.MANAGER) {
        isManagerOrHead = true;
      }

      if (user.employeeId) {
        const [emp, headedDepts] = await Promise.all([
          this.prisma.employee.findUnique({
            where: { id: user.employeeId },
            select: { departmentId: true },
          }),
          this.prisma.department.findMany({
            where: { organizationId, headId: user.employeeId },
            select: { id: true },
          }),
        ]);

        if (headedDepts.length > 0) {
          isManagerOrHead = true;
          allowedDepartmentIds.push(...headedDepts.map((d) => d.id));
        }
        if (emp?.departmentId) {
          allowedDepartmentIds.push(emp.departmentId);
        }
      }

      if (!isManagerOrHead) {
        throw new ForbiddenException(
          'Only HR Admins, Super Admins, Managers, or Department Heads can publish announcements.',
        );
      }

      if (!dto.targetDepartmentId) {
        throw new ForbiddenException(
          'Managers and Department Heads can only publish announcements specific to their department.',
        );
      }

      if (!allowedDepartmentIds.includes(dto.targetDepartmentId)) {
        throw new ForbiddenException(
          'You are not authorized to publish announcements for this department.',
        );
      }
    }

    if (dto.targetDepartmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.targetDepartmentId, organizationId },
      });
      if (!dept) {
        throw new NotFoundException('Target department does not exist in this organization.');
      }
    }

    // Auto-expiration calculation (default: 24 hours)
    let expiresAt: Date;
    if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
    } else {
      const hours = dto.durationHours && dto.durationHours > 0 ? dto.durationHours : 24;
      expiresAt = new Date(Date.now() + hours * 3600 * 1000);
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        organizationId,
        createdByUserId: user.id,
        title: dto.title,
        content: dto.content,
        priority: dto.priority || 'NORMAL',
        targetDepartmentId: dto.targetDepartmentId || null,
        expiresAt,
      },
      include: {
        targetDepartment: { select: { id: true, name: true, codePrefix: true } },
        createdBy: { select: { id: true, email: true, role: true } },
      },
    });

    // Fan-out notifications to users
    const targetUsers = await this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(dto.targetDepartmentId
          ? { employee: { departmentId: dto.targetDepartmentId } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    if (targetUsers.length > 0) {
      if (dto.fanOutNotifications !== false) {
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
          `Announcement fanned out to ${targetUsers.length} in-app notification recipients.`,
        );
      }

      // Email Broadcast (default: enabled)
      if (dto.sendEmail !== false) {
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        for (const u of targetUsers) {
          const recipientName = u.employee
            ? `${u.employee.firstName} ${u.employee.lastName}`.trim()
            : u.email.split('@')[0];

          await this.dispatchEmailNotification(
            {
              to: u.email,
              recipientName,
              type: 'ANNOUNCEMENT',
              title: `📢 Announcement: ${dto.title}`,
              message: dto.content,
              actionUrl: frontendBaseUrl,
              metadata: {
                announcementId: announcement.id,
                priority: announcement.priority,
                expiresAt: expiresAt.toISOString(),
              },
            },
            null,
          );
        }
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

    // Opportunistic sweep: mark expired announcements inactive in the database
    this.prisma.announcement.updateMany({
      where: {
        organizationId,
        isActive: true,
        expiresAt: { lte: new Date() },
      },
      data: { isActive: false },
    }).catch(() => {});

    const whereClause: any = { organizationId };

    if (query.isActive !== undefined) {
      whereClause.isActive = query.isActive === 'true';
    } else if (!isAdmin) {
      whereClause.isActive = true;
    }

    // Active announcements must not be expired
    if (whereClause.isActive === true) {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      ];
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
    const announcement = await this.prisma.announcement.findFirst({
      where: { id: announcementId, organizationId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found.');
    }

    const isAdmin =
      user.role === Role.CLIENT_SUPER_ADMIN || user.role === Role.HR_ADMIN;
    const isAuthor = announcement.createdByUserId === user.id;

    let isDeptHead = false;
    if (!isAdmin && !isAuthor && user.employeeId && announcement.targetDepartmentId) {
      const dept = await this.prisma.department.findFirst({
        where: {
          id: announcement.targetDepartmentId,
          organizationId,
          headId: user.employeeId,
        },
      });
      if (dept) isDeptHead = true;
    }

    if (!isAdmin && !isAuthor && !isDeptHead) {
      throw new ForbiddenException('You do not have permission to deactivate this announcement.');
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
