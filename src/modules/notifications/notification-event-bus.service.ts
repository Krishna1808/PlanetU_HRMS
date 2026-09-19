import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export interface LeaveStatusEventPayload {
  organizationId: string;
  recipientUserId: string;
  leaveRequestId: string;
  status: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
}

export interface AttendanceAlertEventPayload {
  organizationId: string;
  recipientUserId: string;
  alertType: 'LATE_ARRIVAL' | 'MISSING_PUNCH' | 'OVERTIME';
  date: string;
  details: string;
}

export interface PayslipReleasedEventPayload {
  organizationId: string;
  recipientUserId: string;
  payslipId: string;
  month: number;
  year: number;
  netPayable: number;
}

export interface ShiftAssignedEventPayload {
  organizationId: string;
  recipientUserId: string;
  shiftName: string;
  effectiveDate: string;
}

export interface ClearanceTaskEventPayload {
  organizationId: string;
  recipientUserId: string;
  department: string;
  taskName: string;
  employeeName: string;
}

export interface AnnouncementPublishedEventPayload {
  organizationId: string;
  announcementId: string;
  title: string;
  priority: string;
  targetDepartmentId?: string;
  createdByUserId: string;
}

@Injectable()
export class NotificationEventBusService {
  private readonly logger = new Logger(NotificationEventBusService.name);
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  emitLeaveStatus(payload: LeaveStatusEventPayload) {
    this.logger.log(`Domain Event Emitted: leave.status_changed for user ${payload.recipientUserId}`);
    this.emitter.emit('leave.status_changed', payload);
  }

  emitAttendanceAlert(payload: AttendanceAlertEventPayload) {
    this.logger.log(`Domain Event Emitted: attendance.alert for user ${payload.recipientUserId}`);
    this.emitter.emit('attendance.alert', payload);
  }

  emitPayslipReleased(payload: PayslipReleasedEventPayload) {
    this.logger.log(`Domain Event Emitted: payroll.payslip_released for user ${payload.recipientUserId}`);
    this.emitter.emit('payroll.payslip_released', payload);
  }

  emitShiftAssigned(payload: ShiftAssignedEventPayload) {
    this.logger.log(`Domain Event Emitted: shift.assigned for user ${payload.recipientUserId}`);
    this.emitter.emit('shift.assigned', payload);
  }

  emitClearanceTask(payload: ClearanceTaskEventPayload) {
    this.logger.log(`Domain Event Emitted: clearance.task_assigned for user ${payload.recipientUserId}`);
    this.emitter.emit('clearance.task_assigned', payload);
  }

  emitAnnouncementPublished(payload: AnnouncementPublishedEventPayload) {
    this.logger.log(`Domain Event Emitted: announcement.published [${payload.title}]`);
    this.emitter.emit('announcement.published', payload);
  }

  on(eventName: string, listener: (...args: any[]) => void) {
    this.emitter.on(eventName, listener);
  }
}
