/**
 * Templates gallery — app-wide standard: designing a template happens on the
 * FULL page (/app/templates/new · /app/templates/:id), not a slide-over.
 * The eye button opens a read-only preview overlay (lightbox), which is kept.
 */
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Plus, Search, Eye, Copy, Edit2, Trash2, Loader2, Star, X, Printer,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { TemplatePreview, TYPE_META, LAYOUT_META, type DocType, type Layout } from "../components/template-preview";

export function Templates() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "">("");
  const [previewTpl, setPreviewTpl] = useState<any | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.documentTemplates.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

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
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/templates/new")}><Plus className="me-2 h-4 w-4" />{t("قالب جديد", "New Template")}</Button>
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
                <Button key={k} variant="outline" size="sm" onClick={() => navigate(`/app/templates/new?type=${k}`)} className="border-border text-primary"><Plus className="me-1 h-3.5 w-3.5" />{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</Button>
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
              <Card key={tpl.id} className="border-border hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer" onClick={() => navigate(`/app/templates/${tpl.id}`)}>
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
                  <div className="flex items-center justify-between pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground/60 font-english">{(tpl.updatedAt || "").slice(0, 10)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setPreviewTpl(tpl)} className="rounded-md p-1.5 text-primary hover:bg-blue-50 transition-colors" title={t("معاينة حية", "Live preview")}><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => navigate(`/app/templates/${tpl.id}`)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("تعديل", "Edit")}><Edit2 className="h-3.5 w-3.5" /></button>
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

      {/* Read-only preview lightbox (kept · it's a viewer, not a form) */}
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
