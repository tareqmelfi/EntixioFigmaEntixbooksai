import { Link, useParams } from "react-router";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export function ProductDetail() {
  const { id } = useParams();
  return (
    <div className="space-y-6">
      <Link to="/app/products" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary">
        <ArrowRight className="h-4 w-4" /> العودة لقائمة المنتجات
      </Link>
      <Card className="border-border">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">صفحة تفاصيل المنتج (id: <span className="font-english">{id}</span>)</p>
          <p className="text-xs text-muted-foreground/60 mt-2">العرض التفصيلي + الحركات + الجرد سيُفعّل في تحديث قادم</p>
        </CardContent>
      </Card>
    </div>
  );
}
