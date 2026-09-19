import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { getAvailableStock } from "@/lib/stock-api";
import { OrderSummary, updateOrderItems } from "@/lib/sales-api";
import { toast } from "@/hooks/use-toast";
import { OrderItemsEditor, CartItem, calcLine, baht } from "@/components/sales/order-items-editor";

interface EditOrderItemsDialogProps {
  order: OrderSummary | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * ให้ mount ตอนเปิดเท่านั้น (`{order && <EditOrderItemsDialog key=... />}`) ค่าในฟอร์มจะเริ่มใหม่ทุกครั้งที่เปิด
 * แก้ไขสินค้าในออเดอร์ที่บันทึกไปแล้ว (เช่น กรอกผิดแต่ส่งของไปแล้ว)
 * เลขออเดอร์ วันที่ ช่องทาง ที่อยู่ COD สถานะจัดส่ง ผู้บันทึก คงเดิม — สต๊อกปรับตามให้เอง และบันทึกลงประวัติสต๊อก
 */
export function EditOrderItemsDialog({ order, onOpenChange }: EditOrderItemsDialogProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<CartItem[]>([]);
  const [shippingFeeInput, setShippingFeeInput] = useState('');

  // ใช้ตัวเลขสต๊อกล่าสุดเสมอ (รอโหลดใหม่ ไม่ใช้ของเก่าในแคช)
  const { data: stock = [], isFetchedAfterMount: stockLoaded } = useQuery({
    queryKey: ['stock', { available: true }],
    queryFn: getAvailableStock,
    staleTime: 0
  });

  // จำนวนที่ออเดอร์นี้ใช้อยู่ต่อล็อต — ตอนแก้ ของส่วนนี้ถือว่าเลือกได้ (จะคืนสต๊อกก่อนหักใหม่)
  const orderQtyByLot = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of order?.items ?? []) m[i.stock_in_id] = (m[i.stock_in_id] || 0) + Number(i.quantity);
    return m;
  }, [order]);

  // เปิดหน้าต่าง (และโหลดสต๊อกเสร็จ) → ตั้งค่าเริ่มจากออเดอร์เดิม
  useEffect(() => {
    if (!order || !stockLoaded) return;
    const lotAvailable = new Map(stock.map(s => [s.id, s.available_quantity]));
    setItems(order.items.map(i => ({
      cartId: i.id,
      stock_in_id: i.stock_in_id,
      sku: i.sku,
      product_name: i.product_name,
      color: i.color,
      size: i.size,
      available: (lotAvailable.get(i.stock_in_id) ?? 0) + (orderQtyByLot[i.stock_in_id] ?? 0),
      quantity: Number(i.quantity),
      unit_price: String(i.unit_price),
      discount_type: i.discount_type === 'percent' ? 'percent' : 'amount',
      discount_value: Number(i.discount_value) ? String(i.discount_value) : '',
      note: i.note || ''
    })));
    setShippingFeeInput(order.shipping_fee ? String(order.shipping_fee) : '');
    // ตั้งค่าครั้งเดียวต่อการเปิด ไม่ให้ทับที่แก้อยู่เมื่อสต๊อกโหลดใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.order_id, stockLoaded]);

  const shippingFee = Math.max(0, Number(shippingFeeInput) || 0);
  const subtotal = items.reduce((s, i) => s + calcLine(i).totalAmount, 0);
  const total = subtotal + shippingFee;
  const qty = items.reduce((s, i) => s + i.quantity, 0);
  const isCod = order?.payment_method === 'cod';

  const mutation = useMutation({
    mutationFn: updateOrderItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast({ title: 'แก้ไขออเดอร์แล้ว', description: `${order?.order_id} · สต๊อกปรับตามให้แล้ว` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'แก้ไขไม่สำเร็จ', description: error.message, variant: 'destructive' });
    }
  });

  const handleSave = () => {
    if (!order) return;
    if (items.length === 0) {
      toast({ title: 'ต้องมีสินค้าอย่างน้อย 1 รายการ', description: 'ถ้าจะยกเลิกทั้งออเดอร์ ให้ใช้ปุ่มลบออเดอร์', variant: 'destructive' });
      return;
    }
    const over = items.find(i => i.quantity > i.available);
    if (over) {
      toast({ title: 'สต๊อกไม่พอ', description: `${over.sku} เลือกได้ไม่เกิน ${over.available} ชิ้น`, variant: 'destructive' });
      return;
    }
    mutation.mutate({
      order_id: order.order_id,
      shipping_fee: shippingFee,
      items: items.map(i => ({
        stock_in_id: i.stock_in_id,
        sku: i.sku,
        product_name: i.product_name,
        color: i.color,
        size: i.size,
        quantity: i.quantity,
        unit_price: Number(i.unit_price) || 0,
        discount_type: i.discount_type,
        discount_value: Number(i.discount_value) || 0,
        note: i.note
      }))
    });
  };

  return (
    <Dialog open={!!order} onOpenChange={o => { if (!mutation.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขสินค้าในออเดอร์ {order?.order_id}</DialogTitle>
          <DialogDescription>
            เลขออเดอร์ วันที่ ที่อยู่ และสถานะจัดส่งคงเดิม · สต๊อกคืน/หักใหม่ให้อัตโนมัติ และบันทึกไว้ในหน้า "ความเคลื่อนไหวสต๊อก"
          </DialogDescription>
        </DialogHeader>

        {!stockLoaded ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> กำลังโหลดสต๊อก...
          </div>
        ) : (
          <div className="space-y-4">
            <OrderItemsEditor
              items={items}
              onChange={setItems}
              stock={stock}
              extraAvailable={orderQtyByLot}
              emptyText="ไม่มีสินค้าเหลือในออเดอร์ — เลือกสินค้าเพิ่ม หรือปิดหน้าต่างแล้วใช้ปุ่มลบออเดอร์"
            />
            <div>
              <Label htmlFor="edit_shipping_fee">ค่าส่ง (บาท)</Label>
              <Input
                id="edit_shipping_fee"
                type="number" min="0" step="0.01" inputMode="decimal"
                className="mt-1"
                placeholder="0"
                value={shippingFeeInput}
                onChange={e => setShippingFeeInput(e.target.value)}
              />
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/40 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>ค่าสินค้า ({qty} ชิ้น)</span><span>{baht(subtotal)}</span>
              </div>
              {shippingFee > 0 && (
                <div className="flex justify-between text-blue-600"><span>ค่าส่ง</span><span>+ {baht(shippingFee)}</span></div>
              )}
              <div className="flex justify-between items-center font-medium">
                <span>{isCod ? 'ยอดเก็บเงินปลายทาง (COD)' : 'ยอดรวมทั้งหมด'}</span>
                <span className="text-lg font-bold text-orange-600">{baht(total)}</span>
              </div>
              {order && Math.abs(total - order.total_amount) > 0.005 && (
                <p className="text-xs text-muted-foreground">ยอดเดิม {baht(order.total_amount)}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>ยกเลิก</Button>
          <Button
            className="bg-gradient-to-r from-rose-500 to-pink-500 text-white"
            onClick={handleSave}
            disabled={!stockLoaded || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            บันทึกการแก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
