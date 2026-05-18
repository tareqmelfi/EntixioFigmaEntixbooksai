import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Package, Plus, RefreshCw, Repeat2, Warehouse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";

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

const movementLabels: Record<string, string> = {
  RECEIPT: "استلام",
  OPENING: "رصيد افتتاحي",
  ISSUE: "صرف",
  TRANSFER_IN: "تحويل وارد",
  TRANSFER_OUT: "تحويل صادر",
  ADJUSTMENT: "تسوية",
  RETURN_IN: "مرتجع وارد",
  RETURN_OUT: "مرتجع صادر",
};

export function Inventory() {
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stock" | "warehouses" | "movements">("stock");
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
      setError(e instanceof ApiError ? e.message : "تعذر تحميل بيانات المخزون");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalQty = stock.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const stockValue = stock.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.averageCost || 0), 0);
  const lowStock = stock.filter((row) => Number(row.quantity || 0) <= 0).length;

  const createWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.code.trim() || !warehouseForm.name.trim()) {
      setError("رمز واسم المستودع مطلوبة");
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
      push("success", "تم إنشاء المستودع");
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل إنشاء المستودع");
    } finally {
      setBusy(false);
    }
  };

  const createMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantityValue = Number(movementForm.quantity);
    const unitCostValue = Number(movementForm.unitCost || 0);
    if (!movementForm.productId || !movementForm.warehouseId || !quantityValue) {
      setError("اختر المنتج والمستودع والكمية");
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
          setError("اختر مستودع تحويل مختلف");
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
      push("success", "تم تسجيل حركة المخزون");
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل تسجيل الحركة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المخزون والمستودعات</h1>
          <p className="text-[#6B7280] mt-1">تتبع الكميات، المستودعات، الاستلام، الصرف، والتحويلات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="me-2 h-4 w-4" />تحديث</Button>
          <Button variant="outline" onClick={() => setWarehouseOpen(true)}><Warehouse className="me-2 h-4 w-4" />مستودع جديد</Button>
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setMovementOpen(true)}><Plus className="me-2 h-4 w-4" />حركة مخزون</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="المستودعات" value={warehouses.length.toString()} />
        <Metric label="الأصناف المخزنية" value={products.filter((p) => p.type === "INVENTORY").length.toString()} />
        <Metric label="إجمالي الكمية" value={qty(totalQty)} />
        <Metric label="قيمة المخزون" value={`${money(stockValue)} SAR`} tone={lowStock > 0 ? "warn" : "default"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "stock"} onClick={() => setActiveTab("stock")}>الأرصدة</TabButton>
        <TabButton active={activeTab === "warehouses"} onClick={() => setActiveTab("warehouses")}>المستودعات</TabButton>
        <TabButton active={activeTab === "movements"} onClick={() => setActiveTab("movements")}>الحركات</TabButton>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <CardTitle>{activeTab === "stock" ? "أرصدة المخزون" : activeTab === "warehouses" ? "المستودعات" : "سجل الحركات"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#1276E3]" /></div>
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
            <h2 className="text-lg font-semibold text-[#0B1B49]">مستودع جديد</h2>
            <p className="text-sm text-[#6B7280]">أضف مستودع أو فرع تخزين فعلي.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>الرمز *</Label><Input required value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })} dir="ltr" className="font-english" placeholder="MAIN" /></div>
            <div className="space-y-2"><Label>الاسم *</Label><Input required value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} placeholder="المستودع الرئيسي" /></div>
          </div>
          <div className="space-y-2"><Label>العنوان</Label><Input value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} placeholder="الرياض · حي..." /></div>
          <label className="flex items-center gap-2 text-sm text-[#0B1B49]">
            <input type="checkbox" checked={warehouseForm.isPrimary} onChange={(e) => setWarehouseForm({ ...warehouseForm, isPrimary: e.target.checked })} />
            مستودع رئيسي
          </label>
          <div className="flex justify-end gap-2 border-t border-[#E5E7EB] pt-3">
            <Button type="button" variant="outline" onClick={() => setWarehouseOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </SidePanel>

      <SidePanel open={movementOpen} onClose={() => setMovementOpen(false)}>
        <form onSubmit={createMovement} className="space-y-4 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0B1B49]">حركة مخزون</h2>
            <p className="text-sm text-[#6B7280]">سجل استلام، صرف، أو تحويل بين المستودعات.</p>
          </div>
          <div className="space-y-2">
            <Label>نوع الحركة</Label>
            <Select value={movementForm.mode} onValueChange={(mode) => setMovementForm({ ...movementForm, mode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt">استلام</SelectItem>
                <SelectItem value="issue">صرف</SelectItem>
                <SelectItem value="transfer">تحويل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الصنف *</Label>
            <Select value={movementForm.productId} onValueChange={(productId) => setMovementForm({ ...movementForm, productId })}>
              <SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.nameAr || p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{movementForm.mode === "transfer" ? "من مستودع *" : "المستودع *"}</Label>
              <Select value={movementForm.warehouseId} onValueChange={(warehouseId) => setMovementForm({ ...movementForm, warehouseId })}>
                <SelectTrigger><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {movementForm.mode === "transfer" && (
              <div className="space-y-2">
                <Label>إلى مستودع *</Label>
                <Select value={movementForm.toWarehouseId} onValueChange={(toWarehouseId) => setMovementForm({ ...movementForm, toWarehouseId })}>
                  <SelectTrigger><SelectValue placeholder="اختر الوجهة" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>الكمية *</Label><Input required type="number" min="0.001" step="0.001" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} dir="ltr" className="font-english" /></div>
            {movementForm.mode === "receipt" ? (
              <div className="space-y-2"><Label>تكلفة الوحدة</Label><Input type="number" min="0" step="0.01" value={movementForm.unitCost} onChange={(e) => setMovementForm({ ...movementForm, unitCost: e.target.value })} dir="ltr" className="font-english" /></div>
            ) : (
              <div className="space-y-2">
                <Label>طريقة التكلفة</Label>
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
          <div className="flex justify-end gap-2 border-t border-[#E5E7EB] pt-3">
            <Button type="button" variant="outline" onClick={() => setMovementOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "جارٍ التسجيل..." : "تسجيل الحركة"}</Button>
          </div>
        </form>
      </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${tone === "warn" ? "border-amber-200 bg-amber-50" : "border-[#E5E7EB] bg-white"}`}>
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#0B1B49] font-english">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md border px-3 py-2 text-sm ${active ? "border-[#1276E3] bg-[#EAF4FF] text-[#1276E3]" : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"}`}>
      {children}
    </button>
  );
}

function StockTable({ rows, productById }: { rows: StockRow[]; productById: Map<string, ProductRow> }) {
  if (rows.length === 0) return <Empty icon={<Package className="h-10 w-10" />} text="لا توجد أرصدة مخزون بعد" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
          <th className="px-4 py-3 text-start">الصنف</th>
          <th className="px-4 py-3 text-start">المستودع</th>
          <th className="px-4 py-3 text-start">الكمية</th>
          <th className="px-4 py-3 text-start">متوسط التكلفة</th>
          <th className="px-4 py-3 text-start">القيمة</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const product = productById.get(row.productId);
            const quantity = Number(row.quantity || 0);
            const averageCost = Number(row.averageCost || 0);
            return (
              <tr key={row.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                <td className="px-4 py-3">
                  <div className="font-medium text-[#0B1B49]">{product?.nameAr || product?.name || "صنف غير معروف"}</div>
                  <div className="text-xs text-[#9CA3AF] font-english">{product?.sku || row.productId}</div>
                </td>
                <td className="px-4 py-3 text-sm text-[#374151]">{row.warehouse?.name || row.warehouseId}</td>
                <td className="px-4 py-3 text-sm font-semibold text-[#0B1B49] font-english">{qty(quantity)}</td>
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
  if (rows.length === 0) return <Empty icon={<Warehouse className="h-10 w-10" />} text="لا توجد مستودعات بعد" />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#0B1B49]">{row.name}</div>
              <div className="text-xs text-[#6B7280] font-english">{row.code}</div>
            </div>
            {row.isPrimary && <span className="rounded bg-blue-50 px-2 py-1 text-xs text-[#1276E3]">رئيسي</span>}
          </div>
          {row.address && <div className="mt-3 text-sm text-[#6B7280]">{row.address}</div>}
        </div>
      ))}
    </div>
  );
}

function MovementTable({ rows, productById, warehouseById }: { rows: MovementRow[]; productById: Map<string, ProductRow>; warehouseById: Map<string, WarehouseRow> }) {
  if (rows.length === 0) return <Empty icon={<Repeat2 className="h-10 w-10" />} text="لا توجد حركات مخزون بعد" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
          <th className="px-4 py-3 text-start">التاريخ</th>
          <th className="px-4 py-3 text-start">الحركة</th>
          <th className="px-4 py-3 text-start">الصنف</th>
          <th className="px-4 py-3 text-start">المستودع</th>
          <th className="px-4 py-3 text-start">الكمية</th>
          <th className="px-4 py-3 text-start">التكلفة</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const product = productById.get(row.productId);
            const warehouse = warehouseById.get(row.warehouseId);
            const quantityValue = Number(row.quantity || 0);
            const inbound = quantityValue >= 0;
            return (
              <tr key={row.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                <td className="px-4 py-3 text-sm text-[#6B7280] font-english">{row.occurredAt ? new Date(row.occurredAt).toLocaleDateString("en-GB") : "—"}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${inbound ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {inbound ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                    {movementLabels[row.type] || row.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#0B1B49]">{product?.nameAr || product?.name || row.productId}</td>
                <td className="px-4 py-3 text-sm text-[#374151]">{warehouse?.name || row.warehouseId}</td>
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
  return <div className="py-12 text-center text-[#9CA3AF]">{icon}<p className="mt-3 text-sm text-[#6B7280]">{text}</p></div>;
}
