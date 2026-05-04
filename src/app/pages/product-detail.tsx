import { Link, useParams } from "react-router";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export function ProductDetail() {
  const { id } = useParams();
  return (
    <div className="space-y-6">
      <Link to="/app/products" className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#1276E3]">
        <ArrowRight className="h-4 w-4" /> العودة لقائمة المنتجات
      </Link>
      <Card className="border-[#E5E7EB]">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-[#6B7280]">صفحة تفاصيل المنتج (id: <span className="font-english">{id}</span>)</p>
          <p className="text-xs text-[#9CA3AF] mt-2">العرض التفصيلي + الحركات + الجرد سيُفعّل في تحديث قادم</p>
        </CardContent>
      </Card>
    </div>
  );
}
