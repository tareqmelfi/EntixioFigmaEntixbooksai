/**
 * Fiscal Periods · year-end close + period locking · UX-117
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, Lock, Unlock, CheckCircle2, AlertCircle, CalendarDays, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";

export function FiscalPeriods() {
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [pendingClose, setPendingClose] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.fiscalPeriods.list(year);
      setItems(r.items);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push, year]);
  useEffect(() => { refresh(); }, [refresh]);

  const handleInit = async () => {
    setBusy("init");
    try {
      await api.fiscalPeriods.init(year, 1);
      push("success", `تم إنشاء 12 فترة شهرية لعام ${year}`);
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الإنشاء");
    } finally { setBusy(null); }
  };

  const handleLock = async (id: string) => {
    setBusy(id);
    try {
      await api.fiscalPeriods.lock(id);
      push("success", "تم قفل الفترة");
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل القفل");
    } finally { setBusy(null); }
  };

  const handleUnlock = async (id: string) => {
    setBusy(id);
    try {
      await api.fiscalPeriods.unlock(id);
      push("success", "تم فتح الفترة");
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الفتح");
    } finally { setBusy(null); }
  };

  const handlePreview = async (id: string) => {
    setBusy(id);
    try {
      const p = await api.fiscalPeriods.previewClose(id);
      setPreview(p);
      setPendingClose(id);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل المعاينة");
    } finally { setBusy(null); }
  };

  const handleClose = async () => {
    if (!pendingClose) return;
    setBusy(pendingClose);
    try {
      const r = await api.fiscalPeriods.close(pendingClose);
      push("success", `تم إغلاق الفترة · صافي الدخل: ${r.netIncome.toLocaleString()} · تم إنشاء قيد إغلاق آلي`);
      setPendingClose(null);
      setPreview(null);
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الإغلاق");
    } finally { setBusy(null); }
  };

  const monthName = (n: number) => ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"][n - 1] || String(n);

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الفترات المالية</h1>
          <p className="text-[#6B7280] mt-1">قفل الفترات · إغلاق سنوي · ترحيل الأرباح المحتجزة</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 font-english text-center" dir="ltr" />
          {items.length === 0 && (
            <Button onClick={handleInit} disabled={busy === "init"} className="bg-[#1276E3] hover:bg-[#1060C0]">
              {busy === "init" ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              إنشاء فترات {year}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div>
      ) : items.length === 0 ? (
        <Card className="border-[#E5E7EB]">
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 text-[#E5E7EB] mx-auto mb-3" />
            <p className="text-sm text-[#6B7280]">لم يتم إنشاء فترات لعام {year}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">اضغط "إنشاء فترات" لإنشاء 12 فترة شهرية</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">فترات السنة المالية {year}</CardTitle>
            <CardDescription>افتح/أقفل/أغلق · الإغلاق ينشئ قيد إغلاق آلي ويرحّل صافي الدخل إلى الأرباح المحتجزة</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                <tr>
                  <th className="text-start px-4 py-2.5 font-medium">الفترة</th>
                  <th className="text-start px-4 py-2.5 font-medium">من</th>
                  <th className="text-start px-4 py-2.5 font-medium">إلى</th>
                  <th className="text-center px-4 py-2.5 font-medium">الحالة</th>
                  <th className="text-end px-4 py-2.5 font-medium">صافي الدخل</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.id} className="border-t border-[#F3F4F6]">
                    <td className="px-4 py-3 text-[#0B1B49] font-medium">
                      <span className="font-english me-1" dir="ltr">{p.periodNumber}</span> · {monthName(p.periodNumber)}
                    </td>
                    <td className="px-4 py-3 font-english text-[#374151]" dir="ltr">{p.startDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-english text-[#374151]" dir="ltr">{p.endDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        p.status === "CLOSED" ? "bg-gray-100 text-gray-700" :
                        p.status === "LOCKED" ? "bg-amber-50 text-amber-700" :
                        "bg-green-50 text-green-700"
                      }`}>
                        {p.status === "CLOSED" ? "مُغلقة" : p.status === "LOCKED" ? "مقفلة" : "مفتوحة"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end font-english font-semibold" dir="ltr">
                      {p.netIncome != null ? p.netIncome.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {p.status === "OPEN" && (
                        <Button size="sm" variant="outline" onClick={() => handleLock(p.id)} disabled={busy === p.id}
                          className="border-amber-300 text-amber-700 hover:bg-amber-50">
                          <Lock className="h-3 w-3 me-1" /> قفل
                        </Button>
                      )}
                      {p.status === "LOCKED" && (
                        <span className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleUnlock(p.id)} disabled={busy === p.id}
                            className="border-[#E5E7EB]">
                            <Unlock className="h-3 w-3 me-1" /> فتح
                          </Button>
                          <Button size="sm" onClick={() => handlePreview(p.id)} disabled={busy === p.id}
                            className="bg-red-600 hover:bg-red-700 text-white">
                            <CheckCircle2 className="h-3 w-3 me-1" /> إغلاق
                          </Button>
                        </span>
                      )}
                      {p.status === "CLOSED" && (
                        <span className="text-xs text-[#9CA3AF]">— مُغلقة نهائياً —</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Preview Close modal */}
      {preview && pendingClose && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setPreview(null); setPendingClose(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg text-[#0B1B49] font-bold mb-3">تأكيد إغلاق الفترة</h2>
            <p className="text-xs text-[#6B7280] mb-4">سيتم إنشاء قيد إغلاق آلي يصفّر حسابات الإيرادات والمصروفات ويرحّل الصافي إلى الأرباح المحتجزة. هذه العملية <span className="font-bold text-red-600">غير قابلة للتراجع</span>.</p>
            <div className="rounded-lg border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
              <div className="flex justify-between p-3 text-sm">
                <span className="text-[#6B7280]">إجمالي الإيرادات</span>
                <span className="font-english font-semibold text-green-700" dir="ltr">{preview.combinedRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span className="text-[#6B7280]">إجمالي المصروفات</span>
                <span className="font-english font-semibold text-red-700" dir="ltr">{preview.combinedExpense.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 text-sm bg-[#F9FAFB]">
                <span className="text-[#0B1B49] font-bold">صافي الدخل</span>
                <span className={`font-english font-bold ${preview.netIncome >= 0 ? "text-green-700" : "text-red-700"}`} dir="ltr">{preview.netIncome.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { setPreview(null); setPendingClose(null); }} className="border-[#E5E7EB]">إلغاء</Button>
              <Button onClick={handleClose} disabled={busy === pendingClose} className="bg-red-600 hover:bg-red-700 text-white">
                {busy === pendingClose ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
                تأكيد الإغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
