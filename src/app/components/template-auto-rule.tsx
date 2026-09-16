/**
 * Automatic template routing (2026-09-14) · «متى يُختار هذا القالب تلقائيًا؟»
 * A template may declare a rule matching a document's lines (product type · SKU prefix ·
 * category · description keyword). When a quote/invoice has no explicit template, the
 * highest-priority template whose rule matches its lines is used automatically — before
 * falling back to the org's default template. See the API's src/lib/template-routing.ts.
 *
 * UX-1: no Dialog/Sheet/confirm/alert — a plain card with a toggle, chip lists, and inline text.
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { DocumentTemplateAutoRule } from "../lib/api";

export interface AutoRuleValues {
  enabled: boolean;
  productTypes: string[];
  skuPrefixes: string[];
  categories: string[];
  descriptionContains: string[];
  mode: "any" | "all";
  minLines: number;
  priority: number;
}

export const EMPTY_AUTO_RULE: AutoRuleValues = {
  enabled: false, productTypes: [], skuPrefixes: [], categories: [], descriptionContains: [],
  mode: "any", minLines: 1, priority: 0,
};

/** Load the current template's stored autoRule/autoPriority into editable form values. */
export function autoRuleFromTemplate(tpl: { autoRule?: DocumentTemplateAutoRule | null; autoPriority?: number | null } | null | undefined): AutoRuleValues {
  const r = tpl?.autoRule || null;
  const hasRule = !!r && ((r.productTypes?.length || 0) + (r.skuPrefixes?.length || 0) + (r.categories?.length || 0) + (r.descriptionContains?.length || 0) > 0);
  return {
    enabled: hasRule,
    productTypes: r?.productTypes || [],
    skuPrefixes: r?.skuPrefixes || [],
    categories: r?.categories || [],
    descriptionContains: r?.descriptionContains || [],
    mode: r?.mode === "all" ? "all" : "any",
    minLines: r?.minLines && r.minLines >= 1 ? r.minLines : 1,
    priority: tpl?.autoPriority || 0,
  };
}

/** Form values → the PATCH/POST payload shape (null autoRule when disabled/empty · engine default). */
export function autoRulePayload(v: AutoRuleValues): { autoRule: DocumentTemplateAutoRule | null; autoPriority: number } {
  if (!v.enabled) return { autoRule: null, autoPriority: v.priority || 0 };
  const rule: DocumentTemplateAutoRule = {};
  if (v.productTypes.length) rule.productTypes = v.productTypes;
  if (v.skuPrefixes.length) rule.skuPrefixes = v.skuPrefixes;
  if (v.categories.length) rule.categories = v.categories;
  if (v.descriptionContains.length) rule.descriptionContains = v.descriptionContains;
  if (v.mode === "all") rule.mode = "all";
  if (v.minLines && v.minLines !== 1) rule.minLines = v.minLines;
  const isEmpty = !rule.productTypes && !rule.skuPrefixes && !rule.categories && !rule.descriptionContains;
  return { autoRule: isEmpty ? null : rule, autoPriority: v.priority || 0 };
}

const PRODUCT_TYPES = ["SERVICE", "GOOD", "INVENTORY", "SUBSCRIPTION", "PACKAGE", "BUNDLE", "DIGITAL"] as const;

