/**
 * New wallet transaction — full page (app-wide standard).
 * /app/investments/:id/transactions/new
 *
 * Kind is segmented. Money-moving kinds need the bank/cash offset account;
 * trades compute amount = qty × price live and show realized P&L after save.
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
import { displayName } from "../lib/display-name";
import { useLanguage } from "../components/LanguageContext";

type TxnKind = "DEPOSIT" | "WITHDRAWAL" | "TRADE_BUY" | "TRADE_SELL" | "FEE" | "SUBSCRIPTION" | "PROFIT_PAYOUT" | "PROFIT_SHARE_COST" | "ADJUSTMENT";

const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function WalletTransactionNew() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();

  const [wallet, setWallet] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    kind: "DEPOSIT" as TxnKind,
    amount: "", symbol: "", quantity: "", price: "", fee: "",
    offsetAccountId: "", expenseAccountId: "", revenueAccountId: "", notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, a] = await Promise.all([api.investments.getWallet(id!), api.accounts.list()]);
      setWallet(w);
      setAccounts(a.items);
      // Pre-pick kind by wallet type
      setForm((f) => ({ ...f, kind: w.kind === "FUNDED_PROP" ? "SUBSCRIPTION" : "DEPOSIT" }));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  const cashAccounts = useMemo(() => accounts
    .filter((a) => a.type === "ASSET" && /bank|cash/i.test(a.subtype || ""))
    .map((a) => ({ id: a.id, label: `${a.code} · ${displayName(a)}`, sublabel: a.subtype || undefined })), [accounts]);
  const expenseAccounts = useMemo(() => accounts
    .filter((a) => a.type === "EXPENSE")
    .map((a) => ({ id: a.id, label: `${a.code} · ${displayName(a)}` })), [accounts]);
  const revenueAccounts = useMemo(() => accounts
    .filter((a) => a.type === "REVENUE")
    .map((a) => ({ id: a.id, label: `${a.code} · ${displayName(a)}` })), [accounts]);

  const isTrade = form.kind === "TRADE_BUY" || form.kind === "TRADE_SELL";
  const needsOffset = form.kind !== "ADJUSTMENT";
  const needsExpenseAcct = ["FEE", "SUBSCRIPTION", "PROFIT_SHARE_COST"].includes(form.kind);

  // Live amount for trades: qty × price
  useEffect(() => {
    if (!isTrade) return;
    const q = Number(form.quantity || 0);
    const p = Number(form.price || 0);
    if (q > 0 && p > 0) {
      setForm((f) => ({ ...f, amount: (q * p).toFixed(2) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.quantity, form.price, isTrade]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!wallet) {
    return <div className="max-w-3xl space-y-4"><div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || "not found"}</div></div>;
  }

  const KINDS: Array<{ kind: TxnKind; ar: string; en: string; show: boolean }> = [
    { kind: "DEPOSIT", ar: "إيداع", en: "Deposit", show: wallet.kind === "TRADING" },
    { kind: "WITHDRAWAL", ar: "سحب", en: "Withdrawal", show: wallet.kind === "TRADING" },
    { kind: "TRADE_BUY", ar: "شراء", en: "Buy", show: true },
    { kind: "TRADE_SELL", ar: "بيع", en: "Sell", show: true },
    { kind: "FEE", ar: "رسوم", en: "Fee", show: true },
    { kind: "SUBSCRIPTION", ar: "اشتراك التمويل", en: "Funding subscription", show: wallet.kind === "FUNDED_PROP" },
    { kind: "PROFIT_PAYOUT", ar: "توزيع أرباح وارد", en: "Profit payout in", show: wallet.kind === "FUNDED_PROP" },
    { kind: "PROFIT_SHARE_COST", ar: "حصة المموّل", en: "Firm's share", show: wallet.kind === "FUNDED_PROP" },
    { kind: "ADJUSTMENT", ar: "تسوية (سجل فقط)", en: "Adjustment (register only)", show: true },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { setError(t("المبلغ مطلوب", "Amount is required")); return; }
    if (isTrade && (!form.symbol.trim() || !Number(form.quantity) || !Number(form.price))) {
      setError(t("الصفقة تحتاج الرمز والكمية والسعر", "A trade needs symbol, quantity and price"));
      return;
    }
    if (needsOffset && !form.offsetAccountId) { setError(t("اختر حساب البنك/الصندوق المقابل", "Choose the bank/cash offset account")); return; }
    setBusy(true);
    try {
      const txn = await api.investments.addWalletTransaction(wallet.id, {
        date: form.date, kind: form.kind, amount,
        symbol: isTrade ? form.symbol.trim() : null,
        quantity: isTrade ? Number(form.quantity) : null,
        price: isTrade ? Number(form.price) : null,
        fee: form.fee ? Number(form.fee) : null,
        offsetAccountId: needsOffset ? form.offsetAccountId : null,
        expenseAccountId: needsExpenseAcct ? (form.expenseAccountId || null) : null,
        revenueAccountId: form.kind === "PROFIT_PAYOUT" ? (form.revenueAccountId || null) : null,
        notes: form.notes || null,
      });
      if (txn.journalPosted) {
        push("success", t("سُجّلت الحركة وقُيّدت في الدفاتر ✓", "Transaction recorded and posted to the books ✓"));
      } else {
        push("success", t("سُجّلت الحركة (سجل فقط — بلا قيد)", "Transaction recorded (register only — no journal)"));
      }
      if (txn.realizedPnl != null) {
        push(Number(txn.realizedPnl) >= 0 ? "success" : "info",
          t(`الربح المحقق من البيع: ${money(txn.realizedPnl)} ${wallet.currency}`, `Realized P&L on the sale: ${money(txn.realizedPnl)} ${wallet.currency}`), 6000);
      }
      navigate(`/app/investments/${wallet.id}`);
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "";
      setError(
        msg === "amount_mismatch" ? t("المبلغ يجب أن يساوي الكمية × السعر", "Amount must equal quantity × price")
        : msg === "trade_fields_required" ? t("الصفقة تحتاج الرمز والكمية والسعر", "A trade needs symbol, quantity and price")
        : msg || t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to={`/app/investments/${wallet.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للمحفظة", "Back to the wallet")} · {wallet.name}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("حركة جديدة", "New transaction")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {wallet.kind === "FUNDED_PROP"
            ? t("محفظة ممولة: ما يُقيد هو مالك فقط (اشتراك · أرباح · حصة المموّل)", "Funded wallet: only your money posts (subscription · profits · firm's share)")
            : t("كل حركة مالية تُقيّد تلقائياً بين حساب المحفظة والبنك", "Every money movement posts automatically between the wallet and bank accounts")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>{t("نوع الحركة", "Transaction kind")}</Label>
              <div className="flex flex-wrap gap-2">
                {KINDS.filter((k) => k.show).map((k) => (
                  <button key={k.kind} type="button" onClick={() => setForm({ ...form, kind: k.kind, amount: isTrade && !(k.kind === "TRADE_BUY" || k.kind === "TRADE_SELL") ? "" : form.amount })}
                    className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${form.kind === k.kind ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}>
                    {t(k.ar, k.en)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("التاريخ *", "Date *")}</Label><DateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} required inputClassName="" /></div>
              <div className="space-y-2"><Label>{t("المبلغ *", "Amount *")}</Label>
                <Input type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} dir="ltr" className="font-english" readOnly={isTrade && Number(form.quantity) > 0 && Number(form.price) > 0} />
                {isTrade && <p className="text-[10px] text-muted-foreground">{t("يُحسب تلقائياً = الكمية × السعر", "Auto-computed = quantity × price")}</p>}
              </div>
            </div>

            {isTrade && (
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <div className="space-y-2"><Label>{t("الرمز *", "Symbol *")}</Label><Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} placeholder="AAPL · 1120.SE" dir="ltr" className="font-english" /></div>
                <div className="space-y-2"><Label>{t("الكمية *", "Qty *")}</Label><Input type="number" step="0.000001" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} dir="ltr" className="font-english" /></div>
                <div className="space-y-2"><Label>{t("السعر *", "Price *")}</Label><Input type="number" step="0.000001" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} dir="ltr" className="font-english" /></div>
              </div>
            )}

            {(isTrade || form.kind === "FEE") && (
              <div className="space-y-2 w-1/2"><Label>{t("العمولة / الرسوم", "Commission / fee")}</Label><Input type="number" step="0.01" min="0" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} dir="ltr" className="font-english" placeholder="0" /></div>
            )}

            {needsOffset && (
              <div className="space-y-2">
                <Label>{t("حساب البنك / الصندوق المقابل *", "Bank / cash offset account *")}</Label>
                <SearchableCombobox value={form.offsetAccountId} onChange={(offsetAccountId) => setForm({ ...form, offsetAccountId })} items={cashAccounts} placeholder={t("اختر الحساب الذي خرج منه أو دخل إليه المال...", "Choose the account the money left or entered...")} />
                {cashAccounts.length === 0 && <p className="text-[11px] text-amber-700">{t("لا توجد حسابات بنكية في الشجرة — أنشئ حساباً بنكياً أولاً من صفحة الحسابات البنكية", "No bank accounts in the chart — create one from the Bank accounts page first")}</p>}
              </div>
            )}

            {needsExpenseAcct && (
              <div className="space-y-2">
                <Label>{t("حساب المصروف", "Expense account")}</Label>
                <SearchableCombobox value={form.expenseAccountId} onChange={(expenseAccountId) => setForm({ ...form, expenseAccountId })} items={expenseAccounts} placeholder={t("تلقائي: 65000 مصاريف الاستثمار والتداول", "Auto: 65000 Investment & Trading Expenses")} />
              </div>
            )}

            {form.kind === "PROFIT_PAYOUT" && (
              <div className="space-y-2">
                <Label>{t("حساب الإيراد", "Revenue account")}</Label>
                <SearchableCombobox value={form.revenueAccountId} onChange={(revenueAccountId) => setForm({ ...form, revenueAccountId })} items={revenueAccounts} placeholder={t("تلقائي: 43000 إيرادات أخرى", "Auto: 43000 Other Income")} />
              </div>
            )}

            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("اختياري", "Optional")} /></div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate(`/app/investments/${wallet.id}`)}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{t("تسجيل الحركة", "Record transaction")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
