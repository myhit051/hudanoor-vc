"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";

import Index from "@/pages/Index";
import { TaskReminder } from "@/pages/TaskReminder";
import { EmployeeManagement } from "@/pages/EmployeeManagement";
import { UpdateLogs } from "@/pages/UpdateLogs";
import { AppSettings } from "@/pages/AppSettings";
import { StockReceiving } from "@/pages/StockReceiving";
import { AddRecordForm } from "@/components/forms/add-record-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSheetsData } from "@/hooks/use-sheets-data";
import { toast } from "@/hooks/use-toast";

export function MainLayout() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  
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

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Index />;
      case 'stock-receiving':
        return <StockReceiving />;
      case 'task-reminder':
        return <TaskReminder />;
      case 'employees':
        return <EmployeeManagement />;
      case 'update-logs':
        return <UpdateLogs />;
      case 'settings':
        return <AppSettings />;
      default:
        return <Index />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Sidebar 
        currentPage={currentPage}
        onPageChange={setCurrentPage}
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