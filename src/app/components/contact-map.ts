/**
 * Central Contact Name → Contact ID Mapping
 * Used across all pages for "everything clickable" navigation.
 * Any customer/vendor/supplier name links to their contact profile at /contacts/:id
 */
export const contactMap: Record<string, string> = {
  // Customers
  "شركة التقنية المتقدمة": "P-002",
  "مؤسسة الإبداع الرقمي": "P-003",
  "شركة المستقبل للتجارة": "P-004",
  "مؤسسة النجاح للتطوير": "P-011",
  "شركة الأمل للاستثمار": "P-012",
  "شركة الأمل التجارية": "P-012",
  "مؤسسة النور": "P-003",
  "شركة البناء الحديث": "P-006",
  "مؤسسة البناء الحديث": "P-006",
  "شركة الاتصالات السعودية": "P-001",
  // Vendors / Suppliers
  "شركة المواد الخام": "P-005",
  "مؤسسة التوريدات": "P-007",
  "شركة الإمدادات": "P-008",
  "مؤسسة الخدمات": "P-009",
  "شركة التجهيزات": "P-010",
  "شركة الحلول التقنية": "P-013",
  "شركة الصيانة المتقدمة": "P-014",
};

/** Helper: get contact link path */
export const contactLink = (name: string): string => {
  const id = contactMap[name];
  return id ? `/contacts/${id}` : "/contacts";
};