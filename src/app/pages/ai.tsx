/**
 * AI Assistant · agentic chat + multi-file OCR with classification
 *
 * - Chat with Claude · يقدر يضيف عملاء/فواتير/مصروفات/سندات
 * - Upload N files (any type) → batch OCR → classification table
 * - Route OCR documents conservatively: expenses, purchase bills, bank review, or manual review
 */
import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Upload, Loader2, Bot, User, FileText, CheckCircle2, AlertCircle, X, MessageSquare, Plus, Archive } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, AgentConversation, AgentMessage, Contact, ExpenseLine, ExpensePaymentSplit, OcrResult } from "../lib/api";
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
    docType?: string;
    route?: DocumentRoute;
    recordType?: "expense" | "bill" | "bank_statement" | "review";
    recordId?: string;
    recordNumber?: string;
    destinationLabel?: string;
    destinationHref?: string;
    actionLabel?: string;
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
type DocumentRoute = "expense" | "bill" | "bank_statement" | "contract_review" | "manual_review";

type CreatedRecordMeta = {
  recordType: "expense" | "bill" | "bank_statement" | "review";
  recordId?: string;
  recordNumber?: string;
  destinationLabel: string;
  destinationHref?: string;
  actionLabel: string;
  createdNumber?: string;
  duplicateNumber?: string;
  blockedMessage?: string;
};

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(value: string | null | undefined, days: number): string {
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) return todayIso();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function normalizeDocType(e?: OcrResult): string {
  return String(e?.docType || e?.documentType || "OTHER").toUpperCase();
}

function isPaymentEvidence(e: OcrResult): boolean {
  const hasSplit = Array.isArray(e.payments) && e.payments.some((p) => normalizeMoney(p.amount) != null || p.method);
  return Boolean(e.paymentMethod || hasSplit);
}

function classifyDocumentRoute(e: OcrResult | undefined, fileName?: string): DocumentRoute {
  if (!e) return "manual_review";
  if (isBankStatementBlockedResult(e, fileName)) return "bank_statement";
  const docType = normalizeDocType(e);
  const text = [
    docType,
    fileName,
    e.summary,
    ...(Array.isArray(e.tags) ? e.tags : []),
  ].filter(Boolean).join(" ").toLowerCase();

  if (docType === "STATEMENT") return "manual_review";
  if (docType === "CONTRACT" || /contract|agreement|عقد|اتفاقية|مقاولة|ضمانة|warranty|guarantee/.test(text)) {
    return "contract_review";
  }
  if (docType === "RECEIPT") return "expense";
  if ((docType === "INVOICE" || docType === "BILL") && isPaymentEvidence(e)) return "expense";
  if (docType === "INVOICE" || docType === "BILL") return "bill";
  return "manual_review";
}

function routeLabel(route: DocumentRoute): string {
  if (route === "expense") return "مصروف نقدي";
  if (route === "bill") return "فاتورة مشتريات";
  if (route === "bank_statement") return "كشف/تسوية بنكية";
  if (route === "contract_review") return "مراجعة عقود";
  return "مراجعة يدوية";
}

function defaultRouteMeta(route: DocumentRoute): CreatedRecordMeta {
  if (route === "bank_statement") {
    return {
      recordType: "bank_statement",
      destinationLabel: "تسوية البنوك",
      destinationHref: "/app/bank-reconciliation",
      actionLabel: "لم يسجل كمصروف",
      blockedMessage: "تم اكتشاف كشف حساب/حركة بنكية. وجّهها للتسوية البنكية بدل المصروفات.",
    };
  }
  if (route === "contract_review") {
    return {
      recordType: "review",
      destinationLabel: "مراجعة العقود",
      actionLabel: "لم يسجل تلقائياً",
      blockedMessage: "هذا يبدو عقداً/اتفاقية. يحتاج مراجعة قبل إنشاء التزام أو فاتورة.",
    };
  }
  if (route === "manual_review") {
    return {
      recordType: "review",
      destinationLabel: "مراجعة يدوية",
      actionLabel: "لم يسجل تلقائياً",
      blockedMessage: "المستند غير كافٍ للتسجيل الآمن. يحتاج مراجعة.",
    };
  }
  return {
    recordType: route === "bill" ? "bill" : "expense",
    destinationLabel: route === "bill" ? "فواتير المشتريات" : "المصروفات",
    destinationHref: route === "bill" ? "/app/purchases/bills" : "/app/expenses",
    actionLabel: route === "bill" ? "جاهز كفاتورة مشتريات" : "جاهز كمصروف",
  };
}

