import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Role,
  ExitType,
  ExitStatus,
  ApprovalStatus,
  ExitClearanceDepartment,
  ClearanceStatus,
  EmploymentStatus,
  FnFStatus,
  ExitReasonCategory,
  Prisma,
} from '@prisma/client';
import { OffboardingService } from '../src/modules/offboarding/offboarding.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('OffboardingService (Module 9: Offboarding & Exit Management)', () => {
  let service: OffboardingService;
  let mockPrisma: any;
  let mockAttendanceService: any;
  let mockLeaveService: any;
  let mockPayrollService: any;

  const orgId = 'org-off-100';
  const empId = 'emp-off-200';
  const managerEmpId = 'emp-mgr-300';
  const exitReqId = 'req-exit-400';

  const mockEmployeeUser: AuthenticatedUser = {
    id: 'user-emp-200',
    organizationId: orgId,
    email: 'rohan@alpha.com',
    role: Role.EMPLOYEE,
    employeeId: empId,
  };

  const mockManagerUser: AuthenticatedUser = {
    id: 'user-mgr-300',
    organizationId: orgId,
    email: 'manager@alpha.com',
    role: Role.MANAGER,
    employeeId: managerEmpId,
  };

  const mockHrUser: AuthenticatedUser = {
    id: 'user-hr-100',
    organizationId: orgId,
    email: 'hr@alpha.com',
    role: Role.HR_ADMIN,
    employeeId: 'emp-hr-100',
  };

  beforeEach(() => {
    mockPrisma = {
      employee: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      exitRequest: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      exitClearanceTask: {
        findFirst: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
      },
      exitInterview: {
        upsert: jest.fn(),
      },
      salaryStructure: {
        findFirst: jest.fn(),
      },
      fnFSettlement: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      user: {
        updateMany: jest.fn(),
      },
      employeeJobHistory: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    mockAttendanceService = {
      getFinalizedPayableDays: jest.fn().mockResolvedValue({
        payableDays: 20,
        lwpDays: 0,
        unexcusedAbsenceDays: 0,
        totalMonthDays: 30,
      }),
    };

    mockLeaveService = {
      getEmployeeLeaveBalances: jest.fn().mockResolvedValue({
        employee: { id: empId },
        balances: [
          { leaveTypeId: 'lt-pl', leaveTypeName: 'Paid Leave', isPaid: true, availableBalance: 6 },
          { leaveTypeId: 'lt-lwp', leaveTypeName: 'LWP', isPaid: false, availableBalance: 10 },
        ],
      }),
    };

    mockPayrollService = {
      getConfiguration: jest.fn().mockResolvedValue({
        organizationId: orgId,
        pfCeilingAmount: 15000,
        applyPfCeiling: true,
        pfEmployeeRate: 12,
        ptAmount: 200,
        ptSalaryThreshold: 10000,
        roundToWholeRupee: true,
      }),
    };

    service = new OffboardingService(
      mockPrisma,
      mockAttendanceService,
      mockLeaveService,
      mockPayrollService,
    );
  });

  // ---------------------------------------------------------------------------
  // 1. Resignation Submission
  // ---------------------------------------------------------------------------
  describe('applyResignation', () => {
    it('allows an employee to apply for resignation with proposed LWD', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: empId,
        organizationId: orgId,
        employmentStatus: EmploymentStatus.ACTIVE,
        reportingManagerId: managerEmpId,
      });

      mockPrisma.exitRequest.findFirst.mockResolvedValue(null);

      const createdMock = {
        id: exitReqId,
        organizationId: orgId,
        employeeId: empId,
        status: ExitStatus.PENDING_APPROVAL,
        noticePeriodDays: 30,
      };
      mockPrisma.exitRequest.create.mockResolvedValue(createdMock);

      const result = await service.applyResignation(
        orgId,
        {
          reason: 'Pursuing higher studies',
          proposedLastWorkingDay: '2026-10-31T00:00:00.000Z',
          noticePeriodDays: 30,
        },
        mockEmployeeUser,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(ExitStatus.PENDING_APPROVAL);
      expect(mockPrisma.exitRequest.create).toHaveBeenCalled();
    });

    it('rejects resignation if an active exit request is already in progress', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: empId,
        organizationId: orgId,
        employmentStatus: EmploymentStatus.ACTIVE,
      });

      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: 'existing-req',
        status: ExitStatus.PENDING_APPROVAL,
      });

      await expect(
        service.applyResignation(
          orgId,
          {
            reason: 'Duplicate attempt',
            proposedLastWorkingDay: '2026-10-31T00:00:00.000Z',
          },
          mockEmployeeUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Dual Approval Workflow (Manager & HR)
  // ---------------------------------------------------------------------------
  describe('actionResignation', () => {
    it('allows reporting manager to approve resignation', async () => {
      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: exitReqId,
        organizationId: orgId,
        employeeId: empId,
        status: ExitStatus.PENDING_APPROVAL,
        proposedLastWorkingDay: new Date('2026-10-31'),
        employee: { id: empId, reportingManagerId: managerEmpId },
      });

      mockPrisma.exitRequest.update.mockResolvedValue({
        id: exitReqId,
        managerApprovalStatus: ApprovalStatus.APPROVED,
        status: ExitStatus.APPROVED,
      });

      const result = await service.actionResignation(
        orgId,
        exitReqId,
        {
          decision: ApprovalStatus.APPROVED,
          comments: 'Handover plan agreed with employee',
        },
        mockManagerUser,
      );

      expect(result.managerApprovalStatus).toBe(ApprovalStatus.APPROVED);
    });

    it('allows HR to approve, sets NOTICE_PERIOD and seeds clearance tasks', async () => {
      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: exitReqId,
        organizationId: orgId,
        employeeId: empId,
        status: ExitStatus.APPROVED,
        proposedLastWorkingDay: new Date('2026-10-31'),
        employee: { id: empId, reportingManagerId: managerEmpId },
      });

      mockPrisma.exitClearanceTask.count.mockResolvedValue(0);
      mockPrisma.exitClearanceTask.createMany.mockResolvedValue({ count: 7 });

      mockPrisma.exitRequest.update.mockResolvedValue({
        id: exitReqId,
        hrApprovalStatus: ApprovalStatus.APPROVED,
        status: ExitStatus.CLEARANCE_IN_PROGRESS,
      });

      const result = await service.actionResignation(
        orgId,
        exitReqId,
        {
          decision: ApprovalStatus.APPROVED,
          approvedLastWorkingDay: '2026-10-31T00:00:00.000Z',
          comments: 'Approved by HR. Clearances initiated.',
        },
        mockHrUser,
      );

      expect(mockPrisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: empId },
          data: { employmentStatus: EmploymentStatus.NOTICE_PERIOD },
        }),
      );
      expect(mockPrisma.exitClearanceTask.createMany).toHaveBeenCalled();
      expect(result.status).toBe(ExitStatus.CLEARANCE_IN_PROGRESS);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Department Clearance Checklists
  // ---------------------------------------------------------------------------
  describe('updateClearanceTask', () => {
    it('updates clearance task status and advances exit status when all mandatory tasks are done', async () => {
      mockPrisma.exitClearanceTask.findFirst.mockResolvedValue({
        id: 'task-it-1',
        organizationId: orgId,
        exitRequestId: exitReqId,
        isMandatory: true,
      });

      mockPrisma.exitClearanceTask.update.mockResolvedValue({
        id: 'task-it-1',
        status: ClearanceStatus.CLEARED,
      });

      // When checking remaining mandatory tasks, return 0 (all cleared)
      mockPrisma.exitClearanceTask.count.mockResolvedValue(0);

      const result = await service.updateClearanceTask(
        orgId,
        'task-it-1',
        { status: ClearanceStatus.CLEARED, remarks: 'Macbook returned with charger' },
        mockHrUser,
      );

      expect(result.status).toBe(ClearanceStatus.CLEARED);
      expect(mockPrisma.exitRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: exitReqId,
            organizationId: orgId,
            status: ExitStatus.CLEARANCE_IN_PROGRESS,
          },
          data: { status: ExitStatus.SETTLEMENT_PENDING },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Confidential Exit Interview
  // ---------------------------------------------------------------------------
  describe('submitExitInterview', () => {
    it('records exit interview feedback and ratings', async () => {
      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: exitReqId,
        organizationId: orgId,
        employeeId: empId,
      });

      mockPrisma.exitInterview.upsert.mockResolvedValue({
        id: 'interview-1',
        exitRequestId: exitReqId,
        reasonCategory: ExitReasonCategory.CAREER_GROWTH,
        companyCultureRating: 5,
        wouldRecommendCompany: true,
      });

      const result = await service.submitExitInterview(
        orgId,
        exitReqId,
        {
          reasonCategory: ExitReasonCategory.CAREER_GROWTH,
          companyCultureRating: 5,
          managementRating: 4,
          workLifeBalanceRating: 4,
          compensationRating: 4,
          wouldRecommendCompany: true,
          feedback: 'Great team and culture!',
        },
        mockEmployeeUser,
      );

      expect(result.companyCultureRating).toBe(5);
      expect(result.wouldRecommendCompany).toBe(true);
      expect(mockPrisma.exitInterview.upsert).toHaveBeenCalled();
    });

    it('prevents unauthorized employee from submitting interview for another employee', async () => {
      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: exitReqId,
        organizationId: orgId,
        employeeId: 'different-emp-id',
      });

      await expect(
        service.submitExitInterview(
          orgId,
          exitReqId,
          {
            reasonCategory: ExitReasonCategory.OTHER,
            companyCultureRating: 3,
            managementRating: 3,
            workLifeBalanceRating: 3,
            compensationRating: 3,
            wouldRecommendCompany: false,
          },
          mockEmployeeUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Full and Final (FnF) Settlement Calculation
  // ---------------------------------------------------------------------------
  describe('calculateFnFSettlement', () => {
    it('computes statutory FnF settlement combining salary, leave encashment, notice deduction and PF', async () => {
      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: exitReqId,
        organizationId: orgId,
        employeeId: empId,
        resignationDate: new Date('2026-09-01'),
        proposedLastWorkingDay: new Date('2026-09-30'),
        approvedLastWorkingDay: new Date('2026-09-30'),
        noticePeriodDays: 30,
        employee: { id: empId, employeeCode: 'ENG-0001' },
      });

      mockPrisma.salaryStructure.findFirst.mockResolvedValue({
        id: 'sal-1',
        employeeId: empId,
        monthlyGross: 60000,
        basicSalary: 30000,
        hra: 15000,
        specialAllowance: 15000,
      });

      mockPrisma.fnFSettlement.upsert.mockImplementation((args: any) =>
        Promise.resolve(args.create),
      );

      const result = await service.calculateFnFSettlement(orgId, exitReqId, {
        gratuityAmount: 0,
        bonusAmount: 5000,
      });

      expect(result).toBeDefined();
      expect(Number(result.earnedGross)).toBeGreaterThan(0);
      expect(Number(result.leaveEncashmentAmount)).toBeGreaterThan(0); // 6 days * (30000/30 = 1000) = 6000
      expect(Number(result.totalAdditions)).toBeGreaterThan(0);
      expect(Number(result.netSettlementAmount)).toBeGreaterThan(0);
      expect(result.status).toBe(FnFStatus.DRAFT);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Atomic Exit Finalization & Soft Deletion
  // ---------------------------------------------------------------------------
  describe('finalizeExit', () => {
    it('blocks exit finalization if mandatory clearance tasks remain pending', async () => {
      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: exitReqId,
        organizationId: orgId,
        employeeId: empId,
        status: ExitStatus.SETTLEMENT_PENDING,
        clearanceTasks: [
          { id: 't1', isMandatory: true, status: ClearanceStatus.PENDING, title: 'Hardware Return' },
        ],
        fnfSettlement: { id: 'fnf-1', status: FnFStatus.APPROVED },
      });

      await expect(
        service.finalizeExit(orgId, exitReqId, mockHrUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks exit finalization if FnF settlement is not approved yet', async () => {
      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: exitReqId,
        organizationId: orgId,
        employeeId: empId,
        status: ExitStatus.SETTLEMENT_PENDING,
        clearanceTasks: [
          { id: 't1', isMandatory: true, status: ClearanceStatus.CLEARED, title: 'Hardware Return' },
        ],
        fnfSettlement: { id: 'fnf-1', status: FnFStatus.DRAFT },
      });

      await expect(
        service.finalizeExit(orgId, exitReqId, mockHrUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('atomically soft-deletes employee, deactivates user login, and marks exit completed', async () => {
      mockPrisma.exitRequest.findFirst.mockResolvedValue({
        id: exitReqId,
        organizationId: orgId,
        employeeId: empId,
        exitType: ExitType.RESIGNATION,
        status: ExitStatus.SETTLEMENT_PENDING,
        proposedLastWorkingDay: new Date('2026-09-30'),
        approvedLastWorkingDay: new Date('2026-09-30'),
        clearanceTasks: [
          { id: 't1', isMandatory: true, status: ClearanceStatus.CLEARED, title: 'Hardware Return' },
          { id: 't2', isMandatory: false, status: ClearanceStatus.PENDING, title: 'Corporate Card' },
        ],
        fnfSettlement: { id: 'fnf-1', status: FnFStatus.APPROVED },
      });

      mockPrisma.employee.update.mockResolvedValue({
        id: empId,
        employeeCode: 'ENG-0001',
        firstName: 'Rohan',
        lastName: 'Sharma',
        employmentStatus: EmploymentStatus.RESIGNED,
        deletedAt: new Date(),
      });

      mockPrisma.exitRequest.update.mockResolvedValue({
        id: exitReqId,
        status: ExitStatus.COMPLETED,
      });

      mockPrisma.fnFSettlement.update.mockResolvedValue({
        id: 'fnf-1',
        status: FnFStatus.PROCESSED,
      });

      const result = await service.finalizeExit(orgId, exitReqId, mockHrUser);

      expect(result.status).toBe(ExitStatus.COMPLETED);
      expect(mockPrisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: empId },
          data: expect.objectContaining({
            employmentStatus: EmploymentStatus.RESIGNED,
          }),
        }),
      );
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, employeeId: empId },
        data: { isActive: false },
      });
      expect(mockPrisma.fnFSettlement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fnf-1' },
          data: expect.objectContaining({ status: FnFStatus.PROCESSED }),
        }),
      );
    });
  });
});
