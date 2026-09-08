import { displayDigits, displayLocale } from "../lib/number-display";
/**
 * Quotes (عروض الأسعار) · wired to /api/quotes · with convert-to-invoice + sign
 * UX-1 compliant: NO Dialog · NO alert/confirm/prompt
 * UX pattern: FullPageForm + ItemsTable + SearchableCombobox · مطابق Wafeq
 */
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useSearchParams, useParams, Link } from "react-router";
import { Plus, Search, Trash2, Loader2, FileText, ArrowLeftRight, FileSignature, FileSpreadsheet, Link2, CheckCircle2, XCircle, Printer, ArrowRight, Eye } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, InlineAlert, LedgerFigure, Metric, MetricStrip, PageHeader, PageToolbar, StatusBadge } from "../components/product";
import { BidiText } from "../components/bidi-text";
import { InvoicePreviewPane } from "../components/invoice-preview-pane";
import { useWideViewport } from "../lib/use-wide-viewport";
import { getOrgId } from "../lib/api";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { useFormDraft } from "../lib/form-draft";
import { useOrgRegion } from "../lib/use-org-region";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode, computeTotals } from "../components/items-table";
import { DocumentDropZone, type ExtractedDocument } from "../components/document-dropzone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { normalizeDigits } from "../lib/digits";
import { api, ApiError, Quote, Contact, type PaymentPlan, type PaymentPlanItemInput, type PaymentCondition, type PaymentBillingMethod } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useReturnTo } from "../lib/use-return-to";
import { useLanguage } from "../components/LanguageContext";
import { BranchField } from "../components/branch-field";

const CURRENCIES = [
  { value: "SAR", label: { ar: "ريال سعودي · SAR", en: "Saudi Riyal · SAR" } },
  { value: "USD", label: { ar: "دولار أمريكي · USD", en: "US Dollar · USD" } },
  { value: "EUR", label: { ar: "يورو · EUR", en: "Euro · EUR" } },
  { value: "AED", label: { ar: "درهم إماراتي · AED", en: "UAE Dirham · AED" } },
];

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, SENT: { ar: "مرسل", en: "Sent" }, VIEWED: { ar: "مُشاهَد", en: "Viewed" }, ACCEPTED: { ar: "مقبول", en: "Accepted" },
  REJECTED: { ar: "مرفوض", en: "Rejected" }, CONVERTED: { ar: "محوّل لفاتورة", en: "Converted to invoice" }, EXPIRED: { ar: "منتهي", en: "Expired" },
};
/* Ledger status tone · accepted/converted = blue (success) · sent/viewed = copper (waiting) ·
   rejected = brick (a lost quote is a loss) · draft/expired = muted with a hollow dot */
const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = {
  DRAFT: "neutral",
  SENT: "warning",
  VIEWED: "warning",
  ACCEPTED: "success",
  REJECTED: "critical",
  CONVERTED: "success",
  EXPIRED: "neutral",
};
const money2 = (n: number | string) => Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── SPEC-05 L2 · خطة الدفعات (payment plan) ──────────────────────────────────
   The instalment schedule attached to the quote and printed on the proposal
   (the document engine renders doc.paymentPlan). Percents must sum to 100 —
   the guard blocks saving the PLAN only, never the quote itself. */
type PlanRow = { key: string; label: string; percent: string; condition: PaymentCondition; conditionValue: string; billingMethod: PaymentBillingMethod };
let planSeq = 0;
const newPlanRow = (): PlanRow => ({ key: `p${Date.now()}-${planSeq++}`, label: "", percent: "", condition: "MILESTONE", conditionValue: "", billingMethod: "INVOICE" });
const CONDITIONS: Array<{ value: PaymentCondition; ar: string; en: string }> = [
  { value: "SIGNATURE", ar: "عند التوقيع", en: "On signature" },
  { value: "MILESTONE", ar: "عند مرحلة", en: "At a milestone" },
  { value: "PROGRESS", ar: "حسب نسبة الإنجاز", en: "By progress" },
  { value: "DELIVERY", ar: "عند التسليم", en: "On delivery" },
  { value: "DATE", ar: "بتاريخ محدد", en: "On a date" },
];
const BILLING_METHODS: Array<{ value: PaymentBillingMethod; ar: string; en: string }> = [
  { value: "INVOICE", ar: "فاتورة", en: "Invoice" },
  { value: "PROGRESS_CLAIM", ar: "مستخلص", en: "Progress claim" },
];
const planPercentSum = (rows: PlanRow[]) => rows.reduce((s, r) => s + (Number(normalizeDigits(r.percent)) || 0), 0);
const planRowsValid = (rows: PlanRow[]) =>
  rows.length > 0 && rows.every((r) => r.label.trim() && Number(normalizeDigits(r.percent)) > 0) && Math.abs(planPercentSum(rows) - 100) <= 0.01;
const planRowsToItems = (rows: PlanRow[]): PaymentPlanItemInput[] => rows.map((r, i) => ({
  label: r.label.trim(),
  percent: Number(normalizeDigits(r.percent)) || 0,
  condition: r.condition,
  conditionValue: r.conditionValue.trim() || null,
  billingMethod: r.billingMethod,
  sortOrder: i,
}));
const planFromApi = (plan: PaymentPlan | null | undefined): PlanRow[] =>
  (plan?.items || []).map((i) => ({
    key: i.id || `p${Date.now()}-${planSeq++}`,
    label: i.label,
    percent: String(Number(i.percent)),
    condition: i.condition,
    conditionValue: i.conditionValue || "",
    billingMethod: i.billingMethod,
  }));

const EMPTY_FORM = {
  contactId: "",
  quoteNumber: "",
  reference: "",
  issueDate: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  currency: "SAR",
  notes: "",
  // Brand document template (id) · "" = org default for QUOTE · 2026-09-08
  templateId: "",
  // Terms & conditions · per-document override · prefilled from the template on create
  termsConditions: "",
  // Branch dimension (B1) · undefined = apply member default · null = none
  branchId: undefined as string | null | undefined,
};

