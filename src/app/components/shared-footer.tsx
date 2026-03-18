import { Link } from "react-router";
import { Instagram, Linkedin, Youtube, Twitter, Facebook, Mail, Phone, MapPin } from "lucide-react";

export function SharedFooter() {
  const footerLinks = {
    product: [
      { label: "المميزات", href: "/features" },
      { label: "التكامل والأمان", href: "/integration" },
      { label: "التسعير", href: "/pricing" },
      { label: "التحديثات", href: "/changelog" },
      { label: "خارطة الطريق", href: "/roadmap" },
    ],
    solutions: [
      { label: "للمحاسبين", href: "/solutions/accountants" },
      { label: "للشركات الصغيرة", href: "/solutions/small-business" },
      { label: "للمؤسسات", href: "/solutions/enterprises" },
      { label: "للمطاعم والكافيهات", href: "/solutions/restaurants" },
      { label: "للتجارة الإلكترونية", href: "/solutions/ecommerce" },
    ],
    resources: [
      { label: "المدونة", href: "/blog" },
      { label: "مركز المساعدة", href: "/help" },
      { label: "التوثيق", href: "/docs" },
      { label: "الفيديوهات التعليمية", href: "/videos" },
      { label: "دراسات الحالة", href: "/case-studies" },
      { label: "قاموس المحاسبة", href: "/glossary" },
    ],
    company: [
      { label: "عن Entix Books", href: "/about" },
      { label: "الفريق", href: "/team" },
      { label: "الوظائف", href: "/careers" },
      { label: "اتصل بنا", href: "/contact" },
      { label: "الشركاء", href: "/partners" },
    ],
    legal: [
      { label: "سياسة الخصوصية", href: "/privacy" },
      { label: "الشروط والأحكام", href: "/terms" },
      { label: "سياسة الاسترجاع", href: "/refund" },
      { label: "اتفاقية مستوى الخدمة", href: "/sla" },
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
    <footer className="bg-[#0B1A47] text-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <span className="text-white" style={{ fontSize: "16px", fontWeight: 700, fontFamily: "Inter" }}>E</span>
              </div>
              <span className="text-white" style={{ fontSize: "20px", fontWeight: 700 }}>Entix Books</span>
            </div>
            <p className="text-[#94A3B8] max-w-sm mb-6" style={{ fontSize: "14px", lineHeight: 1.8 }}>
              نظام محاسبة سحابي متكامل للسوق السعودي والأمريكي. يعمل أونلاين وأوفلاين مع مزامنة ذكية ومتوافق بالكامل مع متطلبات ZATCA.
            </p>
            
            {/* Contact info */}
            <div className="space-y-2.5 mb-6">
              <a href="mailto:support@entix.io" className="flex items-center gap-2.5 text-[#94A3B8] hover:text-white transition-colors group cursor-pointer">
                <Mail className="w-4 h-4 text-[#1276E3] group-hover:text-[#349FC4] transition-colors" />
                <span style={{ fontSize: "13px", fontFamily: "Inter" }}>support@entix.io</span>
              </a>
              <a href="tel:+966800430088" className="flex items-center gap-2.5 text-[#94A3B8] hover:text-white transition-colors group cursor-pointer">
                <Phone className="w-4 h-4 text-[#1276E3] group-hover:text-[#349FC4] transition-colors" />
                <span style={{ fontSize: "13px", fontFamily: "Inter", direction: "ltr" }}>+966 800 430 088</span>
              </a>
              <div className="flex items-start gap-2.5 text-[#94A3B8]">
                <MapPin className="w-4 h-4 text-[#1276E3] mt-0.5 flex-shrink-0" />
                <span style={{ fontSize: "13px" }}>الرياض، المملكة العربية السعودية</span>
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
            <h4 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>المنتج</h4>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer" 
                    style={{ fontSize: "14px" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>الحلول</h4>
            <ul className="space-y-2.5">
              {footerLinks.solutions.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer" 
                    style={{ fontSize: "14px" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>الموارد</h4>
            <ul className="space-y-2.5">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer" 
                    style={{ fontSize: "14px" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white mb-4" style={{ fontSize: "15px", fontWeight: 600 }}>الشركة</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer" 
                    style={{ fontSize: "14px" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Download apps section */}
        <div className="bg-white/5 rounded-2xl p-6 mb-12 border border-white/10">
          <h4 className="text-white mb-4" style={{ fontSize: "16px", fontWeight: 600 }}>حمّل التطبيق</h4>
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
                  <span className="text-white" style={{ fontSize: "11px", fontWeight: 700, fontFamily: "Inter" }}>
                    {app.store[0]}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[#94A3B8] group-hover:text-white transition-colors" style={{ fontSize: "10px" }}>
                    متوفر على
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
            <p className="text-[#64748B] text-center md:text-right" style={{ fontSize: "13px", fontFamily: "Inter" }}>
              &copy; 2026 Entix Books. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {footerLinks.legal.map((link) => (
                <Link 
                  key={link.label}
                  to={link.href} 
                  className="text-[#64748B] hover:text-[#94A3B8] transition-colors cursor-pointer" 
                  style={{ fontSize: "13px" }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Development notice */}
          <div className="mt-6 text-center">
            <p className="text-[#F59E0B]/80 max-w-2xl mx-auto" style={{ fontSize: "12px", lineHeight: 1.7 }}>
              ⚠ الموقع حالياً تحت التطوير — لا يمكن الاشتراك في الوقت الحالي. سيتم الإعلان عن التشغيل الكامل قريباً.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
