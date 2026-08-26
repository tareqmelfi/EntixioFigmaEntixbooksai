/**
 * Settings → «الحسابات الرقابية» (control accounts · 2026-08-26)
 *
 * Which account the automatic postings use for each role (AR · AP · cash · bank ·
 * tax · default revenue · cost of revenue · default expense). Shows how the
 * engine resolved each role today (explicit / legacy code / heuristic / none) so
 * a company with its own chart can see — and fix — the mapping in one place.
 * No dialogs (UX-1) · SearchableCombobox per role · saves per change.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { SearchableCombobox, type ComboboxItem } from "./searchable-combobox";
import { api, ApiError, type Account, type LedgerRoleRow } from "../lib/api";
import { useLanguage } from "./LanguageContext";

export function LedgerMappingTab({ canManage, push }: { canManage: boolean; push: (kind: "success" | "error" | "info", msg: string) => void }) {
  const { language, t } = useLanguage();
  const [rows, setRows] = useState<LedgerRoleRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a] = await Promise.all([api.accounts.ledgerMapping(), api.accounts.list()]);
      setRows(m.roles); setAccounts(a.items || []);
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذر تحميل الحسابات الرقابية", "Could not load control accounts")); }
    finally { setLoading(false); }
  }, [push, t]);
  useEffect(() => { void load(); }, [load]);

  const itemsByType = useMemo(() => {
    const m: Record<string, ComboboxItem[]> = {};
    for (const a of accounts) {
      const type = (a as any).type as string;
      (m[type] ||= []).push({ id: a.id, label: `${a.code} · ${language === "ar" ? ((a as any).nameAr || a.name) : a.name}` });
    }
    return m;
  }, [accounts, language]);

  const save = async (role: string, accountId: string | null) => {
    setBusy(role);
    try {
      const r = await api.accounts.setLedgerMapping({ [role]: accountId });
      setRows(r.roles);
      push("success", t("حُفظ", "Saved"));
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed")); }
    finally { setBusy(null); }
  };

  const viaLabel = (via: LedgerRoleRow["via"]) => via === "explicit" ? t("محدد يدويًا", "Set manually") : via === "legacy_code" ? t("الكود الافتراضي", "Default code") : via === "heuristic" ? t("استدلال تلقائي — يُفضّل تثبيته", "Auto-detected — better to pin it") : t("غير محدد — لن تُرحَّل القيود الآلية لهذا الدور", "Not set — automatic postings for this role are skipped");

  if (loading) return <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground"><ShieldCheck className="h-5 w-5" /> {t("الحسابات الرقابية للقيود التلقائية", "Control accounts for automatic postings")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("كل فاتورة · سند · مصروف · بيع كاشير يُرحَّل تلقائيًا إلى هذه الحسابات. الشركات التي تستورد دليلها الخاص تثبّتها هنا مرة واحدة.", "Every invoice, voucher, expense and POS sale posts automatically to these accounts. Companies with their own chart pin them here once.")}</p>
      </CardHeader>
      <CardContent className="divide-y divide-border/60">
        {rows.map((r) => {
          const items = itemsByType[r.type] || [];
          const missing = r.via === "none";
          return (
            <div key={r.role} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] md:items-center">
              <div>
                <div className="text-sm font-semibold text-foreground">{language === "ar" ? r.ar : r.en}</div>
                <div className={`mt-0.5 flex items-center gap-1 text-[11px] ${missing ? "text-danger" : r.via === "heuristic" ? "text-warning" : "text-muted-foreground"}`}>
                  {missing ? <AlertTriangle className="h-3 w-3" /> : null}{viaLabel(r.via)}
                </div>
              </div>
              <SearchableCombobox
                value={r.resolved?.id || ""}
                onChange={(id) => { if (canManage) void save(r.role, id || null); }}
                items={items}
                disabled={!canManage || busy === r.role}
                placeholder={t(`اختر حساب ${r.type === "ASSET" ? "أصول" : r.type === "LIABILITY" ? "التزامات" : r.type === "REVENUE" ? "إيراد" : "مصروف"}…`, `Pick a${r.type === "ASSET" ? "n asset" : r.type === "LIABILITY" ? " liability" : r.type === "REVENUE" ? " revenue" : "n expense"} account…`)}
                menuMinWidth={360}
              />
              <div className="flex items-center gap-2 text-xs">
                {busy === r.role ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                {r.explicit && canManage ? (
                  <button type="button" onClick={() => void save(r.role, null)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground" title={t("إلغاء التثبيت والعودة للتلقائي", "Unpin · back to automatic")}>
                    <RotateCcw className="h-3 w-3" />{t("تلقائي", "Auto")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
