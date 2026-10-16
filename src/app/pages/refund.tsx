import { Link } from "react-router";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useLanguage } from "../components/LanguageContext";
import { usePublicRoute } from "../lib/public-route";

/**
 * /refund — Refund and cancellation policy (2026-10-16). Replaces the
 * "coming soon" placeholder. Every commitment here is one the product
 * already makes elsewhere (pricing FAQ: 30-day money-back on the first
 * subscription, cancel anytime, access until period end; Terms §11).
 * Do not add new commitments here without updating /pricing and /terms.
 */
type Section = { id: string; title: string; body: string; items?: string[] };

const en: Section[] = [
  {
    id: "free",
    title: "1. Free plan",
    body: "The Starter plan is free and needs no payment card, so there is nothing to refund.",
  },
  {
    id: "guarantee",
    title: "2. 30-day money-back guarantee",
    body: "If you are not satisfied with your first paid subscription, ask for a refund within 30 days of the first subscription date and we refund the full amount — no questions asked.",
    items: [
      "Applies once per organization, to the first paid subscription (monthly or annual).",
      "Does not apply to renewals or to later plan changes after the first 30 days.",
    ],
  },
  {
    id: "cancel",
    title: "3. Cancelling after 30 days",
    body: "You can cancel at any time from the billing portal. Cancellation stops future charges; your access continues until the end of the period you already paid for.",
    items: [
      "Fees for a period that has already started are not refunded or prorated, except where the law requires otherwise.",
      "Downgrading takes effect at the start of the next billing period.",
    ],
  },
  {
    id: "errors",
    title: "4. Billing errors and duplicate charges",
    body: "If you were charged twice, charged the wrong amount, or charged after cancelling, we refund the incorrect amount in full, whenever you report it.",
  },
  {
    id: "how",
    title: "5. How to request a refund",
    body: "Email support@entix.io from the account owner's email address with the organization name and the payment receipt. We confirm by email.",
    items: [
      "Refunds go back to the original payment method through Stripe.",
      "Banks usually post the refund within 5–10 business days after we issue it.",
    ],
  },
  {
    id: "resellers",
    title: "6. Purchases through an authorized reseller",
    body: "If you bought Entix Books from an authorized reseller rather than on entix.io, the reseller handles the refund under its own sales terms. Contact the seller who issued your invoice.",
  },
  {
    id: "data",
    title: "7. Your data after cancellation or refund",
    body: "A refund or cancellation never deletes your books silently. Export your data from Settings at any time; deletion follows the retention rules in our Terms of Service.",
  },
  {
    id: "rights",
    title: "8. Your legal rights",
    body: "Nothing in this policy limits a consumer right that cannot be waived under the law that applies to you.",
  },
];

const ar: Section[] = [
  {
    id: "free",
    title: "1. الباقة المجانية",
    body: "باقة البداية مجانية ولا تتطلب بطاقة دفع، فلا يوجد ما يُسترد.",
  },
  {
    id: "guarantee",
    title: "2. ضمان استرداد خلال 30 يومًا",
    body: "إن لم تكن راضيًا عن أول اشتراك مدفوع، اطلب الاسترداد خلال 30 يومًا من تاريخ الاشتراك الأول ونعيد المبلغ كاملًا دون أسئلة.",
    items: [
      "يُطبَّق مرة واحدة لكل منشأة، على أول اشتراك مدفوع (شهري أو سنوي).",
      "لا يشمل التجديدات ولا تغييرات الباقة بعد انقضاء الثلاثين يومًا الأولى.",
    ],
  },
  {
    id: "cancel",
    title: "3. الإلغاء بعد 30 يومًا",
    body: "يمكنك الإلغاء في أي وقت من بوابة الفوترة. الإلغاء يوقف التحصيل القادم، ويستمر وصولك حتى نهاية الفترة المدفوعة.",
    items: [
      "رسوم الفترة التي بدأت لا تُسترد ولا تُحتسب تناسبيًا، إلا إذا أوجب النظام خلاف ذلك.",
      "خفض الباقة يسري من بداية فترة الفوترة التالية.",
    ],
  },
  {
    id: "errors",
    title: "4. أخطاء الفوترة والخصم المكرر",
    body: "إذا خُصم منك مرتين، أو بمبلغ خاطئ، أو بعد الإلغاء، نعيد المبلغ غير الصحيح كاملًا متى ما أبلغتنا.",
  },
  {
    id: "how",
    title: "5. طريقة طلب الاسترداد",
    body: "راسل support@entix.io من بريد مالك الحساب مع اسم المنشأة وإيصال الدفع، ونؤكد لك بالبريد.",
    items: [
      "يُعاد المبلغ إلى وسيلة الدفع الأصلية عبر Stripe.",
      "عادةً يظهر المبلغ في حسابك البنكي خلال 5 إلى 10 أيام عمل من إصدار الاسترداد.",
    ],
  },
  {
    id: "resellers",
    title: "6. الشراء عبر موزّع معتمد",
    body: "إذا اشتريت Entix Books من موزّع معتمد وليس من entix.io، فالاسترداد يتم لدى الموزّع وفق شروط البيع الخاصة به. تواصل مع الجهة التي أصدرت فاتورتك.",
  },
  {
    id: "data",
    title: "7. بياناتك بعد الإلغاء أو الاسترداد",
    body: "الاسترداد أو الإلغاء لا يحذف دفاترك تلقائيًا. صدّر بياناتك من الإعدادات في أي وقت، والحذف يتبع قواعد الاحتفاظ في الشروط والأحكام.",
  },
  {
    id: "rights",
    title: "8. حقوقك النظامية",
    body: "لا تحدّ هذه السياسة من أي حق للمستهلك لا يجوز التنازل عنه وفق النظام المطبّق عليك.",
  },
];

export function Refund() {
  const { language } = useLanguage();
  const { href } = usePublicRoute();
  const isAr = language === "ar";
  const sections = isAr ? ar : en;

  return (
    <div className="min-h-screen bg-card" dir={isAr ? "rtl" : "ltr"}>
      <SharedNavbar />
      <main data-page="refund" className="mx-auto max-w-4xl px-5 pt-28 pb-20">
        <h1 className="text-foreground mb-3" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800 }}>
          {isAr ? "سياسة الاسترداد والإلغاء" : "Refund and cancellation policy"}
        </h1>
        <p className="text-muted-foreground" style={{ fontSize: "0.95rem" }}>
          {isAr ? "آخر تحديث: 16 أكتوبر 2026" : "Last updated: October 16, 2026"}
        </p>

        <div className="mt-8 rounded-lg border border-border bg-surface-subtle p-6">
          <p className="m-0 text-foreground/80" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
            {isAr
              ? "تنطبق هذه السياسة على اشتراكات Entix Books المدفوعة مباشرة على entix.io، والتي تقدمها ENSIDEX LLC. وهي جزء من "
              : "This policy covers Entix Books subscriptions paid directly on entix.io, provided by ENSIDEX LLC. It forms part of our "}
            <Link to={href("/terms")} className="text-primary underline underline-offset-2">
              {isAr ? "الشروط والأحكام" : "Terms of Service"}
            </Link>
            .
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2 className="text-foreground mb-3" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{s.title}</h2>
              <p className="text-foreground/80" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>{s.body}</p>
              {s.items && (
                <ul className="list-disc ps-6 text-foreground/80 space-y-2" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                  {s.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
