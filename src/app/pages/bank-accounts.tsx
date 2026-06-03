/**
 * Bank Accounts · CRUD wired to /api/bank-accounts
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowRight, Plus, Search, Trash2, Wallet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, BankAccount } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

// KSA banks · IBAN bank-code (positions 5-6) → name + SWIFT
const KSA_BANKS: Record<string, { name: string; swift: string }> = {
  "80": { name: "مصرف الراجحي · Al Rajhi", swift: "RJHISARI" },
  "10": { name: "البنك الأهلي السعودي · SNB", swift: "NCBKSAJE" },
  "05": { name: "مصرف الإنماء · Alinma Bank", swift: "INMASARI" },
  "55": { name: "البنك السعودي الفرنسي · BSF", swift: "BSFRSARI" },
  "30": { name: "البنك العربي الوطني · ANB", swift: "ARNBSARI" },
  "45": { name: "البنك السعودي البريطاني · SAB", swift: "SABBSARI" },
  "20": { name: "بنك الرياض · Riyad Bank", swift: "RIBLSARI" },
  "90": { name: "بنك البلاد · Al Bilad", swift: "ALBISARI" },
  "60": { name: "بنك الجزيرة · Al Jazira", swift: "BJAZSAJE" },
  "65": { name: "البنك السعودي للاستثمار · SAIB", swift: "SIBCSARI" },
  "70": { name: "بنك الإمارات دبي الوطني · ENBD", swift: "EBILSARI" },
  "85": { name: "بنك الخليج الدولي · GIB", swift: "GULFSARI" },
};

const US_BANK_SUGGESTIONS = [
  "Mercury / Column N.A.",
  "Column N.A.",
  "JPMorgan Chase",
  "Bank of America",
  "Wells Fargo",
  "Citibank",
  "Brex Treasury",
  "Wise US",
];

const IBAN_COUNTRIES = new Set(["SA", "AE", "KW", "QA", "BH", "OM", "JO", "GB", "DE", "FR"]);

/** Detect KSA bank from IBAN string · returns { name, swift } or null */
function detectKsaBank(iban: string): { name: string; swift: string } | null {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (!cleaned.startsWith("SA") || cleaned.length < 8) return null;
  const bankCode = cleaned.substring(4, 6);
  return KSA_BANKS[bankCode] || null;
}

function isBlankBankForm(form: ReturnType<typeof blankForm>) {
  return !form.name && !form.bankName && !form.accountNumber && !form.iban && !form.routingNumber && !form.swiftCode && form.balance === "0";
}

function currencyForCountry(country: string) {
  if (country === "SA") return "SAR";
  if (country === "US") return "USD";
  if (country === "AE") return "AED";
  if (country === "EG") return "EGP";
  if (country === "GB") return "GBP";
  if (country === "EU" || country === "DE" || country === "FR") return "EUR";
  return "USD";
}

