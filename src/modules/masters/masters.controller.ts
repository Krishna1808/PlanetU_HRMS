import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MastersService } from './masters.service';
import {
  CreateDepartmentDto,
  CreateDesignationDto,
  CreateGradeDto,
  CreateLocationDto,
} from './dto/masters.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/masters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MastersController {
  constructor(private readonly mastersService: MastersService) {}

  // Departments
  @Get('departments')
  async getDepartments(@CurrentUser() user: AuthenticatedUser) {
    return this.mastersService.getDepartments(user.organizationId);
  }

  @Post('departments')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async createDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.mastersService.createDepartment(user.organizationId, dto);
  }

  // Designations
  @Get('designations')
  async getDesignations(@CurrentUser() user: AuthenticatedUser) {
    return this.mastersService.getDesignations(user.organizationId);
  }

  @Post('designations')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async createDesignation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDesignationDto,
  ) {
    return this.mastersService.createDesignation(user.organizationId, dto);
  }

  // Grades
  @Get('grades')
  async getGrades(@CurrentUser() user: AuthenticatedUser) {
    return this.mastersService.getGrades(user.organizationId);
  }

  @Post('grades')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async createGrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGradeDto,
  ) {
    return this.mastersService.createGrade(user.organizationId, dto);
  }

  // Locations
  @Get('locations')
  async getLocations(@CurrentUser() user: AuthenticatedUser) {
    return this.mastersService.getLocations(user.organizationId);
  }

  @Post('locations')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async createLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLocationDto,
  ) {
    return this.mastersService.createLocation(user.organizationId, dto);
  }
}
