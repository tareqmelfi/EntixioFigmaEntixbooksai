/**
 * New share transaction — full page (app-wide standard).
 * /app/share-transactions/new
 *
 * Kind is segmented. Journal treatment per kind (explained on-page):
 *   ISSUE         → Dr bank · Cr share capital (par) + share premium
 *   BUYBACK       → Dr treasury shares · Cr bank
 *   SELL_TREASURY → Dr bank · Cr treasury (avg cost) ± share premium
 *   TRANSFER      → register only (company is not a party)
 *   CANCEL        → Dr share capital · Cr bank
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError, Account } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useLanguage } from "../components/LanguageContext";

type ShareKind = "ISSUE" | "BUYBACK" | "SELL_TREASURY" | "TRANSFER" | "CANCEL";

const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ShareTransactionNew() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();

  const [shareholders, setShareholders] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    kind: "ISSUE" as ShareKind,
    fromShareholderId: "", toShareholderId: "",
    shares: "", pricePerShare: "", parValue: "10",
    offsetAccountId: "", notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([api.investments.listShareholders(), api.accounts.list()]);
      setShareholders(s.items);
      setAccounts(a.items);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const holderItems = useMemo(() => shareholders.map((s) => ({
    id: s.id,
    label: `${s.code} · ${s.name}`,
    sublabel: `${Number(s.shareCount || 0).toLocaleString()} ${t("سهم", "shares")}`,
  })), [shareholders, t]);

  const cashAccounts = useMemo(() => accounts
    .filter((a) => a.type === "ASSET" && /bank|cash/i.test(a.subtype || ""))
    .map((a) => ({ id: a.id, label: `${a.code} · ${displayName(a)}`, sublabel: a.subtype || undefined })), [accounts]);

  const amount = (Number(form.shares || 0) * Number(form.pricePerShare || 0));
  const fromHolder = shareholders.find((s) => s.id === form.fromShareholderId);

  const KINDS: Array<{ kind: ShareKind; ar: string; en: string; hint: string }> = [
    { kind: "ISSUE", ar: "إصدار أسهم جديدة", en: "Issue new shares", hint: "مدين البنك · دائن رأس المال + علاوة الإصدار" },
    { kind: "BUYBACK", ar: "شراء الشركة أسهمها", en: "Company buyback", hint: "مدين أسهم خزينة · دائن البنك" },
    { kind: "SELL_TREASURY", ar: "بيع أسهم خزينة", en: "Sell treasury shares", hint: "مدين البنك · دائن أسهم خزينة بالتكلفة ± علاوة الإصدار" },
    { kind: "TRANSFER", ar: "تنازل بين مساهمين", en: "Shareholder transfer", hint: "سجل فقط — الشركة ليست طرفاً في الصفقة" },
    { kind: "CANCEL", ar: "إلغاء أسهم", en: "Cancel shares", hint: "مدين رأس المال · دائن البنك" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!Number(form.shares) || !Number(form.pricePerShare)) { setError(t("عدد الأسهم والسعر مطلوبان", "Shares and price are required")); return; }
    if (form.kind !== "TRANSFER" && !form.offsetAccountId) { setError(t("اختر حساب البنك", "Choose the bank account")); return; }
    setBusy(true);
    try {
      const txn = await api.investments.createShareTransaction({
        date: form.date, kind: form.kind,
        fromShareholderId: ["BUYBACK", "TRANSFER", "CANCEL"].includes(form.kind) ? form.fromShareholderId || null : null,
        toShareholderId: ["ISSUE", "SELL_TREASURY", "TRANSFER"].includes(form.kind) ? form.toShareholderId || null : null,
        shares: Number(form.shares),
        pricePerShare: Number(form.pricePerShare),
        parValue: form.parValue ? Number(form.parValue) : null,
        offsetAccountId: form.kind !== "TRANSFER" ? form.offsetAccountId : null,
        notes: form.notes || null,
      });
      if (form.kind === "TRANSFER") {
        push("success", t("وُثّق التنازل في السجل (لا قيد — الشركة ليست طرفاً)", "Transfer recorded in the register (no journal — company not a party)"));
      } else if (txn.journalPosted) {
        push("success", t("وُثّقت الحركة وقُيّدت في حقوق الملكية ✓", "Move recorded and posted to equity ✓"));
      } else {
        push("success", t("وُثّقت الحركة (سجل فقط)", "Move recorded (register only)"));
      }
      navigate("/app/shareholders");
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "";
      setError(
        msg === "insufficient_shares" ? t(`رصيد البائع لا يكفي (يملك ${fromHolder ? Number(fromHolder.shareCount).toLocaleString() : "؟"} سهم)`, `Seller's holding is insufficient`)
        : msg === "insufficient_treasury" ? t("أسهم الخزينة لا تكفي لهذا البيع", "Treasury shares are insufficient for this sale")
        : msg === "same_party" ? t("البائع والمشتري نفس الشخص", "Seller and buyer are the same")
        : msg === "both_parties_required" ? t("التنازل يحتاج الطرفين", "A transfer needs both parties")
        : msg === "offset_account_required" ? t("اختر حساب البنك", "Choose the bank account")
        : msg || t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/shareholders" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة لسجل المساهمين", "Back to the Register")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("حركة أسهم جديدة", "New share transaction")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("كل نوع له معالجته المحاسبية الصحيحة في حقوق الملكية — والتنازل بين المساهمين يبقى في السجل فقط", "Each kind gets its correct equity treatment — transfers between shareholders stay in the register")}</p>
      </div>

      {shareholders.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("سجّل مساهماً أولاً من صفحة سجل المساهمين", "Register a shareholder first from the Shareholders page")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>{t("نوع الحركة", "Transaction kind")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {KINDS.map((k) => (
                  <button key={k.kind} type="button" onClick={() => setForm({ ...form, kind: k.kind })}
                    className={`rounded-lg border p-3 text-start transition-colors ${form.kind === k.kind ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"}`}>
                    <div className="text-sm" style={{ fontWeight: 700, color: form.kind === k.kind ? "#1276E3" : "inherit" }}>{t(k.ar, k.en)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-4">{k.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {["BUYBACK", "TRANSFER", "CANCEL"].includes(form.kind) && (
                <div className="space-y-2">
                  <Label>{form.kind === "BUYBACK" ? t("البائع (مساهم حالي) *", "Seller (current holder) *") : form.kind === "CANCEL" ? t("المساهم الملغى أسهمه *", "Holder whose shares cancel *") : t("المتنازل *", "From *")}</Label>
                  <SearchableCombobox value={form.fromShareholderId} onChange={(fromShareholderId) => setForm({ ...form, fromShareholderId })} items={holderItems} placeholder={t("اختر المساهم...", "Choose shareholder...")} />
                  {fromHolder && <p className="text-[10px] text-muted-foreground">{t("يملك حالياً:", "Currently holds:")} <span className="font-english">{Number(fromHolder.shareCount || 0).toLocaleString()}</span> {t("سهم", "shares")}</p>}
                </div>
              )}
              {["ISSUE", "SELL_TREASURY", "TRANSFER"].includes(form.kind) && (
                <div className="space-y-2">
                  <Label>{form.kind === "ISSUE" ? t("المساهم الجديد *", "Receiving shareholder *") : form.kind === "SELL_TREASURY" ? t("المشتري *", "Buyer *") : t("المتنازَل له *", "To *")}</Label>
                  <SearchableCombobox value={form.toShareholderId} onChange={(toShareholderId) => setForm({ ...form, toShareholderId })} items={holderItems} placeholder={t("اختر المساهم...", "Choose shareholder...")} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("التاريخ *", "Date *")}</Label><DateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} required inputClassName="" /></div>
              {form.kind === "ISSUE" && (
                <div className="space-y-2"><Label>{t("القيمة الاسمية للسهم", "Par value per share")}</Label><Input type="number" step="0.01" min="0" value={form.parValue} onChange={(e) => setForm({ ...form, parValue: e.target.value })} dir="ltr" className="font-english" /></div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <div className="space-y-2"><Label>{t("عدد الأسهم *", "Shares *")}</Label><Input type="number" step="1" min="1" required value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("سعر السهم *", "Price per share *")}</Label><Input type="number" step="0.0001" min="0" required value={form.pricePerShare} onChange={(e) => setForm({ ...form, pricePerShare: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("الإجمالي", "Total")}</Label><div className="rounded-md border border-border bg-white px-3 py-2 font-english text-sm" style={{ fontWeight: 700 }} dir="ltr">{money(amount)}</div></div>
            </div>

            {form.kind !== "TRANSFER" && (
              <div className="space-y-2">
                <Label>{t("حساب البنك *", "Bank account *")}</Label>
                <SearchableCombobox value={form.offsetAccountId} onChange={(offsetAccountId) => setForm({ ...form, offsetAccountId })} items={cashAccounts} placeholder={t("الحساب الذي دخل منه أو خرج إليه المال...", "The account money entered or left...")} />
                {cashAccounts.length === 0 && <p className="text-[11px] text-amber-700">{t("لا توجد حسابات بنكية — أنشئ حساباً من صفحة الحسابات البنكية", "No bank accounts — create one from the Bank accounts page")}</p>}
              </div>
            )}
            {form.kind === "TRANSFER" && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                {t("التنازل بين المساهمين صفقة بينهم هم — الثمن لا يمر عبر الشركة، لذلك لا يُنشأ قيد دفاتر، ويُحدَّث السجل فقط (عدد الأسهم ومتوسط التكلفة لكل طرف).", "A transfer is a deal between the shareholders themselves — the price doesn't flow through the company, so no journal entry is created; only the register updates (each party's share count and average cost).")}
              </div>
            )}

            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("رقم العقد · قرار الجمعية · مرجع التوثيق", "Contract no. · assembly resolution · notarization ref")} /></div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate("/app/shareholders")}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy || shareholders.length === 0} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{t("توثيق الحركة", "Record the move")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
