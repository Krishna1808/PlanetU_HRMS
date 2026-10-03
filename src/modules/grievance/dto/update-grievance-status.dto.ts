import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { GrievanceStatus } from '@prisma/client';

export class UpdateGrievanceStatusDto {
  @IsNotEmpty()
  @IsEnum(GrievanceStatus)
  status: GrievanceStatus;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isInternalOnly?: boolean;
}
