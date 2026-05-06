import { Card, CardContent } from "../components/ui/card";
import { BarChart3 } from "lucide-react";

export function Reports() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>التقارير</h1><p className="text-[#6B7280] mt-1">P&L · الميزانية · التدفق النقدي · ميزان المراجعة · إقرار VAT</p></div>
      <Card className="border-[#E5E7EB]"><CardContent className="py-12 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-[#9CA3AF] mb-4" />
        <h3 className="text-[#0B1B49]" style={{ fontSize: "1.1rem", fontWeight: 600 }}>قريباً · Sprint 5</h3>
        <p className="text-sm text-[#6B7280] mt-2 max-w-md mx-auto">تقارير P&L · Balance Sheet · Cash Flow · VAT Return · A/R Aging مع تصدير PDF و Excel.<br />ملخص سريع متوفر في <a href="/app" className="text-[#1276E3] hover:underline">لوحة التحكم</a>.</p>
      </CardContent></Card>
    </div>
  );
}
