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
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ShiftService } from './shift.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { BulkAssignShiftDto } from './dto/bulk-assign-shift.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  /**
   * POST /api/v1/shifts
   * Create a new shift template (HR_ADMIN, CLIENT_SUPER_ADMIN only)
   */
  @Post()
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async createShift(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShiftDto,
  ) {
    return this.shiftService.createShift(user.organizationId, dto);
  }

  /**
   * GET /api/v1/shifts
   * List shift templates (Accessible to all authenticated users)
   */
  @Get()
  async listShifts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.shiftService.listShifts(
      user.organizationId,
      includeInactive === 'true',
    );
  }

  /**
   * POST /api/v1/shifts/assignments
   * Assign shift to an employee (HR_ADMIN, CLIENT_SUPER_ADMIN)
   * Note: Defined before /:id parameter to avoid route interception
   */
  @Post('assignments')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async assignShift(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignShiftDto,
  ) {
    return this.shiftService.assignShift(user.organizationId, dto, user.id);
  }

  /**
   * POST /api/v1/shifts/assignments/bulk
   * Bulk assign shift by department or employee list (HR_ADMIN, CLIENT_SUPER_ADMIN)
   */
  @Post('assignments/bulk')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async bulkAssignShift(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkAssignShiftDto,
  ) {
    return this.shiftService.bulkAssignShift(user.organizationId, dto, user.id);
  }

  /**
   * GET /api/v1/shifts/assignments/employee/:employeeId
   * Retrieve shift assignment history for an employee
   */
  @Get('assignments/employee/:employeeId')
  async getEmployeeShiftAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId') employeeId: string,
  ) {
    // Role-based visibility check: Employees can only view their own shift history
    if (
      user.role === Role.EMPLOYEE &&
      user.employeeId !== employeeId
    ) {
      throw new ForbiddenException(
        'Employees can only view their own shift assignment history',
      );
    }

    return this.shiftService.getEmployeeShiftAssignments(
      user.organizationId,
      employeeId,
    );
  }

  /**
   * GET /api/v1/shifts/assignments/employee/:employeeId/current
   * Retrieve active shift for an employee on today or specified date
   */
  @Get('assignments/employee/:employeeId/current')
  async getEmployeeCurrentShift(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId') employeeId: string,
    @Query('date') dateString?: string,
  ) {
    if (
      user.role === Role.EMPLOYEE &&
      user.employeeId !== employeeId
    ) {
      throw new ForbiddenException(
        'Employees can only view their own current shift assignment',
      );
    }

    const date = dateString ? new Date(dateString) : new Date();
    return this.shiftService.getEmployeeShiftForDate(
      user.organizationId,
      employeeId,
      date,
    );
  }

  /**
   * GET /api/v1/shifts/:id
   * Get single shift template details
   */
  @Get(':id')
  async getShiftById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.shiftService.getShiftById(user.organizationId, id);
  }

  /**
   * PATCH /api/v1/shifts/:id
   * Update shift template (HR_ADMIN, CLIENT_SUPER_ADMIN only)
   */
  @Patch(':id')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async updateShift(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shiftService.updateShift(user.organizationId, id, dto);
  }

  /**
   * DELETE /api/v1/shifts/:id
   * Soft-deactivate shift template (HR_ADMIN, CLIENT_SUPER_ADMIN only)
   */
  @Delete(':id')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async deactivateShift(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.shiftService.deactivateShift(user.organizationId, id);
  }
}
