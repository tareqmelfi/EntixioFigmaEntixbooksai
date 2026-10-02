/**
 * SimilarityReviewDialog · shown when an ingestion create answers
 * SIMILARITY_REVIEW_REQUIRED. Nothing was written server-side; the user picks
 * one of the signed allowed actions and the caller resubmits with a
 * duplicateDecision (buildDuplicateDecision).
 */
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useRef } from 'react';
import { useLanguage } from "./LanguageContext";
import { Button } from "./ui/button";
import {
  SIMILARITY_ACTION_LABELS,
  similaritySignalLabel,
  type DuplicateDecisionAction,
  type SimilarityReview,
} from "../lib/similarity-review";

interface Props {
  review: SimilarityReview
  /** display hint for the candidate document (e.g. its number) when known */
  candidateLabel?: string | null
  busy?: boolean
  onChoose: (action: DuplicateDecisionAction) => void
  onCancel: () => void
}

export function SimilarityReviewDialog({ review, candidateLabel, busy, onChoose, onCancel }: Props) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => { section.current?.scrollIntoView({ block: 'center' }); section.current?.focus({ preventScroll: true }); }, [review.decisionToken]);
  const { language } = useLanguage();
  const lang: "ar" | "en" = language === "en" ? "en" : "ar";
  const t = (ar: string, en: string) => (lang === "en" ? en : ar);

  const actions: Array<{ action: DuplicateDecisionAction; className: string }> = [
    { action: "USE_EXISTING", className: "bg-primary hover:bg-primary/80" },
    { action: "UPDATE_DRAFT", className: "bg-warning hover:bg-warning text-primary-foreground" },
    { action: "CREATE_SEPARATE", className: "" },
  ];

  return (
    <section ref={section} tabIndex={-1} aria-label={t("مراجعة تشابه المستندات", "Document similarity review")} className="my-4 rounded-xl border border-warning/40 bg-card p-4">
      <div className="w-full space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-warning/10 p-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t("مستند مشابه يحتاج مراجعة", "Similar document needs review")}</h3>
            <p className="text-sm text-muted-foreground">
              {t(
                "لم يُحفظ شيء بعد — وجد النظام مستنداً قائماً يشبه هذا المستند. اختر كيفية المتابعة.",
                "Nothing was saved yet — the system found an existing document that looks similar. Choose how to proceed.",
              )}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border p-3 text-sm">
          <p className="text-foreground font-medium">
            {review.candidate.entityType === "Bill" ? t("فاتورة شراء قائمة", "Existing purchase bill") : t("مصروف قائم", "Existing expense")}
            {candidateLabel ? ` · ${candidateLabel}` : ""}
            {review.candidate.status ? ` · ${review.candidate.status}` : ""}
          </p>
          <Link className="mt-2 inline-block text-primary underline" target="_blank" rel="noopener noreferrer"
            to={review.candidate.entityType === "Bill" ? `/app/purchases/bills/${encodeURIComponent(review.candidate.id)}` : `/app/expenses/${encodeURIComponent(review.candidate.id)}`}>
            {t("فتح المستند الموجود", "Open existing document")}
          </Link>
          {review.crossPurchase && review.candidate.entityType === 'Bill' && ['RECEIVED', 'DUE', 'PARTIAL', 'OVERDUE'].includes(review.candidate.status || '') && (
            <Link className="ms-4 inline-block text-primary underline" target="_blank" rel="noopener noreferrer"
              to={`/app/payments/new?billId=${encodeURIComponent(review.candidate.id)}`}>
              {t('سداد الفاتورة الموجودة', 'Pay existing bill')}
            </Link>
          )}
          {review.crossPurchase && <p className="mt-2 text-sm text-muted-foreground">
            {review.candidate.entityType === "Bill"
              ? t("قد يكون هذا سدادًا لفاتورة شراء موجودة. راجع الفاتورة وسجّل السداد بسند صرف مرتبط بها؛ لا تنشئ مصروفًا ثانيًا لنفس الشراء.", "This may settle an existing purchase bill. Review it and record a linked payment voucher; do not create a second expense for the same purchase.")
              : t("قد يكون الشراء مسجلًا بالفعل كمصروف مدفوع. راجع المستند الموجود؛ اختر إنشاء منفصل فقط إذا كانت عملية شراء أخرى.", "This purchase may already be recorded as a paid expense. Review the existing document; create separately only for a different purchase.")}
          </p>}
          <div className="mt-2 space-y-1">
            {review.matchedSignals.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                <span>
                  {t("متطابق:", "Matching:")}{" "}
                  {review.matchedSignals.map((s) => similaritySignalLabel(s, lang)).join(t(" · ", " · "))}
                </span>
              </p>
            )}
            {review.differingSignals.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <XCircle className="h-3.5 w-3.5 text-danger mt-0.5 shrink-0" />
                <span>
                  {t("مختلف:", "Differing:")}{" "}
                  {review.differingSignals.map((s) => similaritySignalLabel(s, lang)).join(t(" · ", " · "))}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {t("مراجعة البيانات", "Review data")}
          </Button>
          {actions
            .filter(({ action }) => review.allowedActions.includes(action))
            .map(({ action, className }) => (
              <Button
                key={action}
                type="button"
                variant={action === "CREATE_SEPARATE" ? "outline" : "default"}
                className={className}
                disabled={busy}
                onClick={() => onChoose(action)}
              >
                {lang === "en" ? SIMILARITY_ACTION_LABELS[action].en : SIMILARITY_ACTION_LABELS[action].ar}
              </Button>
            ))}
        </div>
      </div>
    </section>
  );
}
