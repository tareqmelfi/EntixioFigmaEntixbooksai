/**
 * AI Assistant · agentic chat with file upload + tool calling
 *
 * - Chat with Claude · يقدر يضيف عملاء/فواتير/مصروفات/سندات
 * - Upload receipt → OCR → auto-create expense
 * - Generate financial summaries on demand
 */
import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Upload, Loader2, Bot, User, FileText, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, OcrResult } from "../lib/api";

interface Msg {
  role: "user" | "assistant";
  content: string;
  toolResults?: Array<{ tool: string; args: any; result: any }>;
  ocrResult?: OcrResult;
  attachment?: { name: string; preview?: string };
}

const QUICK_PROMPTS = [
  "كم إجمالي المصروفات هذا الشهر؟",
  "أعطني ملخص مالي لهذا الشهر",
  "اعرض لي آخر 10 فواتير",
  "أضف عميل جديد: شركة الفجر · رقم ضريبي 300123456789012",
  "كم عملائي وكم مورديني؟",
];

export function AI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; base64: string; mime: string; preview: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError("الملف أكبر من 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setPendingFile({ name: file.name, base64, mime: file.type, preview: result });
    };
    reader.readAsDataURL(file);
  };

  const handleScanReceipt = async () => {
    if (!pendingFile) return;
    setBusy(true);
    setError(null);
    const userMsg: Msg = {
      role: "user",
      content: `📎 رفعت ملف: ${pendingFile.name} · اقرأه واسجّله كمصروف`,
      attachment: { name: pendingFile.name, preview: pendingFile.preview },
    };
    setMessages(prev => [...prev, userMsg]);
    try {
      const ocr = await api.ocr.extract({
        fileBase64: pendingFile.base64,
        mimeType: pendingFile.mime,
        docType: "receipt",
      });
      const r = ocr.extracted;
      let assistantContent = `استخرجت من الملف:\n\n`;
      assistantContent += `• المورد: ${r.vendor || "غير واضح"}\n`;
      assistantContent += `• التاريخ: ${r.issueDate || "غير محدد"}\n`;
      assistantContent += `• المجموع: ${r.total} ${r.currency || "SAR"}\n`;
      if (r.taxAmount) assistantContent += `• الضريبة: ${r.taxAmount}\n`;
      if (r.category) assistantContent += `• التصنيف المقترح: ${r.category}\n`;
      assistantContent += `• الثقة: ${Math.round((r.confidence || 0) * 100)}%`;
      if (r.warnings?.length) assistantContent += `\n\n⚠️ ملاحظات: ${r.warnings.join(" · ")}`;

      // Auto-create expense if confidence > 0.6
      if ((r.confidence || 0) > 0.6 && r.total > 0) {
        const expense = await api.expenses.create({
          date: r.issueDate || new Date().toISOString().slice(0, 10),
          category: r.category || "غير مصنف",
          amount: r.subtotal || r.total - (r.taxAmount || 0),
          paymentMethod: (r.paymentMethod as any) || "OTHER",
          vendorName: r.vendor || undefined,
          taxAmount: r.taxAmount || 0,
          description: `OCR: ${r.documentNumber || pendingFile.name}`,
          currency: r.currency || "SAR",
        });
        assistantContent += `\n\n✅ تم حفظ المصروف رقم **${expense.number}** بقيمة ${Number(expense.total).toLocaleString()} ${expense.currency}`;
      } else {
        assistantContent += `\n\n⚠️ الثقة منخفضة · أدخل البيانات يدوياً من صفحة المصروفات`;
      }

      setMessages(prev => [...prev, { role: "assistant", content: assistantContent, ocrResult: r }]);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشلت قراءة الملف");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setBusy(true);

    const newMsgs: Msg[] = [...messages, { role: "user" as const, content: text }];
    setMessages(newMsgs);

    try {
      const r = await api.agent.chat(newMsgs.map(m => ({ role: m.role, content: m.content })));
      setMessages(prev => [...prev, { role: "assistant", content: r.message || "(تم تنفيذ الإجراء)", toolResults: r.toolResults }]);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل الاتصال بالـAgent");
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
            <p className="text-[#6B7280] text-sm mt-0.5">اطلب · ارفع · اسأل · ينفذ مباشرة في الـDB</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" onClick={() => setMessages([])} className="border-[#E5E7EB]">
            <Trash2 className="me-2 h-4 w-4" /> محادثة جديدة
          </Button>
        )}
      </div>

      {/* Messages */}
      <Card className="border-[#E5E7EB] flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef as any}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Bot className="h-16 w-16 text-[#1276E3] mb-4" />
              <h2 className="text-[#0B1B49] mb-2" style={{ fontSize: "1.25rem", fontWeight: 600 }}>كيف أقدر أساعدك؟</h2>
              <p className="text-[#6B7280] text-sm mb-6 max-w-md">
                ارفع فاتورة لاستخراجها · اطلب تقرير · أضف عميل/مصروف بكلمة
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
                <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التفكير...
              </div>
            </div>
          )}
        </CardContent>

        {/* Pending file preview */}
        {pendingFile && (
          <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[#1276E3]" />
              <div>
                <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>{pendingFile.name}</p>
                <p className="text-xs text-[#6B7280]">جاهز للمعالجة · OCR + إنشاء مصروف تلقائي</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPendingFile(null)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button size="sm" onClick={handleScanReceipt} disabled={busy} className="bg-[#1276E3] hover:bg-[#0B5FBF]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "معالجة"}
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-[#E5E7EB] p-3">
          {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="h-10 w-10 shrink-0 rounded-md border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1276E3] disabled:opacity-50"
              title="رفع فاتورة / إيصال"
            >
              <Upload className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="اسأل المساعد · أو اكتب طلب..."
              rows={1}
              className="flex-1 resize-none rounded-md border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20"
              disabled={busy}
            />
            <Button onClick={() => handleSend()} disabled={busy || !input.trim()} className="bg-[#1276E3] hover:bg-[#0B5FBF] h-10 px-4">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-2 text-center">
            الـAgent يقدر ينشئ/يحذف عملاء · مصروفات · سندات · ويرفع تقارير · Enter للإرسال · Shift+Enter لسطر جديد
          </p>
        </div>
      </Card>
    </div>
  );
}
