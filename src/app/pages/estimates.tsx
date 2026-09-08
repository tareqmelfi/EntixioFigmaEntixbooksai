/**
 * SPEC-05 · Layer 1 — الدراسة والتسعير (Estimating & Pricing) · /api/estimates
 *
 * The INTERNAL cost study that precedes a quote: cost per line (material ·
 * labour · other) → margin → sale price → approval → conversion to a client
 * quote that carries the PRICE ONLY.
 *
 * UX-1: no Dialog · no Sheet · no window.alert/confirm/prompt.
 *   create/edit → FullPageForm · destructive + conversion → inline confirm strip ·
 *   feedback → toasts.
 * Visibility law (API): cost · margin · sale price are ABSENT from the payload
 * for non-financial roles — the UI hides those columns/figures, never prints 0.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  Calculator, Plus, Search, Trash2, Loader2, FileSpreadsheet, Lock, Unlock,
  ArrowRight, Copy, Send, CheckCircle2, ArrowLeftRight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, InlineAlert, LedgerFigure, Metric, MetricStrip, PageHeader, PageToolbar, StatusBadge } from "../components/product";
import { FullPageForm } from "../components/full-page-form";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { ContactSearchInput } from "../components/contact-search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useLanguage } from "../components/LanguageContext";
import { authStore } from "../components/auth-store";
import { normalizeDigits } from "../lib/digits";
import { displayLocale } from "../lib/number-display";
import { api, ApiError, type Contact, type Estimate, type EstimateLineInput } from "../lib/api";
import { taxRateLabel, useTaxRates } from "../lib/use-tax-rates";

const CURRENCIES = ["SAR", "USD", "EUR", "AED"];

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" },
  REVIEW: { ar: "قيد المراجعة", en: "In review" },
  APPROVED: { ar: "معتمدة", en: "Approved" },
  CONVERTED: { ar: "محوّلة لعرض", en: "Converted" },
  ARCHIVED: { ar: "مؤرشفة", en: "Archived" },
};
/* Ledger tones · approved/converted = blue (success) · review = copper (waiting) ·
   draft/archived = muted with a hollow dot. Never green, never red for "waiting". */
const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = {
  DRAFT: "neutral", REVIEW: "warning", APPROVED: "success", CONVERTED: "success", ARCHIVED: "neutral",
};

