import { useState, useRef, useEffect } from "react";
import { Plus, ExternalLink, Settings } from "lucide-react";

// ── Chart of Accounts data (flat with categories) ──
export interface AccountOption {
  code: string;
  name: string;
  category: string;
}

const accountOptions: AccountOption[] = [
  // Revenue
  { code: "4000", name: "بيع بضائع", category: "الإيرادات" },
  { code: "4001", name: "إيرادات المبيعات", category: "الإيرادات" },
  { code: "4002", name: "إيرادات أخرى", category: "الإيرادات" },
  { code: "4100", name: "إيرادات خدمات", category: "الإيرادات" },
  { code: "4200", name: "إيرادات متنوعة", category: "الإيرادات" },
  { code: "4300", name: "مردودات ومسموحات", category: "الإيرادات" },
  { code: "7000", name: "إيرادات فوائد", category: "الإيرادات" },
  { code: "7100", name: "أرباح/(خسائر) التخلص من أصول", category: "الإيرادات" },
  // Equity
  { code: "3000", name: "الأرباح المبقاة", category: "حقوق الملكية" },
  { code: "3001", name: "رأس المال", category: "حقوق الملكية" },
  { code: "3100", name: "حقوق المالك", category: "حقوق الملكية" },
  { code: "3200", name: "سحوبات المالك", category: "حقوق الملكية" },
  // Liabilities
  { code: "2050", name: "عربون عميل", category: "الخصوم" },
  { code: "2100", name: "مصروفات مستحقة", category: "الخصوم" },
  { code: "2101", name: "الذمم الدائنة", category: "الخصوم" },
  { code: "2102", name: "ضريبة القيمة المضافة المستحقة", category: "الخصوم" },
  { code: "2110", name: "فوائد مستحقة", category: "الخصوم" },
  { code: "2120", name: "أجور مستحقة", category: "الخصوم" },
  { code: "2130", name: "التزامات الرواتب", category: "الخصوم" },
  { code: "2140", name: "ذمم دائنة أخرى", category: "الخصوم" },
  { code: "2200", name: "قرض غير مضمون (جاري)", category: "الخصوم" },
  { code: "2210", name: "قرض مضمون (جاري)", category: "الخصوم" },
  { code: "2220", name: "مبالغ مستحقة للمالك", category: "الخصوم" },
  // Assets
  { code: "1101", name: "النقدية", category: "الأصول" },
  { code: "1102", name: "البنك", category: "الأصول" },
  { code: "1103", name: "الذمم المدينة", category: "الأصول" },
  { code: "1201", name: "المعدات", category: "الأصول" },
  { code: "1202", name: "الأثاث", category: "الأصول" },
  { code: "1203", name: "أجهزة الحاسب", category: "الأصول" },
  { code: "1204", name: "المركبات", category: "الأصول" },
  // Expenses
  { code: "5001", name: "تكلفة المبيعات", category: "المصروفات" },
  { code: "5002", name: "الرواتب والأجور", category: "المصروفات" },
  { code: "5003", name: "الإيجار", category: "المصروفات" },
  { code: "5004", name: "المرافق", category: "المصروفات" },
  { code: "5005", name: "الصيانة", category: "المصروفات" },
  { code: "5006", name: "مصاريف إدارية", category: "المصروفات" },
];

const categoryOrder = ["الإيرادات", "حقوق الملكية", "الخصوم", "الأصول", "المصروفات"];

interface AccountSelectProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  className?: string;
  filterCategories?: string[];
}

export function AccountSelect({ value, onChange, placeholder = "حساب", className, filterCategories }: AccountSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayValue = value ? (() => {
    const acc = accountOptions.find((a) => a.code === value);
    return acc ? `${acc.code} - ${acc.name}` : value;
  })() : "";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredAccounts = accountOptions.filter((a) => {
    if (filterCategories && !filterCategories.includes(a.category)) return false;
    if (!query) return true;
    return a.name.includes(query) || a.code.includes(query);
  });

  const grouped: Record<string, AccountOption[]> = {};
  for (const acc of filteredAccounts) {
    if (!grouped[acc.category]) grouped[acc.category] = [];
    grouped[acc.category].push(acc);
  }

  const flatResults = categoryOrder.flatMap((cat) => grouped[cat] || []);

  const handleSelect = (acc: AccountOption) => {
    onChange(acc.code);
    setIsOpen(false);
    setQuery("");
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIndex((p) => Math.min(p + 1, flatResults.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIndex((p) => Math.max(p - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < flatResults.length) handleSelect(flatResults[highlightIndex]);
    }
    else if (e.key === "Escape" || e.key === "Tab") setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? query : displayValue}
        onChange={(e) => { setQuery(e.target.value); setHighlightIndex(-1); }}
        onFocus={() => { setIsOpen(true); setQuery(""); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20 transition-colors"
      />

      {isOpen && (
        <div className="absolute z-50 mt-1 w-[300px] rounded-lg border border-[#E5E7EB] bg-white shadow-lg overflow-hidden" style={{ maxHeight: "350px" }}>
          {/* Quick actions */}
          <div className="border-b border-[#E5E7EB]">
            <button className="w-full text-start px-3 py-2 flex items-center gap-2 hover:bg-[#F9FAFB] transition-colors">
              <Plus className="h-4 w-4 text-[#1276E3]" />
              <span className="text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>إنشاء حساب جديد</span>
              <ExternalLink className="h-3 w-3 text-[#1276E3] ms-auto" />
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "290px" }}>
            {categoryOrder.map((cat) => {
              const accs = grouped[cat];
              if (!accs || accs.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="px-3 py-1.5 text-xs text-[#9CA3AF] bg-[#F9FAFB] border-b border-[#F3F4F6]" style={{ fontWeight: 600 }}>{cat}</div>
                  {accs.map((acc) => {
                    const flatIdx = flatResults.indexOf(acc);
                    return (
                      <button
                        key={acc.code}
                        onClick={() => handleSelect(acc)}
                        onMouseEnter={() => setHighlightIndex(flatIdx)}
                        className={`w-full text-start px-3 py-2 flex items-center gap-2 transition-colors ${highlightIndex === flatIdx ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"}`}
                      >
                        <span className="text-sm font-english text-[#6B7280] w-10 shrink-0">{acc.code}</span>
                        <span className="text-sm text-[#0B1B49]">- {acc.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {flatResults.length === 0 && (
              <div className="px-3 py-3 text-sm text-[#6B7280] text-center">لا توجد حسابات مطابقة</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { accountOptions };
