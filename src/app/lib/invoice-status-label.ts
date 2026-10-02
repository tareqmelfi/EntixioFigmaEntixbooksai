/** Document workflow, settlement and lateness are separate dimensions.
 * Historic PAID/PARTIAL rows prove issuance, not who explicitly approved them. */
export function invoiceStatusLabel(invoice: { status: string; approvalConfirmed?: boolean; total: unknown; amountPaid?: unknown }, overdueDays: number, language: string): string {
  const ar = language === 'ar';
  const document = invoice.status === 'DRAFT' ? (ar ? 'مسودة' : 'Draft')
    : invoice.status === 'CANCELLED' ? (ar ? 'ملغاة' : 'Cancelled')
    : (invoice.status === 'APPROVED' || invoice.approvalConfirmed) ? (ar ? 'معتمدة' : 'Approved') : (ar ? 'صادرة' : 'Issued');
  if (invoice.status === 'DRAFT' || invoice.status === 'CANCELLED') return document;
  const paid = Number(invoice.amountPaid || 0), total = Number(invoice.total || 0);
  const settled = total > 0 && paid >= total;
  const payment = settled ? (ar ? 'مدفوعة' : 'Paid') : paid > 0 ? (ar ? 'مدفوعة جزئيًا' : 'Partially paid') : (ar ? 'غير مدفوعة' : 'Unpaid');
  return [document, payment, !settled && overdueDays > 0 ? (ar ? `متأخرة ${overdueDays} أيام` : `${overdueDays} days overdue`) : ''].filter(Boolean).join(' · ');
}
