/**
 * Shareholder full page — app-wide standard:
 *   /app/shareholders/new  → register form (auto SH-001 code)
 *   /app/shareholders/:id  → holdings + this shareholder's share moves + edit/delete
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Edit2, Loader2, Plus, Save, Sparkles, Trash2, Users2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { useLegalType } from "../lib/use-legal-type";

const num = (v: any) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KIND_LABELS: Record<string, { ar: string; en: string }> = {
  ISSUE: { ar: "إصدار", en: "Issue" }, BUYBACK: { ar: "شراء الشركة أسهمها", en: "Buyback" },
  SELL_TREASURY: { ar: "بيع أسهم خزينة", en: "Treasury sale" }, TRANSFER: { ar: "تنازل بين مساهمين", en: "Transfer" },
  CANCEL: { ar: "إلغاء أسهم", en: "Cancellation" },
};

const EMPTY_FORM = { code: "", name: "", nationalId: "", email: "", phone: "", notes: "", contactId: "" };

export function ShareholderDetail() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const legalType = useLegalType();
  const isJsc = legalType === "JSC";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [person, setPerson] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [pendingDelete, setPendingDelete] = useState(false);

  const contactItems = useMemo(
    () => contacts.map((c) => ({ id: c.id, label: c.displayName, sublabel: [c.customCode, c.email].filter(Boolean).join(" · ") })),
    [contacts],
  );

  const applyPerson = useCallback((s: any) => {
    setPerson(s);
    setForm({ code: s.code || "", name: s.name || "", nationalId: s.nationalId || "", email: s.email || "", phone: s.phone || "", notes: s.notes || "", contactId: s.contactId || "" });
  }, []);

  const load = useCallback(async () => {
    if (isNew) {
      try { const { code } = await api.investments.nextShareholderCode(); setForm((f) => ({ ...f, code })); } catch { /* manual */ }
      return;
    }
    setLoading(true);
    try { applyPerson(await api.investments.getShareholder(id!)); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل تحميل المساهم", "Failed to load shareholder")); }
    finally { setLoading(false); }
  }, [id, isNew, applyPerson, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.contacts.list({ limit: 300 }).then((d: any) => setContacts(d.items || [])).catch(() => {}); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("الاسم مطلوب", "Name is required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = { code: form.code.trim() || undefined, name: form.name.trim(), nationalId: form.nationalId || null, email: form.email || null, phone: form.phone || null, notes: form.notes || null, contactId: form.contactId || null };
      const saved = isNew ? await api.investments.createShareholder(payload) : await api.investments.updateShareholder(id!, payload);
      push("success", isNew
        ? (isJsc ? t("تم تسجيل المساهم", "Shareholder registered") : t("تم تسجيل المالك", "Owner registered"))
        : (isJsc ? t("تم تحديث المساهم", "Shareholder updated") : t("تم تحديث المالك", "Owner updated")));
      if (isNew) navigate(`/app/shareholders/${saved.id}`, { replace: true });
      else { applyPerson({ ...person, ...saved }); setEditMode(false); }
    } catch (e: any) {
      setError(e instanceof ApiError ? (e.message === "code_exists" ? t("الرمز موجود", "Code already exists") : e.message) : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    try {
      await api.investments.deleteShareholder(id!);
      push("success", isJsc ? t("تم حذف المساهم", "Shareholder deleted") : t("تم حذف المالك", "Owner deleted"));
      navigate("/app/shareholders");
    } catch (e: any) {
      push("error", e instanceof ApiError && e.message === "has_transactions" ? t("له حركات في السجل — لا يمكن حذفه", "Has register transactions — cannot delete") : t("فشل الحذف", "Delete failed"));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const formView = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{isJsc ? t("بيانات المساهم", "Shareholder details") : t("بيانات المالك", "Owner details")}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("الرمز", "Code")}</Label>
              <div className="flex gap-1.5">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SH-001" dir="ltr" className="font-english" />
                {isNew && (
                  <button type="button" onClick={async () => { try { const { code } = await api.investments.nextShareholderCode(); setForm((f) => ({ ...f, code })); } catch { /* keep */ } }}
                    title={t("توليد تلقائي", "Auto-generate")} className="shrink-0 rounded-md border border-border px-2 text-primary hover:bg-blue-50">
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2"><Label>{t("رقم الهوية / السجل", "ID / CR number")}</Label><Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" className="font-english" /></div>
          </div>
          <div className="space-y-2"><Label>{t("الاسم *", "Name *")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isJsc ? t("اسم المساهم شخصاً أو شركة", "Shareholder name — person or company") : t("اسم المالك شخصاً أو شركة", "Owner name — person or company")} /></div>
          <div className="space-y-2">
            <Label>{t("الربط بجهة اتصال", "Linked contact")}</Label>
            <SearchableCombobox
              value={form.contactId}
              onChange={(contactId) => {
                const c = contacts.find((x) => x.id === contactId);
                setForm((f) => ({ ...f, contactId, name: f.name || (c?.displayName ?? ""), email: f.email || (c?.email ?? ""), phone: f.phone || (c?.phone ?? "") }));
              }}
              items={contactItems}
              placeholder={t("اختر من سجل جهات الاتصال...", "Pick from contacts...")}
            />
            <p className="text-[10px] text-muted-foreground">{t("اختياري — يعبّي الاسم والبيانات من جهة الاتصال ويُعلّمها كمالك", "Optional — fills name/details from the contact and flags it as owner")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t("البريد", "Email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("الجوال", "Mobile")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="font-english" /></div>
          </div>
          <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-[#F7F9FC] py-3 -mx-1 px-1">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/shareholders") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? (isJsc ? t("تسجيل المساهم", "Register shareholder") : t("تسجيل المالك", "Register owner")) : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const detailView = person && (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("الأسهم المملوكة", "Shares held")}</div>
          <div className="font-english text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.3rem" }} dir="ltr">{num(person.shareCount)}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("متوسط تكلفة السهم", "Avg cost per share")}</div>
          <div className="font-english text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.3rem" }} dir="ltr">{person.avgCost != null ? money(person.avgCost) : "—"}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("إجمالي الاستثمار", "Total invested")}</div>
          <div className="font-english text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.3rem" }} dir="ltr">{person.avgCost != null ? money(Number(person.shareCount || 0) * Number(person.avgCost)) : "—"}</div>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-base">{t("حركات الأسهم", "Share moves")} · {person.transactions?.length || 0}</CardTitle>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/share-transactions/new")}>
              <Plus className="me-1.5 h-3.5 w-3.5" />{t("حركة أسهم", "Share transaction")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!person.transactions || person.transactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("لا توجد حركات بعد", "No share moves yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 text-start">{t("التاريخ", "Date")}</th>
                  <th className="py-2.5 px-4 text-start">{t("النوع", "Kind")}</th>
                  <th className="py-2.5 px-4 text-start">{t("الطرف الآخر", "Counterparty")}</th>
                  <th className="py-2.5 px-4 text-start">{t("الأسهم", "Shares")}</th>
                  <th className="py-2.5 px-4 text-start">{t("السعر", "Price")}</th>
                  <th className="py-2.5 px-4 text-start">{t("الإجمالي", "Total")}</th>
                  <th className="py-2.5 px-4 text-start">{t("القيد", "Entry")}</th>
                </tr></thead>
                <tbody>
                  {person.transactions.map((x: any) => {
                    const counterparty = x.from?.id === person.id ? x.to : x.from;
                    const isOut = x.from?.id === person.id;
                    return (
                      <tr key={x.id} className="border-b border-border/50 hover:bg-primary/5">
                        <td className="py-2.5 px-4 font-english text-xs text-muted-foreground" dir="ltr">{x.date?.slice(0, 10)}</td>
                        <td className="py-2.5 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${x.kind === "ISSUE" ? "bg-blue-100 text-blue-700" : x.kind === "TRANSFER" ? "bg-violet-100 text-violet-700" : x.kind === "BUYBACK" ? "bg-amber-100 text-amber-700" : x.kind === "SELL_TREASURY" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                            {KIND_LABELS[x.kind] ? t(KIND_LABELS[x.kind].ar, KIND_LABELS[x.kind].en) : x.kind}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-foreground/80">{counterparty?.name || t("الشركة", "The company")}</td>
                        <td className={`py-2.5 px-4 font-english ${isOut ? "text-red-600" : "text-emerald-600"}`} style={{ fontWeight: 600 }} dir="ltr">{isOut ? "−" : "+"}{num(x.shares)}</td>
                        <td className="py-2.5 px-4 font-english" dir="ltr">{money(x.pricePerShare)}</td>
                        <td className="py-2.5 px-4 font-english" dir="ltr">{money(x.amount)}</td>
                        <td className="py-2.5 px-4 text-xs">{x.journalEntryId ? <span className="text-emerald-700">{t("مقيّد ✓", "posted ✓")}</span> : <span className="text-muted-foreground/50">{t("سجل فقط", "register")}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700 mb-2">{isJsc ? t("حذف المساهم نهائياً؟ (يُسمح فقط بلا حركات)", "Delete this shareholder permanently? (allowed only with no transactions)") : t("حذف المالك نهائياً؟ (يُسمح فقط بلا حركات)", "Delete this owner permanently? (allowed only with no transactions)")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/shareholders" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للسجل", "Back to the Register")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {isNew ? t("مساهم جديد", "New Shareholder") : (person?.name || t("المساهم", "Shareholder"))}
        </h1>
        {!isNew && person && (
          <div className="flex items-center gap-2 mt-1">
            <span className="font-english text-xs text-primary" dir="ltr">{person.code}</span>
            <span className="text-xs text-muted-foreground font-english">{person.nationalId || ""}</span>
          </div>
        )}
        {isNew && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Users2 className="h-4 w-4" />{t("سجّل مساهماً ثم وثّق الإصدار أو التنازل من صفحته", "Register a shareholder, then record issuance or transfers from their page")}</p>}
      </div>
      {error && !editMode && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
