import { useState, useRef, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  FileText, Plus, Search, DollarSign, AlertCircle, Eye, Edit2, X, Trash2, Printer, Download,
  Upload, GripVertical, ChevronDown, Paperclip, AlertTriangle, ClipboardPaste,
  Palette, Image, FileImage, FileSpreadsheet, File, FolderOpen, CheckCircle2, XCircle,
  Scan, Sparkles, MoreVertical, Filter, Copy, TrendingUp,
  User, Mail, Phone, MapPin, Building, Hash, Briefcase, Calendar, CreditCard, MessageSquare, History, Clock, Tag, Link2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { contactLink } from "../components/contact-map";
import { ContactSearchInput } from "../components/contact-search-input";
import { ItemSearchInput, type CatalogItem } from "../components/item-search-input";
import { AccountSelect } from "../components/account-select";
import { TaxRateSelect } from "../components/tax-rate-select";

/* ════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════ */
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

interface Attachment {
  name: string;
  size: string;
  type: "pdf" | "image" | "excel" | "doc" | "other";
  category: "فاتورة" | "عقد" | "إيصال" | "أخرى";
  uploadedAt: string;
  ocrStatus?: "pending" | "processing" | "done" | "failed";
  ocrData?: Partial<LineItem>[];
}

interface BrandingTheme {
  id: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  layout: "standard" | "professional" | "minimal" | "modern";
  showLogo: boolean;
  showPaymentDetails: boolean;
  footerText: string;
}

interface DuplicateMatch {
  invoiceId: string;
  customer: string;
  date: string;
  amount: number;
  matchType: "exact_number" | "same_day_amount" | "similar_amount";
  confidence: number;
}

interface Invoice {
  id: string;
  customer: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  amountNum: number;
  status: string;
  items: LineItem[];
  notes: string;
  paymentTerms: string;
  reference: string;
  currency: string;
  amountsAre: "exclusive" | "inclusive";
  brandingThemeId?: string;
  attachments?: Attachment[];
}

/* ════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════ */
let lineIdCounter = 100;
const newLineId = () => `LN-${++lineIdCounter}`;
const emptyLine = (): LineItem => ({
  id: newLineId(), product: "", description: "", qty: 0, price: 0, discount: 0, account: "", taxRate: 15, project: "",
});
const createEmptyLines = (count: number): LineItem[] => Array.from({ length: count }, () => emptyLine());

/* ── Currency display: SR for in-app (SAMA standard — symbol always LEFT of number) ── */
const CUR = "SR"; // In-app default; settings can override per context

/* ── Account lookup (code → name) for detail view ── */
const accountMap: Record<string, string> = {
  "4000": "بيع بضائع", "4001": "إيرادات المبيعات", "4002": "إيرادات أخرى",
  "4100": "إيرادات خدمات", "4200": "إيرادات متنوعة", "4300": "مردودات ومسموحات",
  "5001": "تكلفة المبيعات", "5002": "الرواتب والأجور", "5003": "الإيجار",
  "1101": "النقدية", "1102": "البنك", "1103": "الذمم المدينة",
  "1201": "المعدات", "1202": "الأثاث", "1203": "أجهزة الحاسب", "1204": "المركبات",
};
const acctLabel = (code: string) => accountMap[code] ? `${code} ${accountMap[code]}` : code;

/* ── Transaction classification helper ── */
const classifyTransaction = (items: LineItem[]): { label: string; color: string } => {
  const hasAsset = items.some(i => i.account.startsWith("12"));
  const hasRevenue = items.some(i => i.account.startsWith("4"));
  const hasExpense = items.some(i => i.account.startsWith("5"));
  if (hasAsset) return { label: "أصل ثابت", color: "bg-[#DBEAFE] text-[#1E40AF]" };
  if (hasRevenue) return { label: "إيراد تشغيلي", color: "bg-[#ECEEF5] text-[#0B1A47]" };
  if (hasExpense) return { label: "مصروف تشغيلي", color: "bg-[#FEF3C7] text-[#92400E]" };
  return { label: "عام", color: "bg-[#F3F4F6] text-[#374151]" };
};

/* ── Mock contact data for detail view ── */
const contactDetails: Record<string, { email: string; phone: string; address: string; taxId: string; cr: string; roles: string[]; accountManager: string; balance: number }> = {
  "شركة التقنية المتقدمة": { email: "info@advtech.sa", phone: "+966 11 234 5678", address: "الرياض، حي العليا، شارع الأمير محمد", taxId: "300456789012345", cr: "1010234567", roles: ["عميل"], accountManager: "أحمد محمد", balance: 15000 },
  "مؤسسة الإبداع الرقمي": { email: "contact@digital-creative.sa", phone: "+966 55 123 4567", address: "جدة، حي الصفا، طريق المدينة", taxId: "300567890123456", cr: "4030567890", roles: ["عميل", "مورد"], accountManager: "سارة علي", balance: 8500 },
  "شركة المستقبل للتجارة": { email: "sales@future-trade.sa", phone: "+966 12 345 6789", address: "الدمام، حي الفيصلية", taxId: "300678901234567", cr: "2050678901", roles: ["عميل"], accountManager: "خالد عمر", balance: -5000 },
  "مؤسسة النجاح للتطوير": { email: "dev@success.sa", phone: "+966 54 987 6543", address: "الرياض، حي الملز", taxId: "300789012345678", cr: "1010789012", roles: ["عميل"], accountManager: "أحمد محمد", balance: 12300 },
  "شركة الأمل للاستثمار": { email: "invest@hope.sa", phone: "+966 11 876 5432", address: "الرياض، طريق الملك فهد", taxId: "300890123456789", cr: "1010890123", roles: ["عميل", "مستثمر"], accountManager: "سارة علي", balance: 0 },
  "مؤسسة البناء الحديث": { email: "info@modern-build.sa", phone: "+966 13 456 7890", address: "الخبر، حي اليرموك", taxId: "300901234567890", cr: "2050901234", roles: ["عميل"], accountManager: "خالد عمر", balance: 45200 },
};

const fileTypeIcon = (type: Attachment["type"]) => {
  const map = { pdf: FileText, image: FileImage, excel: FileSpreadsheet, doc: File, other: FolderOpen };
  return map[type] || File;
};
const fileTypeFromName = (name: string): Attachment["type"] => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  if (["doc", "docx"].includes(ext)) return "doc";
  return "other";
};

/* ════════════════════════════════════════════════════════
   STATIC DATA
   ════════════════════════════════════════════════════════ */
const currencies = [
  { code: "SAR", name: "ريال سعودي", symbol: "﷼", flag: "🇸🇦" },
  { code: "USD", name: "دولار أمريكي", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "يورو", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "جنيه إسترليني", symbol: "£", flag: "🇬🇧" },
  { code: "AED", name: "درهم إماراتي", symbol: "د.إ", flag: "🇦🇪" },
];

const projects = ["", "مشروع ألفا", "مشروع بيتا", "مشروع جاما", "البنية التحتية"];

const defaultBrandingThemes: BrandingTheme[] = [
  { id: "BT-001", name: "افتراضي", logoUrl: "", primaryColor: "#0B1B49", accentColor: "#1276E3", layout: "standard", showLogo: true, showPaymentDetails: true, footerText: "شكراً لتعاملكم معنا" },
  { id: "BT-002", name: "احترافي", logoUrl: "", primaryColor: "#1E293B", accentColor: "#0EA5E9", layout: "professional", showLogo: true, showPaymentDetails: true, footerText: "نسعد بخدمتكم دائماً" },
  { id: "BT-003", name: "بسيط", logoUrl: "", primaryColor: "#111827", accentColor: "#6366F1", layout: "minimal", showLogo: false, showPaymentDetails: false, footerText: "" },
  { id: "BT-004", name: "عصري", logoUrl: "", primaryColor: "#0F172A", accentColor: "#F59E0B", layout: "modern", showLogo: true, showPaymentDetails: true, footerText: "نقدّر ثقتكم بنا" },
];

