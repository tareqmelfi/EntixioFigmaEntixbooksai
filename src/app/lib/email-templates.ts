/**
 * Document email templates (قوالب رسائل المستندات)
 *
 * One template per document type — the send dialogs pre-fill everything and the
 * accountant only edits what they want:
 *   • To      ← contact email from the client file (fetched if the row lacks it)
 *   • Subject ← per-doc default with number + org
 *   • Body    ← greeting with the client's FIRST NAME auto-inserted, doc summary
 *               line, portal hint, and the org signature — fully editable
 *
 * The API wraps this plain-text body into the branded HTML layout (Stripe-style
 * card + CTA + footer) server-side.
 *
 * FUTURE: per-org editable templates in Settings ← رسائل والتواصل (needs API
 * storage — queued behind the Coolify redeploy).
 */

/** First token of the display name — "شركة فزعه للإنتاج" → "شركة" is wrong, so
 * for orgs we skip generic prefixes and take the first meaningful word. */
export function firstNameOf(displayName?: string | null): string {
  const name = (displayName || "").trim();
  if (!name) return "";
  const tokens = name.split(/\s+/);
  const skip = new Set(["شركة", "مؤسسة", "مكتب", "مجموعة", "معهد", "شركه"]);
  const first = tokens.find((t) => !skip.has(t)) || tokens[0];
  return first;
}

export interface DocEmailTemplateInput {
  docLabel: string;          // سند قبض · سند صرف · فاتورة · عرض سعر
  number: string;
  date: string;              // yyyy-mm-dd
  amountLine?: string;       // "111,896.97 SAR"
  contactName?: string | null;
  orgName: string;
}

export function composeDocEmail(i: DocEmailTemplateInput): { subject: string; message: string } {
  const first = firstNameOf(i.contactName);
  const subject = `${i.docLabel} رقم ${i.number} · ${i.orgName}`;
  const lines = [
    "السلام عليكم ورحمة الله وبركاته،",
    first ? `عميلنا الكريم ${first}، تحية طيبة وبعد،` : "عميلنا الكريم، تحية طيبة وبعد،",
    "",
    `نشارككم ${i.docLabel} رقم ${i.number} بتاريخ ${i.date}${i.amountLine ? ` بمبلغ ${i.amountLine}` : ""}.`,
    "",
    "يمكنكم الاطلاع على النسخة المختومة عبر زر العرض المرفق في هذا البريد.",
    "",
    "مع خالص التقدير،",
    i.orgName,
  ];
  return { subject, message: lines.join("\n") };
}

export function voucherEmail(opts: {
  type: "RECEIPT" | "PAYMENT";
  number: string;
  date: string;
  amount: number;
  currency: string;
  contactName?: string | null;
  orgName: string;
}): { subject: string; message: string } {
  return composeDocEmail({
    docLabel: opts.type === "RECEIPT" ? "سند قبض" : "سند صرف",
    number: opts.number,
    date: opts.date,
    amountLine: `${opts.amount.toLocaleString()} ${opts.currency}`,
    contactName: opts.contactName,
    orgName: opts.orgName,
  });
}

export function invoiceEmail(opts: {
  number: string;
  date: string;
  total: number;
  currency: string;
  contactName?: string | null;
  orgName: string;
}): { subject: string; message: string } {
  return composeDocEmail({
    docLabel: "فاتورة",
    number: opts.number,
    date: opts.date,
    amountLine: `${opts.total.toLocaleString()} ${opts.currency}`,
    contactName: opts.contactName,
    orgName: opts.orgName,
  });
}

export function quoteEmail(opts: {
  number: string;
  date: string;
  total: number;
  currency: string;
  contactName?: string | null;
  orgName: string;
}): { subject: string; message: string } {
  return composeDocEmail({
    docLabel: "عرض سعر",
    number: opts.number,
    date: opts.date,
    amountLine: `${opts.total.toLocaleString()} ${opts.currency}`,
    contactName: opts.contactName,
    orgName: opts.orgName,
  });
}
