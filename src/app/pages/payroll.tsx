import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import {
  Wallet, Plus, Search, Download, DollarSign, Clock, Calendar, Upload,
  FileText, CheckCircle2, AlertTriangle, TrendingUp, Users, MoreVertical,
  Eye, Edit2, Trash2, X, ChevronDown, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const CUR = "SR";

interface PayrollRun {
  id: string;
  period: string;
  month: string;
  year: string;
  employees: number;
  totalAmount: number;
  status: string;
  processedDate?: string;
  transferFile?: string;
}

interface AllowanceType {
  id: string;
  name: string;
  type: "ثابت" | "متغير" | "نسبة";
  amount?: number;
  percentage?: number;
  taxable: boolean;
}

const payrollRuns: PayrollRun[] = [
  { id: "PAY-2026-02", period: "فبراير 2026", month: "02", year: "2026", employees: 45, totalAmount: 285000, status: "مكتمل", processedDate: "2026-02-28", transferFile: "payroll_feb_2026.xlsx" },
  { id: "PAY-2026-03", period: "مارس 2026", month: "03", year: "2026", employees: 47, totalAmount: 297500, status: "قيد المعالجة" },
  { id: "PAY-2026-04", period: "أبريل 2026", month: "04", year: "2026", employees: 47, totalAmount: 0, status: "مسودة" },
];

const allowanceTypes: AllowanceType[] = [
  { id: "AL-001", name: "بدل سكن", type: "ثابت", amount: 2000, taxable: false },
  { id: "AL-002", name: "بدل نقل", type: "ثابت", amount: 500, taxable: false },
  { id: "AL-003", name: "بدل هاتف", type: "ثابت", amount: 300, taxable: false },
  { id: "AL-004", name: "عمولة مبيعات", type: "نسبة", percentage: 5, taxable: true },
  { id: "AL-005", name: "ساعات إضافية", type: "متغير", taxable: true },
  { id: "AL-006", name: "مكافأة أداء", type: "متغير", taxable: true },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "مكتمل": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "قيد المعالجة": "bg-[#EFF6FF] text-[#1276E3] border-[#1276E3]/20",
    "مسودة": "bg-[#F3F4F6] text-[#6B7280] border-[#9CA3AF]",
    "معلق": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
  };
  return m[s] || "";
};

const typeBadge = (t: string) => {
  const m: Record<string, string> = {
    "ثابت": "bg-[#ECEEF5] text-[#0B1A47]",
    "متغير": "bg-[#E4F4F9] text-[#349FC4]",
    "نسبة": "bg-[#FEF3C7] text-[#92400E]",
  };
  return m[t] || "";
};

