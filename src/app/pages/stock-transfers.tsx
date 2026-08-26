/**
 * Stock transfers between warehouses / branches (B2 · 2026-08-26)
 *
 *  /app/inventory/transfers        list (+ in-transit value) · new transfer form
 *  /app/inventory/transfers/:id    document: send · receive (partial · reasons) · cancel · print (A4 + 80mm)
 *
 * DRAFT → SENT (stock leaves the source) → RECEIVED (lands at the destination
 * at the same cost · shortfall posts as shrinkage) · CANCELLED (SENT returns).
 * UX-1: no dialogs — InlineConfirm for send/receive/cancel · toasts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowLeftRight, Loader2, Plus, Printer, Send, PackageCheck, X, Trash2, Check, Truck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { SearchableCombobox, type ComboboxItem } from "../components/searchable-combobox";
import { BranchField } from "../components/branch-field";
import { api, ApiError, type StockTransfer, type StockTransferSummary } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { useOrgRegion } from "../lib/use-org-region";
import { displayName } from "../lib/display-name";
import { money } from "../lib/pos-store";

const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft", cls: "bg-muted text-muted-foreground" },
  SENT: { ar: "في الطريق", en: "In transit", cls: "bg-warning-subtle text-warning" },
  RECEIVED: { ar: "مستلَم", en: "Received", cls: "bg-success-subtle text-success" },
  CANCELLED: { ar: "ملغى", en: "Cancelled", cls: "bg-muted text-muted-foreground" },
};
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
type Wh = { id: string; code: string; name: string; isPrimary?: boolean };

// ═══════════════════════════════ list + new ══════════════════════════════════
export function StockTransfers() {
  const { language, t } = useLanguage();
  const { currency } = useOrgRegion();
  const { toasts, push, dismiss } = useToasts();
  const navigate = useNavigate();
  const [items, setItems] = useState<StockTransferSummary[]>([]);
  const [inTransit, setInTransit] = useState(0);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ fromWarehouseId: string; toWarehouseId: string; fromBranchId: string | null | undefined; toBranchId: string | null | undefined; notes: string; lines: Array<{ productId: string; qty: string }> }>({ fromWarehouseId: "", toWarehouseId: "", fromBranchId: null, toBranchId: null, notes: "", lines: [{ productId: "", qty: "1" }] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, w, p] = await Promise.all([api.inventory.transfers.list(), api.inventory.listWarehouses(), api.products.list()]);
      setItems(tr.items); setInTransit(tr.inTransitValue || 0);
      const whs: Wh[] = w.items || [];
      setWarehouses(whs);
      setProducts(((p as any).items || []).filter((x: any) => x.type === "GOOD" || x.type === "INVENTORY"));
      setForm((f) => ({ ...f, fromWarehouseId: f.fromWarehouseId || (whs.find((x) => x.isPrimary)?.id ?? whs[0]?.id ?? ""), toWarehouseId: f.toWarehouseId || (whs.find((x) => x.id !== (whs.find((y) => y.isPrimary)?.id ?? whs[0]?.id))?.id ?? "") }));
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذر التحميل", "Could not load")); }
    finally { setLoading(false); }
  }, [push, t]);
  useEffect(() => { void load(); }, [load]);

  const productItems = useMemo<ComboboxItem[]>(() => products.map((p) => ({ id: p.id, label: displayName(p), sublabel: p.sku || undefined })), [products]);
  const validLines = form.lines.filter((l) => l.productId && Number(l.qty) > 0);
  const setLine = (i: number, patch: Partial<{ productId: string; qty: string }>) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const create = async (send: boolean) => {
    if (!form.fromWarehouseId || !form.toWarehouseId) { push("error", t("اختر المستودعين", "Pick both warehouses")); return; }
    if (form.fromWarehouseId === form.toWarehouseId) { push("error", t("المصدر والوجهة متطابقان", "Source and destination are the same")); return; }
    if (!validLines.length) { push("error", t("أضف صنفًا واحدًا على الأقل", "Add at least one item")); return; }
    setBusy(true);
    try {
      const tr = await api.inventory.transfers.create({ fromWarehouseId: form.fromWarehouseId, toWarehouseId: form.toWarehouseId, fromBranchId: form.fromBranchId ?? null, toBranchId: form.toBranchId ?? null, notes: form.notes || null, lines: validLines.map((l) => ({ productId: l.productId, qty: Number(l.qty) })), send });
      navigate(`/app/inventory/transfers/${tr.id}`);
    } catch (e: any) {
      const code = e instanceof ApiError ? e.code : "";
      if (code === "insufficient_stock") push("error", t(`الرصيد غير كافٍ في المصدر (المتاح ${(e.body as any)?.available ?? 0})`, `Not enough stock at the source (available ${(e.body as any)?.available ?? 0})`));
      else push("error", e?.message || t("تعذر الإنشاء", "Could not create"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/inventory" className="text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="me-1 inline h-3 w-3 rtl:rotate-180" />{t("المخزون", "Inventory")}</Link>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("التحويلات بين المستودعات والفروع", "Warehouse & branch transfers")}</h1>
        <p className="mt-1 text-muted-foreground">{t("مسودة → أُرسلت (بضاعة في الطريق) → مستلَمة بنفس التكلفة · أي نقص يُرحَّل كفروقات جرد", "Draft → sent (goods in transit) → received at the same cost · any shortfall posts as shrinkage")}</p>
      </div>

      <Card className="border-border">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-foreground/80">{t("من مستودع", "From warehouse")}</span>
              <select value={form.fromWarehouseId} onChange={(e) => setForm({ ...form, fromWarehouseId: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            <div className="text-sm"><span className="mb-1 block text-xs font-semibold text-foreground/80">{t("فرع المصدر", "Source branch")}</span><BranchField compact value={form.fromBranchId} onChange={(id) => setForm((f) => ({ ...f, fromBranchId: id }))} /></div>
            <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-foreground/80">{t("إلى مستودع", "To warehouse")}</span>
              <select value={form.toWarehouseId} onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            <div className="text-sm"><span className="mb-1 block text-xs font-semibold text-foreground/80">{t("فرع الوجهة", "Destination branch")}</span><BranchField compact value={form.toBranchId} onChange={(id) => setForm((f) => ({ ...f, toBranchId: id }))} /></div>
          </div>
          <div className="rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-2 text-start">{t("الصنف", "Item")}</th><th className="px-3 py-2 text-end w-32">{t("الكمية", "Qty")}</th><th className="w-10"></th></tr></thead>
              <tbody>
                {form.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-2 py-1"><SearchableCombobox value={l.productId} onChange={(id) => setLine(i, { productId: id })} items={productItems} placeholder={t("ابحث بالاسم أو SKU…", "Search by name or SKU…")} borderless menuMinWidth={320} /></td>
                    <td className="px-2 py-1"><Input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} dir="ltr" className="h-8 text-end font-english" inputMode="decimal" /></td>
                    <td className="px-2 py-1 text-center"><button type="button" onClick={() => setForm((f) => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, j) => j !== i) : f.lines }))} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { productId: "", qty: "1" }] }))} className="flex w-full items-center gap-1 px-3 py-2 text-xs text-primary hover:bg-primary/5"><Plus className="h-3.5 w-3.5" />{t("إضافة صنف", "Add item")}</button>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-foreground/80">{t("ملاحظات", "Notes")}</span><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("سائق · رقم الشاحنة · سبب التحويل", "Driver · truck no. · reason")} /></label>
            <Button variant="outline" className="border-border" disabled={busy || !validLines.length} onClick={() => void create(false)}>{t("حفظ كمسودة", "Save draft")}</Button>
            <Button className="bg-primary hover:bg-primary/90" disabled={busy || !validLines.length} onClick={() => void create(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="me-1 h-4 w-4" />}{t("إرسال الآن", "Send now")}</Button>
          </div>
          {!products.length && !loading && <div className="text-xs text-warning">{t("لا أصناف مخزنية بعد — أضف أصنافًا من نوع «بضاعة» أو «مخزون».", "No stock items yet — add items of type “Good” or “Inventory”.")}</div>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("في الطريق (قيمة)", "In transit (value)")}</div><div className="font-english text-xl text-foreground" dir="ltr" style={{ fontWeight: 700 }}>{money(inTransit)} {currency}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("في الطريق (مستندات)", "In transit (docs)")}</div><div className="font-english text-xl text-foreground" style={{ fontWeight: 700 }}>{items.filter((i) => i.status === "SENT").length}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("مسودات", "Drafts")}</div><div className="font-english text-xl text-foreground" style={{ fontWeight: 700 }}>{items.filter((i) => i.status === "DRAFT").length}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("مستلَمة", "Received")}</div><div className="font-english text-xl text-foreground" style={{ fontWeight: 700 }}>{items.filter((i) => i.status === "RECEIVED").length}</div></CardContent></Card>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div> : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground"><ArrowLeftRight className="h-8 w-8" />{t("لا تحويلات بعد", "No transfers yet")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2 text-start">{t("الرقم", "No.")}</th><th className="px-4 py-2 text-start">{t("من", "From")}</th><th className="px-4 py-2 text-start">{t("إلى", "To")}</th><th className="px-4 py-2 text-end">{t("الأصناف", "Items")}</th><th className="px-4 py-2 text-end">{t("الكمية", "Qty")}</th><th className="px-4 py-2 text-end">{t("القيمة", "Value")}</th><th className="px-4 py-2 text-start">{t("الحالة", "Status")}</th><th className="px-4 py-2 text-start">{t("أُنشئ", "Created")}</th>
              </tr></thead>
              <tbody>
                {items.map((tr) => (
                  <tr key={tr.id} onClick={() => navigate(`/app/inventory/transfers/${tr.id}`)} className="cursor-pointer border-b border-border/50 hover:bg-primary/5">
                    <td className="px-4 py-2 font-english text-foreground" dir="ltr" style={{ fontWeight: 600 }}>{tr.number}</td>
                    <td className="px-4 py-2">{tr.fromWarehouse.name}</td>
                    <td className="px-4 py-2">{tr.toWarehouse.name}</td>
                    <td className="px-4 py-2 text-end font-english">{tr.lines}</td>
                    <td className="px-4 py-2 text-end font-english">{tr.qty}</td>
                    <td className="px-4 py-2 text-end font-english">{money(tr.value)}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[tr.status]?.cls}`}>{language === "ar" ? STATUS[tr.status]?.ar : STATUS[tr.status]?.en}</span></td>
                    <td className="px-4 py-2 font-english text-xs text-muted-foreground" dir="ltr">{fmtDate(tr.createdAt)}</td>
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

// ═══════════════════════════════ detail ═════════════════════════════════════
export function StockTransferDetail() {
  const { id = "" } = useParams();
  const { language, t } = useLanguage();
  const { currency } = useOrgRegion();
  const { toasts, push, dismiss } = useToasts();
  const [tr, setTr] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"send" | "receive" | "cancel" | null>(null);
  const [received, setReceived] = useState<Record<string, { qty: string; reason: string }>>({});
  const [receivedBy, setReceivedBy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.inventory.transfers.get(id);
      setTr(d);
      setReceived(Object.fromEntries(d.lines.map((l) => [l.productId, { qty: String(l.receivedQty ?? l.qty), reason: l.reason || "" }])));
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذر التحميل", "Could not load")); }
    finally { setLoading(false); }
  }, [id, push, t]);
  useEffect(() => { void load(); }, [load]);

  const act = async (kind: "send" | "receive" | "cancel") => {
    setBusy(true); setConfirm(null);
    try {
      if (kind === "send") { await api.inventory.transfers.send(id); push("success", t("أُرسلت — البضاعة في الطريق", "Sent — goods are in transit")); }
      else if (kind === "receive") {
        const r = await api.inventory.transfers.receive(id, { lines: (tr?.lines || []).map((l) => ({ productId: l.productId, receivedQty: Number(received[l.productId]?.qty ?? l.qty), reason: received[l.productId]?.reason || null })), receivedByName: receivedBy || null });
        push(r.shortfallValue > 0 ? "info" : "success", r.shortfallValue > 0 ? t(`استُلمت بنقص ${money(r.shortfallValue)} ${currency} — رُحّل كفروقات جرد`, `Received with a ${money(r.shortfallValue)} ${currency} shortfall — posted as shrinkage`) : t("استُلمت كاملة", "Received in full"));
      } else { await api.inventory.transfers.cancel(id); push("success", t("أُلغي التحويل", "Transfer cancelled")); }
      await load();
    } catch (e: any) {
      const code = e instanceof ApiError ? e.code : "";
      if (code === "insufficient_stock") push("error", t(`الرصيد غير كافٍ في المصدر (المتاح ${(e.body as any)?.available ?? 0})`, `Not enough stock at the source (available ${(e.body as any)?.available ?? 0})`));
      else push("error", e?.message || t("فشل الإجراء", "Action failed"));
    } finally { setBusy(false); }
  };

  if (loading || !tr) return <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;
  const st = STATUS[tr.status];

  return (
    <div className="space-y-5 max-w-7xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link to="/app/inventory/transfers" className="text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="me-1 inline h-3 w-3 rtl:rotate-180" />{t("التحويلات", "Transfers")}</Link>
          <h1 className="flex items-center gap-2 text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}><Truck className="h-5 w-5 text-primary" /><span className="font-english" dir="ltr">{tr.number}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st?.cls}`}>{language === "ar" ? st?.ar : st?.en}</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr.fromWarehouse.name}{tr.fromBranch ? ` (${language === "ar" ? tr.fromBranch.nameAr || tr.fromBranch.name : tr.fromBranch.name})` : ""} → {tr.toWarehouse.name}{tr.toBranch ? ` (${language === "ar" ? tr.toBranch.nameAr || tr.toBranch.name : tr.toBranch.name})` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="border-border" onClick={() => window.print()}><Printer className="me-1 h-4 w-4" />{t("طباعة", "Print")}</Button>
          {tr.status === "DRAFT" && (confirm === "send" ? <InlineConfirm label={t("إرسال؟ البضاعة تخرج من المصدر الآن", "Send? Goods leave the source now")} onConfirm={() => void act("send")} onCancel={() => setConfirm(null)} /> : <Button className="bg-primary hover:bg-primary/90" disabled={busy} onClick={() => setConfirm("send")}><Send className="me-1 h-4 w-4" />{t("إرسال", "Send")}</Button>)}
          {tr.status === "SENT" && (confirm === "receive" ? <InlineConfirm label={t("تأكيد الاستلام بالكميات أدناه؟", "Confirm receipt with the quantities below?")} onConfirm={() => void act("receive")} onCancel={() => setConfirm(null)} /> : <Button className="bg-[#0B1B49] text-white hover:bg-[#0B1B49]/90" disabled={busy} onClick={() => setConfirm("receive")}><PackageCheck className="me-1 h-4 w-4" />{t("استلام", "Receive")}</Button>)}
          {(tr.status === "DRAFT" || tr.status === "SENT") && (confirm === "cancel" ? <InlineConfirm label={tr.status === "SENT" ? t("إلغاء؟ تعود البضاعة للمصدر", "Cancel? Goods return to the source") : t("إلغاء المسودة؟", "Cancel the draft?")} onConfirm={() => void act("cancel")} onCancel={() => setConfirm(null)} /> : <Button variant="outline" className="border-danger-border text-danger hover:bg-danger-subtle" disabled={busy} onClick={() => setConfirm("cancel")}><X className="me-1 h-4 w-4" />{t("إلغاء", "Cancel")}</Button>)}
        </div>
      </div>

      {/* Printable document */}
      <div className="print-doc rounded-xl border border-border bg-white p-6">
        <div className="mb-4 hidden print:block"><div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{t("مستند تحويل مخزون", "Stock transfer note")} · <span dir="ltr">{tr.number}</span></div></div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><div className="text-xs text-muted-foreground">{t("من", "From")}</div><div className="text-foreground" style={{ fontWeight: 600 }}>{tr.fromWarehouse.code} · {tr.fromWarehouse.name}</div></div>
          <div><div className="text-xs text-muted-foreground">{t("إلى", "To")}</div><div className="text-foreground" style={{ fontWeight: 600 }}>{tr.toWarehouse.code} · {tr.toWarehouse.name}</div></div>
          <div><div className="text-xs text-muted-foreground">{t("أُرسلت", "Sent")}</div><div className="font-english" dir="ltr">{fmtDate(tr.sentAt)}</div></div>
          <div><div className="text-xs text-muted-foreground">{t("استُلمت", "Received")}</div><div className="font-english" dir="ltr">{fmtDate(tr.receivedAt)}{tr.receivedByName ? ` · ${tr.receivedByName}` : ""}</div></div>
        </div>
        {tr.notes && <div className="mt-3 text-sm text-foreground/80">{tr.notes}</div>}
        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-2 py-2 text-start">{t("الصنف", "Item")}</th><th className="px-2 py-2 text-end">{t("المرسَل", "Sent")}</th><th className="px-2 py-2 text-end">{t("تكلفة الوحدة", "Unit cost")}</th><th className="px-2 py-2 text-end">{t("القيمة", "Value")}</th><th className="px-2 py-2 text-end">{t("المستلَم", "Received")}</th><th className="px-2 py-2 text-start">{t("السبب", "Reason")}</th>
          </tr></thead>
          <tbody>
            {tr.lines.map((l) => (
              <tr key={l.id} className="border-b border-border/50">
                <td className="px-2 py-2">{l.product ? displayName(l.product as any) : l.productId}{l.product?.sku ? <span className="ms-2 font-english text-xs text-muted-foreground" dir="ltr">{l.product.sku}</span> : null}</td>
                <td className="px-2 py-2 text-end font-english">{l.qty}</td>
                <td className="px-2 py-2 text-end font-english">{tr.status === "DRAFT" ? "—" : money(l.unitCost)}</td>
                <td className="px-2 py-2 text-end font-english">{tr.status === "DRAFT" ? "—" : money(l.value)}</td>
                <td className="px-2 py-2 text-end">
                  {tr.status === "SENT" ? <Input value={received[l.productId]?.qty ?? ""} onChange={(e) => setReceived((r) => ({ ...r, [l.productId]: { qty: e.target.value, reason: r[l.productId]?.reason || "" } }))} dir="ltr" className="ms-auto h-8 w-24 text-end font-english print:hidden" inputMode="decimal" /> : <span className="font-english">{l.receivedQty ?? "—"}</span>}
                  {tr.status === "SENT" && <span className="hidden font-english print:inline">______</span>}
                  {l.shortfall ? <div className="text-[11px] text-danger">−{l.shortfall}</div> : null}
                </td>
                <td className="px-2 py-2">
                  {tr.status === "SENT" ? <Input value={received[l.productId]?.reason ?? ""} onChange={(e) => setReceived((r) => ({ ...r, [l.productId]: { qty: r[l.productId]?.qty ?? String(l.qty), reason: e.target.value } }))} placeholder={t("تلف · نقص", "damaged · short")} className="h-8 print:hidden" /> : <span className="text-xs text-muted-foreground">{l.reason || "—"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="text-sm" style={{ fontWeight: 700 }}>
            <td className="px-2 py-2">{t("الإجمالي", "Total")}</td><td className="px-2 py-2 text-end font-english">{tr.summary.qty}</td><td></td><td className="px-2 py-2 text-end font-english">{tr.status === "DRAFT" ? "—" : `${money(tr.summary.value)} ${currency}`}</td><td className="px-2 py-2 text-end font-english">{tr.status === "RECEIVED" ? tr.summary.receivedQty : ""}</td><td></td>
          </tr></tfoot>
        </table>
        {tr.status === "SENT" && (
          <div className="mt-3 flex items-center gap-2 print:hidden"><span className="text-xs text-muted-foreground">{t("اسم المستلم", "Received by")}</span><Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className="h-8 w-56" /></div>
        )}
        <div className="mt-8 hidden grid-cols-3 gap-6 text-xs print:grid">
          <div><div className="border-t border-black pt-1">{t("المرسِل", "Sender")}</div></div>
          <div><div className="border-t border-black pt-1">{t("السائق / الناقل", "Driver / carrier")}</div></div>
          <div><div className="border-t border-black pt-1">{t("المستلم", "Receiver")}</div></div>
        </div>
      </div>

      {tr.status === "RECEIVED" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success-border bg-success-subtle px-4 py-3 text-sm text-success print:hidden">
          <Check className="h-4 w-4" />{t("استُلمت البضاعة في مستودع الوجهة بنفس تكلفة الإرسال.", "Goods landed at the destination at the sent cost.")}
          {tr.summary.shortfallValue > 0 && <span className="text-danger">{t(`نقص ${money(tr.summary.shortfallValue)} ${currency}`, `Shortfall ${money(tr.summary.shortfallValue)} ${currency}`)}</span>}
          {tr.journal ? <Link to={`/app/journal-entries/${tr.journal.id}`} className="ms-auto font-english underline underline-offset-2" dir="ltr">{tr.journal.entryNumber} ↗</Link> : null}
        </div>
      )}
      <style>{`@media print { .print\\:hidden { display: none !important; } aside, header, nav { display: none !important; } .print-doc { border: 0 !important; padding: 0 !important; } }`}</style>
    </div>
  );
}
