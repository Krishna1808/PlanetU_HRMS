import { IsOptional, IsString, MinLength } from 'class-validator';

export class ConvertCandidateDto {
  /**
   * Optional initial password for the newly created user account.
   * Defaults to 'Password@123' if not provided.
   */
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @IsOptional()
  initialPassword?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
