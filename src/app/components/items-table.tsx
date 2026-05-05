/**
 * ItemsTable v2 · multi-line invoice/quote/bill items
 *
 * Per طارق's reference (Wafeq screenshot 2026-05-05):
 * Columns (RTL):
 *   الصنف (Item)            · product picker · auto-fills description + price + tax
 *   الوصف (Description)     · free text · overrides product default
 *   الكمية (Quantity)
 *   السعر (Price)
 *   الحساب (Account)        · chart of accounts mapping (revenue acc for invoices, expense acc for bills)
 *   الضريبة (Tax)           · 15% / 0% / exempt
 *   مبلغ الضريبة (Tax SR)
 *   المبلغ (SR)             · line total
 *   ⋮ drag handle           · reorder rows
 *
 * Plus:
 *  - 10 visible rows by default · auto-shrink on small screens
 *  - "إضافة سطر" + "الأعمدة (X مخفية)" footer
 *  - Smart paste from Excel/CSV
 *  - Per-line tax mode override (when bulk = "custom")
 *  - Bilingual digit normalization
 */
import { useRef, useState, useMemo, KeyboardEvent, ClipboardEvent } from "react";
import { Plus, Trash2, GripVertical, Settings2 } from "lucide-react";
import { Input } from "./ui/input";
import { SearchableCombobox } from "./searchable-combobox";
import { BarcodeScannerButton } from "./barcode-scanner";
import { normalizeDigits } from "../lib/digits";

export interface InvoiceLine {
  id: string;
  productId?: string;       // optional · null = free-form line
  description: string;
  quantity: string;
  unitPrice: string;
  /** GL account id · maps to revenue/expense in chart of accounts */
  accountId?: string;
  taxInclusive: boolean;
  taxRate: number;
  notes?: string;
}

export type TaxMode = "all-inclusive" | "all-exclusive" | "custom";

export interface ProductOption {
  id: string;
  name: string;
  sku?: string;
  unitPrice: number;
  taxRate?: number;
  /** Default income/expense account id for this product */
  accountId?: string;
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  /** "INCOME" | "EXPENSE" | "ASSET" etc. */
  type: string;
}

interface Props {
  lines: InvoiceLine[];
  setLines: (lines: InvoiceLine[]) => void;
  mode: TaxMode;
  onModeChange: (m: TaxMode) => void;
  defaultTaxRate?: number;
  currency?: string;
  /** Optional · enables Item picker column · pass [] to hide */
  products?: ProductOption[];
  /** Optional · enables Account picker column */
  accounts?: AccountOption[];
  /** Allow user to create a product on-the-fly */
  onCreateProduct?: (name: string) => Promise<ProductOption>;
  /** Allow user to create an account on-the-fly (rare · usually pre-set) */
  onCreateAccount?: (name: string) => Promise<AccountOption>;
  /** Minimum visible rows · pads with empties · default 10 */
  minRows?: number;
  /** Direction: "sales" affects defaults (income accounts) · "purchases" → expense accounts */
  direction?: "sales" | "purchases";
}

export function newLine(taxRate = 0.15, taxInclusive = false): InvoiceLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    quantity: "1",
    unitPrice: "",
    taxRate,
    taxInclusive,
  };
}

export function computeTotals(lines: InvoiceLine[]) {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    if (!l.description.trim() && !l.unitPrice) continue;
    const qty = Number(normalizeDigits(l.quantity)) || 0;
    const price = Number(normalizeDigits(l.unitPrice)) || 0;
    const lineGross = qty * price;
    if (l.taxInclusive) {
      const net = lineGross / (1 + l.taxRate);
      const lineTax = lineGross - net;
      subtotal += net;
      tax += lineTax;
    } else {
      const lineTax = lineGross * l.taxRate;
      subtotal += lineGross;
      tax += lineTax;
    }
  }
  return { subtotal, tax, total: subtotal + tax };
}

const DEFAULT_HIDDEN_COLS = { account: false, tax: false, taxAmount: false };

