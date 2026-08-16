import { Outlet, useLocation } from "react-router";
import { AppSidebar, SidebarMode } from "../components/app-sidebar";
import { AppHeader } from "../components/app-header";
import { useState, useEffect, useRef, useCallback } from "react";
import { PanelRightOpen } from "lucide-react";
import { useLanguage } from "../components/LanguageContext";

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
