
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { Income, Expense, Channel } from "@/types";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";

interface AddRecordFormProps {
  onSubmit: (record: Omit<Income, 'id' | 'createdAt' | 'updatedAt'> | Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => void;
  isSubmitting?: boolean;
  onClose?: () => void;
}

export function AddRecordForm({ onSubmit, isSubmitting = false, onClose }: AddRecordFormProps) {
  const { settings, refetch } = useSettings();
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
  const [date, setDate] = useState<Date>(new Date());
  const [channel, setChannel] = useState<Channel>('store');

  // Debug: แสดงข้อมูล branches ใน console
  console.log('AddRecordForm - Current branchesByChannel:', settings.branchesByChannel);

  // Get available branches based on selected channel
  const getAvailableBranches = (channel: Channel): string[] => {
    if (!settings.branchesByChannel) {
      return settings.branches || ['สาขาหลัก'];
    }
    return settings.branchesByChannel[channel] || [];
  };

  // Reset branch selection when channel changes
  useEffect(() => {
    setIncomeForm(prev => ({ ...prev, branch_or_platform: '' }));
    setExpenseForm(prev => ({ ...prev, branch_or_platform: '' }));
  }, [channel]);

  // Income form state
  const [incomeForm, setIncomeForm] = useState({
    branch_or_platform: '',
    product_name: '',
    product_category: '',
    quantity: 1,
    amount: 0,
    note: ''
  });

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    branch_or_platform: '',
    expense_item: '',
    expense_category: '',
    cost: 0,
    note: ''
  });

  const handleIncomeSubmit = (closeAfter: boolean) => {
    if (!incomeForm.branch_or_platform || !incomeForm.product_name || !incomeForm.product_category) {
      toast({
        title: "กรุณากรอกข้อมูลให้ครบ",
        description: "ช่องทางขาย สาขา/แพลตฟอร์ม ชื่อสินค้า และหมวดหมู่สินค้าเป็นข้อมูลที่จำเป็น",
        variant: "destructive"
      });
      return;
    }

    const record: Omit<Income, 'id' | 'createdAt' | 'updatedAt'> = {
      date: date.toISOString(),
      channel,
      ...incomeForm
    };

    onSubmit(record);

    toast({
      title: "บันทึกรายรับสำเร็จ",
      description: `เพิ่มรายรับ ${incomeForm.product_name} ในวันที่ ${formatDate(date.toISOString())} แล้ว`
    });

    if (closeAfter) {
      setIncomeForm({ branch_or_platform: '', product_name: '', product_category: '', quantity: 1, amount: 0, note: '' });
      onClose?.();
    } else {
      // รีเซ็ตเฉพาะตัวเลข รอใส่ใหม่
      setIncomeForm(prev => ({ ...prev, quantity: 1, amount: 0 }));
    }
  };

  const handleExpenseSubmit = (closeAfter: boolean) => {
    if (!expenseForm.branch_or_platform || !expenseForm.expense_item || !expenseForm.expense_category) {
      toast({
        title: "กรุณากรอกข้อมูลให้ครบ",
        description: "ช่องทางขาย สาขา/แพลตฟอร์ม รายการจ่าย และหมวดหมู่จ่ายเป็นข้อมูลที่จำเป็น",
        variant: "destructive"
      });
      return;
    }

    const record: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> = {
      date: date.toISOString(),
      channel,
      ...expenseForm
    };

    onSubmit(record);

    toast({
      title: "บันทึกรายจ่ายสำเร็จ",
      description: `เพิ่มรายจ่าย ${expenseForm.expense_item} ในวันที่ ${formatDate(date.toISOString())} แล้ว`
    });

    if (closeAfter) {
      setExpenseForm({ branch_or_platform: '', expense_item: '', expense_category: '', cost: 0, note: '' });
      onClose?.();
    } else {
      // รีเซ็ตเฉพาะตัวเลข รอใส่ใหม่
      setExpenseForm(prev => ({ ...prev, cost: 0 }));
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          เพิ่มรายการใหม่
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'income' | 'expense')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="income" className="text-green-600 data-[state=active]:bg-green-50">
              รายรับ
            </TabsTrigger>
            <TabsTrigger value="expense" className="text-red-600 data-[state=active]:bg-red-50">
              รายจ่าย
            </TabsTrigger>
          </TabsList>

          {/* Common fields */}
          <div className="space-y-4 mb-6">
            <div>
              <Label>วันที่</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDate(date.toISOString()) : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>ช่องทางขาย</Label>
              <RadioGroup value={channel} onValueChange={(value) => setChannel(value as Channel)} className="flex gap-6 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="store" id="store" />
                  <Label htmlFor="store">หน้าร้าน</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="online" id="online" />
                  <Label htmlFor="online">ออนไลน์</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <TabsContent value="income">
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="branch_platform_income">
                    {channel === 'store' ? 'สาขา *' : 'แพลตฟอร์ม *'}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => refetch()}
                    className="text-xs h-6 px-2"
                  >
                    รีเฟรช
                  </Button>
                </div>
                <Select
                  value={incomeForm.branch_or_platform}
                  onValueChange={(value) => setIncomeForm(prev => ({ ...prev, branch_or_platform: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา/แพลตฟอร์ม" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableBranches(channel).length > 0 ? (
                      getAvailableBranches(channel).map((branch: string) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        ไม่มีตัวเลือกสำหรับช่องทาง{channel === 'store' ? 'หน้าร้าน' : 'ออนไลน์'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {/* Debug info */}
                <div className="text-xs text-muted-foreground mt-1">
                  ตัวเลือกสำหรับ{channel === 'store' ? 'หน้าร้าน' : 'ออนไลน์'}: {getAvailableBranches(channel).length} รายการ
                </div>
              </div>

              <div>
                <Label htmlFor="product_name">ชื่อสินค้า *</Label>
                <Input
                  id="product_name"
                  value={incomeForm.product_name}
                  onChange={(e) => setIncomeForm(prev => ({ ...prev, product_name: e.target.value }))}
                  placeholder="เช่น กาแฟลาเต้"
                  required
                />
              </div>

              <div>
                <Label htmlFor="product_category">หมวดหมู่สินค้า *</Label>
                <Select
                  value={incomeForm.product_category}
                  onValueChange={(value) => setIncomeForm(prev => ({ ...prev, product_category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="มินิเดรส">มินิเดรส</SelectItem>
                    <SelectItem value="เดรสสั่งตัด">เดรสสั่งตัด</SelectItem>
                    <SelectItem value="เดรสยาว">เดรสยาว</SelectItem>
                    <SelectItem value="ผ้าคลุม">ผ้าคลุม</SelectItem>
                    <SelectItem value="กระโปรง">กระโปรง</SelectItem>
                    <SelectItem value="กางเกง">กางเกง</SelectItem>
                    <SelectItem value="เสื้อสั้น">เสื้อสั้น</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">จำนวน (ชิ้น)</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={incomeForm.quantity}
                    onChange={(e) => setIncomeForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">ยอดขาย (บาท)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={incomeForm.amount}
                    onChange={(e) => setIncomeForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="note_income">หมายเหตุ</Label>
                <Textarea
                  id="note_income"
                  value={incomeForm.note}
                  onChange={(e) => setIncomeForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1 bg-income hover:bg-income/90"
                  disabled={isSubmitting}
                  onClick={() => handleIncomeSubmit(false)}
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      บันทึก
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-income text-income hover:bg-income/10"
                  disabled={isSubmitting}
                  onClick={() => handleIncomeSubmit(true)}
                >
                  บันทึกและปิด
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="expense">
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <Label htmlFor="branch_platform_expense">
                  {channel === 'store' ? 'สาขา *' : 'แพลตฟอร์ม *'}
                </Label>
                <Select
                  value={expenseForm.branch_or_platform}
                  onValueChange={(value) => setExpenseForm(prev => ({ ...prev, branch_or_platform: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา/แพลตฟอร์ม" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableBranches(channel).length > 0 ? (
                      getAvailableBranches(channel).map((branch: string) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        ไม่มีตัวเลือกสำหรับช่องทาง{channel === 'store' ? 'หน้าร้าน' : 'ออนไลน์'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expense_item">รายการจ่าย *</Label>
                <Input
                  id="expense_item"
                  value={expenseForm.expense_item}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, expense_item: e.target.value }))}
                  placeholder="เช่น เมล็ดกาแฟอราบิก้า"
                  required
                />
              </div>

              <div>
                <Label htmlFor="expense_category">หมวดหมู่จ่าย *</Label>
                <Select
                  value={expenseForm.expense_category}
                  onValueChange={(value) => setExpenseForm(prev => ({ ...prev, expense_category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="วัตถุดิบ">วัตถุดิบ</SelectItem>
                    <SelectItem value="โลจิสติกส์">โลจิสติกส์</SelectItem>
                    <SelectItem value="สาธารณูปโภค">สาธารณูปโภค</SelectItem>
                    <SelectItem value="การตลาด">การตลาด</SelectItem>
                    <SelectItem value="เครื่องมือ">เครื่องมือ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cost">ค่าใช้จ่าย (บาท)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.cost}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>

              <div>
                <Label htmlFor="note_expense">หมายเหตุ</Label>
                <Textarea
                  id="note_expense"
                  value={expenseForm.note}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1 bg-expense hover:bg-expense/90"
                  disabled={isSubmitting}
                  onClick={() => handleExpenseSubmit(false)}
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      บันทึก
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-expense text-expense hover:bg-expense/10"
                  disabled={isSubmitting}
                  onClick={() => handleExpenseSubmit(true)}
                >
                  บันทึกและปิด
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
