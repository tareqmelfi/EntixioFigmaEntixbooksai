/** Notifications never become purchases merely because they contain a balance. */
export function isFinancialNotice(data: any): boolean {
 const kind=String(data?.documentType || data?.docType || '').toLowerCase();
 const subject=String(data?.subject || data?.emailSubject || data?.title || '').trim();
 return /^(notification|balance_alert|credit_balance_alert|reminder)$/.test(kind)
   || /^(your\s+)?(openrouter\s+)?credit balance is low[.!]?$|^تنبيه.*انخفاض.*الرصيد$/i.test(subject);
}
