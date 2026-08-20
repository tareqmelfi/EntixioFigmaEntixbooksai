import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Save, Download, Printer, AlertTriangle, FileText, ShoppingBag } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DateInput } from "../components/date-input";
import { Button } from "../components/ui/button";
import { api, ApiError, type TaxReturnPayload, type TaxReturnWithholdingRow, type UsSalesTaxPayload, type VatSummaryPayload } from "../lib/api";
import { useOrgRegion } from "../lib/use-org-region";
import { useLanguage } from "../components/LanguageContext";

const money = (value: number, currency = "SAR") =>
  `${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

// Saudi VAT is filed monthly or quarterly per the org's registration — the
// return should open on the CURRENT filing period (not a bare month), and
// offer one-click quarter jumps (user report 2026-08-18).
function quarterRange(year: number, q: 1 | 2 | 3 | 4): [string, string] {
  const startMonth = (q - 1) * 3;
  const from = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, startMonth + 3, 0)).toISOString().slice(0, 10);
  return [from, to];
}

function currentQuarterRange(): [string, string] {
  const now = new Date();
  return quarterRange(now.getFullYear(), (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4);
}

const QUARTER_LABELS: Array<[1 | 2 | 3 | 4, string, string]> = [
  [1, "الربع الأول", "Q1"],
  [2, "الربع الثاني", "Q2"],
  [3, "الربع الثالث", "Q3"],
  [4, "الربع الرابع", "Q4"],
];

const transferTypeLabel: Record<TaxReturnWithholdingRow["transferType"], { ar: string; en: string }> = {
  SERVICE: { ar: "خدمات", en: "Services" },
  ROYALTY: { ar: "إتاوة / امتياز", en: "Royalty" },
  INTEREST: { ar: "فوائد", en: "Interest" },
  OTHER: { ar: "أخرى", en: "Other" },
};

export function Taxes() {
  const { t } = useLanguage();
  // W30 · the return's SHAPE follows the org's country — a Wyoming company never
  // sees a Saudi VAT return, and a Saudi company never sees US sales tax.
  const { isSA, isUS, country, loading: regionLoading } = useOrgRegion();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [from, setFrom] = useState(searchParams.get("from") || monthStartIso());
  const [to, setTo] = useState(searchParams.get("to") || todayIso());
  // An explicit range (URL or a user's pick) wins; otherwise the first loaded
  // payload snaps the range to the org's filing cadence (quarterly SA filers
  // open on the current quarter — never a lone month).
  const didPickRange = useRef(Boolean(searchParams.get("from") || searchParams.get("to")));

  const applyRange = (nextFrom: string, nextTo: string) => {
    didPickRange.current = true;
    setFrom(nextFrom);
    setTo(nextTo);
  };

  const [payload, setPayload] = useState<TaxReturnPayload | null>(null);
  const [usPayload, setUsPayload] = useState<UsSalesTaxPayload | null>(null);
  const [vatPayload, setVatPayload] = useState<VatSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingVoucherId, setSavingVoucherId] = useState<string | null>(null);
  const [withholdingDraft, setWithholdingDraft] = useState<Record<string, { rate: number; transferType: TaxReturnWithholdingRow["transferType"] }>>({});

  useEffect(() => {
    const params: Record<string, string> = { from, to };
    setSearchParams(params, { replace: true });
  }, [from, to, setSearchParams]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isUS) {
        setUsPayload(await api.taxReturn.usSalesTax({ from, to }));
        return;
      }
      if (!isSA) {
        setVatPayload(await api.taxReturn.vatSummary({ from, to }));
        return;
      }
      const data = await api.taxReturn.saVat({ from, to });
      setPayload(data);
      const seed: Record<string, { rate: number; transferType: TaxReturnWithholdingRow["transferType"] }> = {};
      data.withholding.rows.forEach((row) => {
        seed[row.voucherId] = { rate: row.rate, transferType: row.transferType };
      });
      setWithholdingDraft(seed);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذر تحميل بيانات الإقرار الضريبي", "Failed to load tax return data"));
    } finally {
      setLoading(false);
    }
  };

  // W30 fix · wait for the region resolver, and REFETCH when it settles — on a
  // cold load the hook briefly reports the SA default, so the first fetch would
  // hit the wrong country's endpoint and the resolved view would stay empty.
  useEffect(() => {
    if (regionLoading) return;
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [from, to, country, regionLoading]);

  const currency = payload?.org.baseCurrency || "SAR";

  // First load with no explicit range → snap to the org's filing cadence.
  useEffect(() => {
    if (didPickRange.current || !payload) return;
    didPickRange.current = true;
    if (payload.org.vatPeriod === "quarterly") {
      const [qf, qt] = currentQuarterRange();
      setFrom(qf);
      setTo(qt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const withholdingTotals = useMemo(() => {
    if (!payload) return { totalBase: 0, totalWithholding: 0 };
    let totalBase = 0;
    let totalWithholding = 0;
    for (const row of payload.withholding.rows) {
      const draft = withholdingDraft[row.voucherId] || { rate: row.rate, transferType: row.transferType };
      totalBase += row.baseAmount;
      totalWithholding += (row.baseAmount * Number(draft.rate || 0)) / 100;
    }
    return { totalBase, totalWithholding };
  }, [payload, withholdingDraft]);

  const updateDraft = (voucherId: string, patch: Partial<{ rate: number; transferType: TaxReturnWithholdingRow["transferType"] }>) => {
    setWithholdingDraft((prev) => ({
      ...prev,
      [voucherId]: {
        ...(prev[voucherId] || { rate: 5, transferType: "SERVICE" as const }),
        ...patch,
      },
    }));
  };

  const saveWithholding = async (row: TaxReturnWithholdingRow) => {
    const draft = withholdingDraft[row.voucherId] || { rate: row.rate, transferType: row.transferType };
    setSavingVoucherId(row.voucherId);
    try {
      await api.taxReturn.updateWithholding(row.voucherId, {
        rate: Number(draft.rate || 0),
        transferType: draft.transferType,
      });
      await load();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذر حفظ تعديل الاستقطاع", "Failed to save withholding change"));
    } finally {
      setSavingVoucherId(null);
    }
  };

  // Export a CSV with the ZATCA line-by-line fields for manual portal entry.
  const exportZatcaCsv = () => {
    if (!payload) return;
    const v = payload.vatDeclaration;
    const rows: string[] = [`${t("البند", "Line item")},${t("الأساس الضريبي", "Taxable base")},${t("الضريبة", "Tax")}`];
    const add = (label: string, base: number, vat: number) =>
      rows.push(`"${label}",${base.toFixed(2)},${vat.toFixed(2)}`);
    add(t("المبيعات الخاضعة للنسبة الأساسية (15%)", "Standard-rated sales (15%)"), v.sales.standardRated.base, v.sales.standardRated.vat);
    add(t("المبيعات للمواطنين (الصحة والتعليم)", "Sales to citizens (health & education)"), v.sales.citizens?.base || 0, v.sales.citizens?.vat || 0);
    add(t("المبيعات الخاضعة للنسبة الصفرية (محلية)", "Zero-rated sales (domestic)"), v.sales.zeroDomestic?.base || 0, 0);
    add(t("الصادرات", "Exports"), v.sales.exports?.base || 0, 0);
    add(t("المبيعات المعفاة", "Exempt sales"), v.sales.exempt.base, 0);
    add(t("إجمالي ضريبة المبيعات", "Total sales tax"), v.sales.totalBase, v.sales.totalVat);
    add(t("المشتريات الخاضعة للنسبة الأساسية (15%)", "Standard-rated purchases (15%)"), v.purchases.deductible.base, v.purchases.deductible.vat);
    add(t("الاستيرادات (الجمارك)", "Imports (customs)"), v.purchases.importCustoms?.base || 0, v.purchases.importCustoms?.vat || 0);
    add(t("الاستيرادات (احتساب عكسي RCM)", "Imports (reverse charge RCM)"), v.purchases.importRcm?.base || 0, v.purchases.importRcm?.vat || 0);
    add(t("المشتريات الصفرية والمعفاة", "Zero-rated & exempt purchases"), v.purchases.zeroExempt?.base || 0, 0);
    add(t("إجمالي ضريبة المشتريات", "Total purchases tax"), v.purchases.totalBase, v.purchases.totalVat);
    add(t("صافي الضريبة المستحقة/المستردة", "Net VAT due/refundable"), 0, v.netVat);
    const csv = rows.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zatca-vat-return-${payload.period.from}_to_${payload.period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print-friendly view (browser print-to-PDF, consistent with the rest of the app).
  const printZatca = () => window.print();

  // ── W30 · country-routed views (US sales tax · generic VAT) ──
  if (isUS) {
    return (
      <UsTaxView
        payload={usPayload} loading={loading} error={error}
        from={from} to={to} setFrom={setFrom} setTo={setTo} reload={load}
      />
    );
  }
  if (!isSA) {
    return (
      <GenericVatView
        payload={vatPayload} loading={loading} error={error} country={country}
        from={from} to={to} setFrom={setFrom} setTo={setTo} reload={load}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الإقرار الضريبي السعودي", "Saudi Tax Return")}</h1>
        <p className="text-muted-foreground mt-1">{t("مطابقة تشغيلية لبنود VAT + جدول ضريبة الاستقطاع من الحوالات مع تعديل النسبة لكل عملية.", "Operational reconciliation of VAT line items plus a withholding tax schedule per remittance with per-transaction rate adjustment.")}</p>
      </div>

      <Card className="border-border">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1 text-sm text-foreground/80">
            <span className="font-semibold">{t("من تاريخ", "From date")}</span>
            <DateInput value={from} onChange={(v) => applyRange(v, to)} inputClassName="h-10 text-sm" />
          </label>
          <label className="space-y-1 text-sm text-foreground/80">
            <span className="font-semibold">{t("إلى تاريخ", "To date")}</span>
            <DateInput value={to} onChange={(v) => applyRange(from, v)} inputClassName="h-10 text-sm" />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}</Button>
            <Button variant="outline" onClick={exportZatcaCsv} disabled={!payload}><Download className="me-2 h-4 w-4" />{t("تصدير ملخص الإقرار", "Export return summary")}</Button>
            <Button variant="outline" onClick={printZatca} disabled={!payload}><Printer className="me-2 h-4 w-4" />{t("طباعة / PDF", "Print / PDF")}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:col-span-3">
            <span className="text-xs text-muted-foreground">{t("فترات جاهزة:", "Quick periods:")}</span>
            {QUARTER_LABELS.map(([q, ar, en]) => {
              const year = new Date().getFullYear();
              const [qf, qt] = quarterRange(year, q);
              const active = from === qf && to === qt;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => applyRange(qf, qt)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border bg-white text-foreground/70 hover:bg-muted"}`}
                >
                  {t(ar, en)} <span className="font-english text-[10px] opacity-70">{year}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => applyRange(monthStartIso(), todayIso())}
              className="rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground/70 transition hover:bg-muted"
            >
              {t("الشهر الحالي", "Current month")}
            </button>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
      ) : payload ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label={t("رقم التسجيل الضريبي", "VAT registration number")} value={payload.org.vatNumber || "—"} mono />
            <Metric label={t("الفترة", "Period")} value={`${payload.period.from} → ${payload.period.to}`} mono />
            <Metric label={t("صافي VAT", "Net VAT")} value={money(payload.vatDeclaration.netVat, currency)} tone={payload.vatDeclaration.netVat >= 0 ? "warn" : "good"} />
            <Metric label={payload.vatDeclaration.netVat >= 0 ? t("المستحق الدفع", "Payable") : t("الرصيد المسترد", "Refundable balance")} value={money(payload.vatDeclaration.netVat >= 0 ? payload.vatDeclaration.payable : payload.vatDeclaration.refundable, currency)} tone={payload.vatDeclaration.netVat >= 0 ? "warn" : "good"} />
          </div>

          {/* Draft review — the filer's eye must pass over unposted documents
              BEFORE approving the return (they never enter the buckets above). */}
          {payload.drafts && payload.drafts.count > 0 && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  {t("مسودات داخل هذه الفترة تحتاج مراجعة", "Drafts inside this period need review")}
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{payload.drafts.count}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs leading-5 text-amber-800/80">
                  {t(
                    "هذه المستندات غير معتمدة ولا تدخل في بنود الإقرار أعلاه. افتحها واعتمدها أو احذفها قبل اعتماد الإقرار النهائي.",
                    "These documents are unposted and excluded from the return lines above. Open each one — post it or delete it — before approving the final return.",
                  )}
                </p>
                <ul className="divide-y divide-amber-200/60 rounded-lg border border-amber-200/70 bg-white">
                  {payload.drafts.invoices.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/app/invoices/${d.id}`)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm transition hover:bg-amber-50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-amber-700" />
                          <span className="truncate font-medium text-foreground">{d.invoiceNumber}</span>
                          <span className="truncate text-xs text-muted-foreground">{d.contactName || "—"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{t("مسودة فاتورة", "Draft invoice")}</span>
                          <span className="font-english">{d.issueDate}</span>
                          <span className="font-semibold text-foreground">{money(d.total, currency)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {payload.drafts.bills.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/app/purchases/bills/${d.id}`)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm transition hover:bg-amber-50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <ShoppingBag className="h-4 w-4 shrink-0 text-amber-700" />
                          <span className="truncate font-medium text-foreground">{d.billNumber}</span>
                          <span className="truncate text-xs text-muted-foreground">{d.contactName || "—"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{t("مسودة مشتريات", "Draft bill")}</span>
                          <span className="font-english">{d.issueDate}</span>
                          <span className="font-semibold text-foreground">{money(d.total, currency)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Section 1 · ضريبة المبيعات / المخرجات (Output Tax) */}
          <Card className="border-border">
            <CardHeader><CardTitle>{t("ضريبة المبيعات / المخرجات", "Sales / Output Tax")}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted text-muted-foreground">
                      <th className="text-start px-4 py-2.5 font-medium">{t("البند", "Line item")}</th>
                      <th className="text-end px-4 py-2.5 font-medium">{t("الأساس الضريبي", "Taxable base")}</th>
                      <th className="text-end px-4 py-2.5 font-medium">{t("الضريبة", "Tax")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <VatRow label={t("المبيعات الخاضعة للنسبة الأساسية (15%)", "Standard-rated sales (15%)")} base={payload.vatDeclaration.sales.standardRated.base} tax={payload.vatDeclaration.sales.standardRated.vat} currency={currency} />
                    <VatRow label={t("المبيعات للمواطنين (الخدمات الصحية والتعليمية)", "Sales to citizens (health & education services)")} base={payload.vatDeclaration.sales.citizens?.base || 0} tax={payload.vatDeclaration.sales.citizens?.vat || 0} currency={currency} />
                    <VatRow label={t("المبيعات الخاضعة للنسبة الصفرية (محلية)", "Zero-rated sales (domestic)")} base={payload.vatDeclaration.sales.zeroDomestic?.base || 0} tax={0} currency={currency} />
                    <VatRow label={t("الصادرات", "Exports")} base={payload.vatDeclaration.sales.exports?.base || 0} tax={0} currency={currency} />
                    <VatRow label={t("المبيعات المعفاة من الضريبة", "Exempt sales")} base={payload.vatDeclaration.sales.exempt.base} tax={0} currency={currency} />
                    <VatRow label={t("إيرادات غير ضريبية", "Non-taxable revenue")} base={payload.vatDeclaration.sales.nonTaxable.base} tax={0} currency={currency} />
                    <VatRow strong label={t("إجمالي ضريبة المبيعات", "Total sales tax")} base={payload.vatDeclaration.sales.totalBase} tax={payload.vatDeclaration.sales.totalVat} currency={currency} />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 · ضريبة المشتريات / المدخلات (Input Tax) */}
          <Card className="border-border">
            <CardHeader><CardTitle>{t("ضريبة المشتريات / المدخلات", "Purchases / Input Tax")}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted text-muted-foreground">
                      <th className="text-start px-4 py-2.5 font-medium">{t("البند", "Line item")}</th>
                      <th className="text-end px-4 py-2.5 font-medium">{t("الأساس الضريبي", "Taxable base")}</th>
                      <th className="text-end px-4 py-2.5 font-medium">{t("الضريبة", "Tax")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <VatRow label={t("المشتريات الخاضعة للنسبة الأساسية (15%)", "Standard-rated purchases (15%)")} base={payload.vatDeclaration.purchases.deductible.base} tax={payload.vatDeclaration.purchases.deductible.vat} currency={currency} />
                    <VatRow label={t("الاستيرادات الخاضعة للضريبة والمدفوعة في الجمارك", "Taxable imports paid at customs")} base={payload.vatDeclaration.purchases.importCustoms?.base || 0} tax={payload.vatDeclaration.purchases.importCustoms?.vat || 0} currency={currency} />
                    <VatRow label={t("الاستيرادات الخاضعة لآلية الاحتساب العكسي (RCM)", "Imports subject to reverse charge (RCM)")} base={payload.vatDeclaration.purchases.importRcm?.base || 0} tax={payload.vatDeclaration.purchases.importRcm?.vat || 0} currency={currency} />
                    <VatRow label={t("المشتريات الخاضعة للنسبة الصفرية والمعفاة", "Zero-rated & exempt purchases")} base={payload.vatDeclaration.purchases.zeroExempt?.base || 0} tax={0} currency={currency} />
                    <VatRow strong label={t("إجمالي ضريبة المشتريات", "Total purchases tax")} base={payload.vatDeclaration.purchases.totalBase} tax={payload.vatDeclaration.purchases.totalVat} currency={currency} />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section 3 · صافي الضريبة المستحقة / المستردة (Net VAT) */}
          <Card className="border-border">
            <CardHeader><CardTitle>{t("صافي الضريبة المستحقة / المستردة", "Net VAT Due / Refundable")}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="px-4 py-2.5">{t("إجمالي ضريبة المبيعات (المخرجات)", "Total sales tax (output)")}</td>
                      <td className="px-4 py-2.5 text-end font-english font-semibold" dir="ltr">{money(payload.vatDeclaration.sales.totalVat, currency)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="px-4 py-2.5">{t("إجمالي ضريبة المشتريات (المدخلات)", "Total purchases tax (input)")}</td>
                      <td className="px-4 py-2.5 text-end font-english font-semibold" dir="ltr">{money(payload.vatDeclaration.purchases.totalVat, currency)}</td>
                    </tr>
                    <tr className="border-t-2 border-border bg-muted/50">
                      <td className="px-4 py-2.5 font-bold">{payload.vatDeclaration.netVat >= 0 ? t("صافي الضريبة المستحقة", "Net VAT due") : t("صافي الضريبة المستردة", "Net VAT refundable")}</td>
                      <td className="px-4 py-2.5 text-end font-english font-bold" dir="ltr">{money(payload.vatDeclaration.netVat >= 0 ? payload.vatDeclaration.payable : payload.vatDeclaration.refundable, currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {isSA
                  ? t("هذه قراءة تشغيلية لفترة محددة. الإرسال الرسمي إلى ZATCA يتطلب المراجعة المحاسبية النهائية قبل التقديم.", "This is an operational read for a selected period. Official ZATCA filing requires final accounting review before submission.")
                  : "Operational read for the selected period · final filing requires your accountant's review before submission."}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle>{t("ضريبة الاستقطاع (حسب الحوالات)", "Withholding Tax (by remittance)")}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted text-muted-foreground">
                      <th className="text-start px-4 py-2.5 font-medium">{t("رقم السند", "Voucher no.")}</th>
                      <th className="text-start px-4 py-2.5 font-medium">{t("التاريخ", "Date")}</th>
                      <th className="text-start px-4 py-2.5 font-medium">{t("المستفيد", "Beneficiary")}</th>
                      <th className="text-start px-4 py-2.5 font-medium">{t("نوع الحوالة", "Transfer type")}</th>
                      <th className="text-end px-4 py-2.5 font-medium">{t("مبلغ الأساس", "Base amount")}</th>
                      <th className="text-start px-4 py-2.5 font-medium">{t("النسبة", "Rate")}</th>
                      <th className="text-end px-4 py-2.5 font-medium">{t("قيمة الاستقطاع", "Withholding amount")}</th>
                      <th className="text-center px-4 py-2.5 font-medium">{t("الإجراء", "Action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.withholding.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground/70">{t("لا توجد حوالات في الفترة المحددة.", "No remittances in the selected period.")}</td>
                      </tr>
                    ) : (
                      payload.withholding.rows.map((row) => {
                        const draft = withholdingDraft[row.voucherId] || { rate: row.rate, transferType: row.transferType };
                        const calc = (row.baseAmount * Number(draft.rate || 0)) / 100;
                        return (
                          <tr key={row.voucherId} className="border-b border-border/50 hover:bg-primary/5">
                            <td className="px-4 py-2.5"><span dir="ltr" className="font-english inline-block font-semibold">{row.number}</span></td>
                            <td className="px-4 py-2.5"><span dir="ltr" className="font-english inline-block">{row.date}</span></td>
                            <td className="px-4 py-2.5">{row.beneficiary}</td>
                            <td className="px-4 py-2.5">
                              <select
                                value={draft.transferType}
                                onChange={(e) => updateDraft(row.voucherId, { transferType: e.target.value as TaxReturnWithholdingRow["transferType"] })}
                                className="h-9 rounded border border-border px-2 bg-white"
                              >
                                <option value="SERVICE">{t(transferTypeLabel.SERVICE.ar, transferTypeLabel.SERVICE.en)}</option>
                                <option value="ROYALTY">{t(transferTypeLabel.ROYALTY.ar, transferTypeLabel.ROYALTY.en)}</option>
                                <option value="INTEREST">{t(transferTypeLabel.INTEREST.ar, transferTypeLabel.INTEREST.en)}</option>
                                <option value="OTHER">{t(transferTypeLabel.OTHER.ar, transferTypeLabel.OTHER.en)}</option>
                              </select>
                            </td>
                            <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block">{money(row.baseAmount, row.currency)}</span></td>
                            <td className="px-4 py-2.5">
                              <select
                                value={String(draft.rate)}
                                onChange={(e) => updateDraft(row.voucherId, { rate: Number(e.target.value) })}
                                className="h-9 rounded border border-border px-2 bg-white"
                              >
                                <option value="5">5%</option>
                                <option value="15">15%</option>
                                <option value="20">20%</option>
                                <option value="0">0%</option>
                              </select>
                            </td>
                            <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block font-semibold">{money(calc, row.currency)}</span></td>
                            <td className="px-4 py-2.5 text-center">
                              <Button size="sm" variant="outline" onClick={() => saveWithholding(row)} disabled={savingVoucherId === row.voucherId}>
                                {savingVoucherId === row.voucherId ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-1 h-4 w-4" /> {t("حفظ", "Save")}</>}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 border-t border-border">
                      <td className="px-4 py-2.5 font-semibold" colSpan={4}>{t("الإجمالي", "Total")}</td>
                      <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block font-semibold">{money(withholdingTotals.totalBase, currency)}</span></td>
                      <td className="px-4 py-2.5">—</td>
                      <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block font-bold">{money(withholdingTotals.totalWithholding, currency)}</span></td>
                      <td className="px-4 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone = "default", mono = false }: { label: string; value: string; tone?: "default" | "warn" | "good"; mono?: boolean }) {
  const colors = tone === "good" ? "border-emerald-200 bg-emerald-50" : tone === "warn" ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return (
    <div className={`rounded-lg border px-4 py-3 ${colors}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold text-foreground ${mono ? "font-english" : ""}`}>{value}</div>
    </div>
  );
}

function VatRow({ label, base, tax, currency, strong = false }: { label: string; base: number; tax: number; currency: string; strong?: boolean }) {
  return (
    <tr className="border-b border-border/50">
      <td className={`px-4 py-2.5 ${strong ? "font-semibold" : ""}`}>{label}</td>
      <td className="px-4 py-2.5 text-end"><span dir="ltr" className={`font-english inline-block ${strong ? "font-semibold" : ""}`}>{money(base, currency)}</span></td>
      <td className="px-4 py-2.5 text-end"><span dir="ltr" className={`font-english inline-block ${strong ? "font-semibold" : ""}`}>{money(tax, currency)}</span></td>
    </tr>
  );
}


// ═══ W30 · US Sales Tax Summary + IRS filing guide ═══
function UsTaxView({ payload, loading, error, from, to, setFrom, setTo, reload }: {
  payload: UsSalesTaxPayload | null; loading: boolean; error: string | null;
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; reload: () => void;
}) {
  const { t } = useLanguage();
  const cur = payload?.currency || "USD";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("ملخص ضريبة المبيعات الأمريكية", "US Sales Tax Summary")}</h1>
        <p className="text-muted-foreground mt-1">{t("المبيعات والضريبة المحصلة حسب الولاية + النموذج الفيدرالي المناسب لنوع شركتك — اطبعه أو عبّ منه إقرارك.", "Sales & collected tax by state, plus the federal form that fits your entity type — print it or fill your return from it.")}</p>
      </div>
      <Card className="border-border">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1 text-sm text-foreground/80"><span className="font-semibold">{t("من تاريخ", "From date")}</span><DateInput value={from} onChange={setFrom} inputClassName="h-10 text-sm" /></label>
          <label className="space-y-1 text-sm text-foreground/80"><span className="font-semibold">{t("إلى تاريخ", "To date")}</span><DateInput value={to} onChange={setTo} inputClassName="h-10 text-sm" /></label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reload}><RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}</Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!payload}><Printer className="me-2 h-4 w-4" />{t("طباعة / PDF", "Print / PDF")}</Button>
          </div>
        </CardContent>
      </Card>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
      ) : payload ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              [t("إجمالي المبيعات", "Gross sales"), money(payload.sales.grossSales, cur)],
              [t("معفاة / بدون ضريبة", "Exempt / untaxed"), money(payload.sales.exemptSales, cur)],
              [t("مبيعات خاضعة", "Taxable sales"), money(payload.sales.taxableSales, cur)],
              [t("الضريبة المحصلة", "Tax collected"), money(payload.sales.taxCollected, cur)],
            ].map(([l, v]) => (
              <Card key={l as string} className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.15rem" }} dir="ltr">{v}</div></CardContent></Card>
            ))}
          </div>

          {payload.irsGuide && (
            <Card className="border-blue-200 bg-blue-50/60">
              <CardHeader><CardTitle className="text-foreground text-base">{t("نموذجك الفيدرالي (IRS)", "Your federal (IRS) form")}: {payload.irsGuide.form}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm text-foreground/80">
                <div>{t(payload.irsGuide.titleAr, payload.irsGuide.title)}</div>
                {payload.irsGuide.notes.map((n, i) => <div key={i} className="flex gap-2"><span className="text-blue-600">•</span><span>{n}</span></div>)}
                {payload.hint && <div className="mt-2 rounded-lg bg-white/70 border border-blue-100 px-3 py-2 text-xs text-blue-900">💡 {payload.hint}</div>}
                {payload.org.ein && <div className="text-xs text-muted-foreground mt-1">EIN: <span className="font-english">{payload.org.ein}</span>{payload.org.state ? ` · ${t("الولاية", "State")}: ${payload.org.state}` : ""}</div>}
              </CardContent>
            </Card>
          )}

          {payload.formPreview && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader>
                <CardTitle className="text-foreground text-base">{t("ملخص نموذج الإقرار القابل للطباعة", "Printable filing preview")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-foreground/80">
                <div>{t("الفترة", "Period")}: <span className="font-english">{payload.formPreview.period.label}</span></div>
                <div>{t("الكيان", "Entity")}: {payload.formPreview.identity.companyName}</div>
                {payload.formPreview.filing?.form && (
                  <div>{t("النموذج الفيدرالي", "Federal form")}: <span className="font-semibold">{payload.formPreview.filing.form}</span></div>
                )}
                <div>{t("إجمالي المبيعات", "Gross sales")}: <span className="font-english" dir="ltr">{money(payload.formPreview.summary.grossSales, cur)}</span></div>
                <div>{t("الضريبة المحصلة", "Tax collected")}: <span className="font-english" dir="ltr">{money(payload.formPreview.summary.taxCollected, cur)}</span></div>
                <div className="text-xs text-emerald-900/80">{t("يمكنك استخدام هذا الملخص كنسخة مراجعة/طباعة قبل تقديم الإقرار الرسمي.", "You can use this as a printable review artifact before official filing.")}</div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardHeader><CardTitle className="text-foreground text-base">{t("حسب الولاية", "By state")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground"><th className="px-4 py-2 text-start font-medium">{t("الولاية", "State")}</th><th className="px-4 py-2 text-end font-medium">{t("الأساس", "Base")}</th><th className="px-4 py-2 text-end font-medium">{t("الضريبة", "Tax")}</th></tr></thead>
                <tbody>
                  {payload.sales.byState.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">{t("لا مبيعات في الفترة", "No sales in this period")}</td></tr>}
                  {payload.sales.byState.map((r) => (
                    <tr key={r.state} className="border-b border-border/60">
                      <td className="px-4 py-2.5 text-foreground">{r.state}</td>
                      <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block">{money(r.base, cur)}</span></td>
                      <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block">{money(r.tax, cur)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

// ═══ W30 · Generic VAT return (AE/GCC/…) at the org's own rate ═══
function GenericVatView({ payload, loading, error, country, from, to, setFrom, setTo, reload }: {
  payload: VatSummaryPayload | null; loading: boolean; error: string | null; country: string;
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; reload: () => void;
}) {
  const { t } = useLanguage();
  const cur = payload?.currency || "SAR";
  const ratePct = payload?.standardRate != null ? Math.round(payload.standardRate * 100) : null;
  const Row = ({ label, base, tax, strong }: { label: string; base: number; tax: number; strong?: boolean }) => (
    <tr className="border-b border-border/60">
      <td className={`px-4 py-2.5 text-foreground ${strong ? "font-semibold" : ""}`}>{label}</td>
      <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block">{money(base, cur)}</span></td>
      <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block">{money(tax, cur)}</span></td>
    </tr>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الإقرار الضريبي", "VAT Return")} · {country}</h1>
        <p className="text-muted-foreground mt-1">{t(`بنود VAT بمعدل بلدك${ratePct != null ? ` (${ratePct}%)` : ""} — اطبعها أو عبّ منها إقرارك الرسمي.`, `VAT lines at your country's rate${ratePct != null ? ` (${ratePct}%)` : ""} — print or fill your official return from them.`)}</p>
      </div>
      <Card className="border-border">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1 text-sm text-foreground/80"><span className="font-semibold">{t("من تاريخ", "From date")}</span><DateInput value={from} onChange={setFrom} inputClassName="h-10 text-sm" /></label>
          <label className="space-y-1 text-sm text-foreground/80"><span className="font-semibold">{t("إلى تاريخ", "To date")}</span><DateInput value={to} onChange={setTo} inputClassName="h-10 text-sm" /></label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reload}><RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}</Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!payload}><Printer className="me-2 h-4 w-4" />{t("طباعة / PDF", "Print / PDF")}</Button>
          </div>
        </CardContent>
      </Card>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
      ) : payload ? (
        <>
          {payload.formPreview && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader>
                <CardTitle className="text-foreground text-base">{t("ملخص نموذج VAT القابل للطباعة", "Printable VAT filing preview")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-foreground/80">
                <div>{t("الفترة", "Period")}: <span className="font-english">{payload.formPreview.period.label}</span></div>
                <div>{t("المنشأة", "Company")}: {payload.formPreview.identity.companyName}</div>
                {payload.formPreview.identity.vatNumber && (
                  <div>{t("الرقم الضريبي", "VAT number")}: <span className="font-english">{payload.formPreview.identity.vatNumber}</span></div>
                )}
                <div>{t("صافي الضريبة", "Net VAT")}: <span className="font-english" dir="ltr">{money(payload.formPreview.net.due, cur)}</span> · {payload.formPreview.net.direction === "payable" ? t("مستحق", "Payable") : t("مسترد", "Refundable")}</div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground"><th className="px-4 py-2 text-start font-medium">{t("البند", "Line item")}</th><th className="px-4 py-2 text-end font-medium">{t("الأساس الضريبي", "Taxable base")}</th><th className="px-4 py-2 text-end font-medium">{t("الضريبة", "Tax")}</th></tr></thead>
                <tbody>
                  <Row label={t(`مبيعات بالنسبة الأساسية${ratePct != null ? ` (${ratePct}%)` : ""}`, `Standard-rated sales${ratePct != null ? ` (${ratePct}%)` : ""}`)} base={payload.sales.standardBase} tax={payload.sales.standardVat} />
                  <Row label={t("مبيعات صفرية (محلية)", "Zero-rated sales (domestic)")} base={payload.sales.zeroBase} tax={0} />
                  <Row label={t("الصادرات", "Exports")} base={payload.sales.exportsBase} tax={0} />
                  <Row label={t("مبيعات معفاة", "Exempt sales")} base={payload.sales.exemptBase} tax={0} />
                  <Row label={t(`مشتريات بالنسبة الأساسية${ratePct != null ? ` (${ratePct}%)` : ""}`, `Standard-rated purchases${ratePct != null ? ` (${ratePct}%)` : ""}`)} base={payload.purchases.standardBase} tax={payload.purchases.standardVat} />
                  <Row label={t("مشتريات صفرية ومعفاة", "Zero-rated & exempt purchases")} base={payload.purchases.zeroExemptBase} tax={0} />
                  <Row label={t("صافي الضريبة المستحقة / المستردة", "Net VAT due / refundable")} base={0} tax={payload.net.due} strong />
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
