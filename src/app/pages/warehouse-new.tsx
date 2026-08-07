/**
 * New Warehouse — full page (app-wide standard · no slide-overs).
 * /app/inventory/warehouses/new
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Loader2, Save, Warehouse } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function WarehouseNew() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", address: "", isPrimary: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setError(t("رمز واسم المستودع مطلوبة", "Warehouse code and name are required")); return; }
    setBusy(true); setError(null);
    try {
      await api.inventory.createWarehouse({
        code: form.code.trim(),
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        isPrimary: form.isPrimary,
      });
      push("success", t("تم إنشاء المستودع", "Warehouse created"));
      navigate("/app/warehouses");
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل إنشاء المستودع", "Failed to create warehouse"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/warehouses" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للمستودعات", "Back to Warehouses")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("مستودع جديد", "New warehouse")}</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Warehouse className="h-4 w-4" />{t("أضف مستودع أو فرع تخزين فعلي.", "Add a physical warehouse or storage branch.")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("الرمز *", "Code *")}</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} dir="ltr" className="font-english" placeholder="MAIN" /></div>
              <div className="space-y-2"><Label>{t("الاسم *", "Name *")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("المستودع الرئيسي", "Main warehouse")} /></div>
            </div>
            <div className="space-y-2"><Label>{t("العنوان", "Address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t("الرياض · حي...", "Riyadh · district...")} /></div>
            <div className="space-y-2">
              <Label>{t("النوع", "Kind")}</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({ ...form, isPrimary: false })} className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${!form.isPrimary ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}>{t("فرع تخزين", "Storage branch")}</button>
                <button type="button" onClick={() => setForm({ ...form, isPrimary: true })} className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${form.isPrimary ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}>{t("مستودع رئيسي", "Primary warehouse")}</button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate("/app/warehouses")}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{t("حفظ المستودع", "Save warehouse")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
