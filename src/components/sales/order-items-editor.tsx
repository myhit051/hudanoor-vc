import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvailableStockItem } from "@/lib/stock-api";
import { toast } from "@/hooks/use-toast";

// 1 แถวในตารางสินค้าของออเดอร์ — เลือกสินค้าแล้วเข้าตารางทันที แก้จำนวน/ราคา/ส่วนลดในแถวได้
export type CartItem = {
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

export const calcLine = (item: CartItem) => {
  const price = Math.max(0, Number(item.unit_price) || 0);
  const val = Math.max(0, Number(item.discount_value) || 0);
  const discountAmount = item.discount_type === 'percent' ? price * (Math.min(val, 100) / 100) : Math.min(val, price);
  const finalUnitPrice = Math.max(0, price - discountAmount);
  return { discountAmount, finalUnitPrice, totalAmount: finalUnitPrice * item.quantity };
};

export const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface OrderItemsEditorProps {
  items: CartItem[];
  onChange: React.Dispatch<React.SetStateAction<CartItem[]>>;
  /** ล็อตที่ยังมีของ (available_quantity) — ใช้ในช่องค้นหา */
  stock: AvailableStockItem[];
  /** ข้อความเมื่อยังไม่มีสินค้า */
  emptyText?: string;
  /** ตอนแก้ออเดอร์เดิม: จำนวนที่ออเดอร์นี้ใช้อยู่แล้วต่อล็อต (บวกคืนเป็นของที่เลือกได้) */
  extraAvailable?: Record<string, number>;
}

/** ตารางสินค้าในออเดอร์ — ใช้ทั้งหน้าบันทึกยอดขายและหน้าต่างแก้ไขออเดอร์ (จอ < md เป็นการ์ด) */
export function OrderItemsEditor({ items, onChange, stock, emptyText = 'ยังไม่มีสินค้า — ค้นหาแล้วกดเลือกด้านบน', extraAvailable }: OrderItemsEditorProps) {
  const [stockComboOpen, setStockComboOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  // แถวที่เพิ่งเพิ่ม/บวกจำนวน — ไฮไลต์สีเขียวแวบหนึ่ง
  const [flashId, setFlashId] = useState('');

  // เลือกสินค้าแล้วเข้าตารางทันที · ตัวเดิมซ้ำ = บวกจำนวนในแถวเดิม (ไม่เกินสต๊อก)
  const handleSelectStock = (item: AvailableStockItem) => {
    const existing = items.find(c => c.stock_in_id === item.id);
    if (existing) {
      if (existing.quantity >= existing.available) {
        toast({ title: 'สต๊อกไม่พอ', description: `${item.sku} เหลือ ${existing.available} ชิ้น`, variant: 'destructive' });
        return;
      }
      onChange(prev => prev.map(c => c.cartId === existing.cartId ? { ...c, quantity: c.quantity + 1 } : c));
      flash(existing.cartId);
    } else {
      const cartId = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      onChange(prev => [...prev, {
        cartId,
        stock_in_id: item.id,
        sku: item.sku,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        available: item.available_quantity + (extraAvailable?.[item.id] ?? 0),
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
    onChange(prev => prev.map(c => c.cartId === cartId ? { ...c, ...patch } : c));

  const setQuantity = (item: CartItem, qty: number) =>
    updateCartItem(item.cartId, { quantity: Math.min(item.available, Math.max(1, Math.floor(qty) || 1)) });

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
    onChange(prev => prev.filter(i => i.cartId !== cartId));
  };


  return (
    <div className="space-y-3">
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
              {stock.map(item => {
                const inCart = items.find(c => c.stock_in_id === item.id)?.quantity ?? 0;
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

    {items.length === 0 ? (
      <p className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
        {emptyText}
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
              {items.map(item => (
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
          {items.map(item => (
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
  );
}
