import { displayLocale } from "../lib/number-display";
/**
 * ENTIX.IO — Unified Chart Styling System
 * ──────────────────────────────────────────
 * Rule: Titles stay bold and clear. Everything else (axes, grid, legend)
 *       is deliberately muted so the data visuals (bars, lines) are the hero.
 */

/** Very faint grid — almost invisible guide lines */
export const gridStyle = {
  strokeDasharray: "3 3",
  stroke: "#E3DACB",
  strokeOpacity: 0.8,
} as const;

/** X-axis (category labels like months) — small, muted */
export const xAxisStyle = {
  style: { fontSize: "10px", fontFamily: "IBM Plex Sans Arabic", fill: "#8A93A6" },
  tickLine: false as const,
  axisLine: false as const,
} as const;

/** X-axis for English / numeric values */
export const xAxisNumericStyle = {
  style: { fontSize: "10px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", fill: "#8A93A6" },
  tickLine: false as const,
  axisLine: false as const,
} as const;

/** Y-axis (numeric scale) — very light so numbers don't compete with data */
export const yAxisStyle = {
  style: { fontSize: "10px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", fill: "#8A93A6" },
  tickLine: false as const,
  axisLine: false as const,
} as const;

/** Y-axis for Arabic category labels (horizontal bar charts) */
export const yAxisCategoryStyle = {
  style: { fontSize: "10px", fontFamily: "IBM Plex Sans Arabic", fill: "#8A93A6" },
  tickLine: false as const,
  axisLine: false as const,
} as const;

/** Tooltip — stays readable, subtle border */
export const tooltipStyle = {
  contentStyle: {
    fontFamily: "IBM Plex Sans Arabic",
    fontSize: "12px",
    backgroundColor: "rgba(255,255,255,0.96)",
    border: "1px solid #ECEEF1",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
    padding: "8px 12px",
  },
  itemStyle: {
    color: "#6B7280",
    fontSize: "11px",
  },
  labelStyle: {
    color: "#374151",
    fontWeight: 500,
    marginBottom: "4px",
  },
} as const;

/** Legend — small and quiet */
export const legendStyle = {
  wrapperStyle: {
    fontFamily: "IBM Plex Sans Arabic",
    fontSize: "11px",
    color: "#9CA3AF",
    paddingTop: "8px",
  },
  iconSize: 8,
} as const;

/** Format number for tooltip display */
export const formatSAR = (value: number) => `${value.toLocaleString(displayLocale(), { maximumFractionDigits: 2 })} SR`;
export const formatSARShort = (value: number) => `${value.toLocaleString(displayLocale(), { maximumFractionDigits: 2 })} SR`;

/** Muted bar colors with slight transparency for softer look */
export const chartColors = {
  navy: "#1A1E48",
  navySoft: "rgba(11,27,73,0.85)",
  blue: "#5875DB",
  blueSoft: "rgba(18,118,227,0.8)",
  teal: "#8FA3F0",
  tealSoft: "rgba(23,159,197,0.75)",
  green: "#4661C7",
  /** Official loss / danger color — use for losses, overdue, critical states */
  red: "#9E3B2E",
  redSoft: "rgba(239,68,68,0.80)",
} as const;

/**
 * Status colors — consistent across invoices, reports, and dashboard indicators.
 * green  = paid / safe / low
 * blue   = sent / moderate / neutral
 * red    = overdue / critical / loss
 * gray   = draft / inactive
 */
export const statusColors = {
  green:     { text: "#4661C7", bg: "#F0FDF4", border: "#BBF7D0" },
  blue:      { text: "#5875DB", bg: "#EFF6FF", border: "#BFDBFE" },
  red:       { text: "#9E3B2E", bg: "#FEF2F2", border: "#FECACA" },
  amber:     { text: "#8A5F14", bg: "#FFFBEB", border: "#FDE68A" },
  gray:      { text: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
} as const;