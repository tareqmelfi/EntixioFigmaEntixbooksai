/** Amounts stay in their own currencies; only journal values use company currency. */
export function settlePurchase(input: {
  sourceCurrency: string; baseCurrency: string; actualPaidCurrency: string;
  sourceTotal: number; actualPaidAmount?: number; exchangeRate?: number;
  treatment?: string;
}) {
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const samePayment = input.sourceCurrency === input.actualPaidCurrency;
  const actualPaidAmount = samePayment ? (input.actualPaidAmount || input.sourceTotal) : (input.actualPaidAmount || 0);
  const sourceRate = input.sourceCurrency === input.baseCurrency ? 1
    : input.treatment === 'MERGE_INTO_EXPENSE' && input.actualPaidCurrency === input.baseCurrency && actualPaidAmount > 0
      ? actualPaidAmount / input.sourceTotal : (input.exchangeRate || 0);
  const bookBaseAmount = round(input.sourceTotal * sourceRate);
  const referenceToBase = input.actualPaidCurrency === input.baseCurrency ? 1
    : samePayment ? sourceRate
    : input.actualPaidCurrency === 'SAR' && input.baseCurrency === 'USD' ? 1 / 3.75
    : input.actualPaidCurrency === 'USD' && input.baseCurrency === 'SAR' ? 3.75 : 0;
  const paymentRate = input.actualPaidCurrency === input.baseCurrency ? 1 : samePayment ? sourceRate
    : input.treatment === 'MERGE_INTO_EXPENSE' && actualPaidAmount > 0
    ? bookBaseAmount / actualPaidAmount : referenceToBase;
  const actualBaseAmount = round(actualPaidAmount * paymentRate);
  return {
    sourceCurrency: input.sourceCurrency, baseCurrency: input.baseCurrency,
    actualPaidCurrency: input.actualPaidCurrency, sourceTotal: round(input.sourceTotal),
    exchangeRate: sourceRate, bookBaseAmount, actualPaidAmount, actualBaseAmount,
    paymentToBaseRate: paymentRate,
    actualRate: input.sourceTotal > 0 ? actualPaidAmount / input.sourceTotal : 0,
    difference: round(actualBaseAmount - bookBaseAmount),
    treatment: input.treatment || 'MERGE_INTO_EXPENSE',
    isCrossCurrency: input.sourceCurrency !== input.baseCurrency || !samePayment,
  };
}
