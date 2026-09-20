/**
 * SocialLinksCard · Settings → العلامة التجارية (CEO 2026-09-20)
 *
 * Several tenants (EDG among them) asked for somewhere to keep their public profiles; neither
 * «بيانات الشركة» nor «العلامة التجارية» had any field for one. It lives here, beside the logo
 * and the output identity, because that is where public-facing branding belongs.
 *
 * UX-1: no dialogs — inline rows, inline validation, toasts.
 */
import { useState } from "react";
import { Loader2, Plus, Save, Trash2, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { InlineAlert } from "./product";
import { api, SOCIAL_PLATFORMS, type Org, type SocialLink, type SocialPlatform } from "../lib/api";
import { humanizeError } from "../lib/error-messages";
import { useLanguage } from "./LanguageContext";

const LABELS: Record<SocialPlatform, [string, string]> = {
  instagram: ["إنستغرام", "Instagram"],
  x: ["إكس", "X"],
  linkedin: ["لينكدإن", "LinkedIn"],
  tiktok: ["تيك توك", "TikTok"],
  facebook: ["فيسبوك", "Facebook"],
  youtube: ["يوتيوب", "YouTube"],
  snapchat: ["سناب شات", "Snapchat"],
  whatsapp: ["واتساب", "WhatsApp"],
  other: ["أخرى", "Other"],
};

const MAX = 10;

/** Mirrors the server's normaliser (api lib/social-links.ts) so the row is flagged before saving. */
export function socialUrlValid(raw: string): boolean {
  const t = String(raw || "").trim();
  if (!t) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, "")}`);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch { return false; }
}

export function SocialLinksCard({ org, setOrg, push }: {
  org: Org;
  setOrg: (o: Org) => void;
  push: (kind: "success" | "error" | "info", msg: string) => void;
}) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<SocialLink[]>(() => (org.socialLinks || []).map((l) => ({ ...l })));
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = (i: number, patch: Partial<SocialLink>) => {
    setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setTouched(true);
  };
  const add = () => { setRows([...rows, { platform: "instagram", url: "" }]); setTouched(true); };
  const remove = (i: number) => { setRows(rows.filter((_, k) => k !== i)); setTouched(true); };

  // A row the user started and left blank is simply not saved; a row with text that is not a link
  // blocks the save, because saving it silently is what produced broken public links before.
  const filled = rows.filter((r) => String(r.url || "").trim());
  const broken = filled.filter((r) => !socialUrlValid(r.url));

  const save = async () => {
    if (broken.length) return;
    setBusy(true);
    try {
      const updated = await api.orgs.update(org.id, { socialLinks: filled.length ? filled : null } as any);
      setOrg({ ...org, socialLinks: updated.socialLinks ?? null });
      setRows((updated.socialLinks || []).map((l) => ({ ...l })));
      setTouched(false);
      push("success", t("حُفظت روابط التواصل", "Social links saved"));
    } catch (e) {
      push("error", humanizeError(e, language, { ar: "تعذّر حفظ الروابط", en: "Could not save the links" }));
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" />{t("روابط التواصل", "Social links")}</CardTitle>
        <CardDescription>
          {t("حسابات الشركة العامة — تظهر مع هوية المخرجات المشتركة (اللوحات المشاركة).", "The company's public profiles — shown with the shared-output identity (public boards).")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("لا توجد روابط بعد.", "No links yet.")}</p>
        )}
        {rows.map((r, i) => {
          const bad = !!String(r.url || "").trim() && !socialUrlValid(r.url);
          return (
            <div key={i} className="flex flex-wrap items-start gap-2">
              <select
                value={r.platform}
                onChange={(e) => set(i, { platform: e.target.value as SocialPlatform })}
                className="h-10 rounded-md border border-border bg-card px-2 text-sm"
                data-testid={`social-platform-${i}`}
              >
                {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{t(LABELS[p][0], LABELS[p][1])}</option>)}
              </select>
              <div className="min-w-[200px] flex-1">
                <input
                  type="text"
                  dir="ltr"
                  value={r.url}
                  onChange={(e) => set(i, { url: e.target.value })}
                  placeholder="instagram.com/your-account"
                  aria-invalid={bad || undefined}
                  className={`h-10 w-full rounded-md border bg-card px-3 font-english text-sm ${bad ? "border-danger ring-1 ring-danger-border" : "border-border"}`}
                  data-testid={`social-url-${i}`}
                />
                {bad && <div className="mt-1 text-[11px] text-danger">{t("رابط غير صالح — اكتبه هكذا instagram.com/حسابك", "Not a valid link — type it as instagram.com/your-account")}</div>}
              </div>
              {r.platform === "other" && (
                <input
                  type="text"
                  value={r.label || ""}
                  onChange={(e) => set(i, { label: e.target.value })}
                  placeholder={t("الاسم الظاهر", "Display name")}
                  className="h-10 w-36 rounded-md border border-border bg-card px-3 text-sm"
                  data-testid={`social-label-${i}`}
                />
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label={t("حذف", "Remove")} data-testid={`social-remove-${i}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {broken.length > 0 && (
          <InlineAlert tone="critical" data-testid="social-invalid">{t(`${broken.length} رابط غير صالح — صحّحه أو احذفه قبل الحفظ`, `${broken.length} link(s) are not valid — fix or remove them before saving`)}</InlineAlert>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={rows.length >= MAX} data-testid="social-add">
            <Plus className="h-4 w-4 me-1" />{t("إضافة رابط", "Add link")}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={busy || !touched || broken.length > 0} data-testid="social-save">
            {busy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Save className="h-4 w-4 me-1" />}{t("حفظ", "Save")}
          </Button>
          {rows.length >= MAX && <span className="text-[11px] text-muted-foreground">{t(`الحد ${MAX} روابط`, `${MAX} links max`)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
