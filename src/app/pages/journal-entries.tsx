import { Card, CardContent } from "../components/ui/card";
import { BookOpen } from "lucide-react";

export function JournalEntries() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>قيود اليومية</h1><p className="text-[#6B7280] mt-1">قيود محاسبية يدوية مع التحقق من التوازن</p></div>
      <Card className="border-[#E5E7EB]"><CardContent className="py-12 text-center">
        <BookOpen className="h-12 w-12 mx-auto text-[#9CA3AF] mb-4" />
        <h3 className="text-[#0B1B49]" style={{ fontSize: "1.1rem", fontWeight: 600 }}>قريباً · Sprint 4</h3>
        <p className="text-sm text-[#6B7280] mt-2 max-w-md mx-auto">قيود يدوية · مرحّل/ملغي · التحقق من توازن المدين والدائن · ربط بمراكز التكلفة.<br />القيود التلقائية من الفواتير والمصروفات تُنشأ مباشرة في الخلفية.</p>
      </CardContent></Card>
    </div>
  );
}
