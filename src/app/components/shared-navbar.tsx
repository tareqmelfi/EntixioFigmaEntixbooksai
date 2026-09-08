import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "./LanguageContext";
import { EntixWordmark } from "./entix-brand";
import { usePublicRoute } from "../lib/public-route";
import { PublicPreferenceSelector, PublicLanguageToggle } from "./public-preference-selector";

interface DropdownItem {
  label: string;
  labelEn?: string;
  desc?: string;
  descEn?: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  label: string;
  labelEn?: string;
  href?: string;
  dropdown?: DropdownItem[];
}

export function SharedNavbar() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const publicRoute = usePublicRoute();
  const publicHref = publicRoute.href;
  const [mobileNav, setMobileNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const inNav = dropdownRef.current && dropdownRef.current.contains(e.target as Node);
      if (!inNav) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems: NavItem[] = [
    {
      label: "المنتج",
      labelEn: "Product",
      dropdown: [
        { label: "المميزات", labelEn: "Features", desc: "اكتشف جميع إمكانيات النظام", descEn: "Discover all system capabilities", href: "/features" },
        { label: "التكامل والأمان", labelEn: "Integration & Security", desc: "المزامنة والالتزام والحماية", descEn: "Synchronization, compliance, and protection", href: "/integration" },
        { label: "التسعير", labelEn: "Pricing", desc: "خطط مرنة لجميع الأحجام", descEn: "Flexible plans for all sizes", href: "/pricing" },
      ]
    },
    {
      label: "الحلول",
      labelEn: "Solutions",
      dropdown: [
        { label: "للمحاسبين", labelEn: "For Accountants", desc: "أدوات احترافية متقدمة", descEn: "Advanced professional tools", href: "/solutions/accountants" },
        { label: "للشركات الصغيرة", labelEn: "For Small Businesses", desc: "بداية سهلة واحترافية", descEn: "Easy and professional start", href: "/solutions/small-business" },
        { label: "للمؤسسات الكبيرة", labelEn: "For Enterprises", desc: "حلول مؤسسية متكاملة", descEn: "Integrated enterprise solutions", href: "/solutions/enterprises" },
      ]
    },
    {
      label: "الموارد",
      labelEn: "Resources",
      dropdown: [
        { label: "المدونة", labelEn: "Blog", desc: "مقالات ونصائح محاسبية", descEn: "Accounting articles and tips", href: "/blog" },
        { label: "مركز المساعدة", labelEn: "Help Center", desc: "إجابات لجميع أسئلتك", descEn: "Answers to all your questions", href: "/help" },
        { label: "التوثيق", labelEn: "Documentation", desc: "دليل استخدام شامل", descEn: "Comprehensive user guide", href: "/docs" },
        { label: "الفيديوهات", labelEn: "Videos", desc: "شروحات مرئية تفاعلية", descEn: "Interactive visual tutorials", href: "/videos" },
        { label: "برنامج الإحالة", labelEn: "Referral Program", desc: "اكسب عمولة 50% مع كل إحالة", descEn: "Earn 50% commission per referral", href: "/referrals" },
      ]
    },
    { label: "الأسعار", labelEn: "Pricing", href: "/pricing" },
  ];

  const handleNavigate = (path: string) => {
    setMobileNav(false);
    setOpenDropdown(null);
    navigate(publicHref(path));
  };

  return (
    <>
    <nav
      dir={language === "en" ? "ltr" : "rtl"}
      className={`fixed top-0 right-0 left-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-background/95 backdrop-blur" : "bg-background/90 backdrop-blur"
      } border-b border-border`}
    >
      <div className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] h-[64px] lg:h-[88px] flex items-center justify-between gap-6">
        {/* Logo */}
        <Link to={publicHref("")} className="flex items-center hover:opacity-80 transition-opacity cursor-pointer" aria-label="ENTIX.IO">
          <EntixWordmark size={20} />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-9" ref={dropdownRef}>
          {navItems.map((item) => (
            <div key={item.label} className="relative">
              {item.dropdown ? (
                <>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                    className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors cursor-pointer"
                    style={{ fontSize: "15px", fontWeight: 500 }}
                  >
                    {t(item.label, item.labelEn)}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        openDropdown === item.label ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openDropdown === item.label && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full end-0 mt-2 w-[280px] bg-card rounded-lg shadow-popover border border-border overflow-hidden"
                      >
                        {item.dropdown.map((subItem, i) => (
                          <button
                            key={subItem.label}
                            onClick={() => handleNavigate(subItem.href)}
                            className={`w-full text-start px-5 py-3 hover:bg-surface-hover transition-colors cursor-pointer ${
                              i !== item.dropdown!.length - 1 ? "border-b border-border" : ""
                            }`}
                          >
                            <div className="text-foreground" style={{ fontSize: "14px", fontWeight: 600 }}>
                              {t(subItem.label, subItem.labelEn)}
                            </div>
                            {subItem.desc && (
                              <div className="text-muted-foreground mt-0.5" style={{ fontSize: "12px" }}>
                                {t(subItem.desc, subItem.descEn)}
                              </div>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <Link
                  to={publicHref(item.href!)}
                  className="block text-foreground hover:text-primary transition-colors cursor-pointer"
                  style={{ fontSize: "15px", fontWeight: 500 }}
                >
                  {t(item.label, item.labelEn)}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="hidden lg:flex items-center gap-3">
          <PublicPreferenceSelector />
          <button
            onClick={() => navigate(publicHref("/login"))}
            className="text-foreground hover:text-primary transition-colors cursor-pointer px-2"
            style={{ fontSize: "15px", fontWeight: 500 }}
          >
            {t("تسجيل الدخول", "Sign in")}
          </button>
          <button
            onClick={() => navigate(publicHref("/register"))}
            className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-background transition-colors hover:bg-primary cursor-pointer"
            style={{ fontSize: "14px", fontWeight: 600 }}
          >
            {t("ابدأ مجاناً", "Start free")}
          </button>
        </div>

        {/* Mobile CTA + hamburger */}
        <div className="lg:hidden flex items-center gap-2">
          {/* Language switch stays OUTSIDE the hamburger — on a phone it must be
              one tap from the first paint (CEO 2026-09-08). */}
          <PublicLanguageToggle />
          <button
            onClick={() => navigate(publicHref("/register"))}
            className="inline-flex h-10 items-center rounded-full bg-foreground px-3.5 text-background transition-colors hover:bg-primary cursor-pointer"
            style={{ fontSize: "13px", fontWeight: 600 }}
          >
            {t("ابدأ مجاناً", "Start free")}
          </button>
        <button
          onClick={() => setMobileNav(!mobileNav)}
          aria-label={mobileNav ? t("إغلاق القائمة", "Close menu") : t("فتح القائمة", "Open menu")}
          aria-expanded={mobileNav}
          className="h-11 w-11 inline-flex items-center justify-center text-foreground hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
        >
          {mobileNav ? <X className="w-[22px] h-[22px]" strokeWidth={1.8} /> : <Menu className="w-[22px] h-[22px]" strokeWidth={1.8} />}
        </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileNav && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }} 
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-card border-t border-border shadow-popover overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2 max-h-[calc(100vh-68px)] overflow-y-auto">
              {navItems.map((item) => (
                <div key={item.label}>
                  {item.dropdown ? (
                    <>
                      <div className="text-muted-foreground px-3 py-2" style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t(item.label, item.labelEn)}
                      </div>
                      <div className="space-y-1 mb-3">
                        {item.dropdown.map((subItem) => (
                          <button
                            key={subItem.label}
                            onClick={() => handleNavigate(subItem.href)}
                            className="w-full text-start px-3 py-2.5 text-content-secondary hover:bg-surface-hover hover:text-foreground rounded-md transition-colors cursor-pointer"
                            style={{ fontSize: "14px", fontWeight: 500 }}
                          >
                            {t(subItem.label, subItem.labelEn)}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleNavigate(item.href!)}
                      className="w-full text-start px-3 py-2.5 text-content-secondary hover:bg-surface-hover hover:text-foreground rounded-md transition-colors cursor-pointer"
                      style={{ fontSize: "14px", fontWeight: 500 }}
                    >
                      {t(item.label, item.labelEn)}
                    </button>
                  )}
                </div>
              ))}
              <hr className="border-border my-4" />
              <div className="px-3 py-2.5"><PublicPreferenceSelector /></div>
              <button 
                onClick={() => handleNavigate("/login")} 
                className="w-full text-start text-foreground px-3 py-2.5 hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                {t("تسجيل الدخول", "Sign in")}
              </button>
              <button
                onClick={() => handleNavigate("/register")}
                className="w-full bg-foreground text-background py-3 rounded-full cursor-pointer hover:bg-primary transition-colors"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("ابدأ مجاناً", "Start free")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>

    {/* Mobile fixed-bottom CTA · outside fixed nav so it stays anchored to viewport bottom */}
    {!mobileNav && (
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-3 safe-area-inset-bottom">
        <button
          onClick={() => navigate(publicHref("/register"))}
          className="w-full bg-foreground text-background py-3 rounded-full hover:bg-primary transition-colors cursor-pointer"
          style={{ fontSize: "15px", fontWeight: 600 }}
        >
          {t("ابدأ مجاناً", "Start free")}
        </button>
      </div>
    )}
    </>
  );
}
