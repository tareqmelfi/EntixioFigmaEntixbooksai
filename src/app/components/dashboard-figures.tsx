/**
 * Dashboard figure strip · Ledger (Direction A)
 *
 * The ink-ruled strip from the approved dashboard artboard
 * (`Blue-DashboardAR.dc.html` · tablet + mobile variants):
 *   · ink rule top and bottom, paper rules between the figures
 *   · 4 columns ≥1280 · 2×2 below (tablet + mobile artboards)
 *   · label 12/13px muted · serif numeral 28/32/40px · hint 11/12px
 *   · outer edges keep zero inline padding so the numerals sit on the rule
 *
 * Local to the dashboard on purpose: the shared `.ledger-figures` primitive
 * carries a different padding scale and collapses to one column under 640px,
 * while the mobile artboard keeps the 2×2 grid.
 */
import "./dashboard-figures.css";
import { Link } from "react-router";
import type { ReactNode } from "react";
import { displayDigits, displayLocale } from "../lib/number-display";
import { cn } from "./ui/utils";

export type FigureHintTone = "muted" | "primary" | "warning" | "success" | "danger";

export interface DashboardFigure {
  key: string;
  href?: string;
  testId?: string;
  /** Full label (desktop). */
  label: ReactNode;
  /** Short label used below 1280px, where the column is half as wide. */
  labelShort?: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  hintShort?: ReactNode;
  hintTone?: FigureHintTone;
  /** Losses render the numeral in brick; everything else stays ink. */
  negative?: boolean;
  positive?: boolean;
}

const hintToneClass: Record<FigureHintTone, string> = {
  muted: "text-content-secondary",
  primary: "text-primary",
  warning: "text-warning",
  success: "text-success",
  danger: "text-danger",
};

/** Two spans so the compact copy shows below 1280px without a second render. */
function Responsive({ full, short }: { full: ReactNode; short?: ReactNode }) {
  if (short === undefined) return <>{full}</>;
  return (
    <>
      <span className="xl:hidden">{short}</span>
      <span className="hidden xl:inline">{full}</span>
    </>
  );
}

export function DashboardFigures({ items, className, columns = 4 }: { items: DashboardFigure[]; className?: string; columns?: 3 | 4 | 6 }) {
  const rows = Math.ceil(items.length / 2);
  return (
    <div className={columns === 6 ? "dashboard-figures-container" : undefined}><div className={cn("grid border-y border-foreground", columns === 6 ? "dashboard-figures-six" : columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((f, i) => {
        const startCol = i % 2 === 0;
        const lastRow = Math.floor(i / 2) === rows - 1;
        const last = i === items.length - 1;
        return (
          <div
            key={f.key}
            data-testid={f.testId}
            className={cn(
              "flex min-w-0 flex-col gap-1 border-border py-3 md:py-3.5",
              columns === 3 && "sm:border-b-0 sm:border-e sm:px-4 first:sm:ps-0 last:sm:border-e-0 last:sm:pe-0 last:max-sm:col-span-2 last:max-sm:border-e-0",
              columns !== 6 && (startCol ? "border-e ps-0 pe-3.5 md:pe-5" : "ps-3.5 pe-0 md:ps-5"),
              columns !== 6 && !lastRow && "border-b xl:border-b-0",
              columns !== 6 && (last ? "xl:border-e-0 xl:pe-0" : "xl:border-e xl:pe-4"),
              columns !== 6 && (i === 0 ? "xl:ps-0" : "xl:ps-4"),
            )}
          >
            <span className="truncate text-[12px] leading-tight text-content-secondary xl:text-[13px]">
              {f.href ? <Link to={f.href}><Responsive full={f.label} short={f.labelShort} /></Link> : <Responsive full={f.label} short={f.labelShort} />}
            </span>
            <span
              dir="ltr"
              className={cn(
                "font-display text-[28px] leading-none tracking-[-0.01em] tabular-nums md:text-[32px] xl:text-[40px]",
                f.negative ? "text-danger" : f.positive ? "text-primary" : "text-foreground",
              )}
            >
              {f.href ? <Link to={f.href} className="font-display font-normal focus-visible:outline-2 focus-visible:outline-ring">{f.value}</Link> : f.value}
            </span>
            {f.hint && (
              <span className={cn("truncate text-[11px] leading-tight md:text-[12px]", hintToneClass[f.hintTone ?? "muted"])}>
                <Responsive full={f.hint} short={f.hintShort} />
              </span>
            )}
          </div>
        );
      })}
    </div></div>
  );
}

/** Shared figure formatting keeps both dashboard bases on the approved ledger type scale. */
export function DashboardNumeral({ value, fraction = true }: { value: number; fraction?: boolean }) {
  const [integer, decimal] = Math.abs(value).toFixed(2).split('.');
  return <>{value < 0 ? '−' : ''}{Number(integer).toLocaleString(displayLocale('en-US'), {maximumFractionDigits: 0})}{fraction && <small className="text-[0.45em] text-current">{displayDigits('.' + decimal)}</small>}</>;
}
