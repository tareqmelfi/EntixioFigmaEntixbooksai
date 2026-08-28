/**
 * Products & Services — LIST page.
 * Create/edit happens on the item's OWN full page (/app/products/new or
 * /app/products/:id) — the app-wide standard like invoices, no slide-overs.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Loader2, Package, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const IMAGE_STORE_KEY = "entix_product_images_v1";

export function Products() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const { toasts, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localImages, setLocalImages] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.products.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    try {
      setLocalImages(JSON.parse(localStorage.getItem(IMAGE_STORE_KEY) || "{}"));
    } catch {
      setLocalImages({});
    }
  }, []);

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المنتجات والخدمات", "Products & Services")}</h1>
          <p className="text-muted-foreground mt-1">{t("كل صنف مربوط بحسابه المحاسبي · اضغط أي صنف لفتحه وتعديله", "Every item is linked to its accounts · click any item to open and edit it")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/products/new")}>
          <Plus className="me-2 h-4 w-4" />{t("صنف جديد", "New Item")}
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle>{t("القائمة", "List")} · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground">{t("لا توجد منتجات بعد — سجّل أول خدمة أو منتج", "No products yet — register your first service or product")}</p>
              <Button className="bg-primary hover:bg-primary/90 mt-4" onClick={() => navigate("/app/products/new")}>
                <Plus className="me-2 h-4 w-4" />{t("صنف جديد", "New Item")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] table-fixed">
                <colgroup>
                  <col className="w-[72px]" />
                  <col className="w-[150px]" />
                  <col />
                  <col className="w-[110px]" />
                  <col className="w-[130px]" />
                  <col className="w-[200px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الصورة", "Image")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>SKU</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("النوع", "Type")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("السعر", "Price")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("حساب الإيراد", "Income acct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const imageUrl = p.imageUrl || localImages[p.id];
                    return (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/app/products/${p.id}`)}
                        className="border-b border-border/50 hover:bg-primary/5 cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="h-9 w-9 overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
                            {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground/60" />}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-english text-sm text-muted-foreground truncate" dir="ltr">{p.sku || "—"}</td>
                        <td className="py-3 px-4 text-sm text-foreground truncate" title={p.nameAr || p.name}>{p.nameAr || p.name}</td>
                        <td className="py-3 px-4 text-xs">
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            {p.type === "SERVICE" ? t("خدمة", "Service") : p.type === "GOOD" ? t("بضاعة", "Good") : p.type === "INVENTORY" ? t("مخزون", "Inventory") : t("آخر", "Other")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-start"><span dir="ltr" className="font-english text-sm whitespace-nowrap" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{Number(p.unitPrice).toLocaleString()}</span></td>
                        <td className="py-3 px-4 text-xs truncate" dir="ltr">
                          {p.incomeAccountId
                            ? <span className="font-english text-emerald-700">{t("مربوط", "linked")} ✓</span>
                            : <span className="text-amber-600">{t("غير مربوط", "not linked")}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
