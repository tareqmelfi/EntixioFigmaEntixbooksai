import { useState } from "react";
import {
  FileText, Plus, Search, Download, Eye, Copy, Edit2, MoreVertical,
  Receipt, FileSpreadsheet, CreditCard, ScrollText, Printer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

interface Template {
  id: string;
  name: string;
  type: string;
  icon: React.ElementType;
  description: string;
  lastModified: string;
  isDefault: boolean;
  status: "نشط" | "مسودة";
}

const templates: Template[] = [
  { id: "T-001", name: "فاتورة مبيعات - كلاسيك", type: "فاتورة بيع", icon: FileText, description: "قالب الفاتورة الأساسي مع شعار الشركة وبيانات ZATCA", lastModified: "2026-03-01", isDefault: true, status: "نشط" },
  { id: "T-002", name: "فاتورة مبيعات - حديث", type: "فاتورة بيع", icon: FileText, description: "تصميم عصري بألوان الهوية مع QR Code", lastModified: "2026-02-20", isDefault: false, status: "نشط" },
  { id: "T-003", name: "عرض سعر - احترافي", type: "عرض سعر", icon: FileSpreadsheet, description: "قالب عرض أسعار مع شروط وأحكام", lastModified: "2026-02-15", isDefault: true, status: "نشط" },
  { id: "T-004", name: "سند قبض", type: "سند قبض", icon: Receipt, description: "سند قبض رسمي مع رقم مرجعي", lastModified: "2026-01-10", isDefault: true, status: "نشط" },
  { id: "T-005", name: "سند صرف", type: "سند صرف", icon: CreditCard, description: "سند صرف للموردين", lastModified: "2026-01-10", isDefault: true, status: "نشط" },
  { id: "T-006", name: "إشعار دائن", type: "إشعار دائن", icon: ScrollText, description: "قالب إشعار دائن متوافق مع ZATCA", lastModified: "2026-01-05", isDefault: true, status: "نشط" },
  { id: "T-007", name: "فاتورة مبيعات - مبسط", type: "فاتورة بيع", icon: FileText, description: "فاتورة مبسطة للمبيعات الصغيرة (POS)", lastModified: "2025-12-20", isDefault: false, status: "مسودة" },
];

export function Templates() {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = templates.filter(t =>
    t.name.includes(searchQuery) || t.type.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>القوالب</h1>
          <p className="text-[#6B7280] mt-1">إدارة قوالب الفواتير والمستندات</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />قالب جديد</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input placeholder="بحث في القوالب..." className="ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const Icon = template.icon;
          return (
            <Card key={template.id} className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#EFF6FF] p-2.5"><Icon className="h-5 w-5 text-[#1276E3]" /></div>
                    <div>
                      <div className="text-[#0B1B49]" style={{ fontWeight: 600 }}>{template.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#6B7280]">{template.type}</span>
                        {template.isDefault && (
                          <span className="inline-flex rounded-full bg-[#ECEEF5] px-2 py-0.5 text-[10px] text-[#0B1A47]" style={{ fontWeight: 600 }}>افتراضي</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${template.status === "نشط" ? "bg-[#ECEEF5] text-[#0B1A47]" : "bg-[#FEF3C7] text-[#92400E]"}`} style={{ fontWeight: 600 }}>{template.status}</span>
                </div>
                <p className="text-sm text-[#6B7280] mb-3">{template.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                  <span className="text-xs text-[#9CA3AF] font-english">{template.lastModified}</span>
                  <div className="flex gap-1">
                    <button className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                    <button className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><Copy className="h-3.5 w-3.5" /></button>
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
