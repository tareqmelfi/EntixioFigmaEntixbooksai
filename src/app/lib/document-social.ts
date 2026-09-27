/** Pure shared print footer: no external assets; links survive native PDF printing. */
export type SocialFooterSettings = {
  pages: 'last' | 'first' | 'all' | 'none';
  size: 'small' | 'medium' | 'large';
  align: 'start' | 'center' | 'end';
};
export function socialFooterSettings(raw: any): SocialFooterSettings {
  return {
    pages: ['last', 'first', 'all', 'none'].includes(raw?.pages) ? raw.pages : 'last',
    size: ['small', 'medium', 'large'].includes(raw?.size) ? raw.size : 'small',
    align: ['start', 'center', 'end'].includes(raw?.align) ? raw.align : 'center',
  };
}
export function socialFooterOnPage(settings: SocialFooterSettings, page: number, total: number) {
  return settings.pages === 'all' || (settings.pages === 'first' && page === 1) || (settings.pages === 'last' && page === total);
}
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const names: Record<string, [string, string]> = {
  instagram: ['إنستغرام', 'Instagram'], x: ['إكس', 'X'], linkedin: ['لينكدإن', 'LinkedIn'],
  tiktok: ['تيك توك', 'TikTok'], facebook: ['فيسبوك', 'Facebook'], youtube: ['يوتيوب', 'YouTube'],
  snapchat: ['سناب شات', 'Snapchat'], whatsapp: ['واتساب', 'WhatsApp'], other: ['الموقع', 'Website'],
};
const icons: Record<string, string> = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7" fill="currentColor"/>',
  x: '<path d="m4 3 16 18h-5L4 3h5l11 18M20 3 4 21"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7M11 17v-7m0 3c0-4 6-4 6 0v4"/><circle cx="7" cy="7" r=".6" fill="currentColor"/>',
  tiktok: '<path d="M14 3v12a4 4 0 1 1-4-4m4-8c1 4 3 5 6 5"/>',
  facebook: '<path d="M15 21V13h3l1-4h-4V7c0-1 1-2 2-2h2V2h-3c-4 0-5 2-5 5v2H8v4h3v8"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 6 3-6 3z"/>',
  whatsapp: '<path d="M20 12a8 8 0 0 1-12 7l-5 2 2-5a8 8 0 1 1 15-4Z"/><path d="m8 7-1 2c1 4 4 7 8 8l2-2-3-2-1 1c-2-1-3-2-3-3l1-1Z"/>',
  snapchat: '<path d="M7 10V7a5 5 0 0 1 10 0v3l3-1-2 3c0 3 2 4 4 5l-4 1-1 2-3-1-2 2-2-2-3 1-1-2-4-1c2-1 4-2 4-5L4 9Z"/>',
  other: '<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
};
export function socialFooterHtml(raw: unknown, options?: unknown, lang = 'ar'): string {
  const settings = socialFooterSettings(options);
  if (!Array.isArray(raw) || settings.pages === 'none') return '';
  const font = { small: 8, medium: 9, large: 10 }[settings.size];
  const links = raw.slice(0, 10).flatMap(link => {
    if (!link || typeof link.url !== 'string') return [];
    const value = link.url.trim();
    if (!value || (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))) return [];
    let url: URL;
    try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`); } catch { return []; }
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return [];
    const platform = typeof link.platform === 'string' ? link.platform : 'other';
    const label = typeof link.label === 'string' && link.label.trim() ? link.label.trim().slice(0, 40) : (names[platform] || names.other)[lang === 'ar' ? 0 : 1];
    return [`<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer" title="${escape(url.href)}" style="display:inline-flex;align-items:center;gap:1.4mm;color:inherit;text-decoration:none;font:inherit;line-height:1.5;max-width:calc(25% - 4mm);min-width:0;padding:.5mm 0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="width:1.35em;height:1.35em;flex-shrink:0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[platform] || icons.other}</svg><bdi dir="auto" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${escape(label)}</bdi></a>`];
  });
  if (!links.length) return '';
  return `<div class="document-social-footer" data-social-pages="${settings.pages}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="font-family:inherit;font-size:${font}pt;line-height:1.5;color:inherit;display:flex;flex-wrap:wrap;align-items:center;justify-content:${{start:'flex-start',center:'center',end:'flex-end'}[settings.align]};column-gap:4mm;row-gap:1mm;padding-top:3mm;border-top:.5pt solid currentColor;break-inside:avoid">${links.join('')}</div>`;
}
