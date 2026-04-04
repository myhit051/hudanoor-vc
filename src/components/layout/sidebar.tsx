"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/ui/connection-status";
import {
  LayoutDashboard,
  Plus,
  CheckSquare,
  Menu,
  X,
  Users,
  FileText,
  Settings,
  PackagePlus
} from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onAddRecord: () => void;
}

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'add-record',
    label: 'บันทึกรายการใหม่',
    icon: Plus,
  },
  {
    id: 'stock-receiving',
    label: 'รับสินค้าเข้าสต๊อก',
    icon: PackagePlus,
  },
  {
    id: 'task-reminder',
    label: 'Task Reminder',
    icon: CheckSquare,
  },
  {
    id: 'employees',
    label: 'จัดการพนักงาน',
    icon: Users,
  },
  {
    id: 'update-logs',
    label: 'Update Logs',
    icon: FileText,
  },
  {
    id: 'settings',
    label: 'การตั้งค่า',
    icon: Settings,
  },
];

export function Sidebar({ currentPage, onPageChange, onAddRecord }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleMenuClick = (itemId: string) => {
    if (itemId === 'add-record') {
      onAddRecord();
    } else {
      onPageChange(itemId);
    }
    setIsOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-rose-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <div>
            <h2 className="font-bold text-lg bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
              HUDANOOR
            </h2>
            <p className="text-xs text-muted-foreground">ระบบบันทึกรายรับ-รายจ่าย</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-12",
                  isActive 
                    ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={() => handleMenuClick(item.id)}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-muted-foreground text-center mb-2">
          เสื้อผ้าแฟชั่นมุสลิม
        </div>
        {/* Connection Status in Sidebar */}
        <div className="flex justify-center">
          <ConnectionStatus />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:bg-white lg:dark:bg-gray-900 lg:border-r lg:border-gray-200 lg:dark:border-gray-700">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden fixed top-4 left-4 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}