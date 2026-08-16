/**
 * Similarity-review contract · mirrors the ingestion service's
 * SIMILARITY_REVIEW_REQUIRED outcome (server: src/lib/ingestion-service.ts).
 *
 * When a bill/expense create answers with `ingestion.outcome`, the record was
 * NOT written — the user must pick one of the signed `allowedActions` and the
 * client resubmits the same payload plus `duplicateDecision`.
 */

export type DuplicateDecisionAction = 'USE_EXISTING' | 'UPDATE_DRAFT' | 'CREATE_SEPARATE'

export interface SimilarityReview {
  candidate: { entityType: 'Bill' | 'Expense'; id: string; status?: string | null }
  tier: string
  matchedSignals: string[]
  differingSignals: string[]
  decisionToken: string
  allowedActions: DuplicateDecisionAction[]
}

export interface DuplicateDecision {
  action: DuplicateDecisionAction
  candidateId: string
  decisionToken: string
  reasonCode: string
}

/** Extracts the review payload from any ingestion create/approve response.
 * Bills/expenses nest it under `ingestion`; inbox approve answers top-level. */
export function getSimilarityReview(response: any): SimilarityReview | null {
  const block = response?.ingestion ?? (response?.outcome ? response : null)
  const review = block?.similarityReview
  if (block?.outcome !== 'SIMILARITY_REVIEW_REQUIRED' || !review) return null
  if (typeof review.decisionToken !== 'string' || !review.decisionToken) return null
  if (typeof review.candidate?.id !== 'string' || !review.candidate.id) return null
  return review as SimilarityReview
}

export const SIMILARITY_ACTION_REASON_CODES: Record<DuplicateDecisionAction, string> = {
  USE_EXISTING: 'user_confirmed_existing',
  UPDATE_DRAFT: 'user_updated_draft',
  CREATE_SEPARATE: 'user_chose_separate',
}

export function buildDuplicateDecision(review: SimilarityReview, action: DuplicateDecisionAction): DuplicateDecision {
  return {
    action,
    candidateId: review.candidate.id,
    decisionToken: review.decisionToken,
    reasonCode: SIMILARITY_ACTION_REASON_CODES[action],
  }
}

const SIGNAL_LABELS: Record<string, { ar: string; en: string }> = {
  canonical_party: { ar: 'الطرف', en: 'Party' },
  legal_identifier: { ar: 'المعرف النظامي', en: 'Legal identifier' },
  date: { ar: 'التاريخ', en: 'Date' },
  amount: { ar: 'المبلغ', en: 'Amount' },
  currency: { ar: 'العملة', en: 'Currency' },
  document_number: { ar: 'رقم المستند', en: 'Document number' },
  source_hash: { ar: 'الملف المصدر', en: 'Source file' },
}

export function similaritySignalLabel(signal: string, language: 'ar' | 'en'): string {
  const label = SIGNAL_LABELS[signal]
  if (!label) return signal
  return language === 'en' ? label.en : label.ar
}

/** The signed decision token expired/was invalidated — the caller should fetch a fresh review. */
export function isStaleDecisionError(error: any): boolean {
  return error?.status === 409 && /^(stale|expired|invalid)_duplicate_decision$/.test(error?.code || '')
}

export const SIMILARITY_ACTION_LABELS: Record<DuplicateDecisionAction, { ar: string; en: string }> = {
  USE_EXISTING: { ar: 'استخدام الموجود', en: 'Use existing' },
  UPDATE_DRAFT: { ar: 'تحديث المسودة', en: 'Update draft' },
  CREATE_SEPARATE: { ar: 'إنشاء منفصل', en: 'Create separate' },
}
