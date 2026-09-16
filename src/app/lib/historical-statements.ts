/** Local, read-only statement files. This module never writes to the ledger or storage. */
export const HISTORICAL_MAX_BYTES = 1024 * 1024;
export const HISTORICAL_METRICS = ['revenue', 'grossProfit', 'netProfit', 'cash', 'totalAssets', 'totalLiabilities', 'totalEquity', 'operatingCashFlow', 'investingCashFlow', 'financingCashFlow'] as const;
export type HistoricalMetricKey = typeof HISTORICAL_METRICS[number];
export type HistoricalMetric = { value: number | null; pdfPage: number | null; printedPage: string | null; status: 'verified' | 'needs_review' | 'unavailable' };
export type HistoricalPeriod = { id: string; label: string; startDate: string; endDate: string; comparabilityNote: string; metrics: Record<HistoricalMetricKey, HistoricalMetric> };
export type HistoricalStatements = {
  schemaVersion: 1; revision: string;
  entity: { name: string; crNumber: string; countryCode: string; currency: string };
  scope: 'unconsolidated' | 'consolidated'; purpose: string;
  source: { fileName: string; sha256: string; auditor: string; reportDate: string; opinion: string; note: string };
  warnings: string[]; periods: HistoricalPeriod[];
};
export type HistoricalOrg = { id: string; crNumber?: string | null; country: string; baseCurrency: string };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_FILE');
  return value as Record<string, unknown>;
}
function text(value: unknown, optional = false): string {
  if (optional && value == null) return '';
  if (typeof value !== 'string' || value.length > 5000 || (!optional && !value.trim())) throw new Error('INVALID_FILE');
  return value.trim();
}
function date(value: unknown): string {
  const s = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) throw new Error('INVALID_DATE');
  return s;
}
export function parseHistoricalStatements(raw: string, org: HistoricalOrg): HistoricalStatements {
  if (new TextEncoder().encode(raw).byteLength > HISTORICAL_MAX_BYTES) throw new Error('FILE_TOO_LARGE');
  const input = object(JSON.parse(raw));
  if (input.schemaVersion !== 1) throw new Error('INVALID_VERSION');
  const e = object(input.entity);
  const entity = { name: text(e.name), crNumber: text(e.crNumber), countryCode: text(e.countryCode), currency: text(e.currency) };
  if (!org.crNumber?.trim() || entity.crNumber !== org.crNumber.trim() || entity.countryCode !== org.country || entity.currency !== org.baseCurrency) throw new Error('ENTITY_MISMATCH');
  if (!['unconsolidated', 'consolidated'].includes(String(input.scope))) throw new Error('INVALID_SCOPE');
  const s = object(input.source);
  const source = { fileName: text(s.fileName), sha256: text(s.sha256), auditor: text(s.auditor), reportDate: date(s.reportDate), opinion: text(s.opinion), note: text(s.note, true) };
  if (!/^[a-f\d]{64}$/i.test(source.sha256)) throw new Error('INVALID_HASH');
  if (!Array.isArray(input.warnings) || input.warnings.length > 100 || !Array.isArray(input.periods) || !input.periods.length || input.periods.length > 50) throw new Error('INVALID_FILE');
  const warnings = input.warnings.map(v => text(v));
  const ids = new Set<string>();
  const periods = input.periods.map(value => {
    const p = object(value);
    const id = text(p.id), label = text(p.label), startDate = date(p.startDate), endDate = date(p.endDate);
    if (ids.has(id) || startDate > endDate) throw new Error('INVALID_PERIOD');
    ids.add(id);
    const values = object(p.metrics);
    const metrics = {} as Record<HistoricalMetricKey, HistoricalMetric>;
    for (const key of HISTORICAL_METRICS) {
      const m = object(values[key]);
      if (m.value !== null && (typeof m.value !== 'number' || !Number.isFinite(m.value) || Math.abs(m.value) > Number.MAX_SAFE_INTEGER)) throw new Error('INVALID_AMOUNT');
      if (!['verified', 'needs_review', 'unavailable'].includes(String(m.status))) throw new Error('INVALID_STATUS');
      if (m.pdfPage !== null && (!Number.isInteger(m.pdfPage) || Number(m.pdfPage) < 1)) throw new Error('INVALID_PAGE');
      const metric: HistoricalMetric = { value: m.value as number | null, pdfPage: m.pdfPage as number | null, printedPage: m.printedPage == null ? null : text(m.printedPage), status: m.status as HistoricalMetric['status'] };
      if (metric.value === null) metric.status = 'unavailable';
      if (metric.status === 'unavailable' && metric.value !== null) throw new Error('INVALID_STATUS');
      if (metric.status === 'verified' && metric.pdfPage === null) metric.status = 'needs_review';
      metrics[key] = metric;
    }
    return { id, label, startDate, endDate, comparabilityNote: text(p.comparabilityNote, true), metrics };
  });
  return { schemaVersion: 1, revision: text(input.revision), entity, scope: input.scope as HistoricalStatements['scope'], purpose: text(input.purpose), source, warnings, periods };
}
export function historicalBalanceDifference(period: HistoricalPeriod): number | null {
  const { totalAssets: a, totalLiabilities: l, totalEquity: e } = period.metrics;
  return a.value === null || l.value === null || e.value === null ? null : a.value - l.value - e.value;
}
