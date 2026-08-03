import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Package, Plus, RefreshCw, Repeat2, Warehouse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type ProductRow = {
  id: string;
  sku?: string | null;
  name: string;
  nameAr?: string | null;
  type?: string | null;
  costPrice?: string | number | null;
};

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  isPrimary?: boolean;
};

type StockRow = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: string | number;
  averageCost: string | number;
  lastCost?: string | number | null;
  updatedAt?: string;
  warehouse?: { id: string; code: string; name: string };
};

type MovementRow = {
  id: string;
  productId: string;
  warehouseId: string;
  type: string;
  quantity: string | number;
  unitCost?: string | number | null;
  occurredAt?: string;
  notes?: string | null;
};

const money = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qty = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });

const movementLabels: Record<string, { ar: string; en: string }> = {
  RECEIPT: { ar: "استلام", en: "Receipt" },
  OPENING: { ar: "رصيد افتتاحي", en: "Opening balance" },
  ISSUE: { ar: "صرف", en: "Issue" },
  TRANSFER_IN: { ar: "تحويل وارد", en: "Transfer in" },
  TRANSFER_OUT: { ar: "تحويل صادر", en: "Transfer out" },
  ADJUSTMENT: { ar: "تسوية", en: "Adjustment" },
  RETURN_IN: { ar: "مرتجع وارد", en: "Return in" },
  RETURN_OUT: { ar: "مرتجع صادر", en: "Return out" },
};

