
"use client";

import { useState, useMemo, useEffect } from "react";

import { TrendChart } from "@/components/dashboard/trend-chart";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { ChannelChart } from "@/components/dashboard/channel-chart";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { TopCategoriesTable } from "@/components/dashboard/top-categories-table";
import { SalesTarget } from "@/components/dashboard/sales-target";
import { MonthlyBreakdownChart } from "@/components/dashboard/monthly-breakdown-chart";
import { AddRecordForm } from "@/components/forms/add-record-form";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSheetsData } from "@/hooks/use-sheets-data";
import { useSettings } from "@/hooks/use-settings";
import { Income, Expense, DashboardSummary, ChartData, CategoryData, ChannelData, FilterOptions, TopCategoryData } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Plus, Search, TrendingUp, BarChart3, PieChart, Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Index = () => {
  const {
    incomeData,
    expenseData,
    isLoading,
    hasError,
    addIncome,
    addExpense,
    isAddingIncome,
    isAddingExpense,
    refetchAll
  } = useSheetsData();

  const { settings } = useSettings();

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({});
  const [salesTarget, setSalesTarget] = useState<number>(settings.monthlyTarget || 200000);

  // Update sales target when settings change
  useEffect(() => {
    if (settings.monthlyTarget) {
      setSalesTarget(settings.monthlyTarget);
    }
  }, [settings.monthlyTarget]);

  // Filter data based on active filters
  const filteredIncomeData = useMemo(() => {
    return incomeData.filter(item => {
      // Date filtering - compare dates properly
      if (filters.dateFrom) {
        const itemDate = new Date(item.date);
        const filterFromDate = new Date(filters.dateFrom);
        if (itemDate < filterFromDate) return false;
      }
      if (filters.dateTo) {
        const itemDate = new Date(item.date);
        const filterToDate = new Date(filters.dateTo);
        // Include the entire day by setting time to end of day
        filterToDate.setHours(23, 59, 59, 999);
        if (itemDate > filterToDate) return false;
      }
      if (filters.channels?.length && !filters.channels.includes(item.channel)) return false;
      if (filters.branches?.length && !filters.branches.includes(item.branch_or_platform)) return false;
      if (filters.productCategories?.length && !filters.productCategories.includes(item.product_category)) return false;
      if (filters.q && !item.product_name.toLowerCase().includes(filters.q.toLowerCase()) && 
          !item.note?.toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }, [incomeData, filters]);

  const filteredExpenseData = useMemo(() => {
    return expenseData.filter(item => {
      // Date filtering - compare dates properly
      if (filters.dateFrom) {
        const itemDate = new Date(item.date);
        const filterFromDate = new Date(filters.dateFrom);
        if (itemDate < filterFromDate) return false;
      }
      if (filters.dateTo) {
        const itemDate = new Date(item.date);
        const filterToDate = new Date(filters.dateTo);
        // Include the entire day by setting time to end of day
        filterToDate.setHours(23, 59, 59, 999);
        if (itemDate > filterToDate) return false;
      }
      if (filters.channels?.length && !filters.channels.includes(item.channel)) return false;
      if (filters.branches?.length && !filters.branches.includes(item.branch_or_platform)) return false;
      if (filters.expenseCategories?.length && !filters.expenseCategories.includes(item.expense_category)) return false;
      if (filters.q && !item.expense_item.toLowerCase().includes(filters.q.toLowerCase()) && 
          !item.note?.toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }, [expenseData, filters]);

  // Calculate dashboard summary
  const summary: DashboardSummary = useMemo(() => {
    const totalIncome = filteredIncomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = filteredExpenseData.reduce((sum, item) => sum + item.cost, 0);
    const totalQuantity = filteredIncomeData.reduce((sum, item) => sum + item.quantity, 0);

    // Debug logging
    console.log('Dashboard Summary Debug:', {
      totalIncomeRecords: incomeData.length,
      filteredIncomeRecords: filteredIncomeData.length,
      totalIncome,
      filters,
      sampleFilteredData: filteredIncomeData.slice(0, 3)
    });

    return {
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
      totalQuantity,
      salesTarget,
      targetProgress: salesTarget ? (totalIncome / salesTarget) * 100 : 0,
      periodComparison: {
        incomeChange: 12.5,
        expenseChange: -8.2,
        profitChange: 15.8
      }
    };
  }, [filteredIncomeData, filteredExpenseData, salesTarget, incomeData, filters]);

  // Generate available filter options
  const availableBranches = useMemo(() => {
    const branches = new Set([
      ...incomeData.map(item => item.branch_or_platform),
      ...expenseData.map(item => item.branch_or_platform)
    ].filter(branch => branch && branch.trim() !== ''));
    return Array.from(branches).sort();
  }, [incomeData, expenseData]);

  const availableProductCategories = useMemo(() => {
    const categories = new Set(incomeData.map(item => item.product_category).filter(category => category && category.trim() !== ''));
    return Array.from(categories).sort();
  }, [incomeData]);

  const availableExpenseCategories = useMemo(() => {
    const categories = new Set(expenseData.map(item => item.expense_category).filter(category => category && category.trim() !== ''));
    return Array.from(categories).sort();
  }, [expenseData]);

  // Generate chart data
  const chartData: ChartData[] = useMemo(() => {
    const dateMap = new Map<string, { income: number; expense: number }>();

    // Group income by date
    filteredIncomeData.forEach(item => {
      const date = item.date.split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { income: 0, expense: 0 });
      }
      const current = dateMap.get(date)!;
      dateMap.set(date, { ...current, income: current.income + item.amount });
    });

    // Group expense by date
    filteredExpenseData.forEach(item => {
      const date = item.date.split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { income: 0, expense: 0 });
      }
      const current = dateMap.get(date)!;
      dateMap.set(date, { ...current, expense: current.expense + item.cost });
    });

    // Convert to array and calculate profit
    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        income: data.income,
        expense: data.expense,
        profit: data.income - data.expense
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredIncomeData, filteredExpenseData]);

  // Generate category data for income
  const incomeCategoryData: CategoryData[] = useMemo(() => {
    const categoryMap = new Map<string, number>();
    const total = filteredIncomeData.reduce((sum, item) => sum + item.amount, 0);

    filteredIncomeData.forEach(item => {
      const current = categoryMap.get(item.product_category) || 0;
      categoryMap.set(item.product_category, current + item.amount);
    });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    }));
  }, [filteredIncomeData]);

  // Generate category data for expense
  const expenseCategoryData: CategoryData[] = useMemo(() => {
    const categoryMap = new Map<string, number>();
    const total = filteredExpenseData.reduce((sum, item) => sum + item.cost, 0);

    filteredExpenseData.forEach(item => {
      const current = categoryMap.get(item.expense_category) || 0;
      categoryMap.set(item.expense_category, current + item.cost);
    });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    }));
  }, [filteredExpenseData]);

  // Generate top categories data
  const topIncomeCategories: TopCategoryData[] = useMemo(() => {
    const categoryMap = new Map<string, { total: number; count: number }>();
    const total = filteredIncomeData.reduce((sum, item) => sum + item.amount, 0);

    filteredIncomeData.forEach(item => {
      const current = categoryMap.get(item.product_category) || { total: 0, count: 0 };
      categoryMap.set(item.product_category, {
        total: current.total + item.amount,
        count: current.count + 1
      });
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: total > 0 ? (data.total / total) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredIncomeData]);

  const topExpenseCategories: TopCategoryData[] = useMemo(() => {
    const categoryMap = new Map<string, { total: number; count: number }>();
    const total = filteredExpenseData.reduce((sum, item) => sum + item.cost, 0);

    filteredExpenseData.forEach(item => {
      const current = categoryMap.get(item.expense_category) || { total: 0, count: 0 };
      categoryMap.set(item.expense_category, {
        total: current.total + item.cost,
        count: current.count + 1
      });
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: total > 0 ? (data.total / total) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenseData]);

  // Generate channel data
  const channelData: ChannelData[] = useMemo(() => {
    const channels = ['store', 'online'];
    return channels.map(channel => {
      const channelIncome = filteredIncomeData
        .filter(item => item.channel === channel)
        .reduce((sum, item) => sum + item.amount, 0);
      const channelExpense = filteredExpenseData
        .filter(item => item.channel === channel)
        .reduce((sum, item) => sum + item.cost, 0);
      const channelQuantity = filteredIncomeData
        .filter(item => item.channel === channel)
        .reduce((sum, item) => sum + item.quantity, 0);

      return {
        channel,
        income: channelIncome,
        expense: channelExpense,
        quantity: channelQuantity
      };
    });
  }, [filteredIncomeData, filteredExpenseData]);

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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลดข้อมูลจาก Google Sheets...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              ไม่สามารถเชื่อมต่อกับ Google Sheets ได้ กรุณาตรวจสอบการตั้งค่า API Key และ Sheets ID
            </AlertDescription>
          </Alert>
          <Button 
            onClick={refetchAll} 
            className="w-full mt-4"
            variant="outline"
          >
            ลองใหม่อีกครั้ง
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                ร้าน HUDANOOR
              </h1>
              <p className="text-muted-foreground">ระบบบันทึกรายรับ-รายจ่าย | เสื้อผ้าแฟชั่นมุสลิม</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={refetchAll}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                รีเฟรช
              </Button>
              
              <ThemeToggle />
              
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="ค้นหารายการ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="hidden md:flex bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                    disabled={isAddingIncome || isAddingExpense}
                  >
                    {(isAddingIncome || isAddingExpense) ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    เพิ่มรายการ
                  </Button>
                </DialogTrigger>
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <DashboardFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableBranches={availableBranches}
          availableProductCategories={availableProductCategories}
          availableExpenseCategories={availableExpenseCategories}
          branchesByChannel={settings.branchesByChannel}
        />



        {/* Monthly Breakdown Chart */}
        <div className="mb-6">
          <MonthlyBreakdownChart 
            incomeData={incomeData}
            expenseData={expenseData}
            filters={filters}
          />
        </div>

        {/* Data Filter Warning */}
        {(filters.dateFrom || filters.dateTo || filters.channels?.length || filters.branches?.length || filters.productCategories?.length || filters.expenseCategories?.length || filters.q) && (
          <div className="mb-6">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-medium">ข้อมูลที่แสดงถูกกรองแล้ว</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    ยอดขายรวมและสถิติต่างๆ แสดงเฉพาะข้อมูลที่ตรงกับตัวกรองที่เลือก หากต้องการดูข้อมูลทั้งหมด กรุณาล้างตัวกรอง
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales Target */}
        <div className="mb-6">
          <SalesTarget 
            summary={summary} 
            onTargetUpdate={setSalesTarget}
            filters={filters}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TrendChart data={chartData} />
          <ChannelChart data={channelData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <CategoryChart 
            data={incomeCategoryData} 
            title="สัดส่วนรายรับตามหมวดหมู่" 
            type="income" 
          />
          <CategoryChart 
            data={expenseCategoryData} 
            title="สัดส่วนรายจ่ายตามหมวดหมู่" 
            type="expense" 
          />
        </div>

        {/* Top Categories Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TopCategoriesTable 
            data={topIncomeCategories}
            title="Top 5 หมวดหมู่สินค้า"
            type="income"
          />
          <TopCategoriesTable 
            data={topExpenseCategories}
            title="Top 5 หมวดหมู่รายจ่าย"
            type="expense"
          />
        </div>

        {/* Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-income" />
              รายรับล่าสุด
            </h3>
            <div className="space-y-3">
              {filteredIncomeData.slice(-5).reverse().map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">{item.branch_or_platform}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-income">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} ชิ้น</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-expense" />
              รายจ่ายล่าสุด
            </h3>
            <div className="space-y-3">
              {filteredExpenseData.slice(-5).reverse().map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div>
                    <p className="font-medium">{item.expense_item}</p>
                    <p className="text-sm text-muted-foreground">{item.branch_or_platform}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-expense">{formatCurrency(item.cost)}</p>
                    <p className="text-xs text-muted-foreground">{item.expense_category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile FAB */}
      <Sheet open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
        <SheetTrigger asChild>
          <FloatingActionButton onClick={() => setIsAddFormOpen(true)} />
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[90vh]">
          <SheetHeader>
            <SheetTitle>เพิ่มรายการใหม่</SheetTitle>
          </SheetHeader>
          <div className="mt-6 overflow-y-auto h-full pb-6">
            <AddRecordForm
              onSubmit={handleAddRecord}
              isSubmitting={isAddingIncome || isAddingExpense}
              onClose={() => setIsAddFormOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Index;
