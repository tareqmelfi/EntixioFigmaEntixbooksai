import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import {
  Building2, Plus, Search, Filter, MoreVertical, Eye, Edit2, Copy, Trash2,
  ChevronDown, X, Download, ArrowUpDown, CreditCard, Wallet, TrendingUp,
  CheckSquare, GitMerge, ArrowLeftRight, Landmark
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const CUR = "SR";

interface BankAccount {
  id: string;
  name: string;
  bank: string;
  iban: string;
  type: string;
  currency: string;
  balance: number;
  status: string;
  lastSync?: string;
}

const accounts: BankAccount[] = [
  { id: "BA-001", name: "الحساب الجاري الرئيسي", bank: "البنك الأهلي السعودي", iban: "SA44 2000 0001 2340 0000 1234", type: "جاري", currency: "SAR", balance: 1250000, status: "نشط", lastSync: "2026-03-04" },
  { id: "BA-002", name: "حساب الرواتب", bank: "بنك الراجحي", iban: "SA03 8000 0000 6080 1016 7519", type: "جاري", currency: "SAR", balance: 340000, status: "نشط", lastSync: "2026-03-04" },
  { id: "BA-003", name: "حساب التوفير", bank: "البنك الأهلي السعودي", iban: "SA44 2000 0001 2340 0000 5678", type: "توفير", currency: "SAR", balance: 2500000, status: "نشط", lastSync: "2026-03-03" },
  { id: "BA-004", name: "حساب USD", bank: "بنك الإنماء", iban: "SA05 0500 0000 1234 5670 0012", type: "جاري", currency: "USD", balance: 85000, status: "نشط", lastSync: "2026-03-01" },
  { id: "BA-005", name: "صندوق النثرية", bank: "—", iban: "—", type: "صندوق", currency: "SAR", balance: 5000, status: "نشط" },
  { id: "BA-006", name: "حساب الضمان", bank: "بنك الرياض", iban: "SA66 2000 0001 2340 9900 1234", type: "جاري", currency: "SAR", balance: 0, status: "مجمّد" },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "نشط": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "مجمّد": "bg-[#E4F4F9] text-[#2A7F9E] border-[#349FC4]",
    "مغلق": "bg-[#F3F4F6] text-[#6B7280] border-[#9CA3AF]",
  };
  return m[s] || "";
};

export function BankAccounts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [perPage, setPerPage] = useState(20);
  const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = accounts.filter((a) =>
    a.name.includes(searchQuery) || a.bank.includes(searchQuery) || a.id.includes(searchQuery)
  );

  const totalBalance = accounts.filter(a => a.currency === "SAR").reduce((s, a) => s + a.balance, 0);
  const activeCount = accounts.filter(a => a.status === "نشط").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الحسابات البنكية</h1>
          <p className="text-[#6B7280] mt-1">إدارة الحسابات البنكية والصناديق</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />حساب بنكي جديد</Button>
          <Button variant="outline" className="border-[#E5E7EB]"><Download className="me-2 h-4 w-4" />تصدير</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#0B1A47]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><Landmark className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalBalance.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الأرصدة (SAR)</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Building2 className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{accounts.length}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الحسابات</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><CreditCard className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{activeCount}</div>
            <p className="text-xs text-[#6B7280] mt-1">حسابات نشطة</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><ArrowLeftRight className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>47</div>
            <p className="text-xs text-[#6B7280] mt-1">حركة هذا الشهر</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-[#0B1B49]">قائمة الحسابات</CardTitle>
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
                <col style={{ minWidth: "180px" }} />
                <col style={{ minWidth: "150px" }} />
                <col style={{ minWidth: "200px" }} />
                <col style={{ minWidth: "70px" }} />
                <col style={{ minWidth: "120px" }} />
                <col style={{ minWidth: "80px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الرمز</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>اسم الحساب</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>البنك</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>IBAN</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>النوع</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الرصيد</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((acc) => (
                  <tr key={acc.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 px-3"><span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{acc.id}</span></td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#374151] block overflow-hidden text-ellipsis" style={{ fontWeight: 500 }} title={acc.name}>
                        {acc.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-sm text-[#6B7280] block overflow-hidden text-ellipsis" title={acc.bank}>
                        {acc.bank}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-english text-xs text-[#9CA3AF] block overflow-hidden text-ellipsis" dir="ltr" title={acc.iban}>
                        {acc.iban}
                      </span>
                    </td>
                    <td className="py-3.5 px-3"><span className="text-sm text-[#6B7280]">{acc.type}</span></td>
                    <td className="py-3.5 px-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{acc.currency === "SAR" ? CUR : "$"}</span>
                        <span className="text-[#0B1A47]">{acc.balance.toLocaleString("en-US")}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex rounded-md px-2.5 py-0.5 text-xs border whitespace-nowrap ${statusStyle(acc.status)}`} style={{ fontWeight: 600 }}>{acc.status}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="relative" ref={actionMenuId === acc.id ? actionMenuRef : undefined}>
                        <button onClick={() => setActionMenuId(actionMenuId === acc.id ? null : acc.id)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><MoreVertical className="h-4 w-4" /></button>
                        {actionMenuId === acc.id && (
                          <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Edit2 className="h-3.5 w-3.5 text-[#6B7280]" />تعديل</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><ArrowLeftRight className="h-3.5 w-3.5 text-[#6B7280]" />تحويل</button>
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
    </div>
  );
}