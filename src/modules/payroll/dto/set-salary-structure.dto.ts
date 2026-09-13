import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class SetSalaryStructureDto {
  @IsUUID('4', { message: 'employeeId must be a valid UUID' })
  @IsNotEmpty({ message: 'employeeId is required' })
  employeeId: string;

  /**
   * Annual Cost-to-Company (CTC) in INR.
   * Basic (50%), HRA (25%), Special Allowance (25%) are derived automatically.
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'annualCtc must be a valid monetary amount' })
  @IsPositive({ message: 'annualCtc must be greater than zero' })
  annualCtc: number;

  /**
   * Date from which this structure becomes active (ISO 8601 string)
   */
  @IsDateString({}, { message: 'effectiveFrom must be a valid ISO 8601 date string' })
  @IsNotEmpty({ message: 'effectiveFrom is required' })
  effectiveFrom: string;

  /**
   * Optional reason for revision (e.g. Annual Appraisal 2026, Promotion)
   */
  @IsString()
  @IsOptional()
  revisionReason?: string;
}
