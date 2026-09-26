import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { AnnouncementPriority } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(AnnouncementPriority)
  @IsOptional()
  priority?: AnnouncementPriority;

  @IsUUID()
  @IsOptional()
  targetDepartmentId?: string;

  @IsOptional()
  expiresAt?: string;

  @IsOptional()
  durationHours?: number;

  @IsBoolean()
  @IsOptional()
  fanOutNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;
}
