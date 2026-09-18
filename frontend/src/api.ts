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
  getDesignations: () => fetchJson<any[]>('/masters/designations'),
  getGrades: () => fetchJson<any[]>('/masters/grades'),
  getLocations: () => fetchJson<any[]>('/masters/locations'),

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
  actionLeave: (id: string, action: 'APPROVE' | 'REJECT', rejectionReason?: string) =>
    fetchJson<any>(`/leaves/${id}/action`, {
      method: 'PATCH',
      body: JSON.stringify({ action, rejectionReason }),
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
};
