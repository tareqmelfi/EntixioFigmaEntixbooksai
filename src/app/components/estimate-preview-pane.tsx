/**
 * EstimatePreviewPane · «كيف ستبدو الدراسة للعميل» + «لوحة الدراسة» (CEO 2026-09-13)
 *
 * Lives beside the estimate editor (end side · sticky · ≥ 1280px) or stacked above
 * it behind a segmented control on narrower screens. Two tabs:
 *
 *   «معاينة العميل» — the quotation the client will receive, rendered by the SAME
 *     engine as /print/proposal (BrandDocument · renderDocument) from a synthetic
 *     quote-shaped DocSpec: item no · description · qty · unit · unit price · line
 *     total · subtotal / VAT / total. SALE SIDE ONLY — cost and margin never enter
 *     the DocSpec (visibility law). Debounced 300 ms behind the keystrokes.
 *
 *   «لوحة الدراسة» — KPI tiles (cost · sale · gross margin · tax), a per-section
 *     mini table and a checklist (lines without cost · client-locked prices ·
 *     lines without unit/qty). Uses the editor's own computed line values.
 *
 * Ledger law: colour never carries meaning alone — every tone is paired with a
 * mark and a word (ok = blue · attention = copper · loss = brick).
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronsLeft, ChevronsRight, Eye, LayoutDashboard, Loader2 } from "lucide-react";
import { BrandDocument, useBrandTemplate } from "./brand-document";
import { useLanguage } from "./LanguageContext";
import { api, getOrgId, type Contact, type Org } from "../lib/api";
import { partyFromContact, partyFromOrg, quoteQrPayload, type DocSpec, type LineSpec, type PartySpec, type RenderInput } from "../lib/document-render";
import { displayLocale } from "../lib/number-display";

export type EstimatePreviewTab = "client" | "board";

/** One computed line as the editor already sees it (sale + cost sides). */
export interface EstimatePreviewLine {
  itemNo: string;
  section: string;
  description: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** fraction of 100 · e.g. 15 */
  taxRate: number;
  unitCost: number;
  cost: number;
  unitPriceLocked: boolean;
}

export interface EstimatePreviewTotals {
  costTotal: number;
  saleSubtotal: number;
  taxTotal: number;
  saleTotal: number;
  marginPct: number;
}

export interface EstimatePreviewSection { section: string; cost: number; sale: number; marginPct: number }

interface Props {
  title: string;
  number?: string | null;
  currency: string;
  contact?: Contact | null;
  /** Typed customer name when no contact id resolved yet (e.g. from a file) */
  contactName?: string;
  lines: EstimatePreviewLine[];
  totals: EstimatePreviewTotals;
  sections: EstimatePreviewSection[];
  defaultMarginPct: number;
  /** false for non-financial roles → the board hides cost / margin figures */
  canSeeCost: boolean;
  tab: EstimatePreviewTab;
  onTabChange: (tab: EstimatePreviewTab) => void;
  /** Side layout only · «إخفاء المعاينة» */
  onCollapse?: () => void;
  className?: string;
}

const money2 = (n: number) => Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = (n: number) => Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** True at and above the given CSS px width · SSR-safe. */
export function useMinWidth(px: number): boolean {
  const [ok, setOk] = useState<boolean>(() => (typeof window !== "undefined" ? window.matchMedia(`(min-width: ${px}px)`).matches : true));
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [px]);
  return ok;
}

