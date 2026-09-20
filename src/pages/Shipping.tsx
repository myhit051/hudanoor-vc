"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Truck, Search, Printer, MapPin, Clock, CheckCircle2, Undo2, ChevronDown, AlertTriangle, Loader2, PackageOpen, PackageCheck, HandCoins
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { getSalesOrders, groupSalesByOrder, updateShippingStatus, OrderSummary, ShippingStatus } from "@/lib/sales-api";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";

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

const STATUS_META: Record<ShippingStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: {
    label: 'รอส่ง',
    icon: Clock,
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  },
  preparing: {
    label: 'เตรียมจัดส่ง',
    icon: PackageCheck,
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800'
  },
  shipped: {
    label: 'ส่งแล้ว',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  },
  returned: {
    label: 'ตีกลับ',
    icon: Undo2,
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  }
};
const STATUS_KEYS = Object.keys(STATUS_META) as ShippingStatus[];

type LabelSize = 'sticker' | 'a4' | 'a4-8';

// ขนาดเป็น px ที่ 96dpi — สติ๊กเกอร์ 100×150 มม. / A4 แบ่ง 4 ช่อง (105×148.5 มม.) / A4 แบ่ง 8 ช่อง (105×74 มม.)
const PX_PER_MM = 96 / 25.4;
const LABEL_SIZES: Record<LabelSize, { label: string; pageMm: [number, number]; cols: number; rows: number; compact: boolean }> = {
  sticker: { label: 'สติ๊กเกอร์ 100×150 มม. (1 ใบ/หน้า)', pageMm: [100, 150], cols: 1, rows: 1, compact: false },
  a4: { label: 'กระดาษ A4 (4 ใบ/หน้า)', pageMm: [210, 297], cols: 2, rows: 2, compact: false },
  'a4-8': { label: 'กระดาษ A4 (8 ใบ/หน้า)', pageMm: [210, 297], cols: 2, rows: 4, compact: true }
};
const MAX_COMPACT_ITEMS = 2;
// ที่อยู่ร้านยาวเกินจะไปเบียดช่องที่อยู่ผู้รับในใบปะหน้าแบบย่อ — ตัดให้เหลือราว 2 บรรทัด
const MAX_COMPACT_SENDER_ADDRESS = 110;

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
const MAX_LABEL_ITEMS = 6;

const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// กรอบ COD พื้นขาวขอบดำหนา ตัวใหญ่ — เห็นชัดว่าต้องเก็บเงินเท่าไหร่ และไม่เปลืองหมึก (บอสขอเลิกใช้แถบพื้นดำ)
function CodBanner({ amount, compact }: { amount: number; compact?: boolean }) {
  return (
    <div
      style={{
        background: '#fff', color: '#000', border: `${compact ? 2 : 3}px solid #000`, borderRadius: compact ? '4px' : '6px',
        padding: compact ? '0 8px 2px' : '4px 12px 6px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexShrink: 0, lineHeight: 1.5
      }}
    >
      <div>
        <span style={{ fontSize: compact ? '20px' : '32px', fontWeight: 800, letterSpacing: '1px' }}>COD</span>
        <span style={{ fontSize: compact ? '10px' : '14px', fontWeight: 700, marginLeft: compact ? '6px' : '10px' }}>เก็บเงินปลายทาง</span>
      </div>
      <span style={{ fontSize: compact ? '20px' : '32px', fontWeight: 800 }}>{baht(amount)}</span>
    </div>
  );
}

interface Sender {
  name: string;
  phone: string;
  address: string;
}

