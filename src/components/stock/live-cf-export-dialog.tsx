import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CfVariant, getCfVariants, updateCfCode } from "@/lib/stock-api";
import { toast } from "@/hooks/use-toast";

const CF_CODE_RE = /^[A-Z]{1,4}\d{1,4}$/;

const variantKey = (v: Pick<CfVariant, 'sku' | 'color' | 'size'>) => `${v.sku}|${v.color}|${v.size}`;
const variantLabel = (v: CfVariant) => [v.color, v.size].filter(Boolean).join(' / ') || 'มาตรฐาน';
/** ชื่อสินค้าหลักในระบบไลฟ์ — ใส่รหัสสินค้าต่อท้าย กัน SKU คนละตัวที่ชื่อซ้ำกันถูกรวมเป็นสินค้าเดียว */
const liveProductName = (v: CfVariant) => `${v.product_name} (${v.sku})`;

// CSV ตาม RFC 4180 — ครอบ "..." เมื่อมี , " หรือขึ้นบรรทัดใหม่
const csvCell = (value: string | number) => {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * รหัสสินค้าหลักที่ลูกค้าพิมพ์คู่กับสี/ไซส์ในไลฟ์ (เช่น "CF A08 ดำ M") — ใช้ได้เฉพาะ SKU ที่เป็นรูปแบบรหัส CF
 * SKU อย่าง "no" ลูกค้าพิมพ์ไม่ได้ ปล่อยว่าง (ลูกค้าใช้รหัสเต็ม cf_code แทน)
 */
const productCode = (sku: string) => {
  const code = sku.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return CF_CODE_RE.test(code) ? code : '';
};

/**
 * ไฟล์สำหรับนำเข้า HUDANOOR Live CF: product_name, variant, cf_code, price, stock (คอลัมน์บังคับของระบบไลฟ์)
 * + product_code, color, size ให้ระบบไลฟ์จับคู่คอมเมนต์แบบ "A08 ดำ M" ได้ + sku ไว้อ้างอิง
 * (ระบบไลฟ์รุ่นที่ยังไม่รองรับจะข้ามคอลัมน์ที่ไม่รู้จักให้เอง)
 */
function buildLiveCfCsv(rows: CfVariant[]) {
  const header = ['product_name', 'variant', 'cf_code', 'price', 'stock', 'product_code', 'color', 'size', 'sku'];
  const lines = rows.map(v => [liveProductName(v), variantLabel(v), v.cf_code, Number(v.price) || 0, Math.max(0, Math.floor(v.stock)),
    productCode(v.sku), v.color, v.size, v.sku]
    .map(csvCell).join(','));
  return '﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n';
}

function CfCodeInput({ variant }: { variant: CfVariant }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(variant.cf_code);
  const normalized = value.trim().toUpperCase();
  const invalid = !CF_CODE_RE.test(normalized);

  const mutation = useMutation({
    mutationFn: updateCfCode,
    onSuccess: code => {
      setValue(code);
      queryClient.setQueryData<CfVariant[]>(['stock', { view: 'cf' }], prev =>
        prev?.map(v => variantKey(v) === variantKey(variant) ? { ...v, cf_code: code } : v));
      toast({ title: `บันทึกรหัส ${code} แล้ว` });
    },
    onError: (error: Error) => {
      setValue(variant.cf_code);
      toast({ title: 'เปลี่ยนรหัสไม่สำเร็จ', description: error.message, variant: 'destructive' });
    }
  });

  const save = () => {
    if (normalized === variant.cf_code) { setValue(variant.cf_code); return; }
    if (invalid) {
      toast({ title: 'รหัสไม่ถูกรูปแบบ', description: 'ตัวอักษรอังกฤษ 1–4 ตัว ตามด้วยตัวเลข 1–4 ตัว เช่น A11, AB12', variant: 'destructive' });
      setValue(variant.cf_code);
      return;
    }
    mutation.mutate({ sku: variant.sku, color: variant.color, size: variant.size, cf_code: normalized });
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        disabled={mutation.isPending}
        aria-label={`รหัส CF ${variant.sku} ${variantLabel(variant)}`}
        className={cn("h-8 w-24 px-2 font-mono font-semibold uppercase", value && invalid && "border-red-400 focus-visible:ring-red-300")}
        maxLength={8}
      />
      {mutation.isPending && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

interface LiveCfExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ส่งออกสต๊อกเป็น CSV สำหรับนำเข้าระบบ HUDANOOR Live CF พร้อมแก้รหัส CF ต่อตัวเลือก */
export function LiveCfExportDialog({ open, onOpenChange }: LiveCfExportDialogProps) {
  const [search, setSearch] = useState('');
  const { data: variants = [], isLoading, isError } = useQuery({
    queryKey: ['stock', { view: 'cf' }],
    queryFn: getCfVariants,
    enabled: open,
    staleTime: 0
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter(v => `${v.cf_code} ${v.sku} ${v.product_name} ${v.color} ${v.size}`.toLowerCase().includes(q));
  }, [variants, search]);

  const exportable = variants.filter(v => CF_CODE_RE.test(v.cf_code));
  const missingCode = variants.length - exportable.length;
  const inStock = exportable.filter(v => v.stock > 0);
  const totalQty = inStock.reduce((s, v) => s + v.stock, 0);

  const handleDownload = () => {
    if (exportable.length === 0) return;
    const blob = new Blob([buildLiveCfCsv(exportable)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `live-cf-products-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({
      title: `ดาวน์โหลดแล้ว ${exportable.length} ตัวเลือก`,
      description: missingCode > 0 ? `ข้าม ${missingCode} ตัวเลือกที่ยังไม่มีรหัส CF` : 'นำไปอัปโหลดที่หน้า /admin/products ของระบบไลฟ์ได้เลย'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>ส่งออกสินค้าไประบบ Live CF</DialogTitle>
          <DialogDescription>
            1 แถว = 1 ตัวเลือก (รหัส + สี + ไซส์) · รวมตัวที่หมดแล้วเป็นสต๊อก 0 · ราคาจากล็อตที่รับเข้าล่าสุด ·
            รหัส CF ตั้งให้อัตโนมัติและจำไว้ถาวร แก้ได้ในช่องด้านล่าง (ลูกค้าพิมพ์ "CF รหัส" ในไลฟ์)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> กำลังเตรียมรายการ...
          </div>
        ) : isError ? (
          <div className="py-10 text-center text-sm text-red-600">โหลดรายการไม่สำเร็จ ลองปิดแล้วเปิดใหม่</div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="ค้นหารหัส CF รหัสสินค้า ชื่อ สี ไซส์" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                {exportable.length} ตัวเลือก · พร้อมขาย {inStock.length} ตัว ({totalQty.toLocaleString('th-TH')} ชิ้น)
              </div>
            </div>

            {missingCode > 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                มี {missingCode} ตัวเลือกยังไม่มีรหัส CF จะไม่ถูกส่งออก — ปิดแล้วเปิดหน้าต่างนี้ใหม่ ระบบจะตั้งให้
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[110px]">รหัส CF</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead className="w-[90px] text-right">ราคา</TableHead>
                    <TableHead className="w-[90px] text-right">พร้อมขาย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(v => (
                    <TableRow key={variantKey(v)}>
                      <TableCell className="py-1.5"><CfCodeInput variant={v} /></TableCell>
                      <TableCell className="py-1.5">
                        <span className="font-mono text-xs text-muted-foreground mr-1.5">{v.sku}</span>
                        <span className="font-medium">{v.product_name}</span>
                        <span className="text-xs text-muted-foreground"> · {variantLabel(v)}</span>
                      </TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">฿{Number(v.price).toLocaleString('th-TH')}</TableCell>
                      <TableCell className={cn("py-1.5 text-right font-semibold tabular-nums", v.stock === 0 && "text-red-500")}>
                        {v.stock === 0 ? 'หมด (0)' : v.stock.toLocaleString('th-TH')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {visible.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">ไม่พบสินค้า</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                ไฟล์มีคอลัมน์ product_name, variant, cf_code, price, stock + product_code, color, size, sku — อัปโหลดที่หน้า /admin/products ของระบบไลฟ์
              </p>
              <Button
                className="bg-gradient-to-r from-rose-500 to-pink-500 text-white shrink-0"
                onClick={handleDownload}
                disabled={exportable.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                ดาวน์โหลด CSV
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
