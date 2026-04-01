import { useState, useRef, useEffect } from "react";
import {
  FolderKanban, Plus, Search, MoreVertical, Eye, Edit2, Trash2,
  Download, DollarSign, Clock, Users, TrendingUp, CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

const CUR = "SR";

interface Project {
  id: string;
  name: string;
  client: string;
  manager: string;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  revenue: number;
  progress: number;
  status: string;
}

const projects: Project[] = [
  { id: "PJ-001", name: "مشروع التحول الرقمي", client: "شركة التقنية المتقدمة", manager: "أحمد الحربي", startDate: "2025-06-01", endDate: "2026-06-01", budget: 1500000, spent: 920000, revenue: 1800000, progress: 65, status: "جاري" },
  { id: "PJ-002", name: "تطوير المتجر الإلكتروني", client: "شركة المستقبل للتجارة", manager: "خالد العمري", startDate: "2025-09-01", endDate: "2026-03-31", budget: 450000, spent: 380000, revenue: 500000, progress: 88, status: "جاري" },
  { id: "PJ-003", name: "تجهيز مقر الشركة", client: "داخلي", manager: "محمد أحمد", startDate: "2025-01-15", endDate: "2025-12-31", budget: 800000, spent: 750000, revenue: 0, progress: 100, status: "مكتمل" },
  { id: "PJ-004", name: "نظام إدارة المخزون", client: "مؤسسة الإبداع الرقمي", manager: "سارة الشمري", startDate: "2026-01-01", endDate: "2026-08-31", budget: 650000, spent: 120000, revenue: 700000, progress: 22, status: "جاري" },
  { id: "PJ-005", name: "حملة تسويقية Q1", client: "داخلي", manager: "نورة السبيعي", startDate: "2026-01-01", endDate: "2026-03-31", budget: 200000, spent: 0, revenue: 0, progress: 0, status: "مُعلّق" },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "جاري": "bg-[#EFF6FF] text-[#1276E3] border-[#1276E3]/20",
    "مكتمل": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "مُعلّق": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
    "ملغي": "bg-[#E4F4F9] text-[#2A7F9E] border-[#349FC4]",
  };
  return m[s] || "";
};

export function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    client: "",
    manager: "",
    startDate: "",
    endDate: "",
    budget: "",
    revenue: "",
    status: "جاري"
  });
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = projects.filter((p) => p.name.includes(searchQuery) || p.client.includes(searchQuery) || p.id.includes(searchQuery));
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalRevenue = projects.reduce((s, p) => s + p.revenue, 0);
  const activeProjects = projects.filter((p) => p.status === "جاري").length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // هنا يمكن إضافة المنطق لحفظ البيانات
    console.log("New Project:", formData);
    setIsDialogOpen(false);
    setFormData({ name: "", client: "", manager: "", startDate: "", endDate: "", budget: "", revenue: "", status: "جاري" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المشاريع</h1>
          <p className="text-[#6B7280] mt-1">إدارة المشاريع وتتبع الربحية</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setIsDialogOpen(true)}><Plus className="me-2 h-4 w-4" />مشروع جديد</Button>
          <Button variant="outline" className="border-[#E5E7EB]"><Download className="me-2 h-4 w-4" />تصدير</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><FolderKanban className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{projects.length}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي المشاريع</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><DollarSign className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{(totalRevenue / 1000000).toFixed(1)}M</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الإيرادات</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Clock className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#1276E3] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{activeProjects}</div>
            <p className="text-xs text-[#6B7280] mt-1">مشاريع جارية</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><TrendingUp className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{(totalBudget / 1000000).toFixed(1)}M</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الميزانيات</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-[#0B1B49]">قائمة المشاريع</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input placeholder="بحث..." className="w-full ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "950px" }}>
              <colgroup>
                <col style={{ minWidth: "80px" }} />
                <col style={{ minWidth: "180px" }} />
                <col style={{ minWidth: "140px" }} />
                <col style={{ minWidth: "110px" }} />
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "110px" }} />
                <col style={{ minWidth: "90px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الرمز</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المشروع</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>العميل</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>تاريخ الانتهاء</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الميزانية</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المصروف</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التقدم</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 px-3"><span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{p.id}</span></td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#374151] block overflow-hidden text-ellipsis" style={{ fontWeight: 500 }} title={p.name}>
                        {p.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#6B7280] block overflow-hidden text-ellipsis" title={p.client}>
                        {p.client}
                      </span>
                    </td>
                    <td className="py-3.5 px-3"><span className="font-english text-sm text-[#6B7280] whitespace-nowrap">{p.endDate}</span></td>
                    <td className="py-3.5 px-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                        <span className="text-[#374151]">{p.budget.toLocaleString("en-US")}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                        <span className="text-[#349FC4]">{p.spent.toLocaleString("en-US")}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#E5E7EB] rounded-full min-w-[50px]">
                          <div className="h-1.5 rounded-full bg-[#1276E3]" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="font-english text-xs text-[#6B7280] whitespace-nowrap" style={{ fontWeight: 600 }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3"><span className={`inline-flex rounded-md px-2 py-0.5 text-xs border whitespace-nowrap ${statusStyle(p.status)}`} style={{ fontWeight: 600 }}>{p.status}</span></td>
                    <td className="py-3.5 px-3">
                      <div className="relative" ref={actionMenuId === p.id ? actionMenuRef : undefined}>
                        <button onClick={() => setActionMenuId(actionMenuId === p.id ? null : p.id)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><MoreVertical className="h-4 w-4" /></button>
                        {actionMenuId === p.id && (
                          <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Edit2 className="h-3.5 w-3.5 text-[#6B7280]" />تعديل</button>
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

      {/* Dialog for New Project */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-[#0B1B49]">مشروع جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name" className="text-[#374151]">اسم المشروع *</Label>
                  <Input
                    id="name"
                    placeholder="مثال: مشروع التحول الرقمي"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="border-[#E5E7EB]"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="client" className="text-[#374151]">اسم العميل *</Label>
                  <Input
                    id="client"
                    placeholder="مثال: شركة التقنية المتقدمة"
                    value={formData.client}
                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                    required
                    className="border-[#E5E7EB]"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="manager" className="text-[#374151]">مدير المشروع *</Label>
                  <Input
                    id="manager"
                    placeholder="مثال: أحمد الحربي"
                    value={formData.manager}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                    required
                    className="border-[#E5E7EB]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-[#374151]">تاريخ البداية *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-[#374151]">تاريخ الانتهاء *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-[#374151]">الميزانية ({CUR}) *</Label>
                  <Input
                    id="budget"
                    type="number"
                    placeholder="0"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenue" className="text-[#374151]">الإيرادات المتوقعة ({CUR}) *</Label>
                  <Input
                    id="revenue"
                    type="number"
                    placeholder="0"
                    value={formData.revenue}
                    onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                    required
                    className="border-[#E5E7EB] font-english"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="status" className="text-[#374151]">الحالة *</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="border-[#E5E7EB]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="جاري">جاري</SelectItem>
                      <SelectItem value="مكتمل">مكتمل</SelectItem>
                      <SelectItem value="مُعلّق">مُعلّق</SelectItem>
                      <SelectItem value="ملغي">ملغي</SelectItem>
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