function buildBillLines(e: OcrResult, total: number) {
  const lines = Array.isArray(e.lineItems) ? e.lineItems : [];
  const mapped = lines
    .map((line: any) => {
      const quantity = normalizeMoney(line.quantity) || 1;
      const subtotal = normalizeMoney(line.subtotal ?? line.lineTotal);
      const unitPrice = normalizeMoney(line.unitPrice) ?? (subtotal != null ? subtotal / quantity : null);
      const description = String(line.description || "").trim();
      if (!description || unitPrice == null) return null;
      return {
        productId: null,
        description,
        quantity,
        unitPrice,
      };
    })
    .filter(Boolean) as Array<{ productId: null; description: string; quantity: number; unitPrice: number }>;

  if (mapped.length > 0) return mapped;
  return [{
    productId: null,
    description: e.summary || e.documentNumber || e.vendor || "OCR purchase bill",
    quantity: 1,
    unitPrice: normalizeMoney(e.subtotal) ?? total,
  }];
}

async function findOrCreateSupplier(e: OcrResult): Promise<Contact> {
  const displayName = (e.vendor || "مورد غير معروف").trim();
  const taxId = e.vendorVat?.trim() || null;
  const q = taxId || displayName.slice(0, 60);
  const existing = await api.contacts.list({ type: "SUPPLIER", q, limit: 200 }).catch(() => ({ items: [] as Contact[] }));
  const byTax = taxId
    ? existing.items.find((c) => c.taxId === taxId || c.vatNumber === taxId)
    : undefined;
  const byName = existing.items.find((c) => c.displayName.trim().toLowerCase() === displayName.toLowerCase());
  if (byTax || byName) return (byTax || byName)!;
  return api.contacts.create({
    displayName,
    type: "SUPPLIER",
    isSupplier: true,
    entityKind: "COMPANY",
    taxId,
    vatNumber: taxId,
    country: "SA",
    notes: "Created from Entix AI OCR batch routing",
  });
}