export function Inventory() {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Derive the active tab from the URL path so /app/warehouses → "warehouses",
  // /app/stock-movements → "movements", and /app/inventory → "stock".
  // Without this, React Router reuses the same <Inventory /> instance across
  // all three routes and the tab stays stuck on "stock" (the reported bug).
  const deriveTab = (): "stock" | "warehouses" | "movements" => {
    const p = location.pathname;
    if (p.endsWith("/stock-movements")) return "movements";
    if (p.endsWith("/warehouses")) return "warehouses";
    return "stock";
  };
  const [activeTab, setActiveTab] = useState<"stock" | "warehouses" | "movements">(deriveTab);
  useEffect(() => { setActiveTab(deriveTab()); }, [location.pathname]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ code: "", name: "", address: "", isPrimary: false });
  const [movementForm, setMovementForm] = useState({
    mode: "receipt",
    productId: "",
    warehouseId: "",
    toWarehouseId: "",
    quantity: "",
    unitCost: "",
    method: "WAC",
  });

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const productOptions = useMemo(() => products.map((p) => ({
    id: p.id,
    label: p.nameAr || p.name,
    sublabel: [p.sku, p.type].filter(Boolean).join(" · "),
  })), [products]);
  const warehouseOptions = useMemo(() => warehouses.map((w) => ({
    id: w.id,
    label: w.name,
    sublabel: w.code,
  })), [warehouses]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, warehousesRes, stockRes, movementsRes] = await Promise.all([
        api.products.list(),
        api.inventory.listWarehouses(),
        api.inventory.listStock(),
        api.inventory.listMovements(),
      ]);
      setProducts(productsRes.items || []);
      setWarehouses(warehousesRes.items || []);
      setStock(stockRes.items || []);
      setMovements(movementsRes.items || []);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذر تحميل بيانات المخزون", "Could not load inventory data"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const totalQty = stock.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const stockValue = stock.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.averageCost || 0), 0);
  const lowStock = stock.filter((row) => Number(row.quantity || 0) <= 0).length;

  const createWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.code.trim() || !warehouseForm.name.trim()) {
      setError(t("رمز واسم المستودع مطلوبة", "Warehouse code and name are required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.inventory.createWarehouse({
        code: warehouseForm.code.trim(),
        name: warehouseForm.name.trim(),
        address: warehouseForm.address.trim() || undefined,
        isPrimary: warehouseForm.isPrimary,
      });
      setWarehouseOpen(false);
      setWarehouseForm({ code: "", name: "", address: "", isPrimary: false });
      await load();
      push("success", t("تم إنشاء المستودع", "Warehouse created"));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل إنشاء المستودع", "Failed to create warehouse"));
    } finally {
      setBusy(false);
    }
  };

  const createProductInline = async (name: string) => {
    const created = await api.products.create({
      sku: null,
      name: name.trim(),
      nameAr: name.trim(),
      type: "INVENTORY",
      unitPrice: 0,
      costPrice: 0,
    });
    setProducts((prev) => [created, ...prev]);
    push("success", t(`تم إنشاء الصنف ${created.nameAr || created.name}`, `Item ${created.name} created`));
    return created.id;
  };

  const createWarehouseInline = async (name: string) => {
    const usedCodes = new Set(warehouses.map((w) => w.code));
    let index = warehouses.length + 1;
    let code = `WH-${String(index).padStart(3, "0")}`;
    while (usedCodes.has(code)) {
      index += 1;
      code = `WH-${String(index).padStart(3, "0")}`;
    }
    const created = await api.inventory.createWarehouse({
      code,
      name: name.trim(),
      isPrimary: warehouses.length === 0,
    });
    setWarehouses((prev) => [created, ...prev]);
    push("success", t(`تم إنشاء المستودع ${created.name}`, `Warehouse ${created.name} created`));
    return created.id;
  };

  const createMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantityValue = Number(movementForm.quantity);
    const unitCostValue = Number(movementForm.unitCost || 0);
    if (!movementForm.productId || !movementForm.warehouseId || !quantityValue) {
      setError(t("اختر المنتج والمستودع والكمية", "Select the product, warehouse and quantity"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (movementForm.mode === "receipt") {
        await api.inventory.receipt({
          productId: movementForm.productId,
          warehouseId: movementForm.warehouseId,
          quantity: quantityValue,
          unitCost: unitCostValue,
          refType: "MANUAL",
        });
      } else if (movementForm.mode === "issue") {
        await api.inventory.issue({
          productId: movementForm.productId,
          warehouseId: movementForm.warehouseId,
          quantity: quantityValue,
          method: movementForm.method as "WAC" | "FIFO" | "LIFO",
          refType: "MANUAL",
        });
      } else {
        if (!movementForm.toWarehouseId || movementForm.toWarehouseId === movementForm.warehouseId) {
          setError(t("اختر مستودع تحويل مختلف", "Choose a different destination warehouse"));
          setBusy(false);
          return;
        }
        await api.inventory.transfer({
          productId: movementForm.productId,
          fromWarehouseId: movementForm.warehouseId,
          toWarehouseId: movementForm.toWarehouseId,
          quantity: quantityValue,
          method: movementForm.method as "WAC" | "FIFO" | "LIFO",
        });
      }
      setMovementOpen(false);
      setMovementForm({ mode: "receipt", productId: "", warehouseId: "", toWarehouseId: "", quantity: "", unitCost: "", method: "WAC" });
      await load();
      push("success", t("تم تسجيل حركة المخزون", "Stock movement recorded"));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تسجيل الحركة", "Failed to record movement"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المخزون والمستودعات", "Inventory & Warehouses")}</h1>
          <p className="text-muted-foreground mt-1">{t("تتبع الكميات، المستودعات، الاستلام، الصرف، والتحويلات", "Track quantities, warehouses, receipts, issues, and transfers")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}</Button>
          <Button variant="outline" onClick={() => setWarehouseOpen(true)}><Warehouse className="me-2 h-4 w-4" />{t("مستودع جديد", "New warehouse")}</Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setMovementOpen(true)}><Plus className="me-2 h-4 w-4" />{t("حركة مخزون", "Stock movement")}</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label={t("المستودعات", "Warehouses")} value={warehouses.length.toString()} />
        <Metric label={t("الأصناف المخزنية", "Inventory items")} value={products.filter((p) => p.type === "INVENTORY").length.toString()} />
        <Metric label={t("إجمالي الكمية", "Total quantity")} value={qty(totalQty)} />
        <Metric label={t("قيمة المخزون", "Stock value")} value={`${money(stockValue)} SAR`} tone={lowStock > 0 ? "warn" : "default"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "stock"} onClick={() => setActiveTab("stock")}>{t("الأرصدة", "Balances")}</TabButton>
        <TabButton active={activeTab === "warehouses"} onClick={() => setActiveTab("warehouses")}>{t("المستودعات", "Warehouses")}</TabButton>
        <TabButton active={activeTab === "movements"} onClick={() => setActiveTab("movements")}>{t("الحركات", "Movements")}</TabButton>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>{activeTab === "stock" ? t("أرصدة المخزون", "Stock Balances") : activeTab === "warehouses" ? t("المستودعات", "Warehouses") : t("سجل الحركات", "Movement Log")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
          ) : activeTab === "stock" ? (
            <StockTable rows={stock} productById={productById} />
          ) : activeTab === "warehouses" ? (
            <WarehouseTable rows={warehouses} />
          ) : (
            <MovementTable rows={movements} productById={productById} warehouseById={warehouseById} />
          )}
        </CardContent>
      </Card>

      <SidePanel open={warehouseOpen} onClose={() => setWarehouseOpen(false)}>
        <form onSubmit={createWarehouse} className="space-y-4 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("مستودع جديد", "New warehouse")}</h2>
            <p className="text-sm text-muted-foreground">{t("أضف مستودع أو فرع تخزين فعلي.", "Add a physical warehouse or storage branch.")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t("الرمز *", "Code *")}</Label><Input required value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })} dir="ltr" className="font-english" placeholder="MAIN" /></div>
            <div className="space-y-2"><Label>{t("الاسم *", "Name *")}</Label><Input required value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} placeholder={t("المستودع الرئيسي", "Main warehouse")} /></div>
          </div>
          <div className="space-y-2"><Label>{t("العنوان", "Address")}</Label><Input value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} placeholder={t("الرياض · حي...", "Riyadh · district...")} /></div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={warehouseForm.isPrimary} onChange={(e) => setWarehouseForm({ ...warehouseForm, isPrimary: e.target.checked })} />
            {t("مستودع رئيسي", "Primary warehouse")}
          </label>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => setWarehouseOpen(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? t("جارٍ الحفظ...", "Saving...") : t("حفظ", "Save")}</Button>
          </div>
        </form>
      </SidePanel>

      <SidePanel open={movementOpen} onClose={() => setMovementOpen(false)}>
        <form onSubmit={createMovement} className="space-y-4 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("حركة مخزون", "Stock movement")}</h2>
            <p className="text-sm text-muted-foreground">{t("سجل استلام، صرف، أو تحويل بين المستودعات.", "Record a receipt, issue, or transfer between warehouses.")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("نوع الحركة", "Movement type")}</Label>
            <Select value={movementForm.mode} onValueChange={(mode) => setMovementForm({ ...movementForm, mode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt">{t("استلام", "Receipt")}</SelectItem>
                <SelectItem value="issue">{t("صرف", "Issue")}</SelectItem>
                <SelectItem value="transfer">{t("تحويل", "Transfer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("الصنف *", "Item *")}</Label>
            <SearchableCombobox
              value={movementForm.productId}
              onChange={(productId) => setMovementForm({ ...movementForm, productId })}
              onCreate={createProductInline}
              items={productOptions}
              placeholder={t("ابحث عن صنف أو اكتب صنف جديد...", "Search for an item or type a new one...")}
              createLabel={(q) => t(`+ إنشاء صنف مخزني "${q}"`, `+ Create inventory item "${q}"`)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{movementForm.mode === "transfer" ? t("من مستودع *", "From warehouse *") : t("المستودع *", "Warehouse *")}</Label>
              <SearchableCombobox
                value={movementForm.warehouseId}
                onChange={(warehouseId) => setMovementForm({ ...movementForm, warehouseId })}
                onCreate={createWarehouseInline}
                items={warehouseOptions}
                placeholder={t("ابحث عن مستودع أو اكتب مستودع جديد...", "Search for a warehouse or type a new one...")}
                createLabel={(q) => t(`+ إنشاء مستودع "${q}"`, `+ Create warehouse "${q}"`)}
              />
            </div>
            {movementForm.mode === "transfer" && (
              <div className="space-y-2">
                <Label>{t("إلى مستودع *", "To warehouse *")}</Label>
                <SearchableCombobox
                  value={movementForm.toWarehouseId}
                  onChange={(toWarehouseId) => setMovementForm({ ...movementForm, toWarehouseId })}
                  onCreate={createWarehouseInline}
                  items={warehouseOptions.filter((w) => w.id !== movementForm.warehouseId)}
                  placeholder={t("ابحث عن وجهة أو اكتب مستودع جديد...", "Search a destination or type a new warehouse...")}
                  createLabel={(q) => t(`+ إنشاء مستودع "${q}"`, `+ Create warehouse "${q}"`)}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t("الكمية *", "Quantity *")}</Label><Input required type="number" min="0.001" step="0.001" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} dir="ltr" className="font-english" /></div>
            {movementForm.mode === "receipt" ? (
              <div className="space-y-2"><Label>{t("تكلفة الوحدة", "Unit cost")}</Label><Input type="number" min="0" step="0.01" value={movementForm.unitCost} onChange={(e) => setMovementForm({ ...movementForm, unitCost: e.target.value })} dir="ltr" className="font-english" /></div>
            ) : (
              <div className="space-y-2">
                <Label>{t("طريقة التكلفة", "Cost method")}</Label>
                <Select value={movementForm.method} onValueChange={(method) => setMovementForm({ ...movementForm, method })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WAC">WAC</SelectItem>
                    <SelectItem value="FIFO">FIFO</SelectItem>
                    <SelectItem value="LIFO">LIFO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => setMovementOpen(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? t("جارٍ التسجيل...", "Recording...") : t("تسجيل الحركة", "Record movement")}</Button>
          </div>
        </form>
      </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${tone === "warn" ? "border-amber-200 bg-amber-50" : "border-border bg-white"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground font-english">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md border px-3 py-2 text-sm ${active ? "border-[#1276E3] bg-[#EAF4FF] text-primary" : "border-border bg-white text-muted-foreground hover:bg-muted"}`}>
      {children}
    </button>
  );
}

function StockTable({ rows, productById }: { rows: StockRow[]; productById: Map<string, ProductRow> }) {
  const { t } = useLanguage();
  if (rows.length === 0) return <Empty icon={<Package className="h-10 w-10" />} text={t("لا توجد أرصدة مخزون بعد", "No stock balances yet")} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
          <th className="px-4 py-3 text-start">{t("الصنف", "Item")}</th>
          <th className="px-4 py-3 text-start">{t("المستودع", "Warehouse")}</th>
          <th className="px-4 py-3 text-start">{t("الكمية", "Quantity")}</th>
          <th className="px-4 py-3 text-start">{t("متوسط التكلفة", "Avg cost")}</th>
          <th className="px-4 py-3 text-start">{t("القيمة", "Value")}</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const product = productById.get(row.productId);
            const quantity = Number(row.quantity || 0);
            const averageCost = Number(row.averageCost || 0);
            return (
              <tr key={row.id} className="border-b border-border/50 hover:bg-primary/5">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{product?.nameAr || product?.name || t("صنف غير معروف", "Unknown item")}</div>
                  <div className="text-xs text-muted-foreground/60 font-english">{product?.sku || row.productId}</div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground/80">{row.warehouse?.name || row.warehouseId}</td>
                <td className="px-4 py-3 text-sm font-semibold text-foreground font-english">{qty(quantity)}</td>
                <td className="px-4 py-3 text-sm font-english">{money(averageCost)}</td>
                <td className="px-4 py-3 text-sm font-semibold font-english">{money(quantity * averageCost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WarehouseTable({ rows }: { rows: WarehouseRow[] }) {
  const { t } = useLanguage();
  if (rows.length === 0) return <Empty icon={<Warehouse className="h-10 w-10" />} text={t("لا توجد مستودعات بعد", "No warehouses yet")} />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-foreground">{row.name}</div>
              <div className="text-xs text-muted-foreground font-english">{row.code}</div>
            </div>
            {row.isPrimary && <span className="rounded bg-blue-50 px-2 py-1 text-xs text-primary">{t("رئيسي", "Primary")}</span>}
          </div>
          {row.address && <div className="mt-3 text-sm text-muted-foreground">{row.address}</div>}
        </div>
      ))}
    </div>
  );
}

function MovementTable({ rows, productById, warehouseById }: { rows: MovementRow[]; productById: Map<string, ProductRow>; warehouseById: Map<string, WarehouseRow> }) {
  const { t } = useLanguage();
  if (rows.length === 0) return <Empty icon={<Repeat2 className="h-10 w-10" />} text={t("لا توجد حركات مخزون بعد", "No stock movements yet")} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
          <th className="px-4 py-3 text-start">{t("التاريخ", "Date")}</th>
          <th className="px-4 py-3 text-start">{t("الحركة", "Movement")}</th>
          <th className="px-4 py-3 text-start">{t("الصنف", "Item")}</th>
          <th className="px-4 py-3 text-start">{t("المستودع", "Warehouse")}</th>
          <th className="px-4 py-3 text-start">{t("الكمية", "Quantity")}</th>
          <th className="px-4 py-3 text-start">{t("التكلفة", "Cost")}</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const product = productById.get(row.productId);
            const warehouse = warehouseById.get(row.warehouseId);
            const quantityValue = Number(row.quantity || 0);
            const inbound = quantityValue >= 0;
            const label = movementLabels[row.type];
            return (
              <tr key={row.id} className="border-b border-border/50 hover:bg-primary/5">
                <td className="px-4 py-3 text-sm text-muted-foreground font-english">{row.occurredAt ? new Date(row.occurredAt).toLocaleDateString("en-GB") : "—"}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${inbound ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {inbound ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                    {label ? t(label.ar, label.en) : row.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{product?.nameAr || product?.name || row.productId}</td>
                <td className="px-4 py-3 text-sm text-foreground/80">{warehouse?.name || row.warehouseId}</td>
                <td className="px-4 py-3 text-sm font-semibold font-english">{qty(quantityValue)}</td>
                <td className="px-4 py-3 text-sm font-english">{money(row.unitCost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="py-12 text-center text-muted-foreground/60">{icon}<p className="mt-3 text-sm text-muted-foreground">{text}</p></div>;
}
