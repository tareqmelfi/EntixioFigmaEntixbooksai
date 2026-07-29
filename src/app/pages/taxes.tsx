import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, type TaxReturnPayload, type TaxReturnWithholdingRow } from "../lib/api";

const money = (value: number, currency = "SAR") =>
  `${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

const transferTypeLabel: Record<TaxReturnWithholdingRow["transferType"], string> = {
  SERVICE: "خدمات",
  ROYALTY: "إتاوة / امتياز",
  INTEREST: "فوائد",
  OTHER: "أخرى",
};

export function Taxes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") || monthStartIso());
  const [to, setTo] = useState(searchParams.get("to") || todayIso());

  const [payload, setPayload] = useState<TaxReturnPayload | null>(null);
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
      const data = await api.taxReturn.saVat({ from, to });
      setPayload(data);
      const seed: Record<string, { rate: number; transferType: TaxReturnWithholdingRow["transferType"] }> = {};
      data.withholding.rows.forEach((row) => {
        seed[row.voucherId] = { rate: row.rate, transferType: row.transferType };
      });
      setWithholdingDraft(seed);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "تعذر تحميل بيانات الإقرار الضريبي");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [from, to]);

  const currency = payload?.org.baseCurrency || "SAR";

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
      setError(e instanceof ApiError ? e.message : "تعذر حفظ تعديل الاستقطاع");
    } finally {
      setSavingVoucherId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الإقرار الضريبي السعودي</h1>
        <p className="text-muted-foreground mt-1">مطابقة تشغيلية لبنود VAT + جدول ضريبة الاستقطاع من الحوالات مع تعديل النسبة لكل عملية.</p>
      </div>

      <Card className="border-border">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1 text-sm text-foreground/80">
            <span className="font-semibold">من تاريخ</span>
            <input value={from} onChange={(event) => setFrom(event.target.value)} type="date" className="h-10 w-full rounded-lg border border-border px-3 outline-none focus:border-[#1276E3]" />
          </label>
          <label className="space-y-1 text-sm text-foreground/80">
            <span className="font-semibold">إلى تاريخ</span>
            <input value={to} onChange={(event) => setTo(event.target.value)} type="date" className="h-10 w-full rounded-lg border border-border px-3 outline-none focus:border-[#1276E3]" />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="me-2 h-4 w-4" />تحديث</Button>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
      ) : payload ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="رقم التسجيل الضريبي" value={payload.org.vatNumber || "—"} mono />
            <Metric label="الفترة" value={`${payload.period.from} → ${payload.period.to}`} mono />
            <Metric label="صافي VAT" value={money(payload.vatDeclaration.netVat, currency)} tone={payload.vatDeclaration.netVat >= 0 ? "warn" : "good"} />
            <Metric label={payload.vatDeclaration.netVat >= 0 ? "المستحق الدفع" : "الرصيد المسترد"} value={money(payload.vatDeclaration.netVat >= 0 ? payload.vatDeclaration.payable : payload.vatDeclaration.refundable, currency)} tone={payload.vatDeclaration.netVat >= 0 ? "warn" : "good"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border">
              <CardHeader><CardTitle>بنود إقرار VAT</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted text-muted-foreground">
                        <th className="text-start px-4 py-2.5 font-medium">البند</th>
                        <th className="text-end px-4 py-2.5 font-medium">الأساس الضريبي</th>
                        <th className="text-end px-4 py-2.5 font-medium">الضريبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      <VatRow label="المبيعات الخاضعة للضريبة (15%)" base={payload.vatDeclaration.sales.standardRated.base} tax={payload.vatDeclaration.sales.standardRated.vat} currency={currency} />
                      <VatRow label="المبيعات بنسبة صفرية" base={payload.vatDeclaration.sales.zeroRated.base} tax={payload.vatDeclaration.sales.zeroRated.vat} currency={currency} />
                      <VatRow label="المبيعات المعفاة" base={payload.vatDeclaration.sales.exempt.base} tax={payload.vatDeclaration.sales.exempt.vat} currency={currency} />
                      <VatRow label="إيرادات غير ضريبية" base={payload.vatDeclaration.sales.nonTaxable.base} tax={payload.vatDeclaration.sales.nonTaxable.vat} currency={currency} />
                      <VatRow strong label="إجمالي المبيعات" base={payload.vatDeclaration.sales.totalBase} tax={payload.vatDeclaration.sales.totalVat} currency={currency} />

                      <VatRow label="المشتريات القابلة للخصم" base={payload.vatDeclaration.purchases.deductible.base} tax={payload.vatDeclaration.purchases.deductible.vat} currency={currency} />
                      <VatRow label="المشتريات الصفرية" base={payload.vatDeclaration.purchases.zeroRated.base} tax={payload.vatDeclaration.purchases.zeroRated.vat} currency={currency} />
                      <VatRow label="المشتريات المعفاة" base={payload.vatDeclaration.purchases.exempt.base} tax={payload.vatDeclaration.purchases.exempt.vat} currency={currency} />
                      <VatRow label="الواردات" base={payload.vatDeclaration.purchases.imports.base} tax={payload.vatDeclaration.purchases.imports.vat} currency={currency} />
                      <VatRow strong label="إجمالي المشتريات" base={payload.vatDeclaration.purchases.totalBase} tax={payload.vatDeclaration.purchases.totalVat} currency={currency} />

                      <tr className="border-t-2 border-border bg-muted/50">
                        <td className="px-4 py-2.5 font-semibold">صافي الضريبة</td>
                        <td className="px-4 py-2.5 text-end">—</td>
                        <td className="px-4 py-2.5 text-end font-english font-bold" dir="ltr">{money(payload.vatDeclaration.netVat, currency)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle>التوضيح المالي</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <TaxLine label="الإيراد العام" value={payload.breakdown.grossRevenue} currency={currency} />
                <TaxLine label="الضريبة" value={payload.breakdown.taxAmount} currency={currency} />
                <TaxLine label="الإجمالي" value={payload.breakdown.totalRevenueIncludingTax} currency={currency} strong />
                <TaxLine label="الإيرادات غير الضريبية" value={payload.breakdown.nonTaxRevenue} currency={currency} />
                <TaxLine label="المصاريف" value={payload.breakdown.expensesTotal} currency={currency} />
                <TaxLine label="ضريبة المدخلات" value={payload.breakdown.expensesTax} currency={currency} />

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  هذه قراءة تشغيلية لفترة محددة. الإرسال الرسمي إلى ZATCA يتطلب المراجعة المحاسبية النهائية قبل التقديم.
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader><CardTitle>ضريبة الاستقطاع (حسب الحوالات)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted text-muted-foreground">
                      <th className="text-start px-4 py-2.5 font-medium">رقم السند</th>
                      <th className="text-start px-4 py-2.5 font-medium">التاريخ</th>
                      <th className="text-start px-4 py-2.5 font-medium">المستفيد</th>
                      <th className="text-start px-4 py-2.5 font-medium">نوع الحوالة</th>
                      <th className="text-end px-4 py-2.5 font-medium">مبلغ الأساس</th>
                      <th className="text-start px-4 py-2.5 font-medium">النسبة</th>
                      <th className="text-end px-4 py-2.5 font-medium">قيمة الاستقطاع</th>
                      <th className="text-center px-4 py-2.5 font-medium">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.withholding.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground/70">لا توجد حوالات في الفترة المحددة.</td>
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
                                <option value="SERVICE">{transferTypeLabel.SERVICE}</option>
                                <option value="ROYALTY">{transferTypeLabel.ROYALTY}</option>
                                <option value="INTEREST">{transferTypeLabel.INTEREST}</option>
                                <option value="OTHER">{transferTypeLabel.OTHER}</option>
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
                                <option value="20">20%</option>
                                <option value="0">0%</option>
                              </select>
                            </td>
                            <td className="px-4 py-2.5 text-end"><span dir="ltr" className="font-english inline-block font-semibold">{money(calc, row.currency)}</span></td>
                            <td className="px-4 py-2.5 text-center">
                              <Button size="sm" variant="outline" onClick={() => saveWithholding(row)} disabled={savingVoucherId === row.voucherId}>
                                {savingVoucherId === row.voucherId ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-1 h-4 w-4" /> حفظ</>}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 border-t border-border">
                      <td className="px-4 py-2.5 font-semibold" colSpan={4}>الإجمالي</td>
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

function TaxLine({ label, value, currency, strong = false }: { label: string; value: number; currency: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "text-base" : "text-sm"}`}>
      <span className="text-foreground/80">{label}</span>
      <span className={`font-english ${strong ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`} dir="ltr">{money(value, currency)}</span>
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
