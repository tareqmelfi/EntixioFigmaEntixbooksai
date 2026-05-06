import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard, FileText, ShoppingCart, Calculator,
  Package, Users, BarChart3, Settings, LogOut,
  ChevronDown, ChevronLeft, Sparkles, Receipt,
  FileSpreadsheet, CreditCard, ScrollText, BookOpen,
  Calculator as CalculatorIcon, FolderOpen, Wallet,
  Building2, Map, Layers, Warehouse, Search,
  Landmark, Target, FolderKanban, GitBranch,
  Plug, FileCode, Handshake, HelpCircle, Globe,
  Mail, UserCheck, Briefcase, ClipboardList, Users2,
  Pin, PinOff, MousePointer, EyeOff,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SubItem {
  title: string;
  icon: React.ElementType;
  path: string;
}

interface MenuItem {
  title: string;
  icon: React.ElementType;
  path?: string;
  badge?: string;
  children?: SubItem[];
}

interface MenuSection {
  label?: string;
  items: MenuItem[];
}

const sections: MenuSection[] = [
  {
    items: [
      { title: "لوحة التحكم", icon: LayoutDashboard, path: "/app" },
      { title: "الذكاء الاصطناعي", icon: Sparkles, path: "/app/ai", badge: "جديد" },
    ],
  },
  {
    label: "العمليات الأساسية",
    items: [
      {
        title: "المبيعات",
        icon: ShoppingCart,
        path: "/app/sales",
        children: [
          { title: "عروض الأسعار", icon: FileSpreadsheet, path: "/app/quotes" },
          { title: "فواتير المبيعات", icon: FileText, path: "/app/invoices" },
          { title: "سندات القبض", icon: Receipt, path: "/app/receipts" },
          { title: "الإشعارات الدائنة", icon: ScrollText, path: "/app/credit-notes" },
        ],
      },
      {
        title: "المشتريات",
        icon: ShoppingCart,
        path: "/app/purchases",
        children: [
          { title: "فواتير المشتريات", icon: FileText, path: "/app/purchases/bills" },
          { title: "سندات الدفع", icon: CreditCard, path: "/app/payments" },
          { title: "المصروفات النقدية", icon: Receipt, path: "/app/expenses" },
        ],
      },
      { title: "العملاء والموردين", icon: Users, path: "/app/contacts" },
      {
        title: "الرواتب والموظفين",
        icon: Wallet,
        path: "/app/payroll",
        children: [
          { title: "الرواتب", icon: Wallet, path: "/app/payroll" },
          { title: "الموظفين", icon: Users2, path: "/app/payroll" },
        ],
      },
      {
        title: "منتجات، خدمات، مخزون",
        icon: Package,
        path: "/app/products",
        children: [
          { title: "المنتجات والخدمات", icon: Layers, path: "/app/products" },
          { title: "المخزون والمستودعات", icon: Warehouse, path: "/app/inventory" },
        ],
      },
    ],
  },
  {
    label: "للمحاسب",
    items: [
      {
        title: "المحاسبة",
        icon: Calculator,
        children: [
          { title: "القيود اليدوية", icon: CalculatorIcon, path: "/app/journal-entries" },
          { title: "شجرة الحسابات", icon: BookOpen, path: "/app/chart-of-accounts" },
          { title: "الضرائب", icon: FolderOpen, path: "/app/taxes" },
        ],
      },
      { title: "الحسابات البنكية", icon: Landmark, path: "/app/bank-accounts" },
      { title: "الأصول الثابتة", icon: Building2, path: "/app/assets" },
      { title: "مراكز التكلفة", icon: Target, path: "/app/cost-centers" },
      { title: "المشاريع", icon: FolderKanban, path: "/app/projects" },
      { title: "الفروع", icon: GitBranch, path: "/app/branches" },
    ],
  },
  {
    label: "للمطورين",
    items: [
      { title: "التكاملات", icon: Plug, path: "/app/integrations" },
      { title: "القوالب", icon: FileCode, path: "/app/templates", badge: "محدّث" },
    ],
  },
  {
    items: [
      { title: "التعاقد مع محاسب", icon: Handshake, path: "/app/roadmap" },
    ],
  },
];

