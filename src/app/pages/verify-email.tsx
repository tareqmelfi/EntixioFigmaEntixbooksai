/**
 * /verify-email — verification-link landing (security fix 2026-08-21)
 *
 * Previously the link targeted /login?verified=1 — and /login auto-redirects
 * into /app whenever ANY session exists, so on a shared device the clicker
 * landed inside the PREVIOUS account's workspace with full edit rights.
 *
 * This page never forwards into the app silently:
 *  · if the signed-in session belongs to a DIFFERENT email than the verified
 *    one, that session is signed out first (server-side revoke) with a notice;
 *  · states are explicit: success / already-used-or-expired (with resend) /
 *    neutral (direct visit).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";
import { Loader2, MailWarning, ShieldAlert, MailCheck } from "lucide-react";

export function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const params = new URLSearchParams(location.search);
  const email = (params.get("email") || "").toLowerCase();
  const errorParam = params.get("error");
  const verifiedFlag = params.get("verified") === "1";

  const [auth, setAuth] = useState(authStore.getState());
  const [signedOutOther, setSignedOutOther] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const guardRan = useRef(false);

  useEffect(() => authStore.subscribe(setAuth), []);

  // Cross-account guard — runs once, before any status UI is trusted.
  useEffect(() => {
    if (auth.loading || guardRan.current) return;
    guardRan.current = true;
    const sessionEmail = auth.user?.email?.toLowerCase();
    if (auth.isAuthenticated && email && sessionEmail && sessionEmail !== email) {
      authStore.logout().then(() => setSignedOutOther(auth.user?.email || null));
    }
  }, [auth.loading, auth.isAuthenticated, auth.user?.email, email]);

  const handleResend = async () => {
    if (!email) return;
    setResendBusy(true);
    setResendNotice(null);
    try {
      await authStore.resendVerificationEmail(email, `${window.location.origin}/verify-email?verified=1&email=${encodeURIComponent(email)}`);
      setResendNotice(t("أُرسل رابط جديد — افحص بريدك", "A new link was sent — check your inbox"));
    } catch {
      setResendNotice(t("تعذّر الإرسال الآن — حاول لاحقًا", "Could not send right now — try later"));
    } finally {
      setResendBusy(false);
    }
  };

  const sessionMatchesVerified = auth.isAuthenticated && auth.user?.email?.toLowerCase() === email;

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-raised p-8 text-center">
        {signedOutOther && (
          <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-start text-xs text-amber-800 flex gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {t("حمايةً لك، سجّلنا خروج الحساب السابق على هذا الجهاز", "For your safety, the previous account on this device was signed out")}
              {" "}(<span className="font-english" dir="ltr">{signedOutOther}</span>).
            </span>
          </div>
        )}

        {/* Success state — only when the server marked the link consumed OK */}
        {verifiedFlag && !errorParam && (
          <>
            <MailCheck className="mx-auto h-12 w-12 text-success mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">{t("تم تفعيل بريدك الإلكتروني", "Your email is verified")}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t("اكتمل التفعيل", "Verification complete")}
              {email && <> — <span className="font-english" dir="ltr">{email}</span></>}.
            </p>
            {sessionMatchesVerified ? (
              <button onClick={() => navigate("/app")} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                {t("الانتقال إلى التطبيق", "Continue to the app")}
              </button>
            ) : (
              <button onClick={() => navigate("/login")} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                {t("تسجيل الدخول", "Sign in")}
              </button>
            )}
          </>
        )}

        {/* Consumed/expired/invalid link */}
        {errorParam && (
          <>
            <MailWarning className="mx-auto h-12 w-12 text-amber-500 mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">{t("هذا الرابط لم يعد صالحًا", "This link is no longer valid")}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t("روابط التفعيل تعمل مرة واحدة وتنتهي خلال 24 ساعة. إن كان بريدك مفعلًا مسبقًا سجّل دخولك مباشرة، وإلا اطلب رابطًا جديدًا.", "Verification links work once and expire within 24 hours. If your email is already verified just sign in, otherwise request a new link.")}
            </p>
            {resendNotice && <p className="text-xs text-muted-foreground mb-3">{resendNotice}</p>}
            <div className="flex flex-col gap-2">
              {email && (
                <button onClick={handleResend} disabled={resendBusy}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                  {resendBusy ? <Loader2 className="h-4 w-4 animate-spin inline" /> : t("إرسال رابط تفعيل جديد", "Send a new verification link")}
                </button>
              )}
              <button onClick={() => navigate("/login")} className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted/50">
                {t("تسجيل الدخول", "Sign in")}
              </button>
            </div>
          </>
        )}

        {/* Neutral state — direct visit without link params */}
        {!verifiedFlag && !errorParam && (
          <>
            <MailWarning className="mx-auto h-12 w-12 text-primary mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">{t("تحقق من بريدك الإلكتروني", "Check your inbox")}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t("افتح رسالة التفعيل واضغط الرابط داخلها. لم تصلك؟ أرسل رابطًا جديدًا.", "Open the verification email and tap its link. Nothing arrived? Send a new one.")}
            </p>
            {resendNotice && <p className="text-xs text-muted-foreground mb-3">{resendNotice}</p>}
            <div className="flex flex-col gap-2">
              {email && (
                <button onClick={handleResend} disabled={resendBusy}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                  {resendBusy ? <Loader2 className="h-4 w-4 animate-spin inline" /> : t("إرسال رابط تفعيل جديد", "Send a new verification link")}
                </button>
              )}
              <Link to="/login" className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted/50">
                {t("تسجيل الدخول", "Sign in")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
