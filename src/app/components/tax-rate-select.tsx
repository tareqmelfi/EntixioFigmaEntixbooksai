import { useState, useRef, useEffect } from "react";
import { Settings, Plus, ExternalLink } from "lucide-react";

export interface TaxRate {
  id: string;
  name: string;
  nameEn: string;
  rate: number;
  type: "sales" | "purchases" | "both";
}

const taxRates: TaxRate[] = [
  { id: "VAT15", name: "ضريبة القيمة المضافة", nameEn: "VAT 15%", rate: 15, type: "both" },
  { id: "VAT0", name: "نسبة صفر", nameEn: "Zero Rated", rate: 0, type: "both" },
  { id: "EXEMPT", name: "معفاة من الضريبة", nameEn: "Tax Exempt", rate: 0, type: "both" },
  { id: "IMPORT_TAX", name: "ضريبة على الواردات", nameEn: "Sales Tax on Imports", rate: 0, type: "purchases" },
  { id: "PURCHASE_TAX", name: "ضريبة على المشتريات", nameEn: "Tax on Purchases", rate: 15, type: "purchases" },
  { id: "SALES_TAX", name: "ضريبة على المبيعات", nameEn: "Tax on Sales", rate: 15, type: "sales" },
  { id: "WITHHOLDING5", name: "ضريبة استقطاع 5%", nameEn: "Withholding Tax 5%", rate: 5, type: "purchases" },
  { id: "WITHHOLDING20", name: "ضريبة استقطاع 20%", nameEn: "Withholding Tax 20%", rate: 20, type: "purchases" },
];

interface TaxRateSelectProps {
  value: number;
  onChange: (rate: number, taxRateId?: string) => void;
  type?: "sales" | "purchases" | "both";
  placeholder?: string;
  className?: string;
}

export function TaxRateSelect({ value, onChange, type = "both", placeholder = "الضريبة", className }: TaxRateSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = taxRates.filter((t) => type === "both" || t.type === "both" || t.type === type);

  const displayValue = (() => {
    const match = filtered.find((t) => t.rate === value);
    if (match) return `${match.rate}%`;
    return `${value}%`;
  })();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (tr: TaxRate) => {
    onChange(tr.rate, tr.id);
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm text-start font-english focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20 transition-colors"
      >
        {displayValue}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-[260px] rounded-lg border border-[#E5E7EB] bg-white shadow-lg overflow-hidden" style={{ maxHeight: "320px" }}>
          {/* Actions */}
          <div className="border-b border-[#E5E7EB]">
            <button className="w-full text-start px-3 py-2 flex items-center gap-2 hover:bg-[#F9FAFB] transition-colors">
              <Settings className="h-4 w-4 text-[#6B7280]" />
              <span className="text-sm text-[#374151]">إعداد ضريبة تلقائية</span>
              <ExternalLink className="h-3 w-3 text-[#6B7280] ms-auto" />
            </button>
            <button className="w-full text-start px-3 py-2 flex items-center gap-2 hover:bg-[#F9FAFB] transition-colors border-b border-[#E5E7EB]">
              <Plus className="h-4 w-4 text-[#1276E3]" />
              <span className="text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>إنشاء نسبة ضريبة جديدة</span>
              <ExternalLink className="h-3 w-3 text-[#1276E3] ms-auto" />
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "230px" }}>
            {filtered.map((tr, i) => (
              <button
                key={tr.id}
                onClick={() => handleSelect(tr)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`w-full text-start px-3 py-2.5 flex items-center justify-between transition-colors ${highlightIndex === i ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"} ${tr.rate === value ? "bg-[#F0F9FF]" : ""}`}
              >
                <span className="text-sm text-[#0B1B49]">{tr.name}</span>
                <span className="text-sm font-english text-[#6B7280]" style={{ fontWeight: 500 }}>{tr.rate}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { taxRates };
