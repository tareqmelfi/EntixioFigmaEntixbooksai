import { test, expect } from '@playwright/test';
import { renderDocument, sampleInput, SECTION_IDS, type RenderInput } from '../src/app/lib/document-render';
import { qrSvg } from '../src/app/components/brand-document';

function fixture(lang: 'ar' | 'en', count = 5, long = false): RenderInput {
  const input = sampleInput('INVOICE', lang, {
    themePreset: 'custom', theme: { navy: '#0C2F61', fill: '#E3F8FC' },
    headerStyle: 'bar', amountInWords: true,
    sections: SECTION_IDS.map(id => ({ id, enabled: ['header', 'items', 'totals'].includes(id) })),
  });
  input.qr = qrSvg;
  input.org = { ...input.org, name: 'شركة اختبار طباعة الفواتير للاستثمار', nameEn: 'Synthetic Invoice Print Holding Inc', legalName: 'Synthetic Invoice Print Holding Inc', email: 'print@example.invalid' };
  input.contact = { ...input.contact, name: 'مركز العميل التجريبي لصيانة السيارات - فرع الورشة', nameEn: null, email: 'client@example.invalid' };
  const descriptions = lang === 'ar'
    ? ['40005 – طرمبة تحضير كامل JCB – حبة', '120176 – مبرد زيت هيدروليك 2W1008 – حبة', '1100002 – دينمو بكات شيوَل H 950 – حبة', '120036 – رديتر كامل CAT 428 – حبة', '120037 – إصلاح طرمبة ديزل بركنز – حبة']
    : ['40005 – Complete JCB priming pump – each', '120176 – Hydraulic oil cooler 2W1008 – each', '1100002 – H 950 alternator – each', '120036 – Complete CAT 428 radiator – each', '120037 – Perkins diesel pump repair – each'];
  const amounts = [1400, 2500, 1100, 2500, 2000];
  input.doc = { ...input.doc, number: 'QA-INVOICE-0001', title: null, reference: 'QA-REF-001', taxBasis: 'inclusive', discountTotal: 0, paymentLinkUrl: null, paymentPlan: null,
    notes: lang === 'ar' ? 'مرجع البنود: اختبار الطباعة - فرع الورشة. الأسعار شاملة ضريبة القيمة المضافة 15%.' : 'Print test reference — workshop branch. Prices include 15% VAT.',
    lines: Array.from({ length: count }, (_, i) => {
      const gross = amounts[i % 5]; const net = Math.round(gross / 1.15 * 100) / 100;
      return { description: descriptions[i % 5] + (long ? '\n' + (lang === 'ar' ? 'تفاصيل اختبار طويلة للتأكد من ظهور الوصف كاملاً دون قطع أو تداخل. ' : 'Long test description to verify complete text without clipping or overlap. ').repeat(8) : ''), quantity: i % 5 < 3 ? 2 : 1, unitPrice: gross / (i % 5 < 3 ? 2 : 1), subtotal: gross, netAmount: net, taxAmount: Math.round((gross - net) * 100) / 100, taxRate: .15, taxInclusive: true };
    }),
  };
  input.doc.total = input.doc.lines.reduce((s, l) => s + l.subtotal, 0);
  input.doc.subtotal = Math.round(input.doc.total / 1.15 * 100) / 100;
  input.doc.taxTotal = Math.round((input.doc.total - input.doc.subtotal) * 100) / 100;
  return input;
}

for (const lang of ['ar', 'en'] as const) for (const scenario of ['compact', 'many', 'long'] as const) test(`invoice print ${lang}: ${scenario}`, async ({ page }, info) => {
  const compact = scenario === 'compact';
  const input = fixture(lang, compact ? 5 : scenario === 'many' ? 40 : 20, scenario === 'long');
  const out = renderDocument(input);
  await page.route('**/invoice-density-test', r => r.fulfill({ contentType: 'text/html', body: out.html }));
  await page.goto('/invoice-density-test');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.items tbody tr:not(.sec):not([data-line-rounding])')).toHaveCount(input.doc.lines.length);
  const sheets = await page.locator('.items').first().evaluate(el => ({ items: el.closest('.sheet')?.getAttribute('data-page'), totals: document.querySelector('.totals')?.closest('.sheet')?.getAttribute('data-page') }));
  await page.locator('.sheet').filter({ has: page.locator('.items') }).first().screenshot({ path: info.outputPath('items.png') });
  const pdf = await page.pdf({ path: info.outputPath('invoice.pdf'), preferCSSPageSize: true, printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(out.sheetCount);
  if (compact) expect(sheets.totals).toBe(sheets.items);
  else expect(await page.locator('.items thead').count()).toBeGreaterThan(1);
  expect(await page.locator('.pgflow').evaluateAll(flows => flows.every(flow => {
    const bounds = flow.getBoundingClientRect();
    return flow.scrollHeight <= flow.clientHeight + 1 && Array.from(flow.querySelectorAll('td, .totals, .qr, .tafqit, .notes')).every(el => {
      const box = el.getBoundingClientRect(); return box.bottom <= bounds.bottom + 1 && box.right <= bounds.right + 1 && box.left >= bounds.left - 1;
    });
  }))).toBe(true);
  if (compact) { await expect(page.locator('.totals .grand')).toContainText('9,500.00'); await expect(page.locator('.totals')).toContainText('1,239.13'); }
});
