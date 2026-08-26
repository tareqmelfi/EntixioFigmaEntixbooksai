/**
 * ActingAsBanner (Z2.3) — the red strip a platform admin sees while working on
 * behalf of a company: company · reason · countdown · «End». Ends on click or
 * when the 60-minute grant expires (the API stops accepting the override too).
 */
import { useEffect, useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { readActAs, stopActAs, subscribeActAs } from "../lib/act-as";
import { api, setOrgId } from "../lib/api";
import { invalidateOrgRegion } from "../lib/use-org-region";
import { useLanguage } from "./LanguageContext";

export function ActingAsBanner() {
  const { t } = useLanguage();
  const [act, setAct] = useState(readActAs());
  const [now, setNow] = useState(Date.now());
  useEffect(() => subscribeActAs(() => setAct(readActAs())), []);
  useEffect(() => {
    if (!act) return;
    const id = setInterval(() => { setNow(Date.now()); if (!readActAs()) setAct(null); }, 1000);
    return () => clearInterval(id);
  }, [act]);
  if (!act) return null;
  const left = Math.max(0, act.until - now);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const end = async () => {
    try { await api.admin.impersonateStop(act.orgId); } catch { /* audit best-effort */ }
    stopActAs(); setOrgId(null); invalidateOrgRegion();
    window.location.replace(`/admin/orgs/${act.orgId}`);
  };
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-red-700 bg-red-600 px-4 py-1.5 text-xs text-white">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span style={{ fontWeight: 700 }}>{t("تعمل بالنيابة عن", "Acting on behalf of")} «{act.orgName}»</span>
      <span className="text-white/80 truncate max-w-[40ch]">· {act.reason}</span>
      <span className="font-english tabular-nums text-white/90" dir="ltr">· {mm}:{ss}</span>
      <button type="button" onClick={() => void end()} className="ms-auto inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 hover:bg-white/25" style={{ fontWeight: 600 }}>
        <LogOut className="h-3.5 w-3.5" />{t("إنهاء", "End")}
      </button>
    </div>
  );
}
