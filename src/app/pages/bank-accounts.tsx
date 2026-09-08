import { displayLocale } from "../lib/number-display";
/**
 * Bank Accounts · CRUD wired to /api/bank-accounts
 * Detail view (/app/bank-accounts/:id) shows the account's transactions
 * (vouchers linked via bankAccountId) with click-through and reconcile link.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { ArrowRight, ArrowDownToLine, ArrowUpFromLine, Plus, Trash2, Wallet, Loader2, Link2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { EmptyState, InlineAlert, LedgerFigure, Metric, MetricStrip, PageHeader, SearchField, SectionHeader, StatusBadge } from "../components/product";
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
      <PageHeader
        eyebrow={t("البنوك والنقد", "Banks & cash")}
        title={t("الحسابات البنكية", "Bank accounts")}
        description={t("إدارة حسابات البنوك والصناديق النقدية", "Manage bank accounts and cash accounts")}
        actions={<Button onClick={() => navigate("/app/bank-accounts/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("حساب جديد", "New account")}</Button>}
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      {selectedAccount && (
        <Card className="border-s-[3px] border-s-primary">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <Link to="/app/bank-accounts" className="text-xs text-primary hover:underline">{t("كل الحسابات", "All accounts")}</Link>
                  <span className="text-xs text-muted-foreground/60">/</span>
                  <span className="font-english text-xs text-muted-foreground">{selectedAccount.currency}</span>
                </div>
                <h2 className="truncate text-section font-semibold text-foreground" title={selectedAccount.name}><bdi dir="auto">{selectedAccount.name}</bdi></h2>
                <p className="mt-1 truncate text-sm text-foreground/70"><bdi dir="auto">{selectedAccount.bankName || t("حساب بنكي", "Bank account")}</bdi></p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <div className="min-w-0 rounded-lg border border-border bg-surface-subtle px-3 py-2">
                    <div className="text-muted-foreground">{t("الدولة", "Country")}</div>
                    <div className="truncate font-english text-foreground" dir="ltr">{selectedAccount.country || "—"}</div>
                  </div>
                  <div className="min-w-0 rounded-lg border border-border bg-surface-subtle px-3 py-2">
                    <div className="text-muted-foreground">{t("التفاصيل البنكية", "Bank details")}</div>
                    <div className="truncate font-code text-foreground" dir="ltr" title={accountIdentifier(selectedAccount)}>{accountIdentifier(selectedAccount)}</div>
                  </div>
                  <div className="min-w-0 rounded-lg border border-border bg-surface-subtle px-3 py-2">
                    <div className="text-muted-foreground">{t("الرصيد", "Balance")}</div>
                    <div className="truncate font-display text-base tabular-nums text-foreground" dir="ltr">{Number(selectedAccount.balance).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small className="text-xs text-content-secondary">{selectedAccount.currency}</small></div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={`/app/bank-reconciliation?bankAccountId=${selectedAccount.id}`}>
                    {t("استيراد كشف / تسوية", "Import statement / reconcile")}
                    <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" strokeWidth={1.75} />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedAccount && (
        <section className="space-y-3">
          <SectionHeader
            title={<>{t("العمليات", "Transactions")} · <span className="font-english tabular-nums">{transactions.length}</span></>}
            actions={(
              <Link to={`/app/bank-reconciliation?bankAccountId=${selectedAccount.id}`} className="text-xs text-primary hover:underline">
                {t("استيراد كشف حساب لإضافة عمليات", "Import a statement to add transactions")}
              </Link>
            )}
          />
          {txLoading ? (
            <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-10 w-10" strokeWidth={1.5} />}
              title={t("لا توجد عمليات على هذا الحساب بعد", "No transactions on this account yet")}
              description={t("استورد كشف حساب أو سجل سند قبض/صرف مربوط بهذا الحساب", "Import a statement or record a receipt/payment voucher linked to this account")}
            />
          ) : (
            <div className="ledger-table overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "200px" }} />{/* الرقم · mono */}
                  <col />{/* الطرف · flexible */}
                  <col style={{ width: "200px" }} />
                  <col style={{ width: "170px" }} />
                  <col style={{ width: "150px" }} />
                </colgroup>
                <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
                  <th className="py-3 px-4 text-start font-medium">{t("التاريخ", "Date")}</th>
                  <th className="py-3 px-4 text-start font-medium">{t("النوع", "Type")}</th>
                  <th className="py-3 px-4 text-start font-medium">{t("الرقم", "Number")}</th>
                  <th className="py-3 px-4 text-start font-medium">{t("الطرف", "Counterparty")}</th>
                  <th className="py-3 px-4 text-start font-medium">{t("المرجع / الملاحظات", "Reference / notes")}</th>
                  <th className="py-3 px-4 text-end font-medium">{t("المبلغ", "Amount")}</th>
                  <th className="py-3 px-4 text-start font-medium">{t("الربط", "Linked to")}</th>
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
                        className="border-b border-border hover:bg-surface-hover cursor-pointer"
                        title={t("فتح السند", "Open voucher")}
                      >
                        <td className="py-3 px-4 text-start"><span dir="ltr" className="font-english whitespace-nowrap text-sm text-muted-foreground tabular-nums">{v.date ? new Date(v.date).toLocaleDateString(displayLocale("en-GB")) : "—"}</span></td>
                        <td className="py-3 px-4 text-sm">
                          <StatusBadge tone={inbound ? "success" : "warning"} icon={inbound ? <ArrowDownToLine className="h-3 w-3" strokeWidth={1.75} /> : <ArrowUpFromLine className="h-3 w-3" strokeWidth={1.75} />}>
                            {inbound ? t("قبض", "Receipt") : t("صرف", "Payment")}
                          </StatusBadge>
                        </td>
                        <td className="py-3 px-4 text-start">
                          <Link to={detailPath} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-code text-sm font-semibold text-foreground hover:underline underline-offset-4" dir="ltr" title={v.number}>{v.number}</Link>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground/80 truncate" title={v.contact?.displayName || ""}><bdi dir="auto">{v.contact?.displayName || "—"}</bdi></td>
                        <td className="py-3 px-4 text-xs text-muted-foreground truncate" title={v.notes || v.reference || ""}>
                          <bdi dir="auto">{v.reference || v.notes || "—"}</bdi>
                        </td>
                        <td className={`py-3 px-4 text-end font-english tabular-nums whitespace-nowrap text-sm ${inbound ? "text-success" : "text-warning"}`} style={{ fontWeight: 600 }} dir="ltr">
                          {inbound ? "+" : "−"}{Number(v.amount).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {v.currency}
                        </td>
                        <td className="py-3 px-4 text-sm" onClick={(e) => e.stopPropagation()}>
                          {linkedPath ? (
                            <Link to={linkedPath} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <Link2 className="h-3 w-3" />
                              {v.invoiceId ? t("فاتورة", "Invoice") : t("فاتورة شراء", "Bill")}
                            </Link>
                          ) : (
                            <Link to={`/app/bank-reconciliation?bankAccountId=${selectedAccount.id}`} className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary hover:underline">
                              <Link2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{t("اربط بفاتورة/مصروف", "Link to invoice/expense")}</span>
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
        </section>
      )}

      <MetricStrip className="xl:grid-cols-3">
        <Metric label={t("إجمالي الأرصدة", "Total balance")} value={<LedgerFigure value={totalBalance} />} />
        <Metric label={t("عدد الحسابات", "Accounts")} value={String(items.length)} />
        <Metric label={t("العملات", "Currencies")} value={String(new Set(items.map(b => b.currency)).size)} />
      </MetricStrip>

      <section className="space-y-3">
        <SectionHeader
          title={t("قائمة الحسابات", "Accounts list")}
          actions={<SearchField aria-label={t("بحث", "Search")} placeholder={t("بحث...", "Search...")} containerClassName="w-64 max-w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />}
        />
        {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-10 w-10" strokeWidth={1.5} />}
            title={t("لا توجد حسابات بنكية بعد", "No bank accounts yet")}
            action={<Button onClick={() => navigate("/app/bank-accounts/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("حساب جديد", "New account")}</Button>}
          />
        ) : (
          <div className="ledger-table overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-sm">
              <colgroup>
                <col />{/* الاسم · flexible */}
                <col style={{ width: "220px" }} />
                <col style={{ width: "260px" }} />{/* IBAN · 24-34 chars mono */}
                <col style={{ width: "180px" }} />
                <col style={{ width: "120px" }} />
              </colgroup>
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
                <th className="py-3 px-4 text-start font-medium">{t("الاسم", "Name")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("البنك", "Bank")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("التفاصيل البنكية", "Bank details")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("الرصيد", "Balance")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {filtered.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/app/bank-accounts/${b.id}`)}
                    className="border-b border-border hover:bg-surface-hover cursor-pointer"
                    title={t("فتح الحساب", "Open account")}
                  >
                    <td className="py-3 px-4 text-sm" style={{ fontWeight: 500 }}>
                      <Link to={`/app/bank-accounts/${b.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate text-foreground hover:underline underline-offset-4" title={b.name}><bdi dir="auto">{b.name}</bdi></Link>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground/80 truncate" title={b.bankName || ""}><bdi dir="auto">{b.bankName || "—"}</bdi></td>
                    <td className="py-3 px-4 text-start"><span dir="ltr" className="block max-w-full truncate font-code text-xs text-muted-foreground tabular-nums" title={accountIdentifier(b)}>{accountIdentifier(b)}</span></td>
                    <td className="py-3 px-4 text-end"><span dir="ltr" className="font-english text-sm text-foreground inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums" style={{ fontWeight: 600 }}><span>{Number(b.balance).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span className="text-[10px] text-muted-foreground/60">{b.currency}</span></span></td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {pendingDelete === b.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(b.id)} onCancel={() => setPendingDelete(null)} label={t("تأكيد الحذف؟", "Confirm delete?")} />
                      ) : (
                        <button onClick={() => setPendingDelete(b.id)} className="rounded-md p-1.5 text-danger hover:bg-danger-subtle" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