const initialInvoices: Invoice[] = [
  { id: "INV-2026-001", customer: "شركة التقنية المتقدمة", invoiceDate: "2026-03-01", dueDate: "2026-03-31", amount: "15,000", amountNum: 15000, status: "مدفوعة", items: [{ id: "L1", product: "استشارات تقنية", description: "خدمات استشارية شهر مارس", qty: 1, price: 13043.48, discount: 0, account: "4001", taxRate: 15, project: "" }], notes: "شكراً لتعاملكم معنا", paymentTerms: "صافي 30 يوم", reference: "", currency: "SAR", amountsAre: "exclusive" },
  { id: "INV-2026-002", customer: "مؤسسة الإبداع الرقمي", invoiceDate: "2026-03-02", dueDate: "2026-03-16", amount: "8,500", amountNum: 8500, status: "مرسلة", items: [{ id: "L2", product: "تطوير برمجيات", description: "تطوير واجهة مستخدم", qty: 1, price: 7391.30, discount: 0, account: "4001", taxRate: 15, project: "" }], notes: "", paymentTerms: "صافي 15 يوم", reference: "", currency: "SAR", amountsAre: "exclusive" },
  { id: "INV-2026-003", customer: "شركة المستقبل للتجارة", invoiceDate: "2026-03-03", dueDate: "2026-04-03", amount: "22,000", amountNum: 22000, status: "مدفوعة", items: [{ id: "L3", product: "نظام ERP", description: "ترخيص سنوي", qty: 1, price: 19130.43, discount: 0, account: "4001", taxRate: 15, project: "" }], notes: "", paymentTerms: "صافي 30 يوم", reference: "", currency: "SAR", amountsAre: "exclusive" },
  { id: "INV-2026-004", customer: "مؤسسة النجاح للتطوير", invoiceDate: "2026-02-20", dueDate: "2026-03-05", amount: "12,300", amountNum: 12300, status: "متأخرة", items: [{ id: "L4", product: "خدمات تصميم", description: "تصميم هوية بصرية", qty: 1, price: 10695.65, discount: 0, account: "4001", taxRate: 15, project: "" }], notes: "يرجى السداد في أقرب وقت", paymentTerms: "صافي 15 يوم", reference: "", currency: "SAR", amountsAre: "exclusive" },
  { id: "INV-2026-005", customer: "شركة الأمل للاستثمار", invoiceDate: "2026-03-04", dueDate: "2026-03-20", amount: "18,700", amountNum: 18700, status: "مسودة", items: [{ id: "L5", product: "استضافة سحابية", description: "خطة المؤسسات السنوية", qty: 1, price: 16260.87, discount: 0, account: "4001", taxRate: 15, project: "" }], notes: "", paymentTerms: "فوري", reference: "", currency: "SAR", amountsAre: "exclusive" },
  { id: "INV-2026-006", customer: "مؤسسة البناء الحديث", invoiceDate: "2026-03-04", dueDate: "2026-04-04", amount: "45,200", amountNum: 45200, status: "مرسلة", items: [{ id: "L6", product: "معدات حاسوب", description: "أجهزة ومعدات شبكية", qty: 5, price: 7860.87, discount: 0, account: "1203", taxRate: 15, project: "" }], notes: "", paymentTerms: "صافي 30 يوم", reference: "", currency: "SAR", amountsAre: "exclusive" },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "مدفوعة": "bg-[#DCFCE7] text-[#166534] border-[#22C55E] hover:bg-[#BBF7D0]",
    "مرسلة": "bg-[#EFF6FF] text-[#1E40AF] border-[#3B82F6] hover:bg-[#DBEAFE]",
    "متأخرة": "bg-[#FEE2E2] text-[#991B1B] border-[#EF4444] hover:bg-[#FECACA]",
    "مسودة": "bg-[#F3F4F6] text-[#374151] border-[#9CA3AF] hover:bg-[#E5E7EB]",
  };
  return m[s] || "";
};

type View = "list" | "create" | "view" | "edit";

/* ════════════════════════════════════════════════════════
   COMPONENT
   ═════════════════════��══════════════════════════════════ */
