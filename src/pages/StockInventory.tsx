"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Pencil, Trash2, Check, X } from "lucide-react";
import { getStockInventory, getStockItems, deleteStockItem, updateStockItem, StockInventoryItem, StockItem } from "@/lib/stock-api";
import { toast } from "@/hooks/use-toast";

export function StockInventory() {
  const queryClient = useQueryClient();

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['stock', { view: 'inventory' }],
    queryFn: getStockInventory,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false
  });

  // Dialog state
  const [selected, setSelected] = useState<StockInventoryItem | null>(null);

  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['stock', { sku: selected?.sku, color: selected?.color, size: selected?.size }],
    queryFn: () => getStockItems({ sku: selected!.sku }),
    enabled: !!selected,
    select: (items) => items.filter(
      (i) => i.color === selected?.color && i.size === selected?.size
    ),
    staleTime: 0
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStockItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'ลบรายการสำเร็จ' });
    },
    onError: () => {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถลบรายการได้', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StockItem> }) => updateStockItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'แก้ไขสำเร็จ' });
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  });

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ quantity: string; cost_price: string; sell_price: string; note: string }>({
    quantity: '', cost_price: '', sell_price: '', note: ''
  });

  function startEdit(item: StockItem) {
    setEditingId(item.id);
    setEditForm({
      quantity: String(item.quantity),
      cost_price: String(item.cost_price),
      sell_price: String(item.sell_price),
      note: item.note || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(id: string) {
    updateMutation.mutate({
      id,
      data: {
        quantity: Number(editForm.quantity),
        cost_price: Number(editForm.cost_price),
        sell_price: Number(editForm.sell_price),
        note: editForm.note
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm('ยืนยันการลบรายการนี้?')) return;
    deleteMutation.mutate(id);
  }

  const totalSKUs = inventory.length;
  const totalRemaining = inventory.reduce((s, i) => s + Number(i.remaining), 0);
  const outOfStock = inventory.filter(i => Number(i.remaining) <= 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-rose-500" />
          สต๊อกคงเหลือ
        </h1>
        <p className="text-muted-foreground text-sm mt-1">แสดงสินค้าคงเหลือจากการรับเข้าและขายออก</p>
      </div>

      {/* สรุปภาพรวม */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">รายการทั้งหมด</p>
            <p className="text-3xl font-bold text-rose-600">{totalSKUs}</p>
            <p className="text-xs text-muted-foreground">SKU/สี/ไซส์</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">คงเหลือรวม</p>
            <p className="text-3xl font-bold text-pink-600">{totalRemaining}</p>
            <p className="text-xs text-muted-foreground">ชิ้น</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">สินค้าหมด</p>
            <p className="text-3xl font-bold text-red-500">{outOfStock}</p>
            <p className="text-xs text-muted-foreground">รายการ</p>
          </CardContent>
        </Card>
      </div>

      {/* ตารางสต๊อก */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดสต๊อกคงเหลือ</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">ยังไม่มีข้อมูลสต๊อก</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead>สี</TableHead>
                    <TableHead>ไซส์</TableHead>
                    <TableHead className="text-right">รับเข้า</TableHead>
                    <TableHead className="text-right">ขายออก</TableHead>
                    <TableHead className="text-right">คงเหลือ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item: StockInventoryItem, idx: number) => {
                    const remaining = Number(item.remaining);
                    const isOut = remaining <= 0;
                    const isLow = remaining > 0 && remaining <= 3;
                    return (
                      <TableRow
                        key={`${item.sku}-${item.color}-${item.size}-${idx}`}
                        className={isOut ? 'bg-red-50 dark:bg-red-950/20' : ''}
                      >
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.color || '-'}</TableCell>
                        <TableCell>{item.size || '-'}</TableCell>
                        <TableCell className="text-right">{Number(item.total_in)}</TableCell>
                        <TableCell className="text-right text-rose-500">{Number(item.total_sold)}</TableCell>
                        <TableCell className={`text-right font-bold ${isOut ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-green-600'}`}>
                          {remaining}
                        </TableCell>
                        <TableCell>
                          {isOut
                            ? <Badge variant="destructive" className="text-xs">หมด</Badge>
                            : isLow
                              ? <Badge variant="outline" className="text-xs border-orange-400 text-orange-500">ใกล้หมด</Badge>
                              : <Badge variant="outline" className="text-xs border-green-400 text-green-600">มีสต๊อก</Badge>
                          }
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => setSelected(item)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            จัดการ
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog จัดการ records ย่อย */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditingId(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-rose-500" />
              จัดการสต๊อก: {selected?.sku}
              {selected?.color && <span className="text-muted-foreground font-normal">/ {selected.color}</span>}
              {selected?.size && <span className="text-muted-foreground font-normal">/ {selected.size}</span>}
            </DialogTitle>
          </DialogHeader>

          {recordsLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">ไม่พบรายการ</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead className="text-right">ต้นทุน</TableHead>
                    <TableHead className="text-right">ราคาขาย</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((rec) => {
                    const isEditing = editingId === rec.id;
                    return (
                      <TableRow key={rec.id}>
                        <TableCell className="text-sm">{rec.date}</TableCell>
                        {isEditing ? (
                          <>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-7 w-20 text-right text-sm"
                                value={editForm.quantity}
                                onChange={(e) => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-7 w-24 text-right text-sm"
                                value={editForm.cost_price}
                                onChange={(e) => setEditForm(f => ({ ...f, cost_price: e.target.value }))}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-7 w-24 text-right text-sm"
                                value={editForm.sell_price}
                                onChange={(e) => setEditForm(f => ({ ...f, sell_price: e.target.value }))}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-7 text-sm"
                                value={editForm.note}
                                onChange={(e) => setEditForm(f => ({ ...f, note: e.target.value }))}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 w-7 p-0"
                                  onClick={() => saveEdit(rec.id)}
                                  disabled={updateMutation.isPending}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={cancelEdit}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-right text-sm">{rec.quantity}</TableCell>
                            <TableCell className="text-right text-sm">{rec.cost_price.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-sm">{rec.sell_price.toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{rec.note || '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEdit(rec)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDelete(rec.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
