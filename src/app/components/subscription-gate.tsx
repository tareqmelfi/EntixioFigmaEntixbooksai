/**
 * SubscriptionGate · friendly upgrade page shown by the app shell when the API
 * answers 402 `subscription_required` for the active company (CEO 2026-08-25:
 * a raw red error is not a paywall). Also handles 410 `org_deleted` by routing
 * the user to another company (or /welcome when none is left).
 *
 * Full-content replacement inside <main> — no modal, no popup (UX-1).
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { CreditCard, ArrowLeftRight, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "./LanguageContext";
import { setOrgId } from "../lib/api";

type GateState = { kind: "subscription"; status: string | null } | { kind: "deleted" } | null;

export function useSubscriptionGate() {
  const [gate, setGate] = useState<GateState>(null);
  const location = useLocation();
  useEffect(() => {
    const onSub = (e: Event) => setGate({ kind: "subscription", status: (e as CustomEvent).detail?.status ?? null });
    const onDeleted = () => setGate({ kind: "deleted" });
    window.addEventListener("entix:subscription-required", onSub);
    window.addEventListener("entix:org-deleted", onDeleted);
    return () => {
      window.removeEventListener("entix:subscription-required", onSub);
      window.removeEventListener("entix:org-deleted", onDeleted);
    };
  }, []);
  // Billing / settings / welcome screens must stay reachable so the user can actually fix it.
  const exempt = /^\/app\/(billing|settings|admin)/.test(location.pathname);
  useEffect(() => { if (exempt) setGate(null); }, [exempt, location.pathname]);
  return { gate, clear: () => setGate(null) };
}

export function SubscriptionGate({ gate, orgName, onSwitch }: { gate: GateState; orgName?: string | null; onSwitch: () => void }) {
  const { t } = useLanguage();
  if (!gate) return null;

  if (gate.kind === "deleted") {
    // Drop the stale selection so authStore resolves another company on reload.
    setOrgId(null);
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 text-center shadow-raised">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">{t("هذه الشركة محذوفة", "This company was deleted")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("يمكن للمالك استعادتها من حسابي → الشركات المحذوفة خلال فترة السماح.", "The owner can restore it from Account → Deleted companies during the grace period.")}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => window.location.assign("/app/dashboard")} className="bg-primary hover:bg-primary/90"><ArrowLeftRight className="h-4 w-4 me-2" />{t("الانتقال لشركة أخرى", "Go to another company")}</Button>
          <Link to="/app/settings?tab=account"><Button variant="outline">{t("الشركات المحذوفة", "Deleted companies")}</Button></Link>
        </div>
      </div>
    );
  }

  const expired = gate.status === "EXPIRED" || gate.status === "CANCELED";
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-8 shadow-raised">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-6 w-6" /></div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">
            {orgName ? t(`فعّل باقة «${orgName}» للمتابعة`, `Activate a plan for “${orgName}” to continue`) : t("فعّل باقة هذه الشركة للمتابعة", "Activate a plan for this company to continue")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {expired
              ? t("انتهت فترة الاشتراك أو التجربة لهذه الشركة. بياناتك محفوظة بالكامل — اختر باقة وتابع من حيث توقفت.", "This company's subscription or trial has ended. Your data is fully preserved — pick a plan and continue where you left off.")
              : t("كل شركة لها باقتها الخاصة وشهر مجاني على أي باقة مدفوعة. بياناتك محفوظة بالكامل.", "Each company has its own plan with a free month on any paid plan. Your data is fully preserved.")}
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{t("فواتير غير محدودة · مستخدمون حتى 5", "Unlimited invoices · up to 5 users")}</li>
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{t("الوكيل الذكي الكامل + ربط البنوك", "Full AI agent + bank feeds")}</li>
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{t("خصم 30% على كل شركة إضافية", "30% off every additional company")}</li>
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{t("إلغاء في أي وقت", "Cancel anytime")}</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/app/settings?tab=plans"><Button className="bg-primary hover:bg-primary/90"><CreditCard className="h-4 w-4 me-2" />{t("اختيار باقة", "Choose a plan")}</Button></Link>
            <Button variant="outline" onClick={onSwitch}><ArrowLeftRight className="h-4 w-4 me-2" />{t("التبديل لشركة أخرى", "Switch company")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
