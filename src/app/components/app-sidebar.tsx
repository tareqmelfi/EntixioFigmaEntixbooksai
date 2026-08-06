import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard, FileText, ShoppingCart, Calculator,
  Package, Users, BarChart3, Settings,
  ChevronLeft, Sparkles, Receipt,
  FileSpreadsheet, CreditCard, ScrollText, BookOpen,
  Calculator as CalculatorIcon, FolderOpen, Wallet,
  Building2, Map, Layers, Warehouse, Search,
  Landmark, Target, FolderKanban, GitBranch, CalendarDays,
  Plug, FileCode, HelpCircle, Globe,
  Users2, Inbox, Camera, TrendingUp, HardHat,
  Pin, MousePointer, EyeOff, Crown,
  PanelRightClose,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { OrgSwitcher } from "./org-switcher";
import { useLanguage } from "./LanguageContext";
import { EntixWordmark } from "./entix-brand";
import { api } from "../lib/api";
import { useLegalType } from "../lib/use-legal-type";

const EN_TEXT: Record<string, string> = {
  "لوحة التحكم": "Dashboard",
  "الذكاء الاصطناعي": "AI",
  "جديد": "New",
  "العمليات الأساسية": "Core operations",
  "المبيعات": "Sales",
  "كاشير POS": "Cashier POS",
  "عروض الأسعار": "Quotes",
  "فواتير المبيعات": "Sales invoices",
  "سندات القبض": "Receipts",
  "الإشعارات الدائنة": "Credit notes",
  "المشتريات": "Purchases",
  "فواتير المشتريات": "Purchase bills",
  "إشعارات الموردين": "Supplier credits",
  "سندات الصرف": "Payment vouchers",
  "المصروفات النقدية": "Expenses",
  "التقاط الإيصالات": "Capture receipts",
  "البريد الوارد": "Inbox",
  "قائمة الاتصال": "Contacts",
  "الرواتب والموظفين": "Payroll & employees",
  "الرواتب": "Payroll",
  "الموظفين": "Employees",
  "منتجات، خدمات، مخزون": "Products, services, inventory",
  "المنتجات والخدمات": "Products & services",
  "المخزون والمستودعات": "Inventory & warehouses",
  "حركات المخزون": "Stock movements",
  "للمحاسب": "Accounting",
  "المحاسبة": "Accounting",
  "القيود اليدوية": "Journal entries",
  "شجرة الحسابات": "Chart of accounts",
  "الضرائب": "Taxes",
  "الحسابات البنكية": "Bank accounts",
  "تسوية البنوك": "Bank reconciliation",
  "الفترات المالية": "Fiscal periods",
  "الأصول الثابتة": "Fixed assets",
  "مراكز التكلفة": "Cost centers",
  "المشاريع": "Projects",
  "الفروع": "Branches",
  "محافظ الاستثمار": "Investment wallets",
  "سجل المساهمين": "Shareholders",
  "سجل الملاك": "Owners registry",
  "الملاك والمجلس": "Ownership & Board",
  "المقاولون والفريلانسر": "Contractors & freelancers",
  "للمطورين": "Developers",
  "التكاملات": "Integrations",
  "القوالب": "Templates",
  "محدّث": "Updated",
  "التعاقد مع محاسب": "Hire an accountant",
  "التقارير": "Reports",
  "خارطة المزايا": "Roadmap",
  "الإعدادات": "Settings",
  "مركز المساعدة": "Help center",
  "اذهب إلى صفحة...": "Go to page...",
  "الرئيسية · ENTIX": "Home · ENTIX",
  "ثابت": "Pinned",
  "تلقائي": "Auto",
  "مخفي": "Hidden",
};

