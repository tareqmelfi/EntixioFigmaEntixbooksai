import { Outlet, useLocation } from "react-router";
import { AppSidebar, SidebarMode } from "../components/app-sidebar";
import { AppHeader } from "../components/app-header";
import { useState, useEffect, useRef, useCallback } from "react";
import { PanelRightOpen } from "lucide-react";

export function Root() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    <div className="flex h-dvh w-full bg-[#F4FCFF]" dir="rtl">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
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
        <main ref={mainRef} className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Floating button when sidebar is hidden */}
      {sidebarMode === "hidden" && (
        <button
          onClick={() => handleModeChange("pinned")}
          className="hidden lg:flex fixed top-4 end-4 z-30 items-center gap-1.5 rounded-lg bg-white border border-[#E5E7EB] px-3 py-2 text-xs text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49] shadow-sm transition-all"
          title="إظهار القائمة"
        >
          <PanelRightOpen className="h-4 w-4" />
          <span>القائمة</span>
        </button>
      )}
    </div>
  );
}
