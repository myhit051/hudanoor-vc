import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getEmployeeAccounts, updateEmployeeAccount, EmployeeAccount } from '@/lib/auth-api';
import { KeyRound, Loader2, ShieldCheck, UserPlus } from 'lucide-react';

const MENU_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'add-record', label: 'บันทึกรายการใหม่' },
  { id: 'stock-receiving', label: 'รับสินค้าเข้าสต๊อก' },
  { id: 'sales-entry', label: 'บันทึกยอดขาย' },
  { id: 'order-history', label: 'ประวัติการขาย' },
  { id: 'stock-inventory', label: 'สต๊อกคงเหลือ' },
  { id: 'task-reminder', label: 'Task Reminder' },
  { id: 'employees', label: 'จัดการพนักงาน' },
  { id: 'payroll', label: 'จ่ายเงินเดือน (Admin เท่านั้น)' },
  { id: 'settings', label: 'การตั้งค่า' },
];

interface EditState {
  employeeId: string;
  name: string;
  login_username: string;
  pin: string;
  role: string;
  allowed_menus: string[];
  account_active: boolean;
  hasAccount: boolean;
}

export function EmployeeAccounts() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<EmployeeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setAccounts(await getEmployeeAccounts());
    } catch (e: any) {
      toast({ title: 'โหลดข้อมูลบัญชีไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const openEdit = (a: EmployeeAccount) => {
    setEdit({
      employeeId: a.id,
      name: a.name,
      login_username: a.login_username || '',
      pin: '',
      role: a.role || 'employee',
      allowed_menus: a.allowed_menus || [],
      account_active: a.account_active === 1,
      hasAccount: a.has_account,
    });
  };

  const handleSave = async () => {
    if (!edit) return;
    const uname = edit.login_username.trim();
    if (!uname) {
      toast({ title: 'ต้องระบุชื่อผู้ใช้', description: 'กรอกชื่อผู้ใช้สำหรับล็อกอิน', variant: 'destructive' });
      return;
    }
    if (!edit.hasAccount && !edit.pin) {
      toast({ title: 'ต้องตั้ง PIN', description: 'บัญชีใหม่ต้องตั้งรหัส PIN', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await updateEmployeeAccount({
        employeeId: edit.employeeId,
        login_username: uname,
        pin: edit.pin || undefined,
        role: edit.role,
        allowed_menus: edit.role === 'admin' ? [] : edit.allowed_menus,
        account_active: edit.account_active ? 1 : 0,
      });
      toast({ title: 'สำเร็จ', description: `บันทึกบัญชีของ ${edit.name} แล้ว` });
      setEdit(null);
      fetchAccounts();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: EmployeeAccount) => {
    try {
      await updateEmployeeAccount({ employeeId: a.id, account_active: a.account_active ? 0 : 1 });
      fetchAccounts();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> กำลังโหลด...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
        <ShieldCheck className="h-4 w-4 text-purple-600 shrink-0" />
        จัดการบัญชีล็อกอินของพนักงานแต่ละคน — พนักงานที่ยังไม่มีบัญชีจะแสดงเป็น "ยังไม่มีบัญชี" ตั้งให้ภายหลังได้
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">พนักงาน</th>
                  <th className="px-4 py-3 font-medium">ชื่อผู้ใช้ (ล็อกอิน)</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">สถานะบัญชี</th>
                  <th className="px-4 py-3 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {accounts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.position || '—'}{a.is_active ? '' : ' · พักงาน'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {a.has_account
                        ? <span className="font-mono">{a.login_username}</span>
                        : <Badge variant="secondary" className="bg-gray-100 text-gray-500">ยังไม่มีบัญชี</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {a.has_account && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${a.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                          {a.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.has_account ? (
                        <div className="flex items-center gap-2">
                          <Switch checked={a.account_active === 1} onCheckedChange={() => toggleActive(a)} />
                          <span className={`text-xs ${a.account_active ? 'text-green-600' : 'text-red-500'}`}>
                            {a.account_active ? 'ใช้งานได้' : 'ปิดอยู่'}
                          </span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                        {a.has_account
                          ? <><KeyRound className="h-3.5 w-3.5 mr-1" /> แก้บัญชี</>
                          : <><UserPlus className="h-3.5 w-3.5 mr-1" /> ตั้งบัญชี</>}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.hasAccount ? 'แก้ไขบัญชีล็อกอิน' : 'ตั้งบัญชีล็อกอิน'}</DialogTitle>
            <DialogDescription>{edit?.name}</DialogDescription>
          </DialogHeader>

          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>ชื่อผู้ใช้ (สำหรับล็อกอิน) <span className="text-red-500">*</span></Label>
                <Input
                  value={edit.login_username}
                  onChange={e => setEdit({ ...edit, login_username: e.target.value })}
                  placeholder="เช่น husna"
                  autoCapitalize="none"
                />
                {edit.hasAccount && (
                  <p className="text-xs text-amber-600">⚠️ การเปลี่ยนชื่อผู้ใช้จะทำให้ต้องล็อกอินด้วยชื่อใหม่</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>PIN {edit.hasAccount ? '(เว้นว่างถ้าไม่เปลี่ยน)' : <span className="text-red-500">*</span>}</Label>
                <Input
                  type="password"
                  value={edit.pin}
                  onChange={e => setEdit({ ...edit, pin: e.target.value })}
                  placeholder={edit.hasAccount ? 'เว้นว่างถ้าไม่เปลี่ยน' : 'ตั้งรหัส PIN'}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={edit.role} onValueChange={(v) => setEdit({ ...edit, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">พนักงาน (Employee)</SelectItem>
                    <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {edit.role === 'employee' && (
                <div className="space-y-2">
                  <Label>สิทธิ์การเข้าถึงเมนู</Label>
                  <div className="grid grid-cols-2 gap-2 border p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 max-h-52 overflow-y-auto">
                    {MENU_OPTIONS.map(menu => (
                      <label key={menu.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={edit.allowed_menus.includes(menu.id)}
                          onCheckedChange={(checked) => {
                            setEdit({
                              ...edit,
                              allowed_menus: checked
                                ? [...edit.allowed_menus, menu.id]
                                : edit.allowed_menus.filter(m => m !== menu.id),
                            });
                          }}
                        />
                        {menu.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <Label className="cursor-pointer">เปิดใช้งานบัญชี (ล็อกอินได้)</Label>
                <Switch checked={edit.account_active} onCheckedChange={(c) => setEdit({ ...edit, account_active: c })} />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setEdit(null)}>ยกเลิก</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 min-w-[120px]">
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังบันทึก...</> : 'บันทึก'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
