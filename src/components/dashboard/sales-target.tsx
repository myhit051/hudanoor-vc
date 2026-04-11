
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DashboardSummary } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Target, Edit3, TrendingUp, Award, AlertTriangle, PartyPopper } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface SalesTargetProps {
  summary: DashboardSummary;
  onTargetUpdate: (target: number) => void;
  filters: any; // FilterOptions type
}

export function SalesTarget({ summary, onTargetUpdate, filters }: SalesTargetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetInput, setTargetInput] = useState(summary.salesTarget?.toString() || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetInput);
    if (isNaN(target) || target <= 0) {
      toast({
        title: "ข้อผิดพลาด",
        description: "กรุณาใส่เป้าหมายยอดขายที่ถูกต้อง",
        variant: "destructive"
      });
      return;
    }
    onTargetUpdate(target);
    setIsOpen(false);
    toast({
      title: "บันทึกสำเร็จ",
      description: `ตั้งเป้าหมายยอดขายเป็น ${formatCurrency(target)}`
    });
  };

  // Calculate adjusted target based on date range
  const calculateAdjustedTarget = () => {
    if (!summary.salesTarget) return 0;
    
    // If no date filters, use monthly target as is
    if (!filters.dateFrom && !filters.dateTo) {
      return summary.salesTarget;
    }
    
    // Calculate days in the filtered period
    const startDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = filters.dateTo ? new Date(filters.dateTo) : new Date();
    
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
    
    // Calculate daily average target (monthly target / 30 days)
    const dailyTarget = summary.salesTarget / 30;
    
    // Return adjusted target for the filtered period
    return dailyTarget * daysDiff;
  };

  const adjustedTarget = calculateAdjustedTarget();
  
  const progressPercentage = adjustedTarget 
    ? Math.min((summary.totalIncome / adjustedTarget) * 100, 100)
    : 0;

  const remaining = adjustedTarget ? Math.max(adjustedTarget - summary.totalIncome, 0) : 0;
  const achieved = summary.totalIncome >= adjustedTarget;

  // Data for circular progress chart
  const chartData = [
    {
      name: 'บรรลุแล้ว',
      value: summary.totalIncome,
      color: achieved ? '#10b981' : '#3b82f6'
    },
    {
      name: 'เหลือ',
      value: Math.max(remaining, 0),
      color: '#f1f5f9'
    }
  ];

  // Create gradient colors for the chart
  const COLORS = {
    achieved: achieved ? '#10b981' : '#3b82f6',
    remaining: '#f1f5f9'
  };

  return (
    <Card className="card-elevated bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            <div className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              <Target className="h-4 w-4" />
            </div>
            เป้าหมายยอดขาย
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="hover:bg-blue-100 dark:hover:bg-blue-900">
                <Edit3 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ตั้งเป้าหมายยอดขายรายเดือน</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="target">เป้าหมายยอดขายรายเดือน (บาท)</Label>
                  <Input
                    id="target"
                    type="number"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="ใส่เป้าหมายยอดขายรายเดือน"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    เป้าหมายจะถูกปรับตามช่วงเวลาที่เลือกในตัวกรอง
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    ยกเลิก
                  </Button>
                  <Button type="submit">บันทึก</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {summary.salesTarget ? (
          <div className="space-y-6">
            {/* Circular Progress Chart */}
            <div className="relative">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      startAngle={90}
                      endAngle={450}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="rgba(255,255,255,0.8)"
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          className="drop-shadow-sm"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 to-indigo-400/20 blur-xl"></div>
              
              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <div className="text-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-full p-4 shadow-lg border border-white/20">
                  {achieved ? (
                    <Award className="h-8 w-8 text-green-500 mx-auto mb-2 animate-pulse" />
                  ) : (
                    <TrendingUp className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  )}
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {progressPercentage.toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {achieved ? 'บรรลุแล้ว!' : 'ความคืบหน้า'}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-white/80 to-blue-50/80 dark:from-gray-800/80 dark:to-blue-950/80 backdrop-blur-sm rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-sm"></div>
                  <span className="text-sm text-muted-foreground font-medium">ยอดขายปัจจุบัน</span>
                </div>
                <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {formatCurrency(summary.totalIncome)}
                </div>
                {(filters.dateFrom || filters.dateTo || filters.channels?.length || filters.branches?.length || filters.productCategories?.length || filters.q) && (
                  <div className="text-xs mt-1 flex items-center gap-1" style={{color: 'hsl(var(--info-text))'}}>
                    <AlertTriangle className="h-3 w-3" />
                    <span>ข้อมูลถูกกรองแล้ว</span>
                  </div>
                )}
              </div>
              
              <div className="bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-gray-400 to-gray-500 shadow-sm"></div>
                  <span className="text-sm text-muted-foreground font-medium">
                    {filters.dateFrom || filters.dateTo ? 'เป้าหมายช่วงนี้' : 'เป้าหมายรายเดือน'}
                  </span>
                </div>
                <div className="text-xl font-bold text-gray-700 dark:text-gray-300">
                  {formatCurrency(adjustedTarget)}
                </div>
                {(filters.dateFrom || filters.dateTo) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    เป้าหมายรายเดือน: {formatCurrency(summary.salesTarget)}
                  </div>
                )}
              </div>
            </div>

            {/* Status Message */}
            <div className="text-center">
              {achieved ? (
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full inline-flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 animate-pulse">
                  <Award className="h-5 w-5" />
                  <span className="font-semibold">บรรลุเป้าหมายแล้ว!</span>
                  <PartyPopper className="h-4 w-4" />
                </div>
              ) : (
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-full inline-flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-semibold">
                    เหลืออีก {formatCurrency(remaining)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="relative mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-xl">
                <Target className="h-10 w-10 text-white" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/30 to-indigo-400/30 rounded-full blur-xl"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              ตั้งเป้าหมายยอดขายรายเดือน
            </h3>
            <p className="text-muted-foreground mb-6">
              กำหนดเป้าหมายรายเดือนเพื่อติดตามความคืบหน้าการขาย<br/>
              เป้าหมายจะถูกปรับตามช่วงเวลาที่เลือกในตัวกรอง
            </p>
            <Button 
              onClick={() => setIsOpen(true)} 
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-3"
              size="lg"
            >
              <Target className="h-5 w-5 mr-2" />
              ตั้งเป้าหมาย
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
