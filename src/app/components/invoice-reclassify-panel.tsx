/**
 * Reclassify an issued invoice · CEO 2026-09-21
 *
 * "An approved and paid invoice must not be stuck forever — let me fix the
 * account it landed on, the way Xero does."
 *
 * The line between what may change and what may not is the money. Amounts,
 * tax, number, dates and customer are what the client received and what the
 * authority saw: those move only through a credit note. WHERE the same amount
 * sits in the chart of accounts is bookkeeping — leaving a wrong revenue
 * account untouchable just keeps the books wrong.
 *
 * The API enforces all of it: role, org ownership, revenue-only accounts, and
 * a rollback if a single figure moves. This panel only collects the intent.
 * UX-1: no dialog — the panel expands in place and confirms inline.
 */
import { useState } from "react";
import { Loader2, Tags } from "lucide-react";
import { Button } from "./ui/button";
import { SearchableCombobox } from "./searchable-combobox";
import { api, ApiError, type Invoice } from "../lib/api";
import { useLanguage } from "./LanguageContext";

type AccountOption = { id: string; code?: string | null; name: string; type?: string };

export function InvoiceReclassifyPanel({
  invoice, accounts, onDone,
}: {
  invoice: Invoice;
  accounts: AccountOption[];
  onDone: () => Promise<void> | void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});

  const lines = (invoice.lines || []) as Array<{ id: string; description: string; accountId?: string | null; subtotal?: unknown }>;
  const revenue = accounts.filter((a) => a.type === "REVENUE" || a.type === "INCOME");
  const changed = lines.filter((l) => choice[l.id] !== undefined && choice[l.id] !== (l.accountId || ""));

  const submit = async () => {
    if (!changed.length) return;
    setBusy(true); setError(null);
    try {
      await api.invoices.reclassify(invoice.id, {
        lines: changed.map((l) => ({ lineId: l.id, accountId: choice[l.id] || null })),
        reason: reason.trim() || undefined,
      });
      setDone(true);
      setChoice({});
      await onDone();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذّرت إعادة التصنيف", "Reclassification failed"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-lg border border-border p-4" data-testid="invoice-reclassify">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{t("إعادة تصنيف محاسبي", "Reclassify")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "تغيير حساب الإيراد لكل بند دون المساس بالمبالغ أو الضريبة. يُسجَّل في سجل التدقيق.",
                "Change the revenue account per line without touching amounts or tax. Written to the audit log.",
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => setOpen(true)} className="shrink-0 gap-2">
            <Tags className="h-4 w-4" strokeWidth={1.75} />{t("إعادة تصنيف", "Reclassify")}
          </Button>
        </div>
        {done && (
          <p className="mt-3 text-sm text-success">{t("تم حفظ إعادة التصنيف", "Reclassification saved")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4" data-testid="invoice-reclassify-open">
      <div>
        <p className="font-semibold text-foreground">{t("إعادة تصنيف محاسبي", "Reclassify")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "المبالغ والضريبة ورقم الفاتورة وتواريخها والعميل لا تتغيّر — تصحيحها بإشعار دائن.",
            "Amounts, tax, number, dates and customer do not change — correcting those needs a credit note.",
          )}
        </p>
      </div>

      <div className="ledger-table overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <colgroup><col /><col style={{ width: "300px" }} /></colgroup>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">{t("البند", "Line")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("حساب الإيراد", "Revenue account")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-border/50">
                <td className="px-3 py-2 align-middle">
                  <div className="truncate text-start text-foreground"><bdi dir="auto">{l.description}</bdi></div>
                </td>
                <td className="px-3 py-2">
                  <SearchableCombobox
                    value={choice[l.id] ?? (l.accountId || "")}
                    onChange={(id) => setChoice((prev) => ({ ...prev, [l.id]: id }))}
                    items={revenue.map((a) => ({ id: a.id, label: a.name, sublabel: a.code || undefined }))}
                    placeholder={t("اختر حساباً", "Choose an account")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <label className="mb-1 block text-xs text-foreground/80">{t("سبب التعديل", "Reason")}</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("مثال: البند يخص إيراد الاشتراكات وليس الخدمات", "e.g. this line is subscription revenue, not services")}
          className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
          data-testid="reclassify-reason"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="me-auto text-xs text-muted-foreground">
          {changed.length
            ? t(`${changed.length} بند سيتغيّر`, `${changed.length} line(s) will change`)
            : t("لم تغيّر شيئاً بعد", "Nothing changed yet")}
        </span>
        <Button variant="outline" onClick={() => { setOpen(false); setChoice({}); setError(null); }} disabled={busy}>
          {t("إلغاء", "Cancel")}
        </Button>
        <Button onClick={submit} disabled={busy || !changed.length} data-testid="reclassify-save">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حفظ إعادة التصنيف", "Save reclassification")}
        </Button>
      </div>
    </div>
  );
}
