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
    if (!form.displayName.trim()) { setError("الاسم مطلوب"); return; }
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
      setError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#F3F4F6]">
          <h2 className="text-base text-[#0B1B49]" style={{ fontWeight: 700 }}>إضافة جهة جديدة</h2>
          <button onClick={onCancel} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-4 w-4 text-[#6B7280]" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-2 gap-2">
            {(["INDIVIDUAL", "COMPANY"] as const).map(k => {
              const Icon = k === "INDIVIDUAL" ? User : Building2;
              const active = form.entityKind === k;
              return (
                <button key={k} type="button" onClick={() => setForm({ ...form, entityKind: k })}
                  className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${active ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB]"}`}>
                  <Icon className={`h-4 w-4 ${active ? "text-[#1276E3]" : "text-[#9CA3AF]"}`} />
                  <span className="text-sm">{k === "INDIVIDUAL" ? "فرد" : "منظمة"}</span>
                </button>
              );
            })}
          </div>

          <div>
            <Label className="text-xs text-[#6B7280]">الاسم *</Label>
            <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="شركة الأمل التجارية" className="border-[#E5E7EB]" />
          </div>

          <div>
            <Label className="text-xs text-[#6B7280]">النوع</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["customer", "supplier", "both"] as Role[]).map(r => (
                <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                  className={`text-xs px-2 py-1.5 rounded border transition ${form.role === r ? "border-[#1276E3] bg-[#F4FCFF] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280]"}`}>
                  {r === "customer" ? "عميل" : r === "supplier" ? "مورّد" : "كلاهما"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-[#6B7280]">البريد</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@x.com" dir="ltr" className="border-[#E5E7EB] font-english" />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280]">الجوال</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966 5X XXX XXXX" dir="ltr" className="border-[#E5E7EB] font-english" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-[#6B7280]">الدولة</Label>
            <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
              <option value="SA">السعودية</option>
              <option value="AE">الإمارات</option>
              <option value="KW">الكويت</option>
              <option value="EG">مصر</option>
              <option value="US">الولايات المتحدة</option>
              <option value="GB">المملكة المتحدة</option>
            </select>
          </div>

          {form.country === "SA" && form.entityKind === "COMPANY" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#6B7280]">الرقم الضريبي</Label>
                <Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} placeholder="300XXX" maxLength={15} dir="ltr" className="border-[#E5E7EB] font-english" />
              </div>
              <div>
                <Label className="text-xs text-[#6B7280]">السجل التجاري</Label>
                <Input value={form.crNumber} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} placeholder="1010XX" dir="ltr" className="border-[#E5E7EB] font-english" />
              </div>
            </div>
          )}

          <p className="text-xs text-[#9CA3AF] pt-1">يمكن إكمال باقي البيانات (العنوان · LEI · ضريبة الاستقطاع) من صفحة جهات الاتصال</p>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#F3F4F6]">
          <Button type="button" variant="outline" onClick={onCancel} className="border-[#E5E7EB]">إلغاء</Button>
          <Button onClick={handleSave} disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
          </Button>
        </div>
      </div>
    </div>
  );
}
