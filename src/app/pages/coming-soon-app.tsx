/**
 * In-app "Coming Soon" page · used as a stub for routes that have a sidebar entry
 * but no implementation yet (UX-151 · "every clickable must open").
 *
 * Usage:
 *   <Route path="marketplace/accountants" element={<ComingSoonApp title="..." description="..." />} />
 */
import { Construction, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router";

export interface ComingSoonAppProps {
  title: string;
  description: string;
  /** Optional bullet list of features that will ship */
  features?: string[];
  /** Optional CTA · default = "اطلبها الآن" → mailto */
  ctaLabel?: string;
  ctaHref?: string;
}

export function ComingSoonApp({
  title,
  description,
  features,
  ctaLabel = "أبلغني عند الإطلاق",
  ctaHref = "mailto:hello@entix.io?subject=طلب%20ميزة",
}: ComingSoonAppProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
          <Construction className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-foreground mb-3" style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          {title}
        </h1>
        <p className="text-muted-foreground mb-8 text-base" style={{ lineHeight: 1.7 }}>
          {description}
        </p>

        {features && features.length > 0 && (
          <div className="mb-8 rounded-xl border border-border bg-white p-5 text-start">
            <div className="flex items-center gap-2 mb-3 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm" style={{ fontWeight: 600 }}>المتوقع في الإطلاق</span>
            </div>
            <ul className="space-y-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={ctaHref}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg transition-all hover:shadow-md text-sm"
            style={{ fontWeight: 600 }}
          >
            {ctaLabel}
          </a>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 border border-border bg-white text-foreground hover:bg-muted px-6 py-3 rounded-lg transition-all text-sm"
            style={{ fontWeight: 500 }}
          >
            <ArrowRight className="h-4 w-4" />
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
