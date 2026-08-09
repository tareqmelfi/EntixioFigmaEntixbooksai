import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Package, Plus, RefreshCw, Repeat2, Warehouse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { displayName } from "../lib/display-name";
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
  const { toasts, dismiss } = useToasts();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
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
  const navigate = useNavigate();

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المخزون والمستودعات", "Inventory & Warehouses")}</h1>
          <p className="text-muted-foreground mt-1">{t("تتبع الكميات، المستودعات، الاستلام، الصرف، والتحويلات", "Track quantities, warehouses, receipts, issues, and transfers")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}</Button>
          <Button variant="outline" onClick={() => navigate("/app/inventory/warehouses/new")}><Warehouse className="me-2 h-4 w-4" />{t("مستودع جديد", "New warehouse")}</Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/inventory/movements/new")}><Plus className="me-2 h-4 w-4" />{t("حركة مخزون", "Stock movement")}</Button>
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
    <button onClick={onClick} className={`rounded-md border px-3 py-2 text-sm ${active ? "border-primary bg-primary/5 text-primary" : "border-border bg-white text-muted-foreground hover:bg-muted"}`}>
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
                  <div className="font-medium text-foreground">{displayName(product ?? {}) || t("صنف غير معروف", "Unknown item")}</div>
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
                <td className="px-4 py-3 text-sm text-foreground">{displayName(product ?? {}) || row.productId}</td>
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
