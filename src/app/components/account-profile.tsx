import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import { authStore } from "./auth-store";
import { useLanguage } from "./LanguageContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { InlineAlert } from "./product";
import { downscaleDataUrl } from "../lib/print-image";

export function AccountProfile() {
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState({ name: "", phone: "", bio: "", image: "", email: "" });
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feedbackSection, setFeedbackSection] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.VITE_API_URL || "https://api.entix.io"}/me`, { credentials: "include" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(user => { if (active) setProfile({ name: user.name || "", phone: user.phone || "", bio: user.bio || "", image: user.image || "", email: user.email || "" }); })
      .catch(() => { if (active) { setLoadFailed(true); setError(t("تعذّر تحميل ملفك الشخصي. أعد فتح الصفحة.", "Could not load your profile. Please reload the page.")); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const options = { headers: { "Accept-Language": language } };
  const run = async (key: string, action: () => Promise<void>) => {
    setFeedbackSection(key === "image" ? "profile" : key);
    setBusy(key); setError(""); setNotice("");
    try { await action(); } catch (e) {
      setError(e instanceof Error ? e.message : t("تعذّر حفظ التغيير. حاول مجددًا.", "Could not save the change. Please retry."));
    } finally { setBusy(""); }
  };
  const check = (result: any) => {
    if (!result.error) return;
    const code = result.error.code;
    if (code === "INVALID_PASSWORD") throw new Error(t("كلمة المرور الحالية غير صحيحة.", "Your current password is incorrect."));
    if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") throw new Error(t("حسابك يستخدم تسجيل الدخول الخارجي. استخدم «نسيت كلمة المرور» لإنشاء كلمة مرور.", "Your account uses external sign-in. Use Forgot password to create a password."));
    if (code === "SESSION_EXPIRED" || result.error.status === 401) throw new Error(t("سجّل الدخول مجددًا لإكمال هذا التغيير.", "Sign in again to complete this change."));
    throw new Error(t("تعذّر تنفيذ الطلب. تحقّق من البيانات أو سجّل الدخول مجددًا.", "The request could not be completed. Check the details or sign in again."));
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setFeedbackSection("profile"); setNotice("");
      setError(t("اختر صورة PNG أو JPEG أو WebP لا تتجاوز 5MB.", "Choose a PNG, JPEG or WebP image up to 5MB.")); return;
    }
    await run("image", async () => {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const image = await downscaleDataUrl(source, 512, 0.82);
      if (image.length > 400_000) throw new Error(t("الصورة كبيرة؛ اختر صورة أصغر.", "The image is too large; choose a smaller image."));
      setProfile(value => ({ ...value, image }));
    });
  };
  const feedback = (key: string) => feedbackSection === key && <>
    {error && <InlineAlert tone="critical" role="alert">{error}</InlineAlert>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
  </>;
  if (loading) return <p>{t("جاري تحميل حسابك…", "Loading your account…")}</p>;
  if (loadFailed) return <InlineAlert tone="critical" role="alert">{error}</InlineAlert>;
  return <section className="space-y-6" data-testid="account-profile">
    <div><h3 className="font-semibold">{t("ملفي الشخصي", "My profile")}</h3><p className="text-sm text-muted-foreground">{t("بياناتك تخص حسابك في جميع الشركات، ولا تغيّر صلاحياتك في الفريق.", "Your profile belongs to your account across companies. It does not change your team permissions.")}</p></div>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run("profile", async () => {
      let imageUrl = profile.image;
      if (imageUrl.startsWith("data:")) {
        const blob = await (await fetch(imageUrl)).blob();
        const uploaded = await fetch(`${import.meta.env.VITE_API_URL || "https://api.entix.io"}/me/avatars`, { method: "POST", credentials: "include", headers: { "Content-Type": blob.type }, body: blob });
        if (!uploaded.ok) throw new Error(t("تعذّر حفظ الصورة. حاول مجددًا.", "Could not save the photo. Please retry."));
        imageUrl = (await uploaded.json()).url;
      }
      check(await authClient.updateUser({ name: profile.name.trim(), image: imageUrl || null, phone: profile.phone.trim(), bio: profile.bio.trim(), fetchOptions: options } as any));
      setProfile(value => ({ ...value, image: imageUrl }));
      await authStore.refresh(); setNotice(t("حُفظ ملفك الشخصي.", "Your profile was saved."));
    }); }}>
      <div className="flex flex-wrap items-center gap-3">
        {profile.image && <img src={profile.image} alt={t("الصورة الشخصية", "Profile photo")} className="h-16 w-16 rounded-full object-cover" />}
        <div><Label htmlFor="profile-photo">{t("الصورة الشخصية", "Profile photo")}</Label><Input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!busy} onChange={event => void upload(event.target.files?.[0])} /></div>
        {profile.image && <Button type="button" variant="outline" disabled={!!busy} onClick={() => setProfile({ ...profile, image: "" })}>{t("إزالة الصورة", "Remove photo")}</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="profile-name">{t("الاسم", "Name")}</Label><Input id="profile-name" required maxLength={200} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
        <div><Label htmlFor="profile-phone">{t("الهاتف", "Phone")}</Label><Input id="profile-phone" type="tel" dir="ltr" maxLength={40} value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></div>
      </div>
      <div><Label htmlFor="profile-bio">{t("نبذة عني", "About me")}</Label><textarea id="profile-bio" maxLength={500} rows={3} className="w-full rounded-md border border-border bg-card p-3 text-sm" value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} /><p className="text-xs text-muted-foreground">{profile.bio.length}/500</p></div>
      <Button type="submit" disabled={!!busy || !profile.name.trim()}>{t("حفظ الملف الشخصي", "Save profile")}</Button>
      {feedback("profile")}
    </form>
    <form className="space-y-3 border-t border-border pt-5" onSubmit={e => { e.preventDefault(); void run("email", async () => {
      check(await authClient.changeEmail({ newEmail: newEmail.trim(), callbackURL: `${window.location.origin}/app/settings?tab=account`, fetchOptions: options }));
      setNotice(t("إذا كان البريد متاحًا ستصلك رسالة تأكيد. راجع بريدك الحالي ثم الجديد؛ يبقى بريد الدخول الحالي حتى اكتمال التحقق.", "If the email is available, a confirmation message will arrive. Check your current inbox, then the new one. Your sign-in email remains unchanged until verification completes.")); setNewEmail("");
    }); }}>
      <h3 className="font-semibold">{t("تغيير البريد الإلكتروني", "Change email")}</h3><p className="text-sm" dir="ltr">{profile.email}</p>
      <Label htmlFor="profile-email">{t("البريد الجديد", "New email")}</Label><Input id="profile-email" type="email" required autoComplete="email" dir="ltr" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
      <Button type="submit" variant="outline" disabled={!!busy || newEmail.trim().toLowerCase() === profile.email.toLowerCase()}>{t("إرسال طلب تغيير البريد", "Request email change")}</Button>
      {feedback("email")}
    </form>
    <form className="space-y-3 border-t border-border pt-5" onSubmit={e => { e.preventDefault(); void run("password", async () => {
      if (newPassword !== confirmation) throw new Error(t("كلمتا المرور غير متطابقتين.", "The passwords do not match."));
      check(await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true, fetchOptions: options }));
      setCurrentPassword(""); setNewPassword(""); setConfirmation(""); setNotice(t("تغيّرت كلمة المرور وأُغلقت الجلسات الأخرى.", "Password changed and other sessions signed out."));
    }); }}>
      <h3 className="font-semibold">{t("تغيير كلمة المرور", "Change password")}</h3>
      <div><Label htmlFor="profile-current-password">{t("كلمة المرور الحالية", "Current password")}</Label><Input id="profile-current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></div>
      <div><Label htmlFor="profile-new-password">{t("كلمة المرور الجديدة", "New password")}</Label><Input id="profile-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
      <div><Label htmlFor="profile-confirm-password">{t("تأكيد كلمة المرور", "Confirm password")}</Label><Input id="profile-confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
      <div className="flex flex-wrap items-center gap-4"><Button type="submit" variant="outline" disabled={!!busy}>{t("تحديث كلمة المرور", "Update password")}</Button><a className="text-sm text-primary underline" href="/forgot-password">{t("نسيت كلمة المرور أو أستخدم Google / Apple", "Forgot password or using Google / Apple")}</a></div>
      {feedback("password")}
    </form>
  </section>;
}
