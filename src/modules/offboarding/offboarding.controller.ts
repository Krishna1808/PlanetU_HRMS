import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { OffboardingService } from './offboarding.service';
import { ApplyResignationDto } from './dto/apply-resignation.dto';
import { ActionResignationDto } from './dto/action-resignation.dto';
import { UpdateClearanceTaskDto } from './dto/update-clearance-task.dto';
import { SubmitExitInterviewDto } from './dto/submit-exit-interview.dto';
import { CalculateFnFDto } from './dto/calculate-fnf.dto';
import { QueryExitRequestsDto } from './dto/query-exit-requests.dto';

@Controller('api/v1/offboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OffboardingController {
  constructor(private readonly offboardingService: OffboardingService) {}

  @Post('resignation')
  @Roles(
    Role.EMPLOYEE,
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.MANAGER,
  )
  async applyResignation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyResignationDto,
  ) {
    return this.offboardingService.applyResignation(user.organizationId, dto, user);
  }

  @Get('requests')
  @Roles(
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.MANAGER,
    Role.FINANCE,
    Role.EMPLOYEE,
  )
  async listExitRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryExitRequestsDto,
  ) {
    return this.offboardingService.listExitRequests(user.organizationId, query, user);
  }

  @Get('requests/:id')
  @Roles(
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.MANAGER,
    Role.FINANCE,
    Role.EMPLOYEE,
  )
  async getExitRequestById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offboardingService.getExitRequestById(user.organizationId, id, user);
  }

  @Patch('requests/:id/action')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER)
  async actionResignation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionResignationDto,
  ) {
    return this.offboardingService.actionResignation(user.organizationId, id, dto, user);
  }

  @Patch('tasks/:taskId')
  @Roles(
    Role.CLIENT_SUPER_ADMIN,
    Role.HR_ADMIN,
    Role.MANAGER,
    Role.FINANCE,
  )
  async updateClearanceTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateClearanceTaskDto,
  ) {
    return this.offboardingService.updateClearanceTask(user.organizationId, taskId, dto, user);
  }

  @Post('requests/:id/interview')
  @Roles(Role.EMPLOYEE, Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async submitExitInterview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitExitInterviewDto,
  ) {
    return this.offboardingService.submitExitInterview(user.organizationId, id, dto, user);
  }

  @Post('requests/:id/fnf/calculate')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.FINANCE)
  async calculateFnFSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CalculateFnFDto,
  ) {
    return this.offboardingService.calculateFnFSettlement(user.organizationId, id, dto);
  }

  @Patch('requests/:id/fnf/approve')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.FINANCE, Role.HR_ADMIN)
  async approveFnFSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offboardingService.approveFnFSettlement(user.organizationId, id, user);
  }

  @Post('requests/:id/finalize')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async finalizeExit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offboardingService.finalizeExit(user.organizationId, id, user);
  }
}
