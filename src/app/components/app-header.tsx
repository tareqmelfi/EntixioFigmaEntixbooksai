import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell, Settings, LogOut, Building2,
  CreditCard, Users, Lock, Activity, Star, ChevronDown, Mail, Menu, CheckCheck
} from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { authStore } from "./auth-store";
import { api, NotificationItem } from "../lib/api";
import { OrgSwitcher } from "./org-switcher";
import { useLanguage } from "./LanguageContext";

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
    <header className="border-b border-[#E5E7EB] bg-white px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* START side (right in RTL) · mobile menu only · org info lives in sidebar (UX-169) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden rounded-md p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
            title={t("القائمة", "Menu")}
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Page title slot · could show breadcrumb later */}
          <div className="hidden lg:block text-sm text-[#6B7280]" />
        </div>

        {/* END side (left in RTL) · actions only · ENTIX.IO wordmark moved to sidebar header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleLanguage}
            className="hidden sm:flex items-center gap-1.5 rounded-md px-2 py-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
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
              className="relative rounded-md p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute end-1 top-1 h-4 w-4 rounded-full bg-[#EF4444] text-white text-[10px] flex items-center justify-center font-english" style={{ fontWeight: 700 }}>{unreadCount}</span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute start-0 z-50 mt-1 w-80 rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
                  <span className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>
                    {t("الإشعارات", "Notifications")}{unreadCount > 0 && <span className="ms-2 text-xs text-[#1276E3] font-english">({unreadCount})</span>}
                  </span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-[#1276E3] hover:underline">
                      <CheckCheck className="h-3 w-3" /> {t("تحديد الكل كمقروء", "Mark all read")}
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-sm text-[#9CA3AF]">{t("لا توجد إشعارات", "No notifications")}</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`flex gap-3 px-4 py-3 border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer ${!n.readAt ? "bg-[#EFF6FF]/30" : ""}`}
                      >
                        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? "bg-[#1276E3]" : "bg-transparent"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#0B1B49]" style={{ fontWeight: !n.readAt ? 600 : 400 }}>{n.title}</p>
                          {n.body && <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-2">{n.body}</p>}
                          <p className="text-xs text-[#9CA3AF] mt-1">{timeAgo(n.createdAt, language)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-4 py-2 border-t border-[#F3F4F6]">
                  <Link to="/app/notifications" onClick={() => setShowNotifications(false)} className="block w-full text-center text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>
                    {t("عرض كل الإشعارات", "View all notifications")}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Inbox */}
          <button className="relative rounded-md p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49]">
            <Mail className="h-5 w-5" />
          </button>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
              className="flex items-center gap-3 rounded-md border border-transparent px-2 py-1 hover:bg-[#F3F4F6] transition-colors"
            >
              <div className="text-end">
                <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>{authState.user?.name || t("مستخدم", "User")}</div>
                <div className="text-xs text-[#6B7280] font-english">{authState.user?.email || "user@entix.io"}</div>
              </div>
              <Avatar>
                <AvatarFallback className="bg-[#1276E3] text-white">ط</AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-[#9CA3AF]" />
            </button>

            {showProfile && (
              <div className="absolute start-0 z-50 mt-1 w-72 rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-[#F3F4F6]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-[#1276E3] text-white text-lg">ط</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{t("حسابي", "My account")}</div>
                      <div className="text-xs text-[#6B7280]">{authState.user?.name || t("مستخدم", "User")}</div>
                      <div className="text-xs text-[#9CA3AF] font-english">{authState.user?.email || "user@entix.io"}</div>
                    </div>
                  </div>
                </div>

                {/* Company */}
                <div className="px-4 py-2 border-b border-[#F3F4F6]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-[#1276E3]">
                        <span className="font-english text-xs text-white" style={{ fontWeight: 700 }}>EB</span>
                      </div>
                      <span className="text-sm text-[#374151] truncate" style={{ maxWidth: "150px" }}>{t("شركة Entix Books العالمية", "Entix Books Global")}</span>
                    </div>
                    <button className="text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>{t("تغيير", "Change")}</button>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link to="/app/settings" onClick={() => setShowProfile(false)}>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                      <Building2 className="h-4 w-4 text-[#6B7280]" />{t("إعدادات المنشأة", "Company settings")}
                    </button>
                  </Link>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <CreditCard className="h-4 w-4 text-[#6B7280]" />{t("الباقة والاشتراك", "Plan & billing")}
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <Users className="h-4 w-4 text-[#6B7280]" />{t("إدارة ودعوة المستخدمين", "Manage users")}
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <Lock className="h-4 w-4 text-[#6B7280]" />{t("إقفال الفترات", "Close periods")}
                  </button>
                </div>

                <div className="border-t border-[#F3F4F6] py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <Settings className="h-4 w-4 text-[#6B7280]" />{t("إدارة جميع اشتراكاتي", "Manage subscriptions")}
                  </button>
                  <Link to="/app/roadmap" onClick={() => setShowProfile(false)}>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                      <Star className="h-4 w-4 text-[#6B7280]" />{t("الطلب أو التصويت على ميزة", "Request or vote on a feature")}
                    </button>
                  </Link>
                </div>

                <div className="border-t border-[#F3F4F6] py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <Activity className="h-4 w-4 text-[#22C55E]" />{t("حالة النظام", "System status")}
                  </button>
                </div>

                <div className="border-t border-[#F3F4F6] py-1">
                  <button 
                    onClick={() => { authStore.logout(); navigate("/"); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />{t("تسجيل الخروج", "Sign out")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
