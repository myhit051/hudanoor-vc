import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { login as loginApi } from '@/lib/auth-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !pin) return;
    
    setIsSubmitting(true);
    try {
      const { token, user } = await loginApi({ employee_id: employeeId, pin });
      login(token, user);
      toast({
        title: 'เข้าสู่ระบบสำเร็จ',
        description: `ยินดีต้อนรับ ${user.name}`,
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        description: error.message || 'รหัสพนักงานหรือ PIN ไม่ถูกต้อง',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 safe-area-top safe-area-bottom">
      <Card className="w-full max-w-md shadow-xl border-rose-100 dark:border-rose-900/30">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
            <Store className="w-8 h-8 text-rose-600 dark:text-rose-400" />
          </div>
          <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-600 to-pink-600">
            Hudanoor VC
          </CardTitle>
          <CardDescription className="text-base">
            ลงชื่อเข้าใช้งานระบบจัดการร้าน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                รหัสพนักงาน
              </label>
              <Input
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="เช่น EMP001"
                required
                className="h-12 px-4 focus-visible:ring-rose-500"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                รหัสผ่าน
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  required
                  className="h-12 px-4 pr-12 focus-visible:ring-rose-500"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || !employeeId || !pin}
              className="w-full h-12 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-base font-medium shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
