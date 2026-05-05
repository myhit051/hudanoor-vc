"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Wallet, Calculator, TrendingUp, FileDown, CheckCircle2, Loader2, RefreshCw,
  Lock, Unlock, AlertCircle, Receipt, Trash2, Pencil, Building2, DownloadCloud,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { usePayrollByPeriod, usePayrollMutations, usePayrollRuns } from "@/hooks/use-payroll";
import { PayslipDialog } from "@/components/payroll/PayslipDialog";
import { PayrollItem } from "@/types/payroll";
import {
  ImportPreview, ImportResult, importLegacySales, previewLegacySalesImport,
} from "@/lib/vercel-payroll";
import { toast } from "@/hooks/use-toast";

const monthLabel = (period: string) => {
  if (!period) return "";
  const [y, m] = period.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
};

const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: d.toLocaleDateString("th-TH", { year: "numeric", month: "long" }) });
  }
  return options;
};

export default function Payroll() {
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(monthOptions[0].value);

  const { run, items, isLoading, isFetching, refetch } = usePayrollByPeriod(selectedPeriod);
  const { runs } = usePayrollRuns();
  const { createRun, updateItem, finalizeRun, reopenRun, deleteRun } = usePayrollMutations(selectedPeriod);

  const [payslipOpen, setPayslipOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<PayrollItem | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<PayrollItem | null>(null);
  const [adjustValue, setAdjustValue] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const isFinalized = run?.status === "finalized";
  const periodHasRun = !!run;

  const totals = useMemo(() => {
    const totalSalary = items.reduce((s, it) => s + it.salary, 0);
    const totalCommission = items.reduce((s, it) => s + it.totalCommission, 0);
    const totalAdjustment = items.reduce((s, it) => s + (it.adjustment || 0), 0);
    const totalAmount = items.reduce((s, it) => s + it.totalAmount, 0);
    const paidCount = items.filter((it) => it.status === "paid").length;
    const paidAmount = items.filter((it) => it.status === "paid").reduce((s, it) => s + it.totalAmount, 0);
    return { totalSalary, totalCommission, totalAdjustment, totalAmount, paidCount, paidAmount };
  }, [items]);

  const branchGroups = useMemo(() => {
    const groups = new Map<string, PayrollItem[]>();
    for (const it of items) {
      const key = it.homeBranch || "— ไม่ระบุสาขา —";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }
    return Array.from(groups.entries()).map(([branch, list]) => ({
      branch,
      items: list,
      totalSalary: list.reduce((s, it) => s + it.salary, 0),
      totalCommission: list.reduce((s, it) => s + it.totalCommission, 0),
      totalAmount: list.reduce((s, it) => s + it.totalAmount, 0),
    }));
  }, [items]);

  const handleCreate = async (regenerate: boolean) => {
    await createRun.mutateAsync({ period: selectedPeriod, regenerate });
  };

  const togglePaid = async (item: PayrollItem) => {
    await updateItem.mutateAsync({
      itemId: item.id,
      updates: { status: item.status === "paid" ? "pending" : "paid" },
    });
  };

  const openAdjust = (item: PayrollItem) => {
    setAdjustItem(item);
    setAdjustValue(item.adjustment || 0);
    setAdjustNote(item.adjustmentNote || "");
    setAdjustOpen(true);
  };

  const submitAdjust = async () => {
    if (!adjustItem) return;
    await updateItem.mutateAsync({
      itemId: adjustItem.id,
      updates: { adjustment: adjustValue, adjustmentNote: adjustNote },
    });
    setAdjustOpen(false);
    setAdjustItem(null);
  };

  const handleViewPayslip = (item: PayrollItem) => {
    setActiveItem(item);
    setPayslipOpen(true);
  };

  const openImportDialog = async () => {
    setImportOpen(true);
    setImportPreview(null);
    setImportResult(null);
    setImportLoading(true);
    try {
      const preview = await previewLegacySalesImport();
      setImportPreview(preview);
    } catch (err: any) {
      toast({ title: "ดึงข้อมูล Sheet ไม่สำเร็จ", description: err.message || "", variant: "destructive" });
      setImportOpen(false);
    } finally {
      setImportLoading(false);
    }
  };

  const runImport = async () => {
    setImportLoading(true);
    try {
      const result = await importLegacySales();
      setImportResult(result);
      toast({
        title: "นำเข้ายอดขายเสร็จสิ้น",
        description: `เพิ่มใหม่ ${result.imported} · ข้าม ${result.skipped} · ผิดพลาด ${result.errors}`,
      });
      // Refresh current period (commission may change)
      await refetch();
    } catch (err: any) {
      toast({ title: "นำเข้าไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            จ่ายเงินเดือน
          </h1>
          <p className="text-muted-foreground mt-1">
            สรุปยอดเงินเดือน + คอม สำหรับพนักงาน — แยกตามสาขา ออกใบแจ้งเป็น PDF ได้
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="period" className="text-sm whitespace-nowrap">เดือน:</Label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger id="period" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => {
                const r = runs.find((x) => x.period === opt.value);
                return (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}{r ? (r.status === "finalized" ? " · ปิดแล้ว" : " · ฉบับร่าง") : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={openImportDialog} title="นำเข้ายอดขายเก่าจาก Google Sheet">
            <DownloadCloud className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">นำเข้ายอดขายเก่า</span>
          </Button>
        </div>
      </div>

      {/* Run actions */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">รอบจ่าย: {monthLabel(selectedPeriod)}</div>
              <div className="text-sm text-muted-foreground">
                {periodHasRun ? (
                  <>
                    {isFinalized ? <Badge className="bg-gray-700">ปิดรอบแล้ว 🔒</Badge> : <Badge className="bg-amber-500">ฉบับร่าง</Badge>}
                    {" "}· {run?.employeeCount} คน · จ่ายแล้ว {totals.paidCount}/{items.length}
                  </>
                ) : (
                  "ยังไม่ได้สร้างรอบจ่ายสำหรับเดือนนี้"
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!periodHasRun && (
              <Button
                onClick={() => handleCreate(false)}
                disabled={createRun.isPending}
                className="bg-gradient-to-r from-rose-500 to-pink-500"
              >
                {createRun.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
                สร้างรอบจ่ายเงินเดือน
              </Button>
            )}
            {periodHasRun && !isFinalized && (
              <>
                <Button variant="outline" onClick={() => handleCreate(true)} disabled={createRun.isPending}>
                  {createRun.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  คำนวณใหม่
                </Button>
                <Button variant="outline" onClick={() => finalizeRun.mutate(run!.id)} disabled={finalizeRun.isPending}>
                  <Lock className="h-4 w-4 mr-2" /> ปิดรอบ
                </Button>
                <Button variant="ghost" className="text-red-600" onClick={() => {
                  if (confirm("ลบรอบจ่ายนี้? (ข้อมูลที่จ่ายแล้วจะหายไป)")) deleteRun.mutate(run!.id);
                }} disabled={deleteRun.isPending}>
                  <Trash2 className="h-4 w-4 mr-2" /> ลบรอบ
                </Button>
              </>
            )}
            {periodHasRun && isFinalized && (
              <Button variant="outline" onClick={() => reopenRun.mutate(run!.id)} disabled={reopenRun.isPending}>
                <Unlock className="h-4 w-4 mr-2" /> เปิดรอบใหม่
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-sm text-blue-700">เงินเดือนรวม</div>
            <div className="text-xl font-bold text-blue-800">{formatCurrency(totals.totalSalary)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="text-sm text-emerald-700">คอมรวม</div>
            <div className="text-xl font-bold text-emerald-800">{formatCurrency(totals.totalCommission)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <div className="text-sm text-amber-700">ปรับปรุงรวม</div>
            <div className="text-xl font-bold text-amber-800">
              {totals.totalAdjustment >= 0 ? "+" : ""}{formatCurrency(totals.totalAdjustment)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200">
          <CardContent className="p-4">
            <div className="text-sm text-rose-700">รวมต้องจ่าย</div>
            <div className="text-xl font-bold text-rose-800">{formatCurrency(totals.totalAmount)}</div>
            <div className="text-xs text-rose-600 mt-1">
              จ่ายแล้ว {formatCurrency(totals.paidAmount)} / คงค้าง {formatCurrency(totals.totalAmount - totals.paidAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: by employee / by branch */}
      {!periodHasRun ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">ยังไม่ได้สร้างรอบจ่ายสำหรับ {monthLabel(selectedPeriod)}</h3>
            <p className="text-muted-foreground text-sm">กดปุ่ม "สร้างรอบจ่ายเงินเดือน" ด้านบนเพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="employees" className="space-y-4">
          <TabsList>
            <TabsTrigger value="employees">รายพนักงาน ({items.length})</TabsTrigger>
            <TabsTrigger value="branches">แยกตามสาขา ({branchGroups.length})</TabsTrigger>
          </TabsList>

          {/* By employee */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle>รายการเงินเดือนพนักงาน</CardTitle>
                <CardDescription>กดปุ่ม "ใบแจ้ง" เพื่อดูใบเงินเดือน + ดาวน์โหลด PDF</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>พนักงาน</TableHead>
                        <TableHead>สาขาประจำ</TableHead>
                        <TableHead className="text-right">เงินเดือน</TableHead>
                        <TableHead className="text-right">คอม</TableHead>
                        <TableHead className="text-right">ปรับปรุง</TableHead>
                        <TableHead className="text-right">รวม</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead className="text-right">การจัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">ไม่มีข้อมูล</TableCell></TableRow>
                      ) : items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>
                            <div className="font-medium">{it.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{it.position || "-"}</div>
                          </TableCell>
                          <TableCell className="text-sm">{it.homeBranch || "-"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(it.salary)}</TableCell>
                          <TableCell className="text-right text-emerald-600">{formatCurrency(it.totalCommission)}</TableCell>
                          <TableCell className="text-right">
                            {it.adjustment !== 0 ? (
                              <span className={it.adjustment < 0 ? "text-red-600" : "text-amber-600"}>
                                {it.adjustment > 0 ? "+" : ""}{formatCurrency(it.adjustment)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-rose-600">{formatCurrency(it.totalAmount)}</TableCell>
                          <TableCell>
                            {it.status === "paid" ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">จ่ายแล้ว</Badge>
                            ) : (
                              <Badge variant="outline">รอจ่าย</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleViewPayslip(it)}>
                                <Receipt className="h-4 w-4 mr-1" /> ใบแจ้ง
                              </Button>
                              {!isFinalized && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => openAdjust(it)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={it.status === "paid" ? "outline" : "default"}
                                    onClick={() => togglePaid(it)}
                                    disabled={updateItem.isPending}
                                  >
                                    {it.status === "paid" ? "ยกเลิก" : <><CheckCircle2 className="h-4 w-4 mr-1" /> จ่าย</>}
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* By branch */}
          <TabsContent value="branches">
            <div className="space-y-4">
              {branchGroups.map((g) => (
                <Card key={g.branch}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-rose-500" />
                      <CardTitle className="text-lg">{g.branch}</CardTitle>
                      <Badge variant="outline">{g.items.length} คน</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">รวมต้องจ่าย</div>
                      <div className="text-lg font-bold text-rose-600">{formatCurrency(g.totalAmount)}</div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                      <div className="p-2 rounded bg-blue-50">
                        <div className="text-xs text-blue-600">เงินเดือน</div>
                        <div className="font-semibold text-blue-800">{formatCurrency(g.totalSalary)}</div>
                      </div>
                      <div className="p-2 rounded bg-emerald-50">
                        <div className="text-xs text-emerald-600">คอม</div>
                        <div className="font-semibold text-emerald-800">{formatCurrency(g.totalCommission)}</div>
                      </div>
                      <div className="p-2 rounded bg-rose-50">
                        <div className="text-xs text-rose-600">รวม</div>
                        <div className="font-semibold text-rose-800">{formatCurrency(g.totalAmount)}</div>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>พนักงาน</TableHead>
                          <TableHead className="text-right">เงินเดือน</TableHead>
                          <TableHead className="text-right">คอม</TableHead>
                          <TableHead className="text-right">รวม</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead className="text-right">ใบแจ้ง</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.items.map((it) => (
                          <TableRow key={it.id}>
                            <TableCell className="font-medium">{it.employeeName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(it.salary)}</TableCell>
                            <TableCell className="text-right text-emerald-600">{formatCurrency(it.totalCommission)}</TableCell>
                            <TableCell className="text-right font-bold text-rose-600">{formatCurrency(it.totalAmount)}</TableCell>
                            <TableCell>
                              {it.status === "paid" ? (
                                <Badge className="bg-green-100 text-green-700">จ่ายแล้ว</Badge>
                              ) : (
                                <Badge variant="outline">รอจ่าย</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => handleViewPayslip(it)}>
                                <FileDown className="h-4 w-4 mr-1" /> ดู
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Payslip Dialog */}
      <PayslipDialog
        open={payslipOpen}
        onOpenChange={setPayslipOpen}
        item={activeItem}
        run={run}
      />

      {/* Import legacy sales Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!importLoading) setImportOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DownloadCloud className="h-5 w-5 text-rose-500" />
              นำเข้ายอดขายเก่าจาก Google Sheet
            </DialogTitle>
            <DialogDescription>
              ดึงข้อมูลยอดขายเก่าจาก Sheet "รายรับ" เข้าฐานข้อมูลใหม่ — เพื่อใช้คำนวณค่าคอมย้อนหลัง
            </DialogDescription>
          </DialogHeader>

          {importLoading && !importPreview && !importResult ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">กำลังตรวจสอบข้อมูลใน Sheet...</p>
            </div>
          ) : importResult ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 p-4">
                <div className="flex items-center gap-2 text-emerald-700 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">นำเข้าเสร็จสิ้น</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-emerald-700">{importResult.imported}</div>
                    <div className="text-xs text-emerald-600">เพิ่มใหม่</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-500">{importResult.skipped}</div>
                    <div className="text-xs text-gray-500">ข้าม (ซ้ำใน DB)</div>
                  </div>
                  {importResult.duplicatesInSheet !== undefined && (
                    <div>
                      <div className="text-2xl font-bold text-amber-600">{importResult.duplicatesInSheet}</div>
                      <div className="text-xs text-amber-600">ซ้ำใน Sheet</div>
                    </div>
                  )}
                  <div>
                    <div className="text-2xl font-bold text-red-500">{importResult.errors}</div>
                    <div className="text-xs text-red-500">ผิดพลาด</div>
                  </div>
                </div>
              </div>
              {importResult.errorSamples && importResult.errorSamples.length > 0 && (
                <div className="text-xs bg-red-50 border border-red-200 rounded p-2 space-y-1">
                  <div className="font-semibold text-red-700">ตัวอย่าง error:</div>
                  {importResult.errorSamples.map((e, i) => (
                    <div key={i} className="text-red-600">• {e.sheetId}: {e.message}</div>
                  ))}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                💡 แนะนำ: กลับไปหน้ารอบจ่ายเงินเดือน → กด <strong>"คำนวณใหม่"</strong> เพื่อรวมยอดที่นำเข้าเข้ามา
              </div>
            </div>
          ) : importPreview ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">พบใน Sheet ทั้งหมด</span>
                  <span className="font-semibold">{importPreview.totalInSheet} รายการ</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">นำเข้าแล้วก่อนหน้า</span>
                  <span className="font-semibold text-gray-500">{importPreview.alreadyImported} รายการ</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">จะเพิ่มใหม่</span>
                  <span className="font-bold text-rose-600 text-lg">{importPreview.willImport} รายการ</span>
                </div>
              </div>
              {importPreview.willImport === 0 ? (
                <div className="text-center text-sm text-muted-foreground bg-gray-50 rounded p-3">
                  ✓ ข้อมูลทั้งหมดถูกนำเข้าแล้ว ไม่มีอะไรต้องเพิ่ม
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                  ⚠️ ยอดขายที่นำเข้าจะใช้ <code className="bg-white px-1 rounded">SKU = LEGACY</code> และ note ระบุว่ามาจาก Sheet — ปลอดภัยที่จะรันซ้ำ (ของซ้ำจะถูกข้าม)
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importLoading}>
              {importResult ? "ปิด" : "ยกเลิก"}
            </Button>
            {importPreview && !importResult && importPreview.willImport > 0 && (
              <Button onClick={runImport} disabled={importLoading} className="bg-gradient-to-r from-rose-500 to-pink-500">
                {importLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังนำเข้า...</> : <><DownloadCloud className="h-4 w-4 mr-2" /> นำเข้าตอนนี้</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปรับปรุง / โบนัส / หักเพิ่ม — {adjustItem?.employeeName}</DialogTitle>
            <DialogDescription>
              ใส่จำนวนเงินบวก (โบนัส) หรือลบ (หักเงิน) พร้อมหมายเหตุ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="adjustValue">จำนวน (บวก = เพิ่ม / ลบ = หัก)</Label>
              <Input
                id="adjustValue"
                type="number"
                value={adjustValue}
                onChange={(e) => setAdjustValue(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="adjustNote">หมายเหตุ</Label>
              <Textarea
                id="adjustNote"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="เช่น โบนัสเดือนแรก / หักเงินกู้ / ค่าทำงานล่วงเวลา"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>ยกเลิก</Button>
            <Button onClick={submitAdjust} disabled={updateItem.isPending}>
              {updateItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
