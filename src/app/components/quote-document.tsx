import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { api } from "../lib/api";

export type SignaturePlacement = { page: number; x: number; y: number; width: number; height: number };
export type QuotePresentation = { html: string; hash: string; pages: number; title: string; lang: string };
export function parseQuotePresentation(html: string): QuotePresentation {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector(".edoc");
  if (!root) throw new Error("تعذّر تحميل المستند الكامل");
  return { html, hash: doc.querySelector('meta[name="entix-document-hash"]')?.getAttribute("content") || "", pages: root.querySelectorAll(".sheet").length, title: doc.title, lang: doc.documentElement.lang || "ar" };
}
export async function loadQuotePresentation(id: string, params?: { templateId?: string | null; lang?: "ar" | "en"; orgId?: string }) {
  return parseQuotePresentation(await api.documentTemplates.render("QUOTE", id, { ...params, actions: 0 }));
}

/** The exact server-rendered sheets are shared by print, the public link and placement preview. */
export function QuoteDocument({ presentation, placement, onPlacement }: {
  presentation: QuotePresentation; placement?: SignaturePlacement; onPlacement?: (p: SignaturePlacement) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const content = useMemo(() => {
    const doc = new DOMParser().parseFromString(presentation.html, "text/html");
    if (placement) {
      const sheet = doc.querySelector(`.sheet[data-page="${placement.page}"]`);
      const box = doc.createElement("div");
      box.textContent = presentation.lang === "ar" ? "توقيع العميل" : "Customer signature";
      box.setAttribute("style", `position:absolute;z-index:10;box-sizing:border-box;border:2px dashed #5875DB;background:#eef1ffcc;color:#1a1e48;display:flex;align-items:center;justify-content:center;left:${placement.x * 100}%;top:${placement.y * 100}%;width:${placement.width * 100}%;height:${placement.height * 100}%`);
      sheet?.prepend(box);
    }
    return { css: Array.from(doc.querySelectorAll("style")).map(el => el.textContent).join("\n"), body: doc.querySelector(".edoc")!.outerHTML };
  }, [presentation, placement]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / 794));
    measure(); const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  function choose(event: MouseEvent<HTMLDivElement>) {
    if (!onPlacement) return;
    const sheet = (event.target as Element).closest<HTMLElement>(".sheet");
    if (!sheet) return;
    event.preventDefault();
    const r = sheet.getBoundingClientRect();
    onPlacement({ page: Number(sheet.dataset.page), x: Math.max(0, Math.min(0.68, (event.clientX - r.left) / r.width - 0.16)), y: Math.max(0, Math.min(0.92, (event.clientY - r.top) / r.height - 0.04)), width: 0.32, height: 0.08 });
  }
  return <div ref={host} className="quote-document-host" data-testid="brand-document" data-sheets={presentation.pages} style={{ width: "100%", height: presentation.pages * 1137 * scale, position: "relative" }}>
    <style>{content.css + `\n@media print{.quote-document-host{height:auto!important}.quote-document-content{position:static!important;transform:none!important;width:auto!important}.quote-document-host .sheet{margin:0!important}}`}</style>
    <div className="quote-document-content" style={{ width: 794, position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", cursor: onPlacement ? "crosshair" : undefined }} onClick={choose} dangerouslySetInnerHTML={{ __html: content.body }} />
  </div>;
}
