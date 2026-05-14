"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, PackagePlus, Trash2, X, Copy, ChevronDown, ChevronUp, Lock, Package, Hash, DollarSign, ImagePlus, Loader2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useStock } from "@/hooks/use-stock";
import { NewStockItem, uploadProductImage } from "@/lib/stock-api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const PRESET_SIZES = ["S", "M", "L", "XL", "XXL", "ฟรีไซส์"];

const PRESET_CATEGORIES = [
  "มินิเดรส",
  "กางเกง",
  "กระโปรง",
  "เสื้อ",
  "เดรสสั่งตัด",
  "เดรสยาว",
  "ผ้าคลุม",
  "อื่นๆ",
];

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface SkuForm {
  sku: string;
  product_name: string;
  product_category: string;
  cost_price: string;
  sell_price: string;
  note: string;
  colors: string[];
  sizes: string[];
  // grid: colors[i] x sizes[j] -> quantity
  grid: Record<string, Record<string, string>>;
}

const emptyForm = (): SkuForm => ({
  sku: '',
  product_name: '',
  product_category: '',
  cost_price: '',
  sell_price: '',
  note: '',
  colors: [],
  sizes: [],
  grid: {},
});

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB limit (Vercel body limit is 4.5MB)

export function StockReceiving() {
  const [date, setDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [form, setForm] = useState<SkuForm>(emptyForm());
  const [colorInput, setColorInput] = useState('');
  const [lastPrices, setLastPrices] = useState({ cost_price: '', sell_price: '' });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { stockItems, isLoading, addStock, isAdding, deleteStock } = useStock();
  const { user } = useAuth();

  // --- Color tag logic ---
  const addColor = useCallback((val: string) => {
    const trimmed = val.trim();
    if (!trimmed || form.colors.includes(trimmed)) return;
    setForm(prev => ({
      ...prev,
      colors: [...prev.colors, trimmed],
      grid: {
        ...prev.grid,
        [trimmed]: Object.fromEntries(prev.sizes.map(s => [s, prev.grid[trimmed]?.[s] ?? '']))
      }
    }));
    setColorInput('');
  }, [form.colors, form.sizes, form.grid]);

  const removeColor = (color: string) => {
    setForm(prev => {
      const grid = { ...prev.grid };
      delete grid[color];
      return { ...prev, colors: prev.colors.filter(c => c !== color), grid };
    });
  };

  const handleColorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addColor(colorInput);
    } else if (e.key === 'Backspace' && !colorInput && form.colors.length > 0) {
      removeColor(form.colors[form.colors.length - 1]);
    }
  };

  // --- Size logic ---
  const toggleSize = (size: string) => {
    const isFreeSize = size === 'ฟรีไซส์';
    setForm(prev => {
      let newSizes: string[];
      if (prev.sizes.includes(size)) {
        newSizes = prev.sizes.filter(s => s !== size);
      } else if (isFreeSize) {
        newSizes = ['ฟรีไซส์'];
      } else {
        newSizes = [...prev.sizes.filter(s => s !== 'ฟรีไซส์'), size];
      }
      // rebuild grid with new sizes
      const grid: Record<string, Record<string, string>> = {};
      for (const color of prev.colors) {
        grid[color] = Object.fromEntries(newSizes.map(s => [s, prev.grid[color]?.[s] ?? '']));
      }
      return { ...prev, sizes: newSizes, grid };
    });
  };

  // --- Grid quantity ---
  const setQty = (color: string, size: string, val: string) => {
    setForm(prev => ({
      ...prev,
      grid: {
        ...prev.grid,
        [color]: { ...prev.grid[color], [size]: val }
      }
    }));
  };

  // Tab order: left→right, top→bottom in grid
  const handleGridKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    colorIdx: number,
    sizeIdx: number
  ) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const totalCols = form.sizes.length;
    const totalRows = form.colors.length;
    let nextCol = sizeIdx + (e.shiftKey ? -1 : 1);
    let nextRow = colorIdx;
    if (nextCol >= totalCols) { nextCol = 0; nextRow++; }
    if (nextCol < 0) { nextCol = totalCols - 1; nextRow--; }
    if (nextRow < 0 || nextRow >= totalRows) return;
    const el = document.getElementById(`grid-${nextRow}-${nextCol}`);
    el?.focus();
  };

  // --- Totals ---
  const gridTotal = form.colors.reduce((sum, c) =>
    sum + form.sizes.reduce((s2, sz) => s2 + (parseInt(form.grid[c]?.[sz] || '0') || 0), 0), 0);

  // --- Save ---
  const validate = () => {
    if (!form.sku.trim()) { toast({ title: 'กรุณากรอก SKU', variant: 'destructive' }); return false; }
    if (!form.product_name.trim()) { toast({ title: 'กรุณากรอกชื่อสินค้า', variant: 'destructive' }); return false; }
    if (form.colors.length === 0) { toast({ title: 'กรุณาเพิ่มสีอย่างน้อย 1 สี', variant: 'destructive' }); return false; }
    if (form.sizes.length === 0) { toast({ title: 'กรุณาเลือกไซส์อย่างน้อย 1 ไซส์', variant: 'destructive' }); return false; }
    if (gridTotal === 0) { toast({ title: 'กรุณากรอกจำนวนในตาราง', variant: 'destructive' }); return false; }
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    (async () => {
      try {
        let image_url = '';
        if (imageFile) {
          setIsUploading(true);
          try {
            image_url = await uploadProductImage(imageFile, form.sku.trim());
          } catch {
            toast({ title: 'อัปโหลดรูปไม่สำเร็จ', description: 'จะบันทึกสินค้าโดยไม่มีรูป', variant: 'destructive' });
          } finally {
            setIsUploading(false);
          }
        }

        const dateStr = toLocalDateStr(date);
        const records: NewStockItem[] = [];
        for (const color of form.colors) {
          for (const size of form.sizes) {
            const qty = parseInt(form.grid[color]?.[size] || '0') || 0;
            if (qty <= 0) continue;
            records.push({
              date: dateStr,
              sku: form.sku.trim(),
              product_name: form.product_name.trim(),
              product_category: form.product_category.trim(),
              color,
              size,
              quantity: qty,
              cost_price: parseFloat(form.cost_price) || 0,
              sell_price: parseFloat(form.sell_price) || 0,
              note: form.note,
              image_url,
            });
          }
        }

        for (const record of records) {
          await addStock(record);
        }
        toast({ title: `บันทึกสำเร็จ ${records.length} รายการ (${gridTotal} ชิ้น)` });
        setLastPrices({ cost_price: form.cost_price, sell_price: form.sell_price });
        setForm(emptyForm());
        setColorInput('');
        clearImage();
      } catch {
        toast({ title: 'เกิดข้อผิดพลาดระหว่างบันทึก', variant: 'destructive' });
      }
    })();
  };

  const copyLastPrices = () => {
    setForm(prev => ({ ...prev, cost_price: lastPrices.cost_price, sell_price: lastPrices.sell_price }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ title: 'รูปใหญ่เกินไป', description: 'กรุณาเลือกรูปที่มีขนาดไม่เกิน 4MB', variant: 'destructive' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // --- Summary ---
  const dateStr = toLocalDateStr(date);
  const todayItems = stockItems.filter(i => i.date === dateStr);
  const totalQty = todayItems.reduce((s, i) => s + i.quantity, 0);
  const totalCost = todayItems.reduce((s, i) => s + Number(i.cost_price) * i.quantity, 0);
  const totalSku = new Set(todayItems.map(i => i.sku)).size;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-md">
              <PackagePlus className="h-5 w-5 text-white" />
            </div>
            รับสินค้าเข้าสต๊อก
          </h1>
          <p className="text-muted-foreground text-sm mt-1 ml-11">บันทึกสินค้าที่รับเข้าคลังใหม่</p>
        </div>
        {/* Date picker */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 shadow-sm">
              <CalendarIcon className="h-4 w-4" />
              {formatDate(toLocalDateStr(date))}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { if (d) { setDate(d); setCalendarOpen(false); } }}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">ผู้บันทึก</Label>
        <div className="flex items-center gap-2 mt-1 mb-2 px-3 py-2 bg-muted/50 w-fit rounded-lg border border-border">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{user?.name || '-'}</span>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-elevated bg-white dark:bg-gray-900 rounded-xl p-4 text-center border border-rose-100 dark:border-rose-900/30">
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-2">
            <Hash className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-xs text-muted-foreground">SKU วันนี้</p>
          <p className="text-2xl font-bold text-rose-600 animate-count-up">{totalSku}</p>
        </div>
        <div className="card-elevated bg-white dark:bg-gray-900 rounded-xl p-4 text-center border border-pink-100 dark:border-pink-900/30">
          <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mx-auto mb-2">
            <Package className="h-4 w-4 text-pink-500" />
          </div>
          <p className="text-xs text-muted-foreground">จำนวนชิ้น</p>
          <p className="text-2xl font-bold text-pink-600 animate-count-up">{totalQty}</p>
        </div>
        <div className="card-elevated bg-white dark:bg-gray-900 rounded-xl p-4 text-center border border-orange-100 dark:border-orange-900/30">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2">
            <DollarSign className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-xs text-muted-foreground">ต้นทุนรวม</p>
          <p className="text-2xl font-bold text-orange-600 animate-count-up">฿{totalCost.toLocaleString('th-TH')}</p>
        </div>
      </div>

      {/* Main form */}
      <Card className="card-elevated overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-rose-500" />
            กรอกข้อมูล SKU
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Row 1: SKU + ชื่อสินค้า */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku">SKU <span className="text-red-500">*</span></Label>
              <Input
                id="sku"
                className="mt-1 font-mono"
                value={form.sku}
                onChange={e => setForm(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="เช่น HD-DRESS-001"
              />
            </div>
            <div>
              <Label htmlFor="product_name">ชื่อสินค้า <span className="text-red-500">*</span></Label>
              <Input
                id="product_name"
                className="mt-1"
                value={form.product_name}
                onChange={e => setForm(prev => ({ ...prev, product_name: e.target.value }))}
                placeholder="เช่น เดรสลายดอก"
              />
            </div>
          </div>

          {/* Row 1.5: หมวดหมู่สินค้า */}
          <div>
            <Label htmlFor="product_category">หมวดหมู่สินค้า</Label>
            <Select
              value={form.product_category}
              onValueChange={value => setForm(prev => ({ ...prev, product_category: value }))}
            >
              <SelectTrigger id="product_category" className="mt-1">
                <SelectValue placeholder="เลือกหมวดหมู่สินค้า" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* รูปสินค้า */}
          <div>
            <Label>รูปสินค้า</Label>
            <div className="mt-1 flex items-start gap-3">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              {imagePreview ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border shrink-0">
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-rose-400 hover:text-rose-500 transition-colors shrink-0"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-[10px]">เลือกรูป</span>
                </button>
              )}
              <div className="flex flex-col gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                  {imagePreview ? 'เปลี่ยนรูป' : 'เลือกรูปสินค้า'}
                </Button>
                <p className="text-[11px] text-muted-foreground">จากกล้อง มือถือ หรือคอมได้เลย (ไม่เกิน 4MB)</p>
              </div>
            </div>
          </div>

          {/* Row 2: ราคา + copy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cost_price">ราคาต้นทุน (บาท) <span className="text-red-500">*</span></Label>
              <Input
                id="cost_price"
                type="number"
                min="0"
                className="mt-1"
                value={form.cost_price}
                onChange={e => setForm(prev => ({ ...prev, cost_price: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sell_price">ราคาขาย (บาท) <span className="text-red-500">*</span></Label>
                {lastPrices.cost_price && (
                  <button
                    type="button"
                    onClick={copyLastPrices}
                    className="text-xs text-rose-500 hover:underline flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    copy จาก SKU ก่อนหน้า ({lastPrices.cost_price}/{lastPrices.sell_price})
                  </button>
                )}
              </div>
              <Input
                id="sell_price"
                type="number"
                min="0"
                className="mt-1"
                value={form.sell_price}
                onChange={e => setForm(prev => ({ ...prev, sell_price: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          {/* Row 3: สี (tag input) */}
          <div>
            <Label>สี <span className="text-red-500">*</span></Label>
            <div
              className="mt-1 min-h-10 flex flex-wrap gap-2 items-center px-3 py-2 rounded-md border border-input bg-background cursor-text"
              onClick={() => colorInputRef.current?.focus()}
            >
              {form.colors.map(c => (
                <Badge key={c} variant="secondary" className="gap-1 pr-1">
                  {c}
                  <button type="button" onClick={() => removeColor(c)} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                ref={colorInputRef}
                value={colorInput}
                onChange={e => setColorInput(e.target.value)}
                onKeyDown={handleColorKeyDown}
                onBlur={() => colorInput.trim() && addColor(colorInput)}
                placeholder={form.colors.length === 0 ? "พิมพ์สีแล้วกด Enter เช่น ดำ, ลายดอก..." : "เพิ่มสี..."}
                className="flex-1 min-w-24 outline-none bg-transparent text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">พิมพ์ชื่อสีแล้วกด Enter เพื่อเพิ่ม</p>
          </div>

          {/* Row 4: ไซส์ (checkbox) */}
          <div>
            <Label>ไซส์ <span className="text-red-500">*</span></Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_SIZES.map(size => {
                const isFreeSizeMode = form.sizes.includes('ฟรีไซส์');
                const isSelected = form.sizes.includes(size);
                const isDisabled = size !== 'ฟรีไซส์' && isFreeSizeMode;
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggleSize(size)}
                    className={cn(
                      "px-4 py-1.5 rounded-full border text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-rose-500 text-white border-rose-500"
                        : "border-gray-300 text-gray-600 hover:border-rose-400",
                      isDisabled && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid matrix */}
          {form.colors.length > 0 && form.sizes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>จำนวนสินค้า (Tab เพื่อเลื่อนช่อง)</Label>
                <span className="text-sm font-semibold text-rose-600">รวม {gridTotal} ชิ้น</span>
              </div>
              <div className="overflow-x-auto -mx-2 px-2 pb-2 scrollbar-hide">
                <table className="border-collapse min-w-[400px]">
                  <thead>
                    <tr>
                      <th className="text-left text-sm font-medium text-muted-foreground pb-2 pr-6 w-32">สี \ ไซส์</th>
                      {form.sizes.map(size => (
                        <th key={size} className="text-center text-sm font-medium text-muted-foreground pb-2 px-2 w-24">
                          {size}
                        </th>
                      ))}
                      <th className="text-right text-sm font-medium text-muted-foreground pb-2 pl-6 w-16">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.colors.map((color, ci) => {
                      const rowTotal = form.sizes.reduce((s, sz) => s + (parseInt(form.grid[color]?.[sz] || '0') || 0), 0);
                      return (
                        <tr key={color} className="border-t border-gray-100">
                          <td className="py-2 pr-6">
                            <span className="text-sm font-medium">{color}</span>
                          </td>
                          {form.sizes.map((size, si) => (
                            <td key={size} className="py-2 px-2">
                              <Input
                                id={`grid-${ci}-${si}`}
                                type="number"
                                min="0"
                                value={form.grid[color]?.[size] ?? ''}
                                onChange={e => setQty(color, size, e.target.value)}
                                onKeyDown={e => handleGridKeyDown(e, ci, si)}
                                onFocus={e => e.target.select()}
                                className="h-9 text-center w-16 sm:w-20"
                                placeholder="0"
                              />
                            </td>
                          ))}
                          <td className="py-2 pl-6 text-right">
                            <span className={cn("text-sm font-semibold tabular-nums", rowTotal > 0 ? "text-rose-600" : "text-muted-foreground")}>
                              {rowTotal}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td className="pt-2 pr-6 text-sm font-medium text-muted-foreground">รวมทั้งหมด</td>
                      {form.sizes.map(size => {
                        const colTotal = form.colors.reduce((s, c) => s + (parseInt(form.grid[c]?.[size] || '0') || 0), 0);
                        return (
                          <td key={size} className="pt-2 px-2 text-center">
                            <span className={cn("text-sm font-semibold tabular-nums", colTotal > 0 ? "text-rose-600" : "text-muted-foreground")}>
                              {colTotal}
                            </span>
                          </td>
                        );
                      })}
                      <td className="pt-2 pl-6 text-right">
                        <span className="text-sm font-bold text-rose-600 tabular-nums">{gridTotal}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* หมายเหตุ */}
          <div>
            <Label htmlFor="note">หมายเหตุ</Label>
            <Textarea
              id="note"
              className="mt-1"
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
              placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
              rows={2}
            />
          </div>

          {/* Save button */}
          <Button
            className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white h-11 text-base"
            disabled={isAdding || isUploading}
            onClick={handleSave}
          >
            {isUploading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังอัปโหลดรูป...</>
              : isAdding
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <><PackagePlus className="h-4 w-4 mr-2" /><span className="hidden sm:inline">บันทึก SKU นี้ ({gridTotal} ชิ้น) → ไปต่อ SKU ถัดไป</span><span className="sm:hidden">บันทึก ({gridTotal} ชิ้น)</span></>}
          </Button>
        </CardContent>
      </Card>

      {/* History (collapsible) */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setHistoryOpen(o => !o)}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <span>ประวัติรับสินค้า ({todayItems.length} รายการวันนี้)</span>
            {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {historyOpen && (
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : stockItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ยังไม่มีรายการ</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>ชื่อสินค้า</TableHead>
                      <TableHead>สี</TableHead>
                      <TableHead>ไซส์</TableHead>
                      <TableHead>ผู้บันทึก</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead className="text-right">ต้นทุน</TableHead>
                      <TableHead className="text-right">ราคาขาย</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(item.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="text-sm">{item.product_name}</TableCell>
                        <TableCell className="text-sm">{item.color || '-'}</TableCell>
                        <TableCell className="text-sm">{item.size || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.recorded_by || '-'}</TableCell>
                        <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm">฿{Number(item.cost_price).toLocaleString('th-TH')}</TableCell>
                        <TableCell className="text-right text-sm">฿{Number(item.sell_price).toLocaleString('th-TH')}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteStock(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
