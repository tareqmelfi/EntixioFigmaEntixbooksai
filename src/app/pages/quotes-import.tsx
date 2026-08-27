/**
 * BOQ import wizard (SPEC-04) · /app/quotes/import
 * Upload the customer's priced BOQ workbook → per-sheet preview (sheet = section)
 * → tick which lines are included / optional → pick customer + title → create the quote.
 * UX-1: FullPageForm · no dialogs. UX-5: SearchableCombobox with quick-create.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { UploadCloud, Loader2, FileSpreadsheet, ChevronLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { DateInput } from "../components/date-input";
import { FullPageForm } from "../components/full-page-form";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ToastStack, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";
import { api, ApiError, BoqPreview, Contact } from "../lib/api";
import { useEffect } from "react";

type LineState = { included: boolean; isOptional: boolean };

export function QuotesImport() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();

  const [preview, setPreview] = useState<BoqPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  // key: `${sheetIdx}:${lineIdx}` → state (headings excluded)
  const [lineState, setLineState] = useState<Record<string, LineState>>({});
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [form, setForm] = useState({
    contactId: "",
    title: "",
    issueDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    vat: true,
  });

  useEffect(() => {
    api.contacts.list({ limit: 200 }).then((r) => setCustomers(r.items.filter((c) => c.type === "CUSTOMER" || c.type === "BOTH"))).catch(() => {});
  }, []);

  const upload = async (f: File) => {
    setBusy(true); setErr(null);
    try {
      const p = await api.quotes.importBoq(f);
      setPreview(p);
      setActiveSheet(0);
      const init: Record<string, LineState> = {};
      p.sheets.forEach((s, si) => s.lines.forEach((l, li) => { if (!l.isHeading) init[`${si}:${li}`] = { included: true, isOptional: false }; }));
      setLineState(init);
      if (!form.title) setForm((fm) => ({ ...fm, title: f.name.replace(/\.(xlsx|xls|csv)$/i, "") }));
      if (p.warnings.length) p.warnings.forEach((w) => push("info", w));
    } catch (e: any) {
      setErr(e instanceof ApiError ? e.message : t("فشل قراءة الملف", "Failed to read the file"));
    } finally { setBusy(false); }
  };

  const stats = useMemo(() => {
    if (!preview) return { count: 0, total: 0, optional: 0 };
    let count = 0, total = 0, optional = 0;
    preview.sheets.forEach((s, si) => s.lines.forEach((l, li) => {
      if (l.isHeading) return;
      const st = lineState[`${si}:${li}`];
      const amount = l.subtotal ?? (l.qty ?? 0) * (l.unitPrice ?? 0);
      if (st?.included) { count++; total += amount; } else if (st?.isOptional) optional++;
    }));
    return { count, total, optional };
  }, [preview, lineState]);

  const createQuote = async () => {
    if (!preview) return;
    if (!form.contactId) { setErr(t("اختر العميل (الجهة المرسلة للـ BOQ)", "Select the customer")); return; }
    const lines: any[] = [];
    let sort = 0;
    preview.sheets.forEach((s, si) => s.lines.forEach((l, li) => {
      if (l.isHeading) return;
      const st = lineState[`${si}:${li}`];
      if (!st) return;
      if (!st.included && !st.isOptional) return; // dropped entirely
      const qty = l.qty ?? 1;
      const unitPrice = l.unitPrice ?? (l.subtotal != null && qty ? l.subtotal / qty : 0);
      if (!l.description.trim() || (!unitPrice && !l.subtotal)) return;
      lines.push({
        description: l.description,
        quantity: qty || 1,
        unitPrice,
        sectionLabel: s.name,
        unit: l.unit,
        isOptional: st.isOptional,
        included: st.included,
        sortOrder: sort++,
      });
    }));
    if (!lines.length) { setErr(t("لا توجد بنود مسعّرة محددة", "No priced lines selected")); return; }
    setBusy(true); setErr(null);
    try {
      const q = await api.quotes.create({
        contactId: form.contactId,
        issueDate: form.issueDate,
        validUntil: form.validUntil,
        title: form.title || null,
        sourceFileName: preview.fileName,
        lines,
      } as any);
      push("success", t(`تم إنشاء عرض السعر ${q.quoteNumber} من الـ BOQ`, `Created quote ${q.quoteNumber} from the BOQ`));
      setTimeout(() => navigate("/app/quotes"), 600);
    } catch (e: any) {
      setErr(e instanceof ApiError ? e.message : t("فشل إنشاء العرض", "Failed to create the quote"));
    } finally { setBusy(false); }
  };

  const sheet = preview?.sheets[activeSheet];

  return (
    <>
      <FullPageForm
        title={t("استيراد BOQ → عرض سعر", "Import BOQ → Quote")}
        subtitle={t("ارفع جدول الكميات المسعّر (Excel) · كل صفحة تتحول إلى قسم في العرض", "Upload the priced BOQ workbook · every sheet becomes a proposal section")}
        onClose={() => navigate("/app/quotes")}
        disableEscape={busy}
        footer={
          preview ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm text-muted-foreground">
                {t(`${stats.count} بند مشمول`, `${stats.count} included`)} · <span className="font-english font-bold text-foreground">{stats.total.toLocaleString()}</span>
                {stats.optional > 0 && <> · {t(`${stats.optional} اختياري`, `${stats.optional} optional`)}</>}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="border-border" onClick={() => setPreview(null)}>{t("ملف آخر", "Another file")}</Button>
                <Button type="button" disabled={busy} onClick={createQuote} className="bg-primary hover:bg-primary/90">
                  {busy ? "..." : t("إنشاء عرض السعر", "Create quote")}
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="w-full max-w-none mx-auto space-y-4">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          {!preview && (
            <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 py-16 cursor-pointer hover:bg-primary/10 transition-colors">
              {busy ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <UploadCloud className="h-10 w-10 text-primary" />}
              <div className="text-foreground" style={{ fontWeight: 700 }}>{t("اسحب ملف الـ BOQ هنا أو اضغط للاختيار", "Drop the BOQ file here or click to choose")}</div>
              <div className="text-xs text-muted-foreground">{t("Excel (.xlsx / .xls) · حتى 10MB · يدعم العناوين العربية والإنجليزية والأرقام العربية ١٢٣", "Excel (.xlsx / .xls) · up to 10MB · Arabic & English headers")}</div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
            </label>
          )}

          {preview && (
            <>
              {/* Quote header fields */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">{t("العميل", "Customer")} *</Label>
                  <SearchableCombobox
                    value={form.contactId}
                    onChange={(id) => setForm({ ...form, contactId: id })}
                    onCreate={async (name) => {
                      const c = await api.contacts.create({ displayName: name, type: "CUSTOMER" });
                      setCustomers((prev) => [c, ...prev]);
                      return c.id;
                    }}
                    items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                    placeholder={t("ابحث أو أنشئ...", "Search or create...")}
                    createLabel={(q) => t(`+ إنشاء "${q}"`, `+ Create "${q}"`)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">{t("عنوان المشروع/المناقصة", "Project / tender title")}</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border-border h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">{t("تاريخ العرض", "Issue date")}</Label>
                  <DateInput value={form.issueDate} onChange={(iso) => setForm({ ...form, issueDate: iso })} inputClassName="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">{t("صالح حتى", "Valid until")}</Label>
                  <DateInput value={form.validUntil} onChange={(iso) => setForm({ ...form, validUntil: iso })} inputClassName="h-9 text-sm" />
                </div>
              </div>

              {/* Sheet tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground font-english">{preview.fileName}</span>
                <div className="flex items-center gap-1 flex-wrap ms-2">
                  {preview.sheets.map((s, i) => (
                    <button key={s.name} onClick={() => setActiveSheet(i)}
                      className={`rounded-full px-3 py-1 text-xs transition-colors ${i === activeSheet ? "bg-primary text-white" : "bg-muted text-foreground/70 hover:bg-primary/10"}`}>
                      {s.name} <span className="font-english">({s.lineCount})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lines table for the active sheet */}
              {sheet && (
                <div className="rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                        <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>{t("مشمول", "Incl.")}</th>
                        <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>{t("اختياري", "Opt.")}</th>
                        <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>{t("البند", "Description")}</th>
                        <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>{t("الوحدة", "Unit")}</th>
                        <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>{t("الكمية", "Qty")}</th>
                        <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>{t("السعر", "Price")}</th>
                        <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>{t("الإجمالي", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.lines.map((l, li) => {
                        if (l.isHeading) return (
                          <tr key={li} className="bg-primary/5">
                            <td colSpan={7} className="py-1.5 px-3 text-xs text-primary" style={{ fontWeight: 700 }}>{l.description}</td>
                          </tr>
                        );
                        const key = `${activeSheet}:${li}`;
                        const st = lineState[key] || { included: true, isOptional: false };
                        const amount = l.subtotal ?? (l.qty ?? 0) * (l.unitPrice ?? 0);
                        return (
                          <tr key={li} className={`border-b border-border/40 ${!st.included && !st.isOptional ? "opacity-40" : ""}`}>
                            <td className="py-1.5 px-3">
                              <input type="checkbox" checked={st.included} onChange={(e) => setLineState((s) => ({ ...s, [key]: { included: e.target.checked, isOptional: e.target.checked ? false : s[key]?.isOptional || false } }))} className="h-4 w-4 accent-[#1276E3]" />
                            </td>
                            <td className="py-1.5 px-3">
                              <input type="checkbox" checked={st.isOptional} onChange={(e) => setLineState((s) => ({ ...s, [key]: { included: e.target.checked ? false : s[key]?.included ?? true, isOptional: e.target.checked } }))} className="h-4 w-4 accent-[#179FC5]" title={t("يظهر في العرض كبند اختياري غير مشمول في الإجمالي", "Shown as optional · excluded from the total")} />
                            </td>
                            <td className="py-1.5 px-3 text-foreground/90">{l.no && <span className="font-english text-muted-foreground me-1">{l.no}</span>}{l.description}</td>
                            <td className="py-1.5 px-3 text-xs text-muted-foreground">{l.unit || "—"}</td>
                            <td className="py-1.5 px-3 font-english">{l.qty ?? "—"}</td>
                            <td className="py-1.5 px-3 font-english">{l.unitPrice?.toLocaleString() ?? "—"}</td>
                            <td className="py-1.5 px-3 font-english" style={{ fontWeight: 600 }}>{amount ? amount.toLocaleString() : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronLeft className="h-3.5 w-3.5" />
                {t("«مشمول» يدخل في إجمالي العرض · «اختياري» يظهر للعميل كأعمال إضافية بدون دخوله في الإجمالي · غير المحدد يُستبعد نهائيًا.", "'Included' counts toward the total · 'Optional' shows as extra works excluded from the total · unticked lines are dropped.")}
              </p>
            </>
          )}
        </div>
      </FullPageForm>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
