import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LeaveAccrualFrequency } from '@prisma/client';

export class UpdateLeaveTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @IsNumber()
  @Min(0, { message: 'daysAllowedPerYear must be non-negative' })
  @IsOptional()
  daysAllowedPerYear?: number;

  @IsEnum(LeaveAccrualFrequency, {
    message: 'accrualFrequency must be one of: MONTHLY, QUARTERLY, YEARLY, NONE',
  })
  @IsOptional()
  accrualFrequency?: LeaveAccrualFrequency;

  @IsNumber()
  @Min(0, { message: 'carryForwardLimit must be non-negative' })
  @IsOptional()
  carryForwardLimit?: number;

  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
