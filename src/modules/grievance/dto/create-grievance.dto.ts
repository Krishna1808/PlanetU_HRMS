import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { GrievanceCategory, GrievancePriority } from '@prisma/client';

export class CreateGrievanceDto {
  @IsNotEmpty()
  @IsEnum(GrievanceCategory)
  category: GrievanceCategory;

  @IsOptional()
  @IsEnum(GrievancePriority)
  priority?: GrievancePriority;

  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  description: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;
}
