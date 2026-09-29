import { ContactProfileLink } from './contact-profile-link';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowUpRight, FileSpreadsheet, Plus, RefreshCw, Search } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useIsMobile } from './ui/use-mobile';
import { PageHeader, StatusBadge } from './product';
import { displayLocale } from '../lib/number-display';
import { localDateKey, QUOTE_STAGES, quoteDays, quoteStage, summarizeQuotes, type QuoteOverview, type QuoteStage } from '../lib/quote-overview';

const names: Record<QuoteStage, [string,string]> = {
  DRAFT: ['مسودات','Drafts'], SENT: ['بانتظار الرد','Awaiting reply'], VIEWED: ['شاهدها العميل','Viewed'],
  ACCEPTED: ['مقبولة · بانتظار الفوترة','Accepted · to invoice'], CONVERTED: ['محوّلة لفاتورة','Invoiced'],
  REJECTED: ['مرفوضة','Declined'], EXPIRED: ['منتهية الصلاحية','Expired'],
};
const tones = { DRAFT: 'neutral', SENT: 'warning', VIEWED: 'info', ACCEPTED: 'warning', CONVERTED: 'success', REJECTED: 'critical', EXPIRED: 'critical' } as const;
type QuoteFilter = QuoteStage | 'ALL' | 'PROJECT' | 'WAITING';
const amount = (n: number | string) => Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function QuotesDashboard({ items, loading, error, onRefresh, onNew, onImport }: {
  items: QuoteOverview[]; loading: boolean; error: string | null; onRefresh: () => void; onNew: () => void; onImport: () => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const today = localDateKey();
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<QuoteFilter>('ALL');
  const [client, setClient] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [visible, setVisible] = useState(25);
  const invalidRange = !!(from && to && from > to);
  const period = useMemo(() => items.filter(q => (!from || q.issueDate.slice(0,10) >= from) && (!to || q.issueDate.slice(0,10) <= to)), [items, from, to]);
  const summary = useMemo(() => summarizeQuotes(period, today), [period, today]);
  const matchesStage = (q: QuoteOverview, filter: QuoteFilter) => filter === 'ALL' || (filter === 'WAITING' ? ['SENT','VIEWED'].includes(quoteStage(q,today)) : filter === 'PROJECT' ? !!(q.projectId || q.projects?.length) : quoteStage(q,today) === filter);
  const shown = period.filter(q => {
    const text = `${q.quoteNumber} ${q.title || ''} ${q.contact?.displayName || ''} ${(q.projects || []).map(p => `${p.code} ${p.name}`).join(' ')}`.toLocaleLowerCase();
    return (!query || text.includes(query.trim().toLocaleLowerCase())) && (!client || q.contactId === client)
      && matchesStage(q, stage);
  });
  const pick = (value: typeof stage) => { setStage(value); setVisible(25); };
  const groups = [
    { key: 'open', title: t('العروض والمتابعة','Quotes & follow-up'), rows: shown.filter(q => !['ACCEPTED','CONVERTED'].includes(quoteStage(q,today))) },
    { key: 'accepted', title: t('عروض مقبولة · بانتظار الفوترة','Accepted quotes · awaiting invoicing'), rows: shown.filter(q => quoteStage(q,today) === 'ACCEPTED') },
    { key: 'converted', title: t('العروض المحوّلة إلى فواتير','Quotes converted to invoices'), rows: shown.filter(q => quoteStage(q,today) === 'CONVERTED') },
  ];
  const changePeriod = (setter: (v: string) => void, value: string) => { setter(value); setVisible(25); };
  const dateCell = (q: QuoteOverview) => {
    const s = quoteStage(q, today);
    const days = quoteDays(q.validUntil || today, today);
    return <span className={`inline-flex flex-col gap-1 text-xs ${s === 'EXPIRED' ? 'text-danger' : s === 'ACCEPTED' ? 'text-warning' : 'text-muted-foreground'}`} data-testid={`quote-date-${q.id}`}>
      <time dateTime={q.validUntil?.slice(0,10)} dir="ltr" className="tabular-nums">{q.validUntil?.slice(0,10) || '—'}</time>
      {s === 'EXPIRED' && <span>{days ? t(`منتهي منذ ${days} يوم`, `Expired ${days} days ago`) : t('منتهي','Expired')}</span>}
      {s === 'ACCEPTED' && <span>{t('مقبول · لم يُفوتر','Accepted · not invoiced')}</span>}
    </span>;
  };
  const links = (q: QuoteOverview) => <div className="flex flex-col gap-1 text-xs">
    {(q.projects || []).map(p => <Link key={p.id} to={`/app/projects/${p.id}`} className="text-primary hover:underline" title={p.name}>
      <bdi>{p.code} · {p.name}</bdi>
      <span className="block text-muted-foreground">{p.status === 'COMPLETED' ? t('مكتمل','Completed') : p.status === 'CANCELLED' ? t('ملغى','Cancelled') : p.status === 'ON_HOLD' ? t('متوقف','On hold') : t('نشط','Active')} · {t('الإنجاز','Progress')} {p.percentComplete == null ? '—' : `${Number(p.percentComplete)}%`}</span>
      {p.endDate && <span className={`block ${p.endDate.slice(0,10) < today && !['COMPLETED','CANCELLED'].includes(p.status) ? 'text-danger' : 'text-muted-foreground'}`}>{t('النهاية','Ends')} {p.endDate.slice(0,10)}</span>}
    </Link>)}
    {!q.projects?.length && q.projectId && <Link to={`/app/projects/${q.projectId}`} className="text-primary hover:underline">{t('فتح المشروع','Open project')}</Link>}
    {q.convertedInvoiceId && <Link to={`/app/invoices/${q.convertedInvoiceId}`} className="text-primary hover:underline"><bdi>{q.convertedInvoice?.invoiceNumber || t('فتح الفاتورة','Open invoice')}</bdi>{q.convertedInvoice?.status === 'CANCELLED' && <span className="ms-1 text-danger">{t('ملغاة','Voided')}</span>}</Link>}
    {!q.projectId && !q.projects?.length && !q.convertedInvoiceId && <span className="text-muted-foreground">—</span>}
  </div>;
  return <div className="space-y-5" data-testid="quotes-dashboard">
    <PageHeader className="flex-col sm:flex-row [&>div:first-child]:w-full sm:[&>div:first-child]:w-auto" eyebrow={t('المبيعات','Sales')} title={t('عروض الأسعار','Quotes')} description={t('من العرض إلى الموافقة والمشروع والفاتورة — متابعة واحدة واضحة.','From proposal to approval, project and invoice — one clear view.')} actions={<>
      <Button variant="outline" onClick={onImport}><FileSpreadsheet className="me-2 h-4 w-4" />{t('استيراد BOQ','Import BOQ')}</Button>
      <Button onClick={onNew}><Plus className="me-2 h-4 w-4" />{t('عرض سعر جديد','New quote')}</Button>
    </>} />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">{t('تاريخ إصدار العرض · من','Quote issue date · from')}<Input type="date" value={from} onChange={e=>changePeriod(setFrom,e.target.value)} className="block w-40" /></label>
        <label className="space-y-1 text-xs text-muted-foreground">{t('إلى','To')}<Input type="date" value={to} onChange={e=>changePeriod(setTo,e.target.value)} className="block w-40" /></label>
        {(from || to) && <Button variant="ghost" onClick={()=>{setFrom('');setTo('');}}>{t('كل الفترات','All time')}</Button>}
      </div>
      <Button variant="ghost" onClick={onRefresh} disabled={loading}><RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('تحديث','Refresh')}</Button>
    </div>
    {error ? <div role="alert" className="rounded-lg border border-danger-border p-5 text-danger">{t('تعذر تحميل جميع العروض؛ لم تُحسب مؤشرات جزئية. أعد المحاولة.','Could not load all quotes; partial metrics are not shown. Please retry.')}<Button variant="outline" className="ms-3" onClick={onRefresh}>{t('إعادة المحاولة','Retry')}</Button></div>
      : loading ? <div role="status" className="py-16 text-center text-muted-foreground">{t('جارٍ تحميل العروض وروابط المشاريع…','Loading quotes and project links…')}</div>
      : invalidRange ? <p role="alert" className="text-danger">{t('تاريخ البداية يجب أن يسبق النهاية.','The start date must be before the end date.')}</p>
      : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {([
            ['ALL',t('كل العروض','All quotes'),'text-foreground','bg-card'],
            ['WAITING',t('بانتظار الرد','Awaiting reply'),'text-primary','bg-primary/5'],
            ['ACCEPTED',t('مقبولة ولم تُفوتر','Accepted, not invoiced'),'text-warning','bg-warning/5'],
            ['CONVERTED',t('محوّلة لفاتورة','Invoiced'),'text-success','bg-success/5'],
            ['EXPIRED',t('منتهية الصلاحية','Expired'),'text-danger','bg-danger/5'],
            ['PROJECT',t('مرتبطة بمشاريع','Linked to projects'),'text-primary','bg-primary/5'],
          ] as const).map(([key,label,color,background])=> {
            const metric = summarizeQuotes(period.filter(q=>matchesStage(q,key)),today);
            const count = Object.values(metric.counts).reduce((total,n)=>total+n,0);
            return <button key={key} type="button" onClick={()=>pick(key)} aria-pressed={stage===key} className={`flex min-w-0 flex-col rounded-xl border p-4 text-start transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary ${background} ${stage===key ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`} data-testid={`quote-metric-${key}`}>
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <span className={`mt-2 font-display text-3xl tabular-nums ${color}`} data-testid={`quote-count-${key}`}>{count}</span>
              <span className="mt-2 block w-full border-t border-border/60 pt-2 text-sm font-medium tabular-nums" data-testid={key==='ALL' ? 'quote-currency-totals' : `quote-total-${key}`}>
                <span className="mb-1 block text-xs font-normal text-muted-foreground">{t('إجمالي المبلغ','Total amount')}</span>
                {Object.entries(metric.currencies).map(([cur,n])=><span key={cur} className="block"><bdi>{amount(n)} <span className="text-xs font-normal text-muted-foreground">{cur}</span></bdi></span>)}
                {!count && <span>{amount(0)}</span>}
              </span>
            </button>;
          })}
        </div>
        {(summary.accepted.length > 0 || summary.rejected.length > 0 || summary.overdue.length > 0) && <details className="rounded-lg border border-border" data-testid="quote-customer-insights">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium" data-testid="quote-insights-toggle">{t('تفاصيل العملاء والمتابعة','Customer insights & follow-up')}{summary.acceptanceRate != null && <span className="ms-3 text-xs font-normal text-muted-foreground">{t('نسبة القبول','Acceptance rate')} {summary.acceptanceRate}%</span>}</summary>
        <div className="grid gap-3 px-3 pb-3 lg:grid-cols-3">
          {([
            ['accepted',t('الأكثر قبولًا','Most acceptances'),t('عدد العروض المقبولة والمحوّلة','Accepted and invoiced quote count')],
            ['rejected',t('الأكثر رفضًا','Most declines'),t('حسب الرفض المسجّل، لا انتهاء الصلاحية','Recorded declines, not expired quotes')],
            ['overdue',t('عملاء يحتاجون متابعة','Customers to follow up'),t('عروض منتهية دون رد؛ لا تشمل المسودات','Expired without a response; excludes drafts')],
          ] as const).filter(([key])=>summary[key].length > 0).map(([key,title,hint])=><section key={key} className="rounded-xl border border-border bg-card p-4" data-testid={`quote-clients-${key}`}>
            <h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            <ol className="mt-3 divide-y divide-border">{summary[key].map(c=><li key={c.id}><button type="button" className="flex w-full items-center justify-between gap-3 py-3 text-start text-sm hover:text-primary" onClick={()=>{setClient(c.id);pick(key==='rejected'?'REJECTED':key==='overdue'?'EXPIRED':'ALL');}}><bdi className="min-w-0 break-words">{c.name}</bdi><span className="shrink-0 text-xs tabular-nums">{c[key]} {key==='overdue' ? t(`· الأقدم ${c.oldestDays} يوم`,`· oldest ${c.oldestDays}d`) : t('عرض','quotes')}</span></button></li>)}</ol>
            {!summary[key].length && <p className="py-5 text-sm text-muted-foreground">{t('لا توجد بيانات لهذه الحالة','No records in this category')}</p>}
          </section>)}
        </div>
        </details>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">{t('سجل العروض','Quote register')} <span className="text-muted-foreground">({shown.length})</span></h2><p className="mt-1 text-xs text-muted-foreground">{t('المبالغ تشمل الضريبة؛ كل عملة مستقلة. اضغط بطاقة لتصفية العروض.','Totals include tax, with each currency separate. Select a card to filter quotes.')}</p></div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label><span className="sr-only">{t('حالة العرض','Quote stage')}</span><select value={stage} onChange={e=>pick(e.target.value as QuoteFilter)} className="h-10 max-w-full rounded-md border border-border bg-card px-3 text-sm">
              <option value="ALL">{t('كل الحالات','All stages')}</option>
              <option value="WAITING">{t('بانتظار الرد','Awaiting reply')}</option>
              {QUOTE_STAGES.map(s=><option key={s} value={s}>{t(...names[s])}</option>)}
              <option value="PROJECT">{t('مرتبطة بمشروع','Linked to a project')}</option>
            </select></label>
          <label className="relative w-full sm:w-72"><span className="sr-only">{t('ابحث في العروض','Search quotes')}</span><Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={e=>{setQuery(e.target.value);setVisible(25);}} placeholder={t('رقم العرض، العميل أو المشروع','Quote number, customer or project')} className="ps-9" /></label>
          </div>
        </div>
        {(stage!=='ALL' || client || query) && <div className="flex flex-wrap items-center gap-3 text-xs"><span>{t('التصفية الحالية:','Current filter:')} {stage==='ALL'?t('كل الحالات','All stages'):stage==='PROJECT'?t('مرتبطة بمشروع','Linked to a project'):stage==='WAITING'?t('بانتظار الرد','Awaiting reply'):t(...names[stage])}{client ? ` · ${period.find(q=>q.contactId===client)?.contact?.displayName || '—'}`:''}</span><Button variant="outline" size="sm" onClick={()=>{pick('ALL');setClient('');setQuery('');}}>{t('مسح التصفية','Clear filters')}</Button></div>}
        {!shown.length && <div className="rounded-xl border border-dashed border-border py-12 text-center"><h3 className="font-semibold">{items.length ? t('لا توجد عروض تطابق التصفية','No matching quotes') : t('ابدأ بأول عرض سعر','Create your first quote')}</h3><p className="mt-2 text-sm text-muted-foreground">{items.length ? t('غيّر الفترة أو امسح التصفية.','Change the period or clear filters.') : t('ستظهر المؤشرات تلقائيًا مع إرسال العروض وتسجيل قرارات العملاء.','Insights appear as quotes are sent and customer decisions are recorded.')}</p></div>}
        {groups.filter(g=>g.rows.length).map(g=><section key={g.key} className="space-y-3" data-testid={`quote-group-${g.key}`}>
          <h3 className="flex items-center gap-2 font-semibold">{g.title}<span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{g.rows.length}</span></h3>
          {mobile ? <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {g.rows.slice(0,visible).map(q=><li key={q.id} className="space-y-3 p-4" data-testid={`quote-row-${q.id}`}>
              <Link to={`/app/quotes/${q.id}`} className="block space-y-1">
                <span className="flex items-start justify-between gap-3"><bdi className="break-all font-code font-semibold text-primary">{q.quoteNumber}</bdi><ArrowUpRight className="h-4 w-4 shrink-0 text-primary" /></span>
                {q.title && <bdi className="block text-xs text-muted-foreground">{q.title}</bdi>}
              </Link>
              <ContactProfileLink id={q.contactId} name={q.contact?.displayName} className="block text-sm" />
              <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge tone={tones[quoteStage(q,today)]}>{t(...names[quoteStage(q,today)])}</StatusBadge><span dir="ltr" className="text-sm tabular-nums">{amount(q.total)} {q.currency}</span></div>
              <div className="flex justify-between gap-3 text-xs"><div><span className="mb-1 block text-muted-foreground">{t('الإصدار','Issued')}</span><time dir="ltr">{q.issueDate.slice(0,10)}</time></div><div><span className="mb-1 block text-muted-foreground">{t('صالح حتى','Valid until')}</span>{dateCell(q)}</div></div>
              {(q.projects?.length || q.projectId || q.convertedInvoiceId) ? <div className="border-t border-border pt-3">{links(q)}</div> : null}
            </li>)}
          </ul> : <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[850px] text-start text-sm" aria-label={g.title}>
              <thead className="bg-surface-subtle text-xs text-muted-foreground"><tr>{[t('العرض / المشروع','Quote / scope'),t('العميل','Customer'),t('الإصدار','Issued'),t('صالح حتى','Valid until'),t('الإجمالي','Total'),t('الحالة','Stage'),t('المشروع والفاتورة','Project & invoice')].map(h=><th key={h} className="px-4 py-3 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{g.rows.slice(0,visible).map(q=><tr key={q.id} className="cursor-pointer bg-card align-top hover:bg-surface-subtle" data-testid={`quote-row-${q.id}`} onClick={e=>{ if (!(e.target as HTMLElement).closest('a,button') && !window.getSelection()?.toString()) navigate(`/app/quotes/${q.id}`); }}>
                <td className="max-w-64 px-4 py-4"><Link to={`/app/quotes/${q.id}`} className="group block text-primary hover:underline"><span className="flex items-center gap-2"><bdi className="min-w-0 break-all font-code font-semibold">{q.quoteNumber}</bdi><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></span><span className="mt-1 block break-words text-xs text-muted-foreground">{q.title || t('فتح عرض السعر','Open quote')}</span></Link></td>
                <td className="max-w-48 px-4 py-4"><ContactProfileLink id={q.contactId} name={q.contact?.displayName} /></td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground"><time dir="ltr">{q.issueDate.slice(0,10)}</time></td>
                <td className="px-4 py-4">{dateCell(q)}</td>
                <td className="whitespace-nowrap px-4 py-4"><span dir="ltr" className="inline-block tabular-nums">{amount(q.total)} <span className="text-xs text-muted-foreground">{q.currency}</span></span></td>
                <td className="px-4 py-4"><StatusBadge tone={tones[quoteStage(q,today)]}>{t(...names[quoteStage(q,today)])}</StatusBadge></td>
                <td className="min-w-40 max-w-64 px-4 py-4">{links(q)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
          {g.rows.length>visible && <Button variant="outline" onClick={()=>setVisible(n=>n+25)}>{t('عرض المزيد','Show more')} ({g.rows.length-visible})</Button>}
        </section>)}
      </>}
  </div>;
}
