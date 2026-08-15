/**
 * SearchableCombobox · type-to-search + create-on-the-fly
 *
 * Replaces closed shadcn <Select>. Product requirement UX-5 rule:
 *   "العميل · يمكن كتابة الاسم ويظهر · إذا لم يكن مسجلاً يسمح بتسجيله مباشرة"
 *
 * Pattern (matches Wave + Wafeq + Notion comboboxes):
 *   1. User types in input
 *   2. Filtered list of matches shown below
 *   3. If query has no exact match → "+ إنشاء [query]" option appears at top
 *   4. Click create → calls onCreate(query) which returns the new item · auto-selects
 *   5. Click any match → onChange + close
 *
 * Notes (UX-221):
 *   - The popup is rendered in a portal (document.body)
 *   - This avoids clipping when used inside tables/containers with overflow rules
 *   - Position auto-adjusts on scroll/resize and keeps within viewport
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Check, ChevronDown } from "lucide-react";
import { normalizeDigits } from "../lib/digits";
import { BidiText, NumericText } from "./bidi-text";

export interface ComboboxItem {
  id: string;
  label: string;
  sublabel?: string; // e.g. email · displayed below label in muted text
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  onCreate?: (query: string) => Promise<string>; // returns created item's id
  items: ComboboxItem[];
  placeholder?: string;
  createLabel?: (query: string) => string;
  disabled?: boolean;
  className?: string;
  /** Optional class override for the trigger button itself */
  buttonClassName?: string;
  /** Minimum popup width (px) · keeps account names readable in narrow cells */
  menuMinWidth?: number;
  /** Selected label wraps to multiple lines + box grows (item cells) instead of truncating */
  wrap?: boolean;
  /**
   * Borderless trigger for dense data tables (e.g. ItemsTable).
   * Strips the bordered input look → only the chevron + hover/focus ring remain,
   * matching minimalist data-table selectors. Defaults to false so existing
   * bordered callers (forms, modals) are unchanged.
   */
  borderless?: boolean;
}

type PanelStyle = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function SearchableCombobox({
  value,
  onChange,
  onCreate,
  items,
  placeholder = "ابحث أو اكتب...",
  createLabel = (q) => `+ إنشاء "${q}"`,
  disabled = false,
  className = "",
  buttonClassName = "",
  menuMinWidth = 300,
  wrap = false,
  borderless = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [panelStyle, setPanelStyle] = useState<PanelStyle | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The currently-selected item label for display when closed
  const selected = useMemo(() => items.find((i) => i.id === value), [items, value]);

  // Filter logic · case-insensitive substring · normalize digits
  const filtered = useMemo(() => {
    const q = normalizeDigits(query.trim()).toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.sublabel || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  // Show create option if query is non-empty and not an exact match
  const showCreate = useMemo(() => {
    if (!onCreate || !query.trim()) return false;
    const q = query.trim().toLowerCase();
    return !items.some((i) => i.label.toLowerCase() === q);
  }, [items, query, onCreate]);

  const updatePanelPosition = () => {
    const trigger = wrapRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 0;

    // Width: keep readable popup width, but never overflow viewport
    const targetWidth = Math.max(rect.width, menuMinWidth);
    const maxWidth = Math.max(220, window.innerWidth - viewportPadding * 2);
    const width = Math.min(targetWidth, maxWidth);

    let left = rect.left;
    if (left + width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - viewportPadding - width;
    }
    if (left < viewportPadding) left = viewportPadding;

    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const placeAbove = spaceBelow < 220 && spaceAbove > spaceBelow;

    const available = placeAbove ? spaceAbove - gap : spaceBelow - gap;
    const maxHeight = Math.max(140, Math.min(320, available));
    const top = placeAbove
      ? Math.max(viewportPadding, rect.top - gap - maxHeight)
      : rect.bottom + gap;

    setPanelStyle({ top, left, width, maxHeight });
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = !!wrapRef.current?.contains(target);
      const insidePanel = !!panelRef.current?.contains(target);
      if (!insideTrigger && !insidePanel) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Focus input + position popup when opened
  useEffect(() => {
    if (!open) return;

    updatePanelPosition();
    const raf = requestAnimationFrame(() => {
      updatePanelPosition();
      inputRef.current?.focus();
    });

    const onViewportChange = () => updatePanelPosition();
    window.addEventListener("resize", onViewportChange);
    // capture=true catches scroll from nested containers too
    window.addEventListener("scroll", onViewportChange, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, items.length, menuMinWidth]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleCreate = async () => {
    if (!onCreate || !query.trim()) return;
    setCreating(true);
    try {
      const newId = await onCreate(query.trim());
      handleSelect(newId);
    } catch (e) {
      // caller is responsible for showing the error · we just stop creating
      console.warn("[combobox] create failed", e);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showCreate) {
        handleCreate();
      } else if (filtered.length > 0) {
        handleSelect(filtered[0].id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`w-full flex items-center justify-between rounded-md ${
          borderless
            ? "border-0 bg-transparent hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            : "border border-border bg-white hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
        } px-3 py-2 text-sm text-start disabled:opacity-50 ${buttonClassName}`}
        title={selected?.label || placeholder}
      >
        <span className={wrap
          ? `min-w-0 flex-1 ${selected ? "text-foreground" : "text-muted-foreground/60"} break-words leading-5`
          : selected ? "text-foreground truncate" : "text-muted-foreground/60 truncate"
        }>
          {selected ? (
            <>
              <BidiText compact={wrap} className="max-w-full leading-5" title={selected.label}>{selected.label}</BidiText>
              {wrap && selected.sublabel && (
                <NumericText className="ms-1 text-[11px] text-muted-foreground/60">· {selected.sublabel.split("·")[0].trim()}</NumericText>
              )}
            </>
          ) : <BidiText>{placeholder}</BidiText>}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground/60 shrink-0 ms-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && panelStyle && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[120] rounded-md border border-primary bg-white shadow-lg"
          style={{
            top: `${panelStyle.top}px`,
            left: `${panelStyle.left}px`,
            width: `${panelStyle.width}px`,
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
            <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(normalizeDigits(e.target.value))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              dir="auto"
              className="flex-1 bg-transparent text-start outline-none text-sm placeholder:text-muted-foreground/60"
            />
          </div>

          <div className="overflow-y-auto py-1" style={{ maxHeight: `${panelStyle.maxHeight}px` }}>
            {/* Create option (only when query non-empty and no exact match) */}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full text-start flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span style={{ fontWeight: 500 }}>{createLabel(query.trim())}</span>
                {creating && <span className="text-xs text-muted-foreground/60 ms-auto">جارٍ الإنشاء...</span>}
              </button>
            )}

            {filtered.length === 0 && !showCreate && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                لا توجد نتائج · جرب اسماً مختلفاً
              </div>
            )}

            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className="w-full text-start flex items-start justify-between gap-2 px-3 py-2 text-sm hover:bg-muted"
                title={`${item.label}${item.sublabel ? ` · ${item.sublabel}` : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <BidiText compact className="block text-foreground leading-5" title={item.label}>{item.label}</BidiText>
                  {item.sublabel && (
                    <NumericText className="block max-w-full overflow-hidden text-ellipsis text-xs text-muted-foreground">{item.sublabel}</NumericText>
                  )}
                </div>
                {item.id === value && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
