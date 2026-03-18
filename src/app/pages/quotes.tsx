import { Label } from "../components/ui/label";
import { ContactSearchInput } from "../components/contact-search-input";
import { ItemSearchInput } from "../components/item-search-input";
import { TaxRateSelect } from "../components/tax-rate-select";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FileSpreadsheet, Plus, Search, Eye, Edit2, X, Trash2, ArrowRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

interface LineItem { product: string; description: string; qty: number; price: number; taxRate: number; }
interface Quote { id: string; client: string; date: string; validUntil: string; total: string; totalNum: number; status: string; items: LineItem[]; notes: string; }

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "مسودة": "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]",
    "مرسل": "bg-[#EFF6FF] text-[#1E40AF] hover:bg-[#DBEAFE]",
    "مقبول": "bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0]",
    "مرفوض": "bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA]",
    "محوّل لفاتورة": "bg-[#DBEAFE] text-[#1E40AF] hover:bg-[#BFDBFE]",
  };
  return m[s] || "";
};

// Status → filter param
const statusFilterParam: Record<string, string> = {
  "مسودة": "draft",
  "مرسل": "sent",
  "مقبول": "accepted",
  "مرفوض": "rejected",
  "محوّل لفاتورة": "converted",
};

// Client → Contact ID mapping
const clientContactMap: Record<string, string> = {
  "شركة الأمل التجارية": "P-012",
  "مؤسسة النور": "P-003",
  "شركة البناء الحديث": "P-006",
  "شركة التقنية المتقدمة": "P-002",
  "مؤسسة الإبداع الرقمي": "P-003",
};

const initialQuotes: Quote[] = [
  { id: "Q-2026-001", client: "شركة الأمل التجارية", date: "2026-03-01", validUntil: "2026-03-15", total: "15,000", totalNum: 15000, status: "مرسل", items: [{ product: "استشارات", description: "خدمات استشارية", qty: 1, price: 13043.48, taxRate: 15 }], notes: "" },
  { id: "Q-2026-002", client: "مؤسسة النور", date: "2026-03-02", validUntil: "2026-03-16", total: "8,500", totalNum: 8500, status: "مقبول", items: [{ product: "تطوير", description: "تطوير موقع", qty: 1, price: 7391.30, taxRate: 15 }], notes: "" },
  { id: "Q-2026-003", client: "شركة البناء الحديث", date: "2026-03-03", validUntil: "2026-03-17", total: "25,000", totalNum: 25000, status: "مرفوض", items: [{ product: "نظام", description: "نظام محاسبي", qty: 1, price: 21739.13, taxRate: 15 }], notes: "" },
  { id: "Q-2026-004", client: "شركة التقنية المتقدمة", date: "2026-03-04", validUntil: "2026-03-18", total: "35,000", totalNum: 35000, status: "مسودة", items: [{ product: "خوادم", description: "خوادم سحابية", qty: 2, price: 15217.39, taxRate: 15 }], notes: "" },
  { id: "Q-2026-005", client: "مؤسسة الإبداع الرقمي", date: "2026-02-28", validUntil: "2026-03-14", total: "12,000", totalNum: 12000, status: "محوّل لفاتورة", items: [{ product: "تصميم", description: "تصميم UI/UX", qty: 1, price: 10434.78, taxRate: 15 }], notes: "" },
];

type View = "list" | "create" | "view";

