import { useState } from "react";
import { BookOpen, Plus, Search, ChevronDown, ChevronLeft, MoreHorizontal, Edit2, Trash2, X, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";

interface Account {
  code: string;
  name: string;
  type: string;
  balance: number;
  children?: Account[];
}

const typeBadge = (t: string) => {
  const m: Record<string, string> = { "أصل": "bg-[#DBEAFE] text-[#1E40AF]", "التزام": "bg-[#E4F4F9] text-[#349FC4]", "حقوق الملكية": "bg-[#FEF3C7] text-[#92400E]", "إيراد": "bg-[#ECEEF5] text-[#0B1A47]", "مصروف": "bg-[#F3F4F6] text-[#374151]" };
  return m[t] || "";
};

const accountTree: Account[] = [
  { code: "1000", name: "الأصول", type: "أصل", balance: 920000, children: [
    { code: "1100", name: "الأصول المتداولة", type: "أصل", balance: 680000, children: [
      { code: "1101", name: "النقدية", type: "أصل", balance: 230000 },
      { code: "1102", name: "البنك", type: "أصل", balance: 450000 },
      { code: "1103", name: "الذمم المدينة", type: "أصل", balance: 240000 },
    ]},
    { code: "1200", name: "الأصول الثابتة", type: "أصل", balance: 240000, children: [
      { code: "1201", name: "المعدات", type: "أصل", balance: 120000 },
      { code: "1202", name: "الأثاث", type: "أصل", balance: 35000 },
      { code: "1203", name: "أجهزة الحاسب", type: "أصل", balance: 53000 },
      { code: "1204", name: "المركبات", type: "أصل", balance: 80000 },
    ]},
  ]},
  { code: "2000", name: "الخصوم", type: "التزام", balance: 310000, children: [
    { code: "2100", name: "الخصوم المتداولة", type: "التزام", balance: 310000, children: [
      { code: "2101", name: "الذمم الدائنة", type: "التزام", balance: 260000 },
      { code: "2102", name: "ضريبة القيمة المضافة المستحقة", type: "التزام", balance: 50000 },
    ]},
  ]},
  { code: "3000", name: "حقوق الملكية", type: "حقوق الملكية", balance: 1270000, children: [
    { code: "3001", name: "رأس المال", type: "حقوق الملكية", balance: 1000000 },
    { code: "3002", name: "الأرباح المبقاة", type: "حقوق الملكية", balance: 270000 },
  ]},
  { code: "4000", name: "الإيرادات", type: "إيراد", balance: 1250000, children: [
    { code: "4001", name: "إيرادات المبيعات", type: "إيراد", balance: 1180000 },
    { code: "4002", name: "إيرادات أخرى", type: "إيراد", balance: 70000 },
  ]},
  { code: "5000", name: "المصروفات", type: "مصروف", balance: 980000, children: [
    { code: "5001", name: "تكلفة المبيعات", type: "مصروف", balance: 650000 },
    { code: "5002", name: "الرواتب والأجور", type: "مصروف", balance: 180000 },
    { code: "5003", name: "الإيجار", type: "مصروف", balance: 60000 },
    { code: "5004", name: "المرافق", type: "مصروف", balance: 25000 },
    { code: "5005", name: "الصيانة", type: "مصروف", balance: 15000 },
    { code: "5006", name: "مصاريف إدارية", type: "مصروف", balance: 50000 },
  ]},
];

// Map KPI label → account tree code for filtering
const kpiCodeMap: Record<string, string> = {
  "الأصول": "1000",
  "الالتزامات": "2000",
  "حقوق الملكية": "3000",
  "الإيرادات": "4000",
  "المصروفات": "5000",
};

export function ChartOfAccounts() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1000", "2000", "3000", "4000", "5000"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  // Filter: when a KPI card is clicked, expand only that category
  const handleKpiClick = (label: string) => {
    const code = kpiCodeMap[label];
    if (activeFilter === code) {
      // Reset: show all
      setActiveFilter(null);
      setExpanded(new Set(["1000", "2000", "3000", "4000", "5000"]));
    } else {
      setActiveFilter(code);
      // Expand this category and its children
      const newExpanded = new Set<string>();
      const expandAll = (accts: Account[]) => {
        accts.forEach((a) => { newExpanded.add(a.code); if (a.children) expandAll(a.children); });
      };
      const target = accountTree.find((a) => a.code === code);
      if (target) { newExpanded.add(target.code); if (target.children) expandAll(target.children); }
      setExpanded(newExpanded);
    }
  };

  const filteredTree = activeFilter ? accountTree.filter((a) => a.code === activeFilter) : accountTree;

  const kpis = [
    { label: "الأصول", value: 920000, color: "#1276E3" },
    { label: "الالتزامات", value: 310000, color: "#349FC4" },
    { label: "حقوق الملكية", value: 1270000, color: "#F59E0B" },
    { label: "الإيرادات", value: 1250000, color: "#0B1A47" },
    { label: "المصروفات", value: 980000, color: "#6B7280" },
  ];

  // Detail view for a selected leaf account
  if (selectedAccount) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedAccount(null)} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
          <div>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}><span className="font-english">{selectedAccount.code}</span> — {selectedAccount.name}</h1>
            <Badge className={`text-xs ${typeBadge(selectedAccount.type)}`}>{selectedAccount.type}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]"><CardContent className="p-5">
            <h3 className="text-[#0B1B49] mb-3" style={{ fontWeight: 600 }}>معلومات الحساب</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#6B7280]">رمز الحساب:</span><span className="font-english">{selectedAccount.code}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">اسم الحساب:</span><span>{selectedAccount.name}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">النوع:</span><Badge className={`text-xs ${typeBadge(selectedAccount.type)}`}>{selectedAccount.type}</Badge></div>
            </div>
          </CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-5">
            <h3 className="text-[#0B1B49] mb-3" style={{ fontWeight: 600 }}>الرصيد</h3>
            <div className="font-english" style={{ fontSize: "2rem", fontWeight: 700, color: selectedAccount.type === "إيراد" ? "#0B1A47" : selectedAccount.type === "مصروف" ? "#6B7280" : "#0B1B49" }}>
              {selectedAccount.balance.toLocaleString()} SR
            </div>
          </CardContent></Card>
        </div>
        {/* Sample transactions */}
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">آخر الحركات</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full border-collapse" style={{ minWidth: "500px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المرجع</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الوصف</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>مدين</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>دائن</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                  <td className="py-2.5 pe-4 text-sm font-english text-[#6B7280]">2026-03-01</td>
                  <td className="py-2.5 pe-4"><button className="text-sm font-english text-[#1276E3] hover:underline">JE-001</button></td>
                  <td className="py-2.5 pe-4 text-sm text-[#374151]">قيد افتتاحي</td>
                  <td className="py-2.5 pe-4 text-sm font-english">{selectedAccount.balance > 100000 ? "140,000" : "—"}</td>
                  <td className="py-2.5 text-sm font-english">{selectedAccount.balance > 100000 ? "—" : "140,000"}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>دليل الحسابات</h1><p className="text-[#6B7280] mt-1">إدارة شجرة الحسابات المحاسبية</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setShowCreateForm(!showCreateForm)}><Plus className="me-2 h-4 w-4" />حساب جديد</Button>
      </div>

      {/* KPI Cards — Clickable to filter */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} onClick={() => handleKpiClick(kpi.label)} className="cursor-pointer">
            <Card className={`border-[#E5E7EB] hover:shadow-md transition-all ${activeFilter === kpiCodeMap[kpi.label] ? "ring-2" : ""}`} style={{ borderColor: activeFilter === kpiCodeMap[kpi.label] ? kpi.color + "40" : undefined }}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">{kpi.label}</CardTitle></CardHeader>
              <CardContent><div className="font-english" style={{ fontSize: "1.25rem", fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()} SR</div></CardContent>
            </Card>
          </div>
        ))}
      </div>

      {activeFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">تصفية حسب:</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs text-[#1E40AF]" style={{ fontWeight: 600 }}>
            {kpis.find((k) => kpiCodeMap[k.label] === activeFilter)?.label}
            <button onClick={() => { setActiveFilter(null); setExpanded(new Set(["1000", "2000", "3000", "4000", "5000"])); }} className="ms-1 hover:opacity-70"><X className="h-3 w-3" /></button>
          </span>
        </div>
      )}

      {showCreateForm && (
        <Card className="border-[#1276E3] bg-[#1276E3]/5">
          <CardHeader><CardTitle className="text-[#0B1B49]">إضافة حساب جديد</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2"><Label>رمز الحساب</Label><Input placeholder="مثال: 1104" className="font-english" dir="ltr" /></div>
              <div className="space-y-2"><Label>اسم الحساب</Label><Input placeholder="اسم الحساب" /></div>
              <div className="space-y-2"><Label>النوع</Label>
                <select className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm focus:border-[#1276E3] focus:outline-none">
                  <option>أصل</option><option>التزام</option><option>حقوق الملكية</option><option>إيراد</option><option>مصروف</option>
                </select>
              </div>
              <div className="space-y-2"><Label>الحساب الأب</Label>
                <select className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm focus:border-[#1276E3] focus:outline-none">
                  <option>بدون (حساب رئيسي)</option>
                  {accountTree.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setShowCreateForm(false)}>حفظ</Button>
              <Button variant="outline" className="border-[#E5E7EB]" onClick={() => setShowCreateForm(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-[#0B1B49]">شجرة الحسابات</CardTitle>
            <div className="relative w-full sm:w-64"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-full ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="space-y-0">
            {filteredTree.map((account) => (
              <AccountRow key={account.code} account={account} level={0} expanded={expanded} onToggle={toggle} searchQuery={searchQuery} onSelect={setSelectedAccount} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountRow({ account, level, expanded, onToggle, searchQuery, onSelect }: {
  account: Account; level: number; expanded: Set<string>; onToggle: (code: string) => void; searchQuery: string; onSelect: (a: Account) => void;
}) {
  const hasChildren = account.children && account.children.length > 0;
  const isExpanded = expanded.has(account.code);
  const matchesSearch = !searchQuery || account.name.includes(searchQuery) || account.code.includes(searchQuery);

  if (!matchesSearch && !hasChildren) return null;

  return (
    <>
      <div
        className="flex items-center gap-3 border-b border-[#F3F4F6] py-3 hover:bg-[#F4FCFF] transition-colors"
        style={{ paddingInlineStart: `${level * 24 + 16}px` }}
      >
        {hasChildren ? (
          <button onClick={() => onToggle(account.code)} className="rounded p-0.5 hover:bg-[#E5E7EB]">
            {isExpanded ? <ChevronDown className="h-4 w-4 text-[#6B7280]" /> : <ChevronLeft className="h-4 w-4 text-[#6B7280]" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className="font-english text-sm text-[#6B7280] w-12" style={{ fontWeight: 500 }}>{account.code}</span>
        <button
          onClick={() => hasChildren ? onToggle(account.code) : onSelect(account)}
          className={`flex-1 text-start text-sm transition-colors ${hasChildren ? "text-[#0B1B49]" : "text-[#374151] hover:text-[#1276E3] hover:underline"}`}
          style={{ fontWeight: hasChildren ? 600 : 400 }}
        >
          {account.name}
        </button>
        <Badge className={`text-xs ${typeBadge(account.type)}`}>{account.type}</Badge>
        <button
          onClick={() => onSelect(account)}
          className="font-english text-sm min-w-[100px] text-end hover:text-[#1276E3] hover:underline transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          {account.balance.toLocaleString()} SR
        </button>
        <button className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"><MoreHorizontal className="h-4 w-4" /></button>
      </div>
      {hasChildren && isExpanded && account.children!.map((child) => (
        <AccountRow key={child.code} account={child} level={level + 1} expanded={expanded} onToggle={onToggle} searchQuery={searchQuery} onSelect={onSelect} />
      ))}
    </>
  );
}