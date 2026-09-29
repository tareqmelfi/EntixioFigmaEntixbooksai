import type { Invoice } from './api';
export type InvoiceZatcaState = 'accepted' | 'rejected' | 'review' | 'sending' | 'pending' | 'uncertain' | 'not_sent' | 'test' | 'unverified';
/** Production delivery success and authority evidence differ from local approval. */
export function invoiceZatcaState(invoice: Pick<Invoice, 'zatcaDelivery' | 'zatcaStatus'>): InvoiceZatcaState {
  const evidence = invoice.zatcaDelivery?.evidence;
  if (evidence?.mode && evidence.mode !== 'production') return 'test';
  // Terminal authority evidence is definitive; otherwise use the latest queue state.
  const terminal = ['REPORTED', 'CLEARED', 'REJECTED'].includes(evidence?.state || '');
  const state = terminal ? evidence?.state : invoice.zatcaDelivery?.state || evidence?.state || invoice.zatcaStatus;
  if (['REPORTED', 'CLEARED'].includes(state || '')) return evidence?.mode === 'production' ? 'accepted' : 'unverified';
  if (state === 'ACCEPTED') return invoice.zatcaDelivery?.state === 'ACCEPTED' ? 'accepted' : 'unverified';
  if (state === 'REJECTED') return 'rejected';
  if (state === 'REVIEW') return 'review';
  if (state === 'SENDING') return 'sending';
  if (state === 'PENDING' || state === 'QUEUED') return 'pending';
  if (state === 'RETRY' || state === 'UNCERTAIN') return 'uncertain';
  if (!state || state === 'NOT_SENT' || state === 'NONE') return 'not_sent';
  return 'unverified';
}
export const INVOICE_ZATCA_LABELS = {
  accepted: ['مقبولة لدى الهيئة', 'Accepted by ZATCA'],
  rejected: ['مرفوضة من الهيئة', 'Rejected by ZATCA'],
  review: ['تحتاج معالجة', 'Needs attention'],
  sending: ['جارٍ الإرسال للهيئة', 'Sending to ZATCA'],
  pending: ['في قائمة الإرسال', 'Queued for submission'],
  uncertain: ['نتيجة الإرسال غير مؤكدة', 'Submission result unconfirmed'],
  not_sent: ['لم تُرسل للهيئة', 'Not submitted to ZATCA'],
  test: ['إرسال تجريبي — ليس قبول إنتاج', 'Test submission — not production acceptance'],
  unverified: ['حالة الهيئة تحتاج تحقق', 'ZATCA status needs verification'],
} as const;
