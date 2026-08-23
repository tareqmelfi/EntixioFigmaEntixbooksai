/**
 * /claim · post-payment landing for pay-first guest checkout.
 *
 * Stripe redirects here after a successful /buy payment. The webhook has
 * already created the account + company + ACTIVE subscription and emailed a
 * set-password link; this page tells the guest exactly that.
 */
import { MailCheck } from "lucide-react";
import { useLanguage } from "../components/LanguageContext";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";

export function ClaimPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background">
      <SharedNavbar />
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
          <MailCheck className="h-7 w-7 text-emerald-700" />
        </div>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 800 }}>
          {t("تم الدفع — شركتك جاهزة", "Payment received — your company is ready")}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {t(
            "أرسلنا لك بريدًا فيه رابط تعيين كلمة المرور. افتح البريد، عيّن كلمة المرور، وسجّل الدخول — اشتراكك مفعّل وشركتك بانتظارك.",
            "We emailed you a set-password link. Open it, choose your password, and sign in — your subscription is active and your company is waiting.",
          )}
        </p>
        <div className="mt-8 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {t(
            "لم يصلك البريد خلال دقائق؟ تحقق من الرسائل غير المرغوبة أو راسل support@entix.io من نفس البريد الذي دفعت به.",
            "No email after a few minutes? Check spam, or email support@entix.io from the same address you paid with.",
          )}
        </div>
        <a href="/login" className="inline-block mt-6 text-sm text-primary hover:underline">
          {t("لديك كلمة مرور بالفعل؟ سجّل الدخول", "Already set your password? Sign in")}
        </a>
      </main>
      <SharedFooter />
    </div>
  );
}
