"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarOff, CalendarDays, Check, Loader2, Trash2, AlertCircle, RefreshCw, Info, Lock,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { addLeave, deleteLeave, getLeaves, setLeaveQuota } from "@/lib/vercel-payroll";
import { LEAVE_TYPE_LABEL, formatDays } from "@/lib/leave-utils";
import { usePayrollByPeriod, usePayrollMutations } from "@/hooks/use-payroll";
import { LeaveType } from "@/types/payroll";
import { toast } from "@/hooks/use-toast";

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const monthLabel = (period: string) => {
  if (!period) return "";
  const [y, m] = period.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
};

// เดือนหน้า (ลาล่วงหน้า) ย้อนไป 17 เดือน
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = -1; i < 17; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: monthLabel(value) });
  }
  return options;
};

const leaveDateLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" });

// จำนวนวันในช่วง (รวมทั้งสองวัน) — 0 ถ้าช่วงไม่ถูกต้อง
const countDays = (start: string, end: string) => {
  if (!start) return 0;
  if (!end) return 1;
  const diff = (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000;
  return diff < 0 ? 0 : diff + 1;
};

const TYPE_BADGE: Record<LeaveType, string> = {
  sick: "bg-sky-50 text-sky-700 border-sky-200",
  personal: "bg-amber-50 text-amber-700 border-amber-200",
  other: "bg-gray-50 text-gray-700 border-gray-200",
};

const quotaText = (q: number | null) => (q === null ? "" : String(q));

function QuotaInput({ employeeName, value, onSave, saving }: {
  employeeName: string;
  value: number | null;
  onSave: (v: number | null) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(quotaText(value));
  useEffect(() => setDraft(quotaText(value)), [value]);
  const dirty = draft.trim() !== quotaText(value);
  const commit = () => {
    if (!dirty) return;
    onSave(draft.trim() === "" ? null : Number(draft));
  };
  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        max={31}
        step={0.5}
        value={draft}
        placeholder="ไม่ตั้ง"
        aria-label={`วันลาที่ได้ต่อเดือนของ ${employeeName}`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        className="h-9 w-20 text-right"
      />
      {dirty && (
        <Button size="sm" className="h-9 px-2" onClick={commit} disabled={saving} aria-label={`บันทึกวันลาที่ได้ของ ${employeeName}`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

export function Leaves() {
  const qc = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState(() => toLocalDateStr(new Date()).slice(0, 7));
  const monthOptions = useMemo(() => {
    const options = generateMonthOptions();
    if (!options.some((o) => o.value === selectedPeriod)) {
      options.push({ value: selectedPeriod, label: monthLabel(selectedPeriod) });
    }
    return options;
  }, [selectedPeriod]);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["leaves", selectedPeriod],
    queryFn: () => getLeaves(selectedPeriod),
    staleTime: 15 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const employees = useMemo(() => data?.employees ?? [], [data]);
  const leaves = useMemo(() => data?.leaves ?? [], [data]);

  const { run, items: payrollItems } = usePayrollByPeriod(selectedPeriod);
  const { createRun } = usePayrollMutations(selectedPeriod);

  // ── ฟอร์มบันทึกการลา ──
  const [employeeId, setEmployeeId] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [note, setNote] = useState("");

  useEffect(() => {
    const today = toLocalDateStr(new Date());
    setStartDate((prev) => (prev.startsWith(selectedPeriod) ? prev : today.startsWith(selectedPeriod) ? today : `${selectedPeriod}-01`));
    setEndDate((prev) => (prev.startsWith(selectedPeriod) ? prev : ""));
  }, [selectedPeriod]);

  const dayCount = halfDay ? (startDate ? 0.5 : 0) : countDays(startDate, endDate);
  const rangeInvalid = !halfDay && !!endDate && countDays(startDate, endDate) === 0;

  const invalidateLeaves = () => qc.invalidateQueries({ queryKey: ["leaves"] });

  const addMutation = useMutation({
    mutationFn: addLeave,
    onSuccess: async (result, vars) => {
      const emp = employees.find((e) => e.id === vars.employeeId);
      toast({
        title: "บันทึกการลาแล้ว",
        description: `${emp?.name ?? ""} ${vars.halfDay ? "ครึ่งวัน" : `${result.created} วัน`}`,
      });
      setEndDate("");
      setNote("");
      const leavePeriod = vars.startDate.slice(0, 7);
      if (leavePeriod !== selectedPeriod) setSelectedPeriod(leavePeriod);
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "บันทึกการลาไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLeave,
    onSuccess: async () => {
      toast({ title: "ลบวันลาแล้ว" });
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const [savingQuotaFor, setSavingQuotaFor] = useState<string | null>(null);
  const quotaMutation = useMutation({
    mutationFn: ({ target, quota }: { target: { employeeId: string } | { all: true }; quota: number | null }) =>
      setLeaveQuota(target, quota),
    onMutate: ({ target }) => setSavingQuotaFor("all" in target ? "all" : target.employeeId),
    onSettled: () => setSavingQuotaFor(null),
    onSuccess: async (_r, { quota }) => {
      toast({ title: quota === null ? "ยกเลิกวันลาที่ได้แล้ว (ไม่หัก)" : `ตั้งวันลาที่ได้ ${formatDays(quota)} วัน/เดือนแล้ว` });
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "ตั้งวันลาไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const [allQuota, setAllQuota] = useState("");

  const submitLeave = () => {
    if (!employeeId) {
      toast({ title: "กรุณาเลือกพนักงาน", variant: "destructive" });
      return;
    }
    if (!startDate || rangeInvalid) {
      toast({ title: "กรุณาเลือกวันที่ให้ถูกต้อง", variant: "destructive" });
      return;
    }
    addMutation.mutate({
      employeeId,
      startDate,
      endDate: halfDay ? undefined : endDate || undefined,
      halfDay,
      leaveType,
      note: note.trim(),
    });
  };

  const applyAllQuota = () => {
    const quota = allQuota.trim() === "" ? null : Number(allQuota);
    const text = quota === null ? "ยกเลิกวันลาที่ได้ (ไม่หัก)" : `ตั้งวันลาที่ได้ ${formatDays(quota)} วัน/เดือน`;
    if (!confirm(`${text} ให้พนักงานทุกคน?`)) return;
    quotaMutation.mutate({ target: { all: true }, quota });
  };

  const [filterEmployee, setFilterEmployee] = useState("all");
  const shownLeaves = filterEmployee === "all" ? leaves : leaves.filter((l) => l.employeeId === filterEmployee);
  const employeeName = (id: string, fallback: string) => employees.find((e) => e.id === id)?.name || fallback;

  const totals = useMemo(() => ({
    leaveDays: employees.reduce((s, e) => s + e.leaveDays, 0),
    deduction: employees.reduce((s, e) => s + e.deduction, 0),
    overCount: employees.filter((e) => e.excessDays > 0).length,
  }), [employees]);
  const noQuotaCount = employees.filter((e) => e.leaveQuota === null).length;

  // รอบเงินเดือนเดือนนี้คิดจากข้อมูลการลาชุดเก่า → ต้องกด "คำนวณใหม่"
  const payrollStale = !!run && run.status === "draft" && employees.some((e) => {
    const it = payrollItems.find((i) => i.employeeId === e.id);
    return !!it && (it.leaveDays !== e.leaveDays || (it.leaveQuota ?? null) !== e.leaveQuota);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            บันทึกการลา
          </h1>
          <p className="text-muted-foreground mt-1">
            ลาเกินวันที่ได้ต่อเดือน หักวันละ เงินเดือน ÷ 25 — หักจากคอมก่อน คอมไม่พอหักจากเงินเดือน
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="leave-period" className="text-sm whitespace-nowrap">เดือน:</Label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger id="leave-period" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="โหลดใหม่">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Payroll status */}
      {run?.status === "finalized" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            เงินเดือน{monthLabel(selectedPeriod)}ปิดรอบแล้ว — แก้การลาตอนนี้จะไม่เปลี่ยนยอดเงินเดือน
            (ต้องเปิดรอบใหม่ในหน้าจ่ายเงินเดือนแล้วกด "คำนวณใหม่")
          </span>
        </div>
      )}
      {payrollStale && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>ข้อมูลการลาเปลี่ยนหลังคำนวณเงินเดือน{monthLabel(selectedPeriod)} — คำนวณใหม่เพื่อให้ยอดหักในหน้าจ่ายเงินเดือนตรง</span>
          </div>
          <Button
            size="sm"
            onClick={() => createRun.mutate({ period: selectedPeriod, regenerate: true })}
            disabled={createRun.isPending}
            className="shrink-0"
          >
            {createRun.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            คำนวณเงินเดือนใหม่
          </Button>
        </div>
      )}

      {error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-red-500 mb-3" />
            <p className="font-medium">โหลดข้อมูลการลาไม่สำเร็จ</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Form */}
          <Card className="xl:col-span-1 h-fit min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarOff className="h-5 w-5 text-rose-500" /> บันทึกวันลา
              </CardTitle>
              <CardDescription>ลาหลายวันติดกัน ใส่ "ถึงวันที่" ได้เลย</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="leave-employee">พนักงาน</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger id="leave-employee">
                    <SelectValue placeholder={isLoading ? "กำลังโหลด..." : "เลือกพนักงาน"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}{e.position ? ` · ${e.position}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>ลา</Label>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="ลาเต็มวันหรือครึ่งวัน">
                  <Button type="button" variant={!halfDay ? "default" : "outline"} onClick={() => setHalfDay(false)} aria-pressed={!halfDay}>
                    เต็มวัน
                  </Button>
                  <Button type="button" variant={halfDay ? "default" : "outline"} onClick={() => setHalfDay(true)} aria-pressed={halfDay}>
                    ครึ่งวัน
                  </Button>
                </div>
              </div>

              <div className={cn("grid gap-3", !halfDay && "grid-cols-2")}>
                <div className="space-y-1.5">
                  <Label htmlFor="leave-start">{halfDay ? "วันที่ลา" : "วันที่เริ่มลา"}</Label>
                  <Input id="leave-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                {!halfDay && (
                  <div className="space-y-1.5">
                    <Label htmlFor="leave-end">ถึงวันที่ <span className="text-muted-foreground font-normal">(ถ้าหลายวัน)</span></Label>
                    <Input id="leave-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                )}
              </div>
              {rangeInvalid && <p className="text-sm text-red-600">"ถึงวันที่" ต้องไม่ก่อนวันเริ่มลา</p>}

              <div className="space-y-1.5">
                <Label>ประเภท</Label>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="ประเภทการลา">
                  {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
                    <Button key={t} type="button" variant={leaveType === t ? "default" : "outline"} onClick={() => setLeaveType(t)} aria-pressed={leaveType === t}>
                      {LEAVE_TYPE_LABEL[t]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="leave-note">หมายเหตุ</Label>
                <Input id="leave-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ไปหาหมอ / ธุระที่บ้าน" />
              </div>

              <Button
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500"
                onClick={submitLeave}
                disabled={addMutation.isPending || rangeInvalid}
              >
                {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarOff className="h-4 w-4 mr-2" />}
                บันทึกการลา{dayCount > 0 ? ` (${formatDays(dayCount)} วัน)` : ""}
              </Button>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="xl:col-span-2 min-w-0">
            <CardHeader>
              <CardTitle className="text-lg">สรุปการลา {monthLabel(selectedPeriod)}</CardTitle>
              <CardDescription>
                ลารวม {formatDays(totals.leaveDays)} วัน · ลาเกิน {totals.overCount} คน · หักรวมประมาณ {formatCurrency(totals.deduction)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/40 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="all-quota" className="text-sm">วันลาที่ได้ต่อเดือน — ตั้งให้ทุกคน</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="all-quota"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={31}
                      step={0.5}
                      value={allQuota}
                      onChange={(e) => setAllQuota(e.target.value)}
                      placeholder="เช่น 4"
                      className="h-9 w-24 text-right"
                    />
                    <span className="text-sm text-muted-foreground">วัน</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-9" onClick={applyAllQuota} disabled={quotaMutation.isPending || employees.length === 0}>
                  {savingQuotaFor === "all" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  ใช้กับทุกคน
                </Button>
                <span className="text-xs text-muted-foreground basis-full">แก้รายคนได้ในตารางด้านล่าง · เว้นว่าง = ยังไม่ตั้ง (ไม่หัก)</span>
              </div>

              {noQuotaCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>ยังไม่ได้ตั้งวันลาที่ได้ {noQuotaCount} คน — คนที่ยังไม่ตั้งจะไม่ถูกหัก</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead className="text-right">ลาได้/เดือน</TableHead>
                      <TableHead className="text-right">ลาไป</TableHead>
                      <TableHead className="text-right">เกิน</TableHead>
                      <TableHead className="text-right">หักวันละ</TableHead>
                      <TableHead className="text-right">ยอดหัก</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : employees.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">ไม่มีพนักงาน</TableCell></TableRow>
                    ) : employees.map((e) => (
                      <TableRow key={e.id} className={cn(e.excessDays > 0 && "bg-red-50/60")}>
                        <TableCell>
                          <div className="font-medium">{e.name}</div>
                          <div className="text-xs text-muted-foreground">เงินเดือน {formatCurrency(e.salary)}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <QuotaInput
                            employeeName={e.name}
                            value={e.leaveQuota}
                            saving={savingQuotaFor === e.id}
                            onSave={(quota) => quotaMutation.mutate({ target: { employeeId: e.id }, quota })}
                          />
                        </TableCell>
                        <TableCell className="text-right">{e.leaveDays > 0 ? formatDays(e.leaveDays) : <span className="text-gray-400">0</span>}</TableCell>
                        <TableCell className="text-right">
                          {e.excessDays > 0 ? <span className="font-semibold text-red-600">{formatDays(e.excessDays)}</span> : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(e.dailyRate)}</TableCell>
                        <TableCell className="text-right">
                          {e.deduction > 0 ? <span className="font-semibold text-red-600">−{formatCurrency(e.deduction)}</span> : <span className="text-gray-400">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Leave list */}
          <Card className="xl:col-span-3 min-w-0">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5 text-rose-500" /> รายการลา {monthLabel(selectedPeriod)}
                </CardTitle>
                <CardDescription>{shownLeaves.length} รายการ</CardDescription>
              </div>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-48" aria-label="กรองตามพนักงาน">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกคน</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead>จำนวน</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                      <TableHead className="whitespace-nowrap">ผู้บันทึก</TableHead>
                      <TableHead className="text-right">ลบ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownLeaves.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          {isLoading ? "กำลังโหลด..." : "ยังไม่มีการลาในเดือนนี้"}
                        </TableCell>
                      </TableRow>
                    ) : shownLeaves.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">{leaveDateLabel(l.date)}</TableCell>
                        <TableCell className="font-medium">{employeeName(l.employeeId, l.employeeName)}</TableCell>
                        <TableCell className="whitespace-nowrap">{l.days === 0.5 ? "ครึ่งวัน" : "เต็มวัน"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("font-medium whitespace-nowrap", TYPE_BADGE[l.leaveType] ?? TYPE_BADGE.other)}>
                            {LEAVE_TYPE_LABEL[l.leaveType] ?? LEAVE_TYPE_LABEL.other}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[240px]">{l.note || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.recordedBy || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            aria-label={`ลบวันลา ${employeeName(l.employeeId, l.employeeName)} ${leaveDateLabel(l.date)}`}
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm(`ลบวันลา ${employeeName(l.employeeId, l.employeeName)} วันที่ ${leaveDateLabel(l.date)}?`)) {
                                deleteMutation.mutate(l.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
