import { useLocation, useNavigate } from "react-router";
import {
  localizedPath,
  parsePublicPath,
  publicPageForPath,
  type PublicLocale,
  type PublicMarket,
} from "../public-site-manifest";

export function publicRouteFromWindow() {
  if (typeof window === "undefined") return null;
  return parsePublicPath(window.location.pathname);
}

export function usePublicRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const route = parsePublicPath(location.pathname);

  const href = (pagePath: string) => route && publicPageForPath(pagePath)
    ? localizedPath(route.market, route.locale, pagePath)
    : pagePath || "/";

  const changeLocale = (locale: PublicLocale) => {
    if (!route || route.locale === locale) return;
    navigate(`${localizedPath(route.market, locale, route.pagePath)}${location.search}${location.hash}`);
  };

  const changeMarket = (market: PublicMarket) => {
    if (!route || route.market === market) return;
    navigate(`${localizedPath(market, route.locale, route.pagePath)}${location.search}${location.hash}`);
  };

  return { route, href, changeLocale, changeMarket };
}
