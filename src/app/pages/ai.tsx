/**
 * AI Assistant · agentic chat + multi-file OCR with classification
 *
 * - Chat with Claude · يقدر يضيف عملاء/فواتير/مصروفات/سندات
 * - Upload N files (any type) → batch OCR → classification table
 * - Auto-create expenses where confidence > 0.6
 */
import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Upload, Loader2, Bot, User, FileText, CheckCircle2, AlertCircle, Trash2, X } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, OcrResult } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";

interface Msg {
  role: "user" | "assistant";
  content: string;
  toolResults?: Array<{ tool: string; args: any; result: any }>;
  ocrResult?: OcrResult;
  attachment?: { name: string; preview?: string };
  batchSummary?: BatchSummary;
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
  rows: Array<{ name?: string; ok: boolean; vendor?: string; date?: string; total?: number; currency?: string; error?: string }>;
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

export function AI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toasts, push, dismiss } = useToasts();

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

    try {
      const r = await api.ocr.extractBatch({
        files: pending.map((p) => ({ fileBase64: p.base64, mimeType: p.mime, fileName: p.name })),
        hint: input.trim() || undefined,
      });

      // Build per-file rows
      const rows = r.files.map((f) => ({
        name: f.fileName,
        ok: f.ok,
        vendor: f.extracted?.vendor || undefined,
        date: f.extracted?.issueDate || undefined,
        total: typeof f.extracted?.total === "number" ? f.extracted.total : undefined,
        currency: f.extracted?.currency || undefined,
        error: f.error,
      }));

      // Auto-create expenses for high-confidence items
      let createdCount = 0;
      for (const item of r.files) {
        if (!item.ok || !item.extracted) continue;
        const e = item.extracted;
        const conf = e.confidence || 0;
        if (conf > 0.6 && typeof e.total === "number" && e.total > 0) {
          try {
            await api.expenses.create({
              date: e.issueDate || new Date().toISOString().slice(0, 10),
              category: e.category || "غير مصنف",
              amount: e.subtotal || e.total - (e.taxAmount || 0),
              paymentMethod: (e.paymentMethod as any) || "OTHER",
              vendorName: e.vendor || undefined,
              taxAmount: e.taxAmount || 0,
              description: `OCR: ${e.documentNumber || item.fileName || ""}`,
              currency: e.currency || "SAR",
            });
            createdCount += 1;
          } catch (err) {
            console.warn("[ai] auto-create expense failed", err);
          }
        }
      }

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

      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent, batchSummary: summary }]);
      setPending([]);
      if (fileRef.current) fileRef.current.value = "";
      push("success", `تم معالجة ${r.summary.successful}/${r.summary.totalFiles}`);
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "فشل معالجة الملفات";
      setError(msg);
      push("error", msg);
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

    const newMsgs: Msg[] = [...messages, { role: "user" as const, content: text }];
    setMessages(newMsgs);

    try {
      const r = await api.agent.chat(newMsgs.map((m) => ({ role: m.role, content: m.content })));
      setMessages((prev) => [...prev, { role: "assistant", content: r.message || "(تم تنفيذ الإجراء)", toolResults: r.toolResults }]);
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "فشل الاتصال بالـAgent";
      setError(msg);
      push("error", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#1276E3]/10 p-3"><Sparkles className="h-7 w-7 text-[#1276E3]" /></div>
          <div>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>المساعد الذكي</h1>
            <p className="text-[#6B7280] text-sm mt-0.5">اطلب · ارفع · اسأل · ينفذ مباشرة في الـDB · يدعم ملفات متعددة</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" onClick={() => setMessages([])} className="border-[#E5E7EB]">
            <Trash2 className="me-2 h-4 w-4" /> محادثة جديدة
          </Button>
        )}
      </div>

      <Card className="border-[#E5E7EB] flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef as any}>
          {messages.length === 0 && (
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

          {messages.map((m, i) => (
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
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">التاريخ</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">المبلغ</th>
                          <th className="py-2 px-3 text-start font-medium text-[#6B7280]">الحالة</th>
                        </tr></thead>
                        <tbody>
                          {m.batchSummary.rows.map((r, j) => (
                            <tr key={j} className="border-t border-[#F3F4F6]">
                              <td className="py-2 px-3 text-[#0B1B49] truncate max-w-[180px]" title={r.name}>{r.name}</td>
                              <td className="py-2 px-3 text-[#374151]">{r.vendor || "—"}</td>
                              <td className="py-2 px-3 font-english text-[#6B7280]">{r.date || "—"}</td>
                              <td className="py-2 px-3 font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>
                                {typeof r.total === "number" ? `${r.total.toLocaleString()} ${r.currency || ""}` : "—"}
                              </td>
                              <td className="py-2 px-3">
                                {r.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="text-red-600 text-xs">{r.error || "فشل"}</span>}
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
              <p className="text-xs text-[#6B7280]"><span className="font-english">{pending.length}</span> ملف جاهز · OCR + تصنيف تلقائي + إنشاء مصروفات</p>
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

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
