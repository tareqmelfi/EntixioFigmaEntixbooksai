import assert from 'node:assert/strict';
import { HISTORICAL_METRICS, parseHistoricalStatements, historicalBalanceDifference } from '../src/app/lib/historical-statements';
export const historicalFixture = {
  schemaVersion: 1, revision: 'V01', entity: { name: 'Synthetic Test Company', crNumber: 'SYNTHETIC-001', countryCode: 'US', currency: 'USD' },
  scope: 'unconsolidated', purpose: 'zakat', source: { fileName: 'synthetic-statements.pdf', sha256: 'a'.repeat(64), auditor: 'Synthetic Auditor', reportDate: '2023-11-06', opinion: 'unmodified', note: 'Synthetic test data only' }, warnings: ['Special purpose statements; unequal comparison periods.'],
  periods: [
    { id: '2022', label: '2022', startDate: '2022-01-01', endDate: '2022-12-31', comparabilityNote: '12 months', metrics: Object.fromEntries(HISTORICAL_METRICS.map(key => [key, { value: key === 'totalAssets' ? 100 : key === 'totalLiabilities' ? 60 : key === 'totalEquity' ? 40 : 25, pdfPage: 4, printedPage: '3', status: 'verified' }])) },
    { id: '2021', label: '2020–2021', startDate: '2020-09-06', endDate: '2021-12-31', comparabilityNote: 'Longer than a calendar year; growth percentages are not comparable.', metrics: Object.fromEntries(HISTORICAL_METRICS.map(key => [key, { value: null, pdfPage: null, printedPage: null, status: 'unavailable' }])) },
  ],
};
const org = { id: 'synthetic-org', crNumber: 'SYNTHETIC-001', country: 'US', baseCurrency: 'USD' };
const parse = (input: unknown) => parseHistoricalStatements(JSON.stringify(input), org);
const data = parse(historicalFixture);
assert.equal(data.periods[1].metrics.cash.value, null);
assert.equal(data.periods[1].metrics.cash.status, 'unavailable');
assert.equal(historicalBalanceDifference(data.periods[0]), 0);
assert.equal(historicalBalanceDifference(data.periods[1]), null);
assert.throws(() => parseHistoricalStatements(JSON.stringify(historicalFixture), {...org, crNumber: 'OTHER'}), /ENTITY_MISMATCH/);
assert.throws(() => parseHistoricalStatements(JSON.stringify(historicalFixture), {...org, crNumber: null}), /ENTITY_MISMATCH/);
assert.throws(() => parse({...historicalFixture, periods: [{...historicalFixture.periods[0], startDate:'2022-02-30'}]}), /INVALID_DATE/);
assert.throws(() => parse({...historicalFixture, periods: [{...historicalFixture.periods[0], startDate:'2023-01-01'}]}), /INVALID_PERIOD/);
assert.throws(() => parseHistoricalStatements(' '.repeat(1024*1024+1), org), /FILE_TOO_LARGE/);
const revised = structuredClone(historicalFixture);
revised.periods[0].metrics.revenue.pdfPage = null;
assert.equal(parse(revised).periods[0].metrics.revenue.status, 'needs_review');
revised.periods[0].metrics.totalAssets.value = 105;
assert.equal(historicalBalanceDifference(parse(revised).periods[0]), 5);
console.log('Historical statements contract checks passed');
