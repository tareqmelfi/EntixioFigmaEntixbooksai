/**
 * Chart of Accounts · UX-95 · tree view + auto-suggest code + parent picker
 *
 * Code ranges:
 *   1xxxx = Asset      · 2xxxx = Liability
 *   3xxxx = Equity     · 4xxxx = Revenue
 *   5xxxx = Expense
 *
 * Auto-suggest: when user picks type or parent, the form proposes the next
 * available code in that bucket (still editable). Parent dropdown is filtered
 * to the same type so child stays under correct branch.
 *
 * Tree view: accounts indented by depth so the user sees the hierarchy.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { AlertTriangle, ArrowRightLeft, BookOpen, Plus, Search, Trash2, Loader2, X, ChevronDown, ChevronRight as ChevronRightIcon, Edit2, Download, Upload, FileSpreadsheet, History, Sparkles, Wallet, CreditCard, Landmark, TrendingUp, TrendingDown, PlusCircle, Info } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, Account, AccountTransactions } from "../lib/api";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
type CashFlowType = "OPERATING" | "INVESTING" | "FINANCING" | "NON_CASH";
type AccountForm = {
  code: string;
  name: string;
  nameAr: string;
  type: AccountType;
  parentId: string;
  description: string;
  cashFlowType: CashFlowType;
  allowPosting: boolean;
  allowPayment: boolean;
  allowExpenseClaim: boolean;
};
type ImportRow = {
  code: string;
  name: string;
  nameAr: string;
  type?: AccountType;
  parentCode?: string;
  description?: string;
  confidence?: number | null;
  duplicateCode?: boolean;
  duplicateNameCode?: string | null;
  needsReviewReason?: string | null;
  rowStatus?: "new" | "code_duplicate" | "name_duplicate" | "needs_review";
};

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "أصل", LIABILITY: "التزام", EQUITY: "حقوق ملكية", REVENUE: "إيراد", EXPENSE: "مصروف",
};
const TYPE_LABELS_PLURAL: Record<AccountType, string> = {
  ASSET: "الأصول",
  LIABILITY: "الالتزامات",
  EQUITY: "حقوق الملكية",
  REVENUE: "الإيرادات",
  EXPENSE: "المصروفات",
};
const TYPE_COLORS: Record<AccountType, string> = {
  ASSET: "bg-blue-100 text-blue-700",
  LIABILITY: "bg-red-100 text-red-700",
  EQUITY: "bg-purple-100 text-purple-700",
  REVENUE: "bg-green-100 text-green-700",
  EXPENSE: "bg-amber-100 text-amber-700",
};

// Code prefix per type
const TYPE_PREFIX: Record<AccountType, string> = {
  ASSET:     "1",
  LIABILITY: "2",
  EQUITY:    "3",
  REVENUE:   "4",
  EXPENSE:   "5",
};

const CASH_FLOW_META: Record<CashFlowType, { label: string; hint: string }> = {
  OPERATING: { label: "التشغيلات (Operating)", hint: "للمبيعات، المصروفات اليومية، العملاء، الموردين، النقد والبنوك المستخدمة يومياً." },
  INVESTING: { label: "الاستثمارات (Investing)", hint: "لشراء أو بيع الأصول طويلة الأجل والاستثمارات." },
  FINANCING: { label: "التمويلات (Financing)", hint: "للقروض، رأس المال، توزيعات الملاك، وحركات التمويل." },
  NON_CASH: { label: "غير نقدي (Non-Cash)", hint: "للحسابات التي لا تمثل حركة نقدية مباشرة مثل الإهلاك والتسويات." },
};

function formatAmount(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeBankAccount(value: string): boolean {
  return /(bank|cash|wallet|treasury|checking|saving|بنك|مصرف|حساب بنكي|صندوق|نقد|محفظة)/i.test(value);
}

function inferCashFlowType(type: AccountType, name: string, parent?: Account | null): CashFlowType {
  const source = `${name} ${parent?.name || ""} ${parent?.nameAr || ""}`.toLowerCase();
  if (/depreciation|amortization|provision|إهلاك|استهلاك|مخصص/i.test(source)) return "NON_CASH";
  if (type === "EQUITY") return "FINANCING";
  if (type === "LIABILITY" && /(loan|قرض|تمويل|capital lease)/i.test(source)) return "FINANCING";
  if (type === "ASSET" && /(fixed|equipment|vehicle|building|investment|أصول ثابتة|اصل ثابت|استثمار|سيارة|معدات|مبنى)/i.test(source)) return "INVESTING";
  return "OPERATING";
}

function usageDefaults(type: AccountType, name = "", parent?: Account | null) {
  const text = `${name} ${parent?.name || ""} ${parent?.nameAr || ""}`;
  const bankish = looksLikeBankAccount(text);
  return {
    allowPosting: true,
    allowPayment: type === "ASSET" && bankish,
    allowExpenseClaim: type === "EXPENSE",
  };
}

function defaultForm(type: AccountType = "ASSET", parentId = "", parent?: Account | null): AccountForm {
  const usage = usageDefaults(type, "", parent || null);
  return {
    code: "",
    name: "",
    nameAr: "",
    type,
    parentId,
    description: "",
    cashFlowType: inferCashFlowType(type, "", parent || null),
    ...usage,
  };
}

// Visual meta per type · gradient + icon + ring color (UX-192)
const TYPE_META: Record<AccountType, {
  icon: any;
  bg: string;       // chip soft bg (used very sparingly)
  text: string;     // chip text
  hint: string;
}> = {
  ASSET:     { icon: Wallet,       bg: "bg-[#F4FCFF]", text: "text-[#1276E3]", hint: "ما تملكه الشركة" },
  LIABILITY: { icon: CreditCard,   bg: "bg-[#F9FAFB]", text: "text-[#6B7280]", hint: "ما عليها للغير" },
  EQUITY:    { icon: Landmark,     bg: "bg-[#F9FAFB]", text: "text-[#6B7280]", hint: "حقوق الملاّك" },
  REVENUE:   { icon: TrendingUp,   bg: "bg-[#F9FAFB]", text: "text-[#6B7280]", hint: "ما تكسبه الشركة" },
  EXPENSE:   { icon: TrendingDown, bg: "bg-[#F9FAFB]", text: "text-[#6B7280]", hint: "ما تنفقه الشركة" },
};


/** Suggest next available code in the bucket. If parent provided, use parent.code as prefix. */
function suggestCode(items: Account[], type: AccountType, parent: Account | null): string {
  if (parent) {
    // child code = parent.code + 2-digit increment (e.g. 5100 → 5101)
    const parentCode = parent.code;
    const siblings = items.filter(a => a.parentId === parent.id);
    if (siblings.length === 0) {
      // first child · pad parent with "01"
      return `${parentCode}01`;
    }
    const maxSibling = siblings.reduce((max, s) => {
      const num = Number(s.code);
      return num > max ? num : max;
    }, 0);
    return String(maxSibling + 1);
  }
  // top-level · take next 4-digit code in bucket
  const prefix = TYPE_PREFIX[type];
  const bucket = items.filter(a => a.code.startsWith(prefix) && a.code.length === 5 && !a.parentId);
  if (bucket.length === 0) return `${prefix}1000`;
  const maxCode = bucket.reduce((max, a) => {
    const num = Number(a.code);
    return num > max ? num : max;
  }, Number(`${prefix}0000`));
  return String(maxCode + 100);
}

