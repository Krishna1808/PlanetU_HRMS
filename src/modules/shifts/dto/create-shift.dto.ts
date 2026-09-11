import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty({ message: 'Shift name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Shift code is required' })
  code: string;

  /**
   * Start time in 24-hour HH:mm format (e.g., '09:00', '22:00')
   */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in 24-hour HH:mm format (e.g. 09:00, 22:00)',
  })
  startTime: string;

  /**
   * End time in 24-hour HH:mm format (e.g., '18:00', '06:00')
   */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in 24-hour HH:mm format (e.g. 18:00, 06:00)',
  })
  endTime: string;

  /**
   * Indicates if the shift spans past midnight (e.g. 22:00 to 06:00)
   */
  @IsBoolean()
  @IsOptional()
  isOvernight?: boolean;

  /**
   * Permissible grace period for punch-in before marking late (in minutes)
   */
  @IsInt()
  @Min(0, { message: 'gracePeriodMinutes must be a non-negative integer' })
  @IsOptional()
  gracePeriodMinutes?: number = 15;

  /**
   * Unpaid/paid break duration deducted from total work hours (in minutes)
   */
  @IsInt()
  @Min(0, { message: 'breakDurationMinutes must be a non-negative integer' })
  @IsOptional()
  breakDurationMinutes?: number = 60;

  /**
   * Minimum active minutes required to qualify for half-day attendance (default 240 = 4h)
   */
  @IsInt()
  @Min(0, { message: 'halfDayThresholdMinutes must be a non-negative integer' })
  @IsOptional()
  halfDayThresholdMinutes?: number = 240;

  /**
   * Minimum active minutes required to qualify for full-day attendance (default 480 = 8h)
   */
  @IsInt()
  @Min(0, { message: 'fullDayThresholdMinutes must be a non-negative integer' })
  @IsOptional()
  fullDayThresholdMinutes?: number = 480;

  /**
   * Whether this shift is the tenant-wide default fallback shift
   */
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false;

  /**
   * Whether the shift template is active for new assignments
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