/** Build the quote-shaped document from the editor state · SALE SIDE ONLY. */
export function docFromEstimateEditor(args: { title: string; number?: string | null; currency: string; lines: EstimatePreviewLine[]; totals: EstimatePreviewTotals; lang: "ar" | "en" }): DocSpec {
  const lines: LineSpec[] = args.lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      code: l.itemNo || null,
      description: l.spec ? `${l.description}\n${l.spec}` : l.description,
      quantity: l.quantity,
      unitPrice: round2(l.unitPrice),
      discount: 0,
      subtotal: l.lineTotal,
      taxRate: l.taxRate / 100,
      unit: l.unit || null,
      sectionLabel: l.section || null,
      included: true,
    }));
  return {
    kind: "QUOTE",
    number: args.number || (args.lang === "ar" ? "مسودة" : "DRAFT"),
    issueDate: todayIso(),
    endDate: null,
    currency: args.currency || "SAR",
    status: "DRAFT",
    title: args.title || null,
    reference: null,
    notes: null,
    termsConditions: null,
    lines,
    subtotal: args.totals.saleSubtotal,
    discountTotal: 0,
    taxTotal: args.totals.taxTotal,
    total: args.totals.saleTotal,
    language: args.lang,
  };
}

export function EstimatePreviewPane({ title, number, currency, contact, contactName, lines, totals, sections, defaultMarginPct, canSeeCost, tab, onTabChange, onCollapse, className = "" }: Props) {
  const { t, language } = useLanguage();
  const lang: "ar" | "en" = language === "en" ? "en" : "ar";

  // The issuing company · same source as the template designer
  const [org, setOrg] = useState<Org | null>(null);
  useEffect(() => {
    const id = getOrgId();
    if (!id) return;
    let alive = true;
    api.orgs.get(id).then((o) => { if (alive) setOrg(o); }).catch(() => { if (alive) setOrg(null); });
    return () => { alive = false; };
  }, []);
  const { template, bank, ready } = useBrandTemplate("QUOTE", null, tab === "client");

  const live = useMemo<RenderInput>(() => {
    const orgParty: PartySpec = org ? partyFromOrg(org) : { name: "" };
    const contactParty: PartySpec | null = contact ? partyFromContact(contact) : (contactName?.trim() ? { name: contactName.trim() } : null);
    const doc = docFromEstimateEditor({ title, number, currency, lines, totals, lang });
    // quote QR (identity · showQr) · same TLV the printed quote will carry
    doc.qrPayload = quoteQrPayload(doc, orgParty, template);
    return {
      lang,
      template,
      org: orgParty,
      contact: contactParty,
      doc,
      bank,
      embed: true,
    };
  }, [org, contact, contactName, template, bank, lang, title, number, currency, lines, totals]);

  // 300 ms behind the keystrokes · the engine lays out A4 sheets, not cheap per key
  const [debounced, setDebounced] = useState<RenderInput>(live);
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(live), 300);
    return () => window.clearTimeout(h);
  }, [live]);

  const hasLines = debounced.doc.lines.length > 0;

  // ── board figures ─────────────────────────────────────────────────────────
  const noCost = lines.filter((l) => l.description.trim() && l.unitCost <= 0).length;
  const locked = lines.filter((l) => l.description.trim() && l.unitPriceLocked).length;
  const noUnitQty = lines.filter((l) => l.description.trim() && (!l.unit.trim() || !(l.quantity > 0))).length;
  const sectionRows = useMemo(() => {
    const counts = new Map<string, number>();
    lines.forEach((l) => { const k = l.section.trim(); if (k && l.description.trim()) counts.set(k, (counts.get(k) || 0) + 1); });
    return sections.map((s) => ({ ...s, lines: counts.get(s.section) || 0 }));
  }, [lines, sections]);

  const marginTone = totals.saleSubtotal <= 0 ? "neutral" : totals.marginPct < 0 ? "danger" : totals.marginPct < defaultMarginPct ? "warning" : "success";
  const toneText: Record<string, string> = { neutral: "text-foreground", success: "text-success", warning: "text-warning", danger: "text-danger" };
  const marginWord = marginTone === "danger" ? t("خسارة", "Loss") : marginTone === "warning" ? t("دون المستهدف", "Below target") : marginTone === "success" ? t("ضمن المستهدف", "On target") : "";
  const marginMark = marginTone === "danger" ? "🔴" : marginTone === "warning" ? "🟡" : marginTone === "success" ? "🟢" : "";

  const segBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${active ? "bg-card text-primary shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <aside className={`min-w-0 rounded-xl border border-border bg-card ${className}`} data-testid="estimate-preview-pane" aria-label={t("معاينة الدراسة", "Estimate preview")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1" role="tablist" aria-label={t("محتوى المعاينة", "Preview content")}>
          <button type="button" role="tab" aria-selected={tab === "client"} className={segBtn(tab === "client")} onClick={() => onTabChange("client")} data-testid="estimate-preview-tab-client">
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />{t("معاينة العميل", "Client preview")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "board"} className={segBtn(tab === "board")} onClick={() => onTabChange("board")} data-testid="estimate-preview-tab-board">
            <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.75} />{t("لوحة الدراسة", "Study board")}
          </button>
        </div>
        {onCollapse && (
          <button type="button" onClick={onCollapse} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="estimate-preview-collapse">
            {lang === "ar" ? <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> : <ChevronsRight className="h-3.5 w-3.5" strokeWidth={1.75} />}
            {t("إخفاء المعاينة", "Hide preview")}
          </button>
        )}
      </div>

      {tab === "client" ? (
        <div className="p-3" role="tabpanel">
          <p className="mb-2 text-[11px] leading-4 text-muted-foreground">
            {t("هذا ما يستلمه العميل بعد التحويل إلى عرض سعر — سعر البيع فقط · لا تكلفة ولا هامش.",
               "What the client receives once this becomes a quote — sale price only · no cost, no margin.")}
          </p>
          {!ready ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
          ) : !hasLines ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground" data-testid="estimate-preview-empty">
              {t("أضف بندًا واحدًا على الأقل (أو أسقط ملفًا) لتظهر معاينة العرض.", "Add at least one line (or drop a file) to see the quotation preview.")}
            </div>
          ) : (
            <div className="rounded-lg bg-surface-hover p-2" data-testid="estimate-preview-document">
              <BrandDocument input={debounced} scaleToFit />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 p-3" role="tabpanel" data-testid="estimate-preview-board">
          {/* KPI tiles · 2×2 */}
          <div className="grid grid-cols-2 gap-2">
            {canSeeCost && (
              <div className="rounded-lg border border-border bg-surface-subtle p-3">
                <div className="text-[11px] text-muted-foreground">{t("إجمالي التكلفة", "Total cost")}</div>
                <div dir="ltr" className="mt-1 font-english text-[17px] leading-6 tabular-nums text-foreground text-end">{money2(totals.costTotal)} <span className="text-[11px] text-muted-foreground">{currency}</span></div>
              </div>
            )}
            <div className="rounded-lg border border-border bg-surface-subtle p-3">
              <div className="text-[11px] text-muted-foreground">{t("إجمالي البيع", "Total sale")}</div>
              <div dir="ltr" className="mt-1 font-english text-[17px] leading-6 tabular-nums text-foreground text-end">{money2(totals.saleSubtotal)} <span className="text-[11px] text-muted-foreground">{currency}</span></div>
            </div>
            {canSeeCost && (
              <div className="rounded-lg border border-border bg-surface-subtle p-3" data-testid="estimate-board-margin">
                <div className="text-[11px] text-muted-foreground">{t("الهامش الإجمالي %", "Gross margin %")}</div>
                <div dir="ltr" className={`mt-1 font-english text-[17px] leading-6 tabular-nums text-end ${toneText[marginTone]}`}>{pct1(totals.marginPct)}%</div>
                {marginWord && <div className={`mt-0.5 text-[11px] ${toneText[marginTone]}`}><span aria-hidden="true">{marginMark}</span> {marginWord} · {t(`المستهدف ${pct1(defaultMarginPct)}%`, `target ${pct1(defaultMarginPct)}%`)}</div>}
              </div>
            )}
            <div className="rounded-lg border border-border bg-surface-subtle p-3">
              <div className="text-[11px] text-muted-foreground">{t("الضريبة", "Tax")}</div>
              <div dir="ltr" className="mt-1 font-english text-[17px] leading-6 tabular-nums text-foreground text-end">{money2(totals.taxTotal)} <span className="text-[11px] text-muted-foreground">{currency}</span></div>
              <div dir="ltr" className="mt-0.5 font-english text-[11px] tabular-nums text-muted-foreground text-end">{t("الشامل", "Grand")} {money2(totals.saleTotal)}</div>
            </div>
          </div>

          {/* Per-section mini table */}
          <div>
            <h3 className="mb-1.5 text-xs font-semibold text-foreground">{t("الأقسام", "Sections")}</h3>
            {sectionRows.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{t("لا أقسام بعد — اكتب اسم القسم في عمود «القسم» لتجميع البنود.", "No sections yet — fill the “Section” column to group lines.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-[12px]">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground">
                      <th className="py-1 text-start font-medium">{t("القسم", "Section")}</th>
                      <th className="py-1 text-end font-medium">{t("بنود", "Lines")}</th>
                      {canSeeCost && <th className="py-1 text-end font-medium">{t("التكلفة", "Cost")}</th>}
                      <th className="py-1 text-end font-medium">{t("البيع", "Sale")}</th>
                      {canSeeCost && <th className="py-1 text-end font-medium">{t("الهامش %", "Margin %")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sectionRows.map((s) => (
                      <tr key={s.section} className="border-t border-border">
                        <td className="max-w-[160px] truncate py-1.5 text-foreground"><bdi dir="auto">{s.section}</bdi></td>
                        <td className="py-1.5 text-end font-english tabular-nums text-muted-foreground">{s.lines}</td>
                        {canSeeCost && <td className="py-1.5 text-end font-english tabular-nums text-muted-foreground"><span dir="ltr">{money2(s.cost)}</span></td>}
                        <td className="py-1.5 text-end font-english tabular-nums text-foreground"><span dir="ltr">{money2(s.sale)}</span></td>
                        {canSeeCost && <td className={`py-1.5 text-end font-english tabular-nums ${s.marginPct < 0 ? "text-danger" : s.marginPct < defaultMarginPct ? "text-warning" : "text-foreground"}`}><span dir="ltr">{pct1(s.marginPct)}</span></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Checklist */}
          <div>
            <h3 className="mb-1.5 text-xs font-semibold text-foreground">{t("قائمة التحقق", "Checklist")}</h3>
            <ul className="space-y-1 text-[12px]">
              {canSeeCost && (
                <li className="flex items-center justify-between gap-2" data-testid="estimate-board-no-cost">
                  <span className={noCost > 0 ? "text-warning" : "text-muted-foreground"}><span aria-hidden="true">{noCost > 0 ? "🟡" : "✓"}</span> {t("بنود بلا تكلفة", "Lines without cost")}</span>
                  <span className="font-english tabular-nums text-foreground">{noCost}</span>
                </li>
              )}
              <li className="flex items-center justify-between gap-2" data-testid="estimate-board-locked">
                <span className="text-muted-foreground"><span aria-hidden="true">🔒</span> {t("بنود بسعر مقفل من العميل", "Client-locked prices")}</span>
                <span className="font-english tabular-nums text-foreground">{locked}</span>
              </li>
              <li className="flex items-center justify-between gap-2" data-testid="estimate-board-no-unit">
                <span className={noUnitQty > 0 ? "text-warning" : "text-muted-foreground"}><span aria-hidden="true">{noUnitQty > 0 ? "🟡" : "✓"}</span> {t("بنود بلا وحدة/كمية", "Lines without unit/qty")}</span>
                <span className="font-english tabular-nums text-foreground">{noUnitQty}</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </aside>
  );
}
