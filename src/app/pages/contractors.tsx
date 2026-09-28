import { displayLocale, displayDigits } from "../lib/number-display";
/**
 * Contractors list — المقاولون والفريلانسر (different from company suppliers:
 * no AP cycle · direct payments · hours tracked per project · peer benchmarks).
 * Rows open the contractor page. New → /app/contractors/new
 */
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, HardHat, Loader2, Plus, Star } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { EmptyState, InlineAlert, LedgerFigure, Metric, MetricStrip, PageHeader, StatusBadge } from "../components/product";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const money = (v: any) => Number(v || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hrs = (v: any) => Number(v || 0).toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 1 });

const KIND_LABELS: Record<string, { ar: string; en: string; tone: "info" | "warning" | "neutral" | "success" }> = {
  FREELANCER: { ar: "فريلانسر", en: "Freelancer", tone: "info" },
  CONTRACTOR: { ar: "مقاول", en: "Contractor", tone: "warning" },
  AGENCY: { ar: "وكالة", en: "Agency", tone: "neutral" },
};

export function Contractors() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [peers, setPeers] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [auditBusy, setAuditBusy] = useState(false);
  const [identityAudit, setIdentityAudit] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<{ linked: number; review: Array<{ id: string; name: string }> } | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.contractors.list();
      setItems(d.items);
      setPeers(d.peers);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const syncContacts = async () => {
    setSyncing(true); setError(null);
    try { setSyncResult(await api.contractors.syncContacts()); await refresh(); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("تعذرت المزامنة", "Sync failed")); }
    finally { setSyncing(false); }
  };

  const filtered = items.filter((x) => !kindFilter || x.kind === kindFilter);
  const totalOutstanding = items.reduce((s, x) => s + Number(x.stats?.outstanding || 0), 0);
  const totalPaid = items.reduce((s, x) => s + Number(x.stats?.totalPaid || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("الموظفون والرواتب", "Employees & payroll")}
        title={t("المقاولون والفريلانسر", "Contractors & Freelancers")}
        description={t("جهة اتصال موحدة · تعاقد وأسعار وساعات لكل مشروع · مدفوعات مرتبطة", "One shared contact · engagement, rates and hours per project · linked payments")}
        actions={<Button onClick={() => navigate("/app/contractors/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("مقاول جديد", "New contractor")}</Button>}
      />

      <MetricStrip>
        <Metric label={t("المقاولون", "Contractors")} value={String(items.length)} />
        <Metric label={t("مدفوعات إجمالية", "Total paid")} value={<LedgerFigure value={totalPaid} />} />
        <Metric tone="warning" label={t("مستحق لهم", "Outstanding")} value={<LedgerFigure value={totalOutstanding} />} />
        <Metric label={t("متوسط سعر الساعة (السوق الداخلي)", "Avg hourly rate (peer)")} value={peers?.avgRate != null ? <LedgerFigure value={Number(peers.avgRate)} /> : "—"} />
      </MetricStrip>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" disabled={auditBusy} onClick={async () => {
          setAuditBusy(true); setError(null);
          try { setIdentityAudit(await api.contractors.identityAudit()); }
          catch (e: any) { setError(e instanceof ApiError ? e.message : t("تعذر الفحص", "Audit failed")); }
          finally { setAuditBusy(false); }
        }}>{t("فحص روابط الاتصال دون تعديل", "Audit contact links without changes")}</Button>
        <Button variant="outline" onClick={syncContacts} disabled={syncing}>{syncing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t("مزامنة السجلات السابقة مع الاتصال", "Sync older records with contacts")}</Button>
        <button onClick={() => setKindFilter("")} aria-pressed={!kindFilter} className={`rounded-full px-3.5 py-[7px] text-[13px] leading-5 transition-colors ${!kindFilter ? "bg-foreground text-background" : "border border-border bg-card text-content-secondary hover:border-border-strong"}`}>{t("الكل", "All")}</button>
        {Object.entries(KIND_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setKindFilter(k)} aria-pressed={kindFilter === k} className={`rounded-full px-3.5 py-[7px] text-[13px] leading-5 transition-colors ${kindFilter === k ? "bg-foreground text-background" : "border border-border bg-card text-content-secondary hover:border-border-strong"}`}>{t(v.ar, v.en)}</button>
        ))}
      </div>

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}
      {identityAudit && <section className="space-y-3 rounded-lg border border-border p-4" data-testid="contractor-identity-audit">
        <h2 className="font-semibold">{t("نتيجة الفحص — لم تُعدّل أي بيانات", "Audit result — no data changed")}</h2>
        <p className="text-sm">{t("جهات الاتصال", "Contacts")}: {identityAudit.counts.contacts} · {t("المقاولون", "Contractors")}: {identityAudit.counts.contractors} · {t("ملاحظات للمراجعة", "Findings to review")}: {identityAudit.counts.findings}</p>
        <Button variant="outline" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(identityAudit, null, 2)], { type: "application/json" }));
          const link = document.createElement("a"); link.href = url; link.download = "entix-contact-link-audit.json"; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }}>{t("تنزيل تقرير الفحص", "Download audit report")}</Button>
        {identityAudit.findings.map((finding: any, index: number) => <div key={index} className="border-t border-border pt-2 text-sm">
          <span>{({ unlinked: t("مقاول بلا جهة اتصال", "Contractor without contact"), missing_or_foreign_contact: t("رابط مفقود أو خارج الشركة", "Missing or out-of-company link"), identity_drift: t("اختلاف في بيانات الهوية", "Identity fields differ"), inactive_link_occupant: t("ملف موقوف يحتفظ بالرابط", "Inactive profile retains the link"), multiple_profiles: t("أكثر من ملف للجهة", "Multiple profiles for the contact"), role_without_profile: t("دور مقاول دون ملف", "Contractor role without a profile") } as Record<string, string>)[finding.issue] || finding.issue}</span>
          {finding.contractorId && <Link className="ms-2 text-primary underline" to={`/app/contractors/${finding.contractorId}`}>{finding.code || t("فتح المقاول", "Open contractor")}</Link>}
          {finding.contactId && <Link className="ms-2 text-primary underline" to={`/app/contacts/${finding.contactId}`}>{t("فتح جهة الاتصال", "Open contact")}</Link>}
        </div>)}
      </section>}
      {syncResult && <InlineAlert>
        <p>{t("تم ربط السجلات:", "Records linked:")} {syncResult.linked}</p>
        {syncResult.review.length > 0 && <p>{t("اختر جهة الاتصال لهذه الملفات من التعديل؛ لم تُدمج الأسماء المتشابهة تلقائيًا:", "Select a contact in Edit for these profiles; similar names were not merged automatically:")}</p>}
        {syncResult.review.map(x => <Link key={x.id} to={`/app/contractors/${x.id}`} className="block text-primary underline">{x.name}</Link>)}
      </InlineAlert>}

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{t("السجل", "Register")} · <span className="font-english tabular-nums">{filtered.length}</span></h2>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         filtered.length === 0 ? (
          <EmptyState
            icon={<HardHat className="h-10 w-10" strokeWidth={1.5} />}
            title={t("لا يوجد مقاولون بعد", "No contractors yet")}
            description={t("سجّل فريلانسر أو مقاول أو وكالة، أشركه في مشروع، سجّل ساعاته، وادفع له مباشرة", "Register a freelancer, contractor or agency — engage on a project, log hours, pay directly")}
            action={<Button onClick={() => navigate("/app/contractors/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("مقاول جديد", "New contractor")}</Button>}
          />
        ) : (
          <div className="ledger-table overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed text-sm">
              <colgroup>
                <col style={{ width: "130px" }} />{/* الرمز · mono */}
                <col />{/* المقاول · flexible */}
                <col style={{ width: "110px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "90px" }} />
                <col style={{ width: "44px" }} />
              </colgroup>
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
                <th className="py-3 px-4 text-start font-medium">{t("الرمز", "Code")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("المقاول", "Contractor")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("النوع", "Kind")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("الساعات", "Hours")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("متوسط السعر", "Avg rate")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("مقابل الأقران", "vs peers")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("مستحق", "Outstanding")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("التقييم", "Rating")}</th>
                <th className="py-3 px-4"></th>
              </tr></thead>
              <tbody>
                {filtered.map((x) => {
                  const kind = KIND_LABELS[x.kind] || KIND_LABELS.FREELANCER;
                  const avgRate = x.stats?.avgRate;
                  const peerRate = peers?.avgRate;
                  const vsPeers = avgRate != null && peerRate != null && peerRate > 0 ? ((avgRate - peerRate) / peerRate) * 100 : null;
                  return (
                    <tr key={x.id} onClick={() => navigate(`/app/contractors/${x.id}`)} className={`border-b border-border hover:bg-surface-hover cursor-pointer ${!x.isActive ? "opacity-50" : ""}`} title={t("فتح المقاول", "Open contractor")}>
                      <td className="py-3 px-4"><Link to={`/app/contractors/${x.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-code text-sm font-semibold text-foreground hover:underline underline-offset-4" dir="ltr" title={x.code}>{x.code}</Link></td>
                      <td className="py-3 px-4">
                        <div className="truncate text-sm text-foreground" style={{ fontWeight: 600 }} title={x.name}><bdi dir="auto">{x.name}</bdi> {!x.isActive && <span className="text-[10px] text-muted-foreground">({t("موقوف", "inactive")})</span>}</div>
                        <div className="truncate text-xs text-muted-foreground"><bdi dir="auto">{x.specialty || "—"}</bdi> · <span className="font-english tabular-nums">{x.stats?.projectsCount || 0}</span> {t("مشروع", "projects")}</div>
                      </td>
                      <td className="py-3 px-4"><StatusBadge tone={kind.tone}>{t(kind.ar, kind.en)}</StatusBadge></td>
                      <td className="py-3 px-4 text-end font-english text-foreground tabular-nums" dir="ltr">{hrs(x.stats?.totalHours)}</td>
                      <td className="py-3 px-4 text-end font-english text-foreground tabular-nums whitespace-nowrap" dir="ltr">{avgRate != null ? money(avgRate) : "—"}</td>
                      <td className="py-3 px-4 text-end font-english text-xs tabular-nums" dir="ltr">
                        {vsPeers == null ? "—" : (
                          <span className={vsPeers > 5 ? "text-warning" : vsPeers < -5 ? "text-success" : "text-muted-foreground"}>
                            {vsPeers > 0 ? "+" : ""}{displayDigits(vsPeers.toFixed(0))}%
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-end font-english tabular-nums whitespace-nowrap ${Number(x.stats?.outstanding || 0) > 0 ? "text-warning" : "text-muted-foreground"}`} style={{ fontWeight: 600 }} dir="ltr">{money(x.stats?.outstanding)}</td>
                      <td className="py-3 px-4">
                        {x.rating != null ? (
                          <span className="inline-flex items-center gap-0.5 text-warning text-xs font-english"><Star className="h-3 w-3 fill-current" />{displayDigits(Number(x.rating).toFixed(1))}</span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4 ltr:rotate-180" strokeWidth={1.75} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
