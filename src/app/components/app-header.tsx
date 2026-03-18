import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import {
  Bell, Globe, Settings, LogOut, User, Building2,
  CreditCard, Users, Lock, Activity, Star, ChevronDown, Mail, Menu
} from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";

export function AppHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const notifications = [
    { id: 1, text: "فاتورة INV-2026-015 متأخرة 3 أيام", time: "منذ ساعة", read: false },
    { id: 2, text: "تم استلام دفعة من شركة التقنية المتقدمة", time: "منذ 3 ساعات", read: false },
    { id: 3, text: "المخزون منخفض: ورق طباعة A4", time: "منذ يوم", read: true },
    { id: 4, text: "دورة الرواتب لشهر فبراير جاهزة للمراجعة", time: "منذ يومين", read: true },
  ];
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="border-b border-[#E5E7EB] bg-white px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left side in RTL */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile menu button */}
          <button 
            onClick={onMenuClick}
            className="lg:hidden rounded-md p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <button className="hidden sm:block rounded-md p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49]">
            <Globe className="h-5 w-5" />
          </button>
        </div>

        {/* Right side in RTL = notifications + profile */}
        <div className="flex items-center gap-2 sm:gap-3">
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
                  <span className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>الإشعارات</span>
                  <button className="text-xs text-[#1276E3] hover:underline">تحديد الكل كمقروء</button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer ${!n.read ? "bg-[#EFF6FF]/30" : ""}`}>
                      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.read ? "bg-[#1276E3]" : "bg-transparent"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#374151]">{n.text}</p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-[#F3F4F6]">
                  <button className="w-full text-center text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>عرض كل الإشعارات</button>
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
                <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>طارق ملفي</div>
                <div className="text-xs text-[#6B7280] font-english">tareq@entix.io</div>
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
                      <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>حسابي</div>
                      <div className="text-xs text-[#6B7280]">طارق ملفي</div>
                      <div className="text-xs text-[#9CA3AF] font-english">tareq@entix.io</div>
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
                      <span className="text-sm text-[#374151] truncate" style={{ maxWidth: "150px" }}>شركة Entix Books العالمية</span>
                    </div>
                    <button className="text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>تغيير</button>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link to="/settings" onClick={() => setShowProfile(false)}>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                      <Building2 className="h-4 w-4 text-[#6B7280]" />إعدادات المنشأة
                    </button>
                  </Link>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <CreditCard className="h-4 w-4 text-[#6B7280]" />الباقة والاشتراك
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <Users className="h-4 w-4 text-[#6B7280]" />إدارة ودعوة المستخدمين
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <Lock className="h-4 w-4 text-[#6B7280]" />إقفال الفترات
                  </button>
                </div>

                <div className="border-t border-[#F3F4F6] py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <Settings className="h-4 w-4 text-[#6B7280]" />إدارة جميع اشتراكاتي
                  </button>
                  <Link to="/roadmap" onClick={() => setShowProfile(false)}>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                      <Star className="h-4 w-4 text-[#6B7280]" />الطلب أو التصويت على ميزة
                    </button>
                  </Link>
                </div>

                <div className="border-t border-[#F3F4F6] py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start transition-colors">
                    <Activity className="h-4 w-4 text-[#22C55E]" />حالة النظام
                  </button>
                </div>

                <div className="border-t border-[#F3F4F6] py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start transition-colors">
                    <LogOut className="h-4 w-4" />تسجيل الخروج
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