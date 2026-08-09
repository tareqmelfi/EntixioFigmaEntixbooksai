/**
 * New Stock Movement — full page (app-wide standard · no slide-overs).
 * /app/inventory/movements/new
 *
 * Movement type (receipt/issue/transfer) and cost method (WAC/FIFO/LIFO)
 * are segmented buttons — enums are never dropdowns in this app.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Loader2, Repeat2, Save } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useLanguage } from "../components/LanguageContext";

type Mode = "receipt" | "issue" | "transfer";
const COST_METHODS = ["WAC", "FIFO", "LIFO"] as const;

export function StockMovementNew() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toasts, push, dismiss } = useToasts();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [form, setForm] = useState({
    mode: (searchParams.get("mode") as Mode) || "receipt" as Mode,
    productId: "", warehouseId: "", toWarehouseId: "",
    quantity: "", unitCost: "", method: "WAC" as (typeof COST_METHODS)[number],
  });

  const load = useCallback(async () => {
    try {
      const [productsRes, warehousesRes] = await Promise.all([api.products.list(), api.inventory.listWarehouses()]);
      setProducts(productsRes.items || []);
      setWarehouses(warehousesRes.items || []);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذر تحميل البيانات", "Could not load data"));
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const productOptions = useMemo(() => products.map((p) => ({
    id: p.id, label: p.nameAr || p.name, sublabel: [p.sku, p.type].filter(Boolean).join(" · "),
  })), [products]);
  const warehouseOptions = useMemo(() => warehouses.map((w) => ({ id: w.id, label: w.name, sublabel: w.code })), [warehouses]);

  const createProductInline = async (name: string) => {
    const created = await api.products.create({ sku: null, name: name.trim(), nameAr: name.trim(), type: "INVENTORY", unitPrice: 0, costPrice: 0 });
    setProducts((prev) => [created, ...prev]);
    push("success", t(`تم إنشاء الصنف ${displayName(created)}`, `Item ${created.name} created`));
    return created.id;
  };

  const createWarehouseInline = async (name: string) => {
    const usedCodes = new Set(warehouses.map((w) => w.code));
    let index = warehouses.length + 1;
    let code = `WH-${String(index).padStart(3, "0")}`;
    while (usedCodes.has(code)) { index += 1; code = `WH-${String(index).padStart(3, "0")}`; }
    const created = await api.inventory.createWarehouse({ code, name: name.trim(), isPrimary: warehouses.length === 0 });
    setWarehouses((prev) => [created, ...prev]);
    push("success", t(`تم إنشاء المستودع ${created.name}`, `Warehouse ${created.name} created`));
    return created.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantityValue = Number(form.quantity);
    const unitCostValue = Number(form.unitCost || 0);
    if (!form.productId || !form.warehouseId || !quantityValue) { setError(t("اختر المنتج والمستودع والكمية", "Select the product, warehouse and quantity")); return; }
    if (form.mode === "transfer" && (!form.toWarehouseId || form.toWarehouseId === form.warehouseId)) { setError(t("اختر مستودع تحويل مختلف", "Choose a different destination warehouse")); return; }
    setBusy(true); setError(null);
    try {
      if (form.mode === "receipt") {
        await api.inventory.receipt({ productId: form.productId, warehouseId: form.warehouseId, quantity: quantityValue, unitCost: unitCostValue, refType: "MANUAL" });
      } else if (form.mode === "issue") {
        await api.inventory.issue({ productId: form.productId, warehouseId: form.warehouseId, quantity: quantityValue, method: form.method, refType: "MANUAL" });
      } else {
        await api.inventory.transfer({ productId: form.productId, fromWarehouseId: form.warehouseId, toWarehouseId: form.toWarehouseId, quantity: quantityValue, method: form.method });
      }
      push("success", t("تم تسجيل حركة المخزون", "Stock movement recorded"));
      navigate("/app/stock-movements");
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تسجيل الحركة", "Failed to record movement"));
    } finally { setBusy(false); }
  };

  const modeMeta: Record<Mode, { ar: string; en: string; icon: any }> = {
    receipt: { ar: "استلام", en: "Receipt", icon: ArrowDownToLine },
    issue: { ar: "صرف", en: "Issue", icon: ArrowUpFromLine },
    transfer: { ar: "تحويل", en: "Transfer", icon: Repeat2 },
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/stock-movements" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة لسجل الحركات", "Back to Movement Log")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("حركة مخزون", "Stock movement")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("سجل استلام، صرف، أو تحويل بين المستودعات.", "Record a receipt, issue, or transfer between warehouses.")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>{t("نوع الحركة", "Movement type")}</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(modeMeta) as Mode[]).map((m) => {
                  const Icon = modeMeta[m].icon;
                  return (
                    <button key={m} type="button" onClick={() => setForm({ ...form, mode: m })}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm border transition-colors ${form.mode === m ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}>
                      <Icon className="h-3.5 w-3.5" />{t(modeMeta[m].ar, modeMeta[m].en)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("الصنف *", "Item *")}</Label>
              <SearchableCombobox
                value={form.productId}
                onChange={(productId) => setForm({ ...form, productId })}
                onCreate={createProductInline}
                items={productOptions}
                placeholder={t("ابحث عن صنف أو اكتب صنف جديد...", "Search for an item or type a new one...")}
                createLabel={(q) => t(`+ إنشاء صنف مخزني "${q}"`, `+ Create inventory item "${q}"`)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{form.mode === "transfer" ? t("من مستودع *", "From warehouse *") : t("المستودع *", "Warehouse *")}</Label>
                <SearchableCombobox
                  value={form.warehouseId}
                  onChange={(warehouseId) => setForm({ ...form, warehouseId })}
                  onCreate={createWarehouseInline}
                  items={warehouseOptions}
                  placeholder={t("ابحث عن مستودع أو اكتب مستودع جديد...", "Search for a warehouse or type a new one...")}
                  createLabel={(q) => t(`+ إنشاء مستودع "${q}"`, `+ Create warehouse "${q}"`)}
                />
              </div>
              {form.mode === "transfer" && (
                <div className="space-y-2">
                  <Label>{t("إلى مستودع *", "To warehouse *")}</Label>
                  <SearchableCombobox
                    value={form.toWarehouseId}
                    onChange={(toWarehouseId) => setForm({ ...form, toWarehouseId })}
                    onCreate={createWarehouseInline}
                    items={warehouseOptions.filter((w) => w.id !== form.warehouseId)}
                    placeholder={t("ابحث عن وجهة أو اكتب مستودع جديد...", "Search a destination or type a new warehouse...")}
                    createLabel={(q) => t(`+ إنشاء مستودع "${q}"`, `+ Create warehouse "${q}"`)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("الكمية *", "Quantity *")}</Label><Input required type="number" min="0.001" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} dir="ltr" className="font-english" /></div>
              {form.mode === "receipt" ? (
                <div className="space-y-2"><Label>{t("تكلفة الوحدة", "Unit cost")}</Label><Input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} dir="ltr" className="font-english" /></div>
              ) : (
                <div className="space-y-2">
                  <Label>{t("طريقة التكلفة", "Cost method")}</Label>
                  <div className="flex gap-2">
                    {COST_METHODS.map((m) => (
                      <button key={m} type="button" onClick={() => setForm({ ...form, method: m })}
                        className={`rounded-full px-4 py-1.5 text-sm border font-english transition-colors ${form.method === m ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}>{m}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate("/app/stock-movements")}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{t("تسجيل الحركة", "Record movement")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
