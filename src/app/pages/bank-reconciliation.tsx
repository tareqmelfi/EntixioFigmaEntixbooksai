/**
 * Bank Reconciliation · UX-115 · Wafeq/Zoho-style
 * Upload statement → parse → review per-row matches → commit
 * Supports CSV / MT940 / OFX · KSA bank profiles (RJHI, NCB, Riyad, etc.) + Generic
 */
import { useEffect, useState, useCallback } from "react";
import {
  Upload, Loader2, CheckCircle2, XCircle, FileText, Banknote, AlertCircle,
  Link2, Plus, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";

type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  reference?: string;
  matchKind?: "voucher" | "invoice" | "bill" | "none";
  matchId?: string;
  matchScore?: number;
  matchLabel?: string;
  decision?: "accept" | "create_voucher" | "skip";
};

export function BankReconciliation() {
  const { toasts, push, dismiss } = useToasts();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; label: string }[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [profile, setProfile] = useState("GENERIC");
  const [format, setFormat] = useState<"csv" | "mt940" | "ofx">("csv");
  const [fileText, setFileText] = useState("");
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [stats, setStats] = useState<{ matched: number; unmatched: number } | null>(null);
  const [committing, setCommitting] = useState(false);

  const loadInit = useCallback(async () => {
    try {
      const [acc, prof] = await Promise.all([
        api.bankAccounts.list(),
        api.bankImport.profiles(),
      ]);
      setBankAccounts(acc.items);
      setProfiles(prof.profiles);
      if (acc.items[0] && !bankAccountId) setBankAccountId(acc.items[0].id);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    }
  }, [push, bankAccountId]);
  useEffect(() => { loadInit(); }, [loadInit]);

  const handleFile = async (file: File) => {
    setFilename(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "ofx") setFormat("ofx");
    else if (ext === "mt940" || ext === "sta") setFormat("mt940");
    else setFormat("csv");
    const text = await file.text();
    setFileText(text);
  };

  const handleParse = async () => {
    if (!bankAccountId) { push("error", "اختر حساباً بنكياً"); return; }
    if (!fileText.trim()) { push("error", "ارفع ملف الكشف"); return; }
    setBusy(true);
    try {
      const res = await api.bankImport.parse({ bankAccountId, format, profile, text: fileText });
      const parsed = (res.rows || []).map((r: any) => ({
        ...r,
        decision: r.matchKind && r.matchKind !== "none" ? "accept" : "create_voucher",
      })) as ParsedRow[];
      setRows(parsed);
      setStats({ matched: res.matched || 0, unmatched: res.unmatched || 0 });
      setStep("review");
      push("success", `تم استخراج ${parsed.length} حركة · مطابقة ${res.matched} · غير مطابقة ${res.unmatched}`);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الاستخراج");
    } finally { setBusy(false); }
  };

  const handleCommit = async () => {
    if (!bankAccountId) return;
    const toSend = rows.filter(r => r.decision !== "skip");
    if (toSend.length === 0) { push("error", "لا توجد حركات لتأكيدها"); return; }
    setCommitting(true);
    try {
      const res = await api.bankImport.commit({ bankAccountId, rows: toSend });
      push("success", `تم · أنشئ ${res.created} سند · ربط ${res.linked} وثيقة · تخطي ${res.skipped}`);
      setStep("done");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التأكيد");
    } finally { setCommitting(false); }
  };

  const updateRow = (i: number, patch: Partial<ParsedRow>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    setRows(next);
  };

  const reset = () => {
    setStep("upload"); setRows([]); setStats(null); setFileText(""); setFilename("");
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>تسوية البنوك</h1>
          <p className="text-[#6B7280] mt-1">رفع كشف حساب البنك · مطابقة الحركات تلقائياً · ترحيل بنقرة</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          <span className={step === "upload" ? "text-[#1276E3] font-semibold" : ""}>1. رفع</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === "review" ? "text-[#1276E3] font-semibold" : ""}>2. مراجعة</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === "done" ? "text-[#1276E3] font-semibold" : ""}>3. تأكيد</span>
        </div>
      </div>

      {step === "upload" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B1B49]"><Upload className="h-5 w-5" /> رفع كشف حساب</CardTitle>
            <CardDescription>صيغ مدعومة: CSV · MT940 · OFX · QIF</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>الحساب البنكي *</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bankName || b.name} · <span className="font-english" dir="ltr">{b.accountNumber || b.iban}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الصيغة</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="mt940">MT940 (SWIFT)</SelectItem>
                    <SelectItem value="ofx">OFX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>قالب البنك</Label>
                <Select value={profile} onValueChange={setProfile}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-8 text-center hover:border-[#1276E3] transition">
              <FileText className="h-10 w-10 text-[#9CA3AF] mx-auto mb-2" />
              <input type="file" id="bank-stmt" accept=".csv,.mt940,.sta,.ofx,.qif,.txt" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <label htmlFor="bank-stmt" className="cursor-pointer">
                {filename ? (
                  <div>
                    <div className="text-sm text-[#0B1B49] font-medium">{filename}</div>
                    <div className="text-xs text-[#9CA3AF] mt-1">{(fileText.length / 1024).toFixed(1)} KB · اضغط لتغيير الملف</div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-[#1276E3] font-medium">اختر ملفاً للرفع</div>
                    <div className="text-xs text-[#9CA3AF] mt-1">CSV من البنك أو ملف SWIFT MT940</div>
                  </>
                )}
              </label>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleParse} disabled={busy || !fileText} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                استخراج الحركات والمطابقة التلقائية
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="border-[#E5E7EB]"><CardContent className="p-4">
              <div className="text-xs text-[#6B7280]">إجمالي الحركات</div>
              <div className="font-english font-bold text-[#0B1B49] mt-1" style={{ fontSize: "1.5rem" }}>{rows.length}</div>
            </CardContent></Card>
            <Card className="border-[#E5E7EB]"><CardContent className="p-4">
              <div className="text-xs text-[#6B7280]">مطابقة تلقائية</div>
              <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.5rem" }}>{stats?.matched || 0}</div>
            </CardContent></Card>
            <Card className="border-[#E5E7EB]"><CardContent className="p-4">
              <div className="text-xs text-[#6B7280]">تحتاج مراجعة</div>
              <div className="font-english font-bold text-amber-700 mt-1" style={{ fontSize: "1.5rem" }}>{stats?.unmatched || 0}</div>
            </CardContent></Card>
          </div>

          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">مراجعة الحركات</CardTitle>
              <CardDescription>اختر لكل حركة: قبول المطابقة · إنشاء سند جديد · تخطي</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "100px" }} />
                    <col />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "200px" }} />
                    <col style={{ width: "200px" }} />
                  </colgroup>
                  <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                    <tr>
                      <th className="text-start px-3 py-2.5 font-medium">التاريخ</th>
                      <th className="text-start px-3 py-2.5 font-medium">البيان</th>
                      <th className="text-end px-3 py-2.5 font-medium">المبلغ</th>
                      <th className="text-start px-3 py-2.5 font-medium">المطابقة</th>
                      <th className="text-center px-3 py-2.5 font-medium">القرار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-[#F3F4F6]">
                        <td className="px-3 py-2 font-english text-[#374151]" dir="ltr">{r.date.slice(0, 10)}</td>
                        <td className="px-3 py-2">
                          <div className="text-[#0B1B49] truncate">{r.description}</div>
                          {r.reference && <div className="text-xs text-[#9CA3AF] font-english" dir="ltr">{r.reference}</div>}
                        </td>
                        <td className={`px-3 py-2 text-end font-english font-semibold ${r.amount >= 0 ? "text-green-700" : "text-red-700"}`} dir="ltr">
                          {r.amount >= 0 ? "+" : ""}{r.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {r.matchKind && r.matchKind !== "none" ? (
                            <div className="flex items-center gap-2 text-xs">
                              <Link2 className="h-3 w-3 text-green-600" />
                              <div>
                                <div className="text-[#0B1B49]">{r.matchLabel}</div>
                                {r.matchScore && <div className="text-[#9CA3AF]">ثقة <span className="font-english">{Math.round(r.matchScore * 100)}%</span></div>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-[#9CA3AF]">— لا يوجد —</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Select value={r.decision || "skip"} onValueChange={(v) => updateRow(i, { decision: v as any })}>
                            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {r.matchKind && r.matchKind !== "none" && <SelectItem value="accept">قبول الربط</SelectItem>}
                              <SelectItem value="create_voucher">سند جديد</SelectItem>
                              <SelectItem value="skip">تخطي</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={reset} className="border-[#E5E7EB]">رجوع</Button>
            <Button onClick={handleCommit} disabled={committing} className="bg-green-600 hover:bg-green-700 text-white">
              {committing ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
              تأكيد وترحيل {rows.filter(r => r.decision !== "skip").length} حركة
            </Button>
          </div>
        </>
      )}

      {step === "done" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-3" />
            <div className="text-xl text-[#0B1B49] font-bold">تمت التسوية بنجاح</div>
            <p className="text-sm text-[#6B7280] mt-2">جميع الحركات المعتمدة أصبحت قيوداً مرحَّلة في الدفتر العام</p>
            <Button onClick={reset} className="bg-[#1276E3] hover:bg-[#1060C0] mt-4">رفع كشف آخر</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
