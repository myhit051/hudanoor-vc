import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSales } from '@/hooks/use-sales';
import { groupSalesByOrder } from '@/lib/sales-api';
import { Search, History, Trash2, Loader2, PackageCheck, TrendingUp, ShoppingCart, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

export function OrderHistory() {
  const { user } = useAuth();
  
  const toLocalDateStr = (d: Date) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];
  };

  // Date filter state (default to today)
  const [dateFrom, setDateFrom] = useState(toLocalDateStr(new Date()));
  const [dateTo, setDateTo] = useState(toLocalDateStr(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [preset, setPreset] = useState('today');

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const today = new Date();
    
    switch (value) {
      case 'today':
        setDateFrom(toLocalDateStr(today));
        setDateTo(toLocalDateStr(today));
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateFrom(toLocalDateStr(yesterday));
        setDateTo(toLocalDateStr(yesterday));
        break;
      case 'last7days':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        setDateFrom(toLocalDateStr(last7));
        setDateTo(toLocalDateStr(today));
        break;
      case 'last30days':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 29);
        setDateFrom(toLocalDateStr(last30));
        setDateTo(toLocalDateStr(today));
        break;
      case 'thisMonth':
        const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setDateFrom(toLocalDateStr(firstDayThisMonth));
        setDateTo(toLocalDateStr(today));
        break;
      case 'lastMonth':
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateFrom(toLocalDateStr(firstDayLastMonth));
        setDateTo(toLocalDateStr(lastDayLastMonth));
        break;
      case 'all':
        setDateFrom('');
        setDateTo('');
        break;
    }
  };

  const { salesOrders, isLoading, deleteSale, deleteOrder, isDeleting, isDeletingOrder } = useSales();

  // Filter sales based on date and search query
  const filteredSales = useMemo(() => {
    return salesOrders.filter(sale => {
      // Date filter
      if (dateFrom && sale.date < dateFrom) return false;
      if (dateTo && sale.date > dateTo) return false;
      
      // Search query (sku, product name, order id, note)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (sale.order_id || '').toLowerCase().includes(q) ||
          (sale.product_name || '').toLowerCase().includes(q) ||
          (sale.sku || '').toLowerCase().includes(q) ||
          (sale.note || '').toLowerCase().includes(q) ||
          (sale.recorded_by || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [salesOrders, dateFrom, dateTo, searchQuery]);

  const groupedOrders = useMemo(() => groupSalesByOrder(filteredSales), [filteredSales]);

  // Calculate Summary KPIs
  const summary = useMemo(() => {
    let totalAmount = 0;
    let totalItems = 0;
    
    groupedOrders.forEach(order => {
      totalAmount += order.total_amount;
      totalItems += order.total_quantity;
    });

    return {
      totalAmount,
      totalOrders: groupedOrders.length,
      totalItems
    };
  }, [groupedOrders]);

  // Handle Delete
  const handleDeleteOrder = (orderId: string, isLegacy: boolean) => {
    if (!confirm('คุณต้องการลบออเดอร์นี้ใช่หรือไม่? ข้อมูลการขายจะถูกลบและสต๊อกจะถูกคืนกลับอัตโนมัติ')) return;
    if (isLegacy) {
      deleteSale(orderId);
    } else {
      deleteOrder(orderId);
    }
  };

  return (
    <div className="space-y-6 page-enter max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6 text-rose-500" />
          ประวัติการขาย
        </h2>
        <p className="text-muted-foreground mt-1">ดูรายการออเดอร์ย้อนหลัง ค้นหา และลบรายการ</p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-gray-800 shadow-sm border border-rose-100 dark:border-rose-900/30">
          <CardContent className="p-4 sm:p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">ยอดขายรวม</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                ฿{summary.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border border-blue-100 dark:border-blue-900/30">
          <CardContent className="p-4 sm:p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">จำนวนออเดอร์</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary.totalOrders.toLocaleString('th-TH')} <span className="text-base font-normal text-muted-foreground">บิล</span>
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 shadow-sm border border-emerald-100 dark:border-emerald-900/30">
          <CardContent className="p-4 sm:p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">จำนวนสินค้าที่ขาย</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary.totalItems.toLocaleString('th-TH')} <span className="text-base font-normal text-muted-foreground">ชิ้น</span>
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-elevated">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>ช่วงเวลา</Label>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกช่วงเวลา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">วันนี้</SelectItem>
                  <SelectItem value="yesterday">เมื่อวาน</SelectItem>
                  <SelectItem value="last7days">7 วันล่าสุด</SelectItem>
                  <SelectItem value="last30days">30 วันล่าสุด</SelectItem>
                  <SelectItem value="thisMonth">เดือนนี้</SelectItem>
                  <SelectItem value="lastMonth">เดือนที่ผ่านมา</SelectItem>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ตั้งแต่วันที่</Label>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={e => { setDateFrom(e.target.value); setPreset('custom'); }} 
              />
            </div>
            <div className="space-y-2">
              <Label>ถึงวันที่</Label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={e => { setDateTo(e.target.value); setPreset('custom'); }} 
              />
            </div>
            <div className="space-y-2">
              <Label>ค้นหา</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="รหัสออเดอร์, สินค้า, พนักงาน..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-b p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-rose-500" />
              รายการออเดอร์ ({groupedOrders.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="h-8 w-8 text-rose-500 animate-spin" />
            </div>
          ) : groupedOrders.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>ไม่พบรายการออเดอร์ที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {groupedOrders.map((group, idx) => (
                <AccordionItem
                  key={group.order_id || `legacy-${idx}`}
                  value={group.order_id || `legacy-${idx}`}
                  className="border-b last:border-0"
                >
                  <AccordionTrigger className="hover:no-underline px-4 sm:px-6 py-4 hover:bg-muted/40 transition-colors cursor-pointer">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full mr-3 gap-2 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/40 dark:to-pink-900/40 shrink-0">
                          <span className="text-[10px] font-medium text-rose-500 leading-none">
                            {new Date(group.created_at || group.date).toLocaleDateString('th-TH', { day: '2-digit' })}
                          </span>
                          <span className="text-[9px] text-rose-400 leading-none mt-1">
                            {new Date(group.created_at || group.date).toLocaleDateString('th-TH', { month: 'short' })}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold truncate">{group.order_id || '-'}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 shrink-0",
                                group.channel === 'store'
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                  : "bg-blue-50 text-blue-600 border-blue-200"
                              )}
                            >
                              {group.channel === 'store' ? 'หน้าร้าน' : 'ออนไลน์'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">{group.branch_or_platform}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">บันทึกโดย {group.recorded_by || '-'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-12 sm:ml-0">
                        <p className="text-sm font-bold text-rose-600">
                          ฿{group.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {group.total_items} รายการ · {group.total_quantity} ชิ้น
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="rounded-xl border border-muted/60 overflow-hidden bg-white dark:bg-gray-900/50">
                      {group.items.map((item, i) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 transition-colors",
                            i % 2 === 0 ? "bg-muted/10" : "bg-transparent"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.sku}
                              {(item.color || item.size) && ` · ${[item.color, item.size].filter(Boolean).join(' / ')}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-sm">
                              {item.quantity} × ฿{Number(item.unit_price).toLocaleString('th-TH')}
                            </p>
                            {Number(item.discount_amount) > 0 && (
                              <p className="text-[11px] text-rose-500 mt-0.5">
                                ส่วนลด: -฿{Number(item.discount_amount).toLocaleString('th-TH')}
                              </p>
                            )}
                            <p className="text-sm font-semibold mt-0.5">
                              ฿{Number(item.total_amount).toLocaleString('th-TH')}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {/* Footer total & Action */}
                      <div className="flex items-center justify-between px-4 py-3 bg-rose-50/80 dark:bg-rose-950/30 border-t border-muted/60">
                        <span className="text-sm font-medium text-muted-foreground">ยอดรวมสุทธิ</span>
                        <span className="text-sm font-bold text-rose-600">
                          ฿{group.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      {(user?.role === 'admin' || user?.name === group.recorded_by) && (
                        <div className="px-4 py-3 bg-muted/20 border-t border-muted/60 flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs"
                            disabled={isDeleting || isDeletingOrder}
                            onClick={() => handleDeleteOrder(group.order_id || group.items[0].id, !group.order_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
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

export default OrderHistory;
