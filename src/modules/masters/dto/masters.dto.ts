import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Department name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Department code prefix is required (e.g. ENG)' })
  @Length(2, 6, { message: 'Code prefix must be between 2 and 6 uppercase characters' })
  @Matches(/^[A-Z0-9]+$/, { message: 'Code prefix must be alphanumeric uppercase' })
  codePrefix: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateDesignationDto {
  @IsString()
  @IsNotEmpty({ message: 'Designation name is required' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateGradeDto {
  @IsString()
  @IsNotEmpty({ message: 'Grade name is required (e.g. L1, M2)' })
  name: string;

  @IsOptional()
  level?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty({ message: 'Location name is required' })
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;
}
