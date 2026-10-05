import { displayLocale } from "../lib/number-display";
/**
 * Fixed Assets list — app-wide standard: rows open the FULL detail page
 * (/app/assets/:id) instead of a slide-over. New asset → /app/assets/new.
 */
import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Loader2, ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { EmptyState, InlineAlert, LedgerFigure, Metric, MetricStrip, PageHeader, StatusBadge } from "../components/product";
import { Button } from "../components/ui/button";
import { api, ApiError, Account, type AssetIntakeCandidate } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function FixedAssets() {
  const [intake, setIntake] = useState<AssetIntakeCandidate[]>([]);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalCost: 0, netBookValue: 0, totalDepreciation: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [listed, pending] = await Promise.allSettled([api.fixedAssets.list(), api.fixedAssets.intake()]);
      if (listed.status === 'fulfilled') { const d = listed.value; setItems(d.items); setStats({ totalCost: d.totalCost, netBookValue: d.netBookValue, totalDepreciation: d.totalDepreciation }); }
      if (pending.status === 'fulfilled') setIntake(pending.value.items);
      if (listed.status === 'rejected' || pending.status === 'rejected') setError(t("تعذّر تحميل بعض بيانات الأصول. أعد المحاولة.", "Some asset information could not be loaded. Please retry."));
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    api.accounts.list().then((d) => setAccounts(d.items)).catch(() => {});
  }, []);

  const formatMoney = (value: any) => Number(value || 0).toLocaleString(displayLocale(undefined), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const accountLabel = (id?: string | null) => {
    if (!id) return "—";
    const a = accounts.find(x => x.id === id);
    return a ? `${a.code} · ${a.name}` : "—";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("المحاسبة", "Accounting")}
        title={t("الأصول الثابتة", "Fixed Assets")}
        description={t("مراجعة الأصول وربطها بالمشتريات والقيود المحاسبية", "Review assets linked to purchases and journal entries")}
        actions={<Button onClick={() => navigate("/app/assets/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("أصل جديد", "New Asset")}</Button>}
      />

      <MetricStrip className="xl:grid-cols-3">
        <Metric label={t("إجمالي التكلفة", "Total Cost")} value={<LedgerFigure value={stats.totalCost} />} />
        <Metric tone="warning" label={t("إهلاك تقديري غير مرحّل", "Estimated depreciation · unposted")} value={<LedgerFigure value={stats.totalDepreciation} />} />
        <Metric tone="success" label={t("القيمة المتبقية التقديرية", "Estimated remaining value")} value={<LedgerFigure value={stats.netBookValue} />} />
      </MetricStrip>

      <p className="text-xs text-muted-foreground">{t("التقدير بالقسط الثابت من تاريخ بدء الاستخدام المحدد؛ لا يمثل رصيد الأستاذ أو الإهلاك الضريبي.", "Straight-line estimate from the specified in-service date; this is not the ledger balance or tax depreciation.")}</p>
      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <section aria-label={t("أصول تحتاج تسجيلًا", "Assets awaiting registration")} className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="font-semibold">{t("أصول تحتاج تسجيلًا", "Assets awaiting registration")} · {intake.length}</h2>
        <p className="text-sm text-muted-foreground">{t("بنود من القيود المرحّلة والمشتريات. راجع التكلفة والعمر الإنتاجي قبل التسجيل. الاستبعاد لا يحذف القيد أو الفاتورة.", "Items from posted journals and purchases. Review cost and useful life before registering. Dismissal does not delete the journal or purchase.")}</p>
        {!loading && !error && !intake.length && <p className="text-sm">{t("لا توجد بنود معلقة.", "No items awaiting review.")}</p>}
        {intake.map(item => <div key={item.sourceKey} className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <div className="flex-1 min-w-0"><p className="font-medium break-words">{item.name}</p><p className="text-xs text-muted-foreground">{item.sourceNumber} · {item.acquisitionDate.slice(0,10)} · {accountLabel(item.accountId)}</p></div>
          <span dir="ltr" className="text-sm">{item.acquisitionCost === "" ? t("تأكيد التكلفة مطلوب", "Confirm cost") : `${formatMoney(item.acquisitionCost)} ${item.currency}`}</span>
          <Button type="button" variant="outline" onClick={() => navigate(`/app/assets/new?intake=${encodeURIComponent(item.sourceKey)}`)}>{t("مراجعة وتسجيل", "Review and register")}</Button>
          <Button type="button" variant="ghost" disabled={reviewBusy !== null} onClick={async () => {
            setReviewBusy(item.sourceKey); setError(null);
            try { await api.fixedAssets.dismissIntake({sourceKey:item.sourceKey,fingerprint:item.fingerprint}); await refresh(); }
            catch { setError(t("تعذّر استبعاد البند. حدّث القائمة وحاول مجددًا.", "Could not dismiss this item. Refresh and try again.")); }
            finally { setReviewBusy(null); }
          }}>{t("استبعاد", "Dismiss")}</Button>
        </div>)}
      </section>

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{t("قائمة الأصول", "Assets List")} · <span className="font-english tabular-nums">{items.length}</span></h2>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         items.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-10 w-10" strokeWidth={1.5} />}
            title={t("لا توجد أصول ثابتة", "No fixed assets")}
            description={t("سجّل أصلاً يدوياً أو راجع البنود المكتشفة من المشتريات والقيود", "Register manually or review items discovered from purchases and journals")}
            action={<Button onClick={() => navigate("/app/assets/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("أصل جديد", "New Asset")}</Button>}
          />
         ) :
        (<div className="ledger-table overflow-x-auto">
          <table className="w-full table-fixed min-w-[1000px] text-sm">
            <colgroup>
              <col className="w-[130px]" />{/* الرمز · mono */}
              <col />{/* الاسم · flexible */}
              <col className="w-[140px]" />
              <col className="w-[200px]" />
              <col className="w-[120px]" />
              <col className="w-[140px]" />
              <col className="w-[110px]" />
              <col className="w-[44px]" />
            </colgroup>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-foreground">
                <th className="py-3 px-4 text-start font-medium">{t("الرمز", "Code")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("الاسم", "Name")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("التصنيف", "Category")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("حساب الأصل", "Asset account")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("تاريخ الاقتناء", "Acquisition")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("التكلفة", "Cost")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("الحالة", "Status")}</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/app/assets/${a.id}`)}
                  className="border-b border-border hover:bg-surface-hover cursor-pointer"
                  title={t("فتح الأصل", "Open asset")}
                >
                  <td className="py-3 px-4">
                    <Link to={`/app/assets/${a.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-code text-sm font-semibold text-foreground hover:underline underline-offset-4" dir="ltr" title={a.code}>{a.code}</Link>
                  </td>
                  <td className="py-3 px-4">
                    <span className="block max-w-full truncate text-sm text-foreground" title={a.name}><bdi dir="auto">{a.name}</bdi></span>
                    {(a.purchaseBillId || a.purchaseExpenseId) && <span className="text-[10px] text-muted-foreground/70">{t("من المشتريات", "from purchases")}</span>}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground/80 truncate"><bdi dir="auto">{a.category || "—"}</bdi></td>
                  <td className="py-3 px-4 text-xs text-muted-foreground truncate" dir="ltr">{accountLabel(a.accountId)}</td>
                  <td className="py-3 px-4 font-english text-xs text-muted-foreground tabular-nums whitespace-nowrap" dir="ltr">{a.acquisitionDate?.slice(0, 10)}</td>
                  <td className="py-3 px-4 text-end font-english text-sm text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }} dir="ltr">{formatMoney(a.acquisitionCost)}</td>
                  <td className="py-3 px-4">
                    <StatusBadge tone={a.status === "ACTIVE" ? "success" : "neutral"}>
                      {a.status === "ACTIVE" ? t("نشط", "Active") : a.status === "DISPOSED" ? t("مُخرج", "Disposed") : t("مشطوب", "Written off")}
                    </StatusBadge>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" strokeWidth={1.75} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>)}
      </section>
    </div>
  );
}
