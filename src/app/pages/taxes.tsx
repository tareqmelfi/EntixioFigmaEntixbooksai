import { Card, CardContent } from "../components/ui/card";
import { Percent } from "lucide-react";

export function Taxes() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الضرائب</h1><p className="text-[#6B7280] mt-1">إعدادات معدلات الضريبة وإقرار VAT</p></div>
      <Card className="border-[#E5E7EB]"><CardContent className="py-12 text-center">
        <Percent className="h-12 w-12 mx-auto text-[#9CA3AF] mb-4" />
        <h3 className="text-[#0B1B49]" style={{ fontSize: "1.1rem", fontWeight: 600 }}>معدلات افتراضية مفعّلة</h3>
        <p className="text-sm text-[#6B7280] mt-2 max-w-md mx-auto">VAT 15% · VAT 0% · VAT Exempt متوفرة افتراضياً لكل شركة جديدة.<br />إقرار VAT الربعي والتصدير لـZATCA Phase 2 سيُفعّل في Sprint 5.</p>
      </CardContent></Card>
    </div>
  );
}
