import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDepartmentDto,
  CreateDesignationDto,
  UpdateDesignationDto,
  CreateGradeDto,
  CreateLocationDto,
} from './dto/masters.dto';

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Departments
  // -------------------------------------------------------------------------
  async getDepartments(organizationId: string) {
    return this.prisma.department.findMany({
      where: { organizationId },
      include: {
        head: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            personalEmail: true,
            designation: { select: { id: true, name: true } },
            user: { select: { role: true, email: true } },
          },
        },
        _count: {
          select: {
            employees: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDepartmentById(organizationId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId },
      include: {
        head: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            personalEmail: true,
            designation: { select: { id: true, name: true } },
            user: { select: { role: true, email: true } },
          },
        },
        employees: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            personalEmail: true,
            dateOfJoining: true,
            employmentStatus: true,
            employmentType: true,
            designation: { select: { id: true, name: true } },
            reportingManager: {
              select: { id: true, employeeCode: true, firstName: true, lastName: true },
            },
            user: { select: { role: true, email: true } },
          },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        },
        _count: {
          select: {
            employees: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async setDepartmentHead(
    organizationId: string,
    departmentId: string,
    headEmployeeId: string | null,
  ) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (headEmployeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: headEmployeeId, organizationId, deletedAt: null },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found or inactive');
      }
    }

    return this.prisma.department.update({
      where: { id: departmentId },
      data: { headId: headEmployeeId || null },
      include: {
        head: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            personalEmail: true,
            designation: { select: { id: true, name: true } },
            user: { select: { role: true, email: true } },
          },
        },
        _count: {
          select: {
            employees: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  async createDepartment(organizationId: string, dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({
      where: {
        organizationId,
        OR: [{ name: dto.name }, { codePrefix: dto.codePrefix.toUpperCase() }],
      },
    });

    if (existing) {
      if (existing.name.toLowerCase() === dto.name.toLowerCase()) {
        throw new ConflictException(`Department with name "${dto.name}" already exists`);
      }
      throw new ConflictException(`Department with code prefix "${dto.codePrefix}" already exists`);
    }

    const cleanHeadId = dto.headId?.trim() ? dto.headId.trim() : null;

    if (cleanHeadId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: cleanHeadId, organizationId, deletedAt: null },
      });
      if (!employee) {
        throw new NotFoundException('Head employee not found or inactive');
      }
    }

    return this.prisma.department.create({
      data: {
        organizationId,
        name: dto.name,
        codePrefix: dto.codePrefix.toUpperCase(),
        description: dto.description,
        headId: cleanHeadId || undefined,
      },
      include: {
        head: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            personalEmail: true,
            designation: { select: { id: true, name: true } },
            user: { select: { role: true, email: true } },
          },
        },
        _count: {
          select: {
            employees: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Designations
  // -------------------------------------------------------------------------
  async getDesignations(organizationId: string) {
    return this.prisma.designation.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async createDesignation(organizationId: string, dto: CreateDesignationDto) {
    const existing = await this.prisma.designation.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Designation "${dto.name}" already exists`);
    }

    return this.prisma.designation.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async updateDesignation(
    organizationId: string,
    id: string,
    dto: UpdateDesignationDto,
  ) {
    const existing = await this.prisma.designation.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException('Designation not found');
    }

    if (
      dto.name &&
      dto.name.trim() &&
      dto.name.trim().toLowerCase() !== existing.name.toLowerCase()
    ) {
      const conflict = await this.prisma.designation.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: dto.name.trim(),
          },
        },
      });
      if (conflict) {
        throw new ConflictException(`Designation "${dto.name}" already exists`);
      }
    }

    return this.prisma.designation.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Grades
  // -------------------------------------------------------------------------
  async getGrades(organizationId: string) {
    return this.prisma.grade.findMany({
      where: { organizationId },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  async createGrade(organizationId: string, dto: CreateGradeDto) {
    const existing = await this.prisma.grade.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Grade "${dto.name}" already exists`);
    }

    return this.prisma.grade.create({
      data: {
        organizationId,
        name: dto.name,
        level: dto.level,
        description: dto.description,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Locations
  // -------------------------------------------------------------------------
  async getLocations(organizationId: string) {
    return this.prisma.location.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async createLocation(organizationId: string, dto: CreateLocationDto) {
    const existing = await this.prisma.location.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Location "${dto.name}" already exists`);
    }

    return this.prisma.location.create({
      data: {
        organizationId,
        name: dto.name,
        address: dto.address,
        city: dto.city,
        country: dto.country || 'India',
      },
    });
  }
}
