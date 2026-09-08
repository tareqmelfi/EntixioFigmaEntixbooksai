/**
 * Templates gallery — app-wide standard: designing a template happens on the
 * FULL page (/app/templates/new · /app/templates/:id), not a slide-over.
 * The eye button opens a read-only preview overlay (lightbox), which is kept.
 */
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Plus, Eye, Copy, Edit2, Trash2, Loader2, Star, X, Printer,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { EmptyState, InlineAlert, PageHeader, SearchField, StatusBadge } from "../components/product";
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
      <PageHeader
        eyebrow={t("الإعدادات", "Settings")}
        title={t("القوالب", "Templates")}
        description={t("قوالب طباعة الفواتير والسندات والإشعارات — القالب الافتراضي يُستخدم فوراً في الطباعة", "Print templates for invoices, vouchers and notes — the default template is used immediately when printing")}
        actions={<Button onClick={() => navigate("/app/templates/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("قالب جديد", "New Template")}</Button>}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <SearchField containerClassName="max-w-sm" placeholder={t("بحث في القوالب...", "Search templates...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label={t("بحث", "Search")} />
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTypeFilter("")} aria-pressed={!typeFilter} className={`rounded-full px-3.5 py-[7px] text-[13px] leading-5 transition-colors ${!typeFilter ? "bg-foreground text-background" : "border border-border bg-card text-content-secondary hover:border-border-strong"}`}>{t("الكل", "All")}</button>
          {(Object.keys(TYPE_META) as DocType[]).map(k => (
            <button key={k} onClick={() => setTypeFilter(k)} aria-pressed={typeFilter === k} className={`rounded-full px-3.5 py-[7px] text-[13px] leading-5 transition-colors ${typeFilter === k ? "bg-foreground text-background" : "border border-border bg-card text-content-secondary hover:border-border-strong"}`}>{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</button>
          ))}
        </div>
      </div>

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="h-7 w-7 animate-spin mx-auto text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" strokeWidth={1.5} />}
          title={items.length === 0 ? t("لا توجد قوالب بعد — أنشئ أول قالب لشركتك", "No templates yet — create your company's first template") : t("لا نتائج مطابقة", "No matching results")}
          action={items.length === 0 ? (
            <div className="flex justify-center gap-2 flex-wrap">
              {(Object.keys(TYPE_META) as DocType[]).map(k => (
                <Button key={k} variant="outline" size="sm" onClick={() => navigate(`/app/templates/new?type=${k}`)}><Plus className="me-1 h-3.5 w-3.5" strokeWidth={1.75} />{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</Button>
              ))}
            </div>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tpl) => {
            const meta = TYPE_META[tpl.type as DocType] || TYPE_META.INVOICE;
            const Icon = meta.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
            return (
              <Card key={tpl.id} className="ledger-hoverable min-w-0 cursor-pointer transition" onClick={() => navigate(`/app/templates/${tpl.id}`)} title={t("فتح القالب", "Open template")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-lg border border-border bg-surface-subtle p-2.5"><Icon className="h-5 w-5 text-content-secondary" /></div>
                      <div className="min-w-0">
                        <div className="truncate text-foreground" style={{ fontWeight: 600 }} title={isAr ? tpl.name : (tpl.nameEn || tpl.name)}><bdi dir="auto">{isAr ? tpl.name : (tpl.nameEn || tpl.name)}</bdi></div>
                        <div className="flex min-w-0 flex-wrap items-center gap-2 mt-0.5">
                          <span className="truncate text-xs text-muted-foreground">{isAr ? meta.ar : meta.en} · {isAr ? LAYOUT_META[tpl.layout as Layout]?.ar : LAYOUT_META[tpl.layout as Layout]?.en}</span>
                          {tpl.isDefault && (
                            <StatusBadge tone="info" icon={<Star className="h-2.5 w-2.5 fill-current" />}>{t("افتراضي", "Default")}</StatusBadge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <span className="h-4 w-4 rounded-full border border-border" style={{ background: tpl.primaryColor }} title={tpl.primaryColor} />
                      <span className="h-4 w-4 rounded-full border border-border" style={{ background: tpl.accentColor }} title={tpl.accentColor} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground/60 font-english">{(tpl.updatedAt || "").slice(0, 10)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setPreviewTpl(tpl)} className="rounded-md p-1.5 text-primary hover:bg-info-subtle transition-colors" title={t("معاينة حية", "Live preview")}><Eye className="h-3.5 w-3.5" /></button>
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

      {/* Read-only preview lightbox (kept · it's a viewer, not a form) */}
      {previewTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setPreviewTpl(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card shadow-[var(--elevation-popover)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="text-sm" style={{ fontWeight: 700 }}>{isAr ? previewTpl.name : (previewTpl.nameEn || previewTpl.name)} · {t("معاينة", "Preview")}</div>
              <div className="flex gap-1">
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title={t("طباعة", "Print")} onClick={() => window.print()}><Printer className="h-4 w-4" /></button>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" onClick={() => setPreviewTpl(null)}><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="p-5 bg-surface-hover"><TemplatePreview tpl={previewTpl} language={language} /></div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
