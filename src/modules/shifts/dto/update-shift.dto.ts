import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UpdateShiftDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in 24-hour HH:mm format (e.g. 09:00, 22:00)',
  })
  @IsOptional()
  startTime?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in 24-hour HH:mm format (e.g. 18:00, 06:00)',
  })
  @IsOptional()
  endTime?: string;

  @IsBoolean()
  @IsOptional()
  isOvernight?: boolean;

  @IsInt()
  @Min(0, { message: 'gracePeriodMinutes must be a non-negative integer' })
  @IsOptional()
  gracePeriodMinutes?: number;

  @IsInt()
  @Min(0, { message: 'breakDurationMinutes must be a non-negative integer' })
  @IsOptional()
  breakDurationMinutes?: number;

  @IsInt()
  @Min(0, { message: 'halfDayThresholdMinutes must be a non-negative integer' })
  @IsOptional()
  halfDayThresholdMinutes?: number;

  @IsInt()
  @Min(0, { message: 'fullDayThresholdMinutes must be a non-negative integer' })
  @IsOptional()
  fullDayThresholdMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
