import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDepartmentDto,
  CreateDesignationDto,
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
      orderBy: { name: 'asc' },
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

    return this.prisma.department.create({
      data: {
        organizationId,
        name: dto.name,
        codePrefix: dto.codePrefix.toUpperCase(),
        description: dto.description,
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
