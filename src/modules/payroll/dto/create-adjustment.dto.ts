import { IsUUID, IsInt, IsEnum, IsNumber, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollAdjustmentType } from '@prisma/client';

export class CreateAdjustmentDto {
  @IsUUID()
  employeeId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  month: number;

  @IsEnum(PayrollAdjustmentType)
  type: PayrollAdjustmentType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
