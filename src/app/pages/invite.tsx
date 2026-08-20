/**
 * /invite/:token — invitation landing (consent-first, 2026-08-21)
 *
 * The emailed link lands here. The invitee must be signed in WITH THE INVITED
 * EMAIL (server enforces the match); then they accept (membership created) or
 * decline (inviter notified). Nobody is ever added to an org silently.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, ApiError } from "../lib/api";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";
import { CheckCircle2, Loader2, MailWarning, XCircle, Building2 } from "lucide-react";

type InviteInfo = {
  org: { id: string; name: string; slug: string };
  role: string;
  invitedByName?: string | null;
  status: string;
  expiresAt: string;
};

const ROLE_AR: Record<string, string> = { OWNER: "مالك", ADMIN: "مدير", ACCOUNTANT: "محاسب", VIEWER: "مشاهد" };

export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [auth, setAuth] = useState(authStore.getState());
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "accepted" | "declined" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [mismatchEmail, setMismatchEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  useEffect(() => authStore.subscribe(setAuth), []);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) { setPhase("ready"); return; }
    setPhase("loading");
    api.invites.get(token)
      .then((r) => {
        setInfo(r);
        if (r.status === "PENDING") setPhase("ready");
        else if (r.status === "ACCEPTED") setPhase("accepted");
        else {
          setError(
            r.status === "REVOKED" ? t("سُحبت هذه الدعوة من المرسل", "This invite was revoked by the sender")
            : r.status === "EXPIRED" ? t("انتهت صلاحية هذه الدعوة — اطلب من المرسل إعادة إرسالها", "This invite expired — ask the sender to send it again")
            : t("هذه الدعوة لم تعد صالحة", "This invite is no longer valid"),
          );
          setPhase("error");
        }
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) {
          setMismatchEmail((e.body as any)?.invitedEmail || null);
        } else if (e instanceof ApiError && e.status === 404) {
          setError(t("الدعوة غير موجودة — ربما نُسخ الرابط ناقصًا", "Invite not found — the link may have been copied incompletely"));
        } else {
          setError(t("تعذّر تحميل الدعوة", "Could not load the invite"));
        }
        setPhase("error");
      });
  }, [auth.loading, auth.isAuthenticated, token]);

  const roleLabel = (r: string) => (language === "ar" ? (ROLE_AR[r] || r) : r);

  const handleAccept = async () => {
    setBusy("accept");
    try {
      const r = await api.invites.accept(token);
      setInfo((i) => (i ? { ...i, org: r.org } : i));
      setPhase("accepted");
    } catch (e: any) {
      const msg = e instanceof ApiError && e.status === 402
        ? t("امتلأت مقاعد باقة الشركة — اطلب من المالك الترقية", "The company's plan seats are full — ask the owner to upgrade")
        : e?.message || t("تعذّر قبول الدعوة", "Could not accept the invite");
      setError(msg);
      setPhase("error");
    } finally { setBusy(null); }
  };

  const handleDecline = async () => {
    setBusy("decline");
    try {
      await api.invites.decline(token);
      setPhase("declined");
    } catch (e: any) {
      setError(e?.message || t("تعذّر رفض الدعوة", "Could not decline the invite"));
      setPhase("error");
    } finally { setBusy(null); }
  };

  const switchAccount = async () => {
    await authStore.logout();
    navigate("/login", { state: { from: `/invite/${token}` } });
  };

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-raised p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-7 w-7 text-primary" />
        </div>

        {phase === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("جارٍ تحميل الدعوة…", "Loading invite…")}</p>
          </div>
        )}

        {phase === "ready" && !auth.isAuthenticated && !auth.loading && (
          <>
            <h1 className="text-lg font-bold text-foreground mb-2">{t("لديك دعوة للانضمام إلى شركة", "You've been invited to join a company")}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t("سجّل الدخول أو أنشئ حسابًا بالبريد الذي وصلت عليه الدعوة لعرضها وقبولها أو رفضها.", "Sign in or create an account with the invited email to view, accept, or decline it.")}
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate("/login", { state: { from: `/invite/${token}` } })}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                {t("تسجيل الدخول", "Sign in")}
              </button>
              <button onClick={() => navigate("/register", { state: { from: `/invite/${token}` } })}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted/50">
                {t("إنشاء حساب جديد", "Create a new account")}
              </button>
            </div>
          </>
        )}

        {phase === "ready" && auth.isAuthenticated && info && (
          <>
            <h1 className="text-lg font-bold text-foreground mb-2">
              {t("دعوة للانضمام إلى", "Invitation to join")} «{info.org.name}»
            </h1>
            <p className="text-sm text-muted-foreground mb-1">
              {t("من", "From")}: <span className="font-medium text-foreground">{info.invitedByName || t("أحد أعضاء الفريق", "A team member")}</span>
              {" · "}{t("الصلاحية", "Role")}: <span className="font-medium text-foreground">{roleLabel(info.role)}</span>
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              {t("تنتهي الدعوة في", "Invite expires")} <span className="font-english">{new Date(info.expiresAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}</span>
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleAccept} disabled={busy !== null}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : t("قبول الدعوة والانضمام", "Accept & join")}
              </button>
              <button onClick={handleDecline} disabled={busy !== null}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 disabled:opacity-60">
                {busy === "decline" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : t("رفض الدعوة", "Decline")}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-4">
              {t("لن تُضاف إلى الشركة إلا إذا ضغطت «قبول».", "You're only added if you press Accept.")}
            </p>
          </>
        )}

        {phase === "accepted" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-success mb-3" />
            <h1 className="text-lg font-bold text-foreground mb-2">
              {t("أهلًا بك في", "Welcome to")} «{info?.org.name}»
            </h1>
            <p className="text-sm text-muted-foreground mb-6">{t("تم تفعيل عضويتك — ستجد الشركة في قائمة الشركات.", "Your membership is active — find the company in your company switcher.")}</p>
            <button onClick={() => navigate("/app")} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {t("فتح التطبيق", "Open the app")}
            </button>
          </>
        )}

        {phase === "declined" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <h1 className="text-lg font-bold text-foreground mb-2">{t("تم رفض الدعوة", "Invite declined")}</h1>
            <p className="text-sm text-muted-foreground mb-6">{t("أُبلغ المرسل — لن تُضاف إلى الشركة.", "The sender was notified — you were not added to the company.")}</p>
            <button onClick={() => navigate("/app")} className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted/50">
              {t("العودة للتطبيق", "Back to the app")}
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <MailWarning className="mx-auto h-10 w-10 text-amber-500 mb-3" />
            {mismatchEmail ? (
              <>
                <h1 className="text-lg font-bold text-foreground mb-2">{t("هذه الدعوة ليست لهذا الحساب", "This invite is for a different account")}</h1>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("الدعوة موجهة إلى", "The invite is addressed to")}: <span className="font-english font-medium text-foreground" dir="ltr">{mismatchEmail}</span>
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {t("أنت مسجل حاليًا بـ", "You're signed in as")} <span className="font-english" dir="ltr">{auth.user?.email}</span>
                </p>
                <button onClick={switchAccount} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  {t("تبديل الحساب", "Switch account")}
                </button>
              </>
            ) : (
              <>
                <h1 className="text-lg font-bold text-foreground mb-2">{t("تعذّر فتح الدعوة", "Couldn't open the invite")}</h1>
                <p className="text-sm text-muted-foreground mb-6">{error}</p>
                <button onClick={() => navigate("/app")} className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted/50">
                  {t("العودة للتطبيق", "Back to the app")}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
