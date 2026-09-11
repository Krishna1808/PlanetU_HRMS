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

export class AssignShiftDto {
  @IsUUID('4', { message: 'employeeId must be a valid UUID' })
  @IsNotEmpty({ message: 'employeeId is required' })
  employeeId: string;

  @IsUUID('4', { message: 'shiftId must be a valid UUID' })
  @IsNotEmpty({ message: 'shiftId is required' })
  shiftId: string;

  /**
   * The start date when this shift schedule takes effect (e.g. '2026-09-01T00:00:00.000Z' or '2026-09-01')
   */
  @IsDateString({}, { message: 'effectiveFrom must be a valid ISO date string' })
  @IsNotEmpty({ message: 'effectiveFrom is required' })
  effectiveFrom: string;

  /**
   * Array of designated weekly off days for this employee under this assignment
   */
  @IsArray({ message: 'weeklyOffDays must be an array' })
  @IsEnum(DayOfWeek, {
    each: true,
    message: 'Each day in weeklyOffDays must be a valid DayOfWeek (e.g. MONDAY, SUNDAY)',
  })
  @IsOptional()
  weeklyOffDays?: DayOfWeek[];

  @IsString()
  @IsOptional()
  notes?: string;
}
