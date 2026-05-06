import { contactLink } from "../components/contact-map";
import { ContactSearchInput } from "../components/contact-search-input";
import { ItemSearchInput, type CatalogItem } from "../components/item-search-input";
import { AccountSelect } from "../components/account-select";
import { TaxRateSelect } from "../components/tax-rate-select";
import { useState, useRef, useCallback } from "react";
import { Link } from "react-router";
import {
  FileText, Plus, Search, DollarSign, AlertCircle, Eye, Edit2, X, Trash2, Download, Zap,
  Upload, GripVertical, ChevronDown, Paperclip, AlertTriangle, ClipboardPaste, MoreVertical, Copy
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";

// ── Types ──
interface LineItem {
  id: string;
  product: string;
  description: string;
  qty: number;
  price: number;
  discount: number;
  account: string;
  taxRate: number;
  project: string;
}

interface Bill {
  id: string;
  vendor: string;
  date: string;
  dueDate: string;
  amount: string;
  amountNum: number;
  status: string;
  items: LineItem[];
  notes: string;
  currency: string;
  amountsAre: "exclusive" | "inclusive";
}

let lineIdCounter = 200;
const newLineId = () => `BLN-${++lineIdCounter}`;
const emptyLine = (): LineItem => ({ id: newLineId(), product: "", description: "", qty: 0, price: 0, discount: 0, account: "", taxRate: 15, project: "" });
const createEmptyLines = (n: number): LineItem[] => Array.from({ length: n }, () => emptyLine());

const currencies = [
  { code: "SAR", name: "ريال سعودي", flag: "🇸🇦" },
  { code: "USD", name: "دولار أمريكي", flag: "🇺🇸" },
  { code: "EUR", name: "يورو", flag: "🇪🇺" },
  { code: "GBP", name: "جنيه إسترليني", flag: "🇬🇧" },
  { code: "AED", name: "درهم إماراتي", flag: "🇦🇪" },
];

const projects = ["", "مشروع ألفا", "مشروع بيتا", "مشروع جاما", "البنية التحتية"];

const initialBills: Bill[] = [
  { id: "BILL-2026-001", vendor: "شركة المواد الخام", date: "2026-03-01", dueDate: "2026-03-31", amount: "45,000", amountNum: 45000, status: "مدفوعة", items: [{ id: "BL1", product: "مواد خام", description: "حديد وألمنيوم", qty: 1, price: 39130.43, discount: 0, account: "5001", taxRate: 15, project: "" }], notes: "", currency: "SAR", amountsAre: "exclusive" },
  { id: "BILL-2026-002", vendor: "مؤسسة التوريدات", date: "2026-03-05", dueDate: "2026-03-20", amount: "28,500", amountNum: 28500, status: "مرسلة", items: [{ id: "BL2", product: "لوازم مكتبية", description: "أدوات مكتبية متنوعة", qty: 1, price: 24782.61, discount: 0, account: "5006", taxRate: 15, project: "" }], notes: "", currency: "SAR", amountsAre: "exclusive" },
  { id: "BILL-2026-003", vendor: "شركة الإمدادات", date: "2026-03-08", dueDate: "2026-04-08", amount: "15,000", amountNum: 15000, status: "مدفوعة", items: [{ id: "BL3", product: "صيانة معدات", description: "صيانة دورية", qty: 1, price: 13043.48, discount: 0, account: "5005", taxRate: 15, project: "" }], notes: "", currency: "SAR", amountsAre: "exclusive" },
  { id: "BILL-2026-004", vendor: "مؤسسة الخدمات", date: "2026-02-25", dueDate: "2026-03-10", amount: "22,000", amountNum: 22000, status: "متأخرة", items: [{ id: "BL4", product: "جهاز حاسب", description: "سيرفر جديد", qty: 1, price: 19130.43, discount: 0, account: "1203", taxRate: 15, project: "" }], notes: "أصل ثابت", currency: "SAR", amountsAre: "exclusive" },
  { id: "BILL-2026-005", vendor: "شركة التجهيزات", date: "2026-03-10", dueDate: "2026-04-10", amount: "18,500", amountNum: 18500, status: "مسودة", items: [{ id: "BL5", product: "أثاث", description: "مكاتب وكراسي", qty: 5, price: 3217.39, discount: 0, account: "1202", taxRate: 15, project: "" }], notes: "", currency: "SAR", amountsAre: "exclusive" },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "مدفوعة": "bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0]",
    "مرسلة": "bg-[#EFF6FF] text-[#1E40AF] hover:bg-[#DBEAFE]",
    "متأخرة": "bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA]",
    "مسودة": "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]",
  };
  return m[s] || "";
};

