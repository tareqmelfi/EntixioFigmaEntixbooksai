import { displayLocale } from "../lib/number-display";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Package, Plus, RefreshCw, Repeat2, Warehouse, ClipboardList, AlertTriangle } from "lucide-react";
import { EmptyState, InlineAlert, LedgerFigure, Metric as LedgerMetric, MetricStrip, PageHeader, StatusBadge } from "../components/product";
import { Button } from "../components/ui/button";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useLanguage } from "../components/LanguageContext";
import { useOrgRegion } from "../lib/use-org-region";
import type { ReorderAlert } from "../lib/api";

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
  Number(value || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qty = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 });

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
  const [reorder, setReorder] = useState<ReorderAlert[]>([]);
  const { currency: orgCurrency } = useOrgRegion();
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
      api.inventory.reorder().then((r) => setReorder(r.items || [])).catch(() => setReorder([]));
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
      <PageHeader
        eyebrow={t("المنتجات والمخزون", "Products & inventory")}
        title={t("المخزون والمستودعات", "Inventory & Warehouses")}
        description={t("تتبع الكميات، المستودعات، الاستلام، الصرف، والتحويلات", "Track quantities, warehouses, receipts, issues, and transfers")}
        actions={(
          <>
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="me-2 h-4 w-4" strokeWidth={1.75} />{t("تحديث", "Refresh")}</Button>
            <Button variant="outline" onClick={() => navigate("/app/inventory/counts")}><ClipboardList className="me-2 h-4 w-4" strokeWidth={1.75} />{t("الجرد", "Stocktake")}</Button>
            <Button variant="outline" onClick={() => navigate("/app/inventory/transfers")}><Repeat2 className="me-2 h-4 w-4" strokeWidth={1.75} />{t("التحويلات", "Transfers")}</Button>
            <Button variant="outline" onClick={() => navigate("/app/inventory/warehouses/new")}><Warehouse className="me-2 h-4 w-4" strokeWidth={1.75} />{t("مستودع جديد", "New warehouse")}</Button>
            <Button onClick={() => navigate("/app/inventory/movements/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("حركة مخزون", "Stock movement")}</Button>
          </>
        )}
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <MetricStrip>
        <LedgerMetric label={t("المستودعات", "Warehouses")} value={warehouses.length.toString()} />
        <LedgerMetric label={t("الأصناف المخزنية", "Inventory items")} value={products.filter((p) => p.type === "INVENTORY").length.toString()} />
        <LedgerMetric label={t("إجمالي الكمية", "Total quantity")} value={qty(totalQty)} />
        <LedgerMetric label={t("قيمة المخزون", "Stock value")} value={<LedgerFigure value={stockValue} currency={orgCurrency || undefined} />} tone={lowStock > 0 ? "warning" : "neutral"} />
      </MetricStrip>

      {/* B3.3 · reorder alerts · products at/below their reorder point */}
      {reorder.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-section flex items-center gap-2 font-semibold text-warning"><AlertTriangle className="h-4 w-4" strokeWidth={1.75} />{t(`تنبيهات إعادة الطلب · ${reorder.length}`, `Reorder alerts · ${reorder.length}`)}</h2>
          <div className="ledger-table overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-sm">
              <colgroup>
                <col />
                <col style={{ width: "110px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "170px" }} />
              </colgroup>
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
                <th className="px-4 py-2 text-start font-medium">{t("الصنف", "Item")}</th>
                <th className="px-4 py-2 text-end font-medium">{t("المتوفر", "On hand")}</th>
                <th className="px-4 py-2 text-end font-medium">{t("حد الطلب", "Reorder point")}</th>
                <th className="px-4 py-2 text-end font-medium">{t("النقص", "Short by")}</th>
                <th className="px-4 py-2 text-end font-medium">{t("كمية مقترحة", "Suggested qty")}</th>
                <th className="px-4 py-2 text-end font-medium">{t("التكلفة التقديرية", "Est. cost")}</th>
              </tr></thead>
              <tbody>
                {reorder.slice(0, 20).map((r) => (
                  <tr key={r.product.id} className="border-b border-border hover:bg-surface-hover cursor-pointer" onClick={() => navigate(`/app/products/${r.product.id}`)} title={t("فتح الصنف", "Open item")}>
                    <td className="px-4 py-2 text-foreground truncate"><Link to={`/app/products/${r.product.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline underline-offset-4"><bdi dir="auto">{displayName(r.product as any)}</bdi></Link>{r.product.sku ? <span className="ms-2 font-code text-xs text-muted-foreground" dir="ltr">{r.product.sku}</span> : null}</td>
                    <td className="px-4 py-2 text-end font-english tabular-nums" dir="ltr">{qty(r.onHand)}</td>
                    <td className="px-4 py-2 text-end font-english tabular-nums" dir="ltr">{qty(r.reorderQty)}</td>
                    <td className="px-4 py-2 text-end font-english tabular-nums text-warning" dir="ltr">{qty(r.shortBy)}</td>
                    <td className="px-4 py-2 text-end font-english tabular-nums" dir="ltr">{qty(r.suggestedQty)}</td>
                    <td className="px-4 py-2 text-end font-english tabular-nums whitespace-nowrap" dir="ltr">{money(r.suggestedQty * r.unitCost)} {orgCurrency || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reorder.length > 20 && <div className="px-4 py-2 text-xs text-muted-foreground">{t(`+${reorder.length - 20} صنف آخر`, `+${reorder.length - 20} more`)}</div>}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2" role="tablist">
        <TabButton active={activeTab === "stock"} onClick={() => setActiveTab("stock")}>{t("الأرصدة", "Balances")}</TabButton>
        <TabButton active={activeTab === "warehouses"} onClick={() => setActiveTab("warehouses")}>{t("المستودعات", "Warehouses")}</TabButton>
        <TabButton active={activeTab === "movements"} onClick={() => setActiveTab("movements")}>{t("الحركات", "Movements")}</TabButton>
      </div>

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{activeTab === "stock" ? t("أرصدة المخزون", "Stock Balances") : activeTab === "warehouses" ? t("المستودعات", "Warehouses") : t("سجل الحركات", "Movement Log")}</h2>
        {loading ? (
          <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : activeTab === "stock" ? (
          <StockTable rows={stock} productById={productById} />
        ) : activeTab === "warehouses" ? (
          <WarehouseTable rows={warehouses} />
        ) : (
          <MovementTable rows={movements} productById={productById} warehouseById={warehouseById} />
        )}
      </section>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className={`rounded-full px-3.5 py-[7px] text-[13px] leading-5 transition-colors ${active ? "bg-foreground text-background" : "border border-border bg-card text-content-secondary hover:border-border-strong"}`}>
      {children}
    </button>
  );
}

function StockTable({ rows, productById }: { rows: StockRow[]; productById: Map<string, ProductRow> }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  if (rows.length === 0) return <Empty icon={<Package className="h-10 w-10" />} text={t("لا توجد أرصدة مخزون بعد", "No stock balances yet")} />;
  return (
    <div className="ledger-table overflow-x-auto">
      <table className="w-full min-w-[820px] table-fixed text-sm">
        <colgroup>
          <col />
          <col style={{ width: "220px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "150px" }} />
          <col style={{ width: "170px" }} />
        </colgroup>
        <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
          <th className="px-4 py-3 text-start font-medium">{t("الصنف", "Item")}</th>
          <th className="px-4 py-3 text-start font-medium">{t("المستودع", "Warehouse")}</th>
          <th className="px-4 py-3 text-end font-medium">{t("الكمية", "Quantity")}</th>
          <th className="px-4 py-3 text-end font-medium">{t("متوسط التكلفة", "Avg cost")}</th>
          <th className="px-4 py-3 text-end font-medium">{t("القيمة", "Value")}</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const product = productById.get(row.productId);
            const quantity = Number(row.quantity || 0);
            const averageCost = Number(row.averageCost || 0);
            return (
              <tr key={row.id} className="border-b border-border hover:bg-surface-hover cursor-pointer" onClick={() => navigate(`/app/products/${row.productId}`)} title={t("فتح الصنف", "Open item")}>
                <td className="px-4 py-3">
                  <Link to={`/app/products/${row.productId}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-medium text-foreground hover:underline underline-offset-4" title={displayName(product ?? {}) || undefined}><bdi dir="auto">{displayName(product ?? {}) || t("صنف غير معروف", "Unknown item")}</bdi></Link>
                  <div className="truncate text-xs text-muted-foreground/60 font-code" dir="ltr">{product?.sku || row.productId}</div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground/80 truncate"><bdi dir="auto">{row.warehouse?.name || row.warehouseId}</bdi></td>
                <td className="px-4 py-3 text-end text-sm font-semibold text-foreground font-english tabular-nums" dir="ltr">{qty(quantity)}</td>
                <td className="px-4 py-3 text-end text-sm font-english tabular-nums" dir="ltr">{money(averageCost)}</td>
                <td className="px-4 py-3 text-end text-sm font-semibold font-english tabular-nums" dir="ltr">{money(quantity * averageCost)}</td>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div key={row.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground" title={row.name}><bdi dir="auto">{row.name}</bdi></div>
              <div className="truncate text-xs text-muted-foreground font-code" dir="ltr">{row.code}</div>
            </div>
            {row.isPrimary && <StatusBadge tone="info" className="shrink-0">{t("رئيسي", "Primary")}</StatusBadge>}
          </div>
          {row.address && <div className="mt-3 truncate text-sm text-muted-foreground" title={row.address}><bdi dir="auto">{row.address}</bdi></div>}
        </div>
      ))}
    </div>
  );
}

function MovementTable({ rows, productById, warehouseById }: { rows: MovementRow[]; productById: Map<string, ProductRow>; warehouseById: Map<string, WarehouseRow> }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  if (rows.length === 0) return <Empty icon={<Repeat2 className="h-10 w-10" />} text={t("لا توجد حركات مخزون بعد", "No stock movements yet")} />;
  return (
    <div className="ledger-table overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed text-sm">
        <colgroup>
          <col style={{ width: "110px" }} />
          <col style={{ width: "150px" }} />
          <col />
          <col style={{ width: "200px" }} />
          <col style={{ width: "110px" }} />
          <col style={{ width: "140px" }} />
        </colgroup>
        <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
          <th className="px-4 py-3 text-start font-medium">{t("التاريخ", "Date")}</th>
          <th className="px-4 py-3 text-start font-medium">{t("الحركة", "Movement")}</th>
          <th className="px-4 py-3 text-start font-medium">{t("الصنف", "Item")}</th>
          <th className="px-4 py-3 text-start font-medium">{t("المستودع", "Warehouse")}</th>
          <th className="px-4 py-3 text-end font-medium">{t("الكمية", "Quantity")}</th>
          <th className="px-4 py-3 text-end font-medium">{t("التكلفة", "Cost")}</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const product = productById.get(row.productId);
            const warehouse = warehouseById.get(row.warehouseId);
            const quantityValue = Number(row.quantity || 0);
            const inbound = quantityValue >= 0;
            const label = movementLabels[row.type];
            return (
              <tr key={row.id} className="border-b border-border hover:bg-surface-hover cursor-pointer" onClick={() => navigate(`/app/products/${row.productId}`)} title={t("فتح الصنف", "Open item")}>
                <td className="px-4 py-3 text-sm text-muted-foreground font-english tabular-nums whitespace-nowrap" dir="ltr">{row.occurredAt ? new Date(row.occurredAt).toLocaleDateString(displayLocale("en-GB")) : "—"}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge tone={inbound ? "success" : "warning"} icon={inbound ? <ArrowDownToLine className="h-3 w-3" strokeWidth={1.75} /> : <ArrowUpFromLine className="h-3 w-3" strokeWidth={1.75} />}>
                    {label ? t(label.ar, label.en) : row.type}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-sm text-foreground truncate"><Link to={`/app/products/${row.productId}`} onClick={(e) => e.stopPropagation()} className="hover:underline underline-offset-4"><bdi dir="auto">{displayName(product ?? {}) || row.productId}</bdi></Link></td>
                <td className="px-4 py-3 text-sm text-foreground/80 truncate"><bdi dir="auto">{warehouse?.name || row.warehouseId}</bdi></td>
                <td className="px-4 py-3 text-end text-sm font-semibold font-english tabular-nums" dir="ltr">{qty(quantityValue)}</td>
                <td className="px-4 py-3 text-end text-sm font-english tabular-nums" dir="ltr">{money(row.unitCost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <EmptyState icon={icon} title={text} />;
}