function toolResultHref(tool: string, result: any): string | null {
  if (!result || result.error) return null;
  const name = String(tool || "").toLowerCase();
  if (name.includes("expense")) return "/app/expenses";
  if (name.includes("bill")) return result.id ? `/app/purchases/bills/${result.id}` : "/app/purchases/bills";
  if (name.includes("invoice")) return result.id ? `/app/invoices/${result.id}` : "/app/invoices";
  if (name.includes("contact")) return result.id ? `/app/contacts/${result.id}` : "/app/contacts";
  return null;
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
  if (e.status === "needs_bank_statement_review" || e.documentType === "bank_statement") return true;
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
  const lastMessage = messages[messages.length - 1];
  const waitingForPersistedReply = Boolean(activeConversationId && !busy && !loadingMessages && lastMessage?.role === "user");

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
    if (!activeConversationId || !waitingForPersistedReply) return;
    let alive = true;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const r = await api.agent.conversations.messages(activeConversationId);
        if (!alive) return;
        setMessages(r.messages.map(mapAgentMessage));
        const newest = r.messages[r.messages.length - 1];
        if (newest?.role === "assistant" || attempts >= 30) alive = false;
      } catch {
        if (attempts >= 5) alive = false;
      }
    };
    const id = window.setInterval(() => {
      if (alive) poll();
      else window.clearInterval(id);
    }, 3000);
    poll();
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [activeConversationId, waitingForPersistedReply]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, waitingForPersistedReply]);

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

  const handleProcessBatch = async (noteOverride?: string) => {
    const batchFiles = pending;
    if (batchFiles.length === 0) return;
    const note = (noteOverride ?? input).trim();
    setBusy(true);
    setError(null);
    setInput("");

    const fileText = batchFiles.length === 1
      ? `📎 رفعت ملف: ${batchFiles[0].name} · اقرأه وصنّفه`
      : `📎 رفعت ${batchFiles.length} ملف · اقرأها وصنّفها`;
    const userMsg: Msg = {
      role: "user",
      content: note ? `${fileText}\n\nطلبي: ${note}` : fileText,
    };
    setMessages((prev) => [...prev, userMsg]);

    let conversationIdForBatch: string | null = null;
    try {
      conversationIdForBatch = await ensureConversation(userMsg.content);
      await api.agent.conversations.appendMessage(conversationIdForBatch, {
        role: "user",
        content: userMsg.content,
        metadata: { source: "ocr-batch-upload", fileCount: batchFiles.length, hint: note || null, fileNames: batchFiles.map((f) => f.name) },
      });

      const r = await api.ocr.extractBatch({
        files: batchFiles.map((p) => ({ fileBase64: p.base64, mimeType: p.mime, fileName: p.name })),
        hint: note || undefined,
      });

      // Route documents by accounting intent before persistence.
      let createdExpenseCount = 0;
      let createdBillCount = 0;
      let blockedStatementCount = 0;
      let reviewCount = 0;
      const createdByFile = new Map<string, CreatedRecordMeta>();
      const pendingByName = new Map(batchFiles.map((p) => [p.name, p]));
      for (const item of r.files) {
        if (!item.ok || !item.extracted) continue;
        const e = item.extracted;
        const route = classifyDocumentRoute(e, item.fileName);
        if (route === "bank_statement") {
          blockedStatementCount += 1;
          createdByFile.set(item.fileName || "", defaultRouteMeta(route));
          continue;
        }
        const conf = e.confidence || 0;
        const total = normalizeMoney(e.total);
        if ((route === "contract_review" || route === "manual_review") || conf <= 0.6 || total == null || total <= 0) {
          reviewCount += 1;
          createdByFile.set(item.fileName || "", defaultRouteMeta(route));
          continue;
        }

        if (route === "bill") {
          try {
            const supplier = await findOrCreateSupplier(e);
            const saved: any = await api.bills.create({
              contactId: supplier.id,
              billNumber: e.documentNumber || undefined,
              status: "DRAFT",
              issueDate: e.issueDate || todayIso(),
              dueDate: e.dueDate || addDaysIso(e.issueDate, 30),
              currency: e.currency || "SAR",
              notes: [
                "Created by Entix AI OCR as purchase bill draft.",
                e.summary || null,
                item.fileName ? `Source file: ${item.fileName}` : null,
                e.vendorVat ? `Supplier VAT: ${e.vendorVat}` : null,
                note ? `User note: ${note}` : null,
              ].filter(Boolean).join("\n"),
              lines: buildBillLines(e, total),
            });
            createdBillCount += 1;
            createdByFile.set(item.fileName || "", {
              recordType: "bill",
              recordId: saved?.id,
              recordNumber: saved?.billNumber,
              destinationLabel: "فاتورة مشتريات",
              destinationHref: saved?.id ? `/app/purchases/bills/${saved.id}` : "/app/purchases/bills",
              actionLabel: "أُنشئت كمسودة",
              createdNumber: saved?.billNumber,
            });
          } catch (err: any) {
            reviewCount += 1;
            createdByFile.set(item.fileName || "", {
              ...defaultRouteMeta("manual_review"),
              blockedMessage: err instanceof ApiError ? err.message : "تعذر إنشاء فاتورة المشتريات. يحتاج مراجعة.",
            });
            console.warn("[ai] auto-create purchase bill failed", err);
          }
          continue;
        }

        if (route === "expense") {
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
            createdExpenseCount += 1;
            createdByFile.set(item.fileName || "", {
              recordType: "expense",
              recordId: saved?.id,
              recordNumber: saved?.number,
              destinationLabel: "مصروف نقدي",
              destinationHref: "/app/expenses",
              actionLabel: "أُنشئ كمصروف",
              createdNumber: saved?.number,
              duplicateNumber: saved?.duplicateExpense?.number,
            });
          } catch (err) {
            console.warn("[ai] auto-create expense failed", err);
            reviewCount += 1;
            createdByFile.set(item.fileName || "", {
              ...defaultRouteMeta("manual_review"),
              blockedMessage: err instanceof ApiError ? err.message : "تعذر إنشاء المصروف. يحتاج مراجعة.",
            });
          }
        }
      }

      // Build per-file rows after persistence, so duplicate and saved numbers show in the same table.
      const rows = r.files.map((f) => {
        const route = classifyDocumentRoute(f.extracted, f.fileName);
        const fallbackMeta = defaultRouteMeta(route);
        const meta = createdByFile.get(f.fileName || "") || fallbackMeta;
        return {
          name: f.fileName,
          ok: f.ok,
          docType: normalizeDocType(f.extracted),
          route,
          vendor: f.extracted?.vendor || undefined,
          vendorVat: f.extracted?.vendorVat || undefined,
          documentNumber: f.extracted?.documentNumber || undefined,
          date: f.extracted?.issueDate || undefined,
          total: typeof f.extracted?.total === "number" ? f.extracted.total : undefined,
          currency: f.extracted?.currency || undefined,
          lineCount: Array.isArray(f.extracted?.lineItems) ? f.extracted!.lineItems.length : undefined,
          recordType: meta.recordType,
          recordId: meta.recordId,
          recordNumber: meta.recordNumber || meta.createdNumber,
          destinationLabel: meta.destinationLabel,
          destinationHref: meta.destinationHref,
          actionLabel: meta.actionLabel,
          createdNumber: meta.createdNumber,
          duplicateNumber: meta.duplicateNumber,
          blockedMessage: meta.blockedMessage || (isBankStatementBlockedResult(f.extracted, f.fileName) ? (f.extracted?.message || "تم اكتشاف كشف حساب بنكي ولم يتم تحويله إلى مصروف.") : undefined),
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
      if (createdExpenseCount > 0) assistantContent += `\n\n✨ تم إنشاء ${createdExpenseCount} مصروف تلقائياً.`;
      if (createdBillCount > 0) assistantContent += `\n\n🧾 تم إنشاء ${createdBillCount} فاتورة مشتريات كمسودة للمراجعة.`;
      if (blockedStatementCount > 0) assistantContent += `\n\nتم توجيه ${blockedStatementCount} كشف/حركة بنكية إلى التسوية بدل تحويلها لمصروف.`;
      if (reviewCount > 0) assistantContent += `\n\n${reviewCount} ملف يحتاج مراجعة قبل التسجيل.`;
      assistantContent += `\n\nالفرق المختصر: فاتورة المشتريات مطالبة من مورد وقد تكون غير مدفوعة، أما المصروف فهو صرف/إيصال مدفوع فعلياً.`;
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
    if (busy || (!text && pending.length === 0)) return;

    // If files are pending, route through batch processing
    if (pending.length > 0) {
      await handleProcessBatch(text);
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
                      <div className="overflow-x-auto">
                      <table className="min-w-[920px] w-full text-xs">
                        <thead className="bg-[#F9FAFB]"><tr>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">الملف</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">النوع</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">المورد</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">رقم/ضريبة</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">التاريخ</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">المبلغ</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">المكان / الحالة</th>
                        </tr></thead>
                        <tbody>
                          {m.batchSummary.rows.map((r, j) => (
                            <tr key={j} className="border-t border-[#F3F4F6]">
                              <td className="py-2 px-3 text-[#0B1B49] max-w-[220px]" title={r.name}>
                                {r.destinationHref ? (
                                  <Link to={r.destinationHref} className="block truncate text-[#1276E3] hover:underline" title={r.name}>
                                    {r.name}
                                  </Link>
                                ) : (
                                  <span className="block truncate">{r.name}</span>
                                )}
                                {r.recordNumber && <span className="font-english text-[10px] text-[#6B7280]">{r.recordNumber}</span>}
                              </td>
                              <td className="py-2 px-3">
                                <span className="inline-flex rounded-md bg-[#EEF6FF] px-2 py-0.5 text-[11px] text-[#0B1B49]" style={{ fontWeight: 700 }}>
                                  {routeLabel((r.route || "manual_review") as DocumentRoute)}
                                </span>
                                {r.docType && <div className="font-english text-[10px] text-[#9CA3AF] mt-1">{r.docType}</div>}
                              </td>
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
                                <div className="flex flex-col gap-1">
                                  {r.destinationHref ? (
                                    <Link to={r.destinationHref} className="font-english text-[#1276E3] hover:underline" style={{ fontWeight: 700 }}>
                                      {r.recordNumber || r.destinationLabel}
                                    </Link>
                                  ) : (
                                    <span className="text-[#374151]" style={{ fontWeight: 700 }}>{r.destinationLabel || "—"}</span>
                                  )}
                                  {r.actionLabel && <span className="text-[10px] text-[#6B7280]">{r.actionLabel}</span>}
                                  {r.blockedMessage ? (
                                    <div className="flex items-start gap-1 text-amber-700">
                                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                      <span className="text-[10px] leading-4">{r.blockedMessage}</span>
                                    </div>
                                  ) : r.ok ? (
                                    <div className="flex items-center gap-1 text-green-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span className="text-[10px]">تمت القراءة</span>
                                    </div>
                                  ) : <span className="text-red-600 text-xs">{r.error || "فشل"}</span>}
                                  {r.duplicateNumber && <span className="font-english text-[10px] text-amber-700">مكرر: {r.duplicateNumber}</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
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
                    {m.toolResults.map((tr, j) => {
                      const href = toolResultHref(tr.tool, tr.result);
                      const inner = (
                        <>
                          {tr.result?.error ? <AlertCircle className="h-3.5 w-3.5 text-red-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                          <span className="font-english text-[#6B7280]">{tr.tool}</span>
                          {tr.result?.id && <span className="font-english text-[#1276E3]">→ {tr.result.number || tr.result.billNumber || tr.result.invoiceNumber || tr.result.id}</span>}
                        </>
                      );
                      return href ? (
                        <Link key={j} to={href} className="rounded border border-[#E5E7EB] bg-white/40 px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-white hover:underline">
                          {inner}
                        </Link>
                      ) : (
                        <div key={j} className="rounded border border-[#E5E7EB] bg-white/40 px-3 py-1.5 text-xs flex items-center gap-2">
                          {inner}
                        </div>
                      );
                    })}
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
          {waitingForPersistedReply && !busy && (
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full bg-[#1276E3]/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-[#1276E3]" />
              </div>
              <div className="bg-[#F4FCFF] border border-[#E5E7EB] rounded-2xl px-4 py-3 text-sm flex items-center gap-2 text-[#6B7280]">
                <Loader2 className="h-4 w-4 animate-spin" /> بانتظار الرد المحفوظ من السيرفر...
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
                <Button size="sm" onClick={() => handleProcessBatch()} disabled={busy} className="bg-[#1276E3] hover:bg-[#0B5FBF]">
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
