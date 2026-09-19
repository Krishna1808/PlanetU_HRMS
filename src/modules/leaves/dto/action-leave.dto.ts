import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { LeaveRequestStatus } from '@prisma/client';

export class ActionLeaveDto {
  /**
   * Action decision: Must be either APPROVED or REJECTED.
   * Also accepts APPROVE, REJECT, and resolves from action property if status is omitted.
   */
  @Transform(({ value, obj }) => {
    const raw = value ?? obj.action;
    if (typeof raw === 'string') {
      const upper = raw.toUpperCase();
      if (upper === 'APPROVE' || upper === 'APPROVED') return LeaveRequestStatus.APPROVED;
      if (upper === 'REJECT' || upper === 'REJECTED') return LeaveRequestStatus.REJECTED;
    }
    return raw;
  })
  @IsIn([LeaveRequestStatus.APPROVED, LeaveRequestStatus.REJECTED], {
    message: 'status must be either APPROVED or REJECTED',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: LeaveRequestStatus;

  /**
   * Optional action property alias for client backward compatibility
   */
  @IsOptional()
  @IsString()
  action?: string;

  /**
   * Optional/Required note explaining reason for rejection
   */
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
