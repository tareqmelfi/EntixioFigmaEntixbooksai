import { Link, useParams } from "react-router";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export function AssetDetail() {
  const { id } = useParams();
  return (
    <div className="space-y-6">
      <Link to="/app/assets" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary">
        <ArrowRight className="h-4 w-4" /> العودة لقائمة الأصول
      </Link>
      <Card className="border-border">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">صفحة تفاصيل الأصل (id: <span className="font-english">{id}</span>)</p>
          <p className="text-xs text-muted-foreground/60 mt-2">العرض التفصيلي + جدول الإهلاك سيُفعّل في تحديث قادم</p>
        </CardContent>
      </Card>
    </div>
  );
}
