import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/use-settings";
import {
  Settings as SettingsIcon,
  Store,
  Palette,
  FileText,
  Save,
  Check,
  Loader2,
  List,
  Plus,
  X,
  Tag,
  Building
} from "lucide-react";

const colorOptions = [
  { name: "Rose", value: "#e11d48" },
  { name: "Pink", value: "#ec4899" },
  { name: "Purple", value: "#a855f7" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" }
];

export function AppSettings() {
  const { settings, isLoading, saveSettings, isSaving } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);

  // State สำหรับการเพิ่มตัวเลือกใหม่
  const [newChannel, setNewChannel] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newStoreBranch, setNewStoreBranch] = useState('');
  const [newOnlinePlatform, setNewOnlinePlatform] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');

  // อัพเดต localSettings เมื่อ settings จาก server เปลี่ยน
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSaveSettings = () => {
    saveSettings(localSettings);
  };

  // ฟังก์ชันสำหรับจัดการตัวเลือก
  const addChannel = () => {
    if (newChannel.trim() && !localSettings.channels?.includes(newChannel.trim())) {
      setLocalSettings({
        ...localSettings,
        channels: [...(localSettings.channels || []), newChannel.trim()]
      });
      setNewChannel('');
    }
  };

  const removeChannel = (channel: string) => {
    setLocalSettings({
      ...localSettings,
      channels: localSettings.channels?.filter(c => c !== channel) || []
    });
  };

  const addBranch = () => {
    if (newBranch.trim() && !localSettings.branches?.includes(newBranch.trim())) {
      const updatedSettings = {
        ...localSettings,
        branches: [...(localSettings.branches || []), newBranch.trim()]
      };
      setLocalSettings(updatedSettings);
      saveSettings(updatedSettings); // บันทึกทันทีเมื่อเพิ่มสาขาใหม่
      setNewBranch('');
    }
  };

  const removeBranch = (branch: string) => {
    const updatedSettings = {
      ...localSettings,
      branches: localSettings.branches?.filter(b => b !== branch) || []
    };
    setLocalSettings(updatedSettings);
    saveSettings(updatedSettings); // บันทึกทันทีเมื่อลบสาขา
  };

  // ฟังก์ชันสำหรับจัดการสาขาหน้าร้าน
  const addStoreBranch = () => {
    if (newStoreBranch.trim() && !localSettings.branchesByChannel?.store?.includes(newStoreBranch.trim())) {
      const updatedSettings = {
        ...localSettings,
        branchesByChannel: {
          ...localSettings.branchesByChannel,
          store: [...(localSettings.branchesByChannel?.store || []), newStoreBranch.trim()],
          online: localSettings.branchesByChannel?.online || []
        }
      };
      setLocalSettings(updatedSettings);
      saveSettings(updatedSettings);
      setNewStoreBranch('');
    }
  };

  const removeStoreBranch = (branch: string) => {
    const updatedSettings = {
      ...localSettings,
      branchesByChannel: {
        ...localSettings.branchesByChannel,
        store: localSettings.branchesByChannel?.store?.filter(b => b !== branch) || [],
        online: localSettings.branchesByChannel?.online || []
      }
    };
    setLocalSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  // ฟังก์ชันสำหรับจัดการแพลตฟอร์มออนไลน์
  const addOnlinePlatform = () => {
    if (newOnlinePlatform.trim() && !localSettings.branchesByChannel?.online?.includes(newOnlinePlatform.trim())) {
      const updatedSettings = {
        ...localSettings,
        branchesByChannel: {
          ...localSettings.branchesByChannel,
          store: localSettings.branchesByChannel?.store || [],
          online: [...(localSettings.branchesByChannel?.online || []), newOnlinePlatform.trim()]
        }
      };
      setLocalSettings(updatedSettings);
      saveSettings(updatedSettings);
      setNewOnlinePlatform('');
    }
  };

  const removeOnlinePlatform = (platform: string) => {
    const updatedSettings = {
      ...localSettings,
      branchesByChannel: {
        ...localSettings.branchesByChannel,
        store: localSettings.branchesByChannel?.store || [],
        online: localSettings.branchesByChannel?.online?.filter(p => p !== platform) || []
      }
    };
    setLocalSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  const addProductCategory = () => {
    if (newProductCategory.trim() && !localSettings.productCategories?.includes(newProductCategory.trim())) {
      setLocalSettings({
        ...localSettings,
        productCategories: [...(localSettings.productCategories || []), newProductCategory.trim()]
      });
      setNewProductCategory('');
    }
  };

  const removeProductCategory = (category: string) => {
    setLocalSettings({
      ...localSettings,
      productCategories: localSettings.productCategories?.filter(c => c !== category) || []
    });
  };

  const addExpenseCategory = () => {
    if (newExpenseCategory.trim() && !localSettings.expenseCategories?.includes(newExpenseCategory.trim())) {
      setLocalSettings({
        ...localSettings,
        expenseCategories: [...(localSettings.expenseCategories || []), newExpenseCategory.trim()]
      });
      setNewExpenseCategory('');
    }
  };

  const removeExpenseCategory = (category: string) => {
    setLocalSettings({
      ...localSettings,
      expenseCategories: localSettings.expenseCategories?.filter(c => c !== category) || []
    });
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลดการตั้งค่า...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            การตั้งค่า
          </h1>
          <div>
            <p className="text-muted-foreground mt-1">
              ปรับแต่งระบบให้เหมาะสมกับการใช้งานของคุณ
            </p>
            {settings.updatedAt && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                <Check className="h-3 w-3 inline mr-1" />
                บันทึกล่าสุด: {new Date(settings.updatedAt).toLocaleString('th-TH')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                บันทึกการตั้งค่า
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="store" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="store">ข้อมูลร้าน</TabsTrigger>
          <TabsTrigger value="options">ตัวเลือก</TabsTrigger>
          <TabsTrigger value="appearance">รูปลักษณ์</TabsTrigger>
          <TabsTrigger value="system">ระบบ</TabsTrigger>
        </TabsList>

        <TabsContent value="options" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ช่องทางขาย */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  ช่องทางขาย
                </CardTitle>
                <CardDescription>
                  จัดการตัวเลือกช่องทางขาย
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="เพิ่มช่องทางใหม่"
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addChannel()}
                  />
                  <Button onClick={addChannel} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {localSettings.channels?.map((channel, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <span>{channel}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChannel(channel)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* สาขาหน้าร้าน */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  สาขาหน้าร้าน
                </CardTitle>
                <CardDescription>
                  จัดการสาขาหน้าร้านต่างๆ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="เพิ่มสาขาหน้าร้านใหม่"
                    value={newStoreBranch}
                    onChange={(e) => setNewStoreBranch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addStoreBranch()}
                  />
                  <Button onClick={addStoreBranch} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {localSettings.branchesByChannel?.store?.map((branch, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <span>{branch}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStoreBranch(branch)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* แพลตฟอร์มออนไลน์ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  แพลตฟอร์มออนไลน์
                </CardTitle>
                <CardDescription>
                  จัดการแพลตฟอร์มขายออนไลน์ต่างๆ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="เพิ่มแพลตฟอร์มออนไลน์ใหม่"
                    value={newOnlinePlatform}
                    onChange={(e) => setNewOnlinePlatform(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addOnlinePlatform()}
                  />
                  <Button onClick={addOnlinePlatform} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {localSettings.branchesByChannel?.online?.map((platform, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <span>{platform}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOnlinePlatform(platform)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* หมวดหมู่สินค้า */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  หมวดหมู่สินค้า
                </CardTitle>
                <CardDescription>
                  จัดการหมวดหมู่สินค้าสำหรับรายรับ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="เพิ่มหมวดหมู่สินค้าใหม่"
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addProductCategory()}
                  />
                  <Button onClick={addProductCategory} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {localSettings.productCategories?.map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <span>{category}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProductCategory(category)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* หมวดหมู่รายจ่าย */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  หมวดหมู่รายจ่าย
                </CardTitle>
                <CardDescription>
                  จัดการหมวดหมู่รายจ่าย
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="เพิ่มหมวดหมู่รายจ่ายใหม่"
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addExpenseCategory()}
                  />
                  <Button onClick={addExpenseCategory} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {localSettings.expenseCategories?.map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <span>{category}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExpenseCategory(category)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="store" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                ข้อมูลร้านค้า
              </CardTitle>
              <CardDescription>
                ตั้งค่าข้อมูลพื้นฐานของร้านค้า
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storeName">ชื่อร้าน</Label>
                  <Input
                    id="storeName"
                    value={localSettings.storeName}
                    onChange={(e) => setLocalSettings({ ...localSettings, storeName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="websiteName">ชื่อเว็บไซต์</Label>
                  <Input
                    id="websiteName"
                    value={localSettings.websiteName}
                    onChange={(e) => setLocalSettings({ ...localSettings, websiteName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="storeSlogan">สโลแกนร้าน</Label>
                <Input
                  id="storeSlogan"
                  value={localSettings.storeSlogan || ""}
                  onChange={(e) => setLocalSettings({ ...localSettings, storeSlogan: e.target.value })}
                  placeholder="เช่น เสื้อผ้าแฟชั่นมุสลิม"
                />
              </div>

              <div>
                <Label htmlFor="storeAddress">ที่อยู่ร้าน</Label>
                <Textarea
                  id="storeAddress"
                  value={localSettings.storeAddress || ""}
                  onChange={(e) => setLocalSettings({ ...localSettings, storeAddress: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storePhone">เบอร์โทรศัพท์</Label>
                  <Input
                    id="storePhone"
                    value={localSettings.storePhone || ""}
                    onChange={(e) => setLocalSettings({ ...localSettings, storePhone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="storeEmail">อีเมล</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    value={localSettings.storeEmail || ""}
                    onChange={(e) => setLocalSettings({ ...localSettings, storeEmail: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                รูปลักษณ์และธีม
              </CardTitle>
              <CardDescription>
                ปรับแต่งสีและรูปลักษณ์ของระบบ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>สีหลักของระบบ</Label>
                <div className="grid grid-cols-7 gap-2 mt-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      className={`w-12 h-12 rounded-lg border-2 ${localSettings.primaryColor === color.value
                        ? 'border-gray-900 dark:border-white'
                        : 'border-gray-200 dark:border-gray-700'
                        }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setLocalSettings({ ...localSettings, primaryColor: color.value })}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                การตั้งค่าระบบ
              </CardTitle>
              <CardDescription>
                ตั้งค่าพื้นฐานของระบบ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="currency">สกุลเงิน</Label>
                  <Select value={localSettings.currency} onValueChange={(value) => setLocalSettings({ ...localSettings, currency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="THB">บาท (THB)</SelectItem>
                      <SelectItem value="USD">ดอลลาร์ (USD)</SelectItem>
                      <SelectItem value="EUR">ยูโร (EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dateFormat">รูปแบบวันที่</Label>
                  <Select value={localSettings.dateFormat} onValueChange={(value) => setLocalSettings({ ...localSettings, dateFormat: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="defaultSalesTarget">เป้าหมายยอดขายเริ่มต้น</Label>
                  <Input
                    id="defaultSalesTarget"
                    type="number"
                    value={localSettings.defaultSalesTarget}
                    onChange={(e) => setLocalSettings({ ...localSettings, defaultSalesTarget: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="monthlyTarget">เป้าหมายรายเดือน (บาท)</Label>
                <Input
                  id="monthlyTarget"
                  type="number"
                  value={localSettings.monthlyTarget || 200000}
                  onChange={(e) => setLocalSettings({ ...localSettings, monthlyTarget: Number(e.target.value) })}
                  placeholder="200,000"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  เป้าหมายรายรับสุทธิต่อเดือน (รายรับ - รายจ่าย)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}