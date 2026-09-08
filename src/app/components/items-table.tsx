import { displayLocale, displayDigits } from "../lib/number-display";
/**
 * ItemsTable v2 · multi-line invoice/quote/bill items
 *
 * Product requirement reference (Wafeq screenshot 2026-05-05):
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
import { useRef, useState, useMemo, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from "react";
import { Plus, Trash2, Settings2, Square, SquareCheck, Building2 } from "lucide-react";
import { Input } from "./ui/input";
import { SearchableCombobox } from "./searchable-combobox";
import { BarcodeScannerButton } from "./barcode-scanner";
import { normalizeDigits } from "../lib/digits";
import { useLanguage } from "./LanguageContext";

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
  /** Revenue recognition / deferred revenue · optional per-line schedule */
  recognitionStartDate?: string;        // ISO date (yyyy-mm-dd)
  recognitionMonths?: number;           // 1..120
  deferredRevenueAccountId?: string;    // LIABILITY account; server resolves when null
  /** Purchases only · auto-register this line as a fixed asset on bill save */
  isAsset?: boolean;
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
  /** Chart subtype · 'fixed'/'intangible' marks the fixed-asset branch */
  subtype?: string | null;
}

interface Props {
  lines: InvoiceLine[];
  setLines: React.Dispatch<React.SetStateAction<InvoiceLine[]>>;
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
  /** Optional external key to reset history when form changes */
  formKey?: string;
  /** Line ids that failed validation · rendered red so the user can spot & fix fast */
  invalidIds?: Set<string>;
}

export function newLine(taxRate = 0.15, taxInclusive = false): InvoiceLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    quantity: "1",
    unitPrice: "0",
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

// ض.ق.م + الاعتراف are off by default so the grid matches the approved 7-column anatomy;
// both stay one click away in the "الأعمدة" menu.
const DEFAULT_HIDDEN_COLS = { account: false, tax: false, taxAmount: true, recognition: true };

const ROW_BORDER_CLASS = "border-border/30";

function normalizeNumberCell(value: string) {
  return normalizeDigits(value)
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "")
    .trim();
}

function isNumericCell(value: string) {
  const cleaned = normalizeNumberCell(value);
  return /^-?\d+(\.\d+)?$/.test(cleaned);
}

function splitStructuredRow(row: string, hasTabs: boolean) {
  return (hasTabs ? row.split("\t") : row.split(",")).map((cell) => cell.trim()).filter(Boolean);
}

function isLikelyHeaderRow(cols: string[]) {
  const label = cols.join(" ").toLowerCase();
  return /description|item|qty|quantity|price|amount|الوصف|الصنف|الكمية|السعر|المبلغ/.test(label);
}

function mergeProductDescription(productName: string, existingDescription?: string) {
  const template = (productName || "").trim();
  const userText = (existingDescription || "").trim();
  if (!template) return userText;
  if (!userText) return template;

  const userLines = userText.split("\n");
  const firstLine = (userLines[0] || "").trim();
  if (firstLine === template) return userText;

  return `${template}\n${userText}`;
}

function AutoGrowTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  title,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  title?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 30), 160)}px`;
  };
  useEffect(() => { resize(); }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onInput={resize}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      title={title}
      rows={1}
      style={{ minHeight: "22px", maxHeight: "160px", resize: "none", overflow: "hidden" }}
      className="w-full border-0 bg-transparent px-2 text-[13px] leading-[22px] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--brand-blue-600)]"
    />
  );
}

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
  formKey,
  invalidIds,
}: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(DEFAULT_HIDDEN_COLS);
  const [colsOpen, setColsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Undo / Redo history
  const historyRef = useRef<{ past: InvoiceLine[][]; present: InvoiceLine[]; future: InvoiceLine[][] }>({ past: [], present: lines, future: [] });
  const isUndoingRef = useRef(false);

  useEffect(() => {
    if (isUndoingRef.current) { isUndoingRef.current = false; return; }
    historyRef.current.past.push(historyRef.current.present);
    historyRef.current.present = lines;
    if (historyRef.current.past.length > 50) historyRef.current.past.shift();
  }, [lines]);

  useEffect(() => {
    historyRef.current = { past: [], present: lines, future: [] };
  }, [formKey]);

  const undo = () => {
    const { past, present } = historyRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    historyRef.current.past = past.slice(0, -1);
    historyRef.current.future = [present, ...historyRef.current.future];
    historyRef.current.present = previous;
    isUndoingRef.current = true;
    setLines(previous);
  };

  const redo = () => {
    const { future, present } = historyRef.current;
    if (future.length === 0) return;
    const next = future[0];
    historyRef.current.future = future.slice(1);
    historyRef.current.past = [...historyRef.current.past, present];
    historyRef.current.present = next;
    isUndoingRef.current = true;
    setLines(next);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", handler as any);
    return () => document.removeEventListener("keydown", handler as any);
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    const realIds = lines.map((l) => l.id);
    const allSelected = realIds.every((id) => selected.has(id));
    if (allSelected) {
      const next = new Set(selected);
      realIds.forEach((id) => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      realIds.forEach((id) => next.add(id));
      setSelected(next);
    }
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    setLines(lines.filter((l) => !selected.has(l.id)));
    setSelected(new Set());
  };

  const allSelected = lines.length > 0 && lines.every((l) => selected.has(l.id));

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
    const existing = displayLines[idx];
    const combined = mergeProductDescription(product.name, existing?.description);
    updateLine(idx, {
      productId: product.id,
      description: combined,
      unitPrice: String(product.unitPrice ?? 0),
      accountId: product.accountId || existing?.accountId,
      taxRate: product.taxRate ?? existing?.taxRate ?? defaultTaxRate,
    });
  };

  const handleModeChange = (m: TaxMode) => {
    onModeChange(m);
    if (m === "all-inclusive") setLines(lines.map((l: InvoiceLine) => ({ ...l, taxInclusive: true })));
    else if (m === "all-exclusive") setLines(lines.map((l: InvoiceLine) => ({ ...l, taxInclusive: false })));
  };

  void handleModeChange;

  const _totals = computeTotals(lines);
  void _totals;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number, isLast: boolean) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isLast && idx === realLineCount - 1) addRow();
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const rows = text.split(/\r?\n/).filter((r) => r.trim());
    const hasTabs = text.includes("\t");
    const commaCount = (rows[0]?.match(/,/g) || []).length;
    const looksLikeCsv = rows.length >= 2 && commaCount > 0 && rows.every((r) => (r.match(/,/g) || []).length === commaCount);
    const structuredPaste = hasTabs || looksLikeCsv || (target?.tagName !== "TEXTAREA" && rows.length > 1);
    if (!structuredPaste) return;

    e.preventDefault();
    const inclusive = mode === "all-inclusive";

    if (hasTabs || looksLikeCsv) {
      const newRows: InvoiceLine[] = [];
      for (const row of rows) {
        const cols = splitStructuredRow(row, hasTabs);
        if (cols.length === 0 || isLikelyHeaderRow(cols)) continue;
        const numericIndexes = cols.map((col, idx) => isNumericCell(col) ? idx : -1).filter((idx) => idx >= 0);
        const priceIndex = numericIndexes.length ? numericIndexes[numericIndexes.length - 1] : undefined;
        const qtyIndex = numericIndexes.length >= 2 ? numericIndexes[numericIndexes.length - 2] : undefined;
        const textCells = cols.filter((_, idx) => idx !== priceIndex && idx !== qtyIndex);
        const firstText = textCells[0] || cols[0] || "";
        const product = products.find((p) =>
          p.name.toLowerCase() === firstText.toLowerCase() ||
          (p.sku || "").toLowerCase() === firstText.toLowerCase()
        );
        const descriptionCells = product ? textCells.slice(1) : textCells;
        const description = (descriptionCells.join(" · ") || product?.name || firstText).trim();
        if (!description && priceIndex === undefined) continue;
        newRows.push({
          ...newLine(defaultTaxRate, inclusive),
          productId: product?.id,
          accountId: product?.accountId,
          description,
          quantity: qtyIndex !== undefined ? normalizeNumberCell(cols[qtyIndex]) : "1",
          unitPrice: priceIndex !== undefined ? normalizeNumberCell(cols[priceIndex]) : "",
          taxRate: product?.taxRate ?? defaultTaxRate,
        });
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
      description: t("⏳ جارٍ تحليل النص بالذكاء الاصطناعي...", "⏳ Analyzing text with AI..."),
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
        setLines((prev: InvoiceLine[]) => prev.filter((l) => l.id !== aiPlaceholder.id).concat(aiRows));
      } else {
        // AI couldn't parse · keep first line as the entire blob
        setLines((prev: InvoiceLine[]) =>
          prev.map((l) => (l.id === aiPlaceholder.id ? { ...l, description: text.slice(0, 200) } : l)),
        );
      }
    } catch (err) {
      // On error · just put the raw text in description
      setLines((prev: InvoiceLine[]) =>
        prev.map((l) => (l.id === aiPlaceholder.id ? { ...l, description: text.slice(0, 200) } : l)),
      );
    }
  };

  const totals = computeTotals(lines);
  void totals;

  const showAccount = !hidden.account && (accounts.length > 0 || !!onCreateAccount);
  const showTax = !hidden.tax;
  const showTaxAmount = !hidden.taxAmount;
  const showRecognition = !hidden.recognition;
  const showAssetCol = direction === "purchases";
  /** Xero-style: accounts inside the fixed-asset branch auto-register the line as an asset (no flag needed) */
  const fixedAssetAccountIds = new Set(
    accounts
      .filter((a) => a.type === "ASSET" && /fixed|intangible/i.test(a.subtype || ""))
      .map((a) => a.id),
  );
  const hiddenCount = Number(hidden.account) + Number(hidden.tax) + Number(hidden.taxAmount) + Number(hidden.recognition);

  // Backend uses REVENUE not INCOME · accept both for compatibility
  const accountItems = accounts
    .filter((a) => direction === "sales"
      ? (a.type === "REVENUE" || a.type === "INCOME")
      : a.type === "EXPENSE")
    .map((a) => ({ id: a.id, label: a.name, sublabel: a.code }));

  // Ledger dense grid · column track list mirrors the approved reference
  // (# · البند · الوصف · الكمية · السعر · [الحساب] · [الضريبة] · المبلغ · [ض.ق.م] · الإجمالي · [الاعتراف] · [أصل] · حذف)
  const gridTemplate = [
    "36px",
    "150px",
    "minmax(0, 1fr)",
    "70px",
    "100px",
    showAccount ? "170px" : null,
    showTax ? "96px" : null,
    "110px",
    showTaxAmount ? "110px" : null,
    "130px",
    showRecognition ? "150px" : null,
    showAssetCol ? "44px" : null,
    "32px",
  ].filter(Boolean).join(" ");
  const gridMinWidth =
    36 + 150 + 200 + 70 + 100 + (showAccount ? 170 : 0) + (showTax ? 96 : 0) + 110 +
    (showTaxAmount ? 110 : 0) + 130 + (showRecognition ? 150 : 0) + (showAssetCol ? 44 : 0) + 32;

  return (
    <div className="space-y-3">
      {/* Items grid · paste handler on container */}
      <div
        ref={containerRef}
        onPaste={handlePaste}
        className="ledger-grid-dense"
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: gridMinWidth }}>
            {/* Header row */}
            <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
              <span className="cell h idx">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="group inline-flex h-full w-full items-center justify-center text-content-secondary hover:text-foreground"
                  title={allSelected ? t("إلغاء تحديد الكل", "Clear all") : t("تحديد الكل", "Select all")}
                >
                  {allSelected
                    ? <SquareCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                    : <>
                        <span className="group-hover:hidden">#</span>
                        <Square className="hidden h-3.5 w-3.5 group-hover:block" strokeWidth={1.75} />
                      </>}
                </button>
              </span>
              <span className="cell h">{t("البند", "Item")}</span>
              <span className="cell h">{t("الوصف", "Description")}</span>
              <span className="cell h n">{t("الكمية", "Qty")}</span>
              <span className="cell h n">{t("السعر", "Price")}</span>
              {showAccount && <span className="cell h">{t("الحساب", "Account")}</span>}
              {showTax && <span className="cell h n">{t("الضريبة", "Tax")}</span>}
              <span className="cell h n">{t("المبلغ", "Amount")} ({currency})</span>
              {showTaxAmount && <span className="cell h n">{t("ض.ق.م", "VAT amt")}</span>}
              <span className="cell h n">{t("الإجمالي", "Total")} ({currency})</span>
              {showRecognition && (
                <span className="cell h">
                  <span className="inline-flex items-center gap-1.5">
                    {t("الاعتراف", "Recognition")}
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">{t("جديد", "New")}</span>
                  </span>
                </span>
              )}
              {showAssetCol && (
                <span className="cell h" title={t("تسجيل السطر كأصل ثابت تلقائياً عند الحفظ", "Auto-register this line as a fixed asset on save")}>{t("أصل", "Asset")}</span>
              )}
              <span className="cell h" />
            </div>

            {/* Line rows */}
            {displayLines.map((line, i) => {
              const qty = Number(normalizeDigits(line.quantity)) || 0;
              const price = Number(normalizeDigits(line.unitPrice)) || 0;
              const gross = qty * price;
              const lineTax = line.taxInclusive ? gross - gross / (1 + line.taxRate) : gross * line.taxRate;
              const lineNet = line.taxInclusive ? gross / (1 + line.taxRate) : gross;
              const lineTotal = line.taxInclusive ? gross : gross + lineTax;
              const isReal = i < realLineCount;
              const isInvalid = isReal && !!invalidIds?.has(line.id);
              const isSelected = isReal && selected.has(line.id);

              return (
                <div
                  key={line.id}
                  className={`grid ${ROW_BORDER_CLASS} ${isInvalid ? "ring-1 ring-inset ring-danger [&_.cell]:bg-danger-subtle" : ""}`}
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <span className="cell idx">
                    <button
                      type="button"
                      onClick={() => isReal && toggleSelect(line.id)}
                      disabled={!isReal}
                      aria-pressed={isSelected}
                      className="group inline-flex h-full w-full items-center justify-center text-content-secondary hover:text-foreground disabled:opacity-40"
                      title={t("تحديد السطر", "Select line")}
                    >
                      {isSelected
                        ? <SquareCheck className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                        : <>
                            <span className="group-hover:hidden">{i + 1}</span>
                            <Square className="hidden h-3.5 w-3.5 group-hover:block" strokeWidth={1.75} />
                          </>}
                    </button>
                  </span>
                  <span className="cell !px-1">
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
                        sublabel: `${p.sku ? `${p.sku} · ` : ""}${(Number(p.unitPrice) || 0).toLocaleString(displayLocale(), { maximumFractionDigits: 2 })}`,
                      }))}
                      placeholder={t("منتج أو خدمة…", "Product or service…")}
                      createLabel={(q) => t("+ إنشاء صنف", "+ Create item") + ` "${q}"`}
                      borderless
                      buttonClassName="min-h-8 h-auto py-1 px-2 text-[13px] rounded-md"
                      menuMinWidth={360}
                      wrap
                    />
                  </span>
                  <span className="cell !px-1">
                    <AutoGrowTextarea
                      value={line.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                      onKeyDown={(e) => {
                        // Shift+Enter = newline inside cell · Enter alone = next row
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleKeyDown(e as any, i, false);
                        }
                        // Shift+Enter is allowed default behavior (newline)
                      }}
                      placeholder={t("الوصف", "Description")}
                      title={t("Shift+Enter لسطر جديد داخل الخلية", "Shift+Enter for a newline inside the cell")}
                    />
                  </span>
                  <span className="cell n">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={isReal ? line.quantity : ""}
                      onChange={(e) => updateLine(i, { quantity: normalizeDigits(e.target.value) })}
                      onKeyDown={(e) => handleKeyDown(e, i, false)}
                      dir="ltr"
                      className="font-english text-[13px] text-end"
                    />
                  </span>
                  <span className="cell n">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={isReal ? line.unitPrice : ""}
                      onChange={(e) => updateLine(i, { unitPrice: normalizeDigits(e.target.value) })}
                      onKeyDown={(e) => handleKeyDown(e, i, i === realLineCount - 1)}
                      dir="ltr"
                      className="font-english text-[13px] text-end"
                    />
                  </span>
                  {showAccount && (
                    <span className="cell !px-1">
                      <SearchableCombobox
                        value={line.accountId || ""}
                        onChange={(id) => updateLine(i, { accountId: id })}
                        items={accountItems}
                        placeholder={t("حساب…", "Account…")}
                        borderless
                        buttonClassName="min-h-8 h-auto py-1 px-2 text-[13px] rounded-md"
                        menuMinWidth={520}
                        wrap
                        onCreate={onCreateAccount ? async (name) => {
                          const a = await onCreateAccount(name);
                          updateLine(i, { accountId: a.id });
                          return a.id;
                        } : undefined}
                        createLabel={(q) => t("+ إنشاء حساب جديد", "+ Create account") + ` "${q}"`}
                      />
                    </span>
                  )}
                  {showTax && (
                    <span className="cell n !px-1">
                      <select
                        value={`${line.taxRate}-${line.taxInclusive ? "in" : "ex"}`}
                        onChange={(e) => {
                          const [rate, inc] = e.target.value.split("-");
                          updateLine(i, { taxRate: Number(rate), taxInclusive: inc === "in" });
                        }}
                        className="h-8 w-full border-0 bg-transparent px-1 text-[12px] leading-tight text-end focus:outline-none"
                      >
                        <option value="0.15-ex">{t("15% غير شامل", "15% excluded")}</option>
                        <option value="0.15-in">{t("15% شامل", "15% included")}</option>
                        <option value="0-ex">{t("0% (صفر)", "0% (zero-rated)")}</option>
                        <option value="0-ex">{t("معفى", "Exempt")}</option>
                      </select>
                    </span>
                  )}
                  <span className="cell n font-english text-foreground">
                    {gross > 0 ? displayDigits(lineNet.toFixed(2)) : ""}
                  </span>
                  {showTaxAmount && (
                    <span className="cell n font-english text-content-secondary">
                      {gross > 0 ? displayDigits(lineTax.toFixed(2)) : ""}
                    </span>
                  )}
                  <span className="cell n font-display !bg-surface-subtle text-[15px] text-foreground">
                    {gross > 0 ? displayDigits(lineTotal.toFixed(2)) : ""}
                  </span>
                  {showRecognition && (
                    <span className="cell !px-1">
                      {isReal && gross > 0 ? (
                        <div className="flex w-full items-center gap-1">
                          <Input
                            type="date"
                            value={line.recognitionStartDate || ""}
                            onChange={(e) => updateLine(i, { recognitionStartDate: e.target.value || undefined })}
                            className="text-[11px]"
                            dir="ltr"
                            title={t("بداية الاعتراف بالإيراد", "Revenue recognition start")}
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={120}
                            value={line.recognitionMonths ? String(line.recognitionMonths) : ""}
                            onChange={(e) => updateLine(i, { recognitionMonths: e.target.value ? Number(e.target.value) : undefined })}
                            placeholder={t("أشهر", "Months")}
                            className="font-english text-[11px]"
                            dir="ltr"
                          />
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </span>
                  )}
                  {showAssetCol && (
                    <span className="cell justify-center !px-0">
                      {isReal && gross > 0 ? (
                        line.accountId && fixedAssetAccountIds.has(line.accountId) ? (
                          <span
                            className="inline-flex items-center justify-center rounded-md p-1 text-success"
                            title={t("الحساب ضمن فرع الأصول · سيُسجَّل كأصل ثابت تلقائياً عند الحفظ", "Account sits in the assets branch · auto-registers as a fixed asset on save")}
                          >
                            <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </span>
                        ) : (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={line.isAsset === true}
                            onClick={() => updateLine(i, { isAsset: !line.isAsset })}
                            title={line.isAsset ? t("سيُسجَّل كأصل ثابت عند الحفظ · اضغط للإلغاء", "Registers as a fixed asset on save · click to undo") : t("تسجيل السطر كأصل ثابت تلقائياً عند الحفظ", "Auto-register this line as a fixed asset on save")}
                            className={`rounded-md p-1 transition-colors ${line.isAsset ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </span>
                  )}
                  <span className="cell justify-center !px-0">
                    {isReal && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="rounded-md p-1 text-muted-foreground hover:text-danger"
                        title={t("حذف السطر", "Delete line")}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer · quiet "+ سطر" pill + cashier input + barcode + columns toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-subtle px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary hover:border-border-strong"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("سطر", "Line")}
            </button>
            <span className="text-muted-foreground">{t("Enter ينتقل للسطر التالي · Tab بين الخلايا", "Enter moves to the next line · Tab between cells")}</span>

            {selected.size > 0 && (
              <button
                type="button"
                onClick={deleteSelected}
                className="flex items-center gap-1 text-xs text-danger hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("حذف {n} سطر", "Delete {n} lines").replace("{n}", String(selected.size))}
              </button>
            )}

            {/* Cashier mode · type SKU/code + Enter → product drops in */}
            {products.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{t("كاشير:", "Cashier:")}</span>
                <input
                  type="text"
                  placeholder={t("ادخل الكود + Enter", "Enter code + Enter")}
                  className="w-40 rounded-full border border-border bg-card px-3 py-1 font-english text-xs focus:outline-none"
                  dir="ltr"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const code = (e.target as HTMLInputElement).value.trim();
                    if (!code) return;
                    // Try SKU match first · then by id · then by name
                    const match = products.find(p =>
                      (p.sku || "").toLowerCase() === code.toLowerCase() ||
                      p.id === code ||
                      p.name.toLowerCase() === code.toLowerCase()
                    );
                    if (match) {
                      const emptyIdx = lines.findIndex(l => !l.description.trim() && !l.unitPrice);
                      if (emptyIdx >= 0) {
                        onProductPick(emptyIdx, match);
                      } else {
                        const inclusive = mode === "all-inclusive";
                        const newLineWithProduct: InvoiceLine = {
                          ...newLine(defaultTaxRate, inclusive),
                          productId: match.id,
                          description: mergeProductDescription(match.name),
                          unitPrice: String(match.unitPrice),
                          accountId: match.accountId,
                          taxRate: match.taxRate ?? defaultTaxRate,
                        };
                        setLines([...lines, newLineWithProduct]);
                      }
                      (e.target as HTMLInputElement).value = "";
                    } else {
                      console.warn("[cashier] no match for:", code);
                      (e.target as HTMLInputElement).select();
                    }
                  }}
                />
              </div>
            )}
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
                        description: mergeProductDescription(match.name),
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
          <div className="relative flex items-center gap-3">
            <span className="text-muted-foreground">{t("{n} بنود", "{n} lines").replace("{n}", String(realLineCount))}</span>
            <button
              type="button"
              onClick={() => setColsOpen(!colsOpen)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-content-secondary hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t("الأعمدة ({n} مخفية)", "Columns ({n} hidden)").replace("{n}", String(hiddenCount))}
            </button>
            {colsOpen && (
              <div className="absolute end-0 top-full mt-1 w-44 rounded-md border border-border bg-card shadow-lg p-2 z-10">
                {[
                  { key: "account" as const, label: t("الحساب", "Account") },
                  { key: "tax" as const, label: t("الضريبة", "Tax") },
                  { key: "taxAmount" as const, label: t("مبلغ الضريبة", "Tax amount") },
                  { key: "recognition" as const, label: t("الاعتراف بالإيرادات", "Revenue recognition") },
                ].map((c) => (
                  <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/50 rounded cursor-pointer">
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
