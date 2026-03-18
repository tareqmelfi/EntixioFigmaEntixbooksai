import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  X, Edit2, Trash2, FileText, Printer, Download, Save,
  Package, Tag, Hash, User, Warehouse, BarChart3, DollarSign,
  ArrowLeftRight, ChevronDown, ShoppingCart, Receipt,
  TrendingUp, AlertTriangle, Layers, Clock, CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { productsData, type Product, type ItemType } from "./inventory";
import { contactLink } from "../components/contact-map";

const CUR = "SR";

const typeBadge = (t: ItemType) => {
  const m: Record<string, string> = {
    "منتج": "bg-[#EFF6FF] text-[#1276E3] border-[#1276E3]/20",
    "خدمة": "bg-[#F0FDF4] text-[#166534] border-[#22C55E]/20",
    "أصل": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
  };
  return m[t] || "";
};

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    "متاح": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "منخفض": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
    "نفذ": "bg-[#E4F4F9] text-[#2A7F9E] border-[#349FC4]",
  };
  return m[s] || "";
};

/* Mock transactions linked to this product */
const getLinkedTransactions = (_sku: string) => [
  { id: "INV-2026-001", type: "فاتورة بيع", date: "2026-03-01", qty: 5, unitPrice: 4500, total: 22500, contact: "شركة التقنية المتقدمة" },
  { id: "INV-2026-003", type: "فاتورة بيع", date: "2026-03-03", qty: 2, unitPrice: 4500, total: 9000, contact: "شركة المستقبل للتجارة" },
  { id: "BILL-2026-001", type: "فاتورة شراء", date: "2026-02-15", qty: 50, unitPrice: 3800, total: 190000, contact: "شركة الحلول التقنية" },
  { id: "BILL-2026-005", type: "فاتورة شراء", date: "2026-01-10", qty: 100, unitPrice: 3800, total: 380000, contact: "شركة الحلول التقنية" },
];

/* Mock stock movements */
const getStockMovements = (_sku: string) => [
  { id: "SM-001", date: "2026-03-03", type: "صادر", qty: -2, reference: "INV-2026-003", warehouse: "المستودع الرئيسي", balance: 145 },
  { id: "SM-002", date: "2026-03-01", type: "صادر", qty: -5, reference: "INV-2026-001", warehouse: "المستودع الرئيسي", balance: 147 },
  { id: "SM-003", date: "2026-02-15", type: "وارد", qty: 50, reference: "BILL-2026-001", warehouse: "المستودع الرئيسي", balance: 152 },
  { id: "SM-004", date: "2026-01-10", type: "وارد", qty: 100, reference: "BILL-2026-005", warehouse: "المستودع الرئيسي", balance: 102 },
  { id: "SM-005", date: "2025-12-01", type: "تحويل", qty: -10, reference: "TR-001", warehouse: "→ المستودع الفرعي", balance: 2 },
];

