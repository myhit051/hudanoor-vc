import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getUsers, createUser, updateUser, UserManagement } from '@/lib/auth-api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldAlert, UserPlus, KeyRound } from 'lucide-react';

const MENU_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'add-record', label: 'บันทึกรายการใหม่' },
  { id: 'stock-receiving', label: 'รับสินค้าเข้าสต๊อก' },
  { id: 'sales-entry', label: 'บันทึกยอดขาย' },
  { id: 'order-history', label: 'ประวัติการขาย' },
  { id: 'stock-inventory', label: 'สต๊อกคงเหลือ' },
  { id: 'task-reminder', label: 'Task Reminder' },
  { id: 'employees', label: 'จัดการพนักงาน' },
  { id: 'settings', label: 'การตั้งค่า' },
];

export default function AdminPanel() {
  const [users, setUsers] = useState<UserManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<UserManagement> & { pin?: string }>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error: any) {
      toast({ title: 'Error fetching users', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser.employee_id || !currentUser.name || (!isEditing && !currentUser.pin)) {
      toast({ title: 'ข้อมูลไม่ครบ', description: 'กรุณากรอกรหัสพนักงาน ชื่อ และ PIN', variant: 'destructive' });
      return;
    }

    try {
      if (isEditing && currentUser.id) {
        await updateUser({
          id: currentUser.id,
          role: currentUser.role,
          allowed_menus: currentUser.allowed_menus,
          pin: currentUser.pin || undefined,
          is_active: currentUser.is_active
        });
        toast({ title: 'สำเร็จ', description: 'อัปเดตผู้ใช้งานเรียบร้อยแล้ว' });
      } else {
        await createUser({
          ...currentUser,
          pin: currentUser.pin!
        });
        toast({ title: 'สำเร็จ', description: 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว' });
      }
      setCurrentUser({});
      setIsEditing(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (user: UserManagement) => {
    try {
      await updateUser({ id: user.id, is_active: user.is_active ? 0 : 1 });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">กำลังโหลด...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">จัดการผู้ใช้งานและสิทธิ์การเข้าถึง</p>
          </div>
        </div>
        <Button
          onClick={() => { setIsEditing(false); setCurrentUser({ role: 'employee', allowed_menus: ['dashboard'] }); }}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 w-full sm:w-auto"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          เพิ่มผู้ใช้งานใหม่
        </Button>
      </div>

      {currentUser.role !== undefined && (
        <Card className="border-purple-200 dark:border-purple-900/30 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {isEditing ? <KeyRound className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              {isEditing ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">รหัสพนักงาน <span className="text-red-500">*</span></label>
                <Input
                  disabled={isEditing}
                  value={currentUser.employee_id || ''}
                  onChange={e => setCurrentUser(prev => ({ ...prev, employee_id: e.target.value }))}
                  placeholder="เช่น EMP001"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">ชื่อ <span className="text-red-500">*</span></label>
                <Input
                  disabled={isEditing}
                  value={currentUser.name || ''}
                  onChange={e => setCurrentUser(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ชื่อพนักงาน"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  รหัสผ่าน (PIN) {isEditing ? '' : <span className="text-red-500">*</span>}
                </label>
                <Input
                  type="password"
                  value={currentUser.pin || ''}
                  onChange={e => setCurrentUser(prev => ({ ...prev, pin: e.target.value }))}
                  placeholder={isEditing ? 'เว้นว่างถ้าไม่เปลี่ยน' : 'ตั้งรหัสผ่าน'}
                />
                {isEditing && (
                  <p className="text-xs text-muted-foreground">เว้นว่างถ้าไม่ต้องการเปลี่ยนรหัสผ่าน</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={currentUser.role}
                  onValueChange={(val: 'admin'|'employee') => setCurrentUser(prev => ({ ...prev, role: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">พนักงาน (Employee)</SelectItem>
                    <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {currentUser.role === 'employee' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">สิทธิ์การเข้าถึงเมนู</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 border p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  {MENU_OPTIONS.map(menu => (
                    <div key={menu.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`menu-${menu.id}`}
                        checked={(currentUser.allowed_menus || []).includes(menu.id)}
                        onCheckedChange={(checked) => {
                          const menus = currentUser.allowed_menus || [];
                          if (checked) {
                            setCurrentUser(prev => ({ ...prev, allowed_menus: [...menus, menu.id] }));
                          } else {
                            setCurrentUser(prev => ({ ...prev, allowed_menus: menus.filter(m => m !== menu.id) }));
                          }
                        }}
                      />
                      <label htmlFor={`menu-${menu.id}`} className="text-sm cursor-pointer">{menu.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentUser({})}>ยกเลิก</Button>
              <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">บันทึก</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 sm:px-6 py-3 font-medium">รหัสพนักงาน</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">ชื่อ</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Role</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">สถานะ</th>
                  <th className="px-4 sm:px-6 py-3 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 sm:px-6 py-4 font-mono text-sm">{user.employee_id}</td>
                    <td className="px-4 sm:px-6 py-4 font-medium">{user.name}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                        {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={user.is_active === 1}
                          onCheckedChange={() => handleToggleActive(user)}
                        />
                        <span className={`text-sm ${user.is_active ? 'text-green-600' : 'text-red-500'}`}>
                          {user.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => {
                        setCurrentUser({ ...user, pin: '' });
                        setIsEditing(true);
                      }}>
                        แก้ไข
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      ยังไม่มีผู้ใช้งานในระบบ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {users.map(user => (
              <div key={user.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{user.employee_id}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={user.is_active === 1}
                      onCheckedChange={() => handleToggleActive(user)}
                    />
                    <span className={`text-sm ${user.is_active ? 'text-green-600' : 'text-red-500'}`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    setCurrentUser({ ...user, pin: '' });
                    setIsEditing(true);
                  }}>
                    แก้ไข
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                ยังไม่มีผู้ใช้งานในระบบ
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
