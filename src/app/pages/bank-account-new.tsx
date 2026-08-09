/**
 * New Bank Account — full page (app-wide standard · no slide-overs).
 * /app/bank-accounts/new
 *
 * Country is a segmented button grid (enums are never dropdowns).
 * KSA banks use a SearchableCombobox (entity picker) with free-text fallback.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Loader2, Save, Wallet } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { useOrgRegion } from "../lib/use-org-region";

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

const IBAN_COUNTRIES = new Set(["SA", "AE", "KW", "QA", "BH", "OM", "JO", "GB", "DE", "FR"]);
const GULF_IBAN = new Set(["SA", "AE", "KW", "QA", "BH", "OM", "JO"]);

const COUNTRIES: Array<{ code: string; ar: string; en: string }> = [
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "AE", ar: "الإمارات", en: "UAE" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
  { code: "OM", ar: "عُمان", en: "Oman" },
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "US", ar: "أمريكا", en: "United States" },
  { code: "GB", ar: "بريطانيا", en: "United Kingdom" },
  { code: "DE", ar: "ألمانيا", en: "Germany" },
  { code: "FR", ar: "فرنسا", en: "France" },
];

function detectKsaBank(iban: string): { name: string; swift: string } | null {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (!cleaned.startsWith("SA") || cleaned.length < 8) return null;
  return KSA_BANKS[cleaned.substring(4, 6)] || null;
}

function currencyForCountry(country: string) {
  if (country === "SA") return "SAR";
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

export function BankAccountNew() {
  const { t, language } = useLanguage();
  const region = useOrgRegion();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState(blankForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // W30 · default country from the active org's ACTUAL country (useOrgRegion is
  // the same module-cached resolver the whole app uses — the old local fetch
  // raced/fell back to the first org, so a US company got Saudi+IBAN defaults).
  useEffect(() => {
    if (region.loading) return;
    const country = region.country || "SA";
    setForm((prev) => {
      const untouched = !prev.name && !prev.bankName && !prev.iban && !prev.accountNumber && !prev.routingNumber;
      return untouched ? blankForm(country, currencyForCountry(country)) : prev;
    });
  }, [region.loading, region.country]);

  // Registry banks + the current free-typed value (so a non-registry bank still displays)
  const ksaBankItems = [
    ...Object.values(KSA_BANKS).map((b) => ({ id: b.name, label: b.name })),
    ...(form.bankName && !Object.values(KSA_BANKS).some((b) => b.name === form.bankName)
      ? [{ id: form.bankName, label: form.bankName }]
      : []),
  ];

  const handleCountryChange = (country: string) => {
    const currency = currencyForCountry(country);
    setForm((prev) => ({ ...blankForm(country, currency), name: prev.name, balance: prev.balance }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError(t("اسم الحساب مطلوب", "Account name is required")); return; }
    const country = (form.country || "").toUpperCase();
    if (country === "US") {
      if (!/^\d{9}$/.test(form.routingNumber.trim())) { setError(t("رقم Routing الأمريكي يجب أن يكون 9 أرقام", "US routing number must be 9 digits")); return; }
      if (!form.accountNumber.trim()) { setError(t("رقم الحساب الأمريكي مطلوب", "US account number is required")); return; }
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
      push("success", t(`تم إنشاء حساب ${b.name}`, `Created account ${b.name}`));
      navigate(`/app/bank-accounts/${b.id}`);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const countryLabel = (code: string) => {
    const c = COUNTRIES.find((x) => x.code === code);
    return c ? (language === "ar" ? c.ar : c.en) : code;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/bank-accounts" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للحسابات البنكية", "Back to Bank accounts")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("حساب بنكي جديد", "New bank account")}</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Wallet className="h-4 w-4" /> {t("حساب بنك أو صندوق نقدية · العملة تُشتق من الدولة ويمكن تعديلها", "Bank or cash account · currency derives from country and stays editable")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الأساسيات", "Basics")}</div>
            <div className="space-y-2"><Label className="text-foreground/80">{t("اسم الحساب *", "Account name *")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("مثال: الحساب الجاري الرئيسي", "Example: Main operating account")} required className="border-border" /></div>

            <div className="space-y-2">
              <Label className="text-foreground/80">{t("الدولة *", "Country *")}</Label>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code} type="button"
                    onClick={() => handleCountryChange(c.code)}
                    className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${form.country === c.code ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}
                  >
                    <span className="font-english text-xs me-1" dir="ltr">{c.code}</span>
                    {language === "ar" ? c.ar : c.en}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label className="text-foreground/80">{t("العملة", "Currency")}</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} dir="ltr" className="border-border font-english" /></div>
              <div className="space-y-2"><Label className="text-foreground/80">{t("الرصيد الافتتاحي", "Opening balance")}</Label>
                <Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} dir="ltr" className="border-border font-english" /></div>
            </div>

            <div className="space-y-2"><Label className="text-foreground/80">{t("البنك", "Bank")}</Label>
              {form.country === "SA" ? (
                <>
                  <SearchableCombobox
                    value={form.bankName}
                    onChange={(v) => {
                      const match = Object.values(KSA_BANKS).find((b) => b.name === v);
                      setForm({ ...form, bankName: v, swiftCode: match ? match.swift + "XXX" : form.swiftCode });
                    }}
                    onCreate={async (q) => q}
                    createLabel={(q) => t(`استخدام "${q}"`, `Use "${q}"`)}
                    items={ksaBankItems}
                    placeholder={t("ابحث عن البنك أو اكتبه...", "Search or type the bank...")}
                  />
                  <p className="text-[10px] text-muted-foreground">{t("بنك غير مدرج؟ اكتب اسمه في الحقل نفسه", "Bank not listed? Type its name in the same field")}</p>
                </>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder={form.country === "US" ? "Mercury / Column N.A." : t("اسم البنك", "Bank name")}
                    className="border-border flex-1"
                  />
                  {form.country === "US" && (
                    <Button
                      type="button" variant="outline"
                      className="shrink-0 border-blue-200 text-xs"
                      onClick={() => setForm({
                        ...form,
                        name: form.name || "Mercury Checking ••5302",
                        bankName: "Mercury / Column N.A.",
                        routingNumber: form.routingNumber || "121145433",
                      })}
                    >Mercury</Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>
              {form.country === "US" ? t("التفاصيل الأمريكية (ACH)", "US details (ACH)") :
               form.country === "EG" ? t("تفاصيل الحساب", "Account details") :
               (form.country === "GB" || form.country === "DE" || form.country === "FR") ? t("تفاصيل IBAN الأوروبية", "European IBAN details") :
               t("تفاصيل IBAN", "IBAN details")}
            <span className="text-xs text-muted-foreground font-normal ms-2">{countryLabel(form.country)}</span>
            </div>

            {GULF_IBAN.has(form.country) && (
              <>
                <div className="space-y-2"><Label className="text-foreground/80">IBAN *</Label>
                  <Input value={form.iban} onChange={(e) => {
                    const cleaned = e.target.value.replace(/\s/g, "").toUpperCase();
                    const next: any = { ...form, iban: cleaned };
                    if (form.country === "SA" && cleaned.length >= 8) {
                      const detected = detectKsaBank(cleaned);
                      if (detected) { next.bankName = detected.name; next.swiftCode = detected.swift + "XXX"; }
                    }
                    setForm(next);
                  }}
                    placeholder={form.country === "SA" ? "SA00 0000 0000 0000 0000 0000" : "Country IBAN"} maxLength={34} dir="ltr" className="border-border font-english" />
                  {form.country === "SA" && form.iban.length >= 8 && (() => {
                    const d = detectKsaBank(form.iban);
                    return d ? <p className="text-[10px] text-green-700 mt-1">{t("تم التعرّف", "Detected")}: {d.name}</p> : <p className="text-[10px] text-amber-600 mt-1">{t("لم يتم التعرّف · أدخل البنك يدوياً", "Not detected. Enter the bank manually.")}</p>;
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-foreground/80">{t("رمز SWIFT/BIC", "SWIFT/BIC code")}</Label>
                    <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="RJHISARIXXX" maxLength={11} dir="ltr" className="border-border font-english" /></div>
                  <div className="space-y-2"><Label className="text-foreground/80">{t("رقم الحساب (اختياري)", "Account number (optional)")}</Label>
                    <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-border font-english" /></div>
                </div>
              </>
            )}

            {form.country === "US" && (
              <>
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-foreground">
                  <div className="font-semibold">{t("صيغة الحسابات الأمريكية", "US bank account format")}</div>
                  <p className="mt-1 text-foreground/70">{t("استخدم Routing Number + Account Number — لا يوجد IBAN في أمريكا.", "Use Routing Number + Account Number — US banks have no IBAN.")}</p>
                </div>
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  🔗 {t("الربط التلقائي بالبنك عبر Plaid يُفعّل من صفحة التكاملات — الحساب اليدوي يعمل الآن، والمزامنة التلقائية عند اكتمال الربط.", "Automatic bank connection via Plaid is enabled from the Integrations page — manual accounts work now, auto-sync once connected.")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-foreground/80">Routing Number * <span className="text-muted-foreground/60 text-xs">(ABA)</span></Label>
                    <Input value={form.routingNumber} onChange={(e) => setForm({ ...form, routingNumber: e.target.value.replace(/\D/g, "") })} placeholder="123456789" maxLength={9} dir="ltr" className="border-border font-english" /></div>
                  <div className="space-y-2"><Label className="text-foreground/80">Account Number *</Label>
                    <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-border font-english" /></div>
                </div>
                <div className="space-y-2"><Label className="text-foreground/80">SWIFT/BIC <span className="text-muted-foreground/60 text-xs">{t("(للتحويلات الدولية)", "(international wires)")}</span></Label>
                  <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="CHASUS33" maxLength={11} dir="ltr" className="border-border font-english" /></div>
              </>
            )}

            {(form.country === "GB" || form.country === "DE" || form.country === "FR") && (
              <>
                <div className="space-y-2"><Label className="text-foreground/80">IBAN *</Label>
                  <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.replace(/\s/g, "").toUpperCase() })} placeholder="GB00 NWBK 0000 0000 0000 00" maxLength={34} dir="ltr" className="border-border font-english" /></div>
                <div className="space-y-2"><Label className="text-foreground/80">SWIFT/BIC *</Label>
                  <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="NWBKGB2L" maxLength={11} dir="ltr" className="border-border font-english" /></div>
              </>
            )}

            {form.country === "EG" && (
              <div className="space-y-2"><Label className="text-foreground/80">{t("رقم الحساب *", "Account number *")}</Label>
                <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-border font-english" /></div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate("/app/bank-accounts")}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{t("حفظ الحساب", "Save account")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
