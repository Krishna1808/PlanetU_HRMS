import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OnboardingTaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @IsEnum(OnboardingTaskStatus, {
    message: 'status must be PENDING, IN_PROGRESS, COMPLETED, or SKIPPED',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: OnboardingTaskStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
