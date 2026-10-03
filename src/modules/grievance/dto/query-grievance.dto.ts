import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GrievanceCategory, GrievancePriority, GrievanceStatus } from '@prisma/client';

export class QueryGrievanceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(GrievanceStatus)
  status?: GrievanceStatus;

  @IsOptional()
  @IsEnum(GrievanceCategory)
  category?: GrievanceCategory;

  @IsOptional()
  @IsEnum(GrievancePriority)
  priority?: GrievancePriority;

  @IsOptional()
  @IsString()
  search?: string;
}
