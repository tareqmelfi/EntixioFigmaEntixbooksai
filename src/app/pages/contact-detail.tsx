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
import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ArrowRight, Building2, Mail, Phone, Globe, MapPin, FileText, ShoppingBag,
  Receipt, Banknote, Loader2, Edit2, ExternalLink, AlertCircle, Plus, Send,
  CheckCircle2, Clock, XCircle, Hash, Briefcase, User, History, Files,
  KeyRound, Activity, Tag,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { api, ApiError, ContactSummary } from "../lib/api";

type Tab = "overview" | "operations" | "documents" | "portal" | "activity";

const TAB_LABELS: Record<Tab, string> = {
  overview: "نظرة عامة",
  operations: "المعاملات",
  documents: "المستندات",
  portal: "البوابة",
  activity: "سجل النشاط",
};

const TAB_ICONS: Record<Tab, any> = {
  overview: User,
  operations: Briefcase,
  documents: Files,
  portal: KeyRound,
  activity: Activity,
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    PAID:     { bg: "bg-green-50",  text: "text-green-700",  label: "مدفوعة" },
    SENT:     { bg: "bg-blue-50",   text: "text-blue-700",   label: "مرسلة" },
    PARTIAL:  { bg: "bg-amber-50",  text: "text-amber-700",  label: "جزئية" },
    OVERDUE:  { bg: "bg-red-50",    text: "text-red-700",    label: "متأخرة" },
    DRAFT:    { bg: "bg-gray-50",   text: "text-gray-700",   label: "مسودة" },
    UNPAID:   { bg: "bg-amber-50",  text: "text-amber-700",  label: "غير مدفوعة" },
    APPROVED: { bg: "bg-blue-50",   text: "text-blue-700",   label: "معتمدة" },
    ACCEPTED: { bg: "bg-green-50",  text: "text-green-700",  label: "مقبول" },
    REJECTED: { bg: "bg-red-50",    text: "text-red-700",    label: "مرفوض" },
    EXPIRED:  { bg: "bg-gray-100",  text: "text-gray-600",   label: "منتهي" },
    CANCELLED:{ bg: "bg-gray-100",  text: "text-gray-600",   label: "ملغاة" },
  };
  const m = map[status] || { bg: "bg-gray-50", text: "text-gray-700", label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-english ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function RoleBadges({ contact }: { contact: any }) {
  const roles: Array<{ key: string; label: string; color: string }> = [];
  if (contact.isCustomer) roles.push({ key: "c", label: "عميل", color: "bg-blue-100 text-blue-700" });
  if (contact.isSupplier) roles.push({ key: "s", label: "مورّد", color: "bg-amber-100 text-amber-700" });
  if (contact.isEmployee) roles.push({ key: "e", label: "موظف", color: "bg-purple-100 text-purple-700" });
  if (contact.isShareholder) roles.push({ key: "sh", label: "مساهم", color: "bg-pink-100 text-pink-700" });
  if (contact.isFreelancer) roles.push({ key: "f", label: "مستقل", color: "bg-cyan-100 text-cyan-700" });
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((r) => (
        <span key={r.key} className={`text-xs px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
      ))}
      {roles.length === 0 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">بدون دور</span>
      )}
    </div>
  );
}

export function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ContactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const s = await api.contacts.summary(id);
      setData(s);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل تحميل بيانات جهة الاتصال");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#1276E3]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link to="/app/contacts" className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#1276E3]">
          <ArrowRight className="h-4 w-4" /> العودة
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "تعذّر تحميل بيانات جهة الاتصال"}
        </div>
      </div>
    );
  }

  const { contact, totals } = data;
  const cur = contact.country === "SA" ? "SAR" : (contact.defaultCurrency || "SAR");
  const fmt = (n: number) => `${n.toLocaleString()} ${cur}`;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link to="/app/contacts" className="mt-1 text-[#6B7280] hover:text-[#1276E3]">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[#0B1B49] truncate" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                {contact.displayName}
              </h1>
              {contact.entityKind === "COMPANY" ? <Building2 className="h-4 w-4 text-[#6B7280]" /> : <User className="h-4 w-4 text-[#6B7280]" />}
              {contact.isForeign && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">جهة خارجية</span>
              )}
            </div>
            {contact.legalName && contact.legalName !== contact.displayName && (
              <p className="text-sm text-[#6B7280] mt-0.5">{contact.legalName}</p>
            )}
            <div className="mt-2"><RoleBadges contact={contact} /></div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => navigate(`/app/contacts?edit=${contact.id}`)}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#F4FCFF] transition flex items-center gap-1.5"
          >
            <Edit2 className="h-3.5 w-3.5" /> تعديل
          </button>
          <Link
            to={`/app/sales/invoices/new?contactId=${contact.id}`}
            className="px-3 py-1.5 rounded-lg bg-[#1276E3] text-white text-sm hover:bg-[#0F66C7] transition flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> فاتورة جديدة
          </Link>
        </div>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-xs text-[#6B7280] mb-1 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> الفواتير
            </div>
            <div className="font-english font-bold text-[#0B1B49]" style={{ fontSize: "1.15rem" }}>
              {totals.invoices.count}
            </div>
            <div className="text-xs text-[#9CA3AF] font-english mt-0.5">{totals.invoices.total.toLocaleString()} {cur}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-xs text-[#6B7280] mb-1 flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" /> فواتير الشراء
            </div>
            <div className="font-english font-bold text-[#0B1B49]" style={{ fontSize: "1.15rem" }}>
              {totals.bills.count}
            </div>
            <div className="text-xs text-[#9CA3AF] font-english mt-0.5">{totals.bills.total.toLocaleString()} {cur}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-xs text-[#6B7280] mb-1 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> سندات القبض
            </div>
            <div className="font-english font-bold text-green-700" style={{ fontSize: "1.15rem" }}>
              {totals.receipts.count}
            </div>
            <div className="text-xs text-[#9CA3AF] font-english mt-0.5">{totals.receipts.total.toLocaleString()} {cur}</div>
          </CardContent>
        </Card>
        <Card className={`border ${totals.balance >= 0 ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}`}>
          <CardContent className="p-4">
            <div className="text-xs text-[#6B7280] mb-1 flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5" /> الرصيد الصافي
            </div>
            <div className={`font-english font-bold ${totals.balance >= 0 ? "text-green-700" : "text-amber-700"}`} style={{ fontSize: "1.15rem" }}>
              {fmt(Math.abs(totals.balance))}
            </div>
            <div className="text-xs mt-0.5">
              {totals.balance > 0 ? <span className="text-green-700">يستحق لي</span> : totals.balance < 0 ? <span className="text-amber-700">أستحق له</span> : <span className="text-[#9CA3AF]">متعادل</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
            const Icon = TAB_ICONS[t];
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm flex items-center gap-1.5 border-b-2 transition shrink-0 ${
                  active ? "border-[#1276E3] text-[#1276E3]" : "border-transparent text-[#6B7280] hover:text-[#0B1B49]"
                }`}
                style={{ fontWeight: active ? 600 : 500 }}
              >
                <Icon className="h-4 w-4" /> {TAB_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab data={data} cur={cur} />}
      {tab === "operations" && <OperationsTab data={data} cur={cur} />}
      {tab === "documents" && <DocumentsTab contactId={contact.id} />}
      {tab === "portal" && <PortalTab contact={contact} />}
      {tab === "activity" && <ActivityTab contactId={contact.id} />}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────
function OverviewTab({ data, cur }: { data: ContactSummary; cur: string }) {
  const { contact, totals } = data;
  const recentInvoices = data.invoices.slice(0, 5);
  const recentBills = data.bills.slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left col · contact info */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "0.95rem", fontWeight: 600 }}>معلومات الاتصال</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {contact.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-[#9CA3AF] shrink-0 mt-0.5" />
                <a href={`mailto:${contact.email}`} className="text-[#1276E3] hover:underline break-all font-english">{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-[#9CA3AF] shrink-0 mt-0.5" />
                <a href={`tel:${contact.phone}`} className="text-[#0B1B49] hover:underline font-english">{contact.phone}</a>
              </div>
            )}
            {(contact.addressLine1 || contact.city) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#9CA3AF] shrink-0 mt-0.5" />
                <div className="text-[#374151]">
                  {contact.addressLine1 && <div>{contact.addressLine1}</div>}
                  {contact.addressLine2 && <div>{contact.addressLine2}</div>}
                  {(contact.city || contact.region) && <div>{[contact.city, contact.region].filter(Boolean).join(", ")}</div>}
                  {contact.postalCode && <div className="font-english">{contact.postalCode}</div>}
                  {contact.country && <div className="text-xs text-[#9CA3AF] font-english uppercase">{contact.country}</div>}
                </div>
              </div>
            )}
            {!contact.email && !contact.phone && !contact.addressLine1 && (
              <div className="text-xs text-[#9CA3AF] py-2">لا توجد معلومات اتصال · أضف من زر التعديل</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "0.95rem", fontWeight: 600 }}>الهوية الضريبية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="الرقم الضريبي" value={contact.vatNumber} mono />
            <Row label="السجل التجاري" value={contact.crNumber} mono />
            <Row label="رقم الهوية" value={(contact as any).nationalId} mono />
            <Row label="LEI" value={(contact as any).leiCode} mono />
            <Row label="النوع" value={contact.entityKind === "COMPANY" ? "شركة" : "فرد"} />
            <Row label="الدولة" value={contact.country?.toUpperCase()} mono />
            {(contact as any).withholdingTaxRate != null && (
              <Row label="ضريبة الاستقطاع" value={`${(contact as any).withholdingTaxRate}%`} mono />
            )}
          </CardContent>
        </Card>

        {(contact as any).tags && (
          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#0B1B49] flex items-center gap-1.5" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                <Tag className="h-4 w-4" /> الوسوم
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {String((contact as any).tags).split(",").map((t: string, i: number) => (
                <span key={i} className="text-xs px-2 py-1 rounded-full bg-[#F4FCFF] text-[#1276E3] border border-blue-100">
                  {t.trim()}
                </span>
              ))}
            </CardContent>
          </Card>
        )}

        {contact.notes && (
          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#0B1B49]" style={{ fontSize: "0.95rem", fontWeight: 600 }}>ملاحظات</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{contact.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right col · recent activity */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#0B1B49] flex items-center gap-1.5" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                <FileText className="h-4 w-4" /> آخر الفواتير
              </CardTitle>
              <span className="text-xs text-[#9CA3AF] font-english">
                مستحق: {totals.arOpen.toLocaleString()} {cur}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <EmptyMini icon={FileText} text="لا توجد فواتير" cta={{ to: `/app/sales/invoices/new?contactId=${contact.id}`, label: "+ أنشئ أول فاتورة" }} />
            ) : (
              <DocList
                rows={recentInvoices.map((i) => ({
                  id: i.id,
                  number: i.invoiceNumber,
                  date: i.issueDate,
                  total: Number(i.total),
                  paid: Number(i.amountPaid),
                  status: i.status,
                  href: `/app/sales/invoices/${i.id}`,
                  cur: i.currency,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#0B1B49] flex items-center gap-1.5" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                <ShoppingBag className="h-4 w-4" /> آخر فواتير الشراء
              </CardTitle>
              <span className="text-xs text-[#9CA3AF] font-english">
                مستحق: {totals.apOpen.toLocaleString()} {cur}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {recentBills.length === 0 ? (
              <EmptyMini icon={ShoppingBag} text="لا توجد فواتير شراء" cta={{ to: `/app/purchases/bills/new?contactId=${contact.id}`, label: "+ سجّل فاتورة شراء" }} />
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
      <span className="text-xs text-[#6B7280]">{label}</span>
      <span className={`text-sm text-[#374151] ${mono ? "font-english" : ""}`}>{value}</span>
    </div>
  );
}

function EmptyMini({ icon: Icon, text, cta }: { icon: any; text: string; cta?: { to: string; label: string } }) {
  return (
    <div className="text-center py-6">
      <Icon className="h-8 w-8 text-[#E5E7EB] mx-auto mb-2" />
      <p className="text-xs text-[#9CA3AF]">{text}</p>
      {cta && <Link to={cta.to} className="text-xs text-[#1276E3] hover:underline mt-2 inline-block">{cta.label}</Link>}
    </div>
  );
}

function DocList({ rows }: { rows: Array<{ id: string; number: string; date: string; total: number; paid: number; status: string; href: string; cur: string }> }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <Link key={r.id} to={r.href} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-[#F4FCFF] transition group">
          <div className="flex items-center gap-3 min-w-0">
            <Hash className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-english font-semibold text-[#0B1B49] group-hover:text-[#1276E3]">{r.number}</div>
              <div className="text-xs text-[#9CA3AF] font-english">{r.date.slice(0, 10)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusPill status={r.status} />
            <div className="text-end">
              <div className="text-sm font-english font-semibold text-[#0B1B49]">{r.total.toLocaleString()}</div>
              <div className="text-xs text-[#9CA3AF] font-english">{r.cur}</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-[#9CA3AF] group-hover:text-[#1276E3]" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Operations tab ────────────────────────────────────────────────────────
function OperationsTab({ data, cur }: { data: ContactSummary; cur: string }) {
  const { contact } = data;
  type Section = "invoices" | "bills" | "quotes" | "vouchers" | "expenses";
  const [section, setSection] = useState<Section>("invoices");

  const sections: Array<{ key: Section; label: string; count: number; total: number }> = [
    { key: "invoices", label: "فواتير المبيعات", count: data.totals.invoices.count, total: data.totals.invoices.total },
    { key: "bills", label: "فواتير الشراء", count: data.totals.bills.count, total: data.totals.bills.total },
    { key: "quotes", label: "عروض الأسعار", count: data.totals.quotes.count, total: data.totals.quotes.total },
    { key: "vouchers", label: "السندات", count: data.totals.receipts.count + data.totals.payments.count, total: data.totals.receipts.total + data.totals.payments.total },
    { key: "expenses", label: "المصروفات", count: data.expenses.length, total: data.expenses.reduce((s, e) => s + Number(e.total), 0) },
  ];

  const newLinks: Record<Section, string> = {
    invoices: `/app/sales/invoices/new?contactId=${contact.id}`,
    bills: `/app/purchases/bills/new?contactId=${contact.id}`,
    quotes: `/app/sales/quotes/new?contactId=${contact.id}`,
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
                ? "border-[#1276E3] bg-[#F4FCFF]"
                : "border-[#E5E7EB] hover:border-[#1276E3]/40"
            }`}
          >
            <div className="text-xs text-[#6B7280]">{s.label}</div>
            <div className="font-english font-bold text-[#0B1B49] mt-0.5" style={{ fontSize: "1rem" }}>{s.count}</div>
            <div className="text-xs text-[#9CA3AF] font-english">{s.total.toLocaleString()} {cur}</div>
          </button>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>
          {sections.find((s) => s.key === section)?.label}
        </h3>
        <Link
          to={newLinks[section]}
          className="px-3 py-1.5 rounded-lg bg-[#1276E3] text-white text-sm hover:bg-[#0F66C7] transition flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> إضافة جديد
        </Link>
      </div>

      {/* Section content · table */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-0">
          {section === "invoices" && <InvTable rows={data.invoices.map((i) => ({ id: i.id, number: i.invoiceNumber, date: i.issueDate, due: i.dueDate, total: Number(i.total), paid: Number(i.amountPaid), status: i.status, cur: i.currency, href: `/app/sales/invoices/${i.id}` }))} />}
          {section === "bills"    && <InvTable rows={data.bills.map((b) => ({ id: b.id, number: b.billNumber, date: b.issueDate, due: b.dueDate, total: Number(b.total), paid: Number(b.amountPaid), status: b.status, cur: b.currency, href: `/app/purchases/bills/${b.id}` }))} />}
          {section === "quotes"   && <InvTable rows={data.quotes.map((q) => ({ id: q.id, number: q.quoteNumber, date: q.issueDate, due: q.validUntil, total: Number(q.total), paid: 0, status: q.status, cur: q.currency, href: `/app/sales/quotes/${q.id}` }))} />}
          {section === "vouchers" && <VchTable rows={data.vouchers} />}
          {section === "expenses" && <ExpTable rows={data.expenses} />}
        </CardContent>
      </Card>
    </div>
  );
}

function InvTable({ rows }: { rows: Array<{ id: string; number: string; date: string; due: string | null; total: number; paid: number; status: string; cur: string; href: string }> }) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-[#9CA3AF]">لا توجد سجلات</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F9FAFB] text-[#6B7280]">
          <tr>
            <th className="text-start px-4 py-2.5 font-medium">رقم</th>
            <th className="text-start px-4 py-2.5 font-medium">تاريخ</th>
            <th className="text-start px-4 py-2.5 font-medium">استحقاق</th>
            <th className="text-end px-4 py-2.5 font-medium">إجمالي</th>
            <th className="text-end px-4 py-2.5 font-medium">مدفوع</th>
            <th className="text-end px-4 py-2.5 font-medium">متبقي</th>
            <th className="text-center px-4 py-2.5 font-medium">الحالة</th>
            <th className="px-2 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#F3F4F6] hover:bg-[#F4FCFF] transition">
              <td className="px-4 py-2.5">
                <Link to={r.href} className="font-english font-semibold text-[#1276E3] hover:underline">{r.number}</Link>
              </td>
              <td className="px-4 py-2.5 text-[#374151] font-english">{r.date.slice(0, 10)}</td>
              <td className="px-4 py-2.5 text-[#6B7280] font-english">{r.due?.slice(0, 10) || "—"}</td>
              <td className="px-4 py-2.5 text-end font-english font-semibold text-[#0B1B49]">{r.total.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-end font-english text-green-600">{r.paid.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-end font-english text-amber-600">{(r.total - r.paid).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-center"><StatusPill status={r.status} /></td>
              <td className="px-2 py-2.5"><Link to={r.href}><ExternalLink className="h-3.5 w-3.5 text-[#9CA3AF] hover:text-[#1276E3]" /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VchTable({ rows }: { rows: ContactSummary["vouchers"] }) {
  if (rows.length === 0) return <div className="py-12 text-center text-sm text-[#9CA3AF]">لا توجد سندات</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F9FAFB] text-[#6B7280]">
          <tr>
            <th className="text-start px-4 py-2.5 font-medium">رقم</th>
            <th className="text-start px-4 py-2.5 font-medium">النوع</th>
            <th className="text-start px-4 py-2.5 font-medium">التاريخ</th>
            <th className="text-end px-4 py-2.5 font-medium">المبلغ</th>
            <th className="text-start px-4 py-2.5 font-medium">طريقة الدفع</th>
            <th className="text-start px-4 py-2.5 font-medium">المرجع</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-t border-[#F3F4F6] hover:bg-[#F4FCFF] transition">
              <td className="px-4 py-2.5 font-english font-semibold text-[#0B1B49]">{v.number}</td>
              <td className="px-4 py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded ${v.type === "RECEIPT" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {v.type === "RECEIPT" ? "قبض" : "صرف"}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[#374151] font-english">{v.date.slice(0, 10)}</td>
              <td className={`px-4 py-2.5 text-end font-english font-semibold ${v.type === "RECEIPT" ? "text-green-700" : "text-amber-700"}`}>
                {Number(v.amount).toLocaleString()} {v.currency}
              </td>
              <td className="px-4 py-2.5 text-[#6B7280] text-xs">{v.paymentMethod || "—"}</td>
              <td className="px-4 py-2.5 text-[#6B7280] text-xs font-english">{v.reference || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpTable({ rows }: { rows: ContactSummary["expenses"] }) {
  if (rows.length === 0) return <div className="py-12 text-center text-sm text-[#9CA3AF]">لا توجد مصروفات</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F9FAFB] text-[#6B7280]">
          <tr>
            <th className="text-start px-4 py-2.5 font-medium">التاريخ</th>
            <th className="text-start px-4 py-2.5 font-medium">الفئة</th>
            <th className="text-start px-4 py-2.5 font-medium">الوصف</th>
            <th className="text-end px-4 py-2.5 font-medium">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-[#F3F4F6] hover:bg-[#F4FCFF] transition">
              <td className="px-4 py-2.5 text-[#374151] font-english">{e.date.slice(0, 10)}</td>
              <td className="px-4 py-2.5 text-[#6B7280] text-xs">{e.category || "غير مصنّف"}</td>
              <td className="px-4 py-2.5 text-[#374151] truncate max-w-md">{e.description || "—"}</td>
              <td className="px-4 py-2.5 text-end font-english font-semibold text-amber-700">{Number(e.total).toLocaleString()} {e.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────
function DocumentsTab({ contactId }: { contactId: string }) {
  return (
    <Card className="border-[#E5E7EB]">
      <CardContent className="py-12 text-center">
        <Files className="h-10 w-10 text-[#E5E7EB] mx-auto mb-3" />
        <p className="text-sm text-[#6B7280]">لم يتم رفع أي مستندات لهذه الجهة</p>
        <p className="text-xs text-[#9CA3AF] mt-1">العقود · بطاقات الضريبة · السجلات التجارية · ملفات الهوية</p>
        <Link
          to={`/app/files/upload?contactId=${contactId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1276E3] text-white text-sm mt-4 hover:bg-[#0F66C7] transition"
        >
          <Plus className="h-3.5 w-3.5" /> رفع مستند
        </Link>
      </CardContent>
    </Card>
  );
}

// ── Portal tab ────────────────────────────────────────────────────────────
function PortalTab({ contact }: { contact: any }) {
  const portalUrl = `${window.location.origin}/portal/${contact.id}`;
  return (
    <div className="space-y-4">
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-[#0B1B49] flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
            <KeyRound className="h-4 w-4" /> بوابة العميل
          </CardTitle>
          <CardDescription className="text-xs text-[#6B7280]">
            رابط مخصّص للعميل لعرض فواتيره · دفعها · تنزيلها · بدون حاجة لإنشاء حساب
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
            <code className="text-xs text-[#374151] font-english truncate flex-1">{portalUrl}</code>
            <button
              onClick={() => navigator.clipboard.writeText(portalUrl)}
              className="text-xs text-[#1276E3] hover:underline shrink-0"
            >
              نسخ
            </button>
          </div>

          {contact.email ? (
            <button
              className="w-full px-3 py-2 rounded-lg bg-[#1276E3] text-white text-sm hover:bg-[#0F66C7] transition flex items-center justify-center gap-2"
            >
              <Send className="h-3.5 w-3.5" /> إرسال دعوة إلى <span className="font-english">{contact.email}</span>
            </button>
          ) : (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" /> أضف بريداً إلكترونياً لإرسال دعوة البوابة
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg border border-[#E5E7EB]">
              <div className="text-xs text-[#6B7280]">آخر دخول</div>
              <div className="text-sm text-[#0B1B49] mt-0.5">لم يدخل بعد</div>
            </div>
            <div className="p-3 rounded-lg border border-[#E5E7EB]">
              <div className="text-xs text-[#6B7280]">حالة البوابة</div>
              <div className="text-sm text-[#0B1B49] mt-0.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#9CA3AF]" /> غير مُفعّل
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
  return (
    <Card className="border-[#E5E7EB]">
      <CardContent className="py-12 text-center">
        <Activity className="h-10 w-10 text-[#E5E7EB] mx-auto mb-3" />
        <p className="text-sm text-[#6B7280]">سجل النشاط قيد البناء</p>
        <p className="text-xs text-[#9CA3AF] mt-1">سيعرض جميع الإجراءات: من أنشأ · من عدّل · متى أُرسلت الفاتورة · متى دُفعت</p>
      </CardContent>
    </Card>
  );
}
