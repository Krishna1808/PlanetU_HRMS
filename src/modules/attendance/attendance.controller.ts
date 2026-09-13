import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { RegularizeAttendanceDto } from './dto/regularize-attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * POST /api/v1/attendance/check-in
   * Employee web clock-in
   */
  @Post('check-in')
  async checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckInDto,
  ) {
    if (!user.employeeId) {
      throw new BadRequestException('User account is not linked to an employee record');
    }
    return this.attendanceService.checkIn(user.organizationId, user.employeeId, dto);
  }

  /**
   * POST /api/v1/attendance/check-out
   * Employee web clock-out
   */
  @Post('check-out')
  async checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckOutDto,
  ) {
    if (!user.employeeId) {
      throw new BadRequestException('User account is not linked to an employee record');
    }
    return this.attendanceService.checkOut(user.organizationId, user.employeeId, dto);
  }

  /**
   * GET /api/v1/attendance/today
   * View logged-in employee's punch status for today
   */
  @Get('today')
  async getTodayAttendance(@CurrentUser() user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('User account is not linked to an employee record');
    }
    return this.attendanceService.getTodayAttendance(user.organizationId, user.employeeId);
  }

  /**
   * GET /api/v1/attendance/my-records
   * View logged-in employee's personal attendance history
   */
  @Get('my-records')
  async getMyRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user.employeeId) {
      throw new BadRequestException('User account is not linked to an employee record');
    }
    return this.attendanceService.getEmployeeAttendanceHistory(
      user.organizationId,
      user.employeeId,
      startDate,
      endDate,
    );
  }

  /**
   * GET /api/v1/attendance/records
   * Query company-wide attendance records (HR/Admin and Managers for their direct reports)
   */
  @Get('records')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER)
  async queryRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAttendanceDto,
  ) {
    return this.attendanceService.queryAttendanceRecords(
      user.organizationId,
      query,
      user,
    );
  }

  /**
   * POST /api/v1/attendance/regularize
   * Manual attendance regularization (HR/Admin and Managers)
   */
  @Post('regularize')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER)
  async regularizeAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegularizeAttendanceDto,
  ) {
    return this.attendanceService.regularizeAttendance(
      user.organizationId,
      dto,
      user,
    );
  }

  /**
   * GET /api/v1/attendance/payable-days/:employeeId
   * Authoritative payable days calculation for a given month/year
   * Consumed by Finance for Payroll processing
   */
  @Get('payable-days/:employeeId')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.FINANCE)
  async getPayableDays(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId') employeeId: string,
    @Query('year') yearString: string,
    @Query('month') monthString: string,
  ) {
    const year = parseInt(yearString, 10);
    const month = parseInt(monthString, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException('Valid year and month (1-12) query parameters are required');
    }

    return this.attendanceService.getFinalizedPayableDays(
      user.organizationId,
      employeeId,
      year,
      month,
    );
  }
}
