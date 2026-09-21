import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { EmployeeService } from './services/employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { CreateEmployeeDocumentDto } from './dto/create-document.dto';
import { TerminateEmployeeDto } from './dto/terminate-employee.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeeService: EmployeeService) {}

  /**
   * POST /api/v1/employees
   * Create employee (HR_ADMIN and CLIENT_SUPER_ADMIN only)
   */
  @Post()
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async createEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeeService.createEmployee(user.organizationId, dto, user.id);
  }

  /**
   * GET /api/v1/employees
   * Paginated, filtered employee directory (All authenticated roles)
   */
  @Get()
  async listEmployees(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryEmployeeDto,
  ) {
    return this.employeeService.listEmployees(user.organizationId, query, user);
  }

  /**
   * GET /api/v1/employees/org-chart
   * Hierarchy view derived from reportingManagerId
   * (Defined before /:id so it is not intercepted as an ID param)
   */
  @Get('org-chart')
  async getOrgChart(@CurrentUser() user: AuthenticatedUser) {
    return this.employeeService.getOrgChart(user.organizationId);
  }

  /**
   * GET /api/v1/employees/:id
   * Get single profile with role-appropriate field visibility
   */
  @Get(':id')
  async getEmployeeById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.employeeService.getEmployeeById(user.organizationId, id, user);
  }

  /**
   * PATCH /api/v1/employees/:id
   * Update employee record:
   * - Employees self-edit low-risk personal fields only
   * - HR/Admin can edit all fields
   */
  @Patch(':id')
  async updateEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeeService.updateEmployee(user.organizationId, id, dto, user);
  }

  /**
   * POST /api/v1/employees/:id/terminate
   * Issue termination notice with notice period days (HR_ADMIN and CLIENT_SUPER_ADMIN only)
   */
  @Post(':id/terminate')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  @HttpCode(HttpStatus.OK)
  async terminateEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TerminateEmployeeDto,
  ) {
    return this.employeeService.softDeleteEmployee(user.organizationId, id, user, dto);
  }

  /**
   * DELETE /api/v1/employees/:id
   * Soft-delete on exit / termination (HR_ADMIN and CLIENT_SUPER_ADMIN only)
   */
  @Delete(':id')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  @HttpCode(HttpStatus.OK)
  async softDeleteEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: TerminateEmployeeDto,
  ) {
    return this.employeeService.softDeleteEmployee(user.organizationId, id, user, body);
  }

  /**
   * GET /api/v1/employees/:id/history
   * Append-only job history ledger (HR/Admin or own history only for Employee)
   */
  @Get(':id/history')
  async getJobHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.employeeService.getJobHistory(user.organizationId, id, user);
  }

  /**
   * POST /api/v1/employees/:id/documents
   * Upload document metadata
   */
  @Post(':id/documents')
  async addDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateEmployeeDocumentDto,
  ) {
    return this.employeeService.addDocument(user.organizationId, id, dto, user);
  }

  /**
   * GET /api/v1/employees/:id/documents
   * View documents list
   */
  @Get(':id/documents')
  async getDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.employeeService.getDocuments(user.organizationId, id, user);
  }
}
