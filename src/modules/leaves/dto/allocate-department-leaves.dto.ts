import { IsNotEmpty, IsNumber, IsString, IsUUID, NotEquals } from 'class-validator';

export class AllocateDepartmentLeavesDto {
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsNotEmpty({ message: 'departmentId is required' })
  departmentId: string;

  @IsUUID('4', { message: 'leaveTypeId must be a valid UUID' })
  @IsNotEmpty({ message: 'leaveTypeId is required' })
  leaveTypeId: string;

  @IsNumber({}, { message: 'days must be a valid number' })
  @NotEquals(0, { message: 'Adjustment days cannot be 0' })
  days: number;

  @IsString()
  @IsNotEmpty({ message: 'Adjustment reason is required for audit trail' })
  reason: string;
}
