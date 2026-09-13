/**
 * Document pages editor · «الصفحات الإضافية» (CEO 2026-09-13 · «إمكانية إضافة صفحات · مثل Gamma»)
 *
 * Free-form pages written INSIDE the platform (scope · requirements · method · photos) and
 * printed by lib/document-render as extra A4 sheets before the terms & conditions page.
 * Block editor · no external editor dependency · JSON blocks (never HTML).
 *
 * UX-1 compliant: NO Dialog · NO alert/confirm/prompt · InlineConfirm for page delete.
 * UX-5: «لصق ذكي» — pasted plain text (Word · email · notes) becomes blocks locally.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, ClipboardPaste, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { InlineConfirm } from "./side-panel";
import { useLanguageSafe } from "./LanguageContext";
import { normalizePages, PAGE_LIMITS, type DocPage, type PageBlock } from "../lib/document-render";

type BlockType = PageBlock["type"];

const BLOCK_LABELS: Record<BlockType, { ar: string; en: string }> = {
  heading: { ar: "عنوان", en: "Heading" },
  paragraph: { ar: "فقرة", en: "Paragraph" },
  bullets: { ar: "نقاط", en: "Bullets" },
  numbered: { ar: "قائمة مرقّمة", en: "Numbered list" },
  table: { ar: "جدول", en: "Table" },
  note: { ar: "تنبيه", en: "Callout" },
  image: { ar: "صورة", en: "Image" },
};
const BLOCK_ORDER: BlockType[] = ["heading", "paragraph", "bullets", "numbered", "table", "note", "image"];

function emptyBlock(type: BlockType): PageBlock {
  switch (type) {
    case "heading": return { type, text: "" };
    case "paragraph": return { type, text: "" };
    case "note": return { type, text: "" };
    case "bullets": return { type, items: [""] };
    case "numbered": return { type, items: [""] };
    case "table": return { type, header: ["", ""], rows: [["", ""]] };
    case "image": return { type, url: "", caption: "" };
  }
}

/** «لصق ذكي» · plain text → blocks. Local heuristics only (no API):
 *  "- x" / "• x" → bullets · "1. x" → numbered · tab/pipe-separated lines → table ·
 *  short line ending with ":" (or ≤ 60 chars followed by a longer paragraph) → heading. */
export function blocksFromText(text: string): PageBlock[] {
  const src = String(text || "").replace(/\r\n?/g, "\n");
  const rawLines = src.split("\n").map((l) => l.replace(/\s+$/, ""));
  const blocks: PageBlock[] = [];
  let i = 0;
  const isBullet = (l: string) => /^\s*(?:[-•·*▪◦]|[-–—])\s+/.test(l);
  const isNumbered = (l: string) => /^\s*(?:\d+|[٠-٩]+)[.)\-–]\s+/.test(l);
  const isTableRow = (l: string) => l.includes("\t") || (l.split("|").length >= 3);
  const cells = (l: string) => (l.includes("\t") ? l.split("\t") : l.split("|")).map((c) => c.trim()).filter((c, idx, arr) => !(c === "" && (idx === 0 || idx === arr.length - 1)));
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (!line.trim()) { i++; continue; }
    if (isBullet(line)) {
      const items: string[] = [];
      while (i < rawLines.length && isBullet(rawLines[i])) { items.push(rawLines[i].replace(/^\s*(?:[-•·*▪◦]|[-–—])\s+/, "").trim()); i++; }
      blocks.push({ type: "bullets", items });
      continue;
    }
    if (isNumbered(line)) {
      const items: string[] = [];
      while (i < rawLines.length && isNumbered(rawLines[i])) { items.push(rawLines[i].replace(/^\s*(?:\d+|[٠-٩]+)[.)\-–]\s+/, "").trim()); i++; }
      blocks.push({ type: "numbered", items });
      continue;
    }
    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (i < rawLines.length && rawLines[i].trim() && isTableRow(rawLines[i])) {
        const r = cells(rawLines[i]);
        if (!r.every((c) => /^[-:\s]*$/.test(c))) rows.push(r); // skip markdown "---|---" separators
        i++;
      }
      if (rows.length) blocks.push({ type: "table", header: rows[0], rows: rows.slice(1) });
      continue;
    }
    // paragraph run · consecutive non-empty plain lines
    const para: string[] = [];
    while (i < rawLines.length && rawLines[i].trim() && !isBullet(rawLines[i]) && !isNumbered(rawLines[i]) && !isTableRow(rawLines[i])) { para.push(rawLines[i].trim()); i++; }
    const first = para[0] || "";
    const headingLike = para.length >= 1 && (/[:：]$/.test(first) || (first.length <= 60 && !/[.。؟?!]$/.test(first) && (para.length === 1 ? true : para.slice(1).join(" ").length > 60)));
    if (headingLike && para.length >= 1) {
      blocks.push({ type: "heading", text: first.replace(/[:：]$/, "") });
      const rest = para.slice(1).join("\n");
      if (rest) blocks.push({ type: "paragraph", text: rest });
    } else {
      blocks.push({ type: "paragraph", text: para.join("\n") });
    }
  }
  return normalizePages([{ title: "", blocks }])[0]?.blocks || [];
}

