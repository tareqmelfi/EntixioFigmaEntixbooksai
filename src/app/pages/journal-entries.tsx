/**
 * Journal Entries · UX-89 · manual ledger entries with debit/credit balance check
 * Wave-style: row click → side panel with full detail · edit · post/unpost · attachments
 * Correct column alignment (RTL with explicit dir="ltr" on numeric cells)
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Loader2, BookOpen, Trash2, X, AlertCircle, CheckCircle2, Calculator,
  Pencil, Send, Undo2, Paperclip, Download, Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, JournalEntryRow, Account, JournalAttachment } from "../lib/api";

type Line = { accountId: string; debit: string; credit: string; description: string };
const blankLine = (): Line => ({ accountId: "", debit: "0", credit: "0", description: "" });
// UX-206 · debit/credit increase/decrease indicator
function impactLabel(accountType: string, debit: number, credit: number): { text: string; tone: "up" | "down" | null } {
  if (!debit && !credit) return { text: "", tone: null };
  // Asset/Expense: debit increases · Liability/Equity/Revenue: credit increases
  const isDebitNormal = accountType === "ASSET" || accountType === "EXPENSE";
  if (debit > 0) return { text: isDebitNormal ? "زاد ↑" : "نقص ↓", tone: isDebitNormal ? "up" : "down" };
  if (credit > 0) return { text: isDebitNormal ? "نقص ↓" : "زاد ↑", tone: isDebitNormal ? "down" : "up" };
  return { text: "", tone: null };
}


type FormState = {
  date: string;
  description: string;
  reference: string;
  lines: Line[];
  postOnSave: boolean;
};

export function JournalEntries() {
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<JournalEntryRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "POSTED" | "DRAFT">("");

  // Detail panel state
  const [selected, setSelected] = useState<JournalEntryRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [attachments, setAttachments] = useState<JournalAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<FormState>({
    date: today, description: "", reference: "", lines: [blankLine(), blankLine()], postOnSave: true,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([
        api.journals.list(statusFilter || undefined),
        api.accounts.list(),
      ]);
      setItems(j.items);
      setAccounts(a.items);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push, statusFilter]);
  useEffect(() => { refresh(); }, [refresh]);

  const totalDebit = form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff = totalDebit - totalCredit;
  const balanced = Math.abs(diff) < 0.01 && totalDebit > 0;

  const addLine = () => setForm({ ...form, lines: [...form.lines, blankLine()] });
  const removeLine = (i: number) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });
  const updateLine = (i: number, patch: Partial<Line>) => {
    const lines = [...form.lines];
    lines[i] = { ...lines[i], ...patch };
    setForm({ ...form, lines });
  };

  const resetForm = () => setForm({ date: today, description: "", reference: "", lines: [blankLine(), blankLine()], postOnSave: true });

  const openCreate = () => { resetForm(); setEditMode(false); setOpen(true); };

  const openEdit = (e: JournalEntryRow) => {
    if (e.status === "POSTED") {
      push("warning", "اضغط (إلغاء ترحيل وتعديل) لتحرير قيد مرحَّل");
      return;
    }
    setForm({
      date: e.date.slice(0, 10),
      description: e.description,
      reference: e.reference || "",
      lines: e.lines.map(l => ({
        accountId: l.accountId,
        debit: String(l.debit || 0),
        credit: String(l.credit || 0),
        description: l.description || "",
      })),
      postOnSave: false,
    });
    setEditMode(true);
    setOpen(true);
  };

  const openDetail = async (id: string) => {
    try {
      const e = await api.journals.get(id);
      setSelected(e);
      setAttachments(e.attachments || []);
    } catch (err: any) {
      push("error", err instanceof ApiError ? err.message : "فشل تحميل التفاصيل");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) { push("error", "الوصف مطلوب"); return; }
    if (!balanced) { push("error", "القيد غير متوازن"); return; }
    const validLines = form.lines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { push("error", "يجب أن يحتوي القيد على سطرين على الأقل"); return; }

    const payload = {
      date: form.date,
      description: form.description.trim(),
      reference: form.reference.trim() || null,
      postOnSave: form.postOnSave,
      lines: validLines.map(l => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description.trim() || null,
      })),
    };

    setBusy(true);
    try {
      if (editMode && selected) {
        await api.journals.update(selected.id, payload);
        push("success", "تم تحديث القيد");
      } else {
        await api.journals.create(payload);
        push("success", form.postOnSave ? "تم حفظ القيد ومُرحَّل" : "تم حفظ القيد كمسودة");
      }
      setOpen(false); setEditMode(false); resetForm(); setSelected(null);
      refresh();
    } catch (err: any) {
      push("error", err instanceof ApiError ? err.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handlePost = async (id: string) => {
    try {
      await api.journals.post(id);
      push("success", "تم ترحيل القيد · ستنعكس على لوحة التحكم");
      const fresh = await api.journals.get(id);
      setSelected(fresh);
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الترحيل");
    }
  };

  const handleUnpost = async (id: string) => {
    try {
      await api.journals.unpost(id);
      push("success", "تم إلغاء الترحيل");
      const fresh = await api.journals.get(id);
      setSelected(fresh);
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل إلغاء الترحيل");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.journals.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", "تم الحذف");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    } finally { setPendingDelete(null); }
  };

  const handleUpload = async (file: File) => {
    if (!selected) return;
    if (file.size > 25 * 1024 * 1024) { push("error", "الحد الأقصى للملف 25 ميجا"); return; }
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const newAtt = await api.journals.attachments.upload(selected.id, {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        data: base64,
      });
      setAttachments(prev => [newAtt, ...prev]);
      push("success", "تم رفع المرفق");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الرفع");
    }
  };

  const handleRemoveAttachment = async (aid: string) => {
    if (!selected) return;
    try {
      await api.journals.attachments.remove(selected.id, aid);
      setAttachments(prev => prev.filter(a => a.id !== aid));
      push("success", "تم حذف المرفق");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    }
  };

  const totalPosted = items.filter(e => e.status === "POSTED").reduce((s, e) => s + e.totalDebit, 0);
  const totalDraft = items.filter(e => e.status === "DRAFT").length;

  return (
    <div className="flex gap-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className={`space-y-6 transition-all ${selected ? "flex-1 min-w-0" : "w-full"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>قيود اليومية</h1>
            <p className="text-muted-foreground mt-1">قيود محاسبية يدوية مع التحقق من توازن المدين والدائن</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="me-2 h-4 w-4" /> قيد جديد
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">إجمالي القيود</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }}>{items.length}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">المرحّلة</div>
            <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.5rem" }}>{items.filter(e => e.status === "POSTED").length}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">المسودات</div>
            <div className="font-english font-bold text-amber-700 mt-1" style={{ fontSize: "1.5rem" }}>{totalDraft}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">إجمالي المبالغ المرحّلة</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{totalPosted.toLocaleString()}</div>
          </CardContent></Card>
        </div>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2"><BookOpen className="h-4 w-4" /> سجل القيود</CardTitle>
            <div className="flex gap-1">
              {(["", "POSTED", "DRAFT"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-md ${statusFilter === s ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {s === "" ? "الكل" : s === "POSTED" ? "مرحّل" : "مسودة"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-[#E5E7EB] mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد قيود يدوية بعد</p>
                <button onClick={openCreate} className="text-sm text-primary hover:underline mt-2">+ أضف أول قيد</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "100px" }} />
                    <col />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "90px" }} />
                    <col style={{ width: "60px" }} />
                  </colgroup>
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="text-start px-4 py-2.5 font-medium">رقم</th>
                      <th className="text-start px-4 py-2.5 font-medium">التاريخ</th>
                      <th className="text-start px-4 py-2.5 font-medium">الوصف</th>
                      <th className="text-end px-4 py-2.5 font-medium">المدين</th>
                      <th className="text-end px-4 py-2.5 font-medium">الدائن</th>
                      <th className="text-center px-2 py-2.5 font-medium">المصدر</th>
                      <th className="text-center px-2 py-2.5 font-medium">الحالة</th>
                      <th className="px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(e => (
                      <tr key={e.id}
                        className={`border-t border-border/50 cursor-pointer hover:bg-primary/5 ${selected?.id === e.id ? "bg-[#EFF8FF]" : ""}`}
                        onClick={() => openDetail(e.id)}>
                        <td className="px-4 py-3 font-english font-semibold text-primary truncate" dir="ltr">{e.number}</td>
                        <td className="px-4 py-3 font-english text-foreground/80" dir="ltr">{e.date.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <div className="text-foreground truncate" style={{ fontWeight: 500 }}>{e.description}</div>
                          <div className="text-xs text-muted-foreground/60 mt-0.5">
                            {e.lineCount} سطر
                            {(e.attachmentCount || 0) > 0 && <span className="ms-2"><Paperclip className="inline h-3 w-3" /> {e.attachmentCount}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-end font-english font-semibold text-foreground" dir="ltr">{e.totalDebit.toLocaleString()}</td>
                        <td className="px-4 py-3 text-end font-english font-semibold text-foreground" dir="ltr">{e.totalCredit.toLocaleString()}</td>
                        <td className="px-2 py-3 text-center">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 whitespace-nowrap">{e.source === "manual" ? "يدوي" : e.source === "invoice" ? "فاتورة" : e.source === "bill" ? "مشتريات" : e.source || "—"}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${e.status === "POSTED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                            {e.status === "POSTED" ? "مرحّل" : "مسودة"}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-end" onClick={(ev) => ev.stopPropagation()}>
                          {e.source === "manual" && e.status === "DRAFT" && (
                            pendingDelete === e.id ? (
                              <span className="flex items-center gap-1 text-xs">
                                <button onClick={() => handleDelete(e.id)} className="px-2 py-1 rounded bg-red-600 text-white">تأكيد</button>
                                <button onClick={() => setPendingDelete(null)} className="px-2 py-1 rounded border border-border">إلغاء</button>
                              </span>
                            ) : (
                              <button onClick={() => setPendingDelete(e.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── DETAIL PANEL ─────────────────────────────────────────────────── */}
      {selected && (
        <Card className="border-border w-[480px] flex-shrink-0 self-start sticky top-4">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
            <div>
              <div className="font-english font-bold text-primary" dir="ltr">{selected.number}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{selected.description}</div>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">التاريخ</div>
                <div className="font-english text-foreground mt-0.5" dir="ltr">{selected.date.slice(0, 10)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">الحالة</div>
                <div className="mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded ${selected.status === "POSTED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {selected.status === "POSTED" ? "مرحّل" : "مسودة"}
                  </span>
                </div>
              </div>
              {selected.reference && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">المرجع</div>
                  <div className="font-english text-foreground mt-0.5" dir="ltr">{selected.reference}</div>
                </div>
              )}
            </div>

            {/* Lines */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">السطور</div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="text-start px-2 py-1.5 font-medium">الحساب</th>
                      <th className="text-end px-2 py-1.5 font-medium w-20">مدين</th>
                      <th className="text-end px-2 py-1.5 font-medium w-20">دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((l, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-2 py-1.5">
                          <div className="font-english text-foreground/80 text-[11px]" dir="ltr">{l.accountCode}</div>
                          <div className="text-foreground">{l.accountName}</div>
                          {l.description && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{l.description}</div>}
                        </td>
                        <td className="px-2 py-1.5 text-end font-english" dir="ltr">{l.debit > 0 ? l.debit.toLocaleString() : "—"}</td>
                        <td className="px-2 py-1.5 text-end font-english" dir="ltr">{l.credit > 0 ? l.credit.toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted">
                    <tr>
                      <td className="px-2 py-1.5 text-end text-muted-foreground font-medium">الإجمالي</td>
                      <td className="px-2 py-1.5 text-end font-english font-bold text-foreground" dir="ltr">{selected.totalDebit.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-end font-english font-bold text-foreground" dir="ltr">{selected.totalCredit.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" /> المرفقات ({attachments.length})
                </div>
                <input ref={fileInputRef} type="file" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <button onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Upload className="h-3 w-3" /> رفع
                </button>
              </div>
              {attachments.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 text-center py-3 border border-dashed border-border rounded">
                  لا توجد مرفقات
                </div>
              ) : (
                <div className="space-y-1">
                  {attachments.map(a => (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0 truncate">{a.filename}</div>
                      <span className="font-english text-muted-foreground/60" dir="ltr">{(a.sizeBytes / 1024).toFixed(0)} KB</span>
                      <a href={a.url} download={a.filename} className="text-primary hover:bg-blue-50 p-1 rounded"><Download className="h-3 w-3" /></a>
                      <button onClick={() => handleRemoveAttachment(a.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
              {selected.source === "manual" && selected.status === "DRAFT" && (
                <>
                  <Button onClick={() => handlePost(selected.id)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Send className="h-4 w-4 me-1" /> ترحيل
                  </Button>
                  <Button onClick={() => openEdit(selected)} variant="outline" className="border-border">
                    <Pencil className="h-4 w-4 me-1" /> تعديل
                  </Button>
                </>
              )}
              {selected.source === "manual" && selected.status === "POSTED" && (
                <>
                  <Button onClick={() => unpostAndEdit(selected)} className="bg-amber-500 hover:bg-amber-600 text-white">
                    <Pencil className="h-4 w-4 me-1" /> إلغاء ترحيل وتعديل
                  </Button>
                  <Button onClick={() => handleUnpost(selected.id)} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                    <Undo2 className="h-4 w-4 me-1" /> إلغاء الترحيل فقط
                  </Button>
                </>
              )}
              {selected.source !== "manual" && (
                <div className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  هذا القيد أُنشئ تلقائياً من <span style={{fontWeight: 600}}>{selected.source === "invoice" ? "فاتورة مبيعات" : selected.source === "bill" ? "فاتورة شراء" : selected.source === "expense" ? "مصروف" : selected.source === "voucher" ? "سند" : "مستند آخر"}</span>{selected.sourceId ? <> رقم <span className="font-english">{selected.sourceId}</span></> : null}.
                  <br/>
                  للتعديل · افتح المستند الأصلي وعدّل من هناك.
                </div>
              )}
              {selected.source === "manual" && selected.status === "DRAFT" && (
                pendingDelete === selected.id ? (
                  <span className="flex items-center gap-1">
                    <Button onClick={() => handleDelete(selected.id)} className="bg-red-600 hover:bg-red-700">تأكيد الحذف</Button>
                    <Button onClick={() => setPendingDelete(null)} variant="outline" className="border-border">إلغاء</Button>
                  </span>
                ) : (
                  <Button onClick={() => setPendingDelete(selected.id)} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 me-1" /> حذف
                  </Button>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── CREATE / EDIT MODAL ──────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h2 className="text-lg text-foreground flex items-center gap-2" style={{ fontWeight: 700 }}>
                  <Calculator className="h-5 w-5" /> {editMode ? "تعديل قيد" : "قيد يومية جديد"}
                </h2>
                <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-muted/50 rounded">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">التاريخ *</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-border font-english" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">الوصف *</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="قيد تسوية رواتب شهر..." required className="border-border" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">المرجع (اختياري)</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم مستند خارجي" className="border-border" />
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "32%" }} />
                      <col />
                      <col style={{ width: "120px" }} />
                      <col style={{ width: "120px" }} />
                      <col style={{ width: "40px" }} />
                    </colgroup>
                    <thead className="bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="text-start px-3 py-2 font-medium">الحساب</th>
                        <th className="text-start px-3 py-2 font-medium">البيان</th>
                        <th className="text-end px-3 py-2 font-medium">مدين</th>
                        <th className="text-end px-3 py-2 font-medium">دائن</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((l, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-2 py-1.5">
                            <select value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}
                              className="w-full text-sm rounded border border-border px-2 py-1.5 bg-white">
                              <option value="">— اختر حساباً —</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} · {a.nameAr || a.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })}
                              placeholder="بيان السطر..." className="w-full text-sm rounded border border-border px-2 py-1.5" />
                            {(() => {
                              const acc = accounts.find(a => a.id === l.accountId);
                              if (!acc) return null;
                              const { text, tone } = impactLabel(acc.type, Number(l.debit) || 0, Number(l.credit) || 0);
                              if (!text) return null;
                              return (
                                <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded ${tone === "up" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                  {(acc.nameAr || acc.name)} {text}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step="0.01" min="0" value={l.debit}
                              onChange={(e) => updateLine(i, { debit: e.target.value, credit: Number(e.target.value) > 0 ? "0" : l.credit })}
                              dir="ltr" className="w-full text-sm rounded border border-border px-2 py-1.5 text-end font-english" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step="0.01" min="0" value={l.credit}
                              onChange={(e) => updateLine(i, { credit: e.target.value, debit: Number(e.target.value) > 0 ? "0" : l.debit })}
                              dir="ltr" className="w-full text-sm rounded border border-border px-2 py-1.5 text-end font-english" />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {form.lines.length > 2 && (
                              <button type="button" onClick={() => removeLine(i)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted text-xs">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-end text-muted-foreground font-medium">الإجمالي</td>
                        <td className="px-3 py-2 text-end font-english font-bold text-foreground" dir="ltr">{totalDebit.toLocaleString()}</td>
                        <td className="px-3 py-2 text-end font-english font-bold text-foreground" dir="ltr">{totalCredit.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={addLine} className="text-sm text-primary hover:underline flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> إضافة سطر
                  </button>

                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${balanced ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {balanced ? "متوازن ✓" : (totalDebit === 0 && totalCredit === 0 ? "أدخل المبالغ" : `الفرق: ${Math.abs(diff).toLocaleString()}`)}
                  </div>
                </div>

                {!editMode && (
                  <label className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer">
                    <input type="checkbox" checked={form.postOnSave}
                      onChange={(e) => setForm({ ...form, postOnSave: e.target.checked })}
                      className="rounded border-border" />
                    ترحيل القيد فور الحفظ (سينعكس مباشرة على لوحة التحكم)
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 p-5 border-t border-border/50">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border">إلغاء</Button>
                <Button type="submit" disabled={busy || !balanced} className="bg-primary hover:bg-primary/90">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (editMode ? "حفظ التعديلات" : (form.postOnSave ? "حفظ وترحيل" : "حفظ كمسودة"))}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