export function ItemsTable({
  lines,
  setLines,
  mode,
  onModeChange,
  defaultTaxRate = 0.15,
  currency = "SAR",
  products = [],
  accounts = [],
  onCreateProduct,
  onCreateAccount,
  minRows = 10,
  direction = "sales",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(DEFAULT_HIDDEN_COLS);
  const [colsOpen, setColsOpen] = useState(false);

  // Pad lines to minRows for visual consistency · empty rows are filtered on submit
  const displayLines = useMemo(() => {
    const padded = [...lines];
    while (padded.length < minRows) padded.push(newLine(defaultTaxRate, mode === "all-inclusive"));
    return padded;
  }, [lines, minRows, defaultTaxRate, mode]);

  const realLineCount = lines.length;

  const updateLine = (idx: number, patch: Partial<InvoiceLine>) => {
    if (idx >= realLineCount) {
      // Promoting a placeholder row · expand the array
      const expanded = [...displayLines.slice(0, idx + 1)].map((l, i) =>
        i === idx ? { ...l, ...patch } : l,
      );
      setLines(expanded);
    } else {
      setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }
  };

  const removeRow = (idx: number) => {
    if (idx >= realLineCount) return;
    setLines(lines.length === 1 ? [newLine(defaultTaxRate, mode === "all-inclusive")] : lines.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    setLines([...lines, newLine(defaultTaxRate, mode === "all-inclusive")]);
  };

  const onProductPick = (idx: number, product: ProductOption) => {
    updateLine(idx, {
      productId: product.id,
      description: product.name,
      unitPrice: String(product.unitPrice),
      accountId: product.accountId || displayLines[idx].accountId,
      taxRate: product.taxRate ?? displayLines[idx].taxRate,
    });
  };

  const handleModeChange = (m: TaxMode) => {
    onModeChange(m);
    if (m === "all-inclusive") setLines(lines.map((l) => ({ ...l, taxInclusive: true })));
    else if (m === "all-exclusive") setLines(lines.map((l) => ({ ...l, taxInclusive: false })));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number, isLast: boolean) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isLast && idx === realLineCount - 1) addRow();
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const rows = text.split(/\r?\n/).filter((r) => r.trim());
    if (rows.length < 2 && !text.includes("\t")) return;

    e.preventDefault();
    const inclusive = mode === "all-inclusive";

    // Detect if pasted text has clear column structure (tabs OR consistent comma columns)
    const hasTabs = text.includes("\t");
    const looksLikeCsv = rows.length >= 2 && rows.every((r) => (r.match(/,/g) || []).length === (rows[0].match(/,/g) || []).length);

    if (hasTabs || looksLikeCsv) {
      // Deterministic split (current path)
      const newRows: InvoiceLine[] = [];
      for (const row of rows) {
        const cols = hasTabs ? row.split("\t") : row.split(",");
        const description = (cols[0] || "").trim();
        if (!description) continue;
        let quantity = "1", unitPrice = "";
        if (cols.length >= 3) {
          quantity = normalizeDigits((cols[1] || "1").trim());
          unitPrice = normalizeDigits((cols[2] || "").trim());
        } else if (cols.length === 2) {
          unitPrice = normalizeDigits((cols[1] || "").trim());
        }
        newRows.push({ ...newLine(defaultTaxRate, inclusive), description, quantity, unitPrice });
      }
      if (newRows.length > 0) {
        const startEmpty = lines.length === 1 && !lines[0].description && !lines[0].unitPrice;
        setLines(startEmpty ? newRows : [...lines, ...newRows]);
      }
      return;
    }

    // Fallback · send to AI parse-paste API · works for messy text without clear columns
    // Show a placeholder row that says "جارٍ التحليل..." while AI works
    const aiPlaceholder: InvoiceLine = {
      ...newLine(defaultTaxRate, inclusive),
      description: "⏳ جارٍ تحليل النص بالذكاء الاصطناعي...",
    };
    setLines([...lines, aiPlaceholder]);
    try {
      const api = (window as any).__entixApi;
      const result: any = api?.agent?.parsePaste
        ? await api.agent.parsePaste({ text, hint: "invoice" })
        : await fetch("/api/agent/parse-paste", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ text, hint: "invoice" }),
          }).then((r) => r.json());

      if (result?.rows && result.rows.length > 0) {
        const aiRows: InvoiceLine[] = result.rows.map((r: any) => ({
          ...newLine(defaultTaxRate, inclusive),
          description: r.description || "",
          quantity: String(r.quantity || 1),
          unitPrice: String(r.unitPrice || 0),
          taxRate: r.taxRate ?? defaultTaxRate,
          taxInclusive: r.taxInclusive ?? inclusive,
        }));
        setLines((prev) => prev.filter((l) => l.id !== aiPlaceholder.id).concat(aiRows));
      } else {
        // AI couldn't parse · keep first line as the entire blob
        setLines((prev) =>
          prev.map((l) => (l.id === aiPlaceholder.id ? { ...l, description: text.slice(0, 200) } : l)),
        );
      }
    } catch (err) {
      // On error · just put the raw text in description
      setLines((prev) =>
        prev.map((l) => (l.id === aiPlaceholder.id ? { ...l, description: text.slice(0, 200) } : l)),
      );
    }
  };

  const totals = computeTotals(lines);

  const showAccount = !hidden.account && (accounts.length > 0 || !!onCreateAccount);
  const showTax = !hidden.tax;
  const showTaxAmount = !hidden.taxAmount;
  const hiddenCount = Number(hidden.account) + Number(hidden.tax) + Number(hidden.taxAmount);

  const accountItems = accounts
    .filter((a) => direction === "sales" ? a.type === "INCOME" : a.type === "EXPENSE")
    .map((a) => ({ id: a.id, label: a.name, sublabel: a.code }));

  return (
    <div className="space-y-3">
      {/* Items table · paste handler on container */}
      <div
        ref={containerRef}
        onPaste={handlePaste}
        className="rounded-lg border border-[#E5E7EB] overflow-hidden bg-white"
      >
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: showAccount ? "1200px" : "900px" }}>
            <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
              <tr>
                <th className="py-2.5 px-2 w-8"></th>
                {products.length > 0 && (
                  <th className="py-2.5 px-3 text-start w-44" style={{ fontWeight: 600 }}>الصنف</th>
                )}
                <th className="py-2.5 px-3 text-start" style={{ fontWeight: 600 }}>الوصف</th>
                <th className="py-2.5 px-3 text-start w-20" style={{ fontWeight: 600 }}>الكمية</th>
                <th className="py-2.5 px-3 text-start w-28" style={{ fontWeight: 600 }}>السعر</th>
                {showAccount && (
                  <th className="py-2.5 px-3 text-start w-40" style={{ fontWeight: 600 }}>الحساب</th>
                )}
                {showTax && (
                  <th className="py-2.5 px-3 text-start w-24" style={{ fontWeight: 600 }}>الضريبة</th>
                )}
                {showTaxAmount && (
                  <th className="py-2.5 px-3 text-start w-28" style={{ fontWeight: 600 }}>مبلغ الضريبة</th>
                )}
                <th className="py-2.5 px-3 text-start w-28" style={{ fontWeight: 600 }}>المبلغ ({currency})</th>
                <th className="py-2.5 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {displayLines.map((line, i) => {
                const qty = Number(normalizeDigits(line.quantity)) || 0;
                const price = Number(normalizeDigits(line.unitPrice)) || 0;
                const gross = qty * price;
                const lineTax = line.taxInclusive ? gross - gross / (1 + line.taxRate) : gross * line.taxRate;
                const lineTotal = line.taxInclusive ? gross : gross + lineTax;
                const isReal = i < realLineCount;

                return (
                  <tr key={line.id} className="border-t border-[#F3F4F6] hover:bg-[#FAFBFC]">
                    <td className="px-1 py-1 text-center">
                      <GripVertical className="h-3.5 w-3.5 text-[#D1D5DB] mx-auto cursor-grab" />
                    </td>
                    {products.length > 0 && (
                      <td className="px-2 py-1">
                        <SearchableCombobox
                          value={line.productId || ""}
                          onChange={(id) => {
                            const p = products.find((x) => x.id === id);
                            if (p) onProductPick(i, p);
                          }}
                          onCreate={onCreateProduct ? async (name) => {
                            const p = await onCreateProduct(name);
                            onProductPick(i, p);
                            return p.id;
                          } : undefined}
                          items={products.map((p) => ({
                            id: p.id,
                            label: p.name,
                            sublabel: `${p.sku ? `${p.sku} · ` : ""}${p.unitPrice.toLocaleString()}`,
                          }))}
                          placeholder="ابحث عن صنف..."
                          createLabel={(q) => `+ إنشاء صنف "${q}"`}
                          className="border-0"
                        />
                      </td>
                    )}
                    <td className="px-2 py-1">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        onKeyDown={(e) => handleKeyDown(e, i, false)}
                        placeholder="الوصف"
                        className="border-0 focus:ring-1 focus:ring-[#1276E3]/30 h-8 bg-transparent"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={isReal ? line.quantity : ""}
                        onChange={(e) => updateLine(i, { quantity: normalizeDigits(e.target.value) })}
                        onKeyDown={(e) => handleKeyDown(e, i, false)}
                        dir="ltr"
                        className="border-0 focus:ring-1 focus:ring-[#1276E3]/30 h-8 font-english bg-transparent"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={isReal ? line.unitPrice : ""}
                        onChange={(e) => updateLine(i, { unitPrice: normalizeDigits(e.target.value) })}
                        onKeyDown={(e) => handleKeyDown(e, i, i === realLineCount - 1)}
                        dir="ltr"
                        className="border-0 focus:ring-1 focus:ring-[#1276E3]/30 h-8 font-english bg-transparent"
                      />
                    </td>
                    {showAccount && (
                      <td className="px-2 py-1">
                        <SearchableCombobox
                          value={line.accountId || ""}
                          onChange={(id) => updateLine(i, { accountId: id })}
                          items={accountItems}
                          placeholder="حساب"
                          className="border-0"
                        />
                      </td>
                    )}
                    {showTax && (
                      <td className="px-2 py-1">
                        <select
                          value={`${line.taxRate}-${line.taxInclusive ? "in" : "ex"}`}
                          onChange={(e) => {
                            const [rate, inc] = e.target.value.split("-");
                            updateLine(i, { taxRate: Number(rate), taxInclusive: inc === "in" });
                          }}
                          className="w-full h-8 rounded-md border-0 bg-transparent px-2 text-xs focus:ring-1 focus:ring-[#1276E3]/30"
                        >
                          <option value="0.15-ex">15% غير شامل</option>
                          <option value="0.15-in">15% شامل</option>
                          <option value="0-ex">0% (صفر)</option>
                          <option value="0-ex">معفى</option>
                        </select>
                      </td>
                    )}
                    {showTaxAmount && (
                      <td className="px-3 py-1 font-english text-sm text-[#6B7280]">
                        {gross > 0 ? lineTax.toFixed(2) : ""}
                      </td>
                    )}
                    <td className="px-3 py-1 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>
                      {gross > 0 ? lineTotal.toFixed(2) : ""}
                    </td>
                    <td className="px-1 py-1">
                      {isReal && (
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-red-50 hover:text-red-600"
                          title="حذف السطر"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer · add row + barcode + columns toggle */}
        <div className="border-t border-[#F3F4F6] px-3 py-2 bg-[#F9FAFB] flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addRow}
              className="text-sm text-[#1276E3] hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> إضافة سطر
            </button>
            {products.length > 0 && (
              <BarcodeScannerButton
                onScanned={(code) => {
                  // Find product by SKU/barcode match · case-insensitive
                  const match = products.find(
                    (p) => (p.sku || "").toLowerCase() === code.toLowerCase(),
                  );
                  if (match) {
                    // Find first empty line · or add new
                    const emptyIdx = lines.findIndex((l) => !l.description.trim() && !l.unitPrice);
                    if (emptyIdx >= 0) {
                      onProductPick(emptyIdx, match);
                    } else {
                      const inclusive = mode === "all-inclusive";
                      const newLineWithProduct: InvoiceLine = {
                        ...newLine(defaultTaxRate, inclusive),
                        productId: match.id,
                        description: match.name,
                        unitPrice: String(match.unitPrice),
                        accountId: match.accountId,
                        taxRate: match.taxRate ?? defaultTaxRate,
                      };
                      setLines([...lines, newLineWithProduct]);
                    }
                  } else {
                    // Could trigger product creation with SKU pre-filled · for now alert via toast pattern
                    console.warn("[barcode] no product matched SKU:", code);
                  }
                }}
              />
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setColsOpen(!colsOpen)}
              className="text-xs text-[#6B7280] hover:text-[#0B1B49] flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#E5E7EB] bg-white"
            >
              <Settings2 className="h-3.5 w-3.5" />
              الأعمدة ({hiddenCount} مخفية)
            </button>
            {colsOpen && (
              <div className="absolute end-0 top-full mt-1 w-44 rounded-md border border-[#E5E7EB] bg-white shadow-lg p-2 z-10">
                {[
                  { key: "account" as const, label: "الحساب" },
                  { key: "tax" as const, label: "الضريبة" },
                  { key: "taxAmount" as const, label: "مبلغ الضريبة" },
                ].map((c) => (
                  <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-[#F9FAFB] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hidden[c.key]}
                      onChange={(e) => setHidden({ ...hidden, [c.key]: !e.target.checked })}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
