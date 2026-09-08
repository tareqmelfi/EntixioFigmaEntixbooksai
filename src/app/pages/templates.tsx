/**
 * Templates gallery — app-wide standard: designing a template happens on the
 * FULL page (/app/templates/new · /app/templates/:id), not a slide-over.
 * The eye button opens a read-only preview INLINE under the gallery (split-view ·
 * UX-1 · 2026-09-08: the brand engine renders the whole document with sample data).
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
import { TYPE_META, LAYOUT_META, type DocType, type Layout } from "../components/template-preview";
import { BrandDocument } from "../components/brand-document";
import { sampleInput, partyFromOrg, type DocKind } from "../lib/document-render";
import { getOrgId, type Org } from "../lib/api";

const KIND_LABEL: Record<string, { ar: string; en: string }> = {
  QUOTE: { ar: "عروض الأسعار", en: "Quotes" },
  INVOICE: { ar: "الفواتير", en: "Invoices" },
  BOTH: { ar: "العروض والفواتير", en: "Quotes + invoices" },
};

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
  const [previewKind, setPreviewKind] = useState<DocKind>("QUOTE");
  const [org, setOrg] = useState<Org | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  useEffect(() => { const oid = getOrgId(); if (oid) api.orgs.get(oid).then(setOrg).catch(() => setOrg(null)); }, []);

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
      // one default per document kind (BOTH covers quotes + invoices) — mirror the server rule
      const kinds = (k: string) => (k === "QUOTE" || k === "INVOICE") ? [k] : ["QUOTE", "INVOICE"];
      const mine = kinds(tpl.kind || "BOTH");
      setItems(prev => prev.map(x => x.id === tpl.id ? { ...x, isDefault: true } : (x.type === tpl.type || kinds(x.kind || "BOTH").some((k) => mine.includes(k))) ? { ...x, isDefault: false } : x));
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
          <h1 className="text-2xl font-bold text-foreground">{t("القوالب", "Templates")}</h1>
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
          <button onClick={() => setTypeFilter("")} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${!typeFilter ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`} style={{ fontWeight: 600 }}>{t("الكل", "All")}</button>
          {(Object.keys(TYPE_META) as DocType[]).map(k => (
            <button key={k} onClick={() => setTypeFilter(k)} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${typeFilter === k ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`} style={{ fontWeight: 600 }}>{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}

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
              <Card key={tpl.id} className="border-border hover:shadow-md hover:border-primary/30 transition-all cursor-pointer" onClick={() => navigate(`/app/templates/${tpl.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-xl p-2.5 shrink-0" style={{ backgroundColor: meta.bg }}><Icon className="h-5 w-5" style={{ color: meta.color }} /></div>
                      <div className="min-w-0">
                        <div className="text-foreground truncate" style={{ fontWeight: 600 }}>{isAr ? tpl.name : (tpl.nameEn || tpl.name)}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{tpl.kind && KIND_LABEL[tpl.kind] ? (isAr ? KIND_LABEL[tpl.kind].ar : KIND_LABEL[tpl.kind].en) : (isAr ? meta.ar : meta.en)} · {tpl.coverStyle === "NONE" ? t("بدون غلاف", "No cover") : tpl.coverStyle === "LIGHT" ? t("غلاف فاتح", "Light cover") : tpl.kind ? t("غلاف داكن", "Dark cover") : (isAr ? LAYOUT_META[tpl.layout as Layout]?.ar : LAYOUT_META[tpl.layout as Layout]?.en)}</span>
                          {tpl.isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground" style={{ fontWeight: 600 }}><Star className="h-2.5 w-2.5 fill-current" />{t("افتراضي", "Default")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <span className="h-4 w-4 rounded-full border border-border" style={{ background: tpl.coverColor || tpl.primaryColor }} title={tpl.coverColor || tpl.primaryColor} />
                      <span className="h-4 w-4 rounded-full border border-border" style={{ background: tpl.brandColor || tpl.accentColor }} title={tpl.brandColor || tpl.accentColor} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground/60 font-english">{(tpl.updatedAt || "").slice(0, 10)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setPreviewTpl(tpl); setPreviewKind(tpl.kind === "INVOICE" ? "INVOICE" : "QUOTE"); }} className="rounded-md p-1.5 text-primary hover:bg-info-subtle transition-colors" title={t("معاينة حية", "Live preview")}><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => navigate(`/app/templates/${tpl.id}`)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("تعديل", "Edit")}><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDuplicate(tpl)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("نسخ", "Duplicate")}><Copy className="h-3.5 w-3.5" /></button>
                      {!tpl.isDefault && (
                        <button onClick={() => handleSetDefault(tpl)} className="rounded-md p-1.5 text-warning hover:bg-warning-subtle transition-colors" title={t("تعيين كافتراضي", "Set as default")}><Star className="h-3.5 w-3.5" /></button>
                      )}
                      {pendingDelete === tpl.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(tpl.id)} onCancel={() => setPendingDelete(null)} />
                      ) : (
                        <button onClick={() => setPendingDelete(tpl.id)} className="rounded-md p-1.5 text-danger hover:bg-danger-subtle transition-colors" title={t("حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Read-only preview · inline under the gallery (viewer · not a form · UX-1) */}
      {previewTpl && (
        <section className="rounded-lg border border-border bg-card" data-testid="template-inline-preview" aria-label={t("معاينة القالب", "Template preview")}>
          <div className="flex items-center justify-between gap-2 flex-wrap px-5 py-3 border-b border-border">
            <div className="text-sm" style={{ fontWeight: 700 }}>{isAr ? previewTpl.name : (previewTpl.nameEn || previewTpl.name)} · {t("معاينة", "Preview")}</div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg bg-muted/50 p-1" role="radiogroup">
                {(["QUOTE", "INVOICE"] as DocKind[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={previewKind === k} onClick={() => setPreviewKind(k)} className={`rounded-md px-2.5 py-1 text-xs ${previewKind === k ? "bg-card text-primary shadow-sm font-semibold" : "text-muted-foreground"}`}>{k === "QUOTE" ? t("عرض سعر", "Quote") : t("فاتورة", "Invoice")}</button>
                ))}
              </div>
              <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title={t("فتح في المصمم", "Open in designer")} onClick={() => navigate(`/app/templates/${previewTpl.id}`)}><Edit2 className="h-4 w-4" /></button>
              <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title={t("طباعة", "Print")} onClick={() => window.print()}><Printer className="h-4 w-4" /></button>
              <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" onClick={() => setPreviewTpl(null)} aria-label={t("إغلاق المعاينة", "Close preview")}><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="p-5 bg-surface-hover max-h-[80vh] overflow-y-auto">
            <BrandDocument input={sampleInput(previewKind, language === "ar" ? "ar" : "en", previewTpl, org ? partyFromOrg(org) : null)} scaleToFit />
          </div>
        </section>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
