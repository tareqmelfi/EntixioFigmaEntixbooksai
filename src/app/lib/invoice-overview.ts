import { api, type Invoice } from './api';

// A failed or changing page must not turn a partial list into company totals.
export async function loadInvoiceOverview(source?: string) {
  const rows = new Map<string, Invoice>();
  let expected: number | undefined;
  for (let page = 1; ; page++) {
    const result = await api.invoices.list({ page, limit: 200, ...(source ? { source } : {}) });
    if (!Number.isInteger(result.total) || result.total < 0 || (expected !== undefined && result.total !== expected)) {
      throw new Error('Invoice list changed while loading; retry');
    }
    expected = result.total;
    const before = rows.size;
    for (const item of result.items) rows.set(item.id, item);
    if (rows.size === expected) return [...rows.values()];
    if (rows.size > expected || rows.size === before) throw new Error('Invoice pagination did not advance');
  }
}
