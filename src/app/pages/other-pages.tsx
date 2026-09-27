import { PlaceholderPage } from "./placeholder";
import { Link } from "react-router";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { Features } from "./features";
import { useLanguage } from "../components/LanguageContext";

export function Team() {
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("فريق العمل", "Our team")}
      description={t("قريباً! تعرف على الفريق الذي يعمل على تطوير ENTIX.IO.", "Coming soon! Meet the team building ENTIX.IO.")}
    />
  );
}

export function Careers() {
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("الوظائف", "Careers")}
      description={t("قريباً! انضم لفريقنا واصنع مستقبل المحاسبة السحابية معنا.", "Coming soon! Join our team and shape the future of cloud accounting with us.")}
    />
  );
}

export function Contact() {
  const { language, t } = useLanguage();
  return <div className="min-h-screen bg-card" dir={language === "ar" ? "rtl" : "ltr"}>
    <SharedNavbar />
    <main data-page="contact" className="mx-auto max-w-5xl px-5 pt-32 pb-20">
      <p className="mb-4 text-sm font-semibold text-primary">ENTIX.IO</p>
      <h1 className="text-4xl font-bold">{t("تواصل مع فريق Entix", "Contact the Entix team")}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{t("اسأل عن المنصة أو ربط حساباتك، أو تابع طلب دعم لمنشأتك. اختر القناة المناسبة لموضوعك.", "Ask about the platform or account connections, or follow a support request for your organization. Choose the channel that fits your question.")}</p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-border p-6">
          <h2 className="text-xl font-semibold">{t("الدعم الفني", "Product support")}</h2>
          <p className="my-4 leading-7 text-muted-foreground">{t("اذكر اسم المنشأة والصفحة والخطوة التي واجهت فيها المشكلة، ويمكنك بدء محادثة من زر الدعم أسفل الصفحة.", "Include your organization, the page and the step where the problem occurred. You can also start a conversation using the support button below.")}</p>
          <a href="mailto:support@entix.io" className="font-semibold text-primary"><bdi>support@entix.io</bdi></a>
          <div className="mt-5"><Link to="/app/help" className="inline-flex rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground">{t("افتح بوابة الدعم", "Open support portal")}</Link></div>
          <p className="mt-3 text-sm text-muted-foreground">{t("سجل الدخول لمتابعة تذاكر منشأتك ومراسلاتها.", "Sign in to follow your organization's tickets and replies.")}</p>
        </section>
        <section className="rounded-2xl border border-border p-6">
          <h2 className="text-xl font-semibold">{t("الخصوصية والشروط", "Privacy and terms")}</h2>
          <p className="my-4 leading-7 text-muted-foreground">{t("لأسئلة معالجة البيانات أو شروط الخدمة، تواصل مع الفريق المعني.", "For data handling or service terms, contact the relevant team.")}</p>
          <ul className="space-y-4"><li><a href="mailto:privacy@entix.io" className="font-semibold text-primary"><bdi>privacy@entix.io</bdi></a></li><li><a href="mailto:legal@entix.io" className="font-semibold text-primary"><bdi>legal@entix.io</bdi></a></li></ul>
        </section>
      </div>
      <nav aria-label={t("مصادر المساعدة", "Help resources")} className="mt-8 flex flex-wrap gap-5 text-primary"><Link to="/help">{t("مركز المساعدة", "Help center")}</Link><Link to="/support/ios">{t("دعم تطبيق iOS", "iOS app support")}</Link><Link to="/features">{t("المزايا وحالة توفرها", "Capabilities and availability")}</Link></nav>
    </main>
    <SharedFooter />
  </div>;
}

export function Partners() {
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("الشركاء", "Partners")}
      description={t("قريباً! تعرف على شركائنا الاستراتيجيين في النجاح.", "Coming soon! Meet the strategic partners behind our success.")}
    />
  );
}

export function Changelog() {
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("سجل التحديثات", "Changelog")}
      description={t("قريباً! تابع جميع التحديثات والتحسينات الجديدة في ENTIX.IO.", "Coming soon! Follow all updates and improvements in ENTIX.IO.")}
    />
  );
}

export function Roadmap() {
  return <Features />;
}

export function CaseStudies() {
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("دراسات الحالة", "Case studies")}
      description={t("قريباً! اقرأ قصص نجاح عملائنا وكيف حسّنوا أعمالهم مع ENTIX.IO.", "Coming soon! Read our customers' success stories and how they improved their business with ENTIX.IO.")}
    />
  );
}

export function Glossary() {
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("قاموس المحاسبة", "Accounting glossary")}
      description={t("قريباً! قاموس شامل للمصطلحات المحاسبية باللغتين العربية والإنجليزية.", "Coming soon! A comprehensive glossary of accounting terms in Arabic and English.")}
    />
  );
}

export function Refund() {
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("سياسة الاسترجاع", "Refund policy")}
      description={t("قريباً! تفاصيل سياسة استرجاع الأموال وإلغاء الاشتراكات.", "Coming soon! Details of our refund and subscription-cancellation policy.")}
    />
  );
}

export function SLA() {
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("اتفاقية مستوى الخدمة", "Service level agreement")}
      description={t("قريباً! تفاصيل التزاماتنا تجاه وقت التشغيل وجودة الخدمة.", "Coming soon! Details of our uptime and service-quality commitments.")}
    />
  );
}