/** Build tree from flat list */
type TreeNode = Account & { children: TreeNode[]; depth: number };
function buildTree(items: Account[]): TreeNode[] {
  const byId = new Map(items.map(a => [a.id, { ...a, children: [] as TreeNode[], depth: 0 }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Set depth recursively
  const setDepth = (n: TreeNode, d: number) => {
    n.depth = d;
    n.children.sort((a, b) => a.code.localeCompare(b.code)).forEach(c => setDepth(c, d + 1));
  };
  roots.sort((a, b) => a.code.localeCompare(b.code)).forEach(r => setDepth(r, 0));
  return roots;
}

/** Flatten tree (post-order parent-first) honoring expand state */
function flattenTree(roots: TreeNode[], expanded: Set<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (node: TreeNode) => {
    out.push(node);
    if (expanded.has(node.id)) {
      node.children.forEach(walk);
    }
  };
  roots.forEach(walk);
  return out;
}

export function ChartOfAccounts() {
  const [items, setItems] = useState<Account[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<AccountType | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [form, setForm] = useState<AccountForm>(() => defaultForm("ASSET"));
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [cashFlowManuallyEdited, setCashFlowManuallyEdited] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ rows: ImportRow[]; mapping: Record<string, string>; rawHeaders: string[]; source: "csv" | "file" | "ai"; warnings?: string[]; fileName?: string } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [mergeSource, setMergeSource] = useState<Account | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  // Transactions side panel
  const [txPanel, setTxPanel] = useState<{ accountId: string; data: AccountTransactions | null; loading: boolean } | null>(null);
  // AI translate state
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const aiSuggest = async (sourceText: string) => {
    if (!sourceText.trim()) { push("error", "اكتب اسم الحساب أولاً"); return; }
    setAiBusy(true); setAiSuggestion(null);
    try {
      const parent = form.parentId ? items.find(a => a.id === form.parentId) : null;
      const hint = [
        `Selected type: ${form.type}`,
        `Preserve selected type. Do not reclassify the account.`,
        parent ? `Parent account: ${parent.code} · ${parent.nameAr || parent.name} · Parent type: ${parent.type}` : "",
      ].filter(Boolean).join("\n");
      const r = await api.accounts.translate(sourceText.trim(), hint);
      const nextName = r.name || form.name;
      const nextNameAr = r.nameAr || form.nameAr;
      const nextUsage = usageDefaults(form.type, `${nextName} ${nextNameAr}`, parent || null);
      setForm(prev => ({
        ...prev,
        name: nextName,
        nameAr: nextNameAr,
        ...(cashFlowManuallyEdited ? {} : { cashFlowType: inferCashFlowType(prev.type, `${nextName} ${nextNameAr}`, parent || null) }),
        allowPayment: nextUsage.allowPayment,
        allowExpenseClaim: nextUsage.allowExpenseClaim,
        ...((!codeManuallyEdited && !prev.parentId && r.suggestedCode && r.type === prev.type) ? { code: r.suggestedCode } : {}),
      }));
      setAiSuggestion(r.reasoning || `${r.category || TYPE_LABELS[form.type]} · لم يتم تغيير التصنيف المختار`);
      push("success", "تم الاقتراح بالذكاء ✨");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الاقتراح");
    } finally { setAiBusy(false); }
  };

  const openTransactions = async (accountId: string) => {
    setTxPanel({ accountId, data: null, loading: true });
    try {
      const data = await api.accounts.transactions(accountId);
      setTxPanel({ accountId, data, loading: false });
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل تحميل العمليات");
      setTxPanel(null);
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.accounts.list();
      setItems(d.items);
      // expand all roots by default
      const rootIds = d.items.filter(a => !a.parentId).map(a => a.id);
      setExpanded(new Set(rootIds));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  // Build tree
  const tree = useMemo(() => buildTree(items), [items]);

  // Filter view
  const flatRows = useMemo(() => {
    const flat = flattenTree(tree, expanded);
    return flat.filter(n => {
      if (filterType !== "ALL" && n.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return n.code.includes(q) || n.name.toLowerCase().includes(q) || (n.nameAr || "").includes(q);
      }
      return true;
    });
  }, [tree, expanded, filterType, searchQuery]);

  const counts = useMemo(() => items.reduce((acc: Record<string, number>, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {}), [items]);

  const parentOptions = useMemo(() => {
    return items.filter(a => a.type === form.type && a.id !== editingId).sort((a, b) => a.code.localeCompare(b.code));
  }, [items, form.type, editingId]);

  // Auto-suggest code when type or parent changes (unless user manually edited)
  useEffect(() => {
    if (codeManuallyEdited) return;
    const parent = form.parentId ? items.find(a => a.id === form.parentId) : null;
    const suggested = suggestCode(items, form.type, parent || null);
    setForm(prev => ({ ...prev, code: suggested }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.parentId, items.length]);

  useEffect(() => {
    if (cashFlowManuallyEdited) return;
    const parent = form.parentId ? items.find(a => a.id === form.parentId) : null;
    setForm(prev => ({ ...prev, cashFlowType: inferCashFlowType(prev.type, `${prev.name} ${prev.nameAr}`, parent || null) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.parentId, form.name, form.nameAr, items.length, cashFlowManuallyEdited]);

  const resetForm = () => {
    setForm(defaultForm("ASSET"));
    setCodeManuallyEdited(false);
    setCashFlowManuallyEdited(false);
    setEditingId(null);
  };

  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (a: Account) => {
    setForm({
      code: a.code,
      name: a.name,
      nameAr: a.nameAr || "",
      type: a.type as AccountType,
      parentId: a.parentId || "",
      description: a.description || "",
      cashFlowType: (a.cashFlowType as CashFlowType) || inferCashFlowType(a.type as AccountType, `${a.name} ${a.nameAr || ""}`),
      allowPosting: a.allowPosting !== false,
      allowPayment: a.allowPayment === true,
      allowExpenseClaim: a.allowExpenseClaim === true,
    });
    setCodeManuallyEdited(true);
    setCashFlowManuallyEdited(Boolean(a.cashFlowType));
    setEditingId(a.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { push("error", "الرمز والاسم مطلوبان"); return; }
    setBusy(true);
    try {
      if (editingId) {
        const a = await api.accounts.update(editingId, {
          code: form.code.trim(),
          name: form.name.trim(),
          nameAr: form.nameAr.trim() || null,
          type: form.type,
          parentId: form.parentId || null,
          description: form.description.trim() || null,
          cashFlowType: form.cashFlowType,
          allowPosting: form.allowPosting,
          allowPayment: form.allowPayment,
          allowExpenseClaim: form.allowExpenseClaim,
        });
        setItems(prev => prev.map(x => x.id === a.id ? a : x));
        push("success", "تم التحديث");
      } else {
        const a = await api.accounts.create({
          code: form.code.trim(), name: form.name.trim(),
          nameAr: form.nameAr.trim() || null,
          type: form.type,
          parentId: form.parentId || null,
          description: form.description.trim() || null,
          cashFlowType: form.cashFlowType,
          allowPosting: form.allowPosting,
          allowPayment: form.allowPayment,
          allowExpenseClaim: form.allowExpenseClaim,
        });
        setItems(prev => [...prev, a]);
        push("success", `تم إنشاء الحساب ${a.code}`);
        // expand the parent so user sees the new child
        if (a.parentId) setExpanded(prev => new Set([...prev, a.parentId!]));
      }
      setOpen(false);
      resetForm();
    } catch (e: any) {
      push("error", e instanceof ApiError ? (e.message === "code_already_exists" ? "الرمز موجود مسبقاً" : e.message) : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    const source = items.find(x => x.id === id) || null;
    try {
      await api.accounts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", "تم الحذف");
    } catch (e: any) {
      if (source && e instanceof ApiError && (e.message.includes("قيود") || e.message.includes("فرعية") || e.message.includes("has_journals") || e.message.includes("has_children"))) {
        setMergeSource(source);
        setMergeTargetId("");
        push("error", "لا يمكن حذف هذا الحساب مباشرة · اختر حساباً لنقل القيود أو الحسابات الفرعية إليه");
      } else {
        push("error", e instanceof ApiError ? e.message : "فشل الحذف");
      }
    } finally { setPendingDelete(null); }
  };

  const confirmMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setMergeBusy(true);
    try {
      const r = await api.accounts.merge(mergeSource.id, mergeTargetId);
      push("success", r.message || "تم الدمج");
      setMergeSource(null);
      setMergeTargetId("");
      await refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الدمج");
    } finally {
      setMergeBusy(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Export ──
  const handleExport = () => {
    // Build flat CSV with parentCode (for re-import)
    const byId = new Map(items.map(a => [a.id, a]));
    const csvRows = [
      ['code', 'name', 'nameAr', 'type', 'parentCode', 'description'],
      ...items.sort((a, b) => a.code.localeCompare(b.code)).map(a => [
        a.code,
        a.name,
        a.nameAr || '',
        a.type,
        a.parentId ? (byId.get(a.parentId)?.code || '') : '',
        a.description || '',
      ]),
    ];
    const csv = csvRows.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    ).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    push('success', `تم تصدير ${items.length} حساب`);
  };

  // ── Smart import ──
  // Detects header column for code/name/nameAr/type/parentCode regardless of language
  const detectMapping = (headers: string[]): Record<string, string> => {
    const lower = headers.map(h => h.trim().toLowerCase());
    const find = (...needles: string[]) => {
      for (const n of needles) {
        const i = lower.findIndex(h => h.includes(n));
        if (i >= 0) return headers[i];
      }
      return '';
    };
    return {
      code: find('code', 'رمز', 'كود', 'رقم'),
      name: find('name_en', 'name en', 'name', 'اسم انج', 'english'),
      nameAr: find('namear', 'name_ar', 'name ar', 'اسم عر', 'arabic', 'الاسم'),
      type: find('type', 'تصنيف', 'نوع', 'فئة', 'category'),
      parentCode: find('parent', 'أب', 'الأب', 'parent_code', 'parentcode'),
      description: find('description', 'وصف', 'desc', 'notes'),
    };
  };

  const parseCsv = (text: string): { headers: string[]; rows: string[][] } => {
    // Simple CSV parser handling quoted fields + commas
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '', inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuote) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') inQuote = false;
          else cur += ch;
        } else {
          if (ch === ',') { out.push(cur); cur = ''; }
          else if (ch === '"') inQuote = true;
          else cur += ch;
        }
      }
      out.push(cur);
      return out;
    };
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  };

  const normalizeType = (t: string): AccountType | undefined => {
    const s = t.trim().toUpperCase();
    if (['ASSET', 'أصل', 'أصول', 'الأصول'].includes(s)) return 'ASSET';
    if (['LIABILITY', 'التزام', 'التزامات', 'الالتزامات', 'LIABILITIES'].includes(s)) return 'LIABILITY';
    if (['EQUITY', 'حقوق', 'حقوق ملكية', 'حقوق الملكية'].includes(s)) return 'EQUITY';
    if (['REVENUE', 'إيراد', 'إيرادات', 'الإيرادات', 'INCOME'].includes(s)) return 'REVENUE';
    if (['EXPENSE', 'مصروف', 'مصروفات', 'المصروفات', 'EXPENSES'].includes(s)) return 'EXPENSE';
    if (['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(s)) return s as AccountType;
    return undefined;
  };

  const annotateImportRows = (rows: ImportRow[]): ImportRow[] => {
    const byCode = new Set(items.map(a => a.code));
    const byName = new Map(items.map(a => [normalizeText(`${a.name} ${a.nameAr || ""}`), a.code]));
    const importCodes = new Set(rows.map(row => row.code).filter(Boolean));
    return rows.map((row) => {
      const duplicateCode = byCode.has(row.code);
      const duplicateNameCode = byName.get(normalizeText(`${row.name} ${row.nameAr || ""}`)) || null;
      const parentMissing = !!row.parentCode && !byCode.has(row.parentCode) && !importCodes.has(row.parentCode);
      const missingType = !row.type;
      const lowConfidence = typeof row.confidence === "number" && row.confidence < 0.7;
      const needsReviewReason = duplicateNameCode
        ? `اسم مشابه للحساب ${duplicateNameCode}`
        : parentMissing
          ? `الأب ${row.parentCode} غير موجود`
          : missingType
            ? "التصنيف غير واضح"
            : lowConfidence
              ? "ثقة التحليل منخفضة"
              : null;
      return {
        ...row,
        duplicateCode,
        duplicateNameCode,
        needsReviewReason,
        rowStatus: duplicateCode ? "code_duplicate" : duplicateNameCode ? "name_duplicate" : needsReviewReason ? "needs_review" : "new",
      };
    });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("entix-coa-import-preview");
      if (!raw || importPreview || items.length === 0) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) {
        setImportPreview({ ...parsed, rows: annotateImportRows(parsed.rows) });
      }
    } catch {
      localStorage.removeItem("entix-coa-import-preview");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    try {
      if (importPreview) localStorage.setItem("entix-coa-import-preview", JSON.stringify(importPreview));
      else localStorage.removeItem("entix-coa-import-preview");
    } catch {}
  }, [importPreview]);

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const idx = s.indexOf("base64,");
      resolve(idx >= 0 ? s.slice(idx + "base64,".length) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFilePick = async (file: File) => {
    try {
      const isCsv = /csv|text\/plain/.test(file.type) || /\.csv$/i.test(file.name);
      if (!isCsv) {
        setImportBusy(true);
        const r = await api.accounts.analyzeImport({
          fileBase64: await fileToBase64(file),
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        });
        const parsed = annotateImportRows((r.rows || []).map((row: any) => ({
          code: String(row.code || "").trim(),
          name: String(row.name || "").trim(),
          nameAr: String(row.nameAr || "").trim(),
          type: row.type || undefined,
          parentCode: row.parentCode || "",
          description: row.description || "",
          confidence: row.confidence ?? null,
        })).filter((row: ImportRow) => row.code));
        if (parsed.length === 0) {
          push("error", "لم يستخرج التحليل حسابات واضحة من الملف");
          return;
        }
        setImportPreview({ rows: parsed, mapping: {}, rawHeaders: [], source: "file", warnings: r.warnings || [], fileName: file.name });
        push("success", `تم تحليل ${parsed.length} حساب من الملف`);
        return;
      }
      const text = await file.text();
      const { headers, rows: rawRows } = parseCsv(text);
      const mapping = detectMapping(headers);
      const colIdx = (key: string) => headers.indexOf(mapping[key]);
      const idxCode = colIdx('code');
      const idxName = colIdx('name');
      const idxNameAr = colIdx('nameAr');
      const idxType = colIdx('type');
      const idxParent = colIdx('parentCode');
      const idxDesc = colIdx('description');

      const parsed = rawRows.map(r => ({
        code: idxCode >= 0 ? (r[idxCode] || '').trim() : '',
        name: idxName >= 0 ? (r[idxName] || '').trim() : '',
        nameAr: idxNameAr >= 0 ? (r[idxNameAr] || '').trim() : '',
        type: idxType >= 0 ? normalizeType(r[idxType] || '') : undefined,
        parentCode: idxParent >= 0 ? (r[idxParent] || '').trim() : '',
        description: idxDesc >= 0 ? (r[idxDesc] || '').trim() : '',
      })).filter(r => r.code);

      if (parsed.length === 0) {
        push('error', 'لم يتم العثور على صفوف صالحة · تأكد من وجود عمود "code" أو "رمز"');
        return;
      }
      setImportPreview({ rows: annotateImportRows(parsed), mapping, rawHeaders: headers, source: "csv", fileName: file.name });
    } catch (e: any) {
      push('error', e?.message || 'فشل قراءة الملف');
    } finally {
      setImportBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      const rowsToImport = importPreview.rows.filter(row => row.rowStatus === "new");
      if (rowsToImport.length === 0) {
        push("error", "لا توجد حسابات جديدة جاهزة للاستيراد · راجع الصفوف الملونة أولاً");
        return;
      }
      const r = await api.accounts.importBulk(rowsToImport.map(row => ({
        code: row.code,
        name: row.name || row.nameAr || row.code,
        nameAr: row.nameAr || null,
        type: row.type,
        parentCode: row.parentCode || null,
        description: row.description || null,
      })), true);
      push('success', r.message);
      setImportPreview(null);
      refresh();
    } catch (e: any) {
      push('error', e instanceof ApiError ? e.message : 'فشل الاستيراد');
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>دليل الحسابات</h1>
          <p className="text-[#6B7280] mt-1">شجرة الحسابات الهرمية حسب التصنيف · 1xxx أصول · 2xxx التزامات · 3xxx حقوق ملكية · 4xxx إيرادات · 5xxx مصروفات</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv,.pdf,application/pdf,image/*,.png,.jpg,.jpeg,.webp,.heic,.heif,.xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePick(f); e.target.value = ''; }} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importBusy} className="border-[#E5E7EB]">
            {importBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Upload className="me-2 h-4 w-4" />}
            استيراد ذكي
          </Button>
          <Button variant="outline" onClick={handleExport} className="border-[#E5E7EB]">
            <Download className="me-2 h-4 w-4" /> تصدير CSV
          </Button>
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />حساب جديد</Button>
        </div>
      </div>

      {/* Type cards · quiet white tiles (UX-198 · minimal Wave-style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {(["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"] as const).map(t => {
          const meta = TYPE_META[t];
          const Icon = meta.icon;
          const typeItems = items.filter(a => a.type === t);
          const total = typeItems.reduce((s, a) => s + (a.balance ?? 0), 0);
          const isActive = filterType === t;
          return (
            <button
              key={t}
              onClick={() => setFilterType(isActive ? "ALL" : t)}
              className={`rounded-lg border bg-white text-start transition p-3.5 hover:border-[#1276E3] ${isActive ? "border-[#1276E3] ring-1 ring-[#1276E3]/20" : "border-[#E5E7EB]"}`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-[#6B7280]">{TYPE_LABELS_PLURAL[t]} · <span className="font-english">{TYPE_PREFIX[t]}xxxx</span></span>
                <Icon className="h-4 w-4 text-[#9CA3AF]" />
              </div>
              <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.1 }}>
                {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-1.5"><span className="font-english">{typeItems.length}</span> حساب · الرصيد الإجمالي</p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <Card className="border-[#E5E7EB] shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input placeholder="بحث بالاسم أو الرمز..." className="ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button onClick={() => setFilterType("ALL")} className={`text-xs px-3 py-1.5 rounded-md border transition ${filterType === "ALL" ? "bg-[#1276E3] text-white border-[#1276E3]" : "bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"}`}>الكل ({items.length})</button>
            <button onClick={() => setExpanded(new Set(items.map(a => a.id)))} className="text-xs text-[#1276E3] hover:underline px-2">+ توسيع</button>
            <button onClick={() => setExpanded(new Set())} className="text-xs text-[#6B7280] hover:underline px-2">طيّ</button>
            <span className="text-xs text-[#9CA3AF] ms-auto">{flatRows.length} حساب معروض</span>
          </div>
        </CardContent>
      </Card>

      {/* Type-grouped tree sections (UX-192) */}
      {loading ? (
        <Card className="border-[#E5E7EB]"><CardContent className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></CardContent></Card>
      ) : items.length === 0 ? (
        <Card className="border-[#E5E7EB] border-dashed"><CardContent className="py-16 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-[#E5E7EB] mb-3" />
          <p className="text-sm text-[#6B7280] mb-3">لا توجد حسابات بعد</p>
          <Button onClick={openCreate} className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />أضف أول حساب</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"] as const).filter(t => filterType === "ALL" || filterType === t).map(t => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            const sectionRoots = tree.filter(n => n.type === t);
            // Apply search filter on tree
            const filterNode = (n: typeof sectionRoots[0]): boolean => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              if (n.code.includes(q) || n.name.toLowerCase().includes(q) || (n.nameAr || "").includes(q)) return true;
              return n.children.some(filterNode);
            };
            const visibleRoots = sectionRoots.filter(filterNode);
            const sectionTotal = items.filter(a => a.type === t).reduce((s, a) => s + (a.balance ?? 0), 0);

            return (
              <Card key={t} className={`border-[#E5E7EB] overflow-hidden`}>
                <div className={`border-b border-[#E5E7EB] px-4 py-2.5 flex items-center justify-between ${meta.bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${meta.text}`} />
                    <div>
                      <div className="text-sm text-[#0B1B49] font-semibold">{TYPE_LABELS_PLURAL[t]} · <span className="font-english">{TYPE_PREFIX[t]}xxxx</span></div>
                      <div className="text-[10px] text-[#9CA3AF]">{sectionRoots.length} حساب رئيسي · إجمالي <span className="font-english">{sectionTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setForm(defaultForm(t)); setCodeManuallyEdited(false); setCashFlowManuallyEdited(false); setEditingId(null); setOpen(true); }}
                    className="text-[11px] text-[#1276E3] hover:bg-[#F4FCFF] transition px-2 py-1 rounded inline-flex items-center gap-1"
                    title={`إضافة حساب جديد · ${TYPE_LABELS[t]}`}
                  >
                    <Plus className="h-3.5 w-3.5" /> إضافة
                  </button>
                </div>
                <CardContent className="p-0">
                  {visibleRoots.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#9CA3AF]">
                      {searchQuery ? "لا نتائج مطابقة" : "لا توجد حسابات في هذا التصنيف"}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F3F4F6]">
                      {(() => {
                        // Flatten only the section's tree honoring expanded state
                        const out: TreeNode[] = [];
                        const walk = (n: TreeNode) => {
                          if (!filterNode(n)) return;
                          out.push(n);
                          if (expanded.has(n.id)) n.children.forEach(walk);
                        };
                        visibleRoots.forEach(walk);
                        return out.map(node => (
                          <div key={node.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-[#F9FAFB] transition" style={{ paddingInlineStart: `${0.75 + node.depth * 1.25}rem` }}>
                            {/* Indent + chevron */}
                            {node.depth > 0 && (
                              <span className="inline-block border-s border-[#E5E7EB] self-stretch -my-2 me-1" style={{ marginInlineStart: "-0.5rem" }} />
                            )}
                            {node.children.length > 0 ? (
                              <button onClick={() => toggleExpand(node.id)} className="text-[#9CA3AF] hover:text-[#1276E3] shrink-0">
                                {expanded.has(node.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                              </button>
                            ) : <span className="inline-block w-4 h-4 shrink-0" />}
                            {/* Code chip */}
                            <button
                              type="button"
                              onClick={() => openTransactions(node.id)}
                              className="font-english text-xs text-[#1276E3] bg-[#F4FCFF] border border-[#E5E7EB] px-2 py-0.5 rounded shrink-0 hover:underline"
                              style={{ fontWeight: 700 }}
                            >
                              {node.code}
                            </button>
                            {/* Name */}
                            <button
                              type="button"
                              onClick={() => openTransactions(node.id)}
                              className="flex-1 min-w-0 text-start cursor-pointer"
                            >
                              <div className="text-sm text-[#0B1B49] truncate hover:text-[#1276E3]" style={{ fontWeight: node.depth === 0 ? 600 : 500 }}>
                                {node.nameAr || node.name}
                              </div>
                              {node.nameAr && node.name && (
                                <div className="text-[10px] text-[#9CA3AF] font-english truncate">{node.name}</div>
                              )}
                            </button>
                            {/* Balance */}
                            <div className="font-english text-xs shrink-0 text-end" style={{ minWidth: "80px" }}>
                              {(node.balance ?? 0) !== 0 ? (
                                <span className={`font-semibold ${(node.balance ?? 0) >= 0 ? "text-[#0B1B49]" : "text-amber-700"}`}>
                                  {(node.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-[#D1D5DB]">0.00</span>
                              )}
                            </div>
                            {/* Hover actions */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button
                                onClick={() => { setForm(defaultForm(node.type as AccountType, node.id, node)); setCodeManuallyEdited(false); setCashFlowManuallyEdited(false); setEditingId(null); setOpen(true); }}
                                className="rounded-md p-1 text-[#6B7280] hover:bg-white hover:text-[#1276E3]"
                                title="إضافة حساب فرعي تحت هذا"
                              >
                                <PlusCircle className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => openEdit(node)} className="rounded-md p-1 text-[#6B7280] hover:bg-white hover:text-[#1276E3]" title="تعديل"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => openTransactions(node.id)} className="rounded-md p-1 text-[#6B7280] hover:bg-white hover:text-[#1276E3]" title="العمليات"><History className="h-3.5 w-3.5" /></button>
                              {pendingDelete === node.id ? (
                                <span className="flex items-center gap-0.5 text-[10px]">
                                  <button onClick={() => handleDelete(node.id)} className="px-1.5 py-0.5 rounded bg-red-600 text-white">تأكيد</button>
                                  <button onClick={() => setPendingDelete(null)} className="px-1.5 py-0.5 rounded border border-[#E5E7EB]">x</button>
                                </span>
                              ) : (
                                <button onClick={() => setPendingDelete(node.id)} className="rounded-md p-1 text-red-600 hover:bg-red-50" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                      {/* Inline add at bottom of section */}
                      <button
                        onClick={() => { setForm(defaultForm(t)); setCodeManuallyEdited(false); setCashFlowManuallyEdited(false); setEditingId(null); setOpen(true); }}
                        className="w-full px-3 py-2 text-xs text-[#9CA3AF] hover:text-[#1276E3] hover:bg-[#F9FAFB] flex items-center gap-2 border-t border-dashed border-[#E5E7EB]"
                      >
                        <Plus className="h-3.5 w-3.5" /> إضافة حساب رئيسي جديد لـ{TYPE_LABELS[t]}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Transactions slide-over panel */}
      {txPanel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setTxPanel(null)}>
          <div className="bg-white shadow-xl w-full max-w-3xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#F3F4F6] p-5 flex items-center justify-between z-10">
              <div>
                <h2 className="text-base text-[#0B1B49] flex items-center gap-2" style={{ fontWeight: 700 }}>
                  <History className="h-5 w-5 text-[#1276E3]" />
                  {txPanel.data ? `${txPanel.data.account.code} · ${txPanel.data.account.nameAr || txPanel.data.account.name}` : "جارٍ التحميل..."}
                </h2>
                {txPanel.data && (
                  <p className="text-xs text-[#6B7280] mt-1">
                    {txPanel.data.total} عملية ·
                    <span className={`font-english font-bold ms-1 ${txPanel.data.finalBalance >= 0 ? "text-[#0B1B49]" : "text-amber-700"}`}>
                      الرصيد: {txPanel.data.finalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
              </div>
              <button onClick={() => setTxPanel(null)} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-5 w-5 text-[#6B7280]" /></button>
            </div>

            <div className="p-5">
              {txPanel.loading ? (
                <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div>
              ) : !txPanel.data || txPanel.data.transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <BookOpen className="h-10 w-10 text-[#E5E7EB] mx-auto mb-2" />
                  <p className="text-sm text-[#6B7280]">لا توجد عمليات على هذا الحساب بعد</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">العمليات ستظهر هنا عند ربط الفواتير والمصروفات بهذا الحساب</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F9FAFB] text-xs text-[#6B7280] sticky top-0">
                      <tr>
                        <th className="text-start px-3 py-2 font-medium">التاريخ</th>
                        <th className="text-start px-3 py-2 font-medium">رقم القيد</th>
                        <th className="text-start px-3 py-2 font-medium">الوصف</th>
                        <th className="text-end px-3 py-2 font-medium">مدين</th>
                        <th className="text-end px-3 py-2 font-medium">دائن</th>
                        <th className="text-end px-3 py-2 font-medium">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txPanel.data.transactions.map((t) => (
                        <tr key={t.id} className="border-t border-[#F3F4F6] hover:bg-[#F4FCFF]">
                          <td className="px-3 py-2 font-english text-[#374151]">{t.date.slice(0, 10)}</td>
                          <td className="px-3 py-2 font-english font-semibold text-[#1276E3]">{t.journalNumber}</td>
                          <td className="px-3 py-2">
                            <div className="text-[#0B1B49]">{t.description}</div>
                            {t.lineDescription && t.lineDescription !== t.description && <div className="text-xs text-[#9CA3AF] mt-0.5">{t.lineDescription}</div>}
                          </td>
                          <td className="px-3 py-2 text-end font-english text-[#0B1B49]">{t.debit > 0 ? t.debit.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</td>
                          <td className="px-3 py-2 text-end font-english text-[#0B1B49]">{t.credit > 0 ? t.credit.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</td>
                          <td className="px-3 py-2 text-end font-english font-semibold text-[#0B1B49]">{t.runningBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import preview modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={() => setImportPreview(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#F3F4F6]">
              <h2 className="text-base text-[#0B1B49] flex items-center gap-2" style={{ fontWeight: 700 }}>
                <FileSpreadsheet className="h-5 w-5 text-[#1276E3]" /> معاينة الاستيراد
                {importPreview.fileName && <span className="font-english text-xs text-[#6B7280]">· {importPreview.fileName}</span>}
              </h2>
              <button type="button" onClick={() => setImportPreview(null)} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-4 w-4 text-[#6B7280]" /></button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                ✓ تم اكتشاف <span className="font-english font-bold">{importPreview.rows.length}</span> صف من {importPreview.source === "csv" ? "CSV" : "تحليل ذكي للملف"}
                <span className="ms-2">· جديد: <span className="font-english font-bold">{importPreview.rows.filter(r => r.rowStatus === "new").length}</span></span>
                <span className="ms-2">· مكرر بالرمز: <span className="font-english font-bold">{importPreview.rows.filter(r => r.rowStatus === "code_duplicate").length}</span></span>
                <span className="ms-2">· يحتاج مراجعة: <span className="font-english font-bold">{importPreview.rows.filter(r => r.rowStatus === "name_duplicate" || r.rowStatus === "needs_review").length}</span></span>
                {(Object.entries(importPreview.mapping).some(([_, v]) => v) || (importPreview.warnings || []).length > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(importPreview.mapping).filter(([_, v]) => v).map(([k, v]) => (
                      <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-white border border-blue-200 font-english">
                        <strong>{k}</strong> ← {v}
                      </span>
                    ))}
                    {(importPreview.warnings || []).slice(0, 3).map((warning, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
                        {warning}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-blue-700/80">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  الأخضر جاهز للإضافة، الأحمر موجود مسبقاً ولن يستورد، والبرتقالي يحتاج مراجعة حتى لا يتكرر دليل الحسابات أو يركب تحت أب خطأ.
                </div>
              </div>

              <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#F9FAFB] text-xs text-[#6B7280] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">الرمز</th>
                      <th className="px-3 py-2 text-start font-medium">الاسم</th>
                      <th className="px-3 py-2 text-start font-medium">العربية</th>
                      <th className="px-3 py-2 text-start font-medium">التصنيف</th>
                      <th className="px-3 py-2 text-start font-medium">الأب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((r, i) => {
                      const inferredType = r.type || (r.code ? (r.code.charAt(0) === '1' ? 'ASSET' : r.code.charAt(0) === '2' ? 'LIABILITY' : r.code.charAt(0) === '3' ? 'EQUITY' : r.code.charAt(0) === '4' ? 'REVENUE' : 'EXPENSE') : '?');
                      return (
                        <tr key={i} className={`border-t border-[#F3F4F6] ${r.rowStatus === "code_duplicate" ? "bg-red-50/70" : r.rowStatus === "name_duplicate" || r.rowStatus === "needs_review" ? "bg-amber-50/80" : "bg-emerald-50/55"}`}>
                          <td className="px-3 py-1.5 font-english font-semibold text-[#1276E3]">{r.code}</td>
                          <td className="px-3 py-1.5 font-english">
                            {r.name || '—'}
                            {r.rowStatus === "new" && <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">سيضاف</span>}
                            {r.rowStatus === "code_duplicate" && <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">رمز موجود</span>}
                            {r.rowStatus === "name_duplicate" && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">اسم مشابه: {r.duplicateNameCode}</span>}
                            {r.rowStatus === "needs_review" && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{r.needsReviewReason}</span>}
                          </td>
                          <td className="px-3 py-1.5">{r.nameAr || '—'}</td>
                          <td className="px-3 py-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[inferredType as AccountType] || 'bg-gray-100'}`}>
                              {TYPE_LABELS[inferredType as AccountType] || inferredType}
                              {!r.type && <span className="text-[9px] ms-1 opacity-60">(تلقائي)</span>}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-english text-xs text-[#6B7280]">{r.parentCode || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-[#9CA3AF]">عند الحفظ سيتم استيراد الصفوف الخضراء فقط · المعاينة تبقى محفوظة مؤقتاً لو أغلقتها ورجعت لها.</p>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-[#F3F4F6]">
              <Button type="button" variant="outline" onClick={() => setImportPreview(null)} className="border-[#E5E7EB]" disabled={importBusy}>إلغاء</Button>
              <Button onClick={confirmImport} disabled={importBusy} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : `استيراد ${importPreview.rows.filter(r => r.rowStatus === "new").length} حساب جاهز`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {mergeSource && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setMergeSource(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#F3F4F6]">
              <h2 className="text-base text-[#0B1B49] flex items-center gap-2" style={{ fontWeight: 700 }}>
                <ArrowRightLeft className="h-5 w-5 text-amber-600" />
                نقل ودمج الحساب
              </h2>
              <button type="button" onClick={() => setMergeSource(null)} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-4 w-4 text-[#6B7280]" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  لا أحذف الحساب إذا عليه قيود أو حسابات فرعية. اختر حساباً من نفس التصنيف ليتم نقل القيود والحسابات الفرعية إليه ثم تعطيل الحساب القديم.
                </div>
              </div>
              <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-3">
                <div className="text-xs text-[#9CA3AF] mb-1">الحساب المراد دمجه</div>
                <div className="font-english text-sm text-[#0B1B49] font-semibold">{mergeSource.code} · {mergeSource.nameAr || mergeSource.name}</div>
                <div className="text-xs text-[#6B7280] mt-1">{TYPE_LABELS[mergeSource.type as AccountType]} · الرصيد {formatAmount(mergeSource.balance)}</div>
              </div>
              <div>
                <Label className="text-xs text-[#6B7280]">الحساب البديل *</Label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white font-english"
                >
                  <option value="">اختر حساباً من نفس التصنيف</option>
                  {items.filter(a => a.id !== mergeSource.id && a.type === mergeSource.type).map(a => (
                    <option key={a.id} value={a.id}>{a.code} · {a.nameAr || a.name} · {formatAmount(a.balance)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-[#F3F4F6]">
              <Button type="button" variant="outline" onClick={() => setMergeSource(null)} className="border-[#E5E7EB]" disabled={mergeBusy}>إلغاء</Button>
              <Button type="button" onClick={confirmMerge} disabled={mergeBusy || !mergeTargetId} className="bg-amber-600 hover:bg-amber-700">
                {mergeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "نقل القيود وتعطيل القديم"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between p-4 border-b border-[#F3F4F6]">
                <h2 className="text-base text-[#0B1B49]" style={{ fontWeight: 700 }}>{editingId ? "تعديل حساب" : "حساب جديد"}</h2>
                <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-4 w-4 text-[#6B7280]" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-[#6B7280]">التصنيف *</Label>
                  <select value={form.type} onChange={(e) => {
                    const nextType = e.target.value as AccountType;
                    const usage = usageDefaults(nextType, `${form.name} ${form.nameAr}`);
                    setForm(prev => ({
                      ...prev,
                      type: nextType,
                      parentId: "",
                      ...(cashFlowManuallyEdited ? {} : { cashFlowType: inferCashFlowType(nextType, `${prev.name} ${prev.nameAr}`) }),
                      ...usage,
                    }));
                  }}
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                    {(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as AccountType[]).map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t]} · {t} ({TYPE_PREFIX[t]}xxxx)</option>
                    ))}
                  </select>
                  <p className="text-xs text-[#9CA3AF] mt-1">
                    الرقم الأساسي لهذا التصنيف يبدأ بـ <span className="font-english">{TYPE_PREFIX[form.type]}xxxx</span> · الاقتراح الذكي لن يغيّر هذا التصنيف.
                  </p>
                </div>

                <div>
                  <Label className="text-xs text-[#6B7280]">الحساب الأب (اختياري)</Label>
                  <select value={form.parentId} onChange={(e) => {
                    const parent = items.find(a => a.id === e.target.value) || null;
                    setForm(prev => ({
                      ...prev,
                      parentId: e.target.value,
                      ...(cashFlowManuallyEdited ? {} : { cashFlowType: inferCashFlowType(prev.type, `${prev.name} ${prev.nameAr}`, parent) }),
                    }));
                  }}
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white font-english">
                    <option value="">— لا يوجد · حساب رئيسي —</option>
                    {parentOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.code} · {p.nameAr || p.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-[#9CA3AF] mt-1">اربطه بحساب رئيسي ليصبح فرعياً وتظهر شجرة هرمية</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <Label className="text-xs text-[#6B7280]">الرمز * <span className="text-[#9CA3AF] text-[10px]">{!codeManuallyEdited && "(تلقائي)"}</span></Label>
                    <Input
                      value={form.code}
                      onChange={(e) => { setForm({ ...form, code: e.target.value }); setCodeManuallyEdited(true); }}
                      placeholder={`${TYPE_PREFIX[form.type]}1000`}
                      required dir="ltr" className="border-[#E5E7EB] font-english"
                    />
                    {codeManuallyEdited && (
                      <button type="button" onClick={() => { setCodeManuallyEdited(false); }} className="text-xs text-[#1276E3] hover:underline mt-1">↻ اقتراح تلقائي</button>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-[#6B7280] flex items-center justify-between">
                      <span>الاسم بالإنجليزية *</span>
                      <button type="button" onClick={() => aiSuggest(form.name || form.nameAr)} disabled={aiBusy} className="text-[10px] text-[#1276E3] hover:underline flex items-center gap-1 disabled:opacity-50">
                        {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        اقتراح بالذكاء
                      </button>
                    </Label>
                    <Input value={form.name} onChange={(e) => {
                      const parent = form.parentId ? items.find(a => a.id === form.parentId) : null;
                      const name = e.target.value;
                      setForm({ ...form, name, ...usageDefaults(form.type, `${name} ${form.nameAr}`, parent || null) });
                    }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) { e.preventDefault(); aiSuggest(form.name); } }}
                      placeholder="Office Supplies" required dir="ltr" className="border-[#E5E7EB] font-english" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-[#6B7280] flex items-center justify-between">
                    <span>الاسم بالعربية</span>
                    <button type="button" onClick={() => aiSuggest(form.nameAr || form.name)} disabled={aiBusy} className="text-[10px] text-[#1276E3] hover:underline flex items-center gap-1 disabled:opacity-50">
                      {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      اقتراح بالذكاء
                    </button>
                  </Label>
                  <Input value={form.nameAr} onChange={(e) => {
                    const parent = form.parentId ? items.find(a => a.id === form.parentId) : null;
                    const nameAr = e.target.value;
                    setForm({ ...form, nameAr, ...usageDefaults(form.type, `${form.name} ${nameAr}`, parent || null) });
                  }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) { e.preventDefault(); aiSuggest(form.nameAr); } }}
                    placeholder="مستلزمات مكتبية · أو اكتب 'جهاز' / 'مبيعات' والذكاء يقترح" className="border-[#E5E7EB]" />
                </div>

                {aiSuggestion && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span>{aiSuggestion}</span>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-[#6B7280]">الوصف (اختياري)</Label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="استخدامات الحساب..." className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
                </div>

                <div>
                  <Label className="text-xs text-[#6B7280]">نوع التدفق النقدي *</Label>
                  <select value={form.cashFlowType}
                    onChange={(e) => { setCashFlowManuallyEdited(true); setForm({ ...form, cashFlowType: e.target.value as CashFlowType }); }}
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                    {(Object.keys(CASH_FLOW_META) as CashFlowType[]).map((key) => (
                      <option key={key} value={key}>{CASH_FLOW_META[key].label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-[#9CA3AF] mt-1">{CASH_FLOW_META[form.cashFlowType].hint}</p>
                </div>

                <div className="rounded-lg border border-[#E5E7EB] p-3 space-y-2">
                  <div className="text-xs text-[#6B7280] font-medium">أين يظهر هذا الحساب؟</div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.allowPosting}
                      onChange={(e) => setForm({ ...form, allowPosting: e.target.checked })}
                      className="mt-1" />
                    <div>
                      <div className="text-sm text-[#0B1B49]">يظهر في القيود اليدوية</div>
                      <div className="text-xs text-[#9CA3AF]">فعّله إذا كان المحاسب يقدر يختار الحساب عند تسجيل قيد يدوي</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.allowPayment}
                      onChange={(e) => setForm({ ...form, allowPayment: e.target.checked })}
                      className="mt-1" />
                    <div>
                      <div className="text-sm text-[#0B1B49]">يظهر كحساب دفع أو تحصيل</div>
                      <div className="text-xs text-[#9CA3AF]">عادة لحسابات البنك والصندوق والبطاقات، وليس لكل حساب مصروف</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.allowExpenseClaim}
                      onChange={(e) => setForm({ ...form, allowExpenseClaim: e.target.checked })}
                      className="mt-1" />
                    <div>
                      <div className="text-sm text-[#0B1B49]">يظهر في مطالبات ومصاريف الموظفين</div>
                      <div className="text-xs text-[#9CA3AF]">فعّله لحسابات المصروفات التي يستخدمها الموظفون في المطالبات</div>
                    </div>
                  </label>
                </div>

                {/* Preview */}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-3">
                  <div className="text-xs text-[#9CA3AF] mb-1">معاينة</div>
                  <div className="flex items-center gap-2">
                    <span className="font-english text-sm text-[#1276E3] font-bold">{form.code || "—"}</span>
                    <span className="text-sm text-[#0B1B49]">·</span>
                    <span className="text-sm text-[#0B1B49] font-medium">{form.nameAr || form.name || "—"}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ms-auto ${TYPE_COLORS[form.type]}`}>{TYPE_LABELS[form.type]}</span>
                  </div>
                  {form.parentId && (() => {
                    const p = items.find(a => a.id === form.parentId);
                    return p ? <div className="text-xs text-[#9CA3AF] mt-1 font-english">↑ تحت: {p.code} · {p.nameAr || p.name}</div> : null;
                  })()}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-[#F3F4F6]">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
                <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? "حفظ التعديلات" : "حفظ")}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
