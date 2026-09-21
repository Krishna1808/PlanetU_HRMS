import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TerminateEmployeeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Notice period days must be an integer' })
  @Min(0, { message: 'Notice period days cannot be negative' })
  @Max(365, { message: 'Notice period days cannot exceed 365' })
  noticePeriodDays?: number = 30;

  @IsString()
  @IsNotEmpty({ message: 'Reason for termination is required' })
  reason: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid termination date format' })
  terminationDate?: string;
}
