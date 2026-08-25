/**
 * Settings → Account → «الشركات المحذوفة» · soft-deleted companies the user
 * owns, restorable within the grace window (CEO 2026-08-25). No dialogs.
 */
import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Loader2, Archive } from "lucide-react";
import { Button } from "./ui/button";
import { api, ApiError, type Org, setOrgId } from "../lib/api";
import { useLanguage } from "./LanguageContext";

const GRACE_DAYS = 30;

function fmt(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return iso; }
}

export function DeletedCompanies({ push }: { push: (kind: "success" | "error", msg: string) => void }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.orgs.listDeleted()); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const restore = async (o: Org) => {
    setBusy(o.id);
    try {
      await api.orgs.restore(o.id);
      push("success", t(`تمت استعادة «${o.name}» — جارٍ فتحها`, `“${o.name}” restored — opening it`));
      setOrgId(o.id);
      setTimeout(() => window.location.assign("/app/dashboard"), 600);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      push("error", code === "grace_expired"
        ? t("انتهت فترة الاستعادة لهذه الشركة", "The restore window for this company has ended")
        : e instanceof ApiError ? e.message : t("تعذّرت الاستعادة", "Restore failed"));
    } finally { setBusy(null); }
  };

  if (loading) return <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>;
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Archive className="h-4 w-4 text-muted-foreground" /> {t("الشركات المحذوفة", "Deleted companies")}</div>
      <p className="text-xs text-muted-foreground">{t(`يمكن استعادة أي شركة خلال ${GRACE_DAYS} يومًا من حذفها · بعدها تُحذف نهائيًا.`, `Any company can be restored within ${GRACE_DAYS} days of deletion · after that it is purged.`)}</p>
      <ul className="divide-y divide-border/60">
        {rows.map((o) => {
          const until = o.deletedAt ? new Date(new Date(o.deletedAt).getTime() + GRACE_DAYS * 86_400_000) : null;
          const expired = until ? until.getTime() < Date.now() : false;
          return (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm text-foreground">{o.name}</div>
                <div className="text-xs text-muted-foreground font-english">{o.country} · {o.baseCurrency} · {t("حُذفت", "deleted")} {fmt(o.deletedAt)} · {expired ? t("انتهت مهلة الاستعادة", "restore window ended") : `${t("تُستعاد حتى", "restore until")} ${fmt(until?.toISOString())}`}</div>
              </div>
              {!expired && (
                <Button type="button" variant="outline" size="sm" disabled={busy === o.id} onClick={() => restore(o)}>
                  {busy === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4 me-1" /> {t("استعادة", "Restore")}</>}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
