import { AuthUser, LoginCredentials, UserManagement } from '../types/auth';

const API_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000' : '')
  : '';
function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

export async function login(credentials: LoginCredentials): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function verifyToken(): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/auth`, {
    method: 'GET',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verify failed');
  return data;
}

export async function getUsers(): Promise<UserManagement[]> {
  const res = await fetch(`${API_URL}/api/users`, {
    method: 'GET',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
  return data.data;
}

export async function createUser(user: Partial<UserManagement> & { pin: string }): Promise<void> {
  const res = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(user)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create user');
}

export async function updateUser(user: Partial<UserManagement> & { pin?: string }): Promise<void> {
  const res = await fetch(`${API_URL}/api/users`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(user)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update user');
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/users?id=${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete user');
}
