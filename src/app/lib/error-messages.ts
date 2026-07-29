/**
 * Bilingual (ar/en) human error messages for typed backend error codes.
 *
 * Before this, raw machine codes like "internal_error" were rendered verbatim
 * as toast text. Now: known codes map to friendly bilingual text, unknown
 * codes fall back to a localized generic, and the support requestId is
 * appended when present so users can quote it.
 */
import { ApiError } from './api'

type Lang = 'ar' | 'en'

const MAP: Record<string, { ar: string; en: string }> = {
  // infra
  internal_error: {
    ar: 'خطأ غير متوقع في الخادم · زوّد الدعم بالرقم المرجعي',
    en: 'Unexpected server error · share the reference id with support',
  },
  database_unavailable: {
    ar: 'قاعدة البيانات غير متاحة مؤقتاً · حاول مجدداً بعد قليل',
    en: 'Database temporarily unavailable · please retry in a moment',
  },
  record_not_found: { ar: 'السجل غير موجود', en: 'Record not found' },
  not_found: { ar: 'العنصر غير موجود', en: 'Item not found' },
  unauthorized: { ar: 'جلستك انتهت · سجّل الدخول مجدداً', en: 'Session expired · please sign in again' },
  subscription_required: {
    ar: 'اشتراكك غير نشط · جدّد الاشتراك للمتابعة',
    en: 'Your subscription is inactive · please renew to continue',
  },
  // validation / conflicts
  validation_failed: { ar: 'تحقّق من الحقول المدخلة', en: 'Please review the entered fields' },
  unique_constraint_violation: {
    ar: 'يوجد سجل بنفس القيمة الفريدة مسبقاً',
    en: 'A record with this unique value already exists',
  },
  number_already_exists: { ar: 'الرقم مستخدم مسبقاً', en: 'This number is already in use' },
  duplicate_invoice_number: {
    ar: 'رقم الفاتورة مستخدم مسبقاً داخل هذه الشركة',
    en: 'Invoice number already exists in this company',
  },
  line_account_required: {
    ar: 'اختر حساب الإيراد لكل بند قبل الاعتماد',
    en: 'Select a revenue account for every line before approving',
  },
  line_incomplete: {
    ar: 'كل بند يحتاج وصفاً واضحاً + كمية وسعراً أكبر من صفر',
    en: 'Every line needs a clear description + quantity and price above zero',
  },
  invoice_number_locked: {
    ar: 'رقم الفاتورة يتثبت بعد إصدارها ولا يمكن تغييره',
    en: 'The invoice number is locked after issuance',
  },
  already_pending: {
    ar: 'يوجد طلب توقيع نشط لهذه الفاتورة',
    en: 'An active signature request exists for this invoice',
  },
  short_code_already_exists: {
    ar: 'رمز العميل/المورد مستخدم مسبقاً',
    en: 'This contact code is already in use',
  },
  // purchases surfaces
  bills_list_failed: { ar: 'تعذّر تحميل فواتير الشراء', en: 'Could not load purchase bills' },
  bill_fetch_failed: { ar: 'تعذّر تحميل الفاتورة', en: 'Could not load the bill' },
  bill_create_failed: { ar: 'تعذّر حفظ فاتورة الشراء', en: 'Could not save the purchase bill' },
  expenses_list_failed: { ar: 'تعذّر تحميل المصروفات', en: 'Could not load expenses' },
  expense_fetch_failed: { ar: 'تعذّر تحميل المصروف', en: 'Could not load the expense' },
  expense_create_failed: { ar: 'تعذّر حفظ المصروف', en: 'Could not save the expense' },
  supplier_credits_list_failed: { ar: 'تعذّر تحميل إشعارات المورّد', en: 'Could not load supplier credits' },
  supplier_credit_fetch_failed: { ar: 'تعذّر تحميل إشعار المورّد', en: 'Could not load the supplier credit' },
  supplier_credit_create_failed: { ar: 'تعذّر حفظ إشعار المورّد', en: 'Could not save the supplier credit' },
  // ingestion
  ingestion_failed: {
    ar: 'فشل حفظ المستند · لم يتم إنشاء أي سجل (تم التراجع عن العملية)',
    en: 'Document ingestion failed · no record was created (rolled back)',
  },
  supplier_required: { ar: 'تعذّر تحديد المورّد · أضفه يدوياً', en: 'Could not resolve the supplier · add it manually' },
  bill_number_required: { ar: 'تعذّر توليد رقم الفاتورة', en: 'Could not allocate a bill number' },
  expense_number_required: { ar: 'تعذّر توليد رقم المصروف', en: 'Could not allocate an expense number' },
  invalid_contact: { ar: 'جهة الاتصال غير صالحة', en: 'Invalid contact' },
  invalid_account: { ar: 'الحساب المحدد غير صالح', en: 'Invalid account selected' },
  invalid_product: { ar: 'أحد الأصناف غير صالح', en: 'One of the items is invalid' },
  // ai / ocr
  quota_exceeded: { ar: 'رصيد الذكاء الاصطناعي مستنفد', en: 'AI quota exhausted' },
  ai_disabled: { ar: 'الذكاء الاصطناعي غير مفعّل', en: 'AI is disabled' },
  ocr_disabled: { ar: 'خدمة الاستخراج غير متاحة حالياً', en: 'Extraction service is currently unavailable' },
  openrouter_error: { ar: 'تعذّر الاستخراج من مزوّد الذكاء', en: 'Extraction failed at the AI provider' },
  extraction_failed: { ar: 'فشل استخراج البيانات من المستند', en: 'Could not extract data from the document' },
  parse_failed: { ar: 'تعذّرت قراءة محتوى المستند', en: 'Could not read the document content' },
  commit_failed: { ar: 'فشل الاعتماد النهائي', en: 'Final commit failed' },
  not_extracted: { ar: 'لم يتم استخراج البيانات بعد', en: 'Data has not been extracted yet' },
  no_supplier: { ar: 'تعذّر تحديد المورّد · أضف يدوياً', en: 'Could not resolve the supplier · add manually' },
  image_preprocess_failed: { ar: 'تعذّرت معالجة ملف الصورة', en: 'Could not process the image file' },
  unsupported_type: { ar: 'نوع الملف غير مدعوم هنا', en: 'File type not supported here' },
  // inbox
  invalid_token: { ar: 'رمز غير صالح', en: 'Invalid token' },
  org_not_found: { ar: 'المنشأة غير موجودة', en: 'Organization not found' },
  no_org_slug: { ar: 'عنوان البريد لا يحمل معرّف المنشأة', en: 'Recipient address misses the org slug' },
  // auth (better-auth passthrough codes already handled elsewhere · generic fallbacks)
  missing_x_org_id_header: { ar: 'لم يتم تحديد المنشأة', en: 'No organization selected' },
}

const GENERIC: Record<Lang, string> = {
  ar: 'حدث خطأ غير متوقع · حاول مجدداً',
  en: 'Something went wrong · please retry',
}

/** Raw snake_case codes must never be shown as user-facing text. */
function looksLikeCode(text: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(text)
}

/**
 * Turn any thrown error into a localized, actionable message.
 * - Known code → mapped bilingual text (+ requestId when present)
 * - Server-provided human message (incl. backend messageAr) → shown as-is
 * - Anything else → caller's localized fallback
 */
export function humanizeError(
  err: unknown,
  lang: Lang,
  fallback?: { ar: string; en: string },
): string {
  const fb = fallback ?? GENERIC
  if (err instanceof ApiError) {
    if (err.code && MAP[err.code]) {
      const base = MAP[err.code][lang]
      return err.requestId ? `${base} · ${err.requestId}` : base
    }
    const serverMsg = lang === 'ar' ? (err.messageAr || err.message) : err.message
    if (serverMsg && !looksLikeCode(serverMsg)) return serverMsg
    if (err.detail && !looksLikeCode(err.detail)) return `${fb[lang]} · ${err.detail}`
    return err.requestId ? `${fb[lang]} · ${err.requestId}` : fb[lang]
  }
  return fb[lang]
}
