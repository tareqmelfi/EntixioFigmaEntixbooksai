import { useEffect, useState, useCallback } from "react";
import { Edit2, ImagePlus, Package, Plus, Trash2, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
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
};

export function Products() {
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  const [, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.products.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    try {
      setLocalImages(JSON.parse(localStorage.getItem(IMAGE_STORE_KEY) || "{}"));
    } catch {
      setLocalImages({});
    }
  }, []);

  const saveLocalImage = (id: string, imageUrl: string) => {
    setLocalImages((prev) => {
      const next = { ...prev };
      if (imageUrl) next[id] = imageUrl;
      else delete next[id];
      try {
        localStorage.setItem(IMAGE_STORE_KEY, JSON.stringify(next));
      } catch {
        push("error", t("تم حفظ الصنف، لكن الصورة كبيرة ولم تحفظ محلياً", "Item saved, but the image was too large to keep locally"));
      }
      return next;
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      sku: item.sku || "",
      name: item.name || "",
      nameAr: item.nameAr || "",
      description: item.description || "",
      category: item.category || "",
      imageUrl: item.imageUrl || localImages[item.id] || "",
      type: item.type || "SERVICE",
      unitPrice: String(item.unitPrice ?? ""),
      costPrice: String(item.costPrice ?? "0"),
    });
    setError(null);
    setOpen(true);
  };

  const handleImageFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("اختر ملف صورة فقط", "Please choose an image file only"));
      return;
    }
    if (file.size > 1_500_000) {
      setError(t("الصورة كبيرة. استخدم صورة أقل من 1.5MB الآن", "Image too large. Use an image under 1.5MB"));
      return;
    }
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
      };
      const p = editingId ? await api.products.update(editingId, payload) : await api.products.create(payload);
      setItems(prev => editingId ? prev.map(x => x.id === editingId ? p : x) : [...prev, p]);
      saveLocalImage(p.id, form.imageUrl);
      setOpen(false); setEditingId(null); setForm(EMPTY_FORM);
      push("success", editingId ? t("تم تحديث الصنف", "Item updated") : t("تم إنشاء الصنف", "Item created"));
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed")); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(id);
    try { await api.products.remove(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
    finally { setPendingDelete(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المنتجات والخدمات", "Products & Services")}</h1><p className="text-muted-foreground mt-1">{t("إدارة المنتجات والخدمات والأصناف المخزنية", "Manage products, services and inventory items")}</p></div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t("صنف جديد", "New Item")}</Button>
      </div>
      <Card className="border-border"><CardHeader><CardTitle>{t("القائمة", "List")} · {items.length}</CardTitle></CardHeader><CardContent>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         items.length === 0 ? <div className="py-12 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد منتجات", "No products")}</p></div> :
        (<div className="overflow-x-auto"><table className="w-full min-w-[820px] table-fixed">
          <colgroup>
            <col className="w-[72px]" />
            <col className="w-[170px]" />
            <col />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[110px]" />
          </colgroup>
          <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الصورة", "Image")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>SKU</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("النوع", "Type")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("السعر", "Price")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}></th>
          </tr></thead><tbody>
            {items.map(p => {
              const imageUrl = p.imageUrl || localImages[p.id];
              return <tr key={p.id} className="border-b border-border/50 hover:bg-primary/5">
              <td className="py-3 px-4">
                <div className="h-9 w-9 overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
                  {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground/60" />}
                </div>
              </td>
              <td className="py-3 px-4 font-english text-sm text-muted-foreground truncate" dir="ltr">{p.sku || "—"}</td>
              <td className="py-3 px-4 text-sm text-foreground truncate" title={p.nameAr || p.name}>{p.nameAr || p.name}</td>
              <td className="py-3 px-4 text-xs"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">{p.type === "SERVICE" ? t("خدمة", "Service") : p.type === "GOOD" ? t("بضاعة", "Good") : p.type === "INVENTORY" ? t("مخزون", "Inventory") : t("آخر", "Other")}</span></td>
              <td className="py-3 px-4 font-english text-sm" style={{ fontWeight: 600 }}>{Number(p.unitPrice).toLocaleString()}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-primary hover:bg-blue-50" title={t("تعديل", "Edit")}><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>;
            })}
          </tbody></table></div>)}
      </CardContent></Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-foreground text-lg font-semibold">{editingId ? t("تعديل صنف", "Edit Item") : t("صنف جديد", "New Item")}</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-2">
              <Label>{t("صورة المنتج", "Product image")}</Label>
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center">
                  {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground/60" />}
                </div>
                <div className="flex-1 space-y-2">
                  <input id="product-image-upload" type="file" accept="image/*" hidden onChange={(e) => handleImageFile(e.target.files?.[0])} />
                  <div className="flex flex-wrap gap-2">
                    <label htmlFor="product-image-upload" className="cursor-pointer rounded-md border border-[#1276E3] px-3 py-2 text-xs text-primary hover:bg-blue-50">{t("اختيار صورة", "Choose image")}</label>
                    {form.imageUrl && <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"><X className="inline h-3.5 w-3.5 me-1" />{t("إزالة", "Remove")}</button>}
                  </div>
                  <Input value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder={t("أو ألصق رابط الصورة", "Or paste image URL")} dir="ltr" className="font-english text-xs" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("النوع", "Type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICE">{t("خدمة", "Service")}</SelectItem>
                    <SelectItem value="GOOD">{t("بضاعة", "Good")}</SelectItem>
                    <SelectItem value="INVENTORY">{t("مخزون", "Inventory")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>{t("الاسم بالإنجليزية", "Name (English)")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("الاسم بالعربية", "Name (Arabic)")}</Label><Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("التصنيف", "Category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} dir="ltr" className="font-english" placeholder="AI / CLD / BRD" /></div>
              <div className="space-y-2"><Label>{t("الوصف", "Description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("وصف مختصر يظهر في الفواتير", "Short description shown on invoices")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("سعر البيع", "Sale price")} *</Label><Input type="number" step="0.01" min="0" required value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("سعر التكلفة", "Cost price")}</Label><Input type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("إلغاء", "Cancel")}</Button><Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? "..." : editingId ? t("تحديث", "Update") : t("حفظ", "Save")}</Button></div>
          </form>
        </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
