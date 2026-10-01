import type { CSSProperties } from 'react';
import type { ReportPayload, ReportPrintSettings } from './api';

export const reportFonts = { noto: 'Noto Sans Arabic', plex: 'IBM Plex Sans Arabic', tajawal: 'Tajawal' } as const;
const hex = (color: string | undefined, fallback: string) => /^#[0-9a-f]{6}$/i.test(color || '') ? color! : fallback;
const tint = (color: string, white: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - white) + 255 * white).toString(16).padStart(2, '0')).join('');
export function reportPalette(settings: ReportPrintSettings) {
  const primary = settings.colorMode === 'plain' ? '#111111' : settings.colorMode === 'grayscale' ? '#333333' : hex(settings.primaryColor, '#102d50');
  const rgb = [1, 3, 5].map(i => parseInt(primary.slice(i, i + 2), 16));
  const foreground = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 150 ? '#111111' : '#ffffff';
  const plain = settings.colorMode === 'plain';
  return { primary, foreground, section: plain ? '#ffffff' : primary, header: plain ? '#ffffff' : tint(primary, .84), total: plain ? '#ffffff' : tint(primary, .91), stripe: plain ? '#ffffff' : tint(primary, .96), rule: plain ? '#999999' : tint(primary, .75) };
}
export function reportAppearance(settings: ReportPrintSettings): CSSProperties {
  const palette = reportPalette(settings);
  return Object.fromEntries([
    ...Object.entries(palette).map(([key, value]) => [`--report-${key}`, value]),
    ['--report-font', `"${reportFonts[settings.fontFamily || 'noto']}", sans-serif`],
  ]) as CSSProperties;
}
export const reportTheme = (settings: ReportPrintSettings) => `report-themed report-theme-${settings.colorMode || 'color'}${settings.colorValues === false ? ' report-neutral-values' : ''}`;
export const reportSign = (value: unknown) => Number(value) < 0 ? 'report-negative' : Number(value) > 0 ? 'report-positive' : 'report-zero';
/** Display only recorded summary values; never derive or fabricate missing financial data. */
export function reportEquationValues(report: ReportPayload) {
  if (report.id !== 'income-statement') return null;
  const rows = report.sections.find(section => section.id === 'income-summary')?.rows;
  const values = ['revenue', 'expenses', 'net-income'].map(id => rows?.find(row => row.id === id)?.values.amount);
  if (values.some(value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)))) return null;
  return values.map(Number);
}
