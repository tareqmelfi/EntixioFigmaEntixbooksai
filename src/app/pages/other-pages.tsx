import { PlaceholderPage } from "./placeholder";
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
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("اتصل بنا", "Contact us")}
      description={t("قريباً! سنوفر نموذج اتصال شامل للإجابة على جميع استفساراتك.", "Coming soon! A full contact form to answer all your questions.")}
    />
  );
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
  const { t } = useLanguage();
  return (
    <PlaceholderPage
      title={t("خارطة الطريق", "Roadmap")}
      description={t("قريباً! شاهد خططنا المستقبلية والميزات القادمة.", "Coming soon! See our future plans and upcoming features.")}
    />
  );
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
