import { Link } from "react-router";
import { Mail, Phone, MapPin } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { EntixWordmark } from "./entix-brand";

export function SharedFooter() {
  const { language, t } = useLanguage();
  const appStores = [
    { name: "App Store", store: "Apple", available: false },
    { name: "Google Play", store: "Google", available: false },
    { name: "AppGallery", store: "Huawei", available: false },
  ] as const;
  const footerLinks = {
    product: [
      { label: "المميزات", labelEn: "Features", href: "/features" },
      { label: "التكامل والأمان", labelEn: "Integration & security", href: "/integration" },
      { label: "التسعير", labelEn: "Pricing", href: "/pricing" },
      { label: "التحديثات", labelEn: "Changelog", href: "/changelog" },
      { label: "خارطة الطريق", labelEn: "Roadmap", href: "/roadmap" },
    ],
    solutions: [
      { label: "للمحاسبين", labelEn: "For accountants", href: "/solutions/accountants" },
      { label: "للشركات الصغيرة", labelEn: "For small businesses", href: "/solutions/small-business" },
      { label: "للمؤسسات", labelEn: "For enterprises", href: "/solutions/enterprises" },
      { label: "للمطاعم والكافيهات", labelEn: "Restaurants & cafes", href: "/solutions/restaurants" },
      { label: "للتجارة الإلكترونية", labelEn: "E-commerce", href: "/solutions/ecommerce" },
    ],
    resources: [
      { label: "المدونة", labelEn: "Blog", href: "/blog" },
      { label: "مركز المساعدة", labelEn: "Help center", href: "/help" },
      { label: "التوثيق", labelEn: "Docs", href: "/docs" },
      { label: "الفيديوهات التعليمية", labelEn: "Videos", href: "/videos" },
      { label: "دراسات الحالة", labelEn: "Case studies", href: "/case-studies" },
      { label: "قاموس المحاسبة", labelEn: "Accounting glossary", href: "/glossary" },
    ],
    company: [
      { label: "عن ENTIX.IO", labelEn: "About ENTIX.IO", href: "/about" },
      { label: "الفريق", labelEn: "Team", href: "/team" },
      { label: "الوظائف", labelEn: "Careers", href: "/careers" },
      { label: "اتصل بنا", labelEn: "Contact", href: "/contact" },
      { label: "الشركاء", labelEn: "Partners", href: "/partners" },
    ],
    legal: [
      { label: "سياسة الخصوصية", labelEn: "Privacy", href: "/privacy" },
      { label: "الشروط والأحكام", labelEn: "Terms", href: "/terms" },
      { label: "سياسة الاسترجاع", labelEn: "Refund policy", href: "/refund" },
      { label: "اتفاقية مستوى الخدمة", labelEn: "SLA", href: "/sla" },
    ],
  };

  return (
    <footer className="bg-foreground text-white" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <div className="flex items-center mb-4">
              <EntixWordmark size={30} light />
            </div>
            <p className="text-muted-foreground max-w-sm mb-6" style={{ fontSize: "14px", lineHeight: 1.8 }}>
              {t(
                "نظام محاسبة سحابي متكامل للسوقين السعودي والأمريكي. جاهزية للفوترة الإلكترونية وفق متطلبات ZATCA مع نسخ احتياطي يومي تلقائي.",
                "A cloud accounting platform for Saudi and US operations, with ZATCA-ready e-invoicing workflows and automatic daily backups."
              )}
            </p>
            
            {/* Contact info */}
            <div className="space-y-2.5 mb-6">
              <a href="mailto:support@entix.io" className="flex items-center gap-2.5 text-muted-foreground hover:text-white transition-colors group cursor-pointer">
                <Mail className="w-4 h-4 text-primary group-hover:text-secondary transition-colors" />
                <span style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>support@entix.io</span>
              </a>
              <a href="tel:+1442444410" className="flex items-center gap-2.5 text-muted-foreground hover:text-white transition-colors group cursor-pointer">
                <Phone className="w-4 h-4 text-primary group-hover:text-secondary transition-colors" />
                <span style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr" }}>+1 (442) 444-410</span>
              </a>
              <div className="flex items-start gap-2.5 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span style={{ fontSize: "13px" }}>{t("وايومنغ، الولايات المتحدة الأمريكية · ENSIDEX LLC", "Wyoming, United States · ENSIDEX LLC")}</span>
              </div>
            </div>

          </div>

          {/* Product */}
          <div>
            <h2 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>{t("المنتج", "Product")}</h2>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-muted-foreground hover:text-white transition-colors cursor-pointer" 
                    style={{ fontSize: "14px" }}
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h2 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>{t("الحلول", "Solutions")}</h2>
            <ul className="space-y-2.5">
              {footerLinks.solutions.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-muted-foreground hover:text-white transition-colors cursor-pointer" 
                    style={{ fontSize: "14px" }}
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h2 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>{t("الموارد", "Resources")}</h2>
            <ul className="space-y-2.5">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-muted-foreground hover:text-white transition-colors cursor-pointer" 
                    style={{ fontSize: "14px" }}
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h2 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>{t("الشركة", "Company")}</h2>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-muted-foreground hover:text-white transition-colors cursor-pointer" 
                    style={{ fontSize: "14px" }}
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Download apps section */}
        <div className="bg-white/5 rounded-2xl p-6 mb-12 border border-white/10">
          <h2 className="text-white mb-4" style={{ fontSize: "16px", fontWeight: 600 }}>{t("تطبيقات الجوال", "Mobile apps")}</h2>
          <div className="flex flex-wrap gap-3">
            {appStores.map((app) => (
              <button
                key={app.store}
                className={`flex items-center gap-2.5 border px-4 py-2.5 rounded-xl transition-all ${
                  app.available
                    ? "bg-white/10 hover:bg-white/20 border-white/20 cursor-pointer group"
                    : "bg-white/5 border-white/10 cursor-not-allowed opacity-70"
                }`}
                disabled={!app.available}
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-white" style={{ fontSize: "11px", fontWeight: 700, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
                    {app.store[0]}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground group-hover:text-white transition-colors" style={{ fontSize: "10px" }}>
                    {app.available ? t("متوفر على", "Available on") : t("قريباً", "Coming soon")}
                  </div>
                  <div className="text-white" style={{ fontSize: "13px", fontWeight: 600 }}>
                    {app.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-muted-foreground" style={{ fontSize: "12px", lineHeight: 1.7 }}>
            {t(
              "تطبيقات iPhone وAndroid ما زالت في QA خاص ولم تُنشر بعد على المتاجر.",
              "iPhone and Android companion apps are still in private QA and are not yet live on app stores."
            )}
          </p>
        </div>

        {/* Payment methods — above the bottom bar. Honest set: cards + mada +
            Apple Pay run through Stripe; no PayPal (not supported). */}
        <div className="pt-8 mt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 600 }}>
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            {t("دفع آمن ومشفّر", "Secure encrypted checkout")}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2" dir="ltr">
            {/* Visa */}
            <span className="inline-flex items-center justify-center rounded-md bg-white px-2.5 h-7" title="Visa">
              <span style={{ color: "#1A1F71", fontSize: "13px", fontWeight: 900, fontStyle: "italic", letterSpacing: "0.02em" }}>VISA</span>
            </span>
            {/* Mastercard */}
            <span className="inline-flex items-center justify-center rounded-md bg-white px-2.5 h-7" title="Mastercard">
              <svg width="30" height="18" viewBox="0 0 30 18"><circle cx="11" cy="9" r="7" fill="#EB001B"/><circle cx="19" cy="9" r="7" fill="#F79E1B" fillOpacity="0.9"/><path d="M15 3.8a7 7 0 0 1 0 10.4 7 7 0 0 1 0-10.4z" fill="#FF5F00"/></svg>
            </span>
            {/* mada */}
            <span className="inline-flex items-center justify-center gap-1 rounded-md bg-white px-2.5 h-7" title="mada">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" fill="#00A19A"/><path d="M12 6.5l4.5 2.5v5L12 16.5 7.5 14v-5L12 6.5z" fill="#fff"/></svg>
              <span style={{ color: "#00205B", fontSize: "12px", fontWeight: 800 }}>mada</span>
            </span>
            {/* Apple Pay */}
            <span className="inline-flex items-center justify-center rounded-md bg-white px-2.5 h-7" title="Apple Pay">
              <span style={{ color: "#000", fontSize: "12px", fontWeight: 600, fontFamily: "-apple-system, system-ui, sans-serif" }}>Apple&nbsp;Pay</span>
            </span>
            {/* Stripe */}
            <span className="inline-flex items-center justify-center rounded-md bg-white px-2.5 h-7" title="Powered by Stripe">
              <span style={{ color: "#635BFF", fontSize: "13px", fontWeight: 800, letterSpacing: "0.01em" }}>stripe</span>
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-center md:text-right" style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
              &copy; 2026 ENTIX.IO · {t("يعمل بواسطة", "Powered by")}{" "}
              <span className="text-secondary" style={{ fontWeight: 800, letterSpacing: "0.03em" }}>ENSIDEX</span>{" "}
              <span>LLC · {t("وايومنغ، الولايات المتحدة", "Wyoming, USA")}</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {footerLinks.legal.map((link) => (
                <Link 
                  key={link.label}
                  to={link.href} 
                  className="text-muted-foreground hover:text-white transition-colors cursor-pointer" 
                  style={{ fontSize: "13px" }}
                >
                    {t(link.label, link.labelEn)}
                </Link>
              ))}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("entix:cookie-preferences"))}
                className="text-muted-foreground hover:text-white transition-colors cursor-pointer"
                style={{ fontSize: "13px" }}
              >
                {t("تفضيلات الكوكيز", "Cookie preferences")}
              </button>
            </div>
          </div>
          
          {/* Development notice */}
          <div className="mt-6 text-center">
            <p className="text-amber-500/80 max-w-2xl mx-auto" style={{ fontSize: "12px", lineHeight: 1.7 }}>
              {t("الاشتراك متاح الآن — دفع آمن عبر Stripe.", "Subscriptions are open — secure payment via Stripe.")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
