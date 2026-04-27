"use client";

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { useAuth } from "@/hooks/use-auth";
import AdminPanel from "@/pages/AdminPanel";

import Index from "@/pages/Index";
import { TaskReminder } from "@/pages/TaskReminder";
import { EmployeeManagement } from "@/pages/EmployeeManagement";
import { UpdateLogs } from "@/pages/UpdateLogs";
import { AppSettings } from "@/pages/AppSettings";
import { StockReceiving } from "@/pages/StockReceiving";
import { SalesEntry } from "@/pages/SalesEntry";
import { StockInventory } from "@/pages/StockInventory";
import { AddRecordForm } from "@/components/forms/add-record-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSheetsData } from "@/hooks/use-sheets-data";

const pathToPage: Record<string, string> = {
  '/': 'dashboard',
  '/stock-receiving': 'stock-receiving',
  '/sales-entry': 'sales-entry',
  '/stock-inventory': 'stock-inventory',
  '/task-reminder': 'task-reminder',
  '/employees': 'employees',
  '/update-logs': 'update-logs',
  '/settings': 'settings',
  '/admin': 'admin-panel',
};

const pageToPath: Record<string, string> = Object.fromEntries(
  Object.entries(pathToPage).map(([path, page]) => [page, path])
);

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth();

  const currentPage = pathToPage[location.pathname] ?? 'dashboard';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    } else if (!isLoading && isAuthenticated && !isAdmin && currentPage !== 'dashboard') {
      if (!user?.allowedMenus?.includes(currentPage) && currentPage !== 'add-record') {
        navigate('/');
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, user, currentPage, navigate]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) return null;

  const {
    addIncome,
    addExpense,
    isAddingIncome,
    isAddingExpense
  } = useSheetsData();

  const handleAddRecord = async (record: any) => {
    try {
      if ('product_name' in record) {
        await addIncome(record);
      } else {
        await addExpense(record);
      }
      setIsAddFormOpen(false);
    } catch (error) {
      console.error('Error adding record:', error);
    }
  };

  const handlePageChange = (page: string) => {
    navigate(pageToPath[page] ?? '/');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Index />;
      case 'stock-receiving':
        return <StockReceiving />;
      case 'sales-entry':
        return <SalesEntry />;
      case 'stock-inventory':
        return <StockInventory />;
      case 'task-reminder':
        return <TaskReminder />;
      case 'employees':
        return <EmployeeManagement />;
      case 'update-logs':
        return <UpdateLogs />;
      case 'settings':
        return <AppSettings />;
      case 'admin-panel':
        return isAdmin ? <AdminPanel /> : <Index />;
      default:
        return <Index />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onAddRecord={() => setIsAddFormOpen(true)}
      />
      
      {/* Main Content */}
      <div className="lg:pl-64">
        <div className="container mx-auto px-4 py-6">
          {/* Page Content */}
          {renderCurrentPage()}
        </div>
      </div>

      {/* Add Record Dialog */}
      <Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>เพิ่มรายการใหม่</DialogTitle>
          </DialogHeader>
          <AddRecordForm 
            onSubmit={handleAddRecord} 
            isSubmitting={isAddingIncome || isAddingExpense}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}