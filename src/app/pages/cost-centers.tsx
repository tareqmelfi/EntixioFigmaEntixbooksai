import { useState, useRef, useEffect } from "react";
import {
  Target, Plus, Search, MoreVertical, Eye, Edit2, Trash2,
  ChevronDown, Download, Layers, DollarSign, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const CUR = "SR";

interface CostCenter {
  id: string;
  name: string;
  code: string;
  parent?: string;
  budget: number;
  actual: number;
  status: string;
}

const costCenters: CostCenter[] = [
  { id: "CC-001", name: "الإدارة العامة", code: "ADM", budget: 500000, actual: 320000, status: "نشط" },
  { id: "CC-002", name: "قسم المبيعات", code: "SLS", budget: 800000, actual: 650000, status: "نشط" },
  { id: "CC-003", name: "قسم التقنية", code: "TEC", budget: 1200000, actual: 980000, status: "نشط" },
  { id: "CC-004", name: "الموارد البشرية", code: "HR", budget: 300000, actual: 275000, status: "نشط" },
  { id: "CC-005", name: "قسم التسويق", code: "MKT", budget: 450000, actual: 380000, status: "نشط" },
  { id: "CC-006", name: "مشروع التحول الرقمي", code: "DX", parent: "قسم التقنية", budget: 600000, actual: 420000, status: "نشط" },
  { id: "CC-007", name: "فرع جدة", code: "JED", budget: 200000, actual: 50000, status: "مُعلّق" },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "نشط": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "مُعلّق": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
    "مغلق": "bg-[#F3F4F6] text-[#6B7280] border-[#9CA3AF]",
  };
  return m[s] || "";
};

export function CostCenters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = costCenters.filter((c) =>
    c.name.includes(searchQuery) || c.code.includes(searchQuery)
  );

  const totalBudget = costCenters.reduce((s, c) => s + c.budget, 0);
  const totalActual = costCenters.reduce((s, c) => s + c.actual, 0);
  const utilization = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>مراكز التكلفة</h1>
          <p className="text-[#6B7280] mt-1">إدارة وتتبع مراكز التكلفة والميزانيات</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />مركز تكلفة جديد</Button>
          <Button variant="outline" className="border-[#E5E7EB]"><Download className="me-2 h-4 w-4" />تصدير</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Target className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{costCenters.length}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي المراكز</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><DollarSign className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{(totalBudget / 1000000).toFixed(1)}M</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الميزانية</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><Layers className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{(totalActual / 1000000).toFixed(1)}M</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي المصروف</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><TrendingUp className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#1276E3] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{utilization}%</div>
            <p className="text-xs text-[#6B7280] mt-1">نسبة الاستخدام</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-[#0B1B49]">قائمة مراكز التكلفة</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input placeholder="بحث..." className="w-full ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "900px" }}>
              <colgroup>
                <col style={{ minWidth: "90px" }} />
                <col style={{ minWidth: "160px" }} />
                <col style={{ minWidth: "80px" }} />
                <col style={{ minWidth: "140px" }} />
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "130px" }} />
                <col style={{ minWidth: "90px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الرمز</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الاسم</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الكود</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المركز الأب</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الميزانية</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المصروف</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الاستخدام</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cc) => {
                  const usage = cc.budget > 0 ? Math.round((cc.actual / cc.budget) * 100) : 0;
                  return (
                    <tr key={cc.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                      <td className="py-3.5 px-3"><span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{cc.id}</span></td>
                      <td className="py-3.5 px-3">
                        <span className="text-sm text-[#374151] block overflow-hidden text-ellipsis" style={{ fontWeight: 500 }} title={cc.name}>
                          {cc.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-3"><span className="font-english text-sm text-[#6B7280]" style={{ fontWeight: 600 }}>{cc.code}</span></td>
                      <td className="py-3.5 px-3">
                        <span className="text-sm text-[#9CA3AF] block overflow-hidden text-ellipsis" title={cc.parent || "—"}>
                          {cc.parent || "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                          <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                          <span className="text-[#374151]">{cc.budget.toLocaleString("en-US")}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                          <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                          <span className="text-[#349FC4]">{cc.actual.toLocaleString("en-US")}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#E5E7EB] rounded-full min-w-[50px]">
                            <div className={`h-1.5 rounded-full ${usage > 90 ? "bg-[#F59E0B]" : "bg-[#1276E3]"}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                          </div>
                          <span className="font-english text-xs text-[#6B7280] whitespace-nowrap" style={{ fontWeight: 600 }}>{usage}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3"><span className={`inline-flex rounded-md px-2 py-0.5 text-xs border whitespace-nowrap ${statusStyle(cc.status)}`} style={{ fontWeight: 600 }}>{cc.status}</span></td>
                      <td className="py-3.5 px-3">
                        <div className="relative" ref={actionMenuId === cc.id ? actionMenuRef : undefined}>
                          <button onClick={() => setActionMenuId(actionMenuId === cc.id ? null : cc.id)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><MoreVertical className="h-4 w-4" /></button>
                          {actionMenuId === cc.id && (
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}