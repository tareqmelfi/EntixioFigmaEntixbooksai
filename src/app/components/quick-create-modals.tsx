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

function PopoverShell({ title, subtitle, onClose, onSubmit, busy, error, children, submitLabel = "حفظ" }: PopoverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onSubmit, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0B1B49]/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      {/* Centered card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#F3F4F6]">
          <div className="min-w-0">
            <h2 className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 700 }}>{title}</h2>
            {subtitle && <p className="text-[#6B7280] text-xs mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {children}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#F3F4F6] bg-[#F9FAFB] rounded-b-2xl">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="border-[#E5E7EB]">إلغاء</Button>
          <Button type="button" onClick={onSubmit} disabled={busy} className="bg-[#1276E3] hover:bg-[#0B5FBF] min-w-[100px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── QuickCreateAccount ──────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: "ASSET", label: "أصول · Asset" },
  { value: "LIABILITY", label: "خصوم · Liability" },
  { value: "EQUITY", label: "حقوق ملكية · Equity" },
  { value: "INCOME", label: "إيرادات · Income" },
  { value: "EXPENSE", label: "مصروفات · Expense" },
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
    if (!name.trim()) { setError("اسم الحساب مطلوب"); return; }
    if (!type) { setError("اختر فئة الحساب"); return; }
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
      setError(e?.message || "فشل الإنشاء");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PopoverShell
      title="حساب جديد"
      subtitle="أنشئه الآن واستخدمه فوراً · يمكنك تعديل التفاصيل لاحقاً من شجرة الحسابات"
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      error={error}
    >
      <div className="space-y-2">
        <Label className="text-[#374151] text-xs">اسم الحساب *</Label>
        <Input
          ref={nameInputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: مصروفات مستشفى · إيرادات استشارات"
          className="border-[#E5E7EB]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[#374151] text-xs">الفئة *</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
          >
            {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-[#374151] text-xs">الكود (اختياري)</Label>
          <Input
            id="qa-code"
            value={code}
            onChange={(e) => setCode(normalizeDigits(e.target.value))}
            placeholder="تلقائي"
            dir="ltr"
            className="border-[#E5E7EB] font-english h-9"
          />
        </div>
      </div>
    </PopoverShell>
  );
}

// ─── QuickCreateProduct ──────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: "SERVICE", label: "خدمة" },
  { value: "GOODS", label: "بضاعة" },
  { value: "DIGITAL", label: "منتج رقمي" },
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
    if (!name.trim()) { setError("اسم المنتج مطلوب"); return; }
    const price = Number(normalizeDigits(unitPrice));
    if (isNaN(price) || price < 0) { setError("السعر غير صحيح"); return; }
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
      setError(e?.message || "فشل الإنشاء");
    } finally {
      setBusy(false);
    }
  };

  const incomeAccounts = accounts.filter((a) => a.type === "INCOME");

  return (
    <PopoverShell
      title="منتج / خدمة جديدة"
      subtitle="عبئ المعلومات الأساسية · ستُحفظ في الكتالوج لاستخدامها في أي فاتورة"
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      error={error}
    >
      <div className="space-y-2">
        <Label className="text-[#374151] text-xs">اسم المنتج *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: استشارة تقنية · تطوير تطبيق"
          className="border-[#E5E7EB]"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-[#374151] text-xs">النوع</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
          >
            {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-2 col-span-2">
          <Label className="text-[#374151] text-xs">SKU / باركود (اختياري)</Label>
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="تلقائي"
            dir="ltr"
            className="border-[#E5E7EB] font-english h-9"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[#374151] text-xs">السعر *</Label>
          <Input
            id="qp-price"
            type="text"
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => setUnitPrice(normalizeDigits(e.target.value))}
            placeholder="0.00"
            dir="ltr"
            className="border-[#E5E7EB] font-english h-9"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[#374151] text-xs">نسبة الضريبة</Label>
          <select
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
          >
            <option value="0.15">15% (قياسية)</option>
            <option value="0">0% (صفر)</option>
            <option value="-1">معفى</option>
          </select>
        </div>
      </div>
      {incomeAccounts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-[#374151] text-xs">حساب الإيراد (اختياري)</Label>
          <select
            value={incomeAccountId}
            onChange={(e) => setIncomeAccountId(e.target.value)}
            className="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
          >
            <option value="">— اختر حساب —</option>
            {incomeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </select>
        </div>
      )}
    </PopoverShell>
  );
}
