import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdatePayrollConfigDto {
  /**
   * PF Statutory Ceiling amount (e.g. 15000.00 INR)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  pfCeilingAmount?: number;

  /**
   * Whether to apply the PF statutory wage ceiling cap
   */
  @IsBoolean()
  @IsOptional()
  applyPfCeiling?: boolean;

  /**
   * Employee PF contribution rate percentage (default 12.00%)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  pfEmployeeRate?: number;

  /**
   * Employer PF contribution rate percentage (default 12.00%)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  pfEmployerRate?: number;

  /**
   * Whether ESI calculation is enabled
   */
  @IsBoolean()
  @IsOptional()
  applyEsi?: boolean;

  /**
   * Monthly gross threshold below which ESI applies (default 21000.00 INR)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  esiThresholdAmount?: number;

  /**
   * Employee ESI rate percentage (default 0.75%)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  esiEmployeeRate?: number;

  /**
   * Employer ESI rate percentage (default 3.25%)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  esiEmployerRate?: number;

  /**
   * Professional Tax monthly flat amount (default 200.00 INR)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  ptAmount?: number;

  /**
   * Monthly gross salary threshold to trigger PT deduction (default 10000.00 INR)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  ptSalaryThreshold?: number;

  /**
   * Whether to round final Net Pay to whole rupees
   */
  @IsBoolean()
  @IsOptional()
  roundToWholeRupee?: boolean;

  /**
   * Percentage of monthly gross allocated to Basic salary (default 50.00%)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  basicPercentage?: number;

  /**
   * Percentage of monthly gross allocated to HRA (default 25.00%)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  hraPercentage?: number;

  /**
   * Percentage of monthly gross allocated to Special Allowance (default 25.00%)
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  specialAllowancePercentage?: number;
}
