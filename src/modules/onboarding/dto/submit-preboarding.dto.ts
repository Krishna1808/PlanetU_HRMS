import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class SubmitPreBoardingDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsDateString({}, { message: 'dateOfBirth must be a valid date' })
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(Gender, { message: 'gender must be a valid Gender enum' })
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

  @IsString()
  @IsOptional()
  notes?: string;
}
