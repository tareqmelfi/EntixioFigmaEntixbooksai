/**
 * /admin/join/:token · Admin v3 R2 — accept an internal-team invitation.
 * Public route: shows the invite, asks to sign in (same email) if needed, then accepts.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";
import { invalidateAdminMe } from "../lib/use-admin-me";

export function AdminJoinPage() {
  const { token = "" } = useParams();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [auth, setAuth] = useState(authStore.getState());
  const [info, setInfo] = useState<Awaited<ReturnType<typeof api.admin.inviteInfo>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => authStore.subscribe(setAuth), []);
  useEffect(() => { api.admin.inviteInfo(token).then(setInfo).catch((e) => setErr(e instanceof ApiError && e.status === 404 ? t("الدعوة غير موجودة", "Invitation not found") : (e as any)?.message || "failed")); }, [token, t]);
  const accept = async () => {
    setBusy(true);
    try { await api.admin.acceptInvite(token); invalidateAdminMe(); await authStore.refresh(); setDone(true); setTimeout(() => navigate("/admin", { replace: true }), 1200); }
    catch (e) { setErr(e instanceof ApiError ? (e.code === "email_mismatch" ? t("سجّل الدخول بنفس البريد المدعو", "Sign in with the invited email") : e.message) : "failed"); }
    finally { setBusy(false); }
  };
  const roleName = info ? (language === "ar" ? info.role.nameAr : info.role.nameEn) : "";
  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-[0_8px_24px_rgba(11,27,73,0.08)]">
        <div className="flex items-center gap-2 mb-4"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B1B49] text-white"><ShieldCheck className="h-5 w-5" /></span><div><div dir="ltr" lang="en" className="font-english text-foreground" style={{ fontWeight: 800 }}>ENTIX<span className="text-primary">.IO</span> · Admin</div><div className="text-xs text-muted-foreground">{t("دعوة للانضمام إلى فريق المنصة", "Invitation to the platform team")}</div></div></div>
        {err ? <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4 mt-0.5" />{err}</div>
        : !info ? <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-8" />
        : done ? <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{t("تم القبول — جارٍ فتح لوحة الإدارة…", "Accepted — opening the console…")}</div>
        : info.accepted ? <p className="text-sm text-muted-foreground">{t("هذه الدعوة مقبولة مسبقًا.", "This invitation was already accepted.")} <Link to="/admin" className="text-primary">{t("افتح اللوحة", "Open the console")}</Link></p>
        : info.expired ? <p className="text-sm text-amber-800">{t("انتهت صلاحية الدعوة — اطلب دعوة جديدة.", "This invitation expired — ask for a new one.")}</p>
        : (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-muted-foreground text-xs">{t("البريد المدعو", "Invited email")}</div><div className="font-english" dir="ltr" style={{ fontWeight: 600 }}>{info.email}</div><div className="mt-2 text-muted-foreground text-xs">{t("الدور", "Role")}</div><div style={{ fontWeight: 600 }}>{roleName} <span className="font-english text-xs text-muted-foreground">({info.role.key})</span></div><div className="mt-2 text-[11px] text-muted-foreground font-english" dir="ltr">{t("بواسطة", "by")} {info.invitedBy} · {t("حتى", "until")} {new Date(info.expiresAt).toLocaleString("en-GB")}</div></div>
            {auth.loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : !auth.isAuthenticated ? (
              <div className="space-y-2">
                <p className="text-muted-foreground">{t("سجّل الدخول بنفس البريد ثم ارجع لهذه الصفحة لقبول الدعوة.", "Sign in with the same email, then return here to accept.")}</p>
                <Link to={`/login?next=${encodeURIComponent(`/admin/join/${token}`)}`} className="inline-flex rounded-lg bg-primary px-4 py-2 text-white" style={{ fontWeight: 600 }}>{t("تسجيل الدخول", "Sign in")}</Link>
                <Link to={`/register?next=${encodeURIComponent(`/admin/join/${token}`)}&email=${encodeURIComponent(info.email)}`} className="ms-2 inline-flex rounded-lg border border-border px-4 py-2 text-foreground">{t("إنشاء حساب", "Create account")}</Link>
              </div>
            ) : (auth.user?.email || "").toLowerCase() !== info.email.toLowerCase() ? (
              <p className="text-amber-800">{t("أنت مسجّل بحساب مختلف", "You are signed in with a different account")} (<span className="font-english" dir="ltr">{auth.user?.email}</span>). {t("سجّل الخروج وادخل بالبريد المدعو.", "Sign out and sign in with the invited email.")}</p>
            ) : (
              <button onClick={() => void accept()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-white" style={{ fontWeight: 600 }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{t("قبول الدعوة", "Accept invitation")}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
