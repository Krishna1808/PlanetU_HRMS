import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  /**
   * Optional punch timestamp (defaults to server current time if omitted)
   */
  @IsDateString({}, { message: 'timestamp must be a valid ISO date string' })
  @IsOptional()
  timestamp?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
