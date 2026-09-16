/**
 * Unmatched bank transactions · stage 2 of the import (2026-09-16)
 *
 * The CEO's rule: the money is recorded the day it moves; the invoice or the
 * journal that explains it is attached whenever it arrives. Before this panel,
 * a statement line that found no match during the import was simply dropped
 * with the page — so "match it later" was not possible at all.
 *
 * UX-1: no dialogs. Selecting a target and pressing the confirm button on the
 * row is the whole interaction; the row disappears once it is matched.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Link2, EyeOff } from "lucide-react";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { SectionHeader } from "./product";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { displayLocale } from "../lib/number-display";

type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  reference: string | null;
  status: string;
};

type Option = { id: string; label: string; contactName?: string; outstanding: number; kind: "invoice" | "bill" };

export function UnmatchedBankTransactions({
  bankAccountId,
  onChanged,
}: {
  bankAccountId: string;
  onChanged?: () => void;
}) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.bankImport.transactions({ bankAccountId, status: "UNMATCHED", limit: 200 });
      setRows(d.transactions || []);
      setError(null);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذّر تحميل الحركات", "Could not load transactions"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [bankAccountId, t]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadOptions = async (id: string) => {
    if (options[id]) return;
    try {
      const d = await api.bankImport.suggestions(id);
      setOptions((prev) => ({ ...prev, [id]: d.options || [] }));
      if (d.match?.id) setChoice((prev) => ({ ...prev, [id]: prev[id] || d.match.id! }));
    } catch {
      setOptions((prev) => ({ ...prev, [id]: [] }));
    }
  };

  const act = async (tx: Tx, action: "link_invoice" | "link_bill" | "ignore") => {
    setBusyId(tx.id);
    try {
      await api.bankImport.match(tx.id, {
        action,
        targetId: action === "ignore" ? undefined : choice[tx.id],
      });
      setRows((prev) => prev.filter((r) => r.id !== tx.id));
      onChanged?.();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذّرت المطابقة", "Match failed"));
    } finally {
      setBusyId(null);
    }
  };

  if (!loading && rows.length === 0 && !error) return null;

  return (
    <section className="space-y-3" data-testid="unmatched-bank-transactions">
      <SectionHeader
        title={<>{t("حركات بانتظار المطابقة", "Awaiting a match")} · <span className="font-english tabular-nums">{rows.length}</span></>}
        actions={(
          <span className="text-xs text-muted-foreground">
            {t("مسجّلة في الدفاتر · اربطها بالفاتورة متى ما وصلت", "Recorded in the books · link each one to its document whenever it arrives")}
          </span>
        )}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {loading ? (
        <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="ledger-table overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: "110px" }} />
              <col style={{ minWidth: "260px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ minWidth: "240px" }} />
              <col style={{ width: "150px" }} />
            </colgroup>
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-start font-medium">{t("التاريخ", "Date")}</th>
                <th className="px-3 py-2.5 text-start font-medium">{t("البيان", "Description")}</th>
                <th className="px-3 py-2.5 text-end font-medium">{t("المبلغ", "Amount")}</th>
                <th className="px-3 py-2.5 text-start font-medium">{t("اربطها بـ", "Link to")}</th>
                <th className="px-3 py-2.5 text-center font-medium">{t("إجراء", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => {
                const opts = options[tx.id];
                const kind: "invoice" | "bill" = tx.amount >= 0 ? "invoice" : "bill";
                return (
                  <tr key={tx.id} className="border-t border-border/50">
                    <td className="px-3 py-2 font-english text-foreground/80" dir="ltr">{String(tx.date).slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <div className="truncate text-foreground"><bdi dir="auto">{tx.description}</bdi></div>
                      {tx.reference && <div className="font-english text-xs text-muted-foreground/60" dir="ltr">{tx.reference}</div>}
                    </td>
                    <td className={`px-3 py-2 text-end font-english font-semibold tabular-nums ${tx.amount >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                      {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={choice[tx.id] || ""}
                        onValueChange={(v) => setChoice((prev) => ({ ...prev, [tx.id]: v }))}
                        onOpenChange={(open) => { if (open) loadOptions(tx.id); }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={kind === "invoice" ? t("اختر فاتورة عميل", "Choose a customer invoice") : t("اختر فاتورة مورد", "Choose a supplier bill")} />
                        </SelectTrigger>
                        <SelectContent>
                          {(opts || []).length === 0 ? (
                            <SelectItem value="__none" disabled>{opts ? t("لا توجد مستندات مفتوحة", "No open documents") : t("جارٍ التحميل...", "Loading...")}</SelectItem>
                          ) : (
                            opts!.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                <span className="font-english" dir="ltr">{o.label}</span>
                                {o.contactName ? ` · ${o.contactName}` : ""}
                                {` · ${o.outstanding.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          className="h-8 px-2 text-xs"
                          disabled={!choice[tx.id] || choice[tx.id] === "__none" || busyId === tx.id}
                          onClick={() => act(tx, kind === "invoice" ? "link_invoice" : "link_bill")}
                        >
                          {busyId === tx.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                          <span className="ms-1">{t("ربط", "Link")}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          disabled={busyId === tx.id}
                          onClick={() => act(tx, "ignore")}
                          title={t("تجاهل هذه الحركة", "Ignore this transaction")}
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        <Check className="me-1 inline h-3 w-3" />
        {t(
          "كل ربط يعلّم النظام: المرة القادمة يقترح نفس العميل والحساب تلقائياً لنفس الجهة",
          "Every link teaches the books: next time the same merchant is pre-filled with the same contact and account",
        )}
      </p>
    </section>
  );
}
