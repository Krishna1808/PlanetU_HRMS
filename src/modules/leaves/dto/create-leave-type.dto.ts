import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LeaveAccrualFrequency } from '@prisma/client';

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'Leave type name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Leave type code is required (e.g. CL, SL, PL)' })
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Indicates if this leave type is fully paid.
   * Unpaid leaves (isPaid: false) like LWP directly deduct from payroll payable days.
   */
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean = true;

  /**
   * Total entitlement granted per calendar year (e.g. 12.0 for CL)
   */
  @IsNumber()
  @Min(0, { message: 'daysAllowedPerYear must be non-negative' })
  @IsOptional()
  daysAllowedPerYear?: number = 0;

  @IsEnum(LeaveAccrualFrequency, {
    message: 'accrualFrequency must be one of: MONTHLY, QUARTERLY, YEARLY, NONE',
  })
  @IsOptional()
  accrualFrequency?: LeaveAccrualFrequency = LeaveAccrualFrequency.MONTHLY;

  /**
   * Maximum unused leave days that can be carried over into the next calendar year
   */
  @IsNumber()
  @Min(0, { message: 'carryForwardLimit must be non-negative' })
  @IsOptional()
  carryForwardLimit?: number = 0;

  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean = true;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