function StatusBadge({ status }: { status: ShippingStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px] px-2 py-0.5 font-medium", meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

// ใบปะหน้าแบบย่อสำหรับช่องเล็ก (A4 8 ใบ/หน้า) — เน้นที่อยู่ผู้รับ ย่อผู้ส่งและรายการสินค้าเหลือบรรทัดเดียว
function CompactShippingLabel({ order, sender }: { order: OrderSummary; sender: Sender }) {
  const items = order.items.slice(0, MAX_COMPACT_ITEMS);
  const more = order.items.length - items.length;
  const itemText = items
    .map(i => `${i.sku} ${i.product_name}${[i.color, i.size].filter(Boolean).length ? ` ${[i.color, i.size].filter(Boolean).join('/')}` : ''} ×${i.quantity}`)
    .join(', ') + (more > 0 ? ` +อีก ${more} รายการ` : '');
  return (
    <div
      style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '8px 10px', fontFamily: "'Noto Sans Thai', sans-serif", color: '#000', background: '#fff', display: 'flex', flexDirection: 'column', gap: '4px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', lineHeight: 1.45 }}>
        <div style={{ minWidth: 0, fontSize: '8.5px' }}>
          <div>
            <span style={{ fontWeight: 600 }}>ผู้ส่ง </span>
            <span style={{ fontWeight: 700, fontSize: '10px' }}>{sender.name}</span>
            {sender.phone && <span> โทร {sender.phone}</span>}
          </div>
          {sender.address && <div>{truncate(sender.address.replace(/\s*\n\s*/g, ' '), MAX_COMPACT_SENDER_ADDRESS)}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '8.5px' }}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, border: '1.2px solid #000', padding: '1px 6px 3px', borderRadius: '3px', lineHeight: 1.6 }}>{order.order_id}</div>
          <div style={{ marginTop: '1px' }}>{formatDate(order.date)}</div>
        </div>
      </div>

      {order.payment_method === 'cod' && <CodBanner amount={order.total_amount} compact />}

      <div style={{ border: '1.5px solid #000', borderRadius: '5px', padding: '5px 8px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, lineHeight: 1.5 }}>ผู้รับ</div>
        <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'pre-line', lineHeight: 1.4, wordBreak: 'break-word' }}>
          {order.shipping_address}
        </div>
      </div>

      <div style={{ fontSize: '8.5px', lineHeight: 1.6, flexShrink: 0 }}>
        <span style={{ fontWeight: 700 }}>สินค้า {order.total_quantity} ชิ้น: </span>{itemText}
      </div>
    </div>
  );
}

// ใบปะหน้า 1 ใบ — ใช้สีดำล้วนและตัวหนังสือใหญ่เพื่อให้ปริ้นขาวดำแล้วอ่านง่าย
function ShippingLabel({ order, sender }: { order: OrderSummary; sender: Sender }) {
  const items = order.items.slice(0, MAX_LABEL_ITEMS);
  const more = order.items.length - items.length;
  return (
    <div
      style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '14px', fontFamily: "'Noto Sans Thai', sans-serif", color: '#000', background: '#fff', display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '10px', fontWeight: 600 }}>ผู้ส่ง</div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>{sender.name}</div>
          {sender.phone && <div style={{ fontSize: '11px' }}>โทร {sender.phone}</div>}
          {sender.address && <div style={{ fontSize: '10px', whiteSpace: 'pre-line', lineHeight: 1.35 }}>{sender.address}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, border: '1.5px solid #000', padding: '3px 8px 5px', borderRadius: '4px', lineHeight: 1.6 }}>{order.order_id}</div>
          <div style={{ fontSize: '10px', marginTop: '3px' }}>{formatDate(order.date)}</div>
          {order.branch_or_platform && <div style={{ fontSize: '10px' }}>{order.branch_or_platform}</div>}
        </div>
      </div>

      {order.payment_method === 'cod' && <CodBanner amount={order.total_amount} />}

      <div style={{ border: '2px solid #000', borderRadius: '6px', padding: '10px 12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>ผู้รับ</div>
        <div style={{ fontSize: '16px', fontWeight: 600, whiteSpace: 'pre-line', lineHeight: 1.45, wordBreak: 'break-word' }}>
          {order.shipping_address}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '2px' }}>
          รายการสินค้า ({order.total_quantity} ชิ้น)
        </div>
        {items.map(item => (
          <div key={item.id} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', gap: '6px', lineHeight: 1.6 }}>
            <span>
              {item.sku} {item.product_name}{[item.color, item.size].filter(Boolean).length ? ` · ${[item.color, item.size].filter(Boolean).join(' / ')}` : ''}
            </span>
            <span style={{ flexShrink: 0, fontWeight: 700 }}>×{item.quantity}</span>
          </div>
        ))}
        {more > 0 && <div style={{ fontSize: '10px' }}>และอีก {more} รายการ</div>}
      </div>
    </div>
  );
}

