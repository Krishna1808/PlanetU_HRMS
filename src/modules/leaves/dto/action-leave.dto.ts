import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { LeaveRequestStatus } from '@prisma/client';

export class ActionLeaveDto {
  /**
   * Action decision: Must be either APPROVED or REJECTED
   */
  @IsIn([LeaveRequestStatus.APPROVED, LeaveRequestStatus.REJECTED], {
    message: 'status must be either APPROVED or REJECTED',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: 'APPROVED' | 'REJECTED';

  /**
   * Optional/Required note explaining reason for rejection
   */
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
