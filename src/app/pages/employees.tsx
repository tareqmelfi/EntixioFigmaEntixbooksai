import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Users, Plus, Search, Filter, MoreVertical, Eye, Edit2, Trash2,
  Download, UserCheck, UserX, Calendar, Clock, Award, Shield,
  FileText, Briefcase, X, ChevronDown, CheckSquare, GitMerge, Copy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

const CUR = "SR";

interface Employee {
  id: string;
  name: string;
  employeeId: string;
  position: string;
  department: string;
  hireDate: string;
  salary: number;
  status: string;
  email: string;
  phone: string;
  nationalId?: string;
  contractType: string;
  contactId?: string; // ربط مع قائمة الاتصال
}

const employeesData: Employee[] = [
  { id: "EMP-001", name: "أحمد محمد العلي", employeeId: "100001", position: "مدير مالي", department: "المالية", hireDate: "2023-01-15", salary: 15000, status: "نشط", email: "ahmed.ali@company.sa", phone: "+966 50 123 4567", nationalId: "1234567890", contractType: "دائم" },
  { id: "EMP-002", name: "سارة علي الشمري", employeeId: "100002", position: "محاسب أول", department: "المالية", hireDate: "2023-03-20", salary: 12000, status: "نشط", email: "sara.shamri@company.sa", phone: "+966 55 234 5678", nationalId: "2345678901", contractType: "دائم" },
  { id: "EMP-003", name: "خالد عبدالله القحطاني", employeeId: "100003", position: "محاسب", department: "المالية", hireDate: "2024-06-01", salary: 8500, status: "نشط", email: "khalid.q@company.sa", phone: "+966 50 345 6789", nationalId: "3456789012", contractType: "دائم" },
  { id: "EMP-004", name: "فاطمة حسن الدوسري", employeeId: "100004", position: "مساعد إداري", department: "الإدارة", hireDate: "2024-01-10", salary: 6000, status: "نشط", email: "fatima.d@company.sa", phone: "+966 55 456 7890", nationalId: "4567890123", contractType: "دائم" },
  { id: "EMP-005", name: "محمد سعد الغامدي", employeeId: "100005", position: "مطور برمجيات", department: "تقنية المعلومات", hireDate: "2024-02-15", salary: 14000, status: "نشط", email: "mohammed.g@company.sa", phone: "+966 50 567 8901", nationalId: "5678901234", contractType: "دائم" },
  { id: "EMP-006", name: "نورة عبدالرحمن السبيعي", employeeId: "100006", position: "مسؤول تسويق", department: "التسويق", hireDate: "2023-09-01", salary: 9500, status: "إجازة", email: "noura.s@company.sa", phone: "+966 55 678 9012", nationalId: "6789012345", contractType: "دائم" },
  { id: "EMP-007", name: "عبدالله خالد العتيبي", employeeId: "100007", position: "مستشار مالي", department: "المالية", hireDate: "2022-04-10", salary: 11000, status: "نشط", email: "abdullah.o@company.sa", phone: "+966 50 789 0123", nationalId: "7890123456", contractType: "مؤقت" },
  { id: "EMP-008", name: "ريم فهد الحربي", employeeId: "100008", position: "مصممة جرافيك", department: "التسويق", hireDate: "2024-08-20", salary: 7500, status: "تحت التجربة", email: "reem.h@company.sa", phone: "+966 55 890 1234", nationalId: "8901234567", contractType: "دائم" },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "نشط": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "إجازة": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
    "تحت التجربة": "bg-[#E4F4F9] text-[#349FC4] border-[#349FC4]",
    "معلق": "bg-[#F3F4F6] text-[#6B7280] border-[#9CA3AF]",
    "مستقيل": "bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]",
  };
  return m[s] || "";
};

const contractTypeBadge = (t: string) => {
  const m: Record<string, string> = {
    "دائم": "bg-[#ECEEF5] text-[#0B1A47]",
    "مؤقت": "bg-[#E4F4F9] text-[#349FC4]",
    "تدريب": "bg-[#FEF3C7] text-[#92400E]",
  };
  return m[t] || "";
};

