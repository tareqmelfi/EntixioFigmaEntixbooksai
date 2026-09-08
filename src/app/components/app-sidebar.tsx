import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard, FileText, ShoppingCart, Calculator,
  Package, Users, BarChart3, Settings,
  ChevronLeft, Sparkles, Receipt,
  FileSpreadsheet, CreditCard, ScrollText, BookOpen,
  Calculator as CalculatorIcon, FolderOpen, Wallet,
  Building2, Map, Layers, Warehouse, Search,
  Landmark, Target, FolderKanban, GitBranch, CalendarDays,
  HelpCircle, LayoutTemplate,
  Users2, Inbox, Camera, HardHat, TrendingUp, Crown,
  Pin, MousePointer, EyeOff,
  PanelRightClose,
} from "lucide-react";
import { useState, useRef, useEffect, useId } from "react";
import { OrgSwitcher } from "./org-switcher";
import { useLanguage } from "./LanguageContext";
import { EntixWordmark } from "./entix-brand";
import { useLegalType } from "../lib/use-legal-type";
import { authStore } from "./auth-store";

const EN_TEXT: Record<string, string> = {
  "لوحة التحكم": "Dashboard",
  "الذكاء الاصطناعي": "AI",
  "المساعد الذكي": "AI assistant",
  "صندوق الوارد": "Inbox",
  "العملاء": "Customers",
  "الموردون": "Suppliers",
  "الفواتير": "Invoices",
  "المصروفات": "Expenses",
  "المنتجات والمخزون": "Products & inventory",
  "المخازن": "Warehouses",
  "البنوك والنقد": "Banks & cash",
  "التسوية البنكية": "Bank reconciliation",
  "دليل الحسابات": "Chart of accounts",
  "القيود اليومية": "Journal entries",
  "ميزان المراجعة": "Trial balance",
  "الموظفون والرواتب": "Employees & payroll",
  "الملاك والاستثمار": "Ownership & investment",
  "مسير الرواتب": "Payroll",
  "جديد": "New",
  "العمليات الأساسية": "Core operations",
  "المبيعات": "Sales",
  "لوحة القسم": "Section dashboard",
  "كاشير POS": "Cashier POS",
  "الدراسة والتسعير": "Estimating & Pricing",
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
  "البنوك": "Banking",
  "الحسابات البنكية": "Bank accounts",
  "تسوية البنوك": "Bank reconciliation",
  "الفترات المالية": "Fiscal periods",
  "الأصول الثابتة": "Fixed assets",
  "مراكز التكلفة": "Cost centers",
  "المشاريع": "Projects",
  "الفروع": "Branches",
  "برنامج الشركاء": "Partner Program",
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
  "التحليل والهيكل": "Analysis & structure",
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
  /** Group home (CEO 2026-09-08): clicking the group name opens the section's
   *  own dashboard — its figures and everything that belongs to it. */
  hub?: string;
  items: MenuItem[];
}

