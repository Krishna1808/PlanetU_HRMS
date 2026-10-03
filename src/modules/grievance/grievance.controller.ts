import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { GrievanceService } from './grievance.service';
import { CreateGrievanceDto } from './dto/create-grievance.dto';
import { UpdateGrievanceStatusDto } from './dto/update-grievance-status.dto';
import { AddTimelineNoteDto } from './dto/add-timeline-note.dto';
import { ResolveGrievanceDto } from './dto/resolve-grievance.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { QueryGrievanceDto } from './dto/query-grievance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/grievance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GrievanceController {
  constructor(private readonly grievanceService: GrievanceService) {}

  /**
   * Submit a new grievance (Employee Self-Service or Management)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGrievance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGrievanceDto,
  ) {
    return this.grievanceService.createGrievance(user.organizationId, user, dto);
  }

  /**
   * Get employee's own submitted grievances (Self-Service)
   */
  @Get('my')
  async getMyGrievances(@CurrentUser() user: AuthenticatedUser) {
    return this.grievanceService.getMyGrievances(user.organizationId, user);
  }

  /**
   * Get executive stats and triage metrics for HR & Committee
   */
  @Get('stats')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async getGrievanceStats(@CurrentUser() user: AuthenticatedUser) {
    return this.grievanceService.getGrievanceStats(user.organizationId);
  }

  /**
   * List all organization grievances with filters and search (HR Admin only)
   */
  @Get()
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async listAllGrievances(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryGrievanceDto,
  ) {
    return this.grievanceService.listAllGrievances(
      user.organizationId,
      query,
      user,
    );
  }

  /**
   * Get single grievance case details
   */
  @Get(':id')
  async getGrievanceById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.grievanceService.getGrievanceById(user.organizationId, id, user);
  }

  /**
   * Update status or assign investigator (HR Admin)
   */
  @Patch(':id/status')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGrievanceStatusDto,
  ) {
    return this.grievanceService.updateStatus(
      user.organizationId,
      id,
      user,
      dto,
    );
  }

  /**
   * Add investigation note or internal audit trail entry
   */
  @Post(':id/timeline')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async addTimelineNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddTimelineNoteDto,
  ) {
    return this.grievanceService.addTimelineNote(
      user.organizationId,
      id,
      user,
      dto,
    );
  }

  /**
   * Mark grievance as resolved or dismissed
   */
  @Post(':id/resolve')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async resolveGrievance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveGrievanceDto,
  ) {
    return this.grievanceService.resolveGrievance(
      user.organizationId,
      id,
      user,
      dto,
    );
  }

  /**
   * Submit employee satisfaction rating and close ticket
   */
  @Post(':id/feedback')
  async submitFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.grievanceService.submitFeedback(
      user.organizationId,
      id,
      user,
      dto,
    );
  }
}
