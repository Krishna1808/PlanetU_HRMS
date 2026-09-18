import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { ExitReasonCategory } from '@prisma/client';

export class SubmitExitInterviewDto {
  @IsNotEmpty()
  @IsEnum(ExitReasonCategory)
  reasonCategory: ExitReasonCategory;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  companyCultureRating: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  managementRating: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  workLifeBalanceRating: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  compensationRating: number;

  @IsNotEmpty()
  @IsBoolean()
  wouldRecommendCompany: boolean;

  @IsOptional()
  @IsString()
  feedback?: string;
}
