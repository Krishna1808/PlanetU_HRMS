import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class QueryAttendanceDto {
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  @IsOptional()
  startDate?: string;

  @IsDateString({}, { message: 'endDate must be a valid ISO date string' })
  @IsOptional()
  endDate?: string;

  @IsUUID('4', { message: 'employeeId must be a valid UUID' })
  @IsOptional()
  employeeId?: string;

  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsOptional()
  departmentId?: string;

  @IsEnum(AttendanceStatus, { message: 'status must be a valid AttendanceStatus' })
  @IsOptional()
  status?: AttendanceStatus;
}
