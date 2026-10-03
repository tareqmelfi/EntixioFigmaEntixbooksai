import { displayLocale } from "../lib/number-display";
/**
 * Fiscal Periods · year-end close + period locking · UX-117
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, Lock, Unlock, CheckCircle2, CalendarDays, Plus } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { EmptyState, PageHeader, SectionHeader, StatusBadge } from "../components/product";
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
  const [pendingReopen, setPendingReopen] = useState<string | null>(null);
  const [reopenError, setReopenError] = useState('');

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
    setReopenError('');
    try {
      await api.fiscalPeriods.unlock(id);
      push("success", t("تم فتح الفترة", "Period reopened"));
      setPendingReopen(null);
      refresh();
    } catch (e: any) {
      const code = e instanceof ApiError ? e.message : '';
      const message = code.includes('reopen_later_period_first') ? t('افتح الفترات المقفلة محاسبيًا الأحدث أولًا.', 'Reopen later accounting periods first.')
        : /closing_entry_mismatch|closing_totals_unavailable/.test(code) ? t('قيد الإقفال لا يطابق سجل الفترة؛ يلزم مراجعته قبل الفتح.', 'The closing entry does not match the period record. Review it before reopening.')
        : t('تعذر فتح الفترة. لم يُحفظ التغيير؛ أعد المحاولة.', 'Could not reopen the period. No change was saved; retry.');
      setReopenError(message);
      push("error", message);
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
      push("success", `${t("تم إغلاق الفترة · صافي الدخل:", "Period closed · Net income:")} ${r.netIncome.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${t("تم إنشاء قيد إغلاق آلي", "an automatic closing entry was created")}`);
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

      <PageHeader
        eyebrow={t("المحاسبة", "Accounting")}
        title={t("الفترات المالية", "Fiscal Periods")}
        description={t("قفل مؤقت وفتح دون تغيير الأرقام · الإقفال المحاسبي إجراء مستقل", "Lock and reopen without changing figures · accounting close is a separate action")}
        actions={(
          <>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 font-english text-center" dir="ltr" aria-label={t("السنة", "Year")} />
            {items.length === 0 && (
              <Button onClick={handleInit} disabled={busy === "init"}>
                {busy === "init" ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" strokeWidth={1.75} />}
                {t("إنشاء فترات", "Create periods")} {year}
              </Button>
            )}
          </>
        )}
      />

      {reopenError && <p role="alert" className="text-sm text-warning">{reopenError}</p>}
      {pendingReopen && <Card><CardContent className="space-y-3 p-5">
        <h2 className="font-semibold">{t('إعادة فتح فترة مقفلة محاسبيًا', 'Reopen an accounting period')}</h2>
        <p className="text-sm text-muted-foreground">{t('سيُعكس قيد الإقفال مع الاحتفاظ به وبسجل المراجعة. تصبح الفترة مفتوحة للتعديل ويمكن إقفالها مجددًا. لن تتغير الفواتير أو الدفعات.', 'The closing entry will be reversed and retained with its audit history. The period becomes editable and can be closed again. Invoices and payments will not change.')}</p>
        <Button disabled={!!busy} onClick={()=>handleUnlock(pendingReopen)}>{t('تأكيد إعادة الفتح','Confirm reopen')}</Button>
        <Button variant="outline" disabled={!!busy} onClick={()=>setPendingReopen(null)}>{t('إلغاء','Cancel')}</Button>
      </CardContent></Card>}
      {/* Close preview · inline confirmation (UX-1 · no modal) */}
      {preview && pendingClose && (
        <Card className="border-s-[3px] border-s-danger">
          <CardContent className="space-y-4 p-5">
            <h2 className="text-section font-semibold text-foreground">{t("تأكيد إغلاق الفترة", "Confirm Period Close")}</h2>
            <p className="text-xs text-muted-foreground">{t("ينشئ الإقفال قيدًا لتصفير الإيرادات والمصروفات وترحيل الصافي إلى الأرباح المحتجزة. يمكنك إعادة فتح الفترة بعكس قيد الإقفال مع حفظ سجل العملية.", "Closing clears revenue and expenses into retained earnings. You can reopen the period by reversing its closing entry with an audit trail.")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="text-xs text-muted-foreground">{t("إجمالي الإيرادات", "Total Revenue")}</div>
                <div className="mt-1 font-display text-xl tabular-nums text-foreground" dir="ltr">{preview.combinedRevenue.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="text-xs text-muted-foreground">{t("إجمالي المصروفات", "Total Expenses")}</div>
                <div className="mt-1 font-display text-xl tabular-nums text-foreground" dir="ltr">{preview.combinedExpense.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-lg border border-border bg-surface-subtle p-3 text-sm">
                <div className="text-xs font-semibold text-foreground">{t("صافي الدخل", "Net Income")}</div>
                <div className={`mt-1 font-display text-xl tabular-nums ${preview.netIncome >= 0 ? "text-foreground" : "text-danger"}`} dir="ltr">{preview.netIncome.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => { setPreview(null); setPendingClose(null); }}>{t("إلغاء", "Cancel")}</Button>
              <Button onClick={handleClose} disabled={busy === pendingClose} className="bg-danger hover:bg-danger text-primary-foreground">
                {busy === pendingClose ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" strokeWidth={1.75} />}
                {t("تأكيد الإغلاق", "Confirm Close")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" strokeWidth={1.5} />}
          title={`${t("لم يتم إنشاء فترات لعام", "No periods created for")} ${year}`}
          description={t("اضغط \"إنشاء فترات\" لإنشاء 12 فترة شهرية", "Click \"Create periods\" to create 12 monthly periods")}
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader
            title={<>{t("فترات السنة المالية", "Fiscal year periods")} <span className="font-english tabular-nums">{year}</span></>}
            description={t("القفل المؤقت يمنع التعديل حتى تفتح الفترة مجددًا، ولا يضيف أي قيد. الإقفال المحاسبي ينشئ قيد ترحيل الأرباح.", "Temporary locking prevents edits until reopened and creates no journal. Accounting close posts retained earnings.")}
          />
          <div className="ledger-table overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-sm">
              <colgroup>
                <col />
                <col style={{ width: "120px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "200px" }} />
              </colgroup>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-foreground">
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
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground font-medium">
                      <span className="font-english me-1" dir="ltr">{p.periodNumber}</span> · {monthName(p.periodNumber)}
                    </td>
                    <td className="px-4 py-3 font-english text-foreground/80 tabular-nums whitespace-nowrap" dir="ltr">{p.startDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-english text-foreground/80 tabular-nums whitespace-nowrap" dir="ltr">{p.endDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={p.status === "CLOSED" ? "neutral" : p.status === "LOCKED" ? "warning" : "success"}>
                        {p.status === "CLOSED" ? t("مُغلقة", "Closed") : p.status === "LOCKED" ? t("مقفلة", "Locked") : t("مفتوحة", "Open")}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-end font-english font-semibold tabular-nums whitespace-nowrap" dir="ltr">
                      {p.netIncome != null ? p.netIncome.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {p.status === "OPEN" && (
                        <Button size="sm" variant="outline" onClick={() => handleLock(p.id)} disabled={busy === p.id}
                          className="border-warning-border text-warning hover:bg-warning-subtle">
                          <Lock className="h-3 w-3 me-1" /> {t("قفل مؤقت", "Lock temporarily")}
                        </Button>
                      )}
                      {p.status === "LOCKED" && (
                        <span className="flex flex-wrap items-center gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleUnlock(p.id)} disabled={busy === p.id}
                            className="border-border">
                            <Unlock className="h-3 w-3 me-1" /> {t("فتح", "Reopen")}
                          </Button>
                          <Button size="sm" onClick={() => handlePreview(p.id)} disabled={busy === p.id}
                            className="bg-danger hover:bg-danger text-primary-foreground">
                            <CheckCircle2 className="h-3 w-3 me-1" /> {t("إقفال محاسبي", "Accounting close")}
                          </Button>
                        </span>
                      )}
                      {p.status === "CLOSED" && (
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={()=>{setPendingReopen(p.id);setPendingClose(null);setPreview(null);setReopenError('');}}><Unlock className="h-3 w-3 me-1" />{t('إعادة الفتح','Reopen')}</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}
