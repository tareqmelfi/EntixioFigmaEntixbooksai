/**
 * سندات الصرف · Payment Vouchers (cash OUT to suppliers)
 * Wafeq-style: supplier + bill link + attachments + branded PDF + email send
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Search, X, Trash2, Loader2, Printer, Mail, Paperclip, Upload, Download,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, Voucher, Contact, ApiError } from "../lib/api";

const METHOD_LABELS: Record<Voucher["paymentMethod"], string> = {
  CASH: "نقداً", BANK_TRANSFER: "تحويل بنكي", CARD: "بطاقة ائتمان",
  STC_PAY: "STC Pay", MADA: "مدى", CHECK: "شيك", OTHER: "أخرى",
};

export function Payments() {
  const [items, setItems] = useState<Voucher[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [summary, setSummary] = useState({ sumAmount: "0", avgAmount: "0" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Voucher | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [form, setForm] = useState<any>({
    contactId: "",
    billId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    paymentMethod: "BANK_TRANSFER",
    reference: "",
    bankAccountId: "",
    notes: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [v, s, b] = await Promise.all([
        api.vouchers.list({ type: "PAYMENT" }),
        api.contacts.list({ type: "SUPPLIER" }).catch(() => ({ items: [] })),
        api.bankAccounts.list().catch(() => ({ items: [] })),
      ]);
      setItems(v.items);
      setSummary(v.summary);
      setSuppliers((s as any).items || []);
      setBankAccounts((b as any).items || []);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!form.contactId) { setBills([]); return; }
    (api as any).bills?.list?.({ contactId: form.contactId, status: "RECEIVED,PARTIAL,OVERDUE" })
      ?.then((r: any) => setBills(r.items || []))
      ?.catch(() => setBills([]));
  }, [form.contactId]);

  const filtered = items.filter(p =>
    !searchQuery || p.number.includes(searchQuery) ||
    (p.contact?.displayName || "").includes(searchQuery) ||
    (p.notes || "").includes(searchQuery)
  );
  const total = Number(summary.sumAmount || 0);
  const avg = Number(summary.avgAmount || 0);

  const resetForm = () => setForm({
    contactId: "", billId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "", paymentMethod: "BANK_TRANSFER", reference: "", bankAccountId: "", notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { push("error", "أدخل مبلغاً صحيحاً"); return; }
    if (!form.contactId) { push("error", "اختر المورد"); return; }
    setBusy(true);
    try {
      const v = await api.vouchers.create({
        type: "PAYMENT",
        contactId: form.contactId,
        billId: form.billId || null,
        date: form.date,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        bankAccountId: form.paymentMethod !== "CASH" ? (form.bankAccountId || null) : null,
        reference: form.reference || null,
        notes: form.notes || null,
      });
      setItems(prev => [v, ...prev]);
      push("success", `تم إنشاء ${v.number}`);
      setOpen(false); resetForm();
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const openSelected = async (v: Voucher) => {
    setSelected(v);
    try {
      const r = await api.vouchers.attachments.list(v.id);
      setAttachments(r.items || []);
    } catch { setAttachments([]); }
  };

  const handleUpload = async (file: File) => {
    if (!selected) return;
    if (file.size > 25 * 1024 * 1024) { push("error", "الحد الأقصى 25 ميجا"); return; }
    try {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const newAtt = await api.vouchers.attachments.upload(selected.id, {
        filename: file.name, contentType: file.type || "application/octet-stream",
        sizeBytes: file.size, data,
      });
      setAttachments(prev => [newAtt, ...prev]);
      push("success", "تم الرفع");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الرفع");
    }
  };

  const handlePrint = (v: Voucher) => window.open(api.vouchers.printUrl(v.id), "_blank");
  const handleEmail = async () => {
    if (!selected) return;
    try {
      const to = emailForm.to || (selected.contact as any)?.email;
      if (!to) { push("error", "المورد ليس له بريد"); return; }
      await api.vouchers.email(selected.id, { to, subject: emailForm.subject || undefined, message: emailForm.message || undefined });
      push("success", `تم الإرسال إلى ${to}`);
      setEmailDialog(false);
      setEmailForm({ to: "", subject: "", message: "" });
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الإرسال");
    }
  };
  const handleDelete = async (id: string) => {
    try {
      await api.vouchers.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", "تم الحذف");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    } finally { setPendingDelete(null); }
  };

  return (
    <div className="flex gap-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className={`space-y-6 transition-all ${selected ? "flex-1 min-w-0" : "w-full"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>سندات الصرف</h1>
            <p className="text-[#6B7280] mt-1">المبالغ المدفوعة للموردين · ربط مباشر بفاتورة المشتريات</p>
          </div>
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="me-2 h-4 w-4" /> سند صرف جديد
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-[#E5E7EB]"><CardContent className="p-4">
            <div className="text-xs text-[#6B7280]">عدد السندات</div>
            <div className="font-english font-bold text-[#0B1B49] mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{items.length}</div>
          </CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-4">
            <div className="text-xs text-[#6B7280]">إجمالي المصروف</div>
            <div className="font-english font-bold text-red-700 mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{total.toLocaleString()} SR</div>
          </CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-4">
            <div className="text-xs text-[#6B7280]">متوسط السند</div>
            <div className="font-english font-bold text-[#0B1B49] mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{avg.toLocaleString()} SR</div>
          </CardContent></Card>
        </div>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-[#0B1B49] flex items-center gap-2"><Wallet className="h-4 w-4" /> سجل السندات</CardTitle>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث..." className="pe-9 border-[#E5E7EB]" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center"><Wallet className="h-12 w-12 mx-auto text-[#E5E7EB] mb-3" /><p className="text-sm text-[#6B7280]">لا سندات</p></div>
            ) : (
              <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "120px" }} /><col style={{ width: "100px" }} /><col />
                  <col style={{ width: "120px" }} /><col style={{ width: "100px" }} /><col style={{ width: "120px" }} />
                </colgroup>
                <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium">رقم</th>
                    <th className="text-start px-4 py-2.5 font-medium">التاريخ</th>
                    <th className="text-start px-4 py-2.5 font-medium">المورد</th>
                    <th className="text-end px-4 py-2.5 font-medium">المبلغ</th>
                    <th className="text-center px-4 py-2.5 font-medium">طريقة الدفع</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id}
                      className={`border-t border-[#F3F4F6] cursor-pointer hover:bg-[#F4FCFF] ${selected?.id === v.id ? "bg-[#EFF8FF]" : ""}`}
                      onClick={() => openSelected(v)}>
                      <td className="px-4 py-3 font-english font-semibold text-[#1276E3] truncate" dir="ltr">{v.number}</td>
                      <td className="px-4 py-3 font-english text-[#374151]" dir="ltr">{v.date.slice(0, 10)}</td>
                      <td className="px-4 py-3 truncate text-[#0B1B49]">{v.contact?.displayName || "—"}</td>
                      <td className="px-4 py-3 text-end font-english font-semibold text-red-700" dir="ltr">{Number(v.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-xs text-[#6B7280]">{METHOD_LABELS[v.paymentMethod]}</td>
                      <td className="px-2 py-3 text-end" onClick={(ev) => ev.stopPropagation()}>
                        <button onClick={() => handlePrint(v)} className="p-1.5 text-[#1276E3] hover:bg-blue-50 rounded"><Printer className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card className="border-[#E5E7EB] w-[460px] flex-shrink-0 self-start sticky top-4">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#F3F4F6]">
            <div>
              <div className="font-english font-bold text-[#1276E3]" dir="ltr">{selected.number}</div>
              <div className="text-xs text-[#6B7280] mt-0.5">{selected.contact?.displayName || "—"}</div>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4 text-[#6B7280]" /></button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="text-center bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-xs text-red-700">المبلغ المصروف</div>
              <div className="font-english font-bold text-red-700 mt-1" style={{ fontSize: "1.75rem" }} dir="ltr">
                {Number(selected.amount).toLocaleString()} {selected.currency}
              </div>
              <div className="text-xs text-red-600 mt-1">{METHOD_LABELS[selected.paymentMethod]}</div>
            </div>

            <div className="text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-[#6B7280]">التاريخ</span><span className="font-english" dir="ltr">{selected.date.slice(0, 10)}</span></div>
              {selected.reference && <div className="flex justify-between"><span className="text-[#6B7280]">المرجع</span><span className="font-english text-xs" dir="ltr">{selected.reference}</span></div>}
              {selected.notes && <div className="pt-2 border-t border-[#F3F4F6] text-xs text-[#374151]">{selected.notes}</div>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-[#6B7280] flex items-center gap-1"><Paperclip className="h-3 w-3" /> المرفقات ({attachments.length})</div>
                <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} className="text-xs text-[#1276E3] hover:underline flex items-center gap-1"><Upload className="h-3 w-3" /> رفع</button>
              </div>
              {attachments.length === 0 ? (
                <div className="text-xs text-[#9CA3AF] text-center py-2 border border-dashed rounded">لا مرفقات</div>
              ) : (
                <div className="space-y-1">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded border border-[#E5E7EB] text-xs">
                      <Paperclip className="h-3 w-3 text-[#6B7280] flex-shrink-0" />
                      <div className="flex-1 truncate">{a.filename}</div>
                      <a href={a.url} download={a.filename} className="text-[#1276E3] p-1 hover:bg-blue-50 rounded"><Download className="h-3 w-3" /></a>
                      <button onClick={async () => {
                        try { await api.vouchers.attachments.remove(selected.id, a.id); setAttachments((prev) => prev.filter((x) => x.id !== a.id)); } catch {}
                      }} className="text-red-600 p-1 hover:bg-red-50 rounded"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#F3F4F6]">
              <Button onClick={() => handlePrint(selected)} className="bg-[#1276E3] hover:bg-[#1060C0] text-white">
                <Printer className="h-4 w-4 me-1" /> طباعة / PDF
              </Button>
              <Button onClick={() => { setEmailForm({ to: (selected.contact as any)?.email || "", subject: "", message: "" }); setEmailDialog(true); }} variant="outline" className="border-[#E5E7EB]">
                <Mail className="h-4 w-4 me-1" /> إرسال للمورد
              </Button>
              {pendingDelete === selected.id ? (
                <span className="flex items-center gap-1">
                  <Button onClick={() => handleDelete(selected.id)} className="bg-red-600 hover:bg-red-700">تأكيد</Button>
                  <Button onClick={() => setPendingDelete(null)} variant="outline">إلغاء</Button>
                </span>
              ) : (
                <Button onClick={() => setPendingDelete(selected.id)} variant="outline" className="border-red-300 text-red-700">
                  <Trash2 className="h-4 w-4 me-1" /> حذف
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6]">
                <h2 className="text-lg text-[#0B1B49] font-bold flex items-center gap-2"><Wallet className="h-5 w-5" /> سند صرف جديد</h2>
                <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-5 w-5 text-[#6B7280]" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <Label className="text-xs">المورد *</Label>
                  <SearchableCombobox
                    value={form.contactId}
                    onChange={(id) => setForm({ ...form, contactId: id, billId: "" })}
                    items={contacts.map((c: any) => ({
                      id: c.id,
                      label: c.displayName,
                      sublabel: [c.legalName, c.email].filter(Boolean).join(" · ") || undefined,
                    }))}
                    placeholder="ابحث عن مورّد (عربي/English)..."
                    onCreate={async (name: string) => {
                      const created = await api.contacts.create({
                        displayName: name,
                        type: "SUPPLIER" as any,
                        isSupplier: true,
                        entityKind: "COMPANY" as any,
                        country: "SA",
                      } as any);
                      setContacts((prev: any) => [created, ...prev]);
                      setForm((f: any) => ({ ...f, contactId: created.id }));
                      return created.id;
                    }}
                    createLabel={(q: string) => `+ إنشاء مورّد جديد "${q}"`}
                  />
                </div>

                {form.contactId && bills.length > 0 && (
                  <div>
                    <Label className="text-xs">فاتورة المشتريات (اختياري)</Label>
                    <select value={form.billId} onChange={(e) => {
                      const bill = bills.find((b) => b.id === e.target.value);
                      setForm({ ...form, billId: e.target.value, amount: bill ? String(Number(bill.total) - Number(bill.amountPaid || 0)) : form.amount });
                    }} className="w-full text-sm rounded border border-[#E5E7EB] px-3 py-2 bg-white">
                      <option value="">— غير مرتبط —</option>
                      {bills.map((bill) => (
                        <option key={bill.id} value={bill.id}>
                          {bill.billNumber} · المتبقي {Number(bill.total) - Number(bill.amountPaid || 0)} {bill.currency}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">التاريخ *</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required dir="ltr" className="font-english" />
                  </div>
                  <div>
                    <Label className="text-xs">المبلغ *</Label>
                    <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required dir="ltr" className="font-english" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">طريقة الدفع *</Label>
                  <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(METHOD_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {form.paymentMethod !== "CASH" && bankAccounts.length > 0 && (
                  <div>
                    <Label className="text-xs">الحساب البنكي المسحوب منه</Label>
                    <select value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                      className="w-full text-sm rounded border border-[#E5E7EB] px-3 py-2 bg-white">
                      <option value="">— اختر —</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>{b.bankName || b.name} · {b.accountNumber || b.iban}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <Label className="text-xs">المرجع</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم تحويل / رقم شيك" dir="ltr" className="font-english" />
                </div>

                <div>
                  <Label className="text-xs">ملاحظات</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات اختيارية" />
                </div>
              </div>

              <div className="flex justify-end gap-2 p-5 border-t border-[#F3F4F6]">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
                <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {emailDialog && selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEmailDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6]">
              <h2 className="text-lg text-[#0B1B49] font-bold">إرسال السند للمورد</h2>
              <button onClick={() => setEmailDialog(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><Label className="text-xs">إلى *</Label><Input type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} dir="ltr" className="font-english" /></div>
              <div><Label className="text-xs">الموضوع</Label><Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} /></div>
              <div><Label className="text-xs">رسالة</Label><textarea value={emailForm.message} onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} rows={4} className="w-full text-sm rounded border border-[#E5E7EB] px-3 py-2" /></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-[#F3F4F6]">
              <Button type="button" variant="outline" onClick={() => setEmailDialog(false)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="button" onClick={handleEmail} className="bg-[#1276E3] hover:bg-[#1060C0]">
                <Mail className="h-4 w-4 me-1" /> إرسال
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
