/**
 * Journal Entries · UX-89 · manual ledger entries with debit/credit balance check
 */
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Loader2, BookOpen, Trash2, X, AlertCircle, CheckCircle2, Calculator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, JournalEntryRow, Account } from "../lib/api";

type Line = { accountId: string; debit: string; credit: string; description: string };
const blankLine = (): Line => ({ accountId: "", debit: "0", credit: "0", description: "" });

export function JournalEntries() {
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<JournalEntryRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today, description: "", reference: "",
    lines: [blankLine(), blankLine()],
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([api.journals.list(), api.accounts.list()]);
      setItems(j.items);
      setAccounts(a.items);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
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

  const resetForm = () => setForm({ date: today, description: "", reference: "", lines: [blankLine(), blankLine()] });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) { push("error", "الوصف مطلوب"); return; }
    if (!balanced) { push("error", "القيد غير متوازن"); return; }
    const validLines = form.lines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { push("error", "يجب أن يحتوي القيد على سطرين على الأقل"); return; }

    setBusy(true);
    try {
      await api.journals.create({
        date: form.date,
        description: form.description.trim(),
        reference: form.reference.trim() || null,
        lines: validLines.map(l => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description.trim() || null,
        })),
      });
      push("success", "تم حفظ القيد");
      setOpen(false); resetForm();
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.journals.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", "تم الحذف");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    } finally { setPendingDelete(null); }
  };

  const totalPosted = items.filter(e => e.status === "POSTED").reduce((s, e) => s + e.totalDebit, 0);

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>قيود اليومية</h1>
          <p className="text-[#6B7280] mt-1">قيود محاسبية يدوية مع التحقق من توازن المدين والدائن</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}>
          <Plus className="me-2 h-4 w-4" /> قيد جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-[#E5E7EB]"><CardContent className="p-4">
          <div className="text-xs text-[#6B7280]">إجمالي القيود</div>
          <div className="font-english font-bold text-[#0B1B49] mt-1" style={{ fontSize: "1.5rem" }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-4">
          <div className="text-xs text-[#6B7280]">القيود المرحّلة</div>
          <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.5rem" }}>{items.filter(e => e.status === "POSTED").length}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-4">
          <div className="text-xs text-[#6B7280]">إجمالي المبالغ المرحّلة</div>
          <div className="font-english font-bold text-[#0B1B49] mt-1" style={{ fontSize: "1.5rem" }}>{totalPosted.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-[#0B1B49] flex items-center gap-2"><BookOpen className="h-4 w-4" /> سجل القيود</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-[#E5E7EB] mb-3" />
              <p className="text-sm text-[#6B7280]">لا توجد قيود يدوية بعد</p>
              <button onClick={() => setOpen(true)} className="text-sm text-[#1276E3] hover:underline mt-2">+ أضف أول قيد</button>
              <p className="text-xs text-[#9CA3AF] mt-3">القيود التلقائية من الفواتير والمصروفات تُنشأ مباشرة في الخلفية</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium">رقم</th>
                    <th className="text-start px-4 py-2.5 font-medium">التاريخ</th>
                    <th className="text-start px-4 py-2.5 font-medium">الوصف</th>
                    <th className="text-end px-4 py-2.5 font-medium">المدين</th>
                    <th className="text-end px-4 py-2.5 font-medium">الدائن</th>
                    <th className="text-center px-4 py-2.5 font-medium">المصدر</th>
                    <th className="text-center px-4 py-2.5 font-medium">الحالة</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(e => (
                    <tr key={e.id} className="border-t border-[#F3F4F6] hover:bg-[#F4FCFF]">
                      <td className="px-4 py-3 font-english font-semibold text-[#1276E3]">{e.number}</td>
                      <td className="px-4 py-3 font-english text-[#374151]">{e.date.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="text-[#0B1B49]" style={{ fontWeight: 500 }}>{e.description}</div>
                        <div className="text-xs text-[#9CA3AF] mt-0.5">{e.lineCount} سطر</div>
                      </td>
                      <td className="px-4 py-3 text-end font-english font-semibold text-[#0B1B49]">{e.totalDebit.toLocaleString()}</td>
                      <td className="px-4 py-3 text-end font-english font-semibold text-[#0B1B49]">{e.totalCredit.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{e.source === "manual" ? "يدوي" : e.source || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${e.status === "POSTED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {e.status === "POSTED" ? "مرحّل" : "مسودة"}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-end">
                        {e.source === "manual" && (
                          pendingDelete === e.id ? (
                            <span className="flex items-center gap-1 text-xs">
                              <button onClick={() => handleDelete(e.id)} className="px-2 py-1 rounded bg-red-600 text-white">تأكيد</button>
                              <button onClick={() => setPendingDelete(null)} className="px-2 py-1 rounded border border-[#E5E7EB]">إلغاء</button>
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

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6]">
                <h2 className="text-lg text-[#0B1B49] flex items-center gap-2" style={{ fontWeight: 700 }}>
                  <Calculator className="h-5 w-5" /> قيد يومية جديد
                </h2>
                <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-5 w-5 text-[#6B7280]" /></button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-[#6B7280]">التاريخ *</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-[#E5E7EB] font-english" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-[#6B7280]">الوصف *</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="قيد تسوية رواتب شهر..." required className="border-[#E5E7EB]" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-[#6B7280]">المرجع (اختياري)</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم مستند خارجي" className="border-[#E5E7EB]" />
                </div>

                <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                      <tr>
                        <th className="text-start px-3 py-2 font-medium w-1/3">الحساب</th>
                        <th className="text-start px-3 py-2 font-medium">البيان</th>
                        <th className="text-end px-3 py-2 font-medium w-32">مدين</th>
                        <th className="text-end px-3 py-2 font-medium w-32">دائن</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((l, i) => (
                        <tr key={i} className="border-t border-[#F3F4F6]">
                          <td className="px-2 py-1.5">
                            <select value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}
                              className="w-full text-sm rounded border border-[#E5E7EB] px-2 py-1.5 bg-white">
                              <option value="">— اختر حساباً —</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} · {a.nameAr || a.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })}
                              placeholder="بيان السطر..." className="w-full text-sm rounded border border-[#E5E7EB] px-2 py-1.5" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step="0.01" min="0" value={l.debit}
                              onChange={(e) => updateLine(i, { debit: e.target.value, credit: Number(e.target.value) > 0 ? "0" : l.credit })}
                              dir="ltr" className="w-full text-sm rounded border border-[#E5E7EB] px-2 py-1.5 text-end font-english" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step="0.01" min="0" value={l.credit}
                              onChange={(e) => updateLine(i, { credit: e.target.value, debit: Number(e.target.value) > 0 ? "0" : l.debit })}
                              dir="ltr" className="w-full text-sm rounded border border-[#E5E7EB] px-2 py-1.5 text-end font-english" />
                          </td>
                          <td className="px-1 py-1.5">
                            {form.lines.length > 2 && (
                              <button type="button" onClick={() => removeLine(i)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#F9FAFB] text-xs">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-end text-[#6B7280] font-medium">الإجمالي</td>
                        <td className="px-3 py-2 text-end font-english font-bold text-[#0B1B49]">{totalDebit.toLocaleString()}</td>
                        <td className="px-3 py-2 text-end font-english font-bold text-[#0B1B49]">{totalCredit.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={addLine} className="text-sm text-[#1276E3] hover:underline flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> إضافة سطر
                  </button>

                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${balanced ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {balanced ? "متوازن ✓" : (totalDebit === 0 && totalCredit === 0 ? "أدخل المبالغ" : `الفرق: ${Math.abs(diff).toLocaleString()}`)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-5 border-t border-[#F3F4F6]">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
                <Button type="submit" disabled={busy || !balanced} className="bg-[#1276E3] hover:bg-[#1060C0]">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ القيد"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
