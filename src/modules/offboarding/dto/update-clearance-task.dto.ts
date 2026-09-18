import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ClearanceStatus } from '@prisma/client';

export class UpdateClearanceTaskDto {
  @IsNotEmpty()
  @IsEnum(ClearanceStatus)
  status: ClearanceStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}
