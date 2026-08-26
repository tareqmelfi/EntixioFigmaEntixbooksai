/**
 * POS v2 · الكاشير (CEO 2026-08-25)
 *
 * «سهلة · مرنة · ما تتأثر بانقطاع النت · طابعة فواتير سريعة وصغيرة · أفضل من أي
 * برنامج مرّ على البقالة». Standalone full-screen workstation (no app chrome):
 *
 *  · Two-tap rule: item → Pay. Barcode field always focused (USB scanner = keyboard + Enter).
 *    `3*` prefix = quantity multiplier for the next scan/tap.
 *  · Offline-first: catalog cached · every sale queued locally with its exact
 *    device time (`occurredAt`) then uploaded in the background (instant) or on
 *    demand (manual · daily/weekly shops). Nothing blocks the cashier.
 *  · Receipts: 58 / 80 mm thermal · auto-print · reprint from «آخر العمليات».
 *  · Holds · shift open/close with drawer reconciliation · branch tag · cashier name.
 *  · UX-1: no dialogs / no browser prompts — every confirmation is inline.
 *  · Keys: F2 search · F9 pay · F4 hold · Esc clear/close · +/- on selected line.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Search, ScanBarcode, X, Plus, Minus, Trash2, Banknote, CreditCard, Wallet, Pause, Play, Lock, Unlock,
  Printer, Settings2, CloudUpload, CloudOff, Cloud, Check, Package, Wrench, Milk, Croissant, CupSoda,
  Wheat, Candy, SprayCan, Beef, Carrot, Apple, Egg, Droplets, Pill, Shirt, Smartphone, Cigarette, Baby, Dog,
  User, LogOut, ChevronDown, History, Loader2, AlertTriangle, Store, type LucideIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useLanguage } from "../components/LanguageContext";
import {
  type PosCatalog, type PosProduct, type QueuedSale, type QueuedLine, type PaymentMethod, type PosSettings, type Hold,
  loadSettings, saveSettings, loadCatalogCache, refreshCatalog, loadHolds, saveHolds, loadShiftCache, saveShiftCache,
  loadQueue, enqueueSale, subscribeQueue, syncPending, startAutoSync, isSyncing, pendingCount, nextProvisionalNumber,
  uuid, deviceId, money, lineTotals,
} from "../lib/pos-store";
import { printReceipt, receiptHtml } from "../lib/pos-receipt";

// ── category → monochrome icon (CEO: no cheap colourful emoji) ────────────────
const CAT_ICONS: Array<[RegExp, LucideIcon]> = [
  [/حليب|ألبان|اجبان|أجبان|جبن|لبن|زبادي|milk|dairy|cheese|yogh?urt/i, Milk],
  [/خبز|مخبوز|صامولي|كرواسون|bread|bakery|croissant/i, Croissant],
  [/ماء|عصير|مشروب|قهوة|شاي|water|juice|drink|coffee|tea|cola|بيبسي|كولا|soda/i, CupSoda],
  [/أرز|رز|سكر|طحين|دقيق|معكرونة|فول|حمص|عدس|rice|sugar|flour|pasta|grain/i, Wheat],
  [/شوكولات|حلوى|حلويات|بسكويت|كيك|candy|chocolate|biscuit|sweet|snack/i, Candy],
  [/منظف|صابون|منديل|مناديل|شامبو|detergent|soap|tissue|clean|shampoo/i, SprayCan],
  [/لحم|دجاج|سمك|فراخ|meat|chicken|fish|beef/i, Beef],
  [/خضار|طماط|بصل|بطاط|خيار|vegetable|veg/i, Carrot],
  [/فاكهة|فواكه|موز|تفاح|برتقال|عنب|fruit|banana|apple/i, Apple],
  [/بيض|egg/i, Egg],
  [/زيت|oil|عسل|honey/i, Droplets],
  [/دواء|صيدل|pharma|medic|vitamin|فيتامين/i, Pill],
  [/ملابس|قميص|cloth|shirt|wear/i, Shirt],
  [/جوال|هاتف|شاحن|phone|mobile|charger|electronic|إلكترون/i, Smartphone],
  [/دخان|سجائر|tobacco|cigar/i, Cigarette],
  [/أطفال|حفاض|baby|diaper/i, Baby],
  [/حيوان|قطط|كلاب|pet|cat|dog/i, Dog],
];
function iconFor(p: PosProduct): LucideIcon {
  const hay = `${p.name} ${p.nameAr ?? ""} ${p.category ?? ""}`;
  for (const [re, I] of CAT_ICONS) if (re.test(hay)) return I;
  return p.type === "SERVICE" ? Wrench : Package;
}

type CartLine = { product: PosProduct; qty: number; unitPrice: number };
type Panel = "none" | "settings" | "history" | "close" | "customer";

const QUICK_CASH = [5, 10, 20, 50, 100, 200, 500];

function beep(kind: "ok" | "err", enabled: boolean) {
  if (!enabled) return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext; if (!Ctx) return;
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = kind === "ok" ? 880 : 220; g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (kind === "ok" ? 0.08 : 0.25));
  } catch { /* no audio */ }
}

