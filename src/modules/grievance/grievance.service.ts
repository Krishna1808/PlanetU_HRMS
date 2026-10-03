import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  GrievanceStatus,
  GrievancePriority,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { MailService } from '../mail/mail.service';
import { CreateGrievanceDto } from './dto/create-grievance.dto';
import { UpdateGrievanceStatusDto } from './dto/update-grievance-status.dto';
import { AddTimelineNoteDto } from './dto/add-timeline-note.dto';
import { ResolveGrievanceDto } from './dto/resolve-grievance.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { QueryGrievanceDto } from './dto/query-grievance.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Injectable()
export class GrievanceService {
  private readonly logger = new Logger(GrievanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @Optional() private readonly mailService?: MailService,
  ) {}

  /**
   * 1. Submit a new grievance (Employee Self-Service or Management)
   */
  async createGrievance(
    organizationId: string,
    user: AuthenticatedUser,
    dto: CreateGrievanceDto,
  ) {
    const year = new Date().getFullYear();
    const count = await this.prisma.grievance.count({
      where: { organizationId },
    });

    let seq = count + 1;
    let ticketNumber = `GRV-${year}-${String(seq).padStart(4, '0')}`;
    while (
      await this.prisma.grievance.findUnique({
        where: {
          organizationId_ticketNumber: {
            organizationId,
            ticketNumber,
          },
        },
      })
    ) {
      seq++;
      ticketNumber = `GRV-${year}-${String(seq).padStart(4, '0')}`;
    }

    const isAnonymous = Boolean(dto.isAnonymous);

    const grievance = await this.prisma.grievance.create({
      data: {
        organizationId,
        ticketNumber,
        category: dto.category,
        priority: dto.priority || GrievancePriority.MEDIUM,
        status: GrievanceStatus.SUBMITTED,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        isAnonymous,
        employeeId: isAnonymous ? null : user.employeeId || null,
        submittedByUserId: user.id,
        attachmentUrl: dto.attachmentUrl || null,
        attachmentName: dto.attachmentName || null,
        timelines: {
          create: {
            organizationId,
            actionTitle: 'Grievance Submitted',
            notes: isAnonymous
              ? 'Case filed anonymously and ticket assigned.'
              : 'Case filed and ticket assigned.',
            actionByUserId: user.id,
            newStatus: GrievanceStatus.SUBMITTED,
            isInternalOnly: false,
          },
        },
      },
      include: {
        timelines: true,
      },
    });

    // Notify HR Admins & Super Admins asynchronously
    this.notifyHrAdminsOnNewGrievance(organizationId, grievance).catch((err) => {
      this.logger.error(`Error notifying HR on grievance creation: ${err.message}`);
    });

    return grievance;
  }