const money2 = (n: number | string) =>
  Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct2 = (n: number | string) =>
  Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (v: unknown): number => {
  const x = Number(normalizeDigits(String(v ?? "")).replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** One editable line (strings · the inputs own their text; math runs on numbers). */
type Row = {
  key: string;
  itemNo: string;
  section: string;
  description: string;
  spec: string;
  unit: string;
  quantity: string;
  materialCost: string;
  labourCost: string;
  otherCost: string;
  marginPct: string;
  unitPrice: string;
  unitPriceLocked: boolean;
  durationDays: string;
  ownerName: string;
  taxRate: string;
};

let rowSeq = 0;
const newRow = (): Row => ({
  key: `r${Date.now()}-${rowSeq++}`,
  itemNo: "", section: "", description: "", spec: "", unit: "",
  quantity: "1", materialCost: "", labourCost: "", otherCost: "",
  marginPct: "", unitPrice: "", unitPriceLocked: false,
  durationDays: "", ownerName: "", taxRate: "",
});

/** The line law, mirrored from the API (src/lib/estimates.ts) so the grid is live. */
function computeRow(r: Row, defaults: { marginPct: number; taxRate: number }) {
  const quantity = num(r.quantity || 1);
  const unitCost = num(r.materialCost) + num(r.labourCost) + num(r.otherCost);
  const marginPct = r.marginPct.trim() === "" ? defaults.marginPct : num(r.marginPct);
  const unitPrice = r.unitPriceLocked && r.unitPrice.trim() !== ""
    ? num(r.unitPrice)
    : unitCost * (1 + marginPct / 100);
  const taxRate = r.taxRate.trim() === "" ? defaults.taxRate : num(r.taxRate);
  return { quantity, unitCost, marginPct, unitPrice, taxRate, lineTotal: round2(quantity * unitPrice), cost: quantity * unitCost };
}

function rowsFromEstimate(est: Estimate): Row[] {
  const lines = est.lines || [];
  if (!lines.length) return [newRow()];
  return lines.map((l) => ({
    key: l.id || `r${Date.now()}-${rowSeq++}`,
    itemNo: l.itemNo || "",
    section: l.section || "",
    description: l.description || "",
    spec: l.spec || "",
    unit: l.unit || "",
    quantity: String(Number(l.quantity ?? 1)),
    materialCost: l.materialCost === undefined ? "" : String(Number(l.materialCost)),
    labourCost: l.labourCost === undefined ? "" : String(Number(l.labourCost)),
    otherCost: l.otherCost === undefined ? "" : String(Number(l.otherCost)),
    marginPct: l.marginPct === undefined ? "" : String(Number(l.marginPct)),
    unitPrice: l.unitPrice === undefined ? "" : String(Number(l.unitPrice)),
    unitPriceLocked: !!l.unitPriceLocked,
    durationDays: l.durationDays === null || l.durationDays === undefined ? "" : String(l.durationDays),
    ownerName: l.ownerName || "",
    taxRate: l.taxRate === undefined ? "" : String(Number(l.taxRate)),
  }));
}

const EMPTY_FORM = {
  title: "",
  contactId: "",
  contactName: "",
  currency: "SAR",
  defaultMarginPct: "15",
  taxRate: "15",
  notes: "",
};

export function Estimates() {
  const { t, language } = useLanguage();
  // The org's VAT catalogue · fills the rate field instead of the user typing 15.
  const { rates: taxRates } = useTaxRates();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { toasts, push, dismiss } = useToasts();

  const isNew = location.pathname.endsWith("/estimates/new");
  const editId = params.id && params.id !== "new" ? params.id : null;
  const editorOpen = isNew || !!editId;

  const [items, setItems] = useState<Estimate[]>([]);
  const [listHidden, setListHidden] = useState(false); // API stripped cost/margin for this role
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // OWNER / ADMIN gate for «اعتماد داخلي» (the API enforces it as well · 403 owner_required)
  const [isAdmin, setIsAdmin] = useState(authStore.getState().user?.role === "admin");
  useEffect(() => authStore.subscribe((s) => setIsAdmin(s.user?.role === "admin")), []);

  // ── editor state ───────────────────────────────────────────────────────────
  const [form, setForm] = useState(EMPTY_FORM);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [current, setCurrent] = useState<Estimate | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const canSeeCost = current ? current.confidentialHidden !== true : !listHidden;
  const frozen = current?.status === "CONVERTED" || current?.status === "ARCHIVED";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [est, cts] = await Promise.all([
        api.estimates.list(),
        api.contacts.list({ limit: 200 }).catch(() => ({ items: [] as Contact[] })),
      ]);
      setItems(est.items);
      setListHidden(!!est.confidentialHidden);
      setContacts(((cts as any).items || []).filter((c: Contact) => c.type === "CUSTOMER" || c.type === "BOTH"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل تحميل الدراسات", "Failed to load estimates"));
    } finally { setLoading(false); }
  }, [push, t]);
  useEffect(() => { refresh(); }, [refresh]);

  // Load the estimate under edit
  useEffect(() => {
    if (!editId) { if (isNew) { setCurrent(null); setForm(EMPTY_FORM); setRows([newRow()]); } return; }
    let alive = true;
    setEditorLoading(true);
    api.estimates.get(editId)
      .then((est) => {
        if (!alive) return;
        setCurrent(est);
        setForm({
          title: est.title || "",
          contactId: est.contactId || "",
          contactName: est.contact?.displayName || "",
          currency: est.currency || "SAR",
          defaultMarginPct: est.defaultMarginPct === undefined ? "" : String(Number(est.defaultMarginPct)),
          taxRate: String(Number(est.taxRate ?? 15)),
          notes: est.notes || "",
        });
        setRows(rowsFromEstimate(est));
      })
      .catch((e: any) => {
        if (!alive) return;
        push("error", e instanceof ApiError ? e.message : t("تعذر تحميل الدراسة", "Could not load the estimate"));
        navigate("/app/estimates", { replace: true });
      })
      .finally(() => { if (alive) setEditorLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const defaults = { marginPct: num(form.defaultMarginPct), taxRate: num(form.taxRate) };
  const computed = useMemo(() => rows.map((r) => computeRow(r, defaults)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, form.defaultMarginPct, form.taxRate]);

  const totals = useMemo(() => {
    let cost = 0, sale = 0, tax = 0;
    computed.forEach((c) => { cost += c.cost; sale += c.lineTotal; tax += round2(c.lineTotal * (c.taxRate / 100)); });
    const costTotal = round2(cost), saleSubtotal = round2(sale), taxTotal = round2(tax);
    return {
      costTotal, saleSubtotal, taxTotal,
      saleTotal: round2(saleSubtotal + taxTotal),
      marginPct: saleSubtotal > 0 ? ((saleSubtotal - costTotal) / saleSubtotal) * 100 : 0,
    };
  }, [computed]);

  const sectionSummary = useMemo(() => {
    const map = new Map<string, { section: string; cost: number; sale: number }>();
    rows.forEach((r, i) => {
      const key = r.section.trim();
      if (!key) return;
      const cur = map.get(key) || { section: key, cost: 0, sale: 0 };
      cur.cost += computed[i].cost;
      cur.sale += computed[i].lineTotal;
      map.set(key, cur);
    });
    return Array.from(map.values()).map((s) => ({
      section: s.section, cost: round2(s.cost), sale: round2(s.sale),
      marginPct: s.sale > 0 ? ((s.sale - s.cost) / s.sale) * 100 : 0,
    }));
  }, [rows, computed]);

  // ── list figures (cost/margin only when the API sent them) ─────────────────
  const listTotals = useMemo(() => {
    let cost = 0, sale = 0;
    items.forEach((e) => { cost += Number(e.costTotal || 0); sale += Number(e.saleSubtotal || 0); });
    return { cost, sale, marginPct: sale > 0 ? ((sale - cost) / sale) * 100 : 0 };
  }, [items]);

  const filtered = items.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return e.number.toLowerCase().includes(q) || (e.title || "").toLowerCase().includes(q) ||
      (e.contact?.displayName || "").toLowerCase().includes(q);
  });

  // ── row helpers ────────────────────────────────────────────────────────────
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (i: number) => setRows((prev) => (prev.length === 1 ? [newRow()] : prev.filter((_, idx) => idx !== i)));

  /** Enter moves to the same cell one row down (Excel habit) · Tab keeps the native order. */
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    const el = e.target as HTMLElement;
    const field = el.getAttribute?.("data-field");
    const rowIdx = Number(el.getAttribute?.("data-row"));
    if (!field || Number.isNaN(rowIdx)) return;
    e.preventDefault();
    const nextIdx = rowIdx + 1;
    if (nextIdx >= rows.length) addRow();
    window.setTimeout(() => {
      const next = gridRef.current?.querySelector<HTMLInputElement>(`[data-field="${field}"][data-row="${nextIdx}"]`);
      next?.focus();
      next?.select?.();
    }, 0);
  };

  const linePayload = (): EstimateLineInput[] => rows
    .filter((r) => r.description.trim())
    .map((r, i) => {
      const c = computeRow(r, defaults);
      return {
        sortOrder: i,
        itemNo: r.itemNo.trim() || null,
        section: r.section.trim() || null,
        description: r.description.trim(),
        spec: r.spec.trim() || null,
        unit: r.unit.trim() || null,
        quantity: c.quantity,
        materialCost: num(r.materialCost),
        labourCost: num(r.labourCost),
        otherCost: num(r.otherCost),
        marginPct: r.marginPct.trim() === "" ? null : num(r.marginPct),
        unitPrice: r.unitPriceLocked ? c.unitPrice : null,
        unitPriceLocked: r.unitPriceLocked,
        taxRate: r.taxRate.trim() === "" ? null : num(r.taxRate),
        durationDays: r.durationDays.trim() === "" ? null : Math.round(num(r.durationDays)),
        ownerName: r.ownerName.trim() || null,
      };
    });

  const save = async (opts?: { silent?: boolean }): Promise<Estimate | null> => {
    setEditorError(null);
    if (!form.title.trim()) { setEditorError(t("عنوان الدراسة مطلوب", "A title is required")); return null; }
    const lines = linePayload();
    if (!lines.length) { setEditorError(t("أضف بنداً واحداً على الأقل (وصف البند)", "Add at least one line (a description)")); return null; }
    setBusy(true);
    try {
      const body = {
        title: form.title.trim(),
        contactId: form.contactId || null,
        currency: form.currency,
        defaultMarginPct: num(form.defaultMarginPct),
        taxRate: num(form.taxRate),
        notes: form.notes || null,
        lines,
      };
      const est = current
        ? await api.estimates.update(current.id, body)
        : await api.estimates.create(body);
      setCurrent(est);
      setRows(rowsFromEstimate(est));
      setItems((prev) => (prev.some((x) => x.id === est.id) ? prev.map((x) => (x.id === est.id ? est : x)) : [est, ...prev]));
      if (!opts?.silent) push("success", t(`حُفظت الدراسة ${est.number}`, `Saved estimate ${est.number}`));
      if (!current) navigate(`/app/estimates/${est.id}`, { replace: true });
      return est;
    } catch (e: any) {
      const msg = e instanceof ApiError
        ? (e.message === "estimate_frozen" ? t("الدراسة محوّلة — أنشئ نسخة جديدة للتعديل", "Converted — create a new version to edit") : e.message)
        : t("فشل الحفظ", "Save failed");
      setEditorError(msg);
      return null;
    } finally { setBusy(false); }
  };

  const runOnSaved = async (fn: (id: string) => Promise<void>) => {
    const est = current || (await save({ silent: true }));
    if (!est) return;
    await fn(est.id);
  };

  const handleSubmitForReview = () => runOnSaved(async (id) => {
    setBusy(true);
    try {
      const est = await api.estimates.submit(id);
      setCurrent(est); setItems((p) => p.map((x) => (x.id === est.id ? est : x)));
      push("success", t("أُرسلت الدراسة للمراجعة", "Sent for review"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("تعذر الإرسال", "Could not submit"));
    } finally { setBusy(false); }
  });

  const handleApprove = () => runOnSaved(async (id) => {
    setBusy(true);
    try {
      const est = await api.estimates.approve(id);
      setCurrent(est); setItems((p) => p.map((x) => (x.id === est.id ? est : x)));
      push("success", t("اعتُمدت الدراسة داخليًا", "Approved internally"));
    } catch (e: any) {
      push("error", e instanceof ApiError
        ? (e.message === "owner_required" ? t("اعتماد الدراسة صلاحية المالك أو المدير", "Approval is an owner/admin right") : e.message)
        : t("تعذر الاعتماد", "Could not approve"));
    } finally { setBusy(false); }
  });

  const handleConvert = async () => {
    setConfirmConvert(false);
    if (!current) return;
    setBusy(true);
    try {
      const r = await api.estimates.convertToQuote(current.id);
      push("success", t(`أُنشئ العرض ${r.quote.quoteNumber} — نُسخت الأسعار فقط`, `Created quote ${r.quote.quoteNumber} — prices only`));
      navigate(`/app/quotes/${r.quote.id}`);
    } catch (e: any) {
      const code = e instanceof ApiError ? e.message : "";
      push("error",
        code === "approval_required" ? t("اعتمد الدراسة داخليًا قبل تحويلها إلى عرض", "Approve the estimate before converting it")
          : code === "contact_required" ? t("حدّد العميل قبل التحويل", "Select the customer before converting")
          : code || t("فشل التحويل", "Conversion failed"));
    } finally { setBusy(false); }
  };

  const handleNewVersion = () => runOnSaved(async (id) => {
    setBusy(true);
    try {
      const est = await api.estimates.newVersion(id);
      setItems((p) => [est, ...p]);
      push("success", t(`أُنشئت النسخة ${est.number}`, `Created version ${est.number}`));
      navigate(`/app/estimates/${est.id}`);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("تعذر إنشاء نسخة جديدة", "Could not create a new version"));
    } finally { setBusy(false); }
  });

  const handleImportFile = async (file: File) => {
    await runOnSaved(async (id) => {
      setBusy(true);
      try {
        const r = await api.estimates.importBoq(id, file);
        setCurrent(r.estimate);
        setRows(rowsFromEstimate(r.estimate));
        push("success", t(`استُوردت ${r.imported} بنداً من ${r.fileName}`, `Imported ${r.imported} line(s) from ${r.fileName}`));
        if (r.warnings?.length) push("info", r.warnings.join(" · "));
      } catch (e: any) {
        push("error", e instanceof ApiError ? e.message : t("تعذر استيراد الملف", "Could not import the file"));
      } finally { setBusy(false); }
    });
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.estimates.remove(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      push("success", t("حُذفت الدراسة", "Estimate deleted"));
    } catch (e: any) {
      push("error", e instanceof ApiError
        ? (e.message === "estimate_frozen" ? t("لا يمكن حذف دراسة محوّلة إلى عرض", "A converted estimate cannot be deleted") : e.message)
        : t("فشل الحذف", "Delete failed"));
    }
  };

  const statusPill = (e: Estimate) => (
    <StatusBadge
      tone={STATUS_TONE[e.status] || "neutral"}
      icon={e.status === "DRAFT" || e.status === "ARCHIVED" ? <span className="ledger-dot hollow" aria-hidden="true" /> : undefined}
    >
      {STATUS_LABELS[e.status] ? t(STATUS_LABELS[e.status].ar, STATUS_LABELS[e.status].en) : e.status}
    </StatusBadge>
  );

  // ── EDITOR ─────────────────────────────────────────────────────────────────
  if (editorOpen) {
    const belowTarget = totals.saleSubtotal > 0 && totals.marginPct < defaults.marginPct;
    const contactOptions = contacts.map((c) => ({
      id: c.id,
      name: c.displayName,
      type: ((c as any).entityKind === "INDIVIDUAL" ? "person" : "organization") as "person" | "organization",
      roles: ["عميل" as const],
      email: c.email || "",
      phone: (c as any).phone || "",
      netBalance: 0,
      entityLocation: (((c as any).country && (c as any).country !== "SA") ? "foreign" : "local") as "local" | "foreign",
      country: (c as any).country || undefined,
    }));

    const cell = "cell";
    const inputCls = "text-[13px]";

    return (
      <>
        <FullPageForm
          title={current ? t(`الدراسة ${current.number}`, `Estimate ${current.number}`) : t("دراسة جديدة", "New estimate")}
          subtitle={t("دراسة داخلية · التكلفة والهامش لا تغادر الشركة", "Internal study · cost and margin never leave the company")}
          onClose={() => navigate("/app/estimates")}
          disableEscape={busy}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" className="border-border" onClick={() => navigate("/app/estimates")}>{t("إغلاق", "Close")}</Button>
                <Button type="button" variant="outline" className="border-border" disabled={busy || frozen} onClick={() => fileRef.current?.click()} data-testid="estimate-import-boq">
                  <FileSpreadsheet className="me-2 h-4 w-4" strokeWidth={1.75} />{t("استيراد BOQ", "Import BOQ")}
                </Button>
                <Button type="button" variant="outline" className="border-border" disabled={busy || !current} onClick={handleNewVersion} data-testid="estimate-new-version">
                  <Copy className="me-2 h-4 w-4" strokeWidth={1.75} />{t("إصدار جديد V02", "New version V02")}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" disabled={busy || frozen} onClick={() => save()} data-testid="estimate-save-draft">
                  {busy ? "…" : t("حفظ كمسودة", "Save as draft")}
                </Button>
                <Button type="button" variant="outline" className="border-border" disabled={busy || frozen} onClick={handleSubmitForReview} data-testid="estimate-submit">
                  <Send className="me-2 h-4 w-4" strokeWidth={1.75} />{t("إرسال للمراجعة", "Send for review")}
                </Button>
                {isAdmin && (
                  <Button type="button" variant="outline" className="border-success text-success" disabled={busy || frozen} onClick={handleApprove} data-testid="estimate-approve">
                    <CheckCircle2 className="me-2 h-4 w-4" strokeWidth={1.75} />{t("اعتماد داخلي", "Approve internally")}
                  </Button>
                )}
                <Button type="button" variant="outline" className="border-border text-primary" disabled={busy || !current || frozen} onClick={() => setConfirmConvert(true)} data-testid="estimate-convert">
                  <ArrowLeftRight className="me-2 h-4 w-4" strokeWidth={1.75} />{t("تحويل إلى عرض سعر", "Convert to quote")}
                </Button>
              </div>
            </div>
          }
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleImportFile(f); }}
            data-testid="estimate-boq-file"
          />
          <div className="w-full space-y-4">
            {editorError && <InlineAlert tone="critical">{editorError}</InlineAlert>}

            {frozen && (
              <InlineAlert tone="warning" title={t("دراسة محوّلة إلى عرض سعر", "Converted to a quote")} data-testid="estimate-frozen-notice">
                {t("هذه الدراسة مجمّدة للقراءة فقط — أنشئ «إصدار جديد V02» لتعديل الأرقام.",
                   "This estimate is read-only — create a new version to change the numbers.")}
              </InlineAlert>
            )}

            {/* Conversion confirm · inline strip (UX-1 · never a dialog) */}
            {confirmConvert && (
              <div className="rounded-lg border border-border border-s-[3px] border-s-primary bg-card p-3" data-testid="estimate-convert-confirm">
                <p className="text-sm text-foreground">
                  {t("سيُنسخ إلى العرض: رقم البند · البند والمواصفات · الكمية · سعر الوحدة · الإجمالي فقط — لا تُنسخ التكلفة ولا نسبة الربح",
                     "The quote receives: item no. · item and spec · quantity · unit price · line total only — cost and margin are never copied")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" disabled={busy} onClick={handleConvert} data-testid="estimate-convert-confirm-yes">{t("تحويل الآن", "Convert now")}</Button>
                  <Button type="button" size="sm" variant="outline" className="border-border" onClick={() => setConfirmConvert(false)}>{t("إلغاء", "Cancel")}</Button>
                </div>
              </div>
            )}

            {editorLoading ? (
              <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                {/* Header fields */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label className="text-xs text-foreground/80">{t("العميل", "Customer")}</Label>
                    <ContactSearchInput
                      value={form.contactName}
                      options={contactOptions}
                      placeholder={t("ابحث أو أنشئ عميلاً...", "Search or create a customer...")}
                      onChange={async (name, id) => {
                        if (id) { setForm((f) => ({ ...f, contactId: id, contactName: name })); return; }
                        if (!name.trim()) { setForm((f) => ({ ...f, contactId: "", contactName: "" })); return; }
                        try {
                          const c = await api.contacts.create({ displayName: name, type: "CUSTOMER" });
                          setContacts((prev) => [c, ...prev]);
                          setForm((f) => ({ ...f, contactId: c.id, contactName: c.displayName }));
                          push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
                        } catch { push("error", t("تعذر إنشاء العميل", "Could not create the customer")); }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label className="text-xs text-foreground/80">{t("عنوان الدراسة", "Estimate title")} *</Label>
                    <Input value={form.title} disabled={frozen} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("مثال: توريد وتركيب أنظمة التكييف", "e.g. Supply and install HVAC systems")} className="h-9 border-border text-sm" data-testid="estimate-title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("العملة", "Currency")}</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })} disabled={frozen}>
                      <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {canSeeCost && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground/80">{t("نسبة الربح الافتراضية %", "Default margin %")}</Label>
                      <Input value={form.defaultMarginPct} disabled={frozen} inputMode="decimal" dir="ltr" onChange={(e) => setForm({ ...form, defaultMarginPct: normalizeDigits(e.target.value) })} className="h-9 border-border text-sm font-english" data-testid="estimate-default-margin" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("نسبة الضريبة %", "Tax rate %")}</Label>
                    <div className="flex min-w-0 items-center gap-2">
                      <Input value={form.taxRate} disabled={frozen} inputMode="decimal" dir="ltr" onChange={(e) => setForm({ ...form, taxRate: normalizeDigits(e.target.value) })} className="h-9 min-w-0 flex-1 border-border text-sm font-english" data-testid="estimate-tax-rate" />
                      {/* Pick from the ORG's catalogue instead of remembering the number.
                          The field stays typeable — a study may price a rate the org has not set up. */}
                      {taxRates.length > 0 && (
                        <select
                          data-testid="estimate-tax-rate-picker"
                          aria-label={t("اختر نسبة ضريبة", "Choose a tax rate")}
                          disabled={frozen}
                          value=""
                          onChange={(e) => { const r = taxRates.find((x) => x.id === e.target.value); if (r) setForm({ ...form, taxRate: String(Number((Number(r.rate) * 100).toFixed(4))) }); }}
                          className="h-9 w-[42%] shrink-0 truncate rounded-lg border border-border bg-card px-2 text-xs text-content-secondary"
                        >
                          <option value="">{t("من الإعدادات…", "From settings…")}</option>
                          {taxRates.map((r) => (
                            <option key={r.id} value={r.id}>{taxRateLabel(r, language === "ar" ? "ar" : "en")}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dense line grid */}
                <section className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-section font-semibold text-foreground">{t("بنود الدراسة", "Estimate lines")}</h2>
                    <Button type="button" size="sm" variant="outline" className="border-border" disabled={frozen} onClick={addRow} data-testid="estimate-add-line">
                      <Plus className="me-1.5 h-3.5 w-3.5" strokeWidth={1.75} />{t("+ سطر", "+ Line")}
                    </Button>
                  </div>
                  <div className="overflow-x-auto" ref={gridRef} onKeyDown={onGridKeyDown}>
                    <div className="ledger-grid-dense" style={{ minWidth: canSeeCost ? 1460 : 1140 }}>
                      <div
                        className="grid"
                        style={{ gridTemplateColumns: canSeeCost
                          // 17 columns · widths tuned so the full study (cost → price → total) fits a 1920 desktop
                          ? "32px 82px 110px minmax(150px,1.2fr) minmax(120px,0.8fr) 60px 68px 88px 88px 84px 96px 68px 108px 116px 54px 96px 34px"
                          : "32px 82px 110px minmax(200px,1.4fr) minmax(160px,1fr) 60px 68px 108px 116px 54px 96px 34px" }}
                        data-testid="estimate-line-grid"
                      >
                        <div className={`${cell} h idx`}>#</div>
                        <div className={`${cell} h`}>{t("رقم البند", "Item no.")}</div>
                        <div className={`${cell} h`}>{t("القسم", "Section")}</div>
                        <div className={`${cell} h`}>{t("البند", "Description")}</div>
                        <div className={`${cell} h`}>{t("المواصفات", "Spec")}</div>
                        <div className={`${cell} h`}>{t("الوحدة", "Unit")}</div>
                        <div className={`${cell} h n`}>{t("الكمية", "Qty")}</div>
                        {canSeeCost && <>
                          <div className={`${cell} h n`}>{t("تكلفة مواد", "Material")}</div>
                          <div className={`${cell} h n`}>{t("تكلفة عمالة", "Labour")}</div>
                          <div className={`${cell} h n`}>{t("تكاليف أخرى", "Other")}</div>
                          <div className={`${cell} h n`}>{t("تكلفة الوحدة", "Unit cost")}</div>
                          <div className={`${cell} h n`}>{t("الربح %", "Margin %")}</div>
                        </>}
                        <div className={`${cell} h n`}>{t("سعر الوحدة", "Unit price")}</div>
                        <div className={`${cell} h n`}>{t("إجمالي البند", "Line total")}</div>
                        <div className={`${cell} h n`}>{t("أيام", "Days")}</div>
                        <div className={`${cell} h`}>{t("المسؤول", "Owner")}</div>
                        <div className={`${cell} h`} aria-hidden="true" />

                        {rows.map((r, i) => {
                          const c = computed[i];
                          return (
                            <div key={r.key} className="contents">
                              <div className={`${cell} idx font-english`}>{i + 1}</div>
                              <div className={cell}><Input data-row={i} data-field="itemNo" disabled={frozen} dir="ltr" className={`${inputCls} font-english`} value={r.itemNo} onChange={(e) => setRow(i, { itemNo: e.target.value })} /></div>
                              <div className={cell}><Input data-row={i} data-field="section" disabled={frozen} className={inputCls} value={r.section} onChange={(e) => setRow(i, { section: e.target.value })} /></div>
                              <div className={cell}><Input data-row={i} data-field="description" disabled={frozen} className={inputCls} value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} placeholder={t("وصف البند", "Line description")} /></div>
                              <div className={cell}><Input data-row={i} data-field="spec" disabled={frozen} className={inputCls} value={r.spec} onChange={(e) => setRow(i, { spec: e.target.value })} /></div>
                              <div className={cell}><Input data-row={i} data-field="unit" disabled={frozen} className={inputCls} value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} /></div>
                              <div className={`${cell} n`}><Input data-row={i} data-field="quantity" disabled={frozen} inputMode="decimal" dir="ltr" className={`${inputCls} font-english text-end`} value={r.quantity} onChange={(e) => setRow(i, { quantity: normalizeDigits(e.target.value) })} /></div>
                              {canSeeCost && <>
                                <div className={`${cell} n`}><Input data-row={i} data-field="materialCost" disabled={frozen} inputMode="decimal" dir="ltr" className={`${inputCls} font-english text-end`} value={r.materialCost} onChange={(e) => setRow(i, { materialCost: normalizeDigits(e.target.value) })} /></div>
                                <div className={`${cell} n`}><Input data-row={i} data-field="labourCost" disabled={frozen} inputMode="decimal" dir="ltr" className={`${inputCls} font-english text-end`} value={r.labourCost} onChange={(e) => setRow(i, { labourCost: normalizeDigits(e.target.value) })} /></div>
                                <div className={`${cell} n`}><Input data-row={i} data-field="otherCost" disabled={frozen} inputMode="decimal" dir="ltr" className={`${inputCls} font-english text-end`} value={r.otherCost} onChange={(e) => setRow(i, { otherCost: normalizeDigits(e.target.value) })} /></div>
                                <div className={`${cell} n font-english text-content-secondary`} title={t("محسوبة: مواد + عمالة + أخرى", "Computed: material + labour + other")} data-testid={`estimate-unit-cost-${i}`}>{money2(c.unitCost)}</div>
                                <div className={`${cell} n`}><Input data-row={i} data-field="marginPct" disabled={frozen || r.unitPriceLocked} inputMode="decimal" dir="ltr" className={`${inputCls} font-english text-end`} placeholder={String(defaults.marginPct)} value={r.marginPct} onChange={(e) => setRow(i, { marginPct: normalizeDigits(e.target.value) })} /></div>
                              </>}
                              <div className={`${cell} n gap-1`}>
                                {r.unitPriceLocked ? (
                                  <Input data-row={i} data-field="unitPrice" disabled={frozen} inputMode="decimal" dir="ltr" className={`${inputCls} font-english text-end`} value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: normalizeDigits(e.target.value) })} data-testid={`estimate-unit-price-${i}`} />
                                ) : (
                                  <span className="flex-1 text-end font-english tabular-nums text-foreground" data-testid={`estimate-unit-price-${i}`}>{money2(c.unitPrice)}</span>
                                )}
                                <button
                                  type="button"
                                  disabled={frozen}
                                  onClick={() => setRow(i, { unitPriceLocked: !r.unitPriceLocked, unitPrice: r.unitPriceLocked ? r.unitPrice : String(round2(c.unitPrice)) })}
                                  className="shrink-0 rounded-full p-1 text-content-secondary hover:text-foreground"
                                  title={r.unitPriceLocked ? t("سعر مثبّت — اضغط لإعادة الحساب من التكلفة والربح", "Locked price — click to compute it from cost + margin") : t("تثبيت السعر يدويًا", "Lock the price manually")}
                                  aria-label={r.unitPriceLocked ? t("إلغاء تثبيت السعر", "Unlock price") : t("تثبيت السعر", "Lock price")}
                                  data-testid={`estimate-lock-${i}`}
                                >
                                  {r.unitPriceLocked ? <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Unlock className="h-3.5 w-3.5" strokeWidth={1.75} />}
                                </button>
                              </div>
                              <div className={`${cell} n font-english text-foreground`} data-testid={`estimate-line-total-${i}`}>{money2(c.lineTotal)}</div>
                              <div className={`${cell} n`}><Input data-row={i} data-field="durationDays" disabled={frozen} inputMode="numeric" dir="ltr" className={`${inputCls} font-english text-end`} value={r.durationDays} onChange={(e) => setRow(i, { durationDays: normalizeDigits(e.target.value) })} /></div>
                              <div className={cell}><Input data-row={i} data-field="ownerName" disabled={frozen} className={inputCls} value={r.ownerName} onChange={(e) => setRow(i, { ownerName: e.target.value })} /></div>
                              <div className={cell}>
                                <button type="button" disabled={frozen} onClick={() => removeRow(i)} className="rounded-full p-1 text-danger hover:bg-surface-hover" title={t("حذف السطر", "Delete line")} aria-label={t("حذف السطر", "Delete line")}>
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Summary · totals + per-section margins */}
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)]">
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("ملاحظات داخلية", "Internal notes")}</Label>
                    <textarea
                      rows={4}
                      value={form.notes}
                      disabled={frozen}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder={t("افتراضات التسعير · مخاطر · مصادر التوريد...", "Pricing assumptions · risks · sourcing...")}
                      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                      data-testid="estimate-notes"
                    />
                    {sectionSummary.length > 0 && canSeeCost && (
                      <div className="pt-2">
                        <h3 className="mb-2 text-sm font-semibold text-foreground">{t("هوامش الأقسام", "Section margins")}</h3>
                        <div className="ledger-table overflow-x-auto">
                          <Table className="table-fixed min-w-[520px]">
                            <colgroup>
                              <col />
                              <col style={{ width: "140px" }} />
                              <col style={{ width: "140px" }} />
                              <col style={{ width: "100px" }} />
                            </colgroup>
                            <TableHeader><TableRow className="hover:bg-transparent">
                              <TableHead>{t("القسم", "Section")}</TableHead>
                              <TableHead className="text-end">{t("التكلفة", "Cost")}</TableHead>
                              <TableHead className="text-end">{t("البيع", "Sale")}</TableHead>
                              <TableHead className="text-end">{t("الهامش %", "Margin %")}</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                              {sectionSummary.map((s) => (
                                <TableRow key={s.section} className="h-10">
                                  <TableCell className="overflow-hidden text-sm text-foreground"><span className="block truncate"><bdi dir="auto">{s.section}</bdi></span></TableCell>
                                  <TableCell className="text-end"><span dir="ltr" className="font-english text-sm tabular-nums text-content-secondary">{money2(s.cost)}</span></TableCell>
                                  <TableCell className="text-end"><span dir="ltr" className="font-english text-sm tabular-nums text-foreground">{money2(s.sale)}</span></TableCell>
                                  <TableCell className="text-end"><span dir="ltr" className={`font-english text-sm tabular-nums ${s.marginPct < defaults.marginPct ? "text-warning" : "text-foreground"}`}>{pct2(s.marginPct)}</span></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-4" data-testid="estimate-summary">
                    {canSeeCost && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 text-muted-foreground">{t("إجمالي التكلفة", "Total cost")}</span>
                        <span dir="ltr" className="shrink-0 font-english tabular-nums text-foreground">{money2(totals.costTotal)} <span className="text-xs text-muted-foreground">{form.currency}</span></span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 text-muted-foreground">{t("إجمالي البيع", "Total sale")}</span>
                      <span dir="ltr" className="shrink-0 font-english tabular-nums text-foreground">{money2(totals.saleSubtotal)} <span className="text-xs text-muted-foreground">{form.currency}</span></span>
                    </div>
                    {canSeeCost && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 text-muted-foreground">{t("الهامش الإجمالي %", "Gross margin %")}</span>
                        <span dir="ltr" className={`shrink-0 font-english tabular-nums ${belowTarget ? "text-warning" : "text-foreground"}`} data-testid="estimate-margin-total">{pct2(totals.marginPct)}</span>
                      </div>
                    )}
                    {belowTarget && canSeeCost && (
                      <p className="text-xs text-warning">{t(`أقل من الهامش المستهدف (${defaults.marginPct}%)`, `Below the target margin (${defaults.marginPct}%)`)}</p>
                    )}
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 text-muted-foreground">{t("الضريبة", "Tax")}</span>
                      <span dir="ltr" className="shrink-0 font-english tabular-nums text-foreground">{money2(totals.taxTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                      <span className="min-w-0 font-semibold text-foreground">{t("الإجمالي الشامل", "Grand total")}</span>
                      <span dir="ltr" className="shrink-0 font-display text-[20px] leading-6 tabular-nums text-foreground">{money2(totals.saleTotal)} <span className="font-english text-xs text-muted-foreground">{form.currency}</span></span>
                    </div>
                    {current?.quote && (
                      <p className="border-t border-border pt-2 text-xs text-content-secondary">
                        {t("العرض الناتج:", "Resulting quote:")}{" "}
                        <Link to={`/app/quotes/${current.quote.id}`} className="font-code text-primary hover:underline">{current.quote.quoteNumber}</Link>
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  // ── LIST ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
        eyebrow={<span className="text-[13px]">{t("المبيعات", "Sales")}</span>}
        title={t("الدراسة والتسعير", "Estimating & Pricing")}
        description={t("دراسة التكلفة والهامش قبل إصدار عرض السعر — التكلفة لا تغادر الشركة",
                       "The internal cost and margin study behind every quote — cost never leaves the company")}
        actions={
          <Button className="h-10 px-[18px] text-sm" onClick={() => navigate("/app/estimates/new")} data-testid="estimate-new">
            <Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("دراسة جديدة", "New estimate")}
          </Button>
        }
      />

      <MetricStrip className="compact">
        <Metric label={t("عدد الدراسات", "Estimates")} value={items.length} hint={t("دراسة", "studies")} />
        {listHidden ? (
          <Metric label={t("قيد المراجعة", "In review")} value={items.filter((e) => e.status === "REVIEW").length} hint={t("بانتظار الاعتماد", "Awaiting approval")} />
        ) : (
          <Metric label={t("إجمالي التكلفة", "Total cost")} value={<LedgerFigure value={listTotals.cost} />} hint={t("قبل الربح", "Before margin")} />
        )}
        <Metric label={t("إجمالي البيع", "Total sale")} value={<LedgerFigure value={listTotals.sale} />} />
        {!listHidden && (
          <Metric label={t("متوسط الهامش %", "Average margin %")} value={<span className={listTotals.marginPct < 0 ? "text-danger" : undefined}>{pct2(listTotals.marginPct)}</span>} />
        )}
      </MetricStrip>

      <PageToolbar aria-label={t("مرشحات الدراسات", "Estimate filters")} className="justify-between">
        <h2 className="text-section font-semibold text-foreground">{t("قائمة الدراسات", "Estimate list")}</h2>
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("بحث...", "Search...")} className="h-9 w-full ps-8 text-[13px]" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="estimate-search" />
        </div>
      </PageToolbar>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Calculator className="h-8 w-8" strokeWidth={1.75} />}
          title={t("لا توجد دراسات بعد", "No estimates yet")}
          description={t("ابدأ دراسة التكلفة والهامش، ثم حوّلها إلى عرض سعر بضغطة واحدة.",
                         "Start a cost study, then convert it into a client quote in one click.")}
          action={<Button onClick={() => navigate("/app/estimates/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("دراسة جديدة", "New estimate")}</Button>}
        />
      ) : (
        <>
          {/* Phones: stacked rows · md and up: the ledger table */}
          <ul className="md:hidden">
            {filtered.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => navigate(`/app/estimates/${e.id}`)} className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-border py-3 text-start">
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="truncate text-sm font-semibold text-foreground"><bdi dir="auto">{e.title}</bdi></span>
                    <span dir="ltr" className="font-code text-xs text-muted-foreground">{e.number}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-[3px]">
                    <span dir="ltr" className="font-display text-[18px] leading-5 tabular-nums text-foreground">{money2(e.saleSubtotal || 0)}</span>
                    {statusPill(e)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="ledger-table hidden overflow-x-auto md:block [&_th]:text-[11px] [&_th]:tracking-[0.06em]">
            <Table className="table-fixed min-w-[1100px]">
              <colgroup>
                <col style={{ width: "200px" }} />{/* رقم الدراسة · mono */}
                <col style={{ minWidth: "160px" }} />{/* العنوان */}
                <col style={{ minWidth: "140px" }} />{/* العميل */}
                {!listHidden && <col style={{ width: "130px" }} />}{/* التكلفة */}
                <col style={{ width: "130px" }} />{/* البيع */}
                {!listHidden && <col style={{ width: "90px" }} />}{/* الهامش */}
                <col style={{ width: "140px" }} />{/* الحالة */}
                <col style={{ width: "110px" }} />{/* التاريخ */}
                <col style={{ width: "60px" }} />{/* حذف */}
              </colgroup>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead>{t("رقم الدراسة", "Estimate no.")}</TableHead>
                <TableHead>{t("العنوان", "Title")}</TableHead>
                <TableHead>{t("العميل", "Customer")}</TableHead>
                {!listHidden && <TableHead className="text-end">{t("التكلفة", "Cost")}</TableHead>}
                <TableHead className="text-end">{t("البيع", "Sale")}</TableHead>
                {!listHidden && <TableHead className="text-end">{t("الهامش %", "Margin %")}</TableHead>}
                <TableHead>{t("الحالة", "Status")}</TableHead>
                <TableHead>{t("التاريخ", "Date")}</TableHead>
                <TableHead><span className="sr-only">{t("إجراءات", "Actions")}</span></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id} onClick={() => navigate(`/app/estimates/${e.id}`)} className="h-12 cursor-pointer" title={t("فتح الدراسة", "Open estimate")}>
                    <TableCell className="overflow-hidden text-start">
                      <Link to={`/app/estimates/${e.id}`} onClick={(ev) => ev.stopPropagation()} title={e.number} className="block max-w-full hover:underline underline-offset-4">
                        <span dir="ltr" className={`block truncate font-code text-sm font-semibold text-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{e.number}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="overflow-hidden text-sm text-foreground" title={e.title}>
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap leading-5"><bdi dir="auto">{e.title}</bdi></span>
                    </TableCell>
                    <TableCell className="overflow-hidden text-sm text-foreground" title={e.contact?.displayName || ""}>
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap leading-5"><bdi dir="auto">{e.contact?.displayName || "—"}</bdi></span>
                    </TableCell>
                    {!listHidden && (
                      <TableCell className="text-end"><span dir="ltr" className="block font-english text-sm tabular-nums text-content-secondary">{money2(e.costTotal || 0)}</span></TableCell>
                    )}
                    <TableCell className="text-end">
                      <span dir="ltr" className="block font-display text-[18px] leading-6 tabular-nums text-foreground">{money2(e.saleSubtotal || 0)}</span>
                    </TableCell>
                    {!listHidden && (
                      <TableCell className="text-end"><span dir="ltr" className="block font-english text-sm tabular-nums text-foreground">{pct2(e.marginPct || 0)}</span></TableCell>
                    )}
                    <TableCell className="align-middle">{statusPill(e)}</TableCell>
                    <TableCell className="text-start"><span dir="ltr" className="font-english text-xs tabular-nums text-content-secondary">{String(e.createdAt || "").slice(0, 10)}</span></TableCell>
                    <TableCell className="align-middle" onClick={(ev) => ev.stopPropagation()}>
                      {pendingDelete === e.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(e.id)} onCancel={() => setPendingDelete(null)} />
                      ) : (
                        <button type="button" onClick={() => setPendingDelete(e.id)} className="rounded-full p-1.5 text-danger hover:bg-surface-hover" title={t("حذف", "Delete")} aria-label={t("حذف", "Delete")}>
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-content-secondary">
            <ArrowRight className="me-1 inline h-3 w-3 align-[-2px] rtl:rotate-180" strokeWidth={1.75} aria-hidden="true" />
            {t("الدراسة داخلية — العميل يرى سعر البيع فقط بعد التحويل إلى عرض سعر.",
               "The estimate is internal — the customer only sees the sale price once it becomes a quote.")}
          </p>
        </>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