type View = "list" | "create" | "view" | "edit";

export function PurchaseBills() {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [view, setView] = useState<View>("list");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Form state
  const [formVendor, setFormVendor] = useState("");
  const [formDate, setFormDate] = useState("2026-03-04");
  const [formDueDate, setFormDueDate] = useState("2026-04-04");
  const [formRef, setFormRef] = useState("");
  const [formCurrency, setFormCurrency] = useState("SAR");
  const [formAmountsAre, setFormAmountsAre] = useState<"exclusive" | "inclusive">("exclusive");
  const [formItems, setFormItems] = useState<LineItem[]>([...createEmptyLines(10)]);
  const [formNotes, setFormNotes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showAssetPrompt, setShowAssetPrompt] = useState<number | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set(["discount", "project"]));
  const [showHiddenCols, setShowHiddenCols] = useState(false);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = bills.filter((b) => {
    const matchSearch = !searchQuery || b.vendor.includes(searchQuery) || b.id.includes(searchQuery);
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Totals
  const activeItems = formItems.filter((i) => i.product || i.description || i.qty > 0 || i.price > 0);
  const computeLineTotal = (item: LineItem) => item.qty * item.price * (1 - item.discount / 100);
  const computeLineTax = (item: LineItem) => {
    const base = computeLineTotal(item);
    if (formAmountsAre === "inclusive") return base - base / (1 + item.taxRate / 100);
    return base * (item.taxRate / 100);
  };
  const computeLineAmount = (item: LineItem) => {
    const base = computeLineTotal(item);
    if (formAmountsAre === "inclusive") return base;
    return base + base * (item.taxRate / 100);
  };

  const subtotal = formAmountsAre === "inclusive"
    ? activeItems.reduce((s, i) => s + computeLineTotal(i) - computeLineTax(i), 0)
    : activeItems.reduce((s, i) => s + computeLineTotal(i), 0);
  const taxTotal = activeItems.reduce((s, i) => s + computeLineTax(i), 0);
  const grandTotal = subtotal + taxTotal;
  const nextId = `BILL-2026-${String(bills.length + 1).padStart(3, "0")}`;

  const resetForm = () => {
    setFormVendor(""); setFormDate("2026-03-04"); setFormDueDate("2026-04-04"); setFormRef("");
    setFormCurrency("SAR"); setFormAmountsAre("exclusive");
    setFormItems([...createEmptyLines(10)]); setFormNotes(""); setAttachments([]);
    setShowAssetPrompt(null); setDuplicateWarning(null); setShowPasteHint(false);
  };

  const checkDuplicate = (vendor: string, date: string, total: number) => {
    const dup = bills.find((b) => b.vendor === vendor && b.date === date && Math.abs(b.amountNum - total) < 1);
    setDuplicateWarning(dup ? `تنبيه: فاتورة مشابهة (${dup.id}) بنفس المورد والتاريخ والمبلغ.` : null);
  };

  const handleSave = (asDraft: boolean) => {
    const newBill: Bill = {
      id: view === "edit" && selectedBill ? selectedBill.id : nextId,
      vendor: formVendor, date: formDate, dueDate: formDueDate,
      amount: grandTotal.toLocaleString(), amountNum: grandTotal,
      status: asDraft ? "مسودة" : "مرسلة", items: activeItems, notes: formNotes,
      currency: formCurrency, amountsAre: formAmountsAre,
    };
    if (view === "edit" && selectedBill) {
      setBills((p) => p.map((b) => b.id === selectedBill.id ? newBill : b));
    } else {
      setBills((p) => [...p, newBill]);
    }
    setView("list"); resetForm();
  };

  const handleEdit = (bill: Bill) => {
    setSelectedBill(bill); setFormVendor(bill.vendor); setFormDate(bill.date); setFormDueDate(bill.dueDate);
    setFormCurrency(bill.currency || "SAR"); setFormAmountsAre(bill.amountsAre || "exclusive");
    const lines = bill.items.map((i) => ({ ...i, id: i.id || newLineId() }));
    while (lines.length < 10) lines.push(emptyLine());
    setFormItems(lines); setFormNotes(bill.notes); setView("edit");
  };

  const addItem = () => setFormItems((p) => [...p, emptyLine()]);
  const removeItem = (i: number) => { if (formItems.length <= 1) return; setFormItems((p) => p.filter((_, idx) => idx !== i)); };
  const updateItem = (i: number, field: keyof LineItem, val: string | number) => {
    setFormItems((p) => p.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === "account" && typeof val === "string" && val.startsWith("12")) setShowAssetPrompt(i);
      return updated;
    }));
  };

  const handleItemSelect = (idx: number, name: string, catalogItem?: CatalogItem) => {
    setFormItems((p) => p.map((item, i) => {
      if (i !== idx) return item;
      if (catalogItem) return { ...item, product: catalogItem.name, description: catalogItem.description, price: catalogItem.price, account: catalogItem.account, taxRate: catalogItem.taxRate, qty: item.qty || 1 };
      return { ...item, product: name };
    }));
  };

  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIndex(idx); };
  const handleDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setDragOverIndex(null); return; }
    setFormItems((prev) => { const next = [...prev]; const [moved] = next.splice(dragIndex, 1); next.splice(idx, 0, moved); return next; });
    setDragIndex(null); setDragOverIndex(null);
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const rows = text.split("\n").filter((r) => r.trim());
    const parsed: Partial<LineItem>[] = [];
    for (const row of rows) {
      const cols = row.split(/\t|,/).map((c) => c.trim());
      if (cols.length >= 2) parsed.push({ id: newLineId(), product: cols[0] || "", description: cols[1] || "", qty: parseFloat(cols[2]) || 1, price: parseFloat(cols[3]) || 0, discount: 0, account: "", taxRate: 15, project: "" });
    }
    if (parsed.length > 0) {
      e.preventDefault();
      setFormItems((prev) => {
        const firstEmpty = prev.findIndex((i) => !i.product && !i.description && i.qty === 0 && i.price === 0);
        const next = [...prev];
        for (let i = 0; i < parsed.length; i++) {
          const target = firstEmpty >= 0 ? firstEmpty + i : next.length;
          if (target < next.length) next[target] = { ...next[target], ...parsed[i] } as LineItem;
          else next.push({ ...emptyLine(), ...parsed[i] } as LineItem);
        }
        return next;
      });
    }
  }, []);

  const toggleColumn = (col: string) => setHiddenCols((prev) => { const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col); return next; });

  /* ─── Detail View ─── */
  if (view === "view" && selectedBill) {
    const b = selectedBill;
    const sub = b.items.reduce((s, i) => s + i.qty * i.price * (1 - (i.discount || 0) / 100), 0);
    const tax = b.items.reduce((s, i) => s + i.qty * i.price * (1 - (i.discount || 0) / 100) * (i.taxRate / 100), 0);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView("list")} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>فاتورة مشتريات <span className="font-english">{b.id}</span></h1>
              <Link to={contactLink(b.vendor)} className="text-[#6B7280] text-sm hover:text-[#1276E3] hover:underline transition-colors">{b.vendor}</Link>
            </div>
            <span className={`inline-flex rounded-md px-2.5 py-1 text-xs ${statusStyle(b.status)}`} style={{ fontWeight: 600 }}>{b.status}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => handleEdit(b)}><Edit2 className="me-2 h-4 w-4" />تعديل</Button>
            <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Download className="me-2 h-4 w-4" />تصدير</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3"><h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات الفاتورة</h3><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-[#6B7280]">رقم:</span> <span className="font-english">{b.id}</span></div><div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{b.date}</span></div><div><span className="text-[#6B7280]">الاستحقاق:</span> <span className="font-english">{b.dueDate}</span></div><div><span className="text-[#6B7280]">العملة:</span> <span className="font-english">{b.currency || "SAR"}</span></div></div></CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3"><h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>المجاميع</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[#6B7280]">الفرعي:</span><span className="font-english">{sub.toLocaleString()} SR</span></div><div className="flex justify-between"><span className="text-[#6B7280]">الضريبة:</span><span className="font-english">{tax.toLocaleString()} SR</span></div><div className="border-t pt-2 flex justify-between" style={{ fontWeight: 700 }}><span>الإجمالي:</span><span className="font-english">{(sub + tax).toLocaleString()} SR</span></div></div></CardContent></Card>
        </div>
        <Card className="border-[#E5E7EB]"><CardHeader><CardTitle className="text-[#0B1B49]">البنود</CardTitle></CardHeader><CardContent>
          <table className="w-full" style={{ minWidth: "600px" }}>
            <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
              {["الصنف", "الوصف", "الكمية", "السعر", "الحساب", "الضريبة %", "المجموع"].map((h) => (
                <th key={h} className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{b.items.map((item, i) => (
              <tr key={i} className="border-b border-[#F3F4F6] last:border-0">
                <td className="py-2.5 pe-3 text-sm">{item.product}</td>
                <td className="py-2.5 pe-3 text-sm text-[#6B7280]">{item.description}</td>
                <td className="py-2.5 pe-3 text-sm font-english">{item.qty}</td>
                <td className="py-2.5 pe-3 text-sm font-english">{item.price.toLocaleString()}</td>
                <td className="py-2.5 pe-3 text-sm font-english">{item.account}</td>
                <td className="py-2.5 pe-3 text-sm font-english">{item.taxRate}%</td>
                <td className="py-2.5 text-sm font-english" style={{ fontWeight: 600 }}>{(item.qty * item.price * (1 - (item.discount || 0) / 100) * (1 + item.taxRate / 100)).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent></Card>
      </div>
    );
  }

  /* ─── Create / Edit View (Xero-like) ─── */
  if (view === "create" || view === "edit") {
    const colDefs = [
      { key: "drag", label: "", width: "32px", alwaysShow: true },
      { key: "item", label: "الصنف", width: "160px", alwaysShow: true },
      { key: "description", label: "الوصف", width: "auto", alwaysShow: true },
      { key: "qty", label: "الكمية", width: "70px", alwaysShow: true },
      { key: "price", label: "السعر", width: "100px", alwaysShow: true },
      { key: "discount", label: "الخصم %", width: "70px", alwaysShow: false },
      { key: "account", label: "الحساب", width: "140px", alwaysShow: true },
      { key: "taxRate", label: "الضريبة", width: "100px", alwaysShow: true },
      { key: "taxAmount", label: "مبلغ الضريبة", width: "90px", alwaysShow: true },
      { key: "project", label: "المشروع", width: "110px", alwaysShow: false },
      { key: "amount", label: `المبلغ ${formCurrency}`, width: "110px", alwaysShow: true },
      { key: "delete", label: "", width: "36px", alwaysShow: true },
    ];
    const visibleCols = colDefs.filter((c) => c.alwaysShow || !hiddenCols.has(c.key));
    const hiddenCount = colDefs.filter((c) => !c.alwaysShow && hiddenCols.has(c.key)).length;

    return (
      <div className="space-y-5" onPaste={handlePaste}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView("list"); resetForm(); }} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {view === "edit" ? `تعديل فاتورة ${selectedBill?.id}` : "فاتورة مشتريات جديدة"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => { setView("list"); resetForm(); }}>إلغاء</Button>
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => handleSave(true)}>حفظ كمسودة</Button>
            <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => handleSave(false)}>إصدار الفاتورة</Button>
          </div>
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="rounded-lg border-2 border-[#F59E0B] bg-[#FEF3C7]/50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" />
            <p className="text-sm text-[#0B1B49] flex-1" style={{ fontWeight: 600 }}>{duplicateWarning}</p>
            <button onClick={() => setDuplicateWarning(null)} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#F3F4F6]">تجاهل</button>
          </div>
        )}

        {/* Form Card */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-6">
            {/* Row 1: Contact, dates, reference */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 lg:grid-cols-5 mb-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>المورد</Label>
                <ContactSearchInput value={formVendor} onChange={(name) => { setFormVendor(name); if (name && formDate) checkDuplicate(name, formDate, grandTotal); }} roleFilter="مورد" placeholder="ابحث عن مورد..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>تاريخ الفاتورة</Label>
                <Input type="date" value={formDate} onChange={(e) => { setFormDate(e.target.value); if (formVendor) checkDuplicate(formVendor, e.target.value, grandTotal); }} className="font-english" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>تاريخ الاستحقاق</Label>
                <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="font-english" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>رقم الفاتورة</Label>
                <div className="flex items-center gap-1">
                  <span className="text-[#6B7280] text-sm">#</span>
                  <Input value={view === "edit" ? selectedBill?.id : nextId} disabled className="font-english bg-[#F9FAFB]" dir="ltr" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>المرجع</Label>
                <Input value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="اختياري" />
              </div>
            </div>

            {/* Currency & Amounts */}
            <div className="flex flex-wrap items-end gap-4 mb-6 pb-6 border-b border-[#E5E7EB]">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>العملة</Label>
                <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none">
                  {currencies.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>المبالغ</Label>
                <select value={formAmountsAre} onChange={(e) => setFormAmountsAre(e.target.value as "exclusive" | "inclusive")} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none">
                  <option value="exclusive">غير شاملة الضريبة</option>
                  <option value="inclusive">شاملة الضريبة</option>
                </select>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
                <thead>
                  <tr className="border-b-2 border-[#E5E7EB]">
                    {visibleCols.map((col) => (
                      <th key={col.key} className="pb-2.5 pe-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: col.width, minWidth: col.width === "auto" ? "120px" : col.width }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((item, i) => {
                    const lineTax = computeLineTax(item);
                    const lineAmount = computeLineAmount(item);
                    const isActive = item.product || item.description || item.qty > 0 || item.price > 0;
                    return (
                      <tr key={item.id} className={`border-b border-[#F3F4F6] transition-colors ${dragOverIndex === i ? "bg-[#EFF6FF]" : isActive ? "bg-white" : "bg-[#FAFBFC]"}`}
                        draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDrop={() => handleDrop(i)} onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}>
                        {visibleCols.some((c) => c.key === "drag") && (<td className="py-1.5 pe-1 cursor-grab"><GripVertical className="h-4 w-4 text-[#D1D5DB] hover:text-[#9CA3AF]" /></td>)}
                        {visibleCols.some((c) => c.key === "item") && (<td className="py-1.5 pe-2"><ItemSearchInput value={item.product} onChange={(name, cat) => handleItemSelect(i, name, cat)} placeholder="ابحث عن صنف..." className="min-w-[140px]" /></td>)}
                        {visibleCols.some((c) => c.key === "description") && (<td className="py-1.5 pe-2"><input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="الوصف" className="w-full rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20" /></td>)}
                        {visibleCols.some((c) => c.key === "qty") && (<td className="py-1.5 pe-2"><input type="number" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", +e.target.value)} className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm font-english text-center focus:border-[#1276E3] focus:outline-none" dir="ltr" min={0} /></td>)}
                        {visibleCols.some((c) => c.key === "price") && (<td className="py-1.5 pe-2"><input type="number" value={item.price || ""} onChange={(e) => updateItem(i, "price", +e.target.value)} className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm font-english text-end focus:border-[#1276E3] focus:outline-none" dir="ltr" min={0} /></td>)}
                        {visibleCols.some((c) => c.key === "discount") && (<td className="py-1.5 pe-2"><input type="number" value={item.discount || ""} onChange={(e) => updateItem(i, "discount", +e.target.value)} className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm font-english text-center focus:border-[#1276E3] focus:outline-none" dir="ltr" min={0} max={100} placeholder="%" /></td>)}
                        {visibleCols.some((c) => c.key === "account") && (<td className="py-1.5 pe-2"><AccountSelect value={item.account} onChange={(code) => updateItem(i, "account", code)} placeholder="حساب" className="min-w-[130px]" filterCategories={["المصروفات", "الأصول"]} /></td>)}
                        {visibleCols.some((c) => c.key === "taxRate") && (<td className="py-1.5 pe-2"><TaxRateSelect value={item.taxRate} onChange={(rate) => updateItem(i, "taxRate", rate)} type="purchases" className="min-w-[80px]" /></td>)}
                        {visibleCols.some((c) => c.key === "taxAmount") && (<td className="py-1.5 pe-2 text-end"><span className="text-sm font-english text-[#6B7280]">{isActive ? lineTax.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ""}</span></td>)}
                        {visibleCols.some((c) => c.key === "project") && (<td className="py-1.5 pe-2"><select value={item.project} onChange={(e) => updateItem(i, "project", e.target.value)} className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm focus:border-[#1276E3] focus:outline-none">{projects.map((p) => <option key={p} value={p}>{p || "—"}</option>)}</select></td>)}
                        {visibleCols.some((c) => c.key === "amount") && (<td className="py-1.5 pe-2 text-end"><span className="text-sm font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{isActive ? lineAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ""}</span></td>)}
                        {visibleCols.some((c) => c.key === "delete") && (<td className="py-1.5">{isActive && (<button onClick={() => removeItem(i)} className="rounded p-1 text-[#D1D5DB] hover:text-[#EF4444] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>)}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Asset prompt */}
            {showAssetPrompt !== null && (
              <div className="mt-3 rounded-lg border-2 border-[#F59E0B] bg-[#FEF3C7]/50 p-4 flex items-center gap-3">
                <Zap className="h-5 w-5 text-[#F59E0B] shrink-0" />
                <div className="flex-1"><p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>هذا البند يبدو كأصل ثابت.</p><p className="text-xs text-[#6B7280]">الحساب المختار تحت فئة الأصول الثابتة</p></div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#1276E3] text-white" onClick={() => setShowAssetPrompt(null)}>نعم، سجّل كأصل</Button>
                  <Button size="sm" variant="outline" className="border-[#E5E7EB]" onClick={() => setShowAssetPrompt(null)}>تخطي</Button>
                </div>
              </div>
            )}

            {/* Actions row */}
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#F3F4F6]">
              <div className="flex items-center gap-1">
                <button onClick={addItem} className="rounded-md border border-[#1276E3] bg-white px-3 py-1.5 text-xs text-[#1276E3] hover:bg-[#EFF6FF]" style={{ fontWeight: 600 }}>إضافة سطر</button>
                <button onClick={() => { for (let i = 0; i < 5; i++) addItem(); }} className="rounded-md border border-[#E5E7EB] bg-white p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><ChevronDown className="h-3.5 w-3.5" /></button>
              </div>
              <div className="relative">
                <button onClick={() => setShowHiddenCols(!showHiddenCols)} className="rounded-md border border-[#22C55E] bg-white px-3 py-1.5 text-xs text-[#22C55E] hover:bg-[#F0FDF4]" style={{ fontWeight: 600 }}>الأعمدة ({hiddenCount} مخفية) <ChevronDown className="h-3 w-3 inline ms-1" /></button>
                {showHiddenCols && (
                  <div className="absolute z-40 mt-1 w-48 rounded-lg border border-[#E5E7EB] bg-white shadow-lg p-2">
                    {colDefs.filter((c) => !c.alwaysShow).map((col) => (
                      <label key={col.key} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-[#F9FAFB] cursor-pointer">
                        <input type="checkbox" checked={!hiddenCols.has(col.key)} onChange={() => toggleColumn(col.key)} className="rounded border-[#E5E7EB]" />
                        <span className="text-sm text-[#374151]">{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="rounded-md border border-[#1276E3] bg-white px-3 py-1.5 text-xs text-[#1276E3] hover:bg-[#EFF6FF] flex items-center gap-1" style={{ fontWeight: 600 }}><Paperclip className="h-3.5 w-3.5" />ملفات {attachments.length > 0 && <span className="font-english">({attachments.length})</span>}</button>
              <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(e) => { if (e.target.files) setAttachments((p) => [...p, ...Array.from(e.target.files!).map((f) => f.name)]); }} />
              <button onClick={() => setShowPasteHint(!showPasteHint)} className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#F3F4F6] flex items-center gap-1" style={{ fontWeight: 500 }}><ClipboardPaste className="h-3.5 w-3.5" />لصق ذكي</button>
            </div>

            {showPasteHint && (
              <div className="mt-3 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] p-4">
                <div className="flex items-start gap-3">
                  <ClipboardPaste className="h-5 w-5 text-[#1276E3] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>اللصق الذكي</p>
                    <p className="text-xs text-[#6B7280] mt-1">انسخ من Excel (Tab أو فاصلة) واضغط Ctrl+V. الترتيب: الصنف، الوصف، الكمية، السعر.</p>
                  </div>
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((file, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-xs text-[#374151]">
                    <Paperclip className="h-3 w-3 text-[#9CA3AF]" />{file}<button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-[#9CA3AF] hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const files = Array.from(e.dataTransfer.files); setAttachments((prev) => [...prev, ...files.map((f) => f.name)]); }}
              className="mt-4 rounded-lg border-2 border-dashed border-[#E5E7EB] p-4 text-center hover:border-[#1276E3]/40 transition-colors">
              <Upload className="h-5 w-5 text-[#9CA3AF] mx-auto mb-1" />
              <p className="text-xs text-[#9CA3AF]">اسحب ملفات هنا أو <button onClick={() => fileInputRef.current?.click()} className="text-[#1276E3] hover:underline">تصفح</button></p>
            </div>

            {/* Totals */}
            <div className="flex justify-end mt-6">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#6B7280]">المجموع الفرعي:</span><span className="font-english">{subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">الضريبة:</span><span className="font-english">{taxTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                <div className="border-t border-[#E5E7EB] pt-2 flex justify-between text-[#0B1B49]" style={{ fontWeight: 700, fontSize: "1.125rem" }}><span>الإجمالي:</span><span className="font-english">{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="ملاحظات..."
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm min-h-[80px] focus:border-[#1276E3] focus:outline-none focus:ring-2 focus:ring-[#1276E3]/20" />
          </div>
        </CardContent></Card>
      </div>
    );
  }

  /* ─── List View ─── */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>فواتير المشتريات</h1><p className="text-[#6B7280] mt-1">إدارة فواتير الشراء من الموردين</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => { resetForm(); setView("create"); }}><Plus className="me-2 h-4 w-4" />فاتورة شراء جديدة</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div onClick={() => setStatusFilter(null)} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-[#6B7280]">مشتريات الشهر</CardTitle><DollarSign className="h-4 w-4 text-[#6B7280]" /></CardHeader>
            <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>129,000 SR</div><p className="text-xs text-[#6B7280] mt-1">5 فواتير هذا الشهر</p></CardContent>
          </Card>
        </div>
        <div onClick={() => setStatusFilter(statusFilter === "متأخرة" ? null : "متأخرة")} className="cursor-pointer">
          <Card className={`border-[#E5E7EB] hover:shadow-md hover:border-[#EF4444]/30 transition-all ${statusFilter === "متأخرة" ? "ring-2 ring-[#EF4444]/20" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-[#6B7280]">غير المدفوعة</CardTitle><AlertCircle className="h-4 w-4 text-[#EF4444]" /></CardHeader>
            <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>69,000 SR</div><p className="text-xs text-[#6B7280] mt-1">3 فواتير معلقة أو متأخرة</p></CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة فواتير المشتريات</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
          {statusFilter && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[#6B7280]">تصفية:</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${statusStyle(statusFilter)}`} style={{ fontWeight: 600 }}>
                {statusFilter}<button onClick={() => setStatusFilter(null)} className="ms-1 hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "800px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-4 text-start" style={{ width: "40px" }}><Checkbox /></th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "140px" }}>رقم الفاتورة</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>المورد</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>التاريخ</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>الاستحقاق</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>المبلغ (SR)</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "90px" }}>الحالة</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "100px" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-4"><Checkbox /></td>
                    <td className="py-3.5 pe-4">
                      <button onClick={() => { setSelectedBill(b); setView("view"); }} className="text-sm font-english text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{b.id}</button>
                    </td>
                    <td className="py-3.5 pe-4">
                      <Link to={contactLink(b.vendor)} className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors">{b.vendor}</Link>
                    </td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{b.date}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{b.dueDate}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#374151]" style={{ fontWeight: 600 }}>{b.amount}</span></td>
                    <td className="py-3.5 pe-4">
                      <button onClick={() => setStatusFilter(statusFilter === b.status ? null : b.status)}>
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs cursor-pointer transition-colors ${statusStyle(b.status)}`} style={{ fontWeight: 600 }}>{b.status}</span>
                      </button>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedBill(b); setView("view"); }} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><MoreVertical className="h-4 w-4" /></button>
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