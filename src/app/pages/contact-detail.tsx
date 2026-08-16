/**
 * Contact Detail · full Wave-style profile page
 *
 * Tabs:
 *   1. Overview     · summary cards · key info · recent activity
 *   2. Operations   · invoices / bills / quotes / receipts / payments tables
 *   3. Documents    · uploaded files attached to this contact
 *   4. Portal       · client portal access (invitation, last login)
 *   5. Activity     · audit log · who did what when
 *
 * Powered by GET /api/contacts/:id/summary
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowRight, Building2, Mail, Phone, MapPin, FileText, ShoppingBag,
  Receipt, Banknote, Loader2, ExternalLink, AlertCircle, Plus, Send,
  Clock, Hash, Briefcase, User, Files,
  KeyRound, Activity, Tag, Landmark , Eye, Printer, Download, Trash2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { InlineAlert, Metric, MetricStrip, PageHeader, SectionHeader, StatusBadge, TableNumericCell } from "../components/product";
import { api, ApiError, ContactSummary } from "../lib/api";
import { ContactWizard } from "../components/contact-wizard";
import { ImageCropperModal } from "../components/image-cropper-modal";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";

type Tab = "overview" | "operations" | "documents" | "portal" | "activity";

const TAB_LABELS: Record<Tab, { ar: string; en: string }> = {
  overview: { ar: "نظرة عامة", en: "Overview" },
  operations: { ar: "المعاملات", en: "Transactions" },
  documents: { ar: "المستندات", en: "Documents" },
  portal: { ar: "البوابة", en: "Portal" },
  activity: { ar: "سجل النشاط", en: "Activity log" },
};

const TAB_ICONS: Record<Tab, any> = {
  overview: User,
  operations: Briefcase,
  documents: Files,
  portal: KeyRound,
  activity: Activity,
};

type SemanticTone = "neutral" | "info" | "success" | "warning" | "critical";

function DocumentStatus({ status }: { status: string }) {
  const { t } = useLanguage();
  const map: Record<string, { tone: SemanticTone; label: { ar: string; en: string } }> = {
    PAID:     { tone: "success", label: { ar: "مدفوعة", en: "Paid" } },
    SENT:     { tone: "info", label: { ar: "مرسلة", en: "Sent" } },
    PARTIAL:  { tone: "warning", label: { ar: "جزئية", en: "Partial" } },
    OVERDUE:  { tone: "critical", label: { ar: "متأخرة", en: "Overdue" } },
    DRAFT:    { tone: "neutral", label: { ar: "مسودة", en: "Draft" } },
    UNPAID:   { tone: "warning", label: { ar: "غير مدفوعة", en: "Unpaid" } },
    APPROVED: { tone: "info", label: { ar: "معتمدة", en: "Approved" } },
    ACCEPTED: { tone: "success", label: { ar: "مقبول", en: "Accepted" } },
    REJECTED: { tone: "critical", label: { ar: "مرفوض", en: "Rejected" } },
    EXPIRED:  { tone: "neutral", label: { ar: "منتهي", en: "Expired" } },
    CANCELLED:{ tone: "neutral", label: { ar: "ملغاة", en: "Cancelled" } },
  };
  const mapped = map[status] || { tone: "neutral" as const, label: { ar: status, en: status } };
  return <StatusBadge tone={mapped.tone} className="font-english">{t(mapped.label.ar, mapped.label.en)}</StatusBadge>;
}

function RoleBadges({ contact }: { contact: any }) {
  const { t } = useLanguage();
  const roles: Array<{ key: string; label: string; tone: SemanticTone }> = [];
  if (contact.isCustomer) roles.push({ key: "c", label: t("عميل", "Customer"), tone: "info" });
  if (contact.isSupplier) roles.push({ key: "s", label: t("مورّد", "Supplier"), tone: "success" });
  if (contact.isEmployee) roles.push({ key: "e", label: t("موظف", "Employee"), tone: "warning" });
  if (contact.isShareholder) roles.push({ key: "sh", label: t("مساهم", "Shareholder"), tone: "neutral" });
  if (contact.isFreelancer) roles.push({ key: "f", label: t("مستقل", "Freelancer"), tone: "neutral" });
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => <StatusBadge key={role.key} tone={role.tone}>{role.label}</StatusBadge>)}
      {roles.length === 0 && <StatusBadge>{t("بدون دور", "No role")}</StatusBadge>}
    </div>
  );
}

export function ContactDetail() {
  const { language, t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ContactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  // Customer logo upload · click the avatar → pick image → CROP → PATCH
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  // Pick a file → open the cropper modal (instead of the old silent downscale).
  const handleLogoPick = (file: File | undefined) => {
    if (!file || !id) return;
    setLogoError(null);
    if (!file.type.startsWith("image/")) { setLogoError(t("اختر ملف صورة (PNG / JPG / WEBP / SVG) · HEIC غير مدعوم", "Choose an image file (PNG / JPG / WEBP / SVG) · HEIC is not supported")); return; }
    if (file.size > 5 * 1024 * 1024) { setLogoError(t("الحد الأقصى 5 ميجابايت", "Maximum size is 5 MB")); return; }
    setCropFile(file);
  };

  // Cropper returns a 256×256 PNG data URL → PATCH the contact → refresh.
  const handleCropSave = async (dataUrl: string) => {
    if (!id) return;
    setCropFile(null);
    setLogoBusy(true);
    try {
      await api.contacts.update(id, { avatarUrl: dataUrl } as any);
      await refresh();
    } catch (e: any) {
      setLogoError(e?.message || t("فشل رفع الشعار", "Failed to upload logo"));
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const s = await api.contacts.summary(id);
      setData(s);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تحميل بيانات جهة الاتصال", "Failed to load contact data"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link to="/app/contacts" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary">
          <ArrowRight className="h-4 w-4" /> {t("العودة", "Back")}
        </Link>
        <InlineAlert tone="critical">
          {error || t("تعذّر تحميل بيانات جهة الاتصال", "Could not load contact data")}
        </InlineAlert>
      </div>
    );
  }

  const { contact, totals } = data;
  const cur = contact.country === "SA" ? "SAR" : (contact.defaultCurrency || "SAR");
  const fmt = (n: number) => `${n.toLocaleString()} ${cur}`;

  return (
    <div className="space-y-5">
      {/* Header bar · Wave-style minimal (UX-201) */}
      <PageHeader
        leading={<Link to="/app/contacts" aria-label={t("العودة إلى جهات الاتصال", "Back to contacts")} className="block rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-primary"><ArrowRight className={`h-5 w-5 ${language === "en" ? "rotate-180" : ""}`} /></Link>}
        title={<span className="block break-words">{contact.displayName}</span>}
        actions={(
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>{t("تعديل العميل", "Edit customer")}</Button>
            <div className="relative">
              <Button variant="outline" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} aria-haspopup="menu">
                {t("المزيد", "More")} <span className="text-[10px]">▾</span>
              </Button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className="absolute end-0 top-full mt-1.5 z-50 w-60 rounded-lg border border-border bg-surface py-1.5 shadow-popover" role="menu">
                    {[
                      { label: t("فاتورة مبيعات جديدة", "New sales invoice"), to: `/app/invoices?new=1&contactId=${contact.id}&returnTo=/app/contacts/${contact.id}` },
                      { label: t("عرض سعر جديد", "New quote"), to: `/app/quotes?new=1&contactId=${contact.id}&returnTo=/app/contacts/${contact.id}` },
                      { label: t("سند قبض جديد", "New receipt"), to: `/app/receipts/new?contactId=${contact.id}&returnTo=/app/contacts/${contact.id}` },
                      { label: t("سند صرف جديد", "New payment"), to: `/app/payments/new?contactId=${contact.id}&returnTo=/app/contacts/${contact.id}` },
                      { label: t("مصروف جديد", "New expense"), to: `/app/expenses?new=1&contactId=${contact.id}&returnTo=/app/contacts/${contact.id}` },
                      { label: t("فاتورة شراء جديدة", "New purchase bill"), to: `/app/purchases/bills?new=1&contactId=${contact.id}&returnTo=/app/contacts/${contact.id}` },
                    ].map((item) => (
                      <Link key={item.to} to={item.to} role="menuitem" onClick={() => setMoreOpen(false)} className="block px-4 py-2.5 text-sm text-foreground transition hover:bg-surface-hover hover:text-primary">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      />

      {/* Wave-style 2-column · contact card on left + tabs on right */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5 items-start">
        {/* Left contact card */}
        <Card className="border-border">
          <CardContent className="p-5">
            {/* Entity-aware avatar (UX-201) · click to upload customer logo */}
            <div className="flex flex-col items-center mb-4">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => handleLogoPick(e.target.files?.[0])}
              />
              <div
                className="relative w-24 h-24 rounded-full bg-primary/5 border border-dashed border-primary flex items-center justify-center mb-1 group cursor-pointer hover:bg-primary/10 transition overflow-hidden"
                title={t("رفع شعار العميل", "Upload customer logo")}
                onClick={() => !logoBusy && logoInputRef.current?.click()}
              >
                {(contact as any).avatarUrl ? (
                  <img src={(contact as any).avatarUrl} alt={contact.displayName} className="w-full h-full object-cover" />
                ) : contact.entityKind === "COMPANY" ? (
                  <Building2 className="h-10 w-10 text-primary" />
                ) : (contact as any).entityKind === "GOVERNMENT" ? (
                  <Landmark className="h-10 w-10 text-primary" />
                ) : (
                  <User className="h-10 w-10 text-primary" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/45 opacity-0 transition group-hover:opacity-100">
                  {logoBusy ? <Loader2 className="h-5 w-5 animate-spin text-background" /> : <span className="text-[10px] font-semibold text-background">{t("رفع شعار", "Upload logo")}</span>}
                </div>
              </div>
              {logoError && (
                <InlineAlert tone="critical" className="mb-1 max-w-[220px] px-2.5 py-1.5 text-center text-xs">
                  {logoError}
                </InlineAlert>
              )}
              <div className="mb-2" />
              <div className="flex flex-wrap gap-1 justify-center">
                {contact.isForeign && <StatusBadge tone="warning">{t("جهة خارجية", "Foreign entity")}</StatusBadge>}
                <RoleBadges contact={contact} />
              </div>
            </div>

            {/* Logo cropper modal · opens when a file is picked */}
            {cropFile && (
              <ImageCropperModal
                file={cropFile}
                onCrop={handleCropSave}
                onClose={() => { setCropFile(null); if (logoInputRef.current) logoInputRef.current.value = ""; }}
              />
            )}
            {contact.legalName && contact.legalName !== contact.displayName && (
              <div className="text-xs text-muted-foreground/60 text-center mb-3 pb-3 border-b border-border/50">{contact.legalName}</div>
            )}
            <div className="space-y-3 text-sm">
              {(contact as any).primaryContactName && (
                <div>
                  <div className="text-[10px] text-muted-foreground/60 mb-0.5">{t("جهة الاتصال الرئيسية", "Primary contact")}</div>
                  <div className="text-foreground font-semibold">{(contact as any).primaryContactName}</div>
                </div>
              )}
              {contact.email && (
                <div className="text-xs">
                  <a href={`mailto:${contact.email}`} className="text-foreground/80 hover:text-primary break-all font-english">{contact.email}</a>
                </div>
              )}
              {(contact as any).website && (
                <div className="text-xs">
                  <a href={(contact as any).website} target="_blank" rel="noreferrer" className="text-primary hover:underline font-english break-all">{(contact as any).website}</a>
                </div>
              )}
              {(contact.addressLine1 || contact.city) && (
                <div className="pt-3 border-t border-border/50">
                  <div className="text-[10px] text-muted-foreground/60 mb-1">{t("عنوان الفوترة", "Billing address")}</div>
                  <div className="text-xs text-foreground/80 leading-5">
                    {contact.addressLine1 && <div>{contact.addressLine1}</div>}
                    {contact.addressLine2 && <div>{contact.addressLine2}</div>}
                    {(contact.city || contact.region) && <div>{[contact.city, contact.region].filter(Boolean).join(", ")}</div>}
                    {contact.postalCode && <div className="font-english">{contact.postalCode}</div>}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right column — placeholder spacer for tabs/content (existing KPIs + sections render below this grid) */}
        <div className="min-w-0">
          {/* spacer; content continues below outside grid */}
        </div>
      </div>

      {/* Top KPI strip */}
      <MetricStrip>
        <Metric
          label={t("الفواتير", "Invoices")}
          icon={<FileText className="h-3.5 w-3.5" />}
          value={<span dir="ltr" className="font-english-block tabular-nums">{totals.invoices.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">{cur}</span></span>}
          hint={<><span className="font-english tabular-nums font-semibold">{totals.invoices.count}</span> {t("فاتورة", "invoices")}</>}
        />
        <Metric
          label={t("فواتير الشراء", "Purchase bills")}
          icon={<ShoppingBag className="h-3.5 w-3.5" />}
          value={<span dir="ltr" className="font-english-block tabular-nums">{totals.bills.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">{cur}</span></span>}
          hint={<><span className="font-english tabular-nums font-semibold">{totals.bills.count}</span> {t("فاتورة شراء", "purchase bills")}</>}
        />
        <Metric
          tone="success"
          label={t("سندات القبض", "Receipts")}
          icon={<Receipt className="h-3.5 w-3.5" />}
          value={<span dir="ltr" className="font-english-block tabular-nums">{totals.receipts.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">{cur}</span></span>}
          hint={<><span className="font-english tabular-nums font-semibold">{totals.receipts.count}</span> {t("سند قبض", "receipts")}</>}
        />
        <Metric
          tone={totals.balance >= 0 ? "success" : "warning"}
          label={t("الرصيد الصافي", "Net balance")}
          icon={<Banknote className="h-3.5 w-3.5" />}
          value={<span dir="ltr" className="font-english-block tabular-nums">{fmt(Math.abs(totals.balance))}</span>}
          hint={<><span className={totals.balance > 0 ? "text-success" : totals.balance < 0 ? "text-warning" : "text-muted-foreground"}>{totals.balance > 0 ? t("يستحق لي", "Owed to me") : totals.balance < 0 ? t("أستحق له", "I owe") : t("متعادل", "Settled")}</span><span className="mt-1 block border-t border-border pt-1">{t("إجمالي العمليات", "Total transactions")} <span dir="ltr" className="font-english tabular-nums font-semibold text-foreground">{(totals.invoices.total + totals.bills.total + totals.receipts.total + totals.payments.total).toLocaleString(undefined, { maximumFractionDigits: 2 })} {cur}</span></span></>}
        />
      </MetricStrip>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tabKey) => {
            const Icon = TAB_ICONS[tabKey];
            const active = tab === tabKey;
            return (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`px-4 py-2.5 text-sm flex items-center gap-1.5 border-b-2 transition shrink-0 ${
                  active ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground font-medium hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t(TAB_LABELS[tabKey].ar, TAB_LABELS[tabKey].en)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab data={data} cur={cur} />}
      {tab === "operations" && <OperationsTab data={data} cur={cur} />}
      {tab === "documents" && <DocumentsTab contact={contact} />}
      {tab === "portal" && <PortalTab contact={contact} />}
      {tab === "activity" && <ActivityTab contactId={contact.id} />}
      {/* تعديل العميل — in place (was: navigate away to /app/contacts?edit= and
          dump the user on the list; now the same wizard opens here and the page
          refreshes with the saved data) */}
      <ContactWizard
        open={editOpen}
        editing={contact}
        onClose={(saved) => {
          setEditOpen(false);
          if (saved) refresh();
        }}
      />

    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────
function OverviewTab({ data, cur }: { data: ContactSummary; cur: string }) {
  const { t } = useLanguage();
  const { contact, totals } = data;
  const recentInvoices = data.invoices.slice(0, 5);
  const recentBills = data.bills.slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left col · contact info */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <SectionHeader title={t("معلومات الاتصال", "Contact info")} />
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {contact.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline break-all font-english">{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                <a href={`tel:${contact.phone}`} className="text-foreground hover:underline font-english">{contact.phone}</a>
              </div>
            )}
            {(contact.addressLine1 || contact.city) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                <div className="text-foreground/80">
                  {contact.addressLine1 && <div>{contact.addressLine1}</div>}
                  {contact.addressLine2 && <div>{contact.addressLine2}</div>}
                  {(contact.city || contact.region) && <div>{[contact.city, contact.region].filter(Boolean).join(", ")}</div>}
                  {contact.postalCode && <div className="font-english">{contact.postalCode}</div>}
                  {contact.country && <div className="text-xs text-muted-foreground/60 font-english uppercase">{contact.country}</div>}
                </div>
              </div>
            )}
            {!contact.email && !contact.phone && !contact.addressLine1 && (
              <div className="text-xs text-muted-foreground/60 py-2">{t("لا توجد معلومات اتصال · أضف من زر التعديل", "No contact info · add it from the Edit button")}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <SectionHeader title={t("الهوية الضريبية", "Tax identity")} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t("الرقم الضريبي", "Tax ID")} value={contact.vatNumber} mono />
            <Row label={t("السجل التجاري", "Commercial registration")} value={contact.crNumber} mono />
            <Row label={t("رقم الهوية", "National ID")} value={(contact as any).nationalId} mono />
            <Row label="LEI" value={(contact as any).leiCode} mono />
            <Row label={t("النوع", "Type")} value={contact.entityKind === "COMPANY" ? t("شركة", "Company") : t("فرد", "Individual")} />
            <Row label={t("الدولة", "Country")} value={contact.country?.toUpperCase()} mono />
            {(contact as any).withholdingTaxRate != null && (
              <Row label={t("ضريبة الاستقطاع", "Withholding tax")} value={`${(contact as any).withholdingTaxRate}%`} mono />
            )}
          </CardContent>
        </Card>

        {(contact as any).tags && (
          <Card className="border-border">
            <CardHeader className="pb-3">
              <SectionHeader title={<span className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> {t("الوسوم", "Tags")}</span>} />
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {String((contact as any).tags).split(",").map((t: string, i: number) => (
                <span key={i} className="rounded-full border border-info-border bg-info-subtle px-2 py-1 text-xs text-info">
                  {t.trim()}
                </span>
              ))}
            </CardContent>
          </Card>
        )}

        {contact.notes && (
          <Card className="border-border">
            <CardHeader className="pb-3">
              <SectionHeader title={t("ملاحظات", "Notes")} />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{contact.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right col · recent activity */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <SectionHeader
              title={<span className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> {t("آخر الفواتير", "Latest invoices")}</span>}
              actions={<span className="text-xs text-muted-foreground">{t("مستحق:", "Due:")} <span dir="ltr" className="inline-block font-english tabular-nums">{totals.arOpen.toLocaleString()} {cur}</span></span>}
            />
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <EmptyMini icon={FileText} text={t("لا توجد فواتير", "No invoices")} cta={{ to: `/app/invoices?new=1&contactId=${contact.id}`, label: t("+ أنشئ أول فاتورة", "+ Create your first invoice") }} />
            ) : (
              <DocList
                rows={recentInvoices.map((i) => ({
                  id: i.id,
                  number: i.invoiceNumber,
                  date: i.issueDate,
                  total: Number(i.total),
                  paid: Number(i.amountPaid),
                  status: i.status,
                  href: `/app/invoices/${i.id}`,
                  cur: i.currency,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <SectionHeader
              title={<span className="flex items-center gap-1.5"><ShoppingBag className="h-4 w-4" /> {t("آخر فواتير الشراء", "Latest purchase bills")}</span>}
              actions={<span className="text-xs text-muted-foreground">{t("مستحق:", "Due:")} <span dir="ltr" className="inline-block font-english tabular-nums">{totals.apOpen.toLocaleString()} {cur}</span></span>}
            />
          </CardHeader>
          <CardContent>
            {recentBills.length === 0 ? (
              <EmptyMini icon={ShoppingBag} text={t("لا توجد فواتير شراء", "No purchase bills")} cta={{ to: `/app/purchases/bills?new=1&contactId=${contact.id}`, label: t("+ سجّل فاتورة شراء", "+ Record a purchase bill") }} />
            ) : (
              <DocList
                rows={recentBills.map((b) => ({
                  id: b.id,
                  number: b.billNumber,
                  date: b.issueDate,
                  total: Number(b.total),
                  paid: Number(b.amountPaid),
                  status: b.status,
                  href: `/app/purchases/bills/${b.id}`,
                  cur: b.currency,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span dir={mono ? "ltr" : undefined} className={`text-sm text-foreground/80 ${mono ? "font-english tabular-nums" : ""}`}>{value}</span>
    </div>
  );
}

function EmptyMini({ icon: Icon, text, cta }: { icon: any; text: string; cta?: { to: string; label: string } }) {
  return (
    <div className="text-center py-6">
      <Icon className="h-8 w-8 text-muted mx-auto mb-2" />
      <p className="text-xs text-muted-foreground/60">{text}</p>
      {cta && <Link to={cta.to} className="text-xs text-primary hover:underline mt-2 inline-block">{cta.label}</Link>}
    </div>
  );
}

function DocList({ rows }: { rows: Array<{ id: string; number: string; date: string; total: number; paid: number; status: string; href: string; cur: string }> }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <Link key={r.id} to={r.href} className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg hover:bg-primary/5 transition group min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Hash className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <div className="min-w-0 flex-1">
              <div dir="ltr" className="text-sm font-english font-english-block font-semibold text-foreground group-hover:text-primary truncate">{r.number}</div>
              <div dir="ltr" className="text-xs text-muted-foreground/60 font-english font-english-block">{r.date.slice(0, 10)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end min-w-[140px] md:min-w-[180px]">
            <DocumentStatus status={r.status} />
            <div className="text-end">
              <div dir="ltr" className="whitespace-nowrap text-sm font-english tabular-nums font-semibold text-foreground">{r.total.toLocaleString()}</div>
              <div dir="ltr" className="whitespace-nowrap text-xs font-english tabular-nums text-muted-foreground">{r.cur}</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Operations tab ────────────────────────────────────────────────────────
function OperationsTab({ data, cur }: { data: ContactSummary; cur: string }) {
  const { t } = useLanguage();
  const { contact } = data;
  type Section = "invoices" | "bills" | "quotes" | "vouchers" | "expenses";
  const [section, setSection] = useState<Section>("invoices");

  const sections: Array<{ key: Section; label: string; count: number; total: number }> = [
    { key: "invoices", label: t("فواتير المبيعات", "Sales invoices"), count: data.totals.invoices.count, total: data.totals.invoices.total },
    { key: "bills", label: t("فواتير الشراء", "Purchase bills"), count: data.totals.bills.count, total: data.totals.bills.total },
    { key: "quotes", label: t("عروض الأسعار", "Quotes"), count: data.totals.quotes.count, total: data.totals.quotes.total },
    { key: "vouchers", label: t("السندات", "Vouchers"), count: data.totals.receipts.count + data.totals.payments.count, total: data.totals.receipts.total + data.totals.payments.total },
    { key: "expenses", label: t("المصروفات", "Expenses"), count: data.expenses.length, total: data.expenses.reduce((s, e) => s + Number(e.total), 0) },
  ];

  const newLinks: Record<Section, string> = {
    invoices: `/app/invoices?new=1&contactId=${contact.id}`,
    bills: `/app/purchases/bills?new=1&contactId=${contact.id}`,
    quotes: `/app/quotes?new=1&contactId=${contact.id}`,
    vouchers: `/app/vouchers/new?contactId=${contact.id}`,
    expenses: `/app/expenses/new?contactId=${contact.id}`,
  };

  return (
    <div className="space-y-4">
      {/* Section selector */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`text-start p-3 rounded-lg border transition ${
              section === s.key
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 font-english tabular-nums text-base font-bold text-foreground">{s.count}</div>
            <div dir="ltr" className="font-english tabular-nums text-xs text-muted-foreground">{s.total.toLocaleString()} {cur}</div>
          </button>
        ))}
      </div>

      {/* Action bar */}
      <SectionHeader
        title={sections.find((s) => s.key === section)?.label}
        actions={(
          <Button asChild size="sm">
            <Link to={newLinks[section]}><Plus className="h-3.5 w-3.5" /> {t("إضافة جديد", "Add new")}</Link>
          </Button>
        )}
      />

      {/* Section content · table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {section === "invoices" && <InvTable rows={data.invoices.map((i) => ({ id: i.id, number: i.invoiceNumber, date: i.issueDate, due: i.dueDate, total: Number(i.total), paid: Number(i.amountPaid), status: i.status, cur: i.currency, href: `/app/invoices/${i.id}` }))} />}
          {section === "bills"    && <InvTable rows={data.bills.map((b) => ({ id: b.id, number: b.billNumber, date: b.issueDate, due: b.dueDate, total: Number(b.total), paid: Number(b.amountPaid), status: b.status, cur: b.currency, href: `/app/purchases/bills/${b.id}` }))} />}
          {section === "quotes"   && <InvTable rows={data.quotes.map((q) => ({ id: q.id, number: q.quoteNumber, date: q.issueDate, due: q.validUntil, total: Number(q.total), paid: 0, status: q.status, cur: q.currency, href: `/app/quotes/${q.id}` }))} />}
          {section === "vouchers" && <VchTable rows={data.vouchers} />}
          {section === "expenses" && <ExpTable rows={data.expenses} />}
        </CardContent>
      </Card>
    </div>
  );
}

function InvTable({ rows }: { rows: Array<{ id: string; number: string; date: string; due: string | null; total: number; paid: number; status: string; cur: string; href: string }> }) {
  const { t } = useLanguage();
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground/60">{t("لا توجد سجلات", "No records")}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] table-auto text-sm">
        <colgroup>
          <col style={{ width: "20%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "6%" }} />
        </colgroup>
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="text-start px-4 py-2.5 font-medium">{t("رقم", "Number")}</th>
            <th className="text-start px-4 py-2.5 font-medium">{t("تاريخ", "Date")}</th>
            <th className="text-start px-4 py-2.5 font-medium">{t("استحقاق", "Due")}</th>
            <th className="text-end px-4 py-2.5 font-medium">{t("إجمالي", "Total")}</th>
            <th className="text-end px-4 py-2.5 font-medium">{t("مدفوع", "Paid")}</th>
            <th className="text-end px-4 py-2.5 font-medium">{t("متبقي", "Remaining")}</th>
            <th className="text-center px-4 py-2.5 font-medium">{t("الحالة", "Status")}</th>
            <th className="px-2 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/50 hover:bg-primary/5 transition">
              <td className="px-4 py-2.5">
                <Link to={r.href} dir="ltr" className="font-english inline-block font-semibold text-primary hover:underline">{r.number}</Link>
              </td>
              <td className="px-4 py-2.5 text-foreground/80"><span dir="ltr" className="font-english inline-block">{r.date.slice(0, 10)}</span></td>
              <td className="px-4 py-2.5 text-muted-foreground"><span dir="ltr" className="font-english inline-block">{r.due?.slice(0, 10) || "—"}</span></td>
              <td className="px-4 py-2.5 text-end"><TableNumericCell className="font-semibold text-foreground">{r.total.toLocaleString()}</TableNumericCell></td>
              <td className="px-4 py-2.5 text-end"><TableNumericCell className="text-success">{r.paid.toLocaleString()}</TableNumericCell></td>
              <td className="px-4 py-2.5 text-end"><TableNumericCell className="text-warning">{(r.total - r.paid).toLocaleString()}</TableNumericCell></td>
              <td className="px-4 py-2.5 text-center"><DocumentStatus status={r.status} /></td>
              <td className="px-2 py-2.5"><Link to={r.href}><ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary" /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VchTable({ rows }: { rows: ContactSummary["vouchers"] }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  if (rows.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground/60">{t("لا توجد سندات", "No vouchers")}</div>;
  const voucherPath = (v: ContactSummary["vouchers"][number]) => (v.type === "RECEIPT" ? `/app/receipts/${v.id}` : `/app/payments/${v.id}`);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] table-auto text-sm">
        <colgroup>
          <col style={{ width: "17%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="text-start px-4 py-2.5 font-medium">{t("رقم", "Number")}</th>
            <th className="text-start px-4 py-2.5 font-medium">{t("النوع", "Type")}</th>
            <th className="text-start px-4 py-2.5 font-medium">{t("التاريخ", "Date")}</th>
            <th className="text-end px-4 py-2.5 font-medium">{t("المبلغ", "Amount")}</th>
            <th className="text-start px-4 py-2.5 font-medium">{t("طريقة الدفع", "Payment method")}</th>
            <th className="text-start px-4 py-2.5 font-medium">{t("المرجع", "Reference")}</th>
            <th className="text-end px-4 py-2.5 font-medium">{t("إجراءات", "Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr
              key={v.id}
              onClick={() => navigate(voucherPath(v))}
              className="border-t border-border/50 hover:bg-primary/5 transition cursor-pointer"
              title={t("استعراض السند", "View voucher")}
            >
              <td className="px-4 py-2.5"><span dir="ltr" className="font-english inline-block font-semibold text-primary">{v.number}</span></td>
              <td className="px-4 py-2.5">
                <StatusBadge tone={v.type === "RECEIPT" ? "success" : "warning"}>
                  {v.type === "RECEIPT" ? t("قبض", "Receipt") : t("صرف", "Payment")}
                </StatusBadge>
              </td>
              <td className="px-4 py-2.5 text-foreground/80"><span dir="ltr" className="font-english tabular-nums inline-block">{v.date.slice(0, 10)}</span></td>
              <td className={`px-4 py-2.5 text-end ${v.type === "RECEIPT" ? "text-success" : "text-warning"}`}>
                <TableNumericCell className="font-semibold">{Number(v.amount).toLocaleString()} {v.currency}</TableNumericCell>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-normal break-words">{v.paymentMethod || "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs"><span dir="ltr" className="font-english inline-block">{v.reference || "—"}</span></td>
              <td className="px-4 py-2.5 text-end" onClick={(e) => e.stopPropagation()}>
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => navigate(voucherPath(v))}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    title={t("استعراض السند", "View voucher")}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`/print/voucher/${v.id}`, "_blank", "noopener")}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    title={t("طباعة السند", "Print voucher")}
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpTable({ rows }: { rows: ContactSummary["expenses"] }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  if (rows.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground/60">{t("لا توجد مصروفات", "No expenses")}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] table-auto text-sm">
        <colgroup>
          <col style={{ width: "16%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "46%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="text-start px-4 py-2.5 font-medium">{t("التاريخ", "Date")}</th>
            <th className="text-start px-4 py-2.5 font-medium">{t("الفئة", "Category")}</th>
            <th className="text-start px-4 py-2.5 font-medium">{t("الوصف", "Description")}</th>
            <th className="text-end px-4 py-2.5 font-medium">{t("المبلغ", "Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} onClick={() => navigate(`/app/expenses/${e.id}`)} className="border-t border-border/50 hover:bg-primary/5 transition cursor-pointer">
              <td className="px-4 py-2.5 text-foreground/80"><span dir="ltr" className="font-english inline-block">{e.date.slice(0, 10)}</span></td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-normal break-words">{e.category || t("غير مصنّف", "Uncategorized")}</td>
              <td className="px-4 py-2.5 text-foreground/80 whitespace-normal break-words">{e.description || "—"}</td>
              <td className="px-4 py-2.5 text-end text-warning"><TableNumericCell className="whitespace-nowrap font-semibold">{Number(e.total).toLocaleString()} {e.currency}</TableNumericCell></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────
function DocumentsTab({ contact }: { contact: any }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      {/* HR-4 #27 — employee HR documents (iqama/passport/contract/CV…) */}
      {contact.isEmployee && <EmployeeDocumentsSection contactId={contact.id} />}

      <Card className="border-border">
        <CardContent className="py-12 text-center">
          <Files className="h-10 w-10 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t("لم يتم رفع أي مستندات لهذه الجهة", "No documents uploaded for this contact")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{t("العقود · بطاقات الضريبة · السجلات التجارية · ملفات الهوية", "Contracts · tax cards · commercial registrations · ID files")}</p>
          <Link
            to={`/app/files/upload?contactId=${contact.id}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> {t("رفع مستند", "Upload document")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Employee HR documents (HR-4 #27) — real upload/list/expiry/download ──

const DOC_KINDS: Array<{ id: string; ar: string; en: string }> = [
  { id: "IQAMA", ar: "إقامة", en: "Iqama" },
  { id: "PASSPORT", ar: "جواز سفر", en: "Passport" },
  { id: "CONTRACT", ar: "عقد عمل", en: "Work contract" },
  { id: "CV", ar: "سيرة ذاتية", en: "CV" },
  { id: "LICENSE", ar: "رخصة مهنية", en: "License" },
  { id: "CERTIFICATE", ar: "شهادة", en: "Certificate" },
  { id: "MEDICAL", ar: "فحص طبي", en: "Medical" },
];

function EmployeeDocumentsSection({ contactId }: { contactId: string }) {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [contractId, setContractId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("IQAMA");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // HR-5 · auto-fill from document
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<any>(null);
  const [applying, setApplying] = useState(false);

  // Resolve this contact's employment contract (documents hang off it)
  useEffect(() => {
    let alive = true;
    api.payroll.contracts().then((r) => {
      if (!alive) return;
      const found = (r.items || []).find((it: any) => it.contactId === contactId);
      setContractId(found?.id || null);
      setResolving(false);
    }).catch(() => setResolving(false));
    return () => { alive = false; };
  }, [contactId]);

  const loadDocs = useCallback(async () => {
    if (!contractId) return;
    try {
      const r = await api.payroll.documents(contractId);
      setItems(r.items || []);
    } catch { /* list stays as-is */ }
  }, [contractId]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  const extractFromFile = async () => {
    if (!file || extracting) return;
    setExtracting(true);
    setExtracted(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] || "";
      const r = await api.agent.extractEmployeeDocument({ fileBase64: base64, fileName: file.name, mimeType: file.type || "image/jpeg" });
      if (r?.error) throw new Error(r.message || r.error);
      setExtracted(r);
      // Prefill the upload form from what the model saw
      if (r?.documentKind && DOC_KINDS.some((k) => k.id === r.documentKind)) setKind(r.documentKind);
      if (r?.expiryDate) setExpiresAt(r.expiryDate);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("تعذر الاستخراج", "Extraction failed"));
    } finally { setExtracting(false); }
  };

  const applyExtracted = async () => {
    if (!extracted || !contractId || applying) return;
    setApplying(true);
    try {
      const name = (extracted.fullNameAr || extracted.fullName || "").trim();
      const contactPatch: any = {};
      if (name) contactPatch.displayName = name;
      if (extracted.nationalId) contactPatch.nationalId = extracted.nationalId;
      if (extracted.nationalityCode) contactPatch.country = extracted.nationalityCode;
      if (Object.keys(contactPatch).length > 0) {
        await api.contacts.update(contactId, contactPatch);
      }
      const contractPatch: any = {};
      if (extracted.jobTitle) contractPatch.jobTitle = extracted.jobTitle;
      if (extracted.nationalityCode) contractPatch.nationalityCode = extracted.nationalityCode;
      if (extracted.birthDate) contractPatch.dateOfBirth = extracted.birthDate;
      if (Object.keys(contractPatch).length > 0) {
        await api.payroll.updateContract(contractId, contractPatch);
      }
      push("success", t("عبّأنا الحقول من المستند ✓ — راجعها في ملف الموظف", "Fields filled from the document ✓ — review them in the employee file"));
      setExtracted(null);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التعبئة", "Apply failed"));
    } finally { setApplying(false); }
  };

  const upload = async () => {
    if (!file || !contractId || busy) return;
    if (file.size > 4 * 1024 * 1024) {
      push("error", t("الملف أكبر من 4MB — صغّر الملف وأعد الرفع", "File is over 4MB — shrink it and retry"));
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] || "";
      await api.payroll.uploadDocument(contractId, {
        documentKind: kind,
        fileName: file.name,
        fileBase64: base64,
        fileType: file.type || undefined,
        expiresAt: expiresAt || null,
      });
      setFile(null);
      setExpiresAt("");
      push("success", t("تم رفع المستند ✓", "Document uploaded ✓"));
      await loadDocs();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الرفع", "Upload failed"));
    } finally { setBusy(false); }
  };

  const download = async (id: string) => {
    try {
      const doc = await api.payroll.downloadDocument(id);
      const a = document.createElement("a");
      a.href = `data:${doc.fileType || "application/octet-stream"};base64,${doc.fileBase64}`;
      a.download = doc.fileName;
      a.click();
    } catch { push("error", t("تعذر التنزيل", "Could not download")); }
  };

  const remove = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.payroll.removeDocument(id);
      setItems((prev) => prev.filter((d) => d.id !== id));
      push("success", t("حُذف المستند", "Document deleted"));
    } catch { push("error", t("فشل الحذف", "Delete failed")); }
  };

  const kindLabel = (id: string) => {
    const k = DOC_KINDS.find((x) => x.id === id);
    return k ? t(k.ar, k.en) : id;
  };

  const expiryBadge = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
    if (days < 0) return <StatusBadge tone="critical" className="text-[10px] font-bold">{t("منتهٍ!", "Expired!")}</StatusBadge>;
    if (days <= 30) return <StatusBadge tone="warning" className="text-[10px] font-bold">{t(`ينتهي خلال ${days} يوم`, `Expires in ${days}d`)}</StatusBadge>;
    return <StatusBadge tone="success" className="text-[10px] font-bold">{t("ساري", "Valid")}</StatusBadge>;
  };

  return (
    <Card className="border-border">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2 text-base">
          <Files className="h-4 w-4 text-primary" /> {t("مستندات الموظف (HR)", "Employee documents (HR)")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {resolving ? (
          <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
        ) : !contractId ? (
          <p className="text-sm text-muted-foreground">{t("لا يوجد عقد توظيف لهذا الموظف بعد — أنشئ العقد من صفحة الرواتب أولًا ثم ارفع المستندات هنا.", "No employment contract for this employee yet — create the contract from Payroll first, then upload documents here.")}</p>
        ) : (
          <>
            {/* Upload row */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
              <div className="flex gap-1.5 flex-wrap">
                {DOC_KINDS.map((k) => (
                  <button key={k.id} onClick={() => setKind(k.id)} className={`rounded-lg px-2.5 py-1 text-[11px] transition-colors ${kind === k.id ? "bg-primary text-primary-foreground font-bold" : "bg-muted/50 text-muted-foreground font-medium hover:bg-muted"}`}>{t(k.ar, k.en)}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="text-xs text-muted-foreground file:me-2 file:rounded-lg file:border-0 file:bg-muted/60 file:px-3 file:py-1.5 file:text-xs file:text-foreground hover:file:bg-muted"
                />
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
                  title={t("تاريخ انتهاء المستند (اختياري)", "Document expiry (optional)")}
                />
                <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={!file || busy} onClick={upload}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 me-1" />}
                  {t("رفع", "Upload")}
                </Button>
                <Button size="sm" variant="outline" disabled={!file || extracting} onClick={extractFromFile}>
                  {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : <Sparkles className="h-3.5 w-3.5 me-1" />}
                  {t("استخراج وتعبئة تلقائية", "Extract & auto-fill")}
                </Button>
              </div>
            </div>

            {/* HR-5 extracted-fields review card */}
            {extracted && (
              <div className="space-y-2 rounded-lg border border-info-border bg-info-subtle p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-primary">{t("قرأنا المستند — راجع قبل التعبئة", "We read the document — review before applying")}</div>
                  <button onClick={() => setExtracted(null)} className="text-muted-foreground/60 hover:text-foreground text-xs">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {extracted.fullNameAr || extracted.fullName ? <div><span className="text-muted-foreground">{t("الاسم:", "Name:")}</span> <span className="text-foreground font-medium">{extracted.fullNameAr || extracted.fullName}</span></div> : null}
                  {extracted.nationalId ? <div><span className="text-muted-foreground">{t("رقم الهوية/الإقامة:", "ID/Iqama no:")}</span> <span className="text-foreground font-english">{extracted.nationalId}</span></div> : null}
                  {extracted.passportNumber ? <div><span className="text-muted-foreground">{t("رقم الجواز:", "Passport no:")}</span> <span className="text-foreground font-english">{extracted.passportNumber}</span></div> : null}
                  {extracted.nationality ? <div><span className="text-muted-foreground">{t("الجنسية:", "Nationality:")}</span> <span className="text-foreground">{extracted.nationality}</span></div> : null}
                  {extracted.birthDate ? <div><span className="text-muted-foreground">{t("الميلاد:", "Birth:")}</span> <span className="text-foreground font-english">{extracted.birthDate}</span></div> : null}
                  {extracted.jobTitle ? <div><span className="text-muted-foreground">{t("المسمى الوظيفي:", "Job title:")}</span> <span className="text-foreground">{extracted.jobTitle}</span></div> : null}
                  {extracted.expiryDate ? <div><span className="text-muted-foreground">{t("انتهاء المستند:", "Doc expiry:")}</span> <span className="text-foreground font-english">{extracted.expiryDate}</span></div> : null}
                </div>
                {Array.isArray(extracted.warnings) && extracted.warnings.length > 0 && (
                  <div className="text-[11px] text-warning">⚠ {extracted.warnings.join(" · ")}</div>
                )}
                <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={applying} onClick={applyExtracted}>
                  {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : <Sparkles className="h-3.5 w-3.5 me-1" />}
                  {t("تعبئة الحقول في ملف الموظف", "Fill the employee file")}
                </Button>
              </div>
            )}

            {/* List */}
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 text-center py-2">{t("لا مستندات مرفوعة بعد — إقامة · جواز · عقد · سيرة ذاتية", "No documents yet — iqama · passport · contract · CV")}</p>
            ) : (
              <div className="divide-y divide-border/50">
                {items.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 py-2.5">
                    <span className="shrink-0 rounded bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{kindLabel(d.documentKind)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground truncate font-english">{d.fileName}</div>
                      <div className="text-[10px] text-muted-foreground/60 font-english">
                        {d.fileSizeBytes ? `${Math.round(d.fileSizeBytes / 1024)} KB` : ""}
                        {d.expiresAt ? ` · ${String(d.expiresAt).slice(0, 10)}` : ""}
                      </div>
                    </div>
                    {expiryBadge(d.expiresAt)}
                    <button onClick={() => download(d.id)} className="rounded-md p-1.5 text-primary hover:bg-primary/10" title={t("تنزيل", "Download")}>
                      <Download className="h-4 w-4" />
                    </button>
                    {pendingDelete === d.id ? (
                      <InlineConfirm onConfirm={() => remove(d.id)} onCancel={() => setPendingDelete(null)} label={t("حذف؟", "Delete?")} />
                    ) : (
                      <button onClick={() => setPendingDelete(d.id)} className="rounded-md p-1.5 text-danger hover:bg-danger-subtle" title={t("حذف", "Delete")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Portal tab ────────────────────────────────────────────────────────────
function PortalTab({ contact }: { contact: any }) {
  const { t } = useLanguage();
  const [portalUrl, setPortalUrl] = useState<string>("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadPortal = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.portal.getUrl(contact.id);
      setPortalUrl(r.url || "");
      setEnabled(!!r.enabled && !!r.url);
    } catch {
      setPortalUrl("");
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [contact.id]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const ensurePortalEnabled = async () => {
    setBusy(true);
    try {
      const r = await api.portal.enable(contact.id);
      setPortalUrl(r.url || "");
      setEnabled(true);
    } catch {
      // ignored in UI for now
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader>
          <SectionHeader title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> {t("بوابة العميل", "Customer portal")}</span>} />
          <CardDescription className="text-xs text-muted-foreground">
            {t("رابط مخصّص للعميل لعرض فواتيره · دفعها · تنزيلها · بدون حاجة لإنشاء حساب", "A dedicated link for the customer to view, pay, and download invoices · no account needed")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
            <code className="text-xs text-foreground/80 font-english truncate flex-1">
              {loading ? "..." : (portalUrl || t("لم يتم تفعيل الرابط بعد", "Link not activated yet"))}
            </code>
            {portalUrl && (
              <button
                onClick={() => navigator.clipboard.writeText(portalUrl)}
                className="text-xs text-primary hover:underline shrink-0"
              >
                {t("نسخ", "Copy")}
              </button>
            )}
          </div>

          {!enabled && (
            <button
              onClick={ensurePortalEnabled}
              disabled={busy || loading}
              className="w-full px-3 py-2 rounded-lg border border-primary text-primary text-sm hover:bg-primary/5 transition disabled:opacity-60"
            >
              {busy ? t("جارٍ التفعيل...", "Enabling...") : t("تفعيل البوابة", "Enable portal")}
            </button>
          )}

          {contact.email ? (
            <button
              disabled={!portalUrl}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> {t("إرسال دعوة إلى", "Send invitation to")} <span className="font-english">{contact.email}</span>
            </button>
          ) : (
            <InlineAlert tone="warning" icon={<AlertCircle className="h-3.5 w-3.5" />}>
              {t("أضف بريداً إلكترونياً لإرسال دعوة البوابة", "Add an email address to send the portal invitation")}
            </InlineAlert>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg border border-border">
              <div className="text-xs text-muted-foreground">{t("آخر دخول", "Last login")}</div>
              <div className="text-sm text-foreground mt-0.5">{t("لم يدخل بعد", "Never logged in")}</div>
            </div>
            <div className="p-3 rounded-lg border border-border">
              <div className="text-xs text-muted-foreground">{t("حالة البوابة", "Portal status")}</div>
              <div className="text-sm text-foreground mt-0.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground/60" /> {enabled ? t("مُفعّلة", "Enabled") : t("غير مُفعّلة", "Disabled")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────
function ActivityTab({ contactId: _contactId }: { contactId: string }) {
  const { t } = useLanguage();
  return (
    <Card className="border-border">
      <CardContent className="py-12 text-center">
        <Activity className="h-10 w-10 text-muted mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{t("سجل النشاط قيد البناء", "Activity log is under construction")}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{t("سيعرض جميع الإجراءات: من أنشأ · من عدّل · متى أُرسلت الفاتورة · متى دُفعت", "It will show all actions: who created · who edited · when the invoice was sent · when it was paid")}</p>
      </CardContent>
    </Card>
  );
}
