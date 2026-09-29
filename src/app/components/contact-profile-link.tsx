import { Link } from 'react-router';
import { useLanguage } from './LanguageContext';

/** Only the party name navigates to contacts; row actions remain document actions. */
export function ContactProfileLink({ id, name, className = '' }: { id?: string | null; name?: string | null; className?: string }) {
  const { t } = useLanguage();
  const label = name || t('فتح جهة الاتصال', 'Open contact profile');
  if (!id) return <bdi className={className}>{name || '—'}</bdi>;
  return <Link to={`/app/contacts/${encodeURIComponent(id)}`} title={t('فتح ملف جهة الاتصال', 'Open contact profile')}
    className={`text-primary font-semibold underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline focus-visible:outline-2 ${className}`}
    onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}><bdi>{label}</bdi></Link>;
}
