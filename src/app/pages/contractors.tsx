/**
 * Contractors list — المقاولون والفريلانسر (different from company suppliers:
 * no AP cycle · direct payments · hours tracked per project · peer benchmarks).
 * Rows open the contractor page. New → /app/contractors/new
 */
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, HardHat, Loader2, Plus, Star } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hrs = (v: any) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });

const KIND_LABELS: Record<string, { ar: string; en: string; bg: string }> = {
  FREELANCER: { ar: "فريلانسر", en: "Freelancer", bg: "bg-blue-100 text-blue-700" },
  CONTRACTOR: { ar: "مقاول", en: "Contractor", bg: "bg-amber-100 text-amber-700" },
  AGENCY: { ar: "وكالة", en: "Agency", bg: "bg-violet-100 text-violet-700" },
};

export function Contractors() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [peers, setPeers] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.contractors.list();
      setItems(d.items);
      setPeers(d.peers);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter((x) => !kindFilter || x.kind === kindFilter);
  const totalOutstanding = items.reduce((s, x) => s + Number(x.stats?.outstanding || 0), 0);
  const totalPaid = items.reduce((s, x) => s + Number(x.stats?.totalPaid || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المقاولون والفريلانسر", "Contractors & Freelancers")}</h1>
          <p className="text-muted-foreground mt-1">{t("تعاقد مباشر بدون دورة موردين · ساعات عمل لكل مشروع · دفع مباشر يُقيد كأتعاب مقاولين", "Direct engagement without the supplier cycle · hours per project · direct payments posted as subcontractor fees")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/contractors/new")}><Plus className="me-2 h-4 w-4" />{t("مقاول جديد", "New contractor")}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("المقاولون", "Contractors")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("مدفوعات إجمالية", "Total paid")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{money(totalPaid)}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("مستحق لهم", "Outstanding")}</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{money(totalOutstanding)}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("متوسط سعر الساعة (السوق الداخلي)", "Avg hourly rate (peer)")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }} dir="ltr">{peers?.avgRate != null ? money(peers.avgRate) : "—"}</div>
        </CardContent></Card>
      </div>

      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setKindFilter("")} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${!kindFilter ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-[#E5E7EB]"}`} style={{ fontWeight: 600 }}>{t("الكل", "All")}</button>
        {Object.entries(KIND_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setKindFilter(k)} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${kindFilter === k ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-[#E5E7EB]"}`} style={{ fontWeight: 600 }}>{t(v.ar, v.en)}</button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("السجل", "Register")} · {filtered.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center">
              <HardHat className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground">{t("لا يوجد مقاولون بعد", "No contractors yet")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{t("سجّل فريلانسر أو مقاول أو وكالة، أشركه في مشروع، سجّل ساعاته، وادفع له مباشرة", "Register a freelancer, contractor or agency — engage on a project, log hours, pay directly")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المقاول", "Contractor")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("النوع", "Kind")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الساعات", "Hours")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("متوسط السعر", "Avg rate")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("مقابل الأقران", "vs peers")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("مستحق", "Outstanding")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التقييم", "Rating")}</th>
                  <th className="py-3 px-4 w-[50px]"></th>
                </tr></thead>
                <tbody>
                  {filtered.map((x) => {
                    const kind = KIND_LABELS[x.kind] || KIND_LABELS.FREELANCER;
                    const avgRate = x.stats?.avgRate;
                    const peerRate = peers?.avgRate;
                    const vsPeers = avgRate != null && peerRate != null && peerRate > 0 ? ((avgRate - peerRate) / peerRate) * 100 : null;
                    return (
                      <tr key={x.id} onClick={() => navigate(`/app/contractors/${x.id}`)} className={`border-b border-border/50 hover:bg-primary/5 cursor-pointer ${!x.isActive ? "opacity-50" : ""}`}>
                        <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 700 }} dir="ltr">{x.code}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{x.name} {!x.isActive && <span className="text-[10px] text-gray-500">({t("موقوف", "inactive")})</span>}</div>
                          <div className="text-xs text-muted-foreground">{x.specialty || "—"} · {x.stats?.projectsCount || 0} {t("مشروع", "projects")}</div>
                        </td>
                        <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${kind.bg}`}>{t(kind.ar, kind.en)}</span></td>
                        <td className="py-3 px-4 font-english text-foreground" dir="ltr">{hrs(x.stats?.totalHours)}</td>
                        <td className="py-3 px-4 font-english text-foreground" dir="ltr">{avgRate != null ? money(avgRate) : "—"}</td>
                        <td className="py-3 px-4 font-english text-xs" dir="ltr">
                          {vsPeers == null ? "—" : (
                            <span className={vsPeers > 5 ? "text-amber-600" : vsPeers < -5 ? "text-emerald-600" : "text-muted-foreground"}>
                              {vsPeers > 0 ? "+" : ""}{vsPeers.toFixed(0)}%
                            </span>
                          )}
                        </td>
                        <td className={`py-3 px-4 font-english ${Number(x.stats?.outstanding || 0) > 0 ? "text-amber-600" : "text-muted-foreground"}`} style={{ fontWeight: 600 }} dir="ltr">{money(x.stats?.outstanding)}</td>
                        <td className="py-3 px-4">
                          {x.rating != null ? (
                            <span className="inline-flex items-center gap-0.5 text-amber-500 text-xs font-english"><Star className="h-3 w-3 fill-current" />{Number(x.rating).toFixed(1)}</span>
                          ) : "—"}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
