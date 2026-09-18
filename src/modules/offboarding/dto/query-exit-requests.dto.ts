import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ExitStatus } from '@prisma/client';

export class QueryExitRequestsDto {
  @IsOptional()
  @IsEnum(ExitStatus)
  status?: ExitStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
