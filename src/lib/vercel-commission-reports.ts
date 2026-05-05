import { EmployeeCommissionReport } from '@/types/employee';

// API base URL - automatically detects environment
const API_BASE = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

export interface CommissionReportsResponse {
  success: boolean;
  data: EmployeeCommissionReport[];
  period: string;
  totalEmployees: number;
  totalCommissions: number;
}

// Get commission reports for a specific period
export const getCommissionReports = async (period?: string): Promise<CommissionReportsResponse> => {
  try {
    const url = period
      ? `${API_BASE}/payroll?action=report&period=${period}`
      : `${API_BASE}/payroll?action=report`;
      
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching commission reports:', error);
    throw error;
  }
};

// Get commission report for current month
export const getCurrentMonthCommissionReports = async (): Promise<CommissionReportsResponse> => {
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format
  return getCommissionReports(currentMonth);
};

// Get commission report for specific employee and period
export const getEmployeeCommissionReport = async (
  employeeId: string, 
  period?: string
): Promise<EmployeeCommissionReport | null> => {
  try {
    const reports = await getCommissionReports(period);
    return reports.data.find(report => report.employeeId === employeeId) || null;
  } catch (error) {
    console.error('Error fetching employee commission report:', error);
    throw error;
  }
};

// Calculate total commissions for all employees in a period
export const getTotalCommissions = async (period?: string): Promise<number> => {
  try {
    const reports = await getCommissionReports(period);
    return reports.totalCommissions;
  } catch (error) {
    console.error('Error calculating total commissions:', error);
    throw error;
  }
};

// Get commission summary by channel (store vs online)
export const getCommissionSummaryByChannel = async (period?: string) => {
  try {
    const reports = await getCommissionReports(period);
    
    const summary = reports.data.reduce(
      (acc, report) => {
        acc.storeCommissions += report.storeCommission;
        acc.onlineCommissions += report.onlineCommission;
        acc.storeSales += report.storeSales;
        acc.onlineSales += report.onlineSales;
        return acc;
      },
      {
        storeCommissions: 0,
        onlineCommissions: 0,
        storeSales: 0,
        onlineSales: 0
      }
    );

    return {
      ...summary,
      totalCommissions: summary.storeCommissions + summary.onlineCommissions,
      totalSales: summary.storeSales + summary.onlineSales,
      period: reports.period
    };
  } catch (error) {
    console.error('Error getting commission summary by channel:', error);
    throw error;
  }
};