/** Controlled editor · `value` is the stored DocPage[] · emits normalised pages on every change. */
export function DocumentPagesEditor({
  value,
  onChange,
  disabled,
  maxPages = PAGE_LIMITS.pages,
}: {
  value: DocPage[] | null | undefined;
  onChange: (pages: DocPage[]) => void;
  disabled?: boolean;
  maxPages?: number;
}) {
  const { t } = useLanguageSafe();
  const pages = useMemo<DocPage[]>(() => (Array.isArray(value) ? value : []), [value]);
  const [open, setOpen] = useState<number | null>(pages.length ? 0 : null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pasteFor, setPasteFor] = useState<number | null>(null);
  const [pasteText, setPasteText] = useState("");
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const emit = (next: DocPage[]) => onChange(next);
  const setPage = (pi: number, patch: Partial<DocPage>) => emit(pages.map((p, i) => (i === pi ? { ...p, ...patch } : p)));
  const setBlock = (pi: number, bi: number, b: PageBlock) => setPage(pi, { blocks: pages[pi].blocks.map((x, i) => (i === bi ? b : x)) });
  const addPage = () => {
    if (pages.length >= maxPages) return;
    emit([...pages, { title: "", blocks: [emptyBlock("paragraph")] }]);
    setOpen(pages.length);
  };
  const removePage = (pi: number) => { emit(pages.filter((_, i) => i !== pi)); setPendingDelete(null); setOpen(null); };
  const movePage = (pi: number, dir: -1 | 1) => {
    const j = pi + dir; if (j < 0 || j >= pages.length) return;
    const next = [...pages]; [next[pi], next[j]] = [next[j], next[pi]]; emit(next); setOpen(j);
  };
  const addBlock = (pi: number, type: BlockType) => {
    if (pages[pi].blocks.length >= PAGE_LIMITS.blocks) return;
    setPage(pi, { blocks: [...pages[pi].blocks, emptyBlock(type)] });
  };
  const removeBlock = (pi: number, bi: number) => setPage(pi, { blocks: pages[pi].blocks.filter((_, i) => i !== bi) });
  const moveBlock = (pi: number, bi: number, dir: -1 | 1) => {
    const j = bi + dir; const arr = [...pages[pi].blocks]; if (j < 0 || j >= arr.length) return;
    [arr[bi], arr[j]] = [arr[j], arr[bi]]; setPage(pi, { blocks: arr });
  };
  const applyPaste = (pi: number) => {
    const blocks = blocksFromText(pasteText);
    if (blocks.length) setPage(pi, { blocks: [...pages[pi].blocks.filter((b) => !isEmptyBlock(b)), ...blocks].slice(0, PAGE_LIMITS.blocks) });
    setPasteText(""); setPasteFor(null);
  };

  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-3" data-testid="document-pages-editor">
      {pages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("أضف صفحات حرة تُطبع مع المستند بنفس الهوية — نطاق العمل · المتطلبات · المنهجية · الصور. كل صفحة تبدأ على ورقة A4 جديدة قبل صفحة الشروط والأحكام.", "Add free-form pages printed with the document in the same identity — scope · requirements · method · photos. Each page starts a fresh A4 sheet before the terms & conditions page.")}
        </p>
      )}
      {pages.map((page, pi) => {
        const isOpen = open === pi;
        return (
          <div key={pi} className="rounded-lg border border-border bg-card" data-testid={`doc-page-${pi}`}>
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-start" onClick={() => setOpen(isOpen ? null : pi)} aria-expanded={isOpen}>
                <span className="font-code text-xs text-muted-foreground">{String(pi + 1).padStart(2, "0")}</span>
                <span className="truncate text-sm font-semibold text-foreground">{page.title || t(`ملحق ${pi + 1}`, `Appendix ${pi + 1}`)}</span>
                <span className="text-xs text-muted-foreground">· {page.blocks.length} {t("كتلة", "blocks")}</span>
                {isOpen ? <ChevronUp className="ms-auto h-4 w-4 text-muted-foreground" /> : <ChevronDown className="ms-auto h-4 w-4 text-muted-foreground" />}
              </button>
              {!disabled && (
                <span className="flex items-center gap-1">
                  <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-surface-hover disabled:opacity-40" disabled={pi === 0} onClick={() => movePage(pi, -1)} title={t("أعلى", "Up")}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-surface-hover disabled:opacity-40" disabled={pi === pages.length - 1} onClick={() => movePage(pi, 1)} title={t("أسفل", "Down")}><ArrowDown className="h-4 w-4" /></button>
                  {pendingDelete === pi ? (
                    <InlineConfirm onConfirm={() => removePage(pi)} onCancel={cancelDelete} label={t("حذف الصفحة؟", "Delete page?")} />
                  ) : (
                    <button type="button" className="rounded-md p-1 text-danger hover:bg-surface-hover" onClick={() => setPendingDelete(pi)} title={t("حذف الصفحة", "Delete page")}><Trash2 className="h-4 w-4" /></button>
                  )}
                </span>
              )}
            </div>
            {isOpen && (
              <div className="space-y-3 border-t border-border px-3 py-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-foreground/80">{t("عنوان الصفحة", "Page title")}</Label>
                  <Input value={page.title} disabled={disabled} maxLength={200} onChange={(e) => setPage(pi, { title: e.target.value })} placeholder={t("نطاق العمل · المتطلبات · الجدول الزمني…", "Scope of work · Requirements · Timeline…")} className="h-9 text-sm" />
                </div>
                {page.blocks.map((b, bi) => (
                  <div key={bi} className="rounded-md border border-border bg-surface-subtle p-2.5" data-testid={`doc-block-${pi}-${bi}`}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">{t(BLOCK_LABELS[b.type].ar, BLOCK_LABELS[b.type].en)}</span>
                      {!disabled && (
                        <span className="ms-auto flex items-center gap-1">
                          <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-surface-hover disabled:opacity-40" disabled={bi === 0} onClick={() => moveBlock(pi, bi, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-surface-hover disabled:opacity-40" disabled={bi === page.blocks.length - 1} onClick={() => moveBlock(pi, bi, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button type="button" className="rounded-md p-1 text-danger hover:bg-surface-hover" onClick={() => removeBlock(pi, bi)} title={t("إزالة الكتلة", "Remove block")}><Trash2 className="h-3.5 w-3.5" /></button>
                        </span>
                      )}
                    </div>
                    <BlockFields block={b} disabled={disabled} onChange={(nb) => setBlock(pi, bi, nb)} inputCls={inputCls} />
                  </div>
                ))}
                {!disabled && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {BLOCK_ORDER.map((type) => (
                      <Button key={type} type="button" size="sm" variant="outline" className="h-8 border-border text-xs" onClick={() => addBlock(pi, type)} data-testid={`add-block-${type}`}>
                        <Plus className="me-1 h-3.5 w-3.5" />{t(BLOCK_LABELS[type].ar, BLOCK_LABELS[type].en)}
                      </Button>
                    ))}
                    <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={() => setPasteFor(pasteFor === pi ? null : pi)} data-testid="pages-smart-paste">
                      <ClipboardPaste className="me-1 h-3.5 w-3.5" />{t("لصق ذكي", "Smart paste")}
                    </Button>
                  </div>
                )}
                {pasteFor === pi && !disabled && (
                  <div className="space-y-2 rounded-md border border-dashed border-border p-2.5">
                    <Label className="text-xs text-foreground/80">{t("الصق نصاً من Word أو إيميل أو ملاحظات — العناوين والنقاط والجداول تتحوّل إلى كتل تلقائياً", "Paste text from Word, email or notes — headings, bullets and tables become blocks automatically")}</Label>
                    <textarea rows={6} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className={inputCls} dir="auto" data-testid="pages-paste-text" />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => applyPaste(pi)} disabled={!pasteText.trim()} data-testid="pages-paste-apply">{t("تحويل إلى كتل", "Convert to blocks")}</Button>
                      <Button type="button" size="sm" variant="outline" className="border-border" onClick={() => { setPasteText(""); setPasteFor(null); }}>{t("إلغاء", "Cancel")}</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!disabled && (
        <Button type="button" size="sm" variant="outline" className="border-border" onClick={addPage} disabled={pages.length >= maxPages} data-testid="doc-pages-add">
          <Plus className="me-1.5 h-4 w-4" />{t("إضافة صفحة", "Add page")} <span className="ms-2 font-code text-[11px] text-muted-foreground">{pages.length}/{maxPages}</span>
        </Button>
      )}
    </div>
  );
}

function isEmptyBlock(b: PageBlock): boolean {
  switch (b.type) {
    case "heading": case "paragraph": case "note": return !b.text.trim();
    case "bullets": case "numbered": return !b.items.some((x) => x.trim());
    case "table": return !b.header.some((x) => x.trim()) && !b.rows.some((r) => r.some((c) => c.trim()));
    case "image": return !b.url.trim();
  }
}

function BlockFields({ block, onChange, disabled, inputCls }: { block: PageBlock; onChange: (b: PageBlock) => void; disabled?: boolean; inputCls: string }) {
  const { t } = useLanguageSafe();
  switch (block.type) {
    case "heading":
      return <Input value={block.text} disabled={disabled} maxLength={300} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder={t("عنوان فرعي", "Sub-heading")} className="h-9 text-sm font-semibold" dir="auto" />;
    case "paragraph":
      return <textarea rows={4} value={block.text} disabled={disabled} maxLength={PAGE_LIMITS.text} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder={t("نص الفقرة…", "Paragraph text…")} className={inputCls} dir="auto" />;
    case "note":
      return <textarea rows={2} value={block.text} disabled={disabled} maxLength={1500} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder={t("تنبيه أو ملاحظة مهمة…", "Callout or important note…")} className={inputCls} dir="auto" />;
    case "bullets":
    case "numbered":
      return (
        <textarea
          rows={Math.min(10, Math.max(3, block.items.length + 1))}
          value={block.items.join("\n")}
          disabled={disabled}
          onChange={(e) => onChange({ ...block, items: e.target.value.split("\n").slice(0, PAGE_LIMITS.items) })}
          placeholder={t("عنصر في كل سطر", "One item per line")}
          className={inputCls}
          dir="auto"
        />
      );
    case "table": {
      const cols = Math.max(block.header.length, ...block.rows.map((r) => r.length), 1);
      const setHeader = (ci: number, v: string) => { const h = Array.from({ length: cols }, (_, i) => block.header[i] || ""); h[ci] = v; onChange({ ...block, header: h }); };
      const setCell = (ri: number, ci: number, v: string) => { const rows = block.rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] || "")); rows[ri][ci] = v; onChange({ ...block, rows }); };
      const addRow = () => block.rows.length < PAGE_LIMITS.rows && onChange({ ...block, rows: [...block.rows, Array.from({ length: cols }, () => "")] });
      const delRow = (ri: number) => onChange({ ...block, rows: block.rows.filter((_, i) => i !== ri) });
      const addCol = () => cols < PAGE_LIMITS.cols && onChange({ ...block, header: [...Array.from({ length: cols }, (_, i) => block.header[i] || ""), ""], rows: block.rows.map((r) => [...Array.from({ length: cols }, (_, i) => r[i] || ""), ""]) });
      const delCol = () => cols > 1 && onChange({ ...block, header: block.header.slice(0, cols - 1), rows: block.rows.map((r) => r.slice(0, cols - 1)) });
      return (
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {Array.from({ length: cols }, (_, ci) => (
                    <th key={ci} className="p-1"><Input value={block.header[ci] || ""} disabled={disabled} onChange={(e) => setHeader(ci, e.target.value)} placeholder={t("عمود", "Column")} className="h-8 text-xs font-semibold" dir="auto" /></th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r, ri) => (
                  <tr key={ri}>
                    {Array.from({ length: cols }, (_, ci) => (
                      <td key={ci} className="p-1"><Input value={r[ci] || ""} disabled={disabled} onChange={(e) => setCell(ri, ci, e.target.value)} className="h-8 text-xs" dir="auto" /></td>
                    ))}
                    <td className="p-1">{!disabled && <button type="button" className="rounded-md p-1 text-danger hover:bg-surface-hover" onClick={() => delRow(ri)} title={t("حذف الصف", "Delete row")}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!disabled && (
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-7 border-border text-xs" onClick={addRow}>{t("+ صف", "+ Row")}</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 border-border text-xs" onClick={addCol} disabled={cols >= PAGE_LIMITS.cols}>{t("+ عمود", "+ Column")}</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 border-border text-xs" onClick={delCol} disabled={cols <= 1}>{t("− عمود", "− Column")}</Button>
            </div>
          )}
        </div>
      );
    }
    case "image":
      return (
        <div className="space-y-2">
          <Input value={block.url} disabled={disabled} onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder={t("رابط الصورة (https://…) — من المرفقات أو أي رابط عام", "Image URL (https://…) — from attachments or any public link")} className="h-9 text-sm" dir="ltr" />
          <Input value={block.caption || ""} disabled={disabled} maxLength={300} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder={t("تعليق الصورة (اختياري)", "Caption (optional)")} className="h-9 text-sm" dir="auto" />
          {/^https?:\/\//i.test(block.url) && <img src={block.url} alt="" className="max-h-40 rounded-md border border-border object-contain" />}
        </div>
      );
  }
}

/** Card used on a saved document (quote · invoice) · loads `pages`, edits, saves via PATCH. */
export function DocumentPagesSection({
  pages,
  onSave,
  disabled,
  printHref,
}: {
  pages: DocPage[] | null | undefined;
  onSave: (pages: DocPage[]) => Promise<void>;
  disabled?: boolean;
  printHref?: string;
}) {
  const { t } = useLanguageSafe();
  const [draft, setDraft] = useState<DocPage[]>(() => normalizePages(pages));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dirty) setDraft(normalizePages(pages)); }, [pages, dirty]);
  const save = async () => {
    setBusy(true);
    try { await onSave(normalizePages(draft)); setDirty(false); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border border-border bg-card p-5" data-testid="document-pages-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-section font-semibold text-foreground">{t("الصفحات الإضافية", "Additional pages")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("تُطبع بعد البنود وقبل صفحة الشروط والأحكام · بنفس هوية المستند", "Printed after the items and before the terms & conditions page · same document identity")}</p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          {printHref && <Button type="button" size="sm" variant="outline" className="border-border" onClick={() => window.open(printHref, "_blank", "noopener")} disabled={dirty}>{t("معاينة الطباعة", "Print preview")}</Button>}
          <Button type="button" size="sm" onClick={save} disabled={disabled || busy || !dirty} data-testid="document-pages-save">
            {busy && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}{t("حفظ الصفحات", "Save pages")}
          </Button>
        </span>
      </div>
      <div className="mt-4">
        <DocumentPagesEditor value={draft} disabled={disabled || busy} onChange={(p) => { setDraft(p); setDirty(true); }} />
      </div>
      {dirty && <p className="mt-2 text-xs text-warning">{t("تغييرات غير محفوظة — اضغط «حفظ الصفحات» قبل المعاينة أو الإرسال.", "Unsaved changes — press “Save pages” before previewing or sending.")}</p>}
    </div>
  );
}
