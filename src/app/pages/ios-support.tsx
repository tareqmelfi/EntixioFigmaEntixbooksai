import { useEffect } from "react";
import { Link } from "react-router";
import {
  Bot,
  Camera,
  CircleHelp,
  Download,
  FileImage,
  FileText,
  KeyRound,
  LifeBuoy,
  Mail,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { useLanguage } from "../components/LanguageContext";

const enSections = [
  {
    id: "access",
    icon: KeyRound,
    title: "Sign in and password help",
    body: "Sign in with the email address and password for your ENTIX.IO account. If you cannot sign in, confirm the email address, check your connection, and try again.",
    items: [
      "Tap Forgot password on the sign-in screen and follow the secure reset instructions sent to your account email.",
      "If the message does not arrive, check spam or junk folders, then contact support@entix.io from the email associated with your account.",
      "For security, support cannot ask for or accept your password.",
    ],
  },
  {
    id: "permissions",
    icon: Camera,
    title: "Camera, Photos, and Files permissions",
    body: "ENTIX.IO requests access only when you choose a related action, such as capturing or importing an invoice, receipt, barcode, or business document.",
    items: [
      "Camera: capture business documents or scan supported barcodes.",
      "Photos: select an existing document image from your photo library.",
      "Files: choose a document through the iOS Files picker; Files access is controlled by the system picker rather than an always-on ENTIX.IO permission.",
      "If Camera or Photos access was denied, open iOS Settings > Privacy & Security, choose Camera or Photos, then allow ENTIX.IO. You can also open Settings, select ENTIX.IO, and review available permissions.",
    ],
  },
  {
    id: "ai-ocr",
    icon: Bot,
    title: "AI and OCR document processing",
    body: "When you submit a document or prompt to an AI-assisted feature, ENTIX.IO may send the selected content and necessary context to our service processors, including OpenRouter and model providers, to extract fields or prepare suggestions.",
    items: [
      "Processing starts only after you select or capture content and submit the action.",
      "AI and OCR results may be incomplete or incorrect. You must review before saving or relying on them.",
      "Generated suggestions are assistive and are not legal, tax, or accounting advice.",
    ],
  },
  {
    id: "deletion",
    icon: Trash2,
    title: "Account deletion and recovery",
    body: "In iOS build 22 or later, initiate account deletion in the app from More > Account > Delete account. If your installed build does not show this option, update ENTIX.IO to the latest available version or contact support@entix.io.",
    items: [
      "To confirm, type the exact email address for the signed-in account. The app sends that value to the account deletion endpoint for verification.",
      "An accepted request schedules deletion, ends active sessions, clears private data stored by the app on that device, and leaves you signed out on all devices.",
      "The endpoint returns a 30-day recovery period and purge date. During that period, sign in again and choose Cancel deletion and restore account to recover access.",
      "After the recovery period, deletion proceeds. A legal retention caveat applies: some minimum records may be retained for legal, tax, accounting, security, or dispute obligations.",
      "Shared organizations are not deleted solely because one member deletes an account; access and ownership rules are applied by the service.",
    ],
  },
  {
    id: "troubleshooting",
    icon: CircleHelp,
    title: "Troubleshooting",
    body: "ENTIX.IO for iOS supports iPhone and iPad running iOS 17 or later. Keep iOS and the app updated, then retry the action after checking your internet connection.",
    items: [
      "If an upload fails, confirm the file is accessible and try a clear image or a supported business document.",
      "If a service appears unavailable, check your connection, retry after a short interval, and email support@entix.io if the issue continues.",
      "When contacting support, include your device model, iOS version, app version, and the steps that led to the issue. Do not include passwords or full sensitive financial records.",
    ],
  },
  {
    id: "contact",
    icon: LifeBuoy,
    title: "Support and privacy",
    body: "Email support@entix.io for help with the ENTIX.IO iOS app. We respond by email and may ask for non-sensitive diagnostic details needed to investigate your request.",
    items: [
      "Read the Privacy Policy for details about collection, processing, retention, and your choices.",
      "For an ongoing service issue, email support with the time of the issue and the affected action.",
      "This support page does not request payment or link to purchasing.",
    ],
  },
];

const appReviewSamples = [
  {
    href: "/app-review-samples/entix-synthetic-app-review-receipt.png",
    filename: "entix-synthetic-app-review-receipt.png",
    format: "PNG",
    icon: FileImage,
  },
  {
    href: "/app-review-samples/entix-synthetic-app-review-receipt.jpg",
    filename: "entix-synthetic-app-review-receipt.jpg",
    format: "JPG",
    icon: FileImage,
  },
  {
    href: "/app-review-samples/entix-synthetic-app-review-receipt-searchable.pdf",
    filename: "entix-synthetic-app-review-receipt-searchable.pdf",
    format: "PDF",
    icon: FileText,
  },
];

const arSections = [
  {
    id: "access",
    icon: KeyRound,
    title: "تسجيل الدخول واستعادة كلمة المرور",
    body: "سجّل الدخول باستخدام البريد الإلكتروني وكلمة المرور لحساب ENTIX.IO. إذا تعذّر الدخول، فتحقق من البريد والاتصال بالإنترنت ثم أعد المحاولة.",
    items: [
      "اضغط «نسيت كلمة المرور» في شاشة تسجيل الدخول واتبع تعليمات الاستعادة الآمنة المرسلة إلى بريد الحساب.",
      "إذا لم تصل الرسالة، فتحقق من البريد غير المرغوب فيه، ثم راسل support@entix.io من البريد المرتبط بالحساب.",
      "لحمايتك، لن يطلب فريق الدعم كلمة مرورك ولن يقبلها.",
    ],
  },
  {
    id: "permissions",
    icon: Camera,
    title: "أذونات الكاميرا والصور والملفات",
    body: "يطلب ENTIX.IO الوصول فقط عند اختيار إجراء مرتبط، مثل تصوير أو استيراد فاتورة أو إيصال أو رمز شريطي أو مستند أعمال.",
    items: [
      "الكاميرا: لتصوير مستندات الأعمال أو مسح الرموز الشريطية المدعومة.",
      "الصور: لاختيار صورة مستند موجودة من مكتبة الصور.",
      "الملفات: لاختيار مستند عبر منتقي «الملفات» في iOS؛ يتحكم منتقي النظام بهذا الوصول، وليس إذناً دائماً لتطبيق ENTIX.IO.",
      "إذا رفضت إذن الكاميرا أو الصور، افتح إعدادات iOS > الخصوصية والأمان، ثم اختر الكاميرا أو الصور واسمح لـ ENTIX.IO. ويمكنك أيضاً فتح الإعدادات واختيار ENTIX.IO لمراجعة الأذونات المتاحة.",
    ],
  },
  {
    id: "ai-ocr",
    icon: Bot,
    title: "معالجة المستندات بالذكاء الاصطناعي وOCR",
    body: "عند إرسال مستند أو طلب إلى ميزة مدعومة بالذكاء الاصطناعي، قد يرسل ENTIX.IO المحتوى المحدد والسياق اللازم إلى معالجي الخدمة، بما في ذلك OpenRouter ومزودو النماذج، لاستخراج الحقول أو إعداد الاقتراحات.",
    items: [
      "تبدأ المعالجة فقط بعد اختيار المحتوى أو تصويره وإرسال الإجراء.",
      "قد تكون نتائج الذكاء الاصطناعي وOCR ناقصة أو غير صحيحة؛ يجب مراجعتها قبل الحفظ أو الاعتماد عليها.",
      "الاقتراحات للمساعدة فقط وليست استشارة قانونية أو ضريبية أو محاسبية.",
    ],
  },
  {
    id: "deletion",
    icon: Trash2,
    title: "حذف الحساب واسترداده",
    body: "في إصدار iOS رقم 22 أو أحدث، ابدأ حذف الحساب من داخل التطبيق عبر «المزيد > الحساب > حذف الحساب». إذا لم يظهر هذا الخيار في الإصدار المثبّت، فحدّث ENTIX.IO إلى أحدث إصدار متاح أو راسل support@entix.io.",
    items: [
      "للتأكيد، اكتب البريد الإلكتروني المطابق تماماً للحساب المسجّل دخوله. يرسل التطبيق هذه القيمة إلى نقطة حذف الحساب للتحقق.",
      "عند قبول الطلب، يُجدول الحذف وتنتهي الجلسات النشطة وتُمسح بيانات التطبيق الخاصة المحفوظة على الجهاز، ويُسجّل خروجك من جميع الأجهزة.",
      "تعيد نقطة الخدمة فترة استرداد مدتها 30 يوماً وتاريخ الحذف. خلال هذه المدة، سجّل الدخول مجدداً واختر «إلغاء الحذف واستعادة الحساب» لاسترداد الوصول.",
      "بعد انتهاء مدة الاسترداد، يستمر الحذف. وقد نحتفظ بالحد الأدنى من السجلات عندما تفرض ذلك التزامات قانونية أو ضريبية أو محاسبية أو أمنية أو متعلقة بالنزاعات.",
      "لا تُحذف المنشآت المشتركة لمجرد حذف عضو واحد لحسابه؛ تطبق الخدمة قواعد الوصول والملكية.",
    ],
  },
  {
    id: "troubleshooting",
    icon: CircleHelp,
    title: "حل المشكلات",
    body: "يدعم ENTIX.IO لنظام iOS أجهزة iPhone وiPad التي تعمل بنظام iOS 17 أو أحدث. حدّث النظام والتطبيق، وتحقق من الاتصال بالإنترنت، ثم أعد المحاولة.",
    items: [
      "إذا فشل الرفع، فتحقق من إمكانية الوصول إلى الملف وجرب صورة واضحة أو مستند أعمال مدعوماً.",
      "إذا بدت إحدى الخدمات غير متاحة، فتحقق من الاتصال وأعد المحاولة بعد فترة قصيرة، ثم راسل support@entix.io إذا استمرت المشكلة.",
      "عند التواصل مع الدعم، أرفق طراز الجهاز وإصدار iOS وإصدار التطبيق والخطوات التي أدت للمشكلة، ولا ترسل كلمات المرور أو السجلات المالية الحساسة كاملة.",
    ],
  },
  {
    id: "contact",
    icon: LifeBuoy,
    title: "الدعم والخصوصية",
    body: "راسل support@entix.io للمساعدة في تطبيق ENTIX.IO لنظام iOS. نرد عبر البريد وقد نطلب معلومات تشخيصية غير حساسة وضرورية للتحقيق في طلبك.",
    items: [
      "اقرأ سياسة الخصوصية لمعرفة تفاصيل الجمع والمعالجة والاحتفاظ واختياراتك.",
      "عند استمرار مشكلة في الخدمة، راسل الدعم مع وقت المشكلة والإجراء المتأثر.",
      "لا تطلب صفحة الدعم هذه أي دفع ولا تحتوي على روابط إتمام شراء.",
    ],
  },
];

export function IosSupport() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const sections = isAr ? arSections : enSections;

  useEffect(() => {
    const title = "iOS Support · ENTIX.IO";
    const description = "Official ENTIX.IO support for iPhone and iPad on iOS 17 or later, including sign-in, permissions, AI/OCR, privacy, and account deletion help.";
    document.title = title;
    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", "https://entix.io/support/ios", "property");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setCanonical("https://entix.io/support/ios");
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <SharedNavbar />
      <main data-page="support-ios" dir={isAr ? "rtl" : "ltr"} className="overflow-x-hidden pt-24 sm:pt-28">
        <section className="px-4 pb-12 pt-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 text-white shadow-2xl sm:px-10 lg:px-14">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold">
                  <Smartphone className="h-4 w-4 text-cyan-300" />
                  <span>{isAr ? "الدعم الرسمي لتطبيق iPhone وiPad" : "Official iPhone and iPad support"}</span>
                </div>
                <h1 className="text-balance text-3xl font-extrabold leading-tight sm:text-5xl">
                  {isAr ? "دعم ENTIX.IO لنظام iOS" : "ENTIX.IO for iOS Support"}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  {isAr
                    ? "معلومات مباشرة لمستخدمي تطبيق ENTIX.IO على iPhone وiPad بنظام iOS 17 أو أحدث: الوصول للحساب، الأذونات، معالجة المستندات، الخصوصية، وحذف الحساب."
                    : "Straightforward help for the ENTIX.IO app on iPhone and iPad running iOS 17 or later: account access, permissions, document processing, privacy, and account deletion."}
                </p>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
                <a href="mailto:support@entix.io" className="flex min-w-0 items-center gap-3 rounded-2xl bg-cyan-400 px-5 py-4 font-bold text-slate-950 transition hover:bg-cyan-300">
                  <Mail className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 break-all font-english">support@entix.io</span>
                </a>
                <Link to="/privacy" className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 font-bold text-white transition hover:bg-white/15">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <span>{isAr ? "سياسة الخصوصية" : "Privacy Policy"}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section data-section="app-review-samples" aria-labelledby="app-review-samples-title" className="mx-auto max-w-6xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-950">
                  <Download className="h-4 w-4" />
                  <span>{isAr ? "ملفات عامة لمراجعة التطبيق" : "Public App Review files"}</span>
                </div>
                <h2 id="app-review-samples-title" className="text-2xl font-extrabold leading-9 text-slate-950">
                  {isAr ? "عينات إيصال اصطناعية" : "Synthetic receipt samples"}
                </h2>
                <p className="mt-3 text-base font-extrabold leading-8 text-red-800">
                  {isAr
                    ? "عينة اصطناعية لمراجعة التطبيق — ليست معاملة حقيقية"
                    : "SYNTHETIC APP REVIEW SAMPLE — NOT A REAL TRANSACTION"}
                </p>
                <p className="mt-2 text-[0.95rem] leading-7 text-slate-700">
                  {isAr
                    ? "استخدم هذه الملفات فقط لاختبار استيراد الإيصالات واستخراج OCR وشاشات المراجعة. جميع الأسماء والمعرّفات والتواريخ والبنود ومبالغ الضريبة والإجماليات مختلقة، ولا تتضمن بيانات شخصية أو حسابات أو أرقام ضريبة/سجل تجاري أو بيانات بنكية حقيقية."
                    : "Use these files only to test receipt import, OCR extraction, and review screens. Every name, identifier, date, line item, tax amount, and total is fabricated; no real PII, account details, VAT/CR identifiers, or bank data are included."}
                </p>
              </div>
              <div className="grid w-full min-w-0 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[22rem] lg:grid-cols-1">
                {appReviewSamples.map((sample) => {
                  const Icon = sample.icon;
                  const label = isAr
                    ? sample.format === "PDF"
                      ? "تنزيل الإيصال الاصطناعي القابل للبحث (PDF)"
                      : `تنزيل الإيصال الاصطناعي (${sample.format})`
                    : sample.format === "PDF"
                      ? "Download searchable synthetic receipt (PDF)"
                      : `Download synthetic receipt (${sample.format})`;
                  return (
                    <a
                      key={sample.format}
                      href={sample.href}
                      download={sample.filename}
                      aria-label={label}
                      className="inline-flex min-w-0 items-center gap-3 rounded-2xl border border-amber-300 bg-white px-4 py-3 font-bold text-slate-950 transition hover:border-amber-500 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                    >
                      <Icon className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">{label}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id} data-section={section.id} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="pt-1 text-xl font-extrabold leading-8 text-slate-950">{section.title}</h2>
                </div>
                <p className="text-[0.95rem] leading-8 text-slate-700">{section.body}</p>
                <ul className="mt-4 space-y-3 text-[0.93rem] leading-7 text-slate-700">
                  {section.items.map((item) => (
                    <li key={item} className="flex min-w-0 items-start gap-3">
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" />
                      <span className="min-w-0 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
                {section.id === "contact" && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a href="mailto:support@entix.io" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                      <Mail className="h-4 w-4" />
                      <span className="font-english">support@entix.io</span>
                    </a>
                    <Link to="/privacy" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-50">
                      <ShieldCheck className="h-4 w-4" />
                      {isAr ? "الخصوصية" : "Privacy"}
                    </Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
      <footer dir={isAr ? "rtl" : "ltr"} className="bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-extrabold">ENTIX.IO</p>
            <p className="mt-1 text-sm text-slate-400">{isAr ? "الدعم الرسمي لتطبيق iPhone وiPad" : "Official iPhone and iPad app support"}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-300">
            <a href="mailto:support@entix.io" className="break-all transition hover:text-white font-english">support@entix.io</a>
            <Link to="/privacy" className="transition hover:text-white">{isAr ? "الخصوصية" : "Privacy"}</Link>
            <Link to="/help" className="transition hover:text-white">{isAr ? "مركز المساعدة" : "General Help"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function setMeta(key: string, content: string, attribute: "name" | "property" = "name") {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function setCanonical(href: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = href;
}
