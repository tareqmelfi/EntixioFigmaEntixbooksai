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
import { BookOpen, Plus, Search, Trash2, Loader2, X, ChevronDown, ChevronRight as ChevronRightIcon, Edit2, Download, Upload, FileSpreadsheet, History, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, Account, AccountTransactions } from "../lib/api";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "أصل", LIABILITY: "التزام", EQUITY: "حقوق ملكية", REVENUE: "إيراد", EXPENSE: "مصروف",
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

  const [form, setForm] = useState({
    code: "", name: "", nameAr: "",
    type: "ASSET" as AccountType,
    parentId: "" as string,
    description: "",
  });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ rows: any[]; mapping: Record<string, string>; rawHeaders: string[] } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  // Transactions side panel
  const [txPanel, setTxPanel] = useState<{ accountId: string; data: AccountTransactions | null; loading: boolean } | null>(null);
  // AI translate state
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const aiSuggest = async (sourceText: string) => {
    if (!sourceText.trim()) { push("error", "اكتب اسم الحساب أولاً"); return; }
    setAiBusy(true); setAiSuggestion(null);
    try {
      const r = await api.accounts.translate(sourceText.trim(), form.parentId ? `Parent type: ${form.type}` : undefined);
      setForm(prev => ({
        ...prev,
        name: r.name || prev.name,
        nameAr: r.nameAr || prev.nameAr,
        type: r.type || prev.type,
        ...((!codeManuallyEdited && r.suggestedCode) ? { code: r.suggestedCode } : {}),
      }));
      setAiSuggestion(r.reasoning || `${r.category || r.type}`);
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

  const resetForm = () => {
    setForm({ code: "", name: "", nameAr: "", type: "ASSET", parentId: "", description: "" });
    setCodeManuallyEdited(false);
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
    });
    setCodeManuallyEdited(true);
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
    try {
      await api.accounts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", "تم الحذف");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    } finally { setPendingDelete(null); }
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

  const handleFilePick = async (file: File) => {
    try {
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
      setImportPreview({ rows: parsed, mapping, rawHeaders: headers });
    } catch (e: any) {
      push('error', e?.message || 'فشل قراءة الملف');
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      const r = await api.accounts.importBulk(importPreview.rows.map(row => ({
        code: row.code,
        name: row.name || row.nameAr || row.code,
        nameAr: row.nameAr || null,
        type: row.type,
        parentCode: row.parentCode || null,
        description: row.description || null,
      })) as any, true);
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
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePick(f); e.target.value = ''; }} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="border-[#E5E7EB]">
            <Upload className="me-2 h-4 w-4" /> استيراد CSV
          </Button>
          <Button variant="outline" onClick={handleExport} className="border-[#E5E7EB]">
            <Download className="me-2 h-4 w-4" /> تصدير CSV
          </Button>
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />حساب جديد</Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {(["ALL", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-lg border px-4 py-3 text-start transition ${filterType === t ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB] hover:bg-[#F9FAFB]"}`}
          >
            <div className="text-xs text-[#6B7280] mb-1">{t === "ALL" ? "الكل" : TYPE_LABELS[t]}</div>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{t === "ALL" ? items.length : (counts[t] || 0)}</div>
          </button>
        ))}
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">الحسابات ({flatRows.length})</CardTitle>
            <div className="flex items-center gap-2">
              <button onClick={() => setExpanded(new Set(items.map(a => a.id)))} className="text-xs text-[#1276E3] hover:underline">+ توسيع الكل</button>
              <button onClick={() => setExpanded(new Set())} className="text-xs text-[#6B7280] hover:underline">طيّ الكل</button>
              <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div>
          ) : flatRows.length === 0 ? (
            <div className="py-12 text-center"><BookOpen className="h-12 w-12 mx-auto text-[#E5E7EB] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد حسابات</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start font-medium">الرمز</th>
                <th className="py-3 px-4 text-start font-medium">الاسم</th>
                <th className="py-3 px-4 text-start font-medium">التصنيف</th>
                <th className="py-3 px-4 text-end font-medium">الرصيد</th>
                <th className="py-3 px-4 text-end font-medium">الإجراءات</th>
              </tr></thead>
              <tbody>
                {flatRows.map(node => (
                  <tr key={node.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF] group">
                    <td className="py-2.5 px-4 font-english text-sm text-[#1276E3] relative" style={{ fontWeight: 600 }}>
                      {/* Indentation guides · vertical lines per depth */}
                      <span className="inline-flex items-center" style={{ gap: 0 }}>
                        {Array.from({ length: node.depth }).map((_, d) => (
                          <span key={d} className="inline-block border-s-2 border-[#E5E7EB] h-7" style={{ width: '1.5rem', marginInlineStart: '0.25rem' }} />
                        ))}
                        {/* Branch connector for non-root */}
                        {node.depth > 0 && (
                          <span className="inline-block border-t-2 border-[#E5E7EB] me-1" style={{ width: '0.5rem' }} />
                        )}
                        {node.children.length > 0 ? (
                          <button onClick={() => toggleExpand(node.id)} className="text-[#9CA3AF] hover:text-[#1276E3] me-1">
                            {expanded.has(node.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                          </button>
                        ) : <span className="inline-block me-1" style={{ width: '0.875rem' }} />}
                        <button type="button" onClick={() => openTransactions(node.id)} className="hover:underline cursor-pointer">{node.code}</button>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-sm cursor-pointer" onClick={() => openTransactions(node.id)}>
                      <div className="text-[#0B1B49] hover:text-[#1276E3]" style={{ fontWeight: 500 }}>{node.nameAr || node.name}</div>
                      {node.nameAr && <div className="text-xs text-[#6B7280] font-english">{node.name}</div>}
                    </td>
                    <td className="py-2.5 px-4"><span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[node.type as AccountType]}`}>{TYPE_LABELS[node.type as AccountType]}</span></td>
                    <td className="py-2.5 px-4 text-end font-english">
                      {(node.balance ?? 0) !== 0 ? (
                        <span className={`font-semibold ${(node.balance ?? 0) >= 0 ? "text-[#0B1B49]" : "text-amber-700"}`}>
                          {(node.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">0.00</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-end">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openTransactions(node.id)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F4FCFF] hover:text-[#1276E3]" title="العمليات"><History className="h-4 w-4" /></button>
                        <button onClick={() => openEdit(node)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F4FCFF] hover:text-[#1276E3]" title="تعديل"><Edit2 className="h-4 w-4" /></button>
                        {pendingDelete === node.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button onClick={() => handleDelete(node.id)} className="px-2 py-1 rounded bg-red-600 text-white">تأكيد</button>
                            <button onClick={() => setPendingDelete(null)} className="px-2 py-1 rounded border border-[#E5E7EB]">إلغاء</button>
                          </span>
                        ) : (
                          <button onClick={() => setPendingDelete(node.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title="حذف"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setImportPreview(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#F3F4F6]">
              <h2 className="text-base text-[#0B1B49] flex items-center gap-2" style={{ fontWeight: 700 }}>
                <FileSpreadsheet className="h-5 w-5 text-[#1276E3]" /> معاينة الاستيراد
              </h2>
              <button type="button" onClick={() => setImportPreview(null)} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-4 w-4 text-[#6B7280]" /></button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                ✓ تم اكتشاف <span className="font-english font-bold">{importPreview.rows.length}</span> صف · الأعمدة المُكتشفة:
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(importPreview.mapping).filter(([_, v]) => v).map(([k, v]) => (
                    <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-white border border-blue-200 font-english">
                      <strong>{k}</strong> ← {v}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#E5E7EB] overflow-hidden max-h-96 overflow-y-auto">
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
                    {importPreview.rows.slice(0, 100).map((r, i) => {
                      const inferredType = r.type || (r.code ? (r.code.charAt(0) === '1' ? 'ASSET' : r.code.charAt(0) === '2' ? 'LIABILITY' : r.code.charAt(0) === '3' ? 'EQUITY' : r.code.charAt(0) === '4' ? 'REVENUE' : 'EXPENSE') : '?');
                      return (
                        <tr key={i} className="border-t border-[#F3F4F6]">
                          <td className="px-3 py-1.5 font-english font-semibold text-[#1276E3]">{r.code}</td>
                          <td className="px-3 py-1.5 font-english">{r.name || '—'}</td>
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
                {importPreview.rows.length > 100 && (
                  <div className="px-3 py-2 text-xs text-center text-[#9CA3AF] bg-[#F9FAFB]">+ {importPreview.rows.length - 100} صف إضافي ستُستورد كاملة</div>
                )}
              </div>

              <p className="text-xs text-[#9CA3AF]">سيتم تخطّي أي رمز موجود مسبقاً · الحسابات الفرعية تُربط تلقائياً بالأب عبر <span className="font-english">parentCode</span></p>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-[#F3F4F6]">
              <Button type="button" variant="outline" onClick={() => setImportPreview(null)} className="border-[#E5E7EB]" disabled={importBusy}>إلغاء</Button>
              <Button onClick={confirmImport} disabled={importBusy} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : `استيراد ${importPreview.rows.length} حساب`}
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
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType, parentId: "" })}
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                    {(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as AccountType[]).map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t]} · {t} ({TYPE_PREFIX[t]}xxxx)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-[#6B7280]">الحساب الأب (اختياري)</Label>
                  <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}
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
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
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
                  <select value={(form as any).cashFlowType || "OPERATING"}
                    onChange={(e) => setForm({ ...form, cashFlowType: e.target.value } as any)}
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                    <option value="OPERATING">التشغيلات (Operating)</option>
                    <option value="INVESTING">الاستثمارات (Investing)</option>
                    <option value="FINANCING">التمويلات (Financing)</option>
                    <option value="NON_CASH">غير نقدي (Non-Cash)</option>
                  </select>
                  <p className="text-xs text-[#9CA3AF] mt-1">حدد القسم الذي سيظهر فيه هذا الحساب ضمن قائمة التدفقات النقدية</p>
                </div>

                <div className="rounded-lg border border-[#E5E7EB] p-3 space-y-2">
                  <div className="text-xs text-[#6B7280] font-medium">كيف يمكن استخدام هذا الحساب؟ (اختياري)</div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={(form as any).allowPosting !== false}
                      onChange={(e) => setForm({ ...form, allowPosting: e.target.checked } as any)}
                      className="mt-1" />
                    <div>
                      <div className="text-sm text-[#0B1B49]">السماح بتسجيل المعاملات على هذا الحساب</div>
                      <div className="text-xs text-[#9CA3AF]">يُسمح للمستخدمين بتحديد هذا الحساب عند إنشاء القيود اليدوية</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={(form as any).allowPayment === true}
                      onChange={(e) => setForm({ ...form, allowPayment: e.target.checked } as any)}
                      className="mt-1" />
                    <div>
                      <div className="text-sm text-[#0B1B49]">السماح باختيار هذا الحساب للمدفوعات</div>
                      <div className="text-xs text-[#9CA3AF]">السماح باختيار هذا الحساب عند تسجيل أي مدفوعات</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={(form as any).allowExpenseClaim === true}
                      onChange={(e) => setForm({ ...form, allowExpenseClaim: e.target.checked } as any)}
                      className="mt-1" />
                    <div>
                      <div className="text-sm text-[#0B1B49]">السماح في مطالبات أو مصاريف الموظفين</div>
                      <div className="text-xs text-[#9CA3AF]">يظهر الحساب في نموذج تقديم مطالبات المصاريف</div>
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
