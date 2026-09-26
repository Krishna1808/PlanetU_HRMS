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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { NotificationService } from './notification.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { QueryAnnouncementsDto } from './dto/query-announcements.dto';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationService.getUserNotifications(user.id, user.organizationId, query);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.getUnreadCount(user.id, user.organizationId);
  }

  @Patch('mark-all-read')
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.markAllAsRead(user.id, user.organizationId);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationService.markAsRead(id, user.id, user.organizationId);
  }

  @Post('test-email')
  async sendTestEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body('targetEmail') targetEmail?: string,
  ) {
    const destination = targetEmail?.trim() || user.email;
    return this.notificationService.sendTestEmail(destination);
  }

  // -------------------------------------------------------------------------
  // Announcements Endpoints
  // -------------------------------------------------------------------------

  @Post('announcements')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  async createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.notificationService.createAnnouncement(user.organizationId, user, dto);
  }

  @Get('announcements')
  async getAnnouncements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAnnouncementsDto,
  ) {
    return this.notificationService.getAnnouncements(user.organizationId, user, query);
  }

  @Patch('announcements/:id/deactivate')
  @Roles(Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  async deactivateAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationService.deactivateAnnouncement(id, user.organizationId, user);
  }
}
