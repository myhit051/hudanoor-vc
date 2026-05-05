import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Printer } from "lucide-react";
import { PayrollItem, PayrollRun } from "@/types/payroll";
import { formatCurrency } from "@/lib/utils";

interface PayslipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PayrollItem | null;
  run: PayrollRun | null;
  shopName?: string;
}

const monthLabel = (period: string) => {
  if (!period) return "";
  const [y, m] = period.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
};

export function PayslipDialog({ open, onOpenChange, item, run, shopName = "HUDANOOR" }: PayslipDialogProps) {
  const slipRef = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPDF = async () => {
    if (!slipRef.current || !item || !run) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(slipRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      // A4 width 210mm. Compute height proportionally.
      const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20; // 10mm margin each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let position = 10;
      let heightLeft = imgHeight;

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }

      const safeName = item.employeeName.replace(/[\\/:*?"<>|]/g, "_");
      pdf.save(`payslip-${run.period}-${safeName}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("ไม่สามารถสร้างไฟล์ PDF ได้");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!item || !run) return null;

  const baseAmount = item.salary + item.totalCommission;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>ใบแจ้งเงินเดือน — {item.employeeName}</DialogTitle>
        </DialogHeader>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> พิมพ์
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            ดาวน์โหลด PDF
          </Button>
        </div>

        {/* Slip content (this is what gets exported) */}
        <div
          ref={slipRef}
          id="payslip-content"
          className="bg-white text-gray-900 p-6 rounded-lg border"
          style={{ fontFamily: "'Sarabun', 'Sukhumvit Set', 'Noto Sans Thai', system-ui, sans-serif" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-3 mb-4">
            <div>
              <div className="text-xl font-bold text-rose-600">{shopName}</div>
              <div className="text-xs text-gray-500">เสื้อผ้าแฟชั่นมุสลิม</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">ใบแจ้งเงินเดือน</div>
              <div className="text-xs text-gray-500">งวดประจำเดือน {monthLabel(run.period)}</div>
              <div className="text-xs text-gray-500">รหัสเอกสาร: {item.id}</div>
            </div>
          </div>

          {/* Employee info */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">ชื่อพนักงาน</div>
              <div className="font-semibold">{item.employeeName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ตำแหน่ง</div>
              <div>{item.position || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">สาขาประจำ</div>
              <div>{item.homeBranch || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">สถานะ</div>
              <div>
                {item.status === "paid" ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">จ่ายแล้ว</Badge>
                ) : (
                  <Badge variant="outline">รอจ่าย</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2 text-gray-700">รายการรับ</div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="text-left p-2 border">รายการ</th>
                  <th className="text-right p-2 border">ยอดขาย</th>
                  <th className="text-right p-2 border w-16">เรท %</th>
                  <th className="text-right p-2 border">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border">เงินเดือนประจำ</td>
                  <td className="p-2 border text-right text-gray-400">—</td>
                  <td className="p-2 border text-right text-gray-400">—</td>
                  <td className="p-2 border text-right font-medium">{formatCurrency(item.salary)}</td>
                </tr>
                {item.commissionBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-2 border text-center text-gray-400 italic">
                      ไม่มีค่าคอมมิชชั่นในงวดนี้
                    </td>
                  </tr>
                ) : (
                  item.commissionBreakdown.map((line, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border">
                        คอม {line.channel === "store" ? "🏬" : "🌐"} {line.branchOrPlatform}
                      </td>
                      <td className="p-2 border text-right">{formatCurrency(line.sales)}</td>
                      <td className="p-2 border text-right">{line.rate}%</td>
                      <td className="p-2 border text-right">{formatCurrency(line.commission)}</td>
                    </tr>
                  ))
                )}
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-2 border" colSpan={3}>รวมรายการรับ</td>
                  <td className="p-2 border text-right">{formatCurrency(baseAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Adjustment */}
          {(item.adjustment !== 0 || item.adjustmentNote) && (
            <div className="mb-4">
              <div className="text-sm font-semibold mb-2 text-gray-700">ปรับปรุง / โบนัส / หักเพิ่ม</div>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  <tr>
                    <td className="p-2 border">{item.adjustmentNote || "ปรับปรุง"}</td>
                    <td className={`p-2 border text-right ${item.adjustment < 0 ? "text-red-600" : "text-green-600"}`}>
                      {item.adjustment >= 0 ? "+" : ""}{formatCurrency(item.adjustment)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Total */}
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-rose-700">ยอดรับสุทธิ</div>
              <div className="text-2xl font-bold text-rose-700">{formatCurrency(item.totalAmount)}</div>
            </div>
          </div>

          {/* Payment info */}
          {item.status === "paid" && (
            <div className="mt-4 text-sm text-gray-600 border-t pt-3">
              <div>จ่ายเมื่อ: {item.paidAt ? new Date(item.paidAt).toLocaleString("th-TH") : "-"}</div>
              {item.paidBy && <div>โดย: {item.paidBy}</div>}
              {item.paidMethod && <div>ช่องทาง: {item.paidMethod}</div>}
            </div>
          )}

          {item.note && (
            <div className="mt-3 text-xs text-gray-500">หมายเหตุ: {item.note}</div>
          )}

          <div className="mt-6 text-[10px] text-gray-400 text-center border-t pt-2">
            เอกสารนี้สร้างจากระบบ HUDANOOR · ออกเมื่อ {new Date().toLocaleString("th-TH")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
