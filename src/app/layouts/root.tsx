import { Outlet, useLocation } from "react-router";
import { AppSidebar } from "../components/app-sidebar";
import { AppHeader } from "../components/app-header";
import { useState, useEffect, useRef } from "react";

export function Root() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4FCFF]" dir="rtl">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar first in code → appears on the RIGHT in RTL */}
      <AppSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <AppHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}