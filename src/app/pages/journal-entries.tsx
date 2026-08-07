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
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, JournalEntryRow, Account, JournalAttachment } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type Line = { accountId: string; debit: string; credit: string; description: string };
const blankLine = (): Line => ({ accountId: "", debit: "0", credit: "0", description: "" });


type FormState = {
  date: string;
  description: string;
  reference: string;
  lines: Line[];
  postOnSave: boolean;
};

export function JournalEntries() {
  const { toasts, push, dismiss } = useToasts();
  const { t } = useLanguage();
  // UX-206 · debit/credit increase/decrease indicator
  function impactLabel(accountType: string, debit: number, credit: number): { text: string; tone: "up" | "down" | null } {
    if (!debit && !credit) return { text: "", tone: null };
    // Asset/Expense: debit increases · Liability/Equity/Revenue: credit increases
    const isDebitNormal = accountType === "ASSET" || accountType === "EXPENSE";
    if (debit > 0) return { text: isDebitNormal ? t("زاد ↑", "Debit ↑") : t("نقص ↓", "Credit ↓"), tone: isDebitNormal ? "up" : "down" };
    if (credit > 0) return { text: isDebitNormal ? t("نقص ↓", "Credit ↓") : t("زاد ↑", "Debit ↑"), tone: isDebitNormal ? "down" : "up" };
    return { text: "", tone: null };
  }
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
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
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
      push("info", t("اضغط (إلغاء ترحيل وتعديل) لتحرير قيد مرحَّل", "Click (Unpost & Edit) to edit a posted entry"));
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
      push("error", err instanceof ApiError ? err.message : t("فشل تحميل التفاصيل", "Failed to load details"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) { push("error", t("الوصف مطلوب", "Description is required")); return; }
    if (!balanced) { push("error", t("القيد غير متوازن", "Entry is not balanced")); return; }
    const validLines = form.lines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { push("error", t("يجب أن يحتوي القيد على سطرين على الأقل", "Entry must contain at least two lines")); return; }

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
        push("success", t("تم تحديث القيد", "Entry updated"));
      } else {
        await api.journals.create(payload);
        push("success", form.postOnSave ? t("تم حفظ القيد ومُرحَّل", "Entry saved and posted") : t("تم حفظ القيد كمسودة", "Entry saved as draft"));
      }
      setOpen(false); setEditMode(false); resetForm(); setSelected(null);
      refresh();
    } catch (err: any) {
      push("error", err instanceof ApiError ? err.message : t("فشل الحفظ", "Failed to save"));
    } finally { setBusy(false); }
  };

  const handlePost = async (id: string) => {
    try {
      await api.journals.post(id);
      push("success", t("تم ترحيل القيد · ستنعكس على لوحة التحكم", "Entry posted · it will reflect on the dashboard"));
      const fresh = await api.journals.get(id);
      setSelected(fresh);
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الترحيل", "Failed to post"));
    }
  };

  const handleUnpost = async (id: string) => {
    try {
      await api.journals.unpost(id);
      push("success", t("تم إلغاء الترحيل", "Entry unposted"));
      const fresh = await api.journals.get(id);
      setSelected(fresh);
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل إلغاء الترحيل", "Failed to unpost"));
    }
  };

  const unpostAndEdit = async (e: JournalEntryRow) => {
    try {
      await api.journals.unpost(e.id);
      push("success", t("تم إلغاء الترحيل · يمكنك التعديل الآن", "Unposted · you can edit now"));
      const fresh = await api.journals.get(e.id);
      setSelected(fresh);
      refresh();
      openEdit(fresh);
    } catch (err: any) {
      push("error", err instanceof ApiError ? err.message : t("فشل إلغاء الترحيل", "Failed to unpost"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.journals.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", t("تم الحذف", "Deleted"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Failed to delete"));
    } finally { setPendingDelete(null); }
  };

  const handleUpload = async (file: File) => {
    if (!selected) return;
    if (file.size > 25 * 1024 * 1024) { push("error", t("الحد الأقصى للملف 25 ميجا", "Maximum file size is 25MB")); return; }
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
      push("success", t("تم رفع المرفق", "Attachment uploaded"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الرفع", "Failed to upload"));
    }
  };

  const handleRemoveAttachment = async (aid: string) => {
    if (!selected) return;
    try {
      await api.journals.attachments.remove(selected.id, aid);
      setAttachments(prev => prev.filter(a => a.id !== aid));
      push("success", t("تم حذف المرفق", "Attachment deleted"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Failed to delete"));
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
            <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("قيود اليومية", "Journal Entries")}</h1>
            <p className="text-muted-foreground mt-1">{t("قيود محاسبية يدوية مع التحقق من توازن المدين والدائن", "Manual accounting entries with debit/credit balance verification")}</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="me-2 h-4 w-4" /> {t("قيد جديد", "New Entry")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("إجمالي القيود", "Total Entries")}</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }}>{items.length}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("المرحّلة", "Posted")}</div>
            <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.5rem" }}>{items.filter(e => e.status === "POSTED").length}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("المسودات", "Drafts")}</div>
            <div className="font-english font-bold text-amber-700 mt-1" style={{ fontSize: "1.5rem" }}>{totalDraft}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("إجمالي المبالغ المرحّلة", "Total Posted Amount")}</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{totalPosted.toLocaleString()}</div>
          </CardContent></Card>
        </div>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2"><BookOpen className="h-4 w-4" /> {t("سجل القيود", "Entries Log")}</CardTitle>
            <div className="flex gap-1">
              {(["", "POSTED", "DRAFT"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-md ${statusFilter === s ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {s === "" ? t("الكل", "All") : s === "POSTED" ? t("مرحّل", "Posted") : t("مسودة", "Draft")}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted mb-3" />
                <p className="text-sm text-muted-foreground">{t("لا توجد قيود يدوية بعد", "No manual entries yet")}</p>
                <button onClick={openCreate} className="text-sm text-primary hover:underline mt-2">+ {t("أضف أول قيد", "Add first entry")}</button>
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
                      <th className="text-start px-4 py-2.5 font-medium">{t("رقم", "No.")}</th>
                      <th className="text-start px-4 py-2.5 font-medium">{t("التاريخ", "Date")}</th>
                      <th className="text-start px-4 py-2.5 font-medium">{t("الوصف", "Description")}</th>
                      <th className="text-end px-4 py-2.5 font-medium">{t("المدين", "Debit")}</th>
                      <th className="text-end px-4 py-2.5 font-medium">{t("الدائن", "Credit")}</th>
                      <th className="text-center px-2 py-2.5 font-medium">{t("المصدر", "Source")}</th>
                      <th className="text-center px-2 py-2.5 font-medium">{t("الحالة", "Status")}</th>
                      <th className="px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(e => (
                      <tr key={e.id}
                        className={`border-t border-border/50 cursor-pointer hover:bg-primary/5 ${selected?.id === e.id ? "bg-primary/5" : ""}`}
                        onClick={() => openDetail(e.id)}>
                        <td className="px-4 py-3 font-english font-semibold text-primary truncate" dir="ltr">{e.number}</td>
                        <td className="px-4 py-3 font-english text-foreground/80" dir="ltr">{e.date.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <div className="text-foreground truncate" style={{ fontWeight: 500 }}>{e.description}</div>
                          <div className="text-xs text-muted-foreground/60 mt-0.5">
                            {e.lineCount} {t("سطر", "lines")}
                            {(e.attachmentCount || 0) > 0 && <span className="ms-2"><Paperclip className="inline h-3 w-3" /> {e.attachmentCount}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-end font-english font-semibold text-foreground" dir="ltr">{e.totalDebit.toLocaleString()}</td>
                        <td className="px-4 py-3 text-end font-english font-semibold text-foreground" dir="ltr">{e.totalCredit.toLocaleString()}</td>
                        <td className="px-2 py-3 text-center">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 whitespace-nowrap">{e.source === "manual" ? t("يدوي", "Manual") : e.source === "invoice" ? t("فاتورة", "Invoice") : e.source === "bill" ? t("مشتريات", "Purchases") : e.source || "—"}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${e.status === "POSTED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                            {e.status === "POSTED" ? t("مرحّل", "Posted") : t("مسودة", "Draft")}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-end" onClick={(ev) => ev.stopPropagation()}>
                          {e.source === "manual" && e.status === "DRAFT" && (
                            pendingDelete === e.id ? (
                              <span className="flex items-center gap-1 text-xs">
                                <button onClick={() => handleDelete(e.id)} className="px-2 py-1 rounded bg-red-600 text-white">{t("تأكيد", "Confirm")}</button>
                                <button onClick={() => setPendingDelete(null)} className="px-2 py-1 rounded border border-border">{t("إلغاء", "Cancel")}</button>
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
                <div className="text-xs text-muted-foreground">{t("التاريخ", "Date")}</div>
                <div className="font-english text-foreground mt-0.5" dir="ltr">{selected.date.slice(0, 10)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("الحالة", "Status")}</div>
                <div className="mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded ${selected.status === "POSTED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {selected.status === "POSTED" ? t("مرحّل", "Posted") : t("مسودة", "Draft")}
                  </span>
                </div>
              </div>
              {selected.reference && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">{t("المرجع", "Reference")}</div>
                  <div className="font-english text-foreground mt-0.5" dir="ltr">{selected.reference}</div>
                </div>
              )}
            </div>

            {/* Lines */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t("السطور", "Lines")}</div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="text-start px-2 py-1.5 font-medium">{t("الحساب", "Account")}</th>
                      <th className="text-end px-2 py-1.5 font-medium w-20">{t("مدين", "Debit")}</th>
                      <th className="text-end px-2 py-1.5 font-medium w-20">{t("دائن", "Credit")}</th>
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
                      <td className="px-2 py-1.5 text-end text-muted-foreground font-medium">{t("الإجمالي", "Total")}</td>
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
                  <Paperclip className="h-3.5 w-3.5" /> {t("المرفقات", "Attachments")} ({attachments.length})
                </div>
                <input ref={fileInputRef} type="file" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <button onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Upload className="h-3 w-3" /> {t("رفع", "Upload")}
                </button>
              </div>
              {attachments.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 text-center py-3 border border-dashed border-border rounded">
                  {t("لا توجد مرفقات", "No attachments")}
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
                    <Send className="h-4 w-4 me-1" /> {t("ترحيل", "Post")}
                  </Button>
                  <Button onClick={() => openEdit(selected)} variant="outline" className="border-border">
                    <Pencil className="h-4 w-4 me-1" /> {t("تعديل", "Edit")}
                  </Button>
                </>
              )}
              {selected.source === "manual" && selected.status === "POSTED" && (
                <>
                  <Button onClick={() => unpostAndEdit(selected)} className="bg-amber-500 hover:bg-amber-600 text-white">
                    <Pencil className="h-4 w-4 me-1" /> {t("إلغاء ترحيل وتعديل", "Unpost & Edit")}
                  </Button>
                  <Button onClick={() => handleUnpost(selected.id)} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                    <Undo2 className="h-4 w-4 me-1" /> {t("إلغاء الترحيل فقط", "Unpost only")}
                  </Button>
                </>
              )}
              {selected.source !== "manual" && (
                <div className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  {t("هذا القيد أُنشئ تلقائياً من", "This entry was auto-created from")} <span style={{fontWeight: 600}}>{selected.source === "invoice" ? t("فاتورة مبيعات", "a sales invoice") : selected.source === "bill" ? t("فاتورة شراء", "a purchase invoice") : selected.source === "expense" ? t("مصروف", "an expense") : selected.source === "voucher" ? t("سند", "a voucher") : t("مستند آخر", "another document")}</span>.
                  <br/>
                  {t("للتعديل · افتح المستند الأصلي وعدّل من هناك.", "To edit, open the source document and edit from there.")}
                </div>
              )}
              {selected.source === "manual" && selected.status === "DRAFT" && (
                pendingDelete === selected.id ? (
                  <span className="flex items-center gap-1">
                    <Button onClick={() => handleDelete(selected.id)} className="bg-red-600 hover:bg-red-700">{t("تأكيد الحذف", "Confirm delete")}</Button>
                    <Button onClick={() => setPendingDelete(null)} variant="outline" className="border-border">{t("إلغاء", "Cancel")}</Button>
                  </span>
                ) : (
                  <Button onClick={() => setPendingDelete(selected.id)} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 me-1" /> {t("حذف", "Delete")}
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
                  <Calculator className="h-5 w-5" /> {editMode ? t("تعديل قيد", "Edit Entry") : t("قيد يومية جديد", "New Journal Entry")}
                </h2>
                <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-muted/50 rounded">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("التاريخ", "Date")} *</Label>
                    <DateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} required inputClassName="" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">{t("الوصف", "Description")} *</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("قيد تسوية رواتب شهر...", "Monthly payroll settlement entry...")} required className="border-border" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("المرجع (اختياري)", "Reference (optional)")}</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("رقم مستند خارجي", "External document number")} className="border-border" />
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
                        <th className="text-start px-3 py-2 font-medium">{t("الحساب", "Account")}</th>
                        <th className="text-start px-3 py-2 font-medium">{t("البيان", "Memo")}</th>
                        <th className="text-end px-3 py-2 font-medium">{t("مدين", "Debit")}</th>
                        <th className="text-end px-3 py-2 font-medium">{t("دائن", "Credit")}</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((l, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-2 py-1.5">
                            <select value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}
                              className="w-full text-sm rounded border border-border px-2 py-1.5 bg-white">
                              <option value="">— {t("اختر حساباً", "Select an account")} —</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} · {a.nameAr || a.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })}
                              placeholder={t("بيان السطر...", "Line memo...")} className="w-full text-sm rounded border border-border px-2 py-1.5" />
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
                        <td colSpan={2} className="px-3 py-2 text-end text-muted-foreground font-medium">{t("الإجمالي", "Total")}</td>
                        <td className="px-3 py-2 text-end font-english font-bold text-foreground" dir="ltr">{totalDebit.toLocaleString()}</td>
                        <td className="px-3 py-2 text-end font-english font-bold text-foreground" dir="ltr">{totalCredit.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={addLine} className="text-sm text-primary hover:underline flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> {t("إضافة سطر", "Add line")}
                  </button>

                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${balanced ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {balanced ? t("متوازن ✓", "Balanced ✓") : (totalDebit === 0 && totalCredit === 0 ? t("أدخل المبالغ", "Enter amounts") : `${t("الفرق", "Difference")}: ${Math.abs(diff).toLocaleString()}`)}
                  </div>
                </div>

                {!editMode && (
                  <label className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer">
                    <input type="checkbox" checked={form.postOnSave}
                      onChange={(e) => setForm({ ...form, postOnSave: e.target.checked })}
                      className="rounded border-border" />
                    {t("ترحيل القيد فور الحفظ (سينعكس مباشرة على لوحة التحكم)", "Post entry on save (will reflect on the dashboard immediately)")}
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 p-5 border-t border-border/50">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border">{t("إلغاء", "Cancel")}</Button>
                <Button type="submit" disabled={busy || !balanced} className="bg-primary hover:bg-primary/90">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (editMode ? t("حفظ التعديلات", "Save changes") : (form.postOnSave ? t("حفظ وترحيل", "Save & Post") : t("حفظ كمسودة", "Save as Draft")))}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
