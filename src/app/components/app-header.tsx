import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell, Settings, LogOut, Building2,
  CreditCard, Users, Lock, Activity, Star, ChevronDown, Mail, Menu, CheckCheck,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { authStore } from "./auth-store";
import { useOrgRegion } from "../lib/use-org-region";
import { useZatcaStatus, type ZatcaStatus } from "../lib/use-zatca-status";
import { zatcaStatusLabel } from "./zatca-status-badge";
import { api, NotificationItem } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { BidiText } from "./bidi-text";

function timeAgo(iso: string, language: "ar" | "en"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return language === "ar" ? "الآن" : "now";
  if (m < 60) return language === "ar" ? `منذ ${m} دقيقة` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return language === "ar" ? `منذ ${h} ساعة` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return language === "ar" ? `منذ ${d} يوم` : `${d}d ago`;
}

/** Secondary ZATCA facts that used to occupy the strip now live in the pill tooltip. */
function zatcaPillDetail(zatca: ZatcaStatus, t: (ar: string, en: string) => string): string {
  const parts: string[] = [];
  if (zatca.raw?.deviceProof?.companyName) parts.push(zatca.raw.deviceProof.companyName);
  if (zatca.connection === "connected" && zatca.submission === "live") {
    parts.push(zatca.raw?.deviceProof?.delivery?.needsReview
      ? t("الإرسال مفعّل · توجد فواتير تحتاج معالجة", "Submission active · invoices need attention")
      : t("الإرسال التلقائي مفعّل · حالة كل فاتورة محفوظة", "Automatic submission active · each invoice has a saved status"));
  }
  if (zatca.connection === "connected" && zatca.submission === "frozen") {
    parts.push(zatca.raw?.deviceProof?.lastAcceptedInvoice
      ? t("تم قبول فاتورة إنتاجية · راجع حالة الإرسال", "Production invoice accepted · review submission status")
      : t("إرسال الفواتير غير مفعّل بعد · شهادة الجهاز مستقلة عن قبول الفواتير", "Invoice submission is not active yet · device onboarding is separate from invoice acceptance"));
  }
  parts.push(zatca.connection === "connected" ? t("التفاصيل", "Details") : zatca.connection === "in_progress" ? t("إكمال الربط", "Continue linking") : t("ابدأ الربط", "Start linking"));
  return parts.join(" · ");
}

