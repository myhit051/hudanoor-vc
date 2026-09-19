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
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, ShoppingCart, Trash2, Search, Plus, PackageCheck, Lock, Receipt, Package, DollarSign, MapPin, HandCoins } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useSales } from "@/hooks/use-sales";
import { useSettings } from "@/hooks/use-settings";
import { useQuery } from "@tanstack/react-query";
import { getAvailableStock, AvailableStockItem } from "@/lib/stock-api";
import { NewSalesOrder, groupSalesByOrder } from "@/lib/sales-api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUsers } from "@/hooks/use-users";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 1 แถวในตารางสินค้าของออเดอร์ — เลือกสินค้าแล้วเข้าตารางทันที แก้จำนวน/ราคา/ส่วนลดในแถวได้
type CartItem = {
  cartId: string;
  stock_in_id: string;
  sku: string;
  product_name: string;
  color: string;
  size: string;
  available: number;
  quantity: number;
  unit_price: string;
  discount_type: 'amount' | 'percent';
  discount_value: string;
  note: string;
};

const calcLine = (item: CartItem) => {
  const price = Math.max(0, Number(item.unit_price) || 0);
  const val = Math.max(0, Number(item.discount_value) || 0);
  const discountAmount = item.discount_type === 'percent' ? price * (Math.min(val, 100) / 100) : Math.min(val, price);
  const finalUnitPrice = Math.max(0, price - discountAmount);
  return { discountAmount, finalUnitPrice, totalAmount: finalUnitPrice * item.quantity };
};

