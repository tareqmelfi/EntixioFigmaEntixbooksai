/**
 * AI Assistant · agentic chat + multi-file OCR with classification
 *
 * - Chat with Claude · يقدر يضيف عملاء/فواتير/مصروفات/سندات
 * - Upload N files (any type) → batch OCR → classification table
 * - Auto-create expenses where confidence > 0.6, excluding bank statements
 */
import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Upload, Loader2, Bot, User, FileText, CheckCircle2, AlertCircle, X, MessageSquare, Plus, Archive } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, AgentConversation, AgentMessage, ExpenseLine, ExpensePaymentSplit, OcrResult } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";

interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: Array<{ tool: string; args: any; result: any }>;
  ocrResult?: OcrResult;
  attachment?: { name: string; preview?: string };
  batchSummary?: BatchSummary;
  createdAt?: string;
}

interface PendingFile {
  id: string;
  name: string;
  base64: string;
  mime: string;
  size: number;
}

interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  totalAmount: number;
  currency: string | null;
  rows: Array<{
    name?: string;
    ok: boolean;
    vendor?: string;
    vendorVat?: string;
    documentNumber?: string;
    date?: string;
    total?: number;
    currency?: string;
    lineCount?: number;
    createdNumber?: string;
    duplicateNumber?: string;
    blockedMessage?: string;
    error?: string;
  }>;
  index: { byDocType: Record<string, number>; byVendor: Record<string, number>; byMonth: Record<string, number>; byTag: Record<string, number> };
}

const QUICK_PROMPTS = [
  "كم إجمالي المصروفات هذا الشهر؟",
  "أعطني ملخص مالي لهذا الشهر",
  "اعرض لي آخر 10 فواتير",
  "أضف عميل جديد: شركة الفجر · رقم ضريبي 300123456789012",
  "كم عملائي وكم مورديني؟",
];

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB per file
const MAX_FILES = 50;
const ACTIVE_CONVERSATION_KEY = "entix_ai_active_conversation_id";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.split(",")[1]);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type ExpenseMethod = ExpensePaymentSplit["method"];

function normalizeMoney(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePaymentMethod(value: unknown): ExpenseMethod {
  const s = String(value || "").toUpperCase();
  if (s === "CASH") return "CASH";
  if (s === "BANK_TRANSFER" || s === "TRANSFER" || s.includes("BANK")) return "BANK_TRANSFER";
  if (s === "MADA") return "MADA";
  if (s === "STC_PAY" || s.includes("STC")) return "STC_PAY";
  if (s === "CHECK" || s === "CHEQUE") return "CHECK";
  if (s === "CARD" || s.includes("VISA") || s.includes("MASTER") || s.includes("CREDIT") || s.includes("DEBIT")) return "CARD";
  return "OTHER";
}

function normalizeTaxRate(value: unknown): number | null {
  const n = normalizeMoney(value);
  if (n == null) return null;
  if (n > 1) return n / 100;
  return n;
}

function buildExpenseLines(e: OcrResult): ExpenseLine[] {
  if (!Array.isArray(e.lineItems)) return [];
  return e.lineItems
    .map((line: any) => {
      const quantity = normalizeMoney(line.quantity) || 1;
      const unitPrice = normalizeMoney(line.unitPrice);
      const subtotal = normalizeMoney(line.subtotal ?? line.lineTotal);
      const lineTotal = subtotal ?? (unitPrice != null ? unitPrice * quantity : null);
      const description = String(line.description || "").trim();
      if (!description || lineTotal == null) return null;
      return {
        description,
        quantity,
        unitPrice: unitPrice ?? lineTotal / quantity,
        taxRate: normalizeTaxRate(line.taxRate ?? e.taxRate),
        taxInclusive: true,
        lineTotal,
        subtotal: lineTotal,
        category: e.category || null,
        notes: "OCR line item",
      } satisfies ExpenseLine;
    })
    .filter(Boolean) as ExpenseLine[];
}

function buildPaymentSplits(e: OcrResult, total: number, fallbackMethod: ExpenseMethod): ExpensePaymentSplit[] {
  const payments = Array.isArray((e as any).payments) ? (e as any).payments : [];
  const mapped = payments
    .map((p: any) => {
      const amount = normalizeMoney(p.amount);
      if (!amount || amount <= 0) return null;
      return {
        method: normalizePaymentMethod(p.method),
        amount,
        reference: p.reference || null,
        cardLast4: p.cardLast4 ? String(p.cardLast4).replace(/\D/g, "").slice(-4) : null,
        notes: "OCR payment split",
      } satisfies ExpensePaymentSplit;
    })
    .filter(Boolean) as ExpensePaymentSplit[];
  if (mapped.length > 0) return mapped;
  return [{ method: fallbackMethod, amount: total, notes: "OCR inferred payment" }];
}

function isBankStatementBlockedResult(e: OcrResult | undefined, fileName?: string): boolean {
  if (!e) return false;
  if (e.status === "needs_bank_statement_review" || e.documentType === "bank_statement" || e.docType === "STATEMENT") return true;
  const text = [
    fileName,
    e.message,
    e.summary,
    ...(Array.isArray(e.warnings) ? e.warnings : []),
  ].filter(Boolean).join("\n").toLowerCase();
  return /bank[\s_-]*statement|account[\s_-]*statement|statement of account|كشف\s+حساب|كشف\s*الحساب/.test(text);
}

function mapAgentMessage(m: AgentMessage): Msg {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    toolResults: Array.isArray(m.toolResults) ? m.toolResults : undefined,
    batchSummary: m.metadata?.batchSummary,
    createdAt: m.createdAt,
  };
}

function formatConversationTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

export function AI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toasts, push, dismiss } = useToasts();

  const refreshConversations = async () => {
    const r = await api.agent.conversations.list({ limit: 50 });
    setConversations(r.items);
    return r.items;
  };

  const ensureConversation = async (title: string) => {
    if (activeConversationId) return activeConversationId;
    const r = await api.agent.conversations.create({ title });
    setConversations((prev) => [r.conversation, ...prev.filter((c) => c.id !== r.conversation.id)]);
    return r.conversation.id;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingConversations(true);
      try {
        const r = await api.agent.conversations.list({ limit: 50 });
        if (!alive) return;
        setConversations(r.items);
        const saved = typeof localStorage !== "undefined" ? localStorage.getItem(ACTIVE_CONVERSATION_KEY) : null;
        const selected = saved && r.items.some((c) => c.id === saved) ? saved : r.items[0]?.id || null;
        setActiveConversationId(selected);
        if (!selected) setMessages([]);
      } catch (e: any) {
        if (alive) push("error", e instanceof ApiError ? e.message : "فشل تحميل محادثات المساعد");
      } finally {
        if (alive) setLoadingConversations(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!activeConversationId) {
      setMessages([]);
      if (typeof localStorage !== "undefined") localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
      return () => { alive = false; };
    }

    if (typeof localStorage !== "undefined") localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
    (async () => {
      setLoadingMessages(true);
      try {
        const r = await api.agent.conversations.messages(activeConversationId);
        if (!alive) return;
        setMessages(r.messages.map(mapAgentMessage));
      } catch (e: any) {
        if (alive) push("error", e instanceof ApiError ? e.message : "فشل تحميل المحادثة");
      } finally {
        if (alive) setLoadingMessages(false);
      }
    })();

    return () => { alive = false; };
  }, [activeConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const addFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    setError(null);
    const accepted: PendingFile[] = [];
    for (const f of arr) {
      if (pending.length + accepted.length >= MAX_FILES) {
        setError(`حد أقصى ${MAX_FILES} ملف لكل دفعة`);
        break;
      }
      if (f.size > MAX_FILE_SIZE) {
        push("error", `${f.name}: أكبر من ${fmtSize(MAX_FILE_SIZE)}`);
        continue;
      }
      try {
        const base64 = await readAsBase64(f);
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          base64,
          mime: f.type || "application/octet-stream",
          size: f.size,
        });
      } catch (e) {
        push("error", `فشل قراءة ${f.name}`);
      }
    }
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
  };

  const removePending = (id: string) => setPending((prev) => prev.filter((p) => p.id !== id));

  const handleProcessBatch = async () => {
    if (pending.length === 0) return;
    setBusy(true);
    setError(null);

    const userMsg: Msg = {
      role: "user",
      content: pending.length === 1
        ? `📎 رفعت ملف: ${pending[0].name} · اقرأه واسجّله`
        : `📎 رفعت ${pending.length} ملف · اقرأها وصنّفها`,
    };
    setMessages((prev) => [...prev, userMsg]);

    let conversationIdForBatch: string | null = null;
    try {
      conversationIdForBatch = await ensureConversation(userMsg.content);
      await api.agent.conversations.appendMessage(conversationIdForBatch, {
        role: "user",
        content: userMsg.content,
        metadata: { source: "ocr-batch-upload", fileCount: pending.length },
      });

      const r = await api.ocr.extractBatch({
        files: pending.map((p) => ({ fileBase64: p.base64, mimeType: p.mime, fileName: p.name })),
        hint: input.trim() || undefined,
      });

      // Auto-create expenses for high-confidence items, but never for bank statements.
      let createdCount = 0;
      let blockedStatementCount = 0;
      const createdByFile = new Map<string, { createdNumber?: string; duplicateNumber?: string }>();
      const pendingByName = new Map(pending.map((p) => [p.name, p]));
      for (const item of r.files) {
        if (!item.ok || !item.extracted) continue;
        const e = item.extracted;
        if (isBankStatementBlockedResult(e, item.fileName)) {
          blockedStatementCount += 1;
          continue;
        }
        const conf = e.confidence || 0;
        const total = normalizeMoney(e.total);
        if (conf > 0.6 && total != null && total > 0) {
          try {
            const sourceFile = item.fileName ? pendingByName.get(item.fileName) : undefined;
            const taxAmount = normalizeMoney(e.taxAmount) || 0;
            const subtotal = normalizeMoney(e.subtotal) ?? Math.max(total - taxAmount, 0);
            const method = normalizePaymentMethod(e.paymentMethod);
            const lineItems = buildExpenseLines(e);
            const saved: any = await api.expenses.create({
              date: e.issueDate || new Date().toISOString().slice(0, 10),
              category: e.category || "غير مصنف",
              amount: subtotal,
              subtotal,
              totalAmount: total,
              paymentMethod: method,
              vendorName: e.vendor || undefined,
              supplierTaxId: e.vendorVat || undefined,
              documentNumber: e.documentNumber || undefined,
              reference: e.documentNumber || undefined,
              taxAmount,
              lineItems: lineItems.length > 0 ? lineItems : null,
              paymentSplits: buildPaymentSplits(e, total, method),
              attachmentName: sourceFile?.name || item.fileName || null,
              attachmentType: sourceFile?.mime || item.mimeType || null,
              attachmentSizeBytes: sourceFile?.size || null,
              attachmentBase64: sourceFile?.base64 || null,
              attachmentCount: sourceFile ? 1 : 0,
              extractedJson: e,
              ocrConfidence: conf,
              autoCreateSupplier: true,
              description: [
                e.summary || `OCR: ${e.documentNumber || item.fileName || ""}`,
                e.documentNumber ? `رقم المستند: ${e.documentNumber}` : null,
                e.vendorVat ? `الرقم الضريبي للمورد: ${e.vendorVat}` : null,
                lineItems.length ? `البنود: ${lineItems.length}` : null,
              ].filter(Boolean).join(" · "),
              currency: e.currency || "SAR",
            });
            createdCount += 1;
            createdByFile.set(item.fileName || "", {
              createdNumber: saved?.number,
              duplicateNumber: saved?.duplicateExpense?.number,
            });
          } catch (err) {
            console.warn("[ai] auto-create expense failed", err);
          }
        }
      }

      // Build per-file rows after persistence, so duplicate and saved numbers show in the same table.
      const rows = r.files.map((f) => {
        const meta = createdByFile.get(f.fileName || "") || {};
        return {
          name: f.fileName,
          ok: f.ok,
          vendor: f.extracted?.vendor || undefined,
          vendorVat: f.extracted?.vendorVat || undefined,
          documentNumber: f.extracted?.documentNumber || undefined,
          date: f.extracted?.issueDate || undefined,
          total: typeof f.extracted?.total === "number" ? f.extracted.total : undefined,
          currency: f.extracted?.currency || undefined,
          lineCount: Array.isArray(f.extracted?.lineItems) ? f.extracted!.lineItems.length : undefined,
          createdNumber: meta.createdNumber,
          duplicateNumber: meta.duplicateNumber,
          blockedMessage: isBankStatementBlockedResult(f.extracted, f.fileName) ? (f.extracted?.message || "تم اكتشاف كشف حساب بنكي ولم يتم تحويله إلى مصروف.") : undefined,
          error: f.error,
        };
      });

      const summary: BatchSummary = {
        total: r.summary.totalFiles,
        successful: r.summary.successful,
        failed: r.summary.failed,
        totalAmount: r.summary.totalAmount,
        currency: r.summary.currency,
        rows,
        index: r.index,
      };

      let assistantContent = `معالجة ${r.summary.totalFiles} ملف · ✅ ${r.summary.successful} نجح · ${r.summary.failed > 0 ? `❌ ${r.summary.failed} فشل · ` : ""}إجمالي القيمة: ${r.summary.totalAmount.toLocaleString()} ${r.summary.currency || ""}`;
      if (createdCount > 0) assistantContent += `\n\n✨ تم إنشاء ${createdCount} مصروف تلقائياً (الثقة > 60%)`;
      if (blockedStatementCount > 0) assistantContent += `\n\nتم منع ${blockedStatementCount} كشف حساب بنكي من التحول إلى مصروف. يحتاج مراجعة/تسوية بنكية.`;
      const duplicateCount = rows.filter((row) => row.duplicateNumber).length;
      if (duplicateCount > 0) assistantContent += `\n⚠️ تم تعليم ${duplicateCount} كمكرر محتمل بدل تجاهله.`;

      await api.agent.conversations.appendMessage(conversationIdForBatch, {
        role: "assistant",
        content: assistantContent,
        metadata: { source: "ocr-batch", batchSummary: summary },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent, batchSummary: summary }]);
      setActiveConversationId(conversationIdForBatch);
      await refreshConversations();
      setPending([]);
      if (fileRef.current) fileRef.current.value = "";
      push("success", `تم معالجة ${r.summary.successful}/${r.summary.totalFiles}`);
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "فشل معالجة الملفات";
      setError(msg);
      push("error", msg);
      if (conversationIdForBatch) {
        setActiveConversationId(conversationIdForBatch);
        await refreshConversations().catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;

    // If files are pending, route through batch processing
    if (pending.length > 0) {
      handleProcessBatch();
      return;
    }

    setInput("");
    setError(null);
    setBusy(true);

    let conversationIdForSend: string | null = null;
    try {
      conversationIdForSend = await ensureConversation(text);
      setMessages((prev) => [...prev, { role: "user" as const, content: text }]);
      const r = await api.agent.chat({ conversationId: conversationIdForSend, message: text });
      setMessages((prev) => [...prev, { role: "assistant", content: r.message || "(تم تنفيذ الإجراء)", toolResults: r.toolResults }]);
      setActiveConversationId(r.conversationId || conversationIdForSend);
      await refreshConversations();
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "فشل الاتصال بالـAgent";
      setError(msg);
      push("error", msg);
      if (conversationIdForSend) setActiveConversationId(conversationIdForSend);
    } finally {
      setBusy(false);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    if (typeof localStorage !== "undefined") localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  };

  const archiveActiveConversation = async () => {
    if (!activeConversationId) return;
    try {
      await api.agent.conversations.update(activeConversationId, { status: "ARCHIVED" });
      const items = await refreshConversations();
      const next = items.find((c) => c.id !== activeConversationId)?.id || null;
      setActiveConversationId(next);
      if (!next) setMessages([]);
      push("success", "تمت أرشفة المحادثة");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل أرشفة المحادثة");
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="hidden xl:flex w-72 shrink-0 flex-col rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
        <div className="border-b border-[#E5E7EB] p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[#0B1B49] text-sm" style={{ fontWeight: 700 }}>المحادثات</p>
            <p className="text-[#9CA3AF] text-xs mt-0.5">محفوظة حسب الشركة</p>
          </div>
          <button
            onClick={startNewConversation}
            className="h-8 w-8 shrink-0 rounded-md bg-[#1276E3] text-white flex items-center justify-center hover:bg-[#0B5FBF]"
            title="محادثة جديدة"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loadingConversations && (
            <div className="text-xs text-[#9CA3AF] px-2 py-3">جار تحميل المحادثات...</div>
          )}
          {!loadingConversations && conversations.length === 0 && (
            <div className="rounded-md border border-dashed border-[#D1D5DB] p-3 text-xs text-[#6B7280] leading-6">
              لا توجد محادثات محفوظة بعد.
            </div>
          )}
          {conversations.map((conversation) => {
            const selected = conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                onClick={() => setActiveConversationId(conversation.id)}
                className={`w-full text-start rounded-md border px-3 py-2.5 transition-colors ${
                  selected
                    ? "border-[#1276E3] bg-[#F4FCFF] text-[#0B1B49]"
                    : "border-transparent hover:border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151]"
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={`h-4 w-4 mt-0.5 shrink-0 ${selected ? "text-[#1276E3]" : "text-[#9CA3AF]"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm" style={{ fontWeight: selected ? 700 : 600 }}>{conversation.title}</p>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#9CA3AF]">
                      <span>{formatConversationTime(conversation.lastMessageAt)}</span>
                      {typeof conversation.messageCount === "number" && <span className="font-english">{conversation.messageCount}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#1276E3]/10 p-3"><Sparkles className="h-7 w-7 text-[#1276E3]" /></div>
          <div>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>المساعد الذكي</h1>
            <p className="text-[#6B7280] text-sm mt-0.5">اطلب · ارفع · اسأل · ينفذ مباشرة في الـDB · يدعم ملفات متعددة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeConversationId && messages.length > 0 && (
            <Button variant="outline" onClick={archiveActiveConversation} className="border-[#E5E7EB]">
              <Archive className="me-2 h-4 w-4" /> أرشفة
            </Button>
          )}
          <Button variant="outline" onClick={startNewConversation} className="border-[#E5E7EB]">
            <Plus className="me-2 h-4 w-4" /> محادثة جديدة
          </Button>
        </div>
      </div>

      <Card className="border-[#E5E7EB] flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef as any}>
          {loadingMessages && (
            <div className="flex items-center justify-center h-full text-sm text-[#6B7280] gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> جار تحميل المحادثة...
            </div>
          )}

          {!loadingMessages && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Bot className="h-16 w-16 text-[#1276E3] mb-4" />
              <h2 className="text-[#0B1B49] mb-2" style={{ fontSize: "1.25rem", fontWeight: 600 }}>كيف أقدر أساعدك؟</h2>
              <p className="text-[#6B7280] text-sm mb-6 max-w-md">
                ارفع فاتورة (أو 50 فاتورة دفعة وحدة) لاستخراجها · اطلب تقرير · أضف عميل/مصروف بكلمة
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-2xl">
                {QUICK_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p)}
                    className="text-start text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-[#F4FCFF] hover:border-[#1276E3]/40 px-4 py-3 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loadingMessages && messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${m.role === "user" ? "bg-[#0B1B49]" : "bg-[#1276E3]/10"}`}>
                {m.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-[#1276E3]" />}
              </div>
              <div className={`flex-1 max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-[#0B1B49] text-white ms-auto" : "bg-[#F4FCFF] text-[#0B1B49] border border-[#E5E7EB]"}`}>
                {m.attachment && (
                  <div className="mb-2 rounded-lg border border-[#E5E7EB]/40 p-2 bg-white/10 flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="text-xs">{m.attachment.name}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                {/* Batch summary table */}
                {m.batchSummary && (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg border border-[#E5E7EB] overflow-hidden bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-[#F9FAFB]"><tr>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">الملف</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">المورد</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">رقم/ضريبة</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">التاريخ</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">المبلغ</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">الحالة</th>
                        </tr></thead>
                        <tbody>
                          {m.batchSummary.rows.map((r, j) => (
                            <tr key={j} className="border-t border-[#F3F4F6]">
                              <td className="py-2 px-3 text-[#0B1B49] truncate max-w-[180px]" title={r.name}>{r.name}</td>
                              <td className="py-2 px-3 text-[#374151]">{r.vendor || "—"}</td>
                              <td className="py-2 px-3 text-[#374151]">
                                <div className="font-english">{r.documentNumber || "—"}</div>
                                {r.vendorVat && <div className="font-english text-[10px] text-[#6B7280]">{r.vendorVat}</div>}
                                {typeof r.lineCount === "number" && r.lineCount > 0 && <div className="text-[10px] text-[#1276E3]">بنود: {r.lineCount}</div>}
                              </td>
                              <td className="py-2 px-3 font-english text-[#6B7280]">{r.date || "—"}</td>
                              <td className="py-2 px-3 font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>
                                {typeof r.total === "number" ? `${r.total.toLocaleString()} ${r.currency || ""}` : "—"}
                              </td>
                              <td className="py-2 px-3">
                                {r.blockedMessage ? (
                                  <div className="flex flex-col gap-0.5 text-amber-700">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-[10px]">{r.blockedMessage}</span>
                                  </div>
                                ) : r.ok ? (
                                  <div className="flex flex-col gap-0.5">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    {r.createdNumber && <span className="font-english text-[10px] text-[#1276E3]">{r.createdNumber}</span>}
                                    {r.duplicateNumber && <span className="font-english text-[10px] text-amber-700">مكرر: {r.duplicateNumber}</span>}
                                  </div>
                                ) : <span className="text-red-600 text-xs">{r.error || "فشل"}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Classification chips */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {Object.entries(m.batchSummary.index.byDocType).slice(0, 8).map(([k, v]) => (
                        <div key={`d-${k}`} className="rounded border border-[#E5E7EB] bg-white px-2 py-1 flex justify-between"><span className="text-[#6B7280]">{k}</span><span className="font-english text-[#1276E3]">{v}</span></div>
                      ))}
                    </div>
                    {Object.keys(m.batchSummary.index.byVendor).length > 0 && (
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">حسب المورد:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(m.batchSummary.index.byVendor).slice(0, 12).map(([k, v]) => (
                            <span key={`v-${k}`} className="text-xs px-2 py-0.5 rounded bg-[#F4FCFF] text-[#1276E3]">{k} · {v}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {m.toolResults && m.toolResults.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {m.toolResults.map((tr, j) => (
                      <div key={j} className="rounded border border-[#E5E7EB] bg-white/40 px-3 py-1.5 text-xs flex items-center gap-2">
                        {tr.result?.error ? <AlertCircle className="h-3.5 w-3.5 text-red-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                        <span className="font-english text-[#6B7280]">{tr.tool}</span>
                        {tr.result?.id && <span className="font-english text-[#1276E3]">→ {tr.result.number || tr.result.id}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full bg-[#1276E3]/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-[#1276E3]" />
              </div>
              <div className="bg-[#F4FCFF] border border-[#E5E7EB] rounded-2xl px-4 py-3 text-sm flex items-center gap-2 text-[#6B7280]">
                <Loader2 className="h-4 w-4 animate-spin" /> جارٍ المعالجة...
              </div>
            </div>
          )}
        </CardContent>

        {/* Pending files strip */}
        {pending.length > 0 && (
          <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#6B7280]"><span className="font-english">{pending.length}</span> ملف جاهز · OCR + تصنيف تلقائي + إنشاء مصروفات آمن</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPending([])} className="border-[#E5E7EB]">إفراغ</Button>
                <Button size="sm" onClick={handleProcessBatch} disabled={busy} className="bg-[#1276E3] hover:bg-[#0B5FBF]">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `معالجة ${pending.length}`}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {pending.map((f) => (
                <div key={f.id} className="flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-xs">
                  <FileText className="h-3.5 w-3.5 text-[#1276E3] shrink-0" />
                  <span className="truncate max-w-[160px]" title={f.name}>{f.name}</span>
                  <span className="font-english text-[#9CA3AF]">{fmtSize(f.size)}</span>
                  <button onClick={() => removePending(f.id)} className="text-[#9CA3AF] hover:text-red-600"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div
          className="border-t border-[#E5E7EB] p-3"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        >
          {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="h-10 w-10 shrink-0 rounded-md border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1276E3] disabled:opacity-50"
              title="رفع ملفات (يدعم الدفعات حتى 50 ملف)"
            >
              <Upload className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={pending.length > 0 ? `أضف ملاحظة (اختياري) ثم اضغط معالجة...` : "اسأل المساعد · أو اكتب طلب..."}
              rows={1}
              className="flex-1 resize-none rounded-md border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20"
              disabled={busy}
            />
            <Button onClick={() => handleSend()} disabled={busy || (!input.trim() && pending.length === 0)} className="bg-[#1276E3] hover:bg-[#0B5FBF] h-10 px-4">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-2 text-center">
            اسحب الملفات هنا · أو اضغط ⬆️ · يدعم PDF · صور · Excel · CSV · أي نوع · حتى 50 ملف دفعة وحدة
          </p>
        </div>
      </Card>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
