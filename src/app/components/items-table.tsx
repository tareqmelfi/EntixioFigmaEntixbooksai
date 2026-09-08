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
import { api } from "../lib/api";
import { taxRateShortLabel, useTaxRates } from "../lib/use-tax-rates";

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
  /**
   * The org's TaxRate row this line was priced with. The editors send it to the
   * API; before it existed the API saw no rate at all and stored taxTotal = 0
   * (a 400 quote reached the client as 400 instead of 460).
   */
  taxRateId?: string;
  notes?: string;
  /** Revenue recognition / deferred revenue · optional per-line schedule */
  recognitionStartDate?: string;        // ISO date (yyyy-mm-dd)
  recognitionMonths?: number;           // 1..120
  deferredRevenueAccountId?: string;    // LIABILITY account; server resolves when null
  /** Purchases only · auto-register this line as a fixed asset on bill save */
  isAsset?: boolean;
  /** Account was filled by the suggestion engine (not yet confirmed by the user) · shows the «مقترح» chip */
  accountSuggested?: boolean;
  /** How the suggestion engine picked the account (product · history · keyword · category · mapping · first) */
  accountVia?: string;
}

/** Result of the account suggestion endpoint (POST /api/accounts/suggest) */
export interface AccountSuggestion {
  accountId: string | null;
  code?: string | null;
  name?: string | null;
  via?: string;
  confidence?: number;
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
  /** Inline error shown under the grid (e.g. the approval law message) · pairs with invalidIds */
  errorMessage?: string | null;
  /** Contact on the document · lets the suggestion engine use history with the same customer/supplier */
  contactId?: string | null;
  /**
   * Account suggestion source · defaults to `api.accounts.suggest`.
   * A line that gets a description / product / price with an empty account is filled
   * automatically (debounced · cached per line text) and marked «مقترح» until the user changes it.
   */
  suggestAccount?: (input: { kind: "sales" | "purchase"; text: string; productId?: string | null; contactId?: string | null }) => Promise<AccountSuggestion | null>;
  /** Disable auto-suggestion (tests · read-only grids) */
  autoSuggest?: boolean;
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

/**
 * Tax-rate parsing that never yields NaN (OCR/API may send 0.15 · 15 · "15%" · "15% شامل" · null).
 * Returns the fraction and, when the text says so, whether the price is tax-inclusive.
 */
export function normalizeTaxRate(value: unknown, fallback = 0): { rate: number; inclusive?: boolean } {
  if (value == null || value === "") return { rate: fallback };
  if (typeof value === "object") {
    const rel = value as { rate?: unknown };
    return normalizeTaxRate(rel.rate, fallback);
  }
  let inclusive: boolean | undefined;
  let raw = value;
  if (typeof value === "string") {
    const text = normalizeDigits(value);
    if (/غير\s*شامل|exclusive|excl/i.test(text)) inclusive = false;
    else if (/شامل|inclusive|incl/i.test(text)) inclusive = true;
    const m = text.match(/-?\d+(?:\.\d+)?/);
    if (!m) return { rate: fallback, inclusive };
    raw = m[0];
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { rate: fallback, inclusive };
  // 15 → 0.15 (percent) · 0.15 stays · 100 → 1 is not a VAT rate so treat >1 as percent
  const rate = n > 1 ? n / 100 : n;
  return { rate: Math.round(rate * 10000) / 10000, inclusive };
}

/** Safe fraction for a line (guards undefined / NaN rates from legacy rows) */
export function lineTaxRate(l: Pick<InvoiceLine, "taxRate">): number {
  const r = Number(l.taxRate);
  return Number.isFinite(r) && r >= 0 ? r : 0;
}

export function computeTotals(lines: InvoiceLine[]) {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    if (!l.description.trim() && !l.unitPrice) continue;
    const qty = Number(normalizeDigits(l.quantity)) || 0;
    const price = Number(normalizeDigits(l.unitPrice)) || 0;
    const lineGross = qty * price;
    const rate = lineTaxRate(l);
    if (l.taxInclusive) {
      const net = lineGross / (1 + rate);
      const lineTax = lineGross - net;
      subtotal += net;
      tax += lineTax;
    } else {
      const lineTax = lineGross * rate;
      subtotal += lineGross;
      tax += lineTax;
    }
  }
  return { subtotal, tax, total: subtotal + tax };
}

// ض.ق.م + الاعتراف are off by default so the grid matches the approved 7-column anatomy;
// both stay one click away in the "الأعمدة" menu. The account column is ALWAYS visible
// (account law 2026-09-08 · every line must carry an account) so it has no toggle.
const DEFAULT_HIDDEN_COLS = { account: false, tax: false, taxAmount: true, recognition: true };

/** Debounce before asking the suggestion engine for a line whose account is still empty */
const SUGGEST_DEBOUNCE_MS = 450;
/** Client-side cache of suggestions · key = kind|productId|text · shared across grids */
const suggestionCache = new Map<string, AccountSuggestion | null>();

async function defaultSuggestAccount(input: { kind: "sales" | "purchase"; text: string; productId?: string | null; contactId?: string | null }): Promise<AccountSuggestion | null> {
  return api.accounts.suggest(input);
}

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
  errorMessage,
  contactId,
  suggestAccount,
  autoSuggest = true,
}: Props) {
  const { t, language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(DEFAULT_HIDDEN_COLS);
  const [suggestingIds, setSuggestingIds] = useState<Set<string>>(new Set());
  const suggestTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const suggestInFlightRef = useRef<Set<string>>(new Set());
  const linesRef = useRef(lines);
  linesRef.current = lines;
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

  // ── Auto-suggest the account for lines that have content but no account ──────
  // «ذكاء يحط أقرب حساب للبند · ما يترك الحسابات فاضية أبدًا»
  const suggestKind: "sales" | "purchase" = direction === "sales" ? "sales" : "purchase";
  const canSuggest = autoSuggest && (accounts.length > 0 || !!suggestAccount);
  useEffect(() => {
    if (!canSuggest) return;
    const timers = suggestTimersRef.current;
    const liveIds = new Set(lines.map((l) => l.id));
    for (const [id, timer] of timers) if (!liveIds.has(id)) { clearTimeout(timer); timers.delete(id); }
    for (const line of lines) {
      if (line.accountId) { const tm = timers.get(line.id); if (tm) { clearTimeout(tm); timers.delete(line.id); } continue; }
      const text = (line.description || "").trim();
      const price = Number(normalizeDigits(line.unitPrice)) || 0;
      const hasContent = text.length >= 3 || !!line.productId || price > 0;
      if (!hasContent) continue;
      if (suggestInFlightRef.current.has(line.id)) continue;
      const productName = line.productId ? products.find((p) => p.id === line.productId)?.name : "";
      const key = `${suggestKind}|${line.productId || ""}|${(text || productName || "").toLowerCase()}`;
      const existing = timers.get(line.id);
      if (existing) clearTimeout(existing);
      timers.set(line.id, setTimeout(async () => {
        timers.delete(line.id);
        const current = linesRef.current.find((l) => l.id === line.id);
        if (!current || current.accountId) return;
        suggestInFlightRef.current.add(line.id);
        setSuggestingIds((prev) => new Set(prev).add(line.id));
        try {
          let hit = suggestionCache.get(key);
          if (hit === undefined) {
            hit = await (suggestAccount || defaultSuggestAccount)({ kind: suggestKind, text: text || productName || "", productId: line.productId || null, contactId: contactId || null }).catch(() => null);
            suggestionCache.set(key, hit ?? null);
          }
          const accountId = hit?.accountId && accountItems.some((a) => a.id === hit!.accountId) ? hit.accountId : hit?.accountId && accounts.length === 0 ? hit.accountId : null;
          if (accountId) {
            setLines((prev: InvoiceLine[]) => prev.map((l) => (l.id === line.id && !l.accountId ? { ...l, accountId, accountSuggested: true, accountVia: hit?.via } : l)));
          }
        } finally {
          suggestInFlightRef.current.delete(line.id);
          setSuggestingIds((prev) => { const next = new Set(prev); next.delete(line.id); return next; });
        }
      }, SUGGEST_DEBOUNCE_MS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, canSuggest, suggestKind, contactId]);
  useEffect(() => () => { for (const tm of suggestTimersRef.current.values()) clearTimeout(tm); }, []);

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
      accountSuggested: product.accountId ? false : existing?.accountSuggested,
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

  // The org's VAT catalogue · shared cache, so several grids on one page fetch once.
  const { rates: taxRates } = useTaxRates();

  /**
   * Once the catalogue arrives, bind every line that has a matching rate to that
   * rate's id, so a document the user never re-touched still saves with a real
   * `taxRateId` instead of relying on the numeric fallback. Runs on the catalogue
   * changing only — lines the user edits get their id from the dropdown itself.
   */
  useEffect(() => {
    if (!taxRates.length) return;
    const byId = new Set(taxRates.map((r) => r.id));
    let changed = false;
    const next = lines.map((l) => {
      if (l.taxRateId && byId.has(l.taxRateId)) return l;
      const match = taxRates.find((r) => Number(r.rate) === lineTaxRate(l) && !!r.isInclusive === !!l.taxInclusive)
        || taxRates.find((r) => Number(r.rate) === lineTaxRate(l));
      if (!match || l.taxRateId === match.id) return l;
      changed = true;
      return { ...l, taxRateId: match.id };
    });
    if (changed) setLines(next);
    // `lines` is deliberately not a dependency: this binds ids when the catalogue
    // loads, it is not a per-keystroke normalizer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxRates]);

  // Account column is always visible once the chart is loaded (never a hidden toggle).
  const showAccount = accounts.length > 0 || !!onCreateAccount;
  const showTax = !hidden.tax;

  /**
   * Tax options come from the ORG's catalogue (`/api/tax-rates`), so the value the
   * user picks is an id the API can store. The static pair below is the fallback
   * for the moment before the catalogue arrives (and if the request fails) — it
   * keeps the grid usable but is never what a saved line carries when rates load.
   */
  const taxOptions = taxRates.length
    ? taxRates.map((r) => ({ value: r.id, label: taxRateShortLabel(r, language === "ar" ? "ar" : "en") }))
    : [
        { value: "rate:0.15:ex", label: t("15% غير شامل", "15% excluded") },
        { value: "rate:0.15:in", label: t("15% شامل", "15% included") },
        { value: "rate:0:ex", label: t("0% (صفر)", "0% (zero-rated)") },
      ];

  /** Which option a stored line is showing · by id first, then by rate + mode. */
  const taxOptionValue = (line: InvoiceLine): string => {
    if (line.taxRateId && taxRates.some((r) => r.id === line.taxRateId)) return line.taxRateId;
    const match = taxRates.find(
      (r) => Number(r.rate) === lineTaxRate(line) && !!r.isInclusive === !!line.taxInclusive,
    ) || taxRates.find((r) => Number(r.rate) === lineTaxRate(line));
    if (match) return match.id;
    return `rate:${lineTaxRate(line)}:${line.taxInclusive ? "in" : "ex"}`;
  };

  /** Turn the chosen option back into the three fields a line stores. */
  const taxSelection = (value: string): Partial<InvoiceLine> => {
    const rate = taxRates.find((r) => r.id === value);
    if (rate) return { taxRateId: rate.id, taxRate: Number(rate.rate), taxInclusive: !!rate.isInclusive };
    const [, fraction, mode] = value.split(":");
    return { taxRateId: undefined, taxRate: Number(fraction) || 0, taxInclusive: mode === "in" };
  };

  const showTaxAmount = !hidden.taxAmount;
  const showRecognition = !hidden.recognition;
  const showAssetCol = direction === "purchases";
  /** Xero-style: accounts inside the fixed-asset branch auto-register the line as an asset (no flag needed) */
  const fixedAssetAccountIds = new Set(
    accounts
      .filter((a) => a.type === "ASSET" && /fixed|intangible/i.test(a.subtype || ""))
      .map((a) => a.id),
  );
  const hiddenCount = Number(hidden.tax) + Number(hidden.taxAmount) + Number(hidden.recognition);

  // Backend uses REVENUE not INCOME · accept both for compatibility
  // Purchases accept EXPENSE + ASSET (fixed-asset lines) — same set the API validates.
  const accountItems = accounts
    .filter((a) => direction === "sales"
      ? (a.type === "REVENUE" || a.type === "INCOME")
      : (a.type === "EXPENSE" || a.type === "ASSET"))
    .map((a) => ({ id: a.id, label: a.name, sublabel: a.code }));

  // Ledger dense grid · column track list mirrors the approved reference
  // (# · البند · الوصف · الكمية · السعر · [الحساب] · [الضريبة] · المبلغ · [ض.ق.م] · الإجمالي · [الاعتراف] · [أصل] · حذف)
  const gridTemplate = [
    "36px",
    "150px",
    "minmax(0, 1fr)",
    "70px",
    "100px",
    showAccount ? "200px" : null,
    showTax ? "96px" : null,
    "110px",
    showTaxAmount ? "110px" : null,
    "130px",
    showRecognition ? "150px" : null,
    showAssetCol ? "44px" : null,
    "32px",
  ].filter(Boolean).join(" ");
  const gridMinWidth =
    36 + 150 + 200 + 70 + 100 + (showAccount ? 200 : 0) + (showTax ? 96 : 0) + 110 +
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
              const rate = lineTaxRate(line);
              const lineTax = line.taxInclusive ? gross - gross / (1 + rate) : gross * rate;
              const lineNet = line.taxInclusive ? gross / (1 + rate) : gross;
              const lineTotal = line.taxInclusive ? gross : gross + lineTax;
              const isReal = i < realLineCount;
              const isInvalid = isReal && !!invalidIds?.has(line.id);
              const isSuggesting = isReal && suggestingIds.has(line.id);
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
                    <span className={`cell !px-1 ${isInvalid && !line.accountId ? "!bg-danger-subtle" : ""}`} data-testid={`line-account-${i}`} data-account-suggested={line.accountSuggested ? "true" : undefined}>
                      <div className="flex w-full min-w-0 items-center gap-1">
                        <div className="min-w-0 flex-1">
                          <SearchableCombobox
                            value={line.accountId || ""}
                            onChange={(id) => updateLine(i, { accountId: id, accountSuggested: false, accountVia: undefined })}
                            items={accountItems}
                            placeholder={isSuggesting ? t("جارٍ الاقتراح…", "Suggesting…") : t("حساب…", "Account…")}
                            borderless
                            buttonClassName={`min-h-8 h-auto py-1 px-2 text-[13px] rounded-md ${line.accountSuggested ? "text-content-secondary" : ""}`}
                            menuMinWidth={520}
                            wrap
                            onCreate={onCreateAccount ? async (name) => {
                              const a = await onCreateAccount(name);
                              updateLine(i, { accountId: a.id, accountSuggested: false, accountVia: undefined });
                              return a.id;
                            } : undefined}
                            createLabel={(q) => t("+ إنشاء حساب جديد", "+ Create account") + ` "${q}"`}
                          />
                        </div>
                        {line.accountSuggested && line.accountId && (
                          <button
                            type="button"
                            onClick={() => updateLine(i, { accountSuggested: false })}
                            className="shrink-0 rounded-full border border-border bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold leading-none text-content-secondary hover:text-foreground"
                            title={t("حساب مقترح تلقائياً · اضغط للتأكيد أو اختر حساباً آخر", "Suggested automatically · click to confirm or pick another account")}
                          >
                            {t("مقترح", "Suggested")}
                          </button>
                        )}
                      </div>
                    </span>
                  )}
                  {showTax && (
                    <span className="cell n !px-1">
                      <select
                        data-testid={`line-tax-${i}`}
                        aria-label={t("الضريبة", "Tax")}
                        value={taxOptionValue(line)}
                        onChange={(e) => updateLine(i, taxSelection(e.target.value))}
                        className="h-8 w-full border-0 bg-transparent px-1 text-[12px] leading-tight text-end focus:outline-none"
                      >
                        {taxOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
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

        {errorMessage && (
          <p role="alert" data-testid="items-table-error" className="border-t border-danger/40 bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">
            {errorMessage}
          </p>
        )}

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