export function Employees() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    employeeId: "",
    position: "",
    department: "المالية",
    hireDate: "",
    salary: "",
    email: "",
    phone: "",
    nationalId: "",
    contractType: "دائم",
    status: "تحت التجربة"
  });

  const actionMenuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = employeesData.filter((e) => {
    const matchStatus = !statusFilter || e.status === statusFilter;
    const matchDepartment = !departmentFilter || e.department === departmentFilter;
    const matchSearch = !searchQuery || e.name.includes(searchQuery) || e.employeeId.includes(searchQuery) || e.position.includes(searchQuery);
    return matchStatus && matchDepartment && matchSearch;
  });

  const totalEmployees = employeesData.length;
  const activeEmployees = employeesData.filter(e => e.status === "نشط").length;
  const onLeaveEmployees = employeesData.filter(e => e.status === "إجازة").length;
  const totalSalaries = employeesData.reduce((sum, e) => sum + e.salary, 0);

  const departments = [...new Set(employeesData.map(e => e.department))];
  const statuses = ["نشط", "إجازة", "تحت التجربة", "معلق", "مستقيل"];
  const activeFilterCount = (statusFilter ? 1 : 0) + (departmentFilter ? 1 : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("New Employee:", formData);
    setIsDialogOpen(false);
    setFormData({
      name: "",
      employeeId: "",
      position: "",
      department: "المالية",
      hireDate: "",
      salary: "",
      email: "",
      phone: "",
      nationalId: "",
      contractType: "دائم",
      status: "تحت التجربة"
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((e) => e.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الموظفين</h1>
          <p className="text-[#6B7280] mt-1">إدارة بيانات الموظفين من التعيين حتى الاستقالة</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setIsDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />موظف جديد
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
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><UserCheck className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{activeEmployees}</div>
            <p className="text-xs text-[#6B7280] mt-1">موظفون نشطون</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#FEF3C7] p-2.5"><Calendar className="h-5 w-5 text-[#92400E]" /></div></div>
            <div className="text-[#92400E] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{onLeaveEmployees}</div>
            <p className="text-xs text-[#6B7280] mt-1">في إجازة</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><Briefcase className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalSalaries.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الرواتب الشهرية</p>
          </CardContent>
        </Card>
      </div>

      {/* Employees Table */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-[#0B1B49]">قائمة الموظفين</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder="بحث..."
                  className="w-full sm:w-64 ps-10 border-[#E5E7EB]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`rounded-lg border p-2 transition-colors relative ${activeFilterCount > 0 ? "bg-[#EFF6FF] border-[#1276E3] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"}`}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -end-1.5 h-4 w-4 rounded-full bg-[#1276E3] text-white text-[10px] flex items-center justify-center font-english" style={{ fontWeight: 700 }}>{activeFilterCount}</span>
                  )}
                </button>
                {showFilterDropdown && (
                  <div className="absolute end-0 z-40 mt-1 w-56 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    <p className="px-3 py-1.5 text-[10px] text-[#9CA3AF] uppercase tracking-wider" style={{ fontWeight: 700 }}>القسم</p>
                    {departments.map((d) => (
                      <button key={d} onClick={() => setDepartmentFilter(departmentFilter === d ? "" : d)}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${departmentFilter === d ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: departmentFilter === d ? 600 : 400 }}>{d}</button>
                    ))}
                    <div className="border-t border-[#F3F4F6] my-1" />
                    <p className="px-3 py-1.5 text-[10px] text-[#9CA3AF] uppercase tracking-wider" style={{ fontWeight: 700 }}>الحالة</p>
                    {statuses.map((s) => (
                      <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${statusFilter === s ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: statusFilter === s ? 600 : 400 }}>{s}</button>
                    ))}
                    {activeFilterCount > 0 && (
                      <>
                        <div className="border-t border-[#F3F4F6] my-1" />
                        <button onClick={() => { setDepartmentFilter(""); setStatusFilter(""); setShowFilterDropdown(false); }}
                          className="w-full text-start px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30">مسح جميع الفلاتر</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {/* Bulk selection bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 rounded-lg bg-[#EFF6FF] px-4 py-2.5 border border-[#1276E3]/20">
              <CheckSquare className="h-4 w-4 text-[#1276E3]" />
              <span className="text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{selectedIds.size} محدد</span>
              <div className="flex-1" />
              <button onClick={() => setSelectedIds(new Set())} className="rounded-md p-1 text-[#6B7280] hover:bg-white"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Active filters */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-[#6B7280]">فلتر نشط:</span>
              {departmentFilter && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                  {departmentFilter}
                  <button onClick={() => setDepartmentFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                  {statusFilter}
                  <button onClick={() => setStatusFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "1000px" }}>
              <colgroup>
                <col style={{ width: "40px" }} />
                <col style={{ minWidth: "100px" }} />
                <col style={{ minWidth: "180px" }} />
                <col style={{ minWidth: "140px" }} />
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "110px" }} />
                <col style={{ minWidth: "80px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-2">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-[#D1D5DB] accent-[#1276E3]" />
                  </th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم الموظف</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الاسم</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الوظيفة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>القسم</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الراتب ({CUR})</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>نوع العقد</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-2">
                      <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleOne(emp.id)}
                        className="h-3.5 w-3.5 rounded border-[#D1D5DB] accent-[#1276E3]" />
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{emp.employeeId}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#374151] block overflow-hidden text-ellipsis" style={{ fontWeight: 500 }} title={emp.name}>
                        {emp.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#6B7280]">{emp.position}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#6B7280]">{emp.department}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                        <span className="text-[#0B1A47]">{emp.salary.toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${contractTypeBadge(emp.contractType)}`} style={{ fontWeight: 600 }}>{emp.contractType}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs border whitespace-nowrap ${statusStyle(emp.status)}`} style={{ fontWeight: 600 }}>{emp.status}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="relative" ref={actionMenuId === emp.id ? actionMenuRef : undefined}>
                        <button onClick={() => setActionMenuId(actionMenuId === emp.id ? null : emp.id)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><MoreVertical className="h-4 w-4" /></button>
                        {actionMenuId === emp.id && (
                          <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Edit2 className="h-3.5 w-3.5 text-[#6B7280]" />تعديل</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><FileText className="h-3.5 w-3.5 text-[#6B7280]" />العقد</button>
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

      {/* Dialog for New Employee */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="text-[#0B1B49]">موظف جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name" className="text-[#374151]">اسم الموظف *</Label>
                  <Input
                    id="name"
                    placeholder="مثال: أحمد محمد العلي"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="border-[#E5E7EB]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeId" className="text-[#374151]">رقم الموظف *</Label>
                  <Input
                    id="employeeId"
                    placeholder="100001"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationalId" className="text-[#374151]">رقم الهوية</Label>
                  <Input
                    id="nationalId"
                    placeholder="1234567890"
                    value={formData.nationalId}
                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position" className="text-[#374151]">الوظيفة *</Label>
                  <Input
                    id="position"
                    placeholder="مثال: محاسب"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    required
                    className="border-[#E5E7EB]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department" className="text-[#374151]">القسم *</Label>
                  <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                    <SelectTrigger className="border-[#E5E7EB]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hireDate" className="text-[#374151]">تاريخ التعيين *</Label>
                  <Input
                    id="hireDate"
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary" className="text-[#374151]">الراتب الأساسي ({CUR}) *</Label>
                  <Input
                    id="salary"
                    type="number"
                    placeholder="0"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="email" className="text-[#374151]">البريد الإلكتروني *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ahmed@company.sa"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="phone" className="text-[#374151]">رقم الجوال *</Label>
                  <Input
                    id="phone"
                    placeholder="+966 50 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractType" className="text-[#374151]">نوع العقد *</Label>
                  <Select value={formData.contractType} onValueChange={(value) => setFormData({ ...formData, contractType: value })}>
                    <SelectTrigger className="border-[#E5E7EB]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="دائم">دائم</SelectItem>
                      <SelectItem value="مؤقت">مؤقت</SelectItem>
                      <SelectItem value="تدريب">تدريب</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-[#374151]">الحالة *</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="border-[#E5E7EB]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-[#E5E7EB]">
                إلغاء
              </Button>
              <Button type="submit" className="bg-[#1276E3] hover:bg-[#1060C0]">
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
