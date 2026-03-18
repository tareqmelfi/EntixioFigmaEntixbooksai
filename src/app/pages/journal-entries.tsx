import { useState } from "react";
import { Link } from "react-router";
import { Calculator, Plus, Search, Eye, X, Trash2, Check, XCircle, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

interface JournalLine { account: string; costCenter: string; debit: number; credit: number; }
interface JournalEntry { id: string; date: string; description: string; ref: string; lines: JournalLine[]; status: string; }

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "مرحّل": "bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0]",
    "مسودة": "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]",
    "ملغي": "bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA]",
  };
  return m[s] || "";
};

const accounts = ["1101 النقدية", "1102 البنك", "1103 الذمم المدينة", "2101 الذمم الدائنة", "4001 إيرادات المبيعات", "5001 تكلفة المبيعات", "5002 الرواتب", "5003 الإيجار"];

const initialEntries: JournalEntry[] = [
  { id: "JE-001", date: "2026-03-01", description: "قيد افتتاحي", ref: "REF-001", lines: [{ account: "1101 النقدية", costCenter: "الرئيسي", debit: 140000, credit: 0 }, { account: "4001 إيرادات المبيعات", costCenter: "الرئيسي", debit: 0, credit: 140000 }], status: "مرحّل" },
  { id: "JE-002", date: "2026-03-02", description: "مبيعات نقدية", ref: "INV-001", lines: [{ account: "1101 النقدية", costCenter: "الرئيسي", debit: 15000, credit: 0 }, { account: "4001 إيرادات المبيعات", costCenter: "الرئيسي", debit: 0, credit: 15000 }], status: "مرحّل" },
  { id: "JE-003", date: "2026-03-03", description: "سداد للمورد", ref: "PAY-001", lines: [{ account: "2101 الذمم الدائنة", costCenter: "الرئيسي", debit: 8500, credit: 0 }, { account: "1102 البنك", costCenter: "الرئيسي", debit: 0, credit: 8500 }], status: "مسودة" },
  { id: "JE-004", date: "2026-03-05", description: "دفع إيجار المكتب", ref: "EXP-001", lines: [{ account: "5003 الإيجار", costCenter: "الرئيسي", debit: 5000, credit: 0 }, { account: "1102 البنك", costCenter: "الرئيسي", debit: 0, credit: 5000 }], status: "مرحّل" },
];

type View = "list" | "create" | "view";

