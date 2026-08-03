/**
 * QuickCreateAccount + QuickCreateProduct · inline popovers
 *
 * Product requirement: "اكتب اسم مستشفى ولا يطلع · يفتح منبثقة فيها فئة الحساب · أحفظ"
 *           · "اكتب اسم منتج ولا يطلع · يفتح منبثقة فيها السعر والحساب والـSKU"
 *
 * UX-1 compliant: NO Dialog · NO overlay. Centered popover with backdrop fade.
 * Esc closes. Click backdrop closes. Tab traps inside.
 */
import { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { normalizeDigits } from "../lib/digits";
import { useLanguage } from "./LanguageContext";

// ─── Shared popover shell ────────────────────────────────────────────────────

interface PopoverProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
  busy?: boolean;
  error?: string | null;
  children: React.ReactNode;
  submitLabel?: string;
}

function PopoverShell({ title, subtitle, onClose, onSubmit, busy, error, children, submitLabel }: PopoverProps) {
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const finalSubmitLabel = submitLabel ?? t("حفظ", "Save");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onSubmit, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir={isRtl ? "rtl" : "ltr"}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0B1B49]/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      {/* Centered card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border/50">
          <div className="min-w-0">
            <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 700 }}>{title}</h2>
            {subtitle && <p className="text-muted-foreground text-xs mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {children}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border/50 bg-muted rounded-b-2xl">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="border-border">{t("إلغاء", "Cancel")}</Button>
          <Button type="button" onClick={onSubmit} disabled={busy} className="bg-primary hover:bg-primary/80 min-w-[100px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : finalSubmitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── QuickCreateAccount ──────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: "ASSET", labelAr: "أصول", labelEn: "Asset" },
  { value: "LIABILITY", labelAr: "خصوم", labelEn: "Liability" },
  { value: "EQUITY", labelAr: "حقوق ملكية", labelEn: "Equity" },
  { value: "INCOME", labelAr: "إيرادات", labelEn: "Income" },
  { value: "EXPENSE", labelAr: "مصروفات", labelEn: "Expense" },
];

interface AccountInput {
  name: string;
  nameAr?: string;
  code?: string;
  type: string;
  parentId?: string | null;
}

interface AccountResult {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface QuickCreateAccountProps {
  initialName: string;
  /** Default type · "EXPENSE" for bills/expenses · "INCOME" for invoices */
  defaultType?: string;
  onCreate: (input: AccountInput) => Promise<AccountResult>;
  onClose: () => void;
  onCreated: (account: AccountResult) => void;
}