  /**
   * 2. Get all grievances filed by the current user (Employee Self-Service)
   */
  async getMyGrievances(organizationId: string, user: AuthenticatedUser) {
    const records = await this.prisma.grievance.findMany({
      where: {
        organizationId,
        submittedByUserId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedToUser: {
          select: {
            id: true,
            email: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            email: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        timelines: {
          where: { isInternalOnly: false },
          orderBy: { createdAt: 'desc' },
          include: {
            actionByUser: {
              select: {
                id: true,
                role: true,
                employee: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    return records;
  }

  /**
   * 3. Get details of a single grievance with role-aware privacy masking
   */
  async getGrievanceById(
    organizationId: string,
    id: string,
    user: AuthenticatedUser,
  ) {
    const isHrOrAdmin =
      user.role === Role.CLIENT_SUPER_ADMIN || user.role === Role.HR_ADMIN;

    const grievance = await this.prisma.grievance.findFirst({
      where: { id, organizationId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            personalEmail: true,
            phone: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
          },
        },
        submittedByUser: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        assignedToUser: {
          select: {
            id: true,
            email: true,
            role: true,
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            email: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        timelines: {
          where: isHrOrAdmin ? undefined : { isInternalOnly: false },
          orderBy: { createdAt: 'desc' },
          include: {
            actionByUser: {
              select: {
                id: true,
                email: true,
                role: true,
                employee: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!grievance) {
      throw new NotFoundException(`Grievance with ID ${id} not found.`);
    }

    // Permission check for regular employees: can only view own cases
    if (!isHrOrAdmin && grievance.submittedByUserId !== user.id) {
      throw new ForbiddenException(
        'You do not have authorization to view this grievance.',
      );
    }

    // Confidentiality masking for HR views when anonymous
    if (isHrOrAdmin && grievance.isAnonymous) {
      return {
        ...grievance,
        employee: null,
        submittedByUser: null,
        submittedByUserId: null,
        timelines: grievance.timelines.map((t) => {
          if (t.actionByUserId === grievance.submittedByUserId) {
            return {
              ...t,
              actionByUser: {
                id: 'anonymous',
                role: Role.EMPLOYEE,
                email: 'anonymous@confidential.local',
                employee: { firstName: 'Anonymous', lastName: 'Submitter' },
              },
            };
          }
          return t;
        }),
      };
    }

    return grievance;
  }

  /**
   * 4. List all grievances with filters, pagination, and search (HR Admin & Management)
   */
  async listAllGrievances(
    organizationId: string,
    query: QueryGrievanceDto,
    user: AuthenticatedUser,
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { ticketNumber: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.grievance.count({ where }),
      this.prisma.grievance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: { select: { id: true, name: true } },
            },
          },
          assignedToUser: {
            select: {
              id: true,
              email: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
          resolvedByUser: {
            select: {
              id: true,
              email: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
          _count: {
            select: { timelines: true },
          },
        },
      }),
    ]);

    // Mask anonymous entries
    const sanitized = records.map((g) => {
      if (g.isAnonymous) {
        return {
          ...g,
          employee: null,
          submittedByUserId: null,
        };
      }
      return g;
    });

    return {
      data: sanitized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 5. Update grievance status and/or assign investigator
   */
  async updateStatus(
    organizationId: string,
    id: string,
    user: AuthenticatedUser,
    dto: UpdateGrievanceStatusDto,
  ) {
    const grievance = await this.prisma.grievance.findFirst({
      where: { id, organizationId },
    });

    if (!grievance) {
      throw new NotFoundException(`Grievance not found.`);
    }

    const previousStatus = grievance.status;
    const isStatusChanged = previousStatus !== dto.status;

    let actionTitle = `Status updated to ${dto.status.replace(/_/g, ' ')}`;
    if (dto.assignedToUserId && dto.assignedToUserId !== grievance.assignedToUserId) {
      actionTitle = isStatusChanged
        ? `Assigned investigator & status updated to ${dto.status.replace(/_/g, ' ')}`
        : `Investigator assigned`;
    }

    const updated = await this.prisma.grievance.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.assignedToUserId !== undefined
          ? { assignedToUserId: dto.assignedToUserId }
          : {}),
        timelines: {
          create: {
            organizationId,
            previousStatus,
            newStatus: dto.status,
            actionTitle,
            notes: dto.notes?.trim() || null,
            isInternalOnly: Boolean(dto.isInternalOnly),
            actionByUserId: user.id,
          },
        },
      },
      include: {
        timelines: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Notify submitter if note is not internal-only
    if (!dto.isInternalOnly && grievance.submittedByUserId) {
      this.notificationService
        .createNotification(organizationId, {
          recipientUserId: grievance.submittedByUserId,
          type: 'GRIEVANCE_UPDATE' as any,
          title: `Grievance ${grievance.ticketNumber}: ${dto.status.replace(/_/g, ' ')}`,
          message: dto.notes
            ? `Your case status is now ${dto.status.replace(/_/g, ' ')}. Note: "${dto.notes}"`
            : `Your case status has been updated to ${dto.status.replace(/_/g, ' ')}.`,
          actionUrl: '/ess',
          metadata: { grievanceId: grievance.id, status: dto.status },
        })
        .catch((err) => this.logger.warn(`Could not send submitter notification: ${err.message}`));
    }

    return updated;
  }

  /**
   * 6. Add investigation note / audit trail entry
   */
  async addTimelineNote(
    organizationId: string,
    id: string,
    user: AuthenticatedUser,
    dto: AddTimelineNoteDto,
  ) {
    const grievance = await this.prisma.grievance.findFirst({
      where: { id, organizationId },
    });

    if (!grievance) {
      throw new NotFoundException(`Grievance not found.`);
    }

    const note = await this.prisma.grievanceTimeline.create({
      data: {
        organizationId,
        grievanceId: id,
        actionByUserId: user.id,
        actionTitle: dto.isInternalOnly
          ? 'Internal Investigation Note'
          : 'Investigation Update Note',
        notes: dto.notes.trim(),
        isInternalOnly: Boolean(dto.isInternalOnly),
      },
      include: {
        actionByUser: {
          select: {
            id: true,
            email: true,
            role: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Notify submitter if public
    if (!dto.isInternalOnly && grievance.submittedByUserId) {
      this.notificationService
        .createNotification(organizationId, {
          recipientUserId: grievance.submittedByUserId,
          type: 'GRIEVANCE_UPDATE' as any,
          title: `New Note on Grievance ${grievance.ticketNumber}`,
          message: `The committee has logged an update: "${dto.notes.substring(0, 120)}..."`,
          actionUrl: '/ess',
          metadata: { grievanceId: grievance.id },
        })
        .catch((err) => this.logger.warn(`Could not send submitter notification: ${err.message}`));
    }

    return note;
  }

  /**
   * 7. Resolve or Dismiss Grievance Case
   */
  async resolveGrievance(
    organizationId: string,
    id: string,
    user: AuthenticatedUser,
    dto: ResolveGrievanceDto,
  ) {
    const grievance = await this.prisma.grievance.findFirst({
      where: { id, organizationId },
      include: {
        submittedByUser: { select: { id: true, email: true } },
        employee: { select: { firstName: true, lastName: true, personalEmail: true } },
      },
    });

    if (!grievance) {
      throw new NotFoundException(`Grievance not found.`);
    }

    const targetStatus = dto.status || GrievanceStatus.RESOLVED;

    const updated = await this.prisma.grievance.update({
      where: { id },
      data: {
        status: targetStatus,
        resolutionNotes: dto.resolutionNotes.trim(),
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
        timelines: {
          create: {
            organizationId,
            previousStatus: grievance.status,
            newStatus: targetStatus,
            actionTitle:
              targetStatus === GrievanceStatus.RESOLVED
                ? 'Grievance Resolved'
                : 'Grievance Dismissed / Rejected',
            notes: dto.resolutionNotes.trim(),
            isInternalOnly: false,
            actionByUserId: user.id,
          },
        },
      },
      include: {
        timelines: { orderBy: { createdAt: 'desc' } },
        resolvedByUser: {
          select: {
            id: true,
            email: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Notify submitter via in-app notification
    if (grievance.submittedByUserId) {
      this.notificationService
        .createNotification(organizationId, {
          recipientUserId: grievance.submittedByUserId,
          type: 'GRIEVANCE_UPDATE' as any,
          title: `Grievance ${grievance.ticketNumber} ${targetStatus === GrievanceStatus.RESOLVED ? 'Resolved' : 'Closed'}`,
          message: `Your grievance has been marked as ${targetStatus.replace(/_/g, ' ')}. Resolution: "${dto.resolutionNotes.substring(0, 140)}...". Please review and leave feedback.`,
          actionUrl: '/ess',
          metadata: { grievanceId: grievance.id, status: targetStatus },
        })
        .catch((err) => this.logger.warn(`Could not send submitter notification: ${err.message}`));
    }

    // If submitter has email and case is not anonymous, send resolution email notice
    const emailTo =
      grievance.employee?.personalEmail || grievance.submittedByUser?.email;
    const recipientName = grievance.employee
      ? `${grievance.employee.firstName} ${grievance.employee.lastName}`
      : 'Colleague';

    if (emailTo && !grievance.isAnonymous && this.mailService) {
      this.mailService
        .sendNotificationEmail({
          to: emailTo,
          recipientName,
          type: 'GRIEVANCE_UPDATE',
          title: `Resolution Notice: Grievance Ticket ${grievance.ticketNumber}`,
          message: `Your grievance regarding "${grievance.subject}" has been reviewed and concluded with status ${targetStatus.replace(/_/g, ' ')}.\n\nResolution Summary:\n${dto.resolutionNotes}\n\nPlease log in to PlanetU HRMS Self-Service to view the full investigation timeline and share your satisfaction feedback.`,
          actionUrl: '/ess',
          metadata: {
            ticketNumber: grievance.ticketNumber,
            status: targetStatus,
          },
        })
        .catch((err) => this.logger.warn(`Failed to send resolution email: ${err.message}`));
    }

    return updated;
  }

  /**
   * 8. Submit closure rating & employee feedback
   */
  async submitFeedback(
    organizationId: string,
    id: string,
    user: AuthenticatedUser,
    dto: SubmitFeedbackDto,
  ) {
    const grievance = await this.prisma.grievance.findFirst({
      where: { id, organizationId },
    });

    if (!grievance) {
      throw new NotFoundException(`Grievance not found.`);
    }

    if (grievance.submittedByUserId !== user.id) {
      throw new ForbiddenException(
        'Only the employee who submitted this grievance may provide closure feedback.',
      );
    }

    if (
      grievance.status !== GrievanceStatus.RESOLVED &&
      grievance.status !== GrievanceStatus.REJECTED &&
      grievance.status !== GrievanceStatus.CLOSED
    ) {
      throw new BadRequestException(
        'Feedback can only be submitted once the grievance is resolved or concluded.',
      );
    }

    const updated = await this.prisma.grievance.update({
      where: { id },
      data: {
        satisfactionRating: dto.satisfactionRating,
        feedbackComments: dto.feedbackComments?.trim() || null,
        status: GrievanceStatus.CLOSED,
        closedAt: new Date(),
        timelines: {
          create: {
            organizationId,
            previousStatus: grievance.status,
            newStatus: GrievanceStatus.CLOSED,
            actionTitle: 'Feedback Submitted & Ticket Closed',
            notes: `Employee satisfaction: ${dto.satisfactionRating} / 5 stars.${dto.feedbackComments ? ` Feedback: "${dto.feedbackComments.trim()}"` : ''}`,
            isInternalOnly: false,
            actionByUserId: user.id,
          },
        },
      },
      include: {
        timelines: { orderBy: { createdAt: 'desc' } },
      },
    });

    return updated;
  }

  /**
   * 9. Management & Committee Analytics / Metric Cards
   */
  async getGrievanceStats(organizationId: string) {
    const [
      total,
      submitted,
      underInvestigation,
      escalated,
      resolved,
      closed,
      rejected,
      urgent,
      categoryGroups,
      closedWithRatings,
    ] = await Promise.all([
      this.prisma.grievance.count({ where: { organizationId } }),
      this.prisma.grievance.count({
        where: { organizationId, status: GrievanceStatus.SUBMITTED },
      }),
      this.prisma.grievance.count({
        where: { organizationId, status: GrievanceStatus.UNDER_INVESTIGATION },
      }),
      this.prisma.grievance.count({
        where: { organizationId, status: GrievanceStatus.ESCALATED },
      }),
      this.prisma.grievance.count({
        where: { organizationId, status: GrievanceStatus.RESOLVED },
      }),
      this.prisma.grievance.count({
        where: { organizationId, status: GrievanceStatus.CLOSED },
      }),
      this.prisma.grievance.count({
        where: { organizationId, status: GrievanceStatus.REJECTED },
      }),
      this.prisma.grievance.count({
        where: {
          organizationId,
          priority: GrievancePriority.URGENT,
          status: {
            notIn: [
              GrievanceStatus.RESOLVED,
              GrievanceStatus.CLOSED,
              GrievanceStatus.REJECTED,
            ],
          },
        },
      }),
      this.prisma.grievance.groupBy({
        by: ['category'],
        where: { organizationId },
        _count: { id: true },
      }),
      this.prisma.grievance.findMany({
        where: {
          organizationId,
          satisfactionRating: { not: null },
        },
        select: { satisfactionRating: true },
      }),
    ]);

    const avgRating =
      closedWithRatings.length > 0
        ? Number(
            (
              closedWithRatings.reduce(
                (sum, r) => sum + (r.satisfactionRating || 0),
                0,
              ) / closedWithRatings.length
            ).toFixed(1),
          )
        : null;

    const byCategory = categoryGroups.reduce((acc, curr) => {
      acc[curr.category] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      activeCases: submitted + underInvestigation + escalated,
      submitted,
      underInvestigation,
      escalated,
      resolved: resolved + closed,
      rejected,
      urgentActive: urgent,
      averageSatisfactionRating: avgRating,
      totalFeedbackCount: closedWithRatings.length,
      byCategory,
    };
  }

  /**
   * Helper: Asynchronously alert HR Admins & Client Super Admins of a newly submitted grievance
   */
  private async notifyHrAdminsOnNewGrievance(
    organizationId: string,
    grievance: any,
  ) {
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: [Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN] },
      },
      select: { id: true, email: true },
    });

    const isUrgent = grievance.priority === GrievancePriority.URGENT;
    const priorityPrefix = isUrgent ? '[URGENT] ' : '';

    for (const admin of admins) {
      await this.notificationService
        .createNotification(organizationId, {
          recipientUserId: admin.id,
          type: 'GRIEVANCE_UPDATE' as any,
          title: `${priorityPrefix}New Grievance Filed: ${grievance.ticketNumber || ''}`,
          message: `${grievance.isAnonymous ? 'An anonymous employee' : 'An employee'} reported a concern (${(grievance.category || 'GENERAL').replace(/_/g, ' ')}): "${(grievance.subject || '').substring(0, 100)}"`,
          actionUrl: '/grievances',
          metadata: {
            grievanceId: grievance.id,
            priority: grievance.priority,
            category: grievance.category,
          },
        })
        .catch(() => {});
    }
  }
}
