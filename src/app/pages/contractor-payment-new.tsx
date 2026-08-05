/**
 * Pay a contractor — full page (app-wide standard).
 * /app/contractors/:id/pay
 *
 * Direct payment: Dr 67200 Subcontractor Fees / Cr bank — ONE entry, no AP
 * cycle. Shows earned/paid/outstanding so the amount makes sense in context.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError, Account } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHODS = ["BANK_TRANSFER", "CASH", "CARD", "MADA", "STC_PAY", "CHECK", "OTHER"] as const;
const METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  BANK_TRANSFER: { ar: "تحويل بنكي", en: "Bank transfer" }, CASH: { ar: "نقداً", en: "Cash" },
  CARD: { ar: "بطاقة", en: "Card" }, MADA: { ar: "مدى", en: "Mada" },
  STC_PAY: { ar: "STC Pay", en: "STC Pay" }, CHECK: { ar: "شيك", en: "Check" },
  OTHER: { ar: "أخرى", en: "Other" },
};

export function ContractorPaymentNew() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();

  const [person, setPerson] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "", method: "BANK_TRANSFER" as string,
    offsetAccountId: "", projectId: "", notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [x, a] = await Promise.all([api.contractors.get(id!), api.accounts.list()]);
      setPerson(x);
      setAccounts(a.items);
      const outstanding = Number(x.stats?.outstanding || 0);
      if (outstanding > 0) setForm((f) => ({ ...f, amount: outstanding.toFixed(2) }));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  const cashAccounts = useMemo(() => accounts
    .filter((a) => a.type === "ASSET" && /bank|cash/i.test(a.subtype || ""))
    .map((a) => ({ id: a.id, label: `${a.code} · ${a.nameAr || a.name}`, sublabel: a.subtype || undefined })), [accounts]);

  const projectItems = useMemo(() => (person?.stats?.engagements || [])
    .filter((e: any) => e.status === "ACTIVE")
    .map((e: any) => ({ id: e.projectId, label: e.project?.name || e.projectId, sublabel: e.project?.code })), [person]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!person) {
    return <div className="max-w-3xl"><div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || "not found"}</div></div>;
  }

  const outstanding = Number(person.stats?.outstanding || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { setError(t("المبلغ مطلوب", "Amount is required")); return; }
    if (!form.offsetAccountId) { setError(t("اختر حساب البنك/الصندوق", "Choose the bank/cash account")); return; }
    setBusy(true);
    try {
      const pay = await api.contractors.pay({
        contractorId: person.id,
        projectId: form.projectId || null,
        date: form.date, amount,
        method: form.method,
        offsetAccountId: form.offsetAccountId,
        notes: form.notes || null,
      });
      push("success", pay.journalPosted
        ? t(`دُفعت ${money(amount)} لـ${person.name} وقُيّدت كأتعاب مقاولين ✓`, `Paid ${money(amount)} to ${person.name} — posted as subcontractor fees ✓`)
        : t(`دُفعت ${money(amount)} (سجل فقط — تعذّر القيد)`, `Paid ${money(amount)} (register only — journal failed)`));
      navigate(`/app/contractors/${person.id}`);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الدفع", "Payment failed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to={`/app/contractors/${person.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة لصفحة المقاول", "Back to contractor")} · {person.name}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("دفعة مباشرة للمقاول", "Direct contractor payment")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("قيد واحد مباشر: مدين 67200 أتعاب مقاولين · دائن البنك — بدون فاتورة شراء ولا دورة ذمم", "One direct entry: Dr 67200 Subcontractor Fees · Cr bank — no bill, no AP cycle")}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("مستحقاته المكتسبة", "Earned")}</div>
          <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{money(person.stats?.totalEarned)}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("المدفوع سابقاً", "Already paid")}</div>
          <div className="font-english text-emerald-600 mt-1" style={{ fontWeight: 700 }} dir="ltr">{money(person.stats?.totalPaid)}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs text-amber-800">{t("المتبقي له", "Outstanding")}</div>
          <div className="font-english text-amber-700 mt-1" style={{ fontWeight: 700 }} dir="ltr">{money(outstanding)}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("التاريخ *", "Date *")}</Label><DateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} required inputClassName="" /></div>
              <div className="space-y-2"><Label>{t("المبلغ *", "Amount *")}</Label>
                <Input type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} dir="ltr" className="font-english" />
                {outstanding > 0 && Number(form.amount) > outstanding && (
                  <p className="text-[11px] text-amber-700">{t("أكبر من المستحق له — سيسجل كسلفة", "Above outstanding — records as an advance")}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("طريقة الدفع", "Payment method")}</Label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, method: m })}
                    className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${form.method === m ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}>
                    {t(METHOD_LABELS[m].ar, METHOD_LABELS[m].en)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("من حساب *", "From account *")}</Label>
              <SearchableCombobox value={form.offsetAccountId} onChange={(offsetAccountId) => setForm({ ...form, offsetAccountId })} items={cashAccounts} placeholder={t("البنك أو الصندوق الذي خرج منه المال...", "The bank or cash the money left...")} />
              {cashAccounts.length === 0 && <p className="text-[11px] text-amber-700">{t("لا توجد حسابات بنكية — أنشئ واحداً أولاً", "No bank accounts — create one first")}</p>}
            </div>

            {projectItems.length > 0 && (
              <div className="space-y-2">
                <Label>{t("ربط بمشروع (اختياري)", "Link to a project (optional)")}</Label>
                <SearchableCombobox value={form.projectId} onChange={(projectId) => setForm({ ...form, projectId })} items={projectItems} placeholder={t("دفعة عامة بدون مشروع", "General payment, no project")} />
              </div>
            )}

            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("دفعة أولى · تسوية نهائية · سلفة", "First payment · final settlement · advance")} /></div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-[#F7F9FC] py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate(`/app/contractors/${person.id}`)}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{t("تأكيد الدفع", "Confirm payment")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
