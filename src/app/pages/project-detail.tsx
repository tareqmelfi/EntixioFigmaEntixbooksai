import { displayLocale, displayDigits } from "../lib/number-display";
/**
 * Project full page — app-wide standard (no slide-overs):
 *   /app/projects/new  → create form
 *   /app/projects/:id  → project detail (edit, status, delete)
 *
 * Status uses segmented buttons (enums are NEVER dropdowns in this app).
 * W5 will extend this page with contractor payments, hours and performance.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Banknote, CheckCircle2, Clock3, Edit2, ExternalLink, FolderKanban, Loader2, Plus, Save, ShoppingCart, Sparkles, Trash2, X } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { InlineAlert } from "../components/product";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, type LinkedDocument, type ProjectBudget, type ProjectLink, type ProjectLinkKind, type PurchaseOrder } from "../lib/api";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ContactSearchInput } from "../components/contact-search-input";
import { useLanguage } from "../components/LanguageContext";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  ACTIVE: { ar: "نشط", en: "Active" }, ON_HOLD: { ar: "متوقف", en: "On Hold" },
  COMPLETED: { ar: "مكتمل", en: "Completed" }, CANCELLED: { ar: "ملغي", en: "Cancelled" },
};
const STATUS_ORDER = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

/** PL1 · statuses of the documents a project links to (quote · estimate · invoice). */
const DOC_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, REVIEW: { ar: "قيد المراجعة", en: "In review" },
  APPROVED: { ar: "معتمد", en: "Approved" }, SENT: { ar: "مُرسل", en: "Sent" },
  ACCEPTED: { ar: "مقبول", en: "Accepted" }, REJECTED: { ar: "مرفوض", en: "Rejected" },
  EXPIRED: { ar: "منتهٍ", en: "Expired" }, CONVERTED: { ar: "محوّل", en: "Converted" },
  PAID: { ar: "مدفوع", en: "Paid" }, PARTIAL: { ar: "مدفوع جزئياً", en: "Partly paid" },
  OVERDUE: { ar: "متأخر", en: "Overdue" }, CANCELLED: { ar: "ملغي", en: "Cancelled" },
  VOID: { ar: "ملغى", en: "Void" },
};

const EMPTY_FORM = { code: "", name: "", startDate: "", endDate: "", status: "ACTIVE", budget: "", notes: "", contractValue: "", retentionPct: "", percentComplete: "", clientContactId: "", clientName: "" };

/** PL1 · the document kinds a project may be linked to · order matches the sales flow. */
const LINK_KINDS: Array<{ kind: ProjectLinkKind; ar: string; en: string; route: (id: string) => string }> = [
  { kind: "QUOTE", ar: "عرض سعر", en: "Quote", route: (id) => `/app/quotes/${id}` },
  { kind: "ESTIMATE", ar: "دراسة/ميزانية", en: "Cost study / budget", route: (id) => `/app/estimates/${id}` },
  { kind: "INVOICE", ar: "فاتورة", en: "Invoice", route: (id) => `/app/invoices/${id}` },
];