export function Payroll() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [isPayrollDialogOpen, setIsPayrollDialogOpen] = useState(false);
  const [isAllowanceDialogOpen, setIsAllowanceDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [payrollFormData, setPayrollFormData] = useState({
    month: "",
    year: "2026"
  });
  const [allowanceFormData, setAllowanceFormData] = useState({
    name: "",
    type: "ثابت" as "ثابت" | "متغير" | "نسبة",
    amount: "",
    percentage: "",
    taxable: false
  });
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = payrollRuns.filter((p) => 
    p.period.includes(searchQuery) || p.id.includes(searchQuery)
  );

  const totalEmployees = 47;
  const monthlyPayroll = 297500;
  const pendingApprovals = 8;
  const overtimeHours = 124;

  const handlePayrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("New Payroll Run:", payrollFormData);
    setIsPayrollDialogOpen(false);
    setPayrollFormData({ month: "", year: "2026" });
  };

  const handleAllowanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("New Allowance:", allowanceFormData);
    setIsAllowanceDialogOpen(false);
    setAllowanceFormData({ name: "", type: "ثابت", amount: "", percentage: "", taxable: false });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Upload File:", selectedFile);
    setIsUploadDialogOpen(false);
    setSelectedFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الرواتب والأجور</h1>
          <p className="text-[#6B7280] mt-1">إدارة دورات الرواتب والامتثال لنظام GOSI</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setIsPayrollDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />دورة رواتب جديدة
          </Button>
          <Button variant="outline" className="border-[#1276E3] text-[#1276E3]" onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="me-2 h-4 w-4" />رفع ملف تحويل
          </Button>
          <Button variant="outline" className="border-[#E5E7EB]">
            <Download className="me-2 h-4 w-4" />تصدير
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Users className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalEmployees}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الموظفين</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><DollarSign className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{monthlyPayroll.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الرواتب الشهرية</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#FEF3C7] p-2.5"><Calendar className="h-5 w-5 text-[#92400E]" /></div></div>
            <div className="text-[#92400E] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{pendingApprovals}</div>
            <p className="text-xs text-[#6B7280] mt-1">طلبات إجازات معلقة</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><Clock className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{overtimeHours}</div>
            <p className="text-xs text-[#6B7280] mt-1">ساعات عمل إضافية</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#1276E3] bg-[#EFF6FF]/30 cursor-pointer hover:shadow-md transition-all" onClick={() => setIsPayrollDialogOpen(true)}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-xl bg-[#1276E3] p-3"><Plus className="h-6 w-6 text-white" /></div>
            <div>
              <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>إنشاء دورة رواتب جديدة</p>
              <p className="text-xs text-[#6B7280]">ابدأ معالجة رواتب الشهر الجديد</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#349FC4] bg-[#E4F4F9]/30 cursor-pointer hover:shadow-md transition-all" onClick={() => setIsUploadDialogOpen(true)}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-xl bg-[#349FC4] p-3"><Upload className="h-6 w-6 text-white" /></div>
            <div>
              <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>رفع ملف تحويل</p>
              <p className="text-xs text-[#6B7280]">استيراد من مدد أو أي نظام خارجي</p>
            </div>
          </CardContent>
        </Card>
        <Link to="/app/employees">
          <Card className="border-[#F59E0B] bg-[#FEF3C7]/30 cursor-pointer hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#F59E0B] p-3"><Users className="h-6 w-6 text-white" /></div>
              <div>
                <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>إدارة الموظفين</p>
                <p className="text-xs text-[#6B7280]">عرض وتحديث بيانات الموظفين</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Payroll Runs Table */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-[#0B1B49]">دورات الرواتب</CardTitle>
              <CardDescription className="text-[#6B7280]">سجل دورات الرواتب الشهرية</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input placeholder="بحث..." className="w-full ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "800px" }}>
              <colgroup>
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "140px" }} />
                <col style={{ minWidth: "100px" }} />
                <col style={{ minWidth: "140px" }} />
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "140px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم الدورة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الفترة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>عدد الموظفين</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>إجمالي المبلغ</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>تاريخ المعالجة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => (
                  <tr key={run.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 px-3">
                      <span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{run.id}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#374151]" style={{ fontWeight: 500 }}>{run.period}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-english text-sm text-[#6B7280]">{run.employees}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                        <span className="text-[#0B1A47]">{run.totalAmount.toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-english text-sm text-[#6B7280]">{run.processedDate || "—"}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs border whitespace-nowrap ${statusStyle(run.status)}`} style={{ fontWeight: 600 }}>{run.status}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="relative" ref={actionMenuId === run.id ? actionMenuRef : undefined}>
                        <button onClick={() => setActionMenuId(actionMenuId === run.id ? null : run.id)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><MoreVertical className="h-4 w-4" /></button>
                        {actionMenuId === run.id && (
                          <div className="absolute end-0 z-40 mt-1 w-40 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض التفاصيل</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Edit2 className="h-3.5 w-3.5 text-[#6B7280]" />تعديل</button>
                            {run.transferFile && (
                              <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Download className="h-3.5 w-3.5 text-[#6B7280]" />تحميل الملف</button>
                            )}
                            <div className="border-t border-[#F3F4F6] my-1" />
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start"><Trash2 className="h-3.5 w-3.5" />حذف</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Allowances & Benefits */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[#0B1B49]">البدلات والمكافآت</CardTitle>
              <CardDescription className="text-[#6B7280]">إدارة أنواع البدلات والمزايا</CardDescription>
            </div>
            <Button variant="outline" className="border-[#1276E3] text-[#1276E3]" onClick={() => setIsAllowanceDialogOpen(true)}>
              <Plus className="me-2 h-4 w-4" />بدل جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "700px" }}>
              <colgroup>
                <col style={{ minWidth: "100px" }} />
                <col style={{ minWidth: "200px" }} />
                <col style={{ minWidth: "100px" }} />
                <col style={{ minWidth: "140px" }} />
                <col style={{ minWidth: "100px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الرمز</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الاسم</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>النوع</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>القيمة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>خاضع للضريبة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {allowanceTypes.map((allowance) => (
                  <tr key={allowance.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 px-3">
                      <span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{allowance.id}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#374151]" style={{ fontWeight: 500 }}>{allowance.name}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${typeBadge(allowance.type)}`} style={{ fontWeight: 600 }}>{allowance.type}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      {allowance.amount && (
                        <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                          <span className="text-[#374151]">{allowance.amount.toLocaleString()}</span>
                        </span>
                      )}
                      {allowance.percentage && (
                        <span className="font-english text-sm text-[#374151]" style={{ fontWeight: 600 }}>{allowance.percentage}%</span>
                      )}
                      {!allowance.amount && !allowance.percentage && <span className="text-sm text-[#9CA3AF]">متغير</span>}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${allowance.taxable ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#ECEEF5] text-[#0B1A47]"}`} style={{ fontWeight: 600 }}>
                        {allowance.taxable ? "نعم" : "لا"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <button className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><MoreVertical className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* GOSI Compliance */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-[#0B1B49]">الامتثال للتأمينات الاجتماعية (GOSI)</CardTitle>
          <CardDescription className="text-[#6B7280]">نظام التأمينات الاجتماعية السعودي</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
              <div className="space-y-1">
                <div className="text-sm text-[#6B7280]">نسبة المؤسسة</div>
                <p className="text-xs text-[#9CA3AF]">من إجمالي الراتب</p>
              </div>
              <div className="text-2xl font-english text-[#0B1B49]" style={{ fontWeight: 700 }}>12%</div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
              <div className="space-y-1">
                <div className="text-sm text-[#6B7280]">نسبة الموظف</div>
                <p className="text-xs text-[#9CA3AF]">من إجمالي الراتب</p>
              </div>
              <div className="text-2xl font-english text-[#0B1B49]" style={{ fontWeight: 700 }}>10%</div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#1276E3] bg-[#EFF6FF]/30 p-4">
              <div className="space-y-1">
                <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>إجمالي المساهمات</div>
                <p className="text-xs text-[#6B7280]">مارس 2026</p>
              </div>
              <div dir="ltr" className="flex items-baseline gap-1">
                <span className="text-sm font-english text-[#6B7280]">{CUR}</span>
                <span className="text-2xl font-english text-[#1276E3]" style={{ fontWeight: 700 }}>65,450</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog for New Payroll Run */}
      <Dialog open={isPayrollDialogOpen} onOpenChange={setIsPayrollDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#0B1B49]">دورة رواتب جديدة</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayrollSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month" className="text-[#374151]">الشهر *</Label>
                  <Select value={payrollFormData.month} onValueChange={(value) => setPayrollFormData({ ...payrollFormData, month: value })}>
                    <SelectTrigger className="border-[#E5E7EB]">
                      <SelectValue placeholder="اختر الشهر" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">يناير</SelectItem>
                      <SelectItem value="02">فبراير</SelectItem>
                      <SelectItem value="03">مارس</SelectItem>
                      <SelectItem value="04">أبريل</SelectItem>
                      <SelectItem value="05">مايو</SelectItem>
                      <SelectItem value="06">يونيو</SelectItem>
                      <SelectItem value="07">يوليو</SelectItem>
                      <SelectItem value="08">أغسطس</SelectItem>
                      <SelectItem value="09">سبتمبر</SelectItem>
                      <SelectItem value="10">أكتوبر</SelectItem>
                      <SelectItem value="11">نوفمبر</SelectItem>
                      <SelectItem value="12">ديسمبر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year" className="text-[#374151]">السنة *</Label>
                  <Input
                    id="year"
                    type="number"
                    value={payrollFormData.year}
                    onChange={(e) => setPayrollFormData({ ...payrollFormData, year: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-[#EFF6FF] p-4 border border-[#1276E3]/20">
                <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>ملاحظة</p>
                <p className="text-xs text-[#6B7280] mt-1">سيتم حساب الرواتب تلقائياً بناءً على بيانات الموظفين والبدلات المعرفة</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPayrollDialogOpen(false)} className="border-[#E5E7EB]">
                إلغاء
              </Button>
              <Button type="submit" className="bg-[#1276E3] hover:bg-[#1060C0]">
                إنشاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for New Allowance */}
      <Dialog open={isAllowanceDialogOpen} onOpenChange={setIsAllowanceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#0B1B49]">بدل جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAllowanceSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="allowanceName" className="text-[#374151]">اسم البدل *</Label>
                <Input
                  id="allowanceName"
                  placeholder="مثال: بدل سكن"
                  value={allowanceFormData.name}
                  onChange={(e) => setAllowanceFormData({ ...allowanceFormData, name: e.target.value })}
                  required
                  className="border-[#E5E7EB]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowanceType" className="text-[#374151]">النوع *</Label>
                <Select value={allowanceFormData.type} onValueChange={(value: "ثابت" | "متغير" | "نسبة") => setAllowanceFormData({ ...allowanceFormData, type: value, amount: "", percentage: "" })}>
                  <SelectTrigger className="border-[#E5E7EB]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ثابت">ثابت</SelectItem>
                    <SelectItem value="متغير">متغير</SelectItem>
                    <SelectItem value="نسبة">نسبة مئوية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {allowanceFormData.type === "ثابت" && (
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-[#374151]">المبلغ ({CUR}) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0"
                    value={allowanceFormData.amount}
                    onChange={(e) => setAllowanceFormData({ ...allowanceFormData, amount: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
              )}
              {allowanceFormData.type === "نسبة" && (
                <div className="space-y-2">
                  <Label htmlFor="percentage" className="text-[#374151]">النسبة المئوية *</Label>
                  <div className="relative">
                    <Input
                      id="percentage"
                      type="number"
                      placeholder="0"
                      value={allowanceFormData.percentage}
                      onChange={(e) => setAllowanceFormData({ ...allowanceFormData, percentage: e.target.value })}
                      required
                      className="border-[#E5E7EB] font-english pe-8"
                      dir="ltr"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[#6B7280] font-english">%</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] p-3">
                <input
                  type="checkbox"
                  id="taxable"
                  checked={allowanceFormData.taxable}
                  onChange={(e) => setAllowanceFormData({ ...allowanceFormData, taxable: e.target.checked })}
                  className="h-4 w-4 rounded border-[#D1D5DB] accent-[#1276E3]"
                />
                <Label htmlFor="taxable" className="text-sm text-[#374151] cursor-pointer">خاضع للضريبة</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAllowanceDialogOpen(false)} className="border-[#E5E7EB]">
                إلغاء
              </Button>
              <Button type="submit" className="bg-[#1276E3] hover:bg-[#1060C0]">
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Upload File */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#0B1B49]">رفع ملف تحويل الرواتب</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file" className="text-[#374151]">ملف التحويل *</Label>
                <div className="flex items-center gap-2">
                  <label htmlFor="file" className="flex-1 cursor-pointer">
                    <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-6 text-center hover:border-[#1276E3] hover:bg-[#EFF6FF]/30 transition-colors">
                      <Upload className="h-8 w-8 text-[#9CA3AF] mx-auto mb-2" />
                      {selectedFile ? (
                        <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{selectedFile.name}</p>
                      ) : (
                        <>
                          <p className="text-sm text-[#374151]" style={{ fontWeight: 500 }}>اضغط لتحديد ملف</p>
                          <p className="text-xs text-[#9CA3AF] mt-1">Excel, CSV (حتى 10MB)</p>
                        </>
                      )}
                    </div>
                    <input
                      id="file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      required
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-lg bg-[#E4F4F9] p-4 border border-[#349FC4]/20">
                <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>تنسيق الملف المطلوب</p>
                <p className="text-xs text-[#6B7280] mt-1">يجب أن يحتوي الملف على: رقم الموظف، الراتب الأساسي، البدلات، الخصومات</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)} className="border-[#E5E7EB]">
                إلغاء
              </Button>
              <Button type="submit" className="bg-[#1276E3] hover:bg-[#1060C0]">
                رفع
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
