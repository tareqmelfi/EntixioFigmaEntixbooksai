/**
 * Contact wizard · UNIFIED PARTY MODEL · shared 4-step create/edit modal
 *
 * Extracted from contacts.tsx so the SAME wizard can open in-place anywhere
 * (contacts list · contact-detail "تعديل العميل" · future call sites) instead
 * of navigating the user away to /app/contacts?edit=<id>.
 *
 *   1. النوع    · individual / organization
 *   2. البيانات · displayName, email, phone, tax IDs (KSA or foreign)
 *   3. الأدوار  · multi-select: customer · supplier · employee · shareholder · freelancer
 *   4. التفاصيل · address, website, notes · live preview
 */
import { useEffect, useRef, useState } from "react";
import {
  Users, Loader2, X, ChevronRight, ChevronLeft, Building2, User,
  AlertCircle, Briefcase, Landmark, UserCheck, Upload, Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ToastStack, useToasts } from "./side-panel";
import { api, ApiError, Contact, ContactInput } from "../lib/api";
import { formatTaxId, formatCrNumber } from "../lib/tax-id-format";
import { AddressAutocomplete } from "./address-autocomplete";
import { useLanguage } from "./LanguageContext";

// ── Roles ────────────────────────────────────────────────────────────────────
export type RoleKey = "isCustomer" | "isSupplier" | "isEmployee" | "isShareholder" | "isFreelancer";

export const ROLES: Array<{ key: RoleKey; label: string; icon: any; bg: string; text: string }> = [
  { key: "isCustomer",    label: "عميل",       icon: Users,      bg: "bg-blue-100",   text: "text-blue-700" },
  { key: "isSupplier",    label: "مورد",       icon: Building2,  bg: "bg-green-100",  text: "text-green-700" },
  { key: "isEmployee",    label: "موظف",       icon: Briefcase,  bg: "bg-purple-100", text: "text-purple-700" },
  { key: "isShareholder", label: "مساهم",      icon: Landmark,   bg: "bg-pink-100",   text: "text-pink-700" },
  { key: "isFreelancer",  label: "فري لانسر",  icon: UserCheck,  bg: "bg-cyan-100",   text: "text-cyan-700" },
];

// English counterparts for ROLES labels (rendered via t(role.label, ROLE_LABEL_EN[role.key]))
const ROLE_LABEL_EN: Record<RoleKey, string> = {
  isCustomer: "Customer",
  isSupplier: "Supplier",
  isEmployee: "Employee",
  isShareholder: "Shareholder",
  isFreelancer: "Freelancer",
};

const COUNTRY_OPTIONS = [
  { code: "SA", label: { ar: "السعودية", en: "Saudi Arabia" }, currency: "SAR" },
  { code: "AE", label: { ar: "الإمارات", en: "United Arab Emirates" }, currency: "AED" },
  { code: "KW", label: { ar: "الكويت", en: "Kuwait" }, currency: "KWD" },
  { code: "QA", label: { ar: "قطر", en: "Qatar" }, currency: "QAR" },
  { code: "BH", label: { ar: "البحرين", en: "Bahrain" }, currency: "BHD" },
  { code: "OM", label: { ar: "عُمان", en: "Oman" }, currency: "OMR" },
  { code: "EG", label: { ar: "مصر", en: "Egypt" }, currency: "EGP" },
  { code: "JO", label: { ar: "الأردن", en: "Jordan" }, currency: "JOD" },
  { code: "US", label: { ar: "الولايات المتحدة", en: "United States" }, currency: "USD" },
  { code: "GB", label: { ar: "المملكة المتحدة", en: "United Kingdom" }, currency: "GBP" },
  { code: "DE", label: { ar: "ألمانيا", en: "Germany" }, currency: "EUR" },
  { code: "FR", label: { ar: "فرنسا", en: "France" }, currency: "EUR" },
];


