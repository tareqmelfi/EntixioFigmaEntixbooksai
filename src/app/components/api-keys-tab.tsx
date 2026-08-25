/**
 * Settings → API keys · programmatic access for agents & integrations.
 *
 * UX-1 compliant: no dialogs · create form is inline · the raw key is shown
 * ONCE inside a copy box right after creation (never again) · revoke uses
 * <InlineConfirm> (3-4s auto-cancel) · errors/success go to bottom-right toasts.
 */
import { useCallback, useEffect, useState } from "react";
import { Key, Plus, Copy, Check, Trash2, Loader2, ShieldAlert, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { InlineConfirm } from "./side-panel";
import { api, ApiError, type ApiKeyItem, type ApiKeyScope } from "../lib/api";
import { useLanguage } from "./LanguageContext";

const SCOPE_META: Record<ApiKeyScope, { ar: string; en: string; hintAr: string; hintEn: string }> = {
  read: { ar: "قراءة", en: "Read", hintAr: "الحسابات · مراكز التكلفة · المنتجات", hintEn: "Accounts · cost centers · products" },
  "write:accounts": { ar: "كتابة: دليل الحسابات", en: "Write: chart of accounts", hintAr: "استيراد/تحديث الحسابات دفعةً واحدة", hintEn: "Bulk import/update accounts" },
  "write:cost_centers": { ar: "كتابة: مراكز التكلفة", en: "Write: cost centers", hintAr: "استيراد/تحديث مراكز التكلفة", hintEn: "Bulk import/update cost centers" },
  "write:products": { ar: "كتابة: المنتجات والخدمات", en: "Write: products & services", hintAr: "استيراد/تحديث المنتجات مع ربطها بحسابات الإيراد", hintEn: "Bulk import/update products linked to revenue accounts" },
};

const EXPIRY_OPTIONS: Array<{ days: number; ar: string; en: string }> = [
  { days: 30, ar: "30 يوم", en: "30 days" },
  { days: 90, ar: "90 يوم", en: "90 days" },
  { days: 365, ar: "سنة", en: "1 year" },
  { days: 0, ar: "بدون انتهاء", en: "Never" },
];

function fmt(d: string | null, locale: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", { dateStyle: "medium", timeStyle: "short" }); } catch { return d; }
}

export function ApiKeysTab({ canManage, push }: { canManage: boolean; push: (kind: "success" | "error", msg: string) => void }) {
  const { t, language } = useLanguage();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiKeyScope[]>(["read"]);
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [freshKey, setFreshKey] = useState<{ raw: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.apiKeys.list();
      setKeys(r.keys);
    } catch (e) {
      push("error", e instanceof ApiError ? e.message : t("تعذّر تحميل المفاتيح", "Failed to load API keys"));
    } finally {
      setLoading(false);
    }
  }, [push, t]);

  useEffect(() => { void load(); }, [load]);

  const toggleScope = (s: ApiKeyScope) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const create = async () => {
    if (name.trim().length < 2) { push("error", t("اكتب اسمًا للمفتاح (حرفان على الأقل)", "Enter a key name (2+ chars)")); return; }
    if (scopes.length === 0) { push("error", t("اختر صلاحية واحدة على الأقل", "Pick at least one scope")); return; }
    setBusy(true);
    try {
      const r = await api.apiKeys.create({ name: name.trim(), scopes, expiresInDays });
      setFreshKey({ raw: r.key, name: r.apiKey.name });
      setCopied(false);
      setShowForm(false);
      setName("");
      setScopes(["read"]);
      push("success", t("تم إنشاء المفتاح · انسخه الآن، لن يظهر مرة أخرى", "Key created · copy it now, it won't be shown again"));
      await load();
    } catch (e) {
      push("error", e instanceof ApiError ? e.message : t("فشل إنشاء المفتاح", "Failed to create key"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!freshKey) return;
    try { await navigator.clipboard.writeText(freshKey.raw); setCopied(true); push("success", t("تم النسخ", "Copied")); }
    catch { push("error", t("تعذّر النسخ · حدّد النص وانسخه يدويًا", "Copy failed · select the text and copy manually")); }
  };

  const revoke = async (id: string) => {
    setPendingRevoke(null);
    try {
      await api.apiKeys.revoke(id);
      push("success", t("تم إلغاء المفتاح", "Key revoked"));
      await load();
    } catch (e) {
      push("error", e instanceof ApiError ? e.message : t("فشل إلغاء المفتاح", "Failed to revoke key"));
    }
  };

  const cancelRevoke = useCallback(() => setPendingRevoke(null), []);

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground"><Key className="h-5 w-5" /> {t("مفاتيح API", "API keys")}</CardTitle>
              <CardDescription>
                {t("وصول برمجي للوكلاء والتكاملات · كل مفتاح مرتبط بهذه الشركة فقط · كل عملية تُسجَّل في سجل التدقيق", "Programmatic access for agents & integrations · each key is bound to this company only · every call is audit-logged")}
              </CardDescription>
            </div>
            {canManage && !showForm && (
              <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 shrink-0">
                <Plus className="h-4 w-4 me-2" /> {t("مفتاح جديد", "New key")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {freshKey && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-primary" />
                {t(`المفتاح «${freshKey.name}» · يظهر مرة واحدة فقط`, `Key “${freshKey.name}” · shown only once`)}
              </div>
              <div className="flex items-center gap-2">
                <code dir="ltr" className="flex-1 min-w-0 truncate rounded-md border border-border bg-surface px-3 py-2 text-sm font-english text-foreground select-all">{freshKey.raw}</code>
                <Button type="button" variant="outline" onClick={copy} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 me-1" /> : <Copy className="h-4 w-4 me-1" />} {copied ? t("تم", "Copied") : t("نسخ", "Copy")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("احفظه في مخزن الأسرار عندك. الاستخدام: ", "Store it in your secrets vault. Usage: ")}
                <code dir="ltr" className="font-english">Authorization: Bearer ek_live_…</code>
                {" · "}
                <code dir="ltr" className="font-english">POST /api/v1/import/accounts</code>
              </p>
              <button type="button" onClick={() => setFreshKey(null)} className="text-xs text-primary hover:underline">{t("أخفِ المفتاح — نسخته", "Hide — I copied it")}</button>
            </div>
          )}

          {showForm && (
            <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/40">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground/80">{t("اسم المفتاح", "Key name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("مثال: Claude · استيراد الدليل", "e.g. Claude · COA import")} className="border-border mt-1" maxLength={80} />
                </div>
                <div>
                  <Label className="text-foreground/80">{t("الانتهاء", "Expires")}</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {EXPIRY_OPTIONS.map((o) => (
                      <button key={o.days} type="button" onClick={() => setExpiresInDays(o.days)}
                        className={`rounded-md border px-3 py-1.5 text-sm transition ${expiresInDays === o.days ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {t(o.ar, o.en)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-foreground/80">{t("الصلاحيات (Scopes)", "Scopes")}</Label>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(Object.keys(SCOPE_META) as ApiKeyScope[]).map((s) => {
                    const on = scopes.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => toggleScope(s)}
                        className={`text-start rounded-lg border p-3 transition ${on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{t(SCOPE_META[s].ar, SCOPE_META[s].en)}</span>
                          <code dir="ltr" className="text-[11px] font-english text-muted-foreground">{s}</code>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{t(SCOPE_META[s].hintAr, SCOPE_META[s].hintEn)}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t("الفواتير والقيود غير متاحة للمفاتيح في هذه المرحلة.", "Invoices and journals are not available to keys in this phase.")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={create} disabled={busy} className="bg-primary hover:bg-primary/90">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Key className="h-4 w-4 me-2" /> {t("إنشاء المفتاح", "Create key")}</>}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={busy}>{t("إلغاء", "Cancel")}</Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : keys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("لا توجد مفاتيح بعد.", "No API keys yet.")}
              {canManage ? " " + t("أنشئ مفتاحًا لتمكين وكيل أو تكامل من العمل على هذه الشركة.", "Create one to let an agent or integration work on this company.") : ""}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-start py-2 pe-3 font-medium">{t("الاسم", "Name")}</th>
                    <th className="text-start py-2 pe-3 font-medium">{t("البادئة", "Prefix")}</th>
                    <th className="text-start py-2 pe-3 font-medium">{t("الصلاحيات", "Scopes")}</th>
                    <th className="text-start py-2 pe-3 font-medium">{t("آخر استخدام", "Last used")}</th>
                    <th className="text-start py-2 pe-3 font-medium">{t("الانتهاء", "Expires")}</th>
                    <th className="text-start py-2 pe-3 font-medium">{t("الحالة", "Status")}</th>
                    {canManage && <th className="py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pe-3 text-foreground font-medium">{k.name}</td>
                      <td className="py-2 pe-3"><code dir="ltr" className="font-english text-xs text-muted-foreground">{k.prefix}…</code></td>
                      <td className="py-2 pe-3">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => <span key={s} dir="ltr" className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-english text-foreground/80">{s}</span>)}
                        </div>
                      </td>
                      <td className="py-2 pe-3 text-muted-foreground whitespace-nowrap"><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(k.lastUsedAt, language)}</span></td>
                      <td className="py-2 pe-3 text-muted-foreground whitespace-nowrap">{k.expiresAt ? fmt(k.expiresAt, language) : t("بدون", "Never")}</td>
                      <td className="py-2 pe-3">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${k.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {k.status === "active" ? t("فعّال", "Active") : k.status === "revoked" ? t("مُلغى", "Revoked") : t("منتهٍ", "Expired")}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-2 text-end">
                          {k.status === "active" && (
                            pendingRevoke === k.id ? (
                              <InlineConfirm onConfirm={() => revoke(k.id)} onCancel={cancelRevoke} label={t("إلغاء المفتاح؟", "Revoke key?")} />
                            ) : (
                              <button type="button" onClick={() => setPendingRevoke(k.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-danger hover:bg-danger-subtle transition">
                                <Trash2 className="h-3.5 w-3.5" /> {t("إلغاء", "Revoke")}
                              </button>
                            )
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
