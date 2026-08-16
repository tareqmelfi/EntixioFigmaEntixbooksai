import assert from 'node:assert/strict'
import {
  buildDuplicateDecision,
  getSimilarityReview,
  isStaleDecisionError,
  similaritySignalLabel,
  SIMILARITY_ACTION_REASON_CODES,
  type SimilarityReview,
} from '../src/app/lib/similarity-review'

const review: SimilarityReview = {
  candidate: { entityType: 'Bill', id: 'bill-9', status: 'DRAFT' },
  tier: 'STRONG',
  matchedSignals: ['canonical_party', 'amount', 'date'],
  differingSignals: ['document_number'],
  decisionToken: 'token-abc',
  allowedActions: ['USE_EXISTING', 'UPDATE_DRAFT', 'CREATE_SEPARATE'],
}

// getSimilarityReview extracts the review only from a real review outcome
assert.equal(getSimilarityReview(null), null)
assert.equal(getSimilarityReview({}), null)
assert.equal(getSimilarityReview({ ingestion: { outcome: 'SIMILARITY_REVIEW_REQUIRED' } }), null)
assert.equal(getSimilarityReview({ ingestion: { dedupeDecision: 'CREATED' } }), null)
assert.deepEqual(
  getSimilarityReview({ ingestion: { outcome: 'SIMILARITY_REVIEW_REQUIRED', similarityReview: review } }),
  review,
)
// token-less payloads are unusable — the resubmit would 409
assert.equal(getSimilarityReview({
  ingestion: { outcome: 'SIMILARITY_REVIEW_REQUIRED', similarityReview: { ...review, decisionToken: '' } },
}), null)

// inbox approve and ocr stage/commit answer with a TOP-LEVEL outcome block
assert.deepEqual(
  getSimilarityReview({ outcome: 'SIMILARITY_REVIEW_REQUIRED', similarityReview: review, dedupeDecision: 'SKIPPED_DUPLICATE' }),
  review,
)
assert.equal(getSimilarityReview({ outcome: 'SIMILARITY_REVIEW_REQUIRED' }), null)

// buildDuplicateDecision binds the signed token + candidate to the chosen action
for (const action of ['USE_EXISTING', 'UPDATE_DRAFT', 'CREATE_SEPARATE'] as const) {
  assert.deepEqual(buildDuplicateDecision(review, action), {
    action,
    candidateId: 'bill-9',
    decisionToken: 'token-abc',
    reasonCode: SIMILARITY_ACTION_REASON_CODES[action],
  })
}
assert.ok(SIMILARITY_ACTION_REASON_CODES.USE_EXISTING.length >= 1)
assert.ok(SIMILARITY_ACTION_REASON_CODES.UPDATE_DRAFT.length >= 1)
assert.ok(SIMILARITY_ACTION_REASON_CODES.CREATE_SEPARATE.length >= 1)

// signal labels are bilingual and fall back to the raw key
assert.equal(similaritySignalLabel('amount', 'ar'), 'المبلغ')
assert.equal(similaritySignalLabel('amount', 'en'), 'Amount')
assert.equal(similaritySignalLabel('canonical_party', 'ar'), 'الطرف')
assert.equal(similaritySignalLabel('source_hash', 'en'), 'Source file')
assert.equal(similaritySignalLabel('unknown_signal', 'ar'), 'unknown_signal')

// stale/expired/invalid decision tokens are classified so callers can re-review
assert.equal(isStaleDecisionError({ status: 409, code: 'stale_duplicate_decision' }), true)
assert.equal(isStaleDecisionError({ status: 409, code: 'expired_duplicate_decision' }), true)
assert.equal(isStaleDecisionError({ status: 409, code: 'invalid_duplicate_decision' }), true)
assert.equal(isStaleDecisionError({ status: 409, code: 'number_already_exists' }), false)
assert.equal(isStaleDecisionError({ status: 500, code: 'stale_duplicate_decision' }), false)
assert.equal(isStaleDecisionError(null), false)
assert.equal(isStaleDecisionError(new Error('network')), false)

console.log('similarity-review contracts OK')
