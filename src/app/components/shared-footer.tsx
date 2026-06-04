import { Link } from "react-router";
import { Instagram, Linkedin, Youtube, Twitter, Facebook, Mail, Phone, MapPin } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { EntixWordmark } from "./entix-brand";

export function SharedFooter() {
  const { language, t } = useLanguage();
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

  const socialLinks = [
    { icon: Instagram, href: "https://instagram.com", label: "Instagram", color: "#E4405F" },
    { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn", color: "#0A66C2" },
    { icon: Youtube, href: "https://youtube.com", label: "YouTube", color: "#FF0000" },
    { icon: Twitter, href: "https://twitter.com", label: "Twitter", color: "#1DA1F2" },
    { icon: Facebook, href: "https://facebook.com", label: "Facebook", color: "#1877F2" },
  ];

  return (
    <footer className="bg-[#0B1A47] text-white" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <div className="flex items-center mb-4">
              <EntixWordmark size={23} light />
            </div>
            <p className="text-[#94A3B8] max-w-sm mb-6" style={{ fontSize: "14px", lineHeight: 1.8 }}>
              {t(
                "نظام محاسبة سحابي متكامل للسوق السعودي والأمريكي. يعمل أونلاين وأوفلاين مع مزامنة ذكية ومتوافق بالكامل مع متطلبات ZATCA.",
                "A cloud accounting platform for Saudi and US operations. Works online and offline with smart sync and ZATCA-ready workflows."
              )}
            </p>
            
            {/* Contact info */}
            <div className="space-y-2.5 mb-6">
              <a href="mailto:support@entix.io" className="flex items-center gap-2.5 text-[#94A3B8] hover:text-white transition-colors group cursor-pointer">
                <Mail className="w-4 h-4 text-[#1276E3] group-hover:text-[#349FC4] transition-colors" />
                <span style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>support@entix.io</span>
              </a>
              <a href="tel:+966800430088" className="flex items-center gap-2.5 text-[#94A3B8] hover:text-white transition-colors group cursor-pointer">
                <Phone className="w-4 h-4 text-[#1276E3] group-hover:text-[#349FC4] transition-colors" />
                <span style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr" }}>+966 800 430 088</span>
              </a>
              <div className="flex items-start gap-2.5 text-[#94A3B8]">
                <MapPin className="w-4 h-4 text-[#1276E3] mt-0.5 flex-shrink-0" />
                <span style={{ fontSize: "13px" }}>{t("الرياض، المملكة العربية السعودية", "Riyadh, Saudi Arabia")}</span>
              </div>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 cursor-pointer group"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4 text-[#94A3B8] group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>{t("المنتج", "Product")}</h4>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer" 
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
            <h4 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>{t("الحلول", "Solutions")}</h4>
            <ul className="space-y-2.5">
              {footerLinks.solutions.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer" 
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
            <h4 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>{t("الموارد", "Resources")}</h4>
            <ul className="space-y-2.5">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer" 
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
            <h4 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>{t("الشركة", "Company")}</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer" 
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
          <h4 className="text-white mb-4" style={{ fontSize: "16px", fontWeight: 600 }}>{t("حمّل التطبيق", "Download the app")}</h4>
          <div className="flex flex-wrap gap-3">
            {[
              { name: "App Store", store: "Apple", available: true },
              { name: "Google Play", store: "Google", available: true },
              { name: "AppGallery", store: "Huawei", available: true },
            ].map((app) => (
              <button
                key={app.store}
                className="flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 rounded-xl transition-all cursor-pointer group"
                disabled={!app.available}
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-white" style={{ fontSize: "11px", fontWeight: 700, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
                    {app.store[0]}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[#94A3B8] group-hover:text-white transition-colors" style={{ fontSize: "10px" }}>
                    {t("متوفر على", "Available on")}
                  </div>
                  <div className="text-white" style={{ fontSize: "13px", fontWeight: 600 }}>
                    {app.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[#64748B] text-center md:text-right" style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
              &copy; 2026 ENTIX.IO. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {footerLinks.legal.map((link) => (
                <Link 
                  key={link.label}
                  to={link.href} 
                  className="text-[#64748B] hover:text-[#94A3B8] transition-colors cursor-pointer" 
                  style={{ fontSize: "13px" }}
                >
                    {t(link.label, link.labelEn)}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Development notice */}
          <div className="mt-6 text-center">
            <p className="text-[#F59E0B]/80 max-w-2xl mx-auto" style={{ fontSize: "12px", lineHeight: 1.7 }}>
              {t("⚠ الموقع حالياً تحت التطوير — لا يمكن الاشتراك في الوقت الحالي. سيتم الإعلان عن التشغيل الكامل قريباً.", "This site is currently in development. Subscriptions are not open yet; full launch will be announced soon.")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
