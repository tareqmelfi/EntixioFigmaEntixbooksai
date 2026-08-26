/**
 * BranchField · B1 (2026-08-26)
 *
 * The branch selector every document form shares. UX-5: SearchableCombobox with
 * quick-create (type a name → «+ إنشاء»). Behaviour:
 *   · value `undefined` (new form, untouched) → pre-fills the member's default branch
 *   · value `null` → «بدون فرع» (explicit none · sent as null)
 *   · companies with NO branches still see the field (creating the first branch
 *     inline is the whole point) — collapsed to a single compact control.
 */
import { useEffect, useMemo } from "react";
import { GitBranch } from "lucide-react";
import { Label } from "./ui/label";
import { SearchableCombobox, type ComboboxItem } from "./searchable-combobox";
import { useBranches } from "../lib/use-branches";
import { useLanguage } from "./LanguageContext";

const NONE = "__none__";

export function BranchField({
  value,
  onChange,
  disabled,
  compact,
  label,
  className,
}: {
  /** undefined = not yet chosen (apply default) · null = none · string = branch id */
  value: string | null | undefined;
  onChange: (branchId: string | null) => void;
  disabled?: boolean;
  /** No label row · for toolbars/filters */
  compact?: boolean;
  label?: string;
  className?: string;
}) {
  const { language, t } = useLanguage();
  const { branches, defaultBranchId, loading, create } = useBranches();

  // Apply the member default once, only while the caller has not chosen anything.
  useEffect(() => {
    if (value === undefined && !loading && defaultBranchId) onChange(defaultBranchId);
  }, [value, loading, defaultBranchId, onChange]);

  const items = useMemo<ComboboxItem[]>(() => [
    { id: NONE, label: t("بدون فرع", "No branch") },
    ...branches.map((b) => ({
      id: b.id,
      label: language === "ar" ? (b.nameAr || b.name) : b.name,
      sublabel: [b.code, b.isHQ ? t("المركز الرئيسي", "HQ") : null].filter(Boolean).join(" · ") || undefined,
    })),
  ], [branches, language, t]);

  const control = (
    <SearchableCombobox
      value={value ? value : value === null ? NONE : ""}
      onChange={(id) => onChange(id === NONE || !id ? null : id)}
      onCreate={async (q) => { const b = await create(q); return b.id; }}
      createLabel={(q) => t(`+ إنشاء فرع «${q}»`, `+ Create branch “${q}”`)}
      items={items}
      disabled={disabled || loading}
      placeholder={t("اختر الفرع…", "Pick a branch…")}
      menuMinWidth={280}
      className={className}
    />
  );

  if (compact) return control;
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 text-muted-foreground" />{label || t("الفرع", "Branch")}</Label>
      {control}
    </div>
  );
}

/** Report/list filter variant · «كل الفروع» + «بدون فرع» + branches · returns '' | 'none' | id */
export function BranchFilter({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const { language, t } = useLanguage();
  const { branches } = useBranches();
  if (!branches.length) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || "h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground"}
      aria-label={t("الفرع", "Branch")}
    >
      <option value="">{t("كل الفروع", "All branches")}</option>
      {branches.map((b) => <option key={b.id} value={b.id}>{language === "ar" ? (b.nameAr || b.name) : b.name}{b.code ? ` · ${b.code}` : ""}</option>)}
      <option value="none">{t("بدون فرع", "Unassigned")}</option>
    </select>
  );
}