export function PosPage() {
  const { language, t } = useLanguage();
  const isRtl = language === "ar";
  const lang: "ar" | "en" = isRtl ? "ar" : "en";

  // ── device state ──
  const [settings, setSettings] = useState<PosSettings>(() => loadSettings());
  const [catalog, setCatalog] = useState<PosCatalog | null>(() => loadCatalogCache());
  const [catalogErr, setCatalogErr] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedSale[]>(() => loadQueue());
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [holds, setHolds] = useState<Hold[]>(() => loadHolds());
  const [shift, setShift] = useState<{ id: string; openedAt: string; openingFloat: string } | null>(() => loadShiftCache());
  const [shiftChecked, setShiftChecked] = useState(false);
  const [floatInput, setFloatInput] = useState("0");
  const [closeCount, setCloseCount] = useState("");
  const [closeSummary, setCloseSummary] = useState<any | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [toast, setToast] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(null);

  // ── sale state ──
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("*");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState<string>("");
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [customerQ, setCustomerQ] = useState("");
  const [customerHits, setCustomerHits] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<QueuedSale | null>(null); // last completed sale (receipt view)
  const [confirmClear, setConfirmClear] = useState(false);
  const [mobileCart, setMobileCart] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((kind: "ok" | "err" | "info", msg: string) => {
    setToast({ kind, msg }); window.setTimeout(() => setToast(null), kind === "err" ? 5000 : 2600);
  }, []);

  // ── boot: catalog (cache first, then refresh) · shift · queue subscription · auto-sync ──
  useEffect(() => {
    let alive = true;
    refreshCatalog().then((c) => { if (alive) { setCatalog(c); setCatalogErr(null); } }).catch((e) => { if (alive && !catalog) setCatalogErr(e?.message || "failed"); });
    api.posShiftCurrent().then((r) => { if (!alive) return; setShift(r.shift); saveShiftCache(r.shift); }).catch(() => { /* offline · keep cache */ }).finally(() => alive && setShiftChecked(true));
    const unsub = subscribeQueue(() => { setQueue(loadQueue()); setSyncBusy(isSyncing()); });
    const stop = startAutoSync(() => loadSettings().syncMode);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { alive = false; unsub(); stop(); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist settings
  const updateSettings = (patch: Partial<PosSettings>) => setSettings((s) => { const n = { ...s, ...patch }; saveSettings(n); return n; });

  // ── focus discipline: the scan field owns the keyboard unless a panel is open ──
  const refocus = useCallback(() => { window.setTimeout(() => { if (panel === "none" && !done) scanRef.current?.focus(); }, 30); }, [panel, done]);
  useEffect(() => { refocus(); }, [cart, shift, panel, done, refocus]);

  const items = catalog?.items ?? [];
  const orgVat = catalog?.orgVatRate ?? 0.15;
  const store = catalog?.store ?? null;
  const currency = store?.baseCurrency || t("ر.س", "SAR");
  const branches = catalog?.branches ?? [];
  const branchName = branches.find((b) => b.id === settings.branchId)?.name ?? null;

  const cats = useMemo(() => ["*", ...Array.from(new Set(items.map((p) => p.category).filter(Boolean) as string[]))], [items]);
  const qtyPrefix = useMemo(() => { const m = query.match(/^(\d{1,3})\*\s*(.*)$/); return m ? { qty: Number(m[1]), rest: m[2] } : null; }, [query]);
  const effectiveQuery = qtyPrefix ? qtyPrefix.rest : query;
  const filtered = useMemo(() => {
    const q = effectiveQuery.trim().toLowerCase();
    return items.filter((p) => (cat === "*" || p.category === cat) && (!q || p.name.toLowerCase().includes(q) || (p.nameAr || "").includes(effectiveQuery.trim()) || (p.sku || "").toLowerCase().includes(q)));
  }, [items, cat, effectiveQuery]);

  const rateFor = (p: PosProduct) => (p.taxRate ? Number(p.taxRate.rate) : orgVat);

  const add = useCallback((p: PosProduct, qty = 1) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + qty }; return next; }
      return [...prev, { product: p, qty, unitPrice: Number(p.unitPrice) }];
    });
    setSelectedLine(p.id);
    setQuery("");
    beep("ok", settings.soundOn);
    refocus();
  }, [refocus, settings.soundOn]);

  const onScanEnter = () => {
    const raw = effectiveQuery.trim();
    const qty = qtyPrefix?.qty && qtyPrefix.qty > 0 ? qtyPrefix.qty : 1;
    if (!raw) { if (cart.length) void pay(); return; }
    const exact = items.find((p) => (p.sku || "").toLowerCase() === raw.toLowerCase());
    if (exact) return add(exact, qty);
    // B3.2 · alias barcode (carton/pack) → product × unitMultiplier
    for (const p of items) {
      const alias = (p.barcodes || []).find((b) => b.barcode.toLowerCase() === raw.toLowerCase());
      if (alias) return add(p, qty * (Number(alias.unitMultiplier) || 1));
    }
    const byName = items.filter((p) => p.name.toLowerCase().includes(raw.toLowerCase()) || (p.nameAr || "").includes(raw));
    if (byName.length === 1) return add(byName[0], qty);
    if (byName.length === 0) { beep("err", settings.soundOn); showToast("err", t(`لا يوجد صنف بالباركود/الاسم «${raw}»`, `No item matches “${raw}”`)); setQuery(""); }
  };

  const setQty = (id: string, qty: number) => setCart((prev) => (qty <= 0 ? prev.filter((l) => l.product.id !== id) : prev.map((l) => (l.product.id === id ? { ...l, qty } : l))));
  const setPrice = (id: string, price: number) => setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, unitPrice: Math.max(0, price) } : l)));

  const qLines: QueuedLine[] = useMemo(() => cart.map((l) => ({ productId: l.product.id, qty: l.qty, unitPrice: l.unitPrice, name: l.product.name, nameAr: l.product.nameAr, sku: l.product.sku, taxRate: rateFor(l.product) })), [cart, orgVat]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => lineTotals(qLines), [qLines]);
  const tenderedNum = tendered === "" ? null : Number(tendered.replace(/[^0-9.]/g, "")) || 0;
  const change = method === "CASH" && tenderedNum != null ? tenderedNum - totals.grand : 0;
  const canPay = cart.length > 0 && !busy && (method !== "CASH" || tenderedNum == null || tenderedNum >= totals.grand - 0.005);

  const clearSale = () => { setCart([]); setTendered(""); setCustomer(null); setSelectedLine(null); setConfirmClear(false); };

  // ── pay · queue first, then sync in the background ──
  const pay = async () => {
    if (!canPay) return;
    setBusy(true);
    try {
      const grand = totals.grand;
      const tender = method === "CASH" ? (tenderedNum ?? grand) : grand;
      const sale: QueuedSale = {
        clientSaleId: uuid(),
        occurredAt: new Date().toISOString(),
        provisionalNumber: nextProvisionalNumber(),
        lines: qLines,
        paymentMethod: method,
        amountTendered: tender,
        shiftId: shift?.id ?? null,
        branchId: settings.branchId,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
        cashierName: settings.cashierName || null,
        totals: { net: totals.net, vat: totals.vat, grand, change: Math.max(0, tender - grand) },
        status: "pending", attempts: 0, lastError: null, invoiceNumber: null, invoiceId: null, syncedAt: null,
      };
      enqueueSale(sale);
      let final = sale;
      if (online && settings.syncMode === "instant") {
        try {
          await syncPending();
          final = loadQueue().find((s) => s.clientSaleId === sale.clientSaleId) ?? sale;
        } catch { /* stays queued */ }
      }
      setDone(final);
      clearSale();
      beep("ok", settings.soundOn);
      if (settings.autoPrint) void printReceipt(final, store, { paper: settings.paper, lang, footerText: settings.footerText, showLogo: settings.showLogo, branchName, currency });
    } finally { setBusy(false); }
  };

  // ── holds ──
  const persistHolds = (h: Hold[]) => { setHolds(h); saveHolds(h); };
  const holdCurrent = () => { if (!cart.length) return; persistHolds([...holds, { id: uuid().slice(0, 8), at: new Date().toISOString(), lines: cart.map((l) => ({ productId: l.product.id, qty: l.qty })) }]); clearSale(); showToast("info", t("عُلّقت الفاتورة", "Sale put on hold")); };
  const resumeHold = (h: Hold) => {
    const lines: CartLine[] = h.lines.map((l) => { const p = items.find((x) => x.id === l.productId); return p ? { product: p, qty: l.qty, unitPrice: Number(p.unitPrice) } : null; }).filter(Boolean) as CartLine[];
    setCart(lines); persistHolds(holds.filter((x) => x.id !== h.id)); setPanel("none");
  };

  // ── sync ──
  const manualSync = async () => {
    if (!online) { showToast("err", t("لا يوجد اتصال — ستُرفع العمليات تلقائيًا عند عودة الشبكة", "Offline — sales upload automatically when the connection returns")); return; }
    setSyncBusy(true);
    const r = await syncPending({ force: true });
    setSyncBusy(false);
    if (r.error) showToast("err", t(`فشل الرفع: ${r.error}`, `Upload failed: ${r.error}`));
    else if (r.sent === 0) showToast("info", t("لا توجد عمليات بانتظار الرفع", "Nothing pending"));
    else showToast("ok", t(`رُفعت ${r.created + r.duplicate} عملية${r.failed ? ` · فشل ${r.failed}` : ""}`, `Uploaded ${r.created + r.duplicate} sale(s)${r.failed ? ` · ${r.failed} failed` : ""}`));
    setSyncNote(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
  };

  // ── shift ──
  const openShift = async () => {
    try { await api.posShiftOpen(Number(floatInput) || 0, settings.branchId); const r = await api.posShiftCurrent(); setShift(r.shift); saveShiftCache(r.shift); }
    catch (e: any) { showToast("err", e?.message || t("تعذر فتح الوردية", "Could not open the shift")); }
  };
  const [localMode, setLocalMode] = useState(false);
  const startWithoutShift = () => { setShift(null); saveShiftCache(null); setShiftChecked(true); setLocalMode(true); };
  const closeShift = async () => {
    const n = Number(closeCount.replace(/[^0-9.]/g, ""));
    if (!closeCount || Number.isNaN(n)) return;
    try {
      if (pendingCount() > 0 && online) await syncPending({ force: true });
      const r = await api.posShiftClose(n);
      setCloseSummary(r.summary); setShift(null); saveShiftCache(null); setPanel("none"); setCloseCount("");
    } catch (e: any) { showToast("err", e?.message || t("تعذر إغلاق الوردية", "Could not close the shift")); }
  };

  // ── customer search ──
  useEffect(() => {
    if (panel !== "customer") return;
    const q = customerQ.trim(); if (q.length < 2) { setCustomerHits([]); return; }
    const h = window.setTimeout(() => {
      api.contacts.list({ role: "customer", q, limit: 8 }).then((r: any) => setCustomerHits((r.items || r.data || []).map((c: any) => ({ id: c.id, name: c.displayName || c.name })))).catch(() => setCustomerHits([]));
    }, 250);
    return () => window.clearTimeout(h);
  }, [customerQ, panel]);

  // ── keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); scanRef.current?.focus(); scanRef.current?.select(); }
      else if (e.key === "F9") { e.preventDefault(); if (!done) void pay(); }
      else if (e.key === "F4") { e.preventDefault(); holdCurrent(); }
      else if (e.key === "Escape") { if (done) setDone(null); else if (panel !== "none") setPanel("none"); else if (query) setQuery(""); else setConfirmClear(false); }
      else if ((e.key === "+" || e.key === "-") && selectedLine && document.activeElement === scanRef.current && !query) {
        e.preventDefault(); const l = cart.find((x) => x.product.id === selectedLine); if (l) setQty(l.product.id, l.qty + (e.key === "+" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pending = queue.filter((s) => s.status !== "synced");
  const failedCount = queue.filter((s) => s.status === "failed").length;
  const recent = [...queue].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 50);
  const reprint = (s: QueuedSale) => printReceipt(s, store, { paper: settings.paper, lang, footerText: settings.footerText, showLogo: settings.showLogo, branchName, currency });

  // ═══════════════════════════════ shift gate ═══════════════════════════════
  if (shiftChecked && !shift && !closeSummary && !localMode) {
    return (
      <Shell dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-raised">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Unlock className="h-7 w-7" /></div>
            <h1 className="mt-4 text-center text-xl font-bold text-foreground">{t("افتح الوردية للبدء", "Open a shift to start")}</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">{t("عهدة الدرج تُطابَق عند الإغلاق · العمليات تُرحّل تلقائيًا", "Drawer float reconciles at close · sales post automatically")}</p>
            <label className="mt-6 block text-xs font-semibold text-foreground">{t("العهدة الافتتاحية (نقد الدرج)", "Opening float (drawer cash)")}</label>
            <input value={floatInput} onChange={(e) => setFloatInput(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" dir="ltr"
              className="mt-1.5 w-full rounded-xl border-2 border-primary/60 bg-canvas px-4 py-3 text-center text-2xl font-bold text-foreground outline-none focus:border-primary" />
            <button onClick={openShift} disabled={!online} className="mt-4 h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {t("فتح الوردية", "Open shift")}
            </button>
            {!online && (
              <button onClick={startWithoutShift} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface text-sm font-semibold text-foreground hover:bg-muted/40">
                <CloudOff className="me-1.5 inline h-4 w-4" /> {t("لا يوجد اتصال — ابدأ البيع الآن (ترحيل لاحقًا)", "Offline — start selling now (upload later)")}
              </button>
            )}
            <Link to="/app/dashboard" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">{t("← العودة للتطبيق", "← Back to the app")}</Link>
          </div>
        </div>
      </Shell>
    );
  }

  // ═══════════════════════════════ close summary ════════════════════════════
  if (closeSummary) {
    const diff = Number(closeSummary.difference || 0);
    const rows: Array<[string, number]> = [
      [t("العهدة الافتتاحية", "Opening float"), closeSummary.openingFloat], [t("المبيعات النقدية", "Cash sales"), closeSummary.cashSales],
      [t("المتوقع بالدرج", "Expected in drawer"), closeSummary.expectedCash], [t("المعدود فعليًا", "Counted"), closeSummary.closingCount],
    ];
    return (
      <Shell dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-raised">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-foreground"><Lock className="h-7 w-7" /></div>
            <h1 className="mt-4 text-center text-xl font-bold text-foreground">{t("أُغلقت الوردية", "Shift closed")}</h1>
            <div className="mt-5 divide-y divide-border/60 text-sm">
              {rows.map(([l, v]) => (<div key={l} className="flex items-center justify-between py-2"><span className="text-muted-foreground">{l}</span><span className="font-english font-semibold text-foreground">{money(Number(v))}</span></div>))}
              <div className={`flex items-center justify-between py-2 text-base font-bold ${Math.abs(diff) < 0.005 ? "text-success" : "text-danger"}`}><span>{t("الفرق", "Difference")}</span><span className="font-english">{diff > 0 ? "+" : ""}{money(diff)}</span></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm"><span className="text-muted-foreground">{t("إجمالي مبيعات الوردية", "Shift sales")}</span><span className="font-english font-bold text-foreground">{money(Number(closeSummary.salesTotal))} · {closeSummary.salesCount}</span></div>
            <button onClick={() => setCloseSummary(null)} className="mt-5 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90">{t("تم", "Done")}</button>
            <Link to="/app/dashboard" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">{t("← العودة للتطبيق", "← Back to the app")}</Link>
          </div>
        </div>
      </Shell>
    );
  }

  // ═══════════════════════════════ cashier ══════════════════════════════════
  const tile = settings.tileSize === "compact" ? "minmax(118px,1fr)" : "minmax(150px,1fr)";
  return (
    <Shell dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* ── top bar ── */}
        <header className="flex h-14 shrink-0 items-center gap-3 bg-[#0B1B49] px-3 text-white sm:px-4">
          <Link to="/app/dashboard" title={t("الخروج من الكاشير", "Exit the cashier")} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"><LogOut className="h-5 w-5 rtl:rotate-180" /></Link>
          <div className="flex min-w-0 items-center gap-2">
            <Store className="h-4 w-4 text-[#05B6FA]" />
            <div className="truncate text-sm font-bold">{store?.name || "ENTIX"}<span className="mx-1.5 text-white/40">·</span><span className="font-normal text-white/80">{branchName || t("الكاشير", "Cashier")}</span></div>
          </div>
          {shift ? (
            <span className="hidden items-center gap-1.5 rounded-full border border-success/40 bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-[#86EFAC] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />{t("وردية مفتوحة", "Shift open")} · <span className="font-english">{new Date(shift.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></span>
          ) : (
            <span className="hidden rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-[#FCD34D] sm:flex">{t("بدون وردية", "No shift")}</span>
          )}
          <div className="ms-auto flex items-center gap-1.5">
            {/* sync status */}
            <button onClick={manualSync} title={t("رفع العمليات المعلّقة الآن", "Upload pending sales now")}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${!online ? "bg-danger/20 text-[#FCA5A5]" : pending.length ? "bg-warning/20 text-[#FCD34D]" : "bg-white/10 text-white/80"}`}>
              {syncBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : !online ? <CloudOff className="h-3.5 w-3.5" /> : pending.length ? <CloudUpload className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{!online ? t("غير متصل", "Offline") : pending.length ? t(`${pending.length} بانتظار الرفع`, `${pending.length} pending`) : t("متزامن", "Synced")}</span>
              {pending.length > 0 && <span className="rounded-full bg-white/20 px-1.5 font-english sm:hidden">{pending.length}</span>}
            </button>
            <button onClick={() => setPanel(panel === "history" ? "none" : "history")} title={t("آخر العمليات · إعادة طباعة", "Recent sales · reprint")} className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 ${panel === "history" ? "bg-white/15" : ""}`}><History className="h-5 w-5" /></button>
            <button onClick={() => setPanel(panel === "settings" ? "none" : "settings")} title={t("الإعدادات", "Settings")} className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 ${panel === "settings" ? "bg-white/15" : ""}`}><Settings2 className="h-5 w-5" /></button>
          </div>
        </header>

        {/* offline strip */}
        {!online && (
          <div className="flex items-center gap-2 bg-warning-subtle px-4 py-1.5 text-xs font-medium text-foreground">
            <CloudOff className="h-4 w-4 text-warning" />
            {t("لا يوجد اتصال — البيع مستمر بشكل طبيعي · كل عملية تُحفظ بوقتها الفعلي وتُرفع تلقائيًا عند عودة الشبكة.", "Offline — keep selling normally · every sale is saved with its real time and uploads automatically when the connection returns.")}
          </div>
        )}
        {failedCount > 0 && online && (
          <div className="flex items-center gap-2 bg-danger-subtle px-4 py-1.5 text-xs font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-danger" />
            {t(`${failedCount} عملية فشل رفعها — افتح «آخر العمليات» للتفاصيل`, `${failedCount} sale(s) failed to upload — open Recent sales for details`)}
            <button onClick={manualSync} className="ms-auto rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold">{t("إعادة المحاولة", "Retry")}</button>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* ── products ── */}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-border bg-surface px-3 py-2.5 sm:px-4">
              <div className="flex h-12 items-center gap-2 rounded-xl border-2 border-primary/50 bg-canvas px-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                <ScanBarcode className="h-5 w-5 shrink-0 text-primary" />
                <input ref={scanRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onScanEnter(); } }}
                  placeholder={t("امسح الباركود أو اكتب اسم الصنف · 3* للكمية · Enter للدفع", "Scan barcode or type a product · 3* for quantity · Enter to pay")}
                  className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/70" autoFocus autoComplete="off" />
                {qtyPrefix && <span className="rounded-md bg-primary/10 px-2 py-0.5 font-english text-xs font-bold text-primary">×{qtyPrefix.qty}</span>}
                {query && <button onClick={() => setQuery("")} className="rounded-md p-1 text-muted-foreground hover:bg-muted/50"><X className="h-4 w-4" /></button>}
                <Search className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2 sm:px-4 [scrollbar-width:none]">
              {cats.map((c) => (
                <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground/80 hover:bg-muted/40"}`}>{c === "*" ? t("الكل", "All") : c}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 sm:px-4 lg:pb-4">
              {catalogErr && !items.length && <div className="rounded-xl border border-danger-border bg-danger-subtle p-4 text-sm text-danger">{catalogErr}</div>}
              {!catalogErr && items.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <Package className="h-8 w-8" />{t("لا أصناف بعد — أضفها من «المنتجات والخدمات»", "No items yet — add them under Products & services")}
                  <Link to="/app/products" className="text-primary underline-offset-2 hover:underline">{t("فتح المنتجات", "Open products")}</Link>
                </div>
              )}
              <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fill, ${tile})` }}>
                {filtered.map((p) => {
                  const inCart = cart.find((l) => l.product.id === p.id)?.qty;
                  const I = iconFor(p);
                  const low = p.type !== "SERVICE" && Number(p.stockQty) <= 0;
                  return (
                    <button key={p.id} onClick={() => add(p, qtyPrefix?.qty || 1)}
                      className={`group relative flex flex-col items-center rounded-2xl border bg-surface p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-raised active:translate-y-0 ${inCart ? "border-primary/60 ring-2 ring-primary/15" : "border-border"}`}>
                      {inCart != null && <span className="absolute top-2 start-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 font-english text-[11px] font-bold text-primary-foreground">{inCart}</span>}
                      {low && <span className="absolute top-2 end-2 rounded-md bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning">{t("نفد", "Out")}</span>}
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-[#0B1B49]/70 group-hover:text-primary">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <I className="h-6 w-6" strokeWidth={1.75} />}
                      </div>
                      <div className="mt-2 line-clamp-2 min-h-[2.4em] text-[13px] font-semibold leading-tight text-foreground">{displayName(p)}</div>
                      <div className="mt-1 font-english text-sm font-bold text-primary">{money(Number(p.unitPrice))} <span className="text-[10px] font-medium text-muted-foreground">{currency}</span></div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── cart / receipt / panels ── */}
          <aside className={`${mobileCart ? "fixed inset-0 z-40 flex" : "hidden"} w-full flex-col border-s border-border bg-surface lg:static lg:flex lg:w-[400px] xl:w-[430px]`}>
            {panel === "settings" ? (
              <SettingsPanel settings={settings} update={updateSettings} branches={branches} onClose={() => setPanel("none")} t={t} device={deviceId()} testPrint={() => { const sample: QueuedSale = { clientSaleId: "sample", occurredAt: new Date().toISOString(), provisionalNumber: "TEST-0001", lines: [{ productId: "x", qty: 2, unitPrice: 5, name: "Sample item", nameAr: "صنف تجريبي", sku: null, taxRate: orgVat }], paymentMethod: "CASH", amountTendered: 20, shiftId: null, branchId: null, customerId: null, customerName: null, cashierName: settings.cashierName || null, totals: { ...lineTotals([{ productId: "x", qty: 2, unitPrice: 5, name: "", nameAr: null, sku: null, taxRate: orgVat }]), change: 10 }, status: "synced", attempts: 0, lastError: null, invoiceNumber: null, invoiceId: null, syncedAt: null }; void reprint(sample); }} />
            ) : panel === "history" ? (
              <HistoryPanel recent={recent} onClose={() => setPanel("none")} reprint={reprint} t={t} currency={currency} syncNote={syncNote} onSync={manualSync} syncBusy={syncBusy} />
            ) : panel === "close" ? (
              <div className="flex h-full flex-col p-4">
                <PanelHeader title={t("إغلاق الوردية", "Close shift")} onClose={() => setPanel("none")} />
                <p className="mt-2 text-sm text-muted-foreground">{t("عدّ النقد في الدرج وأدخل المبلغ · تُرفع العمليات المعلّقة تلقائيًا قبل الإغلاق.", "Count the drawer cash and enter it · pending sales upload before closing.")}</p>
                <input value={closeCount} onChange={(e) => setCloseCount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" dir="ltr" autoFocus placeholder="0.00"
                  className="mt-4 w-full rounded-xl border-2 border-primary/60 bg-canvas px-4 py-3 text-center text-2xl font-bold text-foreground outline-none focus:border-primary" />
                {pending.length > 0 && <div className="mt-2 text-xs text-warning">{t(`${pending.length} عملية بانتظار الرفع — ستُرفع الآن`, `${pending.length} pending sale(s) will upload now`)}</div>}
                <button onClick={closeShift} disabled={!closeCount || !online} className="mt-4 h-12 w-full rounded-xl bg-[#0B1B49] font-bold text-white hover:bg-[#0B1B49]/90 disabled:opacity-50"><Lock className="me-1.5 inline h-4 w-4" />{t("إغلاق الوردية", "Close shift")}</button>
                {!online && <div className="mt-2 text-xs text-danger">{t("إغلاق الوردية يحتاج اتصالًا", "Closing a shift needs a connection")}</div>}
              </div>
            ) : done ? (
              <ReceiptDone sale={done} store={store} currency={currency} t={t} lang={lang} paper={settings.paper} onPrint={() => reprint(done)} onNew={() => { setDone(null); setMobileCart(false); refocus(); }} />
            ) : (
              <>
                {/* customer */}
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <button onClick={() => setPanel("customer")} className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-start text-xs font-medium text-foreground hover:bg-muted/50">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{customer ? customer.name : t("عميل نقدي", "Walk-in customer")}</span><ChevronDown className="ms-auto h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  {customer && <button onClick={() => setCustomer(null)} className="rounded-md p-1 text-muted-foreground hover:text-danger"><X className="h-4 w-4" /></button>}
                  {cart.length > 0 && (confirmClear
                    ? <div className="flex items-center gap-1 text-xs"><button onClick={clearSale} className="rounded-md bg-danger px-2 py-1 font-semibold text-white">{t("مسح", "Clear")}</button><button onClick={() => setConfirmClear(false)} className="rounded-md border border-border px-2 py-1">{t("لا", "No")}</button></div>
                    : <button onClick={() => setConfirmClear(true)} className="text-xs font-semibold text-danger hover:underline">{t("مسح الكل", "Clear all")}</button>)}
                  <button onClick={() => setMobileCart(false)} className="rounded-md p-1 text-muted-foreground lg:hidden"><X className="h-5 w-5" /></button>
                </div>

                {/* lines */}
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
                  {cart.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                      <ScanBarcode className="h-8 w-8 text-muted-foreground/60" />{t("السلة فارغة — امسح صنفًا أو اضغط على بطاقة", "Cart is empty — scan an item or tap a tile")}
                      {holds.length > 0 && <button onClick={() => resumeHold(holds[holds.length - 1])} className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"><Play className="me-1 inline h-3.5 w-3.5" />{t(`استرجاع آخر فاتورة معلّقة (${holds.length})`, `Resume last hold (${holds.length})`)}</button>}
                    </div>
                  )}
                  {cart.map((l) => (
                    <div key={l.product.id} onClick={() => setSelectedLine(l.product.id)} className={`flex items-center gap-2 rounded-xl px-2 py-2 ${selectedLine === l.product.id ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/30"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-foreground">{displayName(l.product)}</div>
                        <div className="flex items-center gap-1 font-english text-[11px] text-muted-foreground">
                          <input value={l.unitPrice} onChange={(e) => setPrice(l.product.id, Number(e.target.value) || 0)} onFocus={(e) => e.target.select()} inputMode="decimal" dir="ltr" className="w-16 rounded border border-transparent bg-transparent px-1 text-start hover:border-border focus:border-primary focus:bg-surface" title={t("تعديل السعر", "Edit price")} />
                          × {l.qty}
                        </div>
                      </div>
                      <div className="flex items-center rounded-full bg-canvas p-0.5">
                        <button onClick={(e) => { e.stopPropagation(); setQty(l.product.id, l.qty - 1); }} className="flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-surface"><Minus className="h-4 w-4" /></button>
                        <span className="w-8 text-center font-english text-sm font-bold text-foreground">{l.qty}</span>
                        <button onClick={(e) => { e.stopPropagation(); setQty(l.product.id, l.qty + 1); }} className="flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-surface"><Plus className="h-4 w-4" /></button>
                      </div>
                      <div className="w-[68px] text-end font-english text-[13px] font-bold text-foreground">{money(l.unitPrice * l.qty)}</div>
                      <button onClick={(e) => { e.stopPropagation(); setQty(l.product.id, 0); }} className="rounded-md p-1 text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>

                {/* totals */}
                <div className="border-t border-border px-4 pt-3">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{t("قبل الضريبة", "Subtotal")}</span><span className="font-english">{money(totals.net)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{t("ضريبة القيمة المضافة", "VAT")}</span><span className="font-english">{money(totals.vat)}</span></div>
                  <div className="mt-1 flex items-baseline justify-between"><span className="text-base font-bold text-foreground">{t("الإجمالي", "Total")}</span><span className="font-english text-2xl font-extrabold text-[#0B1B49]">{money(totals.grand)} <span className="text-xs font-semibold text-muted-foreground">{currency}</span></span></div>
                </div>

                {/* method + tender */}
                <div className="px-4 pt-3">
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-canvas p-1">
                    {([["CASH", Banknote, t("نقد", "Cash")], ["MADA", Wallet, t("مدى", "Mada")], ["CARD", CreditCard, t("بطاقة", "Card")]] as const).map(([m, I, lb]) => (
                      <button key={m} onClick={() => { setMethod(m); if (m !== "CASH") setTendered(""); }} className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${method === m ? "bg-surface text-[#0B1B49] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><I className="h-4 w-4" />{lb}</button>
                    ))}
                  </div>
                  {method === "CASH" && (
                    <div className="mt-2">
                      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                        <button onClick={() => setTendered(totals.grand.toFixed(2))} className="shrink-0 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 font-english text-xs font-bold text-primary">{t("مضبوط", "Exact")}</button>
                        {QUICK_CASH.filter((v) => v >= totals.grand || v >= 50).slice(0, 5).map((v) => (<button key={v} onClick={() => setTendered(String(v))} className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 font-english text-xs font-bold text-foreground hover:bg-muted/40">{v}</button>))}
                        <input value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" dir="ltr" placeholder={t("مبلغ آخر", "Other")} className="w-24 shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 font-english text-xs font-bold text-foreground outline-none focus:border-primary" />
                      </div>
                      {tenderedNum != null && cart.length > 0 && (
                        <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 ${change >= 0 ? "bg-success-subtle" : "bg-danger-subtle"}`}>
                          <span className={`text-xs font-semibold ${change >= 0 ? "text-success" : "text-danger"}`}>{change >= 0 ? t(`الباقي للعميل (من ${money(tenderedNum)})`, `Change (from ${money(tenderedNum)})`) : t("المبلغ أقل من الإجمالي", "Less than the total")}</span>
                          <span className={`font-english text-xl font-extrabold ${change >= 0 ? "text-success" : "text-danger"}`}>{money(Math.abs(change))}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* actions */}
                <div className="p-4 pt-3">
                  <button onClick={pay} disabled={!canPay} className={`flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-extrabold text-white transition-all ${canPay ? "bg-[#16A34A] shadow-[0_8px_24px_rgba(22,163,74,.35)] hover:bg-[#15803D]" : "bg-muted text-muted-foreground"}`}>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6" />}{t("دفع", "Pay")}<span className="rounded-lg bg-white/20 px-3 py-1 font-english text-base">{money(totals.grand)}</span>
                    <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 font-english text-[10px] font-semibold sm:inline">F9</kbd>
                  </button>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <button onClick={holdCurrent} disabled={!cart.length} className="flex h-10 items-center justify-center gap-1 rounded-xl border border-warning-border bg-warning-subtle text-xs font-semibold text-foreground disabled:opacity-40"><Pause className="h-3.5 w-3.5" />{t("تعليق", "Hold")}{holds.length > 0 && <span className="rounded-full bg-warning px-1.5 font-english text-[10px] text-white">{holds.length}</span>}</button>
                    <button onClick={() => holds.length && resumeHold(holds[holds.length - 1])} disabled={!holds.length} className="flex h-10 items-center justify-center gap-1 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground disabled:opacity-40"><Play className="h-3.5 w-3.5" />{t("استرجاع", "Resume")}</button>
                    <button onClick={() => setPanel("close")} disabled={!shift} className="flex h-10 items-center justify-center gap-1 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground disabled:opacity-40"><Lock className="h-3.5 w-3.5" />{t("إغلاق الوردية", "Close shift")}</button>
                  </div>
                </div>
              </>
            )}

            {/* customer picker (inline · replaces cart) */}
            {panel === "customer" && (
              <div className="absolute inset-0 flex flex-col bg-surface p-4">
                <PanelHeader title={t("اختيار العميل", "Choose customer")} onClose={() => { setPanel("none"); setCustomerQ(""); }} />
                <input value={customerQ} onChange={(e) => setCustomerQ(e.target.value)} autoFocus placeholder={t("ابحث بالاسم أو الجوال…", "Search by name or phone…")} className="mt-3 h-11 w-full rounded-xl border border-border bg-canvas px-3 text-sm outline-none focus:border-primary" />
                <button onClick={() => { setCustomer(null); setPanel("none"); }} className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-start text-sm hover:bg-muted/40"><User className="h-4 w-4 text-muted-foreground" />{t("عميل نقدي (بدون اسم)", "Walk-in (no name)")}</button>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {customerHits.map((c) => (<button key={c.id} onClick={() => { setCustomer(c); setPanel("none"); setCustomerQ(""); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm hover:bg-muted/40"><User className="h-4 w-4 text-primary" />{c.name}</button>))}
                  {customerQ.trim().length >= 2 && customerHits.length === 0 && <div className="p-3 text-xs text-muted-foreground">{t("لا نتائج", "No results")}</div>}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* mobile bottom bar */}
        {!mobileCart && (
          <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-surface p-3 lg:hidden">
            <button onClick={() => setMobileCart(true)} className="flex h-12 flex-1 items-center justify-between rounded-xl bg-[#0B1B49] px-4 text-white">
              <span className="text-sm font-semibold">{t(`السلة · ${cart.reduce((a, l) => a + l.qty, 0)} صنف`, `Cart · ${cart.reduce((a, l) => a + l.qty, 0)} items`)}</span><span className="font-english text-base font-bold">{money(totals.grand)}</span>
            </button>
            <button onClick={() => { setMobileCart(true); }} disabled={!cart.length} className="h-12 rounded-xl bg-[#16A34A] px-5 text-sm font-bold text-white disabled:opacity-40">{t("دفع", "Pay")}</button>
          </div>
        )}

        {/* toast */}
        {toast && (
          <div className={`pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-raised lg:bottom-6 ${toast.kind === "err" ? "bg-danger" : toast.kind === "ok" ? "bg-[#16A34A]" : "bg-[#0B1B49]"}`}>{toast.msg}</div>
        )}
      </div>
    </Shell>
  );
}

// ── small building blocks ─────────────────────────────────────────────────────
function Shell({ dir, children }: { dir: "rtl" | "ltr"; children: React.ReactNode }) {
  return <div dir={dir} className="min-h-screen bg-canvas text-foreground" style={{ fontFamily: dir === "rtl" ? "'Noto Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif" : "'Plus Jakarta Sans', 'Noto Sans Arabic', system-ui, sans-serif" }}>{children}</div>;
}
function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="flex items-center justify-between"><h2 className="text-base font-bold text-foreground">{title}</h2><button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"><X className="h-5 w-5" /></button></div>;
}

function ReceiptDone({ sale, store, currency, t, lang, paper, onPrint, onNew }: { sale: QueuedSale; store: any; currency: string; t: (a: string, e: string) => string; lang: "ar" | "en"; paper: "58" | "80"; onPrint: () => void; onNew: () => void }) {
  const html = useMemo(() => receiptHtml(sale, store, { paper, lang, currency }), [sale, store, paper, lang, currency]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 bg-[#16A34A] px-4 py-4 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20"><Check className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{t("تمت العملية", "Sale completed")}</div>
          <div className="truncate font-english text-xs text-white/85">{sale.invoiceNumber || sale.provisionalNumber}{!sale.invoiceNumber && <span className="ms-1 rounded bg-white/20 px-1">{t("سيُرقّم عند الرفع", "numbered on upload")}</span>}</div>
        </div>
        {sale.paymentMethod === "CASH" && sale.totals.change > 0 && (
          <div className="text-end"><div className="text-[10px] uppercase tracking-wide text-white/80">{t("الباقي", "Change")}</div><div className="font-english text-2xl font-extrabold">{money(sale.totals.change)}</div></div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        <iframe title="receipt" srcDoc={html} className="mx-auto block h-[520px] rounded-lg border border-border bg-white shadow-sm" style={{ width: paper === "58" ? 230 : 320 }} />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
        <button onClick={onPrint} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-bold text-foreground hover:bg-muted/40"><Printer className="h-4 w-4" />{t("طباعة", "Print")}</button>
        <button onClick={onNew} autoFocus className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />{t("بيع جديد", "New sale")} <kbd className="rounded bg-white/20 px-1 font-english text-[10px]">Esc</kbd></button>
      </div>
    </div>
  );
}

function HistoryPanel({ recent, onClose, reprint, t, currency, syncNote, onSync, syncBusy }: { recent: QueuedSale[]; onClose: () => void; reprint: (s: QueuedSale) => void; t: (a: string, e: string) => string; currency: string; syncNote: string | null; onSync: () => void; syncBusy: boolean }) {
  return (
    <div className="flex h-full flex-col p-4">
      <PanelHeader title={t("آخر العمليات", "Recent sales")} onClose={onClose} />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("تُحفظ على هذا الجهاز 7 أيام لإعادة الطباعة", "Kept on this device for 7 days for reprints")}</span>
        <button onClick={onSync} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:bg-muted/40">{syncBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}{t("رفع الآن", "Upload now")}</button>
      </div>
      {syncNote && <div className="mt-1 text-[11px] text-muted-foreground">{t("آخر رفع", "Last upload")} · <span className="font-english">{syncNote}</span></div>}
      <div className="mt-3 min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
        {recent.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">{t("لا عمليات بعد", "No sales yet")}</div>}
        {recent.map((s) => (
          <div key={s.clientSaleId} className="flex items-center gap-2 py-2.5">
            <div className={`h-2 w-2 shrink-0 rounded-full ${s.status === "synced" ? "bg-success" : s.status === "failed" ? "bg-danger" : "bg-warning"}`} title={s.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground"><span className="font-english">{s.invoiceNumber || s.provisionalNumber}</span>{s.status !== "synced" && <span className="rounded bg-warning-subtle px-1.5 py-0.5 text-[10px] font-medium text-warning">{s.status === "failed" ? t("فشل", "failed") : t("بانتظار الرفع", "pending")}</span>}</div>
              <div className="font-english text-[11px] text-muted-foreground">{new Date(s.occurredAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {s.lines.length} {t("صنف", "items")} · {s.paymentMethod}{s.lastError ? ` · ${s.lastError}` : ""}</div>
            </div>
            <div className="font-english text-sm font-bold text-foreground">{money(s.totals.grand)} <span className="text-[10px] font-medium text-muted-foreground">{currency}</span></div>
            <button onClick={() => reprint(s)} title={t("إعادة طباعة", "Reprint")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"><Printer className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ settings, update, branches, onClose, t, device, testPrint }: { settings: PosSettings; update: (p: Partial<PosSettings>) => void; branches: Array<{ id: string; name: string }>; onClose: () => void; t: (a: string, e: string) => string; device: string; testPrint: () => void }) {
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="flex items-center justify-between gap-3 py-2.5"><span className="text-sm text-foreground">{label}</span>{children}</div>;
  const Seg = <T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) => (
    <div className="flex rounded-lg bg-canvas p-0.5">{options.map(([v, l]) => <button key={v} onClick={() => onChange(v)} className={`rounded-md px-3 py-1 text-xs font-semibold ${value === v ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"}`}>{l}</button>)}</div>
  );
  const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => <button onClick={() => onChange(!on)} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "start-[22px]" : "start-0.5"}`} /></button>;
  return (
    <div className="flex h-full flex-col p-4">
      <PanelHeader title={t("إعدادات الكاشير", "Cashier settings")} onClose={onClose} />
      <div className="mt-2 min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
        <Row label={t("عرض ورق الطابعة", "Receipt paper")}><Seg value={settings.paper} options={[["58", "58 mm"], ["80", "80 mm"]]} onChange={(v) => update({ paper: v })} /></Row>
        <Row label={t("طباعة تلقائية بعد الدفع", "Auto-print after payment")}><Toggle on={settings.autoPrint} onChange={(v) => update({ autoPrint: v })} /></Row>
        <Row label={t("رفع العمليات", "Upload sales")}><Seg value={settings.syncMode} options={[["instant", t("فوري", "Instant")], ["manual", t("يدوي", "Manual")]]} onChange={(v) => update({ syncMode: v })} /></Row>
        <div className="pb-2 text-[11px] leading-relaxed text-muted-foreground">{t("يدوي = تُحفظ العمليات على الجهاز وتُرفع عند الضغط على «رفع الآن» (يوميًا أو أسبوعيًا). في الحالتين يُسجَّل كل بيع بوقته الفعلي وقت الدفع.", "Manual = sales stay on the device until you press “Upload now” (daily or weekly). Either way every sale is booked at its real payment time.")}</div>
        {branches.length > 0 && (
          <Row label={t("الفرع", "Branch")}>
            <select value={settings.branchId ?? ""} onChange={(e) => update({ branchId: e.target.value || null })} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"><option value="">{t("— بدون —", "— none —")}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </Row>
        )}
        <Row label={t("اسم الكاشير (يظهر بالإيصال)", "Cashier name (on receipt)")}><input value={settings.cashierName} onChange={(e) => update({ cashierName: e.target.value })} className="w-40 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary" /></Row>
        <Row label={t("نص أسفل الإيصال", "Receipt footer text")}><input value={settings.footerText} onChange={(e) => update({ footerText: e.target.value })} placeholder={t("شكرًا لتسوقكم معنا", "Thank you for shopping with us")} className="w-40 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary" /></Row>
        <Row label={t("شعار المتجر على الإيصال", "Store logo on receipt")}><Toggle on={settings.showLogo} onChange={(v) => update({ showLogo: v })} /></Row>
        <Row label={t("صوت عند الإضافة", "Beep on add")}><Toggle on={settings.soundOn} onChange={(v) => update({ soundOn: v })} /></Row>
        <Row label={t("حجم البطاقات", "Tile size")}><Seg value={settings.tileSize} options={[["compact", t("مضغوط", "Compact")], ["comfortable", t("مريح", "Comfortable")]]} onChange={(v) => update({ tileSize: v })} /></Row>
        <div className="py-3">
          <button onClick={testPrint} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground hover:bg-muted/40"><Printer className="h-4 w-4" />{t("طباعة إيصال تجريبي", "Print a test receipt")}</button>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t("الطابعة الحرارية: اختر الطابعة في نافذة الطباعة مرة واحدة ثم فعّل الطباعة الصامتة (kiosk-printing) في المتصفح لتخرج الإيصالات مباشرة.", "Thermal printer: pick it once in the print dialog, then enable silent printing (kiosk-printing) in the browser so receipts come out instantly.")}</p>
        </div>
        <div className="py-3 text-[11px] text-muted-foreground">{t("معرّف الجهاز", "Device id")} · <span className="font-english font-semibold">{device}</span> · <kbd className="font-english">F2</kbd> {t("بحث", "search")} · <kbd className="font-english">F9</kbd> {t("دفع", "pay")} · <kbd className="font-english">F4</kbd> {t("تعليق", "hold")} · <kbd className="font-english">Esc</kbd> {t("إغلاق", "close")}</div>
      </div>
    </div>
  );
}

