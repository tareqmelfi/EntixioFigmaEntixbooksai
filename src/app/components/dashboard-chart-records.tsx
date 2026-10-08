import { Link } from 'react-router';
import { useLanguage } from './LanguageContext';
/** Keyboard/touch alternative to selecting a small chart mark. */
export function DashboardChartRecords({rows}:{rows:Array<{label:string;href:string;value:string}>}) {
  const {t}=useLanguage();
  if (!rows.length) return null;
  return <details className="text-xs"><summary className="cursor-pointer text-primary focus-visible:outline-2 focus-visible:outline-ring">{t('عرض سجلات الرسم','View chart records')}</summary><ul className="mt-2 grid max-h-60 gap-1 overflow-y-auto sm:grid-cols-2">{rows.map((row,i)=><li key={`${row.href}:${i}`}><Link to={row.href} className="flex justify-between gap-3 rounded px-2 py-2 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring"><span>{row.label}</span><bdi>{row.value}</bdi></Link></li>)}</ul></details>;
}
