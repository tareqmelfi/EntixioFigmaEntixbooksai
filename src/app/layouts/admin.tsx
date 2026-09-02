/**
 * Admin Console shell (Z2.1 · 2026-08-26) — standalone /admin/* layout.
 *
 * Platform admins never see the accounting sidebar, the company switcher or
 * any invoice/report link: they get an admin-only white sidebar, a compact
 * top bar with an «Admin» badge and the same session-expiry banner. Sections
 * map 1:1 to URLs so every screen is deep-linkable:
 *   /admin · /admin/orgs · /admin/users · /admin/subscriptions · /admin/support
 *   /admin/system (email · backups · agent · AI usage)
 * Non-admin sessions are bounced to /app (RequireInternal).
 */
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, Building2, Users, CreditCard, MessageSquare, Server, ShieldCheck, LogOut, Languages, Menu, X, Loader2, Tags, ScrollText, UserCog } from "lucide-react";
import { useAdminMe, SECTION_PERMISSION } from "../lib/use-admin-me";
import { useLanguage } from "../components/LanguageContext";
import { authStore } from "../components/auth-store";
import { SessionExpiredBanner } from "../components/session-expired-banner";

export const ADMIN_SECTIONS = [
  { key: "overview", path: "/admin", ar: "اللوحة", en: "Overview", icon: LayoutDashboard, end: true },
  { key: "orgs", path: "/admin/orgs", ar: "الشركات", en: "Companies", icon: Building2 },
  { key: "users", path: "/admin/users", ar: "المستخدمون", en: "Users", icon: Users },
  { key: "subscriptions", path: "/admin/subscriptions", ar: "الاشتراكات", en: "Subscriptions", icon: CreditCard },
  { key: "plans", path: "/admin/plans", ar: "الباقات", en: "Plans", icon: Tags },
  { key: "support", path: "/admin/support", ar: "الدعم", en: "Support", icon: MessageSquare },
  { key: "system", path: "/admin/system", ar: "النظام", en: "System", icon: Server },
  { key: "audit", path: "/admin/audit", ar: "سجل الأثر", en: "Audit trail", icon: ScrollText },
  { key: "team", path: "/admin/team", ar: "الفريق والصلاحيات", en: "Team & roles", icon: UserCog },
] as const;

export function AdminRoot() {
  const { language, t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [auth, setAuth] = useState(authStore.getState());
  const [menuOpen, setMenuOpen] = useState(false);
  const adminMe = useAdminMe();
  useEffect(() => authStore.subscribe(setAuth), []);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  if (auth.loading) return <div className="flex h-dvh items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!auth.isAuthenticated) return <Navigate to="/login" replace />;
  if (!auth.user?.isPlatformAdmin) return <Navigate to="/app" replace />;

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
      {ADMIN_SECTIONS.filter((s) => { const p = SECTION_PERMISSION[s.key]; return !p || adminMe.loading || adminMe.can(p); }).map((s) => (
        <NavLink
          key={s.key}
          to={s.path}
          end={"end" in s ? s.end : false}
          className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${isActive ? "bg-primary/10 text-primary font-semibold" : "text-foreground/80 hover:bg-muted hover:text-foreground"}`}
        >
          <s.icon className="h-4 w-4" />{language === "ar" ? s.ar : s.en}
        </NavLink>
      ))}
    </nav>
  );

  const sidebar = (
    <aside className="flex h-full w-64 shrink-0 flex-col border-e border-border bg-white">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <Link to="/admin" dir="ltr" lang="en" className="font-english text-foreground" style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.01em" }}>ENTIX<span className="text-primary">.IO</span></Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#0B1B49] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"><ShieldCheck className="h-3 w-3" />Admin</span>
        <button type="button" className="ms-auto lg:hidden text-muted-foreground" onClick={() => setMenuOpen(false)} aria-label="close"><X className="h-4 w-4" /></button>
      </div>
      {nav}
      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <div className="truncate font-english" dir="ltr">{auth.user?.email}</div>
        <div className="mt-0.5">{adminMe.me?.roleName ? (language === "ar" ? adminMe.me.roleName.ar : adminMe.me.roleName.en) : t("حساب داخلي", "Internal account")}{adminMe.me?.scopeAssigned ? ` · ${t("نطاق محدد", "scoped")} (${adminMe.me.assignedOrgIds?.length ?? 0})` : ""}</div>
      </div>
    </aside>
  );

  return (
    <div data-shell="admin" className="flex h-dvh w-full bg-canvas" dir={language === "ar" ? "rtl" : "ltr"}>
      {menuOpen && <div className="fixed inset-0 z-40 bg-overlay-scrim lg:hidden" onClick={() => setMenuOpen(false)} />}
      <div className="hidden lg:flex h-full">{sidebar}</div>
      <div className={`fixed inset-y-0 start-0 z-50 lg:hidden transition-transform ${menuOpen ? "translate-x-0" : language === "ar" ? "translate-x-full" : "-translate-x-full"}`}>{sidebar}</div>

      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-[#0B1B49] px-4 text-white">
          <button type="button" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="menu"><Menu className="h-5 w-5" /></button>
          <div className="text-sm font-semibold">{t("وحدة تحكم الإدارة", "Admin Console")}</div>
          <div className="text-xs text-white/60 hidden md:block">{t("كل إجراء يُسجَّل في سجل الأثر", "Every action is audit-logged")}</div>
          <div className="ms-auto flex items-center gap-1">
            <button type="button" onClick={toggleLanguage} className="rounded-md px-2 py-1 text-xs hover:bg-white/10 inline-flex items-center gap-1" title={t("English", "العربية")}><Languages className="h-3.5 w-3.5" />{language === "ar" ? "EN" : "AR"}</button>
            <button type="button" onClick={async () => { await authStore.logout(); navigate("/login", { replace: true }); }} className="rounded-md px-2 py-1 text-xs hover:bg-white/10 inline-flex items-center gap-1"><LogOut className="h-3.5 w-3.5" />{t("خروج", "Sign out")}</button>
          </div>
        </header>
        <SessionExpiredBanner />
        <main className="flex-1 overflow-auto p-[var(--page-gutter)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** /app/admin/* → /admin/* (old bookmarks · one month, then remove). */
export function LegacyAdminRedirect() {
  const location = useLocation();
  const target = location.pathname.replace(/^\/app\/admin/, "/admin") + location.search;
  return <Navigate to={target} replace />;
}
