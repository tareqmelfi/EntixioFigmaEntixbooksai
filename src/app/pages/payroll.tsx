import { Wallet, Users, Calendar, FileText, Plus, DollarSign, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

const payrollRuns = [
  { id: "PAY-2026-02", period: "فبراير 2026", employees: 45, amount: "285,000 SR", status: "مكتمل" },
  { id: "PAY-2026-03", period: "مارس 2026", employees: 47, amount: "297,500 SR", status: "قيد المعالجة" },
];

const employees = [
  { name: "أحمد محمد", position: "مدير مالي", salary: "15,000", status: "نشط" },
  { name: "سارة علي", position: "محاسب أول", salary: "12,000", status: "نشط" },
  { name: "خالد عبدالله", position: "محاسب", salary: "8,500", status: "نشط" },
  { name: "فاطمة حسن", position: "مساعد إداري", salary: "6,000", status: "نشط" },
];

export function Payroll() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الرواتب والأجور</h1>
          <p className="text-muted-foreground mt-1">إدارة رواتب الموظفين والامتثال لنظام GOSI</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="me-2 h-4 w-4" />
          دورة رواتب جديدة
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الموظفين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-english">47</div>
            <p className="text-xs text-muted-foreground">
              موظف نشط
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الرواتب الشهرية</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">297,500 SR</div>
            <p className="text-xs text-muted-foreground">
              +٤٪ من الشهر الماضي
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">طلبات الإجازات</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-english">8</div>
            <p className="text-xs text-muted-foreground">
              بانتظار الموافقة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ساعات العمل الإضافي</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-english">124</div>
            <p className="text-xs text-muted-foreground">
              ساعة هذا الشهر
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Runs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>دورات الرواتب</CardTitle>
              <CardDescription>سجل دورات الرواتب الشهرية</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الدورة</TableHead>
                <TableHead>الفترة</TableHead>
                <TableHead>عدد الموظفين</TableHead>
                <TableHead>إجمالي المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-english font-medium">{run.id}</TableCell>
                  <TableCell>{run.period}</TableCell>
                  <TableCell className="font-english">{run.employees}</TableCell>
                  <TableCell className="font-medium">{run.amount}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        run.status === "مكتمل"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      عرض التفاصيل
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employees */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>الموظفين</CardTitle>
              <CardDescription>إدارة سجلات الموظفين والرواتب</CardDescription>
            </div>
            <Button variant="outline">
              <Plus className="me-2 h-4 w-4" />
              موظف جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الوظيفة</TableHead>
                <TableHead>الراتب الأساسي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.name}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell className="font-medium">{employee.salary} SR</TableCell>
                  <TableCell>
                    <Badge variant="default">{employee.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      عرض
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GOSI Compliance Card */}
      <Card>
        <CardHeader>
          <CardTitle>الامتثال للتأمينات الاجتماعية (GOSI)</CardTitle>
          <CardDescription>نظام التأمينات الاجتماعية السعودي</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <div className="font-medium">نسبة المؤسسة</div>
                <p className="text-sm text-muted-foreground">من إجمالي الراتب</p>
              </div>
              <div className="text-2xl font-bold font-english">12%</div>
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <div className="font-medium">نسبة الموظف</div>
                <p className="text-sm text-muted-foreground">من إجمالي الراتب</p>
              </div>
              <div className="text-2xl font-bold font-english">10%</div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-4">
              <div className="space-y-1">
                <div className="font-medium">إجمالي المساهمات الشهرية</div>
                <p className="text-sm text-muted-foreground">مارس 2026</p>
              </div>
              <div className="text-2xl font-bold">65,450 SR</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}