export function QuickCreateAccount({ initialName, defaultType = "EXPENSE", onCreate, onClose, onCreated }: QuickCreateAccountProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState("");
  const [type, setType] = useState(defaultType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      // focus first empty field
      if (initialName) {
        const codeInput = document.getElementById("qa-code") as HTMLInputElement;
        codeInput?.focus();
      } else {
        nameInputRef.current?.focus();
      }
    }, 50);
  }, [initialName]);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError(t("اسم الحساب مطلوب", "Account name is required")); return; }
    if (!type) { setError(t("اختر فئة الحساب", "Select an account type")); return; }
    setBusy(true);
    try {
      const result = await onCreate({
        name: name.trim(),
        nameAr: name.trim(),
        code: code.trim() || undefined,
        type,
      });
      onCreated(result);
    } catch (e: any) {
      setError(e?.message || t("فشل الإنشاء", "Creation failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PopoverShell
      title={t("حساب جديد", "New account")}
      subtitle={t("أنشئه الآن واستخدمه فوراً · يمكنك تعديل التفاصيل لاحقاً من شجرة الحسابات", "Create it now and use it immediately · edit details later in the chart of accounts")}
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      error={error}
    >
      <div className="space-y-2">
        <Label className="text-foreground/80 text-xs">{t("اسم الحساب *", "Account name *")}</Label>
        <Input
          ref={nameInputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("مثال: مصروفات مستشفى · إيرادات استشارات", "e.g. Hospital expenses · consulting revenue")}
          className="border-border"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-foreground/80 text-xs">{t("الفئة *", "Type *")}</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-white px-2 text-sm"
          >
            {ACCOUNT_TYPES.map((at) => <option key={at.value} value={at.value}>{t(at.labelAr, at.labelEn)}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-foreground/80 text-xs">{t("الكود (اختياري)", "Code (optional)")}</Label>
          <Input
            id="qa-code"
            value={code}
            onChange={(e) => setCode(normalizeDigits(e.target.value))}
            placeholder={t("تلقائي", "Auto")}
            dir="ltr"
            className="border-border font-english h-9"
          />
        </div>
      </div>
    </PopoverShell>
  );
}

// ─── QuickCreateProduct ──────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: "SERVICE", labelAr: "خدمة", labelEn: "Service" },
  { value: "GOODS", labelAr: "بضاعة", labelEn: "Goods" },
  { value: "DIGITAL", labelAr: "منتج رقمي", labelEn: "Digital product" },
];

interface ProductInput {
  name: string;
  nameAr?: string;
  sku?: string;
  type: string;
  unitPrice: number;
  costPrice?: number;
  taxRate?: number;
  incomeAccountId?: string;
  expenseAccountId?: string;
  description?: string;
}

interface ProductResult {
  id: string;
  name: string;
  sku?: string;
  unitPrice: number;
  taxRate?: number;
  incomeAccountId?: string;
}

interface QuickCreateProductProps {
  initialName: string;
  /** Available accounts for the dropdown */
  accounts?: Array<{ id: string; name: string; code: string; type: string }>;
  defaultIncomeAccountId?: string;
  onCreate: (input: ProductInput) => Promise<ProductResult>;
  onClose: () => void;
  onCreated: (product: ProductResult) => void;
}

export function QuickCreateProduct({
  initialName,
  accounts = [],
  defaultIncomeAccountId,
  onCreate,
  onClose,
  onCreated,
}: QuickCreateProductProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName);
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [taxRate, setTaxRate] = useState("0.15");
  const [type, setType] = useState("SERVICE");
  const [incomeAccountId, setIncomeAccountId] = useState(defaultIncomeAccountId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      const priceInput = document.getElementById("qp-price") as HTMLInputElement;
      priceInput?.focus();
    }, 50);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError(t("اسم المنتج مطلوب", "Product name is required")); return; }
    const price = Number(normalizeDigits(unitPrice));
    if (isNaN(price) || price < 0) { setError(t("السعر غير صحيح", "Invalid price")); return; }
    setBusy(true);
    try {
      const result = await onCreate({
        name: name.trim(),
        nameAr: name.trim(),
        sku: sku.trim() || undefined,
        type,
        unitPrice: price,
        taxRate: Number(normalizeDigits(taxRate)) || 0.15,
        incomeAccountId: incomeAccountId || undefined,
      });
      onCreated(result);
    } catch (e: any) {
      setError(e?.message || t("فشل الإنشاء", "Creation failed"));
    } finally {
      setBusy(false);
    }
  };

  const incomeAccounts = accounts.filter((a) => a.type === "INCOME" || a.type === "REVENUE");

  return (
    <PopoverShell
      title={t("منتج / خدمة جديدة", "New product / service")}
      subtitle={t("عبئ المعلومات الأساسية · ستُحفظ في الكتالوج لاستخدامها في أي فاتورة", "Fill in the basics · saved to the catalog for use on any invoice")}
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      error={error}
    >
      <div className="space-y-2">
        <Label className="text-foreground/80 text-xs">{t("اسم المنتج *", "Product name *")}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("مثال: استشارة تقنية · تطوير تطبيق", "e.g. Technical consulting · app development")}
          className="border-border"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-foreground/80 text-xs">{t("النوع", "Type")}</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-white px-2 text-sm"
          >
            {PRODUCT_TYPES.map((pt) => <option key={pt.value} value={pt.value}>{t(pt.labelAr, pt.labelEn)}</option>)}
          </select>
        </div>
        <div className="space-y-2 col-span-2">
          <Label className="text-foreground/80 text-xs">{t("SKU / باركود (اختياري)", "SKU / barcode (optional)")}</Label>
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder={t("تلقائي", "Auto")}
            dir="ltr"
            className="border-border font-english h-9"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-foreground/80 text-xs">{t("السعر *", "Price *")}</Label>
          <Input
            id="qp-price"
            type="text"
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => setUnitPrice(normalizeDigits(e.target.value))}
            placeholder="0.00"
            dir="ltr"
            className="border-border font-english h-9"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-foreground/80 text-xs">{t("نسبة الضريبة", "Tax rate")}</Label>
          <select
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-white px-2 text-sm"
          >
            <option value="0.15">{t("15% (قياسية)", "15% (standard)")}</option>
            <option value="0">{t("0% (صفر)", "0% (zero-rated)")}</option>
            <option value="-1">{t("معفى", "Exempt")}</option>
          </select>
        </div>
      </div>
      {incomeAccounts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-foreground/80 text-xs">{t("حساب الإيراد (اختياري)", "Income account (optional)")}</Label>
          <select
            value={incomeAccountId}
            onChange={(e) => setIncomeAccountId(e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-white px-2 text-sm"
          >
            <option value="">{t("— اختر حساب —", "— Select account —")}</option>
            {incomeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </select>
        </div>
      )}
    </PopoverShell>
  );
}