const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SalesEntry() {
  const [date, setDate] = useState<Date>(new Date());
  const [channel, setChannel] = useState('');
  const [branchOrPlatform, setBranchOrPlatform] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingFeeInput, setShippingFeeInput] = useState('');
  // กด "บันทึกเสร็จสิ้น" แล้วพับฟอร์มเก็บ เหลือปุ่มเปิดฟอร์มใหม่
  const [formOpen, setFormOpen] = useState(true);
  // เก็บเงินปลายทาง — เฉพาะออเดอร์ออนไลน์
  const [isCod, setIsCod] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  // แถวที่เพิ่งเพิ่ม/บวกจำนวน — ไฮไลต์สีเขียวแวบหนึ่ง
  const [flashId, setFlashId] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [stockComboOpen, setStockComboOpen] = useState(false);
  // Admin บันทึกแทนคนอื่นได้ — ว่าง = บันทึกในชื่อตัวเอง
  const [recorderOverride, setRecorderOverride] = useState('');

  const { salesOrders, isLoading, addSales, isAddingBatch, deleteSale, deleteOrder, isDeleting, isDeletingOrder } = useSales();
  const { settings } = useSettings();
  const { user, isAdmin } = useAuth();
  const { users } = useUsers({ enabled: isAdmin });

  const recorderName = (isAdmin && recorderOverride) || user?.name || '';
  const recorderOptions = useMemo(
    () => Array.from(new Set([user?.name, ...users.map(u => u.name)].filter((n): n is string => !!n))),
    [user?.name, users]
  );

  const { data: availableStock = [] } = useQuery({
    queryKey: ['stock', { available: true }],
    queryFn: getAvailableStock,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false
  });

  const handleChannelChange = (v: string) => {
    setChannel(v);
    setBranchOrPlatform('');
    if (v !== 'online') {
      setShippingAddress('');
      setIsCod(false);
    }
  };

  // เลือกสินค้าแล้วเข้าตารางทันที · ตัวเดิมซ้ำ = บวกจำนวนในแถวเดิม (ไม่เกินสต๊อก)
  const handleSelectStock = (item: AvailableStockItem) => {
    const existing = cart.find(c => c.stock_in_id === item.id);
    if (existing) {
      if (existing.quantity >= item.available_quantity) {
        toast({ title: 'สต๊อกไม่พอ', description: `${item.sku} เหลือ ${item.available_quantity} ชิ้น`, variant: 'destructive' });
        return;
      }
      setCart(prev => prev.map(c => c.cartId === existing.cartId ? { ...c, quantity: c.quantity + 1 } : c));
      flash(existing.cartId);
    } else {
      const cartId = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      setCart(prev => [...prev, {
        cartId,
        stock_in_id: item.id,
        sku: item.sku,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        available: item.available_quantity,
        quantity: 1,
        unit_price: String(item.sell_price ?? 0),
        discount_type: 'amount',
        discount_value: '',
        note: ''
      }]);
      flash(cartId);
    }
    setStockSearch('');
  };

  const flash = (cartId: string) => {
    setFlashId(cartId);
    setTimeout(() => setFlashId(id => (id === cartId ? '' : id)), 1200);
  };

  const updateCartItem = (cartId: string, patch: Partial<CartItem>) =>
    setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, ...patch } : c));

  const setQuantity = (item: CartItem, qty: number) =>
    updateCartItem(item.cartId, { quantity: Math.min(item.available, Math.max(1, Math.floor(qty) || 1)) });

  const branchOptions: string[] = useMemo(() => {
    if (channel === 'store') return settings?.branchesByChannel?.store || [];
    if (channel === 'online') return settings?.branchesByChannel?.online || [];
    return [];
  }, [channel, settings]);

  // ค่าส่งคิดต่อออเดอร์ (ไม่บังคับ) — เป็นรายรับ นับรวมยอดขาย
  const shippingFee = Math.max(0, Number(shippingFeeInput) || 0);

  // ยอดรวมทั้ง cart
  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + calcLine(i).totalAmount, 0), [cart]);
  const cartTotal = cartSubtotal + shippingFee;
  const cartQty = useMemo(() => cart.reduce((s, i) => s + Number(i.quantity), 0), [cart]);

  // ชิ้นส่วนที่ใช้ทั้งในตาราง (คอม) และการ์ด (มือถือ)
  const renderQty = (item: CartItem) => (
    <div className="inline-flex items-center rounded-md border overflow-hidden">
      <button
        type="button"
        className="h-8 w-7 min-h-0 min-w-0 bg-muted/50 hover:bg-muted disabled:opacity-40"
        aria-label="ลดจำนวน"
        disabled={item.quantity <= 1}
        onClick={() => setQuantity(item, item.quantity - 1)}
      >−</button>
      <input
        type="number"
        inputMode="numeric"
        className="h-8 w-10 border-x bg-transparent text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={`จำนวน ${item.sku}`}
        value={item.quantity}
        onChange={e => setQuantity(item, Number(e.target.value))}
      />
      <button
        type="button"
        className="h-8 w-7 min-h-0 min-w-0 bg-muted/50 hover:bg-muted disabled:opacity-40"
        aria-label="เพิ่มจำนวน"
        disabled={item.quantity >= item.available}
        onClick={() => setQuantity(item, item.quantity + 1)}
      >+</button>
    </div>
  );

  const renderDiscount = (item: CartItem) => (
    <div className="flex items-center gap-1">
      <Input
        type="number" min="0" step="0.01" inputMode="decimal"
        className="h-8 px-2 text-right"
        placeholder="0"
        aria-label={`ส่วนลด ${item.sku}`}
        value={item.discount_value}
        onChange={e => updateCartItem(item.cartId, { discount_value: e.target.value })}
      />
      <button
        type="button"
        title="สลับส่วนลดเป็นบาท / เปอร์เซ็นต์"
        className="h-8 w-8 min-h-0 min-w-0 shrink-0 rounded-md border text-xs font-semibold hover:bg-muted"
        onClick={() => updateCartItem(item.cartId, { discount_type: item.discount_type === 'amount' ? 'percent' : 'amount' })}
      >{item.discount_type === 'percent' ? '%' : '฿'}</button>
    </div>
  );

  const renderNote = (item: CartItem) => (
    <input
      className="mt-1 w-full rounded border border-dashed bg-transparent px-2 py-0.5 text-xs outline-none focus:border-rose-300"
      placeholder="+ หมายเหตุ (ถ้ามี)"
      aria-label={`หมายเหตุ ${item.sku}`}
      value={item.note}
      onChange={e => updateCartItem(item.cartId, { note: e.target.value })}
    />
  );

  const renderRemove = (item: CartItem) => (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0 h-7 w-7 p-0 min-h-0 min-w-0"
      aria-label={`ลบ ${item.sku}`}
      onClick={() => handleRemoveFromCart(item.cartId)}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );

  const handleRemoveFromCart = (cartId: string) => {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  };

  const validateAndSave = () => {
    if (!channel) { toast({ title: 'กรุณาเลือกช่องทางการขาย', variant: 'destructive' }); return false; }
    if (!branchOrPlatform) { toast({ title: 'กรุณาเลือกสาขา/แพลตฟอร์ม', variant: 'destructive' }); return false; }
    if (cart.length === 0) { toast({ title: 'กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ', variant: 'destructive' }); return false; }
    const over = cart.find(i => i.quantity > i.available);
    if (over) { toast({ title: 'สต๊อกไม่พอ', description: `${over.sku} เหลือ ${over.available} ชิ้น`, variant: 'destructive' }); return false; }
    return true;
  };

  const buildOrders = (): NewSalesOrder[] =>
    cart.map((item, index) => ({
      date: toLocalDateStr(date),
      channel,
      branch_or_platform: branchOrPlatform,
      sku: item.sku,
      product_name: item.product_name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unit_price: Number(item.unit_price) || 0,
      discount_type: item.discount_type,
      discount_value: Number(item.discount_value) || 0,
      // ค่าส่งส่งไปกับรายการแรกรายการเดียว (เซิร์ฟเวอร์ก็ใช้แค่รายการแรก)
      shipping_fee: index === 0 ? shippingFee : 0,
      note: item.note,
      shipping_address: channel === 'online' ? shippingAddress.trim() : '',
      payment_method: channel === 'online' && isCod ? 'cod' : 'transfer',
      stock_in_id: item.stock_in_id,
      ...(isAdmin && recorderOverride && recorderOverride !== user?.name ? { recorded_by: recorderOverride } : {})
    }));

  // บันทึกแล้วกรอกออเดอร์ของลูกค้าคนถัดไปต่อ: ล้างเฉพาะข้อมูลของออเดอร์นี้
  // (สินค้า ตัวเลข ค่าส่ง ที่อยู่) — คงวันที่ ช่องทาง สาขา และผู้บันทึกไว้
  const handleSave = () => {
    if (!validateAndSave()) return;
    addSales(buildOrders(), {
      onSuccess: () => {
        setCart([]);
        setShippingAddress('');
        setShippingFeeInput('');
        setIsCod(false);
        (document.getElementById('shipping_address') ?? document.getElementById('add_item_section'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const handleSaveAndClose = () => {
    if (!validateAndSave()) return;
    addSales(buildOrders(), {
      onSuccess: () => {
        setCart([]);
        setChannel('');
        setBranchOrPlatform('');
        setShippingAddress('');
        setShippingFeeInput('');
        setIsCod(false);
        setRecorderOverride('');
        setFormOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const handleDeleteOrder = (orderId: string, isLegacy: boolean) => {
    if (!confirm('คุณต้องการลบออเดอร์นี้ใช่หรือไม่? ข้อมูลการขายจะถูกลบและสต๊อกจะถูกคืนกลับอัตโนมัติ')) return;
    if (isLegacy) {
      deleteSale(orderId);
    } else {
      deleteOrder(orderId);
    }
  };

  // สรุปยอดวันนี้
  const todayStr = toLocalDateStr(new Date());
  const todayOrders = salesOrders.filter(o => o.date === todayStr);
  const todayTotal = todayOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const todayQty = todayOrders.reduce((s, o) => s + Number(o.quantity), 0);

  // สรุปออเดอร์ล่าสุด
  const groupedOrders = useMemo(() => groupSalesByOrder(salesOrders).slice(0, 10), [salesOrders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-md">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          บันทึกยอดขาย
        </h1>
        <p className="text-muted-foreground text-sm mt-1 ml-11">บันทึกการขายสินค้าจากสต๊อก</p>
      </div>

      {/* ฟอร์มกว้าง 2/3 บนจอใหญ่ เพื่อให้ตารางสินค้ามีที่พอ · จอเล็กกว่าเรียงลงมาเต็มความกว้าง */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="card-elevated overflow-hidden xl:col-span-2">
          <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-5 w-5 text-rose-500" />
              กรอกข้อมูลการขาย
            </CardTitle>
          </CardHeader>
          {!formOpen && (
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <PackageCheck className="h-10 w-10 text-emerald-500" />
              <p className="text-sm text-muted-foreground">บันทึกเรียบร้อยแล้ว</p>
              <Button
                className="bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                บันทึกออเดอร์ใหม่
              </Button>
            </CardContent>
          )}
          <CardContent className={cn("space-y-4 pt-5", !formOpen && "hidden")}>

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

            <div>
              {isAdmin ? (
                <>
                  <Label htmlFor="recorder">ผู้บันทึก <span className="font-normal text-muted-foreground">(Admin เลือกบันทึกแทนคนอื่นได้ — ยอดจะนับเป็นของคนที่เลือก)</span></Label>
                  <Select value={recorderName} onValueChange={v => setRecorderOverride(v === user?.name ? '' : v)}>
                    <SelectTrigger
                      id="recorder"
                      className={cn("mt-1", recorderName !== user?.name && "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {recorderOptions.map(name => (
                        <SelectItem key={name} value={name}>
                          {name}{name === user?.name ? ' (ฉัน)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {recorderName !== user?.name && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">กำลังบันทึกในชื่อ {recorderName}</p>
                  )}
                </>
              ) : (
                <>
                  <Label className="text-xs text-muted-foreground">ผู้บันทึก</Label>
                  <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{user?.name || '-'}</span>
                  </div>
                </>
              )}
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

            {channel === 'online' && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                <Label htmlFor="shipping_address" className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300">
                  <MapPin className="h-4 w-4" />
                  ที่อยู่จัดส่ง <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span>
                </Label>
                <Textarea
                  id="shipping_address"
                  className="mt-2 min-h-[88px] bg-white/80 dark:bg-gray-950/40"
                  value={shippingAddress}
                  onChange={e => setShippingAddress(e.target.value)}
                  placeholder="วางชื่อผู้รับ เบอร์โทร และที่อยู่จัดส่ง"
                  rows={3}
                />
                <label
                  htmlFor="is_cod"
                  className={cn(
                    "mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                    isCod
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                      : "border-border bg-white/80 dark:bg-gray-950/40"
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <HandCoins className={cn("h-4 w-4", isCod ? "text-amber-600" : "text-muted-foreground")} />
                    เก็บเงินปลายทาง (COD)
                  </span>
                  <Switch id="is_cod" checked={isCod} onCheckedChange={setIsCod} className="min-h-0 min-w-0" />
                </label>
                {isCod && (
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                    ยอดที่ต้องเก็บ = ยอดรวมทั้งหมดของออเดอร์ (รวมค่าส่ง){cart.length > 0 && ` · ฿${cartTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
                  </p>
                )}
              </div>
            )}

            {/* สินค้าในออเดอร์: ค้นหา → กดเลือก → เข้าตารางทันที แล้วเลือกตัวถัดไปต่อได้ */}
            <div id="add_item_section" className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                สินค้าในออเดอร์{cart.length > 0 && ` (${cart.length} รายการ · ${cartQty} ชิ้น)`}
              </p>

              <Popover open={stockComboOpen} onOpenChange={o => { setStockComboOpen(o); if (!o) setStockSearch(''); }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-start font-normal text-muted-foreground border-rose-300 hover:border-rose-400"
                  >
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                    <span className="truncate">ค้นหารหัสหรือชื่อสินค้า แล้วกดเลือกเพื่อเพิ่มเข้าตาราง...</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="พิมพ์รหัสหรือชื่อสินค้า..." value={stockSearch} onValueChange={setStockSearch} />
                    <CommandList>
                      <CommandEmpty>ไม่พบสินค้าในสต๊อก</CommandEmpty>
                      <CommandGroup>
                        {availableStock.map(item => {
                          const inCart = cart.find(c => c.stock_in_id === item.id)?.quantity ?? 0;
                          return (
                            <CommandItem
                              key={item.id}
                              value={`${item.sku} ${item.product_name} ${item.color} ${item.size} ${item.id}`}
                              onSelect={() => handleSelectStock(item)}
                            >
                              <div className="flex flex-1 items-center gap-2 min-w-0">
                                <span className="font-mono text-xs text-muted-foreground shrink-0">{item.sku}</span>
                                <span className="font-medium truncate">{item.product_name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{[item.color, item.size].filter(Boolean).join(' ')}</span>
                              </div>
                              {inCart > 0 && (
                                <Badge className="ml-2 text-xs py-0 bg-emerald-500 hover:bg-emerald-500 text-white border-0 shrink-0">ในตาราง {inCart}</Badge>
                              )}
                              <Badge variant="outline" className="ml-1 text-xs py-0 shrink-0">เหลือ {item.available_quantity}</Badge>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {cart.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
                  ยังไม่มีสินค้า — ค้นหาแล้วกดเลือกด้านบน
                </p>
              ) : (
                <>
                  {/* คอม/แท็บเล็ต: ตาราง */}
                  <div className="hidden md:block rounded-lg border overflow-hidden">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px] px-3">รหัส</TableHead>
                          <TableHead className="px-2">สินค้า</TableHead>
                          <TableHead className="w-[108px] px-2 text-center">จำนวน</TableHead>
                          <TableHead className="w-[92px] px-2 text-right whitespace-nowrap">ราคา/ชิ้น</TableHead>
                          <TableHead className="w-[120px] px-2 text-right">ส่วนลด</TableHead>
                          <TableHead className="w-[96px] px-2 text-right">รวม</TableHead>
                          <TableHead className="w-[40px] px-1" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.map(item => (
                          <TableRow key={item.cartId} className={cn("align-top transition-colors duration-700", flashId === item.cartId && "bg-emerald-50 dark:bg-emerald-950/30")}>
                            <TableCell className="py-2 px-3 font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                            <TableCell className="py-2 px-2">
                              <div className="font-medium leading-tight">{item.product_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {[item.color, item.size].filter(Boolean).join(' · ')}{(item.color || item.size) ? ' · ' : ''}เหลือ {item.available}
                              </div>
                              {renderNote(item)}
                            </TableCell>
                            <TableCell className="py-2 px-2 text-center">{renderQty(item)}</TableCell>
                            <TableCell className="py-2 px-2">
                              <Input
                                type="number" min="0" step="0.01" inputMode="decimal"
                                className="h-8 px-2 text-right"
                                aria-label={`ราคา ${item.sku}`}
                                value={item.unit_price}
                                onChange={e => updateCartItem(item.cartId, { unit_price: e.target.value })}
                              />
                            </TableCell>
                            <TableCell className="py-2 px-2">{renderDiscount(item)}</TableCell>
                            <TableCell className="py-2 px-2 text-right font-semibold tabular-nums">{baht(calcLine(item).totalAmount)}</TableCell>
                            <TableCell className="py-2 px-2">{renderRemove(item)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* มือถือ: การ์ดเรียงลงมา */}
                  <div className="md:hidden space-y-2">
                    {cart.map(item => (
                      <div key={item.cartId} className={cn("rounded-lg border p-3 space-y-2 transition-colors duration-700", flashId === item.cartId && "bg-emerald-50 dark:bg-emerald-950/30")}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium leading-tight">
                              <span className="font-mono text-xs text-muted-foreground mr-1.5">{item.sku}</span>{item.product_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[item.color, item.size].filter(Boolean).join(' · ')}{(item.color || item.size) ? ' · ' : ''}เหลือ {item.available}
                            </div>
                          </div>
                          {renderRemove(item)}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">จำนวน</Label>
                            <div className="mt-1">{renderQty(item)}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">ราคา/ชิ้น</Label>
                            <Input
                              type="number" min="0" step="0.01" inputMode="decimal"
                              className="mt-1 h-8 px-2 text-right"
                              value={item.unit_price}
                              onChange={e => updateCartItem(item.cartId, { unit_price: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">ส่วนลด</Label>
                            <div className="mt-1">{renderDiscount(item)}</div>
                          </div>
                          <div className="text-right">
                            <Label className="text-xs text-muted-foreground">รวม</Label>
                            <div className="mt-1 h-8 flex items-center justify-end font-semibold tabular-nums">{baht(calcLine(item).totalAmount)}</div>
                          </div>
                        </div>
                        {renderNote(item)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                {/* ค่าส่งของทั้งออเดอร์ — บอสขอให้กรอกตอนท้าย หลังใส่สินค้าครบ ก่อนกดบันทึก */}
                <div>
                  <Label htmlFor="shipping_fee">
                    ค่าส่ง (บาท) <span className="font-normal text-muted-foreground">(ไม่บังคับ — ลูกค้าโอนมา นับรวมยอดขาย, ใส่ครั้งเดียวต่อออเดอร์)</span>
                  </Label>
                  <Input
                    id="shipping_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-1"
                    placeholder="เช่น 50"
                    value={shippingFeeInput}
                    onChange={e => setShippingFeeInput(e.target.value)}
                  />
                </div>

                {/* ยอดรวม cart */}
                <div className="bg-orange-50 dark:bg-orange-950/40 rounded-lg p-3 space-y-1">
                  {shippingFee > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>ค่าสินค้า</span>
                        <span>฿{cartSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-sm text-blue-600">
                        <span>ค่าส่ง</span>
                        <span>+ ฿{shippingFee.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      {channel === 'online' && isCod ? 'ยอดเก็บเงินปลายทาง (COD)' : 'ยอดรวมทั้งหมด'} ({cartQty} ชิ้น)
                    </span>
                    <span className="text-lg font-bold text-orange-600">฿{cartTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Buttons บันทึก */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                    disabled={isAddingBatch}
                    onClick={handleSave}
                  >
                    {isAddingBatch
                      ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      : <><PackageCheck className="h-4 w-4 mr-2" />บันทึก → ออเดอร์ถัดไป</>}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-rose-400 text-rose-500 hover:bg-rose-50"
                    disabled={isAddingBatch}
                    onClick={handleSaveAndClose}
                  >
                    บันทึกเสร็จสิ้น
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">ออเดอร์ถัดไป</span> = คงวันที่ ช่องทาง สาขา และผู้บันทึกไว้ ล้างเฉพาะสินค้า ค่าส่ง และที่อยู่ ·{' '}
                  <span className="font-medium">บันทึกเสร็จสิ้น</span> = บันทึกแล้วปิดฟอร์ม
                </p>
              </div>
            )}

          </CardContent>
        </Card>

        {/* สรุปยอดวันนี้ */}
        <div className="space-y-4">
          <Card className="card-elevated overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-orange-500" />
                สรุปยอดขายวันนี้
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 pt-5">
              <div className="card-elevated bg-white dark:bg-gray-900 rounded-xl p-4 text-center border border-rose-100 dark:border-rose-900/30">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-2">
                  <Receipt className="h-4 w-4 text-rose-500" />
                </div>
                <p className="text-xs text-muted-foreground">รายการ</p>
                <p className="text-2xl font-bold text-rose-600 animate-count-up">{todayOrders.length}</p>
              </div>
              <div className="card-elevated bg-white dark:bg-gray-900 rounded-xl p-4 text-center border border-pink-100 dark:border-pink-900/30">
                <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mx-auto mb-2">
                  <Package className="h-4 w-4 text-pink-500" />
                </div>
                <p className="text-xs text-muted-foreground">จำนวนชิ้น</p>
                <p className="text-2xl font-bold text-pink-600 animate-count-up">{todayQty}</p>
              </div>
              <div className="col-span-2 card-elevated bg-white dark:bg-gray-900 rounded-xl p-4 text-center border border-orange-100 dark:border-orange-900/30">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-xs text-muted-foreground">ยอดขายรวมวันนี้</p>
                <p className="text-2xl font-bold text-orange-600 animate-count-up">
                  ฿{todayTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* สรุปออเดอร์ล่าสุด */}
      <Card className="card-elevated overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-rose-500" />
              สรุปออเดอร์ล่าสุด
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">
              {groupedOrders.length} ออเดอร์
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          ) : groupedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีรายการขาย</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {groupedOrders.map((group, idx) => (
                <AccordionItem
                  key={group.order_id || `legacy-${idx}`}
                  value={group.order_id || `legacy-${idx}`}
                  className="border-b last:border-0"
                >
                  <AccordionTrigger className="hover:no-underline px-3 sm:px-5 py-3 sm:py-4 hover:bg-muted/40 transition-colors cursor-pointer">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full mr-3 gap-2 sm:gap-4">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="flex flex-col items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/40 dark:to-pink-900/40 shrink-0">
                          <span className="text-[10px] font-medium text-rose-500 leading-none">
                            {new Date(group.created_at || group.date).toLocaleDateString('th-TH', { day: '2-digit' })}
                          </span>
                          <span className="text-[9px] text-rose-400 leading-none mt-0.5">
                            {new Date(group.created_at || group.date).toLocaleDateString('th-TH', { month: 'short' })}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="text-sm font-semibold truncate">{group.order_id || '-'}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 shrink-0",
                                group.channel === 'store'
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                                  : "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                              )}
                            >
                              {group.channel === 'store' ? 'หน้าร้าน' : 'ออนไลน์'}
                            </Badge>
                            {group.payment_method === 'cod' && (
                              <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-amber-500 hover:bg-amber-500 text-white border-0">COD</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{group.branch_or_platform}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">โดย {group.recorded_by || '-'}</span>
                            {group.created_at && (
                              <>
                                <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                  {new Date(group.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-12 sm:ml-0">
                        <p className="text-sm font-bold text-rose-600">
                          ฿{group.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {group.total_items} รายการ · {group.total_quantity} ชิ้น
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4">
                    <div className="rounded-xl border border-muted/60 overflow-hidden">
                      {group.channel === 'online' && group.shipping_address && (
                        <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-3 text-sm dark:border-blue-900/40 dark:bg-blue-950/20">
                          <div className="flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-300">
                            <MapPin className="h-3.5 w-3.5" />
                            ที่อยู่จัดส่ง
                          </div>
                          <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                            {group.shipping_address}
                          </p>
                        </div>
                      )}
                      {group.items.map((item, i) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 transition-colors",
                            i % 2 === 0 ? "bg-muted/20" : "bg-transparent"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.sku}
                              {(item.color || item.size) && ` · ${[item.color, item.size].filter(Boolean).join(' / ')}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-sm">
                              {item.quantity} × ฿{Number(item.unit_price).toLocaleString('th-TH')}
                            </p>
                            {Number(item.discount_amount) > 0 && (
                              <p className="text-[11px] text-rose-500">
                                -฿{Number(item.discount_amount).toLocaleString('th-TH')}
                              </p>
                            )}
                            {Number(item.shipping_fee) > 0 && (
                              <p className="text-[11px] text-blue-600">
                                ค่าส่ง +฿{Number(item.shipping_fee).toLocaleString('th-TH')}
                              </p>
                            )}
                            <p className="text-sm font-semibold">
                              ฿{Number(item.total_amount).toLocaleString('th-TH')}
                            </p>
                          </div>
                        </div>
                      ))}
                      {/* Footer total */}
                      <div className="flex items-center justify-between px-4 py-3 bg-rose-50/80 dark:bg-rose-950/30 border-t border-muted/60">
                        <span className="text-sm font-medium text-muted-foreground">ยอดรวม</span>
                        <span className="text-sm font-bold text-rose-600">
                          ฿{group.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {/* Delete Action */}
                      {(user?.role === 'admin' || user?.name === group.recorded_by) && (
                        <div className="px-4 py-3 bg-muted/20 border-t border-muted/60 flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs h-8"
                            disabled={isDeleting || isDeletingOrder}
                            onClick={() => handleDeleteOrder(group.order_id || group.items[0].id, !group.order_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            ลบออเดอร์
                          </Button>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>


    </div>
  );
}
