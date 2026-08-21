import { Outlet, useLocation } from "react-router";
import { AppSidebar, SidebarMode } from "../components/app-sidebar";
import { AppHeader } from "../components/app-header";
import { useState, useEffect, useRef, useCallback } from "react";
import { PanelRightOpen, MailWarning, Loader2 } from "lucide-react";
import { useLanguage } from "../components/LanguageContext";
import { authStore } from "../components/auth-store";

/**
 * Soft-gate banner (2026-08-21): signup lets users in immediately; this
 * persistent strip is what nags them to verify. Disappears the moment the
 * account is verified. Unverified accounts auto-purge after 30 days.
 */
function UnverifiedEmailBanner() {
  const { t } = useLanguage();
  const [auth, setAuth] = useState(authStore.getState());
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => authStore.subscribe(setAuth), []);

  if (auth.loading || !auth.isAuthenticated || auth.user?.emailVerified !== false) return null;
  const email = auth.user!.email;

  return (
    <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-800">
      <MailWarning className="h-4 w-4 shrink-0" />
      <span>
        {t("بريدك غير مفعّل — فعّله لحماية حسابك (تُحذف الحسابات غير المفعّلة بعد 30 يومًا)", "Your email is unverified — verify it to protect your account (unverified accounts are removed after 30 days)")}
      </span>
      {sent ? (
        <span className="font-medium">{t("أُرسل الرابط ✓", "Link sent ✓")}</span>
      ) : (
        <button
          onClick={async () => {
            setBusy(true);
            try {
              await authStore.resendVerificationEmail(email);
              setSent(true);
            } finally { setBusy(false); }
          }}
          disabled={busy}
          className="font-semibold underline underline-offset-2 hover:text-amber-900 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : t("إرسال رابط التفعيل", "Send verification link")}
        </button>
      )}
    </div>
  );
}

export function Root() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { language, t } = useLanguage();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("entix-sidebar-mode");
      if (saved === "pinned" || saved === "auto" || saved === "hidden") return saved;
    }
    return "pinned";
  });
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location.pathname]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleModeChange = useCallback((mode: SidebarMode) => {
    setSidebarMode(mode);
    localStorage.setItem("entix-sidebar-mode", mode);
  }, []);

  // Zero-org accounts (fresh signup) belong to the /welcome chooser, not the
  // app shell — deep links included.
  const [authState, setAuthState] = useState(authStore.getState());
  useEffect(() => authStore.subscribe(setAuthState), []);
  useEffect(() => {
    if (!authState.loading && authState.isAuthenticated && authState.needsOnboarding) {
      window.location.replace("/welcome");
    }
  }, [authState.loading, authState.isAuthenticated, authState.needsOnboarding]);
  if (authState.isAuthenticated && authState.needsOnboarding) return null;

  return (
    <div data-shell="app" className="flex h-dvh w-full bg-canvas" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay-scrim lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Auto-mode hover trigger */}
      {sidebarMode === "auto" && !isSidebarOpen && (
        <div
          className="hidden lg:block fixed top-0 end-0 w-3 h-full z-40"
          onMouseEnter={() => setIsSidebarOpen(true)}
        />
      )}

      {/* Static sidebar (pinned mode, desktop only) */}
      {sidebarMode === "pinned" && (
        <div className="hidden lg:flex shrink-0 h-full">
          <AppSidebar
            isOpen={true}
            onClose={() => {}}
            mode={sidebarMode}
            onModeChange={handleModeChange}
            isStatic
          />
        </div>
      )}

      {/* Floating sidebar (mobile always + desktop auto/hidden) */}
      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        mode={sidebarMode}
        onModeChange={handleModeChange}
        isStatic={false}
        className={sidebarMode === "pinned" ? "lg:hidden" : ""}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <AppHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <UnverifiedEmailBanner />
        <main ref={mainRef} className="flex-1 overflow-auto p-[var(--page-gutter)]">
          <Outlet />
        </main>
      </div>

      {/* Floating button when sidebar is hidden */}
      {sidebarMode === "hidden" && (
        <button
          onClick={() => handleModeChange("pinned")}
          className="fixed end-4 top-4 z-30 hidden items-center gap-1.5 rounded-lg border bg-surface px-3 py-2 text-xs text-muted-foreground shadow-raised transition-colors hover:bg-surface-hover hover:text-foreground lg:flex"
          title={t("إظهار القائمة", "Show sidebar")}
        >
          <PanelRightOpen className="h-4 w-4" />
          <span>{t("القائمة", "Sidebar")}</span>
        </button>
      )}
    </div>
  );
}
