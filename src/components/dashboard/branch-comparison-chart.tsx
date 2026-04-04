
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Income, Expense } from "@/types";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BranchComparisonChartProps {
  incomeData: Income[];
  expenseData: Expense[];
}

const STORE_COLORS = [
  "#e11d48", "#f97316", "#eab308", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"
];
const ONLINE_COLORS = [
  "#be185d", "#c2410c", "#a16207", "#065f46", "#1e40af", "#6d28d9", "#9d174d"
];

export function BranchComparisonChart({ incomeData, expenseData }: BranchComparisonChartProps) {
  const [metric, setMetric] = useState<"income" | "expense" | "profit">("income");
  const [channel, setChannel] = useState<"store" | "online" | "all">("all");

  const chartData = useMemo(() => {
    const branchMap = new Map<string, { income: number; expense: number; channel: string }>();

    incomeData.forEach(item => {
      if (!item.branch_or_platform) return;
      if (channel !== "all" && item.channel !== channel) return;
      const current = branchMap.get(item.branch_or_platform) || { income: 0, expense: 0, channel: item.channel };
      branchMap.set(item.branch_or_platform, {
        ...current,
        income: current.income + item.amount
      });
    });

    expenseData.forEach(item => {
      if (!item.branch_or_platform) return;
      if (channel !== "all" && item.channel !== channel) return;
      const current = branchMap.get(item.branch_or_platform) || { income: 0, expense: 0, channel: item.channel };
      branchMap.set(item.branch_or_platform, {
        ...current,
        expense: current.expense + item.cost,
        channel: item.channel
      });
    });

    return Array.from(branchMap.entries())
      .map(([name, data]) => ({
        name,
        income: data.income,
        expense: data.expense,
        profit: data.income - data.expense,
        channel: data.channel
      }))
      .sort((a, b) => b[metric] - a[metric]);
  }, [incomeData, expenseData, channel, metric]);

  const metricLabel = metric === "income" ? "รายรับ" : metric === "expense" ? "รายจ่าย" : "กำไร";
  const metricColor =
    metric === "income" ? "hsl(var(--income-color))" :
    metric === "expense" ? "hsl(var(--expense-color))" :
    "#8b5cf6";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.fill }}>
            {metricLabel}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>เปรียบเทียบยอดขายตามสาขา / แพลตฟอร์ม</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Tabs value={channel} onValueChange={(v) => setChannel(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-2 h-6">ทั้งหมด</TabsTrigger>
                <TabsTrigger value="store" className="text-xs px-2 h-6">หน้าร้าน</TabsTrigger>
                <TabsTrigger value="online" className="text-xs px-2 h-6">ออนไลน์</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={metric} onValueChange={(v) => setMetric(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="income" className="text-xs px-2 h-6">รายรับ</TabsTrigger>
                <TabsTrigger value="expense" className="text-xs px-2 h-6">รายจ่าย</TabsTrigger>
                <TabsTrigger value="profit" className="text-xs px-2 h-6">กำไร</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            ไม่มีข้อมูลสำหรับช่วงเวลาที่เลือก
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 20, bottom: chartData.length > 4 ? 40 : 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                fontSize={11}
                angle={chartData.length > 4 ? -30 : 0}
                textAnchor={chartData.length > 4 ? "end" : "middle"}
                interval={0}
              />
              <YAxis
                fontSize={11}
                tickFormatter={(v) => formatCurrency(v)}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.channel === "online"
                        ? ONLINE_COLORS[index % ONLINE_COLORS.length]
                        : STORE_COLORS[index % STORE_COLORS.length]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        {chartData.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {chartData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{
                    backgroundColor:
                      entry.channel === "online"
                        ? ONLINE_COLORS[index % ONLINE_COLORS.length]
                        : STORE_COLORS[index % STORE_COLORS.length]
                  }}
                />
                <span>{entry.name}</span>
                <span className="text-muted-foreground">({formatCurrency(entry[metric])})</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