export function AppHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const authState = authStore.getState();
  const { isSA } = useOrgRegion();
  const zatca = useZatcaStatus(isSA);

  // "آخر تحقق 12:33" only when the status hook actually carries a checked-at
  // stamp — never a fabricated time.
  const checkedAtIso = zatca.raw?.deviceProof?.checkedAt;
  const checkedAtLabel = (() => {
    if (!checkedAtIso) return "";
    const d = new Date(checkedAtIso);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  })();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        api.notifications.list({ limit: 15 }),
        api.notifications.count(),
      ]);
      setNotifications(list.items);
      setUnreadCount(count.unread);
    } catch (e) {
      console.error("[notifications] fetch failed", e);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNotifClick = async (n: NotificationItem) => {
    setShowNotifications(false);
    if (!n.readAt) {
      try {
        await api.notifications.markRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((arr) => arr.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      } catch {}
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setUnreadCount(0);
      setNotifications((arr) => arr.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    } catch {}
  };

  return (
    <>
      <header className="h-[64px] shrink-0 border-b border-border bg-background px-4 sm:px-[40px]">
        <div className="flex h-full items-center justify-between gap-3">
          {/* START side (right in RTL) · mobile menu only */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={onMenuClick}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
              title={t("القائمة", "Menu")}
            >
              <Menu className="h-[20px] w-[20px]" strokeWidth={1.75} />
            </button>
            {/* ZATCA pill (Ledger, 2026-09) · replaces the full-width strip. Per-org truth
                unchanged: dot + word from /api/zatca/onboarding/status. Colour never carries
                the meaning alone — ok = blue, linking = copper, not started = muted. */}
            {isSA && (
              <Link
                to="/app/settings?tab=zatca"
                data-zatca-connection={zatca.connection}
                title={zatcaPillDetail(zatca, t)}
                className={`inline-flex max-w-[60vw] items-center gap-[8px] rounded-full py-[6px] ps-[8px] pe-[12px] text-[12px] font-semibold leading-[15px] transition-colors ${
                  zatca.connection === "connected"
                    ? "bg-info-subtle text-info hover:bg-info-subtle/70"
                    : zatca.connection === "in_progress"
                      ? "bg-warning-subtle text-warning hover:bg-warning-subtle/70"
                      : "bg-muted text-muted-foreground hover:bg-surface-hover"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-[8px] w-[8px] shrink-0 rounded-full ${
                    zatca.connection === "connected"
                      ? "bg-info shadow-[0_0_0_3px_var(--focus-ring)]"
                      : zatca.connection === "in_progress"
                        ? "bg-warning"
                        : "bg-muted-foreground/60"
                  }`}
                />
                <span className="font-code shrink-0" dir="ltr" lang="en">ZATCA</span>
                {/* On phones the reference shows the mark + dot only — the word
                    lives in the tooltip and on /app/settings?tab=zatca. */}
                <span className="hidden truncate sm:inline">{zatcaStatusLabel(zatca, t)}</span>
              </Link>
            )}
            {isSA && checkedAtLabel && (
              <span className="hidden text-[13px] leading-[16px] text-muted-foreground sm:inline">
                {t("آخر تحقق", "Last check")} <span className="font-english" dir="ltr">{checkedAtLabel}</span>
              </span>
            )}
          </div>

          {/* END side (left in RTL) · actions only */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-[6px]">
            {/* Notifications · reference order (reading from the start edge):
                bell, mail, then the user block. */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
                className="relative rounded-lg p-1.5 text-foreground transition-colors hover:bg-surface-hover"
              >
                <Bell className="h-[20px] w-[20px]" strokeWidth={1.6} />
                {unreadCount > 0 && (
                  <span className="absolute end-1 top-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-english" style={{ fontWeight: 700 }}>{unreadCount}</span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute start-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-popover">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                      {t("الإشعارات", "Notifications")}{unreadCount > 0 && <span className="ms-2 text-xs text-primary font-english">({unreadCount})</span>}
                    </span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <CheckCheck className="h-3 w-3" /> {t("تحديد الكل كمقروء", "Mark all read")}
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">{t("لا توجد إشعارات", "No notifications")}</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={`flex gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-hover transition-colors cursor-pointer ${!n.readAt ? "bg-primary/5" : ""}`}
                        >
                          <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? "bg-primary" : "bg-transparent"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground" style={{ fontWeight: !n.readAt ? 600 : 400 }}>{n.title}</p>
                            {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                            <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt, language)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-border">
                    <Link to="/app/notifications" onClick={() => setShowNotifications(false)} className="block w-full text-center text-xs text-primary hover:underline" style={{ fontWeight: 500 }}>
                      {t("عرض كل الإشعارات", "View all notifications")}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Inbox */}
            <button className="relative rounded-lg p-1.5 text-foreground transition-colors hover:bg-surface-hover">
              <Mail className="h-[20px] w-[20px]" strokeWidth={1.6} />
            </button>

            {/* Profile Dropdown · reference puts the name/email first and the
                round 34px avatar on the far end. */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
                className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1 transition-colors hover:bg-surface-hover"
              >
                <div className="hidden text-end sm:block">
                  <BidiText compact className="block max-w-48 text-[13px] font-semibold leading-5 text-foreground">{authState.user?.name || t("مستخدم", "User")}</BidiText>
                  <div className="font-english text-[11px] leading-4 text-muted-foreground">{authState.user?.email || "user@entix.io"}</div>
                </div>
                <Avatar className="h-[34px] w-[34px]">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[13px]" style={{ fontWeight: 600 }}>{(authState.user?.name || "U").trim().charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
              </button>

              {showProfile && (
                <div className="absolute end-0 z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-card shadow-popover">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">{(authState.user?.name || "U").trim().charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t("حسابي", "My account")}</div>
                        <BidiText compact className="block max-w-56 text-xs leading-5 text-muted-foreground">{authState.user?.name || t("مستخدم", "User")}</BidiText>
                        <div className="text-xs text-muted-foreground font-english">{authState.user?.email || "user@entix.io"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Company row + «Change» removed (CEO 2026-08-25): the sidebar
                      switcher is the single place to change company. */}
                  {/* Menu Items */}
                  <div className="py-1">
                    <Link to="/app/settings?tab=company" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-foreground hover:bg-surface-hover text-start transition-colors">
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("إعدادات المنشأة", "Company settings")}</span>
                      </button>
                    </Link>
                    <Link to="/app/billing" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-start transition-colors bg-info-subtle hover:bg-info-subtle/70 border-y border-info-border text-info">
                        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                        <span className="min-w-0 flex-1 whitespace-normal" style={{ fontWeight: 700 }}>{t("الباقة والاشتراك", "Plan & billing")}</span>
                        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground" style={{ fontWeight: 700 }}>
                          {t("وفّر حتى 20% سنويًا", "Save up to 20% yearly")}
                        </span>
                      </button>
                    </Link>
                    <Link to="/app/settings?tab=members" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-foreground hover:bg-surface-hover text-start transition-colors">
                        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("إدارة ودعوة المستخدمين", "Manage users")}</span>
                      </button>
                    </Link>
                    <Link to="/app/fiscal-periods" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-foreground hover:bg-surface-hover text-start transition-colors">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("إقفال الفترات", "Close periods")}</span>
                      </button>
                    </Link>
                  </div>

                  <div className="border-t border-border py-1">
                    <Link to="/app/billing" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-foreground hover:bg-surface-hover text-start transition-colors">
                        <Settings className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("إدارة جميع اشتراكاتي", "Manage subscriptions")}</span>
                      </button>
                    </Link>
                    <Link to="/app/roadmap" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-foreground hover:bg-surface-hover text-start transition-colors">
                        <Star className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("الطلب أو التصويت على ميزة", "Request or vote on a feature")}</span>
                      </button>
                    </Link>
                  </div>

                  <div className="border-t border-border py-1">
                    <Link to="/app/system-status" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-foreground hover:bg-surface-hover text-start transition-colors">
                        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span className="min-w-0 flex-1 whitespace-normal">{t("حالة النظام", "System status")}</span>
                      </button>
                    </Link>
                  </div>

                  <div className="border-t border-border py-1">
                    <button
                      onClick={async () => {
                        await authStore.logoutEverywhere();
                        navigate("/login", { replace: true });
                      }}
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-foreground hover:bg-surface-hover text-start transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 whitespace-normal">{t("تسجيل الخروج من كل الأجهزة", "Sign out of all devices")}</span>
                    </button>
                    <button 
                      onClick={async () => {
                        await authStore.logout();
                        navigate("/login", { replace: true });
                      }}
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-[13px] leading-5 text-destructive hover:bg-destructive/10 text-start transition-colors cursor-pointer"
                    >
                      <LogOut className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 whitespace-normal">{t("تسجيل الخروج", "Sign out")}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
