import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Building2, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, type AdminSubscriberWorkspace } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import {
  AdminWorkspaceBackLink,
  AdminWorkspaceFailedCard,
  AdminWorkspaceLoading,
  AdminWorkspaceStateCard,
  type AdminWorkspaceViewState,
  UnavailableSection,
} from "../components/admin-workspace-shell";

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB");
}

export function AdminSubscriberWorkspacePage() {
  const { t } = useLanguage();
  const { orgId = "" } = useParams();

  const [viewState, setViewState] = useState<AdminWorkspaceViewState>("loading");
  const [workspace, setWorkspace] = useState<AdminSubscriberWorkspace | null>(null);
  const [billingRefreshing, setBillingRefreshing] = useState(false);

  const load = useCallback(async () => {
    setViewState("loading");
    try {
      const data = await api.admin.subscriberDetail(orgId);
      setWorkspace(data);
      setViewState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return setViewState("session");
      if (err instanceof ApiError && err.status === 403) return setViewState("forbidden");
      if (err instanceof ApiError && err.status === 404) return setViewState("notFound");
      setViewState("failed");
    }
  }, [orgId]);

  const refreshBilling = useCallback(async () => {
    setBillingRefreshing(true);
    try {
      const data = await api.admin.subscriberDetail(orgId);
      setWorkspace(data);
      setViewState("ready");
    } catch {
      // Keep existing partial state; full refresh path still uses main retry.
    } finally {
      setBillingRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (viewState === "loading") return <AdminWorkspaceLoading />;

  if (viewState === "session") {
    return (
      <AdminWorkspaceStateCard
        title={t("انتهت الجلسة", "Session required")}
        body={t("سجّل الدخول مرة ثانية للوصول إلى صفحة المشترك.", "Please sign in again to access this subscriber workspace.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
      />
    );
  }

  if (viewState === "forbidden") {
    return (
      <AdminWorkspaceStateCard
        title={t("غير متاح لهذا الحساب", "Access unavailable")}
        body={t("هذه مساحة مشترك أدمن وغير متاحة لحسابك الحالي.", "This admin subscriber workspace is unavailable for your current account.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
      />
    );
  }

  if (viewState === "notFound") {
    return (
      <AdminWorkspaceStateCard
        title={t("المشترك غير متاح", "Subscriber not found")}
        body={t("تعذر العثور على اشتراك المنشأة المطلوبة.", "The requested organization subscription could not be found.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
        notFoundId={orgId}
      />
    );
  }

  if (viewState === "failed" || !workspace) {
    return (
      <AdminWorkspaceFailedCard
        title={t("تعذّر تحميل البيانات", "Failed to load workspace")}
        retryLabel={t("إعادة المحاولة", "Retry")}
        onRetry={() => void load()}
      />
    );
  }

  const summary = workspace.summary.data;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="space-y-1">
        <AdminWorkspaceBackLink label={t("رجوع للوحة الأدمن", "Back to admin")} />
        <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          <CreditCard className="h-5 w-5 text-primary" />{t("مساحة المشترك", "Subscriber workspace")}
        </h1>
        <p className="text-sm text-muted-foreground font-english" dir="ltr">{summary.id} · {summary.status}</p>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-base text-foreground">{t("ملخص الاشتراك", "Subscription summary")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t("المنشأة", "Organization")}: </span>
            <Link to={`/app/admin/orgs/${summary.org.id}`} data-testid={`subscriber-org-link-${summary.org.id}`} className="text-primary hover:underline">
              {summary.org.name}
            </Link>
          </div>
          <div><span className="text-muted-foreground">{t("الخطة", "Plan")}: </span>{summary.plan?.name || "—"}</div>
          <div><span className="text-muted-foreground">{t("فترة حالية", "Current period")}: </span><span className="font-english" dir="ltr">{fmtDate(summary.currentPeriodStart)} → {fmtDate(summary.currentPeriodEnd)}</span></div>
          <div><span className="text-muted-foreground">{t("نهاية التجربة", "Trial ends")}: </span><span className="font-english" dir="ltr">{fmtDate(summary.trialEndsAt)}</span></div>
          <div><span className="text-muted-foreground">Stripe sub: </span><span className="font-english" dir="ltr">{summary.maskedStripeSubscriptionId || "—"}</span></div>
          <div><span className="text-muted-foreground">Stripe customer: </span><span className="font-english" dir="ltr">{summary.maskedStripeCustomerId || "—"}</span></div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />Stripe platform billing</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {workspace.platformBilling.availability !== "available" ? (
            <>
              <UnavailableSection title={t("فاتورة المنصة", "Platform billing")} reason={workspace.platformBilling.unavailableReason} />
              <div className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning">
                {t("تعذر تحميل بيانات Stripe حاليًا. يمكنك إعادة المحاولة بدون أي تعديل على البيانات.", "Stripe billing is currently unavailable. You can retry without mutating any data.")}
              </div>
              <Button variant="outline" onClick={() => void refreshBilling()} disabled={billingRefreshing}>{billingRefreshing ? t("جاري التحديث…", "Refreshing…") : t("إعادة محاولة الفوترة", "Retry billing")}</Button>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Status: </span>{workspace.platformBilling.data?.subscriptionStatus || "—"}</div>
              <div><span className="text-muted-foreground">Cancel at period end: </span>{workspace.platformBilling.data?.cancelAtPeriodEnd ? "true" : "false"}</div>
              <div><span className="text-muted-foreground">Billing email: </span><span className="font-english" dir="ltr">{workspace.platformBilling.data?.billingEmail || "—"}</span></div>
              <div><span className="text-muted-foreground">Payment method: </span>{workspace.platformBilling.data?.paymentMethodBrand || "—"} {workspace.platformBilling.data?.paymentMethodLast4 ? `•••• ${workspace.platformBilling.data.paymentMethodLast4}` : ""}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
