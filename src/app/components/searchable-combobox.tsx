/**
 * SearchableCombobox · type-to-search + create-on-the-fly
 *
 * Replaces closed shadcn <Select>. Per طارق's UX-5 rule:
 *   "العميل · يمكن كتابة الاسم ويظهر · إذا لم يكن مسجلاً يسمح بتسجيله مباشرة"
 *
 * Pattern (matches Wave + Wafeq + Notion comboboxes):
 *   1. User types in input
 *   2. Filtered list of matches shown below
 *   3. If query has no exact match → "+ إنشاء [query]" option appears at top
 *   4. Click create → calls onCreate(query) which returns the new item · auto-selects
 *   5. Click any match → onChange + close
 *
 * Usage:
 *   <SearchableCombobox
 *     value={form.contactId}
 *     onChange={(id) => setForm({ ...form, contactId: id })}
 *     onCreate={async (name) => {
 *       const c = await api.contacts.create({ displayName: name, type: "CUSTOMER" });
 *       setCustomers((prev) => [c, ...prev]);
 *       return c.id;
 *     }}
 *     items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email }))}
 *     placeholder="ابحث عن عميل أو اكتب اسماً جديداً..."
 *     createLabel={(q) => `+ إنشاء "${q}"`}
 *   />
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Search, Check, ChevronDown } from "lucide-react";
import { normalizeDigits } from "../lib/digits";

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
}

export function SearchableCombobox({
  value,
  onChange,
  onCreate,
  items,
  placeholder = "ابحث أو اكتب...",
  createLabel = (q) => `+ إنشاء "${q}"`,
  disabled = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
      } else if (filtered.length === 1) {
        handleSelect(filtered[0].id);
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
      {/* Trigger (closed state shows current selection · opens on click) */}
      {!open ? (
        <button
          type="button"
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
          className="w-full flex items-center justify-between rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-start hover:border-[#1276E3] focus:outline-none focus:ring-2 focus:ring-[#1276E3]/20 disabled:opacity-50"
        >
          <span className={selected ? "text-[#0B1B49]" : "text-[#9CA3AF]"}>
            {selected?.label || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 text-[#9CA3AF] shrink-0" />
        </button>
      ) : (
        <div className="w-full rounded-md border border-[#1276E3] bg-white shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#F3F4F6]">
            <Search className="h-4 w-4 text-[#9CA3AF] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(normalizeDigits(e.target.value))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#9CA3AF]"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {/* Create option (only when query non-empty and no exact match) */}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full text-start flex items-center gap-2 px-3 py-2 text-sm text-[#1276E3] hover:bg-[#F4FCFF] disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span style={{ fontWeight: 500 }}>{createLabel(query.trim())}</span>
                {creating && <span className="text-xs text-[#9CA3AF] ms-auto">جارٍ الإنشاء...</span>}
              </button>
            )}

            {filtered.length === 0 && !showCreate && (
              <div className="px-3 py-4 text-sm text-[#6B7280] text-center">
                لا توجد نتائج · جرب اسماً مختلفاً
              </div>
            )}

            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className="w-full text-start flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-[#F9FAFB]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[#0B1B49] truncate">{item.label}</div>
                  {item.sublabel && (
                    <div className="text-xs text-[#6B7280] truncate font-english">{item.sublabel}</div>
                  )}
                </div>
                {item.id === value && <Check className="h-4 w-4 text-[#1276E3] shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
