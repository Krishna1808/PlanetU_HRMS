import {
  IsInt,
  IsNotEmpty,
  Max,
  Min,
} from 'class-validator';

export class CalculatePayrollBatchDto {
  /**
   * Calendar year (e.g. 2026)
   */
  @IsInt({ message: 'year must be an integer' })
  @Min(2000, { message: 'year must be >= 2000' })
  @Max(2100, { message: 'year must be <= 2100' })
  @IsNotEmpty({ message: 'year is required' })
  year: number;

  /**
   * Calendar month (1 - 12)
   */
  @IsInt({ message: 'month must be an integer' })
  @Min(1, { message: 'month must be between 1 and 12' })
  @Max(12, { message: 'month must be between 1 and 12' })
  @IsNotEmpty({ message: 'month is required' })
  month: number;
}
