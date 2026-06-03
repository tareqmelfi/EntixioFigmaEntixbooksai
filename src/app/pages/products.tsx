import { useEffect, useState, useCallback } from "react";
import { Edit2, ImagePlus, Package, Plus, Trash2, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";

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
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [localImages, setLocalImages] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.products.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
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
        push("error", "تم حفظ الصنف، لكن الصورة كبيرة ولم تحفظ محلياً");
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
      setError("اختر ملف صورة فقط");
      return;
    }
    if (file.size > 1_500_000) {
      setError("الصورة كبيرة. استخدم صورة أقل من 1.5MB الآن");
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
    if (!form.name || !form.unitPrice) { setError("الاسم والسعر مطلوبان"); return; }
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
      push("success", editingId ? "تم تحديث الصنف" : "تم إنشاء الصنف");
    } catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل الحفظ"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    /* TODO-UX1: was confirm("حذف؟") — replace with InlineConfirm */ 
    try { await api.products.remove(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المنتجات والخدمات</h1><p className="text-[#6B7280] mt-1">إدارة المنتجات والخدمات والأصناف المخزنية</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />صنف جديد</Button>
      </div>
      <Card className="border-[#E5E7EB]"><CardHeader><CardTitle>القائمة · {items.length}</CardTitle></CardHeader><CardContent>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
         items.length === 0 ? <div className="py-12 text-center"><Package className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد منتجات</p></div> :
        (<div className="overflow-x-auto"><table className="w-full min-w-[820px] table-fixed">
          <colgroup>
            <col className="w-[72px]" />
            <col className="w-[170px]" />
            <col />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[110px]" />
          </colgroup>
          <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الصورة</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>SKU</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>النوع</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>السعر</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}></th>
          </tr></thead><tbody>
            {items.map(p => {
              const imageUrl = p.imageUrl || localImages[p.id];
              return <tr key={p.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
              <td className="py-3 px-4">
                <div className="h-9 w-9 overflow-hidden rounded-md border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center">
                  {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-[#9CA3AF]" />}
                </div>
              </td>
              <td className="py-3 px-4 font-english text-sm text-[#6B7280] truncate" dir="ltr">{p.sku || "—"}</td>
              <td className="py-3 px-4 text-sm text-[#0B1B49] truncate" title={p.nameAr || p.name}>{p.nameAr || p.name}</td>
              <td className="py-3 px-4 text-xs"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">{p.type === "SERVICE" ? "خدمة" : p.type === "GOOD" ? "بضاعة" : p.type === "INVENTORY" ? "مخزون" : "آخر"}</span></td>
              <td className="py-3 px-4 font-english text-sm" style={{ fontWeight: 600 }}>{Number(p.unitPrice).toLocaleString()}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-[#1276E3] hover:bg-blue-50" title="تعديل"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title="حذف"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>;
            })}
          </tbody></table></div>)}
      </CardContent></Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-[#0B1B49] text-lg font-semibold">{editingId ? "تعديل صنف" : "صنف جديد"}</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-2">
              <Label>صورة المنتج</Label>
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center">
                  {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-[#9CA3AF]" />}
                </div>
                <div className="flex-1 space-y-2">
                  <input id="product-image-upload" type="file" accept="image/*" hidden onChange={(e) => handleImageFile(e.target.files?.[0])} />
                  <div className="flex flex-wrap gap-2">
                    <label htmlFor="product-image-upload" className="cursor-pointer rounded-md border border-[#1276E3] px-3 py-2 text-xs text-[#1276E3] hover:bg-blue-50">اختيار صورة</label>
                    {form.imageUrl && <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="rounded-md border border-[#E5E7EB] px-3 py-2 text-xs text-[#6B7280] hover:bg-[#F9FAFB]"><X className="inline h-3.5 w-3.5 me-1" />إزالة</button>}
                  </div>
                  <Input value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="أو ألصق رابط الصورة" dir="ltr" className="font-english text-xs" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICE">خدمة</SelectItem>
                    <SelectItem value="GOOD">بضاعة</SelectItem>
                    <SelectItem value="INVENTORY">مخزون</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>الاسم بالإنجليزية *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>الاسم بالعربية</Label><Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>التصنيف</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} dir="ltr" className="font-english" placeholder="AI / CLD / BRD" /></div>
              <div className="space-y-2"><Label>الوصف</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف مختصر يظهر في الفواتير" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>سعر البيع *</Label><Input type="number" step="0.01" min="0" required value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>سعر التكلفة</Label><Input type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#E5E7EB]"><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "..." : editingId ? "تحديث" : "حفظ"}</Button></div>
          </form>
        </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
