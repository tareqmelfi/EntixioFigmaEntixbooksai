import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Shared progressive disclosure: native keyboard support, logical RTL spacing. */
export function DetailSection({ title, description, children, testId }: {
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
}) {
  return <details className="group/detail min-w-0 rounded-lg border border-border bg-card" data-testid={testId}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span>{description && <span className="mt-1 block text-xs text-content-secondary">{description}</span>}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-content-secondary transition-transform group-open/detail:rotate-180" />
    </summary>
    <div className="space-y-4 border-t border-border p-4">{children}</div>
  </details>;
}