const searchPages = [
  { label: "لوحة التحكم", path: "/app" },
  { label: "الذكاء الاصطناعي", path: "/app/ai" },
  { label: "المبيعات", path: "/app/sales" },
  { label: "عروض الأسعار", path: "/app/quotes" },
  { label: "فواتير المبيعات", path: "/app/invoices" },
  { label: "سندات القبض", path: "/app/receipts" },
  { label: "الإشعارات الدائنة", path: "/app/credit-notes" },
  { label: "المشتريات", path: "/app/purchases" },
  { label: "فواتير المشتريات", path: "/app/purchases/bills" },
  { label: "سندات الدفع", path: "/app/payments" },
  { label: "المصروفات النقدية", path: "/app/expenses" },
  { label: "العملاء والموردين", path: "/app/contacts" },
  { label: "الرواتب والموظفين", path: "/app/payroll" },
  { label: "المنتجات والخدمات", path: "/app/products" },
  { label: "المخزون والمستودعات", path: "/app/inventory" },
  { label: "القيود اليدوية", path: "/app/journal-entries" },
  { label: "شجرة الحسابات", path: "/app/chart-of-accounts" },
  { label: "الضرائب", path: "/app/taxes" },
  { label: "الحسابات البنكية", path: "/app/bank-accounts" },
  { label: "الأصول الثابتة", path: "/app/assets" },
  { label: "مراكز التكلفة", path: "/app/cost-centers" },
  { label: "المشاريع", path: "/app/projects" },
  { label: "الفروع", path: "/app/branches" },
  { label: "التكاملات", path: "/app/integrations" },
  { label: "القوالب", path: "/app/templates" },
  { label: "التقارير", path: "/app/reports" },
  { label: "الإعدادات", path: "/app/settings" },
  { label: "خارطة المزايا", path: "/app/roadmap" },
];

export type SidebarMode = "pinned" | "auto" | "hidden";

export function AppSidebar({
  isOpen,
  onClose,
  mode,
  onModeChange,
  isStatic = false,
  className = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
  isStatic?: boolean;
  className?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => {
      if (prev.has(title)) return new Set();
      return new Set([title]);
    });
  };

  const isActive = (path?: string) => path === location.pathname;
  const hasActiveChild = (children?: SubItem[]) =>
    children?.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + "/")) ?? false;
  const isParentPathActive = (path?: string) =>
    path ? location.pathname === path || location.pathname.startsWith(path + "/") : false;

  const searchResults = searchQuery.trim()
    ? searchPages.filter((p) => p.label.includes(searchQuery))
    : [];

  const cycleMode = () => {
    if (mode === "pinned") onModeChange("auto");
    else if (mode === "auto") onModeChange("hidden");
    else onModeChange("pinned");
  };

  const modeLabel = mode === "pinned" ? "ثابت" : mode === "auto" ? "تلقائي" : "مخفي";
  const ModeIcon = mode === "pinned" ? Pin : mode === "auto" ? MousePointer : EyeOff;

  // Static sidebar (pinned mode, desktop only)
  if (isStatic) {
    return (
      <aside className="flex h-full w-64 shrink-0 flex-col border-e border-[#E5E7EB] bg-white">
        <SidebarContent
          mode={mode}
          onModeChange={onModeChange}
          cycleMode={cycleMode}
          modeLabel={modeLabel}
          ModeIcon={ModeIcon}
          openMenus={openMenus}
          toggleMenu={toggleMenu}
          isActive={isActive}
          hasActiveChild={hasActiveChild}
          isParentPathActive={isParentPathActive}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFocused={searchFocused}
          setSearchFocused={setSearchFocused}
          searchRef={searchRef}
          searchResults={searchResults}
          navigate={navigate}
        />
      </aside>
    );
  }

  // Floating sidebar (mobile + auto/hidden modes on desktop)
  return (
    <aside
      className={`
        flex h-full w-64 shrink-0 flex-col border-e border-[#E5E7EB] bg-white
        fixed inset-y-0 end-0 z-50 transition-transform duration-300 shadow-xl
        ${isOpen ? "translate-x-0" : "translate-x-full"}
        ${className}
      `}
      onMouseLeave={() => {
        if (mode === "auto") onClose();
      }}
    >
      <SidebarContent
        mode={mode}
        onModeChange={onModeChange}
        cycleMode={cycleMode}
        modeLabel={modeLabel}
        ModeIcon={ModeIcon}
        openMenus={openMenus}
        toggleMenu={toggleMenu}
        isActive={isActive}
        hasActiveChild={hasActiveChild}
        isParentPathActive={isParentPathActive}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
        searchRef={searchRef}
        searchResults={searchResults}
        navigate={navigate}
        onClose={onClose}
      />
    </aside>
  );
}

