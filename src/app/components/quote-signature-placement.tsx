import { useEffect, useState } from "react";
import { loadQuotePresentation, QuoteDocument, type SignaturePlacement, type QuotePresentation } from "./quote-document";
import { useLanguage } from "./LanguageContext";
export type SignatureSelection = { snapshotHash: string; placement?: SignaturePlacement };
export function QuoteSignaturePlacement({ id, disabled, onChange }: { id: string; disabled: boolean; onChange: (value: SignatureSelection | null) => void }) {
  const { t } = useLanguage();
  const [doc, setDoc] = useState<QuotePresentation | null>(null);
  const [placement, setPlacement] = useState<SignaturePlacement>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true; onChange(null); setDoc(null); setPlacement(undefined); setError(false);
    loadQuotePresentation(id).then(doc => { if (alive) { if (!doc.hash) throw new Error("preview_unavailable"); setDoc(doc); onChange({ snapshotHash: doc.hash }); } }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [id, revision, onChange]);
  function choose(p?: SignaturePlacement) { if (disabled || !doc) return; setPlacement(p); onChange({ snapshotHash: doc.hash, placement: p }); }
  return <section className="space-y-3" aria-label={t("مكان توقيع العميل", "Customer signature placement")}>
    <h2 className="font-semibold">{t("مكان توقيع العميل", "Customer signature placement")}</h2>
    {error && <p role="alert">{t("تعذّر تحميل المعاينة؛ أعد المحاولة قبل تجهيز التوقيع.", "Preview failed; retry before preparing the signature.")}</p>}
    <button type="button" disabled={disabled} className="underline text-sm" onClick={() => setRevision(n => n + 1)}>{t("تحديث المعاينة", "Refresh preview")}</button>
    {doc && <>
      <label className="flex items-center gap-2 text-sm">{t("الصفحة", "Page")}
        <select aria-label={t("صفحة التوقيع", "Signature page")} disabled={disabled} value={placement?.page || 0} onChange={e => choose(Number(e.target.value) ? { page: Number(e.target.value), x: 0.55, y: 0.75, width: 0.32, height: 0.08 } : undefined)} className="border border-border rounded p-2">
          <option value={0}>{t("صفحة توقيعات مستقلة في النهاية", "Separate signature page at the end")}</option>
          {Array.from({ length: doc.pages }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{t("اضغط على الموضع المطلوب في العرض، أو اختر الصفحة واضبط الموضع أدناه. اختر مساحة خالية حتى لا يغطي التوقيع نص العرض.", "Click a position on the document, or select a page and adjust below. Choose an empty area so the signature does not cover the quote text.")}</p>
      {placement && <div className="flex gap-3 flex-wrap">{([['x', 'من اليسار %', 'From left %', 0.68], ['y', 'من الأعلى %', 'From top %', 0.92]] as const).map(([key, ar, en, max]) => <label key={key} className="text-xs">{t(ar, en)}<input type="number" min={0} max={max * 100} step={1} aria-label={t(ar, en)} disabled={disabled} value={Math.round(placement[key] * 100)} onChange={e => choose({ ...placement, [key]: Math.max(0, Math.min(max, Number(e.target.value) / 100)) })} className="block border border-border rounded p-2 w-24" /></label>)}</div>}
      <QuoteDocument presentation={doc} placement={placement} onPlacement={disabled ? undefined : choose} />
    </>}
  </section>;
}
