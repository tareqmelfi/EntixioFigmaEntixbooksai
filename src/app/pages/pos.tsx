/**
 * POS · شاشة الكاشير (W27-next)
 *
 * التصميم المعتمد من المالك (pos-cashier-mockup.html) — نفس الألوان والتخطيط:
 *  · قاعدة النقرتين: صنف → دفع
 *  · حقل الباركود مركّز دائمًا (ماسح USB = لوحة مفاتيح + Enter)
 *  · شارة الكمية داخل التايل · نقود سريعة (مضبوط/50/100/200) + باقي حي
 *  · تعليق فواتير (محلي) · وردية فتح/إغلاق بمطابقة الدرج · إيصال 80مم
 * الصدق: لا مزامنة أوفلاين هنا — البيع يتطلب اتصالًا (زر يعطل عند انقطاعه).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { api } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

// ── palette (from the approved mockup) ──
const NAVY = "#0B1B49";
const BLUE = "#1276E3";
const CYAN = "#349FC4";
const BG = "#F4F6FB";
const BORDER = "#E5E9F2";
const MUTED = "#9AA5C4";
const TEXT2 = "#4A5578";

type CatalogItem = {
  id: string; sku: string | null; name: string; nameAr: string | null;
  imageUrl: string | null; type: string; unitPrice: string; stockQty: string;
  category: string | null; taxRate: { rate: string; type: string } | null;
};
type CartLine = { product: CatalogItem; qty: number };
type Hold = { id: string; at: number; lines: CartLine[] };

const CAT_EMOJI: Array<[RegExp, string]> = [
  [/حليب|ألبان|اجبان|أجبان|جبن|لبن|milk|dairy|cheese/i, "🥛"],
  [/خبز|مخبوز|صامولي|bread|bakery/i, "🍞"],
  [/ماء|عصير|مشروب|قهوة|شاي|water|juice|drink|coffee|tea|cola|بيبسي|كولا/i, "🥤"],
  [/أرز|رز|سكر|طحين|دقيق|معكرونة|فول|حمص|عدس|rice|sugar|flour|pasta/i, "🍚"],
  [/شوكولات|حلوى|حلويات|بسكويت|كيك|candy|chocolate|biscuit/i, "🍬"],
  [/منظف|صابون|منديل|مناديل|شامبو|detergent|soap|tissue/i, "🧴"],
  [/لحم|دجاج|سمك|فراخ|meat|chicken|fish/i, "🥩"],
  [/خضار|طماط|بصل|بطاط|خيار|vegetable/i, "🥬"],
  [/فاكهة|موز|تفاح|برتقال|عنب|fruit|banana|apple/i, "🍎"],
  [/بيض|egg/i, "🥚"],
  [/عسل|honey/i, "🍯"],
  [/زيت|oil/i, "🫗"],
];
function emojiFor(p: CatalogItem): string {
  const hay = `${p.name} ${p.nameAr ?? ""} ${p.category ?? ""} ${p.sku ?? ""}`;
  for (const [re, e] of CAT_EMOJI) if (re.test(hay)) return e;
  return p.type === "SERVICE" ? "🛠️" : "📦";
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const holdsKey = () => `entix_pos_holds_${localStorage.getItem("entix_org_id") || "x"}`;

export function PosPage() {
  const { language, t } = useLanguage();
  const isRtl = language === "ar";

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [orgVat, setOrgVat] = useState(0.15);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("*");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<"CASH" | "CARD" | "MADA">("CASH");
  const [tendered, setTendered] = useState<number | null>(null);
  const [shift, setShift] = useState<{ id: string; openedAt: string; openingFloat: string } | null>(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [floatInput, setFloatInput] = useState("0");
  const [closeSummary, setCloseSummary] = useState<any | null>(null);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const scanRef = useRef<HTMLInputElement>(null);

  // ── data ──
  const refreshShift = useCallback(async () => {
    try { const r = await api.posShiftCurrent(); setShift(r.shift); } catch { setShift(null); }
    setShiftChecked(true);
  }, []);
  useEffect(() => {
    api.posCatalog().then((r) => { setCatalog(r.items); if (typeof (r as any).orgVatRate === "number") setOrgVat((r as any).orgVatRate); }).catch((e) => setLoadErr(e?.message || "failed"));
    refreshShift();
    try { setHolds(JSON.parse(localStorage.getItem(holdsKey()) || "[]")); } catch { /* fresh */ }
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [refreshShift]);

  // ── barcode field keeps focus — a USB scanner types + Enter ──
  const refocus = useCallback(() => { window.setTimeout(() => scanRef.current?.focus(), 30); }, []);
  useEffect(() => { refocus(); }, [cart, shift, refocus]);

  const cats = useMemo(() => ["*", ...new Set(catalog.map((p) => p.category).filter(Boolean) as string[])], [catalog]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((p) =>
      (cat === "*" || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q) || (p.nameAr || "").includes(query.trim()) || (p.sku || "").toLowerCase() === q)
    );
  }, [catalog, cat, query]);

  const add = useCallback((p: CatalogItem, qty = 1) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + qty }; return next; }
      return [...prev, { product: p, qty }];
    });
    setQuery("");
    refocus();
  }, [refocus]);

  const onScanEnter = () => {
    const q = query.trim();
    if (!q) return;
    const exactSku = catalog.find((p) => (p.sku || "").toLowerCase() === q.toLowerCase());
    if (exactSku) return add(exactSku);
    const byName = catalog.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.nameAr || "").includes(q));
    if (byName.length === 1) return add(byName[0]);
    // multiple → keep the text as a grid filter (already reactive)
  };

  const setQty = (id: string, qty: number) =>
    setCart((prev) => qty <= 0 ? prev.filter((l) => l.product.id !== id) : prev.map((l) => l.product.id === id ? { ...l, qty } : l));

  // totals — shelf price is tax-INCLUSIVE; extract VAT per line (matches API)
  const totals = useMemo(() => {
    let net = 0, vat = 0;
    for (const l of cart) {
      const rate = l.product.taxRate ? Number(l.product.taxRate.rate) : orgVat;
      const gross = Number(l.product.unitPrice) * l.qty;
      const n = rate > 0 ? gross / (1 + rate) : gross;
      net += n; vat += gross - n;
    }
    return { net, vat, grand: net + vat };
  }, [cart]);

  const change = tendered != null ? Math.max(0, tendered - totals.grand) : null;

  // ── pay ──
  const pay = async () => {
    if (!cart.length || busy || !online) return;
    setBusy(true);
    try {
      const r = await api.posSale({
        lines: cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
        paymentMethod: method,
        amountTendered: method === "CASH" ? (tendered ?? totals.grand) : totals.grand,
        shiftId: shift?.id ?? null,
      });
      setReceipt({ ...r, lines: cart.map((l) => ({ name: l.product.nameAr || l.product.name, qty: l.qty, price: Number(l.product.unitPrice) })), vat: totals.vat, net: totals.net, at: new Date() });
      setCart([]); setTendered(null);
    } catch (e: any) {
      alert((e as any)?.messageAr || e?.message || t("فشل البيع", "Sale failed"));
    } finally { setBusy(false); refocus(); }
  };

  // ── holds (local) ──
  const saveHolds = (h: Hold[]) => { setHolds(h); localStorage.setItem(holdsKey(), JSON.stringify(h)); };
  const holdCurrent = () => {
    if (!cart.length) return;
    saveHolds([...holds, { id: Math.random().toString(36).slice(2, 8), at: Date.now(), lines: cart }]);
    setCart([]); setTendered(null);
  };
  const resumeHold = (h: Hold) => { setCart(h.lines); saveHolds(holds.filter((x) => x.id !== h.id)); };

  // ── shift actions ──
  const openShift = async () => {
    try { await api.posShiftOpen(Number(floatInput) || 0); await refreshShift(); } catch (e: any) { alert(e?.message || "failed"); }
  };

  const currency = t("ر.س", "SAR");

  // ═══ shift gate ═══
  if (shiftChecked && !shift && !closeSummary) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, border: `1.5px solid ${BORDER}`, padding: 32, width: 420, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🔓</div>
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 800, margin: "8px 0 4px" }}>{t("افتح الوردية للبدء", "Open a shift to start")}</h1>
          <p style={{ color: TEXT2, fontSize: 13, marginBottom: 20 }}>{t("الكاشير يعمل فقط مع وردية مفتوحة — عهدة الدرج تُطابَق عند الإغلاق", "The cashier only runs with an open shift — the drawer float reconciles at close")}</p>
          <label style={{ display: "block", textAlign: isRtl ? "right" : "left", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{t("العهدة الافتتاحية (نقد الدرج)", "Opening float (drawer cash)")}</label>
          <input value={floatInput} onChange={(e) => setFloatInput(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal"
            style={{ width: "100%", border: `2px solid ${BLUE}`, borderRadius: 12, padding: "12px 14px", fontSize: 18, fontWeight: 800, textAlign: "center", direction: "ltr" }} />
          <button onClick={openShift} style={{ marginTop: 16, width: "100%", height: 52, border: "none", borderRadius: 14, background: `linear-gradient(135deg, #22C55E, #16A34A)`, color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer" }}>
            {t("فتح الوردية", "Open shift")}
          </button>
          <Link to="/app" style={{ display: "block", marginTop: 12, fontSize: 12.5, color: MUTED }}>{t("← رجوع للتطبيق", "← Back to the app")}</Link>
        </div>
      </div>
    );
  }

  // ═══ close summary ═══
  if (closeSummary) {
    const diff = closeSummary.difference;
    return (
      <div dir={isRtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, border: `1.5px solid ${BORDER}`, padding: 32, width: 440 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🔒</div>
            <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 800, margin: "8px 0 16px" }}>{t("أُغلقت الوردية", "Shift closed")}</h1>
          </div>
          {[
            [t("العهدة الافتتاحية", "Opening float"), fmt(closeSummary.openingFloat)],
            [t("المبيعات النقدية", "Cash sales"), fmt(closeSummary.cashSales)],
            [t("المتوقع بالدرج", "Expected in drawer"), fmt(closeSummary.expectedCash)],
            [t("المعدود فعليًا", "Actually counted"), fmt(closeSummary.closingCount)],
          ].map(([l, v]) => (
            <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F1F4FA", fontSize: 14, color: TEXT2, fontWeight: 600 }}>
              <span>{l}</span><span style={{ direction: "ltr", fontWeight: 800, color: NAVY }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 800, color: diff === 0 ? "#15803D" : "#B91C1C" }}>
            <span>{t("الفرق", "Difference")}</span><span style={{ direction: "ltr" }}>{diff > 0 ? "+" : ""}{fmt(diff)}</span>
          </div>
          <div style={{ background: "#F8FAFF", borderRadius: 12, padding: 12, fontSize: 13, color: TEXT2, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span>{t("إجمالي مبيعات الوردية", "Shift sales total")}</span>
            <span style={{ fontWeight: 800, color: NAVY }}>{fmt(closeSummary.salesTotal)} · {closeSummary.salesCount} {t("عملية", "sales")}</span>
          </div>
          <button onClick={() => { setCloseSummary(null); }} style={{ marginTop: 18, width: "100%", height: 48, border: "none", borderRadius: 14, background: BLUE, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
            {t("تم — فتح وردية جديدة لاحقًا", "Done — open a new shift later")}
          </button>
          <Link to="/app" style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: 12.5, color: MUTED }}>{t("← رجوع للتطبيق", "← Back to the app")}</Link>
        </div>
      </div>
    );
  }

  // ═══ cashier ═══
  return (
    <div dir={isRtl ? "rtl" : "ltr"} style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: BG }}>
      {/* top bar */}
      <div style={{ height: 56, background: NAVY, color: "#fff", display: "flex", alignItems: "center", padding: "0 16px", gap: 14, flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>ENTIX<span style={{ color: CYAN }}>.IO</span> · {t("كاشير", "POS")}</div>
        {shift && (
          <div style={{ background: "rgba(34,197,94,.18)", color: "#4ADE80", border: "1px solid rgba(34,197,94,.4)", padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, background: "#4ADE80", borderRadius: "50%" }} />
            {t("الوردية مفتوحة", "Shift open")} · {new Date(shift.openedAt).toLocaleTimeString(isRtl ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
        <div style={{ marginInlineStart: "auto", fontSize: 12.5, color: "#B6C3E4", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: online ? "rgba(52,159,196,.15)" : "rgba(239,68,68,.18)", color: online ? "#7DD3FC" : "#FCA5A5", border: `1px solid ${online ? "rgba(52,159,196,.35)" : "rgba(239,68,68,.4)"}`, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700 }}>
            {online ? t("☁️ متصل", "☁️ Online") : t("⚠️ لا يوجد اتصال — البيع متوقف", "⚠️ Offline — selling paused")}
          </span>
          <Link to="/app" style={{ color: "#B6C3E4", fontSize: 12 }}>{t("← التطبيق", "← App")}</Link>
        </div>
      </div>

      {/* barcode */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: BG, border: `2px solid ${BLUE}`, borderRadius: 14, padding: "0 14px", height: 52, boxShadow: "0 0 0 4px rgba(18,118,227,.08)" }}>
          <svg width="26" height="26" fill="none" stroke={BLUE} strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h2v12H4zM8 6h1v12H8zM11 6h2v12h-2zM15 6h1v12h-1zM18 6h2v12h-2z"/></svg>
          <input ref={scanRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onScanEnter()}
            placeholder={t("امسح الباركود أو اكتب اسم الصنف… (التركيز دائم هنا)", "Scan barcode or type a product name… (focus lives here)")}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontWeight: 600, color: NAVY }} autoFocus />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* products */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, padding: "12px 16px 8px", overflowX: "auto" }}>
            {cats.map((ct) => (
              <button key={ct} onClick={() => setCat(ct)}
                style={{ padding: "9px 18px", borderRadius: 999, background: cat === ct ? BLUE : "#fff", border: `1.5px solid ${cat === ct ? BLUE : BORDER}`, fontSize: 13.5, fontWeight: 700, color: cat === ct ? "#fff" : TEXT2, whiteSpace: "nowrap", cursor: "pointer" }}>
                {ct === "*" ? t("الكل", "All") : ct}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 10, alignContent: "start" }}>
            {loadErr && <div style={{ gridColumn: "1/-1", color: "#B91C1C", fontSize: 13 }}>{loadErr}</div>}
            {!loadErr && catalog.length === 0 && <div style={{ gridColumn: "1/-1", color: MUTED, fontSize: 13, padding: 20, textAlign: "center" }}>{t("لا أصناف بعد — أضفها من «المنتجات والخدمات» أو انقلها من برنامجك القديم", "No items yet — add them under Products & services or migrate from your old software")}</div>}
            {filtered.map((p) => {
              const inCart = cart.find((l) => l.product.id === p.id)?.qty;
              return (
                <button key={p.id} onClick={() => add(p)}
                  style={{ background: "#fff", border: `1.5px solid ${BORDER}`, borderRadius: 16, padding: "12px 10px", textAlign: "center", cursor: "pointer", position: "relative" }}>
                  {inCart != null && <span style={{ position: "absolute", top: 8, insetInlineStart: 8, background: "#22C55E", color: "#fff", fontSize: 11, fontWeight: 800, minWidth: 22, height: 22, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{inCart}</span>}
                  <div style={{ fontSize: 34, lineHeight: 1.2 }}>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, margin: "0 auto" }} /> : emojiFor(p)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 6, minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>{isRtl ? (p.nameAr || p.name) : p.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: BLUE, marginTop: 2, direction: "ltr" }}>{fmt(Number(p.unitPrice))} <small style={{ fontSize: 10, color: MUTED }}>{currency}</small></div>
                </button>
              );
            })}
          </div>
        </div>

        {/* cart */}
        <div style={{ width: 380, background: "#fff", borderInlineStart: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px dashed ${BORDER}` }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>🧾 {t("الفاتورة الحالية", "Current sale")}</h2>
            {cart.length > 0 && <button onClick={() => { setCart([]); setTendered(null); }} style={{ fontSize: 12, color: "#EF4444", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>{t("مسح الكل ✕", "Clear ✕")}</button>}
          </div>
          <div style={{ padding: "10px 16px", borderBottom: `1px dashed ${BORDER}`, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: TEXT2, fontWeight: 600 }}>
            <div style={{ background: BG, borderRadius: 999, padding: "6px 12px", flex: 1 }}>👤 {t("عميل نقدي (افتراضي)", "Walk-in customer (default)")}</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 12px" }}>
            {cart.length === 0 && <div style={{ color: MUTED, fontSize: 13, textAlign: "center", padding: 24 }}>{t("السلة فارغة — امسح صنفًا أو اضغط تايل", "Cart is empty — scan or tap a tile")}</div>}
            {cart.map((l) => (
              <div key={l.product.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 4px", borderBottom: "1px solid #F1F4FA" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isRtl ? (l.product.nameAr || l.product.name) : l.product.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, direction: "ltr", textAlign: isRtl ? "right" : "left" }}>{fmt(Number(l.product.unitPrice))} × {l.qty}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 2, background: BG, borderRadius: 999, padding: 2 }}>
                  <button onClick={() => setQty(l.product.id, l.qty - 1)} style={{ width: 30, height: 30, borderRadius: 999, border: "none", background: "#fff", fontSize: 16, fontWeight: 800, color: BLUE, cursor: "pointer" }}>−</button>
                  <span style={{ minWidth: 30, textAlign: "center", fontSize: 14, fontWeight: 800, color: NAVY }}>{l.qty}</span>
                  <button onClick={() => setQty(l.product.id, l.qty + 1)} style={{ width: 30, height: 30, borderRadius: 999, border: "none", background: "#fff", fontSize: 16, fontWeight: 800, color: BLUE, cursor: "pointer" }}>+</button>
                </div>
                <div style={{ width: 64, textAlign: "center", fontSize: 13.5, fontWeight: 800, color: NAVY, direction: "ltr" }}>{fmt(Number(l.product.unitPrice) * l.qty)}</div>
                <button onClick={() => setQty(l.product.id, 0)} style={{ color: "#F87171", fontSize: 16, background: "none", border: "none", cursor: "pointer", padding: 4 }}>🗑</button>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `2px solid #EEF1F8`, padding: "12px 16px 6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TEXT2, padding: "3px 0", fontWeight: 600 }}><span>{t("الإجمالي قبل الضريبة", "Net")}</span><span style={{ direction: "ltr" }}>{fmt(totals.net)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TEXT2, padding: "3px 0", fontWeight: 600 }}><span>{t("ضريبة القيمة المضافة", "VAT")}</span><span style={{ direction: "ltr" }}>{fmt(totals.vat)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800, color: NAVY, paddingTop: 8 }}><span>{t("الإجمالي", "Total")}</span><span style={{ color: BLUE, direction: "ltr" }}>{fmt(totals.grand)} {currency}</span></div>
          </div>

          {method === "CASH" && (
            <>
              <div style={{ display: "flex", gap: 8, padding: "8px 16px" }}>
                {[{ l: t("المبلغ المضبوط", "Exact"), v: totals.grand, exact: true }, { l: "50", v: 50 }, { l: "100", v: 100 }, { l: "200", v: 200 }].map((q) => (
                  <button key={q.l as string} onClick={() => setTendered(q.v)}
                    style={{ flex: 1, padding: "10px 0", textAlign: "center", background: (q as any).exact ? "#EFF6FF" : BG, border: `1.5px solid ${(q as any).exact ? BLUE : BORDER}`, borderRadius: 12, fontSize: 14, fontWeight: 800, color: (q as any).exact ? BLUE : NAVY, cursor: "pointer", direction: "ltr" }}>
                    {q.l}
                  </button>
                ))}
              </div>
              {change != null && change > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "2px 16px 8px", background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "8px 14px" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#15803D" }}>{t(`المتبقي للعميل (من ${fmt(tendered || 0)})`, `Change (from ${fmt(tendered || 0)})`)}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#15803D", direction: "ltr" }}>{fmt(change)}</span>
                </div>
              )}
            </>
          )}

          <div style={{ padding: "10px 16px 14px", display: "flex", gap: 10 }}>
            <div style={{ display: "flex", background: BG, borderRadius: 14, padding: 4, gap: 4 }}>
              {([["CASH", "💵", t("نقد", "Cash")], ["MADA", "💳", t("مدى", "Mada")], ["CARD", "💳", t("بطاقة", "Card")]] as const).map(([m, ic, lb]) => (
                <button key={m} onClick={() => { setMethod(m); if (m !== "CASH") setTendered(null); }}
                  style={{ padding: "0 14px", height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 11, fontSize: 12, fontWeight: 800, color: method === m ? NAVY : TEXT2, background: method === m ? "#fff" : "transparent", border: "none", cursor: "pointer", gap: 2, boxShadow: method === m ? "0 2px 8px rgba(11,27,73,.14)" : "none" }}>
                  <span style={{ fontSize: 17 }}>{ic}</span>{lb}
                </button>
              ))}
            </div>
            <button onClick={pay} disabled={!cart.length || busy || !online}
              style={{ flex: 1, height: 64, border: "none", borderRadius: 16, background: !cart.length || !online ? "#CBD5E1" : "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", fontSize: 19, fontWeight: 800, cursor: cart.length && online ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: cart.length && online ? "0 8px 24px rgba(34,197,94,.4)" : "none" }}>
              {busy ? "…" : t("دفع", "Pay")} <span style={{ background: "rgba(255,255,255,.2)", padding: "4px 14px", borderRadius: 10, direction: "ltr" }}>{fmt(totals.grand)}</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, padding: "0 16px 10px" }}>
            <button onClick={holdCurrent} style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: "1.5px solid #F59E0B", background: "#FFFBEB", fontSize: 12, fontWeight: 700, color: "#B45309", cursor: "pointer" }}>
              ⏸ {t("تعليق", "Hold")} {holds.length > 0 && <span style={{ background: "#F59E0B", color: "#fff", borderRadius: 999, fontSize: 10, minWidth: 17, height: 17, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px", marginInlineStart: 4 }}>{holds.length}</span>}
            </button>
            {holds.length > 0 && (
              <button onClick={() => resumeHold(holds[holds.length - 1])} style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: `1.5px solid ${BORDER}`, background: "#fff", fontSize: 12, fontWeight: 700, color: TEXT2, cursor: "pointer" }}>
                ▶ {t("استرجاع آخر معلّقة", "Resume last hold")}
              </button>
            )}
            <button onClick={() => { const c = prompt(t("المبلغ المعدود في الدرج:", "Counted drawer cash:")); if (c != null && c !== "") closeShiftWith(c); }}
              style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: `1.5px solid ${BORDER}`, background: "#fff", fontSize: 12, fontWeight: 700, color: TEXT2, cursor: "pointer" }}>
              🔒 {t("إغلاق الوردية", "Close shift")}
            </button>
          </div>
        </div>
      </div>

      {/* receipt modal */}
      {receipt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,27,73,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setReceipt(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 24, width: 340 }}>
            <div id="pos-receipt" style={{ fontFamily: "monospace", fontSize: 12, color: "#000" }}>
              <div style={{ textAlign: "center", fontWeight: 800, fontSize: 15 }}>ENTIX.IO · {t("إيصال", "Receipt")}</div>
              <div style={{ textAlign: "center", margin: "4px 0 10px" }}>{receipt.invoice.number} · {receipt.at.toLocaleString(isRtl ? "ar-SA" : "en-GB")}</div>
              <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />
              {receipt.lines.map((l: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name} ×{l.qty}</span>
                  <span style={{ direction: "ltr" }}>{fmt(l.price * l.qty)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("قبل الضريبة", "Net")}</span><span style={{ direction: "ltr" }}>{fmt(receipt.net)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("الضريبة", "VAT")}</span><span style={{ direction: "ltr" }}>{fmt(receipt.vat)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15, marginTop: 4 }}><span>{t("الإجمالي", "Total")}</span><span style={{ direction: "ltr" }}>{fmt(receipt.invoice.total)} {currency}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>{t("الدفع", "Paid")} ({receipt.payment.method})</span><span style={{ direction: "ltr" }}>{fmt(receipt.payment.tendered)}</span></div>
              {receipt.payment.change > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>{t("الباقي", "Change")}</span><span style={{ direction: "ltr" }}>{fmt(receipt.payment.change)}</span></div>}
              <div style={{ textAlign: "center", marginTop: 10 }}>{t("شكرًا لتسوقكم معنا", "Thank you for shopping with us")}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => { window.print(); }} style={{ flex: 1, height: 44, border: "none", borderRadius: 12, background: BLUE, color: "#fff", fontWeight: 800, cursor: "pointer" }}>🖨 {t("طباعة", "Print")}</button>
              <button onClick={() => setReceipt(null)} style={{ flex: 1, height: 44, border: `1.5px solid ${BORDER}`, borderRadius: 12, background: "#fff", fontWeight: 700, color: TEXT2, cursor: "pointer" }}>{t("بيع جديد", "New sale")}</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@media print { body * { visibility: hidden; } #pos-receipt, #pos-receipt * { visibility: visible; } #pos-receipt { position: absolute; inset: 0; width: 72mm; } @page { size: 80mm auto; margin: 4mm; } }`}</style>
    </div>
  );

  // close-shift with a captured value (prompt-based, v1)
  function closeShiftWith(val: string) {
    api.posShiftClose(Number(val)).then((r) => { setCloseSummary(r.summary); refreshShift(); }).catch((e) => alert(e?.message || "failed"));
  }
}
