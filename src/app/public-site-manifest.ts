export const SITE_ORIGIN = "https://entix.io" as const;
export const PUBLIC_MARKETS = ["sa", "us"] as const;
export const PUBLIC_LOCALES = ["ar", "en"] as const;

export type PublicMarket = (typeof PUBLIC_MARKETS)[number];
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];
export type PublicPageKind = "landing";
export type LocalizedCopy = { ar: string; en: string };
export type MarketCopy = Record<PublicMarket, LocalizedCopy>;

export interface PublicPageDefinition {
  path: "" | `/${string}`;
  kind: PublicPageKind;
  title: MarketCopy;
  description: MarketCopy;
  changefreq: "weekly" | "monthly";
  priority: number;
  indexable: boolean;
}

const marketCopy = (saAr: string, saEn: string, usAr: string, usEn: string): MarketCopy => ({
  sa: { ar: saAr, en: saEn },
  us: { ar: usAr, en: usEn },
});

// Activation is deliberately constrained to pages whose rendered body is truly
// separated by both market and locale. Shared marketing subpages remain on their
// legacy unprefixed routes until their content has the same separation guarantee.
export const PUBLIC_PAGES = [
  {
    path: "",
    kind: "landing",
    changefreq: "weekly",
    priority: 1,
    indexable: true,
    title: marketCopy(
      "إنتكس بوكس | محاسبة سحابية للسعودية",
      "Entix Books | Cloud accounting for Saudi businesses",
      "إنتكس بوكس | محاسبة سحابية للأعمال الأمريكية",
      "Entix Books | Cloud accounting for US businesses",
    ),
    description: marketCopy(
      "فواتير ومصروفات وتقارير للسوق السعودي. تكامل ZATCA للمرحلة الثانية قيد التحقق.",
      "Invoices, expenses, and reporting for Saudi businesses. ZATCA Phase 2 is under validation.",
      "فواتير ومصروفات وضريبة مبيعات ومدفوعات للأعمال الأمريكية، مع Plaid تجريبي.",
      "Invoices, expenses, sales tax, Stripe payments, and Plaid bank feeds in Beta for US businesses.",
    ),
  },
] as const satisfies readonly PublicPageDefinition[];

const pagePaths = new Set<string>(PUBLIC_PAGES.map((item) => item.path));

export const isPublicMarket = (value: string): value is PublicMarket =>
  (PUBLIC_MARKETS as readonly string[]).includes(value);
export const isPublicLocale = (value: string): value is PublicLocale =>
  (PUBLIC_LOCALES as readonly string[]).includes(value);
export const normalizePagePath = (value: string) => {
  const normalized = value.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
};
export const localizedPath = (market: PublicMarket, locale: PublicLocale, pagePath = "") =>
  `/${market}/${locale}${normalizePagePath(pagePath)}`;

export function parsePublicPath(pathname: string): {
  market: PublicMarket;
  locale: PublicLocale;
  pagePath: PublicPageDefinition["path"];
} | null {
  const match = pathname.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!match || !isPublicMarket(match[1]) || !isPublicLocale(match[2])) return null;
  const pagePath = normalizePagePath(match[3] || "");
  if (!pagePaths.has(pagePath)) return null;
  return { market: match[1], locale: match[2], pagePath: pagePath as PublicPageDefinition["path"] };
}

export const publicPageForPath = (pagePath: string) =>
  PUBLIC_PAGES.find((item) => item.path === normalizePagePath(pagePath));
export const canonicalUrl = (market: PublicMarket, locale: PublicLocale, pagePath = "") =>
  `${SITE_ORIGIN}${localizedPath(market, locale, pagePath)}`;
export const marketRegion = (market: PublicMarket) => market === "sa" ? "SA" : "US";
export const localeDirection = (locale: PublicLocale) => locale === "ar" ? "rtl" : "ltr";
export const ogLocale = (market: PublicMarket, locale: PublicLocale) =>
  `${locale}_${market === "sa" ? "SA" : "US"}`;
