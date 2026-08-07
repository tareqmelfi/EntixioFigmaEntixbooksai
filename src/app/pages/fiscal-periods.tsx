/**
 * Fiscal Periods · year-end close + period locking · UX-117
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, Lock, Unlock, CheckCircle2, CalendarDays, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function FiscalPeriods() {
  const { toasts, push, dismiss } = useToasts();
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [pendingClose, setPendingClose] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.fiscalPeriods.list(year);
      setItems(r.items);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [push, year]);
  useEffect(() => { refresh(); }, [refresh]);

  const handleInit = async () => {
    setBusy("init");
    try {
      await api.fiscalPeriods.init(year, 1);
      push("success", `${t("تم إنشاء 12 فترة شهرية لعام", "Created 12 monthly periods for")} ${year}`);
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الإنشاء", "Failed to create"));
    } finally { setBusy(null); }
  };

  const handleLock = async (id: string) => {
    setBusy(id);
    try {
      await api.fiscalPeriods.lock(id);
      push("success", t("تم قفل الفترة", "Period locked"));
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل القفل", "Failed to lock"));
    } finally { setBusy(null); }
  };

  const handleUnlock = async (id: string) => {
    setBusy(id);
    try {
      await api.fiscalPeriods.unlock(id);
      push("success", t("تم فتح الفترة", "Period reopened"));
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الفتح", "Failed to reopen"));
    } finally { setBusy(null); }
  };

  const handlePreview = async (id: string) => {
    setBusy(id);
    try {
      const p = await api.fiscalPeriods.previewClose(id);
      setPreview(p);
      setPendingClose(id);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل المعاينة", "Failed to preview"));
    } finally { setBusy(null); }
  };

  const handleClose = async () => {
    if (!pendingClose) return;
    setBusy(pendingClose);
    try {
      const r = await api.fiscalPeriods.close(pendingClose);
      push("success", `${t("تم إغلاق الفترة · صافي الدخل:", "Period closed · Net income:")} ${r.netIncome.toLocaleString()} · ${t("تم إنشاء قيد إغلاق آلي", "an automatic closing entry was created")}`);
      setPendingClose(null);
      setPreview(null);
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الإغلاق", "Failed to close"));
    } finally { setBusy(null); }
  };

  const monthNames: { ar: string; en: string }[] = [
    { ar: "يناير", en: "January" }, { ar: "فبراير", en: "February" }, { ar: "مارس", en: "March" },
    { ar: "أبريل", en: "April" }, { ar: "مايو", en: "May" }, { ar: "يونيو", en: "June" },
    { ar: "يوليو", en: "July" }, { ar: "أغسطس", en: "August" }, { ar: "سبتمبر", en: "September" },
    { ar: "أكتوبر", en: "October" }, { ar: "نوفمبر", en: "November" }, { ar: "ديسمبر", en: "December" },
  ];
  const monthName = (n: number) => { const m = monthNames[n - 1]; return m ? t(m.ar, m.en) : String(n); };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الفترات المالية", "Fiscal Periods")}</h1>
          <p className="text-muted-foreground mt-1">{t("قفل الفترات · إغلاق سنوي · ترحيل الأرباح المحتجزة", "Period locking · year-end close · retained earnings posting")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 font-english text-center" dir="ltr" />
          {items.length === 0 && (
            <Button onClick={handleInit} disabled={busy === "init"} className="bg-primary hover:bg-primary/90">
              {busy === "init" ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              {t("إنشاء فترات", "Create periods")} {year}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("لم يتم إنشاء فترات لعام", "No periods created for")} {year}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t("اضغط \"إنشاء فترات\" لإنشاء 12 فترة شهرية", "Click \"Create periods\" to create 12 monthly periods")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">{t("فترات السنة المالية", "Fiscal year periods")} {year}</CardTitle>
            <CardDescription>{t("افتح/أقفل/أغلق · الإغلاق ينشئ قيد إغلاق آلي ويرحّل صافي الدخل إلى الأرباح المحتجزة", "Reopen/Lock/Close · closing creates an automatic closing entry and posts net income to retained earnings")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="text-start px-4 py-2.5 font-medium">{t("الفترة", "Period")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("من", "From")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("إلى", "To")}</th>
                  <th className="text-center px-4 py-2.5 font-medium">{t("الحالة", "Status")}</th>
                  <th className="text-end px-4 py-2.5 font-medium">{t("صافي الدخل", "Net Income")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.id} className="border-t border-border/50">
                    <td className="px-4 py-3 text-foreground font-medium">
                      <span className="font-english me-1" dir="ltr">{p.periodNumber}</span> · {monthName(p.periodNumber)}
                    </td>
                    <td className="px-4 py-3 font-english text-foreground/80" dir="ltr">{p.startDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-english text-foreground/80" dir="ltr">{p.endDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        p.status === "CLOSED" ? "bg-gray-100 text-gray-700" :
                        p.status === "LOCKED" ? "bg-amber-50 text-amber-700" :
                        "bg-green-50 text-green-700"
                      }`}>
                        {p.status === "CLOSED" ? t("مُغلقة", "Closed") : p.status === "LOCKED" ? t("مقفلة", "Locked") : t("مفتوحة", "Open")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end font-english font-semibold" dir="ltr">
                      {p.netIncome != null ? p.netIncome.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {p.status === "OPEN" && (
                        <Button size="sm" variant="outline" onClick={() => handleLock(p.id)} disabled={busy === p.id}
                          className="border-amber-300 text-amber-700 hover:bg-amber-50">
                          <Lock className="h-3 w-3 me-1" /> {t("قفل", "Lock")}
                        </Button>
                      )}
                      {p.status === "LOCKED" && (
                        <span className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleUnlock(p.id)} disabled={busy === p.id}
                            className="border-border">
                            <Unlock className="h-3 w-3 me-1" /> {t("فتح", "Reopen")}
                          </Button>
                          <Button size="sm" onClick={() => handlePreview(p.id)} disabled={busy === p.id}
                            className="bg-red-600 hover:bg-red-700 text-white">
                            <CheckCircle2 className="h-3 w-3 me-1" /> {t("إغلاق", "Close")}
                          </Button>
                        </span>
                      )}
                      {p.status === "CLOSED" && (
                        <span className="text-xs text-muted-foreground/60">{t("— مُغلقة نهائياً —", "— Permanently closed —")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Preview Close modal */}
      {preview && pendingClose && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setPreview(null); setPendingClose(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg text-foreground font-bold mb-3">{t("تأكيد إغلاق الفترة", "Confirm Period Close")}</h2>
            <p className="text-xs text-muted-foreground mb-4">{t("سيتم إنشاء قيد إغلاق آلي يصفّر حسابات الإيرادات والمصروفات ويرحّل الصافي إلى الأرباح المحتجزة. هذه العملية", "An automatic closing entry will be created that zeroes the revenue and expense accounts and posts the net to retained earnings. This action is")} <span className="font-bold text-red-600">{t("غير قابلة للتراجع", "irreversible")}</span>.</p>
            <div className="rounded-lg border border-border divide-y divide-[#F3F4F6]">
              <div className="flex justify-between p-3 text-sm">
                <span className="text-muted-foreground">{t("إجمالي الإيرادات", "Total Revenue")}</span>
                <span className="font-english font-semibold text-green-700" dir="ltr">{preview.combinedRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span className="text-muted-foreground">{t("إجمالي المصروفات", "Total Expenses")}</span>
                <span className="font-english font-semibold text-red-700" dir="ltr">{preview.combinedExpense.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 text-sm bg-muted">
                <span className="text-foreground font-bold">{t("صافي الدخل", "Net Income")}</span>
                <span className={`font-english font-bold ${preview.netIncome >= 0 ? "text-green-700" : "text-red-700"}`} dir="ltr">{preview.netIncome.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { setPreview(null); setPendingClose(null); }} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <Button onClick={handleClose} disabled={busy === pendingClose} className="bg-red-600 hover:bg-red-700 text-white">
                {busy === pendingClose ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
                {t("تأكيد الإغلاق", "Confirm Close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