export function ProjectDetail() {
  const { t, language } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [perf, setPerf] = useState<any | null>(null);
  const [contractors, setContractors] = useState<any[]>([]);
  const [engageForm, setEngageForm] = useState({ contractorId: "", role: "", agreedRate: "" });
  const [engageBusy, setEngageBusy] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  // PL2 · the code starts prefilled from the org's numbering pattern. The «تلقائي»
  // chip disappears the moment the user types their own — and a typed code is
  // never rejected for being non-standard, only for being a duplicate.
  const [codeAuto, setCodeAuto] = useState(isNew);
  // PL1 · links · on a saved project these are server rows; on the new-project
  // form they are staged locally and POSTed right after create.
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [pendingLinks, setPendingLinks] = useState<Array<{ kind: ProjectLinkKind; document: LinkedDocument }>>([]);
  const [linkOptions, setLinkOptions] = useState<Partial<Record<ProjectLinkKind, LinkedDocument[]>>>({});
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);
  // SPEC-05 L3 · after the award: the COST-ONLY budget, the instalment plan and
  // the purchase orders issued from budget lines. None of these carry a sale
  // price or a margin — the API does not send one.
  const [budget, setBudget] = useState<ProjectBudget | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [l3Busy, setL3Busy] = useState<string | null>(null);

  const applyProject = useCallback((p: any) => {
    setProject(p);
    setForm({
      code: p.code || "", name: p.name || "",
      startDate: (p.startDate || "").slice(0, 10), endDate: (p.endDate || "").slice(0, 10),
      status: p.status || "ACTIVE",
      budget: p.budget != null ? String(p.budget) : "", notes: p.notes || "",
      contractValue: p.contractValue != null ? String(p.contractValue) : "", retentionPct: p.retentionPct != null ? String(p.retentionPct) : "", percentComplete: p.percentComplete != null ? String(p.percentComplete) : "",
      clientContactId: p.clientContactId || "", clientName: p.clientName || "",
    });
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      applyProject(await api.projects.get(id!));
      api.contractors.projectPerformance(id!).then(setPerf).catch(() => setPerf(null));
      api.contractors.list().then((d) => setContractors((d.items || []).filter((x: any) => x.isActive !== false))).catch(() => {});
    }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل تحميل المشروع", "Failed to load project")); }
    finally { setLoading(false); }
  }, [id, isNew, applyProject, t]);
  useEffect(() => { load(); }, [load]);

  // Contacts feed the «العميل» picker · customers first, but every contact is offered
  // because a project's counterparty is not always flagged as a customer yet.
  useEffect(() => {
    api.contacts.list().then((d: any) => setContacts(d.items || [])).catch(() => setContacts([]));
  }, []);

  // Resolve the stored clientContactId to a name once contacts arrive.
  useEffect(() => {
    if (!form.clientContactId || form.clientName) return;
    const match = contacts.find((c) => c.id === form.clientContactId);
    if (match) setForm((f) => ({ ...f, clientName: match.displayName }));
  }, [contacts, form.clientContactId, form.clientName]);

  const loadLinks = useCallback(async () => {
    if (isNew) return;
    try { setLinks((await api.projects.links(id!)).items || []); } catch { setLinks([]); }
  }, [id, isNew]);
  useEffect(() => { loadLinks(); }, [loadLinks]);

  const loadLifecycle = useCallback(async () => {
    if (isNew) return;
    api.projects.budget(id!).then(setBudget).catch(() => setBudget(null));
    api.paymentPlans.list({ projectId: id! }).then((d: any) => setPlans(d.items || [])).catch(() => setPlans([]));
    api.purchaseOrders.list({ projectId: id! }).then((d) => setOrders(d.items || [])).catch(() => setOrders([]));
  }, [id, isNew]);
  useEffect(() => { loadLifecycle(); }, [loadLifecycle]);

  const l3Error = (e: any, fallback: string) => {
    // The API answers with a reason; show it rather than a generic failure.
    const code = e instanceof ApiError ? e.message : "";
    if (code === "accountant_approval_required") return t("هذا الإجراء يتطلب صلاحية المحاسب", "This action requires the accountant role");
    if (code === "budget_not_approved") return t("اعتمد ميزانية التكلفة أولاً", "Approve the cost budget first");
    if (code === "budget_already_approved") return t("الميزانية معتمدة · لا يمكن إعادة بنائها", "The budget is approved · it cannot be rebuilt");
    if (code === "estimate_not_found") return t("لا توجد دراسة تكلفة مرتبطة بهذا المشروع", "No cost study is linked to this project");
    if (code === "already_invoiced") return t("هذه الدفعة مفوترة مسبقاً", "This instalment is already invoiced");
    return fallback;
  };

  const runL3 = async (key: string, action: () => Promise<void>, okMessage: string, failMessage: string) => {
    setL3Busy(key);
    try { await action(); push("success", okMessage); }
    catch (e: any) { push("error", l3Error(e, failMessage)); }
    finally { setL3Busy(null); }
  };

  const buildBudget = () => runL3("build", async () => {
    setBudget(await api.projects.buildBudget(id!));
  }, t("تم إنشاء ميزانية التكلفة من الدراسة", "Cost budget built from the cost study"), t("تعذر إنشاء الميزانية", "Could not build the budget"));

  const approveBudget = () => runL3("approve", async () => {
    setBudget(await api.projects.approveBudget(id!));
  }, t("اعتُمدت ميزانية التكلفة · صارت سقف الصرف", "Cost budget approved · it is now the spending ceiling"), t("تعذر الاعتماد", "Could not approve"));

  const invoiceInstalment = (itemId: string) => runL3(`inv-${itemId}`, async () => {
    const res = await api.paymentPlanItems.invoice(itemId);
    await loadLifecycle();
    push("success", t(`صدرت الفاتورة ${res.invoice.invoiceNumber}`, `Invoice ${res.invoice.invoiceNumber} issued`));
  }, t("تم إصدار الفاتورة", "Invoice issued"), t("تعذر إصدار الفاتورة", "Could not issue the invoice"));

  const issuePurchaseOrder = () => runL3("po", async () => {
    if (!budget?.lines?.length) return;
    await api.purchaseOrders.fromBudget({
      projectId: id!,
      lines: budget.lines.map((l) => ({ budgetLineId: l.id })),
    });
    await loadLifecycle();
  }, t("صدر أمر الشراء للمشتريات", "Purchase order issued to purchasing"), t("تعذر إصدار أمر الشراء", "Could not issue the purchase order"));

  // PL2 · prefill the code from numberingSettings.project · re-runs when the client
  // changes so «أدرج رمز العميل» takes effect immediately (EDG-PRJ-0007).
  useEffect(() => {
    if (!isNew || !codeAuto) return;
    let cancelled = false;
    api.projects.nextCode(form.clientContactId || undefined)
      .then((r) => { if (!cancelled && r?.code) setForm((f) => (f.code === r.code ? f : { ...f, code: r.code })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isNew, codeAuto, form.clientContactId]);

  // PL1 · candidate documents per kind, always scoped to the chosen client.
  useEffect(() => {
    const contactId = form.clientContactId;
    if (!contactId) { setLinkOptions({}); return; }
    let cancelled = false;
    Promise.all(LINK_KINDS.map(async ({ kind }) => {
      try {
        const res = isNew
          ? await api.projects.linkableForContact({ kind, contactId })
          : await api.projects.linkable(id!, { kind, contactId });
        return [kind, res.items || []] as const;
      } catch { return [kind, [] as LinkedDocument[]] as const; }
    })).then((entries) => { if (!cancelled) setLinkOptions(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [form.clientContactId, id, isNew]);

  const linkedIds = new Set([...links.map((l) => l.documentId), ...pendingLinks.map((l) => l.document.id)]);

  const addLink = async (kind: ProjectLinkKind, documentId: string) => {
    const document = (linkOptions[kind] || []).find((d) => d.id === documentId);
    if (!document || linkedIds.has(documentId)) return;
    if (isNew) { setPendingLinks((prev) => [...prev, { kind, document }]); return; }
    try {
      await api.projects.link(id!, { kind, documentId });
      await loadLinks();
      push("success", t("تم ربط المستند بالمشروع", "Document linked to the project"));
    } catch (e: any) {
      push("error", e instanceof ApiError && e.message === "already_linked"
        ? t("المستند مربوط مسبقاً", "Already linked")
        : t("تعذر الربط", "Could not link the document"));
    }
  };

  const removeLink = async (linkId: string) => {
    try {
      await api.projects.unlink(id!, linkId);
      setPendingUnlink(null);
      await loadLinks();
      push("success", t("تم إلغاء الربط · المستند لم يُحذف", "Link removed · the document itself was not deleted"));
    } catch { push("error", t("تعذر إلغاء الربط", "Could not remove the link")); }
  };

  const statusLabel = (s: string) => STATUS_LABELS[s] ? (language === "ar" ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en) : s;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setError(t("الرمز والاسم مطلوبان", "Code and name are required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = { code: form.code.trim(), name: form.name.trim(), startDate: form.startDate || null, endDate: form.endDate || null, status: form.status, budget: form.budget ? Number(form.budget) : null, notes: form.notes || null, contractValue: form.contractValue ? Number(form.contractValue) : null, retentionPct: form.retentionPct ? Number(form.retentionPct) : null, percentComplete: form.percentComplete ? Number(form.percentComplete) : null, clientContactId: form.clientContactId || null };
      const saved = isNew ? await api.projects.create(payload) : await api.projects.update(id!, payload);
      // PL1 · links staged on the new-project form are recorded now that the project exists.
      if (isNew && pendingLinks.length) {
        await Promise.all(pendingLinks.map((l) =>
          api.projects.link(saved.id, { kind: l.kind, documentId: l.document.id }).catch(() => null)));
      }
      push("success", isNew ? t("تم إنشاء المشروع", "Project created") : t("تم تحديث المشروع", "Project updated"));
      if (isNew) navigate(`/app/projects/${saved.id}`, { replace: true });
      else { applyProject(saved); setEditMode(false); loadLinks(); }
    } catch (e: any) {
      // A code the user typed themselves is never rejected for its shape — only for
      // colliding with an existing project (PL2).
      setError(e instanceof ApiError
        ? (e.message === "code_exists" ? t("هذا الرمز مستخدم في مشروع آخر · اختر رمزاً مختلفاً", "This code is already used by another project · choose a different one") : e.message)
        : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    try {
      await api.projects.remove(id!);
      push("success", t("تم حذف المشروع", "Project deleted"));
      navigate("/app/projects");
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  const handleEngage = async () => {
    if (!engageForm.contractorId) return;
    setEngageBusy(true);
    try {
      await api.contractors.engage(id!, {
        contractorId: engageForm.contractorId,
        role: engageForm.role || null,
        agreedRate: engageForm.agreedRate ? Number(engageForm.agreedRate) : null,
      });
      push("success", t("أُشرك المقاول في المشروع", "Contractor engaged on the project"));
      setEngageForm({ contractorId: "", role: "", agreedRate: "" });
      api.contractors.projectPerformance(id!).then(setPerf).catch(() => {});
    } catch (e: any) {
      push("error", e instanceof ApiError && e.message === "already_engaged" ? t("مُشرَك مسبقاً في هذا المشروع", "Already engaged on this project") : t("فشل الإشراك", "Engage failed"));
    } finally { setEngageBusy(false); }
  };

  const money = (v: any) => Number(v || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hrsFmt = (v: any) => Number(v || 0).toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 1 });

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const contactOptions = contacts.map((c: any) => ({
    id: c.id,
    name: c.displayName,
    type: (c.entityKind === "INDIVIDUAL" ? "person" : "organization") as "person" | "organization",
    roles: ["عميل" as const],
    email: c.email || "",
    phone: c.phone || "",
    netBalance: 0,
    entityLocation: ((c.country && c.country !== "SA") ? "foreign" : "local") as "local" | "foreign",
    country: c.country || undefined,
  }));

  const docDate = (value: string | null) => (value ? value.slice(0, 10) : "—");
  const kindLabel = (kind: ProjectLinkKind) => {
    const entry = LINK_KINDS.find((x) => x.kind === kind);
    return entry ? t(entry.ar, entry.en) : kind;
  };
  const kindRoute = (kind: ProjectLinkKind, documentId: string) =>
    LINK_KINDS.find((x) => x.kind === kind)?.route(documentId) || "#";
  const docStatus = (status?: string | null) => {
    if (!status) return "—";
    const entry = DOC_STATUS_LABELS[status];
    return entry ? t(entry.ar, entry.en) : status;
  };

  /**
   * PL1 · «ربط بمستند قائم» · one picker per kind, filtered to the project client.
   * Linking records the relation only — the figures shown are the document's own.
   */
  const linkPickers = (
    <Card className="border-border" data-testid="project-link-section">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0 text-sm text-foreground" style={{ fontWeight: 700 }}>
            {t("ربط بمستند قائم", "Link to an existing document")}
          </div>
          <span className="text-xs text-content-secondary">
            {t("الربط لا ينسخ شيئاً · الأرقام تبقى في المستند", "Linking copies nothing · the figures stay on the document")}
          </span>
        </div>

        {!form.clientContactId ? (
          <p className="text-xs text-muted-foreground">{t("اختر العميل أولاً لعرض مستنداته", "Choose the client first to see their documents")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {LINK_KINDS.map(({ kind, ar, en }) => {
              const options = (linkOptions[kind] || []).filter((d) => !linkedIds.has(d.id));
              return (
                <div key={kind} className="min-w-0 space-y-1" data-testid={`project-link-picker-${kind}`}>
                  <Label className="text-xs text-content-secondary">{t(ar, en)}</Label>
                  <SearchableCombobox
                    value=""
                    onChange={(documentId) => addLink(kind, documentId)}
                    items={options.map((d) => ({
                      id: d.id,
                      label: d.number,
                      sublabel: `${docDate(d.date)} · ${money(d.total)} ${d.currency} · ${docStatus(d.status)}`,
                    }))}
                    placeholder={options.length ? t("ابحث برقم المستند...", "Search by document number...") : t("لا توجد مستندات", "No documents")}
                    disabled={!options.length}
                  />
                </div>
              );
            })}
          </div>
        )}

        {(links.length > 0 || pendingLinks.length > 0) && (
          <div className="divide-y divide-border/60 rounded-lg border border-border" data-testid="project-links-list">
            {links.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-content-secondary">{kindLabel(l.kind)}</span>
                <Link to={kindRoute(l.kind, l.documentId)} className="min-w-0 truncate font-code text-primary hover:underline" dir="ltr">
                  {l.document?.number || l.documentId}
                  <ExternalLink className="ms-1 inline h-3 w-3" />
                </Link>
                <span className="ms-auto flex shrink-0 items-center gap-3 font-english text-xs text-content-secondary" dir="ltr">
                  <span>{docDate(l.document?.date ?? null)}</span>
                  <span className="text-foreground">{money(l.document?.total)} {l.document?.currency || "SAR"}</span>
                  <span className="font-sans">{docStatus(l.document?.status)}</span>
                </span>
                <button type="button" onClick={() => setPendingUnlink(l.id)} aria-label={t("إلغاء الربط", "Remove link")} className="shrink-0 rounded p-1 text-content-secondary hover:text-danger">
                  <X className="h-3.5 w-3.5" />
                </button>
                {pendingUnlink === l.id && (
                  <div className="w-full pt-2">
                    <p className="mb-2 text-xs text-content-secondary">{t("إلغاء الربط فقط · المستند لن يُحذف", "Removes the link only · the document is not deleted")}</p>
                    <InlineConfirm onConfirm={() => removeLink(l.id)} onCancel={() => setPendingUnlink(null)} />
                  </div>
                )}
              </div>
            ))}
            {pendingLinks.map((l) => (
              <div key={`pending-${l.document.id}`} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-content-secondary">{kindLabel(l.kind)}</span>
                <span className="min-w-0 truncate font-code text-foreground" dir="ltr">{l.document.number}</span>
                <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] text-content-secondary">{t("يُربط عند الحفظ", "Links on save")}</span>
                <span className="ms-auto flex shrink-0 items-center gap-3 font-english text-xs text-content-secondary" dir="ltr">
                  <span>{docDate(l.document.date)}</span>
                  <span className="text-foreground">{money(l.document.total)} {l.document.currency}</span>
                </span>
                <button type="button" onClick={() => setPendingLinks((prev) => prev.filter((x) => x.document.id !== l.document.id))} aria-label={t("إزالة", "Remove")} className="shrink-0 rounded p-1 text-content-secondary hover:text-danger">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const qty = (v: any) => Number(v || 0).toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 });

  /**
   * SPEC-05 L3 · the post-award working surface: the cost budget the accountant
   * approves, the instalments that become invoices only on that approval, and the
   * purchase orders drawn from the budget's cost lines.
   *
   * Nothing here shows a sale price or a margin — the API does not send one, so
   * this section is safe for anyone who can open the project.
   */
  const lifecycleSection = project && (
    <div className="space-y-5" data-testid="project-lifecycle">
      <Card className="border-border" data-testid="project-cost-budget">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("ميزانية التكلفة", "Cost budget")}</div>
              <p className="mt-0.5 text-xs text-content-secondary">
                {t("نسخة التكلفة من دراسة المشروع · بلا سعر بيع أو نسبة ربح", "The cost copy of the cost study · no sale price, no margin")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {budget && (
                <span className={`rounded-full px-3 py-1 text-xs ${budget.status === "APPROVED" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"}`}>
                  {budget.status === "APPROVED" ? t("معتمدة · سقف الصرف", "Approved · spending ceiling") : t("مسودة · بانتظار اعتماد المحاسب", "Draft · awaiting accountant approval")}
                </span>
              )}
              {!budget && (
                <Button type="button" size="sm" onClick={buildBudget} disabled={l3Busy === "build"} data-testid="build-budget">
                  {l3Busy === "build" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="me-1.5 h-3.5 w-3.5" />{t("أنشئ من الدراسة", "Build from the cost study")}</>}
                </Button>
              )}
              {budget?.status === "DRAFT" && (
                <Button type="button" size="sm" onClick={approveBudget} disabled={l3Busy === "approve"} data-testid="approve-budget">
                  {l3Busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="me-1.5 h-3.5 w-3.5" />{t("اعتماد المحاسب", "Accountant approval")}</>}
                </Button>
              )}
              {budget?.status === "APPROVED" && (
                <Button type="button" size="sm" variant="outline" onClick={issuePurchaseOrder} disabled={l3Busy === "po"} data-testid="issue-po">
                  {l3Busy === "po" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><ShoppingCart className="me-1.5 h-3.5 w-3.5" />{t("أمر شراء للمشتريات", "Purchase order")}</>}
                </Button>
              )}
            </div>
          </div>

          {!budget ? (
            <p className="text-xs text-muted-foreground">{t("لا توجد ميزانية بعد · تُبنى من دراسة التكلفة المرتبطة بالمشروع.", "No budget yet · it is built from the cost study linked to this project.")}</p>
          ) : (
            <>
              <div className="ledger-table overflow-x-auto">
                <Table className="table-fixed min-w-[620px]">
                  <colgroup>
                    <col style={{ width: "90px" }} />{/* رقم البند · mono */}
                    <col style={{ minWidth: "180px" }} />{/* الوصف */}
                    <col style={{ width: "110px" }} />{/* الكمية */}
                    <col style={{ width: "120px" }} />{/* تكلفة الوحدة */}
                    <col style={{ width: "150px" }} />{/* التكلفة المخططة */}
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t("رقم", "No.")}</TableHead>
                      <TableHead className="text-start">{t("البند", "Item")}</TableHead>
                      <TableHead className="text-end">{t("الكمية", "Qty")}</TableHead>
                      <TableHead className="text-end">{t("تكلفة الوحدة", "Unit cost")}</TableHead>
                      <TableHead className="text-end">{t("التكلفة المخططة", "Planned cost")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budget.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="truncate font-code text-xs text-content-secondary" dir="ltr">{l.itemNo || "—"}</TableCell>
                        <TableCell className="truncate"><bdi dir="auto">{l.description}</bdi></TableCell>
                        <TableCell className="text-end font-english" dir="ltr">{qty(l.quantity)}{l.unit ? ` ${l.unit}` : ""}</TableCell>
                        <TableCell className="text-end font-english" dir="ltr">{money(l.unitCost)}</TableCell>
                        <TableCell className="text-end font-english text-foreground" dir="ltr" style={{ fontWeight: 600 }}>{money(l.plannedCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs text-content-secondary">{t("إجمالي التكلفة المخططة", "Total planned cost")}</span>
                <span data-testid="budget-cost-total" className="font-english text-foreground" dir="ltr" style={{ fontWeight: 700 }}>{money(budget.costTotal)} SAR</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {plans.length > 0 && (
        <Card className="border-border" data-testid="project-payment-plan">
          <CardContent className="space-y-3 p-5">
            <div className="min-w-0">
              <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("خطة الدفعات", "Payment plan")}</div>
              <p className="mt-0.5 text-xs text-content-secondary">
                {t("لا تصدر فاتورة الدفعة إلا باعتماد المحاسب", "An instalment becomes an invoice only on accountant approval")}
              </p>
            </div>
            <div className="divide-y divide-border/60 rounded-lg border border-border">
              {plans.flatMap((plan: any) => (plan.items || []).map((item: any) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 p-3 text-sm" data-testid={`plan-item-${item.id}`}>
                  <span className="min-w-0 truncate"><bdi dir="auto">{item.label}</bdi></span>
                  <span className="ms-auto flex shrink-0 items-center gap-3 font-english text-xs" dir="ltr">
                    <span className="text-content-secondary">{qty(item.percent)}%</span>
                    <span className="text-foreground">{money(item.amount)} SAR</span>
                  </span>
                  {item.invoiceId ? (
                    <span className="shrink-0 rounded-full bg-success-subtle px-2 py-0.5 text-[11px] text-success">{t("مفوترة", "Invoiced")}</span>
                  ) : (
                    <Button
                      type="button" size="sm" variant="outline"
                      data-testid={`invoice-item-${item.id}`}
                      onClick={() => invoiceInstalment(item.id)}
                      disabled={l3Busy === `inv-${item.id}`}
                    >
                      {l3Busy === `inv-${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("اعتماد وإصدار فاتورة", "Approve & invoice")}
                    </Button>
                  )}
                </div>
              )))}
            </div>
          </CardContent>
        </Card>
      )}

      {orders.length > 0 && (
        <Card className="border-border" data-testid="project-purchase-orders">
          <CardContent className="space-y-3 p-5">
            <div className="min-w-0">
              <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("أوامر الشراء", "Purchase orders")}</div>
              <p className="mt-0.5 text-xs text-content-secondary">
                {t("تصل المشتريات ببنود التكلفة فقط · لا عرض ولا فاتورة عميل", "Purchasing receives cost lines only · no proposal, no client invoice")}
              </p>
            </div>
            <div className="divide-y divide-border/60 rounded-lg border border-border">
              {orders.map((po) => (
                <div key={po.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="shrink-0 font-code text-primary" dir="ltr">{po.number}</span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-content-secondary">{po.status}</span>
                  <span className="ms-auto flex shrink-0 items-center gap-3 font-english text-xs" dir="ltr">
                    <span className="text-content-secondary">{po.issueDate?.slice(0, 10)}</span>
                    <span className="text-foreground">{money(po.total)} {po.currency}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const formView = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <InlineAlert tone="critical">{error}</InlineAlert>}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("بيانات المشروع", "Project details")}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="project-code">{t("الرمز", "Code")} *</Label>
                {codeAuto && (
                  <span data-testid="project-code-auto-chip" className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-[11px] text-content-secondary">
                    <Sparkles className="h-3 w-3" />{t("تلقائي", "Auto")}
                  </span>
                )}
              </div>
              <Input
                id="project-code" data-testid="project-code-input"
                required value={form.code}
                onChange={(e) => { setCodeAuto(false); setForm({ ...form, code: e.target.value }); }}
                placeholder="PRJ-0001" dir="ltr" className="font-english"
              />
              <p className="text-[11px] text-muted-foreground">
                {codeAuto
                  ? t("مقترح من إعدادات الترقيم التلقائي · يمكنك تعديله", "Suggested by your automatic numbering settings · you can edit it")
                  : t("رمز مخصص · لن يُرفض إلا إذا كان مستخدماً في مشروع آخر", "Custom code · only rejected if another project already uses it")}
              </p>
            </div>
            <div className="min-w-0 space-y-2"><Label>{t("اسم المشروع", "Project name")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("مشروع تطوير التطبيق", "App development project")} /></div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2" data-testid="project-client-field">
              <Label>{t("العميل", "Client")}</Label>
              <ContactSearchInput
                value={form.clientName}
                options={contactOptions}
                placeholder={t("ابحث أو أنشئ عميلاً...", "Search or create a client...")}
                onChange={async (name, contactId) => {
                  if (contactId) { setForm((f) => ({ ...f, clientContactId: contactId, clientName: name })); return; }
                  if (!name.trim()) { setForm((f) => ({ ...f, clientContactId: "", clientName: "" })); return; }
                  try {
                    const c = await api.contacts.create({ displayName: name, type: "CUSTOMER" });
                    setContacts((prev) => [c, ...prev]);
                    setForm((f) => ({ ...f, clientContactId: c.id, clientName: c.displayName }));
                    push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
                  } catch { push("error", t("تعذر إنشاء العميل", "Could not create the client")); }
                }}
              />
              <p className="text-[11px] text-muted-foreground">{t("يحدّد العميل المستندات المتاحة للربط أدناه", "The client decides which documents can be linked below")}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("تاريخ البداية", "Start date")}</Label><DateInput value={form.startDate} onChange={(iso) => setForm({ ...form, startDate: iso })} inputClassName="" /></div>
            <div className="space-y-2"><Label>{t("تاريخ النهاية", "End date")}</Label><DateInput value={form.endDate} onChange={(iso) => setForm({ ...form, endDate: iso })} inputClassName="" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("ميزانية المشروع", "Project budget")}</Label><Input type="number" step="0.01" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} dir="ltr" className="font-english" placeholder="20000" /></div>
            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("نطاق العمل · الشروط · المرجع", "Scope · terms · reference")} /></div>
          </div>
          {/* C2 · contracting (job costing) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="space-y-2"><Label>{t("قيمة العقد", "Contract value")}</Label><Input type="number" step="0.01" min="0" value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: e.target.value })} dir="ltr" className="font-english" placeholder="250000" /></div>
            <div className="space-y-2"><Label>{t("نسبة الاحتجاز %", "Retention %")}</Label><Input type="number" step="0.5" min="0" max="100" value={form.retentionPct} onChange={(e) => setForm({ ...form, retentionPct: e.target.value })} dir="ltr" className="font-english" placeholder="10" /></div>
            <div className="space-y-2"><Label>{t("نسبة الإنجاز %", "% complete")}</Label><Input type="number" step="1" min="0" max="100" value={form.percentComplete} onChange={(e) => setForm({ ...form, percentComplete: e.target.value })} dir="ltr" className="font-english" placeholder="0" /></div>
            <p className="md:col-span-3 text-[11px] text-muted-foreground">{t("تظهر في تقرير «ربحية المشاريع»: المفوتر مقابل العقد · الاحتجاز المقدّر · الميزانية مقابل الفعلي.", "Used by the Project Profitability report: billed vs contract · estimated retention · budget vs actual.")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("الحالة", "Status")}</Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s} type="button"
                  onClick={() => setForm({ ...form, status: s })}
                  className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${form.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"}`}
                >{statusLabel(s)}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {linkPickers}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-background py-3">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/projects") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy} className="min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("إنشاء المشروع", "Create project") : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const detailView = project && (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("الحالة", "Status")}</div>
          <div className="mt-1"><span className={`text-xs px-2 py-0.5 rounded-full ${project.status === "ACTIVE" ? "bg-success-subtle text-success" : project.status === "ON_HOLD" ? "bg-warning-subtle text-warning" : project.status === "COMPLETED" ? "bg-info-subtle text-info" : "bg-surface-hover text-muted-foreground"}`}>{statusLabel(project.status)}</span></div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("البداية", "Start")}</div>
          <div className="font-english text-foreground mt-1" dir="ltr">{project.startDate?.slice(0, 10) || "—"}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("النهاية", "End")}</div>
          <div className="font-english text-foreground mt-1" dir="ltr">{project.endDate?.slice(0, 10) || "—"}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("الرمز", "Code")}</div>
          <div className="font-english text-primary mt-1" style={{ fontWeight: 700 }} dir="ltr">{project.code}</div>
        </div>
      </div>

      {linkPickers}

      {lifecycleSection}

      {/* Performance — تقارير أداء المشروع */}
      {perf && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => navigate(`/app/work-logs/new?project=${project.id}`)}>
              <Clock3 className="me-1.5 h-3.5 w-3.5" />{t("سجّل ساعات", "Log hours")}
            </Button>
            {perf.totals?.outstanding > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-3 py-1 text-xs text-warning">
                <Banknote className="h-3 w-3" />{t("مستحق للمقاولين:", "Contractor outstanding:")} <span className="font-english">{money(perf.totals.outstanding)}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">{t("ساعات العمل", "Hours")}</div>
              <div className="font-english text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.2rem" }} dir="ltr">{hrsFmt(perf.totals?.totalHours)}</div>
              <div className="text-[10px] text-muted-foreground">{t("قابلة للفوترة:", "billable:")} <span className="font-english">{hrsFmt(perf.totals?.billableHours)}</span></div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">{t("تكلفة العمالة", "Labor cost")}</div>
              <div className="font-english text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.2rem" }} dir="ltr">{money(perf.totals?.laborCost)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">{t("المدفوع للمقاولين", "Paid out")}</div>
              <div className="font-english text-success mt-1" style={{ fontWeight: 700, fontSize: "1.2rem" }} dir="ltr">{money(perf.totals?.paidOut)}</div>
            </div>
            <div className={`rounded-lg border p-3 ${perf.totals?.margin != null ? (perf.totals.margin >= 0 ? "border-success-border bg-success-subtle" : "border-danger-border bg-danger-subtle") : "border-border bg-card"}`}>
              <div className="text-xs text-muted-foreground">{t("المتبقي من الميزانية", "Budget margin")}</div>
              <div className={`font-english mt-1 ${perf.totals?.margin != null ? (perf.totals.margin >= 0 ? "text-success" : "text-danger") : "text-foreground"}`} style={{ fontWeight: 700, fontSize: "1.2rem" }} dir="ltr">
                {perf.totals?.margin != null ? money(perf.totals.margin) : "—"}
              </div>
              {perf.totals?.budgetUsedPct != null && <div className="text-[10px] text-muted-foreground">{t("المستهلك:", "used:")} <span className="font-english">{displayDigits(perf.totals.budgetUsedPct.toFixed(0))}%</span></div>}
            </div>
          </div>

          {/* Engaged contractors + engage form */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("المقاولون على المشروع", "Contractors on this project")} · {perf.engagements?.filter((e: any) => e.status === "ACTIVE").length || 0}</div>
              </div>
              {perf.perContractor && perf.perContractor.length > 0 && (
                <div className="divide-y divide-border/50">
                  {perf.perContractor.map((pc: any) => (
                    <div key={pc.contractor.id} className="flex items-center justify-between py-2 text-sm">
                      <button onClick={() => navigate(`/app/contractors/${pc.contractor.id}`)} className="text-primary hover:underline text-start">
                        {pc.contractor.name} <span className="text-xs text-muted-foreground font-english">{pc.contractor.code}</span>
                      </button>
                      <div className="flex items-center gap-4 font-english text-xs" dir="ltr">
                        <span>{hrsFmt(pc.hours)} {t("ساعة", "h")}</span>
                        <span>{money(pc.earned)}</span>
                        {pc.paid < pc.earned && <span className="text-warning">{t("متبقٍ", "due")} {money(pc.earned - pc.paid)}</span>}
                        {pc.paid < pc.earned && (
                          <button onClick={() => navigate(`/app/contractors/${pc.contractor.id}/pay`)} className="rounded bg-primary px-2 py-0.5 text-primary-foreground text-[11px]">{t("ادفع", "Pay")}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
                <div className="flex-1 min-w-[180px]">
                  <SearchableCombobox
                    value={engageForm.contractorId}
                    onChange={(contractorId) => setEngageForm({ ...engageForm, contractorId })}
                    items={contractors.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}`, sublabel: c.specialty || undefined }))}
                    placeholder={t("أشرك مقاولاً...", "Engage a contractor...")}
                  />
                </div>
                <Input value={engageForm.role} onChange={(e) => setEngageForm({ ...engageForm, role: e.target.value })} placeholder={t("الدور (مصمم)", "Role (designer)")} className="w-32 h-9 text-xs" />
                <Input type="number" value={engageForm.agreedRate} onChange={(e) => setEngageForm({ ...engageForm, agreedRate: e.target.value })} placeholder={t("السعر/ساعة", "Rate/hr")} dir="ltr" className="w-24 h-9 text-xs font-english" />
                <Button type="button" size="sm" onClick={handleEngage} disabled={engageBusy || !engageForm.contractorId}>
                  {engageBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="me-1 h-3.5 w-3.5" />{t("إشراك", "Engage")}</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent logs */}
          {perf.recentLogs && perf.recentLogs.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="text-sm text-foreground mb-2" style={{ fontWeight: 700 }}>{t("آخر الساعات المسجلة", "Recent work logs")}</div>
                <div className="divide-y divide-border/50">
                  {perf.recentLogs.slice(0, 8).map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="text-muted-foreground font-english" dir="ltr">{l.date?.slice(0, 10)}</span>
                      <span className="text-foreground/80 flex-1 px-3 truncate">{l.contractor?.name} · {l.description || "—"}</span>
                      <span className="font-english" dir="ltr">{hrsFmt(l.hours)}h</span>
                      <span className="font-english ms-3" style={{ fontWeight: 600 }} dir="ltr">{money(l.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-danger-border text-danger hover:bg-danger-subtle"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-danger-border bg-danger-subtle p-3">
          <p className="text-xs text-danger mb-2">{t("حذف المشروع نهائياً؟", "Delete this project permanently?")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/projects" className="mb-1 inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5 ltr:rotate-180" strokeWidth={1.75} /> {t("المحاسبة", "Accounting")} · {t("العودة للمشاريع", "Back to Projects")}
        </Link>
        <h1 className="text-[clamp(1.75rem,1.5rem+0.8vw,2.25rem)] font-bold leading-tight tracking-[-0.01em] text-foreground">
          {isNew ? t("مشروع جديد", "New Project") : (project?.name || t("المشروع", "Project"))}
        </h1>
        {isNew && <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground flex items-center gap-1.5"><FolderKanban className="h-4 w-4" />{t("أنشئ مشروعاً واربطه بالفواتير والمصروفات والمقاولين", "Create a project and link it to invoices, expenses and contractors")}</p>}
      </div>
      {error && !editMode && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