const itemTypes: ItemType[] = ["منتج", "خدمة", "أصل"];

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const product = productsData.find((p) => p.sku === id);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "movements">("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [editType, setEditType] = useState<ItemType | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="h-16 w-16 text-[#D1D5DB] mb-4" />
        <h2 className="text-[#0B1B49] mb-2" style={{ fontSize: "1.25rem", fontWeight: 700 }}>العنصر غير موجود</h2>
        <p className="text-[#6B7280] mb-4">لم يتم العثور على العنصر المطلوب</p>
        <Button onClick={() => navigate("/products")} className="bg-[#1276E3] hover:bg-[#1060C0]">العودة للقائمة</Button>
      </div>
    );
  }

  const currentType = editType ?? product.type;
  const transactions = getLinkedTransactions(product.sku);
  const movements = getStockMovements(product.sku);
  const isService = currentType === "خدمة";
  const stockValue = product.stock * product.costPrice;
  const margin = product.sellPrice > 0 ? ((product.sellPrice - product.costPrice) / product.sellPrice * 100) : 0;

  const tabs = [
    { key: "overview" as const, label: "نظرة عامة" },
    { key: "transactions" as const, label: "الحركات المالية" },
    ...(!isService ? [{ key: "movements" as const, label: "حركات المخزون" }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate("/products")} className="mt-1 rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
            <X className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{product.name}</h1>
              <span className={`inline-flex rounded-md px-2.5 py-1 text-xs border ${typeBadge(currentType)}`} style={{ fontWeight: 600 }}>{currentType}</span>
              <span className={`inline-flex rounded-md px-2.5 py-1 text-xs border ${statusBadge(product.status)}`} style={{ fontWeight: 600 }}>{product.status}</span>
            </div>
            <p className="text-[#6B7280] font-english" style={{ fontWeight: 500 }}>{product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" className="border-[#E5E7EB]" onClick={() => { setIsEditing(false); setEditType(null); }}>إلغاء</Button>
              <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setIsEditing(false)}><Save className="me-2 h-4 w-4" />حفظ التغييرات</Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="border-[#E5E7EB]"><Printer className="me-2 h-4 w-4" />طباعة</Button>
              <Button variant="outline" className="border-[#1276E3] text-[#1276E3]" onClick={() => setIsEditing(true)}><Edit2 className="me-2 h-4 w-4" />تعديل</Button>
              <Button variant="outline" className="border-[#EF4444] text-[#EF4444] hover:bg-[#FEE2E2]/30"><Trash2 className="me-2 h-4 w-4" />حذف</Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 gap-4 ${isService ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"}`}>
        {/* سعر البيع */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><DollarSign className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{product.sellPrice.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">سعر البيع</p>
          </CardContent>
        </Card>

        {/* هامش الربح */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><TrendingUp className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#1276E3] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{margin.toFixed(1)}%</div>
            <p className="text-xs text-[#6B7280] mt-1">هامش الربح</p>
          </CardContent>
        </Card>

        {!isService && (
          <>
            {/* الكمية المتاحة */}
            <Card className="border-[#E5E7EB]">
              <CardContent className="pt-5 pb-4 px-5 text-center">
                <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Layers className="h-5 w-5 text-[#1276E3]" /></div></div>
                <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{product.stock}</div>
                <p className="text-xs text-[#6B7280] mt-1">الكمية المتاحة</p>
              </CardContent>
            </Card>

            {/* قيمة المخزون */}
            <Card className="border-[#E5E7EB]">
              <CardContent className="pt-5 pb-4 px-5 text-center">
                <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><BarChart3 className="h-5 w-5 text-[#349FC4]" /></div></div>
                <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
                  <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
                  <span className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stockValue.toLocaleString()}</span>
                </div>
                <p className="text-xs text-[#6B7280] mt-1">قيمة المخزون</p>
              </CardContent>
            </Card>
          </>
        )}

        {isService && (
          <Card className="border-[#E5E7EB]">
            <CardContent className="pt-5 pb-4 px-5 text-center">
              <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><ArrowLeftRight className="h-5 w-5 text-[#349FC4]" /></div></div>
              <div className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>12</div>
              <p className="text-xs text-[#6B7280] mt-1">مرات الاستخدام</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${activeTab === tab.key ? "border-[#1276E3] text-[#1276E3]" : "border-transparent text-[#6B7280] hover:text-[#374151]"}`}
            style={{ fontWeight: activeTab === tab.key ? 600 : 400 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Details */}
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">بيانات العنصر</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type changer */}
              <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2 text-sm text-[#6B7280]"><Tag className="h-4 w-4" /> النوع</div>
                {isEditing ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm border ${typeBadge(currentType)}`}
                      style={{ fontWeight: 600 }}
                    >
                      {currentType}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showTypeDropdown && (
                      <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                        {itemTypes.map((t) => (
                          <button key={t} onClick={() => { setEditType(t); setShowTypeDropdown(false); }}
                            className={`w-full text-start px-3 py-2 text-sm transition-colors ${currentType === t ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                            style={{ fontWeight: currentType === t ? 600 : 400 }}
                          >
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] border me-2 ${typeBadge(t)}`} style={{ fontWeight: 600 }}>{t}</span>
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={`inline-flex rounded-md px-2.5 py-1 text-xs border ${typeBadge(currentType)}`} style={{ fontWeight: 600 }}>{currentType}</span>
                )}
              </div>

              <DetailRow icon={Hash} label="الرمز" value={product.sku} isEnglish />
              <DetailRow icon={Package} label="التصنيف" value={product.category} />
              {product.unit && <DetailRow icon={Layers} label="الوحدة" value={product.unit} />}
              {product.barcode && <DetailRow icon={Hash} label="الباركود" value={product.barcode} isEnglish />}
              {product.supplier && (
                <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                  <div className="flex items-center gap-2 text-sm text-[#6B7280]"><User className="h-4 w-4" /> المورد</div>
                  <Link to={contactLink(product.supplier)} className="text-sm text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>{product.supplier}</Link>
                </div>
              )}
              {!isService && <DetailRow icon={Warehouse} label="المستودع" value={product.warehouse} />}
              {product.description && (
                <div className="pt-2">
                  <p className="text-xs text-[#6B7280] mb-1">الوصف</p>
                  <p className="text-sm text-[#374151]">{product.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">التسعير</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                <span className="text-sm text-[#6B7280]">سعر التكلفة</span>
                <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english" style={{ fontWeight: 600 }}>
                  <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                  <span className="text-[#374151]">{product.costPrice.toLocaleString()}</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                <span className="text-sm text-[#6B7280]">سعر البيع</span>
                <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english" style={{ fontWeight: 700 }}>
                  <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                  <span className="text-[#0B1A47]">{product.sellPrice.toLocaleString()}</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                <span className="text-sm text-[#6B7280]">هامش الربح</span>
                <span className="text-sm font-english text-[#1276E3]" style={{ fontWeight: 700 }}>{margin.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                <span className="text-sm text-[#6B7280]">نسبة الضريبة</span>
                <span className="text-sm font-english text-[#374151]" style={{ fontWeight: 500 }}>{product.taxRate ?? 0}%</span>
              </div>

              {!isService && (
                <>
                  <div className="border-t border-[#E5E7EB] pt-4 mt-4">
                    <h3 className="text-[#0B1B49] mb-3" style={{ fontWeight: 600 }}>معلومات المخزون</h3>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                    <span className="text-sm text-[#6B7280]">الكمية الحالية</span>
                    <span className="text-sm font-english text-[#374151]" style={{ fontWeight: 600 }}>{product.stock}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                    <span className="text-sm text-[#6B7280]">حد إعادة الطلب</span>
                    <span className="text-sm font-english text-[#374151]" style={{ fontWeight: 500 }}>{product.reorderLevel}</span>
                  </div>
                  {product.stock > 0 && product.stock <= product.reorderLevel && (
                    <div className="flex items-center gap-2 rounded-lg bg-[#FEF3C7] border border-[#F59E0B]/30 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                      <span className="text-xs text-[#92400E]" style={{ fontWeight: 600 }}>المخزون منخفض — يحتاج إعادة طلب</span>
                    </div>
                  )}
                  {product.stock === 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-[#E4F4F9] border border-[#349FC4]/30 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-[#349FC4]" />
                      <span className="text-xs text-[#2A7F9E]" style={{ fontWeight: 600 }}>المخزون نفذ بالكامل</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {activeTab === "transactions" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">الحركات المالية المرتبطة</CardTitle>
            <CardDescription className="text-[#9CA3AF]" style={{ fontSize: "12px" }}>فواتير البيع والشراء المرتبطة بهذا العنصر</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "750px", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "100px" }} />
                  <col />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "120px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المرجع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>النوع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الطرف</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الكمية</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>سعر الوحدة</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الإجمالي ({CUR})</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                      <td className="py-3.5 pe-3">
                        <Link to={t.id.startsWith("INV") ? "/invoices" : "/purchases/bills"} className="font-english text-sm text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{t.id}</Link>
                      </td>
                      <td className="py-3.5 pe-3">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] border ${t.type.includes("بيع") ? "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20" : "bg-[#E4F4F9] text-[#2A7F9E] border-[#349FC4]/20"}`} style={{ fontWeight: 600 }}>
                          {t.type.includes("بيع") ? <ShoppingCart className="h-3 w-3" /> : <Receipt className="h-3 w-3" />}
                          {t.type}
                        </span>
                      </td>
                      <td className="py-3.5 pe-3"><span className="font-english text-sm text-[#6B7280]">{t.date}</span></td>
                      <td className="py-3.5 pe-3">
                        <Link to={contactLink(t.contact)} className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors">{t.contact}</Link>
                      </td>
                      <td className="py-3.5 pe-3"><span className="font-english text-sm text-[#374151]" style={{ fontWeight: 500 }}>{t.qty}</span></td>
                      <td className="py-3.5 pe-3">
                        <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                          <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem" }}>{CUR}</span>
                          <span className="text-[#374151]">{t.unitPrice.toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="py-3.5 pe-3">
                        <span dir="ltr" className={`inline-flex items-baseline gap-0.5 font-english text-sm ${t.type.includes("بيع") ? "text-[#0B1A47]" : "text-[#349FC4]"}`} style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem", fontWeight: 500 }}>{CUR}</span>
                          {t.total.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stock Movements Tab ── */}
      {activeTab === "movements" && !isService && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">حركات المخزون</CardTitle>
            <CardDescription className="text-[#9CA3AF]" style={{ fontSize: "12px" }}>سجل الوارد والصادر والتحويلات</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "700px", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "130px" }} />
                  <col />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "80px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>النوع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المرجع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المستودع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الكمية</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                      <td className="py-3.5 pe-3"><span className="font-english text-sm text-[#6B7280]">{m.date}</span></td>
                      <td className="py-3.5 pe-3">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] border ${m.type === "وارد" ? "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20" : m.type === "صادر" ? "bg-[#E4F4F9] text-[#2A7F9E] border-[#349FC4]/20" : "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]"}`} style={{ fontWeight: 600 }}>
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3.5 pe-3">
                        <Link to={m.reference.startsWith("INV") ? "/invoices" : m.reference.startsWith("BILL") ? "/purchases/bills" : "#"} className="font-english text-sm text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{m.reference}</Link>
                      </td>
                      <td className="py-3.5 pe-3"><span className="text-sm text-[#6B7280]">{m.warehouse}</span></td>
                      <td className="py-3.5 pe-3">
                        <span className={`font-english text-sm ${m.qty > 0 ? "text-[#0B1A47]" : "text-[#349FC4]"}`} style={{ fontWeight: 600 }}>
                          {m.qty > 0 ? `+${m.qty}` : m.qty}
                        </span>
                      </td>
                      <td className="py-3.5 pe-3"><span className="font-english text-sm text-[#374151]" style={{ fontWeight: 500 }}>{m.balance}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Helper ── */
function DetailRow({ icon: Icon, label, value, isEnglish }: { icon: React.ElementType; label: string; value: string; isEnglish?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
      <div className="flex items-center gap-2 text-sm text-[#6B7280]"><Icon className="h-4 w-4" /> {label}</div>
      <span className={`text-sm text-[#374151] ${isEnglish ? "font-english" : ""}`} style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
