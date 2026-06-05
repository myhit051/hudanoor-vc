import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Users, ArrowRight, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminPanel() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">ภาพรวมระบบและสถิติ</p>
        </div>
      </div>

      {/* แจ้งย้ายการจัดการผู้ใช้ */}
      <Card className="border-purple-200 dark:border-purple-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-purple-600" />
            การจัดการผู้ใช้ย้ายไปแล้ว
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ตอนนี้บัญชีล็อกอินถูกผูกกับข้อมูลพนักงานโดยตรง — จัดการชื่อผู้ใช้ PIN สิทธิ์ และเปิด/ปิดบัญชี
            ได้ที่หน้า <strong>จัดการพนักงาน</strong> แท็บ <strong>“บัญชีผู้ใช้”</strong>
          </p>
          <Button
            onClick={() => navigate('/employees')}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            ไปที่จัดการพนักงาน
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* ที่ว่างสำหรับสถิติในอนาคต */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            สถิติพนักงาน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">เร็ว ๆ นี้ — พื้นที่สำหรับสรุปสถิติและรายงานภาพรวม</p>
        </CardContent>
      </Card>
    </div>
  );
}