export function Shipping() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();

  const [channel, setChannel] = useState<'online' | 'store' | 'all'>('online');
  const [statusFilter, setStatusFilter] = useState<ShippingStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(toLocalDateStr(new Date()));
  const [search, setSearch] = useState('');
  const [addressOnly, setAddressOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [labelSize, setLabelSize] = useState<LabelSize>('sticker');
  const [printOrders, setPrintOrders] = useState<OrderSummary[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', { view: 'shipping', date_from: dateFrom, date_to: dateTo }],
    queryFn: () => getSalesOrders({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false
  });

  const statusMutation = useMutation({
    mutationFn: updateShippingStatus,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast({ title: 'อัปเดตสถานะแล้ว', description: `${vars.order_ids.length} ออเดอร์ → ${STATUS_META[vars.shipping_status].label}` });
      // เอาเฉพาะออเดอร์ที่เพิ่งอัปเดตออกจากรายการที่เลือก ที่เลือกไว้อื่น ๆ ยังอยู่
      setSelected(prev => prev.filter(id => !vars.order_ids.includes(id)));
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  });

  const sender: Sender = {
    name: settings?.storeName || 'HUDANOOR',
    phone: settings?.storePhone || '',
    address: settings?.storeAddress || ''
  };

  // เฉพาะออเดอร์ที่มีเลขออเดอร์ (ข้อมูลเก่าจาก Sheet ไม่มีสถานะจัดส่ง)
  const orders = useMemo(
    () => groupSalesByOrder(sales).filter(o => o.order_id && (channel === 'all' || o.channel === channel)),
    [sales, channel]
  );

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = addressOnly ? orders.filter(o => o.shipping_address?.trim()) : orders;
    if (!q) return base;
    return base.filter(o =>
      [o.order_id, o.shipping_address, o.branch_or_platform, o.recorded_by, ...o.items.map(i => `${i.sku} ${i.product_name}`)]
        .join(' ').toLowerCase().includes(q)
    );
  }, [orders, search, addressOnly]);

  const counts = useMemo(() => {
    const c: Record<ShippingStatus | 'all', number> = { all: searched.length, pending: 0, preparing: 0, shipped: 0, returned: 0 };
    for (const o of searched) c[o.shipping_status] += 1;
    return c;
  }, [searched]);

  const visible = useMemo(
    () => statusFilter === 'all' ? searched : searched.filter(o => o.shipping_status === statusFilter),
    [searched, statusFilter]
  );

  const visibleIds = visible.map(o => o.order_id);
  const selectedVisible = selected.filter(id => visibleIds.includes(id));
  const allChecked = visible.length > 0 && selectedVisible.length === visible.length;

  const toggleOne = (id: string, checked: boolean) =>
    setSelected(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? visibleIds : []);

  const setStatus = (order_ids: string[], shipping_status: ShippingStatus) => {
    if (order_ids.length === 0) return;
    statusMutation.mutate({ order_ids, shipping_status });
  };

  const handleExportPDF = async () => {
    const chosen = visible.filter(o => selectedVisible.includes(o.order_id));
    const printable = chosen.filter(o => o.shipping_address?.trim());
    const skipped = chosen.length - printable.length;
    if (printable.length === 0) {
      toast({ title: 'ไม่มีออเดอร์ที่มีที่อยู่จัดส่ง', description: 'กรุณาเลือกออเดอร์ที่กรอกที่อยู่ไว้แล้ว', variant: 'destructive' });
      return;
    }

    setIsExporting(true);
    setPrintOrders(printable);
    try {
      // รอให้ React วาดใบปะหน้าลงพื้นที่ซ่อนก่อนจับภาพ
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await document.fonts?.ready;

      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const size = LABEL_SIZES[labelSize];
      const pdf = new JsPDF({ unit: "mm", format: size.pageMm, orientation: "portrait" });
      const pages = printRef.current?.querySelectorAll<HTMLElement>('[data-label-page]') ?? [];

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2.5, backgroundColor: "#ffffff", logging: false });
        if (i > 0) pdf.addPage(size.pageMm, "portrait");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, size.pageMm[0], size.pageMm[1]);
      }

      pdf.save(`ใบปะหน้า-${toLocalDateStr(new Date())}-${printable.length}ออเดอร์.pdf`);

      // พิมพ์ใบปะหน้าแล้ว → เลื่อนสถานะ "รอส่ง" เป็น "เตรียมจัดส่ง" อัตโนมัติ (ส่งแล้ว/ตีกลับ ไม่แตะ)
      const toPrepare = printable.filter(o => o.shipping_status === 'pending').map(o => o.order_id);
      let statusNote = '';
      if (toPrepare.length > 0) {
        try {
          await updateShippingStatus({ order_ids: toPrepare, shipping_status: 'preparing' });
          queryClient.invalidateQueries({ queryKey: ['sales'] });
          setSelected(prev => prev.filter(id => !toPrepare.includes(id)));
          statusNote = `เปลี่ยน ${toPrepare.length} ออเดอร์เป็น "เตรียมจัดส่ง" แล้ว`;
        } catch (e) {
          console.error("Auto status update failed:", e);
          statusNote = 'แต่เปลี่ยนสถานะเป็น "เตรียมจัดส่ง" ไม่สำเร็จ กรุณาเปลี่ยนเอง';
        }
      }
      toast({
        title: `สร้างไฟล์ PDF แล้ว (${printable.length} ใบ)`,
        description: [
          statusNote,
          skipped > 0 ? `ข้าม ${skipped} ออเดอร์ที่ยังไม่มีที่อยู่จัดส่ง` : '',
          'ส่งของแล้วอย่าลืมเปลี่ยนสถานะเป็น "ส่งแล้ว"'
        ].filter(Boolean).join(' · ')
      });
    } catch (e) {
      console.error("PDF export failed:", e);
      toast({ title: 'ไม่สามารถสร้างไฟล์ PDF ได้', variant: 'destructive' });
    } finally {
      setIsExporting(false);
      setPrintOrders([]);
    }
  };

  // แบ่งใบปะหน้าเป็นหน้า ๆ ตามขนาดกระดาษ
  const size = LABEL_SIZES[labelSize];
  const printPages: OrderSummary[][] = [];
  const perPage = size.cols * size.rows;
  for (let i = 0; i < printOrders.length; i += perPage) {
    printPages.push(printOrders.slice(i, i + perPage));
  }
  const pageW = size.pageMm[0] * PX_PER_MM;
  const pageH = size.pageMm[1] * PX_PER_MM;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
            <Truck className="h-5 w-5 text-white" />
          </div>
          จัดส่ง
        </h1>
        <p className="text-muted-foreground text-sm mt-1 ml-11">เลือกออเดอร์เพื่อพิมพ์ใบปะหน้า และติดตามสถานะการส่ง</p>
      </div>

      {/* ตัวกรอง */}
      <Card className="card-elevated">
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">ช่องทาง</Label>
              <Select value={channel} onValueChange={v => { setChannel(v as typeof channel); setSelected([]); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">ออนไลน์</SelectItem>
                  <SelectItem value="store">หน้าร้าน</SelectItem>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ship_from" className="text-xs">ตั้งแต่วันที่</Label>
              <Input id="ship_from" type="date" className="mt-1" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ship_to" className="text-xs">ถึงวันที่</Label>
              <Input id="ship_to" type="date" className="mt-1" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="col-span-2 lg:col-span-1">
              <Label htmlFor="ship_search" className="text-xs">ค้นหา</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="ship_search" className="pl-9" placeholder="เลขออเดอร์ ชื่อ เบอร์ สินค้า" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {/* แท็บสถานะ */}
          <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="กรองตามสถานะจัดส่ง">
            {(['all', ...STATUS_KEYS] as const).map(key => {
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer",
                    active
                      ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700"
                  )}
                >
                  {key === 'all' ? 'ทั้งหมด' : STATUS_META[key].label}
                  <span className={cn("ml-1.5 tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{counts[key]}</span>
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none md:ml-auto">
            <Switch checked={addressOnly} onCheckedChange={setAddressOnly} className="min-h-0 min-w-0" />
            เฉพาะออเดอร์ที่มีที่อยู่
          </label>
          </div>
        </CardContent>
      </Card>

      {/* แถบคำสั่งสำหรับออเดอร์ที่เลือก */}
      <Card className="card-elevated sticky top-14 lg:top-2 z-20">
        <CardContent className="py-3 flex flex-col md:flex-row md:items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <Checkbox className="min-h-0 min-w-0" checked={allChecked} onCheckedChange={v => toggleAll(v === true)} disabled={visible.length === 0} aria-label="เลือกทั้งหมด" />
            {selectedVisible.length > 0 ? `เลือกแล้ว ${selectedVisible.length} ออเดอร์` : `เลือกทั้งหมด (${visible.length})`}
          </label>
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <Select value={labelSize} onValueChange={v => setLabelSize(v as LabelSize)}>
              <SelectTrigger className="w-[230px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(LABEL_SIZES) as LabelSize[]).map(k => (
                  <SelectItem key={k} value={k}>{LABEL_SIZES[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-9 bg-gradient-to-r from-sky-500 to-blue-600 text-white"
              disabled={selectedVisible.length === 0 || isExporting}
              onClick={handleExportPDF}
            >
              {isExporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Printer className="h-4 w-4 mr-1.5" />}
              พิมพ์ใบปะหน้า (PDF)
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9" disabled={selectedVisible.length === 0 || statusMutation.isPending}>
                  เปลี่ยนสถานะ <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {STATUS_KEYS.map(k => {
                  const Icon = STATUS_META[k].icon;
                  return (
                    <DropdownMenuItem key={k} onClick={() => setStatus(selectedVisible, k)}>
                      <Icon className="h-4 w-4 mr-2" />{STATUS_META[k].label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* รายการออเดอร์ */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <PackageOpen className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">ไม่พบออเดอร์ในช่วงนี้</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map(order => {
            const checked = selectedVisible.includes(order.order_id);
            const hasAddress = !!order.shipping_address?.trim();
            return (
              <Card
                key={order.order_id}
                className={cn(
                  "card-elevated transition-colors",
                  checked && "ring-2 ring-sky-400 border-sky-300"
                )}
              >
                <CardContent className="p-4 flex gap-3">
                  <Checkbox
                    className="mt-1 shrink-0 min-h-0 min-w-0"
                    checked={checked}
                    onCheckedChange={v => toggleOne(order.order_id, v === true)}
                    aria-label={`เลือก ${order.order_id}`}
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{order.order_id}</span>
                      <StatusBadge status={order.shipping_status} />
                      {order.payment_method === 'cod' && (
                        <Badge className="gap-1 text-[11px] px-2 py-0.5 bg-amber-500 hover:bg-amber-500 text-white border-0">
                          <HandCoins className="h-3 w-3" />
                          COD เก็บ {baht(order.total_amount)}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(order.date)} · {order.channel === 'store' ? 'หน้าร้าน' : 'ออนไลน์'}
                        {order.branch_or_platform ? ` · ${order.branch_or_platform}` : ''}
                      </span>
                      <span className="ml-auto text-sm font-bold text-rose-600 tabular-nums">
                        ฿{order.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {hasAddress ? (
                      <div className="flex gap-1.5 text-sm">
                        <MapPin className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                        <p className="whitespace-pre-line text-gray-700 dark:text-gray-300 line-clamp-3">{order.shipping_address}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        ไม่มีที่อยู่จัดส่ง (พิมพ์ใบปะหน้าไม่ได้)
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {order.items.map(i => `${i.sku ? `${i.sku} ` : ''}${i.product_name}${i.size ? ` ${i.size}` : ''} ×${i.quantity}`).join(', ')}
                      </p>
                      <div className="ml-auto flex gap-1 shrink-0">
                        {STATUS_KEYS.filter(k => k !== order.shipping_status).map(k => {
                          const Icon = STATUS_META[k].icon;
                          return (
                            <Button
                              key={k}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              disabled={statusMutation.isPending}
                              onClick={() => setStatus([order.order_id], k)}
                            >
                              <Icon className="h-3.5 w-3.5 mr-1" />{STATUS_META[k].label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* พื้นที่ซ่อนสำหรับวาดใบปะหน้าก่อนแปลงเป็น PDF */}
      {printPages.length > 0 && (
        <div ref={printRef} aria-hidden style={{ position: 'fixed', left: '-10000px', top: 0 }}>
          {printPages.map((page, pi) => (
            <div
              key={pi}
              data-label-page
              style={{
                width: `${pageW}px`,
                height: `${pageH}px`,
                background: '#fff',
                display: 'grid',
                gridTemplateColumns: `repeat(${size.cols}, 1fr)`,
                gridTemplateRows: `repeat(${size.rows}, 1fr)`
              }}
            >
              {page.map((order, oi) => (
                <div
                  key={order.order_id}
                  style={{
                    minHeight: 0,
                    overflow: 'hidden',
                    // เส้นประไว้ตัดระหว่างช่อง
                    borderRight: size.cols > 1 && oi % size.cols < size.cols - 1 ? '1px dashed #999' : undefined,
                    borderBottom: Math.floor(oi / size.cols) < size.rows - 1 ? '1px dashed #999' : undefined
                  }}
                >
                  {size.compact
                    ? <CompactShippingLabel order={order} sender={sender} />
                    : <ShippingLabel order={order} sender={sender} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
