import { displayDigits, displayLocale } from "../lib/number-display";
/**
 * Sales Invoices · wired to /api/invoices · org-scoped
 * UX-1: NO modal · NO slide-over.
 * UX pattern: FullPageForm (replaces content area on create/sign · مطابق Wafeq) + InlineConfirm + Toasts.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Plus, Search, Trash2, Loader2, FileText, FileSignature, Split, Pencil, Printer, LockKeyhole, Eye } from "lucide-react";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, InlineAlert, Metric, MetricStrip, PageHeader, PageToolbar } from "../components/product";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { BranchField } from "../components/branch-field";
import { ProjectField } from "../components/project-field";
import { useFormDraft } from "../lib/form-draft";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode, computeTotals } from "../components/items-table";
import { DocumentDropZone, type ExtractedDocument } from "../components/document-dropzone";
import { QuickCreateAccount, QuickCreateProduct } from "../components/quick-create-modals";
import { QuickContactDialog } from "../components/quick-contact-dialog";
import { normalizeDigits } from "../lib/digits";
import { useKeyboardShortcuts } from "../lib/use-keyboard-shortcuts";
import { api, getOrgId, Invoice, Contact, DocumentSendRecord } from "../lib/api";
import { SendComposeForm } from "../components/send-compose-form";
import { displayName } from "../lib/display-name";
import { useReturnTo } from "../lib/use-return-to";
import { useLanguage } from "../components/LanguageContext";
import { humanizeError } from "../lib/error-messages";
import { useOrgRegion } from "../lib/use-org-region";
import { IssuedInvoiceRecord } from "../components/issued-invoice-record";
import { InvoicePreviewPane } from "../components/invoice-preview-pane";
import { BidiText } from "../components/bidi-text";

/** Desktop-only split view · ≥1280px shows the paper preview beside the list. */
function useWideViewport() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1536px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1536px)"); // split view needs ~800px for the list beside a 380px+ panel
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, APPROVED: { ar: "معتمدة", en: "Approved" }, SENT: { ar: "مرسلة", en: "Sent" }, VIEWED: { ar: "مُشاهَدة", en: "Viewed" }, PAID: { ar: "مدفوعة", en: "Paid" },
  PARTIAL: { ar: "مدفوعة جزئياً", en: "Partially paid" }, OVERDUE: { ar: "متأخرة", en: "Overdue" }, CANCELLED: { ar: "ملغاة", en: "Cancelled" },
};
/** Ledger status colour · paid/approved = blue (success) · overdue/partial = copper (warning) · draft = muted */
function statusToneClass(status: string, lateDays = 0) {
  if (lateDays > 0 && status !== "PAID" && status !== "CANCELLED") return "text-warning";
  if (status === "PAID" || status === "APPROVED") return "text-success";
  if (status === "OVERDUE" || status === "PARTIAL") return "text-warning";
  if (status === "DRAFT" || status === "CANCELLED") return "text-muted-foreground";
  return "text-content-secondary";
}

/** Days past the due date for a still-unpaid invoice (0 = not late). */
function overdueDays(inv: Invoice) {
  if (!inv.dueDate || inv.status === "PAID" || inv.status === "CANCELLED" || inv.status === "DRAFT") return 0;
  const due = new Date(String(inv.dueDate).slice(0, 10)).getTime();
  if (Number.isNaN(due)) return 0;
  const days = Math.floor((Date.now() - due) / 86400000);
  return days > 0 ? days : 0;
}

/** Ledger figure: large integer part, small muted fraction (never a serif for Arabic). */
function Figure({ value }: { value: number }) {
  const [int, frac] = Math.abs(value).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(".");
  return <>{value < 0 ? "-" : ""}{int}<small>.{frac}</small></>;
}

const EMPTY_FORM = {
  contactId: "",
  invoiceNumber: "", // auto-generated if empty
  supplyDate: "",
  reference: "",     // customer PO / external reference
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  currency: "SAR",
  paymentTerms: "net30", // net15 | net30 | net60 | due-on-receipt | custom
  brandTemplate: "default",
  notes: "",
  // Brand document template (id) · "" = org default for INVOICE · 2026-09-08
  templateId: "",
  // Terms & conditions · per-document override · prefilled from the template on create
  termsConditions: "",
  // Branch dimension (B1) · undefined = apply member default · null = none
  branchId: undefined as string | null | undefined,
  // Project / job-costing dimension (C2)
  projectId: null as string | null,
};

const PAYMENT_TERMS = [
  { value: "due-on-receipt", label: { ar: "مستحق فور الاستلام", en: "Due on receipt" }, days: 0 },
  { value: "net15", label: { ar: "صافي 15 يوم", en: "Net 15 days" }, days: 15 },
  { value: "net30", label: { ar: "صافي 30 يوم", en: "Net 30 days" }, days: 30 },
  { value: "net60", label: { ar: "صافي 60 يوم", en: "Net 60 days" }, days: 60 },
  { value: "net90", label: { ar: "صافي 90 يوم", en: "Net 90 days" }, days: 90 },
];

const CURRENCIES = [
  { value: "SAR", label: { ar: "ريال سعودي · SAR", en: "Saudi Riyal · SAR" } },
  { value: "USD", label: { ar: "دولار أمريكي · USD", en: "US Dollar · USD" } },
  { value: "EUR", label: { ar: "يورو · EUR", en: "Euro · EUR" } },
  { value: "GBP", label: { ar: "جنيه إسترليني · GBP", en: "British Pound · GBP" } },
  { value: "AED", label: { ar: "درهم إماراتي · AED", en: "UAE Dirham · AED" } },
  { value: "KWD", label: { ar: "دينار كويتي · KWD", en: "Kuwaiti Dinar · KWD" } },
];

const BRAND_TEMPLATES = [
  { value: "default", label: { ar: "افتراضي", en: "Default" } },
  { value: "minimal", label: { ar: "مينيمال", en: "Minimal" } },
  { value: "classic", label: { ar: "كلاسيكي", en: "Classic" } },
];

