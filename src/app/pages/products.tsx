import { displayLocale } from "../lib/number-display";
/**
 * Products & Services — LIST page.
 * Create/edit happens on the item's OWN full page (/app/products/new or
 * /app/products/:id) — the app-wide standard like invoices, no slide-overs.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2, Package, Plus, Upload } from "lucide-react";
import { EmptyState, InlineAlert, PageHeader, StatusBadge } from "../components/product";
import { Button } from "../components/ui/button";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { SmartImportWizard } from "../components/smart-import-wizard";

const IMAGE_STORE_KEY = "entix_product_images_v1";

export function Products() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  // Smart import (2026-09-08) · the same wizard the chart of accounts uses
  const [importOpen, setImportOpen] = useState(false);
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

  if (importOpen) {
    return (
      <>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
        <SmartImportWizard
          entity="products"
          onClose={() => setImportOpen(false)}
          onImported={(report) => { push(report.ok ? "success" : "error", language === "ar" ? report.message.ar : report.message.en); refresh(); }}
          templateFileName="entix-products-template.xls"
          templateSheetName={t("الأصناف", "Items")}
          templateRows={[
            ["الرمز", "اسم الصنف", "الاسم بالعربية", "النوع", "الفئة", "سعر البيع", "التكلفة", "الكمية"],
            ...items.map((p: any) => [
              p.sku || "", p.name, p.nameAr || "", p.type || "SERVICE", p.category || "",
              Number(p.unitPrice) || 0, Number(p.costPrice) || 0, Number(p.stockQty) || 0,
            ] as Array<string | number>),
          ]}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <PageHeader
        eyebrow={t("المنتجات والمخزون", "Products & inventory")}
        title={t("المنتجات والخدمات", "Products & Services")}
        description={t("كل صنف مربوط بحسابه المحاسبي · اضغط أي صنف لفتحه وتعديله", "Every item is linked to its accounts · click any item to open and edit it")}
        actions={(
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="products-import">
              <Upload className="me-2 h-4 w-4" strokeWidth={1.75} />{t("استيراد ذكي", "Smart Import")}
            </Button>
            <Button onClick={() => navigate("/app/products/new")}>
              <Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("صنف جديد", "New Item")}
            </Button>
          </>
        )}
      />

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{t("القائمة", "List")} · <span className="font-english tabular-nums">{items.length}</span></h2>
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : error ? (
          <InlineAlert tone="critical">{error}</InlineAlert>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Package className="h-10 w-10" strokeWidth={1.5} />}
            title={t("لا توجد منتجات بعد — سجّل أول خدمة أو منتج", "No products yet — register your first service or product")}
            action={(
              <Button onClick={() => navigate("/app/products/new")}>
                <Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("صنف جديد", "New Item")}
              </Button>
            )}
          />
        ) : (
          <div className="ledger-table overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-sm">
              <colgroup>
                <col className="w-[64px]" />
                <col className="w-[170px]" />{/* SKU · mono */}
                <col />{/* الاسم · flexible */}
                <col className="w-[110px]" />
                <col className="w-[150px]" />
                <col className="w-[150px]" />
              </colgroup>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-foreground">
                  <th className="py-3 px-4 text-start font-medium">{t("الصورة", "Image")}</th>
                  <th className="py-3 px-4 text-start font-medium">SKU</th>
                  <th className="py-3 px-4 text-start font-medium">{t("الاسم", "Name")}</th>
                  <th className="py-3 px-4 text-start font-medium">{t("النوع", "Type")}</th>
                  <th className="py-3 px-4 text-end font-medium">{t("السعر", "Price")}</th>
                  <th className="py-3 px-4 text-start font-medium">{t("حساب الإيراد", "Income acct")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const imageUrl = p.imageUrl || localImages[p.id];
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/app/products/${p.id}`)}
                      className="border-b border-border hover:bg-surface-hover cursor-pointer"
                      title={t("فتح الصنف", "Open item")}
                    >
                      <td className="py-3 px-4">
                        <div className="h-9 w-9 overflow-hidden rounded-md border border-border bg-surface-subtle flex items-center justify-center">
                          {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.75} />}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-start">
                        <Link to={`/app/products/${p.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-code text-sm text-foreground hover:underline underline-offset-4" dir="ltr" title={p.sku || ""}>{p.sku || "—"}</Link>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground truncate" title={p.nameAr || p.name}>
                        <Link to={`/app/products/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline underline-offset-4"><bdi dir="auto">{p.nameAr || p.name}</bdi></Link>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <StatusBadge tone="info">
                          {p.type === "SERVICE" ? t("خدمة", "Service") : p.type === "GOOD" ? t("بضاعة", "Good") : p.type === "INVENTORY" ? t("مخزون", "Inventory") : t("آخر", "Other")}
                        </StatusBadge>
                      </td>
                      <td className="py-3 px-4 text-end"><span dir="ltr" className="font-english text-sm whitespace-nowrap tabular-nums" style={{ fontWeight: 600 }}>{Number(p.unitPrice).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></td>
                      <td className="py-3 px-4 text-xs truncate">
                        {p.incomeAccountId
                          ? <span className="inline-flex items-center gap-1.5 text-success"><span className="ledger-dot" aria-hidden="true" />{t("مربوط", "linked")}</span>
                          : <span className="inline-flex items-center gap-1.5 text-warning"><span className="ledger-dot hollow" aria-hidden="true" />{t("غير مربوط", "not linked")}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
