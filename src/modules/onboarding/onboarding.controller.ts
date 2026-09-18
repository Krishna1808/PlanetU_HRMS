import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { OnboardingService } from './onboarding.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { SubmitPreBoardingDto } from './dto/submit-preboarding.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryCandidateDto } from './dto/query-candidate.dto';
import { ConvertCandidateDto } from './dto/convert-candidate.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * POST /api/v1/onboarding/candidates
   * Create & invite candidate for digital onboarding (HR_ADMIN, CLIENT_SUPER_ADMIN)
   */
  @Post('candidates')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async inviteCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.onboardingService.inviteCandidate(user.organizationId, dto, user.id);
  }

  /**
   * GET /api/v1/onboarding/candidates
   * List onboarding pipeline with status filters (HR_ADMIN, CLIENT_SUPER_ADMIN)
   */
  @Get('candidates')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async listCandidates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryCandidateDto,
  ) {
    return this.onboardingService.listCandidates(user.organizationId, query);
  }

  /**
   * GET /api/v1/onboarding/candidates/:id
   * Get candidate details, pre-boarding data, and task checklist
   */
  @Get('candidates/:id')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER)
  async getCandidateById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.onboardingService.getCandidateById(user.organizationId, id);
  }

  /**
   * PATCH /api/v1/onboarding/candidates/:id/form
   * Submit/update pre-boarding details (address, bank, statutory)
   */
  @Patch('candidates/:id/form')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.EMPLOYEE)
  async submitPreBoardingForm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitPreBoardingDto,
  ) {
    return this.onboardingService.submitPreBoardingForm(user.organizationId, id, dto);
  }

  /**
   * PATCH /api/v1/onboarding/tasks/:taskId
   * Update task status (e.g. COMPLETED or SKIPPED) in checklist (HR_ADMIN, CLIENT_SUPER_ADMIN)
   */
  @Patch('tasks/:taskId')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async updateTaskStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.onboardingService.updateTaskStatus(user.organizationId, taskId, dto, user.id);
  }

  /**
   * POST /api/v1/onboarding/candidates/:id/convert
   * Atomically convert candidate to official Employee and User login credentials
   */
  @Post('candidates/:id/convert')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async convertToEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConvertCandidateDto,
  ) {
    return this.onboardingService.convertToEmployee(user.organizationId, id, dto, user);
  }
}
