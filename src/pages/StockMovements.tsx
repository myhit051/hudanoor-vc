"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeftRight, Search, PackagePlus, ShoppingCart, PencilLine, Trash2, Undo2, Info, PackageOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStockMovements, StockMovement, StockMovementType } from "@/lib/stock-api";

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateStr(d);
};

const TYPE_META: Record<StockMovementType, { label: string; icon: typeof PackagePlus; className: string }> = {
  in: { label: 'รับเข้า', icon: PackagePlus, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_edit: { label: 'แก้จำนวนรับเข้า', icon: PencilLine, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_delete: { label: 'ลบล็อตรับเข้า', icon: Trash2, className: 'bg-red-50 text-red-700 border-red-200' },
  sale: { label: 'ขายออก', icon: ShoppingCart, className: 'bg-sky-50 text-sky-700 border-sky-200' },
  sale_edit: { label: 'แก้ไขออเดอร์', icon: PencilLine, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  sale_delete: { label: 'ลบออเดอร์ (คืนสต๊อก)', icon: Undo2, className: 'bg-red-50 text-red-700 border-red-200' }
};

const FILTERS = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'in', label: 'รับเข้า' },
  { key: 'sale', label: 'ขายออก' },
  { key: 'edit', label: 'แก้ไข' },
  { key: 'delete', label: 'ลบ' }
] as const;

const LIMIT = 1000;

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok'
  }).format(new Date(iso));

const productLabel = (m: StockMovement) => [m.color, m.size].filter(Boolean).join(' · ');

function TypeBadge({ type }: { type: StockMovementType }) {
  const meta = TYPE_META[type] ?? TYPE_META.in;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px] px-2 py-0.5 font-medium whitespace-nowrap", meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function QtyChange({ n }: { n: number }) {
  return (
    <span className={cn("font-bold tabular-nums", n > 0 ? "text-emerald-600" : n < 0 ? "text-red-600" : "text-muted-foreground")}>
      {n > 0 ? `+${n}` : n}
    </span>
  );
}

export function StockMovements() {
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(toLocalDateStr(new Date()));
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const q = useDeferredValue(search.trim());

  // วันที่ตามเวลาไทยของเครื่อง → ช่วงเวลา ISO (ถึง = ต้นวันถัดไป)
  const range = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined;
    let to: string | undefined;
    if (dateTo) {
      const end = new Date(`${dateTo}T00:00:00`);
      end.setDate(end.getDate() + 1);
      to = end.toISOString();
    }
    return { from, to };
  }, [dateFrom, dateTo]);

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stock-movements', { ...range, q, type }],
    queryFn: () => getStockMovements({ ...range, q: q || undefined, type: type || undefined, limit: LIMIT }),
    staleTime: 15 * 1000
  });

  const totals = useMemo(() => {
    let plus = 0, minus = 0;
    for (const m of movements) {
      const n = Number(m.qty_change) || 0;
      if (n > 0) plus += n; else minus += n;
    }
    return { plus, minus };
  }, [movements]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
            <ArrowLeftRight className="h-5 w-5 text-white" />
          </div>
          ความเคลื่อนไหวสต๊อก
        </h1>
        <p className="text-muted-foreground text-sm mt-1 ml-11">สต๊อกเข้า-ออกทุกครั้ง เรียงจากล่าสุด — ใคร ทำอะไร เมื่อไหร่ ออเดอร์ไหน</p>
      </div>

      <Card className="card-elevated">
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="mv_from" className="text-xs">ตั้งแต่วันที่</Label>
              <Input id="mv_from" type="date" className="mt-1" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="mv_to" className="text-xs">ถึงวันที่</Label>
              <Input id="mv_to" type="date" className="mt-1" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="mv_search" className="text-xs">ค้นหา</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="mv_search" className="pl-9" placeholder="รหัสสินค้า ชื่อสินค้า หรือเลขออเดอร์" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="กรองตามประเภท">
              {FILTERS.map(f => {
                const active = type === f.key;
                return (
                  <button
                    key={f.key || 'all'}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setType(f.key)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer",
                      active
                        ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700"
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="md:ml-auto flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{movements.length.toLocaleString('th-TH')} รายการ</span>
              <span>เข้า <span className="font-bold text-emerald-600 tabular-nums">+{totals.plus.toLocaleString('th-TH')}</span></span>
              <span>ออก <span className="font-bold text-red-600 tabular-nums">{totals.minus.toLocaleString('th-TH')}</span></span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          ประวัติการแก้ไขและการลบเริ่มบันทึกตั้งแต่ 19 ก.ย. 2569 — ก่อนหน้านั้นมีแค่รับเข้าและขายออกที่ยังอยู่ในระบบ ·
          ออเดอร์กรอกผิด แก้ได้ที่หน้า "ประวัติการขาย" → เปิดออเดอร์ → ปุ่ม "แก้ไขสินค้า"
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : movements.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <PackageOpen className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">ไม่มีความเคลื่อนไหวในช่วงนี้</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* คอม: ตาราง */}
          <Card className="card-elevated hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">เวลา</TableHead>
                  <TableHead className="w-[150px]">ประเภท</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead className="w-[70px] text-right">จำนวน</TableHead>
                  <TableHead>ออเดอร์ / รายละเอียด</TableHead>
                  <TableHead className="w-[100px]">โดย</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatTime(m.created_at)}</TableCell>
                    <TableCell className="py-2.5"><TypeBadge type={m.type} /></TableCell>
                    <TableCell className="py-2.5">
                      <span className="font-mono text-xs text-muted-foreground mr-1.5">{m.sku}</span>
                      <span className="font-medium">{m.product_name}</span>
                      {productLabel(m) && <span className="text-xs text-muted-foreground"> · {productLabel(m)}</span>}
                    </TableCell>
                    <TableCell className="py-2.5 text-right"><QtyChange n={Number(m.qty_change)} /></TableCell>
                    <TableCell className="py-2.5 text-xs">
                      {m.order_id && <span className="font-semibold mr-1.5">{m.order_id}</span>}
                      <span className="text-muted-foreground">{m.detail}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs">{m.recorded_by || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* มือถือ: การ์ด */}
          <div className="md:hidden space-y-2">
            {movements.map(m => (
              <Card key={m.id} className="card-elevated">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <TypeBadge type={m.type} />
                    <QtyChange n={Number(m.qty_change)} />
                  </div>
                  <div className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground mr-1.5">{m.sku}</span>
                    <span className="font-medium">{m.product_name}</span>
                    {productLabel(m) && <span className="text-xs text-muted-foreground"> · {productLabel(m)}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.order_id && <span className="font-semibold text-foreground mr-1.5">{m.order_id}</span>}
                    {m.detail}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{formatTime(m.created_at)} · โดย {m.recorded_by || '-'}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {movements.length >= LIMIT && (
            <p className="text-center text-xs text-muted-foreground">แสดง {LIMIT.toLocaleString('th-TH')} รายการล่าสุด — ลองเลือกช่วงวันที่ให้แคบลงหรือค้นหาเพื่อดูเพิ่ม</p>
          )}
        </>
      )}
    </div>
  );
}
