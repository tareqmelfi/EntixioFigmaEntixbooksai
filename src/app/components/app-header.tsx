import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell, Settings, LogOut, Building2,
  CreditCard, Users, Lock, Activity, Star, ChevronDown, Mail, Menu, CheckCheck,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { authStore } from "./auth-store";
import { useOrgRegion } from "../lib/use-org-region";
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

export function AppHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const { language, toggleLanguage, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const authState = authStore.getState();
  const { isSA } = useOrgRegion();
  const currentCompanyName = authState.user?.company || t("الشركة الحالية", "Current company");
  const currentCompanyInitials = currentCompanyName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "E";

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
      {/* Gate 0 · country selects relevance only; it never proves a verified server connection. */}
      {isSA && (
      <div className="border-b border-warning-border bg-warning-subtle px-4 py-2 text-warning sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-warning" />
            <span className="truncate text-sm">{t("ZATCA Phase 2 — قيد التحقق", "ZATCA Phase 2 — Under validation")}</span>
          </div>
          <Link to="/app/settings?tab=zatca" className="shrink-0 text-xs font-semibold text-warning hover:underline">
            {t("مراجعة التفاصيل", "Review details")}
          </Link>
        </div>
      </div>
      )}

      <header className="border-b border-border bg-card px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* START side (right in RTL) · mobile menu only */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onMenuClick}
              className="lg:hidden rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t("القائمة", "Menu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden lg:block text-sm text-muted-foreground" />
          </div>

          {/* END side (left in RTL) · actions only */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleLanguage}
              className="hidden sm:flex items-center gap-1.5 rounded-md px-2 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("تغيير اللغة إلى الإنجليزية", "Switch language to Arabic")}
            >
              <span className={language === "ar" ? "font-english text-xs font-semibold" : "text-xs font-semibold"}>
                {language === "ar" ? "English" : "العربية"}
              </span>
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
                className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute end-1 top-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-english" style={{ fontWeight: 700 }}>{unreadCount}</span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute start-0 z-50 mt-1 w-80 rounded-lg border border-border bg-popover shadow-popover">
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
                          className={`flex gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-accent transition-colors cursor-pointer ${!n.readAt ? "bg-primary/5" : ""}`}
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
            <button className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
              <Mail className="h-5 w-5" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
                className="flex items-center gap-3 rounded-md border border-transparent px-2 py-1 hover:bg-accent transition-colors"
              >
                <div className="text-end">
                  <BidiText compact className="block max-w-48 text-sm font-medium leading-5 text-foreground">{authState.user?.name || t("مستخدم", "User")}</BidiText>
                  <div className="text-xs text-muted-foreground font-english">{authState.user?.email || "user@entix.io"}</div>
                </div>
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">ط</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {showProfile && (
                <div className="absolute end-0 z-50 mt-1 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-popover shadow-popover">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">ط</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t("حسابي", "My account")}</div>
                        <BidiText compact className="block max-w-56 text-xs leading-5 text-muted-foreground">{authState.user?.name || t("مستخدم", "User")}</BidiText>
                        <div className="text-xs text-muted-foreground font-english">{authState.user?.email || "user@entix.io"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Current company */}
                  <div className="px-4 py-2 border-b border-border">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary">
                          <span className="font-english text-xs text-primary-foreground" style={{ fontWeight: 700 }}>{currentCompanyInitials}</span>
                        </div>
                        <BidiText compact className="min-w-0 flex-1 text-sm leading-5 text-foreground" title={currentCompanyName}>{currentCompanyName}</BidiText>
                      </div>
                      <Link to="/app/settings?tab=company" onClick={() => setShowProfile(false)} className="shrink-0 text-xs text-primary hover:underline" style={{ fontWeight: 500 }}>
                        {t("تغيير", "Change")}
                      </Link>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link to="/app/settings?tab=company" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-foreground hover:bg-accent text-start transition-colors">
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("إعدادات المنشأة", "Company settings")}</span>
                      </button>
                    </Link>
                    <Link to="/app/billing" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-foreground hover:bg-accent text-start transition-colors">
                        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("الباقة والاشتراك", "Plan & billing")}</span>
                      </button>
                    </Link>
                    <Link to="/app/settings?tab=members" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-foreground hover:bg-accent text-start transition-colors">
                        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("إدارة ودعوة المستخدمين", "Manage users")}</span>
                      </button>
                    </Link>
                    <Link to="/app/fiscal-periods" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-foreground hover:bg-accent text-start transition-colors">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("إقفال الفترات", "Close periods")}</span>
                      </button>
                    </Link>
                  </div>

                  <div className="border-t border-border py-1">
                    <Link to="/app/billing" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-foreground hover:bg-accent text-start transition-colors">
                        <Settings className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("إدارة جميع اشتراكاتي", "Manage subscriptions")}</span>
                      </button>
                    </Link>
                    <Link to="/app/roadmap" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-foreground hover:bg-accent text-start transition-colors">
                        <Star className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal">{t("الطلب أو التصويت على ميزة", "Request or vote on a feature")}</span>
                      </button>
                    </Link>
                  </div>

                  <div className="border-t border-border py-1">
                    <Link to="/app/system-status" onClick={() => setShowProfile(false)}>
                      <button className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-foreground hover:bg-accent text-start transition-colors">
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
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-foreground hover:bg-accent text-start transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 whitespace-normal">{t("تسجيل الخروج من كل الأجهزة", "Sign out of all devices")}</span>
                    </button>
                    <button 
                      onClick={async () => {
                        await authStore.logout();
                        navigate("/login", { replace: true });
                      }}
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-sm leading-5 text-destructive hover:bg-destructive/10 text-start transition-colors cursor-pointer"
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
