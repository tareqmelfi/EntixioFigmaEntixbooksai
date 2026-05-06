import { Card, CardContent } from "../components/ui/card";
import { Users } from "lucide-react";

export function Payroll() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الرواتب</h1><p className="text-[#6B7280] mt-1">إدارة الموظفين والرواتب الشهرية</p></div>
      <Card className="border-[#E5E7EB]"><CardContent className="py-12 text-center">
        <Users className="h-12 w-12 mx-auto text-[#9CA3AF] mb-4" />
        <h3 className="text-[#0B1B49]" style={{ fontSize: "1.1rem", fontWeight: 600 }}>قريباً · Sprint 6</h3>
        <p className="text-sm text-[#6B7280] mt-2 max-w-md mx-auto">إدارة الموظفين · مسير الرواتب · GOSI · WPS · ملفات بنك CSV.</p>
      </CardContent></Card>
    </div>
  );
}
