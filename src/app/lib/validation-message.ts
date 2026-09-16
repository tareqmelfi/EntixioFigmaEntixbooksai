/**
 * Human validation messages (CEO 2026-09-14 · «لا رسالة خطأ مفصَّلة تصل للمستخدم عند فشل الحفظ»).
 *
 * A 400 from the API carries a Zod issue list whose raw form — `lines.8.unitPrice Number must be
 * greater than or equal to 0` — is unreadable to the person filling the form: zero-based index,
 * schema field name, English library wording. This turns one issue into a sentence that names the
 * row the way the screen numbers it and the field the way the screen labels it.
 */
export type ZodIssue = { path?: (string | number)[]; message?: string }

const FIELD: Record<string, [string, string]> = {
  unitPrice: ["سعر الوحدة", "unit price"],
  quantity: ["الكمية", "quantity"],
  discount: ["الخصم", "discount"],
  discountValue: ["قيمة الخصم", "discount value"],
  discountType: ["نوع الخصم", "discount type"],
  description: ["الوصف", "description"],
  contactId: ["العميل", "customer"],
  issueDate: ["تاريخ الإصدار", "issue date"],
  validUntil: ["صالح حتى", "valid until"],
  dueDate: ["تاريخ الاستحقاق", "due date"],
  currency: ["العملة", "currency"],
  exchangeRate: ["سعر الصرف", "exchange rate"],
  taxRate: ["الضريبة", "tax rate"],
  taxRateId: ["الضريبة", "tax rate"],
  accountId: ["الحساب", "account"],
  quoteNumber: ["رقم العرض", "quote number"],
  invoiceNumber: ["رقم الفاتورة", "invoice number"],
  reference: ["المرجع", "reference"],
  title: ["العنوان", "title"],
  lines: ["البنود", "line items"],
  notes: ["الملاحظات", "notes"],
  termsConditions: ["الشروط والأحكام", "terms"],
}

const ROW: Record<string, [string, string]> = {
  lines: ["السطر", "line"],
  items: ["السطر", "line"],
  payments: ["الدفعة", "payment"],
}

/** Library wording → what actually went wrong, in the user's terms. */
function reason(raw: string): [string, string] {
  const m = (raw || "").toLowerCase()
  if (m.includes("greater than or equal to 0")) return ["لا يمكن أن يكون بالسالب", "cannot be negative"]
  if (m.includes("greater than 0")) return ["يجب أن يكون أكبر من صفر", "must be greater than zero"]
  if (m.includes("less than or equal to")) return ["أكبر من الحد المسموح", "is above the allowed maximum"]
  if (m === "required" || m.includes("required")) return ["مطلوب", "is required"]
  if (m.includes("expected string") || m.includes("expected number")) return ["قيمة غير صالحة", "has an invalid value"]
  if (m.includes("invalid enum") || m.includes("invalid_enum")) return ["قيمة غير مسموحة", "is not one of the allowed values"]
  if (m.includes("at least")) return ["أقصر من الحد المطلوب", "is shorter than allowed"]
  if (m.includes("at most") || m.includes("too big")) return ["أطول من الحد المسموح", "is longer than allowed"]
  if (m.includes("invalid date")) return ["تاريخ غير صالح", "is not a valid date"]
  return [raw, raw]
}

/** One issue → "السطر 9 · سعر الوحدة: لا يمكن أن يكون بالسالب" / "Line 9 · unit price: cannot be negative". */
export function humanizeZodIssue(issue: ZodIssue): { ar: string; en: string } {
  const path = (issue.path || []).filter((p) => p !== undefined && p !== null)
  const [rAr, rEn] = reason(String(issue.message || ""))
  const prefixAr: string[] = []
  const prefixEn: string[] = []
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]
    if (typeof seg === "number") continue
    const key = String(seg)
    const next = path[i + 1]
    if (ROW[key] && typeof next === "number") {
      // the screen numbers rows from 1 — the schema from 0
      prefixAr.push(`${ROW[key][0]} ${next + 1}`)
      prefixEn.push(`${ROW[key][1]} ${next + 1}`)
      continue
    }
    const f = FIELD[key]
    prefixAr.push(f ? f[0] : key)
    prefixEn.push(f ? f[1] : key)
  }
  const headAr = prefixAr.join(" · ")
  const headEn = prefixEn.join(" · ")
  return {
    ar: headAr ? `${headAr}: ${rAr}` : rAr,
    en: headEn ? `${headEn}: ${rEn}` : rEn,
  }
}

/** The whole list → at most the first three, so a toast stays readable. */
export function humanizeZodIssues(issues: ZodIssue[]): { ar: string; en: string } {
  const parts = issues.slice(0, 3).map(humanizeZodIssue)
  const more = issues.length - parts.length
  const ar = parts.map((p) => p.ar).join(" · ") + (more > 0 ? ` (و${more} أخرى)` : "")
  const en = parts.map((p) => p.en).join(" · ") + (more > 0 ? ` (and ${more} more)` : "")
  return { ar, en }
}
