"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ShoppingCart, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useSales } from "@/hooks/use-sales";
import { useSettings } from "@/hooks/use-settings";
import { useQuery } from "@tanstack/react-query";
import { getAvailableStock, AvailableStockItem } from "@/lib/stock-api";
import { NewSalesOrder } from "@/lib/sales-api";
import { toast } from "@/hooks/use-toast";

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const emptyForm = {
  channel: '',
  branch_or_platform: '',
  stock_in_id: '',
  sku: '',
  product_name: '',
  color: '',
  size: '',
  quantity: 1,
  unit_price: 0,
  discount_type: 'amount' as 'amount' | 'percent',
  discount_value: 0,
  note: ''
};

export function SalesEntry() {
  const [date, setDate] = useState<Date>(new Date());
  const [form, setForm] = useState(emptyForm);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [stockComboOpen, setStockComboOpen] = useState(false);

  const { salesOrders, isLoading, addSale, isAdding, deleteSale } = useSales();
  const { settings } = useSettings();

  const { data: availableStock = [] } = useQuery({
    queryKey: ['stock', { available: true }],
    queryFn: getAvailableStock,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false
  });

  const handleSet = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // เมื่อเลือกสาขา/แพลตฟอร์ม reset branch
  const handleChannelChange = (v: string) =>
    setForm(prev => ({ ...prev, channel: v, branch_or_platform: '' }));

  // Auto-fill เมื่อเลือกสินค้าจาก Combobox
  const handleSelectStock = (item: AvailableStockItem) => {
    setForm(prev => ({
      ...prev,
      stock_in_id: item.id,
      sku: item.sku,
      product_name: item.product_name,
      color: item.color,
      size: item.size,
      unit_price: item.sell_price
    }));
    setStockComboOpen(false);
  };

  // รายชื่อสาขา/แพลตฟอร์มตาม channel
  const branchOptions: string[] = useMemo(() => {
    if (form.channel === 'store') return settings?.branchesByChannel?.store || [];
    if (form.channel === 'online') return settings?.branchesByChannel?.online || [];
    return [];
  }, [form.channel, settings]);

  // คำนวณส่วนลดและราคาสุทธิ real-time
  const discountAmount = useMemo(() => {
    const price = Number(form.unit_price) || 0;
    const val = Number(form.discount_value) || 0;
    if (form.discount_type === 'percent') return price * (val / 100);
    return Math.min(val, price);
  }, [form.unit_price, form.discount_type, form.discount_value]);

  const finalUnitPrice = useMemo(() => {
    const price = Number(form.unit_price) || 0;
    return Math.max(0, price - discountAmount);
  }, [form.unit_price, discountAmount]);

  const totalAmount = useMemo(() => {
    return finalUnitPrice * (Number(form.quantity) || 1);
  }, [finalUnitPrice, form.quantity]);

  const validate = () => {
    if (!form.stock_in_id) { toast({ title: 'กรุณาเลือกสินค้า', variant: 'destructive' }); return false; }
    if (!form.channel) { toast({ title: 'กรุณาเลือกช่องทางการขาย', variant: 'destructive' }); return false; }
    if (!form.branch_or_platform) { toast({ title: 'กรุณาเลือกสาขา/แพลตฟอร์ม', variant: 'destructive' }); return false; }
    if ((Number(form.quantity) || 0) < 1) { toast({ title: 'จำนวนต้องมากกว่า 0', variant: 'destructive' }); return false; }
    return true;
  };

  const buildOrder = (): NewSalesOrder => ({
    date: toLocalDateStr(date),
    channel: form.channel,
    branch_or_platform: form.branch_or_platform,
    sku: form.sku,
    product_name: form.product_name,
    color: form.color,
    size: form.size,
    quantity: Number(form.quantity) || 1,
    unit_price: Number(form.unit_price) || 0,
    discount_type: form.discount_type,
    discount_value: Number(form.discount_value) || 0,
    note: form.note,
    stock_in_id: form.stock_in_id
  });

  const handleSave = () => {
    if (!validate()) return;
    addSale(buildOrder());
  };

  const handleSaveAndClear = () => {
    if (!validate()) return;
    addSale(buildOrder(), {
      onSuccess: () => setForm(emptyForm)
    });
  };

  // สรุปยอดวันนี้
  const todayStr = toLocalDateStr(new Date());
  const todayOrders = salesOrders.filter(o => o.date === todayStr);
  const todayTotal = todayOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const todayQty = todayOrders.reduce((s, o) => s + Number(o.quantity), 0);

  // label แสดงสินค้าที่เลือกใน Combobox
  const selectedStockLabel = form.stock_in_id
    ? `${form.sku} — ${form.product_name}${form.color ? ` (${form.color}` : ''}${form.size ? ` ${form.size})` : form.color ? ')' : ''}`
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-rose-500" />
          บันทึกยอดขาย
        </h1>
        <p className="text-muted-foreground text-sm mt-1">บันทึกการขายสินค้าจากสต๊อก</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">กรอกข้อมูลการขาย</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* วันที่ขาย */}
            <div>
              <Label>วันที่ขาย</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
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

            {/* ช่องทาง + สาขา */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ช่องทาง <span className="text-red-500">*</span></Label>
                <Select value={form.channel} onValueChange={handleChannelChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกช่องทาง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store">หน้าร้าน</SelectItem>
                    <SelectItem value="online">ออนไลน์</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>สาขา/แพลตฟอร์ม <span className="text-red-500">*</span></Label>
                <Select
                  value={form.branch_or_platform}
                  onValueChange={v => handleSet('branch_or_platform', v)}
                  disabled={!form.channel}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={form.channel ? 'เลือก' : 'เลือกช่องทางก่อน'} />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* เลือกสินค้า (Combobox) */}
            <div>
              <Label>สินค้า <span className="text-red-500">*</span></Label>
              <Popover open={stockComboOpen} onOpenChange={setStockComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between mt-1 font-normal",
                      !form.stock_in_id && "text-muted-foreground"
                    )}
                  >
                    <span className="truncate">
                      {form.stock_in_id ? selectedStockLabel : 'ค้นหา SKU หรือชื่อสินค้า...'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="พิมพ์ SKU หรือชื่อสินค้า..." />
                    <CommandList>
                      <CommandEmpty>ไม่พบสินค้าในสต๊อก</CommandEmpty>
                      <CommandGroup>
                        {availableStock.map(item => (
                          <CommandItem
                            key={item.id}
                            value={`${item.sku} ${item.product_name} ${item.color} ${item.size}`}
                            onSelect={() => handleSelectStock(item)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.stock_in_id === item.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                                <span className="font-medium truncate">{item.product_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {item.color && <span>{item.color}</span>}
                                {item.size && <span>{item.size}</span>}
                                <Badge variant="outline" className="text-xs py-0">
                                  เหลือ {item.available_quantity} ชิ้น
                                </Badge>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* จำนวน + ราคาขาย */}
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <Label htmlFor="unit_price">ราคาขาย/ชิ้น (บาท)</Label>
                <Input
                  id="unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  value={form.unit_price}
                  onChange={e => handleSet('unit_price', e.target.value)}
                />
              </div>
            </div>

            {/* ส่วนลด */}
            <div>
              <Label>ส่วนลด</Label>
              <div className="flex gap-2 mt-1">
                <Select
                  value={form.discount_type}
                  onValueChange={v => { handleSet('discount_type', v); handleSet('discount_value', 0); }}
                >
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">บาท</SelectItem>
                    <SelectItem value="percent">%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  max={form.discount_type === 'percent' ? 100 : undefined}
                  placeholder={form.discount_type === 'percent' ? 'เช่น 10' : 'เช่น 50'}
                  value={form.discount_value}
                  onChange={e => handleSet('discount_value', e.target.value)}
                />
              </div>
            </div>

            {/* สรุปราคา real-time */}
            <div className="bg-rose-50 dark:bg-rose-950/40 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ราคาต่อชิ้น</span>
                <span>฿{Number(form.unit_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>ส่วนลด</span>
                <span>- ฿{discountAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-1">
                <span>ราคาสุทธิ/ชิ้น</span>
                <span>฿{finalUnitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-rose-600">
                <span>ยอดรวม ({form.quantity} ชิ้น)</span>
                <span>฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
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
                {isAdding
                  ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : 'บันทึก'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-rose-400 text-rose-500 hover:bg-rose-50"
                disabled={isAdding}
                onClick={handleSaveAndClear}
              >
                บันทึกและล้างฟอร์ม
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* สรุปยอดวันนี้ */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สรุปยอดขายวันนี้</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="bg-rose-50 dark:bg-rose-950 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">รายการ</p>
                <p className="text-2xl font-bold text-rose-600">{todayOrders.length}</p>
                <p className="text-xs text-muted-foreground">รายการ</p>
              </div>
              <div className="bg-pink-50 dark:bg-pink-950 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">จำนวนชิ้น</p>
                <p className="text-2xl font-bold text-pink-600">{todayQty}</p>
                <p className="text-xs text-muted-foreground">ชิ้น</p>
              </div>
              <div className="col-span-2 bg-orange-50 dark:bg-orange-950 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">ยอดขายรวมวันนี้</p>
                <p className="text-2xl font-bold text-orange-600">
                  ฿{todayTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ตารางประวัติการขาย */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติการขายทั้งหมด</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : salesOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">ยังไม่มีรายการ</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ช่องทาง/สาขา</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead>สี/ไซส์</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead className="text-right">ราคา/ชิ้น</TableHead>
                    <TableHead className="text-right">ส่วนลด</TableHead>
                    <TableHead className="text-right">ยอดรวม</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(order.date)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-xs">
                          <span className="text-muted-foreground">{order.channel === 'store' ? 'หน้าร้าน' : 'ออนไลน์'}</span>
                          <br />
                          {order.branch_or_platform}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{order.sku}</TableCell>
                      <TableCell>{order.product_name}</TableCell>
                      <TableCell className="text-sm">
                        {[order.color, order.size].filter(Boolean).join(' / ') || '-'}
                      </TableCell>
                      <TableCell className="text-right">{order.quantity}</TableCell>
                      <TableCell className="text-right">฿{Number(order.unit_price).toLocaleString('th-TH')}</TableCell>
                      <TableCell className="text-right text-rose-500">
                        {Number(order.discount_amount) > 0
                          ? `- ฿${Number(order.discount_amount).toLocaleString('th-TH')}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ฿{Number(order.total_amount).toLocaleString('th-TH')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteSale(order.id)}
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
