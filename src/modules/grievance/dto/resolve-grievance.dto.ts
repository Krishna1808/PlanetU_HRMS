import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { GrievanceStatus } from '@prisma/client';

export class ResolveGrievanceDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  resolutionNotes: string;

  @IsOptional()
  @IsEnum(GrievanceStatus)
  status?: GrievanceStatus; // RESOLVED or REJECTED
}
