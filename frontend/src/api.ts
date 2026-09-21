// API Client for PlanetU HRMS — Interactive 7-Module Testing Portal
// Uses credentials: 'include' for secure httpOnly cookie authentication

const BASE_URL = '/api/v1';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || res.statusText || 'An error occurred';
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // 1. Auth & Session
  login: (email: string, password: string) =>
    fetchJson<{ user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    fetchJson<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => fetchJson<any>('/auth/me'),

  // 2. Masters
  getDepartments: () => fetchJson<any[]>('/masters/departments'),
  getDepartmentById: (id: string) => fetchJson<any>(`/masters/departments/${id}`),
  setDepartmentHead: (id: string, headEmployeeId: string | null) =>
    fetchJson<any>(`/masters/departments/${id}/head`, {
      method: 'PATCH',
      body: JSON.stringify({ headEmployeeId }),
    }),
  createDepartment: (data: { name: string; codePrefix: string; description?: string; headId?: string }) =>
    fetchJson<any>('/masters/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDesignations: () => fetchJson<any[]>('/masters/designations'),
  createDesignation: (data: { name: string; description?: string }) =>
    fetchJson<any>('/masters/designations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDesignation: (id: string, data: { name?: string; description?: string }) =>
    fetchJson<any>(`/masters/designations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getGrades: () => fetchJson<any[]>('/masters/grades'),
  createGrade: (data: { name: string; level?: number; description?: string }) =>
    fetchJson<any>('/masters/grades', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getLocations: () => fetchJson<any[]>('/masters/locations'),
  createLocation: (data: { name: string; city?: string; country?: string; address?: string }) =>
    fetchJson<any>('/masters/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 3. Module 1: Employees
  getEmployees: () =>
    fetchJson<{ data: any[]; pagination: any }>('/employees?limit=50'),

  getEmployeeById: (id: string) => fetchJson<any>(`/employees/${id}`),

  createEmployee: (data: any) =>
    fetchJson<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEmployee: (id: string, data: any) =>
    fetchJson<any>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  terminateEmployee: (
    id: string,
    payload: string | { noticePeriodDays?: number; reason: string; terminationDate?: string },
  ) => {
    const body = typeof payload === 'string' ? { reason: payload, noticePeriodDays: 0 } : payload;
    return fetchJson<any>(`/employees/${id}/terminate`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // 4. Module 3: Shifts
  getShifts: () => fetchJson<any[]>('/shifts'),
  assignShift: (data: { employeeId: string; shiftId: string; effectiveFrom: string; weeklyOffDays?: string[] }) =>
    fetchJson<any>('/shifts/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 5. Module 4: Attendance
  checkIn: (remarks?: string) =>
    fetchJson<any>('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    }),

  checkOut: (remarks?: string) =>
    fetchJson<any>('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    }),

  getTodayAttendance: () => fetchJson<any>('/attendance/today'),
  getMyAttendanceHistory: () => fetchJson<any[]>('/attendance/my-records'),
  getPayableDays: (employeeId: string, year: number, month: number) =>
    fetchJson<any>(`/attendance/payable-days/${employeeId}?year=${year}&month=${month}`),

  // 6. Module 5: Leaves
  getLeaveTypes: () => fetchJson<any[]>('/leaves/types'),
  getMyLeaveBalances: () => fetchJson<any>('/leaves/my-balances'),
  getMyLeaveRequests: () => fetchJson<any[]>('/leaves/my-requests'),
  applyLeave: (data: { leaveTypeId: string; startDate: string; endDate: string; isHalfDay?: boolean; halfDaySession?: string; reason: string }) =>
    fetchJson<any>('/leaves/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelLeave: (id: string) =>
    fetchJson<any>(`/leaves/${id}/cancel`, {
      method: 'POST',
    }),
  getPendingLeaves: () => fetchJson<any[]>('/leaves/pending'),
  actionLeave: (id: string, action: 'APPROVE' | 'REJECT' | 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    const status = action.startsWith('APPROV') ? 'APPROVED' : 'REJECTED';
    return fetchJson<any>(`/leaves/${id}/action`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason }),
    });
  },
  createLeaveType: (data: {
    name: string;
    code: string;
    description?: string;
    isPaid?: boolean;
    daysAllowedPerYear?: number;
    accrualFrequency?: string;
    carryForwardLimit?: number;
    requiresApproval?: boolean;
  }) =>
    fetchJson<any>('/leaves/types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  adjustLeaveBalance: (data: {
    employeeId: string;
    leaveTypeId: string;
    days: number;
    reason: string;
    notes?: string;
  }) =>
    fetchJson<any>('/leaves/adjust-balance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  allocateDepartmentLeaves: (data: {
    departmentId: string;
    leaveTypeId: string;
    days: number;
    reason: string;
  }) =>
    fetchJson<any>('/leaves/allocate-department', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 7. Module 6: Payroll
  getPayrollConfig: () => fetchJson<any>('/payroll/configuration'),
  setSalaryStructure: (data: { employeeId: string; annualCtc: number; effectiveFrom: string; revisionReason?: string }) =>
    fetchJson<any>('/payroll/salary-structures', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSalaryHistory: (employeeId: string) =>
    fetchJson<any[]>(`/payroll/salary-structures/${employeeId}`),
  calculateBatch: (year: number, month: number) =>
    fetchJson<any>('/payroll/batches/calculate', {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    }),
  getBatches: () => fetchJson<any[]>('/payroll/batches'),
  getBatchById: (id: string) => fetchJson<any>(`/payroll/batches/${id}`),
  lockBatch: (id: string) =>
    fetchJson<any>(`/payroll/batches/${id}/lock`, {
      method: 'PATCH',
    }),
  disburseBatch: (id: string, paymentReference: string, notes?: string) =>
    fetchJson<any>(`/payroll/batches/${id}/disburse`, {
      method: 'POST',
      body: JSON.stringify({ paymentReference, notes }),
    }),
  downloadBankAdviceCsv: async (batchId: string) => {
    const res = await fetch(`${BASE_URL}/payroll/batches/${batchId}/bank-advice?format=csv`, {
      credentials: 'include',
    });
    return res.text();
  },
  getPayslipViewHtmlUrl: (payslipId: string) => `${BASE_URL}/payroll/payslips/${payslipId}/view`,

  // 8. Module 7: Employee Self-Service (ESS)
  getEssDashboard: () => fetchJson<any>('/ess/dashboard'),
  getEssProfile: () => fetchJson<any>('/ess/profile'),
  updateEssProfile: (data: any) =>
    fetchJson<any>('/ess/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getEssAttendance: (year?: number, month?: number) => {
    const query = year && month ? `?year=${year}&month=${month}` : '';
    return fetchJson<any>(`/ess/attendance${query}`);
  },
  getEssLeaves: () => fetchJson<any>('/ess/leaves'),
  getEssPayslips: () => fetchJson<any[]>('/ess/payslips'),
  getEssManagerPending: () => fetchJson<any[]>('/ess/manager/pending-actions'),

  // 9. Module 8: Employee Onboarding
  getOnboardingCandidates: (status?: string, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<any[]>(`/onboarding/candidates${query}`);
  },
  getOnboardingCandidateById: (id: string) => fetchJson<any>(`/onboarding/candidates/${id}`),
  inviteCandidate: (data: any) =>
    fetchJson<any>('/onboarding/candidates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitPreBoardingForm: (id: string, data: any) =>
    fetchJson<any>(`/onboarding/candidates/${id}/form`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateOnboardingTask: (taskId: string, data: { status: string; notes?: string }) =>
    fetchJson<any>(`/onboarding/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  convertCandidateToEmployee: (id: string, data?: { initialPassword?: string; notes?: string }) =>
    fetchJson<any>(`/onboarding/candidates/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  // 10. Module 9: Offboarding & Exit Management
  applyResignation: (data: any) =>
    fetchJson<any>('/offboarding/resignation', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getExitRequests: (status?: string, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<any>(`/offboarding/requests${query}`);
  },
  getExitRequestById: (id: string) => fetchJson<any>(`/offboarding/requests/${id}`),
  actionResignation: (id: string, data: { decision: string; approvedLastWorkingDay?: string; comments?: string }) =>
    fetchJson<any>(`/offboarding/requests/${id}/action`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateClearanceTask: (taskId: string, data: { status: string; remarks?: string }) =>
    fetchJson<any>(`/offboarding/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  submitExitInterview: (id: string, data: any) =>
    fetchJson<any>(`/offboarding/requests/${id}/interview`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  calculateFnFSettlement: (id: string, data?: any) =>
    fetchJson<any>(`/offboarding/requests/${id}/fnf/calculate`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  approveFnFSettlement: (id: string) =>
    fetchJson<any>(`/offboarding/requests/${id}/fnf/approve`, {
      method: 'PATCH',
    }),
  finalizeExit: (id: string) =>
    fetchJson<any>(`/offboarding/requests/${id}/finalize`, {
      method: 'POST',
    }),

  // 11. Module 10: Reports & Dashboards Engine
  getReportsOverview: () => fetchJson<any>('/reports/overview'),
  getWorkforceReports: () => fetchJson<any>('/reports/workforce'),
  getAttendanceReports: (params?: { year?: number; month?: number; departmentId?: string }) => {
    const q = new URLSearchParams();
    if (params?.year) q.append('year', String(params.year));
    if (params?.month) q.append('month', String(params.month));
    if (params?.departmentId) q.append('departmentId', params.departmentId);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<any>(`/reports/attendance${queryStr}`);
  },
  getLeaveReports: (params?: { year?: number; departmentId?: string }) => {
    const q = new URLSearchParams();
    if (params?.year) q.append('year', String(params.year));
    if (params?.departmentId) q.append('departmentId', params.departmentId);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<any>(`/reports/leaves${queryStr}`);
  },
  getPayrollReports: (params?: { year?: number }) => {
    const q = new URLSearchParams();
    if (params?.year) q.append('year', String(params.year));
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<any>(`/reports/payroll${queryStr}`);
  },
  getLifecycleReports: () => fetchJson<any>('/reports/lifecycle'),
  downloadReportCsv: async (reportType: string, params?: any) => {
    const q = new URLSearchParams();
    if (params?.year) q.append('year', String(params.year));
    if (params?.month) q.append('month', String(params.month));
    if (params?.departmentId) q.append('departmentId', params.departmentId);
    const queryStr = q.toString() ? `?${q.toString()}` : '';

    const res = await fetch(`/api/v1/reports/export/${reportType}${queryStr}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to download report' }));
      throw new Error(err.message || 'Failed to download report');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planetu_${reportType}_report.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // 12. Module 11: Notification Engine & Announcements
  getNotifications: (params?: { isRead?: boolean; type?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.isRead !== undefined) q.append('isRead', String(params.isRead));
    if (params?.type) q.append('type', params.type);
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.offset) q.append('offset', String(params.offset));
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ data: any[]; total: number; unreadCount: number }>(`/notifications${queryStr}`);
  },

  getUnreadNotificationCount: () =>
    fetchJson<{ unreadCount: number }>('/notifications/unread-count'),

  markNotificationRead: (id: string) =>
    fetchJson<any>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () =>
    fetchJson<{ success: boolean; updatedCount: number }>('/notifications/mark-all-read', {
      method: 'PATCH',
    }),

  getAnnouncements: (params?: { isActive?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.isActive !== undefined) q.append('isActive', String(params.isActive));
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<any[]>(`/notifications/announcements${queryStr}`);
  },

  createAnnouncement: (data: {
    title: string;
    content: string;
    priority?: string;
    targetDepartmentId?: string;
    expiresAt?: string;
    fanOutNotifications?: boolean;
  }) =>
    fetchJson<any>('/notifications/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deactivateAnnouncement: (id: string) =>
    fetchJson<any>(`/notifications/announcements/${id}/deactivate`, {
      method: 'PATCH',
    }),
};

