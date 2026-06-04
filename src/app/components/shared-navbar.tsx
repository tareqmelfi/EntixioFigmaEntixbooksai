import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { Menu, X, ChevronDown, Globe } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "./LanguageContext";
import { EntixWordmark } from "./entix-brand";

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
  const { language, toggleLanguage, t } = useLanguage();
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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
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
      ]
    },
    { label: "الأسعار", labelEn: "Pricing", href: "/pricing" },
  ];

  const handleNavigate = (path: string) => {
    setMobileNav(false);
    setOpenDropdown(null);
    navigate(path);
  };

  return (
    <>
    <nav
      dir={language === "en" ? "ltr" : "rtl"}
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/98 backdrop-blur-xl shadow-md shadow-black/5"
          : "bg-white/90 backdrop-blur-md"
      } border-b border-gray-100/80`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[64px] sm:h-[68px] flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center hover:opacity-90 transition-opacity cursor-pointer" aria-label="ENTIX.IO">
          <EntixWordmark size={25} />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1" ref={dropdownRef}>
          {navItems.map((item) => (
            <div key={item.label} className="relative">
              {item.dropdown ? (
                <>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                    className="flex items-center gap-1.5 px-4 py-2 text-[#374151] hover:text-[#0B1A47] hover:bg-gray-50 rounded-lg transition-all cursor-pointer"
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
                        className="absolute top-full end-0 mt-2 w-[280px] bg-white rounded-xl shadow-2xl shadow-black/10 border border-gray-100 overflow-hidden"
                      >
                        {item.dropdown.map((subItem, i) => (
                          <button
                            key={subItem.label}
                            onClick={() => handleNavigate(subItem.href)}
                            className={`w-full text-start px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer ${
                              i !== item.dropdown!.length - 1 ? "border-b border-gray-50" : ""
                            }`}
                          >
                            <div className="text-[#0B1A47]" style={{ fontSize: "14px", fontWeight: 600 }}>
                              {t(subItem.label, subItem.labelEn)}
                            </div>
                            {subItem.desc && (
                              <div className="text-[#6B7280] mt-0.5" style={{ fontSize: "12px" }}>
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
                  to={item.href!}
                  className="block px-4 py-2 text-[#374151] hover:text-[#0B1A47] hover:bg-gray-50 rounded-lg transition-all cursor-pointer"
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
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 rounded-lg border border-gray-100 px-3 py-2 text-[#374151] hover:border-[#1276E3]/30 hover:bg-[#F4FCFF] hover:text-[#0B1A47] transition-colors"
            style={{ fontSize: "13px", fontWeight: 600 }}
            aria-label={t("تغيير اللغة إلى الإنجليزية", "Switch language to Arabic")}
          >
            <Globe className="h-4 w-4" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>
          <button 
            onClick={() => navigate("/login")}
            className="text-[#0B1A47] hover:text-[#1276E3] transition-colors cursor-pointer px-4 py-2.5" 
            style={{ fontSize: "14px", fontWeight: 500 }}
          >
            {t("تسجيل الدخول", "Sign in")}
          </button>
          <button
            onClick={() => navigate("/register")}
            className="bg-[#05B6FA] hover:bg-[#0498D4] text-white px-6 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-[#05B6FA]/25 cursor-pointer"
            style={{ fontSize: "14px", fontWeight: 600 }}
          >
            {t("ابدأ مجاناً", "Start free")}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button 
          onClick={() => setMobileNav(!mobileNav)} 
          className="lg:hidden p-2 text-[#0B1A47] hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
        >
          {mobileNav ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileNav && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }} 
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-t border-gray-100 shadow-xl overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2 max-h-[calc(100vh-68px)] overflow-y-auto">
              {navItems.map((item) => (
                <div key={item.label}>
                  {item.dropdown ? (
                    <>
                      <div className="text-[#6B7280] px-3 py-2" style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t(item.label, item.labelEn)}
                      </div>
                      <div className="space-y-1 mb-3">
                        {item.dropdown.map((subItem) => (
                          <button
                            key={subItem.label}
                            onClick={() => handleNavigate(subItem.href)}
                            className="w-full text-start px-3 py-2.5 text-[#374151] hover:bg-gray-50 hover:text-[#0B1A47] rounded-lg transition-colors cursor-pointer"
                            style={{ fontSize: "15px", fontWeight: 500 }}
                          >
                            {t(subItem.label, subItem.labelEn)}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleNavigate(item.href!)}
                      className="w-full text-start px-3 py-2.5 text-[#374151] hover:bg-gray-50 hover:text-[#0B1A47] rounded-lg transition-colors cursor-pointer"
                      style={{ fontSize: "15px", fontWeight: 500 }}
                    >
                      {t(item.label, item.labelEn)}
                    </button>
                  )}
                </div>
              ))}
              <hr className="border-gray-100 my-4" />
              <button
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[#374151] hover:bg-gray-50 hover:text-[#0B1A47] rounded-lg transition-colors cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                <span>{t("اللغة", "Language")}</span>
                <span className="flex items-center gap-1.5 font-english">
                  <Globe className="h-4 w-4" />
                  {language === "ar" ? "English" : "العربية"}
                </span>
              </button>
              <button 
                onClick={() => handleNavigate("/login")} 
                className="w-full text-start text-[#0B1A47] px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                {t("تسجيل الدخول", "Sign in")}
              </button>
              <button
                onClick={() => handleNavigate("/register")}
                className="w-full bg-[#05B6FA] text-white py-3 rounded-xl cursor-pointer hover:bg-[#0498D4] transition-colors"
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
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3 safe-area-inset-bottom">
        <button
          onClick={() => navigate("/register")}
          className="w-full bg-[#05B6FA] text-white py-3 rounded-xl shadow-lg shadow-[#05B6FA]/20 hover:bg-[#0498D4] transition-colors cursor-pointer"
          style={{ fontSize: "15px", fontWeight: 600 }}
        >
          {t("ابدأ مجاناً", "Start free")}
        </button>
      </div>
    )}
    </>
  );
}