export function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [formClient, setFormClient] = useState("");
  const [formDate, setFormDate] = useState("2026-03-04");
  const [formValid, setFormValid] = useState("2026-03-18");
  const [formItems, setFormItems] = useState<LineItem[]>([{ product: "", description: "", qty: 1, price: 0, taxRate: 15 }]);
  const [formNotes, setFormNotes] = useState("");

  const subtotal = formItems.reduce((s, i) => s + i.qty * i.price, 0);
  const taxTotal = formItems.reduce((s, i) => s + i.qty * i.price * (i.taxRate / 100), 0);
  const grandTotal = subtotal + taxTotal;
  const nextId = `Q-2026-${String(quotes.length + 1).padStart(3, "0")}`;

  const filtered = quotes.filter((q) => {
    const matchSearch = !searchQuery || q.client.includes(searchQuery) || q.id.includes(searchQuery);
    const matchStatus = !statusFilter || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const resetForm = () => { setFormClient(""); setFormDate("2026-03-04"); setFormValid("2026-03-18"); setFormItems([{ product: "", description: "", qty: 1, price: 0, taxRate: 15 }]); setFormNotes(""); };

  const handleSave = () => {
    const newQ: Quote = { id: nextId, client: formClient, date: formDate, validUntil: formValid, total: grandTotal.toLocaleString(), totalNum: grandTotal, status: "مسودة", items: formItems, notes: formNotes };
    setQuotes((p) => [...p, newQ]); setView("list"); resetForm();
  };

  const convertToInvoice = (q: Quote) => { setQuotes((p) => p.map((x) => x.id === q.id ? { ...x, status: "محوّل لفاتورة" } : x)); };

  // ── Detail View ──
  if (view === "view" && selected) {
    const q = selected;
    const sub = q.items.reduce((s, i) => s + i.qty * i.price, 0);
    const tax = q.items.reduce((s, i) => s + i.qty * i.price * (i.taxRate / 100), 0);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView("list")} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>عرض سعر <span className="font-english">{q.id}</span></h1>
              <Link
                to={`/contacts/${clientContactMap[q.client] || ""}`}
                className="text-[#6B7280] text-sm hover:text-[#1276E3] hover:underline transition-colors"
              >
                {q.client}
              </Link>
            </div>
            <Badge className={statusStyle(q.status)}>{q.status}</Badge>
          </div>
          <div className="flex gap-2">
            {q.status === "مقبول" && <Button className="bg-[#22C55E] hover:bg-[#16A34A] text-white" onClick={() => convertToInvoice(q)}><ArrowRight className="me-2 h-4 w-4" />تحويل لفاتورة</Button>}
            <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Download className="me-2 h-4 w-4" />تصدير</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3"><h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات العرض</h3><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-[#6B7280]">رقم:</span> <span className="font-english">{q.id}</span></div><div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{q.date}</span></div><div><span className="text-[#6B7280]">صالح حتى:</span> <span className="font-english">{q.validUntil}</span></div></div></CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3"><h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>المجاميع</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[#6B7280]">الفرعي:</span><span className="font-english">{sub.toLocaleString()} SR</span></div><div className="flex justify-between"><span className="text-[#6B7280]">الضريبة:</span><span className="font-english">{tax.toLocaleString()} SR</span></div><div className="border-t pt-2 flex justify-between" style={{ fontWeight: 700 }}><span>الإجمالي:</span><span className="font-english">{(sub + tax).toLocaleString()} SR</span></div></div></CardContent></Card>
        </div>
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">البنود</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full" style={{ minWidth: "500px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الصنف</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الوصف</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الكمية</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>السعر</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المجموع</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((item, i) => (
                  <tr key={i} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="py-2.5 pe-3 text-sm">{item.product}</td>
                    <td className="py-2.5 pe-3 text-sm text-[#6B7280]">{item.description}</td>
                    <td className="py-2.5 pe-3 text-sm font-english">{item.qty}</td>
                    <td className="py-2.5 pe-3 text-sm font-english">{item.price.toLocaleString()}</td>
                    <td className="py-2.5 text-sm font-english" style={{ fontWeight: 600 }}>{(item.qty * item.price * (1 + item.taxRate / 100)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Create View ──
  if (view === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView("list"); resetForm(); }} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>عرض سعر جديد</h1>
          </div>
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={handleSave}>حفظ العرض</Button>
        </div>
        <Card className="border-[#E5E7EB]"><CardHeader><CardTitle className="text-[#0B1B49]">بيانات العميل</CardTitle></CardHeader><CardContent>
          <ContactSearchInput
            value={formClient}
            onChange={(name) => setFormClient(name)}
            roleFilter="عميل"
            label="اختر أو أنشئ عميل"
            placeholder="اكتب اسم العميل..."
          />
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardHeader><CardTitle className="text-[#0B1B49]">التفاصيل</CardTitle></CardHeader><CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>رقم العرض</Label><Input value={nextId} disabled className="font-english bg-[#F3F4F6]" dir="ltr" /></div>
            <div className="space-y-2"><Label>التاريخ</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="font-english" dir="ltr" /></div>
            <div className="space-y-2"><Label>صالح حتى</Label><Input type="date" value={formValid} onChange={(e) => setFormValid(e.target.value)} className="font-english" dir="ltr" /></div>
          </div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardHeader><CardTitle className="text-[#0B1B49]">البنود</CardTitle></CardHeader><CardContent>
          <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-[#E5E7EB]">{["الصنف", "الوصف", "الكمية", "السعر", "الضريبة %", "المجموع", ""].map((h) => <th key={h} className="pb-3 pe-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>)}</tr></thead><tbody>
            {formItems.map((item, i) => (<tr key={i} className="border-b border-[#F3F4F6]">
              <td className="py-2 pe-2"><ItemSearchInput
                value={item.product}
                onChange={(name) => setFormItems((p) => p.map((x, j) => j === i ? { ...x, product: name } : x))}
                placeholder="الصنف"
                className="min-w-[120px]"
              /></td>
              <td className="py-2 pe-2"><Input value={item.description} onChange={(e) => setFormItems((p) => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="الوصف" className="min-w-[140px]" /></td>
              <td className="py-2 pe-2"><Input type="number" value={item.qty} onChange={(e) => setFormItems((p) => p.map((x, j) => j === i ? { ...x, qty: +e.target.value } : x))} className="w-16 font-english" dir="ltr" min={1} /></td>
              <td className="py-2 pe-2"><Input type="number" value={item.price} onChange={(e) => setFormItems((p) => p.map((x, j) => j === i ? { ...x, price: +e.target.value } : x))} className="w-24 font-english" dir="ltr" min={0} /></td>
              <td className="py-2 pe-2"><TaxRateSelect
                value={item.taxRate}
                onChange={(rate) => setFormItems((p) => p.map((x, j) => j === i ? { ...x, taxRate: rate } : x))}
                className="w-16"
              /></td>
              <td className="py-2 pe-2 text-sm font-english" style={{ fontWeight: 500 }}>{(item.qty * item.price * (1 + item.taxRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="py-2">{formItems.length > 1 && <button onClick={() => setFormItems((p) => p.filter((_, j) => j !== i))} className="rounded p-1 text-[#EF4444] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}</td>
            </tr>))}
          </tbody></table></div>
          <Button variant="outline" className="mt-3 border-[#1276E3] text-[#1276E3]" onClick={() => setFormItems((p) => [...p, { product: "", description: "", qty: 1, price: 0, taxRate: 15 }])}><Plus className="me-1 h-4 w-4" />إضافة بند</Button>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5"><div className="max-w-xs ms-auto space-y-2 text-sm"><div className="flex justify-between"><span className="text-[#6B7280]">الفرعي:</span><span className="font-english">{subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} SR</span></div><div className="flex justify-between"><span className="text-[#6B7280]">الضريبة:</span><span className="font-english">{taxTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} SR</span></div><div className="border-t pt-2 flex justify-between" style={{ fontWeight: 700 }}><span>الإجمالي:</span><span className="font-english">{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} SR</span></div></div></CardContent></Card>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>عروض الأسعار</h1>
          <p className="text-[#6B7280] mt-1">إدارة عروض الأسعار للعملاء</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => { resetForm(); setView("create"); }}>
          <Plus className="me-2 h-4 w-4" />
          عرض سعر جديد
        </Button>
      </div>

      {/* KPI Cards — ALL Clickable */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div onClick={() => { setStatusFilter(null); }} className="cursor-pointer">
          <Card className={`border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all ${!statusFilter ? "ring-2 ring-[#1276E3]/20" : ""}`}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي العروض</CardTitle></CardHeader>
            <CardContent>
              <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{quotes.length}</div>
              <p className="text-xs text-[#6B7280] mt-1">عرض سعر</p>
            </CardContent>
          </Card>
        </div>

        <div onClick={() => setStatusFilter(statusFilter === "مرسل" ? null : "مرسل")} className="cursor-pointer">
          <Card className={`border-[#E5E7EB] hover:shadow-md hover:border-[#F59E0B]/30 transition-all ${statusFilter === "مرسل" ? "ring-2 ring-[#F59E0B]/30" : ""}`}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">معلقة</CardTitle></CardHeader>
            <CardContent>
              <div className="font-english text-[#F59E0B]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{quotes.filter((q) => q.status === "مرسل").length}</div>
              <p className="text-xs text-[#6B7280] mt-1">في انتظار الرد</p>
            </CardContent>
          </Card>
        </div>

        <div onClick={() => setStatusFilter(statusFilter === "مقبول" ? null : "مقبول")} className="cursor-pointer">
          <Card className={`border-[#E5E7EB] hover:shadow-md hover:border-[#22C55E]/30 transition-all ${statusFilter === "مقبول" ? "ring-2 ring-[#22C55E]/30" : ""}`}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">مقبولة</CardTitle></CardHeader>
            <CardContent>
              <div className="font-english text-[#22C55E]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{quotes.filter((q) => q.status === "مقبول").length}</div>
              <p className="text-xs text-[#6B7280] mt-1">تم القبول</p>
            </CardContent>
          </Card>
        </div>

        <div onClick={() => { setStatusFilter(null); }} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">القيمة الإجمالية</CardTitle></CardHeader>
            <CardContent>
              <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{quotes.reduce((s, q) => s + q.totalNum, 0).toLocaleString()}</div>
              <p className="text-xs text-[#6B7280] mt-1">SR — قيمة جميع العروض</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Table Card */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة عروض الأسعار</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>
          {/* Status filter indicator */}
          {statusFilter && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[#6B7280]">تصفية حسب:</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${statusStyle(statusFilter)}`} style={{ fontWeight: 600 }}>
                {statusFilter}
                <button onClick={() => setStatusFilter(null)} className="ms-1 hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "780px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "120px" }}>رقم العرض</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>العميل</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>التاريخ</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>صالح حتى</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>الإجمالي (SR)</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>الحالة</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "100px" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <p className="text-sm text-[#6B7280]">لا توجد عروض مطابقة</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((q) => (
                    <tr key={q.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                      {/* Quote ID — clickable */}
                      <td className="py-3.5 pe-4">
                        <button
                          onClick={() => { setSelected(q); setView("view"); }}
                          className="text-sm font-english text-[#1276E3] hover:underline"
                          style={{ fontWeight: 600 }}
                        >
                          {q.id}
                        </button>
                      </td>
                      {/* Client — clickable to contact */}
                      <td className="py-3.5 pe-4">
                        <Link
                          to={`/contacts/${clientContactMap[q.client] || ""}`}
                          className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors"
                        >
                          {q.client}
                        </Link>
                      </td>
                      {/* Date */}
                      <td className="py-3.5 pe-4">
                        <span className="text-sm font-english text-[#6B7280]">{q.date}</span>
                      </td>
                      {/* Valid Until */}
                      <td className="py-3.5 pe-4">
                        <span className="text-sm font-english text-[#6B7280]">{q.validUntil}</span>
                      </td>
                      {/* Total */}
                      <td className="py-3.5 pe-4">
                        <span className="text-sm font-english text-[#374151]" style={{ fontWeight: 600 }}>{q.total}</span>
                      </td>
                      {/* Status — clickable to filter */}
                      <td className="py-3.5 pe-4">
                        <button onClick={() => setStatusFilter(statusFilter === q.status ? null : q.status)}>
                          <span className={`inline-flex rounded-md px-2.5 py-1 text-xs cursor-pointer transition-colors ${statusStyle(q.status)}`} style={{ fontWeight: 600 }}>
                            {q.status}
                          </span>
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setSelected(q); setView("view"); }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#1276E3] hover:bg-[#EFF6FF] transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            عرض
                          </button>
                          {q.status === "مقبول" && (
                            <button
                              onClick={() => convertToInvoice(q)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#22C55E] hover:bg-[#DCFCE7] transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setQuotes((p) => p.filter((x) => x.id !== q.id))}
                            className="inline-flex items-center rounded-md p-1 text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F3F4F6]">
              <p className="text-xs text-[#6B7280]">عرض <span className="font-english">{filtered.length}</span> من <span className="font-english">{quotes.length}</span> عرض</p>
              <div className="flex items-center gap-1">
                <button className="rounded-md border border-[#E5E7EB] px-3 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>السابق</button>
                <button className="rounded-md bg-[#1276E3] px-3 py-1 text-xs text-white font-english" style={{ fontWeight: 500 }}>1</button>
                <button className="rounded-md border border-[#E5E7EB] px-3 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>التالي</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}