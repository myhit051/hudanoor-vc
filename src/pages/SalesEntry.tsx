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
import { CalendarIcon, ShoppingCart, Trash2, ChevronsUpDown, Check, Plus, PackageCheck } from "lucide-react";
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

const emptyItemForm = {
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

interface CartItem extends typeof emptyItemForm {
  cartId: string;
  discountAmount: number;
  finalUnitPrice: number;
  totalAmount: number;
}

export function SalesEntry() {
  const [date, setDate] = useState<Date>(new Date());
  const [channel, setChannel] = useState('');
  const [branchOrPlatform, setBranchOrPlatform] = useState('');
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [stockComboOpen, setStockComboOpen] = useState(false);

  const { salesOrders, isLoading, addSales, isAddingBatch, deleteSale } = useSales();
  const { settings } = useSettings();

  const { data: availableStock = [] } = useQuery({
    queryKey: ['stock', { available: true }],
    queryFn: getAvailableStock,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false
  });

  const handleItemSet = (key: string, value: any) =>
    setItemForm(prev => ({ ...prev, [key]: value }));

  const handleChannelChange = (v: string) => {
    setChannel(v);
    setBranchOrPlatform('');
  };

  const handleSelectStock = (item: AvailableStockItem) => {
    setItemForm(prev => ({
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

  const branchOptions: string[] = useMemo(() => {
    if (channel === 'store') return settings?.branchesByChannel?.store || [];
    if (channel === 'online') return settings?.branchesByChannel?.online || [];
    return [];
  }, [channel, settings]);

  // คำนวณส่วนลด real-time สำหรับ item ที่กำลังกรอก
  const discountAmount = useMemo(() => {
    const price = Number(itemForm.unit_price) || 0;
    const val = Number(itemForm.discount_value) || 0;
    if (itemForm.discount_type === 'percent') return price * (val / 100);
    return Math.min(val, price);
  }, [itemForm.unit_price, itemForm.discount_type, itemForm.discount_value]);

  const finalUnitPrice = useMemo(() => {
    const price = Number(itemForm.unit_price) || 0;
    return Math.max(0, price - discountAmount);
  }, [itemForm.unit_price, discountAmount]);

  const totalAmount = useMemo(() => {
    return finalUnitPrice * (Number(itemForm.quantity) || 1);
  }, [finalUnitPrice, itemForm.quantity]);

  // ยอดรวมทั้ง cart
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.totalAmount, 0), [cart]);
  const cartQty = useMemo(() => cart.reduce((s, i) => s + Number(i.quantity), 0), [cart]);

  const selectedStockLabel = itemForm.stock_in_id
    ? `${itemForm.sku} — ${itemForm.product_name}${itemForm.color ? ` (${itemForm.color}` : ''}${itemForm.size ? ` ${itemForm.size})` : itemForm.color ? ')' : ''}`
    : '';

  const handleAddToCart = () => {
    if (!itemForm.stock_in_id) {
      toast({ title: 'กรุณาเลือกสินค้า', variant: 'destructive' });
      return;
    }
    if ((Number(itemForm.quantity) || 0) < 1) {
      toast({ title: 'จำนวนต้องมากกว่า 0', variant: 'destructive' });
      return;
    }
    const cartItem: CartItem = {
      ...itemForm,
      cartId: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      discountAmount,
      finalUnitPrice,
      totalAmount
    };
    setCart(prev => [...prev, cartItem]);
    setItemForm(emptyItemForm);
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  };

  const validateAndSave = () => {
    if (!channel) { toast({ title: 'กรุณาเลือกช่องทางการขาย', variant: 'destructive' }); return false; }
    if (!branchOrPlatform) { toast({ title: 'กรุณาเลือกสาขา/แพลตฟอร์ม', variant: 'destructive' }); return false; }
    if (cart.length === 0) { toast({ title: 'กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ', variant: 'destructive' }); return false; }
    return true;
  };

  const buildOrders = (): NewSalesOrder[] =>
    cart.map(item => ({
      date: toLocalDateStr(date),
      channel,
      branch_or_platform: branchOrPlatform,
      sku: item.sku,
      product_name: item.product_name,
      color: item.color,
      size: item.size,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unit_price) || 0,
      discount_type: item.discount_type,
      discount_value: Number(item.discount_value) || 0,
      note: item.note,
      stock_in_id: item.stock_in_id
    }));

  const handleSave = () => {
    if (!validateAndSave()) return;
    addSales(buildOrders());
  };

  const handleSaveAndClear = () => {
    if (!validateAndSave()) return;
    addSales(buildOrders(), {
      onSuccess: () => {
        setCart([]);
        setChannel('');
        setBranchOrPlatform('');
      }
    });
  };

  // สรุปยอดวันนี้
  const todayStr = toLocalDateStr(new Date());
  const todayOrders = salesOrders.filter(o => o.date === todayStr);
  const todayTotal = todayOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const todayQty = todayOrders.reduce((s, o) => s + Number(o.quantity), 0);

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

            {/* วันที่ + ช่องทาง + สาขา (ใช้ร่วมทั้ง transaction) */}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ช่องทาง <span className="text-red-500">*</span></Label>
                <Select value={channel} onValueChange={handleChannelChange}>
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
                  value={branchOrPlatform}
                  onValueChange={setBranchOrPlatform}
                  disabled={!channel}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={channel ? 'เลือก' : 'เลือกช่องทางก่อน'} />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* เส้นแบ่ง: ส่วนเพิ่มสินค้า */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">เพิ่มสินค้าในรายการ</p>

              {/* เลือกสินค้า */}
              <div className="space-y-3">
                <div>
                  <Label>สินค้า <span className="text-red-500">*</span></Label>
                  <Popover open={stockComboOpen} onOpenChange={setStockComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between mt-1 font-normal",
                          !itemForm.stock_in_id && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {itemForm.stock_in_id ? selectedStockLabel : 'ค้นหา SKU หรือชื่อสินค้า...'}
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
                                    itemForm.stock_in_id === item.id ? "opacity-100" : "opacity-0"
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quantity">จำนวน (ชิ้น)</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      className="mt-1"
                      value={itemForm.quantity}
                      onChange={e => handleItemSet('quantity', e.target.value)}
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
                      value={itemForm.unit_price}
                      onChange={e => handleItemSet('unit_price', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>ส่วนลด</Label>
                  <div className="flex gap-2 mt-1">
                    <Select
                      value={itemForm.discount_type}
                      onValueChange={v => { handleItemSet('discount_type', v); handleItemSet('discount_value', 0); }}
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
                      max={itemForm.discount_type === 'percent' ? 100 : undefined}
                      placeholder={itemForm.discount_type === 'percent' ? 'เช่น 10' : 'เช่น 50'}
                      value={itemForm.discount_value}
                      onChange={e => handleItemSet('discount_value', e.target.value)}
                    />
                  </div>
                </div>

                {/* สรุปราคา real-time */}
                <div className="bg-rose-50 dark:bg-rose-950/40 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ราคาต่อชิ้น</span>
                    <span>฿{Number(itemForm.unit_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
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
                    <span>ยอดรวม ({itemForm.quantity} ชิ้น)</span>
                    <span>฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="note">หมายเหตุ (รายการนี้)</Label>
                  <Textarea
                    id="note"
                    className="mt-1"
                    value={itemForm.note}
                    onChange={e => handleItemSet('note', e.target.value)}
                    placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
                    rows={2}
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full border-rose-400 text-rose-600 hover:bg-rose-50"
                  onClick={handleAddToCart}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มลงรายการ
                </Button>
              </div>
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">รายการที่จะบันทึก ({cart.length} รายการ)</p>
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.cartId} className="flex items-start gap-2 bg-muted/40 rounded-lg p-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.product_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.sku}{item.color ? ` · ${item.color}` : ''}{item.size ? ` ${item.size}` : ''}
                        </div>
                        <div className="text-xs mt-1">
                          {item.quantity} ชิ้น × ฿{Number(item.unit_price).toLocaleString('th-TH')}
                          {item.discountAmount > 0 && (
                            <span className="text-rose-500"> (ลด ฿{item.discountAmount.toLocaleString('th-TH')})</span>
                          )}
                          <span className="font-semibold ml-1">= ฿{item.totalAmount.toLocaleString('th-TH')}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0 h-7 w-7 p-0"
                        onClick={() => handleRemoveFromCart(item.cartId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* ยอดรวม cart */}
                <div className="bg-orange-50 dark:bg-orange-950/40 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm font-medium">ยอดรวมทั้งหมด ({cartQty} ชิ้น)</span>
                  <span className="text-lg font-bold text-orange-600">฿{cartTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Buttons บันทึก */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                    disabled={isAddingBatch}
                    onClick={handleSave}
                  >
                    {isAddingBatch
                      ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      : <><PackageCheck className="h-4 w-4 mr-2" />บันทึก {cart.length} รายการ</>}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-rose-400 text-rose-500 hover:bg-rose-50"
                    disabled={isAddingBatch}
                    onClick={handleSaveAndClear}
                  >
                    บันทึกและล้างฟอร์ม
                  </Button>
                </div>
              </div>
            )}

            {cart.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-2">
                ยังไม่มีสินค้าในรายการ — กดเพิ่มลงรายการด้านบน
              </p>
            )}
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
