"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarOff, CalendarDays, CalendarRange, Check, Clock, Loader2, Trash2, AlertCircle, RefreshCw, Info, Lock, History,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  addLeave, addOvertime, createOrRegeneratePayroll, deleteLeave, deleteOvertime, getLeaves, setLeaveDayDivisor, setLeaveLump,
  setLeaveQuota, setOtDayRate, setOvertimeLump,
} from "@/lib/vercel-payroll";
import { LEAVE_TYPE_LABEL, formatDays } from "@/lib/leave-utils";
import { EmployeeLeave, EmployeeOvertime, LeaveType } from "@/types/payroll";

type ListRow = { kind: "leave"; item: EmployeeLeave } | { kind: "ot"; item: EmployeeOvertime };
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

const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const buddhistYear = (year: string) => Number(year) + 543;

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
  raya: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const quotaText = (q: number | null) => (q === null ? "" : String(q));

function QuotaInput({ label, value, onSave, saving, max = 366 }: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
  saving: boolean;
  max?: number;
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
        max={max}
        step={0.5}
        value={draft}
        placeholder="ไม่ตั้ง"
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        className="h-9 w-20 text-right"
      />
      {dirty && (
        <Button size="sm" className="h-9 px-2" onClick={commit} disabled={saving} aria-label={`บันทึก${label}`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

function SegmentedButtons<T extends string>({ value, onChange, options, label, cols }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  cols: string;
}) {
  return (
    <div className={cn("grid gap-2", cols)} role="group" aria-label={label}>
      {options.map((o) => (
        <Button key={o.value} type="button" variant={value === o.value ? "default" : "outline"}
          onClick={() => onChange(o.value)} aria-pressed={value === o.value}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

const LEAVE_TYPE_OPTIONS = (Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => ({ value: t, label: LEAVE_TYPE_LABEL[t] }));

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
  const overtime = useMemo(() => data?.overtime ?? [], [data]);
  const year = selectedPeriod.slice(0, 4);
  const selectedMonthIdx = Number(selectedPeriod.slice(5, 7)) - 1;

  const runs = useMemo(() => data?.runs ?? [], [data]);
  const run = runs.find((r) => r.period === selectedPeriod);

  // ── ฟอร์มบันทึกการลา / OT ──
  const [kind, setKind] = useState<"leave" | "ot">("leave");
  const isOt = kind === "ot";
  const [mode, setMode] = useState<"dated" | "lump">("dated");
  const [employeeId, setEmployeeId] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lumpPeriod, setLumpPeriod] = useState(selectedPeriod);
  const [lumpDays, setLumpDays] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [note, setNote] = useState("");

  useEffect(() => {
    const today = toLocalDateStr(new Date());
    setStartDate((prev) => (prev.startsWith(selectedPeriod) ? prev : today.startsWith(selectedPeriod) ? today : `${selectedPeriod}-01`));
    setEndDate((prev) => (prev.startsWith(selectedPeriod) ? prev : ""));
    setLumpPeriod(selectedPeriod);
  }, [selectedPeriod]);

  const dayCount = halfDay ? (startDate ? 0.5 : 0) : countDays(startDate, endDate);
  const rangeInvalid = !halfDay && !!endDate && countDays(startDate, endDate) === 0;

  // หยุดรายอกับการลาอื่นแยกกลุ่มกัน (ยอดย้อนหลังได้กลุ่มละ 1 แถวต่อเดือน) · OT เป็นอีกกลุ่ม
  const sameGroup = (t: LeaveType) => (t === "raya") === (leaveType === "raya");
  const groupRows: { isLump: boolean; employeeId: string; days: number }[] = isOt
    ? overtime
    : leaves.filter((l) => sameGroup(l.leaveType));
  // ยอดย้อนหลังที่มีอยู่แล้วของคน+เดือนที่เลือก (ใส่ใหม่จะแทนที่)
  const existingLump = mode === "lump" && lumpPeriod === selectedPeriod
    ? groupRows.find((l) => l.isLump && l.employeeId === employeeId)
    : undefined;
  // อีกแบบที่มีอยู่แล้วในเดือนเดียวกัน → นับรวมกัน (อาจซ้ำ) เตือนก่อนบันทึก
  const datedInLumpMonth = mode === "lump" && lumpPeriod === selectedPeriod
    ? groupRows.filter((l) => !l.isLump && l.employeeId === employeeId).reduce((s, l) => s + l.days, 0)
    : 0;
  const lumpInDatedMonth = mode === "dated" && startDate.startsWith(selectedPeriod)
    ? groupRows.find((l) => l.isLump && l.employeeId === employeeId)
    : undefined;
  const kindWord = isOt ? " OT" : "วันลา";
  const rayaPerYear = data?.rayaDaysPerYear ?? 3;
  const formEmployee = employees.find((e) => e.id === employeeId);

  // แก้การลาเดือน month → กระทบเดือนนั้นและเดือนหลัง ๆ ในปีเดียวกัน ถ้าบางเดือนปิดรอบแล้วจะไม่หัก/คืนย้อนหลัง → ถามก่อน
  const confirmClosedMonths = (month: string) => {
    const closed = runs.filter((r) => r.status === "finalized" && r.period >= month && r.period.slice(0, 4) === month.slice(0, 4));
    if (closed.length === 0) return true;
    return confirm(
      `เงินเดือน ${closed.map((r) => monthLabel(r.period)).join(", ")} ปิดรอบแล้ว\n` +
      `การแก้นี้จะไม่หักหรือคืนเงินย้อนหลังในเดือนที่ปิดรอบแล้ว (ถ้าต้องการ ให้เปิดรอบใหม่แล้วกด "คำนวณใหม่")\n\nบันทึกต่อไหม?`
    );
  };

  const invalidateLeaves = () => qc.invalidateQueries({ queryKey: ["leaves"] });

  const addMutation = useMutation({
    mutationFn: addLeave,
    onSuccess: async (result, vars) => {
      const emp = employees.find((e) => e.id === vars.employeeId);
      toast({
        title: "บันทึกการลาแล้ว",
        description: `${emp?.name ?? ""} ${vars.halfDay ? "ครึ่งวัน" : `${result.created} วัน`}${result.notice ? ` · ⚠️ ${result.notice}` : ""}`,
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

  const lumpMutation = useMutation({
    mutationFn: setLeaveLump,
    onSuccess: async (result, vars) => {
      const emp = employees.find((e) => e.id === vars.employeeId);
      toast({
        title: vars.days > 0 ? "บันทึกยอดลาย้อนหลังแล้ว" : "ลบยอดลาย้อนหลังแล้ว",
        description: `${emp?.name ?? ""} · ${monthLabel(vars.period)}${vars.days > 0 ? ` · ${formatDays(vars.days)} วัน` : ""}${result.notice ? ` · ⚠️ ${result.notice}` : ""}`,
      });
      setLumpDays("");
      setNote("");
      if (vars.period !== selectedPeriod) setSelectedPeriod(vars.period);
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const otAddMutation = useMutation({
    mutationFn: addOvertime,
    onSuccess: async (result, vars) => {
      const emp = employees.find((e) => e.id === vars.employeeId);
      toast({
        title: "บันทึก OT แล้ว",
        description: `${emp?.name ?? ""} ${vars.halfDay ? "ครึ่งวัน" : `${result.created} วัน`}${result.notice ? ` · ⚠️ ${result.notice}` : ""}`,
      });
      setEndDate("");
      setNote("");
      const otPeriod = vars.startDate.slice(0, 7);
      if (otPeriod !== selectedPeriod) setSelectedPeriod(otPeriod);
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "บันทึก OT ไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const otLumpMutation = useMutation({
    mutationFn: setOvertimeLump,
    onSuccess: async (result, vars) => {
      const emp = employees.find((e) => e.id === vars.employeeId);
      toast({
        title: vars.days > 0 ? "บันทึกยอด OT ทั้งเดือนแล้ว" : "ลบยอด OT ทั้งเดือนแล้ว",
        description: `${emp?.name ?? ""} · ${monthLabel(vars.period)}${vars.days > 0 ? ` · ${formatDays(vars.days)} วัน` : ""}${result.notice ? ` · ⚠️ ${result.notice}` : ""}`,
      });
      setLumpDays("");
      setNote("");
      if (vars.period !== selectedPeriod) setSelectedPeriod(vars.period);
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const otDeleteMutation = useMutation({
    mutationFn: deleteOvertime,
    onSuccess: async () => {
      toast({ title: "ลบรายการ OT แล้ว" });
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLeave,
    onSuccess: async () => {
      toast({ title: "ลบรายการลาแล้ว" });
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const [savingQuotaFor, setSavingQuotaFor] = useState<string | null>(null);
  const quotaMutation = useMutation({
    mutationFn: ({ target, quota, kind }: {
      target: { employeeId: string } | { all: true }; quota: number | null; kind: "yearly" | "commission";
    }) => setLeaveQuota(target, quota, kind),
    onMutate: ({ target, kind }) => setSavingQuotaFor(`${kind}:${"all" in target ? "all" : target.employeeId}`),
    onSettled: () => setSavingQuotaFor(null),
    onSuccess: async (_r, { quota, kind }) => {
      toast({
        title: kind === "yearly"
          ? (quota === null ? "ยกเลิกวันลาที่ได้แล้ว (ไม่หัก)" : `ตั้งวันลาที่ได้ ${formatDays(quota)} วัน/ปีแล้ว`)
          : (quota === null ? "ยกเลิกเกณฑ์ตัดคอมแล้ว (ไม่ตัด)" : `ตั้งแล้ว: ลาเกิน ${formatDays(quota)} วันในเดือน ตัดคอมเดือนนั้น`),
      });
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });

  const [allQuota, setAllQuota] = useState("");
  const [allLimit, setAllLimit] = useState("");

  // ตัวหารค่าแรงรายวัน (ทั้งร้าน)
  const divisor = data?.leaveDayDivisor ?? 26;
  const [divisorDraft, setDivisorDraft] = useState("");
  useEffect(() => { if (data) setDivisorDraft(String(data.leaveDayDivisor)); }, [data]);
  const divisorMutation = useMutation({
    mutationFn: setLeaveDayDivisor,
    onSuccess: async (_r, value) => {
      toast({ title: `ตั้งตัวหารเป็น ÷ ${value} แล้ว`, description: "เดือนที่ยังไม่ปิดรอบ กด \"คำนวณเงินเดือนใหม่\" เพื่อใช้ตัวหารใหม่" });
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "ตั้งตัวหารไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });
  const saveDivisor = () => {
    const value = Number(divisorDraft);
    if (divisorDraft.trim() === "" || !Number.isFinite(value) || value < 1 || value > 31) {
      toast({ title: "ตัวหารต้องเป็น 1–31", variant: "destructive" });
      return;
    }
    if (value === divisor) return;
    if (!confirm(
      `เปลี่ยนหักลาเกินเป็นวันละ เงินเดือน ÷ ${value} (เดิม ÷ ${divisor})?\n` +
      `เดือนที่ปิดรอบแล้วไม่เปลี่ยน · เดือนที่ยังไม่ปิดต้องกด "คำนวณใหม่"`
    )) return;
    divisorMutation.mutate(value);
  };

  // ค่า OT ต่อวัน (ทั้งร้าน)
  const otRate = data?.otDayRate ?? 100;
  const [otRateDraft, setOtRateDraft] = useState("");
  useEffect(() => { if (data) setOtRateDraft(String(data.otDayRate)); }, [data]);
  const otRateMutation = useMutation({
    mutationFn: setOtDayRate,
    onSuccess: async (_r, value) => {
      toast({ title: `ตั้งค่า OT วันละ ${formatCurrency(value)} แล้ว`, description: "เดือนที่ยังไม่ปิดรอบ กด \"คำนวณเงินเดือนใหม่\" เพื่อใช้ค่าใหม่" });
      await invalidateLeaves();
    },
    onError: (err: any) => {
      toast({ title: "ตั้งค่า OT ไม่สำเร็จ", description: err.message || "", variant: "destructive" });
    },
  });
  const saveOtRate = () => {
    const value = Number(otRateDraft);
    if (otRateDraft.trim() === "" || !Number.isFinite(value) || value < 0 || value > 10000) {
      toast({ title: "ค่า OT ต้องเป็น 0–10,000 บาท", variant: "destructive" });
      return;
    }
    if (value === otRate) return;
    if (!confirm(
      `เปลี่ยนค่า OT เป็นวันละ ${formatCurrency(value)} (เดิม ${formatCurrency(otRate)})?\n` +
      `เดือนที่ปิดรอบแล้วไม่เปลี่ยน · เดือนที่ยังไม่ปิดต้องกด "คำนวณใหม่"`
    )) return;
    otRateMutation.mutate(value);
  };

  const submitLeave = () => {
    if (!employeeId) {
      toast({ title: "กรุณาเลือกพนักงาน", variant: "destructive" });
      return;
    }
    if (mode === "lump") {
      const days = Number(lumpDays);
      if (lumpDays.trim() === "" || !Number.isFinite(days) || days < 0) {
        toast({ title: `กรุณาใส่จำนวน${kindWord}`, variant: "destructive" });
        return;
      }
      if (!confirmClosedMonths(lumpPeriod)) return;
      if (isOt) otLumpMutation.mutate({ employeeId, period: lumpPeriod, days, note: note.trim() });
      else lumpMutation.mutate({ employeeId, period: lumpPeriod, days, leaveType, note: note.trim() });
      return;
    }
    if (!startDate || rangeInvalid) {
      toast({ title: "กรุณาเลือกวันที่ให้ถูกต้อง", variant: "destructive" });
      return;
    }
    if (!confirmClosedMonths(startDate.slice(0, 7))) return;
    if (isOt) {
      otAddMutation.mutate({
        employeeId,
        startDate,
        endDate: halfDay ? undefined : endDate || undefined,
        halfDay,
        note: note.trim(),
      });
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
    const text = quota === null ? "ยกเลิกวันลาที่ได้ (ไม่หัก)" : `ตั้งวันลาที่ได้ ${formatDays(quota)} วัน/ปี`;
    if (!confirm(`${text} ให้พนักงานทุกคน?`)) return;
    if (!confirmClosedMonths(`${year}-01`)) return;
    quotaMutation.mutate({ target: { all: true }, quota, kind: "yearly" });
  };

  const applyAllLimit = () => {
    const quota = allLimit.trim() === "" ? null : Number(allLimit);
    const text = quota === null ? "ยกเลิกเกณฑ์ตัดคอม (ไม่ตัด)" : `ตั้งเกณฑ์ ลาเกิน ${formatDays(quota)} วันในเดือน ตัดคอมเดือนนั้น`;
    if (!confirm(`${text} ให้พนักงานทุกคน?`)) return;
    if (!confirmClosedMonths(`${year}-01`)) return;
    quotaMutation.mutate({ target: { all: true }, quota, kind: "commission" });
  };

  const [filterEmployee, setFilterEmployee] = useState("all");
  const shownRows = useMemo(() => {
    const rows: ListRow[] = [
      ...leaves.map((item) => ({ kind: "leave" as const, item })),
      ...overtime.map((item) => ({ kind: "ot" as const, item })),
    ].filter((r) => filterEmployee === "all" || r.item.employeeId === filterEmployee);
    return rows.sort((a, b) => Number(b.item.isLump) - Number(a.item.isLump)
      || b.item.date.localeCompare(a.item.date) || b.item.createdAt.localeCompare(a.item.createdAt));
  }, [leaves, overtime, filterEmployee]);
  const employeeName = (id: string, fallback: string) => employees.find((e) => e.id === id)?.name || fallback;

  const listRef = useRef<HTMLDivElement | null>(null);
  const openMonth = (empId: string, monthIdx: number) => {
    setSelectedPeriod(`${year}-${String(monthIdx + 1).padStart(2, "0")}`);
    setFilterEmployee(empId);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totals = useMemo(() => ({
    leaveDays: employees.reduce((s, e) => s + e.leaveDays, 0),
    deduction: employees.reduce((s, e) => s + e.deduction, 0),
    overCount: employees.filter((e) => e.excessDays > 0).length,
    forfeitCount: employees.filter((e) => e.commissionForfeit).length,
    otDays: employees.reduce((s, e) => s + e.otDays, 0),
    otAmount: employees.reduce((s, e) => s + e.otAmount, 0),
  }), [employees]);
  const noQuotaCount = employees.filter((e) => e.leaveQuota === null).length;
  const noLimitCount = employees.filter((e) => e.commissionLeaveLimit === null).length;

  // รอบเงินเดือนฉบับร่างในปีนี้ที่คิดจากข้อมูลการลาชุดเก่า (เช่น เพิ่งใส่ยอดย้อนหลังเดือนก่อน ๆ) → ต้องคำนวณใหม่
  const staleDrafts = runs.filter((r) => r.stale && r.status === "draft");
  const recalcMutation = useMutation({
    mutationFn: async (periods: string[]) => {
      for (const p of periods) await createOrRegeneratePayroll(p, { regenerate: true });
    },
    onSuccess: async (_r, periods) => {
      toast({ title: "คำนวณเงินเดือนใหม่แล้ว", description: periods.map(monthLabel).join(", ") });
      await qc.invalidateQueries({ queryKey: ["payroll"] });
      await invalidateLeaves();
    },
    onError: async (err: any) => {
      toast({ title: "คำนวณใหม่ไม่สำเร็จ", description: err.message || "", variant: "destructive" });
      await invalidateLeaves();
    },
  });

  const savingForm = addMutation.isPending || lumpMutation.isPending || otAddMutation.isPending || otLumpMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            บันทึกการลา / OT
          </h1>
          <p className="text-muted-foreground mt-1">
            ลาสะสมเกินวันที่ได้ต่อปี (ม.ค.–ธ.ค.) หักวันละ เงินเดือน ÷ {formatDays(divisor)} ในเดือนที่เกิน — หักจากคอมก่อน คอมไม่พอหักจากเงินเดือน
            · ลาในเดือนเกินเกณฑ์ = ไม่ได้คอมเดือนนั้น · หยุดรายอ {rayaPerYear} วัน/ปี ไม่นับเป็นวันลา
            · OT วันละ {formatCurrency(otRate)} บวกเข้าเงินเดือน
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
      {staleDrafts.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              ข้อมูลการลา/OT หรือค่าตั้งเปลี่ยนหลังคำนวณเงินเดือน <strong>{staleDrafts.map((r) => monthLabel(r.period)).join(", ")}</strong> — คำนวณใหม่เพื่อให้ยอดหักและค่า OT ในหน้าจ่ายเงินเดือนตรง
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => recalcMutation.mutate(staleDrafts.map((r) => r.period))}
            disabled={recalcMutation.isPending}
            className="shrink-0"
          >
            {recalcMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            คำนวณเงินเดือนใหม่{staleDrafts.length > 1 ? ` (${staleDrafts.length} เดือน)` : ""}
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
                {isOt
                  ? <><Clock className="h-5 w-5 text-blue-500" /> บันทึก OT</>
                  : <><CalendarOff className="h-5 w-5 text-rose-500" /> บันทึกวันลา</>}
              </CardTitle>
              <CardDescription>
                {mode === "dated"
                  ? `${isOt ? "ทำ OT " : "ลา"}หลายวันติดกัน ใส่ "ถึงวันที่" ได้เลย`
                  : "จำวันที่ไม่ได้ ใส่ยอดรวมของเดือนนั้นแทน — ใส่ใหม่จะแทนยอดเดิมของเดือนนั้น"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SegmentedButtons<"leave" | "ot">
                label="บันทึกอะไร"
                cols="grid-cols-2"
                value={kind}
                onChange={setKind}
                options={[{ value: "leave", label: "การลา" }, { value: "ot", label: `OT (${formatCurrency(otRate)}/วัน)` }]}
              />
              <SegmentedButtons<"dated" | "lump">
                label="วิธีบันทึก"
                cols="grid-cols-2"
                value={mode}
                onChange={setMode}
                options={[{ value: "dated", label: "ระบุวันที่" }, { value: "lump", label: isOt ? "ยอดรวมทั้งเดือน" : "ยอดย้อนหลังทั้งเดือน" }]}
              />

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

              {mode === "dated" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>{isOt ? "OT" : "ลา"}</Label>
                    <SegmentedButtons
                      label="ลาเต็มวันหรือครึ่งวัน"
                      cols="grid-cols-2"
                      value={halfDay ? "half" : "full"}
                      onChange={(v) => setHalfDay(v === "half")}
                      options={[{ value: "full", label: "เต็มวัน" }, { value: "half", label: "ครึ่งวัน" }]}
                    />
                  </div>

                  <div className={cn("grid gap-3", !halfDay && "grid-cols-2")}>
                    <div className="space-y-1.5">
                      <Label htmlFor="leave-start">{halfDay ? (isOt ? "วันที่ทำ OT" : "วันที่ลา") : (isOt ? "วันที่เริ่ม" : "วันที่เริ่มลา")}</Label>
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
                  {lumpInDatedMonth && (
                    <p className="text-xs text-amber-700">
                      ⚠️ เดือนนี้มียอดย้อนหลังทั้งเดือนอยู่แล้ว {formatDays(lumpInDatedMonth.days)} วัน — วันที่บันทึกนี้จะนับรวมเพิ่ม ถ้าเป็น{isOt ? " OT " : "วันลา"}เดียวกันให้แก้ยอดทั้งเดือนแทน
                    </p>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="lump-period">เดือน</Label>
                    <Select value={lumpPeriod} onValueChange={setLumpPeriod}>
                      <SelectTrigger id="lump-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lump-days">{isOt ? "OT กี่วัน" : "ลาไปกี่วัน"}</Label>
                    <Input
                      id="lump-days"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={31}
                      step={0.5}
                      value={lumpDays}
                      placeholder={existingLump ? `เดิม ${formatDays(existingLump.days)}` : "เช่น 2"}
                      onChange={(e) => setLumpDays(e.target.value)}
                    />
                  </div>
                  {existingLump && (
                    <p className="col-span-2 text-xs text-amber-700">
                      เดือนนี้มียอดย้อนหลังอยู่แล้ว {formatDays(existingLump.days)} วัน — บันทึกใหม่จะแทนที่ (ใส่ 0 = ลบ)
                    </p>
                  )}
                  {datedInLumpMonth > 0 && (
                    <p className="col-span-2 text-xs text-amber-700">
                      ⚠️ เดือนนี้มี{isOt ? " OT " : "วันลา"}แบบระบุวันที่อยู่แล้ว {formatDays(datedInLumpMonth)} วัน — ยอดย้อนหลังจะนับรวมเพิ่ม ใส่เฉพาะวันที่ยังไม่ได้บันทึก
                    </p>
                  )}
                </div>
              )}

              {!isOt && <div className="space-y-1.5">
                <Label>ประเภท</Label>
                <SegmentedButtons<LeaveType> label="ประเภทการลา" cols="grid-cols-2" value={leaveType} onChange={setLeaveType} options={LEAVE_TYPE_OPTIONS} />
                {leaveType === "raya" && (
                  <p className="text-xs text-emerald-700">
                    หยุดรายอไม่นับเป็นวันลา ได้ปีละ {rayaPerYear} วัน — เกินจากนี้นับเป็นวันลาปกติ
                    {formEmployee && ` · ${formEmployee.name} ใช้ไปแล้ว ${formatDays(formEmployee.rayaYearDays)} วันในปี ${buddhistYear(year)}`}
                  </p>
                )}
              </div>}

              <div className="space-y-1.5">
                <Label htmlFor="leave-note">หมายเหตุ</Label>
                <Input id="leave-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={isOt ? "เช่น อยู่ต่อจัดไลฟ์ / นับสต๊อก" : "เช่น ไปหาหมอ / ธุระที่บ้าน"} />
              </div>

              <Button
                className={cn("w-full bg-gradient-to-r", isOt ? "from-blue-500 to-indigo-500" : "from-rose-500 to-pink-500")}
                onClick={submitLeave}
                disabled={savingForm || (mode === "dated" && rangeInvalid)}
              >
                {savingForm ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : isOt ? <Clock className="h-4 w-4 mr-2" /> : <CalendarOff className="h-4 w-4 mr-2" />}
                {mode === "dated"
                  ? `บันทึก${isOt ? " OT" : "การลา"}${dayCount > 0 ? ` (${formatDays(dayCount)} วัน)` : ""}`
                  : isOt ? "บันทึกยอด OT ทั้งเดือน" : "บันทึกยอดย้อนหลัง"}
              </Button>
            </CardContent>
          </Card>

          {/* Monthly summary */}
          <Card className="xl:col-span-2 min-w-0">
            <CardHeader>
              <CardTitle className="text-lg">สรุปการลา / OT {monthLabel(selectedPeriod)}</CardTitle>
              <CardDescription>
                ลาเดือนนี้รวม {formatDays(totals.leaveDays)} วัน · ลาเกิน {totals.overCount} คน · หักรวมประมาณ {formatCurrency(totals.deduction)}
                {totals.forfeitCount > 0 && ` · ถูกตัดคอม ${totals.forfeitCount} คน`}
                {totals.otDays > 0 && ` · OT รวม ${formatDays(totals.otDays)} วัน ${formatCurrency(totals.otAmount)}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {noQuotaCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>ยังไม่ได้ตั้งวันลาที่ได้ต่อปี {noQuotaCount} คน — คนที่ยังไม่ตั้งจะไม่ถูกหัก (ตั้งได้ในตาราง "การลาทั้งปี" ด้านล่าง)</span>
                </div>
              )}
              {noLimitCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>ยังไม่ได้ตั้งเกณฑ์ตัดคอม {noLimitCount} คน — คนที่ยังไม่ตั้ง ลากี่วันก็ยังได้คอม (ตั้งได้ในตาราง "การลาทั้งปี" ด้านล่าง)</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead className="text-right">ลาเดือนนี้</TableHead>
                      <TableHead className="text-right whitespace-nowrap">สะสมทั้งปี / ได้</TableHead>
                      <TableHead className="text-right">เกินเดือนนี้</TableHead>
                      <TableHead className="text-right">หักวันละ</TableHead>
                      <TableHead className="text-right">ยอดหัก</TableHead>
                      <TableHead className="text-right whitespace-nowrap">คอมเดือนนี้</TableHead>
                      <TableHead className="text-right whitespace-nowrap">OT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={8} className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : employees.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">ไม่มีพนักงาน</TableCell></TableRow>
                    ) : employees.map((e) => {
                      const cumulative = e.usedBefore + e.leaveDays;
                      const over = e.leaveQuota !== null && cumulative > e.leaveQuota;
                      return (
                        <TableRow key={e.id} className={cn((e.excessDays > 0 || e.commissionForfeit) && "bg-red-50/60")}>
                          <TableCell>
                            <div className="font-medium">{e.name}</div>
                            <div className="text-xs text-muted-foreground">เงินเดือน {formatCurrency(e.salary)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            {e.leaveDays > 0 ? formatDays(e.leaveDays) : <span className="text-gray-400">0</span>}
                            {e.rayaDays > 0 && <div className="text-xs text-emerald-700 whitespace-nowrap">+ รายอ {formatDays(e.rayaDays)}</div>}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <span className={cn(over && "font-semibold text-red-600")}>{formatDays(cumulative)}</span>
                            <span className="text-muted-foreground"> / {e.leaveQuota === null ? "ไม่ตั้ง" : formatDays(e.leaveQuota)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {e.excessDays > 0 ? <span className="font-semibold text-red-600">{formatDays(e.excessDays)}</span> : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(e.dailyRate)}</TableCell>
                          <TableCell className="text-right">
                            {e.deduction > 0 ? <span className="font-semibold text-red-600">−{formatCurrency(e.deduction)}</span> : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {e.commissionLeaveLimit === null ? (
                              <span className="text-xs text-muted-foreground">ไม่ตั้งเกณฑ์</span>
                            ) : e.commissionForfeit ? (
                              <>
                                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">ตัดคอม</Badge>
                                <div className="text-xs text-muted-foreground">ลาเกิน {formatDays(e.commissionLeaveLimit)} วัน</div>
                              </>
                            ) : (
                              <span className="text-xs text-emerald-700">ได้คอม (ลาได้อีก {formatDays(e.commissionLeaveLimit - e.leaveDays)})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {e.otDays > 0 ? (
                              <>
                                <div className="font-semibold text-blue-700">+{formatCurrency(e.otAmount)}</div>
                                <div className="text-xs text-muted-foreground">{formatDays(e.otDays)} วัน</div>
                              </>
                            ) : <span className="text-gray-400">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Yearly overview */}
          <Card className="xl:col-span-3 min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarRange className="h-5 w-5 text-rose-500" /> การลาทั้งปี {buddhistYear(year)}
              </CardTitle>
              <CardDescription>จำนวนวันลารายคนรายเดือน · กดตัวเลขเพื่อดูรายการของเดือนนั้น</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/40 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="all-quota" className="text-sm">วันลาที่ได้ต่อปี — ตั้งให้ทุกคน</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="all-quota"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={366}
                      step={0.5}
                      value={allQuota}
                      onChange={(e) => setAllQuota(e.target.value)}
                      placeholder="เช่น 12"
                      className="h-9 w-24 text-right"
                    />
                    <span className="text-sm text-muted-foreground">วัน/ปี</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-9" onClick={applyAllQuota} disabled={quotaMutation.isPending || employees.length === 0}>
                  {savingQuotaFor === "yearly:all" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  ใช้กับทุกคน
                </Button>
                <div className="space-y-1.5 sm:ml-4">
                  <Label htmlFor="all-limit" className="text-sm">ลาในเดือนเกินกี่วัน ตัดคอม — ตั้งให้ทุกคน</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="all-limit"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={31}
                      step={0.5}
                      value={allLimit}
                      onChange={(e) => setAllLimit(e.target.value)}
                      placeholder="เช่น 5"
                      className="h-9 w-24 text-right"
                    />
                    <span className="text-sm text-muted-foreground">วัน/เดือน</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-9" onClick={applyAllLimit} disabled={quotaMutation.isPending || employees.length === 0}>
                  {savingQuotaFor === "commission:all" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  ใช้กับทุกคน
                </Button>
                <span className="text-xs text-muted-foreground basis-full">
                  แก้รายคนได้ในช่อง "ได้/ปี" และ "ตัดคอมถ้าลาเกิน" · เว้นว่าง = ยังไม่ตั้ง (ไม่หัก/ไม่ตัด) · วันลานับใหม่ทุก 1 ม.ค.
                  · ตัวเลขสีแดงในตาราง = เดือนที่ลาเกินเกณฑ์ (ไม่ได้คอม)
                </span>
                <div className="basis-full flex flex-wrap items-end gap-2 border-t pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="leave-divisor" className="text-sm">หักลาเกินวันละ — ทั้งร้าน</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">เงินเดือน ÷</span>
                      <Input
                        id="leave-divisor"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={31}
                        step={0.5}
                        value={divisorDraft}
                        onChange={(e) => setDivisorDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveDivisor(); }}
                        className="h-9 w-20 text-right"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={saveDivisor}
                    disabled={divisorMutation.isPending || !data || Number(divisorDraft) === divisor}
                  >
                    {divisorMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    บันทึกตัวหาร
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    ตอนนี้ ÷ {formatDays(divisor)} · เช่น ทำงาน 6 วัน/สัปดาห์ ≈ 26 วัน/เดือน · เดือนที่ปิดรอบแล้วใช้ตัวหารเดิม
                  </span>
                </div>
                <div className="basis-full flex flex-wrap items-end gap-2 border-t pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ot-rate" className="text-sm">ค่า OT — ทั้งร้าน</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">วันละ</span>
                      <Input
                        id="ot-rate"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={10000}
                        value={otRateDraft}
                        onChange={(e) => setOtRateDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveOtRate(); }}
                        className="h-9 w-24 text-right"
                      />
                      <span className="text-sm text-muted-foreground">บาท</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={saveOtRate}
                    disabled={otRateMutation.isPending || !data || Number(otRateDraft) === otRate}
                  >
                    {otRateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    บันทึกค่า OT
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    ตอนนี้วันละ {formatCurrency(otRate)} · ครึ่งวัน = ครึ่งราคา · เดือนที่ปิดรอบแล้วใช้ค่าเดิม
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-background min-w-[120px]">พนักงาน</TableHead>
                      {MONTH_SHORT.map((m, i) => (
                        <TableHead key={m} className={cn("text-center px-1.5 whitespace-nowrap", i === selectedMonthIdx && "bg-rose-50 text-rose-700")}>{m}</TableHead>
                      ))}
                      <TableHead className="text-right whitespace-nowrap">รวม</TableHead>
                      <TableHead className="text-right whitespace-nowrap">ได้/ปี</TableHead>
                      <TableHead className="text-right whitespace-nowrap">คงเหลือ</TableHead>
                      <TableHead className="text-right whitespace-nowrap">รายอ</TableHead>
                      <TableHead className="text-right whitespace-nowrap">ตัดคอมถ้าลาเกิน</TableHead>
                      <TableHead className="text-right whitespace-nowrap">OT ทั้งปี</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow><TableCell colSpan={19} className="py-8 text-center text-muted-foreground">{isLoading ? "กำลังโหลด..." : "ไม่มีพนักงาน"}</TableCell></TableRow>
                    ) : employees.map((e) => {
                      const remaining = e.leaveQuota === null ? null : e.leaveQuota - e.yearDays;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="sticky left-0 z-10 bg-background font-medium whitespace-nowrap">{e.name}</TableCell>
                          {e.months.map((d, i) => {
                            const raya = e.rayaMonths?.[i] || 0;
                            const forfeit = e.commissionLeaveLimit !== null && d > e.commissionLeaveLimit;
                            return (
                              <TableCell key={i} className={cn("text-center px-1", i === selectedMonthIdx && "bg-rose-50/60")}>
                                {d > 0 || raya > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => openMonth(e.id, i)}
                                    className={cn(
                                      "min-h-0 min-w-0 rounded px-1.5 py-0.5 font-medium underline-offset-2 hover:bg-rose-100 hover:underline",
                                      forfeit ? "bg-red-100 text-red-700" : "text-rose-700",
                                    )}
                                    aria-label={`ดูการลา ${e.name} ${MONTH_SHORT[i]} ${formatDays(d)} วัน${raya > 0 ? ` หยุดรายอ ${formatDays(raya)} วัน` : ""}${forfeit ? " ตัดคอม" : ""}`}
                                  >
                                    {d > 0 ? formatDays(d) : ""}
                                    {raya > 0 && <span className="block text-[10px] leading-tight text-emerald-700">รายอ {formatDays(raya)}</span>}
                                  </button>
                                ) : (
                                  <span className="text-gray-300">·</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-semibold">{formatDays(e.yearDays)}</TableCell>
                          <TableCell className="text-right">
                            <QuotaInput
                              label={`วันลาที่ได้ต่อปีของ ${e.name}`}
                              value={e.leaveQuota}
                              saving={savingQuotaFor === `yearly:${e.id}`}
                              onSave={(quota) => { if (confirmClosedMonths(`${year}-01`)) quotaMutation.mutate({ target: { employeeId: e.id }, quota, kind: "yearly" }); }}
                            />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {remaining === null ? (
                              <span className="text-gray-400">—</span>
                            ) : remaining >= 0 ? (
                              <span className="text-emerald-700">เหลือ {formatDays(remaining)}</span>
                            ) : (
                              <span className="font-semibold text-red-600">เกิน {formatDays(-remaining)}</span>
                            )}
                          </TableCell>
                          <TableCell className={cn("text-right whitespace-nowrap", e.rayaYearDays > rayaPerYear && "font-semibold text-red-600")}>
                            {formatDays(e.rayaYearDays)}/{rayaPerYear}
                          </TableCell>
                          <TableCell className="text-right">
                            <QuotaInput
                              label={`ลาในเดือนเกินกี่วันตัดคอมของ ${e.name}`}
                              value={e.commissionLeaveLimit}
                              max={31}
                              saving={savingQuotaFor === `commission:${e.id}`}
                              onSave={(quota) => { if (confirmClosedMonths(`${year}-01`)) quotaMutation.mutate({ target: { employeeId: e.id }, quota, kind: "commission" }); }}
                            />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {e.otYearDays > 0 ? <span className="font-medium text-blue-700">{formatDays(e.otYearDays)} วัน</span> : <span className="text-gray-400">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Leave list */}
          <Card ref={listRef} className="xl:col-span-3 min-w-0 scroll-mt-4">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5 text-rose-500" /> รายการลา / OT {monthLabel(selectedPeriod)}
                </CardTitle>
                <CardDescription>{shownRows.length} รายการ</CardDescription>
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
                    {shownRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          {isLoading ? "กำลังโหลด..." : "ยังไม่มีการลาหรือ OT ในเดือนนี้"}
                        </TableCell>
                      </TableRow>
                    ) : shownRows.map((row) => {
                      const l = row.item;
                      const isOtRow = row.kind === "ot";
                      const name = employeeName(l.employeeId, l.employeeName);
                      const what = isOtRow ? "OT" : "วันลา";
                      const when = l.isLump ? `ยอดทั้งเดือน ${monthLabel(l.date.slice(0, 7))}` : leaveDateLabel(l.date);
                      const deleting = isOtRow ? otDeleteMutation.isPending : deleteMutation.isPending;
                      return (
                        <TableRow key={`${row.kind}-${l.id}`} className={cn(l.isLump && "bg-violet-50/50")}>
                          <TableCell className="whitespace-nowrap">
                            {l.isLump ? (
                              <span className="inline-flex items-center gap-1 text-violet-700">
                                <History className="h-3.5 w-3.5" /> ทั้งเดือน (ไม่ระบุวันที่)
                              </span>
                            ) : leaveDateLabel(l.date)}
                          </TableCell>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {l.isLump ? `${formatDays(l.days)} วัน` : l.days === 0.5 ? "ครึ่งวัน" : "เต็มวัน"}
                          </TableCell>
                          <TableCell>
                            {row.kind === "ot" ? (
                              <Badge variant="outline" className="font-medium whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200">OT</Badge>
                            ) : (
                              <Badge variant="outline" className={cn("font-medium whitespace-nowrap", TYPE_BADGE[row.item.leaveType] ?? TYPE_BADGE.other)}>
                                {LEAVE_TYPE_LABEL[row.item.leaveType] ?? LEAVE_TYPE_LABEL.other}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[240px]">{l.note || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{l.recordedBy || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              aria-label={`ลบ${what} ${name} ${when}`}
                              disabled={deleting}
                              onClick={() => {
                                if (!confirm(`ลบ${what} ${name} ${when}?`) || !confirmClosedMonths(l.date.slice(0, 7))) return;
                                if (isOtRow) otDeleteMutation.mutate(l.id);
                                else deleteMutation.mutate(l.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
