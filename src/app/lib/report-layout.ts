import type { ReportColumn, ReportPayload, ReportPrintSettings, ReportSection } from './api';

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
  return report.sections.some(section => visibleColumns(section, settings).length >= 7)
    ? { ...settings, orientation: 'landscape' }
    : settings;
}

/** Repeat the identity column in each panel; every metric is kept exactly once. */
export function reportLayoutSections(report: ReportPayload, settings: ReportPrintSettings): ReportSection[] {
  return report.sections.flatMap(section => {
    const columns = visibleColumns(section, settings);
    if (columns.length <= 8) return [{ ...section, columns }];
    const [identity, ...metrics] = columns;
    const panelCount = Math.ceil(metrics.length / 6);
    return Array.from({ length: panelCount }, (_, index) => {
      const [ar, en] = section.title.split('␟');
      const suffix = ` (${index + 1}/${panelCount})`;
      return {
        ...section,
        id: `${section.id}-panel-${index + 1}`,
        title: `${ar}${suffix}${en ? `␟${en}${suffix}` : ''}`,
        columns: [identity, ...metrics.slice(index * 6, (index + 1) * 6)],
      };
    });
  });
}

/** Summary must never silently discard the report's only data section. */
export function summarizeReport(report: ReportPayload): ReportPayload {
  const sections = report.sections.filter(section => !/-detail$|-crosscheck$/.test(section.id));
  return sections.length ? { ...report, sections } : report;
}
