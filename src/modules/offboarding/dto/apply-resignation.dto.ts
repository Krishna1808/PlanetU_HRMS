import {
  IsString,
  IsNotEmpty,
  IsISO8601,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';
import { ExitType } from '@prisma/client';

export class ApplyResignationDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(ExitType)
  exitType?: ExitType;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsNotEmpty()
  @IsISO8601()
  proposedLastWorkingDay: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  noticePeriodDays?: number;
}
