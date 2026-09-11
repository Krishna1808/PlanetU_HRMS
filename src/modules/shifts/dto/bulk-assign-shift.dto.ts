import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class BulkAssignShiftDto {
  @IsUUID('4', { message: 'shiftId must be a valid UUID' })
  @IsNotEmpty({ message: 'shiftId is required' })
  shiftId: string;

  /**
   * The start date when this shift schedule takes effect for all target employees
   */
  @IsDateString({}, { message: 'effectiveFrom must be a valid ISO date string' })
  @IsNotEmpty({ message: 'effectiveFrom is required' })
  effectiveFrom: string;

  /**
   * Designated weekly off days for this cohort
   */
  @IsArray({ message: 'weeklyOffDays must be an array' })
  @IsEnum(DayOfWeek, {
    each: true,
    message: 'Each day in weeklyOffDays must be a valid DayOfWeek',
  })
  @IsOptional()
  weeklyOffDays?: DayOfWeek[];

  /**
   * Specific list of employee UUIDs to assign
   */
  @IsArray({ message: 'employeeIds must be an array of UUIDs' })
  @IsUUID('4', { each: true, message: 'Each employeeId must be a valid UUID' })
  @IsOptional()
  employeeIds?: string[];

  /**
   * Alternatively, target all active employees in a specific department
   */
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
