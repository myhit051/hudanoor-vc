import { Employee } from '@/types/employee';
import { authHeaders } from '@/lib/auth-api';

const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

function normalizeEmployee(raw: any): Employee {
  return {
    id: raw.id,
    name: raw.name || '',
    position: raw.position || '',
    salary: Number(raw.salary) || 0,
    homeBranch: raw.homeBranch || '',
    secondaryBranches: Array.isArray(raw.secondaryBranches) ? raw.secondaryBranches : [],
    branchCommissions: Array.isArray(raw.branchCommissions) ? raw.branchCommissions : [],
    startDate: raw.startDate || '',
    isActive: !!raw.isActive,
    phone: raw.phone || '',
    email: raw.email || '',
    address: raw.address || '',
    note: raw.note || '',
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
  };
}

export const getEmployeesData = async (): Promise<Employee[]> => {
  const response = await fetch(`${API_BASE}/employees`, { headers: { ...authHeaders() } });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  return list.map(normalizeEmployee);
};

export const addEmployeeRecord = async (
  employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  const response = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ employee }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
};

export const updateEmployeeRecord = async (
  employeeId: string,
  updates: Partial<Employee>
): Promise<void> => {
  const response = await fetch(`${API_BASE}/employees`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ employeeId, updates }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
};

export const deleteEmployeeRecord = async (employeeId: string): Promise<void> => {
  const response = await fetch(
    `${API_BASE}/employees?employeeId=${encodeURIComponent(employeeId)}`,
    { method: 'DELETE', headers: { ...authHeaders() } }
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
};

export const testConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
};
