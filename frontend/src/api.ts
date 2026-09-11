// Lightweight API Client for PlanetU HRMS Minimal Viewing Layer
// Uses credentials: 'include' so the browser automatically sends and receives httpOnly cookies

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
  // Auth
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

  // Masters
  getDepartments: () => fetchJson<any[]>('/masters/departments'),
  getDesignations: () => fetchJson<any[]>('/masters/designations'),

  // Employees
  getEmployees: () =>
    fetchJson<{ data: any[]; pagination: any }>('/employees?limit=50'),

  getEmployeeById: (id: string) => fetchJson<any>(`/employees/${id}`),

  createEmployee: (data: any) =>
    fetchJson<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
