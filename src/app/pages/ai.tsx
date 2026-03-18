import { Sparkles, FileText, Brain, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

export function AI() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">الذكاء الاصطناعي</h1>
          <p className="text-muted-foreground mt-1">أدوات ذكية لتسريع عملك المحاسبي</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">قراءة الفواتير تلقائياً</CardTitle>
                <CardDescription className="text-xs mt-1">
                  OCR - استخراج البيانات من صور الفواتير
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              ارفع صورة أو PDF للفاتورة وسيقوم النظام باستخراج جميع البيانات تلقائياً
            </p>
            <Button className="w-full" variant="outline">
              <FileText className="me-2 h-4 w-4" />
              رفع فاتورة
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">تصنيف ذكي للحسابات</CardTitle>
                <CardDescription className="text-xs mt-1">
                  اقتراح تلقائي للحسابات المناسبة
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              يتعلم النظام من قيودك السابقة ويقترح الحسابات المناسبة تلقائياً
            </p>
            <Button className="w-full" variant="outline" disabled>
              قريباً
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">لصق من Excel</CardTitle>
                <CardDescription className="text-xs mt-1">
                  انسخ والصق البيانات من جداول Excel
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              انسخ عدة أسطر من Excel والصقها مباشرة في الفاتورة
            </p>
            <Button className="w-full" variant="outline" disabled>
              قريباً
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>حول وحدة الذكاء الاصطناعي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            وحدة الذكاء الاصطناعي في Entix Books تساعدك على:
          </p>
          <ul className="me-6 list-disc space-y-2 text-sm text-muted-foreground">
            <li>توفير الوقت في إدخال البيانات يدوياً</li>
            <li>تقليل الأخطاء البشرية في التصنيف المحاسبي</li>
            <li>تحليل أنماط الإنفاق والتدفق النقدي</li>
            <li>التنبؤ بالاحتياجات المالية المستقبلية</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}