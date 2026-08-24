import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { AlertTriangle, ArrowLeft, Building2, Loader2, RefreshCw, Users, CreditCard, MessageSquare, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, type AdminOrganizationWorkspace } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type WorkspaceTab = "overview" | "people" | "subscription" | "support" | "activity";
type ViewState = "loading" | "ready" | "session" | "forbidden" | "notFound" | "failed";

const TABS: WorkspaceTab[] = ["overview", "people", "subscription", "support", "activity"];

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB");
}

function parseTab(raw: string | null): WorkspaceTab {
  if (raw && TABS.includes(raw as WorkspaceTab)) return raw as WorkspaceTab;
  return "overview";
}

function UnavailableSection({ title, reason }: { title: string; reason: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      <div className="text-foreground" style={{ fontWeight: 600 }}>{title}</div>
      <div className="mt-1">{reason || "Unavailable"}</div>
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">{text}</div>;
}

export function AdminOrganizationWorkspace() {
  const { t } = useLanguage();
  const { orgId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [workspace, setWorkspace] = useState<AdminOrganizationWorkspace | null>(null);

  const load = useCallback(async () => {
    setViewState("loading");
    try {
      const data = await api.admin.orgDetail(orgId);
      setWorkspace(data);
      setViewState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setViewState("session");
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setViewState("forbidden");
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setViewState("notFound");
        return;
      }
      setViewState("failed");
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (viewState === "loading") {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (viewState === "session") {
    return (
      <Card className="border-border max-w-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">{t("انتهت الجلسة", "Session required")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("سجّل الدخول مرة ثانية للوصول إلى صفحة المنشأة.", "Please sign in again to access this organization workspace.")}</p>
          <Link to="/login" className="text-sm text-primary hover:underline">{t("الانتقال إلى تسجيل الدخول", "Go to login")}</Link>
        </CardContent>
      </Card>
    );
  }

  if (viewState === "forbidden") {
    return (
      <Card className="border-border max-w-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">{t("غير متاح لهذا الحساب", "Access unavailable")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("هذه مساحة منشأة أدمن وغير متاحة لحسابك الحالي.", "This admin organization workspace is unavailable for your current account.")}</p>
          <Link to="/app/admin" className="text-sm text-primary hover:underline">{t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}</Link>
        </CardContent>
      </Card>
    );
  }

  if (viewState === "notFound") {
    return (
      <Card className="border-border max-w-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">{t("المنشأة غير متاحة", "Organization not found")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground font-english" dir="ltr">{orgId}</p>
          <Link to="/app/admin" className="text-sm text-primary hover:underline">{t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}</Link>
        </CardContent>
      </Card>
    );
  }

  if (viewState === "failed" || !workspace) {
    return (
      <Card className="border-border max-w-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">{t("تعذّر تحميل البيانات", "Failed to load workspace")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4 me-2" />{t("إعادة المحاولة", "Retry")}</Button>
        </CardContent>
      </Card>
    );
  }

  const summary = workspace.summary.data;
  const metrics = workspace.metrics.data;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="space-y-1">
        <Link to="/app/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />{t("رجوع للوحة الأدمن", "Back to admin")}
        </Link>
        <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          <Building2 className="h-5 w-5 text-primary" />{summary.name}
        </h1>
        <p className="text-sm text-muted-foreground font-english" dir="ltr">{summary.slug} · {summary.country} · {summary.baseCurrency}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("الأعضاء", "Members")}</div><div className="text-xl text-foreground" style={{ fontWeight: 700 }}>{metrics.members}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("الفواتير", "Invoices")}</div><div className="text-xl text-foreground" style={{ fontWeight: 700 }}>{metrics.invoices}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("فواتير الشراء", "Purchase bills")}</div><div className="text-xl text-foreground" style={{ fontWeight: 700 }}>{metrics.bills}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("المصروفات", "Expenses")}</div><div className="text-xl text-foreground" style={{ fontWeight: 700 }}>{metrics.expenses}</div></CardContent></Card>
      </div>

      <nav aria-label="Organization workspace tabs" className="flex gap-1.5 rounded-lg bg-muted/60 p-1 w-fit">
        {TABS.map((id) => {
          const active = tab === id;
          const label = id === "overview"
            ? t("نظرة عامة", "Overview")
            : id === "people"
              ? t("الأشخاص", "People")
              : id === "subscription"
                ? t("الاشتراك", "Subscription")
                : id === "support"
                  ? t("الدعم", "Support")
                  : t("النشاط", "Activity");
          return (
            <Link
              key={id}
              to={`?tab=${id}`}
              aria-current={active ? "page" : undefined}
              className={`px-4 py-2 rounded-md text-sm transition ${active ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{ fontWeight: active ? 700 : 500 }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-base text-foreground">{t("ملخص المنشأة", "Organization summary")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">{t("المعرف", "ID")}: </span><span className="font-english" dir="ltr">{summary.id}</span></div>
              <div><span className="text-muted-foreground">{t("الصناعة", "Industry")}: </span>{summary.industry || "—"}</div>
              <div><span className="text-muted-foreground">{t("تاريخ الإنشاء", "Created")}: </span><span className="font-english" dir="ltr">{fmtDate(summary.createdAt)}</span></div>
              <div><span className="text-muted-foreground">{t("آخر تحديث", "Updated")}: </span><span className="font-english" dir="ltr">{fmtDate(summary.updatedAt)}</span></div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader><CardTitle className="text-base text-foreground">{t("حالة البيانات", "Data availability")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {workspace.referral.availability !== "available" && <UnavailableSection title={t("الإحالات", "Referral")} reason={workspace.referral.unavailableReason} />}
              {workspace.outstandingPlatformBilling.availability !== "available" && <UnavailableSection title={t("مستحقات المنصة", "Outstanding platform billing")} reason={workspace.outstandingPlatformBilling.unavailableReason} />}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "people" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Users className="h-4 w-4" />{t("الأشخاص", "People")}</CardTitle></CardHeader>
          <CardContent>
            {workspace.people.availability !== "available" ? (
              <UnavailableSection title={t("الأشخاص", "People")} reason={workspace.people.unavailableReason} />
            ) : workspace.people.data.items.length === 0 ? (
              <EmptySection text={t("لا يوجد أعضاء لهذه المنشأة.", "No members in this organization.")} />
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-2 text-start font-medium">{t("المستخدم", "User")}</th><th className="px-3 py-2 text-start font-medium">{t("الدور", "Role")}</th><th className="px-3 py-2 text-start font-medium">{t("انضم", "Joined")}</th></tr></thead>
                <tbody>
                  {workspace.people.data.items.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-3 py-2.5">
                        <Link
                          to={`/app/admin/users/${row.user.id}`}
                          data-testid={`org-people-user-link-${row.user.id}`}
                          className="font-english text-xs text-foreground hover:underline"
                          dir="ltr"
                        >
                          {row.user.email}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">{row.user.name || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{row.role}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-english" dir="ltr">{fmtDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "subscription" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><CreditCard className="h-4 w-4" />{t("الاشتراك", "Subscription")}</CardTitle></CardHeader>
          <CardContent>
            {workspace.subscription.availability !== "available" ? (
              <UnavailableSection title={t("الاشتراك", "Subscription")} reason={workspace.subscription.unavailableReason} />
            ) : !workspace.subscription.data ? (
              <EmptySection text={t("لا يوجد اشتراك مرتبط بهذه المنشأة.", "No subscription is linked to this organization.")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{t("الحالة", "Status")}</div><div className="text-foreground" style={{ fontWeight: 700 }}>{workspace.subscription.data.status}</div></div>
                <div className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{t("الخطة", "Plan")}</div><div className="text-foreground" style={{ fontWeight: 700 }}>{workspace.subscription.data.plan?.name || "—"}</div></div>
                <div className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">Stripe sub</div><div className="text-foreground font-english text-xs" dir="ltr">{workspace.subscription.data.maskedStripeSubscriptionId || "—"}</div></div>
                <div className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">Stripe customer</div><div className="text-foreground font-english text-xs" dir="ltr">{workspace.subscription.data.maskedStripeCustomerId || "—"}</div></div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "support" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4" />{t("محادثات الدعم", "Support threads")}</CardTitle></CardHeader>
          <CardContent>
            {workspace.support.availability !== "available" ? (
              <UnavailableSection title={t("الدعم", "Support")} reason={workspace.support.unavailableReason} />
            ) : workspace.support.data.items.length === 0 ? (
              <EmptySection text={t("لا توجد محادثات دعم.", "No support threads yet.")} />
            ) : (
              <div className="space-y-2">
                {workspace.support.data.items.map((thread) => (
                  <div key={thread.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/app/admin/support/${thread.id}`}
                        data-testid={`org-support-thread-link-${thread.id}`}
                        className="text-sm text-foreground hover:underline"
                        style={{ fontWeight: 600 }}
                      >
                        {thread.title || t("محادثة", "Thread")}
                      </Link>
                      <div className="text-[11px] text-muted-foreground font-english" dir="ltr">{fmtDate(thread.lastMessageAt)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground font-english" dir="ltr">{thread.user.email} · {thread.messageCount} msgs</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "activity" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Activity className="h-4 w-4" />{t("سجل النشاط", "Activity log")}</CardTitle></CardHeader>
          <CardContent>
            {workspace.activity.availability !== "available" ? (
              <UnavailableSection title={t("النشاط", "Activity")} reason={workspace.activity.unavailableReason} />
            ) : workspace.activity.data.items.length === 0 ? (
              <EmptySection text={t("لا يوجد نشاط مسجّل.", "No recorded activity.")} />
            ) : (
              <div className="space-y-2">
                {workspace.activity.data.items.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-foreground" style={{ fontWeight: 600 }}>{row.action}</div>
                      <div className="text-[11px] text-muted-foreground font-english" dir="ltr">{fmtDate(row.occurredAt)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-english" dir="ltr">{row.entityType}{row.entityId ? ` · ${row.entityId}` : ""} · {row.severity}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {workspace.referral.availability !== "available" || workspace.outstandingPlatformBilling.availability !== "available" ? (
        <div className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>{t("بعض الأقسام غير متاحة في Phase A وتظهر كـ unavailable حسب العقد.", "Some sections are intentionally unavailable in Phase A and are rendered as unavailable by contract.")}</span>
        </div>
      ) : null}
    </div>
  );
}
