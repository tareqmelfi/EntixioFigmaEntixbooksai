/**
 * Bank Accounts · CRUD wired to /api/bank-accounts
 * Detail view (/app/bank-accounts/:id) shows the account's transactions
 * (vouchers linked via bankAccountId) with click-through and reconcile link.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { ArrowRight, ArrowDownToLine, ArrowUpFromLine, Plus, Search, Trash2, Wallet, Loader2, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, BankAccount, Voucher } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

function accountIdentifier(b: BankAccount) {
  const country = (b.country || "").toUpperCase();
  if (country === "US") {
    const accountSuffix = b.accountNumber ? b.accountNumber.slice(-4) : "";
    return [b.routingNumber ? `Routing ${b.routingNumber}` : null, accountSuffix ? `Acct ••••${accountSuffix}` : null].filter(Boolean).join(" · ") || "—";
  }
  return b.iban || b.accountNumber || "—";
}

export function BankAccounts() {
  const { t } = useLanguage();
  const { id: routeAccountId } = useParams();
  const [items, setItems] = useState<BankAccount[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.bankAccounts.list();
      setItems(d.items); setTotalBalance(d.totalBalance);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(b => !searchQuery ||
    b.name.includes(searchQuery) ||
    (b.bankName || "").includes(searchQuery) ||
    (b.iban || "").includes(searchQuery) ||
    (b.routingNumber || "").includes(searchQuery) ||
    (b.accountNumber || "").includes(searchQuery));
  const selectedAccount = routeAccountId ? items.find((item) => item.id === routeAccountId) : null;

  // Transactions (vouchers) linked to the selected bank account
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Voucher[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  useEffect(() => {
    if (!selectedAccount) { setTransactions([]); return; }
    let cancelled = false;
    setTxLoading(true);
    api.vouchers.list({ bankAccountId: selectedAccount.id })
      .then((d) => { if (!cancelled) setTransactions(d.items || []); })
      .catch(() => { if (!cancelled) setTransactions([]); })
      .finally(() => { if (!cancelled) setTxLoading(false); });
    return () => { cancelled = true; };
  }, [selectedAccount?.id]);

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.bankAccounts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الحسابات البنكية", "Bank accounts")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة حسابات البنوك والصناديق النقدية", "Manage bank accounts and cash accounts")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/bank-accounts/new")}><Plus className="me-2 h-4 w-4" />{t("حساب جديد", "New account")}</Button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {selectedAccount && (
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Link to="/app/bank-accounts" className="text-xs text-primary hover:underline">{t("كل الحسابات", "All accounts")}</Link>
                  <span className="text-xs text-muted-foreground/60">/</span>
                  <span className="text-xs text-muted-foreground">{selectedAccount.currency}</span>
                </div>
                <h2 className="text-lg font-semibold text-foreground">{selectedAccount.name}</h2>
                <p className="mt-1 text-sm text-foreground/70">{selectedAccount.bankName || t("حساب بنكي", "Bank account")}</p>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <div className="text-muted-foreground">{t("الدولة", "Country")}</div>
                    <div className="font-english text-foreground" dir="ltr">{selectedAccount.country || "—"}</div>
                  </div>
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <div className="text-muted-foreground">{t("التفاصيل البنكية", "Bank details")}</div>
                    <div className="font-english text-foreground" dir="ltr">{accountIdentifier(selectedAccount)}</div>
                  </div>
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <div className="text-muted-foreground">{t("الرصيد", "Balance")}</div>
                    <div className="font-english text-foreground" dir="ltr">{Number(selectedAccount.balance).toLocaleString()} {selectedAccount.currency}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/app/bank-reconciliation?bankAccountId=${selectedAccount.id}`}>
                  <Button className="bg-primary hover:bg-primary/90">
                    {t("استيراد كشف / تسوية", "Import statement / reconcile")}
                    <ArrowRight className="ms-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedAccount && (
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">{t("العمليات", "Transactions")} · {transactions.length}</CardTitle>
              <Link to={`/app/bank-reconciliation?bankAccountId=${selectedAccount.id}`} className="text-xs text-primary hover:underline">
                {t("استيراد كشف حساب لإضافة عمليات", "Import a statement to add transactions")}
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {txLoading ? (
              <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center">
                <Wallet className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
                <p className="text-sm text-muted-foreground">{t("لا توجد عمليات على هذا الحساب بعد", "No transactions on this account yet")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("استورد كشف حساب أو سجل سند قبض/صرف مربوط بهذا الحساب", "Import a statement or record a receipt/payment voucher linked to this account")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التاريخ", "Date")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("النوع", "Type")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرقم", "Number")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الطرف", "Counterparty")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المرجع / الملاحظات", "Reference / notes")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المبلغ", "Amount")}</th>
                    <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الربط", "Linked to")}</th>
                  </tr></thead>
                  <tbody>
                    {transactions.map((v) => {
                      const inbound = v.type === "RECEIPT";
                      const detailPath = inbound ? `/app/receipts/${v.id}` : `/app/payments/${v.id}`;
                      const linkedPath = v.invoiceId ? `/app/invoices/${v.invoiceId}` : v.billId ? `/app/purchases/bills/${v.billId}` : null;
                      return (
                        <tr
                          key={v.id}
                          onClick={() => navigate(detailPath)}
                          className="border-b border-border/50 hover:bg-primary/5 cursor-pointer"
                        >
                          <td className="py-3 px-4 text-sm text-muted-foreground font-english">{v.date ? new Date(v.date).toLocaleDateString("en-GB") : "—"}</td>
                          <td className="py-3 px-4 text-sm">
                            <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${inbound ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {inbound ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                              {inbound ? t("قبض", "Receipt") : t("صرف", "Payment")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm font-english text-foreground">{v.number}</td>
                          <td className="py-3 px-4 text-sm text-foreground/80">{v.contact?.displayName || "—"}</td>
                          <td className="py-3 px-4 text-xs text-muted-foreground max-w-[220px] truncate" title={v.notes || v.reference || ""}>
                            {v.reference || v.notes || "—"}
                          </td>
                          <td className={`py-3 px-4 text-sm font-english ${inbound ? "text-emerald-700" : "text-amber-700"}`} style={{ fontWeight: 600 }}>
                            {inbound ? "+" : "−"}{Number(v.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {v.currency}
                          </td>
                          <td className="py-3 px-4 text-sm" onClick={(e) => e.stopPropagation()}>
                            {linkedPath ? (
                              <Link to={linkedPath} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <Link2 className="h-3 w-3" />
                                {v.invoiceId ? t("فاتورة", "Invoice") : t("فاتورة شراء", "Bill")}
                              </Link>
                            ) : (
                              <Link to={`/app/bank-reconciliation?bankAccountId=${selectedAccount.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline">
                                <Link2 className="h-3 w-3" />
                                {t("اربط بفاتورة/مصروف", "Link to invoice/expense")}
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("إجمالي الأرصدة", "Total balance")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalBalance.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("عدد الحسابات", "Accounts")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("العملات", "Currencies")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{new Set(items.map(b => b.currency)).size}</div>
        </CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">{t("قائمة الحسابات", "Accounts list")}</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><Input placeholder={t("بحث...", "Search...")} className="w-64 ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><Wallet className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد حسابات بنكية بعد", "No bank accounts yet")}</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("البنك", "Bank")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التفاصيل البنكية", "Bank details")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرصيد", "Balance")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {filtered.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/app/bank-accounts/${b.id}`)}
                    className="border-b border-border/50 hover:bg-primary/5 cursor-pointer"
                  >
                    <td className="py-3 px-4 text-sm" style={{ fontWeight: 500 }}>
                      <Link to={`/app/bank-accounts/${b.id}`} className="text-foreground hover:text-primary hover:underline">{b.name}</Link>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground/80">{b.bankName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{accountIdentifier(b)}</td>
                    <td className="py-3 px-4 font-english text-sm text-foreground" style={{ fontWeight: 600 }}>{Number(b.balance).toLocaleString()} {b.currency}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {pendingDelete === b.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(b.id)} onCancel={() => setPendingDelete(null)} label={t("تأكيد الحذف؟", "Confirm delete?")} />
                      ) : (
                        <button onClick={() => setPendingDelete(b.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>


      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
