import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role, EmploymentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeSequenceService } from './employee-sequence.service';
import { EmployeeRbacService } from './employee-rbac.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { QueryEmployeeDto } from '../dto/query-employee.dto';
import { CreateEmployeeDocumentDto } from '../dto/create-document.dto';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: EmployeeSequenceService,
    private readonly rbacService: EmployeeRbacService,
  ) {}

  /**
   * FR-EMP-001 & FR-EMP-002: Create Employee with atomic code generation & initial ledger record
   */
  async createEmployee(
    organizationId: string,
    dto: CreateEmployeeDto,
    creatorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate department
      const department = await tx.department.findFirst({
        where: { id: dto.departmentId, organizationId },
      });
      if (!department) {
        throw new BadRequestException('Department does not exist in this organization');
      }

      // 2. Validate designation
      const designation = await tx.designation.findFirst({
        where: { id: dto.designationId, organizationId },
      });
      if (!designation) {
        throw new BadRequestException('Designation does not exist in this organization');
      }

      // 3. Validate optional lookups (grade, location, reporting manager)
      if (dto.gradeId) {
        const grade = await tx.grade.findFirst({
          where: { id: dto.gradeId, organizationId },
        });
        if (!grade) throw new BadRequestException('Grade does not exist in this organization');
      }

      if (dto.locationId) {
        const location = await tx.location.findFirst({
          where: { id: dto.locationId, organizationId },
        });
        if (!location) throw new BadRequestException('Location does not exist in this organization');
      }

      if (dto.reportingManagerId) {
        const manager = await tx.employee.findFirst({
          where: { id: dto.reportingManagerId, organizationId, deletedAt: null },
        });
        if (!manager) {
          throw new BadRequestException('Reporting manager not found or is deactivated');
        }
      }

      // 4. Atomically generate unique sequential employee code
      const employeeCode = await this.sequenceService.generateEmployeeCode(
        organizationId,
        dto.departmentId,
        tx,
      );

      // 5. Create core Employee record
      const employee = await tx.employee.create({
        data: {
          organizationId,
          employeeCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          personalEmail: dto.personalEmail,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          gender: dto.gender,
          currentAddress: dto.currentAddress,
          permanentAddress: dto.permanentAddress,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
          emergencyContactRelation: dto.emergencyContactRelation,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          gradeId: dto.gradeId,
          locationId: dto.locationId,
          reportingManagerId: dto.reportingManagerId,
          employmentType: dto.employmentType,
          employmentStatus: dto.employmentStatus,
          dateOfJoining: new Date(dto.dateOfJoining),
          probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null,
          currency: dto.currency || 'INR',
          baseSalary: dto.baseSalary !== undefined ? new Prisma.Decimal(dto.baseSalary) : null,
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          ifscOrRouting: dto.ifscOrRouting,
          panNumber: dto.panNumber,
          uanNumber: dto.uanNumber,
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

      // 6. FR-EMP-005: Create initial entry in append-only job history ledger
      await tx.employeeJobHistory.create({
        data: {
          organizationId,
          employeeId: employee.id,
          departmentId: employee.departmentId,
          designationId: employee.designationId,
          gradeId: employee.gradeId,
          reportingManagerId: employee.reportingManagerId,
          effectiveFrom: employee.dateOfJoining,
          effectiveTo: null, // active
          reason: 'Initial Employment Hire',
          changedByUserId: creatorUserId || null,
        },
      });

      // 7. If workEmail and initialPassword supplied, create auth login account
      if (dto.workEmail && dto.initialPassword) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(dto.initialPassword, salt);

        await tx.user.create({
          data: {
            organizationId,
            email: dto.workEmail.toLowerCase().trim(),
            passwordHash,
            role: Role.EMPLOYEE,
            employeeId: employee.id,
            isActive: true,
          },
        });
      }

      return employee;
    });
  }

  /**
   * FR-EMP-008: Get employee profile with field-level scoping
   */
  async getEmployeeById(
    organizationId: string,
    employeeId: string,
    viewer: AuthenticatedUser,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId,
        deletedAt: null,
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

    if (!employee) {
      throw new NotFoundException('Employee not found or has been deactivated');
    }

    const isDirectReport =
      viewer.employeeId != null && employee.reportingManagerId === viewer.employeeId;

    return this.rbacService.sanitizeEmployeeProfile(employee, viewer, isDirectReport);
  }

  /**
   * FR-EMP-006 & FR-EMP-005: Update employee with field validation & append-only job history
   */
  async updateEmployee(
    organizationId: string,
    employeeId: string,
    dto: UpdateEmployeeDto,
    viewer: AuthenticatedUser,
  ) {
    // 1. Validate role edit permissions (low-risk vs high-risk)
    this.rbacService.validateUpdatePermissions(viewer, employeeId, dto);

    // 2. Fetch existing employee
    const current = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });

    if (!current) {
      throw new NotFoundException('Employee not found or is deactivated');
    }

    // 3. Detect if position/job fields changed (department, designation, grade, reportingManager)
    const jobChanged =
      (dto.departmentId !== undefined && dto.departmentId !== current.departmentId) ||
      (dto.designationId !== undefined && dto.designationId !== current.designationId) ||
      (dto.gradeId !== undefined && dto.gradeId !== current.gradeId) ||
      (dto.reportingManagerId !== undefined &&
        dto.reportingManagerId !== current.reportingManagerId);

    return this.prisma.$transaction(async (tx) => {
      // If job changed, maintain append-only ledger (FR-EMP-005)
      if (jobChanged) {
        const now = new Date();

        // Close currently active job history record
        await tx.employeeJobHistory.updateMany({
          where: {
            organizationId,
            employeeId,
            effectiveTo: null,
          },
          data: {
            effectiveTo: now,
          },
        });

        // Insert new active job history record
        await tx.employeeJobHistory.create({
          data: {
            organizationId,
            employeeId,
            departmentId: dto.departmentId || current.departmentId,
            designationId: dto.designationId || current.designationId,
            gradeId: dto.gradeId !== undefined ? dto.gradeId : current.gradeId,
            reportingManagerId:
              dto.reportingManagerId !== undefined
                ? dto.reportingManagerId
                : current.reportingManagerId,
            effectiveFrom: now,
            effectiveTo: null,
            reason: dto.changeReason || 'Position or Manager Update',
            changedByUserId: viewer.id,
          },
        });
      }

      // Build update payload
      const updateData: Prisma.EmployeeUpdateInput = {
        firstName: dto.firstName,
        lastName: dto.lastName,
        personalEmail: dto.personalEmail,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        currentAddress: dto.currentAddress,
        permanentAddress: dto.permanentAddress,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        emergencyContactRelation: dto.emergencyContactRelation,
        employmentType: dto.employmentType,
        employmentStatus: dto.employmentStatus,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
        dateOfExit: dto.dateOfExit ? new Date(dto.dateOfExit) : undefined,
        probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : undefined,
        currency: dto.currency,
        baseSalary: dto.baseSalary !== undefined ? new Prisma.Decimal(dto.baseSalary) : undefined,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        ifscOrRouting: dto.ifscOrRouting,
        panNumber: dto.panNumber,
        uanNumber: dto.uanNumber,
      };

      if (dto.departmentId) updateData.department = { connect: { id: dto.departmentId } };
      if (dto.designationId) updateData.designation = { connect: { id: dto.designationId } };
      if (dto.gradeId) updateData.grade = { connect: { id: dto.gradeId } };
      if (dto.locationId) updateData.location = { connect: { id: dto.locationId } };
      if (dto.reportingManagerId !== undefined) {
        updateData.reportingManager = dto.reportingManagerId
          ? { connect: { id: dto.reportingManagerId } }
          : { disconnect: true };
      }

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
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

      const isDirectReport =
        viewer.employeeId != null && updated.reportingManagerId === viewer.employeeId;

      return this.rbacService.sanitizeEmployeeProfile(updated, viewer, isDirectReport);
    });
  }

  /**
   * FR-EMP-007: Soft-delete employee on termination/exit — never hard-delete
   */
  async softDeleteEmployee(
    organizationId: string,
    employeeId: string,
    viewer: AuthenticatedUser,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or already deactivated');
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Soft delete employee
      const deactivated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          deletedAt: now,
          dateOfExit: now,
          employmentStatus: EmploymentStatus.TERMINATED,
        },
      });

      // Deactivate linked user login account
      await tx.user.updateMany({
        where: { organizationId, employeeId },
        data: { isActive: false },
      });

      // Close active job history ledger row
      await tx.employeeJobHistory.updateMany({
        where: { organizationId, employeeId, effectiveTo: null },
        data: {
          effectiveTo: now,
          reason: 'Employee Deactivated / Terminated',
          changedByUserId: viewer.id,
        },
      });

      return {
        message: `Employee ${deactivated.employeeCode} successfully deactivated`,
        employeeId: deactivated.id,
        deactivatedAt: now,
      };
    });
  }

  /**
   * FR-EMP-010: Paginated, filterable employee directory
   */
  async listEmployees(
    organizationId: string,
    query: QueryEmployeeDto,
    viewer: AuthenticatedUser,
  ) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null, // Active employees only
    };

    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.designationId) where.designationId = query.designationId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.status) where.employmentStatus = query.status;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { personalEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        include: {
          department: { select: { id: true, name: true, codePrefix: true } },
          designation: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true, level: true } },
          location: { select: { id: true, name: true, city: true } },
          reportingManager: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    // Sanitize each item based on viewer role
    const sanitizedItems = items.map((emp) => {
      const isDirectReport =
        viewer.employeeId != null && emp.reportingManagerId === viewer.employeeId;
      return this.rbacService.sanitizeEmployeeProfile(emp, viewer, isDirectReport);
    });

    return {
      data: sanitizedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * FR-EMP-005: Job history ledger retrieval (HR/Admin or own history only)
   */
  async getJobHistory(
    organizationId: string,
    employeeId: string,
    viewer: AuthenticatedUser,
  ) {
    const isHrOrAdmin =
      viewer.role === Role.CLIENT_SUPER_ADMIN || viewer.role === Role.HR_ADMIN;
    const isSelf = viewer.employeeId && viewer.employeeId === employeeId;

    if (!isHrOrAdmin && !isSelf) {
      throw new ForbiddenException('Access denied: You can only view your own job history');
    }

    return this.prisma.employeeJobHistory.findMany({
      where: {
        organizationId,
        employeeId,
      },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        department: { select: { id: true, name: true, codePrefix: true } },
        designation: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true, level: true } },
        reportingManager: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * FR-EMP-009: Upload document metadata
   */
  async addDocument(
    organizationId: string,
    employeeId: string,
    dto: CreateEmployeeDocumentDto,
    viewer: AuthenticatedUser,
  ) {
    const isHrOrAdmin =
      viewer.role === Role.CLIENT_SUPER_ADMIN || viewer.role === Role.HR_ADMIN;
    const isSelf = viewer.employeeId && viewer.employeeId === employeeId;

    if (!isHrOrAdmin && !isSelf) {
      throw new ForbiddenException('Access denied: You can only upload documents for yourself or team');
    }

    // Verify employee exists
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.employeeDocument.create({
      data: {
        organizationId,
        employeeId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        uploadedByUserId: viewer.id,
      },
    });
  }

  /**
   * FR-EMP-009: List employee documents
   */
  async getDocuments(
    organizationId: string,
    employeeId: string,
    viewer: AuthenticatedUser,
  ) {
    const isHrOrAdmin =
      viewer.role === Role.CLIENT_SUPER_ADMIN || viewer.role === Role.HR_ADMIN;
    const isSelf = viewer.employeeId && viewer.employeeId === employeeId;

    if (!isHrOrAdmin && !isSelf) {
      throw new ForbiddenException('Access denied: You can only view your own documents');
    }

    return this.prisma.employeeDocument.findMany({
      where: { organizationId, employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * FR-EMP-004: Org Chart view derived from reportingManagerId
   */
  async getOrgChart(organizationId: string) {
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        reportingManagerId: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
      },
    });

    // Build hierarchy tree
    const map = new Map<string, any>();
    const roots: any[] = [];

    employees.forEach((emp) => {
      map.set(emp.id, { ...emp, directReports: [] });
    });

    employees.forEach((emp) => {
      const node = map.get(emp.id);
      if (emp.reportingManagerId && map.has(emp.reportingManagerId)) {
        map.get(emp.reportingManagerId).directReports.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
