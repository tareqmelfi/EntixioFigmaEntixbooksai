import { InvoiceNotesPanel } from './invoice-notes-panel';
import { useOrgRegion } from "../lib/use-org-region";
import { InvoiceZatcaBadge } from "./invoice-zatca-badge";
import { invoiceZatcaState } from "../lib/invoice-zatca-state";
import { ContactProfileLink } from "./contact-profile-link";
import { InvoiceAmendmentPanel, type InvoiceAction } from './invoice-amendment-panel';
import { InvoiceDocuments } from './invoice-documents';
import { displayLocale, displayDigits } from "../lib/number-display";
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { authStore } from './auth-store';
import { api, type DocumentSendRecord, type Invoice } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { FullPageForm } from './full-page-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SendLogSection } from './send-log-section';
import { InvoiceReclassifyPanel } from './invoice-reclassify-panel';
import { CheckCircle2, Clock3, Mail } from 'lucide-react';

/** Issued document view: amendments use the server-authorized, audited workflow. */
export function IssuedInvoiceRecord({ invoice, onClose, onRefresh, onPayment, onSend, sendLogRefreshKey, accounts, initialAction, onRemove }: {
  initialAction?: InvoiceAction;
  onRemove?: () => void;
  invoice: Invoice; onClose: () => void; onRefresh: () => Promise<void>; onPayment: () => void;
  /** Chart of accounts · enables the limited post-issue reclassification. */
  accounts?: Array<{ id: string; code?: string | null; name: string; nameAr?: string | null; type?: string }>;
  /** «إرسال» — opens the compose page (never fires an email directly, UX-1).
   *  Pass a past DocumentSendRecord to prefill the page from «إعادة الإرسال». */
  onSend?: (prefill?: DocumentSendRecord) => void;
  sendLogRefreshKey?: number;
}) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { isSA } = useOrgRegion();
  const canCorrect = authStore.getState().user?.role === 'admin';
  const [refreshing, setRefreshing] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const preparePayment = async () => {
    setPaymentBusy(true); setPaymentError('');
    try { await api.paymentLinks.create(invoice.id, 'auto'); await onRefresh(); }
    catch { setPaymentError(t('تعذر تجهيز الرابط. راجع بوابات الدفع في إعدادات هذه المنشأة ثم أعد المحاولة.', 'Could not prepare the link. Check this company’s payment gateway settings, then retry.')); }
    finally { setPaymentBusy(false); }
  };
  const stripeManaged = (invoice as any).paymentLinkProvider === 'stripe-subscription';
  const delivery = invoice.zatcaDelivery;
  const evidence = delivery?.evidence;
  const accepted = invoiceZatcaState(invoice) === 'accepted';
  const canRelease = delivery?.customerReleaseReady !== false;
  const remaining = Number(invoice.total) - Number(invoice.amountPaid || 0);
  const amount = (value: unknown) => Number(value || 0).toLocaleString(displayLocale(language === 'ar' ? 'ar-SA' : 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Same brand-document engine as /print/invoice/:id (UX-180) · embed=1 hides
  // the print chrome, noprint=1 stops the auto print dialog from firing.
  const previewSrc = `/print/invoice/${invoice.id}?embed=1&noprint=1&lang=${language}`;
  return <FullPageForm title={t(`الفاتورة ${invoice.invoiceNumber}`, `Invoice ${invoice.invoiceNumber}`)}
    subtitle={<ContactProfileLink id={invoice.contactId || invoice.contact?.id} name={invoice.contact?.displayName} />} onClose={onClose}
    footer={<div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={onClose}>{t('رجوع', 'Back')}</Button>
      {onRemove && <Button variant="outline" onClick={onRemove}>{t('حذف / إلغاء', 'Delete / void')}</Button>}
      {canCorrect && !stripeManaged && invoice.status !== 'CANCELLED' && <Button variant="outline" onClick={() => navigate(`/app/credit-notes?correctInvoice=${encodeURIComponent(invoice.id)}`)}>{t('تصحيح الفاتورة', 'Correct invoice')}</Button>}
      {!stripeManaged && remaining > 0 && invoice.status !== 'CANCELLED' && <Button variant="outline" onClick={onPayment}>{t('تسجيل تحصيل', 'Record receipt')}</Button>}
      <Button disabled={!canRelease} onClick={() => window.open(`/print/invoice/${invoice.id}`, '_blank', 'noopener,noreferrer')}>{t('طباعة / تنزيل', 'Print / download')}</Button>
      {onSend && invoice.status !== 'CANCELLED' && <Button onClick={() => onSend()} className="bg-primary hover:bg-primary/90" data-testid="issued-invoice-send"><Mail className="me-2 h-4 w-4" strokeWidth={1.75} />{t('إرسال', 'Send')}</Button>}
    </div>}>
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 items-start w-full" dir="ltr" data-testid="invoice-workspace">
      <aside className="min-w-0 lg:sticky lg:top-4 space-y-3 order-2 lg:order-1" dir={language === 'ar' ? 'rtl' : 'ltr'} data-testid="invoice-document-column">
        <p className="text-xs text-muted-foreground">{t('النسخة المحفوظة · تتحدث بعد حفظ التعديل', 'Saved document · updates after saving changes')}</p>
        <div className="rounded-lg border border-border overflow-hidden" aria-label={t('معاينة الفاتورة', 'Invoice preview')}>
          <iframe title={t('معاينة الفاتورة', 'Invoice preview')} key={invoice.updatedAt} src={previewSrc} className="w-full block bg-card" style={{ height: 'min(78vh, 900px)', minHeight: 480, border: 0 }} />
        </div>
        <InvoiceDocuments invoiceId={invoice.id} />
      </aside>
      <div className="min-w-0 space-y-4 order-1 lg:order-2" dir={language === 'ar' ? 'rtl' : 'ltr'} data-testid="invoice-editor-column">
      <InvoiceAmendmentPanel key={`${invoice.id}:${invoice.updatedAt}`} invoice={invoice} onDone={onRefresh} initialAction={initialAction} />
      {remaining > 0 && invoice.status !== 'CANCELLED' && <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="font-semibold">{t('دفع العميل عبر الإنترنت', 'Customer online payment')}</h2>
        {(invoice as any).paymentLinkUrl ? <a className="text-primary underline" href={(invoice as any).paymentLinkUrl} target="_blank" rel="noopener noreferrer">{t('فتح رابط الدفع', 'Open payment link')} · {(invoice as any).paymentLinkProvider}</a> : <p className="text-sm text-muted-foreground">{t('لم يتم تجهيز رابط دفع لهذه الفاتورة بعد.', 'A payment link has not been prepared for this invoice yet.')}</p>}
        {!stripeManaged && <Button variant="outline" disabled={paymentBusy || !canRelease} onClick={preparePayment}>{paymentBusy ? t('جارٍ التحقق…', 'Checking…') : t('تجهيز / تحديث رابط الدفع', 'Prepare / refresh payment link')}</Button>}
        {paymentError && <p role="alert" className="text-sm text-warning">{paymentError}</p>}
      </section>}
      <InvoiceNotesPanel key={invoice.id} invoice={invoice} onDone={onRefresh} />
      {/* An issued invoice is locked for its MONEY, not for its bookkeeping —
          the account a line landed on can still be corrected (2026-09-21). */}
      {!stripeManaged && invoice.status !== 'CANCELLED' && !!accounts?.length && (
        <InvoiceReclassifyPanel invoice={invoice} accounts={accounts} onDone={onRefresh} />
      )}
      {isSA && <section className={`rounded-lg border p-4 space-y-3 ${accepted ? 'border-success-border bg-success-subtle/60' : 'border-warning-border bg-warning-subtle/60'}`}>
        <div className="flex justify-between items-center gap-3">
          <h2 className="font-semibold flex items-center gap-2">{accepted ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Clock3 className="h-5 w-5 text-warning" />}{accepted ? t('تم قبول الفاتورة لدى الهيئة', 'Invoice accepted by ZATCA') : t('متابعة إرسال الفاتورة للهيئة', 'ZATCA invoice delivery')}</h2>
          <Button variant="outline" size="sm" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}>{t('تحديث الحالة', 'Refresh status')}</Button>
        </div>
        <InvoiceZatcaBadge invoice={invoice} />
        {!accepted && delivery?.message && <p className="text-sm">{delivery.message}</p>}
        {evidence ? <>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><dt className="text-muted-foreground">{t('رد الهيئة', 'Authority HTTP response')}</dt><dd dir="ltr">{evidence.httpStatus ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">{t('محاولات الإرسال', 'Submission attempts')}</dt><dd>{displayDigits(evidence.attempts)}</dd></div>
            <div><dt className="text-muted-foreground">{t('الأخطاء', 'Errors')}</dt><dd>{Array.isArray(evidence.errors) ? displayDigits(evidence.errors.length) : '—'}</dd></div>
            <div><dt className="text-muted-foreground">{t('التحذيرات', 'Warnings')}</dt><dd>{Array.isArray(evidence.warnings) ? displayDigits(evidence.warnings.length) : '—'}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">{t('وقت رد الهيئة · الرياض: ', 'Authority response · Riyadh: ')}{new Date(evidence.updatedAt).toLocaleString(displayLocale(language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB'), { timeZone: 'Asia/Riyadh' })}</p>
          <p className="text-xs break-all"><span dir="ltr">UUID: {evidence.uuid}</span></p>
          {[...(evidence.errors || []), ...(evidence.warnings || [])].map((message, index) => <p key={index} className="text-sm">{message}</p>)}
        </> : <p className="text-sm">{delivery?.message || t('لم يُحفظ رد نهائي من الهيئة بعد. الاعتماد داخل Entix يختلف عن قبول الهيئة.', 'No final authority response is stored yet. Approval in Entix is separate from ZATCA acceptance.')}</p>}
      </section>}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground">{t('تاريخ الإصدار', 'Issue date')}</p><p dir="ltr">{displayDigits(invoice.issueDate?.slice(0, 10) || '')}</p></div>
          <div><p className="text-muted-foreground">{t('الإجمالي', 'Total')}</p><p><bdi dir="ltr">{amount(invoice.total)} {invoice.currency}</bdi></p></div>
          <div><p className="text-muted-foreground">{t('المحصّل', 'Collected')}</p><p><bdi dir="ltr">{amount(invoice.amountPaid)} {invoice.currency}</bdi></p></div>
          <div><p className="text-muted-foreground">{t('المستحق', 'Outstanding')}</p><p><bdi dir="ltr">{amount(remaining)} {invoice.currency}</bdi></p></div>
        </div>
        <Table className="text-sm text-start"><TableHeader><TableRow className="border-b border-border hover:bg-transparent">
          {[t('البند', 'Line item'), t('حساب الإيراد', 'Revenue account'), t('الكمية', 'Quantity'), t('السعر قبل الضريبة', 'Price before tax')].map(x => <TableHead key={x} className="text-start py-2 px-2">{x}</TableHead>)}
        </TableRow></TableHeader><TableBody>{(invoice.lines || []).map((line: any, index) => <TableRow key={line.id || index} className="border-b border-border/50">
          <TableCell className="p-2">{line.description}</TableCell><TableCell className="p-2">{line.account ? `${line.account.code} · ${language === 'ar' ? line.account.nameAr || line.account.name : line.account.name}` : t('غير مرتبط — يحتاج مراجعة محاسبية', 'Unmapped — accounting review required')}</TableCell><TableCell className="p-2">{displayDigits(Number(line.quantity))}</TableCell><TableCell className="p-2">{amount(line.unitPrice)}</TableCell>
        </TableRow>)}</TableBody></Table>
        {invoice.notes && <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>}
      </section>
      {!!(invoice as any).payments?.length && <section className="rounded-lg border border-border bg-card p-4 space-y-2"><h2 className="font-semibold">{t('الدفعات', 'Payments')}</h2>{(invoice as any).payments.map((p: any) => <div key={p.id} className="flex flex-wrap justify-between gap-2 text-sm"><bdi>{new Date(p.paidAt).toLocaleDateString(displayLocale('en-GB'))}</bdi><bdi>{amount(p.amount)} {p.currency}</bdi><span>{stripeManaged ? 'Stripe' : p.method}</span></div>)}</section>}
      <SendLogSection entityType="invoice" entityId={invoice.id} refreshKey={sendLogRefreshKey} onResend={(record) => onSend?.(record)} />
      </div>
    </div>
  </FullPageForm>;
}
