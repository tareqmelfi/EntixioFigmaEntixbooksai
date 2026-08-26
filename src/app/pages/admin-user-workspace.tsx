import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { KeyRound, Loader2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { api, ApiError, type AdminUserWorkspace } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import {
  AdminWorkspaceBackLink,
  AdminWorkspaceFailedCard,
  AdminWorkspaceLoading,
  AdminWorkspaceStateCard,
  type AdminWorkspaceViewState,
  EmptySection,
  UnavailableSection,
} from "../components/admin-workspace-shell";

type WorkspaceTab = "overview" | "memberships" | "auth";

const TABS: WorkspaceTab[] = ["overview", "memberships", "auth"];

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB");
}

function parseTab(raw: string | null): WorkspaceTab {
  if (raw && TABS.includes(raw as WorkspaceTab)) return raw as WorkspaceTab;
  return "overview";
}

export function AdminUserWorkspacePage() {
  const { t } = useLanguage();
  const { userId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const [viewState, setViewState] = useState<AdminWorkspaceViewState>("loading");
  const [workspace, setWorkspace] = useState<AdminUserWorkspace | null>(null);

  const load = useCallback(async () => {
    setViewState("loading");
    try {
      const data = await api.admin.userDetail(userId);
      setWorkspace(data);
      setViewState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return setViewState("session");
      if (err instanceof ApiError && err.status === 403) return setViewState("forbidden");
      if (err instanceof ApiError && err.status === 404) return setViewState("notFound");
      setViewState("failed");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (viewState === "loading") return <AdminWorkspaceLoading />;

  if (viewState === "session") {
    return (
      <AdminWorkspaceStateCard
        title={t("انتهت الجلسة", "Session required")}
        body={t("سجّل الدخول مرة ثانية للوصول إلى صفحة المستخدم.", "Please sign in again to access this user workspace.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
      />
    );
  }

  if (viewState === "forbidden") {
    return (
      <AdminWorkspaceStateCard
        title={t("غير متاح لهذا الحساب", "Access unavailable")}
        body={t("هذه مساحة مستخدم أدمن وغير متاحة لحسابك الحالي.", "This admin user workspace is unavailable for your current account.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
      />
    );
  }

  if (viewState === "notFound") {
    return (
      <AdminWorkspaceStateCard
        title={t("المستخدم غير متاح", "User not found")}
        body={t("تعذر العثور على المستخدم المطلوب.", "The requested user could not be found.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
        notFoundId={userId}
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
  const membershipsPage = workspace.memberships.availability === "available" && workspace.memberships.data && Array.isArray(workspace.memberships.data.items)
    ? workspace.memberships.data
    : null;
  const authProvidersPage = workspace.authProviders.availability === "available" && workspace.authProviders.data && Array.isArray(workspace.authProviders.data.items)
    ? workspace.authProviders.data
    : null;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="space-y-1">
        <AdminWorkspaceBackLink label={t("رجوع للوحة الأدمن", "Back to admin")} />
        <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          <User className="h-5 w-5 text-primary" />{summary.email}
        </h1>
        <p className="text-sm text-muted-foreground">{summary.name || "—"} · {summary.emailVerified ? t("موثق", "Verified") : t("غير موثق", "Unverified")}</p>
      </div>

      <nav aria-label="User workspace tabs" className="flex gap-1.5 rounded-lg bg-muted/60 p-1 w-fit">
        {TABS.map((id) => {
          const active = tab === id;
          const label = id === "overview"
            ? t("نظرة عامة", "Overview")
            : id === "memberships"
              ? t("العضويات", "Memberships")
              : t("مزودات الدخول", "Auth providers");
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
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground">{t("ملخص المستخدم", "User summary")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">{t("المعرف", "ID")}: </span><span className="font-english" dir="ltr">{summary.id}</span></div>
            <div><span className="text-muted-foreground">Locale: </span><span className="font-english" dir="ltr">{summary.locale}</span></div>
            <div><span className="text-muted-foreground">{t("تاريخ الإنشاء", "Created")}: </span><span className="font-english" dir="ltr">{fmtDate(summary.createdAt)}</span></div>
          </CardContent>
        </Card>
      )}

      {tab === "memberships" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground">{t("العضويات", "Memberships")}</CardTitle></CardHeader>
          <CardContent>
            {workspace.memberships.availability !== "available" ? (
              <UnavailableSection title={t("العضويات", "Memberships")} reason={workspace.memberships.unavailableReason} />
            ) : !membershipsPage || membershipsPage.items.length === 0 ? (
              <EmptySection text={t("لا توجد عضويات.", "No memberships found.")} />
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-2 text-start font-medium">{t("المنشأة", "Organization")}</th><th className="px-3 py-2 text-start font-medium">{t("الدور", "Role")}</th><th className="px-3 py-2 text-start font-medium">{t("انضم", "Joined")}</th></tr></thead>
                <tbody>
                  {membershipsPage.items.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <Link to={`/admin/orgs/${row.org.id}`} data-testid={`user-membership-org-link-${row.org.id}`} className="text-foreground hover:underline">{row.org.name}</Link>
                          <Link to={`/admin/subscribers/${row.org.id}`} data-testid={`user-membership-subscriber-link-${row.org.id}`} className="text-xs text-primary hover:underline">{t("الاشتراك", "Subscriber")}</Link>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-english" dir="ltr">{row.org.slug} · {row.org.country}</div>
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

      {tab === "auth" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><KeyRound className="h-4 w-4" />{t("مزودات الدخول", "Auth providers")}</CardTitle></CardHeader>
          <CardContent>
            {workspace.authProviders.availability !== "available" ? (
              <UnavailableSection title={t("مزودات الدخول", "Auth providers")} reason={workspace.authProviders.unavailableReason} />
            ) : !authProvidersPage || authProvidersPage.items.length === 0 ? (
              <EmptySection text={t("لا توجد مزودات دخول مرتبطة.", "No auth providers are linked.")} />
            ) : (
              <div className="space-y-2">
                {authProvidersPage.items.map((row) => (
                  <div key={`${row.providerId}-${row.createdAt}`} className="rounded-lg border border-border p-3">
                    <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{row.providerId}</div>
                    <div className="text-xs text-muted-foreground font-english" dir="ltr">{fmtDate(row.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(membershipsPage?.hasMore === true || authProvidersPage?.hasMore === true) ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5" />
          <span>{t("هذه الصفحة تعرض أول دفعة فقط (قراءة فقط، بدون أي تعديل).", "This page currently shows the first batch only (read-only, no mutations).")}</span>
        </div>
      ) : null}
    </div>
  );
}
