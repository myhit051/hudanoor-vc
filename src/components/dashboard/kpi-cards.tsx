"use client";

import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Receipt, BarChart2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DashboardSummary } from "@/types";

interface KpiCardsProps {
  summary: DashboardSummary;
}

interface KpiCardProps {
  label: string;
  value: string;
  subLabel?: string;
  change?: number;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  delay?: string;
}

function KpiCard({ label, value, subLabel, change, icon, colorClass, bgClass, borderClass, delay = "0ms" }: KpiCardProps) {
  const isPositive = change !== undefined ? change >= 0 : true;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${borderClass} ${bgClass} p-5 card-elevated cursor-default animate-count-up`}
      style={{ animationDelay: delay }}
    >
      {/* Icon */}
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${colorClass} bg-opacity-10 mb-3`}>
        {icon}
      </div>

      {/* Value */}
      <p className="text-2xl font-bold tracking-tight mb-0.5" style={{ fontFamily: "'Rubik', sans-serif" }}>
        {value}
      </p>

      {/* Label */}
      <p className="text-sm text-muted-foreground font-medium">{label}</p>

      {/* Change badge */}
      {change !== undefined && (
        <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
          isPositive
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        }`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? "+" : ""}{change.toFixed(1)}%
        </div>
      )}

      {subLabel && !change && (
        <p className="mt-1.5 text-xs text-muted-foreground">{subLabel}</p>
      )}

      {/* Decorative background circle */}
      <div
        className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 ${colorClass}`}
        style={{ background: "currentColor" }}
      />
    </div>
  );
}

export function KpiCards({ summary }: KpiCardsProps) {
  const profitMargin = summary.totalIncome > 0
    ? ((summary.profit / summary.totalIncome) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Income */}
      <KpiCard
        label="รายรับรวม"
        value={formatCurrency(summary.totalIncome)}
        change={summary.periodComparison?.incomeChange}
        icon={<TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />}
        colorClass="text-green-600"
        bgClass="bg-white dark:bg-gray-900"
        borderClass="border-green-100 dark:border-green-900/40"
        delay="0ms"
      />

      {/* Total Expense */}
      <KpiCard
        label="รายจ่ายรวม"
        value={formatCurrency(summary.totalExpense)}
        change={summary.periodComparison?.expenseChange}
        icon={<Receipt className="h-5 w-5 text-red-500 dark:text-red-400" />}
        colorClass="text-red-500"
        bgClass="bg-white dark:bg-gray-900"
        borderClass="border-red-100 dark:border-red-900/40"
        delay="80ms"
      />

      {/* Net Profit */}
      <KpiCard
        label="กำไรสุทธิ"
        value={formatCurrency(summary.profit)}
        subLabel={`Margin ${profitMargin}%`}
        change={summary.periodComparison?.profitChange}
        icon={<DollarSign className="h-5 w-5 text-amber-500 dark:text-amber-400" />}
        colorClass="text-amber-500"
        bgClass="bg-white dark:bg-gray-900"
        borderClass="border-amber-100 dark:border-amber-900/40"
        delay="160ms"
      />

      {/* Total Items */}
      <KpiCard
        label="จำนวนสินค้า"
        value={summary.totalQuantity.toLocaleString("th-TH")}
        subLabel="ชิ้น"
        icon={<ShoppingBag className="h-5 w-5 text-rose-500 dark:text-rose-400" />}
        colorClass="text-rose-500"
        bgClass="bg-white dark:bg-gray-900"
        borderClass="border-rose-100 dark:border-rose-900/40"
        delay="240ms"
      />
    </div>
  );
}