// ── State helpers ────────────────────────────────────────────────────────────
export type FormState = {
  entityKind: "INDIVIDUAL" | "COMPANY";
  customCode: string;
  shortCode: string;
  displayName: string;
  legalName: string;
  email: string;
  phone: string;
  vatNumber: string;
  crNumber: string;
  nationalId: string;
  leiCode: string;
  isForeign: boolean;
  withholdingTaxRate: string;
  defaultCurrency: string;
  country: string;
  city: string;
  region: string;
  addressLine1: string;
  postalCode: string;
  notes: string;
  // role flags
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  isShareholder: boolean;
  isFreelancer: boolean;
};

export const emptyForm: FormState = {
  entityKind: "COMPANY",
  customCode: "", shortCode: "",
  displayName: "", legalName: "", email: "", phone: "",
  vatNumber: "", crNumber: "", nationalId: "", leiCode: "",
  isForeign: false, withholdingTaxRate: "", defaultCurrency: "SAR",
  country: "SA", city: "", region: "", addressLine1: "", postalCode: "",
  notes: "",
  isCustomer: true, isSupplier: false, isEmployee: false, isShareholder: false, isFreelancer: false,
};

export function contactToForm(c: Contact): FormState {
  return {
    entityKind: c.entityKind || "COMPANY",
    customCode: c.customCode || "",
    shortCode: c.shortCode || "",
    displayName: c.displayName || "",
    legalName: c.legalName || "",
    email: c.email || "",
    phone: c.phone || "",
    vatNumber: c.vatNumber || "",
    crNumber: c.crNumber || "",
    nationalId: c.nationalId || "",
    leiCode: c.leiCode || "",
    isForeign: !!c.isForeign,
    withholdingTaxRate: c.withholdingTaxRate != null ? String(c.withholdingTaxRate) : "",
    defaultCurrency: c.defaultCurrency || "SAR",
    country: c.country || "SA",
    city: c.city || "",
    region: c.region || "",
    addressLine1: c.addressLine1 || "",
    postalCode: c.postalCode || "",
    notes: c.notes || "",
    isCustomer: !!c.isCustomer || c.type === "CUSTOMER" || c.type === "BOTH",
    isSupplier: !!c.isSupplier || c.type === "SUPPLIER" || c.type === "BOTH",
    isEmployee: !!c.isEmployee,
    isShareholder: !!c.isShareholder,
    isFreelancer: !!c.isFreelancer,
  };
}

export function formToInput(form: FormState): ContactInput {
  return {
    entityKind: form.entityKind,
    customCode: form.customCode.trim() || null,
    shortCode: form.shortCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || null,
    displayName: form.displayName.trim(),
    legalName: form.legalName.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    vatNumber: form.vatNumber.trim() || null,
    crNumber: form.crNumber.trim() || null,
    nationalId: form.nationalId.trim() || null,
    leiCode: form.leiCode.trim() || null,
    isForeign: form.isForeign,
    withholdingTaxRate: form.withholdingTaxRate ? Number(form.withholdingTaxRate) : null,
    defaultCurrency: form.defaultCurrency || null,
    country: form.country,
    city: form.city.trim() || null,
    region: form.region.trim() || null,
    addressLine1: form.addressLine1.trim() || null,
    postalCode: form.postalCode.trim() || null,
    notes: form.notes.trim() || null,
    isCustomer: form.isCustomer,
    isSupplier: form.isSupplier,
    isEmployee: form.isEmployee,
    isShareholder: form.isShareholder,
    isFreelancer: form.isFreelancer,
  };
}

