import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

const empty = { revision: 0, status: "DRAFT", path: "NEW_APPLICATION", identityEvidence: "", authorityEvidence: "", revenueEvidence: "", applicationReference: "", submissionEvidence: "", approvalEvidence: "", certificateReference: "", certificateSha256: "", vatNumber: "", effectiveDate: "", verificationSource: "", verificationNote: "", confirmVerified: false };
const statuses = [["DRAFT", "جمع المستندات", "Collecting evidence"], ["READY_FOR_REVIEW", "جاهز للمراجعة", "Ready for review"], ["SUBMITTED", "مقدم للهيئة", "Submitted to ZATCA"], ["APPROVED", "معتمد بدليل الهيئة", "Approved with authority evidence"], ["CERTIFICATE_VERIFIED", "شهادة راجعها المسؤول", "Certificate reviewed by administrator"]];
export function VatRegistrationPanel({ orgId }: { orgId: string }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setMessage(""); setForm(empty);
    api.vatRegistration.get(orgId).then(({ registration }) => {
      if (!active) return;
      // Pick writable fields only; server attribution is never replayed as user input.
      setForm(Object.fromEntries(Object.entries(empty).map(([key, value]) => [key, registration?.[key] ?? value])) as typeof empty);
    }).catch((e) => { if (active) setMessage(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orgId]);
  const fields = [
    ["identityEvidence", "مرجع هوية المنشأة والسجل", "Entity identity / registry evidence"],
    ["authorityEvidence", "مرجع تفويض الممثل", "Representative authority evidence"],
    ["revenueEvidence", "مرجع الإيرادات والفترة", "Revenue evidence and period"],
    ["applicationReference", "رقم الطلب لدى الهيئة", "Authority application reference"],
    ["submissionEvidence", "مرجع إثبات التقديم", "Submission evidence reference"],
    ["approvalEvidence", "مرجع موافقة الهيئة", "Authority approval evidence"],
    ["certificateReference", "مرجع ملف الشهادة الأصلي", "Original certificate file reference"],
    ["certificateSha256", "بصمة ملف الشهادة SHA-256", "Certificate file SHA-256"],
    ["vatNumber", "رقم VAT كما في الشهادة", "VAT number on the certificate"],
    ["effectiveDate", "تاريخ السريان YYYY-MM-DD", "Effective date YYYY-MM-DD"],
    ["verificationSource", "رابط مصدر التحقق الرسمي من ZATCA", "Official ZATCA verification source URL"],
    ["verificationNote", "تفاصيل مطابقة الاسم والرقم والتاريخ", "Name, number and date verification notes"],
  ];
  const advanced = ["certificateSha256", "verificationSource", "verificationNote"];
  return <Card data-testid="vat-registration-panel" className="border-border"><CardHeader><CardTitle>{t("التسجيل الضريبي وشهادة VAT", "VAT registration and certificate")}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("جهّز المستندات وتابع طلب الهيئة، أو سجّل شهادة موجودة للمراجعة. Entix لا يقدم الطلب ولا يصدر شهادة التسجيل. إدخال رقم VAT لا يثبت التسجيل. شهادة الجهاز CSID لها مسار مستقل أدناه.", "Prepare evidence and track the authority application, or record an existing certificate for review. Entix does not submit the application or issue VAT certificates. A typed VAT number does not prove registration. Device CSID onboarding is separate below.")}</p>
      <a href="https://www.zatca.gov.sa/en/eServices/Pages/eservices-001.aspx" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("خدمة التسجيل الرسمية لدى الهيئة", "Official ZATCA registration service")}</a>
      {loading ? <p>{t("جارٍ التحميل…", "Loading…")}</p> : <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setMessage("");
        try { const out = await api.vatRegistration.save(orgId, form); setForm({ ...form, revision: out.registration.revision, confirmVerified: false }); setMessage(t("حُفظ سجل المتابعة فقط", "Tracking record saved")); }
        catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
      }}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">{t("نوع المسار", "Workflow")}<select aria-label={t("نوع المسار", "Workflow")} className="w-full rounded-md border border-border bg-background p-2" value={form.path} onChange={e => setForm({ ...form, path: e.target.value, status: "DRAFT", confirmVerified: false })}>
            <option value="NEW_APPLICATION">{t("تسجيل جديد", "New application")}</option><option value="EXISTING_CERTIFICATE">{t("لدي شهادة صادرة", "I have an issued certificate")}</option>
          </select></label>
          <label className="text-sm">{t("الحالة المدعومة بالدليل", "Evidence-supported status")}<select aria-label={t("الحالة المدعومة بالدليل", "Evidence-supported status")} className="w-full rounded-md border border-border bg-background p-2" value={form.status} onChange={e => setForm({ ...form, status: e.target.value, confirmVerified: false })}>{statuses.map(([id, ar, en]) => <option key={id} value={id}>{t(ar, en)}</option>)}</select></label>
          {fields.filter(([key]) => !advanced.includes(key) && (form.path === "NEW_APPLICATION" || !["revenueEvidence", "applicationReference", "submissionEvidence"].includes(key))).map(([key, ar, en]) => <label key={key} className="text-sm">{t(ar, en)}<Input value={String(form[key as keyof typeof empty])} maxLength={key === "certificateSha256" ? 64 : 1000} onChange={e => setForm({ ...form, [key]: e.target.value, confirmVerified: false })} /></label>)}
        </div>
        <details className="rounded-md border border-border p-3 text-sm">
          <summary className="cursor-pointer">{t("تفاصيل التحقق المتقدمة — للمسؤول", "Advanced verification evidence — administrator")}</summary>
          <p className="mt-3 text-muted-foreground">{t("يسجل المسؤول هنا بصمة الشهادة ومصدر مراجعتها. تُحفظ مراجع الوثائق فقط؛ رفع الملفات وحساب بصمتها تلقائيًا غير متاحين في هذا المسار.", "The administrator records the certificate fingerprint and review source here. This workflow stores document references; file upload and automatic fingerprint calculation are not available.")}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">{fields.filter(([key]) => advanced.includes(key)).map(([key, ar, en]) => <label key={key} className="text-sm">{t(ar, en)}<Input value={String(form[key as keyof typeof empty])} maxLength={key === "certificateSha256" ? 64 : 1000} onChange={e => setForm({ ...form, [key]: e.target.value, confirmVerified: false })} /></label>)}</div>
        </details>
        {form.status === "CERTIFICATE_VERIFIED" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.confirmVerified} onChange={e => setForm({ ...form, confirmVerified: e.target.checked })} />{t("راجعت الشهادة الأصلية ومصدر الهيئة وطابقت المنشأة والرقم والتاريخ. هذا تحقق يدوي وليس فحصًا آليًا من الهيئة.", "I reviewed the original certificate and authority source and matched the entity, VAT number and date. This is a manual review, not an automated authority check.")}</label>}
        <Button type="submit" disabled={busy || (form.status === "CERTIFICATE_VERIFIED" && !form.confirmVerified)}>{t("حفظ المتابعة", "Save tracking")}</Button>
      </form>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </CardContent></Card>;
}
