/**
 * Scan Receipts · UX-202 · Wave-style receipts intake hub
 * 3 options: phone scan / file upload / email forward
 * Email alias shows the org-specific bills+slug@entix.io
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Camera, Upload, Send, Copy, X, Inbox, Pencil, Check, RotateCcw, Loader2, FileText, Sparkles, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ToastStack, useToasts } from "../components/side-panel";
import { api } from "../lib/api";

const INBOUND_DOMAIN = "in.entix.io"; // dedicated inbound subdomain · apex mail stays on Google

export function ScanReceipts() {
  const { toasts, push, dismiss } = useToasts();
  const [orgId, setOrgId] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [customLocal, setCustomLocal] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any | null>(null);

  // Convert a File to a base64 data URL (no prefix) for the OCR/agent endpoints.
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = String(reader.result || "");
        const comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

  // Upload + OCR · runs inline on the Receipt Capture page (no redirect).
  // Falls back to the expense form with the file attached if extraction is slow/fails.
  const handleFilePick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadFileName(file.name);
    setUploadBusy(true);
    setOcrResult(null);
    let base64 = "";
    let mime = file.type || "application/octet-stream";
    try {
      base64 = await fileToBase64(file);
      // Try the universal document→rows extractor (bill-lines / expense target).
      const result = await api.agent.extractDocument({
        fileBase64: base64,
        fileName: file.name,
        mimeType: mime,
        target: "expense",
        hint: "receipt",
      });
      setOcrResult(result);
      push("success", "تم تحليل الإيصال · راجع النتيجة وأنشئ المصروف");
    } catch (e: any) {
      // Extraction failed · offer to continue manually with the file attached.
      push("error", "تعذّر التحليل بالذكاء · يمكنك المتابعة يدوياً");
      setOcrResult({ __error: true, file: { name: file.name, base64: base64, mime: mime } });
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Stash the OCR result for the expense form to pick up, then navigate.
  const createExpenseFromOcr = () => {
    if (ocrResult) {
      try { sessionStorage.setItem("entix_ocr_prefill", JSON.stringify(ocrResult)); } catch {}
    }
    navigate("/app/expenses/new?fromOcr=1");
  };

  useEffect(() => {
    (async () => {
      try {
        const orgs = await api.orgs.list();
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
        const active = (stored ? orgs.find((org) => org.id === stored) : null) || orgs[0];
        setOrgId(active?.id || "");
        setOrgSlug(active?.slug || "");
        setCustomLocal((active as any)?.inboundEmailLocal || null);
      } catch (e: any) {
        // Surface the error instead of silently falling back to the default alias.
        // The most common cause is an un-applied inboundEmailLocal migration on the
        // API DB — check /api/health/schema. Without this, a refresh reverts the alias.
        push("error", "تعذّر تحميل إعدادات الإيميل — تأكد أن قاعدة البيانات محدّثة (inboundEmailLocal).");
      }
    })();
  }, []);

  const defaultLocal = orgSlug ? `bills+${orgSlug}` : "";
  const activeLocal = customLocal || defaultLocal;
  const alias = activeLocal ? `${activeLocal}@${INBOUND_DOMAIN}` : "—";

  const copyAlias = async () => {
    if (!activeLocal) return;
    try { await navigator.clipboard.writeText(alias); push("success", "تم النسخ"); }
    catch { push("error", "فشل النسخ"); }
  };

  const openEdit = () => {
    setEditValue(customLocal || "");
    setEditError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const v = editValue.trim().toLowerCase();
    if (v && !/^[a-z0-9][a-z0-9.+-]{0,62}[a-z0-9]$/.test(v)) {
      setEditError("أحرف إنجليزية صغيرة وأرقام و . + - فقط · يبدأ وينتهي بحرف أو رقم");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      await api.orgs.update(orgId, { inboundEmailLocal: v || null } as any);
      setCustomLocal(v || null);
      setEditOpen(false);
      push("success", v ? `صار عنوانك ${v}@${INBOUND_DOMAIN}` : "رجعنا للعنوان الافتراضي");
    } catch (e: any) {
      const code = e?.code || "";
      setEditError(code === "inbound_local_taken" ? "هذا العنوان مستخدم من شركة أخرى · اختر غيره" : (e?.message || "فشل الحفظ"));
    } finally { setEditBusy(false); }
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto pt-4">
        <div className="text-xs text-primary uppercase tracking-wider mb-2 font-english">RECEIPTS</div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          تتبّع المصروفات تلقائياً <span className="italic text-primary">بالذكاء</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          ارفع صور إيصالاتك · يحوّلها AI تلقائياً إلى عمليات محاسبية · بدون كتابة يدوية
        </p>
        <p className="text-sm text-muted-foreground/60 mt-3">كيف تريد إدخال الإيصالات؟</p>
      </div>

      {/* 3 options grid · Wave-style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {/* Phone scan */}
        <Card className="border-border hover:border-[#1276E3] transition cursor-pointer group">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-primary/5 flex items-center justify-center">
              <Camera className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-foreground" style={{ fontWeight: 700 }}>التقاط بالهاتف</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              حمّل تطبيق ENTIX.IO للجوال والتقط الإيصالات بكاميرا الهاتف
            </p>
            <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded bg-blue-50 text-primary font-semibold">قريباً</span>
          </CardContent>
        </Card>

        {/* File upload · opens the OS file picker (no redirect) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFilePick(e.target.files)}
        />
        <div className="block" onClick={() => !uploadBusy && fileInputRef.current?.click()}>
          <Card className="border-border hover:border-[#1276E3] transition cursor-pointer h-full">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-primary/5 flex items-center justify-center">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-foreground" style={{ fontWeight: 700 }}>رفع من الكمبيوتر</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-5">
                اختر الملفات أو اسحبها هنا · صور PNG/JPG/WEBP · PDF · عدة مرفقات
              </p>
              <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">موصى به</span>
            </CardContent>
          </Card>
        </div>

        {/* Email forward */}
        <Card className="border-border hover:border-[#1276E3] transition">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-primary/5 flex items-center justify-center">
              <Send className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-foreground" style={{ fontWeight: 700 }}>إعادة توجيه بالإيميل</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              أرسل الإيصالات الرقمية للإيميل التالي وسيقرأها AI تلقائياً
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inline upload progress + OCR result · stays on this page (no redirect) */}
      {(uploadBusy || uploadFileName || ocrResult) && (
        <Card className="border-border max-w-3xl mx-auto">
          <CardContent className="p-5 space-y-3">
            {uploadBusy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ تحليل <span className="font-english text-foreground">{uploadFileName}</span> بالذكاء الاصطناعي…
              </div>
            )}
            {!uploadBusy && ocrResult && !ocrResult.__error && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-foreground" style={{ fontWeight: 700 }}>
                  <Sparkles className="h-4 w-4 text-primary" /> تم تحليل الإيصال
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {ocrResult.vendor && <div><span className="text-muted-foreground">المورّد:</span> <span className="text-foreground">{ocrResult.vendor}</span></div>}
                  {ocrResult.date && <div><span className="text-muted-foreground">التاريخ:</span> <span className="text-foreground font-english" dir="ltr">{ocrResult.date}</span></div>}
                  {ocrResult.total != null && <div><span className="text-muted-foreground">الإجمالي:</span> <span className="text-foreground font-english" dir="ltr">{ocrResult.total} {ocrResult.currency || "SAR"}</span></div>}
                  {Array.isArray(ocrResult.lines) && <div><span className="text-muted-foreground">عدد البنود:</span> <span className="text-foreground font-english" dir="ltr">{ocrResult.lines.length}</span></div>}
                </div>
                <Button onClick={createExpenseFromOcr} className="bg-primary hover:bg-primary/90 text-white">
                  <FileText className="h-4 w-4 me-1" /> إنشاء مصروف من النتيجة
                </Button>
              </div>
            )}
            {!uploadBusy && ocrResult?.__error && (
              <div className="space-y-2">
                <div className="text-sm text-amber-700">تعذّر التحليل بالذكاء · يمكنك المتابعة يدوياً مع المرفق.</div>
                <Button onClick={createExpenseFromOcr} variant="outline" className="border-border">
                  <ArrowLeft className="h-4 w-4 me-1" /> المتابعة يدوياً في صفحة المصروف
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email alias display */}
      <Card className="border-border max-w-3xl mx-auto">
        <CardContent className="p-5">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5" /> إيميل إعادة التوجيه الخاص بشركتك
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="flex-1 min-w-0 font-english text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 truncate" dir="ltr">
              {alias}
            </code>
            <button
              onClick={copyAlias}
              disabled={!activeLocal}
              className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/5 hover:border-[#1276E3] hover:text-primary transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" /> نسخ
            </button>
            <button
              onClick={openEdit}
              className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/5 hover:border-[#1276E3] hover:text-primary transition flex items-center gap-1.5"
              title="غيّر عنوان الاستقبال"
            >
              <Pencil className="h-3.5 w-3.5" /> تخصيص
            </button>
          </div>
          {customLocal && (
            <p className="mt-1.5 text-[11px] text-emerald-700">عنوان مخصص · الافتراضي: <span className="font-english" dir="ltr">{defaultLocal}@{INBOUND_DOMAIN}</span></p>
          )}

          {/* alias editor */}
          {editOpen && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-xs text-foreground" style={{ fontWeight: 600 }}>عنوان الاستقبال الخاص بك</div>
              <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
                <input
                  value={editValue}
                  onChange={(e) => { setEditValue(e.target.value); setEditError(null); }}
                  placeholder={defaultLocal || "bills.tareq"}
                  className="flex-1 min-w-[180px] font-english text-sm rounded-md border border-border bg-white px-3 py-2"
                  dir="ltr"
                  autoFocus
                />
                <span className="font-english text-sm text-muted-foreground">@{INBOUND_DOMAIN}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-5">
                مثال: <span className="font-english" dir="ltr">bills.tareq</span> · اتركه فاضيًا للرجوع للعنوان الافتراضي <span className="font-english" dir="ltr">{defaultLocal}</span>
              </p>
              {editError && <div className="text-xs text-red-600">{editError}</div>}
              <div className="flex items-center gap-2">
                <button
                  onClick={saveEdit}
                  disabled={editBusy}
                  className="px-3 py-1.5 rounded-md bg-primary text-white text-xs hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                >
                  {editBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} حفظ العنوان
                </button>
                {customLocal && (
                  <button
                    onClick={() => { setEditValue(""); }}
                    className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-white flex items-center gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> رجوع للافتراضي
                  </button>
                )}
                <button onClick={() => setEditOpen(false)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-white">إلغاء</button>
              </div>
            </div>
          )}

          <button onClick={() => setShowFaq(true)} className="mt-3 text-xs text-primary hover:underline">
            تعرف على كيفية فحص الإيصالات الرقمية ←
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground/60 leading-5">
            أي إيميل يوصل لهذا العنوان يدخل <Link to="/app/inbox" className="text-primary hover:underline">صندوق الوارد</Link> تلقائيًا مع مرفقاته ويقرأه الذكاء الاصطناعي.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground/60 text-center">
        الإيصالات تُحفظ في <Link to="/app/inbox" className="text-primary hover:underline">صندوق الوارد</Link>
        {" "} ثم تُحوّل تلقائياً لمصروفات/فواتير شراء بعد المراجعة
      </p>

      {/* FAQ modal */}
      {showFaq && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowFaq(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-foreground" style={{ fontWeight: 700 }}>فحص الإيصالات الرقمية</h2>
              <button onClick={() => setShowFaq(false)} className="p-1 hover:bg-muted/50 rounded">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-foreground/80">
              {[
                { q: "كيف يعمل؟", a: "تحوّل الإيصالات كمرفقات إلى الإيميل أعلاه من Gmail أو Outlook · سيقرأها AI تلقائياً ويضيفها للمعاملات." },
                { q: "أيش نوع الإيصالات؟", a: "ممتاز للإيصالات الرقمية اللي تجيك بالإيميل من Amazon · Uber · Stripe · إلخ." },
                { q: "كم تستغرق المعالجة؟", a: "حتى 5-15 دقيقة لتظهر في صندوق الوارد ثم تُحوّل بعد موافقتك." },
                { q: "صيغ الملفات المدعومة؟", a: "PDF · JPG · PNG · HEIC · GIF · حد أقصى 10 ميجا." },
                { q: "ممكن أرسل أكثر من إيصال في إيميل واحد؟", a: "نعم · سيُعالج كل إيصال على حدة." },
                { q: "ما الذي أكتبه في الإيميل؟", a: "ما في شروط · فقط أرفق الإيصال أو ضعه في جسم الرسالة." },
                { q: "إيصالي ما اتقرى · إيش السبب؟", a: "تأكد إنه واضح وغير ملطّخ · والحجم تحت 10MB · إذا استمرت المشكلة افتح Inbox وراجع يدوياً." },
              ].map((f, i) => (
                <div key={i} className="border-b border-border/50 pb-3 last:border-0">
                  <div className="text-foreground font-semibold mb-1">{f.q}</div>
                  <div className="text-muted-foreground text-xs leading-5">{f.a}</div>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowFaq(false)} className="mt-4 w-full bg-primary hover:bg-[#0F66C7]">حسناً</Button>
          </div>
        </div>
      )}
    </div>
  );
}
