/**
 * Public plan prices · ONE source of truth for the marketing surfaces.
 *
 * Both /pricing and the landing pricing block read these numbers, so the
 * savings percentage a visitor sees on the home page can never disagree with
 * the one on the pricing page (CEO 2026-09-08: «خلي العرض السنوي مع علامات تبين
 * الخصم والتوفير … وخليها سهلة الوصول من الرئيسية»).
 *
 * Charge prices match the live Stripe catalog (api/stripe/plans). The savings
 * figures are COMPUTED from these numbers — never typed by hand.
 */
export type PricingTier = "starter" | "lite" | "professional" | "enterprise";
export type PricingCurrency = "SAR" | "USD";
export type PricingInterval = "monthly" | "yearly";
export interface PlanPrice { monthly: number; yearly: number }

export const PLAN_PRICES: Record<PricingTier, Record<PricingCurrency, PlanPrice>> = {
  starter: { SAR: { monthly: 0, yearly: 0 }, USD: { monthly: 0, yearly: 0 } },
  lite: { SAR: { monthly: 0, yearly: 535 }, USD: { monthly: 0, yearly: 99 } },
  professional: { SAR: { monthly: 99, yearly: 950 }, USD: { monthly: 19, yearly: 190 } },
  enterprise: { SAR: { monthly: 299, yearly: 2990 }, USD: { monthly: 59, yearly: 590 } },
};

/** Whole-percent discount of the annual plan against 12× the monthly price. 0 when it cannot be computed. */
export function annualSavingsPercent(price: PlanPrice): number {
  if (price.monthly <= 0 || price.yearly <= 0) return 0;
  const full = price.monthly * 12;
  if (price.yearly >= full) return 0;
  return Math.round((1 - price.yearly / full) * 100);
}

/** Money saved per year by paying annually. 0 when it cannot be computed. */
export function annualSavingsAmount(price: PlanPrice): number {
  if (price.monthly <= 0 || price.yearly <= 0) return 0;
  return Math.max(0, price.monthly * 12 - price.yearly);
}

/** What the annual plan works out to per month — the figure the card leads with. */
export function monthlyEquivalent(price: PlanPrice): number {
  return price.yearly / 12;
}

/** Best annual discount across the paid plans, for the billing toggle's chip. */
export function bestAnnualSavingsPercent(currency: PricingCurrency): number {
  return Math.max(
    ...(["lite", "professional", "enterprise"] as const).map((tier) =>
      annualSavingsPercent(PLAN_PRICES[tier][currency]),
    ),
  );
}
