/**
 * Credit Notes (إشعارات دائنة) · placeholder · API to be added
 * Uses Invoice model with status="CANCELLED" · Sprint 3 will get its own model
 */
import { Card, CardContent } from "../components/ui/card";
import { ScrollText } from "lucide-react";

export function CreditNotes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الإشعارات الدائنة</h1>
        <p className="text-[#6B7280] mt-1">إدارة إشعارات الخصم والإرجاع</p>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardContent className="py-12 text-center">
          <ScrollText className="h-12 w-12 mx-auto text-[#9CA3AF] mb-4" />
          <h3 className="text-[#0B1B49]" style={{ fontSize: "1.1rem", fontWeight: 600 }}>قريباً</h3>
          <p className="text-sm text-[#6B7280] mt-2 max-w-md mx-auto">
            ستتمكن قريباً من إنشاء إشعارات دائنة للعملاء وربطها بالفواتير الأصلية.<br />
            حالياً يمكنك إلغاء الفاتورة من <a href="/app/invoices" className="text-[#1276E3] hover:underline">صفحة الفواتير</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
