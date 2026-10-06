import { QuoteSignaturePlacement, type SignatureSelection } from "../components/quote-signature-placement";
import { ContactProfileLink } from "../components/contact-profile-link";
import { SignatureHistory } from "../components/signature-history";
import { InvoiceDocuments } from "../components/invoice-documents";
import type { SourceFile } from "../lib/source-file";
import { displayDigits, displayLocale } from "../lib/number-display";
/**
 * Quotes (عروض الأسعار) · wired to /api/quotes · with convert-to-invoice + sign
 * UX-1 compliant: NO Dialog · NO alert/confirm/prompt
 * UX pattern: FullPageForm + ItemsTable + SearchableCombobox · مطابق Wafeq
 */
import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { useSearchParams, useParams, Link, useLocation } from "react-router";
import { Plus, Trash2, Loader2, FileText, ArrowLeftRight, FileSignature, Link2, CheckCircle2, XCircle, Printer, ArrowRight, Mail, Pencil } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { InlineAlert, PageHeader, StatusBadge } from "../components/product";
import { BidiText } from "../components/bidi-text";
import { InvoicePreviewPane } from "../components/invoice-preview-pane";
import { QuotesDashboard } from "../components/quotes-dashboard";
import { loadQuoteOverview } from "../lib/quote-overview";
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
import { DocumentPagesEditor, DocumentPagesSection } from "../components/document-pages-editor";
import { normalizePages, type DocPage } from "../lib/document-render";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { normalizeDigits } from "../lib/digits";
import { api, ApiError, Quote, Contact, DocumentSendRecord, type PaymentPlan, type PaymentPlanItemInput, type PaymentCondition, type PaymentBillingMethod } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useReturnTo } from "../lib/use-return-to";
import { useLanguage } from "../components/LanguageContext";
import { BranchField } from "../components/branch-field";
import { SendComposeForm } from "../components/send-compose-form";
import { SendLogSection } from "../components/send-log-section";
import { humanizeError } from "../lib/error-messages";

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
  originProjectId: "",
  contactId: "",
  /**
   * PROJECT / DOCUMENT TITLE (CEO 2026-09-21 · «وين احط اسم المشروع؟»).
   * `Quote.title` has always existed and the proposal cover prints it under
   * «عرض سعر» — there was simply no field to type it into, so every cover
   * came out untitled while the same quote written by hand carried a name.
   */
  title: "",
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
  // Free-form pages (CEO 2026-09-13) · printed before the T&C page
  pages: [] as DocPage[],
  // Branch dimension (B1) · undefined = apply member default · null = none
  branchId: undefined as string | null | undefined,
  // DOCUMENT-LEVEL DISCOUNT (CEO 2026-09-14) · "" = none · applied before tax, printed as its own row
  discountType: "" as "" | "PERCENT" | "FIXED",
  discountValue: "",
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
  const consumingNewQuery = useRef(false);
  const [items, setItems] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [fullPreviewUrl, setFullPreviewUrl] = useState<string | null>(null);
  const [acceptLink, setAcceptLink] = useState<{ quoteId: string; url: string } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  // CEO 2026-09-21 (verbatim): «ولا شفت تعديل في العروض كلها نفس المشلكة» — the
  // quote form only ever created. Opening a saved quote now fills the SAME form
  // and PATCHes it, so a correction is an edit, never a second quote.
  const [editId, setEditId] = useState<string | null>(null);
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

  // SPEC-05 L2 · payment plan (templates + the rows being edited)
  const [planTemplates, setPlanTemplates] = useState<PaymentPlan[]>([]);
  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [planTemplateId, setPlanTemplateId] = useState("");

  // The payment plan is part of the quote, so it belongs in the draft. It used
  // to live outside the snapshot: Esc kept the lines and the header and threw
  // the plan away, and it had to be typed again from scratch (2026-09-21).
  const draft = useFormDraft({
    key: editId ? `quote:${editId}` : "quote:new",
    restoreMode: "prompt",
    open: createOpen,
    snapshot: { form, lines, taxMode, planRows, planTemplateId },
    restore: (s) => {
      setForm(s.form); setLines(s.lines); setTaxMode(s.taxMode);
      if (Array.isArray(s.planRows)) setPlanRows(s.planRows);
      if (s.planTemplateId !== undefined) setPlanTemplateId(s.planTemplateId);
    },
  });

  const [planBusy, setPlanBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api.paymentPlans.templates().then((r) => { if (alive) setPlanTemplates(r.items); }).catch(() => { /* no templates · custom rows still work */ });
    return () => { alive = false; };
  }, []);

  const [signatureSelection, setSignatureSelection] = useState<SignatureSelection | null>(null);
  const [signatureEmail, setSignatureEmail] = useState(false);
  const [signatureRevision, setSignatureRevision] = useState(0);
  const [signatureBlocked, setSignatureBlocked] = useState(true);
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
  const [seller, setSeller] = useState<{ name: string; vatNumber?: string | null } | null>(null);
  // Send compose page (W-SEND · 2026-09-08) · «إرسال» always opens a page to
  // review/edit the message — it never fires an email silently.
  const [sendComposeFor, setSendComposeFor] = useState<{ quote: Quote; prefill?: DocumentSendRecord; fromCreate?: boolean } | null>(null);
  const [sendLogRefresh, setSendLogRefresh] = useState(0);

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
    setListError(null);
    try {
      const [quotesRes, contactsRes, productsRes, accountsRes] = await Promise.all([
        loadQuoteOverview(),
        api.contacts.list({ limit: 200 }),
        (api as any).products?.list?.({ limit: 200 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
        (api as any).accounts?.list?.({ limit: 500 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
      ]);
      setItems(quotesRes);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
      setProducts((productsRes as any).items || []);
      setAccounts((accountsRes as any).items || []);
    } catch (e: any) {
      setListError(e instanceof Error ? e.message : "load_failed");
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const prefillContact = searchParams.get("contactId") || "";
      setForm({ ...EMPTY_FORM, contactId: prefillContact, originProjectId: searchParams.get("projectId") || "" });
      setLines([newLine()]);
      setTaxMode("all-exclusive");
      setCreateError(null);
      setEditId(null);
      setCreateOpen(true);
      consumingNewQuery.current = true;
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // The opened document follows list-side status changes (award · decline · convert)
  const detailRow = detail ? items.find((q) => q.id === detail.id) : undefined;
  const detailView: Quote | null = detail ? { ...detail, ...(detailRow || {}), lines: (detailRow?.lines as any[])?.length ? detailRow!.lines : detail.lines } : null;

  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);

  /**
   * THE EDITOR IS A ROUTE, NOT A MOOD (CEO 2026-09-21 · «لما اضغط على زر عروض
   * الاسعار مايوديني»). The full-page editor is component state, so clicking
   * «عروض الأسعار» while it was open navigated to a route this page was already
   * on — nothing unmounted, the overlay stayed, and the sidebar looked broken.
   * He had to detour through الفواتير to get back. A navigation to the bare
   * list now closes the editor.
   */
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === "/app/quotes" && !searchParams.get("new")) {
      // Consuming ?new=1 is part of opening the form, not a user navigation away.
      if (consumingNewQuery.current) { consumingNewQuery.current = false; return; }
      setCreateOpen(false);
      setFullPreviewUrl(null);
      setEditId(null);
      setSignFor(null);
      setSendComposeFor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // CEO 2026-09-21 (verbatim): «خليه يطلع الملف يسار اي تعديل يكون لايف اشوفه» —
  // the finished document beside the editor, redrawn on every keystroke. No
  // save, no new tab, no download just to see what the client will read.
  const livePreviewDoc = useMemo(() => {
    // One call carries every figure the printed document prints, in its order:
    // listPrice → discount → net(subtotal) → tax → total. Deriving them two
    // different ways is what made the panel and the PDF disagree.
    const totals = computeTotals(lines, { discountType: form.discountType as any, discountValue: Number(form.discountValue) || 0 });
    return {
      id: editId || "draft",
      number: form.quoteNumber || t("مسودة", "Draft"),
      status: editId ? "DRAFT" : "DRAFT",
      issueDate: form.issueDate,
      dueDate: form.validUntil,
      currency: form.currency,
      subtotal: totals.subtotal,
      listPrice: totals.listPrice,
      discountTotal: totals.discount,
      taxTotal: totals.tax,
      total: totals.total,
      lines: lines
        .filter((l) => l.description.trim() || l.unitPrice)
        .map((l) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, form.quoteNumber, form.issueDate, form.validUntil, form.currency, form.discountType, form.discountValue, editId, language]);
  const livePreviewCustomer = useMemo(() => {
    const c = customers.find((x) => x.id === form.contactId);
    return c ? { contactId: c.id, name: c.displayName, vatNumber: (c as any).taxId } : null;
  }, [customers, form.contactId]);

  /** Open the saved quote in the same editor (CEO 2026-09-21 · «احتاج زر التعديل»). */
  const openEdit = async (q: Quote) => {
    setSourceFiles([]);
    setCreateError(null);
    setBusy(true);
    try {
      const full = (q.lines as any[])?.length ? q : await api.quotes.get(q.id);
      setForm({
        ...EMPTY_FORM,
        contactId: full.contact?.id || (full as any).contactId || "",
        title: (full as any).title || "",
        quoteNumber: full.quoteNumber || "",
        reference: (full as any).reference || "",
        issueDate: String(full.issueDate || "").slice(0, 10) || EMPTY_FORM.issueDate,
        validUntil: String(full.validUntil || "").slice(0, 10) || EMPTY_FORM.validUntil,
        currency: full.currency || EMPTY_FORM.currency,
        notes: (full as any).notes || "",
        templateId: (full as any).templateId || "",
        termsConditions: (full as any).termsConditions || "",
        pages: normalizePages((full as any).pages),
        branchId: (full as any).branchId ?? undefined,
        discountType: ((full as any).discountType || "") as "" | "PERCENT" | "FIXED",
        discountValue: (full as any).discountValue ? String((full as any).discountValue) : "",
      });
      const ls = ((full.lines as any[]) || []).map((l: any) => ({
        id: l.id || Math.random().toString(36).slice(2),
        productId: l.productId || undefined,
        description: l.description || "",
        quantity: String(l.quantity ?? 1),
        // unitPrice is stored as typed; the line flag says whether it includes tax.
        unitPrice: String(l.unitPrice ?? ""),
        discount: Number(l.discount || 0) ? String(l.discount) : "",
        accountId: l.accountId || undefined,
        // `QuoteLine.taxRate` is the TaxRate RELATION, not a number. Reading it
        // as one gave NaN → rate 0, so the reopened quote showed «الضريبة 0.00»
        // against a PDF the server had taxed correctly (CEO 2026-09-21).
        // The line's OWN stored flag first — it is the one the saved totals were
        // computed from. The rate row is only the fallback for rows written
        // before that column existed.
        taxInclusive: typeof l.taxInclusive === "boolean" ? l.taxInclusive
          : (l.taxRate && typeof l.taxRate === "object" ? !!l.taxRate.isInclusive : false),
        taxRate: l.taxRate && typeof l.taxRate === "object" ? Number(l.taxRate.rate) || 0 : Number(l.taxRate) || 0,
        taxRateId: l.taxRateId || (l.taxRate && typeof l.taxRate === "object" ? l.taxRate.id : undefined) || undefined,
      })) as InvoiceLine[];
      setLines(ls.length ? ls : [newLine()]);
      setTaxMode(ls.every(l => l.taxInclusive) ? "all-inclusive" : ls.every(l => !l.taxInclusive) ? "all-exclusive" : "custom");
      setPlanRows(planFromApi((full as any).paymentPlan)); setPlanTemplateId("");
      setEditId(full.id);
      setCreateOpen(true);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("تعذر فتح العرض للتعديل", "Could not open the quote for editing"));
    } finally { setBusy(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setSourceFiles([]);
    const prefillContact = searchParams.get("contactId") || "";
    setForm({ ...EMPTY_FORM, contactId: prefillContact, originProjectId: searchParams.get("projectId") || "" });
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setPlanRows([]); setPlanTemplateId("");
    setCreateOpen(true);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setEditId(null);
    setCreateError(null);
    goBackToSource();
  };

  /** Save once, then preview in this page without relying on popup permissions. */
  const handleFullPreview = async () => {
    const q = await handleSubmit("draft", { stayOpen: true });
    if (!q) return;
    const params = new URLSearchParams({ noprint: "1", embed: "1", lang: language });
    if (form.templateId) params.set("templateId", form.templateId);
    setFullPreviewUrl(`/print/proposal/${encodeURIComponent(q.id)}?${params}`);
  };

  const handleSubmit = async (action: "draft" | "send" = "draft", opts?: { stayOpen?: boolean }): Promise<Quote | null> => {
    setCreateError(null);
    if (!form.contactId) { setCreateError(t("اختر العميل", "Select a customer")); return null; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError(t("أضف بنداً واحداً على الأقل (وصف + سعر)", "Add at least one line item (description + price)")); return null; }
    setBusy(true);
    try {
      const status = action === "draft" ? (editId ? undefined : "DRAFT") : "SENT";
      const payload = {
        sourceAttachments: sourceFiles,
        contactId: form.contactId,
        title: form.title || null,
        quoteNumber: form.quoteNumber || undefined,
        issueDate: form.issueDate,
        validUntil: form.validUntil,
        currency: form.currency,
        status,
        notes: form.notes || null,
        branchId: form.branchId ?? null,
        // Reference lives in its OWN column · terms are the per-document override (never packed together)
        originProjectId: !editId ? form.originProjectId || undefined : undefined,
        reference: form.reference || null,
        termsConditions: form.termsConditions || null,
        templateId: form.templateId || null,
        pages: normalizePages(form.pages),
        // A discount is the document's, never a doctored unit price: it prints as its own
        // «الخصم» row and stays reportable (CEO 2026-09-14).
        discountType: form.discountType || null,
        discountValue: form.discountType ? Number(normalizeDigits(form.discountValue)) || 0 : 0,
        // The tax the user picked travels WITH the line. Sending only price and
        // quantity is what made every quote save taxTotal = 0 and quote a client
        // 400 on a 400 subtotal instead of 460 (CEO screenshot 2026-09-08).
        // The API stores the net itself, so the typed price is sent as typed and
        // `taxInclusive` says how to read it.
        lines: validLines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: Number(normalizeDigits(l.unitPrice)),
          // Per-line discount · the API takes it off this line's gross before tax
          discount: Number(normalizeDigits(l.discount || "")) || 0,
          taxRateId: l.taxRateId || null,
          taxRate: l.taxRate,
          taxInclusive: l.taxInclusive,
        })),
      } as any;
      // Editing keeps the quote's own status — saving a correction must never
      // silently push a SENT quote back to DRAFT.
      if (status === undefined) delete (payload as any).status;
      const q = editId ? await api.quotes.update(editId, payload) : await api.quotes.create(payload);
      setItems(prev => editId ? prev.map((x) => (x.id === q.id ? { ...x, ...q } : x)) : [q, ...prev]);
      // A saved preview becomes an edit: returning and previewing again must not create another quote.
      if (opts?.stayOpen) setEditId(q.id);
      if (editId) setDetail((prev) => (prev && prev.id === q.id ? { ...prev, ...q } : prev));
      // SPEC-05 L2 · the schedule needs a saved quote · an unbalanced plan blocks
      // ONLY itself — the quote is already saved either way.
      if (planRows.length) {
        if (planRowsValid(planRows)) await applyPaymentPlan(q.id, { silent: true });
        else push("info", t("حُفظ العرض بدون خطة الدفعات — مجموع النسب ليس 100%", "Quote saved without the payment plan — the percentages do not add up to 100%"));
      }
      const msg = editId ? t(`تم حفظ التعديلات على ${q.quoteNumber}`, `Saved your changes to ${q.quoteNumber}`)
        : action === "draft" ? t(`تم حفظ ${q.quoteNumber} كمسودة`, `Saved ${q.quoteNumber} as draft`) : t(`تم حفظ ${q.quoteNumber} · راجع الرسالة قبل الإرسال`, `Saved ${q.quoteNumber} · review the message before sending`);
      push("success", msg);
      draft.clear();
      // «إرسال» never fires the email silently (CEO 2026-09-08) — it opens the
      // compose page so the message can be reviewed/edited first.
      if (action === "send" && q.id) {
        setSendComposeFor({ quote: q, fromCreate: true });
        return q;
      }
      if (!opts?.stayOpen) closeCreate();
      return q;
    } catch (e: any) {
      // The reason the save failed has to reach the person filling the form — inline AND as a
      // toast, in their language, naming the row and field (CEO 2026-09-14 · «لا رسالة خطأ
      // مفصَّلة تصل للمستخدم»). The console object was the only place it used to exist.
      const msg = humanizeError(e, language, { ar: "فشل الحفظ", en: "Save failed" });
      setCreateError(msg);
      push("error", msg);
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

  // Creating/copying an acceptance link never sends email or changes the quote status.
  const handleSendLink = async (q: Quote) => {
    setLinkBusy(true);
    try {
      const r = await api.quotes.send(q.id, { email: false });
      setAcceptLink({ quoteId: q.id, url: r.url });
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, acceptToken: r.token } : x));
      try {
        await navigator.clipboard.writeText(r.url);
        push("success", t("نُسخ رابط موافقة العميل — شاركه معه؛ لم يُرسل بريد", "Customer approval link copied — share it with them; no email sent"));
      } catch {
        push("info", t("الرابط جاهز أدناه — حدده وانسخه", "The link is ready below — select it to copy"));
      }
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل إنشاء الرابط", en: "Failed to create the link" }));
    } finally { setLinkBusy(false); }
  };

  // SPEC-04 · manual award (bank transfer / phone) → ACCEPTED + auto project
  const handleManualAccept = async (q: Quote) => {
    setPendingAccept(null);
    try {
      await api.quotes.decision(q.id, { action: "accept", source: t("موافقة يدوية من الشاشة", "Manual approval") });
      push("success", t(`ترسية ${q.quoteNumber} ✓ · تم إنشاء المشروع تلقائيًا`, `${q.quoteNumber} awarded ✓ · project created`));
      const acceptedQuote = await api.quotes.get(q.id);
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, ...acceptedQuote } : x));
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
    setSignatureBlocked(true);
    setSignatureSelection(null);
    setSignatureEmail(false);
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
    if (!signFor || signatureBlocked || !signatureSelection) return;
    setSignError(null);
    if (!signForm.email.trim()) { setSignError(t("البريد الإلكتروني مطلوب", "Email is required")); return; }
    if (!signForm.name.trim()) { setSignError(t("اسم الموقّع مطلوب", "Signer name is required")); return; }
    setBusy(true);
    try {
      const payload = {
        snapshotHash: signatureSelection.snapshotHash,
        sendEmail: signatureEmail,
        signers: [{ name: signForm.name, email: signForm.email, role: "Customer", placement: signatureSelection.placement }],
        message: signForm.message,
        expiresInDays: 30,
      };
      const r = await api.sign.sendQuote(signFor.id, payload);
      if (r.error) {
        push("error", t(`حُفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`, `Request saved but DocuSeal did not respond: ${r.error}`));
      } else {
        push("success", signatureEmail ? t(`تم إرسال العرض للتوقيع إلى ${signForm.email}`, `Quote sent for signing to ${signForm.email}`) : t("تم تجهيز رابط التوقيع — لم يُرسل بريد. يظهر التوقيع أيضًا في رابط العرض المشترك.", "Signing link ready — no email sent. Signing is also available from the shared quote link."));
        if (signatureEmail && signFor.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === signFor.id ? { ...x, status: "SENT" } : x));
        }
      }
      setSignatureRevision(n => n + 1);
    } catch (e: any) {
      setSignatureRevision(n => n + 1);
      const previewErrors: Record<string, string> = {
        document_changed: t("تغير العرض بعد المعاينة؛ حدّث المعاينة ثم حدد مكان التوقيع مجددًا.", "The quote changed after preview. Refresh the preview and select the signature position again."),
        preview_required: t("حدّث معاينة العرض قبل تجهيز رابط التوقيع.", "Refresh the quote preview before preparing the signing link."),
        invalid_signature_placement: t("مكان التوقيع خارج حدود الصفحة؛ اختر مكانًا داخل الصفحة.", "The signature is outside the page. Choose a position within the page."),
      };
      setSignError(e instanceof ApiError && previewErrors[e.code || ""] || humanizeError(e, language, { ar: "تعذر تجهيز التوقيع", en: "Could not prepare signing" }));
    } finally { setBusy(false); }
  };

  // Send compose page (W-SEND · 2026-09-08) · takes over the whole page,
  // above every other view — «إرسال» always lands here, never fires silently.
  if (sendComposeFor) {
    const q = sendComposeFor.quote;
    const contact = q.contact || customers.find((c) => c.id === q.contactId);
    return <>
      <SendComposeForm
        entityType="quote"
        entityId={q.id}
        documentNumber={q.quoteNumber}
        documentLabelAr="عرض سعر" documentLabelEn="Quote"
        defaultTo={contact?.email ? [contact.email] : []}
        defaultSubject={t(`عرض سعر ${q.quoteNumber}`, `Quote ${q.quoteNumber}`)}
        defaultBody={t(
          `مرحباً ${contact?.displayName || ""}،\n\nمرفق عرض السعر رقم ${q.quoteNumber} بقيمة ${Number(q.total).toFixed(2)} ${q.currency}.\n\nنسعد بتعاونكم معنا.`,
          `Hi ${contact?.displayName || ""},\n\nPlease find attached quote ${q.quoteNumber} for ${Number(q.total).toFixed(2)} ${q.currency}.\n\nLooking forward to working with you.`,
        ) + (acceptLink?.quoteId === q.id ? `\n\n${acceptLink.url}` : "")}
        prefill={sendComposeFor.prefill}
        onClose={() => { const fromCreate = sendComposeFor?.fromCreate; setSendComposeFor(null); if (fromCreate) closeCreate(); }}
        onSent={(record) => {
          setSendLogRefresh((n) => n + 1);
          if (record.status === "SENT") {
            setItems((prev) => prev.map((x) => (x.id === q.id ? { ...x, status: "SENT" } as Quote : x)));
            setDetail((prev) => (prev && prev.id === q.id ? ({ ...prev, status: "SENT" } as Quote) : prev));
          }
        }}
        push={push}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>;
  }

  if (fullPreviewUrl) {
    return <>
      <FullPageForm
        title={t("معاينة عرض السعر", "Quote preview")}
        subtitle={t("حُفظت التعديلات — يمكنك العودة لإكمال التحرير", "Changes saved — return to continue editing")}
        onClose={() => setFullPreviewUrl(null)}
        footer={<div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setFullPreviewUrl(null)} data-testid="quote-preview-back">{t("العودة للتحرير", "Back to editing")}</Button>
          <a href={`${fullPreviewUrl.split("?")[0]}?lang=${language}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-primary">
            <Printer className="h-4 w-4" /> {t("طباعة / PDF", "Print / PDF")}
          </a>
        </div>}
      >
        <iframe src={fullPreviewUrl} title={t("المعاينة الكاملة لعرض السعر", "Full quote preview")} className="w-full min-h-[75vh] border-0 bg-white" data-testid="quote-preview-frame" />
      </FullPageForm>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>;
  }

  // Full-page Create form
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={editId ? t("تعديل عرض السعر", "Edit quote") : t("عرض سعر جديد", "New quote")}
          subtitle={editId
            ? t("تُحفظ التعديلات على العرض نفسه — لا يُنشأ عرض جديد", "Your changes are saved to this quote — no new quote is created")
            : t("املأ البيانات الأساسية · يمكنك التعديل لاحقاً", "Fill in the basic details · you can edit later")}
          onClose={closeCreate}
          disableEscape={busy}
          draft={draft}
          onSaveBeforeLeave={async () => !!(await handleSubmit("draft", { stayOpen: true }))}
          footer={(requestClose) =>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={requestClose} className="border-border">{t("إلغاء", "Cancel")}</Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={handleFullPreview} data-testid="quote-full-preview" title={t("يحفظ التعديلات ويعرض المستند الكامل داخل الصفحة", "Saves changes and previews the full document in this page")}>
                  {t("حفظ ومعاينة كاملة", "Save and preview")}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => handleSubmit("draft")} className="bg-primary hover:bg-primary/80">
                  {busy ? "..." : editId ? t("حفظ التعديلات", "Save changes") : t("حفظ كمسودة", "Save as draft")}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("send")} className="border-success text-success hover:bg-success-subtle" title={t("إرسال للعميل", "Send to customer")}>
                  {busy ? "..." : t("حفظ + إرسال", "Save + send")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 w-full max-w-none mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{createError}</div>}

            <div className="space-y-1.5">
              <Label className="text-foreground/80 text-xs">{t("اسم المشروع · عنوان العرض", "Project · quote title")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                /* A placeholder is an example of the SHAPE, not of one client's work
                   (CEO 2026-09-21 · «خليه عادي اي عميل»). */
                placeholder={t("اسم المشروع أو نطاق العمل", "Project or scope name")}
                data-testid="quote-title"
              />
              <p className="text-[11px] text-content-secondary">{t("يُطبع على غلاف العرض تحت «عرض سعر» — اتركه فارغاً ولن يحمل المستند اسماً.", "Printed on the proposal cover under «Quotation» — leave it empty and the document carries no name.")}</p>
            </div>

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
                if (data.sourceFile) setSourceFiles([data.sourceFile]);
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
            {sourceFiles.length > 0 && <p className="text-xs text-muted-foreground">{t("سيُحفظ الملف الأصلي مع المستند:", "Source file will be saved with this document:")} {sourceFiles.map(f => f.name).join(", ")}</p>}

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
                {/* CEO 2026-09-13 · free-form pages (scope · requirements · timeline) · printed before the T&C page */}
                <Label className="text-foreground/80 text-xs">{t("صفحات إضافية · تُطبع بعد البنود وقبل صفحة الشروط والأحكام", "Additional pages · printed after the items and before the terms & conditions page")}</Label>
                <DocumentPagesEditor value={form.pages} onChange={(pages) => setForm({ ...form, pages })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("الإجمالي", "Total")}</Label>
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  {(() => {
                    const totals = computeTotals(lines, { discountType: form.discountType || null, discountValue: Number(normalizeDigits(form.discountValue)) || 0 });
                    return (
                      <>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground min-w-0 break-words">{t("المجموع الفرعي", "Subtotal")}</span>
                          <span className="font-english text-end whitespace-nowrap shrink-0">{form.currency} {displayDigits((totals.discount > 0 ? totals.listPrice : totals.subtotal).toFixed(2))}</span>
                        </div>
                        {/* Discount · document level · before tax (CEO 2026-09-14) */}
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground min-w-0 break-words">{t("الخصم", "Discount")}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            <div className="flex rounded-md bg-muted/50 p-0.5">
                              {([["", t("بلا", "None")], ["PERCENT", "%"], ["FIXED", form.currency]] as Array<["" | "PERCENT" | "FIXED", string]>).map(([id, lbl]) => (
                                <button
                                  key={id || "none"}
                                  type="button"
                                  onClick={() => setForm({ ...form, discountType: id, discountValue: id ? form.discountValue : "" })}
                                  className={`rounded px-2 py-1 text-[11px] transition-colors ${form.discountType === id ? "bg-card text-primary shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                                  data-testid={`quote-discount-${id || "none"}`}
                                >{lbl}</button>
                              ))}
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={!form.discountType}
                              value={form.discountValue}
                              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                              placeholder="0"
                              className="h-8 w-20 rounded-md border border-border bg-card px-2 text-end font-english text-sm disabled:opacity-40"
                              data-testid="quote-discount-value"
                            />
                          </span>
                        </div>
                        {totals.discount > 0 && (
                          <>
                            <div className="flex items-center justify-between gap-3 text-sm text-danger">
                              <span className="min-w-0 break-words">{t("قيمة الخصم", "Discount amount")}</span>
                              <span className="font-english text-end whitespace-nowrap shrink-0">- {form.currency} {displayDigits(totals.discount.toFixed(2))}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-muted-foreground min-w-0 break-words">{t("الصافي", "Net")}</span>
                              <span className="font-english text-end whitespace-nowrap shrink-0">{form.currency} {displayDigits(totals.subtotal.toFixed(2))}</span>
                            </div>
                          </>
                        )}
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
              // The plan splits the FINAL total — document discount applied.
              // Omitting it billed 1,799.98 on a 1,500.00 quote (2026-09-21).
              total={computeTotals(lines, { discountType: form.discountType as any, discountValue: Number(form.discountValue) || 0 }).total}
              currency={form.currency}
              disabled={busy}
            />
          </div>
          <aside
            className="sticky top-4 hidden max-h-[calc(100vh-11rem)] min-w-0 overflow-y-auto rounded-lg bg-surface-subtle p-4 xl:block"
            aria-label={t("المستند النهائي", "Final document")}
            data-testid="quote-live-preview"
          >
            <InvoicePreviewPane
              doc={livePreviewDoc as any}
              seller={seller}
              customer={livePreviewCustomer}
              docTypeLabel={t("عرض سعر", "Quotation")}
              statusLabel={t("معاينة مباشرة", "Live preview")}
              statusMeta={t("يتحدّث مع كل تعديل — لا حاجة للتحميل", "Updates as you type — no download needed")}
            />
          </aside>
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
          subtitle={t("راجع بيانات الموقّع وحدد مكان توقيعه ثم جهّز الرابط · إرسال الدعوة بالبريد اختياري · صلاحية الرابط 30 يومًا", "Review the signer and signature position, then prepare the link · email invitation is optional · link valid for 30 days")}
          onClose={closeSign}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeSign} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <Button type="button" disabled={busy || signatureBlocked || !signatureSelection} onClick={handleSignSubmit} className="bg-primary hover:bg-primary/90">
                <FileSignature className="me-2 h-4 w-4" />{busy ? "..." : signatureEmail ? t("إرسال للتوقيع", "Send for signing") : t("تجهيز رابط التوقيع", "Prepare signing link")}
              </Button>
            </div>
          }
        >
          <div className="max-w-4xl mx-auto space-y-4">
            <SignatureHistory key={signFor.id} docId={signFor.id} docType="QUOTE" revision={signatureRevision} onBlocked={setSignatureBlocked} />
            {signError && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{signError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("اسم الموقّع", "Signer name")} *</Label>
                <Input value={signForm.name} onChange={(e) => setSignForm({ ...signForm, name: e.target.value })} placeholder={t("الاسم الكامل", "Full name")} /></div>
              <div className="space-y-2"><Label>{t("البريد الإلكتروني", "Email")} *</Label>
                <Input type="email" value={signForm.email} onChange={(e) => setSignForm({ ...signForm, email: e.target.value })} dir="ltr" className="font-english" placeholder="signer@example.com" /></div>
            </div>
            <div className="space-y-2"><Label>{t("الرسالة المرفقة", "Attached message")}</Label>
              <textarea value={signForm.message} onChange={(e) => setSignForm({ ...signForm, message: e.target.value })} rows={4} className="w-full rounded-md border border-border px-3 py-2 text-sm" /></div>
            <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={signatureEmail} disabled={busy || signatureBlocked} onChange={e => setSignatureEmail(e.target.checked)} />{t("إرسال دعوة التوقيع بالبريد أيضًا", "Also email the signing invitation")}</label>
            <p className="text-xs text-muted-foreground">{t("يمكنك تجهيز رابط التوقيع ومشاركته بنفسك، أو اختيار إرسال الدعوة بالبريد. لن يُسجل توقيع حتى يكمله العميل.", "Prepare a signing link to share yourself, or email the invitation. A signature is recorded only after the customer completes signing.")}</p>
            <QuoteSignaturePlacement key={signFor.id} id={signFor.id} disabled={busy || signatureBlocked} onChange={setSignatureSelection} />
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  const todayLocal = new Date();
  const todayKey = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`;
  const quoteExpired = (q: Quote) => q.status === "EXPIRED" || (!!q.validUntil && q.validUntil.slice(0, 10) < todayKey && ["DRAFT", "SENT", "VIEWED"].includes(q.status));
  const expiryDate = (q: Quote) => <span className={quoteExpired(q) ? "text-danger" : q.status === "ACCEPTED" ? "text-warning" : "text-content-secondary"}>
    <span dir="ltr" className="font-english text-xs tabular-nums">{q.validUntil?.slice(0, 10) || "—"}</span>
    {quoteExpired(q) && <span className="ms-1 text-xs" data-testid="quote-expired">{t("انتهت الصلاحية", "Expired")}</span>}
  </span>;

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
  /** A quote stops being editable once it has become an invoice or been refused. */
  const quoteEditable = (q: Quote) => q.status !== "CONVERTED" && q.status !== "REJECTED";

  const workflowActions = (q: Quote) => (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()} data-testid="quote-workflow-actions">
      <section aria-label={t("مشاركة العرض", "Share quote")} className="space-y-2">
        <h3 className="text-sm font-semibold">{t("مشاركة العرض", "Share quote")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {q.status !== "CONVERTED" && q.status !== "REJECTED" && (
            <Button type="button" size="sm" onClick={() => setSendComposeFor({ quote: q })} data-testid="quote-send-email">
              <Mail className="me-1.5 h-3.5 w-3.5" strokeWidth={1.75} /> {t("إرسال العرض بالبريد", "Email quote")}
            </Button>
          )}
      <a href={`/print/proposal/${q.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:border-border-strong" title={t("معاينة/طباعة العرض المتكامل", "Preview / print the proposal")}>
        <Printer className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("معاينة / طباعة العرض", "Preview / print quote")}
      </a>
      {q.status !== "CONVERTED" && q.status !== "REJECTED" && q.status !== "ACCEPTED" && (
        <button onClick={() => handleSendLink(q)} disabled={linkBusy} data-testid="quote-accept-link" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:border-border-strong" title={t("إنشاء ونسخ رابط القبول بدون إرسال بريد", "Create and copy an accept link without sending email")}>
          <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("نسخ رابط موافقة العميل", "Copy customer approval link")}
        </button>
      )}
      {q.status !== "CONVERTED" && q.status !== "REJECTED" && q.status !== "ACCEPTED" && (
      <p className="basis-full text-xs leading-relaxed text-content-secondary">{t("شارك الرابط عبر واتساب أو البريد ليوافق العميل أو يرفض. الموافقة تنشئ مشروعًا. جهّز طلب التوقيع الإلكتروني ليظهر زر التوقيع في الرابط نفسه.", "Share the link by WhatsApp or email for the customer to approve or decline. Approval creates a project. Prepare a signature request to enable signing from this same link.")}</p>
      )}
      {acceptLink?.quoteId === q.id && (
        <div className="basis-full space-y-1" data-testid="quote-accept-link-result">
          <Label htmlFor={`accept-link-${q.id}`} className="text-xs text-content-secondary">{t("رابط موافقة العميل · لم يُرسل بريد", "Customer approval link · no email sent")}</Label>
          <Input id={`accept-link-${q.id}`} readOnly dir="ltr" value={acceptLink.url} onFocus={(e) => e.target.select()} className="text-xs" />
          <Button type="button" size="sm" variant="outline" onClick={() => setSendComposeFor({ quote: q })}>{t("مراجعة رسالة البريد", "Review email message")}</Button>
        </div>
      )}
        </div>
      </section>
      {q.status !== "CONVERTED" && q.status !== "REJECTED" && (
        <section aria-label={t("التوقيع الإلكتروني", "Electronic signature")} className="space-y-2 border-t border-border pt-4">
        <button data-testid="quote-request-signature" onClick={() => openSign(q)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:border-border-strong" title={t("إرسال للتوقيع", "Send for signing")}>
          <FileSignature className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("طلب توقيع إلكتروني", "Request electronic signature")}
        </button>
          <p className="text-xs leading-relaxed text-content-secondary">{t("يفتح صفحة مراجعة اسم الموقّع وبريده قبل إرسال دعوة لتوقيع المستند. يمكنك متابعة الطلب وفتح رابط التوقيع من الصفحة نفسها.", "Review the signer’s name and email before sending an invitation to sign the document. Track the request and open its signing link on the same page.")}</p>
        </section>
      )}
      {(q.status === "SENT" || q.status === "VIEWED" || q.status === "DRAFT") && (
        <section aria-label={t("تسجيل رد العميل يدويًا", "Record customer response")} className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t("ردّ العميل خارج المنصة؟", "Customer replied outside Entix?")}</h3>
          <p className="text-xs leading-relaxed text-content-secondary">{t("سجّل رده الذي وصلك بالهاتف أو البريد. الموافقة تنشئ مشروعًا تلقائيًا؛ الرفض يتطلب السبب. لا يُرسل أي منهما رسالة للعميل.", "Record a response received by phone or email. Approval creates a project; decline requires a reason. Neither action sends a customer message.")}</p>
          <div className="flex flex-wrap items-center gap-2">
      {(q.status === "SENT" || q.status === "VIEWED" || q.status === "DRAFT") && (
        pendingAccept === q.id ? (
          <InlineConfirm onConfirm={() => handleManualAccept(q)} onCancel={() => setPendingAccept(null)} label={t("تسجيل موافقة العميل وإنشاء المشروع؟", "Record approval + create project?")} />
        ) : (
          <button onClick={() => setPendingAccept(q.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-success hover:border-border-strong" title={t("موافقة يدوية (حوالة/هاتف) → مشروع تلقائي", "Manual approval → auto project")}>
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("تسجيل موافقة العميل", "Record customer approval")}
          </button>
        )
      )}
      {(q.status === "SENT" || q.status === "VIEWED" || q.status === "DRAFT") && (
        rejectFor === q.id ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            <Input autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t("سبب رفض العميل (إلزامي)...", "Customer decline reason (required)...")} className="h-7 w-44 border-danger-border text-xs" onKeyDown={(e) => { if (e.key === "Enter") handleReject(q); if (e.key === "Escape") { setRejectFor(null); setRejectReason(""); } }} />
            <button onClick={() => handleReject(q)} className="rounded-full bg-danger px-2.5 py-1 text-xs text-primary-foreground">{t("تأكيد", "OK")}</button>
            <button onClick={() => { setRejectFor(null); setRejectReason(""); }} className="rounded-full px-2.5 py-1 text-xs text-muted-foreground">{t("إلغاء", "Cancel")}</button>
          </span>
        ) : (
          <button onClick={() => { setRejectFor(q.id); setRejectReason(""); }} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-danger hover:border-border-strong" title={t("اعتذار/خسارة مع تسجيل السبب", "Decline with a reason")}>
            <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("تسجيل رفض العميل", "Record customer decline")}
          </button>
        )
      )}
          </div>
        </section>
      )}
      <section aria-label={t("الفوترة", "Invoicing")} className="space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
      {q.status !== "CONVERTED" && (
        pendingConvert === q.id ? (
          <InlineConfirm onConfirm={() => handleConvert(q)} onCancel={() => setPendingConvert(null)} label={t("تحويل لفاتورة؟", "Convert to invoice?")} />
        ) : (
          <button onClick={() => setPendingConvert(q.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-success hover:border-border-strong" title={t("تحويل لفاتورة", "Convert to invoice")}>
            <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("إنشاء فاتورة من العرض", "Create invoice from quote")}
          </button>
        )
      )}
      {q.status === "CONVERTED" && q.convertedInvoiceId && (
        <Link to={`/app/invoices/${q.convertedInvoiceId}`} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:border-border-strong">
          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("فتح الفاتورة", "Open invoice")}
        </Link>
      )}
        </div>
        <p className="text-xs leading-relaxed text-content-secondary">{t("يبقى العرض محفوظًا بعد إنشاء الفاتورة، وتُراجع الفاتورة وتُرسل بشكل مستقل.", "The quote stays saved after an invoice is created. Review and send the invoice separately.")}</p>
      </section>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
      {pendingDelete === q.id ? (
        <InlineConfirm onConfirm={() => handleDelete(q.id)} onCancel={() => setPendingDelete(null)} />
      ) : (
        <button onClick={() => setPendingDelete(q.id)} className="ms-auto inline-flex items-center gap-1 rounded-full border border-danger-border px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger-subtle" title={t("حذف العرض", "Delete quote")} data-testid="quote-delete">
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("حذف", "Delete")}
        </button>
      )}
      </div>
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
    listPrice: ((q.lines as any[]) || [])
      .filter((l: any) => l.included !== false)
      .reduce((sum: number, l: any) => sum + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0),
    discountTotal: (q as any).discountTotal,
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
          description={q ? <><ContactProfileLink id={q.contactId} name={q.contact?.displayName} />{q.title ? <> · <BidiText>{q.title}</BidiText></> : null}</> : undefined}
          actions={
            <div className="flex items-center gap-2">
              {q && quoteEditable(q) && (
                <Button className="h-10 px-[18px] text-sm" disabled={busy} onClick={() => openEdit(q)} data-testid="quote-detail-edit">
                  <Pencil className="me-2 h-4 w-4" strokeWidth={1.75} />{t("تعديل", "Edit")}
                </Button>
              )}
              <Button variant="outline" className="h-10 px-[18px] text-sm" onClick={() => navigate("/app/quotes")}>
                <ArrowRight className="me-2 h-4 w-4 rtl:rotate-0 ltr:rotate-180" strokeWidth={1.75} />{t("عروض الأسعار", "Quotes")}
              </Button>
            </div>
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
                customer={q.contact ? { contactId: q.contactId || q.contact.id, name: q.contact.displayName, vatNumber: (q.contact as any).taxId } : null}
                docTypeLabel={t("عرض سعر", "Quotation")}
                statusLabel={statusWord(q)}
                statusMeta={[String(q.issueDate || "").slice(0, 10), q.validUntil ? `→ ${String(q.validUntil).slice(0, 10)}` : ""].filter(Boolean).join(" ")}
                onSend={q.status !== "CONVERTED" && q.status !== "REJECTED" ? () => setSendComposeFor({ quote: q }) : undefined}
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
                    <ContactProfileLink id={q.contactId} name={q.contact?.displayName} />
                  </dd>
                  <dt className="text-content-secondary">{t("تاريخ العرض", "Quote date")}</dt>
                  <dd><span dir="ltr" className="font-english tabular-nums text-foreground">{q.issueDate?.slice(0, 10)}</span></dd>
                  <dt className="text-content-secondary">{t("صالح حتى", "Valid until")}</dt>
                  <dd>{expiryDate(q)}</dd>
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
                <h2 className="mb-3 text-section font-semibold text-foreground">{t("مشاركة العرض ومتابعته", "Share & follow up")}</h2>
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
            {/* CEO 2026-09-13 · free-form pages (scope · requirements · timeline) · printed before the T&C page */}
            <div className="lg:col-span-2">
              <DocumentPagesSection
                pages={q.pages}
                disabled={q.status === "CONVERTED"}
                printHref={`/print/proposal/${q.id}`}
                onSave={async (pages) => {
                  try {
                    const updated = await api.quotes.update(q.id, { pages });
                    setDetail((prev) => (prev && prev.id === q.id ? { ...prev, pages: updated.pages ?? pages } : prev));
                    push("success", t("تم حفظ الصفحات", "Pages saved"));
                  } catch (e: any) {
                    push("error", e?.message || t("تعذّر حفظ الصفحات", "Could not save pages"));
                    throw e;
                  }
                }}
              />
            </div>
            <div className="lg:col-span-2">
              <InvoiceDocuments invoiceId={q.id} kind="quote" />
              <SendLogSection
                entityType="quote"
                entityId={q.id}
                refreshKey={sendLogRefresh}
                onResend={(record) => setSendComposeFor({ quote: q, prefill: record })}
              />
            </div>
          </div>
        )}
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  return <>
    <QuotesDashboard items={items} loading={loading} error={listError} onRefresh={refresh} onNew={openCreate} onImport={() => navigate("/app/quotes/import")} />
    <ToastStack toasts={toasts} onDismiss={dismiss} />
  </>;
}
