import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { EmploymentStatus, EmploymentType, Gender } from '@prisma/client';

export class CreateEmployeeDto {
  // Personal Details
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @IsEmail({}, { message: 'Invalid personal email format' })
  @IsOptional()
  personalEmail?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsDateString({}, { message: 'Date of birth must be a valid ISO date string' })
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(Gender, { message: 'Invalid gender value' })
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

  // Employment Details
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsNotEmpty({ message: 'Department is required' })
  departmentId: string;

  @IsUUID('4', { message: 'designationId must be a valid UUID' })
  @IsNotEmpty({ message: 'Designation is required' })
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

  @IsEnum(EmploymentType, { message: 'Invalid employment type' })
  @IsOptional()
  employmentType?: EmploymentType;

  @IsEnum(EmploymentStatus, { message: 'Invalid employment status' })
  @IsOptional()
  employmentStatus?: EmploymentStatus;

  @IsDateString({}, { message: 'dateOfJoining must be a valid ISO date string' })
  @IsNotEmpty({ message: 'Date of joining is required' })
  dateOfJoining: string;

  @IsDateString()
  @IsOptional()
  probationEndDate?: string;

  // Compensation & Bank Details (Restricted fields)
  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber({}, { message: 'baseSalary must be a number' })
  @Min(0, { message: 'baseSalary cannot be negative' })
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

  // Optional user account creation alongside employee
  @IsEmail()
  @IsOptional()
  workEmail?: string;

  @IsString()
  @IsOptional()
  initialPassword?: string;
}
