import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  NotEquals,
} from 'class-validator';

export class AdjustBalanceDto {
  @IsUUID('4', { message: 'employeeId must be a valid UUID' })
  @IsNotEmpty({ message: 'employeeId is required' })
  employeeId: string;

  @IsUUID('4', { message: 'leaveTypeId must be a valid UUID' })
  @IsNotEmpty({ message: 'leaveTypeId is required' })
  leaveTypeId: string;

  /**
   * Number of days to adjust.
   * Positive value = credit adjustment (+X days).
   * Negative value = debit adjustment (-X days).
   */
  @IsNumber({}, { message: 'days must be a valid number' })
  @NotEquals(0, { message: 'Adjustment days cannot be 0' })
  days: number;

  @IsString()
  @IsNotEmpty({ message: 'Adjustment reason is required for audit trail' })
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
