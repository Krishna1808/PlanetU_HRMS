import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CalculateFnFDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  gratuityAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherDeductions?: number;

  @IsOptional()
  @IsString()
  otherDeductionsRemarks?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
