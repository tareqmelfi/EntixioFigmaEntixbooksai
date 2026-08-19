/**
 * Log work hours — full page (app-wide standard).
 * /app/work-logs/new?project=..&contractor=..
 *
 * The worker is ANY contact (user ask 2026-08-19: «المقاول مو شرط يكون فري
 * لانسر، قائمة الاتصال بها يفترض الكل») — picker lists every contact with
 * inline create; the API binds/creates the contractor shell from contactId.
 * Rate resolution is shown live: engagement rate → contractor default → manual.
 * Non-billable hours are tracked but cost 0.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError, Contact } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function WorkLogNew() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toasts, push, dismiss } = useToasts();

  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newContactName, setNewContactName] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);
  const [form, setForm] = useState({
    projectId: searchParams.get("project") || "",
    contactId: searchParams.get("contact") || "",
    date: new Date().toISOString().slice(0, 10),
    hours: "", description: "", billable: true, rateSnapshot: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, ctr] = await Promise.all([
        api.projects.list(),
        api.contacts.list({ limit: 500 }),
        api.contractors.list(),
      ]);
      setProjects((p.items || []).filter((x: any) => x.status === "ACTIVE"));
      setContacts(c.items || []);
      setContractors((ctr.items || []).filter((x: any) => x.isActive !== false));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const projectItems = useMemo(() => projects.map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` })), [projects]);
  // كل قائمة الاتصال — عميل، مورد، موظف، فري لانسر… الكل قابل لتسجيل ساعات
  const contactItems = useMemo(() => contacts.map((c) => ({
    id: c.id, label: c.displayName,
    sublabel: [c.customCode, c.email || c.phone].filter(Boolean).join(" · "),
  })), [contacts]);

  // Rate hint: the contractor shell bound to the picked contact (if any)
  const boundContractor = useMemo(
    () => contractors.find((x) => x.contactId === form.contactId),
    [contractors, form.contactId],
  );
  const effectiveRate = form.rateSnapshot !== "" ? Number(form.rateSnapshot)
    : boundContractor?.hourlyRate != null ? Number(boundContractor.hourlyRate) : null;
  const amount = form.billable && effectiveRate != null && Number(form.hours) > 0 ? Number(form.hours) * effectiveRate : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const createContactInline = async () => {
    const name = newContactName.trim();
    if (!name) return;
    setCreatingContact(true);
    setError(null);
    try {
      const created = await api.contacts.create({ displayName: name, isSupplier: true } as any);
      setContacts((prev) => [...prev, created]);
      setForm({ ...form, contactId: created.id });
      setNewContactName("");
      push("success", t("أُنشئ جهة الاتصال واخُتيرت", "Contact created and selected"));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل إنشاء جهة الاتصال", "Contact create failed"));
    } finally { setCreatingContact(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.projectId || !form.contactId) { setError(t("اختر المشروع وجهة الاتصال", "Choose project and contact")); return; }
    const hours = Number(form.hours);
    if (!hours || hours <= 0 || hours > 24) { setError(t("الساعات بين 0 و 24 لليوم الواحد", "Hours must be between 0 and 24 per day")); return; }
    setBusy(true);
    try {
      const log = await api.contractors.logWork({
        projectId: form.projectId, contactId: form.contactId,
        date: form.date, hours,
        description: form.description || null,
        billable: form.billable,
        rateSnapshot: form.rateSnapshot !== "" ? Number(form.rateSnapshot) : null,
      });
      push("success", Number(log.amount) > 0
        ? t(`سُجّلت ${hours} ساعة بقيمة ${money(log.amount)}`, `Logged ${hours}h worth ${money(log.amount)}`)
        : t(`سُجّلت ${hours} ساعة (غير قابلة للفوترة)`, `Logged ${hours}h (non-billable)`));
      navigate(`/app/projects/${form.projectId}`);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to={form.projectId ? `/app/projects/${form.projectId}` : "/app/projects"} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة", "Back")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("تسجيل ساعات عمل", "Log work hours")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("سجّل الساعات على أي جهة من قائمة الاتصال — عميل، مورد، مقاول أو موظف", "Log hours against any contact — customer, supplier, contractor or employee")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("المشروع *", "Project *")}</Label>
                <SearchableCombobox value={form.projectId} onChange={(projectId) => setForm({ ...form, projectId })} items={projectItems} placeholder={t("اختر المشروع...", "Choose the project...")} />
                {projects.length === 0 && <p className="text-[11px] text-amber-700">{t("أنشئ مشروعاً أولاً", "Create a project first")}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t("جهة العمل (من قائمة الاتصال) *", "Worker (from contacts) *")}</Label>
                <SearchableCombobox value={form.contactId} onChange={(contactId) => setForm({ ...form, contactId })} items={contactItems} placeholder={t("اختر جهة الاتصال...", "Choose the contact...")} />
                <div className="flex gap-1.5">
                  <Input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder={t("اسم جهة جديدة...", "New contact name...")} className="h-8 text-xs" />
                  <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" disabled={creatingContact || !newContactName.trim()} onClick={createContactInline}>
                    {creatingContact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("إنشاء", "Create")}
                  </Button>
                </div>
                {contacts.length === 0 && <p className="text-[11px] text-amber-700">{t("أضف جهة اتصال أولاً أو أنشئها هنا", "Add a contact first or create one here")}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>{t("التاريخ *", "Date *")}</Label><DateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} required inputClassName="" /></div>
              <div className="space-y-2"><Label>{t("الساعات *", "Hours *")}</Label><Input type="number" step="0.25" min="0.25" max="24" required value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} dir="ltr" className="font-english" placeholder="8" /></div>
              <div className="space-y-2">
                <Label>{t("سعر الساعة", "Hourly rate")}</Label>
                <Input type="number" step="0.01" min="0" value={form.rateSnapshot} onChange={(e) => setForm({ ...form, rateSnapshot: e.target.value })} dir="ltr" className="font-english"
                  placeholder={boundContractor?.hourlyRate != null ? String(boundContractor.hourlyRate) : t("يدوي", "manual")} />
                {effectiveRate != null && <p className="text-[10px] text-muted-foreground">{t("الساري:", "Effective:")} <span className="font-english">{money(effectiveRate)}</span></p>}
              </div>
            </div>

            <div className="space-y-2"><Label>{t("وصف العمل", "Work description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("ماذا أنجز في هذه الساعات؟", "What was delivered in these hours?")} /></div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div>
                <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t("قابلة للفوترة", "Billable")}</div>
                <div className="text-[11px] text-muted-foreground">{t("غير القابلة تُتتبع للتكلفة الداخلية وتبقى بصفر مبلغ", "Non-billable is tracked for internal cost at zero amount")}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({ ...form, billable: true })}
                  className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${form.billable ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border"}`}>{t("نعم", "Yes")}</button>
                <button type="button" onClick={() => setForm({ ...form, billable: false })}
                  className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${!form.billable ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border"}`}>{t("لا", "No")}</button>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center justify-between">
              <span className="text-sm text-emerald-800">{t("قيمة السجل", "Log value")}</span>
              <span className="font-english text-emerald-700" style={{ fontWeight: 700, fontSize: "1.1rem" }} dir="ltr">{money(amount)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{t("تسجيل الساعات", "Log hours")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
