import { jest } from '@jest/globals';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Role, GrievanceCategory, GrievancePriority, GrievanceStatus } from '@prisma/client';
import { GrievanceService } from '../src/modules/grievance/grievance.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('GrievanceService & Case Management Module', () => {
  let service: GrievanceService;
  let mockPrisma: any;
  let mockNotificationService: any;
  let mockMailService: any;

  const orgId = 'org-test-grievance-1';

  const employeeUser: AuthenticatedUser = {
    id: 'user-emp-1',
    organizationId: orgId,
    email: 'emp1@company.com',
    role: Role.EMPLOYEE,
    employeeId: 'emp-record-1',
  };

  const otherEmployeeUser: AuthenticatedUser = {
    id: 'user-emp-2',
    organizationId: orgId,
    email: 'emp2@company.com',
    role: Role.EMPLOYEE,
    employeeId: 'emp-record-2',
  };

  const hrAdminUser: AuthenticatedUser = {
    id: 'user-hr-admin',
    organizationId: orgId,
    email: 'hr@company.com',
    role: Role.HR_ADMIN,
    employeeId: null,
  };

  beforeEach(() => {
    mockPrisma = {
      grievance: {
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      grievanceTimeline: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'user-hr-admin', email: 'hr@company.com' },
        ]),
      },
    };

    mockNotificationService = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' } as any),
    };

    mockMailService = {
      sendNotificationEmail: jest.fn().mockResolvedValue({ success: true, mode: 'mock' } as any),
    };

    service = new GrievanceService(mockPrisma, mockNotificationService, mockMailService);
  });

  describe('createGrievance', () => {
    it('creates named grievance with auto-generated ticket number and notifies HR', async () => {
      (mockPrisma.grievance.count as any).mockResolvedValue(0);
      (mockPrisma.grievance.findUnique as any).mockResolvedValue(null);
      (mockPrisma.grievance.create as any).mockImplementation((args: any) =>
        Promise.resolve({
          id: 'grv-1',
          ticketNumber: args.data.ticketNumber,
          category: args.data.category,
          priority: args.data.priority,
          status: args.data.status,
          subject: args.data.subject,
          description: args.data.description,
          isAnonymous: false,
          employeeId: args.data.employeeId,
          submittedByUserId: args.data.submittedByUserId,
        }),
      );

      const res = await service.createGrievance(orgId, employeeUser, {
        category: GrievanceCategory.COMPENSATION_PAYROLL,
        priority: GrievancePriority.HIGH,
        subject: 'Overtime pay discrepancy for August',
        description: 'Approved overtime of 12 hours missing from August payslip calculation.',
        isAnonymous: false,
      });

      expect(res.ticketNumber).toBe(`GRV-${new Date().getFullYear()}-0001`);
      expect(res.employeeId).toBe(employeeUser.employeeId);
      expect(res.submittedByUserId).toBe(employeeUser.id);
      expect(mockPrisma.grievance.create).toHaveBeenCalled();
    });

    it('creates anonymous grievance with employeeId set to null', async () => {
      (mockPrisma.grievance.count as any).mockResolvedValue(3);
      (mockPrisma.grievance.findUnique as any).mockResolvedValue(null);
      (mockPrisma.grievance.create as any).mockImplementation((args: any) =>
        Promise.resolve({
          id: 'grv-2',
          ticketNumber: args.data.ticketNumber,
          category: args.data.category,
          priority: args.data.priority,
          subject: args.data.subject,
          description: args.data.description,
          isAnonymous: true,
          employeeId: args.data.employeeId,
          submittedByUserId: args.data.submittedByUserId,
        }),
      );

      const res = await service.createGrievance(orgId, employeeUser, {
        category: GrievanceCategory.HARASSMENT_DISCRIMINATION,
        priority: GrievancePriority.URGENT,
        subject: 'Unfair treatment and retaliation concern',
        description: 'Detailed incident report filed anonymously for safety.',
        isAnonymous: true,
      });

      expect(res.ticketNumber).toBe(`GRV-${new Date().getFullYear()}-0004`);
      expect(res.employeeId).toBeNull();
      expect(res.isAnonymous).toBe(true);
    });
  });

  describe('getGrievanceById & Privacy Masking', () => {
    it('blocks regular employee from viewing another users grievance', async () => {
      (mockPrisma.grievance.findFirst as any).mockResolvedValue({
        id: 'grv-priv-1',
        organizationId: orgId,
        submittedByUserId: 'user-emp-1',
        isAnonymous: false,
        timelines: [],
      });

      await expect(
        service.getGrievanceById(orgId, 'grv-priv-1', otherEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('strips submitter identity when HR admin views an anonymous grievance', async () => {
      (mockPrisma.grievance.findFirst as any).mockResolvedValue({
        id: 'grv-anon-1',
        organizationId: orgId,
        ticketNumber: 'GRV-2026-0099',
        isAnonymous: true,
        submittedByUserId: 'user-emp-1',
        employee: { firstName: 'Secret', lastName: 'Employee' },
        submittedByUser: { email: 'secret@company.com' },
        timelines: [
          {
            id: 't-1',
            actionByUserId: 'user-emp-1',
            actionTitle: 'Grievance Submitted',
            isInternalOnly: false,
          },
        ],
      });

      const res = await service.getGrievanceById(orgId, 'grv-anon-1', hrAdminUser);

      expect(res.employee).toBeNull();
      expect(res.submittedByUser).toBeNull();
      expect(res.submittedByUserId).toBeNull();
      expect(res.timelines[0].actionByUser.employee.firstName).toBe('Anonymous');
    });
  });

  describe('updateStatus & addTimelineNote', () => {
    it('updates status and appends audit timeline item', async () => {
      (mockPrisma.grievance.findFirst as any).mockResolvedValue({
        id: 'grv-update-1',
        organizationId: orgId,
        status: GrievanceStatus.SUBMITTED,
        ticketNumber: 'GRV-2026-0005',
        submittedByUserId: 'user-emp-1',
      });

      (mockPrisma.grievance.update as any).mockResolvedValue({
        id: 'grv-update-1',
        status: GrievanceStatus.UNDER_INVESTIGATION,
        timelines: [],
      });

      const res = await service.updateStatus(orgId, 'grv-update-1', hrAdminUser, {
        status: GrievanceStatus.UNDER_INVESTIGATION,
        notes: 'Investigator assigned to conduct interview.',
        isInternalOnly: false,
      });

      expect(res.status).toBe(GrievanceStatus.UNDER_INVESTIGATION);
      expect(mockPrisma.grievance.update).toHaveBeenCalled();
    });

    it('creates an internal-only audit note for committee deliberations', async () => {
      (mockPrisma.grievance.findFirst as any).mockResolvedValue({
        id: 'grv-note-1',
        organizationId: orgId,
      });

      (mockPrisma.grievanceTimeline.create as any).mockResolvedValue({
        id: 'tl-1',
        actionTitle: 'Internal Investigation Note',
        notes: 'Confidential committee deliberation details.',
        isInternalOnly: true,
      });

      const note = await service.addTimelineNote(orgId, 'grv-note-1', hrAdminUser, {
        notes: 'Confidential committee deliberation details.',
        isInternalOnly: true,
      });

      expect(note.isInternalOnly).toBe(true);
      expect(note.actionTitle).toBe('Internal Investigation Note');
    });
  });

  describe('resolveGrievance & submitFeedback', () => {
    it('resolves grievance, records resolution notes and notifies employee', async () => {
      (mockPrisma.grievance.findFirst as any).mockResolvedValue({
        id: 'grv-res-1',
        organizationId: orgId,
        status: GrievanceStatus.UNDER_INVESTIGATION,
        ticketNumber: 'GRV-2026-0010',
        submittedByUserId: 'user-emp-1',
        isAnonymous: false,
        employee: { firstName: 'Alice', lastName: 'Smith', personalEmail: 'alice@company.com' },
      });

      (mockPrisma.grievance.update as any).mockResolvedValue({
        id: 'grv-res-1',
        status: GrievanceStatus.RESOLVED,
        resolutionNotes: 'Salary adjustment of ₹4,500 credited to September payroll batch.',
        timelines: [],
      });

      const res = await service.resolveGrievance(orgId, 'grv-res-1', hrAdminUser, {
        resolutionNotes: 'Salary adjustment of ₹4,500 credited to September payroll batch.',
        status: GrievanceStatus.RESOLVED,
      });

      expect(res.status).toBe(GrievanceStatus.RESOLVED);
      expect(mockNotificationService.createNotification).toHaveBeenCalled();
      expect(mockMailService.sendNotificationEmail).toHaveBeenCalled();
    });

    it('allows employee to submit satisfaction rating and closes ticket', async () => {
      (mockPrisma.grievance.findFirst as any).mockResolvedValue({
        id: 'grv-close-1',
        organizationId: orgId,
        status: GrievanceStatus.RESOLVED,
        submittedByUserId: employeeUser.id,
      });

      (mockPrisma.grievance.update as any).mockResolvedValue({
        id: 'grv-close-1',
        status: GrievanceStatus.CLOSED,
        satisfactionRating: 5,
        feedbackComments: 'Resolved quickly and transparently.',
      });

      const res = await service.submitFeedback(orgId, 'grv-close-1', employeeUser, {
        satisfactionRating: 5,
        feedbackComments: 'Resolved quickly and transparently.',
      });

      expect(res.status).toBe(GrievanceStatus.CLOSED);
      expect(res.satisfactionRating).toBe(5);
    });

    it('rejects feedback from unauthorized user', async () => {
      (mockPrisma.grievance.findFirst as any).mockResolvedValue({
        id: 'grv-close-2',
        organizationId: orgId,
        status: GrievanceStatus.RESOLVED,
        submittedByUserId: employeeUser.id,
      });

      await expect(
        service.submitFeedback(orgId, 'grv-close-2', otherEmployeeUser, {
          satisfactionRating: 4,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getGrievanceStats', () => {
    it('calculates executive SLA metrics and average employee rating', async () => {
      (mockPrisma.grievance.count as any)
        .mockResolvedValueOnce(12) // total
        .mockResolvedValueOnce(3)  // submitted
        .mockResolvedValueOnce(2)  // under investigation
        .mockResolvedValueOnce(1)  // escalated
        .mockResolvedValueOnce(4)  // resolved
        .mockResolvedValueOnce(2)  // closed
        .mockResolvedValueOnce(0)  // rejected
        .mockResolvedValueOnce(2); // urgent

      (mockPrisma.grievance.groupBy as any).mockResolvedValue([
        { category: GrievanceCategory.HARASSMENT_DISCRIMINATION, _count: { id: 3 } },
        { category: GrievanceCategory.COMPENSATION_PAYROLL, _count: { id: 5 } },
      ]);

      (mockPrisma.grievance.findMany as any).mockResolvedValue([
        { satisfactionRating: 5 },
        { satisfactionRating: 4 },
      ]);

      const stats = await service.getGrievanceStats(orgId);

      expect(stats.total).toBe(12);
      expect(stats.activeCases).toBe(6); // 3 submitted + 2 under investigation + 1 escalated
      expect(stats.urgentActive).toBe(2);
      expect(stats.resolved).toBe(6); // 4 resolved + 2 closed
      expect(stats.averageSatisfactionRating).toBe(4.5);
      expect(stats.byCategory[GrievanceCategory.COMPENSATION_PAYROLL]).toBe(5);
    });
  });
});
