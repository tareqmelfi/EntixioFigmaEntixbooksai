import { Link } from "react-router";
import { EntixWordmark } from "../components/entix-brand";
import { PUBLIC_LOCALES, PUBLIC_MARKETS, localizedPath } from "../public-site-manifest";

const names = {
  sa: { en: "Saudi Arabia", ar: "السعودية", flag: "🇸🇦" },
  us: { en: "United States", ar: "الولايات المتحدة", flag: "🇺🇸" },
};

export function MarketLocaleChooser() {
  return (
    <main data-page="market-locale-chooser" className="min-h-screen bg-slate-50 px-5 py-14" dir="ltr">
      <div className="mx-auto max-w-4xl">
        <div className="flex justify-center"><EntixWordmark size={42} /></div>
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold text-slate-950 sm:text-4xl">Choose your market and language</h1>
          <p className="mt-3 text-lg text-slate-600">اختر السوق واللغة للمتابعة</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PUBLIC_MARKETS.map((market) => (
            <section key={market} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-3 text-xl font-bold text-slate-950">
                <span aria-hidden="true">{names[market].flag}</span>
                <span>{names[market].en}</span>
              </h2>
              <p className="mt-1 text-slate-500" dir="rtl">{names[market].ar}</p>
              <div className="mt-6 grid gap-3">
                {PUBLIC_LOCALES.map((locale) => (
                  <Link
                    key={locale}
                    to={localizedPath(market, locale)}
                    className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-900 transition hover:border-primary hover:bg-primary/5"
                  >
                    {names[market].en} — {locale === "en" ? "English" : "العربية"}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