export function Invoices() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Invoice[]>([]);
  const [billingTotals, setBillingTotals] = useState<Record<string, { total: number; paid: number; outstanding: number }> | null>(null);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { language } = useLanguage();
  const { isUS, currency: orgCurrency } = useOrgRegion();
  const defaultTaxRate = isUS ? 0 : 0.15; // US orgs default to 0% sales tax
  const [searchQuery, setSearchQuery] = useState("");
  // Deep-link support (2026-08-28): dashboard KPI tiles link here with
  // ?status=PAID / ?status=OVERDUE, so the list opens already filtered to the
  // number the user clicked instead of dumping every invoice on them.
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    return s ? s.toUpperCase() : "ALL";
  });

  // Side-panel state for create + sign capture (NO Dialog)
  const [createOpen, setCreateOpen] = useState(false);
  const { goBack: goBackToSource } = useReturnTo();
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Multi-line items · UX-5 · Excel paste + bulk tax mode
  const [lines, setLines] = useState<InvoiceLine[]>([newLine(defaultTaxRate)]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");
  // PR5-B · prefilled invoice number is only sent when the USER edited it;
  // otherwise the server allocates a collision-proof number (kills duplicate_invoice_number)
  const [numberEdited, setNumberEdited] = useState(false);
  const numberRetryRef = useRef(false);
  // PR5-C · line ids that failed validation → rendered red in ItemsTable
  const [invalidLineIds, setInvalidLineIds] = useState<Set<string>>(new Set());

  // Quick-create modals (UX-77) · open promise-based · resolve when user saves
  const [quickProductReq, setQuickProductReq] = useState<{
    name: string;
    resolve: (p: any) => void;
    reject: () => void;
  } | null>(null);
  const [quickAccountReq, setQuickAccountReq] = useState<{
    name: string;
    resolve: (a: any) => void;
    reject: () => void;
  } | null>(null);

  const [signFor, setSignFor] = useState<Invoice | null>(null);
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  // Send compose page (W-SEND · 2026-09-08) · never auto-fires an email — the
  // CEO must see + edit the message before it goes out.
  const [sendComposeFor, setSendComposeFor] = useState<{ invoice: Invoice; prefill?: DocumentSendRecord } | null>(null);
  const [sendLogRefresh, setSendLogRefresh] = useState(0);
  // Locale-pure defaults (CEO 2026-08-25): a US company never opens on SAR / 15% VAT.
  // Applies only while the form still carries the untouched SAR default and no invoice is being edited.
  useEffect(() => {
    if (!createOpen || editingInvoice || !orgCurrency) return;
    if (form.currency === EMPTY_FORM.currency && orgCurrency !== EMPTY_FORM.currency) setForm((f) => ({ ...f, currency: orgCurrency }));
    if (isUS) setLines((ls) => ls.map((l) => (l.taxRate === 0.15 && !l.productId && !l.description ? { ...l, taxRate: 0 } : l)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, orgCurrency, isUS, editingInvoice]);
  // Draft protection · autosave + leave guards (CEO 2026-08-25 · never lose a typed invoice)
  const draft = useFormDraft({
    key: editingInvoice ? `invoice:${editingInvoice.id}` : "invoice:new",
    open: createOpen,
    snapshot: { form, lines, taxMode },
    restore: (s) => { setForm(s.form); setLines(s.lines); setTaxMode(s.taxMode); },
  });
  const [previewOpen, setPreviewOpen] = useState(true);
  // Brand document templates for the INVOICE kind (BOTH counts) · selector + terms prefill
  const [docTemplates, setDocTemplates] = useState<any[]>([]);
  useEffect(() => {
    if (!createOpen) return;
    api.documentTemplates.list({ kind: "INVOICE" }).then((r) => setDocTemplates(r.items)).catch(() => setDocTemplates([]));
  }, [createOpen]);
  // New invoice → prefill terms + template from the org default (the user may edit or clear them)
  useEffect(() => {
    if (!createOpen || editingInvoice) return;
    let alive = true;
    api.documentTemplates.defaults().then((d) => {
      const tpl = d.INVOICE;
      if (!alive || !tpl) return;
      setForm((prev: any) => (prev.termsConditions || prev.templateId) ? prev : { ...prev, templateId: tpl.id, termsConditions: tpl.showTerms === false ? "" : (tpl.terms || "") });
    }).catch(() => { /* no default template · terms stay empty */ });
    return () => { alive = false; };
  }, [createOpen, editingInvoice]);
  const [signForm, setSignForm] = useState({ name: "", email: "", message: "" });
  const [signError, setSignError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingApprove, setPendingApprove] = useState<string | null>(null);

  // Split view (list ⟷ paper preview) · desktop only · read-only, never a dialog (UX-1)
  const wideViewport = useWideViewport();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFull, setSelectedFull] = useState<Invoice | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [seller, setSeller] = useState<{ name: string; vatNumber?: string | null } | null>(null);

  // Quick-create contact dialog (full form, not just name)
  const [pendingContact, setPendingContact] = useState<{ name: string; resolve: (id: string) => void; reject: () => void } | null>(null);


  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, contactsRes, productsRes, accountsRes] = await Promise.all([
        api.invoices.list({ limit: 200, ...(sourceFilter === "entix.io" ? { source: "entix.io" } : {}) }),
        api.contacts.list({ limit: 200 }),
        (api as any).products?.list?.({ limit: 200 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
        (api as any).accounts?.list?.({ limit: 500 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
      ]);
      setItems(invRes.items);
      setBillingTotals(invRes.totalsByCurrency || null);
      setInvoiceCount(invRes.total);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
      setProducts((productsRes as any).items || []);
      setAccounts((accountsRes as any).items || []);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
    } finally { setLoading(false); }
  }, [push, sourceFilter]);
  useEffect(() => { refresh(); }, [refresh]);

  // PR5-D · a payment recorded on the receipts page must be visible as soon as
  // the user returns to this window/tab — no more "click edit to see it".
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // PR5-C · clear the red line highlight as soon as the user edits any line
  useEffect(() => {
    setInvalidLineIds((prev) => (prev.size ? new Set() : prev));
  }, [lines]);

  // Auto-open create form when /new or ?new=1 (from Sales Dashboard quick-create)
  useEffect(() => {
    if (location.pathname.endsWith("/new") || searchParams.get("new") === "1") {
      const prefillContact = searchParams.get("contactId") || "";
      setForm(prefillContact ? { ...EMPTY_FORM, contactId: prefillContact } : EMPTY_FORM);
      setLines([newLine(defaultTaxRate)]);
      setTaxMode("all-exclusive");
      setCreateError(null);
      setNumberEdited(false);
      numberRetryRef.current = false;
      setEditingInvoice(null);
      setCreateOpen(true);
      // Clean the query URL after opening, but keep canonical /new routes stable.
      if (searchParams.get("new") === "1") setSearchParams({}, { replace: true });
    }
  }, [location.pathname, searchParams, setSearchParams]);

  // Deep link · /app/invoices/:id (from contact-detail, receipts, search) → open THAT
  // invoice in edit view instead of dumping the user back on the bare list.
  useEffect(() => {
    const m = location.pathname.match(/\/app\/(?:sales\/)?invoices\/([^/]+)/);
    const id = m?.[1];
    // "/new" is the create route, not an id — the deep-link loader used to fire
    // GET /api/invoices/new (404 + console error) on every open of the form.
    if (!id || id === "new" || editingInvoice?.id === id || createOpen) return;
    const row = items.find((x) => x.id === id);
    if (row) { openEdit(row); return; }
    api.invoices.get(id)
      .then((full) => openEdit(full as Invoice))
      .catch(() => { /* unknown/stale id → stay on the list */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, items]);

  // Per-contact filter · /app/invoices?contactId=<id> shows only that contact's invoices
  const contactFilterId = searchParams.get("contactId") || "";
  const contactFilterName = contactFilterId ? (customers.find((c) => c.id === contactFilterId)?.displayName || "") : "";

  // B1 · /app/invoices?branchId=<id|none> (deep-link from branch reports)
  const branchFilterId = searchParams.get("branchId") || "";
  const projectFilterId = searchParams.get("projectId") || "";
  const filtered = items.filter(i => {
    if (contactFilterId && i.contactId !== contactFilterId) return false;
    if (branchFilterId && (branchFilterId === "none" ? !!i.branchId : i.branchId !== branchFilterId)) return false;
    if (projectFilterId && (projectFilterId === "none" ? !!i.projectId : i.projectId !== projectFilterId)) return false;
    if (filterStatus !== "ALL" && i.status !== filterStatus) return false;
    if (searchQuery) return i.invoiceNumber.includes(searchQuery) || (i.contact?.displayName || "").includes(searchQuery);
    return true;
  });

  const totalsByCurrency = billingTotals || items.filter(i => !['DRAFT', 'CANCELLED'].includes(i.status)).reduce((groups: Record<string, { total: number; paid: number; outstanding: number }>, i) => {
    const row = groups[i.currency || orgCurrency] ||= { total: 0, paid: 0, outstanding: 0 };
    row.total += Number(i.total); row.paid += Number(i.amountPaid || 0); row.outstanding += Number(i.total) - Number(i.amountPaid || 0);
    return groups;
  }, {});
  // Ledger figure per currency (main 2026-09 keeps currency totals separate — never summed across currencies).
  const currencyFigure = (key: 'total' | 'paid' | 'outstanding') => {
    const entries = Object.entries(totalsByCurrency);
    if (!entries.length) return <span className="flex flex-col gap-1"><span><Figure value={0} /><small className="ms-1 text-[0.45em] text-content-secondary">{orgCurrency}</small></span></span>;
    return <span className="flex flex-col gap-1">{entries.map(([currency, value]) => <span key={currency}><Figure value={value[key]} /><small className="ms-1 text-[0.45em] text-content-secondary">{currency}</small></span>)}</span>;
  };
  const counts = items.reduce((acc: Record<string, number>, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});
  // Ledger figures strip · derived from the same list, no extra API call.
  const overdueAmount = items.reduce((s, i) => (overdueDays(i) > 0 || i.status === "OVERDUE" ? s + (Number(i.total) - Number(i.amountPaid || 0)) : s), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const collectedThisMonth = items.reduce((s, i) => (String(i.issueDate || "").slice(0, 7) === thisMonth ? s + Number(i.amountPaid || 0) : s), 0);
  // Filter chips · always the core five, plus any other status actually present.
  const chipStatuses = ["DRAFT", "SENT", "OVERDUE", "PAID", ...Object.keys(counts).filter((s) => !["DRAFT", "SENT", "OVERDUE", "PAID"].includes(s) && counts[s] > 0)];
  const chips = [
    { value: "ALL", label: t("الكل", "All"), count: items.length },
    ...chipStatuses.map((s) => ({
      value: s,
      label: STATUS_LABELS[s] ? t(STATUS_LABELS[s].ar, STATUS_LABELS[s].en) : s,
      count: counts[s] || 0,
    })),
  ];

  // Split view · "من" block of the paper document = the active organisation
  useEffect(() => {
    let alive = true;
    api.orgs.list().then((orgs: any[]) => {
      if (!alive) return;
      const active = orgs.find((o) => o.id === getOrgId()) || orgs[0];
      if (active) setSeller({ name: active.legalName || active.name, vatNumber: active.vatNumber });
    }).catch(() => { /* preview simply shows no seller block */ });
    return () => { alive = false; };
  }, []);

  // Split view · keep a row selected while the list is wide enough for the panel
  const filteredKey = filtered.map((i) => i.id).join(",");
  useEffect(() => {
    if (!wideViewport) { setSelectedId(null); return; }
    setSelectedId((prev) => (prev && filtered.some((i) => i.id === prev) ? prev : filtered[0]?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wideViewport, filteredKey]);

  // Split view · list rows carry no lines → fetch the selected invoice once (read-only)
  useEffect(() => {
    if (!selectedId) { setSelectedFull(null); return; }
    const row = items.find((i) => i.id === selectedId) || null;
    setSelectedFull(row);
    if (row?.lines && (row.lines as any[]).length) return;
    let alive = true;
    setSelectedLoading(true);
    api.invoices.get(selectedId)
      .then((full) => { if (alive) setSelectedFull(full as Invoice); })
      .catch(() => { /* keep the row-level summary */ })
      .finally(() => { if (alive) setSelectedLoading(false); });
    return () => { alive = false; };
  }, [selectedId, items]);

  const openCreate = () => {
    const prefillContact = searchParams.get("contactId") || "";
    setForm(prefillContact ? { ...EMPTY_FORM, contactId: prefillContact } : EMPTY_FORM);
    setLines([newLine(defaultTaxRate)]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setNumberEdited(false);
    numberRetryRef.current = false;
    setInvalidLineIds(new Set());
    setEditingInvoice(null);
    setCreateOpen(true);
    // Auto-fetch next invoice number so user sees it immediately (editable)
    api.invoices.nextNumber().then(({ number }) => {
      setForm((f: any) => ({ ...f, invoiceNumber: number }));
    }).catch(() => { /* silent · falls back to placeholder */ });
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    setEditingInvoice(null);
    // Opened from another page (contact file etc.) → go back there
    if (goBackToSource()) return;
    // If we were on a deep link (/app/invoices/:id), return to the canonical list
    if (/\/invoices\/[^/]+/.test(location.pathname)) {
      navigate("/app/invoices", { replace: true });
    }
  };

  // Keyboard shortcuts (UX-7) · skip when create form is open · those have own Esc handler
  useKeyboardShortcuts({
    n: () => { if (!createOpen && !signFor) openCreate(); },
    "/": () => {
      const search = document.querySelector<HTMLInputElement>('input[placeholder="بحث..."], input[placeholder="Search..."]');
      search?.focus();
    },
  }, [createOpen, signFor]);

  // 3-stage workflow: Draft → Approve → Send
  // 'draft' = حفظ كمسودة (always available · default)
  // 'approve' = اعتماد (final commit · enables send · backend will lock edits)
  // 'send' = إرسال (only after approval · triggers email)
  /** «معاينة كاملة» for a NEW invoice · saves a draft first (a document needs an id) then opens the print view in a new tab */
  const handleFullPreview = async () => {
    const win = window.open("", "_blank", "noopener");
    const inv = await handleSubmit("draft");
    if (!inv) { win?.close(); return; }
    const url = `/print/invoice/${inv.id}?noprint=1${form.templateId ? `&templateId=${form.templateId}` : ""}`;
    if (win) win.location.href = url; else window.open(url, "_blank", "noopener");
  };

  const handleSubmit = async (action: "draft" | "approve" | "send" = "draft"): Promise<Invoice | null | undefined> => {
    setCreateError(null);
    if (editingInvoice && editingInvoice.status !== "DRAFT") { setCreateError(t("الفاتورة صادرة ومقفلة", "This issued invoice is locked")); return; }
    if (!form.contactId) { setCreateError(t("اختر العميل", "Select a customer")); return; }

    const activeLines = lines.filter((l) => {
      const qty = Number(normalizeDigits(l.quantity)) || 0;
      const price = Number(normalizeDigits(l.unitPrice)) || 0;
      return !!l.description.trim() || qty > 0 || price > 0 || !!l.productId || !!l.accountId;
    });
    if (activeLines.length === 0) {
      setCreateError(t("أضف بنداً واحداً على الأقل قبل الحفظ", "Add at least one line item before saving"));
      return;
    }

    const isLineComplete = (l: InvoiceLine) => {
      const qty = Number(normalizeDigits(l.quantity)) || 0;
      const price = Number(normalizeDigits(l.unitPrice)) || 0;
      return l.description.trim().length >= 3 && qty > 0 && price > 0;
    };
    const completeLines = activeLines.filter(isLineComplete);
    const incompleteActive = activeLines.filter((l) => !isLineComplete(l));

    // For approval/send: all active lines must be fully complete.
    // An explicit line account or a configured product mapping is required.
    if (action !== "draft" && incompleteActive.length > 0) {
      setInvalidLineIds(new Set(incompleteActive.map((l) => l.id)));
      setCreateError(t(`لا يمكن الاعتماد: ${incompleteActive.length} بند ناقص (موضّح بالأحمر) · كل بند يحتاج وصفاً واضحاً + كمية أكبر من صفر + سعراً أكبر من صفر`, `Cannot approve: ${incompleteActive.length} incomplete line(s) (highlighted in red) · each line needs a clear description + quantity greater than zero + price greater than zero`));
      return;
    }

    if (action !== "draft") {
      const missing = activeLines.filter(l => !l.accountId && !products.find(p => p.id === l.productId)?.incomeAccountId);
      if (missing.length) {
        setInvalidLineIds(new Set(missing.map(l => l.id)));
        // Account law (CEO 2026-09-08): the approve/send message names the real cause.
        setCreateError(t("لا يمكن اعتماد الفاتورة: لم تُسجَّل بنودها بالشكل الصحيح — اختر حسابًا لكل بند.", "Cannot approve: the lines were not recorded correctly — choose an account for every line."));
        return;
      }
    }

    // For draft we only persist completed lines to avoid إنشاء سطور ناقصة بالخطأ.
    const linesToPersist = action === "draft" ? completeLines : activeLines;
    if (linesToPersist.length === 0) {
      setInvalidLineIds(new Set(incompleteActive.map((l) => l.id)));
      setCreateError(t("لا يوجد بند مكتمل للحفظ · البند المكتمل = وصف + كمية + سعر (النواقص موضّحة بالأحمر)", "No complete line to save · a complete line = description + quantity + price (incomplete ones highlighted in red)"));
      return;
    }
    // PR5-C · surface skipped draft lines instead of dropping them silently
    const skippedCount = action === "draft" ? incompleteActive.length : 0;
    if (skippedCount > 0) setInvalidLineIds(new Set(incompleteActive.map((l) => l.id)));

    setBusy(true);
    try {
      // draft → DRAFT · approve → APPROVED · send → APPROVED first (SENT only after email succeeds)
      const status = action === "draft" ? "DRAFT" : "APPROVED";
      const buildPayload = (num?: string) => ({
        contactId: form.contactId,
        ...(num !== undefined ? { invoiceNumber: num } : {}),
        issueDate: form.issueDate,
        supplyDate: form.supplyDate || null,
        dueDate: form.dueDate,
        currency: form.currency,
        status,
        notes: form.notes || null,
        branchId: form.branchId ?? null,
        projectId: form.projectId ?? null,
        // Reference lives in its OWN column · terms are the per-document override (never packed together)
        reference: form.reference || null,
        termsConditions: form.termsConditions || null,
        templateId: form.templateId || null,
        lines: linesToPersist.map((l) => ({
          productId: l.productId || null,
          accountId: l.accountId || null, // only an intentional product mapping can supply a missing account
          taxRate: typeof l.taxRate === "number" ? l.taxRate : defaultTaxRate, // numeric rate · jurisdiction default
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: l.taxInclusive
            ? Number(normalizeDigits(l.unitPrice)) / (1 + l.taxRate)
            : Number(normalizeDigits(l.unitPrice)),
          // Revenue recognition · only sent when the line has a real schedule
          recognitionStartDate: l.recognitionStartDate || null,
          recognitionMonths: l.recognitionMonths ?? null,
          deferredRevenueAccountId: l.deferredRevenueAccountId || null,
        })),
      });
      const isEdit = !!editingInvoice;
      let inv: any;
      if (isEdit) {
        // UPDATE the existing invoice · number only when it actually changed
        const changedNumber = form.invoiceNumber && form.invoiceNumber !== editingInvoice!.invoiceNumber
          ? form.invoiceNumber
          : undefined;
        inv = await api.invoices.update(editingInvoice!.id, buildPayload(changedNumber) as any);
      } else {
        // PR5-B · the prefilled suggestion is NOT sent unless the user edited it.
        // Server-side allocation is collision-proof → kills duplicate_invoice_number.
        try {
          inv = await api.invoices.create(buildPayload(numberEdited ? form.invoiceNumber || undefined : undefined) as any);
        } catch (e: any) {
          if (e?.code === "duplicate_invoice_number" && !numberRetryRef.current) {
            // Number was taken meanwhile → retry once with server allocation + tell the user
            numberRetryRef.current = true;
            inv = await api.invoices.create(buildPayload(undefined) as any);
            push("info", t(`الرقم السابق كان محجوزاً · تم الحفظ برقم جديد ${inv.invoiceNumber}`, `The previous number was taken · saved with a new number ${inv.invoiceNumber}`));
          } else {
            throw e;
          }
        }
      }
      setItems(prev => isEdit ? prev.map((x) => (x.id === inv.id ? (inv as Invoice) : x)) : [inv as Invoice, ...prev]);
      if (skippedCount > 0) {
        push("info", t(`تم حفظ الفاتورة بدون ${skippedCount} بند ناقص (موضّح بالأحمر) · أكملها من شاشة التعديل`, `Invoice saved without ${skippedCount} incomplete line(s) (highlighted in red) · complete them from the edit screen`));
      }
      setNumberEdited(false);
      setInvalidLineIds(new Set());
      const msg = isEdit ? t(`تم تحديث ${inv.invoiceNumber}`, `Updated ${inv.invoiceNumber}`)
                : action === "draft" ? t(`تم حفظ ${inv.invoiceNumber} كمسودة`, `Saved ${inv.invoiceNumber} as draft`)
                : action === "approve" ? t(`تم اعتماد ${inv.invoiceNumber}`, `Approved ${inv.invoiceNumber}`)
                : t(`تم اعتماد ${inv.invoiceNumber} · راجع الرسالة قبل الإرسال`, `Approved ${inv.invoiceNumber} · review the message before sending`);
      push("success", msg);
      // «إرسال» never auto-fires the email (CEO 2026-09-08) — it opens the
      // compose page below so the message can be reviewed/edited first.
      if (action === "send" && inv.id) {
        let payLink: string | undefined;
        try {
          const link = await (api as any).paymentLinks?.create?.(inv.id, "auto");
          payLink = link?.url;
        } catch (e: any) {
          push("info", e?.message || t("لم يتم إنشاء رابط دفع، سيتم إرسال الفاتورة بدون رابط دفع", "No payment link was created; the invoice will be sent without a payment link"));
        }
        setSendComposeFor({ invoice: { ...inv, __payLink: payLink } as any });
      }
      // UX-177 · stay on the saved invoice instead of returning to list
      // Switch to edit mode of the freshly-saved invoice · preserve all form fields
      // Lock immediately after a successful issue, even if the evidence refresh fails.
      setEditingInvoice(inv as Invoice);
      if (action !== "draft") {
        try { setEditingInvoice(await api.invoices.get(inv.id)); }
        catch { push("info", t("تم إصدار الفاتورة. حدّث حالتها لعرض رد الهيئة.", "Invoice issued. Refresh its status to view the authority response.")); }
      }
      setForm((prev) => ({ ...prev, invoiceNumber: inv.invoiceNumber }));
      draft.clear(); // saved → the autosaved draft is obsolete
      // Keep createOpen true · just refresh state
      // closeCreate();   // ❌ removed · was bouncing user back to list and losing context
      return inv as Invoice;
    } catch (e: any) {
      setCreateError(humanizeError(e, language, { ar: "فشل الحفظ", en: "Save failed" }));
      return null;
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.invoices.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", t("تم حذف الفاتورة", "Invoice deleted"));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الحذف", en: "Delete failed" }));
    }
  };

  // Approve a DRAFT invoice · transitions DRAFT → APPROVED
  const handleApprove = async (inv: Invoice) => {
    try {
      // Safety: fetch full invoice to validate lines before accidental approval.
      const full = await api.invoices.get(inv.id);
      const lineItems = (full.lines as any[]) || [];
      const hasIncomplete = lineItems.some((l: any) => {
        const descOk = String(l?.description || "").trim().length >= 3;
        const qtyOk = Number(l?.quantity || 0) > 0;
        const priceOk = Number(l?.unitPrice || 0) > 0;
        return !(descOk && qtyOk && priceOk);
      });
      if (hasIncomplete) {
        push("error", t("لا يمكن الاعتماد: يوجد بند ناقص (الوصف/الكمية/السعر)", "Cannot approve: there is an incomplete line (description/quantity/price)"));
        return;
      }
      if (lineItems.some((l: any) => !l.accountId && !l.product?.incomeAccountId)) {
        push("error", t("اختر حساب الإيراد لكل بند قبل الاعتماد.", "Select a revenue account for every line before approval."));
        return;
      }
      await api.invoices.update(inv.id, { status: "APPROVED" });
      setItems(prev => prev.map(x => x.id === inv.id ? { ...x, status: "APPROVED" } as Invoice : x));
      push("success", t(`تم اعتماد ${inv.invoiceNumber}`, `Approved ${inv.invoiceNumber}`));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الاعتماد", en: "Approve failed" }));
    }
  };

  const handleSplitByCategory = async (inv: Invoice) => {
    setSplittingId(inv.id);
    try {
      const result = await (api as any).invoiceOps.splitByCategory(inv.id);
      const groups = (result?.groups || []) as Array<{ labelAr: string; lines: number }>;
      const groupText = groups.map((g) => `${g.labelAr} (${g.lines})`).join(" · ");
      push("success", t(`تم تفكيك ${inv.invoiceNumber} إلى ${result?.createdCount || 0} فواتير: ${groupText}`, `Split ${inv.invoiceNumber} into ${result?.createdCount || 0} invoices: ${groupText}`));
      await refresh();
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل تفكيك الفاتورة", en: "Split failed" }));
    } finally {
      setSplittingId(null);
    }
  };

  const openRecordPayment = (inv: Invoice) => {
    const remaining = Math.max(Number(inv.total) - Number(inv.amountPaid || 0), 0);
    const params = new URLSearchParams({
      new: "1",
      contactId: inv.contactId,
      invoiceId: inv.id,
      amount: (remaining > 0 ? remaining : Number(inv.total || 0)).toFixed(2),
      date: new Date().toISOString().slice(0, 10),
      reference: inv.invoiceNumber || "",
    });
    navigate(`/app/receipts?${params.toString()}`);
  };

    const openEdit = async (inv: Invoice) => {
    // List rows don't include lines · fetch the full invoice so edit never opens empty
    if (!inv.lines || !(inv.lines as any[]).length) {
      try { inv = await api.invoices.get(inv.id) as Invoice; } catch { /* fall back to row data */ }
    }
    setEditingInvoice(inv);
    setForm({
      ...EMPTY_FORM,
      contactId: inv.contactId,
      invoiceNumber: inv.invoiceNumber,
      issueDate: String(inv.issueDate).slice(0, 10),
      supplyDate: inv.supplyDate?.slice(0,10) || "",
      dueDate: inv.dueDate ? String(inv.dueDate).slice(0, 10) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      currency: inv.currency,
      notes: inv.notes || "",
      // legacy rows stored "Ref: X" inside termsConditions · surface it as the reference, not as terms
      reference: (inv as any).reference || (String(inv.termsConditions || "").match(/^Ref:\s*(.+)$/)?.[1] ?? ""),
      termsConditions: /^Ref:\s*\S+$/.test(String(inv.termsConditions || "").trim()) ? "" : (inv.termsConditions || ""),
      templateId: (inv as any).templateId || "",
      branchId: (inv as any).branchId ?? null,
      projectId: (inv as any).projectId ?? null,
    } as any);
    setLines(((inv.lines as any[]) || []).map((l: any) => ({
      id: l.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: l.description || "",
      quantity: String(l.quantity || 1),
      unitPrice: String(l.unitPrice || 0),
      taxRate: typeof l.taxRate === "number" ? l.taxRate : defaultTaxRate,
      taxInclusive: false,
      productId: l.productId || null,
      accountId: l.accountId || null,
      // Revenue recognition · hydrate saved schedule back into the line
      recognitionStartDate: l.recognitionStartDate ? String(l.recognitionStartDate).slice(0, 10) : undefined,
      recognitionMonths: l.recognitionMonths ?? undefined,
      deferredRevenueAccountId: l.deferredRevenueAccountId || undefined,
    })));
    setCreateOpen(true);
    setCreateError(null);
  };

    const openSign = (inv: Invoice) => {
    const customer = customers.find((c) => c.id === inv.contactId);
    setSignFor(inv);
    setSignForm({
      name: customer?.displayName || "",
      email: customer?.email || "",
      message: t(`يرجى مراجعة وتوقيع الفاتورة رقم ${inv.invoiceNumber}`, `Please review and sign invoice no. ${inv.invoiceNumber}`),
    });
    setSignError(null);
  };
  const closeSign = () => { setSignFor(null); setSignError(null); };

  const handleSignSubmit = async () => {
    if (!signFor) return;
    setSignError(null);
    if (!signForm.email.trim()) { setSignError(t("البريد الإلكتروني مطلوب", "Email is required")); return; }
    if (!signForm.name.trim()) { setSignError(t("اسم الموقّع مطلوب", "Signer name is required")); return; }
    setBusy(true);
    try {
      const r = await api.sign.sendInvoice(signFor.id, {
        signers: [{ name: signForm.name, email: signForm.email, role: "Customer" }],
        message: signForm.message,
        expiresInDays: 30,
      });
      if (r.error) {
        push("error", t(`حُفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`, `Request saved but DocuSeal did not respond: ${r.error}`));
      } else {
        push("success", t(`تم إرسال الفاتورة للتوقيع إلى ${signForm.email}`, `Invoice sent for signing to ${signForm.email}`));
        if (signFor.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === signFor.id ? { ...x, status: "SENT" } : x));
        }
      }
      closeSign();
    } catch (e: any) {
      setSignError(humanizeError(e, language, { ar: "فشل الإرسال", en: "Send failed" }));
    } finally { setBusy(false); }
  };

  // Send compose page (W-SEND · 2026-09-08) · takes over the whole page,
  // above every other view — «إرسال» always lands here, never fires silently.
  if (sendComposeFor) {
    const inv = sendComposeFor.invoice;
    const contact = inv.contact || customers.find((c) => c.id === inv.contactId);
    const payLink = (inv as any).__payLink as string | undefined;
    return <>
      <SendComposeForm
        entityType="invoice"
        entityId={inv.id}
        documentNumber={inv.invoiceNumber}
        documentLabelAr="فاتورة" documentLabelEn="Invoice"
        defaultTo={contact?.email ? [contact.email] : []}
        defaultSubject={t(`فاتورة ${inv.invoiceNumber}`, `Invoice ${inv.invoiceNumber}`)}
        defaultBody={t(
          `مرحباً ${contact?.displayName || ""}،\n\nمرفق الفاتورة رقم ${inv.invoiceNumber} بقيمة ${Number(inv.total).toFixed(2)} ${inv.currency}.${payLink ? `\n\nرابط الدفع: ${payLink}` : ""}\n\nشكراً لتعاملكم معنا.`,
          `Hi ${contact?.displayName || ""},\n\nPlease find attached invoice ${inv.invoiceNumber} for ${Number(inv.total).toFixed(2)} ${inv.currency}.${payLink ? `\n\nPayment link: ${payLink}` : ""}\n\nThank you.`,
        )}
        prefill={sendComposeFor.prefill}
        onClose={() => setSendComposeFor(null)}
        onSent={(record) => {
          setSendLogRefresh((n) => n + 1);
          if (record.status === "SENT") {
            setItems((prev) => prev.map((x) => (x.id === inv.id ? { ...x, status: "SENT" } as Invoice : x)));
            setEditingInvoice((prev) => (prev && prev.id === inv.id ? ({ ...prev, status: "SENT" } as Invoice) : prev));
          }
        }}
        push={push}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>;
  }

  if (createOpen && editingInvoice && editingInvoice.status !== "DRAFT" && !signFor) {
    return <><IssuedInvoiceRecord invoice={editingInvoice} onClose={closeCreate}
      onPayment={() => openRecordPayment(editingInvoice)}
      onSend={(prefill) => setSendComposeFor({ invoice: editingInvoice, prefill })}
      sendLogRefreshKey={sendLogRefresh}
      onRefresh={async () => { try { setEditingInvoice(await api.invoices.get(editingInvoice.id)); } catch (e) { push("error", humanizeError(e, language)); } }} />
      <ToastStack toasts={toasts} onDismiss={dismiss} /></>;
  }

  // Full-page Create form (hides list view) · Wafeq-style replace-content pattern
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={editingInvoice ? t(`تعديل الفاتورة ${editingInvoice.invoiceNumber}`, `Edit invoice ${editingInvoice.invoiceNumber}`) : t("فاتورة جديدة", "New invoice")}
          subtitle={editingInvoice ? t(`الحالة: ${STATUS_LABELS[editingInvoice.status]?.ar || editingInvoice.status}`, `Status: ${STATUS_LABELS[editingInvoice.status]?.en || editingInvoice.status}`) : t("املأ البيانات الأساسية · يمكنك التعديل لاحقاً", "Fill in the basic details · you can edit later")}
          onClose={closeCreate}
          disableEscape={busy}
          draft={draft}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={closeCreate}>{t("إلغاء", "Cancel")}</Button>
                {editingInvoice && (
                  <>
                    <Button
                      type="button"
                      variant={previewOpen ? "outline" : "secondary"}
                      onClick={() => setPreviewOpen((v) => !v)}
                      title={t("معاينة الفاتورة كمستند (يسار)", "Preview invoice as document (left)")}
                    >
                      {t("معاينة", "Preview")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => window.open(`/print/invoice/${editingInvoice.id}`, "_blank", "noopener")}
                      title={t("فتح نسخة الطباعة في تبويب جديد", "Open print version in a new tab")}
                    >
                      {t("طباعة", "Print")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid="invoice-full-preview"
                      onClick={() => window.open(`/print/invoice/${editingInvoice.id}?noprint=1${form.templateId ? `&templateId=${form.templateId}` : ""}`, "_blank", "noopener")}
                      title={t("المستند الكامل بكل صفحاته في تبويب جديد", "The full document with all its pages in a new tab")}
                    >
                      {t("معاينة كاملة", "Full preview")}
                    </Button>
                  </>
                )}
                {!editingInvoice && (
                  <Button type="button" variant="secondary" disabled={busy} onClick={handleFullPreview} data-testid="invoice-full-preview" title={t("يحفظ مسودة ثم يفتح المستند الكامل بكل صفحاته في تبويب جديد", "Saves a draft, then opens the full document with all its pages in a new tab")}>
                    {t("معاينة كاملة", "Full preview")}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => handleSubmit("draft")}>
                  {busy ? "..." : t("حفظ كمسودة", "Save as draft")}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("approve")} title={t("اعتماد + قفل التعديل", "Approve + lock editing")}>
                  {busy ? "..." : t("اعتماد", "Approve")}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("send")} title={t("إرسال للعميل بالبريد", "Send to customer by email")}>
                  {busy ? "..." : t("اعتماد + إرسال", "Approve + send")}
                </Button>
              </div>
            </div>
          }
        >
          <div className={editingInvoice && previewOpen ? "grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_minmax(440px,38%)]" : ""}>
          <div className="w-full max-w-none mx-auto space-y-5">
            {createError && <InlineAlert tone="critical">{createError}</InlineAlert>}

            {/* Header fields · one labelled grid (contact · dates · number · reference · dimensions) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("جهة الاتصال", "Contact")} *</Label>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 min-w-0">
                    <SearchableCombobox
                      value={form.contactId}
                      onChange={(id) => {
                        setForm({ ...form, contactId: id });
                        // Auto-fill reference: contactCode + invoice sequence (editable)
                        const c = customers.find((x) => x.id === id);
                        if (c?.customCode) {
                          const seq = items.filter((iv: any) => iv.contactId === id).length + 1;
                          setForm((prev: any) => ({ ...prev, contactId: id, reference: prev.reference || `${c.customCode}-${String(seq).padStart(2, '0')}` }));
                        }
                      }}
                      onCreate={(name) => new Promise<string>((resolve, reject) => {
                        setPendingContact({ name, resolve, reject });
                      })}
                      items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                      placeholder={t("ابحث عن عميل...", "Search for a customer...")}
                      createLabel={(q) => t(`+ إنشاء "${q}"`, `+ Create "${q}"`)}
                    />
                  </div>
                  {!!form.contactId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/contacts/${form.contactId}`)}
                      className="h-10 px-2.5 rounded-lg border border-border text-xs text-primary hover:border-border-strong shrink-0"
                      title={t("فتح ملف العميل", "Open contact profile")}
                    >
                      ↗
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("تاريخ الإصدار", "Issue date")} *</Label>
                <DateInput value={form.issueDate} onChange={(iso) => setForm({ ...form, issueDate: iso })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("تاريخ الاستحقاق", "Due date")} *</Label>
                <DateInput value={form.dueDate} onChange={(iso) => setForm({ ...form, dueDate: iso })} required />
              </div>
              {!isUS && <div className="space-y-1.5"><Label className="text-content-secondary text-xs">{t("تاريخ التوريد الفعلي — للفاتورة القياسية", "Actual supply date — standard invoice")}</Label><DateInput value={form.supplyDate} onChange={iso => setForm({...form,supplyDate:iso})} /></div>}
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("رقم الفاتورة", "Invoice number")}</Label>
                <Input value={form.invoiceNumber} onChange={(e) => { setForm({ ...form, invoiceNumber: e.target.value }); setNumberEdited(true); }}
                  placeholder={t("# تلقائي", "# Auto")} dir="ltr" className="font-code" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("المرجع", "Reference")}</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("رقم مرجع العميل", "Customer reference number")}  />
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("الدفع الإلكتروني", "Online payment")}</Label>
                <button
                  type="button"
                  onClick={() => { window.location.href = "/app/settings?tab=payments"; }}
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm flex items-center justify-between hover:border-border-strong"
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-content-secondary">
                    <span className="rounded-full border border-border px-1.5 py-0.5">MC</span>
                    <span className="rounded-full border border-border px-1.5 py-0.5">VISA</span>
                  </span>
                  <span className="text-primary">{t("إعداد الدفع", "Set up payments")}</span>
                </button>
              </div>
            </div>

            {/* Second row · currency + tax mode + brand template + payment terms + branch (B1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("العملة", "Currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger ><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.label.ar, c.label.en)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("المبالغ", "Amounts")}</Label>
                <Select value={taxMode} onValueChange={(v) => setTaxMode(v as TaxMode)}>
                  <SelectTrigger className="leading-tight"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-exclusive">{t("غير شاملة الضريبة", "Exclusive of tax")}</SelectItem>
                    <SelectItem value="all-inclusive">{t("شاملة الضريبة", "Inclusive of tax")}</SelectItem>
                    <SelectItem value="custom">{t("مخصصة لكل بند", "Custom per line")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5" data-testid="invoice-template-field">
                <Label className="text-content-secondary text-xs">{t("قالب العلامة التجارية", "Brand template")}</Label>
                {/* Real brand templates (designer · /app/templates) · empty = org default for invoices */}
                <SearchableCombobox
                  value={form.templateId}
                  onChange={(id) => {
                    const tpl = docTemplates.find((x) => x.id === id);
                    setForm((prev: any) => ({ ...prev, templateId: id, brandTemplate: prev.brandTemplate, termsConditions: prev.termsConditions || (tpl?.showTerms === false ? "" : (tpl?.terms || "")) }));
                  }}
                  items={docTemplates.map((x) => ({ id: x.id, label: x.name, sublabel: x.isDefault ? t("افتراضي", "Default") : (x.nameEn || undefined) }))}
                  placeholder={docTemplates.length ? t("القالب الافتراضي", "Default template") : (BRAND_TEMPLATES[0] ? t(BRAND_TEMPLATES[0].label.ar, BRAND_TEMPLATES[0].label.en) : "")}
                  onCreate={async () => { navigate("/app/templates/new?type=INVOICE"); return ""; }}
                  createLabel={(q) => t(`تصميم قالب جديد «${q}»`, `Design a new template “${q}”`)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("شروط الدفع", "Payment terms")}</Label>
                <Select value={form.paymentTerms} onValueChange={(v) => {
                  const pt = PAYMENT_TERMS.find((p) => p.value === v);
                  if (pt) {
                    const due = new Date(form.issueDate);
                    due.setDate(due.getDate() + pt.days);
                    setForm({ ...form, paymentTerms: v, dueDate: due.toISOString().slice(0, 10) });
                  } else {
                    setForm({ ...form, paymentTerms: v });
                  }
                }}>
                  <SelectTrigger ><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((pt) => <SelectItem key={pt.value} value={pt.value}>{t(pt.label.ar, pt.label.en)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("الفرع", "Branch")}</Label>
                <BranchField compact value={form.branchId} onChange={(id) => setForm((f) => ({ ...f, branchId: id }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("المشروع", "Project")}</Label>
                <ProjectField compact value={form.projectId} onChange={(id) => setForm((f) => ({ ...f, projectId: id }))} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t("حساب الإيراد مطلوب لكل بند عند الاعتماد. يمكنك حفظ مسودة حتى يكتمل الربط المحاسبي.", "Each line requires a revenue account for approval. Save a draft while completing the accounting mappings.")}</p>
            {/* Items table v2 · with product picker + account picker */}
            <ItemsTable
              lines={lines}
              setLines={setLines}
              mode={taxMode}
              onModeChange={setTaxMode}
              defaultTaxRate={defaultTaxRate}
              currency={form.currency}
              direction="sales"
              invalidIds={invalidLineIds}
              contactId={form.contactId || null}
              errorMessage={invalidLineIds.size > 0 && createError && /حساب|account/i.test(createError) ? createError : null}
              products={products.map((p: any) => ({
                id: p.id,
                name: displayName(p),
                sku: p.sku,
                unitPrice: Number(p.unitPrice) || 0,
                accountId: p.incomeAccountId,
              }))}
              accounts={accounts.filter((a: any) => a.isActive !== false).map((a: any) => ({
                id: a.id,
                code: a.code,
                name: displayName(a),
                type: a.type,
                subtype: a.subtype,
              }))}
              onCreateProduct={(name) => new Promise((resolve, reject) => {
                setQuickProductReq({ name, resolve, reject });
              })}
              onCreateAccount={(name) => new Promise((resolve, reject) => {
                setQuickAccountReq({ name, resolve, reject });
              })}
              minRows={6}
            />

            {/* Document drop zone · matches the screenshot's "اسحب ملفات هنا" bar */}
            <DocumentDropZone
              compact
              target="invoice-lines"
              hint={t("استخرج بنود الفاتورة من هذا المستند", "Extract invoice line items from this document")}
              defaultTaxRate={defaultTaxRate}
              currency={form.currency}
              onExtracted={(data: ExtractedDocument) => {
                if (!data.lines || data.lines.length === 0) {
                  push("info", t("لم يتم استخراج بنود من المستند", "No line items were extracted from the document"));
                  return;
                }
                const newLines: InvoiceLine[] = data.lines.map((l: any) => ({
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  description: l.description || "",
                  quantity: String(l.quantity || 1),
                  unitPrice: String(l.unitPrice || 0),
                  taxRate: l.taxRate ?? defaultTaxRate,
                  taxInclusive: l.taxInclusive ?? false,
                  notes: l.notes || undefined,
                }));
                setLines(newLines);
                if (data.documentNumber && !form.invoiceNumber) {
                  setForm((f) => ({ ...f, reference: data.documentNumber || f.reference }));
                }
                if (data.dueDate) setForm((f) => ({ ...f, dueDate: data.dueDate || f.dueDate }));
                if (data.notes) setForm((f) => ({ ...f, notes: data.notes || f.notes }));
                push("success", t(`تم استخراج ${newLines.length} بنداً بثقة ${Math.round(data.confidence * 100)}%`, `Extracted ${newLines.length} line item(s) with ${Math.round(data.confidence * 100)}% confidence`));
              }}
              onError={(msg) => push("error", msg)}
            />

            {/* Totals + payment terms + notes · 2-column footer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-content-secondary text-xs">{t("شروط الدفع · ملاحظة للعميل", "Payment terms · note to customer")}</Label>
                  <textarea
                    rows={4}
                    placeholder={t("مثلاً: الدفع خلال 30 يوم من تاريخ الفاتورة عبر تحويل بنكي...", "e.g.: Payment within 30 days of invoice date via bank transfer...")}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-content-secondary text-xs">{t("الشروط والأحكام · تُطبع في بطاقة الشروط (مُعبّأة من القالب · عدّلها لهذه الفاتورة)", "Terms & conditions · printed in the terms card (prefilled from the template · edit for this invoice)")}</Label>
                  <textarea
                    rows={5}
                    placeholder={t("سطر لكل شرط — الاستحقاق خلال 30 يومًا من تاريخ الإصدار…", "One term per line — due within 30 days of the issue date…")}
                    value={form.termsConditions}
                    onChange={(e) => setForm({ ...form, termsConditions: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    data-testid="invoice-terms"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-content-secondary text-xs">{t("الإجمالي", "Total")}</Label>
                <div className="rounded-lg border border-border bg-card p-5 space-y-2">
                  {(() => {
                    const totals = computeTotals(lines);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-content-secondary min-w-0 break-words">{t("المجموع الفرعي", "Subtotal")}</span>
                          <span dir="ltr" className="font-english tabular-nums text-foreground text-end whitespace-nowrap shrink-0">{displayDigits(totals.subtotal.toFixed(2))} <span className="text-xs text-muted-foreground">{form.currency}</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-content-secondary min-w-0 break-words">{isUS ? t("ضريبة المبيعات", "Sales tax") : t("ضريبة القيمة المضافة (15%)", "VAT (15%)")}</span>
                          <span dir="ltr" className="font-english tabular-nums text-foreground text-end whitespace-nowrap shrink-0">{displayDigits(totals.tax.toFixed(2))} <span className="text-xs text-muted-foreground">{form.currency}</span></span>
                        </div>
                        <div className="flex items-end justify-between gap-3 pt-3 mt-1 border-t border-foreground">
                          <span className="text-foreground min-w-0 break-words font-semibold">{t("الإجمالي:", "Total:")}</span>
                          <span dir="ltr" className="ledger-figure-value text-end whitespace-nowrap shrink-0" style={{ fontSize: "26px" }}>
                            {displayDigits(totals.total.toFixed(2))} <span className="text-xs text-muted-foreground">{form.currency}</span>
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
          {editingInvoice && previewOpen && (
            <aside className="hidden xl:block sticky top-4">
              <div className="rounded-lg bg-surface-subtle p-4 space-y-3">
                {/* Action bar above the document · ink + outline pills */}
                <div className="flex items-center justify-between gap-2">
                  <span dir="ltr" className="font-code text-sm font-semibold text-foreground">{editingInvoice.invoiceNumber}</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => window.open(`/print/invoice/${editingInvoice.id}`, "_blank", "noopener")}>
                      {t("فتح في تبويب ←", "Open in tab ←")}
                    </Button>
                    <Button type="button" size="sm" onClick={() => handleSubmit("send")} disabled={busy}>
                      {t("إرسال", "Send")}
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="border-b border-border px-4 py-2 ledger-eyebrow">{t("معاينة المستند · آخر نسخة محفوظة", "Document preview · last saved version")}</div>
                  <iframe
                    title={t(`معاينة ${editingInvoice.invoiceNumber}`, `Preview ${editingInvoice.invoiceNumber}`)}
                    src={`/print/invoice/${editingInvoice.id}?embed=1&noprint=1${form.templateId ? `&templateId=${form.templateId}` : ""}`}
                    className="w-full bg-card"
                    style={{ height: "calc(100vh - 200px)", border: 0 }}
                  />
                </div>
              </div>
            </aside>
          )}
          </div>
        </FullPageForm>
      <ToastStack toasts={toasts} onDismiss={dismiss} />

        {/* Quick-create Product modal · opens when user types unknown item name */}
        {quickProductReq && (
          <QuickCreateProduct
            initialName={quickProductReq.name}
            accounts={accounts.filter((a: any) => a.isActive !== false).map((a: any) => ({ id: a.id, name: displayName(a), code: a.code, type: a.type, subtype: a.subtype }))}
            onCreate={async (input) => {
              const p = await (api as any).products.create(input);
              setProducts((prev) => [p, ...prev]);
              return {
                id: p.id,
                name: displayName(p),
                sku: p.sku,
                unitPrice: Number(p.unitPrice) || 0,
                taxRate: Number(p.taxRate) || defaultTaxRate,
                incomeAccountId: p.incomeAccountId,
              };
            }}
            onClose={() => { quickProductReq.reject(); setQuickProductReq(null); }}
            onCreated={(p) => {
              quickProductReq.resolve({
                id: p.id,
                name: p.name,
                sku: p.sku,
                unitPrice: Number(p.unitPrice) || 0,
                taxRate: p.taxRate,
                accountId: p.incomeAccountId,
              });
              setQuickProductReq(null);
              push("success", t(`تم إنشاء المنتج · ${p.name}`, `Product created · ${p.name}`));
            }}
          />
        )}

        {/* Quick-create Contact dialog · MUST render inside create mode too,
            otherwise SearchableCombobox stays on "creating" forever. */}
        {pendingContact && (
          <QuickContactDialog
            initialName={pendingContact.name}
            defaultRole="customer"
            onCancel={() => { pendingContact.reject(); setPendingContact(null); }}
            onCreated={(c) => {
              setCustomers((prev) => [c, ...prev]);
              push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
              pendingContact.resolve(c.id);
              setPendingContact(null);
            }}
          />
        )}

        {/* Quick-create Account modal · opens when user types unknown account name */}
        {quickAccountReq && (
          <QuickCreateAccount
            initialName={quickAccountReq.name}
            defaultType="INCOME"
            onCreate={async (input) => {
              const a = await (api as any).accounts.create({ ...input, type: input.type === 'INCOME' ? 'REVENUE' : input.type });
              setAccounts((prev) => [a, ...prev]);
              return { id: a.id, name: displayName(a), code: a.code, type: a.type };
            }}
            onClose={() => { quickAccountReq.reject(); setQuickAccountReq(null); }}
            onCreated={(a) => {
              quickAccountReq.resolve(a);
              setQuickAccountReq(null);
              push("success", t(`تم إنشاء الحساب · ${a.name}`, `Account created · ${a.name}`));
            }}
          />
        )}
      </>
    );
  }

  // Full-page Sign form (hides list view)
  if (signFor) {
    return (
      <>
        <FullPageForm
          title={t(`إرسال ${signFor.invoiceNumber} للتوقيع`, `Send ${signFor.invoiceNumber} for signing`)}
          subtitle={t("DocuSeal · sign.ensidex.com · صلاحية الرابط 30 يوم", "DocuSeal · sign.ensidex.com · link valid for 30 days")}
          onClose={closeSign}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeSign} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <Button type="button" disabled={busy} onClick={handleSignSubmit} className="bg-primary hover:bg-primary/90">
                <FileSignature className="me-2 h-4 w-4" />{busy ? "..." : t("إرسال للتوقيع", "Send for signing")}
              </Button>
            </div>
          }
        >
          <div className="max-w-2xl mx-auto space-y-4">
            {signError && <InlineAlert tone="critical">{signError}</InlineAlert>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("اسم الموقّع", "Signer name")} *</Label>
                <Input value={signForm.name} onChange={(e) => setSignForm({ ...signForm, name: e.target.value })} placeholder={t("الاسم الكامل", "Full name")} /></div>
              <div className="space-y-2"><Label>{t("البريد الإلكتروني", "Email")} *</Label>
                <Input type="email" value={signForm.email} onChange={(e) => setSignForm({ ...signForm, email: e.target.value })} dir="ltr" className="font-english" placeholder="signer@example.com" /></div>
            </div>
            <div className="space-y-2"><Label>{t("الرسالة المرفقة", "Attached message")}</Label>
              <textarea value={signForm.message} onChange={(e) => setSignForm({ ...signForm, message: e.target.value })} rows={4} className="w-full rounded-md border border-border px-3 py-2 text-sm" /></div>
            <p className="text-xs text-muted-foreground">{t("سيستلم الموقّع رابطاً عبر البريد لمراجعة الفاتورة وتوقيعها · صلاحية الرابط 30 يوم.", "The signer will receive a link by email to review and sign the invoice · link valid for 30 days.")}</p>
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  // Default · list view
  // In split view the row-action column moves into the preview panel (approved design),
  // so the six ledger columns keep the reference widths instead of scrolling sideways.
  const compactList = wideViewport;
  const selected = selectedFull;
  const selectedLate = selected ? overdueDays(selected) : 0;
  const selectedStatusLabel = selected
    ? selected.status === "PAID"
      ? t("سُدّدت بالكامل", "Paid in full")
      : selectedLate > 0
        ? t(`متأخرة ${selectedLate} أيام`, `${selectedLate} days overdue`)
        : STATUS_LABELS[selected.status]
          ? t(STATUS_LABELS[selected.status].ar, STATUS_LABELS[selected.status].en)
          : selected.status
    : undefined;
  const selectedStatusMeta = selected
    ? [String(selected.issueDate || "").slice(0, 10), (selected as any).journalEntry?.entryNumber || (selected as any).journalEntryNumber]
        .filter(Boolean).join(" · ")
    : undefined;

  return (
    <div className="space-y-6">
      <div className={wideViewport ? "grid grid-cols-[minmax(0,1fr)_minmax(380px,30%)] items-start gap-8" : ""}>
        <div className="min-w-0 space-y-6">
      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
        eyebrow={<span className="text-[13px]">{t("المبيعات", "Sales")}</span>}
        title={t("الفواتير", "Sales Invoices")}
        actions={<Button className="h-10 px-[18px] text-sm" onClick={openCreate}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("فاتورة جديدة", "New invoice")}</Button>}
      />

      {contactFilterId && (
        <InlineAlert tone="info">
          <div className="flex flex-wrap items-center gap-2">
            <span>{t("عرض فواتير عميل واحد", "Showing invoices for one customer")}{contactFilterName ? `: ${contactFilterName}` : ""}</span>
            <button
              onClick={() => setSearchParams({}, { replace: true })}
              className="ms-auto rounded-full border border-border px-2.5 py-0.5 text-xs text-primary hover:border-border-strong"
            >
              {t("إظهار الكل", "Show all")} ×
            </button>
          </div>
        </InlineAlert>
      )}

      <MetricStrip className="grid-cols-3 sm:grid-cols-3 xl:grid-cols-3 [&_.ledger-figure-value]:text-[20px] sm:[&_.ledger-figure-value]:text-[30px] [&_.ledger-figure]:py-3 sm:[&_.ledger-figure]:py-4 max-sm:[&_.ledger-figure]:px-2.5 max-sm:[&_.ledger-figure:first-child]:ps-0 max-sm:[&_.ledger-figure:last-child]:pe-0 max-sm:[&_.ledger-figure+.ledger-figure]:!border-t-0 max-sm:[&_.ledger-figure+.ledger-figure]:!border-s max-sm:[&_.ledger-figure+.ledger-figure]:!border-s-border">
        <Metric label={t("مستحقة", "Outstanding")} value={currencyFigure('outstanding')} hint={<span className="font-english tabular-nums">{invoiceCount} {t("فاتورة", "invoices")}</span>} />
        <Metric label={t("متأخرة", "Overdue")} value={<span className="text-warning"><Figure value={overdueAmount} /></span>} />
        <Metric label={t("محصّلة هذا الشهر", "Collected this month")} value={<span className="text-primary"><Figure value={collectedThisMonth} /></span>} />
      </MetricStrip>

      <PageToolbar aria-label={t("مرشحات الفواتير", "Invoice filters")} className="flex-nowrap gap-2 max-sm:flex-wrap">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto max-sm:w-full">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setFilterStatus(chip.value)}
            aria-pressed={filterStatus === chip.value}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-[7px] text-[13px] leading-5 transition-colors ${
              filterStatus === chip.value
                ? "bg-foreground font-semibold text-background"
                : "border border-border text-foreground hover:border-border-strong"
            }`}
          >
            {chip.label} <span className="font-english tabular-nums">{chip.count}</span>
          </button>
        ))}
        </div>
        {/* Source filter (main 2026-09): Entix subscription invoices vs everything */}
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-9 w-[150px] shrink-0 text-[13px] max-sm:w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">{t("كل المصادر", "All sources")}</SelectItem><SelectItem value="entix.io">{t("اشتراكات Entix", "Entix subscriptions")}</SelectItem></SelectContent>
        </Select>
        <div className="relative min-w-[200px] shrink-0 max-sm:w-full">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("بحث برقم أو عميل...", "Search by number or customer...")} className="h-9 w-full ps-8 text-[13px] sm:w-[200px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </PageToolbar>

      {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
       filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" strokeWidth={1.75} />} title={t("لا توجد فواتير", "No invoices")} />
      ) : (
        <>
        {/* Compact stacked list on phones · the wide ledger table from md up */}
        <ul className="md:hidden">
          {filtered.map((i) => {
            const late = overdueDays(i);
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/invoices/${i.id}`)}
                  className="flex w-full min-h-11 items-center justify-between gap-3 border-b border-border py-3 text-start"
                  title={t("فتح الفاتورة", "Open invoice")}
                >
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="truncate text-sm font-semibold text-foreground">{i.contact?.displayName || "—"}</span>
                    <span dir="ltr" className="font-code text-xs text-muted-foreground">{i.invoiceNumber} · {i.dueDate?.slice(0, 10)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-[3px]">
                    <span dir="ltr" className="font-display text-[18px] leading-5 text-foreground tabular-nums">{Number(i.total).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${statusToneClass(i.status, late)}`}>
                      <span className={`ledger-dot${i.status === "DRAFT" ? " hollow" : ""}`} aria-hidden="true" />
                      {late > 0 && i.status !== "PAID" && i.status !== "CANCELLED"
                        ? t(`متأخرة ${late} أيام`, `${late} days overdue`)
                        : STATUS_LABELS[i.status] ? t(STATUS_LABELS[i.status].ar, STATUS_LABELS[i.status].en) : i.status}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="ledger-table hidden md:block overflow-x-auto [&_th]:text-[11px] [&_th]:tracking-[0.06em]">
        <Table className={`table-fixed ${compactList ? "min-w-[820px]" : "min-w-[980px]"}`}>
          <colgroup>
            <col style={{ width: "200px" }} />{/* الرقم · mono numbers run to 19 chars (ENTIX-XXXXXXXX-0000) — never narrower */}
            <col style={{ minWidth: "110px" }} />{/* العميل · flexible */}
            <col style={{ width: "110px" }} />{/* التاريخ */}
            <col style={{ width: "110px" }} />{/* الاستحقاق */}
            <col style={{ width: "130px" }} />{/* المبلغ */}
            <col style={{ width: "140px" }} />{/* الحالة */}
            {!compactList && <col style={{ width: "150px" }} />}{/* إجراءات · replaced by the panel action bar in split view */}
          </colgroup>
          <TableHeader><TableRow className="hover:bg-transparent">
            <TableHead>{t("الرقم", "Number")}</TableHead>
            <TableHead>{t("العميل", "Customer")}</TableHead>
            <TableHead>{t("التاريخ", "Date")}</TableHead>
            <TableHead>{t("الاستحقاق", "Due")}</TableHead>
            <TableHead className="text-end">{t("المبلغ", "Amount")} <span className="font-english">({orgCurrency})</span></TableHead>
            <TableHead>{t("الحالة", "Status")}</TableHead>
            {!compactList && <TableHead>{t("إجراءات", "Actions")}</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(i => {
              const remaining = Number(i.total) - Number(i.amountPaid || 0);
              const late = overdueDays(i);
              return (
              <TableRow
                key={i.id}
                onClick={() => (wideViewport ? setSelectedId(i.id) : navigate(`/app/invoices/${i.id}`))}
                onDoubleClick={() => navigate(`/app/invoices/${i.id}`)}
                data-state={wideViewport && selectedId === i.id ? "selected" : undefined}
                className="h-12 cursor-pointer data-[state=selected]:border-b-transparent data-[state=selected]:[&>td:first-child]:rounded-s-lg data-[state=selected]:[&>td:last-child]:rounded-e-lg"
                title={wideViewport ? t("عرض في اللوحة · نقرتان للفتح", "Show in the panel · double-click to open") : t("فتح الفاتورة", "Open invoice")}
              >
                <TableCell className="text-start whitespace-nowrap overflow-hidden text-ellipsis">
                  <button
                    onClick={() => navigate(`/app/invoices/${i.id}`)}
                    title={t("فتح الفاتورة", "Open invoice")}
                    className="hover:underline underline-offset-4 cursor-pointer"
                  >
                    <span dir="ltr" className="font-code text-sm font-semibold text-foreground inline-block">{i.invoiceNumber}</span>{(i.zatcaDelivery?.state || i.zatcaStatus) && <span className={`block text-[11px] ${["REPORTED","CLEARED","ACCEPTED"].includes(i.zatcaDelivery?.state || i.zatcaStatus || "") ? "text-success" : "text-warning"}`} title={i.zatcaDelivery?.message || undefined}>{["REPORTED","CLEARED","ACCEPTED"].includes(i.zatcaDelivery?.state || i.zatcaStatus || "") ? t("✓ مقبولة لدى الهيئة", "✓ Accepted by ZATCA") : ["REVIEW","REJECTED"].includes(i.zatcaDelivery?.state || i.zatcaStatus || "") ? t("تحتاج معالجة", "Needs attention") : t("بانتظار قبول الهيئة", "Awaiting ZATCA")}</span>}
                  </button>
                </TableCell>
                <TableCell className="overflow-hidden text-sm text-foreground" title={i.contact?.displayName || ""}>
                  {i.contactId ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/contacts/${i.contactId}`);
                      }}
                      className="block w-full min-w-0 text-start hover:underline underline-offset-4"
                      title={t("فتح ملف العميل", "Open contact profile")}
                    >
                      <BidiText mode="plaintext" className="invoice-customer-name block overflow-hidden text-ellipsis !whitespace-nowrap leading-5">
                        {i.contact?.displayName || "—"}
                      </BidiText>
                    </button>
                  ) : (
                    <BidiText mode="plaintext" className="invoice-customer-name block overflow-hidden text-ellipsis !whitespace-nowrap leading-5">
                      {i.contact?.displayName || "—"}
                    </BidiText>
                  )}
                </TableCell>
                <TableCell className="text-start"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{i.issueDate?.slice(0, 10)}</span></TableCell>
                <TableCell className="text-start"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{i.dueDate?.slice(0, 10)}</span></TableCell>
                <TableCell className="text-end">
                  <span dir="ltr" className="block font-display text-[18px] leading-6 text-foreground tabular-nums">{Number(i.total).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{i.currency !== orgCurrency && <span className="font-english text-[10px] text-muted-foreground"> {i.currency}</span>}</span>
                  {remaining > 0 && Number(i.amountPaid || 0) > 0 && (
                    <span dir="ltr" className="block text-[11px] text-content-secondary tabular-nums">{t("متبقي", "Remaining")} {remaining.toLocaleString(displayLocale(), { maximumFractionDigits: 2 })}</span>
                  )}
                </TableCell>
                <TableCell className="align-middle">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${statusToneClass(i.status, late)}`}>
                      <span className={`ledger-dot${i.status === "DRAFT" ? " hollow" : ""}`} aria-hidden="true" />
                      {late > 0 && i.status !== "PAID" && i.status !== "CANCELLED"
                        ? t(`متأخرة ${late} أيام`, `${late} days overdue`)
                        : STATUS_LABELS[i.status] ? t(STATUS_LABELS[i.status].ar, STATUS_LABELS[i.status].en) : i.status}
                    </span>
                    {i.status === "DRAFT" && !compactList && (
                      pendingApprove === i.id ? (
                        <InlineConfirm
                          label={t("اعتماد الفاتورة؟", "Approve invoice?")}
                          onConfirm={() => { setPendingApprove(null); handleApprove(i); }}
                          onCancel={() => setPendingApprove(null)}
                        />
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingApprove(i.id);
                          }}
                          className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-success hover:border-border-strong"
                          title={t("اعتماد الفاتورة", "Approve invoice")}
                        >
                          ✓
                        </button>
                      )
                    )}
                  </div>
                </TableCell>
                {!compactList && (
                <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
                  <div className="flex w-max min-w-full items-center gap-1 whitespace-nowrap">
                    {/* SENT/APPROVED → Sign button */}
                    {i.status === "DRAFT" && (
                      <button
                        onClick={() => handleSplitByCategory(i)}
                        disabled={splittingId === i.id}
                        className="rounded-full border border-border px-2 py-1 text-xs text-foreground hover:border-border-strong flex items-center gap-1"
                        title={t("تفكيك الفاتورة إلى فواتير حسب القسم", "Split the invoice into invoices by category")}
                      >
                        {splittingId === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Split className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        {t("تفكيك", "Split")}
                      </button>
                    )}
                    {i.status !== "DRAFT" && <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} aria-label={t("فاتورة صادرة ومقفلة", "Issued and locked")} />}
                    {i.status !== "PAID" && i.status !== "CANCELLED" && (
                      <button
                        onClick={() => openRecordPayment(i)}
                        className="rounded-full border border-border px-2 py-1 text-xs text-success hover:border-border-strong flex items-center gap-1"
                        title={t("تسجيل دفعة عبر صفحة سندات القبض", "Record a payment via the receipt vouchers page")}
                      >
                        {t("دفعة", "Payment")}
                      </button>
                    )}
                    {i.status !== "PAID" && i.status !== "CANCELLED" && i.status !== "DRAFT" && (
                      <button onClick={() => openSign(i)} className="rounded-full px-2 py-1 text-xs text-primary hover:bg-surface-hover flex items-center gap-1" title={t("إرسال للتوقيع", "Send for signing")}>
                        <FileSignature className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("توقيع", "Sign")}
                      </button>
                    )}
                    {/* فتح/تعديل — always available; backend locks number + guards integrity */}
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/${i.id}`); }}
                      className="rounded-full p-1.5 text-primary hover:bg-surface-hover"
                      title={i.status === "DRAFT" ? t("تعديل الفاتورة", "Edit invoice") : t("عرض الفاتورة ورد الهيئة", "View invoice and authority response")}
                    >{i.status === "DRAFT" ? <Pencil className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}</button>
                    {/* طباعة — always available */}
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`/print/invoice/${i.id}`, "_blank"); }}
                      className="rounded-full p-1.5 text-content-secondary hover:bg-surface-hover"
                      title={t("طباعة الفاتورة", "Print invoice")}
                    ><Printer className="h-4 w-4" strokeWidth={1.75} /></button>
                    {i.status === "DRAFT" && (pendingDelete === i.id ? (
                      <InlineConfirm onConfirm={() => handleDelete(i.id)} onCancel={() => setPendingDelete(null)} />
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setPendingDelete(i.id); }} className="rounded-full p-1.5 text-danger hover:bg-surface-hover" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                    ))}
                  </div>
                </TableCell>
                )}
              </TableRow>
            );})}
          </TableBody>
        </Table>
        </div>
        </>
      )}
        </div>

        {/* Split view · the selected invoice as a paper document (desktop ≥1280px) */}
        {wideViewport && selected && (
          <aside className="sticky top-4 rounded-lg bg-surface-subtle p-4" aria-label={t("معاينة الفاتورة", "Invoice preview")}>
            <InvoicePreviewPane
              doc={{
                id: selected.id,
                number: selected.invoiceNumber,
                status: selected.status,
                issueDate: selected.issueDate,
                dueDate: selected.dueDate,
                currency: selected.currency,
                subtotal: selected.subtotal,
                taxTotal: selected.taxTotal,
                total: selected.total,
                amountPaid: selected.amountPaid,
                qr: selected.zatcaQr || null,
                lines: (selected.lines as any[])?.map((l: any) => ({
                  id: l.id,
                  description: l.description,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  total: l.total,
                })),
              }}
              seller={seller}
              customer={selected.contact ? { name: selected.contact.displayName, vatNumber: (selected.contact as any).taxId } : null}
              docTypeLabel={t("فاتورة ضريبية", "Tax invoice")}
              statusLabel={selectedStatusLabel}
              statusMeta={selectedStatusMeta}
              loading={selectedLoading}
              onSend={() => openSign(selected)}
              onPdf={() => window.open(`/print/invoice/${selected.id}`, "_blank", "noopener")}
              onEdit={() => navigate(`/app/invoices/${selected.id}`)}
              editLabel={selected.status === "DRAFT" ? t("تعديل", "Edit") : t("فتح", "Open")}
            />
            {/* Row actions for the selected invoice · quiet pills under the paper */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {selected.status !== "PAID" && selected.status !== "CANCELLED" && (
                <button
                  onClick={() => openRecordPayment(selected)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-success hover:border-border-strong"
                  title={t("تسجيل دفعة عبر صفحة سندات القبض", "Record a payment via the receipt vouchers page")}
                >{t("دفعة", "Payment")}</button>
              )}
              {selected.status === "DRAFT" && (
                pendingApprove === selected.id ? (
                  <InlineConfirm
                    label={t("اعتماد الفاتورة؟", "Approve invoice?")}
                    onConfirm={() => { setPendingApprove(null); handleApprove(selected); }}
                    onCancel={() => setPendingApprove(null)}
                  />
                ) : (
                  <button
                    onClick={() => setPendingApprove(selected.id)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-success hover:border-border-strong"
                    title={t("اعتماد الفاتورة", "Approve invoice")}
                  >{t("اعتماد", "Approve")}</button>
                )
              )}
              {selected.status === "DRAFT" && (
                <button
                  onClick={() => handleSplitByCategory(selected)}
                  disabled={splittingId === selected.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:border-border-strong"
                  title={t("تفكيك الفاتورة إلى فواتير حسب القسم", "Split the invoice into invoices by category")}
                >
                  {splittingId === selected.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Split className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  {t("تفكيك", "Split")}
                </button>
              )}
              {selected.status !== "PAID" && selected.status !== "CANCELLED" && selected.status !== "DRAFT" && (
                <button
                  onClick={() => openSign(selected)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:border-border-strong"
                  title={t("إرسال للتوقيع", "Send for signing")}
                ><FileSignature className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("توقيع", "Sign")}</button>
              )}
              {selected.status !== "DRAFT" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={t("فاتورة صادرة ومقفلة", "Issued and locked")}>
                  <LockKeyhole className="h-3.5 w-3.5" strokeWidth={1.75} />{t("مقفلة", "Locked")}
                </span>
              )}
              {selected.status === "DRAFT" && (pendingDelete === selected.id ? (
                <InlineConfirm onConfirm={() => handleDelete(selected.id)} onCancel={() => setPendingDelete(null)} />
              ) : (
                <button
                  onClick={() => setPendingDelete(selected.id)}
                  className="ms-auto rounded-full p-1.5 text-danger hover:bg-surface-hover"
                  title={t("حذف", "Delete")}
                ><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
              ))}
            </div>
          </aside>
        )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
