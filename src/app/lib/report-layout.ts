import type { ReportColumn, ReportPayload, ReportPrintSettings, ReportSection } from './api';

export const isMonthlyReport = (report: ReportPayload) => report.sections.some(section => section.columns.some(column => /^\d{4}-\d{2}$/.test(column.key)));

export function reportColumnWidth(section: ReportSection, column: ReportColumn) {
  // Keep references content-sized; descriptions receive the remaining width.
  if (section.id === 'account-movements' || section.id.startsWith('account-movements-panel-')) return column.key === 'description' ? undefined : { width: '1%' };
  if (section.columns.some(c => /^(opening|closing)(Debit|Credit)$/.test(c.key))) return { width: column.key === 'label' ? '28%' : column.key === 'type' ? '12%' : `${60 / (section.columns.length - 2)}%` };
  if (section.columns.some(c => /^\d{4}-\d{2}$/.test(c.key))) return { width: column.key === 'label' ? '30%' : `${70 / (section.columns.length - 1)}%` };
  return isCompactReportColumn(column) ? { width: '1%' } : undefined;
}

/** Auto-layout gives descriptions the spare width instead of expanding amounts. */
export function isCompactReportColumn(column: ReportColumn) {
  return column.kind === 'money' || column.kind === 'number' || column.kind === 'date'
    || column.kind === 'status' || column.key === 'currency';
}

/** Keep a percentage sign with its heading rather than using a whole extra line. */
export function reportColumnLabel(column: ReportColumn) {
  return column.label.replace(/ +%/g, '\u00a0%');
}

const visibleColumns = (section: ReportSection, settings: ReportPrintSettings) =>
  section.columns.filter(column => settings.showNotes || column.key !== 'note');

/** Dense reports use a readable sheet instead of shrinking every column. */
export function reportLayoutSettings<T extends ReportPrintSettings>(report: ReportPayload, settings: T): T {
  if (settings.orientation === 'portrait' || settings.orientation === 'landscape') return settings;
  const wide = isMonthlyReport(report) || report.sections.some(section => visibleColumns(section, settings).length >= 7);
  return { ...settings, orientation: wide ? 'landscape' : 'portrait' };
}

/** Repeat identity and row currency in each panel; every metric is kept exactly once. */
export function reportLayoutSections(report: ReportPayload, settings: ReportPrintSettings): ReportSection[] {
  return report.sections.flatMap(section => {
    const columns = visibleColumns(section, settings);
    const portrait = reportLayoutSettings(report, settings).orientation === 'portrait';
    const trialBalance = report.id === 'trial-balance' && columns.some(c => c.key === 'openingDebit');
    const identities = columns.filter((column, index) => index === 0 || column.key === 'currency' || (trialBalance && column.key === 'type'));
    const metrics = columns.filter(c => !identities.includes(c));
    const panelSize = portrait ? 4 : isMonthlyReport(report) ? 7 : 6;
    if (columns.length <= (portrait ? identities.length + panelSize : 8)) return [{ ...section, columns }];
    const panelCount = Math.ceil(metrics.length / panelSize);
    return Array.from({ length: panelCount }, (_, index) => {
      const [ar, en] = section.title.split('␟');
      const suffix = ` (${index + 1}/${panelCount})`;
      return {
        ...section,
        id: `${section.id}-panel-${index + 1}`,
        title: `${ar}${suffix}${en ? `␟${en}${suffix}` : ''}`,
        columns: [...identities, ...metrics.slice(index * panelSize, (index + 1) * panelSize)],
      };
    });
  });
}

/** Summary must never silently discard the report's only data section. */
export function summarizeReport(report: ReportPayload): ReportPayload {
  const sections = report.sections.filter(section => !/-detail$|-crosscheck$/.test(section.id));
  return sections.length ? { ...report, sections } : report;
}
