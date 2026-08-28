/**
 * KpiCard — a dashboard number that actually goes somewhere (2026-08-28).
 *
 * Every dashboard tile used to be a dead <Card>: the CEO clicked "6 expenses"
 * and nothing happened. A number on a dashboard is a question ("which six?"),
 * so the tile is now a real link to the filtered list that answers it.
 *
 * Rendered as an <a> via react-router <Link> so middle-click and ⌘-click open a
 * new tab like any other link, and keyboard focus works without extra handlers.
 * Tiles with no destination stay plain <div>s — no fake affordance.
 */
import { Link } from "react-router";
import { ArrowUpLeft } from "lucide-react";
import { Card, CardContent } from "./ui/card";

export type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Tailwind text colour for the value (e.g. "text-amber-600"). */
  tone?: string;
  /** Destination for the drill-down. Omit for a display-only tile. */
  to?: string;
  /** Small caption under the value. */
  hint?: string;
  /** Tooltip / aria description for the link. */
  title?: string;
};

export function KpiCard({ label, value, icon, tone = "text-foreground", to, hint, title }: KpiCardProps) {
  const body = (
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs text-muted-foreground min-w-0 truncate">{label}</span>
        <span className="shrink-0 flex items-center gap-1">
          {icon}
          {to && <ArrowUpLeft className="h-3.5 w-3.5 text-primary/0 group-hover:text-primary/70 transition-colors" aria-hidden />}
        </span>
      </div>
      <div className={`font-english ${tone}`} style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.15 }}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</div>}
    </CardContent>
  );

  if (!to) return <Card className="border-border">{body}</Card>;

  return (
    <Link to={to} title={title || label} className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
      <Card className="border-border transition-colors hover:border-primary/50 hover:bg-primary/[0.03] cursor-pointer h-full">
        {body}
      </Card>
    </Link>
  );
}
