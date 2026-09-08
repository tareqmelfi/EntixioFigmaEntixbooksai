/**
 * BrandDocument · React shell around the pure document engine
 * (src/app/lib/document-render.ts · identical copy in the API).
 *
 * Renders the engine's fixed A4 sheets inline. Used by:
 *   · /print/proposal/:id  (quote print view)
 *   · /print/invoice/:id   (invoice print view · incl. the editor's embed pane)
 *   · /app/templates/:id   (designer live preview · sample data)
 */
import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { api } from "../lib/api";
import { renderDocument, type BankSpec, type DocKind, type RenderInput, type RenderOutput } from "../lib/document-render";

export function qrSvg(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
}

/** Resolve the template for a document: explicit id → org default for the kind (BOTH counts). */
export function useBrandTemplate(kind: DocKind, templateId?: string | null, enabled = true) {
  const [template, setTemplate] = useState<any | null | undefined>(undefined);
  const [bank, setBank] = useState<BankSpec | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      let tpl: any = null;
      if (templateId) { try { tpl = await api.documentTemplates.get(templateId); } catch { tpl = null; } }
      if (!tpl) { try { tpl = (await api.documentTemplates.defaults())[kind] || null; } catch { tpl = null; } }
      let b: BankSpec | null = null;
      if (tpl?.bankAccountId) {
        try {
          const acc = (await api.bankAccounts.list()).items.find((x) => x.id === tpl.bankAccountId);
          if (acc) b = { name: acc.name, bankName: acc.bankName, accountNumber: acc.accountNumber, iban: acc.iban, swiftCode: acc.swiftCode, routingNumber: acc.routingNumber, currency: acc.currency };
        } catch { /* bank card simply omitted */ }
      }
      if (!cancelled) { setTemplate(tpl); setBank(b); }
    })();
    return () => { cancelled = true; };
  }, [kind, templateId, enabled]);
  return { template, bank, ready: template !== undefined };
}

export function BrandDocument({ input, scaleToFit, onRendered }: {
  input: RenderInput;
  /** Shrink the 210mm sheets to the container width (designer pane · embed iframe) */
  scaleToFit?: boolean;
  onRendered?: (out: RenderOutput) => void;
}) {
  const out = useMemo(() => renderDocument({ qr: qrSvg, ...input }), [input]);
  useEffect(() => { onRendered?.(out); }, [out, onRendered]);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!scaleToFit) { setScale(1); return; }
    const el = document.getElementById("brand-document-host");
    if (!el) return;
    const measure = () => setScale(Math.min(1, (el.clientWidth - 8) / 794));
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [scaleToFit]);
  const sheetH = 1123 + 14; // 297mm + gap (px at 96dpi)
  const scaled = !!scaleToFit && scale < 1;
  return (
    <div id="brand-document-host" data-testid="brand-document" data-sheets={out.sheetCount}
      style={scaled ? { position: "relative", width: "100%", height: out.sheetCount * sheetH * scale, overflow: "hidden" } : { width: "100%" }}>
      <style>{out.css}</style>
      <div
        style={scaled ? { position: "absolute", top: 0, left: 0, width: 794, transform: `scale(${scale})`, transformOrigin: "top left" } : undefined}
        dangerouslySetInnerHTML={{ __html: out.body }}
      />
    </div>
  );
}
