import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  DayOfWeek,
  EmploymentStatus,
  EmploymentType,
  OnboardingStatus,
  OnboardingTaskStatus,
  Prisma,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeSequenceService } from '../employees/services/employee-sequence.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { SubmitPreBoardingDto } from './dto/submit-preboarding.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryCandidateDto } from './dto/query-candidate.dto';
import { ConvertCandidateDto } from './dto/convert-candidate.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: EmployeeSequenceService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Candidate Invitation & Onboarding Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Invites a new candidate for onboarding.
   * Validates target employment masters, prevents email collisions, and generates default checklist tasks.
   */
  async inviteCandidate(
    organizationId: string,
    dto: CreateCandidateDto,
    actingUserId?: string,
  ) {
    const normalizedEmail = dto.personalEmail.trim().toLowerCase();

    // 1. Check for duplicate candidate or employee email in this tenant
    const [existingCandidate, existingEmployee, existingUser] = await Promise.all([
      this.prisma.onboardingCandidate.findUnique({
        where: {
          organizationId_personalEmail: {
            organizationId,
            personalEmail: normalizedEmail,
          },
        },
      }),
      this.prisma.employee.findFirst({
        where: {
          organizationId,
          personalEmail: { equals: normalizedEmail, mode: 'insensitive' },
          deletedAt: null,
        },
      }),
      this.prisma.user.findFirst({
        where: {
          organizationId,
          email: normalizedEmail,
        },
      }),
    ]);

    if (existingCandidate) {
      throw new ConflictException(
        `Onboarding candidate with email '${dto.personalEmail}' already exists (Status: ${existingCandidate.status})`,
      );
    }

    if (existingEmployee) {
      throw new ConflictException(
        `Active employee with email '${dto.personalEmail}' already exists in this organization`,
      );
    }

    if (existingUser) {
      throw new ConflictException(
        `User account with email '${dto.personalEmail}' already exists in this organization`,
      );
    }

    // 2. Validate department exists in this organization
    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, organizationId },
    });
    if (!department) {
      throw new BadRequestException('Target department does not exist in this organization');
    }

    // 3. Validate designation exists in this organization
    const designation = await this.prisma.designation.findFirst({
      where: { id: dto.designationId, organizationId },
    });
    if (!designation) {
      throw new BadRequestException('Target designation does not exist in this organization');
    }

    // 4. Validate grade if specified
    if (dto.gradeId) {
      const grade = await this.prisma.grade.findFirst({
        where: { id: dto.gradeId, organizationId },
      });
      if (!grade) throw new BadRequestException('Target grade does not exist in this organization');
    }

    // 5. Validate location if specified
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId },
      });
      if (!location) throw new BadRequestException('Target location does not exist in this organization');
    }

    // 6. Validate reporting manager if specified
    if (dto.reportingManagerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: dto.reportingManagerId, organizationId, deletedAt: null },
      });
      if (!manager) throw new BadRequestException('Target reporting manager does not exist or is inactive');
    }

    // 7. Atomic transaction: create candidate record + standard verification checklist
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.onboardingCandidate.create({
        data: {
          organizationId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          personalEmail: normalizedEmail,
          phone: dto.phone?.trim(),
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          gradeId: dto.gradeId,
          locationId: dto.locationId,
          reportingManagerId: dto.reportingManagerId,
          proposedJoiningDate: new Date(dto.proposedJoiningDate),
          offeredCtc: dto.offeredCtc !== undefined ? new Prisma.Decimal(dto.offeredCtc) : null,
          status: OnboardingStatus.INVITED,
          notes: dto.notes?.trim(),
          invitedByUserId: actingUserId,
        },
        include: {
          department: { select: { id: true, name: true, codePrefix: true } },
          designation: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true, level: true } },
          location: { select: { id: true, name: true, city: true } },
          reportingManager: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true },
          },
        },
      });

      // Default onboarding verification checklist tasks
      const defaultTasks = [
        {
          title: 'Identity & Address Verification',
          description: 'Verify government identity card (Passport / Aadhaar / DL) and permanent address proof.',
          isMandatory: true,
        },
        {
          title: 'Bank Account & Statutory Details',
          description: 'Verify cancelled cheque, IFSC, account number, and PAN card.',
          isMandatory: true,
        },
        {
          title: 'Signed Offer Letter & NDA',
          description: 'Upload executed copy of formal employment offer and confidentiality agreements.',
          isMandatory: true,
        },
        {
          title: 'IT Asset & Hardware Provisioning',
          description: 'Allocate laptop, security key, corporate email, and messaging credentials.',
          isMandatory: false,
        },
      ];

      await tx.onboardingTask.createMany({
        data: defaultTasks.map((t) => ({
          organizationId,
          candidateId: candidate.id,
          title: t.title,
          description: t.description,
          isMandatory: t.isMandatory,
          status: OnboardingTaskStatus.PENDING,
        })),
      });

      const tasks = await tx.onboardingTask.findMany({
        where: { candidateId: candidate.id, organizationId },
        orderBy: { createdAt: 'asc' },
      });

      return {
        ...candidate,
        tasks,
      };
    });
  }

  /**
   * List onboarding candidates with optional status filter and search.
   */
  async listCandidates(organizationId: string, query: QueryCandidateDto) {
    const where: Prisma.OnboardingCandidateWhereInput = {
      organizationId,
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { personalEmail: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.onboardingCandidate.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, codePrefix: true } },
        designation: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true, level: true } },
        location: { select: { id: true, name: true, city: true } },
        reportingManager: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        },
        tasks: true,
        convertedEmployee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single onboarding candidate with checklist tasks.
   */
  async getCandidateById(organizationId: string, id: string) {
    const candidate = await this.prisma.onboardingCandidate.findFirst({
      where: { id, organizationId },
      include: {
        department: { select: { id: true, name: true, codePrefix: true } },
        designation: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true, level: true } },
        location: { select: { id: true, name: true, city: true } },
        reportingManager: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        },
        tasks: { orderBy: { createdAt: 'asc' } },
        convertedEmployee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Onboarding candidate with ID '${id}' not found`);
    }

    return candidate;
  }

  // ---------------------------------------------------------------------------
  // 2. Pre-Boarding Form Submission
  // ---------------------------------------------------------------------------

  /**
   * Candidate or HR submits/updates pre-boarding details (address, bank, PAN/UAN).
   * Transitions status from INVITED to SUBMITTED.
   */
  async submitPreBoardingForm(
    organizationId: string,
    candidateId: string,
    dto: SubmitPreBoardingDto,
  ) {
    const candidate = await this.getCandidateById(organizationId, candidateId);

    if (candidate.status === OnboardingStatus.CONVERTED) {
      throw new BadRequestException('Cannot edit pre-boarding form for a candidate who is already converted');
    }

    const nextStatus =
      candidate.status === OnboardingStatus.INVITED
        ? OnboardingStatus.SUBMITTED
        : candidate.status;

    return this.prisma.onboardingCandidate.update({
      where: { id: candidateId },
      data: {
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.currentAddress !== undefined && { currentAddress: dto.currentAddress?.trim() }),
        ...(dto.permanentAddress !== undefined && { permanentAddress: dto.permanentAddress?.trim() }),
        ...(dto.emergencyContactName !== undefined && { emergencyContactName: dto.emergencyContactName?.trim() }),
        ...(dto.emergencyContactPhone !== undefined && { emergencyContactPhone: dto.emergencyContactPhone?.trim() }),
        ...(dto.emergencyContactRelation !== undefined && { emergencyContactRelation: dto.emergencyContactRelation?.trim() }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName?.trim() }),
        ...(dto.accountNumber !== undefined && { accountNumber: dto.accountNumber?.trim() }),
        ...(dto.ifscOrRouting !== undefined && { ifscOrRouting: dto.ifscOrRouting?.trim() }),
        ...(dto.panNumber !== undefined && { panNumber: dto.panNumber?.trim().toUpperCase() }),
        ...(dto.uanNumber !== undefined && { uanNumber: dto.uanNumber?.trim() }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() }),
        status: nextStatus,
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        tasks: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Onboarding Tasks & Checklists
  // ---------------------------------------------------------------------------

  /**
   * Updates status of an onboarding task (e.g. COMPLETED or SKIPPED).
   */
  async updateTaskStatus(
    organizationId: string,
    taskId: string,
    dto: UpdateTaskDto,
    actingUserId?: string,
  ) {
    const task = await this.prisma.onboardingTask.findFirst({
      where: { id: taskId, organizationId },
    });

    if (!task) {
      throw new NotFoundException(`Onboarding task with ID '${taskId}' not found`);
    }

    const isCompleted = dto.status === OnboardingTaskStatus.COMPLETED;

    return this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        status: dto.status,
        notes: dto.notes?.trim() ?? task.notes,
        completedByUserId: isCompleted ? actingUserId : null,
        completedAt: isCompleted ? new Date() : null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Atomic Conversion to Official Employee + User Login
  // ---------------------------------------------------------------------------

  /**
   * Converts an onboarding candidate into an official Employee record and provisions a User login.
   * Runs in a single atomic Prisma transaction:
   * 1. Auto-generates sequential employee code (e.g. ENG-0001).
   * 2. Creates core Employee record with candidate pre-boarding details.
   * 3. Creates initial employeeJobHistory ledger entry (FR-EMP-005).
   * 4. Provisions User login account (Role.EMPLOYEE, employeeId linked).
   * 5. Assigns default Shift Roster (Module 3).
   * 6. Sets initial active Salary Structure (Module 6) if offeredCtc exists.
   * 7. Marks candidate as CONVERTED.
   */
  async convertToEmployee(
    organizationId: string,
    candidateId: string,
    dto: ConvertCandidateDto,
    actingUser: AuthenticatedUser,
  ) {
    const candidate = await this.getCandidateById(organizationId, candidateId);

    if (candidate.status === OnboardingStatus.CONVERTED) {
      throw new BadRequestException('This candidate has already been converted to an employee');
    }

    // Check mandatory tasks completion
    const pendingMandatory = candidate.tasks.filter(
      (t) => t.isMandatory && t.status !== OnboardingTaskStatus.COMPLETED,
    );
    if (pendingMandatory.length > 0) {
      const titles = pendingMandatory.map((t) => `'${t.title}'`).join(', ');
      throw new BadRequestException(
        `Cannot complete onboarding. Mandatory tasks not completed: ${titles}`,
      );
    }

    const defaultPassword = dto.initialPassword?.trim() || 'Password@123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    return this.prisma.$transaction(async (tx) => {
      // 1. Generate unique sequential employee code
      const employeeCode = await this.sequenceService.generateEmployeeCode(
        organizationId,
        candidate.departmentId,
        tx,
      );

      // 2. Create official Employee record
      const employee = await tx.employee.create({
        data: {
          organizationId,
          employeeCode,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          personalEmail: candidate.personalEmail,
          phone: candidate.phone,
          dateOfBirth: candidate.dateOfBirth,
          gender: candidate.gender,
          currentAddress: candidate.currentAddress,
          permanentAddress: candidate.permanentAddress,
          emergencyContactName: candidate.emergencyContactName,
          emergencyContactPhone: candidate.emergencyContactPhone,
          emergencyContactRelation: candidate.emergencyContactRelation,
          departmentId: candidate.departmentId,
          designationId: candidate.designationId,
          gradeId: candidate.gradeId,
          locationId: candidate.locationId,
          reportingManagerId: candidate.reportingManagerId,
          employmentType: EmploymentType.FULL_TIME,
          employmentStatus: EmploymentStatus.ACTIVE,
          dateOfJoining: candidate.proposedJoiningDate,
          currency: 'INR',
          baseSalary: candidate.offeredCtc ? new Prisma.Decimal(candidate.offeredCtc) : null,
          bankName: candidate.bankName,
          accountNumber: candidate.accountNumber,
          ifscOrRouting: candidate.ifscOrRouting,
          panNumber: candidate.panNumber,
          uanNumber: candidate.uanNumber,
        },
      });

      // 3. Initial Job History Ledger row
      await tx.employeeJobHistory.create({
        data: {
          organizationId,
          employeeId: employee.id,
          departmentId: employee.departmentId,
          designationId: employee.designationId,
          gradeId: employee.gradeId,
          reportingManagerId: employee.reportingManagerId,
          effectiveFrom: employee.dateOfJoining,
          effectiveTo: null,
          reason: 'Initial Onboarding Hire',
          changedByUserId: actingUser.id,
        },
      });

      // 4. Provision User login account
      const user = await tx.user.create({
        data: {
          organizationId,
          email: candidate.personalEmail.trim().toLowerCase(),
          passwordHash,
          role: Role.EMPLOYEE,
          employeeId: employee.id,
          isActive: true,
        },
      });

      // 5. Assign default Shift Roster (Module 3)
      const defaultShift = await tx.shift.findFirst({
        where: { organizationId, isDefault: true, isActive: true },
      });
      if (defaultShift) {
        await tx.employeeShiftAssignment.create({
          data: {
            organizationId,
            employeeId: employee.id,
            shiftId: defaultShift.id,
            effectiveFrom: employee.dateOfJoining,
            weeklyOffDays: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
            assignedByUserId: actingUser.id,
            notes: 'Auto-assigned during onboarding conversion',
          },
        });
      }

      // 6. Set initial Salary Structure (Module 6) if offeredCtc exists
      if (candidate.offeredCtc) {
        const config = await tx.payrollConfiguration.findUnique({
          where: { organizationId },
        });

        const basicPct = config ? Number(config.basicPercentage) : 50;
        const hraPct = config ? Number(config.hraPercentage) : 25;
        const saPct = config ? Number(config.specialAllowancePercentage) : 25;

        const annualCtc = Number(candidate.offeredCtc);
        const monthlyGross = Number((annualCtc / 12).toFixed(2));
        const basicSalary = Number(((monthlyGross * basicPct) / 100).toFixed(2));
        const hra = Number(((monthlyGross * hraPct) / 100).toFixed(2));
        const specialAllowance = Number(((monthlyGross * saPct) / 100).toFixed(2));

        await tx.salaryStructure.create({
          data: {
            organizationId,
            employeeId: employee.id,
            annualCtc: new Prisma.Decimal(annualCtc),
            monthlyGross: new Prisma.Decimal(monthlyGross),
            basicSalary: new Prisma.Decimal(basicSalary),
            hra: new Prisma.Decimal(hra),
            specialAllowance: new Prisma.Decimal(specialAllowance),
            effectiveFrom: employee.dateOfJoining,
            effectiveTo: null,
            revisionReason: 'Initial Onboarding Salary Package',
            revisedByUserId: actingUser.id,
          },
        });
      }

      // 7. Update Onboarding Candidate status
      const updatedCandidate = await tx.onboardingCandidate.update({
        where: { id: candidateId },
        data: {
          status: OnboardingStatus.CONVERTED,
          convertedEmployeeId: employee.id,
          convertedAt: new Date(),
          notes: dto.notes ? `${candidate.notes ? candidate.notes + '; ' : ''}${dto.notes}` : candidate.notes,
        },
      });

      return {
        success: true,
        candidate: updatedCandidate,
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.personalEmail,
        },
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        credentials: {
          email: user.email,
          temporaryPassword: defaultPassword,
        },
      };
    });
  }
}
