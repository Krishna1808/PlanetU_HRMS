import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class RegularizeAttendanceDto {
  @IsUUID('4', { message: 'employeeId must be a valid UUID' })
  @IsNotEmpty({ message: 'employeeId is required' })
  employeeId: string;

  @IsDateString({}, { message: 'date must be a valid ISO date string' })
  @IsNotEmpty({ message: 'date is required' })
  date: string;

  @IsEnum(AttendanceStatus, {
    message: 'status must be one of: PRESENT, HALF_DAY, ABSENT, ON_LEAVE, WEEKLY_OFF, HOLIDAY',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: AttendanceStatus;

  @IsDateString({}, { message: 'checkInTime must be a valid ISO date string' })
  @IsOptional()
  checkInTime?: string;

  @IsDateString({}, { message: 'checkOutTime must be a valid ISO date string' })
  @IsOptional()
  checkOutTime?: string;

  @IsString()
  @IsNotEmpty({ message: 'remarks explaining regularization reason are required' })
  remarks: string;
}
