"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Package, Pencil, Trash2, Check, X, Search, AlertTriangle,
  TrendingDown, Boxes, CircleDollarSign, ShoppingCart
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from "recharts";
import { getStockInventory, getStockItems, deleteStockItem, updateStockItem, StockInventoryItem, StockItem } from "@/lib/stock-api";
import { toast } from "@/hooks/use-toast";

const STATUS_COLORS = {
  out: "#ef4444",
  low: "#f97316",
  ok: "#22c55e",
};

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "low" | "out">("all");

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

  function cancelEdit() { setEditingId(null); }

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

  // Derived stats
  const stats = useMemo(() => {
    const totalSKUs = inventory.length;
    const totalRemaining = inventory.reduce((s, i) => s + Number(i.remaining), 0);
    const outOfStock = inventory.filter(i => Number(i.remaining) <= 0).length;
    const lowStock = inventory.filter(i => Number(i.remaining) > 0 && Number(i.remaining) <= 3).length;
    const totalStockValue = inventory.reduce((s, i) => s + Number(i.stock_value), 0);
    return { totalSKUs, totalRemaining, outOfStock, lowStock, totalStockValue };
  }, [inventory]);

  const lowStockItems = useMemo(
    () => inventory.filter(i => Number(i.remaining) > 0 && Number(i.remaining) <= 3),
    [inventory]
  );

  // Chart data — top 10 by remaining
  const barData = useMemo(() => {
    return [...inventory]
      .sort((a, b) => Number(b.remaining) - Number(a.remaining))
      .slice(0, 10)
      .map(i => ({
        name: `${i.sku}${i.color ? '/' + i.color : ''}${i.size ? '/' + i.size : ''}`,
        remaining: Number(i.remaining),
        total_in: Number(i.total_in),
        color: Number(i.remaining) <= 0 ? STATUS_COLORS.out : Number(i.remaining) <= 3 ? STATUS_COLORS.low : STATUS_COLORS.ok,
      }));
  }, [inventory]);

  const pieData = useMemo(() => {
    const ok = inventory.filter(i => Number(i.remaining) > 3).length;
    const low = inventory.filter(i => Number(i.remaining) > 0 && Number(i.remaining) <= 3).length;
    const out = inventory.filter(i => Number(i.remaining) <= 0).length;
    return [
      { name: 'มีสต๊อก', value: ok, fill: STATUS_COLORS.ok },
      { name: 'ใกล้หมด', value: low, fill: STATUS_COLORS.low },
      { name: 'หมด', value: out, fill: STATUS_COLORS.out },
    ].filter(d => d.value > 0);
  }, [inventory]);

  // Filtered table
  const filtered = useMemo(() => {
    return inventory.filter(i => {
      const remaining = Number(i.remaining);
      const matchSearch = !search || [i.sku, i.product_name, i.color, i.size]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "out" ? remaining <= 0 :
        statusFilter === "low" ? remaining > 0 && remaining <= 3 :
        remaining > 3;
      return matchSearch && matchStatus;
    });
  }, [inventory, search, statusFilter]);

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

      {/* Alert banner */}
      {lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-orange-700 dark:text-orange-400">สินค้าใกล้หมด {lowStockItems.length} รายการ: </span>
            <span className="text-orange-600 dark:text-orange-300">
              {lowStockItems.map(i => `${i.product_name}${i.color ? ' ' + i.color : ''}${i.size ? ' ' + i.size : ''} (เหลือ ${i.remaining})`).join(' · ')}
            </span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">รายการทั้งหมด</p>
              <Boxes className="h-4 w-4 text-rose-400" />
            </div>
            <p className="text-3xl font-bold text-rose-600">{stats.totalSKUs}</p>
            <p className="text-xs text-muted-foreground mt-1">SKU/สี/ไซส์</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">คงเหลือรวม</p>
              <ShoppingCart className="h-4 w-4 text-pink-400" />
            </div>
            <p className="text-3xl font-bold text-pink-600">{stats.totalRemaining.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">ชิ้น</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">ใกล้หมด</p>
              <TrendingDown className="h-4 w-4 text-orange-400" />
            </div>
            <p className="text-3xl font-bold text-orange-500">{stats.lowStock}</p>
            <p className="text-xs text-muted-foreground mt-1">รายการ (≤ 3 ชิ้น)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">สินค้าหมด</p>
              <CircleDollarSign className="h-4 w-4 text-red-400" />
            </div>
            <p className="text-3xl font-bold text-red-500">{stats.outOfStock}</p>
            <p className="text-xs text-muted-foreground mt-1">รายการ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">มูลค่าสต๊อกรวม</p>
              <CircleDollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">
              ฿{stats.totalStockValue.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">ต้นทุน × คงเหลือ</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {!isLoading && inventory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bar Chart */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top 10 สินค้าคงเหลือมากสุด</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    width={110}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} ชิ้น`, 'คงเหลือ']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="remaining" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">สัดส่วนสถานะสต๊อก</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${value}`}
                    labelLine={false}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
                  />
                  <Tooltip formatter={(value: number) => [`${value} รายการ`]} contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <CardTitle className="text-base">รายละเอียดสต๊อกคงเหลือ</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา SKU / ชื่อ / สี / ไซส์..."
                  className="pl-8 h-8 text-sm w-56"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {/* Filter buttons */}
              <div className="flex gap-1">
                {([
                  { key: "all", label: "ทั้งหมด" },
                  { key: "ok", label: "มีสต๊อก" },
                  { key: "low", label: "ใกล้หมด" },
                  { key: "out", label: "หมด" },
                ] as const).map(f => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={statusFilter === f.key ? "default" : "outline"}
                    className={`h-8 text-xs px-3 ${statusFilter === f.key && f.key === "out" ? "bg-red-500 hover:bg-red-600 border-red-500" : statusFilter === f.key && f.key === "low" ? "bg-orange-500 hover:bg-orange-600 border-orange-500" : statusFilter === f.key && f.key === "ok" ? "bg-green-600 hover:bg-green-700 border-green-600" : ""}`}
                    onClick={() => setStatusFilter(f.key)}
                  >
                    {f.label}
                    {f.key !== "all" && (
                      <span className="ml-1 opacity-70">
                        ({f.key === "out" ? stats.outOfStock : f.key === "low" ? stats.lowStock : stats.totalSKUs - stats.outOfStock - stats.lowStock})
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">ไม่พบรายการที่ค้นหา</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">รูป</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead>สี</TableHead>
                    <TableHead>ไซส์</TableHead>
                    <TableHead className="text-right">รับเข้า</TableHead>
                    <TableHead className="text-right">ขายออก</TableHead>
                    <TableHead className="text-right">คงเหลือ</TableHead>
                    <TableHead className="text-right">ต้นทุน/ชิ้น</TableHead>
                    <TableHead className="text-right">ราคาขาย</TableHead>
                    <TableHead className="text-right">มูลค่าสต๊อก</TableHead>
                    <TableHead>สัดส่วน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item: StockInventoryItem, idx: number) => {
                    const remaining = Number(item.remaining);
                    const totalIn = Number(item.total_in);
                    const pct = totalIn > 0 ? Math.round((remaining / totalIn) * 100) : 0;
                    const isOut = remaining <= 0;
                    const isLow = remaining > 0 && remaining <= 3;
                    return (
                      <TableRow
                        key={`${item.sku}-${item.color}-${item.size}-${idx}`}
                        className={isOut ? 'bg-red-50 dark:bg-red-950/20' : isLow ? 'bg-orange-50 dark:bg-orange-950/10' : ''}
                      >
                        <TableCell className="py-1.5">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.product_name}
                              loading="lazy"
                              className="w-11 h-11 rounded-md object-cover border border-border"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-md bg-muted flex items-center justify-center border border-border">
                              <Package className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>{item.color || '-'}</TableCell>
                        <TableCell>{item.size || '-'}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{totalIn}</TableCell>
                        <TableCell className="text-right text-rose-500">{Number(item.total_sold)}</TableCell>
                        <TableCell className={`text-right font-bold ${isOut ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-green-600'}`}>
                          {remaining}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {Number(item.avg_cost_price) > 0 ? `฿${Number(item.avg_cost_price).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-blue-600 dark:text-blue-400 text-sm font-medium">
                          {Number(item.avg_sell_price) > 0 ? `฿${Number(item.avg_sell_price).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400 text-sm">
                          {Number(item.stock_value) > 0 ? `฿${Number(item.stock_value).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                        </TableCell>
                        <TableCell className="w-28">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: isOut ? STATUS_COLORS.out : isLow ? STATUS_COLORS.low : STATUS_COLORS.ok,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
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

      {/* Dialog */}
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
                              <Input type="number" className="h-7 w-20 text-right text-sm" value={editForm.quantity}
                                onChange={(e) => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-7 w-24 text-right text-sm" value={editForm.cost_price}
                                onChange={(e) => setEditForm(f => ({ ...f, cost_price: e.target.value }))} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-7 w-24 text-right text-sm" value={editForm.sell_price}
                                onChange={(e) => setEditForm(f => ({ ...f, sell_price: e.target.value }))} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-sm" value={editForm.note}
                                onChange={(e) => setEditForm(f => ({ ...f, note: e.target.value }))} />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="h-7 w-7 p-0"
                                  onClick={() => saveEdit(rec.id)} disabled={updateMutation.isPending}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
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
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEdit(rec)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDelete(rec.id)} disabled={deleteMutation.isPending}>
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
