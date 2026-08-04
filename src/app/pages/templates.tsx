import { useState } from "react";
import {
  FileText, Plus, Search, Eye, Copy, Edit2,
  Receipt, FileSpreadsheet, CreditCard, ScrollText
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useLanguage } from "../components/LanguageContext";

interface Template {
  id: string;
  name: { ar: string; en: string };
  type: { ar: string; en: string };
  icon: React.ElementType;
  description: { ar: string; en: string };
  lastModified: string;
  isDefault: boolean;
  status: { ar: string; en: string };
}

const templates: Template[] = [
  { id: "T-001", name: { ar: "فاتورة مبيعات - كلاسيك", en: "Sales Invoice - Classic" }, type: { ar: "فاتورة بيع", en: "Sales Invoice" }, icon: FileText, description: { ar: "قالب الفاتورة الأساسي مع شعار الشركة وبيانات ZATCA", en: "Base invoice template with company logo and ZATCA details" }, lastModified: "2026-03-01", isDefault: true, status: { ar: "نشط", en: "Active" } },
  { id: "T-002", name: { ar: "فاتورة مبيعات - حديث", en: "Sales Invoice - Modern" }, type: { ar: "فاتورة بيع", en: "Sales Invoice" }, icon: FileText, description: { ar: "تصميم عصري بألوان الهوية مع QR Code", en: "Modern design with brand colors and QR Code" }, lastModified: "2026-02-20", isDefault: false, status: { ar: "نشط", en: "Active" } },
  { id: "T-003", name: { ar: "عرض سعر - احترافي", en: "Quotation - Professional" }, type: { ar: "عرض سعر", en: "Quotation" }, icon: FileSpreadsheet, description: { ar: "قالب عرض أسعار مع شروط وأحكام", en: "Quotation template with terms and conditions" }, lastModified: "2026-02-15", isDefault: true, status: { ar: "نشط", en: "Active" } },
  { id: "T-004", name: { ar: "سند قبض", en: "Receipt Voucher" }, type: { ar: "سند قبض", en: "Receipt Voucher" }, icon: Receipt, description: { ar: "سند قبض رسمي مع رقم مرجعي", en: "Official receipt voucher with reference number" }, lastModified: "2026-01-10", isDefault: true, status: { ar: "نشط", en: "Active" } },
  { id: "T-005", name: { ar: "سند صرف", en: "Payment Voucher" }, type: { ar: "سند صرف", en: "Payment Voucher" }, icon: CreditCard, description: { ar: "سند صرف للموردين", en: "Payment voucher for suppliers" }, lastModified: "2026-01-10", isDefault: true, status: { ar: "نشط", en: "Active" } },
  { id: "T-006", name: { ar: "إشعار دائن", en: "Credit Note" }, type: { ar: "إشعار دائن", en: "Credit Note" }, icon: ScrollText, description: { ar: "قالب إشعار دائن متوافق مع ZATCA", en: "ZATCA-compliant credit note template" }, lastModified: "2026-01-05", isDefault: true, status: { ar: "نشط", en: "Active" } },
  { id: "T-007", name: { ar: "فاتورة مبيعات - مبسط", en: "Sales Invoice - Simplified" }, type: { ar: "فاتورة بيع", en: "Sales Invoice" }, icon: FileText, description: { ar: "فاتورة مبسطة للمبيعات الصغيرة (POS)", en: "Simplified invoice for small sales (POS)" }, lastModified: "2025-12-20", isDefault: false, status: { ar: "مسودة", en: "Draft" } },
];

export function Templates() {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = templates.filter(tpl => {
    const name = language === "ar" ? tpl.name.ar : tpl.name.en;
    const type = language === "ar" ? tpl.type.ar : tpl.type.en;
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || type.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("القوالب", "Templates")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة قوالب الفواتير والمستندات", "Manage invoice and document templates")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="me-2 h-4 w-4" />{t("قالب جديد", "New Template")}</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input placeholder={t("بحث في القوالب...", "Search templates...")} className="ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const Icon = template.icon as React.ComponentType<{ className?: string }>;
          const isActive = template.status.ar === "نشط";
          return (
            <Card key={template.id} className="border-border hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#EFF6FF] p-2.5"><Icon className="h-5 w-5 text-primary" /></div>
                    <div>
                      <div className="text-foreground" style={{ fontWeight: 600 }}>{language === "ar" ? template.name.ar : template.name.en}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{language === "ar" ? template.type.ar : template.type.en}</span>
                        {template.isDefault && (
                          <span className="inline-flex rounded-full bg-[#ECEEF5] px-2 py-0.5 text-[10px] text-foreground" style={{ fontWeight: 600 }}>{t("افتراضي", "Default")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${isActive ? "bg-[#ECEEF5] text-foreground" : "bg-[#FEF3C7] text-[#92400E]"}`} style={{ fontWeight: 600 }}>{language === "ar" ? template.status.ar : template.status.en}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{language === "ar" ? template.description.ar : template.description.en}</p>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground/60 font-english">{template.lastModified}</span>
                  <div className="flex gap-1">
                    <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("معاينة", "Preview")}><Eye className="h-3.5 w-3.5" /></button>
                    <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("تعديل", "Edit")}><Edit2 className="h-3.5 w-3.5" /></button>
                    <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("نسخ", "Duplicate")}><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
