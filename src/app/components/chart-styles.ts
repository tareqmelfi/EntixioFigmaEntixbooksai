/**
 * Entix Books — Unified Chart Styling System
 * ──────────────────────────────────────────
 * Rule: Titles stay bold and clear. Everything else (axes, grid, legend)
 *       is deliberately muted so the data visuals (bars, lines) are the hero.
 */

/** Very faint grid — almost invisible guide lines */
export const gridStyle = {
  strokeDasharray: "3 3",
  stroke: "#ECEEF1",
  strokeOpacity: 0.8,
} as const;

/** X-axis (category labels like months) — small, muted */
export const xAxisStyle = {
  style: { fontSize: "10px", fontFamily: "Noto Sans Arabic", fill: "#B0B7C3" },
  tickLine: false as const,
  axisLine: false as const,
} as const;

/** X-axis for English / numeric values */
export const xAxisNumericStyle = {
  style: { fontSize: "10px", fontFamily: "Inter", fill: "#B0B7C3" },
  tickLine: false as const,
  axisLine: false as const,
} as const;

/** Y-axis (numeric scale) — very light so numbers don't compete with data */
export const yAxisStyle = {
  style: { fontSize: "10px", fontFamily: "Inter", fill: "#C4CAD4" },
  tickLine: false as const,
  axisLine: false as const,
} as const;

/** Y-axis for Arabic category labels (horizontal bar charts) */
export const yAxisCategoryStyle = {
  style: { fontSize: "10px", fontFamily: "Noto Sans Arabic", fill: "#B0B7C3" },
  tickLine: false as const,
  axisLine: false as const,
} as const;

/** Tooltip — stays readable, subtle border */
export const tooltipStyle = {
  contentStyle: {
    fontFamily: "Noto Sans Arabic",
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
    fontFamily: "Noto Sans Arabic",
    fontSize: "11px",
    color: "#9CA3AF",
    paddingTop: "8px",
  },
  iconSize: 8,
} as const;

/** Format number for tooltip display */
export const formatSAR = (value: number) => `${value.toLocaleString()} SR`;
export const formatSARShort = (value: number) => `${value.toLocaleString()} SR`;

/** Muted bar colors with slight transparency for softer look */
export const chartColors = {
  navy: "#0B1B49",
  navySoft: "rgba(11,27,73,0.85)",
  blue: "#1276E3",
  blueSoft: "rgba(18,118,227,0.8)",
  teal: "#179FC5",
  tealSoft: "rgba(23,159,197,0.75)",
  green: "#22C55E",
  red: "#EF4444",
} as const;