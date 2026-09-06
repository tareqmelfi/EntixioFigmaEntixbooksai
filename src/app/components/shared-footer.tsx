import { Link } from "react-router";
import { Mail, Phone, MapPin } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { EntixWordmark } from "./entix-brand";
import { MarketingChat } from "./marketing-chat";
import { useMarketingRegion } from "./marketing-region";
import { usePublicRoute } from "../lib/public-route";
import { PublicPreferenceSelector } from "./public-preference-selector";

export function SharedFooter() {
  const { language, t } = useLanguage();
  const { isSA } = useMarketingRegion();
  const { href } = usePublicRoute();
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
      { label: "برنامج الإحالة", labelEn: "Referral program", href: "/referrals" },
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
      { label: "دعم تطبيق iOS", labelEn: "iOS app support", href: "/support/ios" },
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
    <footer className="bg-surface-subtle text-foreground border-t border-border" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <div className="flex items-center mb-4">
              <EntixWordmark size={24} />
            </div>
            <p className="text-content-secondary max-w-sm mb-6" style={{ fontSize: "13px", lineHeight: 1.8 }}>
              {isSA
                ? t(
                    "نظام محاسبة سحابي للسوق السعودي مع نسخ احتياطي يومي. تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.",
                    "A cloud accounting platform for Saudi operations with automatic daily backups. ZATCA Phase 2 integration is under validation and is not enabled for production reliance.",
                  )
                : t(
                    "نظام محاسبة سحابي للسوق الأمريكي مع نسخ احتياطي يومي، ومدفوعات Stripe، وربط Plaid التجريبي.",
                    "A cloud accounting platform for US operations with automatic daily backups, Stripe payments, and Plaid bank feeds in Beta.",
                  )}
            </p>
            
            {/* Contact info */}
            <div className="space-y-2.5 mb-6">
              <a href="mailto:support@entix.io" className="flex items-center gap-2.5 text-content-secondary hover:text-foreground transition-colors group cursor-pointer">
                <Mail className="w-4 h-4 text-primary transition-colors" />
                <span style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>support@entix.io</span>
              </a>
              <a href="tel:+1442444410" className="flex items-center gap-2.5 text-content-secondary hover:text-foreground transition-colors group cursor-pointer">
                <Phone className="w-4 h-4 text-primary transition-colors" />
                <span style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr" }}>+1 (442) 444-410</span>
              </a>
              <div className="flex items-start gap-2.5 text-content-secondary">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span style={{ fontSize: "13px" }}>{t("وايومنغ، الولايات المتحدة الأمريكية · ENSIDEX LLC", "Wyoming, United States · ENSIDEX LLC")}</span>
              </div>
            </div>

          </div>

          {/* Product */}
          <div>
            <h2 className="text-foreground mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("المنتج", "Product")}</h2>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={href(link.href)}
                    className="text-content-secondary hover:text-foreground transition-colors cursor-pointer"
                    style={{ fontSize: "13px" }}
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h2 className="text-foreground mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("الحلول", "Solutions")}</h2>
            <ul className="space-y-2.5">
              {footerLinks.solutions.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={href(link.href)}
                    className="text-content-secondary hover:text-foreground transition-colors cursor-pointer"
                    style={{ fontSize: "13px" }}
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h2 className="text-foreground mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("الموارد", "Resources")}</h2>
            <ul className="space-y-2.5">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={href(link.href)}
                    className="text-content-secondary hover:text-foreground transition-colors cursor-pointer"
                    style={{ fontSize: "13px" }}
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h2 className="text-foreground mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("الشركة", "Company")}</h2>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={href(link.href)}
                    className="text-content-secondary hover:text-foreground transition-colors cursor-pointer"
                    style={{ fontSize: "13px" }}
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Download apps section */}
        <div className="bg-card rounded-lg p-5 mb-12 border border-border">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-foreground" style={{ fontSize: "15px", fontWeight: 600 }}>{t("تطبيقات الجوال", "Mobile apps")}</h2>
            <Link to={href("/support/ios")} className="text-sm font-semibold text-primary transition-colors hover:text-foreground">
              {t("دعم تطبيق iOS", "iOS app support")}
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {appStores.map((app) => (
              <button
                key={app.store}
                className={`flex items-center gap-2.5 border px-4 py-2.5 rounded-md transition-colors ${
                  app.available
                    ? "bg-surface-subtle hover:bg-surface-hover border-border cursor-pointer group"
                    : "bg-surface-subtle border-border cursor-not-allowed opacity-70"
                }`}
                disabled={!app.available}
              >
                <div className="w-8 h-8 rounded-md bg-info-subtle flex items-center justify-center">
                  <span className="text-primary font-display" style={{ fontSize: "12px", fontWeight: 700 }}>
                    {app.store[0]}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-content-secondary transition-colors" style={{ fontSize: "10px" }}>
                    {app.available ? t("متوفر على", "Available on") : t("قريباً", "Coming soon")}
                  </div>
                  <div className="text-foreground" style={{ fontSize: "13px", fontWeight: 600 }}>
                    {app.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-content-secondary" style={{ fontSize: "12px", lineHeight: 1.7 }}>
            {t(
              "للمساعدة في تطبيق ENTIX.IO على iPhone وiPad، راجع صفحة دعم iOS الرسمية.",
              "For help with ENTIX.IO on iPhone and iPad, visit the official iOS support page."
            )}
          </p>
        </div>

        {/* Payment methods — above the bottom bar. Honest set: cards + mada +
            Apple Pay run through Stripe; no PayPal (not supported). */}
        <div className="pt-8 mt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-content-secondary" style={{ fontSize: "12px", fontWeight: 600 }}>
            <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            {t("دفع آمن ومشفّر", "Secure encrypted checkout")}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2" dir="ltr">
            {/* Visa */}
            <span className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2.5 h-7 text-foreground" title="Visa">
              <span style={{ fontSize: "13px", fontWeight: 800, fontStyle: "italic", letterSpacing: "0.02em" }}>VISA</span>
            </span>
            {/* Mastercard */}
            <span className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2.5 h-7 text-foreground" title="Mastercard">
              <svg width="30" height="18" viewBox="0 0 30 18" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="9" r="6.2"/><circle cx="19" cy="9" r="6.2"/></svg>
            </span>
            {isSA && (
              <span className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2.5 h-7 text-foreground" title="mada">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2.8l7.6 4.3v8.6L12 20l-7.6-4.3V7.1L12 2.8z"/></svg>
                <span style={{ fontSize: "12px", fontWeight: 800 }}>mada</span>
              </span>
            )}
            {/* Apple Pay */}
            <span className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2.5 h-7 text-foreground" title="Apple Pay">
              <span style={{ fontSize: "12px", fontWeight: 600 }}>Apple&nbsp;Pay</span>
            </span>
            {/* Stripe */}
            <span className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2.5 h-7 text-foreground" title="Powered by Stripe">
              <span style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.01em" }}>stripe</span>
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-content-secondary text-center md:text-start" style={{ fontSize: "13px" }}>
              &copy; 2026 ENTIX.IO · {t("يعمل بواسطة", "Powered by")}{" "}
              <span className="text-foreground" style={{ fontWeight: 700, letterSpacing: "0.03em" }}>ENSIDEX</span>{" "}
              <span>LLC · {t("وايومنغ، الولايات المتحدة", "Wyoming, USA")}</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <PublicPreferenceSelector />
              {footerLinks.legal.map((link) => (
                <Link 
                  key={link.label}
                  to={href(link.href)}
                  className="text-content-secondary hover:text-foreground transition-colors cursor-pointer"
                  style={{ fontSize: "13px" }}
                >
                    {t(link.label, link.labelEn)}
                </Link>
              ))}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("entix:cookie-preferences"))}
                className="text-content-secondary hover:text-foreground transition-colors cursor-pointer"
                style={{ fontSize: "13px" }}
              >
                {t("تفضيلات الكوكيز", "Cookie preferences")}
              </button>
            </div>
          </div>
          
          {/* Development notice */}
          <div className="mt-6 text-center">
            <p className="text-content-secondary max-w-2xl mx-auto" style={{ fontSize: "12px", lineHeight: 1.7 }}>
              {t("الاشتراك متاح الآن — دفع آمن عبر Stripe.", "Subscriptions are open — secure payment via Stripe.")}
            </p>
          </div>
        </div>
      </div>
      {/* Marketing assistant bubble (Azure agent wired later via VITE_MARKETING_CHAT_URL) */}
      <MarketingChat />
    </footer>
  );
}
