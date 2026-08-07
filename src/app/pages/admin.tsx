/**
 * /app/admin · Cross-org dashboard for platform admin (platform admin).
 *
 * Server-side gate: api returns 403 if user email not in ADMIN_EMAILS env.
 * Client-side: just calls the API · if 403, shows access-denied message.
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, ShieldCheck, DollarSign, TrendingUp, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

interface OrgRow {
  id: string;
  orgId: string;
  mode: string;
  monthlyAllocation: string;
  creditBalance: string;
  spentThisPeriod: string;
  periodResetAt: string;
  disabled: boolean;
  disabledReason: string | null;
  byokKeyHint: string | null;
  org: { id: string; name: string; slug: string; country: string; createdAt: string };
}

const MODE_BADGES: Record<string, string> = {
  BYOK: "bg-violet-100 text-violet-700",
  HOSTED_FREE: "bg-gray-100 text-gray-700",
  HOSTED_PRO: "bg-blue-100 text-blue-700",
  HOSTED_BUSINESS: "bg-emerald-100 text-emerald-700",
  PAYG: "bg-amber-100 text-amber-700",
};

export function AdminDashboard() {
  const { t } = useLanguage();
  const [items, setItems] = useState<OrgRow[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const [topupFor, setTopupFor] = useState<OrgRow | null>(null);
  const [topupAmount, setTopupAmount] = useState("10");
  const [topupNote, setTopupNote] = useState("");

  const [usageSummary, setUsageSummary] = useState<{ totalCost: number; totalRequests: number; byModel: Record<string, { count: number; cost: number }> } | null>(null);

  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.aiBilling.admin.orgs();
      setItems(r.items as any);
      setTotalSpend(r.totalSpend);
      try {
        const s = await api.aiBilling.admin.usageSummary();
        setUsageSummary({ totalCost: s.totalCost, totalRequests: s.totalRequests, byModel: s.byModel });
      } catch {}
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
      } else {
        push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
      }
    } finally { setLoading(false); }
  }, [push, t]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleTopup = async () => {
    if (!topupFor) return;
    const amt = Number(topupAmount);
    if (!amt || amt <= 0) { push("error", t("أدخل مبلغاً صحيحاً", "Enter a valid amount")); return; }
    setBusy(true);
    try {
      await api.aiBilling.admin.topup({ orgId: topupFor.orgId, amountUsd: amt, note: topupNote || undefined });
      push("success", t(`تم شحن ${topupFor.org.name} بـ$${amt.toFixed(2)}`, `Topped up ${topupFor.org.name} with $${amt.toFixed(2)}`));
      setTopupFor(null); setTopupAmount("10"); setTopupNote("");
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الشحن", "Top-up failed"));
    } finally { setBusy(false); }
  };

  const handleToggleDisable = async (org: OrgRow) => {
    setBusy(true);
    try {
      await api.aiBilling.admin.disable({
        orgId: org.orgId,
        disabled: !org.disabled,
        reason: !org.disabled ? "Disabled from admin dashboard" : undefined,
      });
      push("success", org.disabled ? t("تم تفعيل الـAI", "AI enabled") : t("تم تعطيل الـAI", "AI disabled"));
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحديث", "Update failed"));
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (forbidden) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <ShieldCheck className="h-16 w-16 text-muted-foreground/60 mx-auto mb-4" />
        <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{t("الصفحة مقيّدة للإدارة فقط", "This page is restricted to admins")}</h1>
        <p className="text-muted-foreground mt-2">{t("حسابك غير مدرج كـadmin · إذا تحتاج وصول، اتصل بالدعم.", "Your account is not listed as an admin · contact support if you need access.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.75rem", fontWeight: 700 }}>
            <ShieldCheck className="h-6 w-6 text-primary" /> {t("لوحة الإدارة", "Admin dashboard")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("إدارة الشركات · الفوترة · الاستهلاك العام", "Manage companies · billing · overall usage")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground text-sm">{t("إجمالي الإنفاق هذا الشهر", "Total spend this month")}</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="font-english text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>${totalSpend.toFixed(2)}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground text-sm">{t("الشركات النشطة", "Active companies")}</span>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div className="font-english text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground text-sm">{t("آخر 30 يوم · طلبات", "Last 30 days · requests")}</span>
            <Sparkle />
          </div>
          <div className="font-english text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{usageSummary?.totalRequests ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1 font-english">{t("إجمالي", "Total")} ${usageSummary?.totalCost.toFixed(2) ?? "0.00"}</div>
        </CardContent></Card>
      </div>

      {topupFor && (
        <Card className="border-primary/40 bg-primary/[0.02]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-base">{t(`شحن رصيد · ${topupFor.org.name}`, `Top up · ${topupFor.org.name}`)}</CardTitle>
              <button onClick={() => setTopupFor(null)} className="text-xs text-muted-foreground hover:text-foreground">{t("إغلاق", "Close")}</button>
            </div>
            <p className="text-xs text-muted-foreground">{t("إضافة رصيد فوق المخصص الشهري", "Add credit on top of the monthly allocation")}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="rounded-lg bg-white border border-border p-3 text-xs">
                <p className="text-muted-foreground">{t("الرصيد الحالي:", "Current balance:")}</p>
                <p className="text-foreground font-english mt-1" style={{ fontWeight: 600 }}>${Number(topupFor.creditBalance).toFixed(2)}</p>
              </div>
              <div className="space-y-2"><Label>{t("المبلغ بالدولار *", "Amount (USD) *")}</Label>
                <Input type="number" min="0.01" step="0.01" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("ملاحظة (اختياري)", "Note (optional)")}</Label>
                <Input value={topupNote} onChange={(e) => setTopupNote(e.target.value)} placeholder={t("منحة · ترقية · تعويض ...", "Grant · upgrade · compensation ...")} /></div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setTopupFor(null)} className="border-border">{t("إلغاء", "Cancel")}</Button>
                <Button onClick={handleTopup} disabled={busy} className="bg-primary hover:bg-primary/90">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("شحن", "Top up")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("الشركات", "Companies")} · {items.length}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">{t("لا توجد شركات بعد", "No companies yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الشركة", "Company")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الباقة", "Plan")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المخصص", "Allocation")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرصيد", "Balance")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المستهلك", "Spent")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>BYOK</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
                </tr></thead>
                <tbody>
                  {items.map((row) => {
                    const spent = Number(row.spentThisPeriod);
                    const allowed = Number(row.monthlyAllocation) + Number(row.creditBalance);
                    const pct = allowed > 0 ? spent / allowed : 0;
                    return (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-primary/5">
                        <td className="py-3 px-4">
                          <div className="text-sm text-foreground" style={{ fontWeight: 500 }}>{row.org.name}</div>
                          <div className="text-xs text-muted-foreground/60 font-english">{row.org.slug} · {row.org.country}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded ${MODE_BADGES[row.mode] || ""}`}>{row.mode}</span>
                        </td>
                        <td className="py-3 px-4 font-english text-sm">${Number(row.monthlyAllocation).toFixed(2)}</td>
                        <td className="py-3 px-4 font-english text-sm text-green-600">${Number(row.creditBalance).toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <div className="font-english text-sm" style={{ color: pct >= 1 ? "#dc2626" : pct >= 0.8 ? "#d97706" : "#0B1B49" }}>
                            ${spent.toFixed(2)} <span className="text-xs text-muted-foreground/60">({(pct * 100).toFixed(0)}%)</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-english text-xs text-muted-foreground">{row.byokKeyHint || "—"}</td>
                        <td className="py-3 px-4">
                          {row.disabled ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700">{t("معطّل", "Disabled")}</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">{t("نشط", "Active")}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setTopupFor(row); setTopupAmount("10"); setTopupNote(""); }}
                              className="rounded-md px-2 py-1 text-xs text-primary hover:bg-blue-50 flex items-center gap-1"
                              title={t("شحن رصيد", "Top up balance")}
                              disabled={busy}
                            >
                              <DollarSign className="h-3.5 w-3.5" /> {t("شحن", "Top up")}
                            </button>
                            <button
                              onClick={() => handleToggleDisable(row)}
                              className={`rounded-md p-1.5 ${row.disabled ? "text-green-600 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}
                              disabled={busy}
                              title={row.disabled ? t("تفعيل", "Enable") : t("تعطيل", "Disable")}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {usageSummary && Object.keys(usageSummary.byModel).length > 0 && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-foreground">{t("توزيع الاستخدام · 30 يوم", "Usage distribution · 30 days")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(usageSummary.byModel)
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([model, stats]) => (
                  <div key={model} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-foreground/80 font-english">{model}</span>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-english">
                      <span>{stats.count} {t("طلب", "requests")}</span>
                      <span style={{ fontWeight: 600 }}>${stats.cost.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}



      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function Sparkle() {
  return <span className="text-amber-500">✨</span>;
}
