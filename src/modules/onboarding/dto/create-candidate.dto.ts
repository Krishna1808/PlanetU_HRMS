import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @IsNotEmpty({ message: 'firstName is required' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'lastName is required' })
  lastName: string;

  @IsEmail({}, { message: 'personalEmail must be a valid email' })
  @IsNotEmpty({ message: 'personalEmail is required' })
  personalEmail: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsNotEmpty({ message: 'departmentId is required' })
  departmentId: string;

  @IsUUID('4', { message: 'designationId must be a valid UUID' })
  @IsNotEmpty({ message: 'designationId is required' })
  designationId: string;

  @IsUUID('4', { message: 'gradeId must be a valid UUID' })
  @IsOptional()
  gradeId?: string;

  @IsUUID('4', { message: 'locationId must be a valid UUID' })
  @IsOptional()
  locationId?: string;

  @IsUUID('4', { message: 'reportingManagerId must be a valid UUID' })
  @IsOptional()
  reportingManagerId?: string;

  @IsDateString({}, { message: 'proposedJoiningDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'proposedJoiningDate is required' })
  proposedJoiningDate: string;

  @IsNumber({}, { message: 'offeredCtc must be a number' })
  @Min(0, { message: 'offeredCtc cannot be negative' })
  @IsOptional()
  offeredCtc?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
