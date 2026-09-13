import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { LeaveHalfDaySession } from '@prisma/client';

export class ApplyLeaveDto {
  /**
   * Optional employeeId: If omitted, the request defaults to the currently authenticated employee.
   * HR_ADMIN and CLIENT_SUPER_ADMIN can supply an employeeId to apply on an employee's behalf.
   */
  @IsUUID('4', { message: 'employeeId must be a valid UUID' })
  @IsOptional()
  employeeId?: string;

  @IsUUID('4', { message: 'leaveTypeId must be a valid UUID' })
  @IsNotEmpty({ message: 'leaveTypeId is required' })
  leaveTypeId: string;

  /**
   * Start date of the leave period (ISO format: YYYY-MM-DD or full ISO date string)
   */
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'startDate is required' })
  startDate: string;

  /**
   * End date of the leave period (ISO format: YYYY-MM-DD or full ISO date string)
   */
  @IsDateString({}, { message: 'endDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'endDate is required' })
  endDate: string;

  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean = false;

  @IsEnum(LeaveHalfDaySession, {
    message: 'halfDaySession must be either FIRST_HALF or SECOND_HALF',
  })
  @IsOptional()
  halfDaySession?: LeaveHalfDaySession;

  @IsString()
  @IsNotEmpty({ message: 'Reason for leave application is required' })
  reason: string;
}