function WizardModal(props: {
  step: 1 | 2 | 3 | 4;
  isEditing: boolean;
  form: FormState;
  setForm: (f: FormState) => void;
  canProceed: boolean;
  busy: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
  onAutoFill?: (file: File) => Promise<void>;
}) {
  const { step, isEditing, form, setForm, canProceed, busy, onClose, onPrev, onNext, onSave, onAutoFill } = props;
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="text-lg text-foreground" style={{ fontWeight: 700 }}>{isEditing ? t("تعديل جهة اتصال", "Edit contact") : t("إضافة جهة اتصال", "Add contact")}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted/50 rounded"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center font-english font-semibold ${step === s ? "bg-primary text-white" : step > s ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground/60"}`}>{s}</div>
                <span className={step === s ? "text-foreground font-semibold" : "text-muted-foreground/60"}>
                  {s === 1 ? t("النوع", "Type") : s === 2 ? t("البيانات", "Details") : s === 3 ? t("الأدوار", "Roles") : t("التفاصيل", "More info")}
                </span>
                {s < 4 && <div className="flex-1 h-px bg-[#E5E7EB]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {step === 1 && <Step1 form={form} setForm={setForm} onAutoFill={onAutoFill} />}
          {step === 2 && <Step2 form={form} setForm={setForm} />}
          {step === 3 && <Step3 form={form} setForm={setForm} />}
          {step === 4 && <Step4 form={form} setForm={setForm} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border/50">
          <Button type="button" variant="outline" onClick={step === 1 ? onClose : onPrev} className="border-border">
            {step === 1 ? t("إلغاء", "Cancel") : <><ChevronRight className="h-4 w-4 me-1" /> {t("السابق", "Previous")}</>}
          </Button>
          {step < 4 ? (
            <Button onClick={onNext} disabled={!canProceed} className="bg-primary hover:bg-primary/90">
              {t("التالي", "Next")} <ChevronLeft className="h-4 w-4 ms-1" />
            </Button>
          ) : (
            <Button onClick={onSave} disabled={busy || !canProceed} className="bg-primary hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditing ? t("حفظ التعديلات", "Save changes") : t("حفظ جهة الاتصال", "Save contact"))}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1({ form, setForm, onAutoFill }: { form: FormState; setForm: (f: FormState) => void; onAutoFill?: (file: File) => Promise<void> }) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!onAutoFill) return;
    setAiBusy(true);
    try { await onAutoFill(file); } finally { setAiBusy(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/80">{t("هل هي منظمة أم فرد؟", "Is it an organization or an individual?")}</p>
      <div className="grid grid-cols-2 gap-3">
        {(["INDIVIDUAL", "COMPANY"] as const).map(k => {
          const Icon = k === "INDIVIDUAL" ? User : Building2;
          const active = form.entityKind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setForm({ ...form, entityKind: k })}
              className={`p-6 rounded-xl border-2 transition flex flex-col items-center gap-3 ${active ? "border-[#1276E3] bg-primary/5" : "border-border hover:border-[#1276E3]/40"}`}
            >
              <Icon className={`h-10 w-10 ${active ? "text-primary" : "text-muted-foreground/60"}`} />
              <div>
                <div className="font-semibold text-foreground">{k === "INDIVIDUAL" ? t("فرد", "Individual") : t("منظمة", "Organization")}</div>
                <div className="text-xs text-muted-foreground/60 mt-0.5">{k === "INDIVIDUAL" ? t("شخص طبيعي", "Natural person") : t("شركة أو مؤسسة", "Company or establishment")}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* AI · upload registration / EIN letter / passport → auto-fill */}
      <div className="rounded-xl border-2 border-dashed border-[#1276E3]/30 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t("تعبئة تلقائية بالذكاء", "AI auto-fill")}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("ارفع جواز/هوية للفرد أو سجل تجاري · رسالة EIN · شهادة الزكاة للمنشآت، والذكاء يقرأها ويعبّي البيانات", "Upload a passport/ID for individuals or a commercial registration · EIN letter · Zakat certificate for organizations, and AI will read and fill the data")}</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          <Button type="button" variant="outline" disabled={aiBusy} onClick={() => fileRef.current?.click()} className="border-[#1276E3] text-primary">
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 me-1.5" /> {t("رفع مستند", "Upload document")}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step2({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const { t } = useLanguage();
  const isKsa = form.country === "SA";
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground/80">{form.entityKind === "COMPANY" ? t("بيانات المنظمة", "Organization details") : t("بيانات الفرد", "Individual details")}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">{t("الاسم *", "Name *")}</Label>
          <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={form.entityKind === "COMPANY" ? t("مثال: شركة التقنية المتقدمة", "e.g. Advanced Tech Co.") : t("مثال: أحمد محمد", "e.g. Ahmed Mohammed")} className="border-border" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("الاسم بالإنجليزية", "Name in English")}</Label>
          <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="e.g. Advanced Tech Co." dir="ltr" className="border-border font-english" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("رمز العميل/الجهة", "Customer/contact code")}</Label>
          <Input
            value={form.customCode}
            onChange={(e) => setForm({ ...form, customCode: e.target.value.toUpperCase() })}
            placeholder="EN-CLI-SNBL"
            dir="ltr"
            className="border-border font-english"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("رمز مختصر للفواتير", "Short code for invoices")}</Label>
          <Input
            value={form.shortCode}
            onChange={(e) => setForm({ ...form, shortCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) })}
            placeholder="SNBL"
            maxLength={4}
            dir="ltr"
            className="border-border font-english"
          />
          <p className="mt-1 text-xs text-muted-foreground/60">{t("حتى 4 أحرف، مثال: SNBL لإصدار أرقام مثل EN-SNBL-INV.", "Up to 4 characters, e.g. SNBL to issue numbers like EN-SNBL-INV.")}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("البريد الإلكتروني", "Email")}</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" dir="ltr" className="border-border font-english" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("رقم الهاتف", "Phone number")}</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966 5X XXX XXXX" dir="ltr" className="border-border font-english" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("الدولة", "Country")}</Label>
          <select value={form.country} onChange={(e) => {
            const c = COUNTRY_OPTIONS.find(o => o.code === e.target.value);
            setForm({ ...form, country: e.target.value, defaultCurrency: c?.currency || "SAR", isForeign: e.target.value !== "SA" });
          }} className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
            {COUNTRY_OPTIONS.map(o => <option key={o.code} value={o.code}>{t(o.label.ar, o.label.en)}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("العملة الافتراضية", "Default currency")}</Label>
          <Input value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })} maxLength={3} dir="ltr" className="border-border font-english" />
        </div>
        {isKsa && form.entityKind === "COMPANY" && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">{t("الرقم الضريبي", "Tax ID")}</Label>
              <Input
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: formatTaxId(e.target.value, form.country) })}
                onPaste={(e) => { e.preventDefault(); const txt = e.clipboardData.getData("text"); setForm({ ...form, vatNumber: formatTaxId(txt, form.country) }); }}
                placeholder="300 XXX XXX XXX X 003" maxLength={20} dir="ltr" className="border-border font-english"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("السجل التجاري", "Commercial registration")}</Label>
              <Input
                value={form.crNumber}
                onChange={(e) => setForm({ ...form, crNumber: formatCrNumber(e.target.value, form.country) })}
                onPaste={(e) => { e.preventDefault(); const txt = e.clipboardData.getData("text"); setForm({ ...form, crNumber: formatCrNumber(txt, form.country) }); }}
                placeholder="1010XXXXXX" maxLength={10} dir="ltr" className="border-border font-english"
              />
            </div>
          </>
        )}
        {isKsa && form.entityKind === "INDIVIDUAL" && (
          <div className="col-span-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">{t("رقم الهوية الوطنية / الإقامة", "National ID / Iqama number")}</Label>
            <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="10XXXXXXXX" maxLength={10} dir="ltr" className="border-border font-english" />
          </div>
        )}
        {!isKsa && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">Tax ID (EIN / VAT / TRN)</Label>
              <Input
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: formatTaxId(e.target.value, form.country) })}
                onPaste={(e) => { e.preventDefault(); const txt = e.clipboardData.getData("text"); setForm({ ...form, vatNumber: formatTaxId(txt, form.country) }); }}
                placeholder={form.country === "US" ? "XX-XXXXXXX" : "Tax ID"} maxLength={20} dir="ltr" className="border-border font-english"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("LEI Code (اختياري)", "LEI Code (optional)")}</Label>
              <Input value={form.leiCode} onChange={(e) => setForm({ ...form, leiCode: e.target.value })} placeholder="20 chars" maxLength={20} dir="ltr" className="border-border font-english" />
            </div>
            <div className="col-span-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground">{t("نسبة ضريبة الاستقطاع (%)", "Withholding tax rate (%)")}</Label>
              <Input type="number" min="0" max="100" step="0.5" value={form.withholdingTaxRate} onChange={(e) => setForm({ ...form, withholdingTaxRate: e.target.value })} placeholder="5" dir="ltr" className="border-border font-english" />
              <p className="text-xs text-muted-foreground/60 mt-1">{t("سيتم حجز هذه النسبة تلقائياً عند فاتورة الشراء", "This percentage will be withheld automatically on purchase bills")}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Step3({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground/80">{t("اختر الأدوار", "Select roles")} <span className="text-muted-foreground/60">{t("(يمكن اختيار أكثر من دور)", "(you can select more than one role)")}</span></p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {ROLES.map(r => {
          const active = form[r.key];
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setForm({ ...form, [r.key]: !active } as any)}
              className={`p-3 rounded-lg border-2 transition flex items-center justify-between ${active ? "border-[#1276E3] bg-primary/5" : "border-border hover:border-[#1276E3]/40"}`}
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                <span className={`p-1.5 rounded ${r.bg} ${r.text}`}><Icon className="h-3.5 w-3.5" /></span>
                {t(r.label, ROLE_LABEL_EN[r.key])}
              </span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? "border-[#1276E3] bg-primary" : "border-border"}`}>
                {active && <span className="text-white text-xs">✓</span>}
              </span>
            </button>
          );
        })}
      </div>
      {!(form.isCustomer || form.isSupplier || form.isEmployee || form.isShareholder || form.isFreelancer) && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5" /> {t("اختر دوراً واحداً على الأقل", "Select at least one role")}
        </div>
      )}
    </div>
  );
}

