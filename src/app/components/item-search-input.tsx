import { useState, useRef, useEffect } from "react";
import { Search, Plus, X, Package, GripVertical } from "lucide-react";

// ── Product/Item catalog ──
export interface CatalogItem {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  price: number;
  unit: string;
  account: string;
  taxRate: number;
}

const defaultCatalog: CatalogItem[] = [
  { id: "ITM-001", name: "استشارات تقنية", nameEn: "Tech Consulting", description: "خدمات استشارية تقنية", price: 5000, unit: "ساعة", account: "4001", taxRate: 15 },
  { id: "ITM-002", name: "تطوير برمجيات", nameEn: "Software Development", description: "تطوير وبرمجة تطبيقات", price: 8000, unit: "مشروع", account: "4001", taxRate: 15 },
  { id: "ITM-003", name: "تصميم UI/UX", nameEn: "UI/UX Design", description: "تصميم واجهات المستخدم", price: 3500, unit: "مشروع", account: "4001", taxRate: 15 },
  { id: "ITM-004", name: "استضافة سحابية", nameEn: "Cloud Hosting", description: "خطة استضافة سحابية سنوية", price: 12000, unit: "سنة", account: "4001", taxRate: 15 },
  { id: "ITM-005", name: "ترخيص برمجي", nameEn: "Software License", description: "ترخيص برنامج سنوي", price: 6000, unit: "ترخيص", account: "4001", taxRate: 15 },
  { id: "ITM-006", name: "تدريب فريق", nameEn: "Team Training", description: "تدريب وورش عمل", price: 2000, unit: "جلسة", account: "4001", taxRate: 15 },
  { id: "ITM-007", name: "صيانة ودعم فني", nameEn: "Maintenance & Support", description: "دعم فني شهري", price: 1500, unit: "شهر", account: "4001", taxRate: 15 },
  { id: "ITM-008", name: "نظام ERP", nameEn: "ERP System", description: "نظام تخطيط موارد المؤسسة", price: 45000, unit: "نظام", account: "4001", taxRate: 15 },
  { id: "ITM-009", name: "معدات حاسوب", nameEn: "Computer Equipment", description: "أجهزة ومعدات حاسوبية", price: 7500, unit: "قطعة", account: "1203", taxRate: 15 },
  { id: "ITM-010", name: "أثاث مكتبي", nameEn: "Office Furniture", description: "مكاتب وكراسي", price: 3200, unit: "قطعة", account: "1202", taxRate: 15 },
  { id: "ITM-011", name: "مواد خام", nameEn: "Raw Materials", description: "حديد وألمنيوم", price: 0, unit: "طن", account: "5001", taxRate: 15 },
  { id: "ITM-012", name: "لوازم مكتبية", nameEn: "Office Supplies", description: "أدوات مكتبية متنوعة", price: 0, unit: "مجموعة", account: "5006", taxRate: 15 },
];

interface ItemSearchInputProps {
  value: string;
  onChange: (name: string, item?: CatalogItem) => void;
  placeholder?: string;
  className?: string;
}

export function ItemSearchInput({ value, onChange, placeholder = "ابحث أو أنشئ صنف...", className }: ItemSearchInputProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = defaultCatalog.filter(
    (item) => item.name.includes(query) || (item.nameEn && item.nameEn.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 6);

  const hasExact = results.some((i) => i.name === query);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setQuery(value); }, [value]);

  const handleSelect = (item: CatalogItem) => {
    setQuery(item.name);
    onChange(item.name, item);
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    setIsOpen(true);
    setHighlightIndex(-1);
    onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIndex((p) => Math.min(p + 1, results.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIndex((p) => Math.max(p - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < results.length) handleSelect(results[highlightIndex]);
      else setIsOpen(false);
    }
    else if (e.key === "Escape") setIsOpen(false);
    else if (e.key === "Tab") setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20 transition-colors"
      />

      {isOpen && (query.length > 0 || true) && (
        <div className="absolute z-50 mt-1 w-[280px] rounded-lg border border-[#E5E7EB] bg-white shadow-lg overflow-hidden" style={{ maxHeight: "300px" }}>
          {/* Create new item option */}
          {query.trim() && !hasExact && (
            <button
              onClick={() => { onChange(query); setIsOpen(false); }}
              onMouseEnter={() => setHighlightIndex(results.length)}
              className={`w-full text-start px-3 py-2.5 flex items-center gap-2 border-b border-[#E5E7EB] transition-colors ${highlightIndex === results.length ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"}`}
            >
              <Plus className="h-4 w-4 text-[#1276E3]" />
              <span className="text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>إنشاء صنف جديد</span>
            </button>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
            {query.trim() && (
              <p className="px-3 py-1.5 text-xs text-[#9CA3AF] bg-[#F9FAFB] border-b border-[#F3F4F6]">
                أنشئ أصنافاً لحفظ التفاصيل وإعادة الاستخدام. إذا لم تحتج لذلك استخدم حقل الوصف.
              </p>
            )}
            {results.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`w-full text-start px-3 py-2 flex items-center gap-2 transition-colors ${highlightIndex === i ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"}`}
              >
                <Package className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0B1B49] truncate" style={{ fontWeight: 500 }}>{item.name}</span>
                    {item.nameEn && <span className="text-xs text-[#9CA3AF] font-english truncate">{item.nameEn}</span>}
                  </div>
                </div>
                {item.price > 0 && (
                  <span className="text-xs font-english text-[#6B7280] shrink-0">{item.price.toLocaleString()}</span>
                )}
              </button>
            ))}
            {results.length === 0 && query.trim() && (
              <div className="px-3 py-3 text-sm text-[#6B7280] text-center">لا توجد أصناف مطابقة</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { defaultCatalog };