function useSidebarText() {
  const { t } = useLanguage();
  // Company-type awareness: joint-stock companies (JSC) keep the
  // "shareholders register" label; every other legal form gets "owners".
  const legalType = useLegalType();
  return (value?: string) => {
    if (!value) return "";
    const v = value === "سجل المساهمين" && legalType !== "JSC" ? "سجل الملاك" : value;
    return t(v, EN_TEXT[v] || v);
  };
}

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
      { title: "التقاط الإيصالات", icon: Camera, path: "/app/scan-receipts" },
    ],
  },
  {
    label: "العمليات الأساسية",
    items: [
      { title: "قائمة الاتصال", icon: Users, path: "/app/contacts" },
      {
        title: "منتجات، خدمات، مخزون",
        icon: Package,
        path: "/app/products",
        children: [
          { title: "المنتجات والخدمات", icon: Layers, path: "/app/products" },
          { title: "المخزون والمستودعات", icon: Warehouse, path: "/app/warehouses" },
          { title: "حركات المخزون", icon: ScrollText, path: "/app/stock-movements" },
        ],
      },
      {
        title: "المبيعات",
        icon: ShoppingCart,
        path: "/app/sales",
        children: [
          { title: "كاشير POS", icon: ShoppingCart, path: "/app/pos" },
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
          { title: "إشعارات الموردين", icon: ScrollText, path: "/app/purchases/supplier-credits" },
          { title: "سندات الصرف", icon: CreditCard, path: "/app/payments" },
          { title: "المصروفات النقدية", icon: Receipt, path: "/app/expenses" },
          { title: "البريد الوارد", icon: Inbox, path: "/app/inbox" },
        ],
      },
      {
        title: "الرواتب والموظفين",
        icon: Wallet,
        path: "/app/payroll",
        children: [
          { title: "الموظفين", icon: Users2, path: "/app/employees" },
          { title: "الرواتب", icon: Wallet, path: "/app/payroll" },
          { title: "المقاولون والفريلانسر", icon: HardHat, path: "/app/contractors" },
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
      { title: "تسوية البنوك", icon: Landmark, path: "/app/bank-reconciliation" },
      { title: "الفترات المالية", icon: CalendarDays, path: "/app/fiscal-periods" },
      { title: "الأصول الثابتة", icon: Building2, path: "/app/assets" },
      {
        title: "الملاك والمجلس",
        icon: Crown,
        badge: "جديد",
        children: [
          { title: "محافظ الاستثمار", icon: TrendingUp, path: "/app/investments" },
          { title: "سجل المساهمين", icon: Users2, path: "/app/shareholders" },
        ],
      },
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
];

const searchPages = [
  { label: "لوحة التحكم", path: "/app" },
  { label: "الذكاء الاصطناعي", path: "/app/ai" },
  { label: "المبيعات", path: "/app/sales" },
  { label: "كاشير POS", path: "/app/pos" },
  { label: "عروض الأسعار", path: "/app/quotes" },
  { label: "فواتير المبيعات", path: "/app/invoices" },
  { label: "سندات القبض", path: "/app/receipts" },
  { label: "الإشعارات الدائنة", path: "/app/credit-notes" },
  { label: "المشتريات", path: "/app/purchases" },
  { label: "فواتير المشتريات", path: "/app/purchases/bills" },
  { label: "إشعارات الموردين", path: "/app/purchases/supplier-credits" },
  { label: "سندات الصرف", path: "/app/payments" },
  { label: "المصروفات النقدية", path: "/app/expenses" },
  { label: "التقاط الإيصالات", path: "/app/scan-receipts" },
  { label: "قائمة الاتصال", path: "/app/contacts" },
  { label: "الرواتب والموظفين", path: "/app/payroll" },
  { label: "المنتجات والخدمات", path: "/app/products" },
  { label: "المخزون والمستودعات", path: "/app/warehouses" },
  { label: "حركات المخزون", path: "/app/stock-movements" },
  { label: "القيود اليدوية", path: "/app/journal-entries" },
  { label: "شجرة الحسابات", path: "/app/chart-of-accounts" },
  { label: "الضرائب", path: "/app/taxes" },
  { label: "الحسابات البنكية", path: "/app/bank-accounts" },
  { label: "الأصول الثابتة", path: "/app/assets" },
  { label: "محافظ الاستثمار", path: "/app/investments" },
  { label: "سجل المساهمين", path: "/app/shareholders" },
  { label: "مراكز التكلفة", path: "/app/cost-centers" },
  { label: "المشاريع", path: "/app/projects" },
  { label: "المقاولون والفريلانسر", path: "/app/contractors" },
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
  const tr = useSidebarText();
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
    ? searchPages.filter((p) => {
        const q = searchQuery.trim().toLowerCase();
        return p.label.includes(searchQuery) || tr(p.label).toLowerCase().includes(q);
      })
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
      <aside className={`flex h-full shrink-0 flex-col border-e border-border bg-card transition-all duration-300 ${collapsed ? "w-16" : "w-64 xl:w-72"}`}>
        <SidebarContent
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
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </aside>
    );
  }

  // Floating sidebar (mobile + auto/hidden modes on desktop)
  return (
    <aside
      className={`
        flex h-full w-64 xl:w-72 shrink-0 flex-col border-e border-border bg-card
        fixed inset-y-0 start-0 z-50 transition-transform duration-300 shadow-xl
        ${isOpen ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"}
        ${className}
      `}
      onMouseLeave={() => {
        if (mode === "auto") onClose();
      }}
    >
      <SidebarContent
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
  cycleMode, modeLabel, ModeIcon,
  openMenus, toggleMenu, isActive, hasActiveChild, isParentPathActive,
  searchQuery, setSearchQuery, searchFocused, setSearchFocused, searchRef, searchResults,
  navigate, onClose, collapsed, setCollapsed,
}: {
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
  collapsed?: boolean;
  setCollapsed?: (c: boolean) => void;
}) {
  const { language, toggleLanguage, t } = useLanguage();
  const tr = useSidebarText();

  const ModeIconTyped = ModeIcon as React.ComponentType<{ className?: string }>;

  return (
    <>
      {/* ── Sidebar header · ENTIX.IO right-aligned · collapse toggle top-right ── */}
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            to="/app"
            onClick={onClose}
            className={`select-none hover:opacity-80 transition-opacity ${collapsed ? "mx-auto" : ""}`}
            title={tr("الرئيسية · ENTIX")}
          >
            {!collapsed && <EntixWordmark size={18} />}
          </Link>
          {setCollapsed && (
            <button
              type="button"
              onClick={() => setCollapsed!(!collapsed)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={collapsed ? "توسيع" : "طي"}
            >
              <PanelRightClose className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* Active org switcher · Wafeq-style with logo + search + "مختارة حالياً" tag */}
        {!collapsed && <OrgSwitcher />}

        {!collapsed && (
        <div className="relative" ref={searchRef}>
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={tr("اذهب إلى صفحة...")}
            className="w-full rounded-md border border-border bg-card ps-9 pe-8 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchFocused(false); }} className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80">
              <span className="font-english text-xs bg-accent rounded px-1.5 py-0.5" style={{ fontWeight: 600 }}>XF</span>
            </button>
          )}
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg py-1 max-h-60 overflow-y-auto">
              {searchResults.map((r) => (
                <button
                  key={r.path}
                  onClick={() => { navigate(r.path); setSearchQuery(""); setSearchFocused(false); onClose?.(); }}
                  className="w-full text-start px-3 py-2 text-sm text-foreground/80 hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  {tr(r.label)}
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-3" : ""}>
            {!collapsed && section.label && (
              <div className="mb-1.5 px-3 text-[11px] tracking-wider text-muted-foreground text-start" style={{ fontWeight: 600 }}>
                {tr(section.label)}
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
                      collapsed={collapsed}
                    />
                  );
                }
                return (
                  <SidebarLink key={item.title} item={item} active={isActive(item.path)} onClick={onClose} collapsed={collapsed} />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom ── */}
      <div className="border-t border-border p-3 space-y-0.5">
        {!collapsed && (
          <>
            <Link to="/app/reports" onClick={onClose}>
              <button className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive("/app/reports") ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent hover:text-foreground"}`}>
                <BarChart3 className="h-5 w-5 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-start">{tr("التقارير")}</span>
              </button>
            </Link>
            <Link to="/app/roadmap" onClick={onClose}>
              <button className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive("/app/roadmap") ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent hover:text-foreground"}`}>
                <Map className="h-5 w-5 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-start">{tr("خارطة المزايا")}</span>
              </button>
            </Link>
            <Link to="/app/settings" onClick={onClose}>
              <button className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive("/app/settings") ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent hover:text-foreground"}`}>
                <Settings className="h-5 w-5 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-start">{tr("الإعدادات")}</span>
              </button>
            </Link>

            <div className="flex items-center gap-1 pt-1">
              <button className="flex flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors">
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{tr("مركز المساعدة")}</span>
              </button>
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                aria-label={t("تغيير اللغة إلى الإنجليزية", "Switch language to Arabic")}
              >
                <Globe className="h-4 w-4 shrink-0" />
                <span className={language === "ar" ? "font-english" : ""}>{language === "ar" ? "English" : "العربية"}</span>
              </button>
            </div>
          </>
        )}

        {/* Mode indicator */}
        <div className="hidden lg:flex items-center justify-center pt-1">
          <button
            onClick={cycleMode}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] text-muted-foreground hover:bg-accent transition-colors"
          >
            <ModeIconTyped className="h-3 w-3" />
            {!collapsed && <span>{tr(modeLabel)}</span>}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Link item ─── */
function SidebarLink({ item, active, onClick, collapsed }: { item: MenuItem; active: boolean; onClick?: () => void; collapsed?: boolean }) {
  const Icon = item.icon as React.ComponentType<{ className?: string }>;
  const tr = useSidebarText();
  return (
    <Link to={item.path!} onClick={onClick}>
      <button
        className={`flex w-full items-center rounded-md text-sm transition-colors ${
          active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent hover:text-foreground"
        } ${collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2"}`}
        title={tr(item.title)}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="flex-1 min-w-0 whitespace-normal break-words text-start">{tr(item.title)}</span>}
        {!collapsed && item.badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] text-white ${item.badge === "محدّث" ? "bg-chart-4" : "bg-secondary"}`}>
            {tr(item.badge)}
          </span>
        )}
      </button>
    </Link>
  );
}

/* ─── Collapsible parent item ─── */
function CollapsibleMenu({
  item, isOpen, onToggle, isActive, isParentActive, onNavigate, collapsed,
}: {
  item: MenuItem;
  isOpen: boolean;
  onToggle: () => void;
  isActive: (path?: string) => boolean;
  isParentActive: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon as React.ComponentType<{ className?: string }>;
  const navigate = useNavigate();
  const tr = useSidebarText();

  // Click main label → navigate to parent path + open submenu
  const handleMainClick = () => {
    if (!isOpen) onToggle();
    if (item.path) {
      navigate(item.path);
    }
  };

  if (collapsed) {
    return (
      <div>
        <button
          onClick={handleMainClick}
          className={`flex w-full items-center justify-center rounded-md px-2 py-2 text-sm transition-colors ${
            isParentActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent hover:text-foreground"
          }`}
          title={tr(item.title)}
        >
          <Icon className="h-5 w-5 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex">
        <button
          onClick={handleMainClick}
          className={`flex flex-1 items-center gap-3 rounded-s-md px-3 py-2 text-sm transition-colors ${
            isParentActive && !isOpen
              ? "bg-primary/10 text-primary"
              : isParentActive && isOpen
              ? "bg-foreground/5 text-foreground"
              : "text-foreground/80 hover:bg-accent hover:text-foreground"
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="flex-1 min-w-0 whitespace-normal break-words text-start">{tr(item.title)}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`rounded-e-md px-2 py-2 text-sm transition-colors ${
            isParentActive && isOpen
              ? "bg-foreground/5 text-foreground"
              : isParentActive && !isOpen
              ? "bg-primary/10 text-primary"
              : "text-foreground/80 hover:bg-accent hover:text-foreground"
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
          maxHeight: isOpen ? `${(item.children?.length || 0) * 60}px` : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="mt-0.5 space-y-0.5">
          {item.children!.map((child) => {
            const ChildIcon = child.icon as React.ComponentType<{ className?: string }>;
            const active = isActive(child.path);
            return (
              <Link key={child.path + child.title} to={child.path} onClick={onNavigate}>
                <button
                  className={`flex w-full items-center gap-3 rounded-md ps-10 pe-3 py-2 text-sm transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <ChildIcon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 whitespace-normal break-words text-start">{tr(child.title)}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
