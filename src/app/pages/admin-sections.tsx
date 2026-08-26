/**
 * Admin Console v2 · Z2.2 section pages (2026-08-26)
 *   /admin/subscriptions  unified table across every company + MRR by currency
 *   /admin/plans          plan catalogue (activate/deactivate · names) — prices live on Stripe
 *   /admin/audit          AdminAudit trail with filters + CSV
 * No dialogs (UX-1) · inline edits · toast feedback.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CreditCard, Download, Loader2, RefreshCw, ScrollText, Search, Tags, Crown, Ban } from "lucide-react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, API_BASE_URL, type AdminAuditRow, type AdminPlanRecord, type AdminSubscriptionsPayload } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB") : "—");
const money = (cents: number, cur: string) => `${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

function StatusPill({ status, lifetime }: { status: string; lifetime?: boolean }) {
  const cls = lifetime ? "bg-[#0B1B49] text-white" : status === "ACTIVE" ? "bg-success-subtle text-success" : status === "TRIALING" ? "bg-primary/10 text-primary" : status === "PAST_DUE" ? "bg-warning-subtle text-warning" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{lifetime ? <Crown className="h-3 w-3" /> : null}{lifetime ? "LIFETIME" : status}</span>;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────
export function AdminSubscriptions() {
  const { t, language } = useLanguage();
  const { toasts, dismiss } = useToasts();
  const [data, setData] = useState<AdminSubscriptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.admin.subscriptions({ q: q || undefined, status: status || undefined, country: country || undefined })); }
    catch (e) { setError(e instanceof ApiError ? e.message : t("تعذر التحميل", "Could not load")); }
    finally { setLoading(false); }
  }, [q, status, country, t]);
  useEffect(() => { const h = setTimeout(() => { void load(); }, 250); return () => clearTimeout(h); }, [load]);

  const statuses = useMemo(() => Object.keys(data?.byStatus || {}), [data]);

  return (
    <div className="space-y-5 max-w-7xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.6rem", fontWeight: 700 }}><CreditCard className="h-5 w-5 text-primary" />{t("الاشتراكات", "Subscriptions")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("كل الشركات في جدول واحد · MRR يحتسب المدفوع النشط فقط (لا المجاملات ولا Lifetime)", "Every company in one table · MRR counts paying active rows only (no comps · no lifetime)")}</p>
        </div>
        <Button variant="outline" className="border-border" onClick={() => void load()} disabled={loading}><RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(data?.mrrCents || {}).map(([cur, cents]) => (
          <Card key={cur} className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">MRR · {cur}</div><div className="font-english text-xl text-foreground" dir="ltr" style={{ fontWeight: 700 }}>{money(cents, cur)}</div></CardContent></Card>
        ))}
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("الإجمالي", "Total")}</div><div className="font-english text-xl text-foreground" style={{ fontWeight: 700 }}>{data?.total ?? "—"}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Lifetime</div><div className="font-english text-xl text-foreground" style={{ fontWeight: 700 }}>{data?.lifetime ?? "—"}</div></CardContent></Card>
        {statuses.slice(0, 2).map((s) => (
          <Card key={s} className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{s}</div><div className="font-english text-xl text-foreground" style={{ fontWeight: 700 }}>{data?.byStatus[s]}</div></CardContent></Card>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]"><Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث باسم الشركة", "Search by company")} className="ps-8 h-9" /></div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-white px-2 text-sm"><option value="">{t("كل الحالات", "All statuses")}</option>{["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "EXPIRED", "INCOMPLETE"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="h-9 rounded-md border border-border bg-white px-2 text-sm"><option value="">{t("كل الدول", "All countries")}</option><option value="SA">SA</option><option value="US">US</option></select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {error && <div className="m-4 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
          {loading && !data ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-start">{t("الشركة", "Company")}</th>
                <th className="px-3 py-2 text-start">{t("المالك", "Owner")}</th>
                <th className="px-3 py-2 text-start">{t("الباقة", "Plan")}</th>
                <th className="px-3 py-2 text-start">{t("الحالة", "Status")}</th>
                <th className="px-3 py-2 text-start">{t("المصدر", "Source")}</th>
                <th className="px-3 py-2 text-start">{t("نهاية الفترة", "Period end")}</th>
                <th className="px-3 py-2 text-end">MRR</th>
              </tr></thead>
              <tbody>
                {(data?.items || []).map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-primary/5">
                    <td className="px-3 py-2"><Link to={`/admin/orgs/${r.orgId}`} className="text-foreground hover:text-primary" style={{ fontWeight: 600 }}>{r.orgName}</Link><div className="text-[11px] text-muted-foreground font-english" dir="ltr">{r.country} · {r.currency}{r.suspended ? <span className="ms-1 inline-flex items-center gap-0.5 text-warning"><Ban className="h-3 w-3" />{t("موقوفة", "suspended")}</span> : null}</div></td>
                    <td className="px-3 py-2 font-english text-xs" dir="ltr">{r.owner || "—"}</td>
                    <td className="px-3 py-2">{language === "ar" ? (r.plan.nameAr || r.plan.name) : r.plan.name}<div className="text-[11px] text-muted-foreground font-english" dir="ltr">{r.plan.tier} · {r.plan.interval}</div></td>
                    <td className="px-3 py-2"><StatusPill status={r.status} lifetime={r.lifetime} />{r.cancelAtPeriodEnd ? <div className="text-[11px] text-warning">{t("يُلغى نهاية الفترة", "cancels at period end")}</div> : null}</td>
                    <td className="px-3 py-2 text-xs font-english" dir="ltr">{r.source}{r.stripeSubscriptionId ? <div className="text-[10px] text-muted-foreground">{r.stripeSubscriptionId.slice(0, 12)}…</div> : null}</td>
                    <td className="px-3 py-2 font-english text-xs" dir="ltr">{r.lifetime ? "∞" : fmtDate(r.currentPeriodEnd || r.trialEndsAt)}</td>
                    <td className="px-3 py-2 text-end font-english" dir="ltr">{r.mrrCents ? money(r.mrrCents, r.currency) : "—"}</td>
                  </tr>
                ))}
                {data && data.items.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">{t("لا اشتراكات مطابقة", "No matching subscriptions")}</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Plans ─────────────────────────────────────────────────────────────────────
export function AdminPlans() {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<AdminPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string; nameAr: string } | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setItems((await api.admin.plans()).items); } catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذر التحميل", "Could not load")); } finally { setLoading(false); } }, [push, t]);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (p: AdminPlanRecord) => {
    setBusy(p.id);
    try { await api.admin.updatePlan(p.id, { isActive: !p.isActive }); push("success", t("حُفظ", "Saved")); await load(); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed")); } finally { setBusy(null); }
  };
  const saveNames = async () => {
    if (!edit) return;
    setBusy(edit.id);
    try { await api.admin.updatePlan(edit.id, { name: edit.name.trim(), nameAr: edit.nameAr.trim() || null }); push("success", t("حُفظ", "Saved")); setEdit(null); await load(); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed")); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-5 max-w-7xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.6rem", fontWeight: 700 }}><Tags className="h-5 w-5 text-primary" />{t("الباقات", "Plans")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("الأسعار تعيش على Stripe (غير قابلة للتعديل) — تغيير السعر = باقة جديدة. هنا: التفعيل والأسماء.", "Prices live on Stripe (immutable) — a price change is a new plan. Here: activation and names.")}</p>
      </div>
      <Card className="border-border">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-start">{t("الباقة", "Plan")}</th><th className="px-3 py-2 text-start">{t("الفئة", "Tier")}</th><th className="px-3 py-2 text-end">{t("السعر", "Price")}</th><th className="px-3 py-2 text-start">{t("الدورة", "Interval")}</th><th className="px-3 py-2 text-end">{t("المشتركون", "Subscribers")}</th><th className="px-3 py-2 text-start">{t("الحالة", "Status")}</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="px-3 py-2">
                      {edit?.id === p.id ? (
                        <div className="flex flex-wrap gap-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="h-8 w-44" dir="ltr" /><Input value={edit.nameAr} onChange={(e) => setEdit({ ...edit, nameAr: e.target.value })} className="h-8 w-44" placeholder={t("الاسم العربي", "Arabic name")} /><Button size="sm" className="h-8 bg-primary" disabled={busy === p.id} onClick={saveNames}>{t("حفظ", "Save")}</Button><Button size="sm" variant="outline" className="h-8 border-border" onClick={() => setEdit(null)}>{t("إلغاء", "Cancel")}</Button></div>
                      ) : (<><div className="text-foreground" style={{ fontWeight: 600 }}>{p.name}</div><div className="text-[11px] text-muted-foreground">{p.nameAr || "—"} · <span className="font-english" dir="ltr">{p.stripePriceId.slice(0, 14)}…</span></div></>)}
                    </td>
                    <td className="px-3 py-2 font-english" dir="ltr">{p.tier}</td>
                    <td className="px-3 py-2 text-end font-english" dir="ltr">{money(p.price, p.currency.toUpperCase())}</td>
                    <td className="px-3 py-2 font-english" dir="ltr">{p.interval}</td>
                    <td className="px-3 py-2 text-end font-english">{p.subscriptions}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.isActive ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground"}`}>{p.isActive ? t("مفعّلة", "Active") : t("موقوفة", "Inactive")}</span></td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">
                      <Button size="sm" variant="outline" className="h-8 border-border me-1" onClick={() => setEdit({ id: p.id, name: p.name, nameAr: p.nameAr || "" })}>{t("الأسماء", "Names")}</Button>
                      <Button size="sm" variant="outline" className="h-8 border-border" disabled={busy === p.id} onClick={() => void toggle(p)}>{p.isActive ? t("إيقاف", "Deactivate") : t("تفعيل", "Activate")}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export function AdminAudit() {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<AdminAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetType, setTargetType] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.admin.audit({ targetType: targetType || undefined, limit: 300 })).items); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذر التحميل", "Could not load")); }
    finally { setLoading(false); }
  }, [targetType, push, t]);
  useEffect(() => { void load(); }, [load]);
  const csv = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/audit?format=csv${targetType ? `&targetType=${targetType}` : ""}`, { credentials: "include" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "admin-audit.csv"; a.click(); URL.revokeObjectURL(url);
    } catch { push("error", t("تعذر التصدير", "Export failed")); }
  };
  return (
    <div className="space-y-5 max-w-7xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.6rem", fontWeight: 700 }}><ScrollText className="h-5 w-5 text-primary" />{t("سجل الأثر", "Audit trail")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("كل إجراء إداري: من · على من · ماذا · قبل/بعد · السبب · IP", "Every admin action: who · on what · before/after · reason · IP")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="h-9 rounded-md border border-border bg-white px-2 text-sm"><option value="">{t("كل الأهداف", "All targets")}</option>{["ORG", "USER", "SUBSCRIPTION", "PLAN", "SYSTEM"].map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <Button variant="outline" className="border-border" onClick={() => void csv()}><Download className="me-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" className="border-border" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
      <Card className="border-border">
        <CardContent className="p-0 overflow-x-auto">
          {loading && !items.length ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-start">{t("الوقت", "When")}</th><th className="px-3 py-2 text-start">{t("الأدمن", "Admin")}</th><th className="px-3 py-2 text-start">{t("الإجراء", "Action")}</th><th className="px-3 py-2 text-start">{t("الهدف", "Target")}</th><th className="px-3 py-2 text-start">{t("السبب", "Reason")}</th><th className="px-3 py-2 text-start">IP</th>
              </tr></thead>
              <tbody>
                {items.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-border/50 hover:bg-primary/5 cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      <td className="px-3 py-2 font-english text-xs whitespace-nowrap" dir="ltr">{fmtDateTime(r.createdAt)}</td>
                      <td className="px-3 py-2 font-english text-xs" dir="ltr">{r.adminEmail}</td>
                      <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 font-english text-[11px]" dir="ltr">{r.action}</span></td>
                      <td className="px-3 py-2">{r.targetLabel || r.targetId || "—"}<div className="text-[11px] text-muted-foreground font-english" dir="ltr">{r.targetType}</div></td>
                      <td className="px-3 py-2 text-xs">{r.reason || "—"}</td>
                      <td className="px-3 py-2 font-english text-[11px] text-muted-foreground" dir="ltr">{r.ipAddress || "—"}</td>
                    </tr>
                    {open === r.id && (
                      <tr className="border-b border-border/50 bg-muted/30">
                        <td colSpan={6} className="px-3 py-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-english" dir="ltr">
                            <div><div className="text-muted-foreground mb-1">before</div><pre className="whitespace-pre-wrap rounded bg-white p-2 border border-border/60">{JSON.stringify(r.before ?? null, null, 1)}</pre></div>
                            <div><div className="text-muted-foreground mb-1">after</div><pre className="whitespace-pre-wrap rounded bg-white p-2 border border-border/60">{JSON.stringify(r.after ?? null, null, 1)}</pre></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">{t("لا إجراءات بعد", "No actions yet")}</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