export function JournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [formDate, setFormDate] = useState("2026-03-04");
  const [formDesc, setFormDesc] = useState("");
  const [formRef, setFormRef] = useState("");
  const [formLines, setFormLines] = useState<JournalLine[]>([
    { account: "", costCenter: "", debit: 0, credit: 0 },
    { account: "", costCenter: "", debit: 0, credit: 0 },
  ]);

  const totalDebit = formLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = formLines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;
  const nextId = `JE-${String(entries.length + 1).padStart(3, "0")}`;

  const filtered = entries.filter((e) => {
    const matchSearch = !searchQuery || e.description.includes(searchQuery) || e.id.includes(searchQuery);
    const matchStatus = !statusFilter || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const resetForm = () => { setFormDate("2026-03-04"); setFormDesc(""); setFormRef(""); setFormLines([{ account: "", costCenter: "", debit: 0, credit: 0 }, { account: "", costCenter: "", debit: 0, credit: 0 }]); };

  const handleSave = (post: boolean) => {
    const entry: JournalEntry = { id: nextId, date: formDate, description: formDesc, ref: formRef, lines: formLines, status: post ? "مرحّل" : "مسودة" };
    setEntries((p) => [...p, entry]); setView("list"); resetForm();
  };

  const addLine = () => setFormLines((p) => [...p, { account: "", costCenter: "", debit: 0, credit: 0 }]);
  const removeLine = (i: number) => setFormLines((p) => p.filter((_, j) => j !== i));
  const updateLine = (i: number, field: keyof JournalLine, val: string | number) => setFormLines((p) => p.map((l, j) => j === i ? { ...l, [field]: val } : l));

  const totalEntryDebit = (e: JournalEntry) => e.lines.reduce((s, l) => s + l.debit, 0);
  const totalEntryCredit = (e: JournalEntry) => e.lines.reduce((s, l) => s + l.credit, 0);

  /* ─── Detail View ─── */
  if (view === "view" && selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView("list")} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>قيد <span className="font-english">{selected.id}</span></h1><p className="text-[#6B7280] text-sm">{selected.description}</p></div>
            <span className={`inline-flex rounded-md px-2.5 py-1 text-xs ${statusStyle(selected.status)}`} style={{ fontWeight: 600 }}>{selected.status}</span>
          </div>
        </div>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5"><div className="grid grid-cols-3 gap-4 text-sm"><div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{selected.date}</span></div><div><span className="text-[#6B7280]">الوصف:</span> <span>{selected.description}</span></div><div><span className="text-[#6B7280]">المرجع:</span> <span className="font-english text-[#1276E3]">{selected.ref}</span></div></div></CardContent></Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">بنود القيد</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full border-collapse" style={{ minWidth: "500px" }}>
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>الحساب</th>
                <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "120px" }}>مركز التكلفة</th>
                <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "130px" }}>مدين (SR)</th>
                <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "130px" }}>دائن (SR)</th>
              </tr></thead>
              <tbody>
                {selected.lines.map((l, i) => (<tr key={i} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF]">
                  <td className="py-2.5 pe-4 text-sm"><Link to="/chart-of-accounts" className="text-[#374151] hover:text-[#1276E3] hover:underline">{l.account}</Link></td>
                  <td className="py-2.5 pe-4 text-sm text-[#6B7280]">{l.costCenter}</td>
                  <td className="py-2.5 pe-4 text-sm font-english">{l.debit > 0 ? l.debit.toLocaleString() : "—"}</td>
                  <td className="py-2.5 text-sm font-english">{l.credit > 0 ? l.credit.toLocaleString() : "—"}</td>
                </tr>))}
                <tr className="bg-[#F9FAFB]" style={{ fontWeight: 600 }}>
                  <td className="py-2.5 pe-4 text-sm" colSpan={2}>الإجمالي</td>
                  <td className="py-2.5 pe-4 text-sm font-english">{totalEntryDebit(selected).toLocaleString()}</td>
                  <td className="py-2.5 text-sm font-english">{totalEntryCredit(selected).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
        <div className={`flex items-center gap-2 rounded-lg p-3 ${totalEntryDebit(selected) === totalEntryCredit(selected) ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
          {totalEntryDebit(selected) === totalEntryCredit(selected) ? <Check className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          <span style={{ fontWeight: 600 }}>{totalEntryDebit(selected) === totalEntryCredit(selected) ? "متوازن" : "غير متوازن"}</span>
        </div>
      </div>
    );
  }

  /* ─── Create View ─── */
  if (view === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView("list"); resetForm(); }} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>قيد جديد</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => handleSave(false)}>حفظ كمسودة</Button>
            <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => handleSave(true)} disabled={!isBalanced}>ترحيل</Button>
          </div>
        </div>
        <Card className="border-[#E5E7EB]"><CardHeader><CardTitle className="text-[#0B1B49]">بيانات القيد</CardTitle></CardHeader><CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2"><Label>رقم القيد</Label><Input value={nextId} disabled className="font-english bg-[#F3F4F6]" dir="ltr" /></div>
            <div className="space-y-2"><Label>التاريخ</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="font-english" dir="ltr" /></div>
            <div className="space-y-2"><Label>الوصف</Label><Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="وصف القيد" /></div>
            <div className="space-y-2"><Label>المرجع</Label><Input value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="اختياري" className="font-english" dir="ltr" /></div>
          </div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardHeader><CardTitle className="text-[#0B1B49]">بنود القيد</CardTitle></CardHeader><CardContent>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "600px" }}>
              <thead><tr className="border-b border-[#E5E7EB]">
                <th className="pb-3 pe-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>الحساب</th>
                <th className="pb-3 pe-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "140px" }}>مركز التكلفة</th>
                <th className="pb-3 pe-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "130px" }}>المدين (SR)</th>
                <th className="pb-3 pe-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "130px" }}>الدائن (SR)</th>
                <th className="pb-3" style={{ width: "40px" }}></th>
              </tr></thead>
              <tbody>
                {formLines.map((line, i) => (
                  <tr key={i} className="border-b border-[#F3F4F6]">
                    <td className="py-2 pe-2"><select value={line.account} onChange={(e) => updateLine(i, "account", e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm min-w-[180px] focus:border-[#1276E3] focus:outline-none"><option value="">اختر حساب...</option>{accounts.map((a) => <option key={a} value={a}>{a}</option>)}</select></td>
                    <td className="py-2 pe-2"><Input value={line.costCenter} onChange={(e) => updateLine(i, "costCenter", e.target.value)} placeholder="مركز التكلفة" /></td>
                    <td className="py-2 pe-2"><Input type="number" value={line.debit || ""} onChange={(e) => updateLine(i, "debit", +e.target.value)} className="font-english" dir="ltr" min={0} placeholder="0" /></td>
                    <td className="py-2 pe-2"><Input type="number" value={line.credit || ""} onChange={(e) => updateLine(i, "credit", +e.target.value)} className="font-english" dir="ltr" min={0} placeholder="0" /></td>
                    <td className="py-2">{formLines.length > 2 && <button onClick={() => removeLine(i)} className="rounded p-1 text-[#EF4444] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
                <tr className="bg-[#F9FAFB]" style={{ fontWeight: 600 }}>
                  <td className="py-2 pe-2 text-sm" colSpan={2}>الإجمالي</td>
                  <td className="py-2 pe-2 text-sm font-english">{totalDebit.toLocaleString()}</td>
                  <td className="py-2 pe-2 text-sm font-english">{totalCredit.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3">
            <Button variant="outline" className="border-[#1276E3] text-[#1276E3]" onClick={addLine}><Plus className="me-1 h-4 w-4" />إضافة سطر</Button>
            <div className={`flex items-center gap-2 rounded-lg px-4 py-2 ${isBalanced ? "bg-[#DCFCE7] text-[#166534]" : totalDebit === 0 && totalCredit === 0 ? "bg-[#F3F4F6] text-[#6B7280]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
              {isBalanced ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span className="text-sm" style={{ fontWeight: 600 }}>{isBalanced ? "متوازن" : "غير متوازن"}</span>
            </div>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  /* ─── List View ─── */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>قيود اليومية</h1><p className="text-[#6B7280] mt-1">إدارة القيود المحاسبية اليومية</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => { resetForm(); setView("create"); }}><Plus className="me-2 h-4 w-4" />قيد جديد</Button>
      </div>

      {/* KPI — Clickable */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div onClick={() => setStatusFilter(null)} className="cursor-pointer">
          <Card className={`border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all ${!statusFilter ? "ring-2 ring-[#1276E3]/20" : ""}`}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي القيود</CardTitle></CardHeader>
            <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{entries.length}</div></CardContent>
          </Card>
        </div>
        <div className="cursor-pointer"><Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي المدين</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{entries.reduce((s, e) => s + totalEntryDebit(e), 0).toLocaleString()} SR</div></CardContent>
        </Card></div>
        <div className="cursor-pointer"><Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي الدائن</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{entries.reduce((s, e) => s + totalEntryCredit(e), 0).toLocaleString()} SR</div></CardContent>
        </Card></div>
        <div onClick={() => setStatusFilter(statusFilter === "مسودة" ? null : "مسودة")} className="cursor-pointer">
          <Card className={`border-[#E5E7EB] hover:shadow-md transition-all ${statusFilter === "مسودة" ? "ring-2 ring-[#F59E0B]/30" : ""}`}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">التوازن</CardTitle></CardHeader>
            <CardContent><div className="text-[#22C55E]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>متوازن ✓</div></CardContent>
          </Card>
        </div>
      </div>

      {/* Table — Fixed alignment */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة قيود اليومية</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
          {statusFilter && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[#6B7280]">تصفية:</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${statusStyle(statusFilter)}`} style={{ fontWeight: 600 }}>
                {statusFilter}
                <button onClick={() => setStatusFilter(null)} className="ms-1 hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "750px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "90px" }}>رقم القيد</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>التاريخ</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>الوصف</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "120px" }}>إجمالي المدين</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "120px" }}>إجمالي الدائن</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "80px" }}>الحالة</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "90px" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-4"><button onClick={() => { setSelected(e); setView("view"); }} className="text-sm font-english text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{e.id}</button></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{e.date}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm text-[#374151]">{e.description}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#374151]" style={{ fontWeight: 500 }}>{totalEntryDebit(e).toLocaleString()}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#374151]" style={{ fontWeight: 500 }}>{totalEntryCredit(e).toLocaleString()}</span></td>
                    <td className="py-3.5 pe-4">
                      <button onClick={() => setStatusFilter(statusFilter === e.status ? null : e.status)}>
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs cursor-pointer transition-colors ${statusStyle(e.status)}`} style={{ fontWeight: 600 }}>{e.status}</span>
                      </button>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelected(e); setView("view"); }} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><MoreVertical className="h-4 w-4" /></button>
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