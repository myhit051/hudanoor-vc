"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Employee, EmployeeCommissionReport, BranchCommission, SecondaryBranch } from "@/types/employee";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useEmployees } from "@/hooks/use-employees";
import { useUsers } from "@/hooks/use-users";
import { useSettings } from "@/hooks/use-settings";
import { useCommissionReports } from "@/hooks/use-commission-reports";
import { useAuth } from "@/hooks/use-auth";
import { EmployeeAccounts } from "@/components/employees/employee-accounts";
import {
  Plus,
  Users,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Calculator,
  TrendingUp,
  Store,
  Globe,
  Loader2,
  AlertCircle,
  Calendar,
  UserCheck,
  Search,
  Lightbulb,
  Star,
  Briefcase
} from "lucide-react";





export function EmployeeManagement() {
  const {
    employees,
    isLoading,
    error,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    isAddingEmployee,
    isUpdatingEmployee,
    isDeletingEmployee,
    refetch
  } = useEmployees();

  const { settings, refetch: refetchSettings } = useSettings();
  // รายชื่อ user account (active) — ใช้เป็นตัวเลือก "ผู้บันทึก" สำหรับคิดคอมเฉพาะคน
  const { users } = useUsers();
  const { isAdmin } = useAuth();

  // State สำหรับเลือกเดือนในรายงานคอมมิชชั่น
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    // Default เป็นเดือนปัจจุบัน
    return new Date().toISOString().substring(0, 7); // YYYY-MM format
  });
  
  // ใช้ข้อมูลคอมมิชชั่นจริงแทน mock data
  const { 
    reports: commissionReports, 
    isLoading: isLoadingCommissions,
    error: commissionError,
    totalCommissions,
    reportPeriod,
    refetch: refetchCommissions,
    fetchReports
  } = useCommissionReports(selectedPeriod);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    salary: 0,
    homeBranch: "",
    secondaryBranches: [] as SecondaryBranch[],
    branchCommissions: [] as BranchCommission[],
    phone: "",
    email: "",
    address: "",
    note: "",
    isActive: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const employeeData = {
      name: formData.name,
      position: formData.position,
      salary: formData.salary,
      homeBranch: formData.homeBranch,
      secondaryBranches: formData.secondaryBranches,
      branchCommissions: formData.branchCommissions,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      note: formData.note,
      isActive: formData.isActive,
      startDate: editingEmployee?.startDate || new Date().toISOString().split('T')[0]
    };

    try {
      if (editingEmployee) {
        await updateEmployee({ employeeId: editingEmployee.id, updates: employeeData });
      } else {
        await addEmployee(employeeData);
      }

      // Reset form
      setFormData({
        name: "",
        position: "",
        salary: 0,
        homeBranch: "",
        secondaryBranches: [],
        branchCommissions: [],
        phone: "",
        email: "",
        address: "",
        note: "",
        isActive: true
      });
      setIsAddDialogOpen(false);
      setEditingEmployee(null);
    } catch (error) {
      console.error('Error submitting employee:', error);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      position: employee.position,
      salary: employee.salary,
      homeBranch: employee.homeBranch || "",
      secondaryBranches: employee.secondaryBranches || [],
      branchCommissions: employee.branchCommissions || [],
      phone: employee.phone || "",
      email: employee.email || "",
      address: employee.address || "",
      note: employee.note || "",
      isActive: employee.isActive
    });
    setIsAddDialogOpen(true);
  };

  const addBranchCommission = () => {
    setFormData({
      ...formData,
      branchCommissions: [...formData.branchCommissions, { channel: "store", branchOrPlatform: "", commissionRate: 0 }]
    });
  };

  const removeBranchCommission = (index: number) => {
    const newCommissions = formData.branchCommissions.filter((_, i) => i !== index);
    setFormData({ ...formData, branchCommissions: newCommissions });
  };

  // สลับเลือก/ไม่เลือก user คนหนึ่งในรายชื่อผู้บันทึกของแถวค่าคอม
  const toggleCommissionSalesperson = (index: number, name: string) => {
    const current = formData.branchCommissions[index]?.salespersonNames || [];
    const next = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name];
    updateBranchCommission(index, 'salespersonNames', next);
  };

  const updateBranchCommission = (index: number, field: keyof BranchCommission, value: string | number | string[]) => {
    const newCommissions = [...formData.branchCommissions];
    newCommissions[index] = { ...newCommissions[index], [field]: value };

    // ถ้าเปลี่ยนช่องทาง ให้รีเซ็ตสาขา/แพลตฟอร์ม
    if (field === 'channel') {
      newCommissions[index].branchOrPlatform = '';
    }

    setFormData({ ...formData, branchCommissions: newCommissions });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEmployee(id);
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  const activeEmployees = employees.filter(emp => emp.isActive);
  const totalSalary = activeEmployees.reduce((sum, emp) => sum + emp.salary, 0);

  // กรอง + ค้นหา รายชื่อพนักงาน
  const filteredEmployees = employees.filter((emp) => {
    const matchStatus =
      statusFilter === "all" ? true : statusFilter === "active" ? emp.isActive : !emp.isActive;
    const q = search.trim().toLowerCase();
    const matchSearch =
      q === "" ||
      emp.name.toLowerCase().includes(q) ||
      (emp.position || "").toLowerCase().includes(q) ||
      (emp.homeBranch || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // สร้างรายการเดือนสำหรับ dropdown (12 เดือนย้อนหลัง)
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = date.toISOString().substring(0, 7); // YYYY-MM
      const label = date.toLocaleDateString('th-TH', { 
        year: 'numeric', 
        month: 'long' 
      });
      options.push({ value, label });
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  // ฟังก์ชันเปลี่ยนเดือน
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลดข้อมูลพนักงาน...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">เกิดข้อผิดพลาด</h3>
          <p className="text-muted-foreground mb-4">
            ไม่สามารถโหลดข้อมูลพนักงานได้
          </p>
          <Button onClick={() => refetch()} variant="outline">
            ลองใหม่อีกครั้ง
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            จัดการพนักงาน
          </h1>
          <p className="text-muted-foreground mt-1">
            บันทึกข้อมูลพนักงาน ตั้งค่าเงินเดือน และคำนวณค่าคอมมิชชั่น
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มพนักงาน
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl p-0 max-h-[92vh] flex flex-col">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {editingEmployee ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5">
                    {editingEmployee ? `กำลังแก้ไข: ${editingEmployee.name}` : "กรอกข้อมูลพนักงานพร้อมตั้งค่าเงินเดือนและคอม"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* SECTION 1 — ข้อมูลส่วนตัว */}
              <section className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Users className="h-4 w-4 text-rose-500" />
                  <h3 className="font-semibold text-sm">ข้อมูลส่วนตัว</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">ชื่อ-นามสกุล <span className="text-red-500">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="เช่น สมหญิง ใจดี"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="position">ตำแหน่ง <span className="text-red-500">*</span></Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="เช่น พนักงานขาย"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                    <div className="relative">
                      <Phone className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="08X-XXX-XXXX"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">อีเมล</Label>
                    <div className="relative">
                      <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="name@example.com"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 2 — ค่าตอบแทน + สาขา */}
              <section className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Calculator className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm">ค่าตอบแทนและสาขา</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="salary">เงินเดือน (บาท) <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                      <Input
                        id="salary"
                        type="number"
                        value={formData.salary || ''}
                        onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                        placeholder="0"
                        className="pl-7"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="homeBranch">สาขาประจำ</Label>
                    <Select
                      value={formData.homeBranch || "__none__"}
                      onValueChange={(value) => setFormData({ ...formData, homeBranch: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger id="homeBranch">
                        <SelectValue placeholder="เลือกสาขาประจำ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                        {(settings.branchesByChannel?.store || settings.branches || []).filter((b: string) => b && b.trim() !== '').map((branch: string) => (
                          <SelectItem key={`store-${branch}`} value={branch}>
                            <span className="inline-flex items-center gap-2"><Store className="h-3.5 w-3.5 text-blue-500" /> {branch}</span>
                          </SelectItem>
                        ))}
                        {(settings.branchesByChannel?.online || []).filter((b: string) => b && b.trim() !== '').map((branch: string) => (
                          <SelectItem key={`online-${branch}`} value={branch}>
                            <span className="inline-flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-purple-500" /> {branch}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">ใช้แบ่งกลุ่มในใบจ่ายเงินเดือน</p>
                  </div>
                </div>

                {/* Secondary branches as chips */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">สาขารอง (ที่ช่วยขาย)</Label>
                    {formData.secondaryBranches.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{formData.secondaryBranches.length} สาขา</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">คลิกเพื่อเพิ่ม/ลบ สาขาที่พนักงานช่วยขาย</p>
                  {(() => {
                    const stores = (settings.branchesByChannel?.store || settings.branches || []).filter((b: string) => b && b.trim() !== '');
                    const onlines = (settings.branchesByChannel?.online || []).filter((b: string) => b && b.trim() !== '');
                    const isChecked = (channel: 'store' | 'online', branch: string) =>
                      formData.secondaryBranches.some(sb => sb.channel === channel && sb.branchOrPlatform === branch);
                    const toggle = (channel: 'store' | 'online', branch: string) => {
                      const exists = isChecked(channel, branch);
                      setFormData({
                        ...formData,
                        secondaryBranches: exists
                          ? formData.secondaryBranches.filter(sb => !(sb.channel === channel && sb.branchOrPlatform === branch))
                          : [...formData.secondaryBranches, { channel, branchOrPlatform: branch }]
                      });
                    };
                    const Chip = ({ active, disabled, onClick, icon, label }: any) => (
                      <button
                        type="button"
                        onClick={onClick}
                        disabled={disabled}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          disabled
                            ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed line-through"
                            : active
                              ? "border-rose-500 bg-rose-500 text-white shadow-sm hover:bg-rose-600"
                              : "border-gray-200 bg-white text-gray-700 hover:border-rose-300 hover:bg-rose-50"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">{icon}{label}</span>
                      </button>
                    );
                    return (
                      <div className="space-y-3">
                        {stores.length > 0 && (
                          <div>
                            <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                              <Store className="h-3 w-3" /> หน้าร้าน
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {stores.map((branch: string) => (
                                <Chip
                                  key={`sec-store-${branch}`}
                                  active={isChecked('store', branch)}
                                  disabled={formData.homeBranch === branch}
                                  onClick={() => toggle('store', branch)}
                                  label={branch}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {onlines.length > 0 && (
                          <div>
                            <div className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                              <Globe className="h-3 w-3" /> ออนไลน์
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {onlines.map((branch: string) => (
                                <Chip
                                  key={`sec-online-${branch}`}
                                  active={isChecked('online', branch)}
                                  disabled={formData.homeBranch === branch}
                                  onClick={() => toggle('online', branch)}
                                  label={branch}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </section>

              {/* SECTION 3 — ค่าคอมมิชชั่น */}
              <section className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    <h3 className="font-semibold text-sm">ค่าคอมตามสาขา/แพลตฟอร์ม</h3>
                    {formData.branchCommissions.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{formData.branchCommissions.length} รายการ</Badge>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addBranchCommission}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    เพิ่ม
                  </Button>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-2.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>เคล็ดลับ:</strong> ถ้าเลือก "<strong>ทุกสาขา</strong>" → พนักงานจะได้คอมจากทุกยอดขายในช่องทางนั้น</span>
                </div>

                {formData.branchCommissions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">ยังไม่มีการตั้งค่าคอมมิชชั่น</p>
                    <p className="text-xs text-muted-foreground mt-0.5">คลิก "เพิ่ม" เพื่อกำหนดอัตรา</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.branchCommissions.map((commission, index) => {
                      const branchOptions = commission.channel === 'store'
                        ? (settings.branchesByChannel?.store || settings.branches || [])
                        : (settings.branchesByChannel?.online || []);
                      const validBranches = branchOptions.filter((b: string) => b && b.trim() !== '');
                      return (
                        <div key={index} className="border rounded-lg p-3 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10">
                          <div className="grid grid-cols-12 gap-2 items-end">
                            {/* Channel */}
                            <div className="col-span-12 sm:col-span-3 space-y-1">
                              <Label className="text-[11px] font-medium text-muted-foreground">ช่องทาง</Label>
                              <Select
                                value={commission.channel}
                                onValueChange={(value: 'store' | 'online') => updateBranchCommission(index, 'channel', value)}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="store"><span className="inline-flex items-center gap-2"><Store className="h-3.5 w-3.5 text-blue-500" /> หน้าร้าน</span></SelectItem>
                                  <SelectItem value="online"><span className="inline-flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-purple-500" /> ออนไลน์</span></SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Branch / Platform */}
                            <div className="col-span-8 sm:col-span-6 space-y-1">
                              <Label className="text-[11px] font-medium text-muted-foreground">
                                {commission.channel === 'store' ? 'สาขา' : 'แพลตฟอร์ม'}
                              </Label>
                              <Select
                                value={commission.branchOrPlatform || "__all__"}
                                onValueChange={(value) => updateBranchCommission(index, 'branchOrPlatform', value === "__all__" ? "" : value)}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__all__">
                                    <span className="inline-flex items-center gap-2 font-medium text-rose-600">
                                      <Star className="h-3.5 w-3.5" /> ทุก{commission.channel === 'store' ? 'สาขา' : 'แพลตฟอร์ม'}
                                    </span>
                                  </SelectItem>
                                  {validBranches.map((branch: string) => (
                                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Rate */}
                            <div className="col-span-3 sm:col-span-2 space-y-1">
                              <Label className="text-[11px] font-medium text-muted-foreground">เรท (%)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  placeholder="0"
                                  value={commission.commissionRate || ''}
                                  onChange={(e) => updateBranchCommission(index, 'commissionRate', Number(e.target.value) || 0)}
                                  className="h-9 text-sm pr-6"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                              </div>
                            </div>

                            {/* Delete */}
                            <div className="col-span-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBranchCommission(index)}
                                className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* ผู้บันทึกที่คิดคอม (recorded_by) — ว่าง = ทุกคน */}
                          {(() => {
                            const selected = commission.salespersonNames || [];
                            const summary = selected.length === 0
                              ? 'ทุกคน (ยอดรวมทั้งสาขา)'
                              : `เฉพาะ ${selected.length} คน: ${selected.join(', ')}`;
                            return (
                              <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-700/40 space-y-1">
                                <Label className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
                                  <UserCheck className="h-3.5 w-3.5 text-amber-500" />
                                  คิดคอมจากยอดของผู้บันทึก
                                </Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="w-full h-9 justify-between text-sm font-normal"
                                    >
                                      <span className={selected.length === 0 ? 'text-muted-foreground' : ''}>
                                        {summary}
                                      </span>
                                      <Users className="h-3.5 w-3.5 opacity-50 shrink-0" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 p-2" align="start">
                                    <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                                      <span className="text-xs font-medium text-muted-foreground">เลือกผู้ใช้ (เลือกได้หลายคน)</span>
                                      {selected.length > 0 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-[11px] text-muted-foreground"
                                          onClick={() => updateBranchCommission(index, 'salespersonNames', [])}
                                        >
                                          ล้าง (ทุกคน)
                                        </Button>
                                      )}
                                    </div>
                                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                                      {users.length === 0 ? (
                                        <p className="text-xs text-muted-foreground px-2 py-3 text-center">ไม่มีบัญชีผู้ใช้</p>
                                      ) : (
                                        users.map((u) => (
                                          <label
                                            key={u.id}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                                          >
                                            <Checkbox
                                              checked={selected.includes(u.name)}
                                              onCheckedChange={() => toggleCommissionSalesperson(index, u.name)}
                                            />
                                            <span className="truncate">{u.name}</span>
                                          </label>
                                        ))
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <p className="text-[10px] text-muted-foreground">
                                  ว่าง = คิดจากยอดขายของทุกคนในช่องทาง/สาขานี้
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* SECTION 4 — ข้อมูลเพิ่มเติม */}
              <section className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <MapPin className="h-4 w-4 text-cyan-500" />
                  <h3 className="font-semibold text-sm">ข้อมูลเพิ่มเติม</h3>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">ที่อยู่</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    placeholder="ที่อยู่พนักงาน"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">หมายเหตุ</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    rows={2}
                    placeholder="ข้อมูลเพิ่มเติม / เงื่อนไขพิเศษ"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                  <div>
                    <Label htmlFor="active" className="text-sm font-medium cursor-pointer">สถานะการทำงาน</Label>
                    <p className="text-xs text-muted-foreground">ปิดเมื่อพนักงานลาออก</p>
                  </div>
                  <Switch
                    id="active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </section>
            </form>

            {/* Sticky footer */}
            <div className="border-t bg-background px-6 py-4 flex items-center justify-end gap-2 rounded-b-lg">
              <Button type="button" variant="outline" onClick={() => {
                setIsAddDialogOpen(false);
                setEditingEmployee(null);
                setFormData({
                  name: "",
                  position: "",
                  salary: 0,
                  homeBranch: "",
                  secondaryBranches: [],
                  branchCommissions: [],
                  phone: "",
                  email: "",
                  address: "",
                  note: "",
                  isActive: true
                });
              }}>
                ยกเลิก
              </Button>
              <Button
                onClick={(e) => handleSubmit(e as any)}
                disabled={isAddingEmployee || isUpdatingEmployee}
                className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 min-w-[140px]"
              >
                {(isAddingEmployee || isUpdatingEmployee) ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังบันทึก...</>
                ) : (
                  editingEmployee ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/20">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">พนักงานทั้งหมด</p>
              <p className="text-2xl font-bold tabular-nums leading-tight">{employees.length}</p>
              <p className="text-xs text-muted-foreground">ทำงานอยู่ {activeEmployees.length} คน</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20">
              <Calculator className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">เงินเดือนรวม / เดือน</p>
              <p className="text-2xl font-bold tabular-nums leading-tight truncate">{formatCurrency(totalSalary)}</p>
              <p className="text-xs text-muted-foreground">เฉพาะพนักงานที่ทำงานอยู่</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">คอมมิชชั่นเดือนนี้</p>
              <p className="text-2xl font-bold tabular-nums leading-tight truncate">
                {isLoadingCommissions ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalCommissions || 0)}
              </p>
              <p className="text-xs text-muted-foreground">{reportPeriod ? `เดือน ${reportPeriod}` : 'เดือนปัจจุบัน'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">รายชื่อพนักงาน</TabsTrigger>
          <TabsTrigger value="commission">รายงานคอมมิชชั่น</TabsTrigger>
          {isAdmin && <TabsTrigger value="accounts">บัญชีผู้ใช้</TabsTrigger>}
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          {/* Toolbar: ค้นหา + กรองสถานะ */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ ตำแหน่ง หรือสาขา"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 self-start">
              {([
                { key: "all", label: "ทั้งหมด" },
                { key: "active", label: "ทำงานอยู่" },
                { key: "inactive", label: "พักงาน" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    statusFilter === opt.key
                      ? "bg-background text-rose-600 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {employees.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 mb-4">
                  <Users className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold mb-1">ยังไม่มีข้อมูลพนักงาน</h3>
                <p className="text-muted-foreground text-center mb-4 text-sm">
                  เริ่มต้นเพิ่มข้อมูลพนักงานและตั้งค่าเงินเดือน
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600">
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มพนักงานคนแรก
                </Button>
              </CardContent>
            </Card>
          ) : filteredEmployees.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">ไม่พบพนักงานที่ตรงกับการค้นหา</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredEmployees.map((employee) => {
                const commissions = Array.isArray(employee.branchCommissions) ? employee.branchCommissions : [];
                return (
                  <Card
                    key={employee.id}
                    className={`group relative overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:border-rose-200 dark:hover:border-rose-900/50 ${!employee.isActive ? "opacity-75" : ""}`}
                  >
                    <CardContent className="p-5">
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 text-white font-semibold text-lg">
                            {employee.name.charAt(0)}
                          </div>
                          {employee.isActive && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base text-foreground truncate">{employee.name}</h3>
                            {!employee.isActive && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">พักงาน</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{employee.position || "—"}</span>
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDate(employee.startDate)}
                            </span>
                            {employee.homeBranch && (
                              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                                <MapPin className="h-3 w-3" /> {employee.homeBranch}
                              </span>
                            )}
                            {Array.isArray(employee.secondaryBranches) && employee.secondaryBranches.length > 0 && (
                              <span>+ {employee.secondaryBranches.length} สาขารอง</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleEdit(employee)}
                            className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                            aria-label={`แก้ไข ${employee.name}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleDelete(employee.id)}
                            disabled={isDeletingEmployee}
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            aria-label={`ลบ ${employee.name}`}
                          >
                            {isDeletingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Salary + commission count */}
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                          <p className="text-[11px] font-medium text-muted-foreground">เงินเดือน</p>
                          <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(employee.salary)}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                          <p className="text-[11px] font-medium text-muted-foreground">ค่าคอม</p>
                          <p className="text-lg font-bold tabular-nums">
                            {commissions.length}
                            <span className="text-xs font-normal text-muted-foreground"> สาขา/แพลตฟอร์ม</span>
                          </p>
                        </div>
                      </div>

                      {/* Commission chips */}
                      {commissions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {commissions.map((c, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs"
                            >
                              {c.channel === "store"
                                ? <Store className="h-3 w-3 text-blue-500" />
                                : <Globe className="h-3 w-3 text-purple-500" />}
                              <span className="text-muted-foreground">{c.branchOrPlatform || "ทุกสาขา"}</span>
                              <span className="font-semibold tabular-nums">{c.commissionRate || 0}%</span>
                              {Array.isArray(c.salespersonNames) && c.salespersonNames.length > 0 && (
                                <UserCheck className="h-3 w-3 text-amber-500" />
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Contact / note — compact */}
                      {(employee.phone || employee.email || employee.address || employee.note) && (
                        <div className="mt-3 pt-3 border-t space-y-1.5 text-sm">
                          {employee.phone && (
                            <p className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0" /> <span className="text-foreground">{employee.phone}</span>
                            </p>
                          )}
                          {employee.email && (
                            <p className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="text-foreground truncate">{employee.email}</span>
                            </p>
                          )}
                          {employee.address && (
                            <p className="flex items-start gap-2 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span className="text-foreground">{employee.address}</span>
                            </p>
                          )}
                          {employee.note && (
                            <p className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                              <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span>{employee.note}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="commission" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle>รายงานคอมมิชชั่นประจำเดือน</CardTitle>
                  <CardDescription>
                    คำนวณจากยอดขายจริงและอัตราคอมมิชชั่นของแต่ละพนักงาน
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="period-select" className="text-sm font-medium whitespace-nowrap">
                      เลือกเดือน:
                    </Label>
                    <Select 
                      value={selectedPeriod} 
                      onValueChange={handlePeriodChange}
                    >
                      <SelectTrigger className="w-40" id="period-select">
                        <SelectValue placeholder="เลือกเดือน" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refetchCommissions}
                    disabled={isLoadingCommissions}
                  >
                    {isLoadingCommissions ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <TrendingUp className="h-4 w-4 mr-2" />
                    )}
                    รีเฟรชข้อมูล
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCommissions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mr-3" />
                  <span>กำลังคำนวณคอมมิชชั่น...</span>
                </div>
              ) : commissionError ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">เกิดข้อผิดพลาด</h3>
                  <p className="text-muted-foreground mb-4">{commissionError}</p>
                  <Button onClick={refetchCommissions} variant="outline">
                    ลองใหม่อีกครั้ง
                  </Button>
                </div>
              ) : commissionReports.length === 0 ? (
                <div className="text-center py-8">
                  <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">ไม่มีข้อมูลคอมมิชชั่น</h3>
                  <p className="text-muted-foreground mb-2">
                    ไม่พบข้อมูลคอมมิชชั่นสำหรับเดือน {monthOptions.find(opt => opt.value === selectedPeriod)?.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    อาจเป็นเพราะยังไม่มีพนักงานที่มีการตั้งค่าคอมมิชชั่นหรือยอดขายในเดือนนี้
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Period Display */}
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        รายงานประจำเดือน: {monthOptions.find(opt => opt.value === selectedPeriod)?.label || selectedPeriod}
                      </span>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                            <Store className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-green-700 dark:text-green-300">คอมหน้าร้าน</div>
                            <div className="text-xl font-bold text-green-800 dark:text-green-200">
                              {formatCurrency(commissionReports.reduce((sum, report) => sum + report.storeCommission, 0))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-700">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <Globe className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">คอมออนไลน์</div>
                            <div className="text-xl font-bold text-blue-800 dark:text-blue-200">
                              {formatCurrency(commissionReports.reduce((sum, report) => sum + report.onlineCommission, 0))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-700">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-purple-700 dark:text-purple-300">คอมรวม</div>
                            <div className="text-xl font-bold text-purple-800 dark:text-purple-200">
                              {formatCurrency(totalCommissions)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Commission Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>พนักงาน</TableHead>
                          <TableHead className="text-right">ยอดขายหน้าร้าน</TableHead>
                          <TableHead className="text-right">ยอดขายออนไลน์</TableHead>
                          <TableHead className="text-right">คอมหน้าร้าน</TableHead>
                          <TableHead className="text-right">คอมออนไลน์</TableHead>
                          <TableHead className="text-right">คอมรวม</TableHead>
                          <TableHead className="text-right">เงินเดือน</TableHead>
                          <TableHead className="text-right">รวมทั้งหมด</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionReports.map((report) => (
                          <TableRow key={`${report.employeeId}-${report.period}`} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="font-medium">{report.employeeName}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(report.storeSales)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(report.onlineSales)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(report.storeCommission)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(report.onlineCommission)}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600 tabular-nums">
                              {formatCurrency(report.totalCommission)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(report.salary)}</TableCell>
                            <TableCell className="text-right font-bold text-blue-600 tabular-nums">
                              {formatCurrency(report.totalEarnings)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Total Summary */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-semibold">
                      <div className="flex flex-col">
                        <span>รวมทั้งหมด ({commissionReports.length} คน)</span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {monthOptions.find(opt => opt.value === selectedPeriod)?.label}
                        </span>
                      </div>
                      <div className="flex gap-6">
                        <span className="text-green-600">
                          คอม: {formatCurrency(totalCommissions)}
                        </span>
                        <span className="text-blue-600">
                          เงินเดือน: {formatCurrency(commissionReports.reduce((sum, report) => sum + report.salary, 0))}
                        </span>
                        <span className="text-purple-600">
                          รวม: {formatCurrency(commissionReports.reduce((sum, report) => sum + report.totalEarnings, 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="accounts" className="space-y-4">
            <EmployeeAccounts />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}