import { Label } from "../components/ui/label";
import { ContactSearchInput } from "../components/contact-search-input";
import { ItemSearchInput } from "../components/item-search-input";
import { TaxRateSelect } from "../components/tax-rate-select";
import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router";
import {
  FileSpreadsheet, Plus, Search, Eye, Edit2, X, Trash2, ArrowRight,
  Download, Copy, FileText, ChevronDown, ChevronUp, GripVertical,
  BookOpen, Layers, ListChecks, Package, ToggleLeft, ToggleRight,
  Send, Printer, MoreVertical, CheckCircle2, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { useReactToPrint } from "react-to-print";
import { QuotePrintTemplate, type QuoteData } from "../components/quote-print-template";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ─────────────────── Types ─────────────────── */

type TaxMode = "exclusive" | "inclusive";

interface LineItem {
  id: string;
  product: string;
  description: string;
  qty: number;
  price: number;
  taxRate: number;
  taxMode: TaxMode; // per-line: شامل أو مضافة
}

interface SOWItem {
  id: string;
  title: string;
  description: string;
}

interface CoverPage {
  enabled: boolean;
  title: string;
  subtitle: string;
  intro: string;
  companyOverview: string;
}

interface TechnicalProposal {
  enabled: boolean;
  projectOverview: string;
  methodology: string;
  timeline: string;
  deliverables: string;
  assumptions: string;
}

interface Quote {
  id: string;
  client: string;
  clientAddress?: string;
  date: string;
  validUntil: string;
  total: string;
  totalNum: number;
  status: string;
  items: LineItem[];
  sowItems: SOWItem[];
  coverPage: CoverPage;
  technicalProposal: TechnicalProposal;
  notes: string;
  terms: string;
  reference: string;
}

/* ─────────────────── Helpers ─────────────────── */

const uid = () => Math.random().toString(36).slice(2, 9);

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

const clientContactMap: Record<string, string> = {
  "شركة الأمل التجارية": "P-012",
  "مؤسسة النور": "P-003",
  "شركة البناء الحديث": "P-006",
  "شركة التقنية المتقدمة": "P-002",
  "مؤسسة الإبداع الرقمي": "P-003",
};

/** Calculate line totals based on tax mode */
function calcLine(item: LineItem) {
  if (item.taxMode === "inclusive") {
    // price includes tax → base = price / (1 + rate)
    const totalWithTax = item.qty * item.price;
    const base = totalWithTax / (1 + item.taxRate / 100);
    const tax = totalWithTax - base;
    return { base, tax, total: totalWithTax };
  } else {
    // price excludes tax → tax added on top
    const base = item.qty * item.price;
    const tax = base * (item.taxRate / 100);
    return { base, tax, total: base + tax };
  }
}

function calcTotals(items: LineItem[]) {
  let subtotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;
  for (const item of items) {
    const c = calcLine(item);
    subtotal += c.base;
    taxTotal += c.tax;
    grandTotal += c.total;
  }
  return { subtotal, taxTotal, grandTotal };
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─────────────────── Default Data ─────────────────── */

const defaultCover: CoverPage = {
  enabled: false,
  title: "",
  subtitle: "",
  intro: "",
  companyOverview: "",
};

const defaultTech: TechnicalProposal = {
  enabled: false,
  projectOverview: "",
  methodology: "",
  timeline: "",
  deliverables: "",
  assumptions: "",
};

const mkItem = (): LineItem => ({
  id: uid(), product: "", description: "", qty: 1, price: 0, taxRate: 15, taxMode: "exclusive",
});

const mkSOW = (): SOWItem => ({ id: uid(), title: "", description: "" });

const initialQuotes: Quote[] = [
  {
    id: "Q-2026-001", client: "شركة الأمل التجارية", date: "2026-03-01", validUntil: "2026-03-15",
    total: "15,000.00", totalNum: 15000, status: "مرسل", notes: "", terms: "الدفع خلال 14 يوم من تاريخ القبول", reference: "",
    items: [{ id: uid(), product: "استشارات", description: "خدمات استشارية", qty: 1, price: 13043.48, taxRate: 15, taxMode: "exclusive" }],
    sowItems: [{ id: uid(), title: "تحليل الأعمال", description: "دراسة وتحليل شامل لاحتياجات العمل" }],
    coverPage: { ...defaultCover }, technicalProposal: { ...defaultTech },
  },
  {
    id: "Q-2026-002", client: "مؤسسة النور", date: "2026-03-02", validUntil: "2026-03-16",
    total: "8,500.00", totalNum: 8500, status: "مقبول", notes: "", terms: "", reference: "",
    items: [{ id: uid(), product: "تطوير", description: "تطوير موقع إلكتروني", qty: 1, price: 8500, taxRate: 15, taxMode: "inclusive" }],
    sowItems: [], coverPage: { ...defaultCover }, technicalProposal: { ...defaultTech },
  },
  {
    id: "Q-2026-003", client: "شركة البناء الحديث", date: "2026-03-03", validUntil: "2026-03-17",
    total: "25,000.00", totalNum: 25000, status: "مرفوض", notes: "", terms: "", reference: "",
    items: [{ id: uid(), product: "نظام محاسبي", description: "ترخيص نظام محاسبي سحابي", qty: 1, price: 21739.13, taxRate: 15, taxMode: "exclusive" }],
    sowItems: [], coverPage: { ...defaultCover }, technicalProposal: { ...defaultTech },
  },
  {
    id: "Q-2026-004", client: "شركة التقنية المتقدمة", date: "2026-03-04", validUntil: "2026-03-18",
    total: "35,000.00", totalNum: 35000, status: "مسودة", notes: "", terms: "", reference: "",
    items: [
      { id: uid(), product: "خوادم سحابية", description: "اشتراك سنوي", qty: 2, price: 15217.39, taxRate: 15, taxMode: "exclusive" },
    ],
    sowItems: [], coverPage: { ...defaultCover }, technicalProposal: { ...defaultTech },
  },
  {
    id: "Q-2026-005", client: "مؤسسة الإبداع الرقمي", date: "2026-02-28", validUntil: "2026-03-14",
    total: "12,000.00", totalNum: 12000, status: "محوّل لفاتورة", notes: "", terms: "", reference: "",
    items: [{ id: uid(), product: "تصميم UI/UX", description: "تصميم واجهات المستخدم", qty: 1, price: 12000, taxRate: 15, taxMode: "inclusive" }],
    sowItems: [], coverPage: { ...defaultCover }, technicalProposal: { ...defaultTech },
  },
];

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

type View = "list" | "create" | "edit" | "view";

export function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  /* ── Form state ── */
  const [formId, setFormId] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formDate, setFormDate] = useState("2026-03-18");
  const [formValid, setFormValid] = useState("2026-04-01");
  const [formItems, setFormItems] = useState<LineItem[]>([mkItem()]);
  const [formSOW, setFormSOW] = useState<SOWItem[]>([]);
  const [formNotes, setFormNotes] = useState("");
  const [formTerms, setFormTerms] = useState("الدفع خلال 14 يوم من تاريخ قبول العرض");
  const [formRef, setFormRef] = useState("");
  const [formCover, setFormCover] = useState<CoverPage>({ ...defaultCover });
  const [formTech, setFormTech] = useState<TechnicalProposal>({ ...defaultTech });

  /* ── Section toggles ── */
  const [showCover, setShowCover] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [showSOW, setShowSOW] = useState(false);

  const nextId = `Q-2026-${String(quotes.length + 1).padStart(3, "0")}`;

  const { subtotal, taxTotal, grandTotal } = calcTotals(formItems);

  const filtered = quotes.filter((q) => {
    const matchSearch = !searchQuery || q.client.includes(searchQuery) || q.id.includes(searchQuery);
    const matchStatus = !statusFilter || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const resetForm = () => {
    setFormId("");
    setFormClient("");
    setFormDate("2026-03-18");
    setFormValid("2026-04-01");
    setFormItems([mkItem()]);
    setFormSOW([]);
    setFormNotes("");
    setFormTerms("الدفع خلال 14 يوم من تاريخ قبول العرض");
    setFormRef("");
    setFormCover({ ...defaultCover });
    setFormTech({ ...defaultTech });
    setShowCover(false);
    setShowTech(false);
    setShowSOW(false);
  };

  const loadQuoteToForm = (q: Quote) => {
    setFormId(q.id);
    setFormClient(q.client);
    setFormDate(q.date);
    setFormValid(q.validUntil);
    setFormItems(q.items.map(i => ({ ...i })));
    setFormSOW(q.sowItems.map(s => ({ ...s })));
    setFormNotes(q.notes);
    setFormTerms(q.terms);
    setFormRef(q.reference);
    setFormCover({ ...q.coverPage });
    setFormTech({ ...q.technicalProposal });
    setShowCover(q.coverPage.enabled);
    setShowTech(q.technicalProposal.enabled);
    setShowSOW(q.sowItems.length > 0);
  };

  const handleSave = () => {
    const quoteId = formId || nextId;
    const { grandTotal: gt } = calcTotals(formItems);
    const newQ: Quote = {
      id: quoteId, client: formClient, date: formDate, validUntil: formValid,
      total: fmt(gt), totalNum: gt, status: "مسودة",
      items: formItems, sowItems: formSOW, notes: formNotes, terms: formTerms,
      reference: formRef,
      coverPage: { ...formCover, enabled: showCover },
      technicalProposal: { ...formTech, enabled: showTech },
    };

    if (view === "edit") {
      setQuotes((p) => p.map((x) => x.id === quoteId ? { ...newQ, status: x.status } : x));
    } else {
      setQuotes((p) => [...p, newQ]);
    }
    setView("list");
    resetForm();
  };

  const convertToInvoice = (q: Quote) => {
    setQuotes((p) => p.map((x) => x.id === q.id ? { ...x, status: "محوّل لفاتورة" } : x));
  };

  const duplicateQuote = (q: Quote) => {
    const newId = `Q-2026-${String(quotes.length + 1).padStart(3, "0")}`;
    const dup: Quote = { ...q, id: newId, status: "مسودة", date: "2026-03-18", validUntil: "2026-04-01" };
    setQuotes((p) => [...p, dup]);
  };

  /* ── Update helpers ── */
  const updateItem = (idx: number, patch: Partial<LineItem>) =>
    setFormItems((p) => p.map((x, j) => j === idx ? { ...x, ...patch } : x));

  const removeItem = (idx: number) =>
    setFormItems((p) => p.filter((_, j) => j !== idx));

  const updateSOW = (idx: number, patch: Partial<SOWItem>) =>
    setFormSOW((p) => p.map((x, j) => j === idx ? { ...x, ...patch } : x));

  const removeSOW = (idx: number) =>
    setFormSOW((p) => p.filter((_, j) => j !== idx));

  /* ── Print helpers ── */
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: "Quote",
    onAfterPrint: () => resetForm(),
  });

  const handlePDF = () => {
    const currentRef = printRef.current;
    if (currentRef) {
      html2canvas(currentRef).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Quote_${selected?.id}.pdf`);
      });
    }
  };

  /* ═══════════════════════════════════════
     DETAIL VIEW
     ═══════════════════════════════════════ */
  if (view === "view" && selected) {
    const q = selected;
    const totals = calcTotals(q.items);

    return (
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button onClick={() => setView("list")} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
              <X className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                عرض سعر <span className="font-english">{q.id}</span>
              </h1>
              <Link
                to={`/app/contacts/${clientContactMap[q.client] || ""}`}
                className="text-[#6B7280] text-sm hover:text-[#1276E3] hover:underline transition-colors"
              >
                {q.client}
              </Link>
            </div>
            <Badge className={statusStyle(q.status)}>{q.status}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-[#E5E7EB] text-[#374151]" onClick={() => { loadQuoteToForm(q); setView("edit"); }}>
              <Edit2 className="me-2 h-4 w-4" />تعديل
            </Button>
            <Button variant="outline" className="border-[#E5E7EB] text-[#374151]" onClick={() => duplicateQuote(q)}>
              <Copy className="me-2 h-4 w-4" />نسخ
            </Button>
            {q.status === "مقبول" && (
              <Button className="bg-[#22C55E] hover:bg-[#16A34A] text-white" onClick={() => convertToInvoice(q)}>
                <ArrowRight className="me-2 h-4 w-4" />تحويل لفاتورة
              </Button>
            )}
            <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={handlePrint}><Download className="me-2 h-4 w-4" />تصدير</Button>
          </div>
        </div>

        {/* Cover Page Preview */}
        {q.coverPage.enabled && (q.coverPage.title || q.coverPage.intro) && (
          <Card className="border-[#E5E7EB] bg-gradient-to-bl from-[#0B1B49]/5 to-transparent">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#1276E3] mb-2">
                <BookOpen className="h-4 w-4" />
                <span className="text-xs" style={{ fontWeight: 600 }}>صفحة الغلاف</span>
              </div>
              {q.coverPage.title && <h2 className="text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{q.coverPage.title}</h2>}
              {q.coverPage.subtitle && <p className="text-[#6B7280]">{q.coverPage.subtitle}</p>}
              {q.coverPage.intro && <p className="text-sm text-[#374151] leading-relaxed">{q.coverPage.intro}</p>}
              {q.coverPage.companyOverview && (
                <>
                  <Separator />
                  <p className="text-sm text-[#374151] leading-relaxed">{q.coverPage.companyOverview}</p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Technical Proposal Preview */}
        {q.technicalProposal.enabled && (q.technicalProposal.projectOverview || q.technicalProposal.methodology) && (
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-[#179FC5] mb-1">
                <Layers className="h-4 w-4" />
                <span className="text-xs" style={{ fontWeight: 600 }}>العرض الفني</span>
              </div>
              {q.technicalProposal.projectOverview && (
                <div>
                  <h4 className="text-[#0B1B49] mb-1" style={{ fontWeight: 600 }}>نظرة عامة على المشروع</h4>
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{q.technicalProposal.projectOverview}</p>
                </div>
              )}
              {q.technicalProposal.methodology && (
                <div>
                  <h4 className="text-[#0B1B49] mb-1" style={{ fontWeight: 600 }}>المنهجية</h4>
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{q.technicalProposal.methodology}</p>
                </div>
              )}
              {q.technicalProposal.timeline && (
                <div>
                  <h4 className="text-[#0B1B49] mb-1" style={{ fontWeight: 600 }}>الجدول الزمني</h4>
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{q.technicalProposal.timeline}</p>
                </div>
              )}
              {q.technicalProposal.deliverables && (
                <div>
                  <h4 className="text-[#0B1B49] mb-1" style={{ fontWeight: 600 }}>المخرجات</h4>
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{q.technicalProposal.deliverables}</p>
                </div>
              )}
              {q.technicalProposal.assumptions && (
                <div>
                  <h4 className="text-[#0B1B49] mb-1" style={{ fontWeight: 600 }}>الافتراضات والمتطلبات المسبقة</h4>
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{q.technicalProposal.assumptions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SOW Preview */}
        {q.sowItems.length > 0 && (
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#0B1B49] mb-1">
                <ListChecks className="h-4 w-4" />
                <span style={{ fontWeight: 600 }}>نطاق العمل (SOW)</span>
              </div>
              <div className="space-y-3">
                {q.sowItems.map((s, i) => (
                  <div key={s.id} className="rounded-lg border border-[#E5E7EB] p-4 bg-[#F9FAFB]">
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-[#1276E3] text-white text-xs font-english" style={{ fontWeight: 700 }}>{i + 1}</span>
                      <div>
                        <h5 className="text-[#0B1B49] text-sm" style={{ fontWeight: 600 }}>{s.title}</h5>
                        {s.description && <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{s.description}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Data + Totals */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات العرض</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[#6B7280]">رقم:</span> <span className="font-english">{q.id}</span></div>
                <div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{q.date}</span></div>
                <div><span className="text-[#6B7280]">صالح حتى:</span> <span className="font-english">{q.validUntil}</span></div>
                {q.reference && <div><span className="text-[#6B7280]">المرجع:</span> {q.reference}</div>}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>المجاميع</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#6B7280]">الفرعي:</span><span className="font-english">{fmt(totals.subtotal)} SR</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">الضريبة:</span><span className="font-english">{fmt(totals.taxTotal)} SR</span></div>
                <div className="border-t pt-2 flex justify-between" style={{ fontWeight: 700 }}><span>الإجمالي:</span><span className="font-english">{fmt(totals.grandTotal)} SR</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items Table */}
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">البنود</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "700px" }}>
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الصنف</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الوصف</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الكمية</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>السعر</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الضريبة</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>نوع السعر</th>
                    <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((item) => {
                    const c = calcLine(item);
                    return (
                      <tr key={item.id} className="border-b border-[#F3F4F6] last:border-0">
                        <td className="py-2.5 pe-3 text-sm">{item.product}</td>
                        <td className="py-2.5 pe-3 text-sm text-[#6B7280]">{item.description}</td>
                        <td className="py-2.5 pe-3 text-sm font-english">{item.qty}</td>
                        <td className="py-2.5 pe-3 text-sm font-english">{fmt(item.price)}</td>
                        <td className="py-2.5 pe-3 text-sm font-english">{item.taxRate}%</td>
                        <td className="py-2.5 pe-3 text-xs">
                          <span className={`rounded-full px-2 py-0.5 ${item.taxMode === "inclusive" ? "bg-[#DBEAFE] text-[#1E40AF]" : "bg-[#FEF3C7] text-[#92400E]"}`} style={{ fontWeight: 600 }}>
                            {item.taxMode === "inclusive" ? "شامل" : "مضافة"}
                          </span>
                        </td>
                        <td className="py-2.5 text-sm font-english" style={{ fontWeight: 600 }}>{fmt(c.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Notes & Terms */}
        {(q.notes || q.terms) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {q.notes && (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-5">
                  <h4 className="text-[#0B1B49] mb-2" style={{ fontWeight: 600 }}>ملاحظات</h4>
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{q.notes}</p>
                </CardContent>
              </Card>
            )}
            {q.terms && (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-5">
                  <h4 className="text-[#0B1B49] mb-2" style={{ fontWeight: 600 }}>الشروط والأحكام</h4>
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{q.terms}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Hidden Print Template */}
        {selected && (
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <QuotePrintTemplate
              ref={printRef}
              quote={{
                ...selected,
                clientAddress: selected.clientAddress || "",
              }}
            />
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════
     CREATE / EDIT VIEW
     ═══════════════════════════════════════ */
  if (view === "create" || view === "edit") {
    const isEdit = view === "edit";
    return (
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView("list"); resetForm(); }} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
              <X className="h-5 w-5" />
            </button>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {isEdit ? <>تعديل عرض سعر <span className="font-english">{formId}</span></> : "عرض سعر جديد"}
            </h1>
          </div>
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={handleSave}>حفظ العرض</Button>
        </div>

        {/* ── Section Toggles ── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCover(!showCover)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${showCover ? "border-[#1276E3] bg-[#EFF6FF] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]"}`}
            style={{ fontWeight: 500 }}
          >
            <BookOpen className="h-4 w-4" />
            صفحة الغلاف
            {showCover ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setShowTech(!showTech)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${showTech ? "border-[#179FC5] bg-[#F0FDFA] text-[#179FC5]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]"}`}
            style={{ fontWeight: 500 }}
          >
            <Layers className="h-4 w-4" />
            العرض الفني
            {showTech ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => { setShowSOW(!showSOW); if (!showSOW && formSOW.length === 0) setFormSOW([mkSOW()]); }}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${showSOW ? "border-[#0B1B49] bg-[#0B1B49]/5 text-[#0B1B49]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]"}`}
            style={{ fontWeight: 500 }}
          >
            <ListChecks className="h-4 w-4" />
            نطاق العمل (SOW)
            {showSOW ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* ── 1. Client ── */}
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">بيانات العميل</CardTitle></CardHeader>
          <CardContent>
            <ContactSearchInput
              value={formClient}
              onChange={(name) => setFormClient(name)}
              roleFilter="عميل"
              label="اختر أو أنشئ عميل"
              placeholder="اكتب اسم العميل..."
            />
          </CardContent>
        </Card>

        {/* ── 2. Details ── */}
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">التفاصيل</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>رقم العرض</Label>
                <Input
                  value={isEdit ? formId : (formId || nextId)}
                  onChange={(e) => setFormId(e.target.value)}
                  className="font-english"
                  dir="ltr"
                />
                <p className="text-xs text-[#6B7280]">يمكنك تعديل رقم العرض</p>
              </div>
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="font-english" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>صالح حتى</Label>
                <Input type="date" value={formValid} onChange={(e) => setFormValid(e.target.value)} className="font-english" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المرجع (اختياري)</Label>
                <Input value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="رقم مرجع أو طلب شراء..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 3. Cover Page ── */}
        {showCover && (
          <Card className="border-[#1276E3]/30 bg-gradient-to-bl from-[#0B1B49]/[0.02] to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#1276E3]" />
                  <CardTitle className="text-[#0B1B49]">صفحة الغلاف</CardTitle>
                </div>
                <button onClick={() => setShowCover(false)} className="text-[#9CA3AF] hover:text-[#EF4444]"><X className="h-4 w-4" /></button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>عنوان العرض</Label>
                  <Input value={formCover.title} onChange={(e) => setFormCover(p => ({ ...p, title: e.target.value }))} placeholder="عرض سعر — خدمات استشارية" />
                </div>
                <div className="space-y-2">
                  <Label>العنوان الفرعي</Label>
                  <Input value={formCover.subtitle} onChange={(e) => setFormCover(p => ({ ...p, subtitle: e.target.value }))} placeholder="مُقدّم لشركة..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>مقدمة العرض</Label>
                <textarea
                  value={formCover.intro}
                  onChange={(e) => setFormCover(p => ({ ...p, intro: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[80px]"
                  placeholder="نتقدم لكم بهذا العرض..."
                />
              </div>
              <div className="space-y-2">
                <Label>نبذة عن الشركة</Label>
                <textarea
                  value={formCover.companyOverview}
                  onChange={(e) => setFormCover(p => ({ ...p, companyOverview: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[80px]"
                  placeholder="Entix Books هي شركة..."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 4. Technical Proposal ── */}
        {showTech && (
          <Card className="border-[#179FC5]/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-[#179FC5]" />
                  <CardTitle className="text-[#0B1B49]">العرض الفني</CardTitle>
                </div>
                <button onClick={() => setShowTech(false)} className="text-[#9CA3AF] hover:text-[#EF4444]"><X className="h-4 w-4" /></button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>نظرة عامة على المشروع</Label>
                <textarea
                  value={formTech.projectOverview}
                  onChange={(e) => setFormTech(p => ({ ...p, projectOverview: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[80px]"
                  placeholder="وصف عام للمشروع والأهداف..."
                />
              </div>
              <div className="space-y-2">
                <Label>المنهجية</Label>
                <textarea
                  value={formTech.methodology}
                  onChange={(e) => setFormTech(p => ({ ...p, methodology: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[80px]"
                  placeholder="المنهجية المتبعة في التنفيذ..."
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>الجدول الزمني</Label>
                  <textarea
                    value={formTech.timeline}
                    onChange={(e) => setFormTech(p => ({ ...p, timeline: e.target.value }))}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[80px]"
                    placeholder="المرحلة 1: أسبوعين&#10;المرحلة 2: 3 أسابيع..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>المخرجات</Label>
                  <textarea
                    value={formTech.deliverables}
                    onChange={(e) => setFormTech(p => ({ ...p, deliverables: e.target.value }))}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[80px]"
                    placeholder="1. تقرير التحليل&#10;2. النظام المطور..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>الافتراضات والمتطلبات المسبقة</Label>
                <textarea
                  value={formTech.assumptions}
                  onChange={(e) => setFormTech(p => ({ ...p, assumptions: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[60px]"
                  placeholder="يُفترض توفير البيانات خلال أسبوع..."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 5. SOW ── */}
        {showSOW && (
          <Card className="border-[#0B1B49]/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-[#0B1B49]" />
                  <CardTitle className="text-[#0B1B49]">نطاق العمل (SOW)</CardTitle>
                </div>
                <button onClick={() => setShowSOW(false)} className="text-[#9CA3AF] hover:text-[#EF4444]"><X className="h-4 w-4" /></button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {formSOW.map((s, i) => (
                <div key={s.id} className="rounded-lg border border-[#E5E7EB] p-4 bg-[#F9FAFB] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#0B1B49] text-white text-xs font-english" style={{ fontWeight: 700 }}>{i + 1}</span>
                      <Input
                        value={s.title}
                        onChange={(e) => updateSOW(i, { title: e.target.value })}
                        placeholder="عنوان البند"
                        className="border-0 bg-transparent p-0 h-auto text-[#0B1B49] focus-visible:ring-0"
                        style={{ fontWeight: 600 }}
                      />
                    </div>
                    {formSOW.length > 1 && (
                      <button onClick={() => removeSOW(i)} className="text-[#EF4444] hover:bg-red-50 rounded p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  <textarea
                    value={s.description}
                    onChange={(e) => updateSOW(i, { description: e.target.value })}
                    className="w-full rounded border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[50px]"
                    placeholder="وصف تفصيلي لهذا البند..."
                  />
                </div>
              ))}
              <Button variant="outline" className="border-[#0B1B49]/30 text-[#0B1B49]" onClick={() => setFormSOW(p => [...p, mkSOW()])}>
                <Plus className="me-1 h-4 w-4" />إضافة بند عمل
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── 6. Line Items ── */}
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#0B1B49]">المنتجات والخدمات</CardTitle>
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>كل سطر يمكن تحديده شامل أو مضافة للضريبة</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "900px" }}>
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    {["الصنف", "الوصف", "الكمية", "السعر", "الضريبة", "نوع السعر", "المجموع", ""].map((h) => (
                      <th key={h} className="pb-3 pe-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((item, i) => {
                    const c = calcLine(item);
                    return (
                      <tr key={item.id} className="border-b border-[#F3F4F6]">
                        <td className="py-2 pe-2">
                          <ItemSearchInput
                            value={item.product}
                            onChange={(name) => updateItem(i, { product: name })}
                            placeholder="الصنف"
                            className="min-w-[120px]"
                          />
                        </td>
                        <td className="py-2 pe-2">
                          <Input value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="الوصف" className="min-w-[140px]" />
                        </td>
                        <td className="py-2 pe-2">
                          <Input type="number" value={item.qty} onChange={(e) => updateItem(i, { qty: +e.target.value })} className="w-16 font-english" dir="ltr" min={1} />
                        </td>
                        <td className="py-2 pe-2">
                          <Input type="number" value={item.price} onChange={(e) => updateItem(i, { price: +e.target.value })} className="w-28 font-english" dir="ltr" min={0} />
                        </td>
                        <td className="py-2 pe-2">
                          <TaxRateSelect
                            value={item.taxRate}
                            onChange={(rate) => updateItem(i, { taxRate: rate })}
                            className="w-16"
                          />
                        </td>
                        <td className="py-2 pe-2">
                          <button
                            onClick={() => updateItem(i, { taxMode: item.taxMode === "exclusive" ? "inclusive" : "exclusive" })}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors whitespace-nowrap ${
                              item.taxMode === "inclusive"
                                ? "border-[#1276E3] bg-[#EFF6FF] text-[#1276E3]"
                                : "border-[#F59E0B] bg-[#FEF3C7] text-[#92400E]"
                            }`}
                            style={{ fontWeight: 600 }}
                          >
                            {item.taxMode === "inclusive" ? (
                              <><ToggleRight className="h-3.5 w-3.5" />شامل</>
                            ) : (
                              <><ToggleLeft className="h-3.5 w-3.5" />مضافة</>
                            )}
                          </button>
                        </td>
                        <td className="py-2 pe-2">
                          <div className="space-y-0.5">
                            <div className="text-sm font-english" style={{ fontWeight: 600 }}>{fmt(c.total)}</div>
                            {item.taxMode === "inclusive" && item.taxRate > 0 && (
                              <div className="text-[10px] text-[#6B7280] font-english">قبل: {fmt(c.base)} + ض: {fmt(c.tax)}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-2">
                          {formItems.length > 1 && (
                            <button onClick={() => removeItem(i)} className="rounded p-1 text-[#EF4444] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button variant="outline" className="mt-3 border-[#1276E3] text-[#1276E3]" onClick={() => setFormItems(p => [...p, mkItem()])}>
              <Plus className="me-1 h-4 w-4" />إضافة بند
            </Button>
          </CardContent>
        </Card>

        {/* ── 7. Totals ── */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="max-w-sm ms-auto space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#6B7280]">الفرعي:</span><span className="font-english">{fmt(subtotal)} SR</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">الضريبة:</span><span className="font-english">{fmt(taxTotal)} SR</span></div>
              <Separator />
              <div className="flex justify-between text-[#0B1B49]" style={{ fontSize: "1.125rem", fontWeight: 700 }}>
                <span>الإجمالي:</span>
                <span className="font-english">{fmt(grandTotal)} SR</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 8. Notes & Terms ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]">
            <CardHeader><CardTitle className="text-[#0B1B49] text-sm">ملاحظات</CardTitle></CardHeader>
            <CardContent>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[80px]"
                placeholder="ملاحظات إضافية للعميل..."
              />
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB]">
            <CardHeader><CardTitle className="text-[#0B1B49] text-sm">الشروط والأحكام</CardTitle></CardHeader>
            <CardContent>
              <textarea
                value={formTerms}
                onChange={(e) => setFormTerms(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-[var(--input-background)] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none min-h-[80px]"
                placeholder="شروط الدفع والتسليم..."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     LIST VIEW
     ═══════════════════════════════════════ */
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>عروض الأسعار</h1>
          <p className="text-[#6B7280] mt-1">إدارة عروض الأسعار للعملاء</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => { resetForm(); setView("create"); }}>
          <Plus className="me-2 h-4 w-4" />عرض سعر جديد
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div onClick={() => setStatusFilter(null)} className="cursor-pointer">
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
              <div className="font-english text-[#F59E0B]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{quotes.filter(q => q.status === "مرسل").length}</div>
              <p className="text-xs text-[#6B7280] mt-1">في انتظار الرد</p>
            </CardContent>
          </Card>
        </div>
        <div onClick={() => setStatusFilter(statusFilter === "مقبول" ? null : "مقبول")} className="cursor-pointer">
          <Card className={`border-[#E5E7EB] hover:shadow-md hover:border-[#22C55E]/30 transition-all ${statusFilter === "مقبول" ? "ring-2 ring-[#22C55E]/30" : ""}`}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">مقبولة</CardTitle></CardHeader>
            <CardContent>
              <div className="font-english text-[#22C55E]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{quotes.filter(q => q.status === "مقبول").length}</div>
              <p className="text-xs text-[#6B7280] mt-1">تم القبول</p>
            </CardContent>
          </Card>
        </div>
        <div onClick={() => setStatusFilter(null)} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">القيمة الإجمالية</CardTitle></CardHeader>
            <CardContent>
              <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{quotes.reduce((s, q) => s + q.totalNum, 0).toLocaleString()}</div>
              <p className="text-xs text-[#6B7280] mt-1">SR</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Table */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-[#0B1B49]">قائمة عروض الأسعار</CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
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
            <table className="w-full border-collapse" style={{ minWidth: "780px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم العرض</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>العميل</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>صالح حتى</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الإجمالي (SR)</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center"><p className="text-sm text-[#6B7280]">لا توجد عروض مطابقة</p></td></tr>
                ) : (
                  filtered.map((q) => (
                    <tr key={q.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                      <td className="py-3.5 pe-4">
                        <button onClick={() => { setSelected(q); setView("view"); }} className="text-sm font-english text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{q.id}</button>
                      </td>
                      <td className="py-3.5 pe-4">
                        <Link to={`/app/contacts/${clientContactMap[q.client] || ""}`} className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors">{q.client}</Link>
                      </td>
                      <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{q.date}</span></td>
                      <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{q.validUntil}</span></td>
                      <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#374151]" style={{ fontWeight: 600 }}>{q.total}</span></td>
                      <td className="py-3.5 pe-4">
                        <button onClick={() => setStatusFilter(statusFilter === q.status ? null : q.status)}>
                          <span className={`inline-flex rounded-md px-2.5 py-1 text-xs cursor-pointer transition-colors ${statusStyle(q.status)}`} style={{ fontWeight: 600 }}>{q.status}</span>
                        </button>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setSelected(q); setView("view"); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#1276E3] hover:bg-[#EFF6FF] transition-colors" style={{ fontWeight: 500 }}>
                            <Eye className="h-3.5 w-3.5" />عرض
                          </button>
                          <button onClick={() => { loadQuoteToForm(q); setView("edit"); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => duplicateQuote(q)} className="inline-flex items-center rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {q.status === "مقبول" && (
                            <button onClick={() => convertToInvoice(q)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#22C55E] hover:bg-[#DCFCE7] transition-colors" style={{ fontWeight: 500 }}>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => setQuotes(p => p.filter(x => x.id !== q.id))} className="inline-flex items-center rounded-md p-1 text-[#EF4444] hover:bg-[#FEE2E2] transition-colors">
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
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F3F4F6]">
              <p className="text-xs text-[#6B7280]">عرض <span className="font-english">{filtered.length}</span> من <span className="font-english">{quotes.length}</span></p>
              <div className="flex items-center gap-1">
                <button className="rounded-md border border-[#E5E7EB] px-3 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6]" style={{ fontWeight: 500 }}>السابق</button>
                <button className="rounded-md bg-[#1276E3] px-3 py-1 text-xs text-white font-english" style={{ fontWeight: 500 }}>1</button>
                <button className="rounded-md border border-[#E5E7EB] px-3 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6]" style={{ fontWeight: 500 }}>التالي</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}