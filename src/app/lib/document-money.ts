/** Matches the API's lib/money.ts: two decimals, half up (away from zero).
 * Number.toFixed and an unscaled Number.EPSILON round 1652.805 down on some
 * calculation paths. The epsilon is applied to cents, just as on the server.
 */
export function roundDocumentMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(Math.abs(value) * 100 + 1e-9) / 100;
  return value < 0 ? -rounded : rounded;
}
