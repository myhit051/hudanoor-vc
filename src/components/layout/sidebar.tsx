"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Plus,
  CheckSquare,
  Menu,
  Users,
  FileText,
  Settings,
  PackagePlus,
  ShoppingCart,
  Package,
  LogOut,
  ShieldAlert,
  History
} from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onAddRecord: () => void;
}

const menuGroups = [
  {
    label: "ภาพรวม",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "จัดการ",
    items: [
      { id: "add-record",       label: "บันทึกรายการใหม่", icon: Plus },
      { id: "stock-receiving",  label: "รับสินค้าเข้าสต๊อก", icon: PackagePlus },
      { id: "sales-entry",      label: "บันทึกยอดขาย",    icon: ShoppingCart },
      { id: "order-history",    label: "ประวัติการขาย",   icon: History },
      { id: "stock-inventory",  label: "สต๊อกคงเหลือ",    icon: Package },
      { id: "task-reminder",    label: "Task Reminder",    icon: CheckSquare },
      { id: "employees",        label: "จัดการพนักงาน",   icon: Users },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { id: "update-logs", label: "Update Logs", icon: FileText },
      { id: "settings",    label: "การตั้งค่า",  icon: Settings },
    ],
  },
];

export function Sidebar({ currentPage, onPageChange, onAddRecord }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();

  const handleMenuClick = (itemId: string) => {
    if (itemId === "add-record") {
      onAddRecord();
    } else {
      onPageChange(itemId);
    }
    setIsOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {/* SVG Brand mark */}
          <div className="w-9 h-9 flex-shrink-0">
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <rect width="36" height="36" rx="10" fill="url(#brandGrad)" />
              <text
                x="18" y="24"
                textAnchor="middle"
                fontSize="18"
                fontWeight="700"
                fontFamily="Rubik, sans-serif"
                fill="white"
                letterSpacing="-1"
              >H</text>
              <defs>
                <linearGradient id="brandGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f43f5e" />
                  <stop offset="1" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div>
            <h2
              className="font-bold text-lg leading-tight bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent"
              style={{ fontFamily: "'Rubik', sans-serif" }}
            >
              HUDANOOR
            </h2>
            <p className="text-xs text-muted-foreground leading-tight">เสื้อผ้าแฟชั่นมุสลิม</p>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {menuGroups.map((group) => {
          // Filter items based on allowedMenus
          const filteredItems = group.items.filter(item => 
            isAdmin || user?.allowedMenus?.includes(item.id)
          );

          // Add Admin Panel item for admin
          if (group.label === "ระบบ" && isAdmin) {
            filteredItems.push({ id: "admin-panel", label: "Admin Panel", icon: ShieldAlert });
          }

          if (filteredItems.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuClick(item.id)}
                    className={cn(
                      "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                      isActive
                        ? "sidebar-item-active text-white"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-white" : "")} />
                    <span>{item.label}</span>
                  </button>
                );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
        {user && (
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex justify-center">
          <ConnectionStatus />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:bg-white lg:dark:bg-gray-900 lg:border-r lg:border-gray-100 lg:dark:border-gray-800 shadow-sm">
        <SidebarContent />
      </div>

      {/* Mobile Hamburger + Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            id="mobile-menu-button"
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

