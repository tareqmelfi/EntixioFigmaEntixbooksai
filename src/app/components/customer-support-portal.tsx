import { useEffect, useState } from 'react';
import { api, type SupportTicket } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { InlineAlert } from './product';

export function CustomerSupportPortal() {
  const { t, language } = useLanguage();
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('support');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const labels: Record<string, string> = { OPEN: t('مفتوح', 'Open'), PENDING: t('قيد المتابعة', 'Pending'), RESOLVED: t('تم الحل', 'Resolved'), CLOSED: t('مغلق', 'Closed') };
  const refresh = async () => setItems((await api.support.list()).items);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const [list, detail] = await Promise.all([api.support.list(), selected ? api.support.get(selected) : Promise.resolve(null)]);
        if (alive) { setItems(list.items); setTicket(detail?.ticket || null); setError(''); }
      } catch { if (alive) setError(t('تعذر تحميل الدعم. أعد المحاولة.', 'Could not load support. Please retry.')); }
    };
    void poll(); const timer = setInterval(() => { if (!document.hidden) void poll(); }, 12000);
    return () => { alive = false; clearInterval(timer); };
  }, [selected, language]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !body.trim()) return;
    setBusy(true); setError('');
    try {
      if (creating) {
        const result = await api.support.create({ subject, body, category, language });
        setSelected(result.ticket.id); setCreating(false); setSubject('');
      } else if (selected) {
        await api.support.reply(selected, body); setTicket((await api.support.get(selected)).ticket);
      }
      setBody(''); await refresh();
    } catch { setError(t('تعذر الإرسال. رسالتك محفوظة هنا؛ أعد المحاولة.', 'Could not send. Your message is still here; please retry.')); }
    finally { setBusy(false); }
  };
  const status = async () => {
    if (!ticket || busy) return; setBusy(true);
    try { await api.support.status(ticket.id, ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'OPEN' : 'RESOLVED'); setTicket((await api.support.get(ticket.id)).ticket); await refresh(); }
    catch { setError(t('تعذر تحديث الطلب', 'Could not update request')); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4" aria-label={t('طلبات الدعم والمحادثات', 'Support requests and conversations')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">{t('محادثاتي مع فريق الدعم', 'My conversations with support')}</h2><p className="text-sm text-muted-foreground">{t('طلبات محفوظة وردود الفريق تظهر هنا تلقائيًا. متاح لجميع الباقات.', 'Saved requests with team replies updated here automatically. Available on every plan.')}</p></div>
      <Button onClick={() => { setCreating(true); setSelected(null); setTicket(null); setBody(''); }}>{t('محادثة جديدة', 'New conversation')}</Button>
    </div>
    {error && <InlineAlert tone="critical">{error}</InlineAlert>}
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <nav className="max-h-[540px] overflow-y-auto rounded-xl border border-border bg-card p-2" aria-label={t('طلباتي', 'My requests')}>
        {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t('لا توجد طلبات بعد', 'No requests yet')}</p>}
        {items.map(item => <button key={item.id} onClick={() => { setSelected(item.id); setTicket(null); setCreating(false); setBody(''); }} className={`mb-1 w-full rounded-lg p-3 text-start ${selected === item.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
          <span className="block break-words text-sm font-semibold">{item.subject}</span><span className="text-xs text-muted-foreground">{labels[item.status] || item.status} · {new Date(item.updatedAt).toLocaleDateString(language === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-US')}</span>
        </button>)}
      </nav>
      <div className="min-w-0 rounded-xl border border-border bg-card p-4">
        {creating ? <form onSubmit={send} className="space-y-4">
          <label className="block text-sm">{t('عنوان الطلب', 'Subject')}<input required maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-3" /></label>
          <label className="block text-sm">{t('الموضوع', 'Category')}<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-3"><option value="support">{t('مساعدة في الاستخدام', 'Help using Entix')}</option><option value="bug">{t('بلاغ عن مشكلة', 'Report a problem')}</option><option value="billing">{t('الفواتير والاشتراك', 'Billing and subscription')}</option><option value="open_question">{t('اقتراح', 'Suggestion')}</option></select></label>
          <label className="block text-sm">{t('كيف نقدر نساعدك؟', 'How can we help?')}<textarea required maxLength={10000} rows={5} value={body} onChange={e => setBody(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-3" /></label>
          <p className="text-xs text-muted-foreground">{t('اذكر رقم المستند والخطوات. لا ترسل كلمات مرور أو مفاتيح API.', 'Include the document number and steps. Do not send passwords or API keys.')}</p>
          <Button disabled={busy || !body.trim() || !subject.trim()}>{busy ? t('جارٍ الإرسال…', 'Sending…') : t('إرسال للدعم', 'Send to support')}</Button>
        </form> : ticket ? <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{ticket.subject}</h3><Button size="sm" variant="outline" disabled={busy} onClick={status}>{ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? t('إعادة فتح', 'Reopen') : t('تم حل المشكلة', 'Mark resolved')}</Button></div>
          <div className="max-h-[440px] space-y-3 overflow-y-auto" role="log" aria-live="polite">
            {ticket.messages?.map(m => <div key={m.id} className={`rounded-lg p-3 ${m.authorType === 'CUSTOMER' ? 'bg-muted' : 'border border-primary/20 bg-primary/5'}`}><p className="mb-1 text-xs text-muted-foreground">{m.authorType === 'CUSTOMER' ? t('أنت', 'You') : m.authorType === 'ADMIN' ? t('فريق الدعم', 'Support team') : t('مساعد الدعم', 'Support assistant')} · {new Date(m.createdAt).toLocaleString(language === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-US')}</p><p className="whitespace-pre-wrap break-words text-sm" dir="auto">{m.body}</p></div>)}
          </div>
          <form onSubmit={send} className="mt-4 flex items-end gap-2"><textarea aria-label={t('رسالتك', 'Your message')} required rows={2} maxLength={10000} value={body} onChange={e => setBody(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background p-3" /><Button disabled={busy || !body.trim()}>{t('إرسال', 'Send')}</Button></form>
        </> : <p className="py-16 text-center text-muted-foreground">{t('اختر طلبًا أو ابدأ محادثة مع فريق الدعم.', 'Choose a request or start a conversation with support.')}</p>}
      </div>
    </div>
  </section>;
}
