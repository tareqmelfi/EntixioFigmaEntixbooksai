/**
 * ProjectField · C2 (2026-08-26) — job-costing dimension on document forms.
 * SearchableCombobox with quick-create (UX-5) · «بدون مشروع» = null.
 * Cached per company like branches (one fetch shared by every form).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban } from "lucide-react";
import { Label } from "./ui/label";
import { SearchableCombobox, type ComboboxItem } from "./searchable-combobox";
import { api, getOrgId } from "../lib/api";
import { useLanguage } from "./LanguageContext";

type Proj = { id: string; code: string; name: string; status: string };
const cache = new Map<string, Proj[]>();
const inflight = new Map<string, Promise<Proj[]>>();
const listeners = new Set<() => void>();
function fetchProjects(orgId: string): Promise<Proj[]> {
  const c = cache.get(orgId); if (c) return Promise.resolve(c);
  let p = inflight.get(orgId);
  if (!p) { p = api.projects.list().then((r) => { const items = (r.items || []) as Proj[]; cache.set(orgId, items); return items; }).finally(() => inflight.delete(orgId)); inflight.set(orgId, p); }
  return p;
}
export function invalidateProjects(orgId = getOrgId()) { if (orgId) cache.delete(orgId); for (const l of listeners) l(); }

export function useProjects() {
  const orgId = getOrgId();
  const [items, setItems] = useState<Proj[]>(orgId ? cache.get(orgId) ?? [] : []);
  const [loading, setLoading] = useState(!(orgId && cache.has(orgId)));
  const load = useCallback(async () => { if (!orgId) { setLoading(false); return; } try { setItems(await fetchProjects(orgId)); } catch { setItems([]); } finally { setLoading(false); } }, [orgId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const l = () => { void load(); }; listeners.add(l); return () => { listeners.delete(l); }; }, [load]);
  const create = useCallback(async (name: string) => {
    const code = name.trim().toUpperCase().replace(/[^A-Z0-9؀-ۿ]+/g, "-").slice(0, 16) || `PRJ-${Date.now().toString().slice(-4)}`;
    const p = await api.projects.create({ code, name: name.trim(), status: "ACTIVE" });
    invalidateProjects(orgId);
    return p as Proj;
  }, [orgId]);
  return { projects: items, loading, create };
}

const NONE = "__none__";
export function ProjectField({ value, onChange, disabled, compact, label }: { value: string | null | undefined; onChange: (id: string | null) => void; disabled?: boolean; compact?: boolean; label?: string }) {
  const { t } = useLanguage();
  const { projects, loading, create } = useProjects();
  const items = useMemo<ComboboxItem[]>(() => [{ id: NONE, label: t("بدون مشروع", "No project") }, ...projects.filter((p) => p.status !== "CANCELLED").map((p) => ({ id: p.id, label: `${p.code} · ${p.name}`, sublabel: p.status !== "ACTIVE" ? p.status : undefined }))], [projects, t]);
  const control = (
    <SearchableCombobox
      value={value ? value : value === null ? NONE : ""}
      onChange={(id) => onChange(id === NONE || !id ? null : id)}
      onCreate={async (q) => (await create(q)).id}
      createLabel={(q) => t(`+ إنشاء مشروع «${q}»`, `+ Create project “${q}”`)}
      items={items}
      disabled={disabled || loading}
      placeholder={t("اختر المشروع…", "Pick a project…")}
      menuMinWidth={300}
    />
  );
  if (compact) return control;
  return <div className="space-y-2"><Label className="flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />{label || t("المشروع", "Project")}</Label>{control}</div>;
}

/** Report/list filter · '' = all · 'none' · id */
export function ProjectFilter({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const { t } = useLanguage();
  const { projects } = useProjects();
  if (!projects.length) return null;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className || "h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground"} aria-label={t("المشروع", "Project")}>
      <option value="">{t("كل المشاريع", "All projects")}</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
      <option value="none">{t("بدون مشروع", "Unassigned")}</option>
    </select>
  );
}
