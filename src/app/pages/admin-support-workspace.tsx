import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { MessageSquare, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { api, ApiError, type AdminSupportWorkspace } from "../lib/api";
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

type WorkspaceTab = "messages" | "attachments";

const TABS: WorkspaceTab[] = ["messages", "attachments"];

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB");
}

function parseTab(raw: string | null): WorkspaceTab {
  if (raw && TABS.includes(raw as WorkspaceTab)) return raw as WorkspaceTab;
  return "messages";
}

export function AdminSupportWorkspacePage() {
  const { t } = useLanguage();
  const { threadId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const [viewState, setViewState] = useState<AdminWorkspaceViewState>("loading");
  const [workspace, setWorkspace] = useState<AdminSupportWorkspace | null>(null);

  const load = useCallback(async () => {
    setViewState("loading");
    try {
      const data = await api.admin.supportDetail(threadId);
      setWorkspace(data);
      setViewState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return setViewState("session");
      if (err instanceof ApiError && err.status === 403) return setViewState("forbidden");
      if (err instanceof ApiError && err.status === 404) return setViewState("notFound");
      setViewState("failed");
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (viewState === "loading") return <AdminWorkspaceLoading />;

  if (viewState === "session") {
    return (
      <AdminWorkspaceStateCard
        title={t("انتهت الجلسة", "Session required")}
        body={t("سجّل الدخول مرة ثانية للوصول إلى صفحة الدعم.", "Please sign in again to access this support workspace.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
      />
    );
  }

  if (viewState === "forbidden") {
    return (
      <AdminWorkspaceStateCard
        title={t("غير متاح لهذا الحساب", "Access unavailable")}
        body={t("هذه مساحة دعم أدمن وغير متاحة لحسابك الحالي.", "This admin support workspace is unavailable for your current account.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
      />
    );
  }

  if (viewState === "notFound") {
    return (
      <AdminWorkspaceStateCard
        title={t("محادثة الدعم غير متاحة", "Support thread not found")}
        body={t("تعذر العثور على محادثة الدعم المطلوبة.", "The requested support thread could not be found.")}
        backLabel={t("العودة إلى لوحة الأدمن", "Back to admin dashboard")}
        notFoundId={threadId}
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
    <div className="space-y-5 max-w-6xl">
      <div className="space-y-1">
        <AdminWorkspaceBackLink label={t("رجوع للوحة الأدمن", "Back to admin")} />
        <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          <MessageSquare className="h-5 w-5 text-primary" />{summary.title || t("محادثة دعم", "Support thread")}
        </h1>
        <p className="text-sm text-muted-foreground font-english" dir="ltr">{summary.id}</p>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-base text-foreground">{t("الروابط", "Links")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <Link to={`/admin/users/${summary.user.id}`} data-testid={`support-user-link-${summary.user.id}`} className="text-primary hover:underline">{summary.user.email}</Link>
          <span className="text-muted-foreground">·</span>
          <Link to={`/admin/orgs/${summary.org.id}`} data-testid={`support-org-link-${summary.org.id}`} className="text-primary hover:underline">{summary.org.name}</Link>
        </CardContent>
      </Card>

      <nav aria-label="Support workspace tabs" className="flex gap-1.5 rounded-lg bg-muted/60 p-1 w-fit">
        {TABS.map((id) => {
          const active = tab === id;
          const label = id === "messages" ? t("الرسائل", "Messages") : t("المرفقات", "Attachments");
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

      {tab === "messages" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground">{t("الرسائل", "Messages")}</CardTitle></CardHeader>
          <CardContent>
            {workspace.messages.availability !== "available" ? (
              <UnavailableSection title={t("الرسائل", "Messages")} reason={workspace.messages.unavailableReason} />
            ) : workspace.messages.data.items.length === 0 ? (
              <EmptySection text={t("لا توجد رسائل.", "No messages in this thread.")} />
            ) : (
              <div className="space-y-2">
                {workspace.messages.data.items.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">{row.role}</div>
                      <div className="text-[11px] text-muted-foreground font-english" dir="ltr">{fmtDate(row.createdAt)}</div>
                    </div>
                    <div className="text-sm text-foreground mt-1 whitespace-pre-wrap">{row.content}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "attachments" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Paperclip className="h-4 w-4" />{t("المرفقات", "Attachments")}</CardTitle></CardHeader>
          <CardContent>
            {workspace.attachments.availability !== "available" ? (
              <UnavailableSection title={t("المرفقات", "Attachments")} reason={workspace.attachments.unavailableReason} />
            ) : (
              <EmptySection text={t("لا توجد مرفقات.", "No attachments.")} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
