"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PackagePlus, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useStock } from "@/hooks/use-stock";
import { NewStockItem } from "@/lib/stock-api";
import { toast } from "@/hooks/use-toast";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "ฟรีไซส์"];
const COLORS = ["ดำ", "ขาว", "เทา", "น้ำตาล", "เบจ", "ครีม", "ชมพู", "แดง", "ส้ม", "เหลือง", "เขียว", "น้ำเงิน", "ม่วง", "อื่นๆ"];

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const emptyForm = {
  sku: '',
  product_name: '',
  color: '',
  size: '',
  quantity: 1,
  cost_price: 0,
  sell_price: 0,
  note: ''
};

export function StockReceiving() {
  const [date, setDate] = useState<Date>(new Date());
  const [form, setForm] = useState(emptyForm);
  const [customColor, setCustomColor] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { stockItems, isLoading, addStock, isAdding, deleteStock } = useStock();

  const handleSet = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const validate = () => {
    if (!form.sku.trim()) { toast({ title: 'กรุณากรอก SKU', variant: 'destructive' }); return false; }
    if (!form.product_name.trim()) { toast({ title: 'กรุณากรอกชื่อสินค้า', variant: 'destructive' }); return false; }
    return true;
  };

  const buildRecord = (): NewStockItem => ({
    date: toLocalDateStr(date),
    sku: form.sku.trim(),
    product_name: form.product_name.trim(),
    color: form.color === 'อื่นๆ' ? customColor : form.color,
    size: form.size,
    quantity: Number(form.quantity) || 1,
    cost_price: Number(form.cost_price) || 0,
    sell_price: Number(form.sell_price) || 0,
    note: form.note
  });

  const handleSave = () => {
    if (!validate()) return;
    addStock(buildRecord());
    setForm(prev => ({ ...prev, quantity: 1, cost_price: 0, sell_price: 0 }));
  };

  const handleSaveAndClose = () => {
    if (!validate()) return;
    addStock(buildRecord());
    setForm(emptyForm);
    setCustomColor('');
  };

  const todayStr = toLocalDateStr(new Date());
  const todayItems = stockItems.filter(i => i.date === todayStr);
  const totalItems = todayItems.reduce((s, i) => s + i.quantity, 0);
  const totalCost = todayItems.reduce((s, i) => s + i.cost_price * i.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackagePlus className="h-6 w-6 text-rose-500" />
          รับสินค้าเข้าสต๊อก
        </h1>
        <p className="text-muted-foreground text-sm mt-1">บันทึกสินค้าที่รับเข้าคลังใหม่</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">กรอกข้อมูลสินค้า</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* วันที่ */}
            <div>
              <Label>วันที่ของเข้า</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDate(toLocalDateStr(date))}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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

            {/* SKU */}
            <div>
              <Label htmlFor="sku">SKU <span className="text-red-500">*</span></Label>
              <Input
                id="sku"
                className="mt-1"
                value={form.sku}
                onChange={e => handleSet('sku', e.target.value)}
                placeholder="เช่น HD-DRESS-001"
              />
            </div>

            {/* ชื่อสินค้า */}
            <div>
              <Label htmlFor="product_name">ชื่อสินค้า <span className="text-red-500">*</span></Label>
              <Input
                id="product_name"
                className="mt-1"
                value={form.product_name}
                onChange={e => handleSet('product_name', e.target.value)}
                placeholder="เช่น เดรสลายดอก"
              />
            </div>

            {/* สี + ไซส์ */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>สี</Label>
                <Select value={form.color} onValueChange={v => handleSet('color', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกสี" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.color === 'อื่นๆ' && (
                  <Input
                    className="mt-2"
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    placeholder="ระบุสี"
                  />
                )}
              </div>
              <div>
                <Label>ไซส์</Label>
                <Select value={form.size} onValueChange={v => handleSet('size', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกไซส์" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* จำนวน */}
            <div>
              <Label htmlFor="quantity">จำนวน (ชิ้น)</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                className="mt-1"
                value={form.quantity}
                onChange={e => handleSet('quantity', e.target.value)}
              />
            </div>

            {/* ราคา */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost_price">ราคาต้นทุน (บาท)</Label>
                <Input
                  id="cost_price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  value={form.cost_price}
                  onChange={e => handleSet('cost_price', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="sell_price">ราคาขาย (บาท)</Label>
                <Input
                  id="sell_price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  value={form.sell_price}
                  onChange={e => handleSet('sell_price', e.target.value)}
                />
              </div>
            </div>

            {/* หมายเหตุ */}
            <div>
              <Label htmlFor="note">หมายเหตุ</Label>
              <Textarea
                id="note"
                className="mt-1"
                value={form.note}
                onChange={e => handleSet('note', e.target.value)}
                placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
                rows={2}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                disabled={isAdding}
                onClick={handleSave}
              >
                {isAdding ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'บันทึก'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-rose-400 text-rose-500 hover:bg-rose-50"
                disabled={isAdding}
                onClick={handleSaveAndClose}
              >
                บันทึกและล้างฟอร์ม
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary วันนี้ */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สรุปรับของวันนี้</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="bg-rose-50 dark:bg-rose-950 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">รายการ</p>
                <p className="text-2xl font-bold text-rose-600">{todayItems.length}</p>
                <p className="text-xs text-muted-foreground">รายการ</p>
              </div>
              <div className="bg-pink-50 dark:bg-pink-950 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">จำนวนชิ้น</p>
                <p className="text-2xl font-bold text-pink-600">{totalItems}</p>
                <p className="text-xs text-muted-foreground">ชิ้น</p>
              </div>
              <div className="col-span-2 bg-orange-50 dark:bg-orange-950 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">ต้นทุนรวมวันนี้</p>
                <p className="text-2xl font-bold text-orange-600">
                  ฿{totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ตารางประวัติ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติรับสินค้าทั้งหมด</CardTitle>
        </CardHeader>
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
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead className="text-right">ต้นทุน</TableHead>
                    <TableHead className="text-right">ราคาขาย</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(item.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.color || '-'}</TableCell>
                      <TableCell>{item.size || '-'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">฿{Number(item.cost_price).toLocaleString('th-TH')}</TableCell>
                      <TableCell className="text-right">฿{Number(item.sell_price).toLocaleString('th-TH')}</TableCell>
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
      </Card>
    </div>
  );
}
