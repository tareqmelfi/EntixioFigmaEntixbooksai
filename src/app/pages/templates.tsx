import { useEffect, useState, useCallback } from "react";
import {
  FileText, Plus, Search, Eye, Copy, Edit2, Trash2, Loader2,
  Receipt, FileSpreadsheet, CreditCard, ScrollText, Star, X, Printer,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

// ── Types & catalogs ──
type DocType = "INVOICE" | "QUOTE" | "RECEIPT_VOUCHER" | "PAYMENT_VOUCHER" | "CREDIT_NOTE";
type Layout = "classic" | "modern" | "minimal";

const TYPE_META: Record<DocType, { ar: string; en: string; icon: React.ElementType; color: string; bg: string }> = {
  INVOICE: { ar: "فاتورة بيع", en: "Sales Invoice", icon: FileText, color: "#0B1B49", bg: "#ECEEF5" },
  QUOTE: { ar: "عرض سعر", en: "Quotation", icon: FileSpreadsheet, color: "#7C3AED", bg: "#F3E8FF" },
  RECEIPT_VOUCHER: { ar: "سند قبض", en: "Receipt Voucher", icon: Receipt, color: "#166534", bg: "#DCFCE7" },
  PAYMENT_VOUCHER: { ar: "سند صرف", en: "Payment Voucher", icon: CreditCard, color: "#B45309", bg: "#FEF3C7" },
  CREDIT_NOTE: { ar: "إشعار دائن", en: "Credit Note", icon: ScrollText, color: "#1276E3", bg: "#EFF6FF" },
};
const LAYOUT_META: Record<Layout, { ar: string; en: string; hintAr: string; hintEn: string }> = {
  classic: { ar: "كلاسيكي", en: "Classic", hintAr: "جدول مؤطر وترويسة تقليدية", hintEn: "Framed table, traditional header" },
  modern: { ar: "حديث", en: "Modern", hintAr: "ترويسة ملوّنة جريئة ومساحات واسعة", hintEn: "Bold colored header, airy spacing" },
  minimal: { ar: "مبسّط", en: "Minimal", hintAr: "نظيف وخفيف للمبيعات الصغيرة", hintEn: "Clean and light for small sales" },
};

const EMPTY_FORM = {
  name: "", nameEn: "", type: "INVOICE" as DocType, layout: "classic" as Layout,
  isDefault: false, primaryColor: "#0B1B49", accentColor: "#1276E3",
  showLogo: true, showTaxBreakdown: true, showTerms: true, terms: "", notes: "",
};

// ── Live preview · renders a sample document with the template config ──
function TemplatePreview({ tpl, language }: { tpl: any; language: string }) {
  const isAr = language === "ar";
  const meta = TYPE_META[tpl.type as DocType] || TYPE_META.INVOICE;
  const rows = [
    { desc: isAr ? "خدمات استشارية — مارس" : "Consulting services — March", qty: 2, price: 3500 },
    { desc: isAr ? "تصميم هوية فرعية" : "Sub-brand design", qty: 1, price: 4200 },
    { desc: isAr ? "دعم فني شهري" : "Monthly technical support", qty: 3, price: 750 },
  ];
  const subtotal = rows.reduce((s, r) => s + r.qty * r.price, 0);
  const tax = tpl.showTaxBreakdown ? subtotal * 0.15 : 0;
  const total = subtotal + tax;
  const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isModern = tpl.layout === "modern";
  const isMinimal = tpl.layout === "minimal";

  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden" dir={isAr ? "rtl" : "ltr"} style={{ fontFamily: "inherit" }}>
      {/* header */}
      <div className={isModern ? "px-6 py-5 text-white" : "px-6 py-5 border-b"} style={isModern ? { background: `linear-gradient(135deg, ${tpl.primaryColor}, ${tpl.accentColor})` } : { borderColor: "#e5e7eb" }}>
        <div className="flex items-start justify-between">
          <div>
            {tpl.showLogo && (
              <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${isModern ? "bg-white/20 text-white" : "text-white"}`} style={!isModern ? { background: tpl.primaryColor } : {}}>EN</div>
            )}
            <div className={`text-base font-bold ${isModern ? "text-white" : ""}`} style={!isModern ? { color: tpl.primaryColor } : {}}>{isAr ? "شركتي القابضة" : "My Holding Co."}</div>
            <div className={`text-[11px] ${isModern ? "text-white/80" : "text-slate-500"}`}>{isAr ? "الرياض · السعودية · ر.ض 300123456700003" : "Riyadh · KSA · VAT 300123456700003"}</div>
          </div>
          <div className="text-end">
            <div className={`text-lg font-bold ${isModern ? "text-white" : ""}`} style={!isModern ? { color: tpl.accentColor } : {}}>{isAr ? meta.ar : meta.en}</div>
            <div className={`text-[11px] font-english ${isModern ? "text-white/80" : "text-slate-500"}`} dir="ltr">INV-2026-0042 · 2026-03-15</div>
          </div>
        </div>
      </div>

      {/* parties */}
      {!isMinimal && (
        <div className="px-6 py-3 flex gap-6 text-[12px] border-b border-slate-100">
          <div><span className="text-slate-400">{isAr ? "إلى:" : "To:"}</span> <span className="font-semibold text-slate-700">{isAr ? "شركة العميل المتحد" : "United Client Co."}</span></div>
          <div><span className="text-slate-400">{isAr ? "الاستحقاق:" : "Due:"}</span> <span className="font-english" dir="ltr">2026-04-14</span></div>
        </div>
      )}

      {/* lines */}
      <div className="px-6 py-3">
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: isMinimal ? "transparent" : `${tpl.primaryColor}0F` }} className={isMinimal ? "border-b-2" : ""}>
              <th className="py-1.5 px-2 text-start font-semibold" style={{ color: tpl.primaryColor }}>{isAr ? "البند" : "Item"}</th>
              <th className="py-1.5 px-2 text-end font-semibold font-english" style={{ color: tpl.primaryColor }}>{isAr ? "كمية" : "Qty"}</th>
              <th className="py-1.5 px-2 text-end font-semibold font-english" style={{ color: tpl.primaryColor }}>{isAr ? "سعر" : "Price"}</th>
              <th className="py-1.5 px-2 text-end font-semibold font-english" style={{ color: tpl.primaryColor }}>{isAr ? "إجمالي" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-1.5 px-2 text-slate-700">{r.desc}</td>
                <td className="py-1.5 px-2 text-end font-english text-slate-600">{r.qty}</td>
                <td className="py-1.5 px-2 text-end font-english text-slate-600">{money(r.price)}</td>
                <td className="py-1.5 px-2 text-end font-english font-semibold text-slate-800">{money(r.qty * r.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-3 flex justify-end">
          <div className="w-48 space-y-1 text-[12px]">
            <div className="flex justify-between text-slate-600"><span>{isAr ? "الإجمالي الفرعي" : "Subtotal"}</span><span className="font-english">{money(subtotal)}</span></div>
            {tpl.showTaxBreakdown && (
              <div className="flex justify-between text-slate-600"><span>{isAr ? "ض.ق.م (15%)" : "VAT (15%)"}</span><span className="font-english">{money(tax)}</span></div>
            )}
            <div className="flex justify-between pt-1 border-t font-bold" style={{ color: tpl.primaryColor }}>
              <span>{isAr ? "الإجمالي" : "Total"}</span><span className="font-english">{money(total)} {isAr ? "ر.س" : "SAR"}</span>
            </div>
          </div>
        </div>

        {/* terms */}
        {tpl.showTerms && tpl.terms && (
          <div className="mt-4 pt-3 border-t border-dashed text-[11px] text-slate-500 leading-5">
            <span className="font-semibold" style={{ color: tpl.accentColor }}>{isAr ? "الشروط: " : "Terms: "}</span>{tpl.terms}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──
export function Templates() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "">("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewTpl, setPreviewTpl] = useState<any | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.documentTemplates.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const openCreate = (type?: DocType) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, type: type || "INVOICE" });
    setError(null);
    setOpen(true);
  };

  const openEdit = (tpl: any) => {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name || "", nameEn: tpl.nameEn || "", type: tpl.type, layout: tpl.layout,
      isDefault: tpl.isDefault, primaryColor: tpl.primaryColor, accentColor: tpl.accentColor,
      showLogo: tpl.showLogo, showTaxBreakdown: tpl.showTaxBreakdown, showTerms: tpl.showTerms,
      terms: tpl.terms || "", notes: tpl.notes || "",
    });
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("اسم القالب مطلوب", "Template name is required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(), nameEn: form.nameEn || null, type: form.type, layout: form.layout,
        isDefault: form.isDefault, primaryColor: form.primaryColor, accentColor: form.accentColor,
        showLogo: form.showLogo, showTaxBreakdown: form.showTaxBreakdown, showTerms: form.showTerms,
        terms: form.terms || null, notes: form.notes || null,
      };
      const saved = editingId ? await api.documentTemplates.update(editingId, payload) : await api.documentTemplates.create(payload);
      push("success", editingId ? t("تم تحديث القالب", "Template updated") : t("تم إنشاء القالب", "Template created"));
      if (saved.isDefault) setItems(prev => prev.map(x => x.type === saved.type && x.id !== saved.id ? { ...x, isDefault: false } : x));
      setItems(prev => editingId ? prev.map(x => x.id === editingId ? saved : x) : [saved, ...prev]);
      setOpen(false);
      setEditingId(null);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed")); }
    finally { setBusy(false); }
  };

  const handleSetDefault = async (tpl: any) => {
    try {
      await api.documentTemplates.setDefault(tpl.id);
      setItems(prev => prev.map(x => x.type === tpl.type ? { ...x, isDefault: x.id === tpl.id } : x));
      push("success", t("تم تعيينه افتراضياً لنوعه", "Set as default for its type"));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
  };

  const handleDuplicate = async (tpl: any) => {
    try {
      const copy = await api.documentTemplates.duplicate(tpl.id);
      setItems(prev => [copy, ...prev]);
      push("success", t("تم نسخ القالب", "Template duplicated"));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل النسخ", "Duplicate failed")); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try { await api.documentTemplates.remove(id); setItems(prev => prev.filter(x => x.id !== id)); push("success", t("تم حذف القالب", "Template deleted")); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  const filtered = items.filter(tpl => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || tpl.name.toLowerCase().includes(q) || (tpl.nameEn || "").toLowerCase().includes(q);
    const matchT = !typeFilter || tpl.type === typeFilter;
    return matchQ && matchT;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("القوالب", "Templates")}</h1>
          <p className="text-muted-foreground mt-1">{t("قوالب طباعة الفواتير والسندات والإشعارات — القالب الافتراضي يُستخدم فوراً في الطباعة", "Print templates for invoices, vouchers and notes — the default template is used immediately when printing")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => openCreate()}><Plus className="me-2 h-4 w-4" />{t("قالب جديد", "New Template")}</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input placeholder={t("بحث في القوالب...", "Search templates...")} className="ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setTypeFilter("")} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${!typeFilter ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-[#E5E7EB]"}`} style={{ fontWeight: 600 }}>{t("الكل", "All")}</button>
          {(Object.keys(TYPE_META) as DocType[]).map(k => (
            <button key={k} onClick={() => setTypeFilter(k)} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${typeFilter === k ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-[#E5E7EB]"}`} style={{ fontWeight: 600 }}>{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="h-7 w-7 animate-spin mx-auto text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-border"><CardContent className="py-14 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{items.length === 0 ? t("لا توجد قوالب بعد — أنشئ أول قالب لشركتك", "No templates yet — create your company's first template") : t("لا نتائج مطابقة", "No matching results")}</p>
          {items.length === 0 && (
            <div className="mt-4 flex justify-center gap-2 flex-wrap">
              {(Object.keys(TYPE_META) as DocType[]).map(k => (
                <Button key={k} variant="outline" size="sm" onClick={() => openCreate(k)} className="border-border text-primary"><Plus className="me-1 h-3.5 w-3.5" />{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</Button>
              ))}
            </div>
          )}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => {
            const meta = TYPE_META[tpl.type as DocType] || TYPE_META.INVOICE;
            const Icon = meta.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
            return (
              <Card key={tpl.id} className="border-border hover:shadow-md hover:border-[#1276E3]/30 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl p-2.5" style={{ backgroundColor: meta.bg }}><Icon className="h-5 w-5" style={{ color: meta.color }} /></div>
                      <div>
                        <div className="text-foreground" style={{ fontWeight: 600 }}>{isAr ? tpl.name : (tpl.nameEn || tpl.name)}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{isAr ? meta.ar : meta.en} · {isAr ? LAYOUT_META[tpl.layout as Layout]?.ar : LAYOUT_META[tpl.layout as Layout]?.en}</span>
                          {tpl.isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECEEF5] px-2 py-0.5 text-[10px] text-foreground" style={{ fontWeight: 600 }}><Star className="h-2.5 w-2.5 fill-current" />{t("افتراضي", "Default")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <span className="h-4 w-4 rounded-full border border-border" style={{ background: tpl.primaryColor }} title={tpl.primaryColor} />
                      <span className="h-4 w-4 rounded-full border border-border" style={{ background: tpl.accentColor }} title={tpl.accentColor} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground/60 font-english">{(tpl.updatedAt || "").slice(0, 10)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setPreviewTpl(tpl)} className="rounded-md p-1.5 text-primary hover:bg-blue-50 transition-colors" title={t("معاينة حية", "Live preview")}><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => openEdit(tpl)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("تعديل", "Edit")}><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDuplicate(tpl)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("نسخ", "Duplicate")}><Copy className="h-3.5 w-3.5" /></button>
                      {!tpl.isDefault && (
                        <button onClick={() => handleSetDefault(tpl)} className="rounded-md p-1.5 text-amber-500 hover:bg-amber-50 transition-colors" title={t("تعيين كافتراضي", "Set as default")}><Star className="h-3.5 w-3.5" /></button>
                      )}
                      {pendingDelete === tpl.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(tpl.id)} onCancel={() => setPendingDelete(null)} />
                      ) : (
                        <button onClick={() => setPendingDelete(tpl.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50 transition-colors" title={t("حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / edit */}
      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-foreground text-lg font-semibold">{editingId ? t("تعديل قالب", "Edit Template") : t("قالب جديد", "New Template")}</h2></div>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t("الاسم (عربي)", "Name (Arabic)")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("فاتورة مبيعات - كلاسيك", "Sales invoice - Classic")} /></div>
            <div className="space-y-2"><Label>{t("الاسم (إنجليزي)", "Name (English)")}</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" className="font-english" placeholder="Sales Invoice - Classic" /></div>
          </div>

          <div className="space-y-2">
            <Label>{t("نوع المستند", "Document type")}</Label>
            <div className="flex gap-1 flex-wrap rounded-lg bg-muted/50 p-1" role="radiogroup">
              {(Object.keys(TYPE_META) as DocType[]).map(k => (
                <button key={k} type="button" role="radio" aria-checked={form.type === k} onClick={() => setForm({ ...form, type: k })}
                  className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${form.type === k ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  style={{ fontWeight: form.type === k ? 700 : 500 }}>{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("التصميم", "Layout")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(LAYOUT_META) as Layout[]).map(k => (
                <button key={k} type="button" role="radio" aria-checked={form.layout === k} onClick={() => setForm({ ...form, layout: k })}
                  className={`rounded-lg border p-2.5 text-start transition-colors ${form.layout === k ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"}`}>
                  <div className="text-xs" style={{ fontWeight: 700, color: form.layout === k ? "#1276E3" : "inherit" }}>{isAr ? LAYOUT_META[k].ar : LAYOUT_META[k].en}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-4">{isAr ? LAYOUT_META[k].hintAr : LAYOUT_META[k].hintEn}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t("اللون الأساسي", "Primary color")}</Label><input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-white p-1" /></div>
            <div className="space-y-2"><Label>{t("لون التمييز", "Accent color")}</Label><input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-white p-1" /></div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            {([
              ["showLogo", t("إظهار الشعار", "Show logo")],
              ["showTaxBreakdown", t("إظهار تفصيل الضريبة", "Show VAT breakdown")],
              ["showTerms", t("إظهار الشروط", "Show terms")],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer">
                <span>{label}</span>
                <input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked } as any)} className="h-4 w-4 accent-[#1276E3]" />
              </label>
            ))}
            <label className="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer border-t border-border/50 mt-1 pt-2">
              <span style={{ fontWeight: 600 }}>{t("افتراضي لهذا النوع", "Default for this type")}</span>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="h-4 w-4 accent-[#1276E3]" />
            </label>
          </div>

          {form.showTerms && (
            <div className="space-y-2"><Label>{t("الشروط والأحكام (تُطبع أسفل المستند)", "Terms & conditions (printed at the bottom)")}</Label>
              <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30 outline-none" placeholder={t("الدفع خلال 30 يوماً من تاريخ الفاتورة...", "Payment due within 30 days of invoice date...")} />
            </div>
          )}

          {/* live mini preview while editing */}
          <div className="space-y-2">
            <Label>{t("معاينة حية", "Live preview")}</Label>
            <div className="rounded-lg bg-slate-100 p-3">
              <TemplatePreview tpl={{ ...form, name: form.name || "—" }} language={language} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? "..." : editingId ? t("تحديث", "Update") : t("حفظ", "Save")}</Button>
          </div>
        </form>
      </SidePanel>

      {/* Full preview modal */}
      {previewTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewTpl(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="text-sm" style={{ fontWeight: 700 }}>{isAr ? previewTpl.name : (previewTpl.nameEn || previewTpl.name)} · {t("معاينة", "Preview")}</div>
              <div className="flex gap-1">
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title={t("طباعة", "Print")} onClick={() => window.print()}><Printer className="h-4 w-4" /></button>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" onClick={() => setPreviewTpl(null)}><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="p-5 bg-slate-100"><TemplatePreview tpl={previewTpl} language={language} /></div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