/** SPEC-05 L2 · the «خطة الدفعات» editor — used in the quote form and on the quote page. */
function PaymentPlanFields({
  rows, setRows, templates, total, currency, disabled, templateId, onTemplate, actions,
}: {
  rows: PlanRow[];
  setRows: (rows: PlanRow[]) => void;
  templates: PaymentPlan[];
  total: number;
  currency: string;
  disabled?: boolean;
  templateId: string;
  onTemplate: (id: string) => void;
  actions?: ReactNode;
}) {
  const { t } = useLanguage();
  const sum = planPercentSum(rows);
  const balanced = rows.length === 0 || Math.abs(sum - 100) <= 0.01;
  const setRow = (i: number, patch: Partial<PlanRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <section className="space-y-2" data-testid="quote-payment-plan">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-section font-semibold text-foreground">{t("خطة الدفعات", "Payment plan")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={templateId || "custom"}
            onValueChange={(v) => {
              onTemplate(v === "custom" ? "" : v);
              const tpl = templates.find((x) => x.id === v);
              if (tpl) setRows(planFromApi(tpl));
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 w-[260px] border-border text-sm" data-testid="quote-plan-template"><SelectValue placeholder={t("خطة قياسية", "Standard plan")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">{t("مخصصة", "Custom")}</SelectItem>
              {templates.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" className="border-border" disabled={disabled} onClick={() => setRows([...rows, newPlanRow()])} data-testid="quote-plan-add">
            <Plus className="me-1.5 h-3.5 w-3.5" strokeWidth={1.75} />{t("+ دفعة", "+ Instalment")}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("لا توجد خطة دفعات — اختر خطة قياسية أو أضف دفعات مخصصة.", "No payment plan — pick a standard plan or add custom instalments.")}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="ledger-grid-dense" style={{ minWidth: 900 }}>
            <div className="grid" style={{ gridTemplateColumns: "minmax(200px,1.5fr) 90px 150px 180px 120px 150px 40px" }}>
              <div className="cell h">{t("وصف الدفعة", "Instalment")}</div>
              <div className="cell h n">{t("النسبة %", "Percent %")}</div>
              <div className="cell h n">{t("المبلغ", "Amount")}</div>
              <div className="cell h">{t("الاستحقاق", "Condition")}</div>
              <div className="cell h">{t("القيمة", "Value")}</div>
              <div className="cell h">{t("طريقة المطالبة", "Billing")}</div>
              <div className="cell h" aria-hidden="true" />
              {rows.map((r, i) => {
                const pct = Number(normalizeDigits(r.percent)) || 0;
                return (
                  <div key={r.key} className="contents">
                    <div className="cell"><Input value={r.label} disabled={disabled} onChange={(e) => setRow(i, { label: e.target.value })} className="text-[13px]" placeholder={t("دفعة أولى عند التوقيع", "Advance on signature")} data-testid={`quote-plan-label-${i}`} /></div>
                    <div className="cell n"><Input value={r.percent} disabled={disabled} dir="ltr" inputMode="decimal" onChange={(e) => setRow(i, { percent: normalizeDigits(e.target.value) })} className="text-[13px] font-english text-end" data-testid={`quote-plan-percent-${i}`} /></div>
                    <div className="cell n font-english text-foreground" data-testid={`quote-plan-amount-${i}`}>{money2((total * pct) / 100)}</div>
                    <div className="cell">
                      <Select value={r.condition} onValueChange={(v) => setRow(i, { condition: v as PaymentCondition })} disabled={disabled}>
                        <SelectTrigger className="h-8 border-0 bg-transparent px-0 text-[13px] shadow-none"><SelectValue /></SelectTrigger>
                        <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.ar, c.en)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="cell"><Input value={r.conditionValue} disabled={disabled} onChange={(e) => setRow(i, { conditionValue: e.target.value })} className="text-[13px]" placeholder={r.condition === "PROGRESS" ? "50" : ""} /></div>
                    <div className="cell">
                      <Select value={r.billingMethod} onValueChange={(v) => setRow(i, { billingMethod: v as PaymentBillingMethod })} disabled={disabled}>
                        <SelectTrigger className="h-8 border-0 bg-transparent px-0 text-[13px] shadow-none"><SelectValue /></SelectTrigger>
                        <SelectContent>{BILLING_METHODS.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.ar, c.en)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="cell">
                      <button type="button" disabled={disabled} onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="rounded-full p-1 text-danger hover:bg-surface-hover" title={t("حذف الدفعة", "Delete instalment")} aria-label={t("حذف الدفعة", "Delete instalment")}>
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs ${balanced ? "text-content-secondary" : "text-warning"}`} data-testid="quote-plan-sum">
          {t("مجموع النسب:", "Percent total:")} <span dir="ltr" className="font-english tabular-nums">{displayDigits(sum.toFixed(2))}%</span>
          {" · "}
          <span dir="ltr" className="font-english tabular-nums">{money2((total * sum) / 100)} {currency}</span>
        </span>
        {actions}
      </div>
      {!balanced && (
        <InlineAlert tone="warning" data-testid="quote-plan-guard">
          {t("مجموع النسب يجب أن يساوي 100% — لن تُحفظ خطة الدفعات حتى تتوازن (العرض نفسه يُحفظ عادي).",
             "The percentages must add up to 100% — the plan will not be saved until they balance (the quote itself saves normally).")}
        </InlineAlert>
      )}
    </section>
  );
}

export function Quotes() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  // Brand document templates for the QUOTE kind (BOTH counts) · selector + terms prefill
  const [docTemplates, setDocTemplates] = useState<any[]>([]);
  useEffect(() => {
    if (!createOpen) return;
    let alive = true;
    api.documentTemplates.list({ kind: "QUOTE" }).then((r) => { if (alive) setDocTemplates(r.items); }).catch(() => setDocTemplates([]));
    // New quote → prefill terms + template from the org default (the user may edit or clear them)
    api.documentTemplates.defaults().then((d) => {
      const tpl = d.QUOTE;
      if (!alive || !tpl) return;
      setForm((prev) => (prev.termsConditions || prev.templateId) ? prev : { ...prev, templateId: tpl.id, termsConditions: tpl.showTerms === false ? "" : (tpl.terms || "") });
    }).catch(() => { /* no default template · terms stay empty */ });
    return () => { alive = false; };
  }, [createOpen]);
  const { goBack: goBackToSource } = useReturnTo();
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");
  // Locale-pure defaults (CEO 2026-08-25): a US company never opens on SAR / 15% VAT.
  const { isUS, currency: orgCurrency } = useOrgRegion();
  useEffect(() => {
    if (!createOpen || !orgCurrency) return;
    if (form.currency === EMPTY_FORM.currency && orgCurrency !== EMPTY_FORM.currency) setForm((f) => ({ ...f, currency: orgCurrency }));
    if (isUS) setLines((ls) => ls.map((l) => (l.taxRate === 0.15 && !l.productId && !l.description ? { ...l, taxRate: 0 } : l)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, orgCurrency, isUS]);
  const draft = useFormDraft({ key: "quote:new", open: createOpen, snapshot: { form, lines, taxMode }, restore: (s) => { setForm(s.form); setLines(s.lines); setTaxMode(s.taxMode); } });

  // SPEC-05 L2 · payment plan (templates + the rows being edited)
  const [planTemplates, setPlanTemplates] = useState<PaymentPlan[]>([]);
  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [planTemplateId, setPlanTemplateId] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api.paymentPlans.templates().then((r) => { if (alive) setPlanTemplates(r.items); }).catch(() => { /* no templates · custom rows still work */ });
    return () => { alive = false; };
  }, []);

  const [signFor, setSignFor] = useState<Quote | null>(null);
  const [signForm, setSignForm] = useState({ name: "", email: "", message: "" });
  const [signError, setSignError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingConvert, setPendingConvert] = useState<string | null>(null);
  // SPEC-04 · award / decline actions
  const [pendingAccept, setPendingAccept] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();

  // Document view · /app/quotes/:id opens THAT quote (brief rule 8: every row opens its document).
  // On wide desktops the list keeps a split-view paper preview beside it (read-only, never a dialog).
  const params = useParams();
  const detailId = params.id && params.id !== "new" && params.id !== "import" ? params.id : null;
  const [detail, setDetail] = useState<Quote | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const wideViewport = useWideViewport();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFull, setSelectedFull] = useState<Quote | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [seller, setSeller] = useState<{ name: string; vatNumber?: string | null } | null>(null);

  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    let alive = true;
    setDetailLoading(true);
    api.quotes.get(detailId)
      .then((q) => { if (!alive) return; setDetail(q); setPlanRows(planFromApi(q.paymentPlan)); setPlanTemplateId(""); })
      .catch((e: any) => {
        if (!alive) return;
        push("error", e instanceof ApiError ? e.message : t("تعذر تحميل العرض", "Could not load the quote"));
        navigate("/app/quotes", { replace: true });
      })
      .finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId]);

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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [quotesRes, contactsRes, productsRes, accountsRes] = await Promise.all([
        api.quotes.list(),
        api.contacts.list({ limit: 200 }),
        (api as any).products?.list?.({ limit: 200 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
        (api as any).accounts?.list?.({ limit: 500 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
      ]);
      setItems(quotesRes.items);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
      setProducts((productsRes as any).items || []);
      setAccounts((accountsRes as any).items || []);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const prefillContact = searchParams.get("contactId") || "";
      setForm(prefillContact ? { ...EMPTY_FORM, contactId: prefillContact } : EMPTY_FORM);
      setLines([newLine()]);
      setTaxMode("all-exclusive");
      setCreateError(null);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = items.filter(q =>
    !searchQuery || q.quoteNumber.includes(searchQuery) ||
    (q.contact?.displayName || "").includes(searchQuery)
  );

  const total = items.reduce((s, q) => s + Number(q.total), 0);
  const accepted = items.filter(q => q.status === "ACCEPTED").length;
  const pending = items.filter(q => q.status === "SENT" || q.status === "VIEWED").length;
  // Currency-honest total: one currency → label it · mixed → per-currency figures
  const totalByCur = Object.entries(items.reduce<Record<string, number>>((acc, q) => { acc[q.currency] = (acc[q.currency] || 0) + Number(q.total); return acc; }, {}))
    .filter(([, v]) => v !== 0);
  const figureCurrency = totalByCur.length === 1 ? totalByCur[0][0] : (orgCurrency || "SAR");

  // Split view · keep a row selected while the list is wide enough for the panel
  const filteredKey = filtered.map((q) => q.id).join(",");
  useEffect(() => {
    if (!wideViewport || detailId) { setSelectedId(null); return; }
    setSelectedId((prev) => (prev && filtered.some((q) => q.id === prev) ? prev : filtered[0]?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wideViewport, filteredKey, detailId]);

  // Split view · list rows carry no lines → fetch the selected quote once (read-only)
  useEffect(() => {
    if (!selectedId) { setSelectedFull(null); return; }
    const row = items.find((q) => q.id === selectedId) || null;
    setSelectedFull(row);
    if (row?.lines && (row.lines as any[]).length) return;
    let alive = true;
    setSelectedLoading(true);
    api.quotes.get(selectedId)
      .then((full) => { if (alive) setSelectedFull(full); })
      .catch(() => { /* keep the row-level summary */ })
      .finally(() => { if (alive) setSelectedLoading(false); });
    return () => { alive = false; };
  }, [selectedId, items]);

  // The opened document follows list-side status changes (award · decline · convert)
  const detailRow = detail ? items.find((q) => q.id === detail.id) : undefined;
  const detailView: Quote | null = detail ? { ...detail, ...(detailRow || {}), lines: (detailRow?.lines as any[])?.length ? detailRow!.lines : detail.lines } : null;

  const openCreate = () => {
    const prefillContact = searchParams.get("contactId") || "";
    setForm(prefillContact ? { ...EMPTY_FORM, contactId: prefillContact } : EMPTY_FORM);
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setPlanRows([]); setPlanTemplateId("");
    setCreateOpen(true);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    goBackToSource();
  };

  /** «معاينة كاملة» · saves a draft first (a document needs an id) then opens the print view in a new tab */
  const handleFullPreview = async () => {
    const win = window.open("", "_blank", "noopener");
    const q = await handleSubmit("draft", { stayOpen: true });
    if (!q) { win?.close(); return; }
    const url = `/print/proposal/${q.id}?noprint=1${form.templateId ? `&templateId=${form.templateId}` : ""}`;
    if (win) win.location.href = url; else window.open(url, "_blank", "noopener");
  };

  const handleSubmit = async (action: "draft" | "send" = "draft", opts?: { stayOpen?: boolean }): Promise<Quote | null> => {
    setCreateError(null);
    if (!form.contactId) { setCreateError(t("اختر العميل", "Select a customer")); return null; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError(t("أضف بنداً واحداً على الأقل (وصف + سعر)", "Add at least one line item (description + price)")); return null; }
    setBusy(true);
    try {
      const status = action === "draft" ? "DRAFT" : "SENT";
      const q = await api.quotes.create({
        contactId: form.contactId,
        quoteNumber: form.quoteNumber || undefined,
        issueDate: form.issueDate,
        validUntil: form.validUntil,
        currency: form.currency,
        status,
        notes: form.notes || null,
        branchId: form.branchId ?? null,
        // Reference lives in its OWN column · terms are the per-document override (never packed together)
        reference: form.reference || null,
        termsConditions: form.termsConditions || null,
        templateId: form.templateId || null,
        lines: validLines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: l.taxInclusive
            ? Number(normalizeDigits(l.unitPrice)) / (1 + l.taxRate)
            : Number(normalizeDigits(l.unitPrice)),
        })),
      } as any);
      setItems(prev => [q, ...prev]);
      // SPEC-05 L2 · the schedule needs a saved quote · an unbalanced plan blocks
      // ONLY itself — the quote is already saved either way.
      if (planRows.length) {
        if (planRowsValid(planRows)) await applyPaymentPlan(q.id, { silent: true });
        else push("info", t("حُفظ العرض بدون خطة الدفعات — مجموع النسب ليس 100%", "Quote saved without the payment plan — the percentages do not add up to 100%"));
      }
      const msg = action === "draft" ? t(`تم حفظ ${q.quoteNumber} كمسودة`, `Saved ${q.quoteNumber} as draft`) : t(`تم إرسال ${q.quoteNumber}`, `Sent ${q.quoteNumber}`);
      push("success", msg);
      draft.clear();
      if (action === "send" && q.id) {
        try { await (api as any).email?.sendQuote?.(q.id, { message: form.notes || undefined }); } catch (e) {}
      }
      if (!opts?.stayOpen) closeCreate();
      return q;
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
      return null;
    } finally { setBusy(false); }
  };

  /** SPEC-05 L2 · store the schedule on a SAVED quote (the proposal then prints it). */
  const applyPaymentPlan = async (quoteId: string, opts?: { silent?: boolean }) => {
    if (!planRows.length) return;
    if (!planRowsValid(planRows)) {
      if (!opts?.silent) push("error", t("مجموع النسب يجب أن يساوي 100% — لم تُحفظ خطة الدفعات", "The percentages must add up to 100% — the payment plan was not saved"));
      return;
    }
    setPlanBusy(true);
    try {
      const plan = await api.quotes.setPaymentPlan(quoteId, {
        templateId: planTemplateId || null,
        name: planTemplates.find((x) => x.id === planTemplateId)?.name || null,
        items: planRowsToItems(planRows),
      });
      setDetail((prev) => (prev && prev.id === quoteId ? { ...prev, paymentPlan: plan } : prev));
      setPlanRows(planFromApi(plan));
      if (!opts?.silent) push("success", t("حُفظت خطة الدفعات وستظهر في العرض المطبوع", "Payment plan saved · it prints on the proposal"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("تعذر حفظ خطة الدفعات", "Could not save the payment plan"));
    } finally { setPlanBusy(false); }
  };

  const removePaymentPlan = async (quoteId: string) => {
    setPlanBusy(true);
    try {
      await api.quotes.removePaymentPlan(quoteId);
      setPlanRows([]); setPlanTemplateId("");
      setDetail((prev) => (prev && prev.id === quoteId ? { ...prev, paymentPlan: null } : prev));
      push("success", t("أُزيلت خطة الدفعات", "Payment plan removed"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("تعذر الحذف", "Delete failed"));
    } finally { setPlanBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.quotes.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", t("تم حذف العرض", "Quote deleted"));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  const handleConvert = async (q: Quote) => {
    setPendingConvert(null);
    try {
      const r = await api.quotes.convertToInvoice(q.id);
      push("success", t(`تم إنشاء الفاتورة ${r.invoice.invoiceNumber}`, `Created invoice ${r.invoice.invoiceNumber}`));
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, status: "CONVERTED", convertedInvoiceId: r.invoice.id } : x));
    } catch (e: any) {
      push("error", e instanceof ApiError ? (e.message === "already_converted" ? t("هذا العرض محوّل سابقاً", "This quote has already been converted") : e.message) : t("فشل التحويل", "Conversion failed"));
    }
  };

  // SPEC-04 · public accept link: generate (+email) then copy to clipboard
  const handleSendLink = async (q: Quote) => {
    try {
      const r = await api.quotes.send(q.id);
      try { await navigator.clipboard.writeText(r.url); } catch { /* clipboard may be blocked */ }
      push("success", r.emailed
        ? t(`أُرسل الرابط للعميل بالبريد ونُسخ: ${r.url}`, `Link emailed to the customer and copied: ${r.url}`)
        : t(`نُسخ رابط الاعتماد: ${r.url}`, `Accept link copied: ${r.url}`));
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, status: x.status === "DRAFT" ? "SENT" : x.status, acceptToken: r.token } : x));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل إنشاء الرابط", "Failed to create the link"));
    }
  };

  // SPEC-04 · manual award (bank transfer / phone) → ACCEPTED + auto project
  const handleManualAccept = async (q: Quote) => {
    setPendingAccept(null);
    try {
      await api.quotes.decision(q.id, { action: "accept", source: t("موافقة يدوية من الشاشة", "Manual approval") });
      push("success", t(`ترسية ${q.quoteNumber} ✓ · تم إنشاء المشروع تلقائيًا`, `${q.quoteNumber} awarded ✓ · project created`));
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, status: "ACCEPTED" } : x));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التسجيل", "Failed"));
    }
  };

  // SPEC-04 · decline with a mandatory reason (feeds the loss-reasons analysis)
  const handleReject = async (q: Quote) => {
    if (!rejectReason.trim()) { push("error", t("سبب الرفض إلزامي", "A reason is required")); return; }
    try {
      await api.quotes.decision(q.id, { action: "reject", reason: rejectReason.trim() });
      push("success", t("سُجّل الاعتذار والسبب", "Declination recorded"));
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, status: "REJECTED", rejectReason: rejectReason.trim() } : x));
      setRejectFor(null); setRejectReason("");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التسجيل", "Failed"));
    }
  };

  const openSign = (q: Quote) => {
    const customer = customers.find((c) => c.id === q.contactId);
    setSignFor(q);
    setSignForm({
      name: customer?.displayName || "",
      email: customer?.email || "",
      message: t(`يرجى مراجعة وتوقيع عرض السعر رقم ${q.quoteNumber}`, `Please review and sign quote no. ${q.quoteNumber}`),
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
      const r = await api.sign.sendQuote(signFor.id, {
        signers: [{ name: signForm.name, email: signForm.email, role: "Customer" }],
        message: signForm.message,
        expiresInDays: 30,
      });
      if (r.error) {
        push("error", t(`حُفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`, `Request saved but DocuSeal did not respond: ${r.error}`));
      } else {
        push("success", t(`تم إرسال العرض للتوقيع إلى ${signForm.email}`, `Quote sent for signing to ${signForm.email}`));
        if (signFor.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === signFor.id ? { ...x, status: "SENT" } : x));
        }
      }
      closeSign();
    } catch (e: any) {
      setSignError(e instanceof ApiError ? (e.message === "already_pending" ? t("يوجد طلب توقيع نشط لهذا العرض", "There is an active signing request for this quote") : e.message) : t("فشل الإرسال", "Send failed"));
    } finally { setBusy(false); }
  };

  // Full-page Create form
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={t("عرض سعر جديد", "New quote")}
          subtitle={t("املأ البيانات الأساسية · يمكنك التعديل لاحقاً", "Fill in the basic details · you can edit later")}
          onClose={closeCreate}
          disableEscape={busy}
          draft={draft}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={closeCreate} className="border-border">{t("إلغاء", "Cancel")}</Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={handleFullPreview} data-testid="quote-full-preview" title={t("يحفظ مسودة ثم يفتح المستند الكامل بكل صفحاته في تبويب جديد", "Saves a draft, then opens the full document with all its pages in a new tab")}>
                  {t("معاينة كاملة", "Full preview")}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => handleSubmit("draft")} className="bg-primary hover:bg-primary/80">
                  {busy ? "..." : t("حفظ كمسودة", "Save as draft")}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("send")} className="border-success text-success hover:bg-success-subtle" title={t("إرسال للعميل", "Send to customer")}>
                  {busy ? "..." : t("حفظ + إرسال", "Save + send")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="w-full max-w-none mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{createError}</div>}

            {/* Top fields row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("العميل", "Customer")} *</Label>
                <SearchableCombobox
                  value={form.contactId}
                  onChange={(id) => setForm({ ...form, contactId: id })}
                  onCreate={async (name) => {
                    const c = await api.contacts.create({ displayName: name, type: "CUSTOMER" });
                    setCustomers((prev) => [c, ...prev]);
                    push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
                    return c.id;
                  }}
                  items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                  placeholder={t("ابحث عن عميل...", "Search for a customer...")}
                  createLabel={(q) => t(`+ إنشاء "${q}"`, `+ Create "${q}"`)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("تاريخ العرض", "Quote date")} *</Label>
                <DateInput value={form.issueDate} onChange={(iso) => setForm({ ...form, issueDate: iso })} required inputClassName="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("صالح حتى", "Valid until")} *</Label>
                <DateInput value={form.validUntil} onChange={(iso) => setForm({ ...form, validUntil: iso })} required inputClassName="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("رقم العرض", "Quote number")}</Label>
                <Input value={form.quoteNumber} onChange={(e) => setForm({ ...form, quoteNumber: e.target.value })} placeholder={t("# تلقائي", "# Auto")} dir="ltr" className="border-border font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("المرجع", "Reference")}</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("رقم مرجع داخلي", "Internal reference number")} className="border-border h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("العملة", "Currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.label.ar, c.label.en)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("المبالغ", "Amounts")}</Label>
                <Select value={taxMode} onValueChange={(v) => setTaxMode(v as TaxMode)}>
                  <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-exclusive">{t("غير شاملة الضريبة", "Exclusive of tax")}</SelectItem>
                    <SelectItem value="all-inclusive">{t("شاملة الضريبة", "Inclusive of tax")}</SelectItem>
                    <SelectItem value="custom">{t("مخصصة لكل بند", "Custom per line")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("الفرع", "Branch")}</Label>
                <BranchField compact value={form.branchId} onChange={(id) => setForm((f) => ({ ...f, branchId: id }))} />
              </div>
              <div className="space-y-1.5" data-testid="quote-template-field">
                <Label className="text-foreground/80 text-xs">{t("قالب المستند", "Document template")}</Label>
                {/* Brand templates (designer · /app/templates) · empty = org default for quotes */}
                <SearchableCombobox
                  value={form.templateId}
                  onChange={(id) => {
                    const tpl = docTemplates.find((x) => x.id === id);
                    setForm((prev) => ({ ...prev, templateId: id, termsConditions: prev.termsConditions || (tpl?.showTerms === false ? "" : (tpl?.terms || "")) }));
                  }}
                  items={docTemplates.map((x) => ({ id: x.id, label: x.name, sublabel: x.isDefault ? t("افتراضي", "Default") : (x.nameEn || undefined) }))}
                  placeholder={t("القالب الافتراضي", "Default template")}
                  onCreate={async () => { navigate("/app/templates/new?type=QUOTE"); return ""; }}
                  createLabel={(q) => t(`تصميم قالب جديد «${q}»`, `Design a new template “${q}”`)}
                />
              </div>
            </div>

            <ItemsTable
              lines={lines}
              setLines={setLines}
              mode={taxMode}
              onModeChange={setTaxMode}
              defaultTaxRate={0.15}
              currency={form.currency}
              direction="sales"
              minRows={10}
              products={products.map((p: any) => ({ id: p.id, name: displayName(p), sku: p.sku, unitPrice: Number(p.unitPrice) || 0, defaultAccountId: p.incomeAccountId }))}
              accounts={accounts.map((a: any) => ({ id: a.id, code: a.code, name: displayName(a), type: a.type, subtype: a.subtype }))}
              onCreateProduct={async (name: string) => {
                const created = await (api as any).products.create({ name, type: "SERVICE", unitPrice: "0", isActive: true });
                setProducts((prev) => [created, ...prev]);
                return { id: created.id, name: created.name, sku: created.sku, unitPrice: 0 };
              }}
              onCreateAccount={async (name: string) => {
                const created = await (api as any).accounts.create({ name, type: "REVENUE", code: String(4000 + Math.floor(Math.random() * 100)) });
                setAccounts((prev) => [created, ...prev]);
                return { id: created.id, code: created.code, name: created.name, type: created.type };
              }}
            />

            <DocumentDropZone
              compact
              target="quote-lines"
              hint={t("استخرج بنود عرض السعر من هذا المستند", "Extract quote line items from this document")}
              defaultTaxRate={0.15}
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
                  taxRate: l.taxRate ?? 0.15,
                  taxInclusive: l.taxInclusive ?? false,
                }));
                setLines(newLines);
                if (data.notes) setForm((f) => ({ ...f, notes: data.notes || f.notes }));
                push("success", t(`تم استخراج ${newLines.length} بنداً`, `Extracted ${newLines.length} line item(s)`));
              }}
              onError={(msg) => push("error", msg)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("شروط ومدة التنفيذ", "Terms and delivery period")}</Label>
                <textarea
                  rows={3}
                  placeholder={t("شروط الدفع · مدة التنفيذ · ضمانات...", "Payment terms · delivery period · warranties...")}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                />
                <Label className="text-foreground/80 text-xs">{t("الشروط والأحكام · تُطبع في بطاقة «شروط العرض» (مُعبّأة من القالب · عدّلها لهذا العرض)", "Terms & conditions · printed in the terms card (prefilled from the template · edit for this quote)")}</Label>
                <textarea
                  rows={5}
                  placeholder={t("سطر لكل شرط — العرض ساري 30 يومًا من تاريخ الإصدار…", "One term per line — valid for 30 days from the issue date…")}
                  value={form.termsConditions}
                  onChange={(e) => setForm({ ...form, termsConditions: e.target.value })}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  data-testid="quote-terms"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("الإجمالي", "Total")}</Label>
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  {(() => {
                    const totals = computeTotals(lines);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground min-w-0 break-words">{t("المجموع الفرعي", "Subtotal")}</span>
                          <span className="font-english text-end whitespace-nowrap shrink-0">{form.currency} {displayDigits(totals.subtotal.toFixed(2))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground min-w-0 break-words">{t("الضريبة (15%)", "Tax (15%)")}</span>
                          <span className="font-english text-end whitespace-nowrap shrink-0">{form.currency} {displayDigits(totals.tax.toFixed(2))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                          <span className="text-foreground min-w-0 break-words" style={{ fontWeight: 600 }}>{t("الإجمالي:", "Total:")}</span>
                          <span className="font-english text-foreground text-end whitespace-nowrap shrink-0" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                            {form.currency} {displayDigits(totals.total.toFixed(2))}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* SPEC-05 L2 · instalment schedule · printed on the proposal */}
            <PaymentPlanFields
              rows={planRows}
              setRows={setPlanRows}
              templates={planTemplates}
              templateId={planTemplateId}
              onTemplate={setPlanTemplateId}
              total={computeTotals(lines).total}
              currency={form.currency}
              disabled={busy}
            />
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  // Full-page Sign form
  if (signFor) {
    return (
      <>
        <FullPageForm
          title={t(`إرسال ${signFor.quoteNumber} للتوقيع`, `Send ${signFor.quoteNumber} for signing`)}
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
            {signError && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{signError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("اسم الموقّع", "Signer name")} *</Label>
                <Input value={signForm.name} onChange={(e) => setSignForm({ ...signForm, name: e.target.value })} placeholder={t("الاسم الكامل", "Full name")} /></div>
              <div className="space-y-2"><Label>{t("البريد الإلكتروني", "Email")} *</Label>
                <Input type="email" value={signForm.email} onChange={(e) => setSignForm({ ...signForm, email: e.target.value })} dir="ltr" className="font-english" placeholder="signer@example.com" /></div>
            </div>
            <div className="space-y-2"><Label>{t("الرسالة المرفقة", "Attached message")}</Label>
              <textarea value={signForm.message} onChange={(e) => setSignForm({ ...signForm, message: e.target.value })} rows={4} className="w-full rounded-md border border-border px-3 py-2 text-sm" /></div>
            <p className="text-xs text-muted-foreground">{t("سيستلم الموقّع رابطاً عبر البريد لمراجعة العرض وتوقيعه · صلاحية الرابط 30 يوم.", "The signer will receive a link by email to review and sign the quote · link valid for 30 days.")}</p>
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  const statusWord = (q: Quote) => (STATUS_LABELS[q.status] ? t(STATUS_LABELS[q.status].ar, STATUS_LABELS[q.status].en) : q.status);
  const statusPill = (q: Quote) => (
    <StatusBadge
      tone={STATUS_TONE[q.status] || "neutral"}
      icon={q.status === "DRAFT" || q.status === "EXPIRED" ? <span className="ledger-dot hollow" aria-hidden="true" /> : undefined}
      title={q.status === "REJECTED" && q.rejectReason ? t(`السبب: ${q.rejectReason}`, `Reason: ${q.rejectReason}`) : undefined}
    >
      {statusWord(q)}
    </StatusBadge>
  );

  // Workflow actions for one quote · quiet pills (list rows keep open · print · delete only)
  const workflowActions = (q: Quote) => (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <a href={`/print/proposal/${q.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:border-border-strong" title={t("معاينة/طباعة العرض المتكامل", "Preview / print the proposal")}>
        <Printer className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("العرض", "Proposal")}
      </a>
      {q.status !== "CONVERTED" && q.status !== "REJECTED" && q.status !== "ACCEPTED" && (
        <button onClick={() => handleSendLink(q)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:border-border-strong" title={t("إنشاء رابط اعتماد عام + إرساله للعميل", "Create a public accept link + email it")}>
          <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("رابط القبول", "Accept link")}
        </button>
      )}
      {(q.status === "SENT" || q.status === "VIEWED" || q.status === "DRAFT") && (
        pendingAccept === q.id ? (
          <InlineConfirm onConfirm={() => handleManualAccept(q)} onCancel={() => setPendingAccept(null)} label={t("تسجيل موافقة العميل وإنشاء المشروع؟", "Record approval + create project?")} />
        ) : (
          <button onClick={() => setPendingAccept(q.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-success hover:border-border-strong" title={t("موافقة يدوية (حوالة/هاتف) → مشروع تلقائي", "Manual approval → auto project")}>
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("ترسية", "Award")}
          </button>
        )
      )}
      {(q.status === "SENT" || q.status === "VIEWED" || q.status === "DRAFT") && (
        rejectFor === q.id ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            <Input autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t("سبب الخسارة (إلزامي)...", "Loss reason (required)...")} className="h-7 w-44 border-danger-border text-xs" onKeyDown={(e) => { if (e.key === "Enter") handleReject(q); if (e.key === "Escape") { setRejectFor(null); setRejectReason(""); } }} />
            <button onClick={() => handleReject(q)} className="rounded-full bg-danger px-2.5 py-1 text-xs text-primary-foreground">{t("تأكيد", "OK")}</button>
            <button onClick={() => { setRejectFor(null); setRejectReason(""); }} className="rounded-full px-2.5 py-1 text-xs text-muted-foreground">{t("إلغاء", "Cancel")}</button>
          </span>
        ) : (
          <button onClick={() => { setRejectFor(q.id); setRejectReason(""); }} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-danger hover:border-border-strong" title={t("اعتذار/خسارة مع تسجيل السبب", "Decline with a reason")}>
            <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("رفض", "Decline")}
          </button>
        )
      )}
      {q.status !== "CONVERTED" && q.status !== "REJECTED" && (
        <button onClick={() => openSign(q)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:border-border-strong" title={t("إرسال للتوقيع", "Send for signing")}>
          <FileSignature className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("توقيع", "Sign")}
        </button>
      )}
      {q.status !== "CONVERTED" && (
        pendingConvert === q.id ? (
          <InlineConfirm onConfirm={() => handleConvert(q)} onCancel={() => setPendingConvert(null)} label={t("تحويل لفاتورة؟", "Convert to invoice?")} />
        ) : (
          <button onClick={() => setPendingConvert(q.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-success hover:border-border-strong" title={t("تحويل لفاتورة", "Convert to invoice")}>
            <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("تحويل", "Convert")}
          </button>
        )
      )}
      {q.status === "CONVERTED" && q.convertedInvoiceId && (
        <Link to={`/app/invoices/${q.convertedInvoiceId}`} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:border-border-strong">
          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("فتح الفاتورة", "Open invoice")}
        </Link>
      )}
      {pendingDelete === q.id ? (
        <InlineConfirm onConfirm={() => handleDelete(q.id)} onCancel={() => setPendingDelete(null)} />
      ) : (
        <button onClick={() => setPendingDelete(q.id)} className="ms-auto rounded-full p-1.5 text-danger hover:bg-surface-hover" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
      )}
    </div>
  );

  const previewDoc = (q: Quote) => ({
    id: q.id,
    number: q.quoteNumber,
    status: q.status,
    issueDate: q.issueDate,
    dueDate: q.validUntil,
    currency: q.currency,
    subtotal: q.subtotal,
    taxTotal: q.taxTotal,
    total: q.total,
    lines: (q.lines as any[])?.map((l: any) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, total: l.total })),
  });

  // Document view · /app/quotes/:id
  if (detailId) {
    const q = detailView;
    return (
      <div className="space-y-6">
        <PageHeader
          className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
          eyebrow={<span className="text-[13px]">{t("المبيعات", "Sales")} · <Link to="/app/quotes" className="hover:underline">{t("عروض الأسعار", "Quotes")}</Link></span>}
          title={q ? <span dir="ltr" className="font-code">{q.quoteNumber}</span> : t("عرض سعر", "Quote")}
          description={q ? <><BidiText>{q.contact?.displayName || "—"}</BidiText>{q.title ? <> · <BidiText>{q.title}</BidiText></> : null}</> : undefined}
          actions={
            <Button variant="outline" className="h-10 px-[18px] text-sm" onClick={() => navigate("/app/quotes")}>
              <ArrowRight className="me-2 h-4 w-4 rtl:rotate-0 ltr:rotate-180" strokeWidth={1.75} />{t("عروض الأسعار", "Quotes")}
            </Button>
          }
        />
        {detailLoading || !q ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)]">
            <div className="min-w-0 rounded-lg bg-surface-subtle p-4">
              <InvoicePreviewPane
                doc={previewDoc(q)}
                seller={seller}
                customer={q.contact ? { name: q.contact.displayName, vatNumber: (q.contact as any).taxId } : null}
                docTypeLabel={t("عرض سعر", "Quotation")}
                statusLabel={statusWord(q)}
                statusMeta={[String(q.issueDate || "").slice(0, 10), q.validUntil ? `→ ${String(q.validUntil).slice(0, 10)}` : ""].filter(Boolean).join(" ")}
                onSend={q.status !== "CONVERTED" && q.status !== "REJECTED" ? () => openSign(q) : undefined}
                onPdf={() => window.open(`/print/proposal/${q.id}`, "_blank", "noopener")}
              />
            </div>
            <aside className="min-w-0 space-y-4">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-section font-semibold text-foreground">{t("الحالة", "Status")}</h2>
                  {statusPill(q)}
                </div>
                <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-content-secondary">{t("العميل", "Customer")}</dt>
                  <dd className="min-w-0 truncate text-foreground">
                    {q.contactId ? <Link to={`/app/contacts/${q.contactId}`} className="hover:underline underline-offset-4"><BidiText>{q.contact?.displayName || "—"}</BidiText></Link> : <BidiText>{q.contact?.displayName || "—"}</BidiText>}
                  </dd>
                  <dt className="text-content-secondary">{t("تاريخ العرض", "Quote date")}</dt>
                  <dd><span dir="ltr" className="font-english tabular-nums text-foreground">{q.issueDate?.slice(0, 10)}</span></dd>
                  <dt className="text-content-secondary">{t("صالح حتى", "Valid until")}</dt>
                  <dd><span dir="ltr" className="font-english tabular-nums text-foreground">{q.validUntil?.slice(0, 10) || "—"}</span></dd>
                  <dt className="text-content-secondary">{t("الإجمالي", "Total")}</dt>
                  <dd><span dir="ltr" className="font-display text-[18px] leading-6 tabular-nums text-foreground">{money2(q.total)} <span className="font-english text-xs text-muted-foreground">{q.currency}</span></span></dd>
                  {q.rejectReason && <>
                    <dt className="text-content-secondary">{t("سبب الرفض", "Decline reason")}</dt>
                    <dd className="min-w-0 break-words text-foreground">{q.rejectReason}</dd>
                  </>}
                  {q.estimateId && <>
                    <dt className="text-content-secondary">{t("المصدر", "Origin")}</dt>
                    <dd className="min-w-0">
                      <Link to={`/app/estimates/${q.estimateId}`} className="font-code text-primary hover:underline underline-offset-4" data-testid="quote-estimate-link">
                        {t("من الدراسة", "From estimate")} {q.estimate?.number || "EST"}
                      </Link>
                    </dd>
                  </>}
                  {q.notes && <>
                    <dt className="text-content-secondary">{t("شروط ومدة التنفيذ", "Terms and delivery period")}</dt>
                    <dd className="min-w-0 whitespace-pre-wrap break-words text-foreground">{q.notes}</dd>
                  </>}
                </dl>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-3 text-section font-semibold text-foreground">{t("إجراءات", "Actions")}</h2>
                {workflowActions(q)}
              </div>
            </aside>
            {/* SPEC-05 L2 · the stored schedule · edited here, printed on the proposal */}
            <div className="lg:col-span-2">
              <PaymentPlanFields
                rows={planRows}
                setRows={setPlanRows}
                templates={planTemplates}
                templateId={planTemplateId}
                onTemplate={setPlanTemplateId}
                total={Number(q.total || 0)}
                currency={q.currency}
                disabled={planBusy}
                actions={
                  <span className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" disabled={planBusy || !planRows.length || !planRowsValid(planRows)} onClick={() => applyPaymentPlan(q.id)} data-testid="quote-plan-save">
                      {t("حفظ خطة الدفعات", "Save payment plan")}
                    </Button>
                    {q.paymentPlan && (
                      <Button type="button" size="sm" variant="outline" className="border-border text-danger" disabled={planBusy} onClick={() => removePaymentPlan(q.id)}>
                        {t("إزالة الخطة", "Remove plan")}
                      </Button>
                    )}
                  </span>
                }
              />
            </div>
          </div>
        )}
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  const selected = selectedFull;
  const compactList = wideViewport;

  return (
    <div className="space-y-6">
      <div className={wideViewport ? "grid grid-cols-[minmax(0,1fr)_minmax(380px,30%)] items-start gap-8" : ""}>
        <div className="min-w-0 space-y-6">
      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
        eyebrow={<span className="text-[13px]">{t("المبيعات", "Sales")}</span>}
        title={t("عروض الأسعار", "Quotes")}
        description={t("إدارة عروض الأسعار للعملاء", "Manage customer quotes")}
        actions={
          <>
            <Button variant="outline" className="h-10 px-[18px] text-sm" onClick={() => navigate("/app/quotes/import")}>
              <FileSpreadsheet className="me-2 h-4 w-4" strokeWidth={1.75} />{t("استيراد BOQ", "Import BOQ")}
            </Button>
            <Button className="h-10 px-[18px] text-sm" onClick={openCreate}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("عرض سعر جديد", "New quote")}</Button>
          </>
        }
      />

      {/* Ledger figures · ink rules, serif numerals, currency stated once */}
      <MetricStrip className="compact">
        <Metric label={t("إجمالي العروض", "Total quotes")} value={items.length} hint={t("عرض", "quotes")} />
        <Metric label={t("معلقة (في انتظار الرد)", "Pending (awaiting response)")} value={<span className="text-warning">{pending}</span>} hint={t("مرسلة أو مُشاهَدة", "Sent or viewed")} />
        <Metric label={t("مقبولة", "Accepted")} value={<span className="text-success">{accepted}</span>} hint={t("ترسية", "Awarded")} />
        <Metric
          label={t("القيمة الإجمالية", "Total value")}
          value={totalByCur.length > 1
            ? <span className="flex flex-col gap-1">{totalByCur.map(([cur, v]) => <span key={cur}><LedgerFigure value={v} currency={cur} /></span>)}</span>
            : <LedgerFigure value={total} currency={figureCurrency} />}
        />
      </MetricStrip>

      <PageToolbar aria-label={t("مرشحات العروض", "Quote filters")} className="justify-between">
        <h2 className="text-section font-semibold text-foreground">{t("قائمة العروض", "Quote list")}</h2>
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("بحث...", "Search...")} className="h-9 w-full ps-8 text-[13px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </PageToolbar>

      {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
       filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" strokeWidth={1.75} />} title={t("لا توجد عروض أسعار بعد", "No quotes yet")} />
      ) : (
        <>
        {/* Compact stacked list on phones · the wide ledger table from md up */}
        <ul className="md:hidden">
          {filtered.map((q) => (
            <li key={q.id}>
              <button type="button" onClick={() => navigate(`/app/quotes/${q.id}`)} className="flex w-full min-h-11 items-center justify-between gap-3 border-b border-border py-3 text-start" title={t("فتح العرض", "Open quote")}>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-sm font-semibold text-foreground"><BidiText>{q.contact?.displayName || "—"}</BidiText></span>
                  <span dir="ltr" className="font-code text-xs text-muted-foreground">{q.quoteNumber} · {q.issueDate?.slice(0, 10)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-[3px]">
                  <span dir="ltr" className="font-display text-[18px] leading-5 text-foreground tabular-nums">{money2(q.total)}</span>
                  {statusPill(q)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="ledger-table hidden md:block overflow-x-auto [&_th]:text-[11px] [&_th]:tracking-[0.06em]">
        <Table className={`table-fixed ${compactList ? "min-w-[820px]" : "min-w-[980px]"}`}>
          <colgroup>
            <col style={{ width: "200px" }} />{/* رقم العرض · mono */}
            <col style={{ minWidth: "110px" }} />{/* العميل · flexible */}
            <col style={{ width: "110px" }} />{/* التاريخ */}
            <col style={{ width: "110px" }} />{/* صالح حتى */}
            <col style={{ width: "130px" }} />{/* الإجمالي */}
            <col style={{ width: "140px" }} />{/* الحالة */}
            {!compactList && <col style={{ width: "150px" }} />}{/* إجراءات · in split view the panel action bar takes over */}
          </colgroup>
          <TableHeader><TableRow className="hover:bg-transparent">
            <TableHead>{t("رقم العرض", "Quote no.")}</TableHead>
            <TableHead>{t("العميل", "Customer")}</TableHead>
            <TableHead>{t("التاريخ", "Date")}</TableHead>
            <TableHead>{t("صالح حتى", "Valid until")}</TableHead>
            <TableHead className="text-end">{t("الإجمالي", "Total")}</TableHead>
            <TableHead>{t("الحالة", "Status")}</TableHead>
            {!compactList && <TableHead>{t("إجراءات", "Actions")}</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(q => (
              <TableRow
                key={q.id}
                onClick={() => (wideViewport ? setSelectedId(q.id) : navigate(`/app/quotes/${q.id}`))}
                onDoubleClick={() => navigate(`/app/quotes/${q.id}`)}
                data-state={wideViewport && selectedId === q.id ? "selected" : undefined}
                className="h-12 cursor-pointer data-[state=selected]:border-b-transparent data-[state=selected]:[&>td:first-child]:rounded-s-lg data-[state=selected]:[&>td:last-child]:rounded-e-lg"
                title={wideViewport ? t("عرض في اللوحة · نقرتان للفتح", "Show in the panel · double-click to open") : t("فتح العرض", "Open quote")}
              >
                <TableCell className="text-start overflow-hidden">
                  {/* LTR code inside an RTL cell: ellipsis at the code's end, aligned to the page start */}
                  <Link to={`/app/quotes/${q.id}`} onClick={(e) => e.stopPropagation()} title={q.quoteNumber} className="block max-w-full hover:underline underline-offset-4">
                    <span dir="ltr" className={`block truncate font-code text-sm font-semibold text-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{q.quoteNumber}</span>
                  </Link>
                </TableCell>
                <TableCell className="overflow-hidden text-sm text-foreground" title={q.contact?.displayName || ""}>
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap leading-5"><bdi dir="auto">{q.contact?.displayName || "—"}</bdi></span>
                </TableCell>
                <TableCell className="text-start"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{q.issueDate?.slice(0, 10)}</span></TableCell>
                <TableCell className="text-start"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{q.validUntil?.slice(0, 10)}</span></TableCell>
                <TableCell className="text-end">
                  <span dir="ltr" className="block font-display text-[18px] leading-6 text-foreground tabular-nums">{money2(q.total)}{q.currency !== figureCurrency && <span className="font-english text-[10px] text-muted-foreground"> {q.currency}</span>}</span>
                </TableCell>
                <TableCell className="align-middle">{statusPill(q)}</TableCell>
                {!compactList && (
                <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <button onClick={() => navigate(`/app/quotes/${q.id}`)} className="rounded-full p-1.5 text-primary hover:bg-surface-hover" title={t("فتح العرض", "Open quote")}><Eye className="h-4 w-4" strokeWidth={1.75} /></button>
                    <a href={`/print/proposal/${q.id}`} target="_blank" rel="noreferrer" className="rounded-full p-1.5 text-content-secondary hover:bg-surface-hover" title={t("معاينة/طباعة العرض المتكامل", "Preview / print the proposal")}><Printer className="h-4 w-4" strokeWidth={1.75} /></a>
                    {pendingDelete === q.id ? (
                      <InlineConfirm onConfirm={() => handleDelete(q.id)} onCancel={() => setPendingDelete(null)} />
                    ) : (
                      <button onClick={() => setPendingDelete(q.id)} className="rounded-full p-1.5 text-danger hover:bg-surface-hover" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                    )}
                  </div>
                </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        </>
      )}
        </div>

        {/* Split view · the selected quote as a paper document (desktop ≥1536px) */}
        {wideViewport && selected && (
          <aside className="sticky top-4 rounded-lg bg-surface-subtle p-4" aria-label={t("معاينة العرض", "Quote preview")}>
            <InvoicePreviewPane
              doc={previewDoc(selected)}
              seller={seller}
              customer={selected.contact ? { name: selected.contact.displayName, vatNumber: (selected.contact as any).taxId } : null}
              docTypeLabel={t("عرض سعر", "Quotation")}
              statusLabel={statusWord(selected)}
              statusMeta={[String(selected.issueDate || "").slice(0, 10), selected.validUntil ? `→ ${String(selected.validUntil).slice(0, 10)}` : ""].filter(Boolean).join(" ")}
              loading={selectedLoading}
              onSend={selected.status !== "CONVERTED" && selected.status !== "REJECTED" ? () => openSign(selected) : undefined}
              onPdf={() => window.open(`/print/proposal/${selected.id}`, "_blank", "noopener")}
              onEdit={() => navigate(`/app/quotes/${selected.id}`)}
              editLabel={t("فتح", "Open")}
            />
            <div className="mt-3">{workflowActions(selected)}</div>
          </aside>
        )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
