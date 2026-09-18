import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  OnboardingStatus,
  OnboardingTaskStatus,
  Role,
} from '@prisma/client';
import { OnboardingService } from '../src/modules/onboarding/onboarding.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('OnboardingService (Module 8: Employee Onboarding & Account Provisioning)', () => {
  let service: OnboardingService;
  let mockPrisma: any;
  let mockSequenceService: any;

  const orgId = 'org-test-100';
  const deptId = 'dept-eng-100';
  const desId = 'des-dev-100';
  const hrUserId = 'user-hr-100';

  const mockHrUser: AuthenticatedUser = {
    id: hrUserId,
    organizationId: orgId,
    email: 'hr@planetu.com',
    role: Role.HR_ADMIN,
    employeeId: 'emp-hr-100',
  };

  beforeEach(() => {
    mockPrisma = {
      onboardingCandidate: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      onboardingTask: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      department: {
        findFirst: jest.fn(),
      },
      designation: {
        findFirst: jest.fn(),
      },
      grade: {
        findFirst: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      employeeJobHistory: {
        create: jest.fn(),
      },
      shift: {
        findFirst: jest.fn(),
      },
      employeeShiftAssignment: {
        create: jest.fn(),
      },
      payrollConfiguration: {
        findUnique: jest.fn(),
      },
      salaryStructure: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    mockSequenceService = {
      generateEmployeeCode: jest.fn().mockResolvedValue('ENG-0005'),
    };

    service = new OnboardingService(mockPrisma, mockSequenceService);
  });

  // ---------------------------------------------------------------------------
  // 1. Candidate Invitation & Task Creation
  // ---------------------------------------------------------------------------

  describe('inviteCandidate', () => {
    it('successfully invites a candidate and creates 4 default verification checklist tasks', async () => {
      mockPrisma.onboardingCandidate.findUnique.mockResolvedValue(null);
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.department.findFirst.mockResolvedValue({ id: deptId, name: 'Engineering', codePrefix: 'ENG' });
      mockPrisma.designation.findFirst.mockResolvedValue({ id: desId, name: 'Senior Software Engineer' });

      const mockCreatedCandidate = {
        id: 'cand-1',
        organizationId: orgId,
        firstName: 'Alice',
        lastName: 'Smith',
        personalEmail: 'alice@example.com',
        departmentId: deptId,
        designationId: desId,
        proposedJoiningDate: new Date('2026-10-01'),
        status: OnboardingStatus.INVITED,
      };

      mockPrisma.onboardingCandidate.create.mockResolvedValue(mockCreatedCandidate);
      mockPrisma.onboardingTask.findMany.mockResolvedValue([
        { id: 't1', title: 'Identity & Address Verification', isMandatory: true, status: OnboardingTaskStatus.PENDING },
        { id: 't2', title: 'Bank Account & Statutory Details', isMandatory: true, status: OnboardingTaskStatus.PENDING },
        { id: 't3', title: 'Signed Offer Letter & NDA', isMandatory: true, status: OnboardingTaskStatus.PENDING },
        { id: 't4', title: 'IT Asset & Hardware Provisioning', isMandatory: false, status: OnboardingTaskStatus.PENDING },
      ]);

      const result = await service.inviteCandidate(
        orgId,
        {
          firstName: 'Alice',
          lastName: 'Smith',
          personalEmail: 'alice@example.com',
          departmentId: deptId,
          designationId: desId,
          proposedJoiningDate: '2026-10-01',
          offeredCtc: 750000,
        },
        hrUserId,
      );

      expect(result.id).toBe('cand-1');
      expect(mockPrisma.onboardingTask.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ title: 'Identity & Address Verification', isMandatory: true }),
            expect.objectContaining({ title: 'IT Asset & Hardware Provisioning', isMandatory: false }),
          ]),
        }),
      );
    });

    it('rejects invitation if email already exists as candidate or active employee', async () => {
      mockPrisma.onboardingCandidate.findUnique.mockResolvedValue({
        id: 'existing-cand',
        status: OnboardingStatus.INVITED,
      });

      await expect(
        service.inviteCandidate(
          orgId,
          {
            firstName: 'Duplicate',
            lastName: 'User',
            personalEmail: 'duplicate@example.com',
            departmentId: deptId,
            designationId: desId,
            proposedJoiningDate: '2026-10-01',
          },
          hrUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Pre-Boarding Form Submission
  // ---------------------------------------------------------------------------

  describe('submitPreBoardingForm', () => {
    it('updates candidate details and transitions status to SUBMITTED', async () => {
      const mockCandidate = {
        id: 'cand-1',
        organizationId: orgId,
        status: OnboardingStatus.INVITED,
        tasks: [],
      };

      mockPrisma.onboardingCandidate.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.onboardingCandidate.update.mockResolvedValue({
        ...mockCandidate,
        status: OnboardingStatus.SUBMITTED,
        bankName: 'HDFC Bank',
        panNumber: 'ABCDE1234F',
      });

      const result = await service.submitPreBoardingForm(orgId, 'cand-1', {
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        ifscOrRouting: 'HDFC0001234',
        panNumber: 'ABCDE1234F',
        currentAddress: '123 Tech Park, Mumbai',
      });

      expect(result.status).toBe(OnboardingStatus.SUBMITTED);
      expect(mockPrisma.onboardingCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cand-1' },
          data: expect.objectContaining({
            status: OnboardingStatus.SUBMITTED,
            bankName: 'HDFC Bank',
            panNumber: 'ABCDE1234F',
          }),
        }),
      );
    });

    it('throws BadRequestException if candidate is already converted', async () => {
      mockPrisma.onboardingCandidate.findFirst.mockResolvedValue({
        id: 'cand-1',
        organizationId: orgId,
        status: OnboardingStatus.CONVERTED,
        tasks: [],
      });

      await expect(
        service.submitPreBoardingForm(orgId, 'cand-1', { bankName: 'Axis Bank' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Task Status Updates
  // ---------------------------------------------------------------------------

  describe('updateTaskStatus', () => {
    it('marks task COMPLETED with timestamp and acting user ID', async () => {
      mockPrisma.onboardingTask.findFirst.mockResolvedValue({
        id: 'task-1',
        organizationId: orgId,
        status: OnboardingTaskStatus.PENDING,
      });

      mockPrisma.onboardingTask.update.mockResolvedValue({
        id: 'task-1',
        status: OnboardingTaskStatus.COMPLETED,
        completedByUserId: hrUserId,
      });

      const result = await service.updateTaskStatus(
        orgId,
        'task-1',
        { status: OnboardingTaskStatus.COMPLETED, notes: 'Verified passport copy' },
        hrUserId,
      );

      expect(result.status).toBe(OnboardingTaskStatus.COMPLETED);
      expect(mockPrisma.onboardingTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            status: OnboardingTaskStatus.COMPLETED,
            completedByUserId: hrUserId,
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Atomic Conversion to Official Employee + User Login
  // ---------------------------------------------------------------------------

  describe('convertToEmployee', () => {
    const mockCandidateWithTasks = {
      id: 'cand-1',
      organizationId: orgId,
      firstName: 'Alice',
      lastName: 'Smith',
      personalEmail: 'alice@example.com',
      phone: '9876543210',
      departmentId: deptId,
      designationId: desId,
      gradeId: 'grade-l3',
      locationId: 'loc-mum',
      reportingManagerId: null,
      proposedJoiningDate: new Date('2026-10-01'),
      offeredCtc: 600000,
      bankName: 'HDFC Bank',
      accountNumber: '123456789012',
      ifscOrRouting: 'HDFC0001234',
      panNumber: 'ABCDE1234F',
      status: OnboardingStatus.SUBMITTED,
      tasks: [
        { id: 't1', title: 'Identity & Address Verification', isMandatory: true, status: OnboardingTaskStatus.COMPLETED },
        { id: 't2', title: 'Bank Account & Statutory Details', isMandatory: true, status: OnboardingTaskStatus.COMPLETED },
        { id: 't3', title: 'Signed Offer Letter & NDA', isMandatory: true, status: OnboardingTaskStatus.COMPLETED },
        { id: 't4', title: 'IT Asset & Hardware Provisioning', isMandatory: false, status: OnboardingTaskStatus.PENDING },
      ],
    };

    it('rejects conversion if mandatory tasks are incomplete', async () => {
      const candidateWithIncompleteTasks = {
        ...mockCandidateWithTasks,
        tasks: [
          { id: 't1', title: 'Identity & Address Verification', isMandatory: true, status: OnboardingTaskStatus.PENDING },
        ],
      };

      mockPrisma.onboardingCandidate.findFirst.mockResolvedValue(candidateWithIncompleteTasks);

      await expect(
        service.convertToEmployee(orgId, 'cand-1', {}, mockHrUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('atomically creates Employee, User login, default Shift assignment, and Salary Structure', async () => {
      mockPrisma.onboardingCandidate.findFirst.mockResolvedValue(mockCandidateWithTasks);

      const mockEmployee = {
        id: 'emp-new-1',
        employeeCode: 'ENG-0005',
        firstName: 'Alice',
        lastName: 'Smith',
        personalEmail: 'alice@example.com',
        dateOfJoining: new Date('2026-10-01'),
      };
      mockPrisma.employee.create.mockResolvedValue(mockEmployee);

      const mockUser = {
        id: 'user-new-1',
        email: 'alice@example.com',
        role: Role.EMPLOYEE,
        employeeId: 'emp-new-1',
      };
      mockPrisma.user.create.mockResolvedValue(mockUser);

      mockPrisma.shift.findFirst.mockResolvedValue({
        id: 'shift-default-1',
        name: 'General Day Shift',
        isDefault: true,
      });

      mockPrisma.payrollConfiguration.findUnique.mockResolvedValue({
        basicPercentage: 50,
        hraPercentage: 25,
        specialAllowancePercentage: 25,
      });

      mockPrisma.onboardingCandidate.update.mockResolvedValue({
        ...mockCandidateWithTasks,
        status: OnboardingStatus.CONVERTED,
        convertedEmployeeId: 'emp-new-1',
      });

      const result = await service.convertToEmployee(
        orgId,
        'cand-1',
        { initialPassword: 'CustomPassword@123' },
        mockHrUser,
      );

      expect(result.success).toBe(true);
      expect(result.employee.employeeCode).toBe('ENG-0005');
      expect(result.user.role).toBe(Role.EMPLOYEE);
      expect(result.credentials.temporaryPassword).toBe('CustomPassword@123');

      // Verify Employee creation
      expect(mockPrisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeCode: 'ENG-0005',
            firstName: 'Alice',
            lastName: 'Smith',
            personalEmail: 'alice@example.com',
          }),
        }),
      );

      // Verify User login creation
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'alice@example.com',
            role: Role.EMPLOYEE,
            employeeId: 'emp-new-1',
          }),
        }),
      );

      // Verify default shift assignment
      expect(mockPrisma.employeeShiftAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp-new-1',
            shiftId: 'shift-default-1',
          }),
        }),
      );

      // Verify 50/25/25 salary structure creation (CTC 6,00,000 => 50k/mo => 25k Basic, 12.5k HRA, 12.5k Special)
      expect(mockPrisma.salaryStructure.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp-new-1',
            monthlyGross: expect.any(Object),
            basicSalary: expect.any(Object),
          }),
        }),
      );

      // Verify candidate status transitioned to CONVERTED
      expect(mockPrisma.onboardingCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cand-1' },
          data: expect.objectContaining({
            status: OnboardingStatus.CONVERTED,
            convertedEmployeeId: 'emp-new-1',
          }),
        }),
      );
    });
  });
});
