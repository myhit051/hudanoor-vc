export interface AuthUser {
  userId: string;
  employeeId: string;
  name: string;
  role: 'admin' | 'employee';
  allowedMenus: string[];
}

export interface LoginCredentials {
  employee_id: string;
  pin: string;
}

export interface UserManagement {
  id: string;
  employee_id: string;
  name: string;
  role: 'admin' | 'employee';
  allowed_menus: string[];
  is_active: number;
  created_at: string;
  updated_at: string;
}
