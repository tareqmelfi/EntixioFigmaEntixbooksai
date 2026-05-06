import { FolderOpen, Plus, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function Taxes() {
  const taxReturns = [
    { id: "TAX-001", period: "يناير 2024", type: "ضريبة القيمة المضافة", sales: "85,000", purchases: "35,000", due: "7,500", status: "مقدم" },
    { id: "TAX-002", period: "فبراير 2024", type: "ضريبة القيمة المضافة", sales: "92,000", purchases: "38,000", due: "8,100", status: "مستحق" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3">
            <FolderOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">الضرائب</h1>
            <p className="text-muted-foreground mt-1">إدارة الإقرارات الضريبية والامتثال</p>
          </div>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          إقرار ضريبي جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">ضريبة المبيعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0B1A47]">12,750 SR</div>
            <p className="text-xs text-muted-foreground mt-1">تم تحصيلها</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">ضريبة المشتريات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#349FC4]">5,250 SR</div>
            <p className="text-xs text-muted-foreground mt-1">مدفوعة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">المستحق للهيئة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">15,600 SR</div>
            <p className="text-xs text-muted-foreground mt-1">يجب دفعه</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">معدل الضريبة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">15%</div>
            <p className="text-xs text-muted-foreground mt-1">ضريبة القيمة المضافة</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>الإقرارات الضريبية</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="بحث..." className="w-64 ps-9" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 pe-4 text-start text-sm font-medium text-muted-foreground">رقم الإقرار</th>
                  <th className="pb-3 pe-4 text-start text-sm font-medium text-muted-foreground">الفترة</th>
                  <th className="pb-3 pe-4 text-start text-sm font-medium text-muted-foreground">النوع</th>
                  <th className="pb-3 pe-4 text-start text-sm font-medium text-muted-foreground">المبيعات</th>
                  <th className="pb-3 pe-4 text-start text-sm font-medium text-muted-foreground">المشتريات</th>
                  <th className="pb-3 pe-4 text-start text-sm font-medium text-muted-foreground">المستحق</th>
                  <th className="pb-3 pe-4 text-start text-sm font-medium text-muted-foreground">الحالة</th>
                  <th className="pb-3 pe-4 text-start text-sm font-medium text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {taxReturns.map((tax) => (
                  <tr key={tax.id} className="border-b last:border-0">
                    <td className="py-4 pe-4 text-sm font-medium">{tax.id}</td>
                    <td className="py-4 pe-4 text-sm">{tax.period}</td>
                    <td className="py-4 pe-4 text-sm">{tax.type}</td>
                    <td className="py-4 pe-4 text-sm">{tax.sales} SR</td>
                    <td className="py-4 pe-4 text-sm">{tax.purchases} SR</td>
                    <td className="py-4 pe-4 text-sm font-medium">{tax.due} SR</td>
                    <td className="py-4 pe-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        tax.status === "مقدم" ? "text-green-600 bg-green-50" : "text-yellow-600 bg-yellow-50"
                      }`}>
                        {tax.status}
                      </span>
                    </td>
                    <td className="py-4 pe-4">
                      <Button variant="ghost" size="sm">عرض</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#1276E3] bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-[#0B1B49]">توافق مع ZATCA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            جميع الفواتير متوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك السعودية (ZATCA)
          </p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-green-600">متصل بنظام فاتورة الإلكتروني</span>
          </div>
          <ul className="me-6 list-disc space-y-2 text-sm text-muted-foreground">
            <li>الختم الإلكتروني (Cryptographic Stamp) مفعّل</li>
            <li>رمز الاستجابة السريع (QR Code) على جميع الفواتير</li>
            <li>الإرسال التلقائي للفواتير إلى ZATCA</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}