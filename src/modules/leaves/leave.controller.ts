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
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ActionLeaveDto } from './dto/action-leave.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { AllocateDepartmentLeavesDto } from './dto/allocate-department-leaves.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // ---------------------------------------------------------------------------
  // Leave Types Configuration
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/leaves/types
   * Create a new leave type policy (HR_ADMIN, CLIENT_SUPER_ADMIN)
   */
  @Post('types')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async createLeaveType(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaveTypeDto,
  ) {
    return this.leaveService.createLeaveType(user.organizationId, dto);
  }

  /**
   * GET /api/v1/leaves/types
   * List all leave types for the organization (All authenticated users)
   */
  @Get('types')
  async listLeaveTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.leaveService.listLeaveTypes(
      user.organizationId,
      includeInactive === 'true',
    );
  }

  /**
   * GET /api/v1/leaves/types/:id
   * Get single leave type configuration
   */
  @Get('types/:id')
  async getLeaveTypeById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leaveService.getLeaveTypeById(user.organizationId, id);
  }

  /**
   * PATCH /api/v1/leaves/types/:id
   * Update leave type configuration (HR_ADMIN, CLIENT_SUPER_ADMIN)
   */
  @Patch('types/:id')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async updateLeaveType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leaveService.updateLeaveType(user.organizationId, id, dto);
  }

  /**
   * DELETE /api/v1/leaves/types/:id
   * Soft-deactivate leave type (HR_ADMIN, CLIENT_SUPER_ADMIN)
   */
  @Delete('types/:id')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async deactivateLeaveType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leaveService.deactivateLeaveType(user.organizationId, id);
  }

  // ---------------------------------------------------------------------------
  // Leave Applications & Self-Service
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/leaves/apply
   * Submit a new leave application (All authenticated roles)
   */
  @Post('apply')
  async applyLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyLeaveDto,
  ) {
    return this.leaveService.applyLeave(user.organizationId, dto, user);
  }

  /**
   * GET /api/v1/leaves/my-requests
   * View logged-in employee's own leave requests
   */
  @Get('my-requests')
  async getMyRequests(@CurrentUser() user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }
    return this.leaveService.listEmployeeRequests(user.organizationId, user.employeeId);
  }

  /**
   * GET /api/v1/leaves/my-balances
   * View logged-in employee's live leave balances
   */
  @Get('my-balances')
  async getMyBalances(@CurrentUser() user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('User account is not linked to an employee profile');
    }
    return this.leaveService.getEmployeeLeaveBalances(user.organizationId, user.employeeId);
  }

  // ---------------------------------------------------------------------------
  // Approval Workflow & Actions
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/leaves/pending
   * List pending leave requests awaiting approval (Managers see direct reports; HR sees all)
   */
  @Get('pending')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER)
  async listPendingRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.listPendingRequests(user.organizationId, user);
  }

  /**
   * PATCH /api/v1/leaves/:id/action
   * Approve or reject a pending leave application
   */
  @Patch(':id/action')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER)
  async actionLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ActionLeaveDto,
  ) {
    return this.leaveService.actionLeave(user.organizationId, id, dto, user);
  }

  /**
   * POST /api/v1/leaves/:id/cancel
   * Cancel an existing leave application
   */
  @Post(':id/cancel')
  async cancelLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leaveService.cancelLeave(user.organizationId, id, user);
  }

  // ---------------------------------------------------------------------------
  // Ledger & Adjustments
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/leaves/adjust-balance
   * Manual credit or debit adjustment to an employee's leave ledger (HR/Admin)
   */
  @Post('adjust-balance')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async adjustBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustBalanceDto,
  ) {
    return this.leaveService.adjustBalance(user.organizationId, dto, user.id);
  }

  /**
   * POST /api/v1/leaves/allocate-department
   * Bulk credit or adjust leave balances for an entire department (HR/Admin)
   */
  @Post('allocate-department')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async allocateDepartmentLeaves(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AllocateDepartmentLeavesDto,
  ) {
    return this.leaveService.allocateDepartmentLeaves(user.organizationId, dto, user.id);
  }

  /**
   * GET /api/v1/leaves/employee/:employeeId/balances
   * Retrieve leave balances for a specific employee
   */
  @Get('employee/:employeeId/balances')
  async getEmployeeBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId') employeeId: string,
  ) {
    if (user.role === Role.EMPLOYEE && user.employeeId !== employeeId) {
      throw new ForbiddenException('Employees can only view their own leave balances');
    }
    return this.leaveService.getEmployeeLeaveBalances(user.organizationId, employeeId);
  }

  /**
   * GET /api/v1/leaves/employee/:employeeId/ledger
   * Full audit ledger of leave transactions for an employee
   */
  @Get('employee/:employeeId/ledger')
  async getEmployeeLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId') employeeId: string,
  ) {
    if (user.role === Role.EMPLOYEE && user.employeeId !== employeeId) {
      throw new ForbiddenException('Employees can only view their own leave ledger');
    }
    return this.leaveService.getEmployeeLedger(user.organizationId, employeeId);
  }

  /**
   * GET /api/v1/leaves/employee/:employeeId/lwp
   * Query total LWP (Leave Without Pay) days in a date period (for Payroll verification)
   */
  @Get('employee/:employeeId/lwp')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.FINANCE)
  async getEmployeeLwp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId') employeeId: string,
    @Query('startDate') startDateString: string,
    @Query('endDate') endDateString: string,
  ) {
    if (!startDateString || !endDateString) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }

    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    const lwpDays = await this.leaveService.getEmployeeLwpDaysForPeriod(
      user.organizationId,
      employeeId,
      startDate,
      endDate,
    );

    return {
      employeeId,
      startDate,
      endDate,
      lwpDays,
    };
  }
}
