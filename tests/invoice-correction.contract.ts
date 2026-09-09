import assert from 'node:assert/strict';
import { correctionLineAmounts } from '../src/app/lib/invoice-correction';

const zeroTax = correctionLineAmounts({ quantity: '2', unitPrice: '100', discount: '20', subtotal: '180', taxRate: null });
assert.deepEqual(zeroTax, { quantity: '2', unitPrice: '90', taxRate: 0 });
const taxed = correctionLineAmounts({ quantity: '2', unitPrice: '100', discount: '20', subtotal: '207', taxRate: { rate: '0.15' } });
assert.ok(Math.abs(Number(taxed.unitPrice) * 2 * 1.15 - 207) < 0.00001, 'Credit preserves discounted invoice total, not list price');
const inclusive = correctionLineAmounts({ quantity: '2', unitPrice: '115', taxRate: { rate: '0.15', isInclusive: true } });
assert.ok(Math.abs(Number(inclusive.unitPrice) - 100) < 0.00001);
assert.throws(() => correctionLineAmounts({ quantity: 0, unitPrice: 10 }));
assert.throws(() => correctionLineAmounts({ quantity: 1, unitPrice: 10, subtotal: 'invalid' }));
console.log('Invoice correction prefill: discounts, zero tax, inclusive VAT and invalid amounts verified. No live writes.');
