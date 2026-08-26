/**
 * Product / Service full-page form — the app-wide standard (like invoices):
 * creating or editing an item opens its OWN page (/app/products/new or
 * /app/products/:id) instead of a right slide-over.
 *
 * The accounting links are first-class here: every service/product maps to
 * its income account (posted on sale) and expense/COGS account (on purchase),
 * so invoice/bill lines land in the right ledger accounts automatically.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, ImagePlus, Loader2, Save, Trash2, X, ScanBarcode, Plus } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, Account, type ProductBarcode } from "../lib/api";
import { displayName } from "../lib/display-name";
import { SearchableCombobox } from "../components/searchable-combobox";
import { useLanguage } from "../components/LanguageContext";

const IMAGE_STORE_KEY = "entix_product_images_v1";

const EMPTY_FORM = {
  sku: "",
  name: "",
  nameAr: "",
  description: "",
  category: "",
  imageUrl: "",
  type: "SERVICE",
  unitPrice: "",
  costPrice: "0",
  stockQty: "0",
  reorderQty: "",
  incomeAccountId: "",
  expenseAccountId: "",
};

export function ProductDetail() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState(EMPTY_FORM);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localImages, setLocalImages] = useState<Record<string, string>>({});

  useEffect(() => {
    api.accounts.list().then((d) => setAccounts(d.items)).catch(() => {});
    try {
      setLocalImages(JSON.parse(localStorage.getItem(IMAGE_STORE_KEY) || "{}"));
    } catch { setLocalImages({}); }
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const item = await api.products.get(id!) as any;
      setForm({
        sku: item.sku || "",
        name: item.name || "",
        nameAr: item.nameAr || "",
        description: item.description || "",
        category: item.category || "",
        imageUrl: item.imageUrl || "",
        type: item.type || "SERVICE",
        unitPrice: String(item.unitPrice ?? ""),
        costPrice: String(item.costPrice ?? "0"),
        stockQty: String(item.stockQty ?? "0"),
        reorderQty: item.reorderQty == null ? "" : String(item.reorderQty),
        incomeAccountId: item.incomeAccountId || "",
        expenseAccountId: item.expenseAccountId || "",
      });
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تحميل الصنف", "Failed to load item"));
    } finally { setLoading(false); }
  }, [id, isNew, t]);
  useEffect(() => { load(); }, [load]);

  const saveLocalImage = (productId: string, imageUrl: string) => {
    const next = { ...localImages };
    if (imageUrl) next[productId] = imageUrl;
    else delete next[productId];
    try { localStorage.setItem(IMAGE_STORE_KEY, JSON.stringify(next)); } catch { /* too large — cosmetic only */ }
  };

  const handleImageFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError(t("اختر ملف صورة فقط", "Please choose an image file only")); return; }
    if (file.size > 1_500_000) { setError(t("الصورة كبيرة. استخدم صورة أقل من 1.5MB الآن", "Image too large. Use an image under 1.5MB")); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.unitPrice) { setError(t("الاسم والسعر مطلوبان", "Name and price are required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        sku: form.sku || null, name: form.name, nameAr: form.nameAr || null,
        description: form.description || null, category: form.category || null, imageUrl: form.imageUrl || null,
        type: form.type, unitPrice: Number(form.unitPrice), costPrice: Number(form.costPrice || 0),
        stockQty: Number(form.stockQty || 0),
        reorderQty: form.reorderQty.trim() === "" ? null : Number(form.reorderQty),
        incomeAccountId: form.incomeAccountId || null, expenseAccountId: form.expenseAccountId || null,
      };
      const saved = isNew ? await api.products.create(payload) : await api.products.update(id!, payload);
      saveLocalImage(saved.id, form.imageUrl);
      push("success", isNew ? t("تم إنشاء الصنف", "Item created") : t("تم تحديث الصنف", "Item updated"));
      navigate("/app/products");
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (isNew || deleting) return;
    setDeleting(true);
    try {
      await api.products.remove(id!);
      push("success", t("تم حذف الصنف", "Item deleted"));
      navigate("/app/products");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed"));
      setDeleting(false);
    }
  };

  const incomeAccount = accounts.find((a) => a.id === form.incomeAccountId);
  const expenseAccount = accounts.find((a) => a.id === form.expenseAccountId);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Page header — full-page standard */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/app/products" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
            <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للمنتجات والخدمات", "Back to Products & Services")}
          </Link>
          <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
            {isNew ? t("صنف جديد", "New Item") : (form.nameAr || form.name || t("تعديل صنف", "Edit Item"))}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isNew
              ? t("سجّل خدمة أو منتجاً واربطه بحساباته المحاسبية من البداية", "Register a service or product and link its accounts from day one")
              : t("تعديل بيانات الصنف وربطه المحاسبي", "Edit the item and its accounting links")}
          </p>
        </div>
        {!isNew && (
          <Button type="button" variant="outline" onClick={handleDelete} disabled={deleting} className="border-red-200 text-red-600 hover:bg-red-50">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="me-2 h-4 w-4" />{t("حذف الصنف", "Delete item")}</>}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Identity column ── */}
          <div className="space-y-5">
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الهوية", "Identity")}</div>
                <div className="space-y-2">
                  <Label>{t("صورة المنتج", "Product image")}</Label>
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center shrink-0">
                      {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground/60" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input id="product-image-upload" type="file" accept="image/*" hidden onChange={(e) => handleImageFile(e.target.files?.[0])} />
                      <div className="flex flex-wrap gap-2">
                        <label htmlFor="product-image-upload" className="cursor-pointer rounded-md border border-primary px-3 py-2 text-xs text-primary hover:bg-blue-50">{t("اختيار صورة", "Choose image")}</label>
                        {form.imageUrl && <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"><X className="inline h-3.5 w-3.5 me-1" />{t("إزالة", "Remove")}</button>}
                      </div>
                      <Input value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder={t("أو ألصق رابط الصورة", "Or paste image URL")} dir="ltr" className="font-english text-xs" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} dir="ltr" className="font-english" placeholder="EN-CLD-001" /></div>
                <div className="space-y-2"><Label>{t("التصنيف", "Category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} dir="ltr" className="font-english" placeholder="AI / CLD / BRD" /></div>
              </CardContent>
            </Card>
          </div>

          {/* ── Name/type/pricing column ── */}
          <div className="space-y-5">
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الأساسيات", "Basics")}</div>
                <div className="space-y-2">
                  <Label>{t("النوع", "Type")}</Label>
                  <div className="flex gap-1 rounded-lg bg-muted/50 p-1" role="radiogroup" aria-label={t("النوع", "Type")}>
                    {([["SERVICE", t("خدمة", "Service")], ["GOOD", t("بضاعة", "Good")], ["INVENTORY", t("مخزون", "Inventory")]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={form.type === val}
                        onClick={() => setForm({ ...form, type: val })}
                        className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${form.type === val ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        style={{ fontWeight: form.type === val ? 700 : 500 }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2"><Label>{t("الاسم بالإنجليزية", "Name (English)")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="ltr" className="font-english" /></div>
                <div className="space-y-2"><Label>{t("الاسم بالعربية", "Name (Arabic)")}</Label><Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t("الوصف", "Description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("وصف مختصر يظهر في الفواتير", "Short description shown on invoices")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>{t("سعر البيع", "Sale price")} *</Label><Input type="number" step="0.01" min="0" required value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} dir="ltr" className="font-english" /></div>
                  <div className="space-y-2"><Label>{t("سعر التكلفة", "Cost price")}</Label><Input type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} dir="ltr" className="font-english" /></div>
                </div>
                {(form.type === "INVENTORY" || form.type === "GOOD") && (
                  <div className="grid grid-cols-2 gap-3">
                    {form.type === "INVENTORY" && <div className="space-y-2"><Label>{t("الرصيد الافتتاحي بالمخزون", "Opening stock quantity")}</Label><Input type="number" step="0.01" min="0" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} dir="ltr" className="font-english" /></div>}
                    <div className="space-y-2"><Label>{t("حد إعادة الطلب", "Reorder point")}</Label><Input type="number" step="1" min="0" value={form.reorderQty} onChange={(e) => setForm({ ...form, reorderQty: e.target.value })} dir="ltr" className="font-english" placeholder={t("فارغ = بدون تنبيه", "Empty = no alert")} /><p className="text-[11px] text-muted-foreground">{t("يظهر تنبيه في المخزون عندما يصل المتوفر إلى هذا الحد.", "Inventory shows an alert once on-hand reaches this level.")}</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Accounting column (the whole point: every item linked) ── */}
          <div className="space-y-5">
            <Card className="border-primary/40 bg-primary/[0.02]">
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الربط المحاسبي", "Accounting links")}</div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-5">
                    {t(
                      "كل فاتورة بيع تترحّل تلقائياً لحساب الإيراد المربوط، وكل شراء لحساب المصروف/التكلفة — بدون قيود يدوية لاحقاً.",
                      "Every sales invoice posts automatically to the linked income account, and every purchase to the expense/COGS account — no manual journals later.",
                    )}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("حساب الإيراد (عند البيع)", "Income account (on sale)")}</Label>
                  <SearchableCombobox
                    value={form.incomeAccountId}
                    onChange={(accountId) => setForm({ ...form, incomeAccountId: accountId })}
                    items={accounts.filter(a => a.type === "REVENUE").map(a => ({ id: a.id, label: `${a.code} · ${a.name}`, sublabel: a.nameAr || undefined }))}
                    placeholder={t("اختر حساب الإيراد...", "Choose income account...")}
                  />
                  {form.type === "SERVICE" && !form.incomeAccountId && (
                    <p className="text-[11px] text-amber-700">{t("خدمة بيع؟ اربطها بحساب إيراد البيع/الخدمات ليترحّل البيع صحيحاً.", "Selling service? Link it to the sales/services revenue account so sales post correctly.")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("حساب المصروف/التكلفة (عند الشراء)", "Expense/COGS account (on purchase)")}</Label>
                  <SearchableCombobox
                    value={form.expenseAccountId}
                    onChange={(accountId) => setForm({ ...form, expenseAccountId: accountId })}
                    items={accounts.filter(a => a.type === "EXPENSE" || a.type === "ASSET").map(a => ({ id: a.id, label: `${a.code} · ${a.name}`, sublabel: a.nameAr || undefined }))}
                    placeholder={t("اختر حساب المصروف...", "Choose expense account...")}
                  />
                  {expenseAccount?.type === "ASSET" && (
                    <p className="text-[11px] text-blue-700">{t("حساب أصل: شراء هذا الصنف يسجَّل أصلاً ثابتاً تلقائياً.", "Asset account: purchasing this item auto-registers a fixed asset.")}</p>
                  )}
                </div>
                {(incomeAccount || expenseAccount) && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 space-y-0.5">
                    {incomeAccount && <div>{t("البيع →", "Sale →")} <span className="font-english font-semibold" dir="ltr">{incomeAccount.code} · {displayName(incomeAccount)}</span></div>}
                    {expenseAccount && <div>{t("الشراء →", "Purchase →")} <span className="font-english font-semibold" dir="ltr">{expenseAccount.code} · {displayName(expenseAccount)}</span></div>}
                  </div>
                )}
              </CardContent>
            </Card>
            {!isNew && (form.type === "GOOD" || form.type === "INVENTORY") && <BarcodesCard productId={id!} push={push} />}
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate("/app/products")}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("حفظ الصنف", "Save item") : t("حفظ التغييرات", "Save changes")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}


/** B3.2 · alias scan codes: a carton barcode with multiplier 12 sells 12 units in one POS scan. */
function BarcodesCard({ productId, push }: { productId: string; push: (kind: "success" | "error" | "info", msg: string) => void }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<ProductBarcode[]>([]);
  const [barcode, setBarcode] = useState("");
  const [mult, setMult] = useState("1");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api.products.barcodes(productId).then((r) => setItems(r.items || [])).catch(() => setItems([])); }, [productId]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!barcode.trim()) return;
    setBusy(true);
    try {
      await api.products.addBarcode(productId, { barcode: barcode.trim(), unitMultiplier: Number(mult) || 1, label: label.trim() || null });
      setBarcode(""); setMult("1"); setLabel(""); load();
      push("success", t("أُضيف الباركود", "Barcode added"));
    } catch (e: any) {
      push("error", e instanceof ApiError && e.message.includes("barcode_taken") ? t("هذا الباركود مستخدم لصنف آخر", "This barcode belongs to another item") : e instanceof ApiError ? e.message : t("فشل الإضافة", "Add failed"));
    } finally { setBusy(false); }
  };
  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-foreground" style={{ fontWeight: 700 }}><ScanBarcode className="h-4 w-4 text-muted-foreground" />{t("باركودات إضافية (كرتون · عبوة)", "Extra barcodes (carton · pack)")}</div>
        <p className="text-[11px] text-muted-foreground leading-5">{t("SKU الصنف هو الكود الأساسي. أضف هنا باركود الكرتون مع عدد الوحدات — مسحة واحدة في الكاشير تبيع الكمية كاملة.", "The item SKU is the primary code. Add the carton barcode with its unit count — one POS scan sells the whole quantity.")}</p>
        {items.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-lg border border-border">
            {items.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-english" dir="ltr">{b.barcode}</span>
                <span className="text-xs text-muted-foreground">× {Number(b.unitMultiplier)}{b.label ? ` · ${b.label}` : ""}</span>
                <button type="button" onClick={async () => { try { await api.products.removeBarcode(productId, b.id); load(); } catch { push("error", t("فشل الحذف", "Delete failed")); } }} className="ms-auto text-muted-foreground hover:text-danger" title={t("حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-[1fr_72px_1fr_auto] gap-2 items-end">
          <div className="space-y-1"><Label className="text-xs">{t("الباركود", "Barcode")}</Label><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} dir="ltr" className="font-english h-9" placeholder="628…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} /></div>
          <div className="space-y-1"><Label className="text-xs">{t("وحدات", "Units")}</Label><Input value={mult} onChange={(e) => setMult(e.target.value)} dir="ltr" className="font-english h-9" inputMode="numeric" /></div>
          <div className="space-y-1"><Label className="text-xs">{t("وصف", "Label")}</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" placeholder={t("كرتون 12", "Carton of 12")} /></div>
          <Button type="button" variant="outline" onClick={add} disabled={busy || !barcode.trim()} className="h-9 border-border"><Plus className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
