/**
 * Stocktake (الجرد) · B4 · 2026-08-26
 *
 *  /app/inventory/counts        list + start a session (freeze system quantities)
 *  /app/inventory/counts/:id    count screen: scan/type SKU → +1 (or set a quantity),
 *                               variances only filter, blind mode, reasons, review → post
 *
 * Posting writes one ADJUSTMENT per variance measured against the LIVE ledger
 * (movements after the count are added back) — sales never stop for a stocktake.
 * UX-1: no dialogs — InlineConfirm for post/cancel · toasts for results.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ClipboardList, Plus, ScanBarcode, Lock, RotateCcw, Printer, Loader2, Check, X, Eye, EyeOff, Filter, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, type StockCount, type StockCountSummary, type StockCountLine } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { displayName } from "../lib/display-name";
import { money } from "../lib/pos-store";

const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  COUNTING: { ar: "جارٍ العدّ", en: "Counting", cls: "bg-warning-subtle text-warning" },
  REVIEW: { ar: "للمراجعة", en: "Review", cls: "bg-primary/10 text-primary" },
  POSTED: { ar: "مُرحَّل", en: "Posted", cls: "bg-success-subtle text-success" },
  CANCELLED: { ar: "ملغى", en: "Cancelled", cls: "bg-muted text-muted-foreground" },
};
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

// ═══════════════════════════════ list ═══════════════════════════════════════
export function StockCounts() {
  const { language, t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const navigate = useNavigate();
  const [items, setItems] = useState<StockCountSummary[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [form, setForm] = useState({ warehouseId: "", scope: "FULL" as "FULL" | "CATEGORY", category: "", blind: false, notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, w, p] = await Promise.all([api.inventory.counts.list(), api.inventory.listWarehouses(), api.products.list()]);
      setItems(c.items); setWarehouses(w.items || []);
      setCategories(Array.from(new Set(((p as any).items || []).map((x: any) => x.category).filter(Boolean))) as string[]);
      setForm((f) => ({ ...f, warehouseId: f.warehouseId || (w.items?.find((x: any) => x.isPrimary)?.id ?? w.items?.[0]?.id ?? "") }));
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذر التحميل", "Could not load")); }
    finally { setLoading(false); }
  }, [push, t]);
  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    if (!form.warehouseId) { push("error", t("اختر المستودع", "Pick a warehouse")); return; }
    setStarting(true);
    try {
      const sc = await api.inventory.counts.create({ warehouseId: form.warehouseId, scope: form.scope, category: form.scope === "CATEGORY" ? form.category || null : null, blind: form.blind, notes: form.notes || null });
      navigate(`/app/inventory/counts/${sc.id}`);
    } catch (e: any) {
      const code = e instanceof ApiError ? e.code : "";
      if (code === "count_already_open" && (e.body as any)?.countId) { push("info", t("توجد جلسة جرد مفتوحة لهذا المستودع — فُتحت", "A stocktake is already open for this warehouse — opening it")); navigate(`/app/inventory/counts/${(e.body as any).countId}`); }
      else if (code === "no_products_in_scope") push("error", t("لا أصناف مخزنية في هذا النطاق", "No stock items in this scope"));
      else push("error", e?.message || t("تعذر بدء الجرد", "Could not start the stocktake"));
    } finally { setStarting(false); }
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/app/inventory" className="text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="me-1 inline h-3 w-3 rtl:rotate-180" />{t("المخزون", "Inventory")}</Link>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الجرد", "Stocktake")}</h1>
          <p className="mt-1 text-muted-foreground">{t("جمّد أرصدة النظام · عدّ بالباركود · راجع الفروقات · رحّل التسويات — والبيع مستمر", "Freeze system quantities · count by barcode · review variances · post adjustments — sales keep running")}</p>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-foreground/80">{t("المستودع", "Warehouse")}</span>
            <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-foreground/80">{t("النطاق", "Scope")}</span>
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as any })} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
              <option value="FULL">{t("كامل المستودع", "Whole warehouse")}</option>
              <option value="CATEGORY">{t("فئة واحدة", "One category")}</option>
            </select>
          </label>
          {form.scope === "CATEGORY" ? (
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-foreground/80">{t("الفئة", "Category")}</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                <option value="">—</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex h-10 items-center gap-2 text-sm text-foreground/80"><input type="checkbox" checked={form.blind} onChange={(e) => setForm({ ...form, blind: e.target.checked })} className="h-4 w-4 accent-[#1276E3]" />{t("عدّ أعمى (إخفاء رصيد النظام)", "Blind count (hide system qty)")}</label>
          )}
          <Button onClick={start} disabled={starting || !warehouses.length} className="bg-primary hover:bg-primary/90">{starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="me-1 h-4 w-4" />}{t("بدء جلسة جرد", "Start stocktake")}</Button>
          {!warehouses.length && !loading && <div className="text-xs text-warning md:col-span-4">{t("لا يوجد مستودع — أنشئ مستودعًا أولًا من صفحة المخزون.", "No warehouse yet — create one from the Inventory page first.")}</div>}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div> : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground"><ClipboardList className="h-8 w-8" />{t("لا جلسات جرد بعد", "No stocktakes yet")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-start text-xs text-muted-foreground">
                <th className="px-4 py-2 text-start">{t("الرقم", "No.")}</th><th className="px-4 py-2 text-start">{t("المستودع", "Warehouse")}</th><th className="px-4 py-2 text-start">{t("النطاق", "Scope")}</th><th className="px-4 py-2 text-start">{t("الأصناف", "Items")}</th><th className="px-4 py-2 text-start">{t("الحالة", "Status")}</th><th className="px-4 py-2 text-start">{t("بدأ", "Started")}</th><th className="px-4 py-2 text-start">{t("رُحّل", "Posted")}</th>
              </tr></thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} onClick={() => navigate(`/app/inventory/counts/${s.id}`)} className="cursor-pointer border-b border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-english font-semibold text-foreground">{s.number}</td>
                    <td className="px-4 py-2.5">{s.warehouse.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.scope === "CATEGORY" ? s.category : t("كامل", "Full")}{s.blind ? ` · ${t("أعمى", "blind")}` : ""}</td>
                    <td className="px-4 py-2.5 font-english">{s.lineCount ?? "—"}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[s.status]?.cls}`}>{language === "ar" ? STATUS[s.status]?.ar : STATUS[s.status]?.en}</span></td>
                    <td className="px-4 py-2.5 font-english text-muted-foreground">{fmtDate(s.snapshotAt)}</td>
                    <td className="px-4 py-2.5 font-english text-muted-foreground">{fmtDate(s.postedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════ count screen ═══════════════════════════════
export function StockCountDetail() {
  const { id = "" } = useParams();
  const { language, t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [sc, setSc] = useState<StockCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState("");
  const [onlyVariances, setOnlyVariances] = useState(false);
  const [onlyUncounted, setOnlyUncounted] = useState(false);
  const [hideSystem, setHideSystem] = useState(false);
  const [confirm, setConfirm] = useState<"post" | "cancel" | null>(null);
  const [lastHit, setLastHit] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try { const d = await api.inventory.counts.get(id); setSc(d); setHideSystem(d.blind && d.status === "COUNTING"); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذر التحميل", "Could not load")); }
    finally { setLoading(false); }
  }, [id, push, t]);
  useEffect(() => { void load(); }, [load]);

  const counting = sc?.status === "COUNTING";
  const refocus = () => window.setTimeout(() => scanRef.current?.focus(), 30);

  const applyLine = async (line: { productId?: string; sku?: string; countedQty: number; mode?: "set" | "add"; reason?: string | null }) => {
    if (!sc || !counting) return;
    try {
      const r = await api.inventory.counts.lines(sc.id, [line]);
      const res = r.results[0];
      if (res.status === "unknown_sku") { push("error", t(`لا صنف بالرمز «${line.sku}»`, `No item with code “${line.sku}”`)); return; }
      setLastHit(res.productId);
      await load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed")); }
  };

  const onScan = async () => {
    const raw = scan.trim(); if (!raw) return;
    const m = raw.match(/^(\d{1,4})\*\s*(.+)$/);
    const qty = m ? Number(m[1]) : 1;
    const code = (m ? m[2] : raw).trim();
    setScan("");
    const byId = sc?.lines.find((l) => (l.product?.sku || "").toLowerCase() === code.toLowerCase());
    await applyLine(byId ? { productId: byId.productId, countedQty: qty, mode: "add" } : { sku: code, countedQty: qty, mode: "add" });
    refocus();
  };

  const setCounted = async (l: StockCountLine, value: string) => {
    if (value === "") return;
    const n = Number(value); if (Number.isNaN(n) || n < 0) return;
    await applyLine({ productId: l.productId, countedQty: n, mode: "set" });
  };
  const setReason = async (l: StockCountLine, reason: string) => { await applyLine({ productId: l.productId, countedQty: l.countedQty ?? 0, mode: "set", reason }); };

  const act = async (kind: "review" | "reopen" | "post" | "cancel") => {
    if (!sc) return; setBusy(true); setConfirm(null);
    try {
      if (kind === "post") {
        const r = await api.inventory.counts.post(sc.id, "skip");
        const n = r.adjustments.filter((a) => a.ok && a.delta !== 0).length;
        push(r.failed.length ? "error" : "success", t(`رُحّل الجرد · ${n} تسوية${r.failed.length ? ` · فشل ${r.failed.length}` : ""}`, `Stocktake posted · ${n} adjustment(s)${r.failed.length ? ` · ${r.failed.length} failed` : ""}`));
        setSc(r.count);
      } else {
        const d = kind === "review" ? await api.inventory.counts.review(sc.id) : kind === "reopen" ? await api.inventory.counts.reopen(sc.id) : await api.inventory.counts.cancel(sc.id);
        setSc(d);
      }
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل الإجراء", "Action failed")); }
    finally { setBusy(false); }
  };

  const lines = useMemo(() => {
    if (!sc) return [];
    const qq = q.trim().toLowerCase();
    return sc.lines.filter((l) => (!onlyVariances || (l.variance != null && l.variance !== 0)) && (!onlyUncounted || l.countedQty == null) && (!qq || (l.product?.name || "").toLowerCase().includes(qq) || (l.product?.nameAr || "").includes(q.trim()) || (l.product?.sku || "").toLowerCase().includes(qq)));
  }, [sc, onlyVariances, onlyUncounted, q]);

  if (loading) return <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;
  if (!sc) return <div className="py-16 text-center text-sm text-muted-foreground">{t("جلسة الجرد غير موجودة", "Stocktake not found")}</div>;
  const st = STATUS[sc.status];

  return (
    <div className="space-y-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to="/app/inventory/counts" className="text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="me-1 inline h-3 w-3 rtl:rotate-180" />{t("الجرد", "Stocktakes")}</Link>
          <h1 className="flex items-center gap-3 text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            <span className="font-english">{sc.number}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st?.cls}`}>{language === "ar" ? st?.ar : st?.en}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{sc.warehouse.name} · {t("تجميد الأرصدة", "Snapshot")} <span className="font-english">{fmtDate(sc.snapshotAt)}</span>{sc.postedAt ? <> · {t("رُحّل", "posted")} <span className="font-english">{fmtDate(sc.postedAt)}</span></> : null}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="me-1 h-4 w-4" />{t("طباعة المحضر", "Print sheet")}</Button>
          {counting && <Button variant="outline" onClick={() => act("review")} disabled={busy}><Eye className="me-1 h-4 w-4" />{t("إنهاء العدّ → مراجعة", "Finish counting → Review")}</Button>}
          {sc.status === "REVIEW" && <Button variant="outline" onClick={() => act("reopen")} disabled={busy}><RotateCcw className="me-1 h-4 w-4" />{t("إعادة فتح العدّ", "Reopen counting")}</Button>}
          {(sc.status === "REVIEW" || counting) && (confirm === "post"
            ? <InlineConfirm label={t(`ترحيل ${sc.summary.variances} تسوية؟`, `Post ${sc.summary.variances} adjustment(s)?`)} onConfirm={() => act("post")} onCancel={() => setConfirm(null)} />
            : <Button onClick={() => setConfirm("post")} disabled={busy || sc.summary.counted === 0} className="bg-[#0B1B49] text-white hover:bg-[#0B1B49]/90"><Lock className="me-1 h-4 w-4" />{t("اعتماد وترحيل", "Approve & post")}</Button>)}
          {sc.status !== "POSTED" && sc.status !== "CANCELLED" && (confirm === "cancel"
            ? <InlineConfirm label={t("إلغاء الجلسة؟", "Cancel session?")} onConfirm={() => act("cancel")} onCancel={() => setConfirm(null)} />
            : <Button variant="ghost" onClick={() => setConfirm("cancel")} disabled={busy} className="text-danger"><X className="me-1 h-4 w-4" />{t("إلغاء", "Cancel")}</Button>)}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          [t("الأصناف", "Items"), String(sc.summary.lines), ""],
          [t("تم عدّها", "Counted"), `${sc.summary.counted} / ${sc.summary.lines}`, ""],
          [t("فروقات", "Variances"), String(sc.summary.variances), sc.summary.variances ? "text-warning" : ""],
          [t("قيمة النقص", "Shortage value"), money(Math.abs(sc.summary.shortageValue)), sc.summary.shortageValue ? "text-danger" : ""],
          [t("قيمة الزيادة", "Surplus value"), money(sc.summary.surplusValue), sc.summary.surplusValue ? "text-success" : ""],
        ].map(([l, v, cls]) => (
          <Card key={l} className="border-border"><CardContent className="p-3"><div className="text-[11px] text-muted-foreground">{l}</div><div className={`font-english text-lg font-bold ${cls || "text-foreground"}`}>{v}</div></CardContent></Card>
        ))}
      </div>

      {/* scan bar */}
      {counting && (
        <div className="flex h-12 items-center gap-2 rounded-xl border-2 border-primary/50 bg-canvas px-3 focus-within:border-primary print:hidden">
          <ScanBarcode className="h-5 w-5 text-primary" />
          <input ref={scanRef} value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void onScan(); } }} autoFocus
            placeholder={t("امسح الباركود أو اكتب الرمز → +1 · اكتب 12* ثم امسح لإضافة 12", "Scan or type a code → +1 · type 12* then scan to add 12")}
            className="h-full flex-1 bg-transparent text-base font-medium outline-none" />
        </div>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث بالاسم أو الرمز…", "Search name or code…")} className="h-9 w-56 border-border" />
        <button onClick={() => setOnlyVariances((v) => !v)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${onlyVariances ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground/80"}`}><Filter className="h-3 w-3" />{t("الفروقات فقط", "Variances only")}</button>
        <button onClick={() => setOnlyUncounted((v) => !v)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${onlyUncounted ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground/80"}`}>{t("لم تُعدّ بعد", "Not counted yet")}</button>
        <button onClick={() => setHideSystem((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-foreground/80">{hideSystem ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{hideSystem ? t("إظهار رصيد النظام", "Show system qty") : t("إخفاء رصيد النظام", "Hide system qty")}</button>
        <span className="ms-auto text-xs text-muted-foreground">{lines.length} / {sc.lines.length}</span>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 text-start">{t("الصنف", "Item")}</th>
              <th className="px-3 py-2 text-start">{t("الرمز", "SKU")}</th>
              {!hideSystem && <th className="px-3 py-2 text-end">{t("النظام", "System")}</th>}
              <th className="px-3 py-2 text-end">{t("المعدود", "Counted")}</th>
              {!hideSystem && <th className="px-3 py-2 text-end">{t("الفرق", "Variance")}</th>}
              {!hideSystem && <th className="px-3 py-2 text-end">{t("القيمة", "Value")}</th>}
              <th className="px-3 py-2 text-start">{t("السبب", "Reason")}</th>
            </tr></thead>
            <tbody>
              {lines.map((l) => {
                const v = l.variance;
                return (
                  <tr key={l.id} className={`border-b border-border/60 ${lastHit === l.productId ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2 text-foreground">{l.product ? displayName(l.product as any) : l.productId}</td>
                    <td className="px-3 py-2 font-english text-muted-foreground">{l.product?.sku || "—"}</td>
                    {!hideSystem && <td className="px-3 py-2 text-end font-english">{l.systemQty}</td>}
                    <td className="px-3 py-2 text-end">
                      {counting ? (
                        <input key={`${l.id}-${l.countedQty}`} defaultValue={l.countedQty ?? ""} inputMode="decimal" dir="ltr" placeholder="—"
                          onBlur={(e) => { if (e.target.value !== String(l.countedQty ?? "")) void setCounted(l, e.target.value); }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-end font-english text-sm outline-none focus:border-primary" />
                      ) : <span className="font-english">{l.countedQty ?? "—"}</span>}
                    </td>
                    {!hideSystem && <td className={`px-3 py-2 text-end font-english font-semibold ${v == null ? "text-muted-foreground" : v < 0 ? "text-danger" : v > 0 ? "text-success" : "text-foreground"}`}>{v == null ? "—" : v > 0 ? `+${v}` : v}</td>}
                    {!hideSystem && <td className={`px-3 py-2 text-end font-english ${l.varianceValue == null ? "text-muted-foreground" : (l.varianceValue < 0 ? "text-danger" : l.varianceValue > 0 ? "text-success" : "")}`}>{l.varianceValue == null ? "—" : money(l.varianceValue)}</td>}
                    <td className="px-3 py-2">
                      {counting && v != null && v !== 0 ? (
                        <select value={l.reason || ""} onChange={(e) => void setReason(l, e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
                          <option value="">—</option>
                          <option value="damaged">{t("تلف", "Damaged")}</option><option value="expired">{t("منتهي", "Expired")}</option><option value="theft">{t("فقد / سرقة", "Loss / theft")}</option><option value="entry_error">{t("خطأ إدخال", "Entry error")}</option><option value="found">{t("عُثر عليه", "Found")}</option><option value="other">{t("أخرى", "Other")}</option>
                        </select>
                      ) : <span className="text-xs text-muted-foreground">{l.reason || "—"}</span>}
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">{t("لا أصناف مطابقة", "No matching items")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {sc.status === "POSTED" && <div className="flex items-center gap-2 rounded-xl border border-success-border bg-success-subtle px-4 py-3 text-sm text-success"><Check className="h-4 w-4" />{t("رُحّلت التسويات إلى دفتر المخزون (نوع الحركة: تسوية جرد).", "Adjustments were posted to the stock ledger (movement type: stocktake adjustment).")}</div>}
      <style>{`@media print { .print\\:hidden { display: none !important; } aside, header, nav { display: none !important; } }`}</style>
    </div>
  );
}
