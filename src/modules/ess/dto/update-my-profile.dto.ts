import {
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateMyProfileDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail({}, { message: 'personalEmail must be a valid email address' })
  @IsOptional()
  personalEmail?: string;

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
}
