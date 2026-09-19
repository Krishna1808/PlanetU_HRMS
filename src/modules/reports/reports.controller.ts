import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @Roles(
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.FINANCE,
    Role.MANAGER,
  )
  async getExecutiveOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getExecutiveOverview(user.organizationId, user);
  }

  @Get('workforce')
  @Roles(
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.FINANCE,
    Role.MANAGER,
  )
  async getWorkforceAnalytics(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getWorkforceAnalytics(user.organizationId, user);
  }

  @Get('attendance')
  @Roles(
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.FINANCE,
    Role.MANAGER,
  )
  async getAttendanceAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getAttendanceAnalytics(user.organizationId, query, user);
  }

  @Get('leaves')
  @Roles(
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.FINANCE,
    Role.MANAGER,
  )
  async getLeaveAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getLeaveAnalytics(user.organizationId, query, user);
  }

  @Get('payroll')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.FINANCE)
  async getPayrollAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getPayrollAnalytics(user.organizationId, query, user);
  }

  @Get('lifecycle')
  @Roles(
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.MANAGER,
  )
  async getLifecycleAnalytics(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getLifecycleAnalytics(user.organizationId, user);
  }

  @Get('export/:reportType')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.FINANCE)
  async exportReportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportType') reportType: string,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.reportsService.exportReportCsv(
      user.organizationId,
      reportType,
      query,
      user,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  }
}
