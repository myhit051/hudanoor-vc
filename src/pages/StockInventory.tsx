"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { getStockInventory, StockInventoryItem } from "@/lib/stock-api";

export function StockInventory() {
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['stock', { view: 'inventory' }],
    queryFn: getStockInventory,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false
  });

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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
