import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { EmploymentStatus, EmploymentType, Gender } from '@prisma/client';

export class UpdateEmployeeDto {
  // Low-Risk Personal Fields (Self-editable by Employee)
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  personalEmail?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  currentAddress?: string;

  @IsString()
  @IsOptional()
  permanentAddress?: string;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @IsString()
  @IsOptional()
  emergencyContactRelation?: string;

  // High-Risk Employment Fields (HR / Admin Only)
  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsUUID('4')
  @IsOptional()
  designationId?: string;

  @IsUUID('4')
  @IsOptional()
  gradeId?: string;

  @IsUUID('4')
  @IsOptional()
  locationId?: string;

  @IsUUID('4')
  @IsOptional()
  reportingManagerId?: string;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsEnum(EmploymentStatus)
  @IsOptional()
  employmentStatus?: EmploymentStatus;

  @IsDateString()
  @IsOptional()
  dateOfJoining?: string;

  @IsDateString()
  @IsOptional()
  dateOfExit?: string;

  @IsDateString()
  @IsOptional()
  probationEndDate?: string;

  // Compensation & Bank Details (HR / Admin Only)
  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  baseSalary?: number;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  ifscOrRouting?: string;

  @IsString()
  @IsOptional()
  panNumber?: string;

  @IsString()
  @IsOptional()
  uanNumber?: string;

  // Audit reason for job change
  @IsString()
  @IsOptional()
  changeReason?: string;
}
