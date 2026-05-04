import { Link, useParams } from "react-router";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export function ContactDetail() {
  const { id } = useParams();
  return (
    <div className="space-y-6">
      <Link to="/app/contacts" className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#1276E3]">
        <ArrowRight className="h-4 w-4" /> العودة لقائمة العملاء/الموردين
      </Link>
      <Card className="border-[#E5E7EB]">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-[#6B7280]">صفحة تفاصيل جهة الاتصال (id: <span className="font-english">{id}</span>)</p>
          <p className="text-xs text-[#9CA3AF] mt-2">العرض التفصيلي + المعاملات + سجل التفاعلات سيُفعّل في تحديث قادم</p>
        </CardContent>
      </Card>
    </div>
  );
}
