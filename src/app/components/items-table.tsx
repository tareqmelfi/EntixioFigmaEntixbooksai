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

const DEFAULT_HIDDEN_COLS = { account: false, tax: false, taxAmount: false, recognition: true };

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
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
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
      rows={1}
      style={{ minHeight: "30px", maxHeight: "160px", resize: "none", overflow: "hidden" }}
      className="w-full border-0 focus:ring-1 focus:ring-primary/30 bg-transparent text-xs leading-5 py-1 px-2 outline-none"
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

  return (
    <div className="space-y-3">
      {/* Items table · paste handler on container */}
      <div
        ref={containerRef}
        onPaste={handlePaste}
        className="rounded-lg border border-border overflow-hidden bg-card"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "100%" }}>
            <colgroup>
              <col className="w-8" />
              <col className="min-w-[140px] w-[14%]" />
              <col className="min-w-[260px] w-[32%]" />
              <col className="min-w-[72px] w-[7%]" />
              <col className="min-w-[104px] w-[9%]" />
              {showAccount && <col className="min-w-[220px] w-[18%]" />}
              {showTax && <col className="min-w-[124px] w-[10%]" />}
              <col className="min-w-[120px] w-[9%]" />
              {showTaxAmount && <col className="min-w-[120px] w-[9%]" />}
              <col className="min-w-[132px] w-[10%]" />
              {showRecognition && <col className="min-w-[150px] w-[12%]" />}
              {showAssetCol && <col className="w-[52px]" />}
              <col className="w-10" />
            </colgroup>
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="py-2.5 px-2 w-8">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-muted-foreground/70 hover:text-foreground"
                    title={allSelected ? t("إلغاء تحديد الكل", "Clear all") : t("تحديد الكل", "Select all")}
                  >
                    {allSelected ? <SquareCheck className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                {(/* show column even when products empty · allows quick-create */ products.length >= 0) && (
                  <th className="py-2.5 px-3 text-start" style={{ fontWeight: 600 }}>{t("الصنف", "Item")}</th>
                )}
                <th className="py-2.5 px-3 text-start" style={{ fontWeight: 600 }}>{t("الوصف", "Description")}</th>
                <th className="py-2.5 px-3 text-start" style={{ fontWeight: 600 }}>{t("الكمية", "Qty")}</th>
                <th className="py-2.5 px-3 text-start" style={{ fontWeight: 600 }}>{t("السعر", "Price")}</th>
                {showAccount && (
                  <th className="py-2.5 px-3 text-start" style={{ fontWeight: 600 }}>{t("الحساب", "Account")}</th>
                )}
                {showTax && (
                  <th className="py-2.5 px-3 text-start" style={{ fontWeight: 600 }}>{t("الضريبة", "Tax")}</th>
                )}
                <th className="py-2.5 px-3 text-end" style={{ fontWeight: 600 }}>{t("المبلغ", "Amount")} ({currency})</th>
                {showTaxAmount && (
                  <th className="py-2.5 px-3 text-end" style={{ fontWeight: 600 }}>{t("ض.ق.م", "VAT amt")}</th>
                )}
                <th className="py-2.5 px-3 text-end" style={{ fontWeight: 600 }}>{t("الإجمالي", "Total")} ({currency})</th>
                {showRecognition && (
                  <th className="py-2.5 px-3 text-start" style={{ fontWeight: 600 }}>
                    <span className="inline-flex items-center gap-1.5">
                      {t("الاعتراف", "Recognition")}
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-white">{t("جديد", "New")}</span>
                    </span>
                  </th>
                )}
                {showAssetCol && (
                  <th className="py-2.5 px-1 text-center" style={{ fontWeight: 600 }} title={t("تسجيل السطر كأصل ثابت تلقائياً عند الحفظ", "Auto-register this line as a fixed asset on save")}>{t("أصل", "Asset")}</th>
                )}
                <th className="py-2.5 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {displayLines.map((line, i) => {
                const qty = Number(normalizeDigits(line.quantity)) || 0;
                const price = Number(normalizeDigits(line.unitPrice)) || 0;
                const gross = qty * price;
                const lineTax = line.taxInclusive ? gross - gross / (1 + line.taxRate) : gross * line.taxRate;
                const lineNet = line.taxInclusive ? gross / (1 + line.taxRate) : gross;
                const lineTotal = line.taxInclusive ? gross : gross + lineTax;
                const isReal = i < realLineCount;
                const isInvalid = isReal && !!invalidIds?.has(line.id);

                return (
                  <tr
                    key={line.id}
                    className={`border-t ${ROW_BORDER_CLASS} ${
                      isInvalid
                        ? "bg-red-50/80 hover:bg-red-100/60 ring-1 ring-inset ring-red-400"
                        : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => isReal && toggleSelect(line.id)}
                        className="text-muted-foreground/70 hover:text-foreground disabled:opacity-30"
                        disabled={!isReal}
                      >
                        {isReal && selected.has(line.id) ? <SquareCheck className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    {(/* show column even when products empty · allows quick-create */ products.length >= 0) && (
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
                            sublabel: `${p.sku ? `${p.sku} · ` : ""}${(Number(p.unitPrice) || 0).toLocaleString()}`,
                          }))}
                          placeholder={t("ابحث عن صنف...", "Search item...")}
                          createLabel={(q) => t("+ إنشاء صنف", "+ Create item") + ` "${q}"`}
                          borderless
                          buttonClassName="min-h-7 h-auto py-1 px-2 text-xs rounded-md"
                          menuMinWidth={360}
                          wrap
                        />
                      </td>
                    )}
                    <td className="px-2 py-1 align-top">
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
                        placeholder={t("الوصف · Shift+Enter لسطر جديد داخل الخلية", "Description · Shift+Enter for a newline inside the cell")}
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
                        className="border-0 focus:ring-1 focus:ring-primary/30 h-7 font-english bg-transparent text-xs"
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
                        className="border-0 focus:ring-1 focus:ring-primary/30 h-7 font-english bg-transparent text-xs"
                      />
                    </td>
                    {showAccount && (
                      <td className="px-2 py-1">
                        <SearchableCombobox
                          value={line.accountId || ""}
                          onChange={(id) => updateLine(i, { accountId: id })}
                          items={accountItems}
                          placeholder={t("ابحث عن حساب...", "Search account...")}
                          borderless
                          buttonClassName="min-h-7 h-auto py-1 px-2 text-xs rounded-md"
                          menuMinWidth={520}
                          wrap
                          onCreate={onCreateAccount ? async (name) => {
                            const a = await onCreateAccount(name);
                            updateLine(i, { accountId: a.id });
                            return a.id;
                          } : undefined}
                          createLabel={(q) => t("+ إنشاء حساب جديد", "+ Create account") + ` "${q}"`}
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
                          className="w-full h-7 rounded-md border-0 bg-transparent px-1.5 text-[11px] leading-tight focus:ring-1 focus:ring-primary/30"
                        >
                          <option value="0.15-ex">{t("15% غير شامل", "15% excluded")}</option>
                          <option value="0.15-in">{t("15% شامل", "15% included")}</option>
                          <option value="0-ex">{t("0% (صفر)", "0% (zero-rated)")}</option>
                          <option value="0-ex">{t("معفى", "Exempt")}</option>
                        </select>
                      </td>
                    )}
                    <td className="px-2 py-1 font-english text-xs text-foreground whitespace-nowrap text-end table-cell">
                      {gross > 0 ? lineNet.toFixed(2) : ""}
                    </td>
                    {showTaxAmount && (
                      <td className="px-2 py-1 font-english text-xs text-muted-foreground whitespace-nowrap text-end table-cell">
                        {gross > 0 ? lineTax.toFixed(2) : ""}
                      </td>
                    )}
                    <td className="px-2 py-1 font-english text-xs text-foreground whitespace-nowrap text-end table-cell" style={{ fontWeight: 700 }}>
                      {gross > 0 ? lineTotal.toFixed(2) : ""}
                    </td>
                    {showRecognition && (
                      <td className="px-2 py-1">
                        {isReal && gross > 0 ? (
                          <div className="flex flex-col gap-1">
                            <Input
                              type="date"
                              value={line.recognitionStartDate || ""}
                              onChange={(e) => updateLine(i, { recognitionStartDate: e.target.value || undefined })}
                              className="h-7 border-0 bg-transparent px-1 text-[11px] focus:ring-1 focus:ring-primary/30"
                              dir="ltr"
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={120}
                              value={line.recognitionMonths ? String(line.recognitionMonths) : ""}
                              onChange={(e) => updateLine(i, { recognitionMonths: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder={t("أشهر", "Months")}
                              className="h-7 border-0 bg-transparent px-1 text-[11px] font-english focus:ring-1 focus:ring-primary/30"
                              dir="ltr"
                            />
                            {line.recognitionStartDate && line.recognitionMonths ? (
                              <span className="text-[10px] text-primary leading-tight">
                                {t("{m} شهر · يبدأ {d}", "{m} months · starts {d}").replace("{m}", String(line.recognitionMonths)).replace("{d}", line.recognitionStartDate || "")}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50">—</span>
                        )}
                      </td>
                    )}
                    {showAssetCol && (
                      <td className="px-1 py-1 text-center">
                        {isReal && gross > 0 ? (
                          line.accountId && fixedAssetAccountIds.has(line.accountId) ? (
                            <span
                              className="inline-flex items-center justify-center rounded-md bg-emerald-100 p-1.5 text-emerald-700 ring-1 ring-emerald-300"
                              title={t("الحساب ضمن فرع الأصول · سيُسجَّل كأصل ثابت تلقائياً عند الحفظ", "Account sits in the assets branch · auto-registers as a fixed asset on save")}
                            >
                              <Building2 className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={line.isAsset === true}
                              onClick={() => updateLine(i, { isAsset: !line.isAsset })}
                              title={line.isAsset ? t("سيُسجَّل كأصل ثابت عند الحفظ · اضغط للإلغاء", "Registers as a fixed asset on save · click to undo") : t("تسجيل السطر كأصل ثابت تلقائياً عند الحفظ", "Auto-register this line as a fixed asset on save")}
                              className={`rounded-md p-1.5 transition-colors ${line.isAsset ? "bg-primary/10 text-primary ring-1 ring-primary/40" : "text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground"}`}
                            >
                              <Building2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-1 py-1">
                      {isReal && (
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="rounded-md p-1.5 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                          title={t("حذف السطر", "Delete line")}
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

        {/* Footer · add row + cashier input + barcode + columns toggle */}
        <div className="border-t border-border/50 px-3 py-2 bg-muted/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addRow}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> {t("إضافة سطر", "Add line")}
            </button>

            {selected.size > 0 && (
              <button
                type="button"
                onClick={deleteSelected}
                className="text-sm text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("حذف {n} سطر", "Delete {n} lines").replace("{n}", String(selected.size))}
              </button>
            )}

            {/* Cashier mode · type SKU/code + Enter → product drops in */}
            {products.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{t("كاشير:", "Cashier:")}</span>
                <input
                  type="text"
                  placeholder={t("ادخل الكود + Enter", "Enter code + Enter")}
                  className="text-sm rounded border border-border px-2 py-1 w-40 font-english focus:ring-1 focus:ring-primary/30"
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setColsOpen(!colsOpen)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card"
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
