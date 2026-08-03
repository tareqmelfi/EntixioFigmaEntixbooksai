import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import {
  FileText,
  Download,
  Printer,
  CreditCard,
  LogOut,
  Eye,
  Building2,
  User,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { EntixWordmark } from "../components/entix-brand";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type PortalTab = "home" | "invoices" | "statement" | "documents";

type PortalInvoice = {
  id: string;
  number: string;
  date: string;
  dueDate: string | null;
  currency: string;
  total: number;
  paid: number;
  remaining: number;
  status: string;
  paymentLinkUrl?: string | null;
};

type PortalStatementRow = {
  date: string;
  description: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
};

type PortalDocument = { id: string; name: string; type: string; date: string };

const STATUS_MAP: Record<string, { ar: string; en: string }> = {
  PAID: { ar: "مدفوعة", en: "Paid" },
  PARTIAL: { ar: "مدفوعة جزئياً", en: "Partially paid" },
  SENT: { ar: "مرسلة", en: "Sent" },
  OVERDUE: { ar: "متأخرة", en: "Overdue" },
  DRAFT: { ar: "مسودة", en: "Draft" },
  CANCELLED: { ar: "ملغاة", en: "Cancelled" },
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    PAID: "bg-[#DCFCE7] text-[#166534]",
    PARTIAL: "bg-[#FEF3C7] text-[#92400E]",
    SENT: "bg-[#EFF6FF] text-[#1E40AF]",
    OVERDUE: "bg-[#FEE2E2] text-[#991B1B]",
    DRAFT: "bg-muted/50 text-muted-foreground",
    CANCELLED: "bg-gray-100 text-gray-600",
  };
  return map[status] || "bg-muted/50 text-muted-foreground";
};

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function PortalHome() {
  const { t } = useLanguage();
  const { token: routeToken } = useParams<{ token?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusLabel = (status: string) => {
    const entry = STATUS_MAP[status];
    return entry ? t(entry.ar, entry.en) : status;
  };

  const [activeTab, setActiveTab] = useState<PortalTab>("home");
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalToken, setPortalToken] = useState("");

  const [profile, setProfile] = useState<any | null>(null);
  const [portalInvoices, setPortalInvoices] = useState<PortalInvoice[]>([]);
  const [portalStatements, setPortalStatements] = useState<PortalStatementRow[]>([]);
  const [portalDocuments, setPortalDocuments] = useState<PortalDocument[]>([]);
  const [payBusyFor, setPayBusyFor] = useState<string | null>(null);

  useEffect(() => {
    const tokenFromQuery = searchParams.get("token") || "";
    const tokenFromRoute = routeToken || "";
    const token = tokenFromQuery || tokenFromRoute;

    if (!token) {
      setError(t("رابط البوابة غير صالح أو منتهي", "Portal link is invalid or expired"));
      setLoading(false);
      return;
    }

    setPortalToken(token);
    if (!tokenFromQuery && tokenFromRoute) {
      setSearchParams({ token: tokenFromRoute }, { replace: true });
    }
  }, [routeToken, searchParams, setSearchParams]);

  const loadPortal = useCallback(async () => {
    if (!portalToken) return;
    setLoading(true);
    setError(null);
    try {
      const [me, invoices, statement, documents] = await Promise.all([
        api.portal.me(portalToken),
        api.portal.invoices(portalToken),
        api.portal.statement(portalToken),
        api.portal.documents(portalToken),
      ]);
      setProfile(me);
      setPortalInvoices(invoices.items || []);
      setPortalStatements(statement.items || []);
      setPortalDocuments(documents.items || []);
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : t("تعذر تحميل بيانات البوابة", "Failed to load portal data");
      setError(msg === "invalid_token" ? t("رابط البوابة غير صالح أو منتهي", "Portal link is invalid or expired") : msg);
    } finally {
      setLoading(false);
    }
  }, [portalToken]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const currency = profile?.org?.baseCurrency || portalInvoices[0]?.currency || "SAR";

  const totalInvoices = portalInvoices.length;
  const totalPaid = portalInvoices.reduce((s, i) => s + Math.max(i.paid || 0, 0), 0);
  const totalPending = portalInvoices.reduce((s, i) => s + Math.max(i.remaining || 0, 0), 0);
  const totalOverdue = portalInvoices
    .filter((i) => i.status === "OVERDUE")
    .reduce((s, i) => s + Math.max(i.remaining || 0, 0), 0);

  const viewingInvoice = selectedInvoice ? portalInvoices.find((i) => i.id === selectedInvoice) : null;

  const currentBalance = useMemo(() => {
    if (portalStatements.length === 0) return 0;
    return Number(portalStatements[portalStatements.length - 1]?.balance || 0);
  }, [portalStatements]);

  const handlePayNow = async (invoice: PortalInvoice) => {
    if (!portalToken) return;
    if (invoice.paymentLinkUrl) {
      openExternal(invoice.paymentLinkUrl);
      return;
    }
    setPayBusyFor(invoice.id);
    try {
      const r = await api.portal.payInvoice(portalToken, invoice.id);
      if (r?.url) openExternal(r.url);
    } catch {
      // keep page stable
    } finally {
      setPayBusyFor(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div className="mt-3 text-sm text-muted-foreground">{t("جارٍ تحميل البوابة...", "Loading portal...")}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4" dir="rtl">
        <Card className="border-border w-full max-w-lg">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-amber-600" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">{t("تعذر فتح بوابة العميل", "Unable to open the customer portal")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted" dir="rtl">
      <header className="bg-white border-b border-border px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <EntixWordmark size={26} />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#0B1B49] text-white text-xs" style={{ fontWeight: 600 }}>
                  {(profile?.contact?.displayName || t("عميل", "Customer")).slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="text-end">
                <div className="text-xs text-foreground" style={{ fontWeight: 500 }}>{profile?.contact?.displayName || t("عميل", "Customer")}</div>
                <div className="text-[10px] text-muted-foreground font-english">{profile?.contact?.email || "—"}</div>
              </div>
            </div>
            <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#EF4444] hover:bg-[#FEE2E2] transition-colors">
              <LogOut className="h-3.5 w-3.5" /> {t("خروج", "Sign out")}
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-border px-6 py-2">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("بوابة:", "Portal:")}</span>
          <button className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-white" style={{ fontWeight: 600 }}>
            <Building2 className="h-3.5 w-3.5" /> {profile?.org?.name || "ENTIX"}
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-[#E5E7EB] transition-colors" style={{ fontWeight: 600 }}>
            <User className="h-3.5 w-3.5" /> {t("شخصي", "Personal")}
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-border px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {([
            { key: "home" as PortalTab, label: t("الرئيسية", "Home") },
            { key: "invoices" as PortalTab, label: t("الفواتير", "Invoices") },
            { key: "statement" as PortalTab, label: t("كشف الحساب", "Statement") },
            { key: "documents" as PortalTab, label: t("المستندات", "Documents") },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedInvoice(null); }}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${activeTab === tab.key ? "border-[#1276E3] text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              style={{ fontWeight: 500 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {activeTab === "home" && !selectedInvoice && (
          <>
            <div>
              <h2 className="text-foreground" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{t("مرحباً", "Hello")} {profile?.contact?.displayName || t("عميل", "Customer")} 👋</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t("بوابة:", "Portal:")} {profile?.org?.name || "ENTIX"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card className="border-border"><CardContent className="pt-4 pb-3 px-4 text-center"><div className="text-foreground font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalInvoices}</div><p className="text-xs text-muted-foreground mt-0.5">{t("إجمالي الفواتير", "Total invoices")}</p></CardContent></Card>
              <Card className="border-border relative overflow-hidden"><div className="absolute top-0 start-0 end-0 h-0.5 bg-[#22C55E]" /><CardContent className="pt-4 pb-3 px-4 text-center"><div dir="ltr" className="flex items-baseline justify-center gap-1"><span className="text-[#22C55E] font-english" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{totalPaid.toLocaleString()}</span><span className="text-xs text-muted-foreground font-english">{currency}</span></div><p className="text-xs text-muted-foreground mt-0.5">{t("مدفوع", "Paid")} ✅</p></CardContent></Card>
              <Card className="border-border relative overflow-hidden"><div className="absolute top-0 start-0 end-0 h-0.5 bg-[#F59E0B]" /><CardContent className="pt-4 pb-3 px-4 text-center"><div dir="ltr" className="flex items-baseline justify-center gap-1"><span className="text-[#F59E0B] font-english" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{totalPending.toLocaleString()}</span><span className="text-xs text-muted-foreground font-english">{currency}</span></div><p className="text-xs text-muted-foreground mt-0.5">{t("متبقي", "Outstanding")} ⏳</p></CardContent></Card>
              <Card className="border-border relative overflow-hidden"><div className="absolute top-0 start-0 end-0 h-0.5 bg-[#EF4444]" /><CardContent className="pt-4 pb-3 px-4 text-center"><div dir="ltr" className="flex items-baseline justify-center gap-1"><span className="text-[#EF4444] font-english" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{totalOverdue.toLocaleString()}</span><span className="text-xs text-muted-foreground font-english">{currency}</span></div><p className="text-xs text-muted-foreground mt-0.5">{t("متأخر", "Overdue")} 🔴</p></CardContent></Card>
            </div>
          </>
        )}

        {selectedInvoice && viewingInvoice && (
          <div className="space-y-5">
            <button onClick={() => setSelectedInvoice(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4 rotate-180" /> {t("العودة", "Back")}
            </button>

            <Card className="border-border">
              <CardContent className="pt-6 pb-5">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-foreground font-english" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{viewingInvoice.number}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5 font-english">{viewingInvoice.date}</p>
                  </div>
                  <span className={`inline-flex rounded-md px-3 py-1 text-xs ${statusBadge(viewingInvoice.status)}`} style={{ fontWeight: 600 }}>{statusLabel(viewingInvoice.status)}</span>
                </div>

                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5">
                    <div className="flex justify-between text-sm text-muted-foreground"><span>{t("الإجمالي", "Total")}</span><span dir="ltr" className="font-english">{currency} {viewingInvoice.total.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm text-muted-foreground"><span>{t("المدفوع", "Paid")}</span><span dir="ltr" className="font-english">{currency} {viewingInvoice.paid.toLocaleString()}</span></div>
                    <div className="flex justify-between pt-2 border-t border-border"><span className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("المتبقي", "Remaining")}</span><span dir="ltr" className="font-english text-foreground" style={{ fontWeight: 700 }}>{currency} {viewingInvoice.remaining.toLocaleString()}</span></div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
                  {viewingInvoice.remaining > 0 && (
                    <button
                      onClick={() => handlePayNow(viewingInvoice)}
                      disabled={payBusyFor === viewingInvoice.id}
                      className="rounded-lg bg-[#22C55E] px-5 py-2.5 text-sm text-white hover:bg-[#16A34A] transition-colors disabled:opacity-60"
                      style={{ fontWeight: 600 }}
                    >
                      <CreditCard className="h-4 w-4 inline-block me-1.5" />
                      {payBusyFor === viewingInvoice.id ? t("جارٍ التحضير...", "Preparing...") : t("ادفع الآن", "Pay now")}
                    </button>
                  )}
                  <button className="rounded-lg border border-[#0B1B49] px-4 py-2.5 text-sm text-foreground hover:bg-[#ECEEF5] transition-colors" style={{ fontWeight: 500 }}>
                    <Download className="h-4 w-4 inline-block me-1.5" />{t("تحميل PDF", "Download PDF")}
                  </button>
                  <button className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors" style={{ fontWeight: 500 }}>
                    <Printer className="h-4 w-4 inline-block me-1.5" />{t("طباعة", "Print")}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "invoices" && !selectedInvoice && (
          <Card className="border-border">
            <CardHeader><CardTitle className="text-foreground" style={{ fontSize: "1rem" }}>{t("جميع الفواتير", "All invoices")}</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {[t("الرقم", "Number"), t("التاريخ", "Date"), t("الاستحقاق", "Due date"), t("المبلغ", "Amount"), t("المتبقي", "Remaining"), t("الحالة", "Status"), ""].map(h => (
                      <th key={h} className="pb-3 pe-3 text-start text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portalInvoices.map(inv => (
                    <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv.id)}>
                      <td className="py-3 pe-3 text-sm font-english text-primary" style={{ fontWeight: 600 }}>{inv.number}</td>
                      <td className="py-3 pe-3 text-sm font-english text-muted-foreground">{inv.date}</td>
                      <td className="py-3 pe-3 text-sm font-english text-muted-foreground">{inv.dueDate || "—"}</td>
                      <td className="py-3 pe-3"><span dir="ltr" className="font-english text-sm text-foreground" style={{ fontWeight: 600 }}>{currency} {inv.total.toLocaleString()}</span></td>
                      <td className="py-3 pe-3"><span dir="ltr" className="font-english text-sm text-amber-700" style={{ fontWeight: 600 }}>{currency} {inv.remaining.toLocaleString()}</span></td>
                      <td className="py-3 pe-3"><span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] ${statusBadge(inv.status)}`} style={{ fontWeight: 600 }}>{statusLabel(inv.status)}</span></td>
                      <td className="py-3"><Eye className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {activeTab === "statement" && (
          <Card className="border-border">
            <CardHeader><CardTitle className="text-foreground" style={{ fontSize: "1rem" }}>{t("كشف الحساب", "Account Statement")}</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {[t("التاريخ", "Date"), t("الوصف", "Description"), t("المرجع", "Reference"), t("مدين", "Debit"), t("دائن", "Credit"), t("الرصيد", "Balance")].map(h => (
                      <th key={h} className="pb-3 pe-3 text-start text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portalStatements.map((s, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted">
                      <td className="py-3 pe-3 text-sm font-english text-muted-foreground">{String(s.date).slice(0, 10)}</td>
                      <td className="py-3 pe-3 text-sm text-foreground/80">{s.description}</td>
                      <td className="py-3 pe-3 text-sm font-english text-primary" style={{ fontWeight: 500 }}>{s.ref}</td>
                      <td className="py-3 pe-3 text-sm font-english text-foreground" style={{ fontWeight: 500 }}>{s.debit > 0 ? s.debit.toLocaleString() : "—"}</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#349FC4]" style={{ fontWeight: 500 }}>{s.credit > 0 ? s.credit.toLocaleString() : "—"}</td>
                      <td className="py-3 pe-3 text-sm font-english text-foreground" style={{ fontWeight: 600 }}>{s.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-3 border-t border-border text-end">
                <span className="text-sm text-muted-foreground">{t("الرصيد الحالي:", "Current balance:")} </span>
                <span dir="ltr" className="font-english text-foreground" style={{ fontWeight: 700 }}>{currency} {currentBalance.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "documents" && (
          <Card className="border-border">
            <CardHeader><CardTitle className="text-foreground" style={{ fontSize: "1rem" }}>{t("المستندات المشتركة", "Shared documents")}</CardTitle></CardHeader>
            <CardContent>
              {portalDocuments.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">{t("لا توجد مستندات حالياً", "No documents at the moment")}</div>
              ) : portalDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 hover:bg-muted transition-colors px-2 rounded-md">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-foreground/80" style={{ fontWeight: 500 }}>{doc.name}</div>
                      <div className="text-xs text-muted-foreground/60 font-english">{String(doc.date).slice(0, 10)}</div>
                    </div>
                  </div>
                  <button className="rounded-md p-1.5 text-primary hover:bg-[#EFF6FF] transition-colors"><Download className="h-4 w-4" /></button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="text-center py-6 border-t border-border mt-12">
        <span className="text-xs text-muted-foreground/60">{t("مقدم من", "Powered by")} </span>
        <span className="text-xs text-muted-foreground/60 font-english" style={{ fontWeight: 600 }}>ENTIX.IO</span>
      </div>
    </div>
  );
}
