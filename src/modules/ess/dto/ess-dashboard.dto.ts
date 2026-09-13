export interface EssProfileSummary {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  personalEmail: string | null;
  phone: string | null;
  department: string;
  designation: string;
  grade: string | null;
  location: string | null;
  reportingManager: string | null;
  dateOfJoining: string;
}

export interface EssShiftCard {
  shiftId: string;
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  gracePeriodMinutes: number;
  weeklyOffDays: string[];
}

export interface EssTodayAttendance {
  date: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalActiveMinutes: number | null;
  isLate: boolean;
  isHalfDay: boolean;
  isWeeklyOff: boolean;
}

export interface EssLeaveBalanceItem {
  leaveTypeId: string;
  name: string;
  code: string;
  isPaid: boolean;
  daysAllowedPerYear: number;
  accruedDays: number;
  usedDays: number;
  availableBalance: number;
}

export interface EssRecentLeaveItem {
  id: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason: string;
  appliedAt: string;
}

export interface EssLatestPayslipItem {
  id: string;
  year: number;
  month: number;
  payableDays: number;
  earnedGross: number;
  totalDeductions: number;
  netPay: number;
  status: string;
}

export interface EssManagerOverview {
  isManager: boolean;
  directReportsCount: number;
  pendingLeaveApprovalsCount: number;
}

export interface EssDashboardResponse {
  profile: EssProfileSummary;
  shift: EssShiftCard;
  todayAttendance: EssTodayAttendance;
  leaveBalances: EssLeaveBalanceItem[];
  recentLeaveRequests: EssRecentLeaveItem[];
  latestPayslip: EssLatestPayslipItem | null;
  managerOverview?: EssManagerOverview;
}
