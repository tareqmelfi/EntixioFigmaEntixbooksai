/**
 * Investment wallet full page — app-wide standard:
 *   /app/investments/new  → create (kind segmented: TRADING / FUNDED_PROP)
 *   /app/investments/:id  → wallet (stats, positions, transactions, report,
 *                           close/reopen, edit, delete)
 *
 * Funded wallets carry the firm's capital OFF-ledger by design — only our
 * real money (subscription fee, profit payouts, firm's share) posts journals.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowRight, Edit2, Landmark, Loader2, Lock, LockOpen, Plus, Save,
  Sparkles, Trash2, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError, Account } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KIND_LABELS: Record<string, { ar: string; en: string }> = {
  DEPOSIT: { ar: "إيداع", en: "Deposit" }, WITHDRAWAL: { ar: "سحب", en: "Withdrawal" },
  TRADE_BUY: { ar: "شراء", en: "Buy" }, TRADE_SELL: { ar: "بيع", en: "Sell" },
  FEE: { ar: "رسوم", en: "Fee" }, SUBSCRIPTION: { ar: "اشتراك", en: "Subscription" },
  PROFIT_PAYOUT: { ar: "توزيع أرباح", en: "Profit payout" }, PROFIT_SHARE_COST: { ar: "حصة المموّل", en: "Firm share" },
  ADJUSTMENT: { ar: "تسوية", en: "Adjustment" },
};

const EMPTY_FORM = {
  code: "", name: "", kind: "TRADING" as "TRADING" | "FUNDED_PROP",
  broker: "", currency: "SAR", accountId: "", openingBalance: "0",
  fundedProvider: "", fundedCapital: "", profitSplitPct: "", subscriptionFee: "", notes: "",
};

export function InvestmentWalletDetail() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [wallet, setWallet] = useState<any | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingTxnDelete, setPendingTxnDelete] = useState<string | null>(null);

  useEffect(() => {
    api.accounts.list().then((d) => setAccounts(d.items)).catch(() => {});
  }, []);

  const applyWallet = useCallback((w: any) => {
    setWallet(w);
    setForm({
      code: w.code || "", name: w.name || "", kind: w.kind || "TRADING",
      broker: w.broker || "", currency: w.currency || "SAR", accountId: w.accountId || "",
      openingBalance: String(w.openingBalance ?? "0"),
      fundedProvider: w.fundedProvider || "", fundedCapital: w.fundedCapital != null ? String(w.fundedCapital) : "",
      profitSplitPct: w.profitSplitPct != null ? String(w.profitSplitPct) : "",
      subscriptionFee: w.subscriptionFee != null ? String(w.subscriptionFee) : "",
      notes: w.notes || "",
    });
  }, []);

  const load = useCallback(async () => {
    if (isNew) {
      try { const { code } = await api.investments.nextWalletCode(); setForm((f) => ({ ...f, code })); } catch { /* manual */ }
      return;
    }
    setLoading(true);
    try {
      const [w, r] = await Promise.all([api.investments.getWallet(id!), api.investments.walletReport(id!).catch(() => null)]);
      applyWallet(w);
      setReport(r);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تحميل المحفظة", "Failed to load wallet"));
    } finally { setLoading(false); }
  }, [id, isNew, applyWallet, t]);
  useEffect(() => { load(); }, [load]);

  const assetAccounts = accounts.filter((a) => a.type === "ASSET").map((a) => ({ id: a.id, label: `${a.code} · ${a.nameAr || a.name}`, sublabel: a.subtype || undefined }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("اسم المحفظة مطلوب", "Wallet name is required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        code: form.code.trim() || undefined,
        name: form.name.trim(), kind: form.kind,
        broker: form.broker || null, currency: form.currency,
        accountId: form.accountId || null,
        openingBalance: Number(form.openingBalance) || 0,
        fundedProvider: form.kind === "FUNDED_PROP" ? (form.fundedProvider || null) : null,
        fundedCapital: form.kind === "FUNDED_PROP" && form.fundedCapital ? Number(form.fundedCapital) : null,
        profitSplitPct: form.kind === "FUNDED_PROP" && form.profitSplitPct ? Number(form.profitSplitPct) : null,
        subscriptionFee: form.kind === "FUNDED_PROP" && form.subscriptionFee ? Number(form.subscriptionFee) : null,
        notes: form.notes || null,
      };
      const saved = isNew ? await api.investments.createWallet(payload) : await api.investments.updateWallet(id!, payload);
      push("success", isNew ? t("تم إنشاء المحفظة", "Wallet created") : t("تم تحديث المحفظة", "Wallet updated"));
      if (isNew) navigate(`/app/investments/${saved.id}`, { replace: true });
      else { applyWallet(saved); setEditMode(false); }
    } catch (e: any) {
      setError(e instanceof ApiError ? (e.message === "code_exists" ? t("الرمز موجود", "Code already exists") : e.message) : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleCloseToggle = async () => {
    try {
      const w = await api.investments.closeWallet(id!);
      applyWallet(w);
      push("success", w.status === "CLOSED" ? t("تم إغلاق المحفظة", "Wallet closed") : t("أُعيد فتح المحفظة", "Wallet reopened"));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
  };

  const handleDelete = async () => {
    try {
      await api.investments.deleteWallet(id!);
      push("success", t("تم حذف المحفظة", "Wallet deleted"));
      navigate("/app/investments");
    } catch (e: any) {
      push("error", e instanceof ApiError && e.message === "has_transactions" ? t("للمحفظة حركات — احذفها أولاً أو أغلق المحفظة", "Wallet has transactions — delete them first or close the wallet") : t("فشل الحذف", "Delete failed"));
    }
  };

  const handleDeleteTxn = async (txnId: string) => {
    setPendingTxnDelete(null);
    try {
      await api.investments.deleteWalletTransaction(txnId);
      push("success", t("حُذفت الحركة وقيدها", "Transaction and its entry deleted"));
      load();
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const formView = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("بيانات المحفظة", "Wallet details")}</div>
            <div className="space-y-2">
              <Label>{t("نوع المحفظة", "Wallet kind")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm({ ...form, kind: "TRADING" })}
                  className={`rounded-lg border p-3 text-start transition-colors ${form.kind === "TRADING" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"}`}>
                  <div className="flex items-center gap-1.5 text-sm" style={{ fontWeight: 700, color: form.kind === "TRADING" ? "#1276E3" : "inherit" }}><TrendingUp className="h-4 w-4" />{t("محفظة تداول", "Trading wallet")}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 leading-4">{t("أموالك أنت · تُسجَّل كأصل استثماري وكل حركة تقيّد", "Your own money · an investment asset, every move posts")}</div>
                </button>
                <button type="button" onClick={() => setForm({ ...form, kind: "FUNDED_PROP" })}
                  className={`rounded-lg border p-3 text-start transition-colors ${form.kind === "FUNDED_PROP" ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300" : "border-border hover:bg-muted/40"}`}>
                  <div className="flex items-center gap-1.5 text-sm" style={{ fontWeight: 700, color: form.kind === "FUNDED_PROP" ? "#7C3AED" : "inherit" }}><Landmark className="h-4 w-4" />{t("محفظة ممولة", "Funded wallet")}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 leading-4">{t("رأس المال للشركة المموّلة · يُتتبع خارج الدفاتر، ومالك فقط (الاشتراك + الأرباح) يُقيد", "Capital is the firm's · tracked off-books; only your money posts")}</div>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("الرمز", "Code")}</Label>
                <div className="flex gap-1.5">
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="TW-0001" dir="ltr" className="font-english" />
                  {isNew && (
                    <button type="button" onClick={async () => { try { const { code } = await api.investments.nextWalletCode(); setForm((f) => ({ ...f, code })); } catch { /* keep */ } }}
                      title={t("توليد تلقائي", "Auto-generate")} className="shrink-0 rounded-md border border-border px-2 text-primary hover:bg-blue-50">
                      <Sparkles className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2"><Label>{t("العملة", "Currency")}</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} dir="ltr" className="font-english" /></div>
            </div>
            <div className="space-y-2"><Label>{t("اسم المحفظة *", "Wallet name *")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.kind === "FUNDED_PROP" ? t("FTMO · 100K", "FTMO · 100K") : t("محفظة دي تريد", "DTrade wallet")} /></div>
            <div className="space-y-2"><Label>{t("الوسيط / المنصة", "Broker / platform")}</Label><Input value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} placeholder={t("دي تريد · دراية · ايزي ماركتس", "DTrade · Derayah · easyMarkets")} /></div>
            <div className="space-y-2"><Label>{t("الرصيد الافتتاحي", "Opening balance")}</Label><Input type="number" step="0.01" min="0" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("اختياري", "Optional")} /></div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {form.kind === "TRADING" ? (
            <Card className="border-primary/40 bg-primary/[0.02]">
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الربط المحاسبي", "Accounting link")}</div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-5">
                    {t("اتركه فارغاً ليُنشأ حساب استثمار تلقائياً تحت 14500 في الشجرة. الإيداعات والصفقات والرسوم تُقيد بين هذا الحساب وحساب البنك.", "Leave empty to auto-create an investment account under 14500. Deposits, trades and fees post between this and the bank account.")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("حساب المحفظة في الشجرة", "Wallet chart account")}</Label>
                  <SearchableCombobox value={form.accountId} onChange={(accountId) => setForm({ ...form, accountId })} items={assetAccounts} placeholder={t("تلقائي (145xx) · أو اختر حساباً", "Auto (145xx) · or choose an account")} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-violet-300 bg-violet-50/50">
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("بيانات التمويل", "Funding details")}</div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-5">
                    {t("رأس مال المحفظة ملك للشركة المموّلة — يظهر كمعلومة فقط ولا يدخل ميزانيتك. الذي يُقيد: الاشتراك (مصروف)، توزيعات الأرباح (إيراد)، وحصة المموّل (مصروف).", "The funded capital belongs to the firm — informational only, never on your balance sheet. Posted: subscription (expense), profit payouts (revenue), firm's share (expense).")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>{t("الشركة المموّلة", "Funding firm")}</Label><Input value={form.fundedProvider} onChange={(e) => setForm({ ...form, fundedProvider: e.target.value })} placeholder="FTMO · FundedNext" /></div>
                  <div className="space-y-2"><Label>{t("رأس المال المموّل", "Funded capital")}</Label><Input type="number" step="0.01" min="0" value={form.fundedCapital} onChange={(e) => setForm({ ...form, fundedCapital: e.target.value })} dir="ltr" className="font-english" placeholder="100000" /></div>
                  <div className="space-y-2"><Label>{t("حصتك من الأرباح %", "Your profit share %")}</Label><Input type="number" step="1" min="0" max="100" value={form.profitSplitPct} onChange={(e) => setForm({ ...form, profitSplitPct: e.target.value })} dir="ltr" className="font-english" placeholder="80" /></div>
                  <div className="space-y-2"><Label>{t("رسوم الاشتراك المدفوعة", "Subscription fee paid")}</Label><Input type="number" step="0.01" min="0" value={form.subscriptionFee} onChange={(e) => setForm({ ...form, subscriptionFee: e.target.value })} dir="ltr" className="font-english" placeholder="540" /></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/investments") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("إنشاء المحفظة", "Create wallet") : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const detailView = wallet && (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {wallet.kind === "FUNDED_PROP" ? (
          <>
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
              <div className="text-xs text-muted-foreground">{t("رأس المال المموّل (خارج الدفاتر)", "Funded capital (off-books)")}</div>
              <div className="font-english text-violet-700 mt-1" style={{ fontWeight: 700 }} dir="ltr">{money(wallet.fundedCapital)} {wallet.currency}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">{t("حصتك من الأرباح", "Your profit share")}</div>
              <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{wallet.profitSplitPct != null ? `${wallet.profitSplitPct}%` : "—"}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">{t("توزيعات مستلمة", "Payouts received")}</div>
              <div className="font-english text-emerald-600 mt-1" style={{ fontWeight: 700 }} dir="ltr">{money(report?.totals?.payouts)}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">{t("صافي النتيجة", "Net result")}</div>
              <div className={`font-english mt-1 ${Number(report?.totals?.netResult || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`} style={{ fontWeight: 700 }} dir="ltr">{money(report?.totals?.netResult)}</div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">{t("إجمالي الإيداعات", "Total deposits")}</div>
              <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{money(report?.totals?.deposits)}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">{t("السحوبات", "Withdrawals")}</div>
              <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{money(report?.totals?.withdrawals)}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">{t("الربح المحقق", "Realized P&L")}</div>
              <div className={`font-english mt-1 ${Number(report?.totals?.realizedPnl || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`} style={{ fontWeight: 700 }} dir="ltr">{money(report?.totals?.realizedPnl)}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">{t("صافي النتيجة", "Net result")}</div>
              <div className={`font-english mt-1 ${Number(report?.totals?.netResult || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`} style={{ fontWeight: 700 }} dir="ltr">{money(report?.totals?.netResult)}</div>
            </div>
          </>
        )}
      </div>

      {/* Positions */}
      {wallet.positions && wallet.positions.length > 0 && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-foreground text-base">{t("المراكز المفتوحة", "Open positions")} · {wallet.positions.length}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                <th className="py-2.5 px-4 text-start">{t("الرمز", "Symbol")}</th>
                <th className="py-2.5 px-4 text-start">{t("الكمية", "Qty")}</th>
                <th className="py-2.5 px-4 text-start">{t("متوسط التكلفة", "Avg cost")}</th>
                <th className="py-2.5 px-4 text-start">{t("إجمالي التكلفة", "Total cost")}</th>
              </tr></thead>
              <tbody>
                {wallet.positions.map((p: any) => (
                  <tr key={p.symbol} className="border-b border-border/50">
                    <td className="py-2.5 px-4 font-english" style={{ fontWeight: 700 }} dir="ltr">{p.symbol}</td>
                    <td className="py-2.5 px-4 font-english" dir="ltr">{Number(p.qty).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                    <td className="py-2.5 px-4 font-english" dir="ltr">{money(p.avgCost)}</td>
                    <td className="py-2.5 px-4 font-english" dir="ltr">{money(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-base">{t("الحركات", "Transactions")} · {wallet.transactions?.length || 0}</CardTitle>
            {wallet.status === "ACTIVE" && (
              <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => navigate(`/app/investments/${wallet.id}/transactions/new`)}>
                <Plus className="me-1.5 h-3.5 w-3.5" />{t("حركة جديدة", "New transaction")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!wallet.transactions || wallet.transactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("لا توجد حركات بعد — سجّل إيداعاً أو صفقة أو رسوم اشتراك", "No transactions yet — record a deposit, a trade, or the subscription fee")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 text-start">{t("التاريخ", "Date")}</th>
                  <th className="py-2.5 px-4 text-start">{t("النوع", "Kind")}</th>
                  <th className="py-2.5 px-4 text-start">{t("التفاصيل", "Details")}</th>
                  <th className="py-2.5 px-4 text-start">{t("المبلغ", "Amount")}</th>
                  <th className="py-2.5 px-4 text-start">{t("الربح المحقق", "Realized")}</th>
                  <th className="py-2.5 px-4 text-start">{t("القيد", "Entry")}</th>
                  <th className="py-2.5 px-4 w-[60px]"></th>
                </tr></thead>
                <tbody>
                  {wallet.transactions.map((x: any) => (
                    <tr key={x.id} className="border-b border-border/50 hover:bg-primary/5">
                      <td className="py-2.5 px-4 font-english text-xs text-muted-foreground" dir="ltr">{x.date?.slice(0, 10)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          x.kind === "DEPOSIT" || x.kind === "PROFIT_PAYOUT" || x.kind === "TRADE_SELL" ? "bg-emerald-100 text-emerald-700"
                          : x.kind === "WITHDRAWAL" || x.kind === "FEE" || x.kind === "SUBSCRIPTION" || x.kind === "PROFIT_SHARE_COST" ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"}`}>
                          {KIND_LABELS[x.kind] ? t(KIND_LABELS[x.kind].ar, KIND_LABELS[x.kind].en) : x.kind}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-foreground/80">
                        {x.symbol ? <span className="font-english" dir="ltr">{Number(x.quantity).toLocaleString()} × {x.symbol} @ {money(x.price)}</span> : (x.notes || "—")}
                      </td>
                      <td className="py-2.5 px-4 font-english" style={{ fontWeight: 600 }} dir="ltr">{money(x.amount)}</td>
                      <td className={`py-2.5 px-4 font-english text-xs ${Number(x.realizedPnl || 0) > 0 ? "text-emerald-600" : Number(x.realizedPnl || 0) < 0 ? "text-red-600" : "text-muted-foreground/50"}`} dir="ltr">
                        {x.realizedPnl != null ? money(x.realizedPnl) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {x.journalEntryId
                          ? <span className="text-emerald-700">{t("مقيّد ✓", "posted ✓")}</span>
                          : <span className="text-muted-foreground/50">{t("سجل فقط", "register")}</span>}
                      </td>
                      <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                        {pendingTxnDelete === x.id
                          ? <InlineConfirm onConfirm={() => handleDeleteTxn(x.id)} onCancel={() => setPendingTxnDelete(null)} />
                          : <button onClick={() => setPendingTxnDelete(x.id)} className="rounded-md p-1 text-red-500 hover:bg-red-50" title={t("حذف الحركة وقيدها", "Delete transaction and its entry")}><Trash2 className="h-3.5 w-3.5" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border min-w-[120px]"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={handleCloseToggle} className="border-border">
          {wallet.status === "ACTIVE" ? <><Lock className="me-2 h-4 w-4" />{t("إغلاق المحفظة", "Close wallet")}</> : <><LockOpen className="me-2 h-4 w-4" />{t("إعادة فتح", "Reopen")}</>}
        </Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700 mb-2">{t("حذف المحفظة نهائياً؟ (يُسمح فقط بلا حركات)", "Delete this wallet permanently? (allowed only with no transactions)")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/investments" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للمحافظ", "Back to Wallets")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {isNew ? t("محفظة استثمار جديدة", "New Investment Wallet") : (wallet?.name || t("المحفظة", "Wallet"))}
        </h1>
        {!isNew && wallet && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-english text-xs text-primary" dir="ltr">{wallet.code}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${wallet.kind === "FUNDED_PROP" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
              {wallet.kind === "FUNDED_PROP" ? t("محفظة ممولة", "Funded wallet") : t("محفظة تداول", "Trading wallet")}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${wallet.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {wallet.status === "ACTIVE" ? t("نشطة", "Active") : t("مغلقة", "Closed")}
            </span>
            <span className="text-xs text-muted-foreground">{wallet.broker || wallet.fundedProvider || ""} · {wallet.currency}</span>
          </div>
        )}
      </div>
      {error && !editMode && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
