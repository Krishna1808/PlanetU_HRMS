import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';
import { ApprovalStatus } from '@prisma/client';

export class ActionResignationDto {
  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  decision: ApprovalStatus;

  @IsOptional()
  @IsISO8601()
  approvedLastWorkingDay?: string;

  @IsOptional()
  @IsString()
  comments?: string;
}
