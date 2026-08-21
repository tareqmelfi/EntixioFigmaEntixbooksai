/**
 * QuickContactDialog · UX-93
 *
 * Inline mini-form that pops up when the user types a name in a contact picker
 * and clicks "+ إضافة جهة جديدة". Captures the essentials (name · type · email ·
 * phone · VAT) without leaving the parent form. Routes to /app/contacts/:id
 * link in the toast so the user can complete the full profile later.
 *
 * Usage:
 *   const [pending, setPending] = useState<string | null>(null);
 *   ...
 *   onCreate={(name) => setPending(name)}
 *   ...
 *   {pending && (
 *     <QuickContactDialog
 *       initialName={pending}
 *       defaultRole="customer"
 *       onCancel={() => setPending(null)}
 *       onCreated={(c) => { setPending(null); setForm({ ...form, contactId: c.id }); }}
 *     />
 *   )}
 */
import { useState } from "react";
import { Loader2, X, Building2, User } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { api, ApiError, Contact } from "../lib/api";
import { formatTaxId, formatCrNumber } from "../lib/tax-id-format";
import { useLanguage } from "./LanguageContext";

type Role = "customer" | "supplier" | "both";

export function QuickContactDialog({
  initialName, defaultRole = "customer",
  onCancel, onCreated,
}: {
  initialName: string;
  defaultRole?: Role;
  onCancel: () => void;
  onCreated: (c: Contact) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: initialName,
    entityKind: "COMPANY" as "INDIVIDUAL" | "COMPANY",
    role: defaultRole as Role,
    email: "", phone: "",
    vatNumber: "", crNumber: "",
    country: "SA",
  });

  const handleSave = async () => {
    if (!form.displayName.trim()) { setError(t("الاسم مطلوب", "Name is required")); return; }
    setBusy(true); setError(null);
    try {
      const c = await api.contacts.create({
        displayName: form.displayName.trim(),
        entityKind: form.entityKind,
        type: form.role === "both" ? "BOTH" : form.role === "supplier" ? "SUPPLIER" : "CUSTOMER",
        isCustomer: form.role === "customer" || form.role === "both",
        isSupplier: form.role === "supplier" || form.role === "both",
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        vatNumber: form.vatNumber.trim() || null,
        crNumber: form.crNumber.trim() || null,
        country: form.country,
        isForeign: form.country !== "SA",
      });
      onCreated(c);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>{t("إضافة جهة جديدة", "Add new contact")}</h2>
          <button onClick={onCancel} className="p-1 hover:bg-muted/50 rounded"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-2 gap-2">
            {(["INDIVIDUAL", "COMPANY"] as const).map(k => {
              const Icon = k === "INDIVIDUAL" ? User : Building2;
              const active = form.entityKind === k;
              return (
                <button key={k} type="button" onClick={() => setForm({ ...form, entityKind: k })}
                  className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${active ? "border-primary bg-primary/5" : "border-border"}`}>
                  <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground/60"}`} />
                  <span className="text-sm">{k === "INDIVIDUAL" ? t("فرد", "Individual") : t("منظمة", "Organization")}</span>
                </button>
              );
            })}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">{t("الاسم *", "Name *")}</Label>
            <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={t("شركة الأمل التجارية", "Acme Trading Co.")} className="border-border" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">{t("النوع", "Type")}</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["customer", "supplier", "both"] as Role[]).map(r => (
                <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                  className={`text-xs px-2 py-1.5 rounded border transition ${form.role === r ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>
                  {r === "customer" ? t("عميل", "Customer") : r === "supplier" ? t("مورّد", "Supplier") : t("كلاهما", "Both")}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">{t("البريد", "Email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@x.com" dir="ltr" className="border-border font-english" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("الجوال", "Phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966 5X XXX XXXX" dir="ltr" className="border-border font-english" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">{t("الدولة", "Country")}</Label>
            <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
              <option value="SA">{t("السعودية", "Saudi Arabia")}</option>
              <option value="AE">{t("الإمارات", "UAE")}</option>
              <option value="KW">{t("الكويت", "Kuwait")}</option>
              <option value="EG">{t("مصر", "Egypt")}</option>
              <option value="US">{t("الولايات المتحدة", "United States")}</option>
              <option value="GB">{t("المملكة المتحدة", "United Kingdom")}</option>
            </select>
          </div>

          {form.country === "SA" && form.entityKind === "COMPANY" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t("الرقم الضريبي", "VAT number")}</Label>
                <Input
                  value={form.vatNumber}
                  onChange={(e) => setForm({ ...form, vatNumber: formatTaxId(e.target.value, form.country) })}
                  onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text"); setForm({ ...form, vatNumber: formatTaxId(t, form.country) }); }}
                  placeholder="300XXX" maxLength={20} dir="ltr" className="border-border font-english"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("السجل التجاري", "Commercial registration")}</Label>
                <Input
                  value={form.crNumber}
                  onChange={(e) => setForm({ ...form, crNumber: formatCrNumber(e.target.value, form.country) })}
                  onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text"); setForm({ ...form, crNumber: formatCrNumber(t, form.country) }); }}
                  placeholder="1010XX" maxLength={10} dir="ltr" className="border-border font-english"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground/60 pt-1">{t("يمكن إكمال باقي البيانات (العنوان · LEI · ضريبة الاستقطاع) من صفحة جهات الاتصال", "You can complete the remaining details (address · LEI · withholding tax) from the Contacts page")}</p>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border/50">
          <Button type="button" variant="outline" onClick={onCancel} className="border-border">{t("إلغاء", "Cancel")}</Button>
          <Button type="button" onClick={handleSave} disabled={busy} className="bg-primary hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حفظ", "Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
