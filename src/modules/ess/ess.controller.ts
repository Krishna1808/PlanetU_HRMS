import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { EssService } from './ess.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/ess')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EssController {
  constructor(private readonly essService: EssService) {}

  /**
   * GET /api/v1/ess/dashboard
   * Single round-trip aggregated dashboard overview for employee home screen
   */
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.essService.getDashboard(user.organizationId, user);
  }

  /**
   * GET /api/v1/ess/profile
   * Full profile view with editability metadata (FR-EMP-006)
   */
  @Get('profile')
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.essService.getMyProfile(user.organizationId, user);
  }

  /**
   * PATCH /api/v1/ess/profile
   * Self-update low-risk contact and emergency details (FR-EMP-006)
   */
  @Patch('profile')
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.essService.updateMyProfile(user.organizationId, dto, user);
  }

  /**
   * GET /api/v1/ess/attendance
   * Personal month-to-date attendance calendar and finalized payable days
   */
  @Get('attendance')
  async getMyAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year ? parseInt(year, 10) : undefined;
    const m = month ? parseInt(month, 10) : undefined;
    return this.essService.getMyAttendance(user.organizationId, user, y, m);
  }

  /**
   * GET /api/v1/ess/leaves
   * Leave balances from ledger and application history
   */
  @Get('leaves')
  async getMyLeaves(@CurrentUser() user: AuthenticatedUser) {
    return this.essService.getMyLeaves(user.organizationId, user);
  }

  /**
   * GET /api/v1/ess/payslips
   * Historical payslips for logged-in employee
   */
  @Get('payslips')
  async getMyPayslips(@CurrentUser() user: AuthenticatedUser) {
    return this.essService.getMyPayslips(user.organizationId, user);
  }

  /**
   * GET /api/v1/ess/manager/pending-actions
   * Direct reports approval queues (Managers only)
   */
  @Get('manager/pending-actions')
  @Roles(Role.MANAGER, Role.HR_ADMIN, Role.CLIENT_SUPER_ADMIN)
  async getManagerPendingApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.essService.getManagerPendingApprovals(user.organizationId, user);
  }
}
