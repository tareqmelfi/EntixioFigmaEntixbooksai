import { InvoiceDocuments } from './invoice-documents';
import { displayLocale, displayDigits } from "../lib/number-display";
import { useState } from 'react';
import type { DocumentSendRecord, Invoice } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { FullPageForm } from './full-page-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SendLogSection } from './send-log-section';
import { LockKeyhole, CheckCircle2, Clock3, Mail } from 'lucide-react';

/** Issued document view: never mounts editable invoice controls. */
export function IssuedInvoiceRecord({ invoice, onClose, onRefresh, onPayment, onSend, sendLogRefreshKey }: {
  invoice: Invoice; onClose: () => void; onRefresh: () => Promise<void>; onPayment: () => void;
  /** «إرسال» — opens the compose page (never fires an email directly, UX-1).
   *  Pass a past DocumentSendRecord to prefill the page from «إعادة الإرسال». */
  onSend?: (prefill?: DocumentSendRecord) => void;
  sendLogRefreshKey?: number;
}) {
  const { t, language } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const stripeManaged = (invoice as any).paymentLinkProvider === 'stripe-subscription';
  const delivery = invoice.zatcaDelivery;
  const evidence = delivery?.evidence;
  const accepted = !!evidence && ['REPORTED', 'CLEARED'].includes(evidence.state);
  const canRelease = delivery?.customerReleaseReady !== false;
  const remaining = Number(invoice.total) - Number(invoice.amountPaid || 0);
  const amount = (value: unknown) => Number(value || 0).toLocaleString(displayLocale(language === 'ar' ? 'ar-SA' : 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Same brand-document engine as /print/invoice/:id (UX-180) · embed=1 hides
  // the print chrome, noprint=1 stops the auto print dialog from firing.
  const previewSrc = `/print/invoice/${invoice.id}?embed=1&noprint=1&lang=${language}`;
  return <FullPageForm title={t(`الفاتورة ${invoice.invoiceNumber}`, `Invoice ${invoice.invoiceNumber}`)}
    subtitle={invoice.contact?.displayName || ''} onClose={onClose}
    footer={<div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={onClose}>{t('رجوع', 'Back')}</Button>
      {!stripeManaged && remaining > 0 && invoice.status !== 'CANCELLED' && <Button variant="outline" onClick={onPayment}>{t('تسجيل تحصيل', 'Record receipt')}</Button>}
      <Button disabled={!canRelease} onClick={() => window.open(`/print/invoice/${invoice.id}`, '_blank', 'noopener,noreferrer')}>{t('طباعة / تنزيل', 'Print / download')}</Button>
      {onSend && invoice.status !== 'CANCELLED' && <Button onClick={() => onSend()} className="bg-primary hover:bg-primary/90" data-testid="issued-invoice-send"><Mail className="me-2 h-4 w-4" strokeWidth={1.75} />{t('إرسال', 'Send')}</Button>}
    </div>}>
    <div className="space-y-4 w-full">
      <div className="rounded-lg border border-border bg-muted/40 p-4 flex gap-3">
        <LockKeyhole className="h-5 w-5 shrink-0 text-primary" />
        <div><p className="font-semibold">{t('فاتورة صادرة ومقفلة', 'Issued invoice · locked')}</p>
          <p className="text-sm text-muted-foreground mt-1">{stripeManaged ? t('الفاتورة والدفعات متزامنة مع أصل Stripe. يمكنك إضافة المستندات الداعمة أدناه.', 'Invoice and payments are synced from Stripe. Supporting documents can be attached below.') : t('لا يمكن تعديلها أو حذفها أو إرجاعها لمسودة. التصحيح بإشعار دائن أو مدين مرتبط بالفاتورة الأصلية. يمكنك تسجيل التحصيل بشكل مستقل.', 'This invoice cannot be edited, deleted or returned to draft. Corrections require a credit/debit note linked to the original. Receipts can be recorded separately.')}</p></div>
      </div>
      {(delivery?.state || invoice.zatcaStatus) && <section className={`rounded-lg border p-4 space-y-3 ${accepted ? 'border-success-border bg-success-subtle/60' : 'border-warning-border bg-warning-subtle/60'}`}>
        <div className="flex justify-between items-center gap-3">
          <h2 className="font-semibold flex items-center gap-2">{accepted ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Clock3 className="h-5 w-5 text-warning" />}{accepted ? t('تم قبول الفاتورة لدى الهيئة', 'Invoice accepted by ZATCA') : t('متابعة إرسال الفاتورة للهيئة', 'ZATCA invoice delivery')}</h2>
          <Button variant="outline" size="sm" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}>{t('تحديث الحالة', 'Refresh status')}</Button>
        </div>
        <p className="text-sm"><span dir="ltr" className="font-english">{delivery?.state || invoice.zatcaStatus}</span>{evidence?.mode && ` · ${evidence.mode === 'production' ? t('بيئة الإنتاج', 'Production') : evidence.mode}`}</p>
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
      {/* Document preview (real brand-document engine) beside attachments — split view, never stacked below the document */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start min-w-0">
        <div className="min-w-0 rounded-lg border border-border bg-surface-subtle overflow-hidden" aria-label={t('معاينة الفاتورة', 'Invoice preview')}>
          <iframe
            title={t('معاينة الفاتورة', 'Invoice preview')}
            src={previewSrc}
            className="w-full block bg-card"
            style={{ height: 'min(78vh, 900px)', minHeight: 480, border: 0 }}
          />
        </div>
        <div className="min-w-0">
          <InvoiceDocuments invoiceId={invoice.id} />
        </div>
      </section>
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
  </FullPageForm>;
}