/* ─── Shared sidebar content ─── */
function SidebarContent({
  mode, onModeChange, cycleMode, modeLabel, ModeIcon,
  openMenus, toggleMenu, isActive, hasActiveChild, isParentPathActive,
  searchQuery, setSearchQuery, searchFocused, setSearchFocused, searchRef, searchResults,
  navigate, onClose,
}: {
  mode: SidebarMode;
  onModeChange: (m: SidebarMode) => void;
  cycleMode: () => void;
  modeLabel: string;
  ModeIcon: React.ElementType;
  openMenus: Set<string>;
  toggleMenu: (t: string) => void;
  isActive: (p?: string) => boolean;
  hasActiveChild: (c?: SubItem[]) => boolean;
  isParentPathActive: (p?: string) => boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchFocused: boolean;
  setSearchFocused: (f: boolean) => void;
  searchRef: React.RefObject<HTMLDivElement | null>;
  searchResults: { label: string; path: string }[];
  navigate: (p: string) => void;
  onClose?: () => void;
}) {
  return (
    <>
      {/* ── Logo & Company ── */}
      <div className="border-b border-[#E5E7EB] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1276E3]">
              <span className="font-english text-lg text-white" style={{ fontWeight: 700 }}>EB</span>
            </div>
            <h1 className="font-english text-lg text-[#0B1B49]" style={{ fontWeight: 700 }}>Entix Books</h1>
          </div>
          <button
            onClick={cycleMode}
            className="hidden lg:flex items-center justify-center rounded-md p-1.5 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#0B1B49] transition-colors"
            title={`الوضع: ${modeLabel}`}
          >
            <ModeIcon className="h-4 w-4" />
          </button>
        </div>

        <button className="mb-2 flex w-full items-center justify-between rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0B1B49] hover:bg-[#F9FAFB]">
          <span>شركة Entix Books العالمية</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#6B7280]" />
        </button>

        <div className="relative" ref={searchRef}>
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="اذهب إلى صفحة..."
            className="w-full rounded-md border border-[#E5E7EB] bg-white ps-9 pe-8 py-2 text-sm text-[#0B1B49] placeholder:text-[#9CA3AF] focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchFocused(false); }} className="absolute end-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
              <span className="font-english text-xs bg-[#F3F4F6] rounded px-1.5 py-0.5" style={{ fontWeight: 600 }}>XF</span>
            </button>
          )}
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1 max-h-60 overflow-y-auto">
              {searchResults.map((r) => (
                <button
                  key={r.path}
                  onClick={() => { navigate(r.path); setSearchQuery(""); setSearchFocused(false); onClose?.(); }}
                  className="w-full text-start px-3 py-2 text-sm text-[#374151] hover:bg-[#EFF6FF] hover:text-[#1276E3] transition-colors"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-3" : ""}>
            {section.label && (
              <div className="mb-1.5 px-3 text-[11px] tracking-wider text-[#9CA3AF] text-start" style={{ fontWeight: 600 }}>
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                if (item.children) {
                  return (
                    <CollapsibleMenu
                      key={item.title}
                      item={item}
                      isOpen={openMenus.has(item.title)}
                      onToggle={() => toggleMenu(item.title)}
                      isActive={isActive}
                      isParentActive={hasActiveChild(item.children) || isParentPathActive(item.path)}
                      onNavigate={onClose}
                    />
                  );
                }
                return (
                  <SidebarLink key={item.title} item={item} active={isActive(item.path)} onClick={onClose} />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom ── */}
      <div className="border-t border-[#E5E7EB] p-3 space-y-0.5">
        <Link to="/app/reports" onClick={onClose}>
          <button className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive("/app/reports") ? "bg-[#1276E3] text-white" : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"}`}>
            <BarChart3 className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-start">التقارير</span>
          </button>
        </Link>
        <Link to="/app/roadmap" onClick={onClose}>
          <button className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive("/app/roadmap") ? "bg-[#1276E3] text-white" : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"}`}>
            <Map className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-start">خارطة المزايا</span>
          </button>
        </Link>
        <Link to="/app/settings" onClick={onClose}>
          <button className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive("/app/settings") ? "bg-[#1276E3] text-white" : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"}`}>
            <Settings className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-start">الإعدادات</span>
          </button>
        </Link>

        <div className="flex items-center gap-1 pt-1">
          <button className="flex flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span>مركز المساعدة</span>
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
            <Globe className="h-4 w-4 shrink-0" />
            <span className="font-english">English</span>
          </button>
        </div>

        {/* Mode indicator */}
        <div className="hidden lg:flex items-center justify-center pt-1">
          <button
            onClick={cycleMode}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors"
          >
            <ModeIcon className="h-3 w-3" />
            <span>{modeLabel}</span>
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Link item ─── */
function SidebarLink({ item, active, onClick }: { item: MenuItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link to={item.path!} onClick={onClick}>
      <button
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
          active ? "bg-[#1276E3] text-white" : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-start">{item.title}</span>
        {item.badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] text-white ${item.badge === "محدّث" ? "bg-[#F59E0B]" : "bg-[#179FC5]"}`}>
            {item.badge}
          </span>
        )}
      </button>
    </Link>
  );
}

/* ─── Collapsible parent item ─── */
function CollapsibleMenu({
  item, isOpen, onToggle, isActive, isParentActive, onNavigate,
}: {
  item: MenuItem;
  isOpen: boolean;
  onToggle: () => void;
  isActive: (path?: string) => boolean;
  isParentActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const navigate = useNavigate();

  // Click main label → navigate to parent path + open submenu
  const handleMainClick = () => {
    if (!isOpen) onToggle();
    if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div>
      <div className="flex">
        <button
          onClick={handleMainClick}
          className={`flex flex-1 items-center gap-3 rounded-s-md px-3 py-2 text-sm transition-colors ${
            isParentActive && !isOpen
              ? "bg-[#1276E3] text-white"
              : isParentActive && isOpen
              ? "bg-[#0B1B49] text-white"
              : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-start">{item.title}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`rounded-e-md px-2 py-2 text-sm transition-colors ${
            isParentActive && isOpen
              ? "bg-[#0B1B49] text-white"
              : isParentActive && !isOpen
              ? "bg-[#1276E3] text-white"
              : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
          }`}
        >
          <ChevronLeft
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "-rotate-90" : ""}`}
          />
        </button>
      </div>

      {/* Animated children */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: isOpen ? `${(item.children?.length || 0) * 44}px` : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="mt-0.5 space-y-0.5">
          {item.children!.map((child) => {
            const ChildIcon = child.icon;
            const active = isActive(child.path);
            return (
              <Link key={child.path + child.title} to={child.path} onClick={onNavigate}>
                <button
                  className={`flex w-full items-center gap-3 rounded-md ps-10 pe-3 py-2 text-sm transition-colors ${
                    active ? "bg-[#1276E3] text-white" : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
                  }`}
                >
                  <ChildIcon className="h-4 w-4 shrink-0" />
                  <span className="text-start">{child.title}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
