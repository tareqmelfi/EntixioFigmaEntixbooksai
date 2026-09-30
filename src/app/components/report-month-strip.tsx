import { useState, type ReactNode } from 'react';
import { useLanguage } from './LanguageContext';
export function ReportMonthStrip({ from, to, onChange, actions }: { from: string; to: string; actions?: ReactNode; onChange: (from: string, to: string) => void }) {
  const { t, language } = useLanguage();
  const [year, setYear] = useState(Number(to.slice(0,4)) || new Date().getFullYear());
  const [anchor, setAnchor] = useState<string | null>(null);
  const end = (key: string) => new Date(Date.UTC(Number(key.slice(0,4)), Number(key.slice(5,7)), 0)).toISOString().slice(0,10);
  return <div className="space-y-2 rounded-lg border border-border bg-card p-2" data-testid="report-month-strip">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" className="rounded border px-2 py-1" onClick={() => setYear(y => y - 1)} aria-label={t('السنة السابقة','Previous year')}>−</button><b>{year}</b><button type="button" className="rounded border px-2 py-1" onClick={() => setYear(y => y + 1)} aria-label={t('السنة التالية','Next year')}>+</button>
      <button type="button" className="rounded border px-2 py-1" onClick={() => {setAnchor(null);onChange(`${year}-01-01`,`${year}-12-31`);}}>{t('السنة كاملة','Full year')}</button>
      {actions}<span className="text-muted-foreground">{anchor ? t('اختر شهر النهاية، أو الشهر نفسه لفترة شهر واحد','Choose the last month, or the same month for a single month') : t('اختر شهر البداية ثم النهاية؛ يمكنك التنقل بين السنوات','Choose the first and last month; you can move between years')}</span>
    </div>
    <div className="flex gap-1 overflow-x-auto pb-1">{Array.from({length:12},(_,i) => {
      const key = `${year}-${String(i+1).padStart(2,'0')}`;
      const selected = key >= from.slice(0,7) && key <= to.slice(0,7);
      return <button type="button" key={key} data-month={key} aria-pressed={anchor === key || selected} className={`min-w-16 flex-1 rounded px-2 py-2 text-xs ${anchor === key ? 'bg-primary text-white' : selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`} onClick={() => {
        if (!anchor) {setAnchor(key);return;}
        const [a,b] = [anchor,key].sort(); setAnchor(null);onChange(`${a}-01`,end(b));
      }}>{new Date(Date.UTC(year,i,1)).toLocaleDateString(language==='ar'?'ar-SA':'en-US',{month:'short',calendar:'gregory',timeZone:'UTC'})}</button>;
    })}</div>
  </div>;
}
