import { displayLocale, displayDigits } from "../lib/number-display";
/**
 * Shareholders register — سجل المساهمين للشركات المساهمة.
 * Rows open the shareholder page (/app/shareholders/:id).
 * New shareholder → /app/shareholders/new · New share move → /app/share-transactions/new
 */
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Loader2, Plus, Repeat2, Users2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { EmptyState, InlineAlert, Metric, MetricStrip, PageHeader, StatusBadge } from "../components/product";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { useLegalType } from "../lib/use-legal-type";

const num = (v: any) => Number(v || 0).toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 });
const money = (v: any) => Number(v || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Shareholders() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  // JSC → shareholders register with share transactions · other legal forms →
  // owners registry linked to contacts (no issuance/treasury mechanics).
  const legalType = useLegalType();
  const isJsc = legalType === "JSC";
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.investments.listShareholders();
      setItems(d.items);
      setSummary(d.summary);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const totalShares = items.reduce((s, x) => s + Number(x.shareCount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("الملاك والاستثمار", "Ownership & investment")}
        title={isJsc ? t("سجل المساهمين", "Shareholders Register") : t("سجل الملاك", "Owners Registry")}
        description={isJsc
          ? t("الإصدار · أسهم الخزينة · التنازل بين المساهمين — بمعالجة محاسبية كاملة لحقوق الملكية", "Issuance · treasury shares · transfers between shareholders — full equity accounting treatment")
          : t("حصص الملاك ونسب التملك — مرتبطة بسجل جهات الاتصال لديك", "Owner stakes and percentages — linked to your contacts")}
        actions={(
          <>
            {isJsc && (
              <Button variant="outline" onClick={() => navigate("/app/share-transactions/new")}><Repeat2 className="me-2 h-4 w-4" strokeWidth={1.75} />{t("حركة أسهم", "Share transaction")}</Button>
            )}
            <Button onClick={() => navigate("/app/shareholders/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{isJsc ? t("مساهم جديد", "New shareholder") : t("مالك جديد", "New owner")}</Button>
          </>
        )}
      />

      {isJsc && (
      <MetricStrip>
        <Metric label={t("الأسهم المصدرة", "Issued shares")} value={num(summary?.issued)} />
        <Metric tone="warning" label={t("أسهم الخزينة", "Treasury shares")} value={num(summary?.treasury)} />
        <Metric tone="success" label={t("الأسهم القائمة", "Outstanding shares")} value={num(summary?.outstanding)} />
        <Metric label={isJsc ? t("المساهمون", "Shareholders") : t("الملاك", "Owners")} value={String(items.length)} />
      </MetricStrip>
      )}

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{t("السجل", "Register")} · <span className="font-english tabular-nums">{items.length}</span></h2>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         items.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-10 w-10" strokeWidth={1.5} />}
            title={isJsc ? t("لا يوجد مساهمون بعد", "No shareholders yet") : t("لا يوجد ملاك بعد", "No owners yet")}
            description={isJsc
              ? t("سجّل المساهمين ثم وثّق الإصدار وشراء/بيع أسهم الشركة والتنازلات بينهم", "Register shareholders, then record issuance, company share buy/sell and transfers")
              : t("سجّل الملاك واربطهم بجهات الاتصال — النسب تُحسب تلقائيًا من الحصص", "Register owners and link them to contacts — percentages compute automatically")}
            action={<Button onClick={() => navigate("/app/shareholders/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{isJsc ? t("مساهم جديد", "New shareholder") : t("مالك جديد", "New owner")}</Button>}
          />
        ) : (
          <div className="ledger-table overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-sm">
              <colgroup>
                <col style={{ width: "130px" }} />{/* الرمز · mono */}
                <col />{/* المساهم · flexible */}
                <col style={{ width: "130px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "140px" }} />
                <col style={{ width: "170px" }} />
                <col style={{ width: "44px" }} />
              </colgroup>
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
                <th className="py-3 px-4 text-start font-medium">{t("الرمز", "Code")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("المساهم", "Shareholder")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("الأسهم", "Shares")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("النسبة %", "Stake %")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("متوسط التكلفة", "Avg cost")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("إجمالي الاستثمار", "Total invested")}</th>
                <th className="py-3 px-4"></th>
              </tr></thead>
              <tbody>
                {items.map((s) => {
                  const shares = Number(s.shareCount || 0);
                  const pct = totalShares > 0 ? (shares / totalShares) * 100 : 0;
                  return (
                    <tr key={s.id} onClick={() => navigate(`/app/shareholders/${s.id}`)} className="border-b border-border hover:bg-surface-hover cursor-pointer" title={t("فتح السجل", "Open record")}>
                      <td className="py-3 px-4"><Link to={`/app/shareholders/${s.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-code text-sm font-semibold text-foreground hover:underline underline-offset-4" dir="ltr" title={s.code}>{s.code}</Link></td>
                      <td className="py-3 px-4">
                        <div className="truncate text-sm text-foreground" style={{ fontWeight: 600 }} title={s.name}><bdi dir="auto">{s.name}</bdi></div>
                        <div className="truncate text-xs text-muted-foreground font-english" dir="ltr">{s.nationalId || s.email || ""}</div>
                        {s.contact && (
                          <StatusBadge tone="info" className="mt-1 max-w-full [&>span]:truncate">
                            {t("مرتبط بجهة اتصال", "Linked contact")} · <bdi dir="auto">{s.contact.customCode || s.contact.displayName}</bdi>
                          </StatusBadge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end font-english text-foreground tabular-nums" style={{ fontWeight: 600 }} dir="ltr">{num(shares)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 shrink-0 rounded-full bg-surface-subtle overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="font-english text-xs text-muted-foreground tabular-nums" dir="ltr">{displayDigits(pct.toFixed(1))}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-end font-english text-muted-foreground tabular-nums whitespace-nowrap" dir="ltr">{s.avgCost != null ? money(s.avgCost) : "—"}</td>
                      <td className="py-3 px-4 text-end font-english text-foreground tabular-nums whitespace-nowrap" dir="ltr">{s.avgCost != null ? money(shares * Number(s.avgCost)) : "—"}</td>
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