// Sidebar IA · Ledger (2026-09-06 blueprint §1): grouped by money flow — people →
// documents → money in every group. Contacts stays one data model and appears
// once, in the top group (one list, role per row — Xero-style). Ownership &
// investment keep their own group; analysis lives inside the ledger group.
const sections: MenuSection[] = [
  {
    items: [
      { title: "لوحة التحكم", icon: LayoutDashboard, path: "/app" },
      {
        title: "صندوق الوارد",
        icon: Inbox,
        path: "/app/inbox",
        children: [
          { title: "البريد الوارد", icon: Inbox, path: "/app/inbox" },
          { title: "التقاط الإيصالات", icon: Camera, path: "/app/scan-receipts" },
        ],
      },
      // One contacts list for everyone (CEO 2026-09-06: a person can be customer,
      // supplier and shareholder at once — Xero-style single list, role shown per row).
      { title: "قائمة الاتصال", icon: Users, path: "/app/contacts" },
      { title: "المساعد الذكي", icon: Sparkles, path: "/app/ai", badge: "جديد" },
    ],
  },
  {
    label: "المبيعات",
    hub: "/app/sales",
    items: [
      // SPEC-05 L1 · the cost study comes BEFORE the quote (internal → client)
      { title: "الدراسة والتسعير", icon: Calculator, path: "/app/estimates" },
      { title: "عروض الأسعار", icon: FileSpreadsheet, path: "/app/quotes" },
      { title: "الفواتير", icon: FileText, path: "/app/invoices" },
      { title: "سندات القبض", icon: Receipt, path: "/app/receipts" },
      { title: "الإشعارات الدائنة", icon: ScrollText, path: "/app/credit-notes" },
      { title: "كاشير POS", icon: ShoppingCart, path: "/app/pos" },
    ],
  },
  {
    label: "المشتريات",
    hub: "/app/purchases",
    items: [
      { title: "فواتير المشتريات", icon: FileText, path: "/app/purchases/bills" },
      { title: "المصروفات", icon: Receipt, path: "/app/expenses" },
      { title: "سندات الصرف", icon: CreditCard, path: "/app/payments" },
      { title: "إشعارات الموردين", icon: ScrollText, path: "/app/purchases/supplier-credits" },
    ],
  },
  {
    label: "المنتجات والمخزون",
    hub: "/app/products",
    items: [
      { title: "المنتجات والخدمات", icon: Package, path: "/app/products" },
      { title: "المخازن", icon: Warehouse, path: "/app/warehouses" },
      { title: "حركات المخزون", icon: Layers, path: "/app/stock-movements" },
    ],
  },
  {
    label: "البنوك والنقد",
    hub: "/app/bank-accounts",
    items: [
      { title: "الحسابات البنكية", icon: Landmark, path: "/app/bank-accounts" },
      { title: "التسوية البنكية", icon: GitBranch, path: "/app/bank-reconciliation" },
    ],
  },
  {
    label: "المحاسبة",
    hub: "/app/accounting",
    items: [
      { title: "دليل الحسابات", icon: BookOpen, path: "/app/chart-of-accounts" },
      { title: "القيود اليومية", icon: CalculatorIcon, path: "/app/journal-entries" },
      { title: "الفترات المالية", icon: CalendarDays, path: "/app/fiscal-periods" },
      { title: "الضرائب", icon: FolderOpen, path: "/app/taxes" },
      { title: "الأصول الثابتة", icon: Building2, path: "/app/assets" },
      {
        title: "التحليل والهيكل",
        icon: Target,
        children: [
          { title: "مراكز التكلفة", icon: Target, path: "/app/cost-centers" },
          { title: "المشاريع", icon: FolderKanban, path: "/app/projects" },
          { title: "الفروع", icon: Map, path: "/app/branches" },
        ],
      },
      { title: "ميزان المراجعة", icon: Calculator, path: "/app/reports/trial-balance" },
    ],
  },
  {
    // Ownership & investment: a Books feature in its own right (CEO 2026-09-07 —
    // keep it, give it a proper home). Sits after the ledger, before people.
    label: "الملاك والاستثمار",
    hub: "/app/shareholders",
    items: [
      { title: "سجل المساهمين", icon: Crown, path: "/app/shareholders" },
      { title: "محافظ الاستثمار", icon: TrendingUp, path: "/app/investments" },
    ],
  },
  {
    label: "الموظفون والرواتب",
    hub: "/app/employees",
    items: [
      { title: "الموظفين", icon: Users2, path: "/app/employees" },
      { title: "مسير الرواتب", icon: Wallet, path: "/app/payroll" },
      { title: "المقاولون والفريلانسر", icon: HardHat, path: "/app/contractors" },
    ],
  },
  {
    items: [
      { title: "التقارير", icon: BarChart3, path: "/app/reports" },
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
  { label: "ميزان المراجعة", path: "/app/reports/trial-balance" },
  { label: "تسوية البنوك", path: "/app/bank-reconciliation" },
  { label: "الفترات المالية", path: "/app/fiscal-periods" },
  { label: "الرواتب والموظفين", path: "/app/payroll" },
  { label: "المنتجات والخدمات", path: "/app/products" },
  { label: "المخزون والمستودعات", path: "/app/warehouses" },
  { label: "حركات المخزون", path: "/app/stock-movements" },
  { label: "المحاسبة", path: "/app/accounting" },
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

/* ─── Collapsible section groups ───
 * The money-flow IA turned the sidebar into ~30 links, which scrolls on a
 * 1000px-tall window. Labelled groups therefore collapse: «المبيعات» and
 * «المشتريات» stay open (the daily work), every other group opens only when
 * the user is inside it — or when they open it by hand, which we remember.
 * localStorage is best-effort: a blocked store just falls back to defaults. */
const SIDEBAR_GROUPS_KEY = "entix-sidebar-groups";
const DEFAULT_OPEN_GROUPS = ["المبيعات", "المشتريات"];

function readStoredGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStoredGroups(value: Record<string, boolean>) {
  try {
    localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(value));
  } catch {
    /* private mode / storage disabled — the sidebar still works, just forgets */
  }
}

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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(!!authStore.getState().user?.isPlatformAdmin);
  useEffect(() => authStore.subscribe((s) => setIsPlatformAdmin(!!s.user?.isPlatformAdmin)), []);
  const navigate = useNavigate();
  const tr = useSidebarText();
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of sections) if (s.label) initial[s.label] = DEFAULT_OPEN_GROUPS.includes(s.label);
    return { ...initial, ...readStoredGroups() };
  });
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

  // Wave behavior: auto-open the group containing the active page so the user
  // always sees where they are — everything else stays collapsed (calm sidebar).
  useEffect(() => {
    const parent = sections
      .flatMap((s) => s.items)
      .find((i) => i.children && (hasActiveChild(i.children) || isParentPathActive(i.path)));
    if (parent) setOpenMenus((prev) => (prev.has(parent.title) ? prev : new Set([parent.title])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Paths may carry a query (contacts?role=…): match pathname + search together,
  // (kept generic so a future filtered link lights up independently).
  const isActive = (path?: string) => {
    if (!path) return false;
    const [p, q] = path.split("?");
    return p === location.pathname && (q ? location.search === `?${q}` : !location.search.includes("role="));
  };
  const hasActiveChild = (children?: SubItem[]) =>
    children?.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + "/")) ?? false;
  const isParentPathActive = (path?: string) =>
    path ? location.pathname === path || location.pathname.startsWith(path + "/") : false;

  // A group counts as active when the current route lives anywhere inside it —
  // query strings are ignored here, so /app/contacts lights its group whichever
  // role filter is on.
  const sectionHasActiveRoute = (section: MenuSection) =>
    (!!section.hub && isActive(section.hub)) ||
    section.items.some(
      (i) =>
        isParentPathActive(i.path?.split("?")[0]) ||
        (i.children?.some((c) => isParentPathActive(c.path.split("?")[0])) ?? false),
    );

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      writeStoredGroups(next);
      return next;
    });

  // Never hide the page the user is standing on: the group holding the active
  // route opens itself, whatever the remembered state said.
  useEffect(() => {
    const active = sections.filter((s) => s.label && sectionHasActiveRoute(s)).map((s) => s.label!);
    if (!active.length) return;
    setOpenGroups((prev) => {
      if (active.every((l) => prev[l])) return prev;
      const next = { ...prev };
      for (const l of active) next[l] = true;
      writeStoredGroups(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

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
      <aside className={`flex h-full shrink-0 flex-col border-e border-border bg-surface-subtle transition-all duration-300 ${collapsed ? "w-16" : "w-[248px]"}`}>
        <SidebarContent
          cycleMode={cycleMode}
          modeLabel={modeLabel}
          ModeIcon={ModeIcon}
          openMenus={openMenus}
          toggleMenu={toggleMenu}
          openGroups={openGroups}
          toggleGroup={toggleGroup}
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
          isPlatformAdmin={isPlatformAdmin}
        />
      </aside>
    );
  }

  // Floating sidebar (mobile + auto/hidden modes on desktop)
  return (
    <aside
      className={`
        flex h-full w-[248px] shrink-0 flex-col border-e border-border bg-surface-subtle
        fixed inset-y-0 start-0 z-50 transition-transform duration-300 shadow-popover
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
        openGroups={openGroups}
        toggleGroup={toggleGroup}
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
        isPlatformAdmin={isPlatformAdmin}
      />
    </aside>
  );
}

/* ─── Shared sidebar content ─── */
function SidebarContent({
  cycleMode, modeLabel, ModeIcon,
  openMenus, toggleMenu, openGroups, toggleGroup, isActive, hasActiveChild, isParentPathActive,
  searchQuery, setSearchQuery, searchFocused, setSearchFocused, searchRef, searchResults,
  navigate, onClose, collapsed, setCollapsed, isPlatformAdmin,
}: {
  cycleMode: () => void;
  modeLabel: string;
  ModeIcon: React.ElementType;
  openMenus: Set<string>;
  toggleMenu: (t: string) => void;
  openGroups: Record<string, boolean>;
  toggleGroup: (label: string) => void;
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
  isPlatformAdmin?: boolean;
}) {
  const { language, toggleLanguage, t } = useLanguage();
  const tr = useSidebarText();
  // The shell mounts this twice (pinned column + mobile drawer) — ids must not collide.
  const uid = useId();

  const ModeIconTyped = ModeIcon as React.ComponentType<{ className?: string; strokeWidth?: number }>;

  return (
    <>
      {/* ── Sidebar header · vector wordmark · workspace card · quiet search ── */}
      <div className="flex flex-col gap-[14px] px-[16px] pb-[14px] pt-[20px]">
        {/* Reference artboard centres the wordmark in the 248px column and has no
            rail toggle; we keep the toggle but float it on the end edge so the
            mark still sits dead centre. */}
        <div className="relative flex h-[20px] items-center justify-center">
          <Link
            to="/app"
            onClick={onClose}
            className="flex select-none items-center leading-none transition-opacity hover:opacity-80"
            title={tr("الرئيسية · ENTIX")}
          >
            {!collapsed && <EntixWordmark size={17} />}
          </Link>
          {setCollapsed && (
            <button
              type="button"
              onClick={() => setCollapsed!(!collapsed)}
              className="absolute end-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              title={collapsed ? "توسيع" : "طي"}
            >
              <PanelRightClose className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Active org switcher · Wafeq-style with logo + search + "مختارة حالياً" tag */}
        {/* Platform-admin accounts never own/belong to a company (owner
         * directive 2026-08-25) — showing an empty/broken switcher here is
         * worse than showing nothing. */}
        {!collapsed && !isPlatformAdmin && <OrgSwitcher />}

        {!collapsed && (
        <div className="relative" ref={searchRef}>
          <Search className="absolute start-[12px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="text"
            placeholder={tr("اذهب إلى صفحة...")}
            className="h-[40px] w-full rounded-lg border border-border bg-card ps-[34px] pe-8 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
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
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-popover">
              {searchResults.map((r) => (
                <button
                  key={r.path}
                  onClick={() => { navigate(r.path); setSearchQuery(""); setSearchFocused(false); onClose?.(); }}
                  className="w-full px-3 py-2 text-start text-[13px] text-foreground/80 transition-colors hover:bg-surface-hover hover:text-foreground"
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
      <nav className="flex-1 overflow-y-auto px-[16px] pb-[8px]">
        {sections.map((section, si) => {
          // Labelled groups collapse; the rail (collapsed sidebar) has no
          // labels, so it always shows every icon.
          const groupOpen = !section.label || !!openGroups[section.label];
          const showItems = collapsed || groupOpen;
          return (
            <div key={si}>
              {!collapsed && section.label && !section.hub && (
                <button
                  type="button"
                  onClick={() => toggleGroup(section.label!)}
                  aria-expanded={groupOpen}
                  aria-controls={`${uid}-group-${si}`}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-[10px] pb-[4px] pt-[10px] text-[10px] leading-[13px] tracking-[1px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="min-w-0 truncate text-start">{tr(section.label)}</span>
                  <ChevronLeft
                    className={`h-[12px] w-[12px] shrink-0 transition-transform duration-200 ${groupOpen ? "-rotate-90" : ""}`}
                    strokeWidth={2}
                  />
                </button>
              )}
              {/* Groups with a hub: the name opens the section dashboard, the chevron folds the list */}
              {!collapsed && section.label && section.hub && (
                <div className={`flex w-full items-center justify-between gap-2 rounded-lg px-[10px] pb-[4px] pt-[10px] text-[10px] leading-[13px] tracking-[1px] transition-colors ${isActive(section.hub) ? "text-foreground" : "text-muted-foreground"}`}>
                  <Link
                    to={section.hub}
                    onClick={onClose}
                    className="min-w-0 flex-1 truncate text-start hover:text-foreground"
                    title={tr("لوحة القسم")}
                  >
                    {tr(section.label)}
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleGroup(section.label!)}
                    aria-expanded={groupOpen}
                    aria-controls={`${uid}-group-${si}`}
                    aria-label={tr(section.label)}
                    className="shrink-0 rounded p-0.5 hover:text-foreground"
                  >
                    <ChevronLeft
                      className={`h-[12px] w-[12px] shrink-0 transition-transform duration-200 ${groupOpen ? "-rotate-90" : ""}`}
                      strokeWidth={2}
                    />
                  </button>
                </div>
              )}
              {showItems && (
                <div id={`${uid}-group-${si}`} className="space-y-px">
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
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Bottom ── */}
      <div className="mt-auto space-y-px border-t border-border px-[16px] pb-[20px] pt-[10px]">
        {!collapsed && (
          <>
            <Link to="/app/roadmap" onClick={onClose}>
              <button className={`flex w-full items-center gap-[10px] rounded-lg px-[10px] py-[7px] text-[13px] leading-[16px] transition-colors ${isActive("/app/roadmap") ? "bg-foreground font-semibold text-background" : "text-content-secondary hover:bg-surface-hover hover:text-foreground"}`}>
                <Map className={`h-[16px] w-[16px] shrink-0 ${isActive("/app/roadmap") ? "text-background" : "text-muted-foreground"}`} strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate text-start">{tr("خارطة المزايا")}</span>
              </button>
            </Link>
            <Link to="/app/settings" onClick={onClose}>
              <button className={`flex w-full items-center gap-[10px] rounded-lg px-[10px] py-[7px] text-[13px] leading-[16px] transition-colors ${isActive("/app/settings") ? "bg-foreground font-semibold text-background" : "text-content-secondary hover:bg-surface-hover hover:text-foreground"}`}>
                <Settings className={`h-[16px] w-[16px] shrink-0 ${isActive("/app/settings") ? "text-background" : "text-muted-foreground"}`} strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate text-start">{tr("الإعدادات")}</span>
              </button>
            </Link>
            {/* Brand document templates (quote / invoice designer) · sits with the settings entries (2026-09-08) */}
            <Link to="/app/templates" onClick={onClose} data-testid="sidebar-templates">
              <button className={`flex w-full items-center gap-[10px] rounded-lg px-[10px] py-[7px] text-[13px] leading-[16px] transition-colors ${isActive("/app/templates") ? "bg-foreground font-semibold text-background" : "text-content-secondary hover:bg-surface-hover hover:text-foreground"}`}>
                <LayoutTemplate className={`h-[16px] w-[16px] shrink-0 ${isActive("/app/templates") ? "text-background" : "text-muted-foreground"}`} strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate text-start">{tr("القوالب")}</span>
              </button>
            </Link>

            <div className="flex items-center gap-1">
              <Link to="/app/help" className="flex flex-1 items-center gap-[10px] rounded-lg px-[10px] py-[7px] text-[13px] leading-[16px] text-content-secondary transition-colors hover:bg-surface-hover hover:text-foreground">
                <HelpCircle className="h-[16px] w-[16px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="min-w-0 truncate">{tr("مركز المساعدة")}</span>
              </Link>
              {/* Reference shows the language switch as a bare 12px ink word at
                  the end of the help row — no icon. */}
              <button
                onClick={toggleLanguage}
                className="rounded-lg px-2 py-[7px] transition-colors hover:bg-surface-hover"
                aria-label={t("تغيير اللغة إلى الإنجليزية", "Switch language to Arabic")}
              >
                <span className="font-english text-xs font-semibold text-foreground">{language === "ar" ? "EN" : "AR"}</span>
              </button>
            </div>
          </>
        )}

        {/* Mode indicator */}
        <div className="hidden items-center justify-center pt-1 lg:flex">
          <button
            onClick={cycleMode}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-surface-hover"
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
  const Icon = item.icon as React.ComponentType<{ className?: string; strokeWidth?: number }>;
  const tr = useSidebarText();
  return (
    <Link to={item.path!} onClick={onClick}>
      <button
        className={`flex w-full items-center rounded-lg text-[13px] transition-colors ${
          active ? "bg-foreground font-semibold text-background" : "text-content-secondary hover:bg-surface-hover hover:text-foreground"
        } ${collapsed ? "justify-center px-2 py-2" : "gap-[10px] px-[10px] py-[7px] leading-[16px]"}`}
        title={tr(item.title)}
      >
        <Icon className={`h-[16px] w-[16px] shrink-0 ${active ? "text-background" : "text-muted-foreground"}`} strokeWidth={1.75} />
        {!collapsed && <span className="min-w-0 flex-1 whitespace-normal break-words text-start">{tr(item.title)}</span>}
        {!collapsed && item.badge && (
          <span className="shrink-0 rounded-full bg-info-subtle px-1.5 py-0.5 text-[10px] font-semibold text-info">{tr(item.badge)}</span>
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
  const Icon = item.icon as React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
          className={`flex w-full items-center justify-center rounded-lg px-2 py-2 text-[13px] transition-colors ${
            isParentActive ? "bg-foreground text-background" : "text-content-secondary hover:bg-surface-hover hover:text-foreground"
          }`}
          title={tr(item.title)}
        >
          <Icon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex">
        <button
          onClick={handleMainClick}
          className={`flex flex-1 items-center gap-[10px] rounded-s-lg ps-[10px] pe-1 py-[7px] text-[13px] leading-[16px] transition-colors ${
            isParentActive
              ? "bg-foreground font-semibold text-background"
              : "text-content-secondary hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <Icon className={`h-[16px] w-[16px] shrink-0 ${isParentActive ? "text-background" : "text-muted-foreground"}`} strokeWidth={1.75} />
          <span className="min-w-0 flex-1 whitespace-normal break-words text-start">{tr(item.title)}</span>
          {item.badge && (
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isParentActive ? "bg-background/15 text-background" : "bg-info-subtle text-info"}`}>{tr(item.badge)}</span>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`rounded-e-lg px-2 py-[7px] text-[13px] leading-[16px] transition-colors ${
            isParentActive
              ? "bg-foreground text-background"
              : "text-content-secondary hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <ChevronLeft
            className={`h-[12px] w-[12px] shrink-0 transition-transform duration-200 ${isOpen ? "-rotate-90" : ""} ${isParentActive ? "text-background" : "text-muted-foreground"}`}
            strokeWidth={2}
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
            const ChildIcon = child.icon as React.ComponentType<{ className?: string; strokeWidth?: number }>;
            const active = isActive(child.path);
            return (
              <Link key={child.path + child.title} to={child.path} onClick={onNavigate}>
                <button
                  className={`flex w-full items-center gap-[10px] rounded-lg ps-8 pe-[10px] py-[7px] text-[13px] leading-[16px] transition-colors ${
                    active ? "bg-foreground font-semibold text-background" : "text-content-secondary hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  <ChildIcon className={`h-[16px] w-[16px] shrink-0 ${active ? "text-background" : "text-muted-foreground"}`} strokeWidth={1.75} />
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