function Step4({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/80">{t("تفاصيل إضافية", "Additional details")}</p>
      <div>
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">{t("العنوان", "Address")} <span className="text-[10px] text-primary">{t("✨ ابدأ الكتابة لاقتراحات تلقائية", "✨ Start typing for automatic suggestions")}</span></Label>
        <AddressAutocomplete
          value={form.addressLine1}
          country={form.country}
          onChange={(v) => setForm({ ...form, addressLine1: v })}
          onPick={(p) => setForm({
            ...form,
            addressLine1: p.line1 || form.addressLine1,
            city: p.city || form.city,
            region: p.region || form.region,
            postalCode: p.postalCode || form.postalCode,
            country: p.country || form.country,
          })}
          placeholder={t("مثال: 30 N Gould St Sheridan WY · أو الرياض حي العليا", "e.g. 30 N Gould St Sheridan WY · or Riyadh, Olaya district")}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">{t("المدينة", "City")}</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={t("الرياض", "Riyadh")} className="border-border" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("المنطقة", "Region")}</Label>
          <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder={t("منطقة الرياض", "Riyadh region")} className="border-border" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("الرمز البريدي", "Postal code")}</Label>
          <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="12345" dir="ltr" className="border-border font-english" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">{t("ملاحظات", "Notes")}</Label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("أي ملاحظات إضافية...", "Any additional notes...")} rows={3} className="w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-border bg-[#FAFBFC] p-4">
        <div className="text-xs text-muted-foreground/60 mb-2">{t("معاينة", "Preview")}</div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
            {(form.displayName || t("؟", "?")).slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-foreground font-semibold truncate">{form.displayName || "—"}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {ROLES.filter(r => form[r.key]).map(r => (
                <span key={r.key} className={`text-xs px-1.5 py-0.5 rounded ${r.bg} ${r.text}`}>{t(r.label, ROLE_LABEL_EN[r.key])}</span>
              ))}
            </div>
          </div>
          {form.isForeign && <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700">{t("خارجي", "Foreign")}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Self-contained wizard (state + save + autofill + toasts) ─────────────────
export function ContactWizard({ open, editing, onClose }: {
  open: boolean;
  editing: Contact | null; // null → create mode
  onClose: (saved?: Contact) => void;
}) {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm(editing ? contactToForm(editing) : emptyForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  if (!open) return null;

  const canProceed =
    step === 1 ? true :
    step === 2 ? form.displayName.trim().length > 0 :
    step === 3 ? (form.isCustomer || form.isSupplier || form.isEmployee || form.isShareholder || form.isFreelancer) :
    true;

  const handleSave = async () => {
    setBusy(true);
    try {
      const payload = formToInput(form);
      if (editing) {
        const updated = await api.contacts.update(editing.id, payload);
        push("success", t("تم تحديث جهة الاتصال", "Contact updated"));
        onClose(updated);
      } else {
        const created = await api.contacts.create(payload);
        push("success", `${t("تم إنشاء", "Created")} ${created.displayName}`);
        onClose(created);
      }
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحفظ", "Failed to save"));
    } finally { setBusy(false); }
  };

  const onAutoFill = async (file: File) => {
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => {
          const s = r.result as string;
          const i = s.indexOf("base64,");
          res(i >= 0 ? s.slice(i + 7) : s);
        };
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const data = await api.contacts.extractFromDocument({
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
      const hasExtractedIdentity = Boolean(
        data.displayName || data.legalName || data.email || data.phone || data.vatNumber
        || data.crNumber || data.nationalId,
      );
      setForm(prev => ({
        ...prev,
        displayName: data.displayName || prev.displayName,
        legalName: data.legalName || prev.legalName,
        entityKind: prev.entityKind,
        country: data.country || prev.country,
        vatNumber: data.vatNumber ? formatTaxId(data.vatNumber, data.country || prev.country) : prev.vatNumber,
        crNumber: data.crNumber ? formatCrNumber(data.crNumber, data.country || prev.country) : prev.crNumber,
        nationalId: data.nationalId || prev.nationalId,
        addressLine1: data.addressLine1 || prev.addressLine1,
        city: data.city || prev.city,
        region: data.region || prev.region,
        postalCode: data.postalCode || prev.postalCode,
        phone: data.phone || prev.phone,
        email: data.email || prev.email,
        isCustomer: data.isCustomer ?? prev.isCustomer,
        isSupplier: data.isSupplier ?? prev.isSupplier,
        isForeign: (data.country || prev.country) !== "SA",
      }));
      if (hasExtractedIdentity) {
        push("success", `✨ ${data.notes || t("تم استخراج البيانات", "Data extracted")} (${t("ثقة", "confidence")} ${(data.confidence * 100).toFixed(0)}%)`);
        setStep(2);
      } else {
        push("info", t("لم أجد بيانات كافية في المستند. بقيت في خطوة النوع حتى تراجع الاختيار أو تدخل البيانات يدوياً.", "Not enough data found in the document. Staying on the Type step so you can review the selection or enter data manually."));
      }
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل قراءة المستند", "Failed to read the document"));
    }
  };

  return (
    <>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <WizardModal
        step={step}
        isEditing={!!editing}
        form={form}
        setForm={setForm}
        canProceed={canProceed}
        busy={busy}
        onClose={() => onClose()}
        onPrev={() => setStep(s => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}
        onNext={() => setStep(s => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
        onSave={handleSave}
        onAutoFill={onAutoFill}
      />
    </>
  );
}
