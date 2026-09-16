/** Prefill a correction from the issued amounts, including discounts and VAT.
 * No write occurs here; an administrator must review and save the credit note.
 */
export function correctionLineAmounts(line: { quantity: unknown; unitPrice: unknown; discount?: unknown; subtotal?: unknown; taxRate?: { rate: unknown; isInclusive?: boolean } | null }) {
  const quantity = Number(line.quantity);
  const taxRate = Number(line.taxRate?.rate ?? 0);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(taxRate) || taxRate < 0) throw new Error('Invalid invoice line');
  const amount = line.subtotal == null
    ? (quantity * Number(line.unitPrice) - Number(line.discount ?? 0)) / (line.taxRate?.isInclusive ? 1 + taxRate : 1)
    : Number(line.subtotal) / (1 + taxRate);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid invoice amount');
  return { quantity: String(quantity), unitPrice: String(amount / quantity), taxRate };
}