function ChipList({ items, onRemove, empty }: { items: string[]; onRemove: (i: number) => void; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v, i) => (
        <span key={`${v}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs">
          {v}
          <button type="button" onClick={() => onRemove(i)} className="text-muted-foreground hover:text-danger" aria-label="remove">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function ChipAdder({ placeholder, onAdd, max, count }: { placeholder: string; onAdd: (v: string) => void; max: number; count: number }) {
  const [text, setText] = useState("");
  const commit = () => {
    const v = text.trim();
    if (v && count < max) onAdd(v);
    setText("");
  };
  return (
    <div className="flex gap-1.5">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder={placeholder}
        disabled={count >= max}
        dir="ltr"
        className="font-code text-xs"
      />
      <button type="button" onClick={commit} disabled={count >= max || !text.trim()}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs hover:bg-surface-hover disabled:opacity-40">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** A one-line plain-language summary of the rule, drawn live as the CEO edits it. */
function ruleSummaryAr(v: AutoRuleValues): string {
  const parts: string[] = [];
  if (v.productTypes.length) parts.push(`نوع المنتج ${v.productTypes.join(" أو ")}`);
  if (v.skuPrefixes.length) parts.push(`كود يبدأ بـ ${v.skuPrefixes.join(" أو ")}`);
  if (v.categories.length) parts.push(`تصنيف ${v.categories.join(" أو ")}`);
  if (v.descriptionContains.length) parts.push(`وصف يحتوي «${v.descriptionContains.join("» أو «")}»`);
  if (parts.length === 0) return "لم تُحدَّد أي شروط — لن يُختار هذا القالب تلقائيًا أبدًا.";
  const joiner = v.mode === "all" ? " و" : " أو ";
  const lines = v.minLines > 1 ? ` في ${v.minLines} بنود على الأقل` : " في بند واحد على الأقل";
  return `يُختار هذا القالب تلقائيًا لأي فاتورة/عرض فيه${lines} من: ${parts.join(joiner)}.`;
}
function ruleSummaryEn(v: AutoRuleValues): string {
  const parts: string[] = [];
  if (v.productTypes.length) parts.push(`product type ${v.productTypes.join(" or ")}`);
  if (v.skuPrefixes.length) parts.push(`SKU starting with ${v.skuPrefixes.join(" or ")}`);
  if (v.categories.length) parts.push(`category ${v.categories.join(" or ")}`);
  if (v.descriptionContains.length) parts.push(`description containing "${v.descriptionContains.join('" or "')}"`);
  if (parts.length === 0) return "No conditions set — this template will never be picked automatically.";
  const joiner = v.mode === "all" ? " and " : " or ";
  const lines = v.minLines > 1 ? ` in at least ${v.minLines} lines` : " in at least one line";
  return `This template is picked automatically for any quote/invoice with${lines} matching: ${parts.join(joiner)}.`;
}

export function TemplateAutoRuleSection({
  value, onChange, isAr, t,
}: {
  value: AutoRuleValues;
  onChange: (patch: Partial<AutoRuleValues>) => void;
  isAr: boolean;
  t: (ar: string, en: string) => string;
}) {
  const MAX = 20;
  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t("متى يُختار هذا القالب تلقائيًا؟", "When is this template picked automatically?")}</h2>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <span className="text-muted-foreground">{value.enabled ? t("مفعّل", "On") : t("معطّل", "Off")}</span>
          <input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ enabled: e.target.checked })}
            className="h-4 w-4 accent-primary" data-testid="auto-rule-enabled" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "بالإضافة إلى القالب الافتراضي، يمكن لهذا القالب أن \"يلتقط\" مستندًا معينًا تلقائيًا إذا كان أحد بنوده يطابق الشروط أدناه — مثل فاتورة ENSIDEX التي فيها بند اشتراك Entix Books.",
          "Beyond the default template, this template can automatically claim a document whose lines match the conditions below — e.g. an ENSIDEX invoice that carries an Entix Books subscription line.",
        )}
      </p>

      {value.enabled && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("نوع المنتج (Product type)", "Product type")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_TYPES.map((pt) => {
                const active = value.productTypes.includes(pt);
                return (
                  <button key={pt} type="button" onClick={() => onChange({
                    productTypes: active ? value.productTypes.filter((x) => x !== pt) : [...value.productTypes, pt],
                  })} className={`rounded-full border px-2.5 py-1 text-xs font-code transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface-hover"}`}>
                    {pt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("بداية كود المنتج (SKU prefix)", "SKU prefix")}</Label>
            <ChipList items={value.skuPrefixes} onRemove={(i) => onChange({ skuPrefixes: value.skuPrefixes.filter((_, j) => j !== i) })}
              empty={t("لا توجد أكواد محددة", "No SKU prefixes set")} />
            <ChipAdder placeholder="EN-ENT-" count={value.skuPrefixes.length} max={MAX}
              onAdd={(v) => onChange({ skuPrefixes: [...value.skuPrefixes, v] })} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("التصنيف (Category)", "Category")}</Label>
            <ChipList items={value.categories} onRemove={(i) => onChange({ categories: value.categories.filter((_, j) => j !== i) })}
              empty={t("لا توجد تصنيفات محددة", "No categories set")} />
            <ChipAdder placeholder="SAAS" count={value.categories.length} max={MAX}
              onAdd={(v) => onChange({ categories: [...value.categories, v] })} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("كلمة في وصف البند (احتياطي — لبند بدون منتج)", "Keyword in the line description (fallback — for a line with no product)")}</Label>
            <ChipList items={value.descriptionContains} onRemove={(i) => onChange({ descriptionContains: value.descriptionContains.filter((_, j) => j !== i) })}
              empty={t("لا توجد كلمات محددة", "No keywords set")} />
            <ChipAdder placeholder={t("اشتراك Entix Books", "Entix Books subscription")} count={value.descriptionContains.length} max={MAX}
              onAdd={(v) => onChange({ descriptionContains: [...value.descriptionContains, v] })} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("طريقة الجمع", "Combine as")}</Label>
              <div className="flex gap-1 rounded-lg bg-muted/50 p-1" role="radiogroup">
                {(["any", "all"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={value.mode === m} onClick={() => onChange({ mode: m })}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${value.mode === m ? "bg-card text-primary shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                    {m === "any" ? t("أي شرط", "Any") : t("كل الشروط", "All")}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("عدد البنود المطلوب", "Min. matching lines")}</Label>
              <Input type="number" min={1} value={value.minLines}
                onChange={(e) => onChange({ minLines: Math.max(1, Number(e.target.value) || 1) })} dir="ltr" className="font-code" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("الأولوية", "Priority")}</Label>
              <Input type="number" value={value.priority}
                onChange={(e) => onChange({ priority: Number(e.target.value) || 0 })} dir="ltr" className="font-code" data-testid="auto-rule-priority" />
            </div>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground" data-testid="auto-rule-summary">
            {isAr ? ruleSummaryAr(value) : ruleSummaryEn(value)}
          </div>
        </div>
      )}
    </section>
  );
}
