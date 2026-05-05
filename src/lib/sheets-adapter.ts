import { Income, Expense } from '@/types';

// Dashboard data now sourced from Turso DB (sales_orders + legacy_sales for income,
// expenses table for expense). Sheet-only adapter is no longer used.
import * as DashboardAPI from './vercel-dashboard';

export const getIncomeData = async (): Promise<Income[]> => {
  try {
    return await DashboardAPI.getIncomeData();
  } catch (error) {
    console.error('Error in getIncomeData:', error);
    return [];
  }
};

export const getExpenseData = async (): Promise<Expense[]> => {
  try {
    return await DashboardAPI.getExpenseData();
  } catch (error) {
    console.error('Error in getExpenseData:', error);
    return [];
  }
};

export const addIncomeRecord = async (
  income: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  return DashboardAPI.addIncomeRecord(income);
};

export const addExpenseRecord = async (
  expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  return DashboardAPI.addExpenseRecord(expense);
};

export const initializeSheets = async (): Promise<void> => {
  return DashboardAPI.initializeSheets();
};

export const getConfigurationStatus = () => ({
  currentMode: 'turso',
  ...DashboardAPI.getConfigurationStatus(),
  isConfigured: true,
});