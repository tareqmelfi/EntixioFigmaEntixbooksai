/**
 * InlinePanel · expand-in-place form section.
 *
 * NOT a modal · NOT a slide-over · NOT floating.
 * Renders as a normal block in the page flow · pushes content below it down.
 * Same pattern as Wave / Wafeq quick-add forms.
 *
 * Usage:
 *   {open && (
 *     <InlinePanel title="فاتورة جديدة" onClose={...} footer={<>...buttons</>}>
 *       <form>...fields</form>
 *     </InlinePanel>
 *   )}
 *
 * Or with conditional render baked in:
 *   <InlinePanel open={open} title="..." onClose={...}>...</InlinePanel>
 *
 * UX-1 compliant.
 */
import { ReactNode } from "react";
import { X } from "lucide-react";

interface InlinePanelProps {
  open?: boolean; // optional · if omitted, always renders (caller does conditional render)
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Visual variant · "card" (bordered card) | "plain" (no border) */
  variant?: "card" | "plain";
}

export function InlinePanel({ open, title, description, onClose, children, footer, variant = "card" }: InlinePanelProps) {
  if (open === false) return null;

  const wrapper = variant === "card"
    ? "rounded-lg border border-border bg-surface"
    : "rounded-lg";

  return (
    <div className={wrapper}>
      <div className="flex items-start justify-between px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h2 className="text-section font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground shrink-0"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-border bg-surface-subtle rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
}
