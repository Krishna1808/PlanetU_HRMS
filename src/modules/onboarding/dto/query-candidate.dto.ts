import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OnboardingStatus } from '@prisma/client';

export class QueryCandidateDto {
  @IsEnum(OnboardingStatus, { message: 'status must be a valid OnboardingStatus' })
  @IsOptional()
  status?: OnboardingStatus;

  @IsString()
  @IsOptional()
  search?: string;
}
