/**
 * «معدلات الضريبة» — the org's VAT catalogue, managed inline.
 *
 * This is the settings surface for `/api/tax-rates`. It lives on the الضرائب page
 * (next to the return) rather than in a new page, because that is where a CEO
 * looking for «الضريبة» already goes.
 *
 * UX-1: no dialogs. Adding a rate is an inline row, deleting is `InlineConfirm`,
 * and every outcome is a toast. A rate that documents already reference is
 * DEACTIVATED by the API rather than deleted, and the toast says so.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { InlineAlert } from "./product";
import { InlineConfirm } from "./side-panel";
import { useLanguage } from "./LanguageContext";
import { api, ApiError, type TaxRate } from "../lib/api";
import { refreshTaxRates, taxRatePercentLabel } from "../lib/use-tax-rates";
import { normalizeDigits } from "../lib/digits";

const TYPE_LABELS: Record<TaxRate["type"], { ar: string; en: string }> = {
  STANDARD: { ar: "أساسية", en: "Standard" },
  ZERO_RATED: { ar: "خاضعة بنسبة صفر", en: "Zero-rated" },
  EXEMPT: { ar: "معفاة", en: "Exempt" },
};

const EMPTY_DRAFT = { name: "", nameAr: "", rate: "", type: "STANDARD" as TaxRate["type"], isInclusive: false };

const toast = (kind: "success" | "error" | "info", message: string) =>
  window.dispatchEvent(new CustomEvent("entix:toast", { detail: { kind, message } }));

export function TaxRatesSection() {
  const { t, language } = useLanguage();
  const [items, setItems] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await api.taxRates.list()).items || []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : t("تعذر تحميل معدلات الضريبة", "Could not load the tax rates"));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  /** Every write invalidates the grid's cached catalogue so line editors see it. */
  const after = async () => { refreshTaxRates(); await load(); };

  const create = async () => {
    const name = draft.name.trim() || draft.nameAr.trim();
    if (!name) { toast("error", t("اكتب اسم المعدل", "Give the rate a name")); return; }
    const rate = normalizeDigits(draft.rate).trim();
    if (rate === "") { toast("error", t("اكتب النسبة (مثال 15)", "Enter the rate (e.g. 15)")); return; }
    setBusy("create");
    try {
      await api.taxRates.create({
        name,
        nameAr: draft.nameAr.trim() || null,
        rate,
        type: draft.type,
        isInclusive: draft.isInclusive,
      });
      setDraft({ ...EMPTY_DRAFT });
      setAdding(false);
      await after();
      toast("success", t("أُضيف المعدل", "Rate added"));
    } catch (e: unknown) {
      toast("error", e instanceof ApiError ? e.message : t("تعذر إضافة المعدل", "Could not add the rate"));
    } finally { setBusy(null); }
  };

  const makeDefault = async (rate: TaxRate) => {
    setBusy(rate.id);
    try {
      await api.taxRates.update(rate.id, { isDefault: true });
      await after();
      toast("success", t("صار المعدل الافتراضي للبنود الجديدة", "New lines now start on this rate"));
    } catch { toast("error", t("تعذر التحديث", "Could not update")); }
    finally { setBusy(null); }
  };

  const remove = async (rate: TaxRate) => {
    setBusy(rate.id);
    try {
      const res = await api.taxRates.remove(rate.id) as { deactivated?: boolean; usedBy?: number } | void;
      setPendingDelete(null);
      await after();
      toast("success", res && (res as any).deactivated
        ? t(`المعدل مستخدم في ${(res as any).usedBy} مستنداً — تم تعطيله بدل حذفه`, `Used by ${(res as any).usedBy} documents — deactivated instead of deleted`)
        : t("حُذف المعدل", "Rate deleted"));
    } catch { toast("error", t("تعذر الحذف", "Could not delete")); }
    finally { setBusy(null); }
  };

  const typeLabel = (type: TaxRate["type"]) =>
    language === "ar" ? TYPE_LABELS[type].ar : TYPE_LABELS[type].en;

  return (
    <section className="space-y-3" data-testid="tax-rates-section">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-section font-semibold text-foreground">{t("معدلات الضريبة", "Tax rates")}</h2>
          <p className="mt-0.5 text-xs text-content-secondary">
            {t(
              "هذه هي النسب التي تظهر في قائمة الضريبة داخل الفواتير وعروض الأسعار · «افتراضي» هو ما يبدأ عليه أي بند جديد.",
              "These are the rates the tax dropdown offers on invoices and quotes · «Default» is what a new line starts on.",
            )}
          </p>
        </div>
        {!adding && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)} data-testid="tax-rate-add">
            <Plus className="me-1.5 h-3.5 w-3.5" strokeWidth={1.75} />{t("معدل جديد", "New rate")}
          </Button>
        )}
      </div>

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      {adding && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="tax-rate-form">
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-content-secondary">{t("الاسم بالعربية", "Arabic name")}</Label>
            <Input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} placeholder={t("ضريبة القيمة المضافة 15%", "VAT 15%")} />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-content-secondary">{t("الاسم بالإنجليزية", "English name")}</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="VAT 15%" dir="ltr" />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-content-secondary">{t("النسبة %", "Rate %")}</Label>
            <Input value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: normalizeDigits(e.target.value) })} inputMode="decimal" dir="ltr" className="font-english" placeholder="15" data-testid="tax-rate-value" />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-content-secondary">{t("النوع", "Type")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TYPE_LABELS) as TaxRate["type"][]).map((type) => (
                <button
                  key={type} type="button"
                  onClick={() => setDraft({ ...draft, type })}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${draft.type === type ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-content-secondary hover:border-primary/50"}`}
                >{typeLabel(type)}</button>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 items-end gap-2">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, isInclusive: !draft.isInclusive })}
              className={`h-9 shrink-0 rounded-full border px-3 text-xs transition-colors ${draft.isInclusive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-content-secondary"}`}
            >{draft.isInclusive ? t("شامل", "Inclusive") : t("غير شامل", "Exclusive")}</button>
            <Button type="button" size="sm" onClick={create} disabled={busy === "create"} data-testid="tax-rate-save">
              {busy === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("حفظ", "Save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(false); setDraft({ ...EMPTY_DRAFT }); }}>
              {t("إلغاء", "Cancel")}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="ledger-table overflow-x-auto">
          <Table className="min-w-[640px] table-fixed text-sm">
            <colgroup>
              <col />
              <col style={{ width: "110px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "170px" }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("المعدل", "Rate")}</TableHead>
                <TableHead className="text-end">{t("النسبة", "Percent")}</TableHead>
                <TableHead className="text-start">{t("النوع", "Type")}</TableHead>
                <TableHead className="text-start">{t("السعر", "Price")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id} data-testid={`tax-rate-row-${r.id}`}>
                  <TableCell>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-foreground"><bdi dir="auto">{language === "ar" ? r.nameAr || r.name : r.name}</bdi></span>
                      {r.isDefault && (
                        <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] text-content-secondary">{t("افتراضي", "Default")}</span>
                      )}
                      {!r.isActive && (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{t("معطّل", "Inactive")}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-end font-english tabular-nums text-foreground" dir="ltr">{taxRatePercentLabel(r.rate)}</TableCell>
                  <TableCell className="text-content-secondary">{typeLabel(r.type)}</TableCell>
                  <TableCell className="text-content-secondary">{r.isInclusive ? t("شامل الضريبة", "Tax-inclusive") : t("غير شامل", "Tax-exclusive")}</TableCell>
                  <TableCell>
                    {pendingDelete === r.id ? (
                      <InlineConfirm onConfirm={() => remove(r)} onCancel={() => setPendingDelete(null)} />
                    ) : (
                      <span className="flex items-center justify-end gap-1">
                        {!r.isDefault && (
                          <button
                            type="button"
                            onClick={() => makeDefault(r)}
                            disabled={busy === r.id}
                            className="rounded-full border border-border px-2 py-1 text-[11px] text-content-secondary hover:text-primary"
                            data-testid={`tax-rate-default-${r.id}`}
                          >
                            <Check className="me-1 inline h-3 w-3" />{t("اجعله افتراضياً", "Make default")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPendingDelete(r.id)}
                          aria-label={t("حذف", "Delete")}
                          className="rounded p-1 text-content-secondary hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!items.length && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">{t("لا توجد معدلات بعد", "No rates yet")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
