import { Link } from "react-router";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useLanguage } from "../components/LanguageContext";

/**
 * /about — real company page (SEO-02 · 2026-10-11). Replaced the "coming soon"
 * placeholder: Google indexed a thin page under the brand query. Facts only —
 * no founder names (P-1), no Saudi office address (P-5), no unverified claims.
 */
export function About() {
  const { language, t } = useLanguage();
  const principles = [
    {
      title: t("عربي أولاً، وإنجليزي بالتوازي", "Arabic-first, English in parallel"),
      body: t(
        "الواجهة والمستندات والتقارير بالعربية والإنجليزية بنفس الدقة، مع اتجاه كتابة صحيح وأرقام موحّدة.",
        "Interface, documents and reports in Arabic and English with the same precision, correct text direction and consistent numerals.",
      ),
    },
    {
      title: t("كل رقم يرجع إلى مصدره", "Every number traces back to its source"),
      body: t(
        "عرض السعر يصبح فاتورة، والفاتورة سند قبض، والسند قيد يومية — تلقائياً وبسجل تدقيق كامل.",
        "A quote becomes an invoice, the invoice a receipt, the receipt a journal entry — automatically, with a full audit trail.",
      ),
    },
    {
      title: t("سوقان، قواعد منفصلة", "Two markets, separate rules"),
      body: t(
        "منشآت السعودية والولايات المتحدة تعمل بإعدادات ضريبية ومستندات مستقلة لكل كيان، دون خلط بين السجلات.",
        "Saudi and US organizations run with independent tax settings and documents per entity — records are never mixed.",
      ),
    },
    {
      title: t("بياناتك ملكك", "Your data stays yours"),
      body: t(
        "تصدير كامل في أي وقت، تشفير للمفاتيح الحساسة، ونسخ احتياطي يومي.",
        "Full export at any time, encryption for sensitive keys, and daily backups.",
      ),
    },
  ];
  const facts = [
    [t("المنتج", "Product"), "Entix Books · entix.io"],
    [t("الشركة", "Company"), "ENSIDEX LLC"],
    [t("المقر", "Registered in"), t("وايومنغ، الولايات المتحدة", "Wyoming, United States")],
    [t("الأسواق", "Markets"), t("السعودية · الولايات المتحدة", "Saudi Arabia · United States")],
    [t("اللغات", "Languages"), t("العربية · الإنجليزية", "Arabic · English")],
    [t("التواصل", "Contact"), "support@entix.io"],
  ];

  return (
    <div className="min-h-screen bg-card" dir={language === "ar" ? "rtl" : "ltr"}>
      <SharedNavbar />
      <main data-page="about" className="mx-auto max-w-5xl px-5 pt-32 pb-20">
        <p className="mb-4 text-sm font-semibold text-primary">ENTIX.IO</p>
        <h1 className="text-4xl font-bold">{t("عن Entix Books", "About Entix Books")}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {t(
            "Entix Books منصة محاسبة سحابية ثنائية اللغة للمنشآت الصغيرة والمتوسطة في السعودية والولايات المتحدة: عروض أسعار، فواتير، سندات، مصروفات، بنوك، مخزون، مشاريع، وتقارير مالية — من شركة ENSIDEX LLC.",
            "Entix Books is a bilingual cloud accounting platform for small and mid-sized businesses in Saudi Arabia and the United States: quotes, invoices, receipts, expenses, banking, inventory, projects and financial reports — built by ENSIDEX LLC.",
          )}
        </p>

        <section data-section="mission" className="mt-12">
          <h2 className="text-2xl font-semibold">{t("لماذا بنيناها", "Why we built it")}</h2>
          <p className="mt-4 max-w-3xl leading-8 text-muted-foreground">
            {t(
              "أغلب برامج المحاسبة إما مصممة للغة واحدة أو لسوق واحد. أصحاب المنشآت الذين يعملون بالعربية والإنجليزية، أو بين السعودية وأمريكا، كانوا يضطرون لإعادة إدخال نفس الأرقام أكثر من مرة. Entix Books تربط المستند بالقيد المحاسبي من أول خطوة، فتقل الأخطاء ويبقى الدفتر جاهزاً للمراجعة في أي وقت.",
              "Most accounting software is designed for one language or one market. Owners who work in Arabic and English, or between Saudi Arabia and the US, kept re-entering the same numbers. Entix Books links each document to its accounting entry from the first step, so errors drop and the ledger is always review-ready.",
            )}
          </p>
        </section>

        <section data-section="principles" className="mt-12">
          <h2 className="text-2xl font-semibold">{t("مبادئ المنتج", "Product principles")}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {principles.map((item) => (
              <article key={item.title} className="rounded-2xl border border-border p-6">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section data-section="facts" className="mt-12">
          <h2 className="text-2xl font-semibold">{t("بطاقة تعريف", "At a glance")}</h2>
          <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-3 border-b border-border py-2">
                <dt className="w-40 flex-none text-sm font-semibold text-muted-foreground">{k}</dt>
                <dd className="m-0 text-foreground"><bdi>{v}</bdi></dd>
              </div>
            ))}
          </dl>
        </section>

        <nav aria-label={t("روابط ذات صلة", "Related links")} className="mt-10 flex flex-wrap gap-5 text-primary">
          <Link to="/features">{t("المزايا", "Features")}</Link>
          <Link to="/pricing">{t("الأسعار", "Pricing")}</Link>
          <Link to="/solutions/small-business">{t("للمنشآت الصغيرة", "For small businesses")}</Link>
          <Link to="/solutions/accountants">{t("للمحاسبين", "For accountants")}</Link>
          <Link to="/contact">{t("تواصل معنا", "Contact")}</Link>
        </nav>
      </main>
      <SharedFooter />
    </div>
  );
}
