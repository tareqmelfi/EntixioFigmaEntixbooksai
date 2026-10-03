import { api, getOrgId } from './api';

export type PurchaseRow = {
  id: string; kind: 'BILL' | 'EXPENSE'; number: string; reference: string; supplier: string;
  date: string; currency: string; total: number; paid: number; remaining: number;
  status: 'DRAFT' | 'PAID' | 'UNPAID' | 'PARTIAL' | 'CANCELLED' | 'DUPLICATE'; path: string;
};
export function purchaseRow(record: any, kind: PurchaseRow['kind']): PurchaseRow {
  const total = Number(record.total) || 0;
  const draft = record.status === 'DRAFT';
  const duplicate = !!record.duplicateOfId;
  const cancelled = ['CANCELLED', 'VOID'].includes(record.status);
  const postedExpense = kind === 'EXPENSE' && ['APPROVED', 'PAID'].includes(record.status);
  const paid = draft || cancelled || duplicate ? 0 : postedExpense ? total : Number(record.amountPaid) || 0;
  return { id: record.id, kind, number: record.billNumber || record.number || '',
    reference: record.supplierDocNumber || record.documentNumber || record.reference || '',
    supplier: record.contact?.displayName || record.vendorName || '',
    date: (record.issueDate || record.date || '').slice(0, 10), currency: record.currency,
    total, paid, remaining: draft || cancelled || duplicate ? 0 : Math.max(0, total - paid),
    status: duplicate ? 'DUPLICATE' : draft ? 'DRAFT' : cancelled ? 'CANCELLED' : paid >= total && total > 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
    path: kind === 'BILL' ? `/app/purchases/bills/${record.id}` : `/app/expenses/${record.id}` };
}
/** Both sources must finish: never present an unavailable source as zero purchases. */
export async function loadPurchaseWorkspace(): Promise<PurchaseRow[]> {
  const scope = getOrgId();
  const load = async (kind: PurchaseRow['kind']) => {
    const records = new Map<string, PurchaseRow>();
    for (let page = 1; ; page++) {
      if (scope !== getOrgId()) throw new Error('Company changed; reload purchases.');
      const result = kind === 'BILL' ? await api.bills.list({ page, limit: 200 } as any) : await api.expenses.list({ page, limit: 200 });
      if (scope !== getOrgId()) throw new Error('Company changed; reload purchases.');
      const before = records.size;
      result.items.forEach(row => records.set(row.id, purchaseRow(row, kind)));
      if (records.size >= result.total || result.items.length === 0) {
        if (records.size < result.total) throw new Error('Purchase list incomplete; reload.');
        return [...records.values()];
      }
      if (records.size === before) throw new Error('Purchase pagination unavailable; reload.');
    }
  };
  const [bills, expenses] = await Promise.all([load('BILL'), load('EXPENSE')]);
  return [...bills, ...expenses].sort((a, b) => b.date.localeCompare(a.date) || `${b.kind}:${b.id}`.localeCompare(`${a.kind}:${a.id}`));
}