function blankForm(country = "SA", currency = currencyForCountry(country)) {
  return {
    name: "", bankName: "", country,
    accountNumber: "", iban: "",
    swiftCode: "", routingNumber: "",
    currency, balance: "0",
  };
}

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
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(window.location.pathname.endsWith("/new") || searchParams.get("new") === "1");
  const [defaultCountry, setDefaultCountry] = useState("SA");
  const [defaultCurrency, setDefaultCurrency] = useState("SAR");
  const [form, setForm] = useState(blankForm());

  useEffect(() => {
    let cancelled = false;
    api.orgs.list().then((orgs) => {
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
      const active = (stored ? orgs.find((o) => o.id === stored) : null) || orgs[0];
      const country = active?.country || "SA";
      const currency = active?.baseCurrency || currencyForCountry(country);
      if (cancelled) return;
      setDefaultCountry(country);
      setDefaultCurrency(currency);
      setForm((prev) => isBlankBankForm(prev) ? blankForm(country, currency) : prev);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

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

  const resetForm = () => setForm(blankForm(defaultCountry, defaultCurrency || currencyForCountry(defaultCountry)));

  const openNewAccount = () => {
    resetForm();
    setOpen(true);
  };

  const handleCountryChange = (country: string) => {
    const currency = currencyForCountry(country);
    setForm((prev) => ({
      ...blankForm(country, currency),
      name: prev.name,
      balance: prev.balance,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError(t("اسم الحساب مطلوب", "Account name is required")); return; }
    const country = (form.country || "").toUpperCase();
    if (country === "US") {
      if (!/^\d{9}$/.test(form.routingNumber.trim())) {
        setError(t("رقم Routing الأمريكي يجب أن يكون 9 أرقام", "US routing number must be 9 digits"));
        return;
      }
      if (!form.accountNumber.trim()) {
        setError(t("رقم الحساب الأمريكي مطلوب", "US account number is required"));
        return;
      }
    }
    if (IBAN_COUNTRIES.has(country) && country !== "US" && !form.iban.trim()) {
      setError(t("IBAN مطلوب لهذا النوع من الحسابات", "IBAN is required for this account type"));
      return;
    }
    setBusy(true);
    try {
      const b = await api.bankAccounts.create({
        name: form.name.trim(),
        bankName: form.bankName.trim() || null,
        country: country || null,
        accountNumber: form.accountNumber || null,
        iban: form.iban || null,
        swiftCode: form.swiftCode || null,
        routingNumber: form.routingNumber || null,
        currency: form.currency,
        balance: Number(form.balance) || 0,
      });
      setItems(prev => [...prev, b]);
      setTotalBalance(prev => prev + Number(b.balance));
      setOpen(false); resetForm();
      push("success", t(`تم إنشاء حساب ${b.name}`, `Created account ${b.name}`));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    /* TODO-UX1: was confirm("هل تريد حذف الحساب البنكي؟") — replace with InlineConfirm */ 
try {
      await api.bankAccounts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الحسابات البنكية", "Bank accounts")}</h1>
          <p className="text-[#6B7280] mt-1">{t("إدارة حسابات البنوك والصناديق النقدية", "Manage bank accounts and cash accounts")}</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openNewAccount}><Plus className="me-2 h-4 w-4" />{t("حساب جديد", "New account")}</Button>
      </div>

      {error && !open && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {selectedAccount && (
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Link to="/app/bank-accounts" className="text-xs text-[#1276E3] hover:underline">{t("كل الحسابات", "All accounts")}</Link>
                  <span className="text-xs text-[#9CA3AF]">/</span>
                  <span className="text-xs text-[#6B7280]">{selectedAccount.currency}</span>
                </div>
                <h2 className="text-lg font-semibold text-[#0B1B49]">{selectedAccount.name}</h2>
                <p className="mt-1 text-sm text-[#4B5563]">{selectedAccount.bankName || t("حساب بنكي", "Bank account")}</p>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <div className="text-[#6B7280]">{t("الدولة", "Country")}</div>
                    <div className="font-english text-[#0B1B49]" dir="ltr">{selectedAccount.country || "—"}</div>
                  </div>
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <div className="text-[#6B7280]">{t("التفاصيل البنكية", "Bank details")}</div>
                    <div className="font-english text-[#0B1B49]" dir="ltr">{accountIdentifier(selectedAccount)}</div>
                  </div>
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <div className="text-[#6B7280]">{t("الرصيد", "Balance")}</div>
                    <div className="font-english text-[#0B1B49]" dir="ltr">{Number(selectedAccount.balance).toLocaleString()} {selectedAccount.currency}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/app/bank-reconciliation?bankAccountId=${selectedAccount.id}`}>
                  <Button className="bg-[#1276E3] hover:bg-[#1060C0]">
                    {t("استيراد كشف / تسوية", "Import statement / reconcile")}
                    <ArrowRight className="ms-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">{t("إجمالي الأرصدة", "Total balance")}</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalBalance.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">{t("عدد الحسابات", "Accounts")}</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">{t("العملات", "Currencies")}</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{new Set(items.map(b => b.currency)).size}</div>
        </CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">{t("قائمة الحسابات", "Accounts list")}</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder={t("بحث...", "Search...")} className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><Wallet className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">{t("لا توجد حسابات بنكية بعد", "No bank accounts yet")}</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("البنك", "Bank")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التفاصيل البنكية", "Bank details")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرصيد", "Balance")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 text-sm" style={{ fontWeight: 500 }}>
                      <Link to={`/app/bank-accounts/${b.id}`} className="text-[#0B1B49] hover:text-[#1276E3] hover:underline">{b.name}</Link>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{b.bankName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{accountIdentifier(b)}</td>
                    <td className="py-3 px-4 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(b.balance).toLocaleString()} {b.currency}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => handleDelete(b.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-[#0B1B49] text-lg font-semibold">{t("حساب بنكي جديد", "New bank account")}</h2></div>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="space-y-2"><Label className="text-[#374151]">{t("اسم الحساب *", "Account name *")}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("مثال: الحساب الجاري الرئيسي", "Example: Main operating account")} required className="border-[#E5E7EB]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">{t("الدولة *", "Country *")}</Label>
                  <select value={form.country} onChange={(e) => handleCountryChange(e.target.value)} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                    <option value="SA">{t("السعودية", "Saudi Arabia")}</option>
                    <option value="AE">{t("الإمارات", "United Arab Emirates")}</option>
                    <option value="KW">{t("الكويت", "Kuwait")}</option>
                    <option value="QA">{t("قطر", "Qatar")}</option>
                    <option value="BH">{t("البحرين", "Bahrain")}</option>
                    <option value="OM">{t("عُمان", "Oman")}</option>
                    <option value="EG">{t("مصر", "Egypt")}</option>
                    <option value="JO">{t("الأردن", "Jordan")}</option>
                    <option value="US">{t("الولايات المتحدة", "United States")}</option>
                    <option value="GB">{t("المملكة المتحدة", "United Kingdom")}</option>
                    <option value="DE">{t("ألمانيا", "Germany")}</option>
                    <option value="FR">{t("فرنسا", "France")}</option>
                  </select></div>
                <div className="space-y-2"><Label className="text-[#374151]">{t("العملة", "Currency")}</Label>
                  <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">{t("البنك", "Bank")}</Label>
                {form.country === "SA" ? (
                  <select
                    value={form.bankName}
                    onChange={(e) => {
                      const v = e.target.value;
                      // If user picks from registry · also set SWIFT
                      const match = Object.values(KSA_BANKS).find((b) => b.name === v);
                      setForm({ ...form, bankName: v, swiftCode: match ? match.swift + "XXX" : form.swiftCode });
                    }}
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white"
                  >
                    <option value="">{t("اختر بنكاً...", "Choose a bank...")}</option>
                    {Object.values(KSA_BANKS).map((b) => (<option key={b.swift} value={b.name}>{b.name}</option>))}
                    <option value="other">{t("أخرى...", "Other...")}</option>
                  </select>
                ) : (
                  <>
                    <Input
                      list={form.country === "US" ? "us-bank-suggestions" : undefined}
                      value={form.bankName}
                      onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                      placeholder={form.country === "US" ? "Mercury / Column N.A." : "Bank name"}
                      className="border-[#E5E7EB]"
                    />
                    {form.country === "US" && (
                      <datalist id="us-bank-suggestions">
                        {US_BANK_SUGGESTIONS.map((name) => <option key={name} value={name} />)}
                      </datalist>
                    )}
                  </>
                )}
              </div>

              {form.country === "US" && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-[#0B1B49]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t("صيغة الحسابات الأمريكية", "US bank account format")}</div>
                      <p className="mt-1 text-[#4B5563]">
                        {t("استخدم Routing Number + Account Number. Mercury غالباً يظهر كبنك Mercury / Column N.A.", "Use Routing Number + Account Number. Mercury commonly appears as Mercury / Column N.A.")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 shrink-0 border-blue-200 bg-white px-2 text-xs"
                      onClick={() => setForm({
                        ...form,
                        name: form.name || "Mercury Checking ••5302",
                        bankName: "Mercury / Column N.A.",
                        country: "US",
                        currency: "USD",
                        routingNumber: form.routingNumber || "121145433",
                      })}
                    >
                      Mercury
                    </Button>
                  </div>
                </div>
              )}

              {/* KSA + Gulf · IBAN-based */}
              {(form.country === "SA" || form.country === "AE" || form.country === "KW" || form.country === "QA" || form.country === "BH" || form.country === "OM" || form.country === "JO") && (
                <>
                  <div className="space-y-2"><Label className="text-[#374151]">IBAN *</Label>
                    <Input value={form.iban} onChange={(e) => {
                      const cleaned = e.target.value.replace(/\s/g, "").toUpperCase();
                      const next: any = { ...form, iban: cleaned };
                      // Auto-detect KSA bank from IBAN positions 5-6
                      if (form.country === "SA" && cleaned.length >= 8) {
                        const detected = detectKsaBank(cleaned);
                        if (detected) {
                          next.bankName = detected.name;
                          next.swiftCode = detected.swift + "XXX";
                        }
                      }
                      setForm(next);
                    }}
                      placeholder={form.country === "SA" ? "SA00 0000 0000 0000 0000 0000" : "Country IBAN"} maxLength={34} dir="ltr" className="border-[#E5E7EB] font-english" />
                    {form.country === "SA" && form.iban.length >= 8 && (() => {
                      const d = detectKsaBank(form.iban);
                      return d ? <p className="text-[10px] text-green-700 mt-1">{t("تم التعرّف", "Detected")}: {d.name}</p> : <p className="text-[10px] text-amber-600 mt-1">{t("لم يتم التعرّف · أدخل البنك يدوياً", "Not detected. Enter the bank manually.")}</p>;
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label className="text-[#374151]">{t("رمز SWIFT/BIC", "SWIFT/BIC code")}</Label>
                      <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="RJHISARIXXX" maxLength={11} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                    <div className="space-y-2"><Label className="text-[#374151]">{t("رقم الحساب (اختياري)", "Account number (optional)")}</Label>
                      <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                  </div>
                </>
              )}

              {/* US · Routing + Account Number */}
              {form.country === "US" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label className="text-[#374151]">Routing Number * <span className="text-[#9CA3AF] text-xs">(ABA)</span></Label>
                      <Input value={form.routingNumber} onChange={(e) => setForm({ ...form, routingNumber: e.target.value.replace(/\D/g, "") })} placeholder="123456789" maxLength={9} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                    <div className="space-y-2"><Label className="text-[#374151]">Account Number *</Label>
                      <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[#374151]">SWIFT/BIC <span className="text-[#9CA3AF] text-xs">{t("(للتحويلات الدولية)", "(international wires)")}</span></Label>
                    <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="CHASUS33" maxLength={11} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                </>
              )}

              {/* UK / EU · IBAN + SWIFT */}
              {(form.country === "GB" || form.country === "DE" || form.country === "FR") && (
                <>
                  <div className="space-y-2"><Label className="text-[#374151]">IBAN *</Label>
                    <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.replace(/\s/g, "").toUpperCase() })} placeholder="GB00 NWBK 0000 0000 0000 00" maxLength={34} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                  <div className="space-y-2"><Label className="text-[#374151]">SWIFT/BIC *</Label>
                    <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="NWBKGB2L" maxLength={11} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                </>
              )}

              {/* Egypt · Account number only */}
              {form.country === "EG" && (
                <div className="space-y-2"><Label className="text-[#374151]">{t("رقم الحساب *", "Account number *")}</Label>
                  <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              )}

              <div className="space-y-2"><Label className="text-[#374151]">{t("الرصيد الافتتاحي", "Opening balance")}</Label>
                <Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#E5E7EB]">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">{t("إلغاء", "Cancel")}</Button>
              <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? t("جارٍ الحفظ...", "Saving...") : t("حفظ", "Save")}</Button>
            </div>
          </form>
        </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
