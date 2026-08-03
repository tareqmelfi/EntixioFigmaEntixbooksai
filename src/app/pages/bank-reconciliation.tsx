/**
 * Bank Reconciliation · UX-115 · Wafeq/Zoho-style
 * Upload statement → parse → review per-row matches → commit
 * Supports PDF / CSV / MT940 / OFX · KSA/US-friendly bank statement intake
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Upload, Loader2, CheckCircle2, FileText,
  Link2, ChevronRight, Landmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type ParsedRow = {
  index?: number;
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
  sourceFile?: string;
};

type StatementFormat = "csv" | "mt940" | "ofx" | "qif" | "pdf" | "xlsx" | "xls";

type UploadedStatementFile = {
  name: string;
  format: StatementFormat;
  mimeType?: string;
  text?: string;
  base64?: string;
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",").pop() || "" : value);
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function bankIdentifier(bank: any) {
  const country = (bank?.country || "").toUpperCase();
  if (country === "US") {
    const suffix = bank.accountNumber ? String(bank.accountNumber).slice(-4) : "";
    return [bank.routingNumber ? `Routing ${bank.routingNumber}` : null, suffix ? `Acct ••••${suffix}` : null].filter(Boolean).join(" · ");
  }
  return bank?.iban || bank?.accountNumber || "";
}

function inferStatementFormat(file: File): StatementFormat {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (ext === "ofx" || ext === "qfx") return "ofx";
  if (ext === "mt940" || ext === "sta" || ext === "swift") return "mt940";
  if (ext === "qif") return "qif";
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  return "csv";
}

async function readStatementFile(file: File): Promise<UploadedStatementFile> {
  const detected = inferStatementFormat(file);
  if (detected === "pdf" || detected === "xlsx" || detected === "xls") {
    const inferredMime = detected === "pdf"
      ? "application/pdf"
      : detected === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/vnd.ms-excel";
    const rawMime = (file.type || "").trim().toLowerCase();
    const normalizedMime = !rawMime || rawMime === "application/octet-stream" ? inferredMime : file.type;
    return {
      name: file.name,
      format: detected,
      mimeType: normalizedMime,
      base64: await fileToBase64(file),
    };
  }
  return {
    name: file.name,
    format: detected,
    mimeType: file.type || "text/plain",
    text: await file.text(),
  };
}

export function BankReconciliation() {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [searchParams] = useSearchParams();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; label: string }[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [profile, setProfile] = useState("GENERIC");
  const [format, setFormat] = useState<StatementFormat>("pdf");
  const [selectedFiles, setSelectedFiles] = useState<UploadedStatementFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [stats, setStats] = useState<{ matched: number; unmatched: number } | null>(null);
  const [parseSource, setParseSource] = useState<{ model?: string; source?: string } | null>(null);
  const [committing, setCommitting] = useState(false);

  const loadInit = useCallback(async () => {
    try {
      const [acc, prof] = await Promise.all([
        api.bankAccounts.list(),
        api.bankImport.profiles(),
      ]);
      setBankAccounts(acc.items);
      setProfiles(prof.profiles);
      const requested = searchParams.get("bankAccountId") || searchParams.get("accountId");
      const matched = requested ? acc.items.find((item: any) => item.id === requested) : null;
      if ((matched || acc.items[0]) && !bankAccountId) setBankAccountId((matched || acc.items[0]).id);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    }
  }, [push, bankAccountId, searchParams]);
  useEffect(() => { loadInit(); }, [loadInit]);

  const handleFiles = async (files: FileList | File[]) => {
    const allowed = Array.from(files).filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      return ["pdf", "csv", "mt940", "sta", "ofx", "qif", "qfx", "txt", "xlsx", "xls"].includes(ext || "")
        || file.type === "application/pdf"
        || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        || file.type === "application/vnd.ms-excel";
    });
    if (allowed.length === 0) {
      push("error", t("اختر ملف PDF أو CSV/MT940/OFX/QIF/XLSX/XLS، وليس مجلد فارغ أو صيغة غير مدعومة", "Choose a PDF or CSV/MT940/OFX/QIF/XLSX/XLS file — not an empty folder or unsupported format"));
      return;
    }
    try {
      const readFiles = await Promise.all(allowed.map(readStatementFile));
      setSelectedFiles(readFiles);
      setFormat(readFiles[0]?.format || "pdf");
      push("success", readFiles.length === 1 ? t("تم اختيار", "Selected") + ` ${readFiles[0].name}` : t("تم اختيار", "Selected") + ` ${readFiles.length} ` + t("ملفات كشف", "statement files"));
    } catch {
      push("error", t("تعذر قراءة الملف المختار", "Failed to read the selected file"));
    }
  };

  const handleParse = async () => {
    if (!bankAccountId) { push("error", t("اختر حساباً بنكياً", "Choose a bank account")); return; }
    if (selectedFiles.length === 0) { push("error", t("ارفع ملف كشف واحد على الأقل", "Upload at least one statement file")); return; }
    setBusy(true);
    try {
      const parsed: ParsedRow[] = [];
      let matched = 0;
      let unmatched = 0;
      const models = new Set<string>();
      for (const file of selectedFiles) {
        const isBinary = file.format === "pdf" || file.format === "xlsx" || file.format === "xls";
        const res = await api.bankImport.parse({
          bankAccountId,
          format: file.format,
          profile,
          text: isBinary ? undefined : file.text,
          fileBase64: isBinary ? file.base64 : undefined,
          fileName: file.name,
          mimeType: file.mimeType || (file.format === "pdf" ? "application/pdf" : undefined),
        });
        matched += res.matched || 0;
        unmatched += res.unmatched || 0;
        if (res.ai?.model) models.add(res.ai.model);
        parsed.push(...((res.rows || []).map((r: any) => ({
          ...r,
          sourceFile: file.name,
          matchKind: r.match?.type && r.match.type !== "unknown" ? r.match.type : "none",
          matchId: r.match?.id,
          matchScore: r.match?.confidence,
          matchLabel: r.match?.id ? `${r.match.type} · ${r.match.reason}` : r.match?.reason,
          decision: r.match?.type && r.match.type !== "unknown" ? "accept" : "create_voucher",
        })) as ParsedRow[]));
      }
      setRows(parsed);
      setStats({ matched, unmatched });
      setParseSource(models.size ? { model: Array.from(models).join(", "), source: "batch" } : null);
      setStep("review");
      const source = models.size ? ` · AI ${Array.from(models).join(", ")}` : "";
      push("success", `${t("تم استخراج", "Extracted")} ${parsed.length} ${t("حركة من", "transactions from")} ${selectedFiles.length} ${t("ملف", "file(s)")} · ${t("مطابقة", "matched")} ${matched} · ${t("غير مطابقة", "unmatched")} ${unmatched}${source}`);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الاستخراج", "Extraction failed"));
    } finally { setBusy(false); }
  };

  const handleCommit = async () => {
    if (!bankAccountId) return;
    const toSend = rows.filter(r => r.decision !== "skip");
    if (toSend.length === 0) { push("error", t("لا توجد حركات لتأكيدها", "No transactions to confirm")); return; }
    const payloadRows = toSend.map((r) => {
      let action: "link_voucher" | "create_voucher" | "link_invoice" | "link_bill" | "skip" = "create_voucher";
      if (r.decision === "skip") action = "skip";
      else if (r.decision === "accept" && r.matchKind === "voucher") action = "link_voucher";
      else if (r.decision === "accept" && r.matchKind === "invoice") action = "link_invoice";
      else if (r.decision === "accept" && r.matchKind === "bill") action = "link_bill";
      return {
        date: r.date,
        amount: r.amount,
        description: r.description,
        reference: r.reference || null,
        action,
        targetId: r.decision === "accept" ? r.matchId : undefined,
      };
    });
    setCommitting(true);
    try {
      const res = await api.bankImport.commit({ bankAccountId, rows: payloadRows });
      push("success", `${t("تم", "Done")} · ${t("أنشئ", "created")} ${res.created} ${t("سند", "vouchers")} · ${t("ربط", "linked")} ${res.linked} ${t("وثيقة", "documents")} · ${t("تخطي", "skipped")} ${res.skipped}`);
      setStep("done");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التأكيد", "Commit failed"));
    } finally { setCommitting(false); }
  };

  const updateRow = (i: number, patch: Partial<ParsedRow>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    setRows(next);
  };

  const reset = () => {
    setStep("upload"); setRows([]); setStats(null); setSelectedFiles([]); setParseSource(null);
  };

  const selectedBank = bankAccounts.find((bank) => bank.id === bankAccountId);
  const directoryInputProps = { webkitdirectory: "true", directory: "" } as any;

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("تسوية البنوك", "Bank Reconciliation")}</h1>
          <p className="text-muted-foreground mt-1">{t("رفع كشف حساب البنك · مطابقة الحركات تلقائياً · ترحيل بنقرة", "Upload a bank statement · auto-match transactions · post with one click")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === "upload" ? "text-primary font-semibold" : ""}>{t("1. رفع", "1. Upload")}</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === "review" ? "text-primary font-semibold" : ""}>{t("2. مراجعة", "2. Review")}</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === "done" ? "text-primary font-semibold" : ""}>{t("3. تأكيد", "3. Confirm")}</span>
        </div>
      </div>

      {step === "upload" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground"><Upload className="h-5 w-5" /> {t("رفع كشف حساب", "Upload Bank Statement")}</CardTitle>
            <CardDescription>{t("صيغ مدعومة: PDF ذكي · CSV · MT940 · OFX · QIF · XLSX · XLS", "Supported formats: smart PDF · CSV · MT940 · OFX · QIF · XLSX · XLS")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedBank && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-foreground flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Landmark className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{selectedBank.name} · {selectedBank.bankName || t("حساب بنكي", "Bank account")}</div>
                    <div className="font-english text-xs text-muted-foreground" dir="ltr">{selectedBank.currency} · {bankIdentifier(selectedBank) || selectedBank.country}</div>
                  </div>
                </div>
                <Link to={`/app/bank-accounts/${selectedBank.id}`} className="shrink-0 text-xs text-primary hover:underline">{t("فتح الحساب", "Open account")}</Link>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>{t("الحساب البنكي", "Bank account")} *</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger><SelectValue placeholder={t("اختر...", "Select...")} /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} · <span className="font-english" dir="ltr">{bankIdentifier(b) || b.currency}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("الصيغة", "Format")}</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF (AI)</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="mt940">MT940 (SWIFT)</SelectItem>
                    <SelectItem value="ofx">OFX</SelectItem>
                    <SelectItem value="qif">QIF</SelectItem>
                    <SelectItem value="xlsx">XLSX</SelectItem>
                    <SelectItem value="xls">XLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("قالب البنك", "Bank profile")}</Label>
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

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-[#1276E3] transition">
              <FileText className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
              <input type="file" id="bank-stmt" accept=".pdf,application/pdf,.csv,.mt940,.sta,.ofx,.qif,.qfx,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" multiple hidden
                onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} />
              <input type="file" id="bank-stmt-folder" accept=".pdf,application/pdf" multiple hidden {...directoryInputProps}
                onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} />
              <div className="cursor-pointer">
                {selectedFiles.length > 0 ? (
                  <div>
                    <div className="text-sm text-foreground font-medium">
                      {selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} ${t("ملفات كشف مختارة", "statement files selected")}`}
                    </div>
                    <div className="text-xs text-muted-foreground/60 mt-1">
                      {selectedFiles.map((f) => f.format.toUpperCase()).join(" · ")} · {t("يمكنك تغيير الملفات", "you can change the files")}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-primary font-medium">{t("اختر ملفاً للرفع", "Choose a file to upload")}</div>
                    <div className="text-xs text-muted-foreground/60 mt-1">{t("PDF كشف البنك أو CSV/MT940/OFX/QIF/XLSX/XLS · يدعم أكثر من ملف PDF", "Bank statement PDF or CSV/MT940/OFX/QIF/XLSX/XLS · supports multiple PDF files")}</div>
                  </>
                )}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <label htmlFor="bank-stmt" className="rounded-md border border-[#1276E3] bg-white px-3 py-1.5 text-xs text-primary hover:bg-blue-50">
                    {t("اختيار ملف أو عدة ملفات", "Choose file(s)")}
                  </label>
                  <label htmlFor="bank-stmt-folder" className="rounded-md border border-border bg-white px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted">
                    {t("اختيار مجلد PDF", "Choose PDF folder")}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleParse} disabled={busy || selectedFiles.length === 0} className="bg-primary hover:bg-primary/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                {t("استخراج الحركات والمطابقة التلقائية", "Extract transactions & auto-match")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="border-border"><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{t("إجمالي الحركات", "Total transactions")}</div>
              <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }}>{rows.length}</div>
            </CardContent></Card>
            <Card className="border-border"><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{t("مطابقة تلقائية", "Auto-matched")}</div>
              <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.5rem" }}>{stats?.matched || 0}</div>
            </CardContent></Card>
            <Card className="border-border"><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{t("تحتاج مراجعة", "Needs review")}</div>
              <div className="font-english font-bold text-amber-700 mt-1" style={{ fontSize: "1.5rem" }}>{stats?.unmatched || 0}</div>
            </CardContent></Card>
          </div>

          {parseSource?.model && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-foreground">
              {t("تمت قراءة الكشف عبر AI", "Statement parsed via AI")} · <span className="font-english" dir="ltr">{parseSource.model}</span>
            </div>
          )}

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground">{t("مراجعة الحركات", "Review transactions")}</CardTitle>
              <CardDescription>{t("اختر لكل حركة: قبول المطابقة · إنشاء سند جديد · تخطي", "For each transaction choose: accept match · create new voucher · skip")}</CardDescription>
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
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="text-start px-3 py-2.5 font-medium">{t("التاريخ", "Date")}</th>
                      <th className="text-start px-3 py-2.5 font-medium">{t("البيان", "Description")}</th>
                      <th className="text-end px-3 py-2.5 font-medium">{t("المبلغ", "Amount")}</th>
                      <th className="text-start px-3 py-2.5 font-medium">{t("المطابقة", "Match")}</th>
                      <th className="text-center px-3 py-2.5 font-medium">{t("القرار", "Decision")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-3 py-2 font-english text-foreground/80" dir="ltr">{r.date.slice(0, 10)}</td>
                        <td className="px-3 py-2">
                          <div className="text-foreground truncate">{r.description}</div>
                          {r.reference && <div className="text-xs text-muted-foreground/60 font-english" dir="ltr">{r.reference}</div>}
                          {r.sourceFile && <div className="text-[11px] text-muted-foreground/60 font-english truncate" dir="ltr">{r.sourceFile}</div>}
                        </td>
                        <td className={`px-3 py-2 text-end font-english font-semibold ${r.amount >= 0 ? "text-green-700" : "text-red-700"}`} dir="ltr">
                          {r.amount >= 0 ? "+" : ""}{r.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {r.matchKind && r.matchKind !== "none" ? (
                            <div className="flex items-center gap-2 text-xs">
                              <Link2 className="h-3 w-3 text-green-600" />
                              <div>
                                <div className="text-foreground">{r.matchLabel}</div>
                                {r.matchScore && <div className="text-muted-foreground/60">{t("ثقة", "confidence")} <span className="font-english">{Math.round(r.matchScore * 100)}%</span></div>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">{t("— لا يوجد —", "— none —")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Select value={r.decision || "skip"} onValueChange={(v) => updateRow(i, { decision: v as any })}>
                            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {r.matchKind && r.matchKind !== "none" && <SelectItem value="accept">{t("قبول الربط", "Accept match")}</SelectItem>}
                              <SelectItem value="create_voucher">{t("سند جديد", "New voucher")}</SelectItem>
                              <SelectItem value="skip">{t("تخطي", "Skip")}</SelectItem>
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
            <Button variant="outline" onClick={reset} className="border-border">{t("رجوع", "Back")}</Button>
            <Button onClick={handleCommit} disabled={committing} className="bg-green-600 hover:bg-green-700 text-white">
              {committing ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
              {t("تأكيد وترحيل", "Confirm & post")} {rows.filter(r => r.decision !== "skip").length} {t("حركة", "transactions")}
            </Button>
          </div>
        </>
      )}

      {step === "done" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-3" />
            <div className="text-xl text-foreground font-bold">{t("تمت التسوية بنجاح", "Reconciliation completed")}</div>
            <p className="text-sm text-muted-foreground mt-2">{t("جميع الحركات المعتمدة أصبحت قيوداً مرحَّلة في الدفتر العام", "All approved transactions are now posted journal entries in the general ledger")}</p>
            <Button onClick={reset} className="bg-primary hover:bg-primary/90 mt-4">{t("رفع كشف آخر", "Upload another statement")}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