export function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [view, setView] = useState<View>("list");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Form state ──
  const [formCustomer, setFormCustomer] = useState("");
  const [formDate, setFormDate] = useState("2026-03-04");
  const [formDueDate, setFormDueDate] = useState("2026-04-04");
  const [formRef, setFormRef] = useState("");
  const [formCurrency, setFormCurrency] = useState("SAR");
  const [formAmountsAre, setFormAmountsAre] = useState<"exclusive" | "inclusive">("exclusive");
  const [formItems, setFormItems] = useState<LineItem[]>([...createEmptyLines(10)]);
  const [formNotes, setFormNotes] = useState("");
  const [formPaymentTerms, setFormPaymentTerms] = useState("صافي 30 يوم");
  const [formBrandingTheme, setFormBrandingTheme] = useState("BT-001");

  // ── UI state ──
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showHiddenCols, setShowHiddenCols] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set(["discount", "project"]));
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showPastePanel, setShowPastePanel] = useState(false);
  const [pastePreview, setPastePreview] = useState<Partial<LineItem>[] | null>(null);
  const [showBrandingPanel, setShowBrandingPanel] = useState(false);
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [ocrSimulating, setOcrSimulating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Detail view tab state ──
  const [detailTab, setDetailTab] = useState<"notes" | "attachments" | "activity" | "payments">("notes");

  // ── List view state ──
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
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

  const statusFilterLabels: Record<string, string> = { "": "الكل", paid: "مدفوعة", sent: "مرسلة", overdue: "متأخرة", draft: "مسودات" };
  const statusToFilter: Record<string, string> = { "مدفوعة": "paid", "مرسلة": "sent", "متأخرة": "overdue", "مسودة": "draft" };

  const filteredInvoices = invoices.filter((i) => {
    const matchesSearch = i.customer.includes(searchQuery) || i.id.includes(searchQuery);
    const matchesStatus = !statusFilter || statusToFilter[i.status] === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const displayedInvoices = filteredInvoices.slice(0, perPage);

  /* ─── Totals ─── */
  const activeItems = formItems.filter((i) => i.product || i.description || i.qty > 0 || i.price > 0);
  const computeLineTotal = (item: LineItem) => item.qty * item.price * (1 - item.discount / 100);
  const computeLineTax = (item: LineItem) => {
    const base = computeLineTotal(item);
    return formAmountsAre === "inclusive" ? base - base / (1 + item.taxRate / 100) : base * (item.taxRate / 100);
  };
  const computeLineAmount = (item: LineItem) => {
    const base = computeLineTotal(item);
    return formAmountsAre === "inclusive" ? base : base + base * (item.taxRate / 100);
  };
  const subtotal = formAmountsAre === "inclusive"
    ? activeItems.reduce((s, i) => s + computeLineTotal(i) - computeLineTax(i), 0)
    : activeItems.reduce((s, i) => s + computeLineTotal(i), 0);
  const taxTotal = activeItems.reduce((s, i) => s + computeLineTax(i), 0);
  const grandTotal = subtotal + taxTotal;

  const nextInvoiceId = `INV-2026-${String(invoices.length + 1).padStart(3, "0")}`;
  const currentTheme = defaultBrandingThemes.find((t) => t.id === formBrandingTheme) || defaultBrandingThemes[0];

  /* ─── Reset ─── */
  const resetForm = () => {
    setFormCustomer(""); setFormDate("2026-03-04"); setFormDueDate("2026-04-04");
    setFormRef(""); setFormCurrency("SAR"); setFormAmountsAre("exclusive");
    setFormItems([...createEmptyLines(10)]); setFormNotes(""); setFormPaymentTerms("صافي 30 يوم");
    setFormBrandingTheme("BT-001"); setAttachments([]); setDuplicateMatches([]);
    setPastePreview(null); setShowPastePanel(false); setShowBrandingPanel(false); setShowDocPanel(false);
  };

  /* ═══════════════ UX-8: Enhanced Duplicate Detection ═══════════════ */
  const checkDuplicate = useCallback((customer: string, date: string, total: number, refNumber?: string) => {
    const matches: DuplicateMatch[] = [];

    // Check 1: Exact invoice number match
    if (refNumber) {
      const numMatch = invoices.find((inv) => inv.reference === refNumber && refNumber !== "");
      if (numMatch) matches.push({ invoiceId: numMatch.id, customer: numMatch.customer, date: numMatch.invoiceDate, amount: numMatch.amountNum, matchType: "exact_number", confidence: 100 });
    }

    // Check 2: Same customer + same date + same amount (±5%)
    if (customer && date) {
      const dayMatches = invoices.filter((inv) =>
        inv.customer === customer && inv.invoiceDate === date && total > 0 && Math.abs(inv.amountNum - total) / Math.max(inv.amountNum, 1) < 0.05
      );
      for (const dm of dayMatches) {
        if (!matches.some((m) => m.invoiceId === dm.id)) {
          matches.push({ invoiceId: dm.id, customer: dm.customer, date: dm.invoiceDate, amount: dm.amountNum, matchType: "same_day_amount", confidence: 95 });
        }
      }
    }

    // Check 3: Same customer + similar amount (±2%) within 7 days
    if (customer && date && total > 0) {
      const targetDate = new Date(date);
      const nearMatches = invoices.filter((inv) => {
        if (inv.customer !== customer) return false;
        const invDate = new Date(inv.invoiceDate);
        const dayDiff = Math.abs((targetDate.getTime() - invDate.getTime()) / 86400000);
        return dayDiff <= 7 && dayDiff > 0 && Math.abs(inv.amountNum - total) / Math.max(inv.amountNum, 1) < 0.02;
      });
      for (const nm of nearMatches) {
        if (!matches.some((m) => m.invoiceId === nm.id)) {
          matches.push({ invoiceId: nm.id, customer: nm.customer, date: nm.invoiceDate, amount: nm.amountNum, matchType: "similar_amount", confidence: 75 });
        }
      }
    }

    setDuplicateMatches(matches);
  }, [invoices]);

  // Auto-check on customer/date/amount change
  useEffect(() => {
    if (view === "create" || view === "edit") {
      const timer = setTimeout(() => checkDuplicate(formCustomer, formDate, grandTotal, formRef), 400);
      return () => clearTimeout(timer);
    }
  }, [formCustomer, formDate, grandTotal, formRef, view, checkDuplicate]);

  /* ─── CRUD ─── */
  const handleCreate = () => { resetForm(); setView("create"); };
  const handleSave = (asDraft: boolean) => {
    const newInv: Invoice = {
      id: view === "edit" && selectedInvoice ? selectedInvoice.id : nextInvoiceId,
      customer: formCustomer, invoiceDate: formDate, dueDate: formDueDate,
      amount: grandTotal.toLocaleString(), amountNum: grandTotal,
      status: asDraft ? "مسودة" : "مرسلة", items: activeItems.length > 0 ? activeItems : [emptyLine()],
      notes: formNotes, paymentTerms: formPaymentTerms, reference: formRef,
      currency: formCurrency, amountsAre: formAmountsAre, brandingThemeId: formBrandingTheme, attachments,
    };
    if (view === "edit" && selectedInvoice) {
      setInvoices((prev) => prev.map((i) => i.id === selectedInvoice.id ? newInv : i));
    } else {
      setInvoices((prev) => [...prev, newInv]);
    }
    setView("list"); resetForm();
  };
  const handleView = (inv: Invoice) => { setSelectedInvoice(inv); setDetailTab("notes"); setView("view"); };
  const handleEdit = (inv: Invoice) => {
    setSelectedInvoice(inv); setFormCustomer(inv.customer); setFormDate(inv.invoiceDate);
    setFormDueDate(inv.dueDate); setFormRef(inv.reference || ""); setFormCurrency(inv.currency || "SAR");
    setFormAmountsAre(inv.amountsAre || "exclusive"); setFormBrandingTheme(inv.brandingThemeId || "BT-001");
    const lines = inv.items.map((i) => ({ ...i, id: i.id || newLineId() }));
    while (lines.length < 10) lines.push(emptyLine());
    setFormItems(lines); setFormNotes(inv.notes); setFormPaymentTerms(inv.paymentTerms);
    setAttachments(inv.attachments || []); setView("edit");
  };
  const handleDelete = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    if (selectedInvoice?.id === id) { setView("list"); setSelectedInvoice(null); }
  };

  /* ─── Line Item ops ─── */
  const addLineItem = () => setFormItems((p) => [...p, emptyLine()]);
  const removeLineItem = (idx: number) => { if (formItems.length <= 1) return; setFormItems((p) => p.filter((_, i) => i !== idx)); };
  const updateLineItem = (idx: number, field: keyof LineItem, val: string | number) => {
    setFormItems((p) => p.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };
  const handleItemSelect = (idx: number, name: string, catalogItem?: CatalogItem) => {
    setFormItems((p) => p.map((item, i) => {
      if (i !== idx) return item;
      if (catalogItem) return { ...item, product: catalogItem.name, description: catalogItem.description, price: catalogItem.price, account: catalogItem.account, taxRate: catalogItem.taxRate, qty: item.qty || 1 };
      return { ...item, product: name };
    }));
  };

  /* ═══════════════ UX-5: Enhanced Drag & Drop ═══════════════ */
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    // Ghost image
    const row = (e.target as HTMLElement).closest("tr");
    if (row) e.dataTransfer.setDragImage(row, 20, 20);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setDragOverIndex(null); return; }
    setFormItems((prev) => {
      const next = [...prev]; const [moved] = next.splice(dragIndex, 1); next.splice(idx, 0, moved); return next;
    });
    setDragIndex(null); setDragOverIndex(null);
  };

  // File Drag & Drop with OCR simulation
  const handleFileDragEnter = (e: React.DragEvent) => { e.preventDefault(); setFileDragActive(true); };
  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setFileDragActive(false);
  };
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setFileDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    processDroppedFiles(files);
  };
  const processDroppedFiles = (files: globalThis.File[]) => {
    const newAttachments: Attachment[] = files.map((f) => ({
      name: f.name, size: formatFileSize(f.size), type: fileTypeFromName(f.name),
      category: "أخرى" as const, uploadedAt: new Date().toISOString(),
      ocrStatus: (fileTypeFromName(f.name) === "image" || fileTypeFromName(f.name) === "pdf") ? "pending" as const : undefined,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);

    // Simulate OCR for images/PDFs
    const ocrFiles = newAttachments.filter((a) => a.ocrStatus === "pending");
    if (ocrFiles.length > 0) simulateOCR(ocrFiles);
  };
  const simulateOCR = (files: Attachment[]) => {
    setOcrSimulating(true);
    // Update to processing
    setAttachments((prev) => prev.map((a) => files.some((f) => f.name === a.name) ? { ...a, ocrStatus: "processing" as const } : a));
    // Simulate 2s OCR processing
    setTimeout(() => {
      const mockOcrData: Partial<LineItem>[] = [
        { product: "خدمات استشارية", description: "استشارة مالية Q1", qty: 1, price: 15000 },
        { product: "رسوم تدقيق", description: "تدقيق حسابات ربع سنوي", qty: 1, price: 8000 },
      ];
      setAttachments((prev) => prev.map((a) =>
        files.some((f) => f.name === a.name) ? { ...a, ocrStatus: "done" as const, ocrData: mockOcrData } : a
      ));
      setOcrSimulating(false);
    }, 2500);
  };
  const applyOcrData = (attachment: Attachment) => {
    if (!attachment.ocrData) return;
    setFormItems((prev) => {
      const firstEmpty = prev.findIndex((i) => !i.product && !i.description && i.qty === 0 && i.price === 0);
      const next = [...prev];
      for (let i = 0; i < attachment.ocrData!.length; i++) {
        const target = firstEmpty >= 0 ? firstEmpty + i : next.length;
        const data = attachment.ocrData![i];
        if (target < next.length) {
          next[target] = { ...next[target], ...data, id: next[target].id } as LineItem;
        } else {
          next.push({ ...emptyLine(), ...data } as LineItem);
        }
      }
      return next;
    });
    // Mark as applied
    setAttachments((prev) => prev.map((a) => a.name === attachment.name ? { ...a, ocrStatus: undefined, ocrData: undefined } : a));
  };
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  /* ═══════════════ UX-2: Enhanced Smart Paste ═══════════════ */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || text.length < 3) return;

    const rows = text.split("\n").filter((r) => r.trim());
    if (rows.length < 1) return;

    // Detect separator: tab, semicolon, pipe, comma
    const seps = ["\t", ";", "|", ","];
    let bestSep = "\t"; let maxCols = 0;
    for (const sep of seps) {
      const colCount = rows[0].split(sep).length;
      if (colCount > maxCols) { maxCols = colCount; bestSep = sep; }
    }

    // Detect if first row is header
    const firstRow = rows[0].split(bestSep).map((c) => c.trim().toLowerCase());
    const headerKeywords = ["صنف", "item", "product", "وصف", "description", "كمية", "qty", "quantity", "سعر", "price", "unit"];
    const isHeader = firstRow.some((cell) => headerKeywords.some((kw) => cell.includes(kw)));
    const dataRows = isHeader ? rows.slice(1) : rows;

    // Smart column mapping
    const colMap = { product: 0, description: 1, qty: 2, price: 3, discount: -1, account: -1, taxRate: -1 };
    if (isHeader) {
      firstRow.forEach((h, idx) => {
        if (h.includes("صنف") || h.includes("item") || h.includes("product") || h.includes("اسم")) colMap.product = idx;
        else if (h.includes("وصف") || h.includes("description") || h.includes("ملاحظ")) colMap.description = idx;
        else if (h.includes("كمية") || h.includes("qty") || h.includes("quantity") || h.includes("عدد")) colMap.qty = idx;
        else if (h.includes("سعر") || h.includes("price") || h.includes("مبلغ") || h.includes("unit")) colMap.price = idx;
        else if (h.includes("خصم") || h.includes("discount")) colMap.discount = idx;
        else if (h.includes("حساب") || h.includes("account")) colMap.account = idx;
        else if (h.includes("ضريبة") || h.includes("tax") || h.includes("vat")) colMap.taxRate = idx;
      });
    }

    const parsed: Partial<LineItem>[] = [];
    for (const row of dataRows) {
      const cols = row.split(bestSep).map((c) => c.trim());
      if (cols.length < 2 && !cols[0]) continue;

      // Parse numbers — handle Arabic decimals (٫) and comma decimals
      const parseNum = (s: string) => {
        if (!s) return 0;
        const cleaned = s.replace(/[^\d.,٫-]/g, "").replace("٫", ".").replace(",", "");
        return parseFloat(cleaned) || 0;
      };

      parsed.push({
        id: newLineId(),
        product: cols[colMap.product] || "",
        description: colMap.description >= 0 ? (cols[colMap.description] || "") : "",
        qty: colMap.qty >= 0 ? (parseNum(cols[colMap.qty]) || 1) : 1,
        price: colMap.price >= 0 ? parseNum(cols[colMap.price]) : 0,
        discount: colMap.discount >= 0 ? parseNum(cols[colMap.discount]) : 0,
        account: colMap.account >= 0 ? (cols[colMap.account] || "") : "",
        taxRate: colMap.taxRate >= 0 ? (parseNum(cols[colMap.taxRate]) || 15) : 15,
        project: "",
      });
    }

    if (parsed.length > 0) {
      e.preventDefault();
      // Show preview instead of direct apply
      setPastePreview(parsed);
      setShowPastePanel(true);
    }
  }, []);

  const applyPastePreview = () => {
    if (!pastePreview) return;
    setFormItems((prev) => {
      const firstEmpty = prev.findIndex((i) => !i.product && !i.description && i.qty === 0 && i.price === 0);
      const next = [...prev];
      for (let i = 0; i < pastePreview.length; i++) {
        const target = firstEmpty >= 0 ? firstEmpty + i : next.length;
        if (target < next.length) next[target] = { ...next[target], ...pastePreview[i] } as LineItem;
        else next.push({ ...emptyLine(), ...pastePreview[i] } as LineItem);
      }
      return next;
    });
    setPastePreview(null); setShowPastePanel(false);
  };

  const toggleColumn = (col: string) => {
    setHiddenCols((prev) => { const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col); return next; });
  };

  /* ════════════════════════════════════════════════════════
     VIEW: Invoice Detail — UX-12 Enhanced
     ════════════════════════════════════════════════════════ */
  if (view === "view" && selectedInvoice) {
    const inv = selectedInvoice;
    const sub = inv.items.reduce((s, i) => s + i.qty * i.price * (1 - (i.discount || 0) / 100), 0);
    const tax = inv.items.reduce((s, i) => s + i.qty * i.price * (1 - (i.discount || 0) / 100) * (i.taxRate / 100), 0);
    const total = sub + tax;
    const contact = contactDetails[inv.customer];
    const txClass = classifyTransaction(inv.items);

    /* Mock activity log */
    const activityLog = [
      { date: inv.invoiceDate, action: "إنشاء الفاتورة", user: "النظام", icon: FileText },
      ...(inv.status !== "مسودة" ? [{ date: inv.invoiceDate, action: "إرسال للعميل عبر البريد", user: contact?.accountManager || "النظام", icon: Mail }] : []),
      ...(inv.status === "مدفوعة" ? [{ date: inv.dueDate, action: "تم الدفع الكامل", user: "النظام", icon: CreditCard }] : []),
    ];

    /* Mock payments */
    const payments = inv.status === "مدفوعة"
      ? [{ id: "PAY-001", date: inv.dueDate, amount: total, method: "تحويل بنكي", ref: "TRF-98765" }]
      : inv.status === "مرسلة" ? [{ id: "PAY-001", date: inv.invoiceDate, amount: total * 0.3, method: "دفعة مقدمة", ref: "DEP-12345" }] : [];

    return (
      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView("list")} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>فاتورة {inv.id}</h1>
                <Badge className={`border ${statusStyle(inv.status)}`}>{inv.status}</Badge>
                <Badge className={`text-xs ${txClass.color}`}><Tag className="h-3 w-3 me-1 inline" />{txClass.label}</Badge>
              </div>
              <Link to={contactLink(inv.customer) || ""} className="text-[#6B7280] text-sm hover:text-[#1276E3] hover:underline transition-colors">{inv.customer}</Link>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => handleEdit(inv)}><Edit2 className="me-2 h-4 w-4" />تعديل</Button>
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => window.print()}><Printer className="me-2 h-4 w-4" />طباعة</Button>
            <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Download className="me-2 h-4 w-4" />تصدير PDF</Button>
          </div>
        </div>

        {/* ── Row 1: Invoice Data + Contact Card ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Invoice Data */}
          <Card className="border-[#E5E7EB] lg:col-span-1">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات الفاتورة</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-[#6B7280]">رقم الفاتورة:</span><span className="font-english" style={{ fontWeight: 500 }}>{inv.id}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">تاريخ الإصدار:</span><span className="font-english">{inv.invoiceDate}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">تاريخ الاستحقاق:</span><span className="font-english">{inv.dueDate}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">شروط الدفع:</span><span>{inv.paymentTerms}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">العملة:</span><span className="font-english">{inv.currency || "SAR"}</span></div>
                {inv.reference && <div className="flex justify-between"><span className="text-[#6B7280]">المرجع الخارجي:</span><button className="text-[#1276E3] hover:underline font-english" style={{ fontWeight: 500 }}>{inv.reference} ↗</button></div>}
              </div>
              {/* Extra clickable fields */}
              <div className="pt-2 border-t border-[#F3F4F6] space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#6B7280]">المشروع:</span><button className="text-[#1276E3] hover:underline flex items-center gap-1"><Link2 className="h-3 w-3" />مشروع ألفا</button></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">العقد:</span><button className="text-[#1276E3] hover:underline flex items-center gap-1"><Link2 className="h-3 w-3" />CNT-2026-003</button></div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Card — UX-12 Party Info */}
          {contact && (
            <Card className="border-[#E5E7EB] lg:col-span-1">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات الجهة</h3>
                  <Link to={contactLink(inv.customer) || ""} className="text-xs text-[#1276E3] hover:underline">فتح الملف ↗</Link>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" /><Link to={contactLink(inv.customer) || ""} className="text-[#0B1B49] hover:text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>{inv.customer}</Link></div>
                  <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" /><span className="font-english text-[#374151]">{contact.email}</span></div>
                  <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" /><span className="font-english text-[#374151]" dir="ltr">{contact.phone}</span></div>
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" /><span className="text-[#374151]">{contact.address}</span></div>
                  <div className="flex items-center gap-2"><Hash className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" /><span className="text-[#6B7280]">ضريبي:</span><span className="font-english text-[#374151]">{contact.taxId}</span></div>
                  <div className="flex items-center gap-2"><Building className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" /><span className="text-[#6B7280]">سجل تجاري:</span><span className="font-english text-[#374151]">{contact.cr}</span></div>
                </div>
                <div className="pt-2 border-t border-[#F3F4F6] flex items-center justify-between text-sm">
                  <div className="flex gap-1">{contact.roles.map(r => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)}</div>
                  <div className="flex items-center gap-1 text-xs text-[#6B7280]"><Briefcase className="h-3 w-3" />{contact.accountManager}</div>
                </div>
                {/* Net balance */}
                <div className="pt-2 border-t border-[#F3F4F6] flex items-center justify-between">
                  <span className="text-xs text-[#6B7280]">صافي الرصيد:</span>
                  <span dir="ltr" className="inline-flex items-baseline gap-1 font-english text-sm" style={{ fontWeight: 600, color: contact.balance > 0 ? "#0B1A47" : contact.balance < 0 ? "#349FC4" : "#374151" }}>
                    <span className="text-[#9CA3AF]" style={{ fontSize: "0.6875rem", fontWeight: 500 }}>{CUR}</span>
                    <span>{Math.abs(contact.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {contact.balance < 0 && <span className="text-[#349FC4]">−</span>}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Totals Card */}
          <Card className="border-[#E5E7EB] lg:col-span-1">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>المجاميع</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-[#6B7280]">المجموع الفرعي:</span><span dir="ltr" className="inline-flex items-baseline gap-1 font-english" style={{ fontVariantNumeric: "tabular-nums" }}><span className="text-[#9CA3AF]" style={{ fontSize: "0.6875rem" }}>{CUR}</span><span>{sub.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">ضريبة القيمة المضافة (15%):</span><span dir="ltr" className="inline-flex items-baseline gap-1 font-english" style={{ fontVariantNumeric: "tabular-nums" }}><span className="text-[#9CA3AF]" style={{ fontSize: "0.6875rem" }}>{CUR}</span><span>{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span></div>
                <div className="border-t border-[#E5E7EB] pt-2 flex justify-between text-[#0B1B49]" style={{ fontWeight: 700, fontSize: "1.125rem" }}>
                  <span>الإجمالي:</span>
                  <span dir="ltr" className="inline-flex items-baseline gap-1.5"><span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span><span className="font-english" style={{ fontVariantNumeric: "tabular-nums" }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                </div>
                {/* Paid / Due */}
                {payments.length > 0 && (
                  <div className="pt-2 border-t border-[#F3F4F6] space-y-1.5">
                    <div className="flex justify-between"><span className="text-[#0B1A47]">المدفوع:</span><span dir="ltr" className="inline-flex items-baseline gap-1 font-english text-[#0B1A47]" style={{ fontVariantNumeric: "tabular-nums" }}><span style={{ fontSize: "0.6875rem" }}>{CUR}</span><span>{payments.reduce((s, p) => s + p.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span></div>
                    <div className="flex justify-between" style={{ fontWeight: 600 }}><span className="text-[#349FC4]">المتبقي:</span><span dir="ltr" className="inline-flex items-baseline gap-1 font-english text-[#349FC4]" style={{ fontVariantNumeric: "tabular-nums" }}><span style={{ fontSize: "0.6875rem" }}>{CUR}</span><span>{(total - payments.reduce((s, p) => s + p.amount, 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span></div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Items Table — Fixed columns + account code:name + dir:ltr amounts ── */}
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">البنود</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "800px", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "40px" }} />
                  <col style={{ width: "160px" }} />
                  <col />
                  <col style={{ width: "180px" }} />
                  <col style={{ width: "65px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "65px" }} />
                  <col style={{ width: "65px" }} />
                  <col style={{ width: "120px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 pe-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>#</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الصنف</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الوصف</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحساب</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الكمية</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>سعر الوحدة</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الخصم</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الضريبة</th>
                    <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المبلغ ({CUR})</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((item, i) => {
                    const lineNet = item.qty * item.price * (1 - (item.discount || 0) / 100);
                    const lineTotal = lineNet * (1 + item.taxRate / 100);
                    return (
                      <tr key={i} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                        <td className="py-3 pe-2 text-xs text-[#9CA3AF] font-english">{i + 1}</td>
                        <td className="py-3 pe-3 text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>{item.product}</td>
                        <td className="py-3 pe-3 text-sm text-[#374151]">{item.description}</td>
                        <td className="py-3 pe-3 text-xs text-[#6B7280]"><span className="font-english" style={{ fontWeight: 500 }}>{item.account}</span> {accountMap[item.account] || ""}</td>
                        <td className="py-3 pe-3 text-sm font-english text-center">{item.qty}</td>
                        <td className="py-3 pe-3"><span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums" }}><span className="text-[#D1D5DB]" style={{ fontSize: "0.625rem" }}>{CUR}</span> {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                        <td className="py-3 pe-3 text-sm font-english text-center text-[#6B7280]">{(item.discount || 0) > 0 ? `${item.discount}%` : "—"}</td>
                        <td className="py-3 pe-3 text-sm font-english text-center text-[#6B7280]">{item.taxRate}%</td>
                        <td className="py-3"><span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}><span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem", fontWeight: 500 }}>{CUR}</span> {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── 4 Tabs: Notes / Attachments / Activity / Payments ── */}
        <Card className="border-[#E5E7EB]">
          <div className="border-b border-[#E5E7EB]">
            <div className="flex gap-0 px-5">
              {([
                { key: "notes" as const, label: "ملاحظات", icon: MessageSquare },
                { key: "attachments" as const, label: "مرفقات", icon: Paperclip, count: inv.attachments?.length || 0 },
                { key: "activity" as const, label: "سجل النشاط", icon: History },
                { key: "payments" as const, label: "المدفوعات", icon: CreditCard, count: payments.length },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${detailTab === tab.key ? "border-[#1276E3] text-[#1276E3]" : "border-transparent text-[#6B7280] hover:text-[#374151]"}`}
                  style={{ fontWeight: detailTab === tab.key ? 600 : 400 }}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {"count" in tab && tab.count > 0 && <span className="font-english bg-[#F3F4F6] text-[#6B7280] rounded-full px-1.5 text-[10px]">{tab.count}</span>}
                </button>
              ))}
            </div>
          </div>
          <CardContent className="p-5">
            {/* Tab: Notes */}
            {detailTab === "notes" && (
              <div>{inv.notes ? <p className="text-sm text-[#374151] leading-relaxed">{inv.notes}</p> : <p className="text-sm text-[#9CA3AF] text-center py-6">لا توجد ملاحظات على هذه الفاتورة</p>}</div>
            )}
            {/* Tab: Attachments */}
            {detailTab === "attachments" && (
              <div>{inv.attachments && inv.attachments.length > 0 ? (
                <div className="space-y-2">{inv.attachments.map((file, i) => {
                  const Icon = fileTypeIcon(file.type);
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] p-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${file.type === "pdf" ? "bg-[#FEE2E2]" : file.type === "image" ? "bg-[#DBEAFE]" : "bg-[#F3F4F6]"}`}><Icon className={`h-4 w-4 ${file.type === "pdf" ? "text-[#EF4444]" : file.type === "image" ? "text-[#1276E3]" : "text-[#6B7280]"}`} /></div>
                      <div className="flex-1 min-w-0"><p className="text-sm text-[#0B1B49] truncate" style={{ fontWeight: 500 }}>{file.name}</p><p className="text-xs font-english text-[#9CA3AF]">{file.size} • {file.category}</p></div>
                      <button className="text-xs text-[#1276E3] hover:underline">تحميل</button>
                    </div>
                  );
                })}</div>
              ) : <p className="text-sm text-[#9CA3AF] text-center py-6">لا توجد مرفقات</p>}</div>
            )}
            {/* Tab: Activity Log */}
            {detailTab === "activity" && (
              <div className="space-y-3">
                {activityLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0 mt-0.5"><entry.icon className="h-3.5 w-3.5 text-[#6B7280]" /></div>
                    <div>
                      <p className="text-sm text-[#0B1B49]">{entry.action}</p>
                      <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mt-0.5"><Clock className="h-3 w-3" /><span className="font-english">{entry.date}</span><span>•</span><span>{entry.user}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Tab: Payments */}
            {detailTab === "payments" && (
              <div>{payments.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[#E5E7EB]">
                    <th className="pb-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم الدفعة</th>
                    <th className="pb-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                    <th className="pb-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الطريقة</th>
                    <th className="pb-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المرجع</th>
                    <th className="pb-2 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المبلغ ({CUR})</th>
                  </tr></thead>
                  <tbody>{payments.map(p => (
                    <tr key={p.id} className="border-b border-[#F3F4F6] last:border-0">
                      <td className="py-2.5 font-english text-[#1276E3] cursor-pointer hover:underline" style={{ fontWeight: 500 }}>{p.id}</td>
                      <td className="py-2.5 font-english text-[#6B7280]">{p.date}</td>
                      <td className="py-2.5 text-[#374151]">{p.method}</td>
                      <td className="py-2.5 font-english text-[#6B7280]">{p.ref}</td>
                      <td className="py-2.5"><span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}><span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span> {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="text-sm text-[#9CA3AF] text-center py-6">لا توجد مدفوعات مسجلة</p>}</div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     VIEW: Create / Edit Form — Xero Level
     ════════════════════════════════════════════════════════ */
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
      { key: "amount", label: `المبلغ (${CUR})`, width: "110px", alwaysShow: true },
      { key: "delete", label: "", width: "36px", alwaysShow: true },
    ];
    const visibleCols = colDefs.filter((c) => c.alwaysShow || !hiddenCols.has(c.key));
    const hiddenCount = colDefs.filter((c) => !c.alwaysShow && hiddenCols.has(c.key)).length;

    return (
      <div
        className="space-y-5"
        onPaste={handlePaste}
        onDragEnter={handleFileDragEnter}
        onDragLeave={handleFileDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
        {/* ── File Drag Overlay ── */}
        {fileDragActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1276E3]/10 backdrop-blur-sm pointer-events-none">
            <div className="rounded-2xl border-4 border-dashed border-[#1276E3] bg-white/90 p-12 text-center shadow-xl">
              <Upload className="h-12 w-12 text-[#1276E3] mx-auto mb-3" />
              <p className="text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>اسقط الملفات هنا</p>
              <p className="text-sm text-[#6B7280] mt-1">فاتورة، صورة، عقد، Excel — سيتم قراءتها تلقائياً بالـ AI OCR</p>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView("list"); resetForm(); }} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                {view === "edit" ? `تعديل فاتورة ${selectedInvoice?.id}` : "فاتورة جديدة"}
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => { setView("list"); resetForm(); }}>إلغاء</Button>
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => handleSave(true)}>حفظ كمسودة</Button>
            <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => handleSave(false)}>إصدار وإرسال</Button>
          </div>
        </div>

        {/* ═══ UX-8: Enhanced Duplicate Warning ═══ */}
        {duplicateMatches.length > 0 && (
          <div className="rounded-lg border-2 border-[#F59E0B] bg-[#FEF3C7]/50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 700 }}>
                  كشف تكرار محتمل — {duplicateMatches.length} فاتورة مشابهة
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">تحقق من أن هذه ليست فاتورة مكررة قبل الحفظ</p>
              </div>
              <button onClick={() => setDuplicateMatches([])} className="rounded p-1 text-[#6B7280] hover:bg-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {duplicateMatches.map((m) => (
                <div key={m.invoiceId} className="flex items-center gap-3 rounded-lg border border-[#F59E0B]/30 bg-white p-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${m.confidence >= 90 ? "bg-[#EF4444]" : m.confidence >= 70 ? "bg-[#F59E0B]" : "bg-[#6B7280]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-english text-[#1276E3]" style={{ fontWeight: 600 }}>{m.invoiceId}</span>
                      <span className="text-[#6B7280]">•</span>
                      <span className="text-[#374151] truncate">{m.customer}</span>
                      <span className="text-[#6B7280]">•</span>
                      <span className="font-english text-[#6B7280]">{m.date}</span>
                      <span className="text-[#6B7280]">•</span>
                      <span className="font-english text-[#374151]" style={{ fontWeight: 600 }}><span dir="ltr">SAR {m.amount.toLocaleString()}</span></span>
                    </div>
                    <span className="text-xs text-[#9CA3AF]">
                      {m.matchType === "exact_number" ? "تطابق رقم المرجع" : m.matchType === "same_day_amount" ? "نفس العميل والتاريخ والمبلغ" : "مبلغ مشابه خلال 7 أيام"}
                      {" "}<span className="font-english">({m.confidence}%)</span>
                    </span>
                  </div>
                  <button onClick={() => { const inv = invoices.find((i) => i.id === m.invoiceId); if (inv) handleView(inv); }} className="rounded-md border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#1276E3] hover:bg-[#EFF6FF]" style={{ fontWeight: 500 }}>عرض</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ UX-2: Paste Preview Panel ═══ */}
        {showPastePanel && pastePreview && (
          <div className="rounded-lg border-2 border-[#1276E3] bg-white shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#EFF6FF] border-b border-[#1276E3]/20">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="h-5 w-5 text-[#1276E3]" />
                <span className="text-sm text-[#0B1B49]" style={{ fontWeight: 700 }}>معاينة اللصق الذكي — {pastePreview.length} سطر</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPastePreview(null); setShowPastePanel(false); }} className="rounded-md border border-[#E5E7EB] px-3 py-1 text-xs text-[#6B7280] hover:bg-white"><XCircle className="h-3.5 w-3.5 me-1 inline" />إلغاء</button>
                <button onClick={applyPastePreview} className="rounded-md bg-[#1276E3] px-3 py-1 text-xs text-white hover:bg-[#1060C0]" style={{ fontWeight: 600 }}><CheckCircle2 className="h-3.5 w-3.5 me-1 inline" />تطبيق الكل</button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-52">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]"><th className="py-2 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الصنف</th><th className="py-2 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الوصف</th><th className="py-2 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الكمية</th><th className="py-2 px-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>السعر</th></tr></thead>
                <tbody>
                  {pastePreview.map((row, i) => (
                    <tr key={i} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                      <td className="py-1.5 px-3 text-[#0B1B49]">{row.product}</td>
                      <td className="py-1.5 px-3 text-[#6B7280]">{row.description}</td>
                      <td className="py-1.5 px-3 font-english">{row.qty}</td>
                      <td className="py-1.5 px-3 font-english">{row.price?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Main Form Card ── */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-6">
            {/* Row 1: Header fields */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
              <div className="space-y-1.5 lg:col-span-1">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>جهة الاتصال</Label>
                <ContactSearchInput value={formCustomer} onChange={(name) => setFormCustomer(name)} roleFilter="عميل" placeholder="ابحث عن عميل..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>تاريخ الإصدار</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="font-english" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>تاريخ الاستحقاق</Label>
                <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="font-english" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>رقم الفاتورة</Label>
                <div className="flex items-center gap-1"><span className="text-[#6B7280] text-sm">#</span><Input value={view === "edit" ? selectedInvoice?.id : nextInvoiceId} disabled className="font-english bg-[#F9FAFB]" dir="ltr" /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>المرجع</Label>
                <Input value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="رقم مرجع المورد" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>الدفع الإلكتروني</Label>
                <button className="w-full rounded-lg border border-[#1276E3] bg-white px-3 py-2 text-xs text-[#1276E3] hover:bg-[#EFF6FF] transition-colors text-start flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                  إعداد الدفع
                  <span className="flex gap-0.5 ms-auto"><span className="w-6 h-4 rounded bg-[#1A1F71] text-white text-[8px] flex items-center justify-center" style={{ fontWeight: 700 }}>VISA</span><span className="w-6 h-4 rounded bg-[#EB001B] text-white text-[8px] flex items-center justify-center" style={{ fontWeight: 700 }}>MC</span></span>
                </button>
              </div>
            </div>

            {/* Row 2: Currency, Amounts are, Branding Theme */}
            <div className="flex flex-wrap items-end gap-4 mb-6 pb-6 border-b border-[#E5E7EB]">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>العملة</Label>
                <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none">{currencies.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}</select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>المبالغ</Label>
                <select value={formAmountsAre} onChange={(e) => setFormAmountsAre(e.target.value as "exclusive" | "inclusive")} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none"><option value="exclusive">غير شاملة الضريبة</option><option value="inclusive">شاملة الضريبة</option></select>
              </div>
              {/* UX-9: Branding Theme Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>قالب العلامة التجارية</Label>
                <div className="flex items-center gap-2">
                  <select value={formBrandingTheme} onChange={(e) => setFormBrandingTheme(e.target.value)} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none">
                    {defaultBrandingThemes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={() => setShowBrandingPanel(!showBrandingPanel)} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1276E3] transition-colors"><Palette className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="ms-auto flex gap-2">
                <button onClick={() => setShowPastePanel(!showPastePanel)} className="rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#6B7280] hover:bg-[#F3F4F6] flex items-center gap-1" style={{ fontWeight: 500 }}><ClipboardPaste className="h-3.5 w-3.5" />لصق ذكي</button>
                <button onClick={() => setShowDocPanel(!showDocPanel)} className="rounded-md border border-[#1276E3] bg-white px-3 py-2 text-xs text-[#1276E3] hover:bg-[#EFF6FF] flex items-center gap-1" style={{ fontWeight: 600 }}><Paperclip className="h-3.5 w-3.5" />المستندات {attachments.length > 0 && <span className="font-english bg-[#1276E3] text-white rounded-full px-1.5 py-0 text-[10px]">{attachments.length}</span>}</button>
              </div>
            </div>

            {/* ═══ UX-9: Branding Theme Panel ═══ */}
            {showBrandingPanel && (
              <div className="mb-6 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-[#1276E3]" />
                    <h3 className="text-sm text-[#0B1B49]" style={{ fontWeight: 700 }}>قالب العلامة التجارية</h3>
                  </div>
                  <button onClick={() => setShowBrandingPanel(false)} className="rounded p-1 text-[#6B7280] hover:bg-white"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {defaultBrandingThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setFormBrandingTheme(theme.id)}
                      className={`rounded-xl border-2 p-3 text-start transition-all ${formBrandingTheme === theme.id ? "border-[#1276E3] ring-2 ring-[#1276E3]/20 bg-white" : "border-[#E5E7EB] hover:border-[#D1D5DB] bg-white"}`}
                    >
                      {/* Mini preview */}
                      <div className="rounded-lg border border-[#E5E7EB] overflow-hidden mb-2" style={{ height: "60px" }}>
                        <div className="h-3" style={{ backgroundColor: theme.primaryColor }} />
                        <div className="px-2 py-1">
                          <div className="flex justify-between">
                            <div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                            <div className="w-5 h-1.5 rounded-full bg-[#E5E7EB]" />
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {[1, 2, 3].map((n) => <div key={n} className="h-0.5 rounded-full bg-[#F3F4F6]" style={{ width: `${100 - n * 15}%` }} />)}
                          </div>
                        </div>
                        <div className="h-2 mt-auto" style={{ backgroundColor: theme.accentColor + "15" }} />
                      </div>
                      <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{theme.name}</p>
                      <p className="text-xs text-[#9CA3AF] capitalize">{theme.layout}</p>
                      {formBrandingTheme === theme.id && <CheckCircle2 className="h-4 w-4 text-[#1276E3] mt-1" />}
                    </button>
                  ))}
                </div>
                {/* Theme settings */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 pt-3 border-t border-[#E5E7EB]">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#6B7280]">شعار الشركة</Label>
                    <button className="w-full rounded-lg border border-dashed border-[#E5E7EB] p-3 text-center hover:border-[#1276E3]/40 transition-colors">
                      <Image className="h-5 w-5 text-[#9CA3AF] mx-auto mb-1" />
                      <p className="text-xs text-[#6B7280]">رفع الشعار</p>
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#6B7280]">لون رئيسي</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={currentTheme.primaryColor} className="w-8 h-8 rounded border border-[#E5E7EB] cursor-pointer" readOnly />
                      <span className="text-xs font-english text-[#6B7280]">{currentTheme.primaryColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#6B7280]">نص التذييل</Label>
                    <Input value={currentTheme.footerText} className="text-sm" readOnly placeholder="مثال: شكراً لتعاملكم معنا" />
                  </div>
                </div>
              </div>
            )}

            {/* ═══ UX-10: Document Management Panel ═══ */}
            {showDocPanel && (
              <div className="mb-6 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-[#1276E3]" />
                    <h3 className="text-sm text-[#0B1B49]" style={{ fontWeight: 700 }}>إدارة المستندات</h3>
                    <span className="text-xs font-english text-[#9CA3AF]">({attachments.length} ملف)</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="rounded-md bg-[#1276E3] px-3 py-1.5 text-xs text-white hover:bg-[#1060C0] flex items-center gap-1" style={{ fontWeight: 600 }}><Upload className="h-3.5 w-3.5" />رفع ملف</button>
                    <button onClick={() => setShowDocPanel(false)} className="rounded p-1 text-[#6B7280] hover:bg-white"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(e) => { if (e.target.files) processDroppedFiles(Array.from(e.target.files)); }} />

                {attachments.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-[#E5E7EB] p-8 text-center">
                    <Upload className="h-8 w-8 text-[#9CA3AF] mx-auto mb-2" />
                    <p className="text-sm text-[#6B7280]" style={{ fontWeight: 500 }}>اسحب ملفات هنا أو <button onClick={() => fileInputRef.current?.click()} className="text-[#1276E3] hover:underline">تصفح</button></p>
                    <p className="text-xs text-[#9CA3AF] mt-1">PDF، صور، Excel، Word — حتى 25MB لكل ملف</p>
                    <div className="flex justify-center gap-4 mt-3">
                      {(["فاتورة", "عقد", "إيصال"] as const).map((cat) => <span key={cat} className="text-xs text-[#9CA3AF] border border-[#E5E7EB] rounded-full px-2 py-0.5">{cat}</span>)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((file, i) => {
                      const Icon = fileTypeIcon(file.type);
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 hover:shadow-sm transition-all">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${file.type === "pdf" ? "bg-[#FEE2E2]" : file.type === "image" ? "bg-[#DBEAFE]" : file.type === "excel" ? "bg-[#DCFCE7]" : "bg-[#F3F4F6]"}`}>
                            <Icon className={`h-5 w-5 ${file.type === "pdf" ? "text-[#EF4444]" : file.type === "image" ? "text-[#1276E3]" : file.type === "excel" ? "text-[#22C55E]" : "text-[#6B7280]"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#0B1B49] truncate" style={{ fontWeight: 500 }}>{file.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-english text-[#9CA3AF]">{file.size}</span>
                              <select value={file.category} onChange={(e) => setAttachments((p) => p.map((a, j) => j === i ? { ...a, category: e.target.value as Attachment["category"] } : a))} className="text-xs border-0 bg-transparent text-[#6B7280] focus:outline-none cursor-pointer p-0">
                                {(["فاتورة", "عقد", "إيصال", "أخرى"] as const).map((c) => <option key={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                          {/* OCR Status */}
                          {file.ocrStatus === "processing" && (
                            <div className="flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-2.5 py-1">
                              <Scan className="h-3.5 w-3.5 text-[#F59E0B] animate-pulse" />
                              <span className="text-xs text-[#92400E]" style={{ fontWeight: 500 }}>يقرأ...</span>
                            </div>
                          )}
                          {file.ocrStatus === "done" && file.ocrData && (
                            <button onClick={() => applyOcrData(file)} className="flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 hover:bg-[#BBF7D0] transition-colors">
                              <Sparkles className="h-3.5 w-3.5 text-[#22C55E]" />
                              <span className="text-xs text-[#166534]" style={{ fontWeight: 600 }}>تطبيق OCR ({file.ocrData.length} بند)</span>
                            </button>
                          )}
                          <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="rounded p-1 text-[#D1D5DB] hover:text-[#EF4444] hover:bg-red-50 transition-colors shrink-0"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Line Items Table ── */}
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
                    const isDragTarget = dragOverIndex === i && dragIndex !== i;
                    return (
                      <tr
                        key={item.id}
                        className={`border-b transition-all ${isDragTarget ? "border-t-2 border-t-[#1276E3] bg-[#EFF6FF]" : "border-[#F3F4F6]"} ${dragIndex === i ? "opacity-40" : ""} ${isActive ? "bg-white" : "bg-[#FAFBFC]"}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDrop={() => handleDrop(i)}
                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      >
                        {visibleCols.some((c) => c.key === "drag") && (<td className="py-1.5 pe-1 cursor-grab active:cursor-grabbing"><GripVertical className={`h-4 w-4 transition-colors ${isActive ? "text-[#9CA3AF]" : "text-[#E5E7EB]"} hover:text-[#6B7280]`} /></td>)}
                        {visibleCols.some((c) => c.key === "item") && (<td className="py-1.5 pe-2"><ItemSearchInput value={item.product} onChange={(name, cat) => handleItemSelect(i, name, cat)} placeholder="ابحث عن صنف..." className="min-w-[140px]" /></td>)}
                        {visibleCols.some((c) => c.key === "description") && (<td className="py-1.5 pe-2"><input value={item.description} onChange={(e) => updateLineItem(i, "description", e.target.value)} placeholder="الوصف" className="w-full rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20" /></td>)}
                        {visibleCols.some((c) => c.key === "qty") && (<td className="py-1.5 pe-2"><input type="number" value={item.qty || ""} onChange={(e) => updateLineItem(i, "qty", +e.target.value)} className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm font-english text-center focus:border-[#1276E3] focus:outline-none" dir="ltr" min={0} /></td>)}
                        {visibleCols.some((c) => c.key === "price") && (<td className="py-1.5 pe-2"><input type="number" value={item.price || ""} onChange={(e) => updateLineItem(i, "price", +e.target.value)} className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm font-english text-end focus:border-[#1276E3] focus:outline-none" dir="ltr" min={0} /></td>)}
                        {visibleCols.some((c) => c.key === "discount") && (<td className="py-1.5 pe-2"><input type="number" value={item.discount || ""} onChange={(e) => updateLineItem(i, "discount", +e.target.value)} className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm font-english text-center focus:border-[#1276E3] focus:outline-none" dir="ltr" min={0} max={100} placeholder="%" /></td>)}
                        {visibleCols.some((c) => c.key === "account") && (<td className="py-1.5 pe-2"><AccountSelect value={item.account} onChange={(code) => updateLineItem(i, "account", code)} placeholder="حساب" className="min-w-[130px]" filterCategories={["الإيرادات", "المصروفات"]} /></td>)}
                        {visibleCols.some((c) => c.key === "taxRate") && (<td className="py-1.5 pe-2"><TaxRateSelect value={item.taxRate} onChange={(rate) => updateLineItem(i, "taxRate", rate)} type="sales" className="min-w-[80px]" /></td>)}
                        {visibleCols.some((c) => c.key === "taxAmount") && (<td className="py-1.5 pe-2 text-end"><span className="text-sm font-english text-[#6B7280]">{isActive ? lineTax.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ""}</span></td>)}
                        {visibleCols.some((c) => c.key === "project") && (<td className="py-1.5 pe-2"><select value={item.project} onChange={(e) => updateLineItem(i, "project", e.target.value)} className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm focus:border-[#1276E3] focus:outline-none">{projects.map((p) => <option key={p} value={p}>{p || "—"}</option>)}</select></td>)}
                        {visibleCols.some((c) => c.key === "amount") && (<td className="py-1.5 pe-2 text-end"><span className="text-sm font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{isActive ? lineAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ""}</span></td>)}
                        {visibleCols.some((c) => c.key === "delete") && (<td className="py-1.5">{isActive && (<button onClick={() => removeLineItem(i)} className="rounded p-1 text-[#D1D5DB] hover:text-[#EF4444] hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>)}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Bottom actions ── */}
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#F3F4F6]">
              <div className="flex items-center gap-1">
                <button onClick={addLineItem} className="rounded-md border border-[#1276E3] bg-white px-3 py-1.5 text-xs text-[#1276E3] hover:bg-[#EFF6FF]" style={{ fontWeight: 600 }}>إضافة سطر</button>
                <button onClick={() => { for (let k = 0; k < 5; k++) addLineItem(); }} className="rounded-md border border-[#E5E7EB] bg-white p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><ChevronDown className="h-3.5 w-3.5" /></button>
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
            </div>

            {/* ── Smart Paste hint ── */}
            {showPastePanel && !pastePreview && (
              <div className="mt-3 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] p-4">
                <div className="flex items-start gap-3">
                  <ClipboardPaste className="h-5 w-5 text-[#1276E3] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>اللصق الذكي (Smart Paste)</p>
                    <p className="text-xs text-[#6B7280] mt-1">انسخ بيانات من <span className="font-english" style={{ fontWeight: 600 }}>Excel</span> أو جدول مفصول بـ Tab/فاصلة/منقوطة ثم اضغط <span className="font-english bg-[#F3F4F6] rounded px-1.5 py-0.5" style={{ fontWeight: 600 }}>Ctrl+V</span></p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#6B7280]">
                      <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />كشف تلقائي للأعمدة (headers)</div>
                      <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />دعم الأرقام العربية والعشرية</div>
                      <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />معاينة قبل التطبيق</div>
                      <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />ربط تلقائي بالأصناف الموجودة</div>
                    </div>
                  </div>
                  <button onClick={() => setShowPastePanel(false)} className="rounded p-1 text-[#6B7280] hover:bg-white"><X className="h-4 w-4" /></button>
                </div>
              </div>
            )}

            {/* ── Drop zone (always visible at bottom) ── */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const files = Array.from(e.dataTransfer.files); if (files.length) processDroppedFiles(files); }}
              className="mt-4 rounded-lg border-2 border-dashed border-[#E5E7EB] p-3 text-center hover:border-[#1276E3]/40 transition-colors"
            >
              <div className="flex items-center justify-center gap-3">
                <Upload className="h-4 w-4 text-[#9CA3AF]" />
                <p className="text-xs text-[#9CA3AF]">اسحب ملفات هنا • <button onClick={() => fileInputRef.current?.click()} className="text-[#1276E3] hover:underline">تصفح</button> • PDF / صور / Excel → AI OCR تلقائي</p>
              </div>
            </div>

            {/* ── Totals ── */}
            <div className="flex justify-end mt-6">
              <div className="w-80 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#6B7280]">المجموع الفرعي:</span><span dir="ltr" className="inline-flex items-baseline gap-1 font-english" style={{ fontVariantNumeric: "tabular-nums" }}><span className="text-[#9CA3AF]" style={{ fontSize: "0.6875rem" }}>{CUR}</span><span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">ضريبة القيمة المضافة:</span><span dir="ltr" className="inline-flex items-baseline gap-1 font-english" style={{ fontVariantNumeric: "tabular-nums" }}><span className="text-[#9CA3AF]" style={{ fontSize: "0.6875rem" }}>{CUR}</span><span>{taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span></div>
                <div className="border-t border-[#E5E7EB] pt-2 flex justify-between text-[#0B1B49]" style={{ fontWeight: 700, fontSize: "1.125rem" }}>
                  <span>الإجمالي:</span>
                  <span dir="ltr" className="inline-flex items-baseline gap-1.5"><span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span><span className="font-english" style={{ fontVariantNumeric: "tabular-nums" }}>{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Notes & Payment Terms ── */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="ملاحظات إضافية..." className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm min-h-[80px] focus:border-[#1276E3] focus:outline-none focus:ring-2 focus:ring-[#1276E3]/20" />
              </div>
              <div className="space-y-2">
                <Label>شروط الدفع</Label>
                <select value={formPaymentTerms} onChange={(e) => setFormPaymentTerms(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-2 focus:ring-[#1276E3]/20"><option>صافي 30 يوم</option><option>صافي 15 يوم</option><option>صافي 60 يوم</option><option>فوري</option></select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     VIEW: Invoice List — Assets-style KPI + 3-dot menu + filter dropdown
     ════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>فواتير المبيعات</h1>
          <p className="text-[#6B7280] mt-1">إصدار وإدارة فواتير المبيعات</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={handleCreate}><Plus className="me-2 h-4 w-4" />فاتورة جديدة</Button>
      </div>

      {/* ── KPI Cards — Assets style ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB] cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all" onClick={() => {}}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><FileText className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{invoices.length}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الفواتير</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all" onClick={() => {}}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><DollarSign className="h-5 w-5 text-[#1276E3]" /></div></div>
            <span dir="ltr" className="inline-flex items-baseline gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{invoices.reduce((s, i) => s + i.amountNum, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </span>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي المبالغ</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all" onClick={() => setStatusFilter("paid")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><TrendingUp className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <span dir="ltr" className="inline-flex items-baseline gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{invoices.filter((i) => i.status === "مدفوعة").reduce((s, i) => s + i.amountNum, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </span>
            <p className="text-xs text-[#6B7280] mt-1">المدفوع</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all" onClick={() => setStatusFilter("overdue")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><AlertCircle className="h-5 w-5 text-[#349FC4]" /></div></div>
            <span dir="ltr" className="inline-flex items-baseline gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{invoices.filter((i) => i.status === "متأخرة").reduce((s, i) => s + i.amountNum, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </span>
            <p className="text-xs text-[#6B7280] mt-1">المتأخر</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Invoice Table ── */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة الفواتير</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input placeholder="بحث باسم العميل..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              {/* Filter dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`rounded-lg border p-2 transition-colors ${statusFilter ? "bg-[#EFF6FF] border-[#1276E3] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"}`}
                >
                  <Filter className="h-4 w-4" />
                </button>
                {showFilterDropdown && (
                  <div className="absolute end-0 z-40 mt-1 w-44 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    {Object.entries(statusFilterLabels).map(([val, label]) => (
                      <button key={val} onClick={() => { setStatusFilter(val); setShowFilterDropdown(false); }}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${statusFilter === val ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: statusFilter === val ? 600 : 400 }}>{label}</button>
                    ))}
                    {statusFilter && (<><div className="border-t border-[#F3F4F6] my-1" /><button onClick={() => { setStatusFilter(""); setShowFilterDropdown(false); }} className="w-full text-start px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30">مسح الفلتر</button></>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Active filter */}
          {statusFilter && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-[#6B7280]">فلتر نشط:</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                {statusFilterLabels[statusFilter]}
                <button onClick={() => setStatusFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "850px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-4 text-start" style={{ width: "40px" }}><Checkbox /></th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "130px" }}>رقم الفاتورة</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>العميل</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>تاريخ الإصدار</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>الاستحقاق</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>المبلغ (SR)</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "90px" }}>الحالة</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "60px" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-4"><Checkbox /></td>
                    <td className="py-3.5 pe-4"><button onClick={() => handleView(inv)} className="text-sm font-english text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{inv.id}</button></td>
                    <td className="py-3.5 pe-4"><Link to={contactLink(inv.customer) || ""} className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors">{inv.customer}</Link></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{inv.invoiceDate}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{inv.dueDate}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#374151]" style={{ fontWeight: 600 }}>{inv.amount}</span></td>
                    <td className="py-3.5 pe-4"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs cursor-pointer border transition-colors ${statusStyle(inv.status)}`} style={{ fontWeight: 600 }}>{inv.status}</span></td>
                    {/* Three-dot menu */}
                    <td className="py-3.5">
                      <div className="relative" ref={actionMenuId === inv.id ? actionMenuRef : undefined}>
                        <button onClick={() => setActionMenuId(actionMenuId === inv.id ? null : inv.id)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><MoreVertical className="h-4 w-4" /></button>
                        {actionMenuId === inv.id && (
                          <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <button onClick={() => { handleView(inv); setActionMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</button>
                            <button onClick={() => { handleEdit(inv); setActionMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Edit2 className="h-3.5 w-3.5 text-[#6B7280]" />تعديل</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Copy className="h-3.5 w-3.5 text-[#6B7280]" />نسخ</button>
                            <div className="border-t border-[#F3F4F6] my-1" />
                            <button onClick={() => { handleDelete(inv.id); setActionMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start"><Trash2 className="h-3.5 w-3.5" />حذف</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F6] mt-2">
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#6B7280]">عرض <span className="font-english">{Math.min(perPage, filteredInvoices.length)}</span> من <span className="font-english">{filteredInvoices.length}</span> فاتورة</p>
              <div className="relative">
                <button onClick={() => setShowPerPageDropdown(!showPerPageDropdown)} className="rounded-md border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] flex items-center gap-1">
                  <span className="font-english">{perPage}</span> في الصفحة <ChevronDown className="h-3 w-3" />
                </button>
                {showPerPageDropdown && (
                  <div className="absolute bottom-full mb-1 start-0 z-40 w-32 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    {[20, 50, 100, 200].map((n) => (
                      <button key={n} onClick={() => { setPerPage(n); setShowPerPageDropdown(false); }}
                        className={`w-full text-start px-3 py-1.5 text-sm font-english ${perPage === n ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: perPage === n ? 600 : 400 }}>{n} في الصفحة</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {filteredInvoices.length > perPage && (
              <button onClick={() => setPerPage(filteredInvoices.length)} className="text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>عرض جميع الفواتير</button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
