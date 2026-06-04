import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Inbox, Mail, Monitor, RefreshCw, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, API_BASE_URL } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type CheckState = "checking" | "ok" | "warning" | "error";

type CheckItem = {
  id: string;
  title: string;
  description: string;
  state: CheckState;
  detail?: string;
  icon: typeof Activity;
};

function stateClasses(state: CheckState) {
  if (state === "ok") return "border-green-200 bg-green-50 text-green-700";
  if (state === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (state === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function stateLabel(state: CheckState, language: "ar" | "en") {
  const labels = {
    checking: { ar: "جاري الفحص", en: "Checking" },
    ok: { ar: "يعمل", en: "Operational" },
    warning: { ar: "يحتاج مراجعة", en: "Needs review" },
    error: { ar: "متوقف", en: "Down" },
  };
  return labels[state][language];
}

function StatusCard({ item, language }: { item: CheckItem; language: "ar" | "en" }) {
  const Icon = item.icon;
  const classes = stateClasses(item.state);

  return (
    <Card className="border-[#E5E7EB]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-lg bg-[#EFF6FF] p-2">
              <Icon className="h-5 w-5 text-[#1276E3]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#0B1B49]">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-[#6B7280]">{item.description}</p>
              {item.detail && <p className="mt-2 break-words text-xs text-[#374151]">{item.detail}</p>}
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${classes}`}>
            {stateLabel(item.state, language)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemStatus() {
  const { language, t } = useLanguage();
  const [apiState, setApiState] = useState<CheckState>("checking");
  const [apiDetail, setApiDetail] = useState("");
  const [emailState, setEmailState] = useState<CheckState>("checking");
  const [emailDetail, setEmailDetail] = useState("");
  const [inboxState, setInboxState] = useState<CheckState>("checking");
  const [inboxDetail, setInboxDetail] = useState("");
  const [checking, setChecking] = useState(false);

  const runChecks = useCallback(async () => {
    setChecking(true);
    setApiState("checking");
    setEmailState("checking");
    setInboxState("checking");

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      const res = await fetch(API_BASE_URL, { credentials: "include", signal: controller.signal });
      window.clearTimeout(timer);
      setApiState(res.ok ? "ok" : "warning");
      setApiDetail(`${API_BASE_URL} · HTTP ${res.status}`);
    } catch (e: any) {
      setApiState("error");
      setApiDetail(e?.name === "AbortError" ? "Request timed out" : "API health check failed");
    }

    try {
      const status = await api.email.status();
      setEmailState(status.configured ? "ok" : "warning");
      setEmailDetail(status.configured ? `${status.mode} · ${status.from}` : t("الإرسال غير مكتمل الإعداد", "Outbound email is not fully configured"));
    } catch {
      setEmailState("warning");
      setEmailDetail(t("تعذر قراءة حالة البريد من هذا الحساب", "Could not read email status from this account"));
    }

    try {
      const status = await api.inbox.status();
      setInboxState(status.configured && status.addressConfigured ? "ok" : "warning");
      setInboxDetail(status.address || t("صندوق الوارد لم يكتمل إعداده", "Inbox address is not fully configured"));
    } catch {
      setInboxState("warning");
      setInboxDetail(t("تعذر قراءة حالة صندوق الوارد من هذا الحساب", "Could not read inbox status from this account"));
    }

    setChecking(false);
  }, [t]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const checks = useMemo<CheckItem[]>(() => [
    {
      id: "web",
      title: t("واجهة التطبيق", "Web app"),
      description: t("الواجهة الحالية محملة من المتصفح وتستجيب.", "The current web app shell is loaded and responding."),
      state: "ok",
      icon: Monitor,
    },
    {
      id: "api",
      title: t("واجهة البرمجة API", "API"),
      description: t("فحص مباشر لنقطة تشغيل الخادم.", "Direct check against the server health endpoint."),
      state: apiState,
      detail: apiDetail,
      icon: Server,
    },
    {
      id: "email",
      title: t("إرسال البريد", "Outbound email"),
      description: t("يتحقق من إعداد إرسال الفواتير والتنبيهات.", "Checks invoice and notification sending configuration."),
      state: emailState,
      detail: emailDetail,
      icon: Mail,
    },
    {
      id: "inbox",
      title: t("صندوق الوارد", "Inbound inbox"),
      description: t("يتحقق من بريد استلام الفواتير والكشوف تلقائياً.", "Checks the inbox used to receive bills and statements automatically."),
      state: inboxState,
      detail: inboxDetail,
      icon: Inbox,
    },
  ], [apiDetail, apiState, emailDetail, emailState, inboxDetail, inboxState, t]);

  const hasIssues = checks.some((item) => item.state === "warning" || item.state === "error");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-bold text-[#0B1B49]">{t("حالة النظام", "System status")}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">{t("فحص سريع لأجزاء التشغيل الأساسية في ENTIX.IO.", "Quick check for the core ENTIX.IO operating surfaces.")}</p>
        </div>
        <Button onClick={runChecks} disabled={checking} variant="outline" className="border-[#D1D5DB]">
          <RefreshCw className={`me-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {t("إعادة الفحص", "Refresh")}
        </Button>
      </div>

      <Card className={hasIssues ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-[#0B1B49]">
            {hasIssues ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {hasIssues ? t("يوجد عناصر تحتاج مراجعة", "Some services need review") : t("الخدمات الأساسية تعمل", "Core services are operational")}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {checks.map((item) => (
          <StatusCard key={item.id} item={item} language={language} />
        ))}
      </div>
    </div>
  );
}
