import { useState } from "react";
import { Link } from "react-router";
import {
  FileText, Download, Printer, CreditCard, LogOut,
  ChevronDown, Eye, Clock, Building2, User, CheckCircle2,
  AlertCircle, Calendar, ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { EntixWordmark } from "../components/entix-brand";

const CUR = "SR";

type PortalTab = "home" | "invoices" | "statement" | "documents";

const portalInvoices = [
  { id: "INV-2026-001", date: "2026-03-01", description: "خدمات استشارية - الربع الأول", amount: 75000, status: "مدفوعة" },
  { id: "INV-2026-003", date: "2026-02-15", description: "ترخيص برمجيات - سنوي", amount: 120000, status: "مدفوعة" },
  { id: "INV-2026-007", date: "2026-03-03", description: "صيانة شهرية - مارس", amount: 55000, status: "مرسلة" },
  { id: "INV-2026-012", date: "2026-01-10", description: "دعم فني - ديسمبر", amount: 8500, status: "متأخرة" },
  { id: "INV-2026-015", date: "2026-03-04", description: "تدريب الموظفين", amount: 22000, status: "مسودة" },
];

const portalStatements = [
  { date: "2026-03-04", description: "فاتورة INV-2026-015", ref: "INV-2026-015", debit: 22000, credit: 0, balance: 63500 },
  { date: "2026-03-03", description: "فاتورة INV-2026-007", ref: "INV-2026-007", debit: 55000, credit: 0, balance: 41500 },
  { date: "2026-02-28", description: "دفعة مستلمة", ref: "REC-2026-002", debit: 0, credit: 120000, balance: -13500 },
  { date: "2026-02-15", description: "فاتورة INV-2026-003", ref: "INV-2026-003", debit: 120000, credit: 0, balance: 106500 },
  { date: "2026-02-01", description: "دفعة مستلمة", ref: "REC-2026-001", debit: 0, credit: 75000, balance: -13500 },
  { date: "2026-01-10", description: "فاتورة INV-2026-001", ref: "INV-2026-001", debit: 75000, credit: 0, balance: 61500 },
];

const portalDocuments = [
  { id: "D-1", name: "عقد خدمات استشارية 2026", type: "عقد", date: "2026-01-15" },
  { id: "D-2", name: "شروط الدفع", type: "سياسة", date: "2025-12-01" },
];

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    "مدفوعة": "bg-[#DCFCE7] text-[#166534]",
    "مرسلة": "bg-[#EFF6FF] text-[#1E40AF]",
    "متأخرة": "bg-[#FEE2E2] text-[#991B1B]",
    "مسودة": "bg-[#F3F4F6] text-[#6B7280]",
  };
  return m[s] || "";
};

export function PortalHome() {
  const [activeTab, setActiveTab] = useState<PortalTab>("home");
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const totalInvoices = portalInvoices.length;
  const totalPaid = portalInvoices.filter(i => i.status === "مدفوعة").reduce((s, i) => s + i.amount, 0);
  const totalPending = portalInvoices.filter(i => i.status === "مرسلة").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = portalInvoices.filter(i => i.status === "متأخرة").reduce((s, i) => s + i.amount, 0);

  const viewingInvoice = selectedInvoice ? portalInvoices.find(i => i.id === selectedInvoice) : null;

  return (
    <div className="min-h-screen bg-[#F9FAFB]" dir="rtl">
      {/* Portal Header */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <EntixWordmark size={26} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#0B1B49] text-white text-xs" style={{ fontWeight: 600 }}>أم</AvatarFallback>
              </Avatar>
              <div className="text-end">
                <div className="text-xs text-[#0B1B49]" style={{ fontWeight: 500 }}>أحمد محمد</div>
                <div className="text-[10px] text-[#6B7280] font-english">ahmed@stc.com.sa</div>
              </div>
            </div>
            <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#EF4444] hover:bg-[#FEE2E2] transition-colors">
              <LogOut className="h-3.5 w-3.5" />
              خروج
            </button>
          </div>
        </div>
      </header>

      {/* Role Selector */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-2">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">تصفح كـ:</span>
          <button className="flex items-center gap-1.5 rounded-lg bg-[#1276E3] px-3 py-1.5 text-xs text-white" style={{ fontWeight: 600 }}>
            <Building2 className="h-3.5 w-3.5" />
            ممثل STC
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-[#F3F4F6] px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#E5E7EB] transition-colors" style={{ fontWeight: 600 }}>
            <User className="h-3.5 w-3.5" />
            شخصي
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-[#E5E7EB] px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {([
            { key: "home" as PortalTab, label: "الرئيسية" },
            { key: "invoices" as PortalTab, label: "الفواتير" },
            { key: "statement" as PortalTab, label: "كشف الحساب" },
            { key: "documents" as PortalTab, label: "المستندات" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedInvoice(null); }}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${activeTab === tab.key ? "border-[#1276E3] text-[#1276E3]" : "border-transparent text-[#6B7280] hover:text-[#0B1B49]"}`}
              style={{ fontWeight: 500 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {activeTab === "home" && !selectedInvoice && (
          <>
            <div>
              <h2 className="text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>مرحباً أحمد 👋</h2>
              <p className="text-sm text-[#6B7280] mt-0.5">بوابة: شركة ENTIX.IO العالمية</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card className="border-[#E5E7EB]">
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalInvoices}</div>
                  <p className="text-xs text-[#6B7280] mt-0.5">إجمالي الفواتير</p>
                </CardContent>
              </Card>
              <Card className="border-[#E5E7EB] relative overflow-hidden">
                <div className="absolute top-0 start-0 end-0 h-0.5 bg-[#22C55E]" />
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <div dir="ltr" className="flex items-baseline justify-center gap-1">
                    <span className="text-[#22C55E] font-english" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{totalPaid.toLocaleString()}</span>
                    <span className="text-xs text-[#6B7280] font-english">{CUR}</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">مدفوع ✅</p>
                </CardContent>
              </Card>
              <Card className="border-[#E5E7EB] relative overflow-hidden">
                <div className="absolute top-0 start-0 end-0 h-0.5 bg-[#F59E0B]" />
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <div dir="ltr" className="flex items-baseline justify-center gap-1">
                    <span className="text-[#F59E0B] font-english" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{totalPending.toLocaleString()}</span>
                    <span className="text-xs text-[#6B7280] font-english">{CUR}</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">متبقي ⏳</p>
                </CardContent>
              </Card>
              <Card className="border-[#E5E7EB] relative overflow-hidden">
                <div className="absolute top-0 start-0 end-0 h-0.5 bg-[#EF4444]" />
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <div dir="ltr" className="flex items-baseline justify-center gap-1">
                    <span className="text-[#EF4444] font-english" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{totalOverdue.toLocaleString()}</span>
                    <span className="text-xs text-[#6B7280] font-english">{CUR}</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">متأخر 🔴</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Invoices */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>آخر الفواتير</CardTitle>
                  <button onClick={() => setActiveTab("invoices")} className="text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>عرض الكل →</button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {portalInvoices.slice(0, 3).map((inv) => (
                    <button key={inv.id} onClick={() => setSelectedInvoice(inv.id)} className="w-full flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors text-start px-2 rounded-md">
                      <div className="flex items-center gap-3">
                        <span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{inv.id}</span>
                        <span className="text-[#D1D5DB]">|</span>
                        <span className="font-english text-sm text-[#6B7280]">{inv.date}</span>
                        <span className="text-[#D1D5DB]">|</span>
                        <span dir="ltr" className="font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{CUR} {inv.amount.toLocaleString()}</span>
                      </div>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] ${statusBadge(inv.status)}`} style={{ fontWeight: 600 }}>{inv.status}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>المستندات المشتركة</CardTitle>
                  <button onClick={() => setActiveTab("documents")} className="text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>عرض الكل</button>
                </div>
              </CardHeader>
              <CardContent>
                {portalDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 py-2.5 border-b border-[#F3F4F6] last:border-0">
                    <FileText className="h-4 w-4 text-[#6B7280]" />
                    <span className="text-sm text-[#374151]">{doc.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <button className="flex items-center gap-2 rounded-lg border border-[#0B1B49] px-4 py-2.5 text-sm text-[#0B1B49] hover:bg-[#ECEEF5] transition-colors" style={{ fontWeight: 500 }}>
              <Download className="h-4 w-4" />
              تحميل كشف الحساب PDF
            </button>
          </>
        )}

        {/* Invoice Detail View */}
        {selectedInvoice && viewingInvoice && (
          <div className="space-y-5">
            <button onClick={() => setSelectedInvoice(null)} className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#0B1B49] transition-colors">
              <ArrowLeft className="h-4 w-4 rotate-180" />
              العودة
            </button>

            <Card className="border-[#E5E7EB]">
              <CardContent className="pt-6 pb-5">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-[#0B1B49] font-english" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{viewingInvoice.id}</h2>
                    <p className="text-sm text-[#6B7280] mt-0.5 font-english">{viewingInvoice.date}</p>
                  </div>
                  <span className={`inline-flex rounded-md px-3 py-1 text-xs ${statusBadge(viewingInvoice.status)}`} style={{ fontWeight: 600 }}>{viewingInvoice.status}</span>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6 p-4 rounded-lg bg-[#F9FAFB]">
                  <div>
                    <p className="text-xs text-[#9CA3AF]" style={{ fontWeight: 500 }}>من</p>
                    <p className="text-sm text-[#0B1B49] mt-0.5" style={{ fontWeight: 600 }}>شركة ENTIX.IO العالمية</p>
                    <p className="text-xs text-[#6B7280]">الرياض، المملكة العربية السعودية</p>
                    <p className="text-xs text-[#6B7280] font-english mt-0.5">VAT: 300000000000001</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9CA3AF]" style={{ fontWeight: 500 }}>إلى</p>
                    <p className="text-sm text-[#0B1B49] mt-0.5" style={{ fontWeight: 600 }}>شركة الاتصالات السعودية</p>
                    <p className="text-xs text-[#6B7280]">الرياض، طريق الملك فهد</p>
                    <p className="text-xs text-[#6B7280] font-english mt-0.5">VAT: 300000000000003</p>
                  </div>
                </div>

                <table className="w-full mb-4">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      {["الوصف", "الكمية", "السعر", "الضريبة", "الإجمالي"].map((h) => (
                        <th key={h} className="pb-2 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#F3F4F6]">
                      <td className="py-3 pe-3 text-sm text-[#374151]">{viewingInvoice.description}</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#374151]">1</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#374151]">{(viewingInvoice.amount / 1.15).toFixed(0)}</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#374151]">15%</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{viewingInvoice.amount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5">
                    <div className="flex justify-between text-sm text-[#6B7280]"><span>المجموع</span><span dir="ltr" className="font-english">{CUR} {(viewingInvoice.amount / 1.15).toFixed(0)}</span></div>
                    <div className="flex justify-between text-sm text-[#6B7280]"><span>الضريبة (15%)</span><span dir="ltr" className="font-english">{CUR} {(viewingInvoice.amount - viewingInvoice.amount / 1.15).toFixed(0)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-[#E5E7EB]"><span className="text-sm text-[#0B1B49]" style={{ fontWeight: 700 }}>الإجمالي</span><span dir="ltr" className="font-english text-[#0B1B49]" style={{ fontWeight: 700 }}>{CUR} {viewingInvoice.amount.toLocaleString()}</span></div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#E5E7EB]">
                  {viewingInvoice.status !== "مدفوعة" && (
                    <button className="rounded-lg bg-[#22C55E] px-5 py-2.5 text-sm text-white hover:bg-[#16A34A] transition-colors" style={{ fontWeight: 600 }}>ادفع الآن</button>
                  )}
                  <button className="rounded-lg border border-[#0B1B49] px-4 py-2.5 text-sm text-[#0B1B49] hover:bg-[#ECEEF5] transition-colors" style={{ fontWeight: 500 }}>
                    <Download className="h-4 w-4 inline-block me-1.5" />تحميل PDF
                  </button>
                  <button className="rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>
                    <Printer className="h-4 w-4 inline-block me-1.5" />طباعة
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "invoices" && !selectedInvoice && (
          <Card className="border-[#E5E7EB]">
            <CardHeader><CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>جميع الفواتير</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    {["الرقم", "التاريخ", "الوصف", "المبلغ", "الحالة", ""].map(h => (
                      <th key={h} className="pb-3 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portalInvoices.map(inv => (
                    <tr key={inv.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv.id)}>
                      <td className="py-3 pe-3 text-sm font-english text-[#1276E3]" style={{ fontWeight: 600 }}>{inv.id}</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#6B7280]">{inv.date}</td>
                      <td className="py-3 pe-3 text-sm text-[#374151]">{inv.description}</td>
                      <td className="py-3 pe-3"><span dir="ltr" className="font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{CUR} {inv.amount.toLocaleString()}</span></td>
                      <td className="py-3 pe-3"><span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] ${statusBadge(inv.status)}`} style={{ fontWeight: 600 }}>{inv.status}</span></td>
                      <td className="py-3"><Eye className="h-4 w-4 text-[#6B7280]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {activeTab === "statement" && (
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>كشف الحساب</CardTitle>
                <button className="flex items-center gap-1.5 rounded-lg border border-[#0B1B49] px-3 py-1.5 text-xs text-[#0B1B49] hover:bg-[#ECEEF5] transition-colors" style={{ fontWeight: 500 }}>
                  <Download className="h-3.5 w-3.5" />تحميل كشف الحساب PDF
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    {["التاريخ", "الوصف", "المرجع", "مدين", "دائن", "الرصيد"].map(h => (
                      <th key={h} className="pb-3 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portalStatements.map((s, i) => (
                    <tr key={i} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB]">
                      <td className="py-3 pe-3 text-sm font-english text-[#6B7280]">{s.date}</td>
                      <td className="py-3 pe-3 text-sm text-[#374151]">{s.description}</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#1276E3]" style={{ fontWeight: 500 }}>{s.ref}</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#0B1A47]" style={{ fontWeight: 500 }}>{s.debit > 0 ? s.debit.toLocaleString() : "—"}</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#349FC4]" style={{ fontWeight: 500 }}>{s.credit > 0 ? s.credit.toLocaleString() : "—"}</td>
                      <td className="py-3 pe-3 text-sm font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{s.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-3 border-t border-[#E5E7EB] text-end">
                <span className="text-sm text-[#6B7280]">الرصيد الحالي: </span>
                <span dir="ltr" className="font-english text-[#0B1B49]" style={{ fontWeight: 700 }}>{CUR} {portalStatements[0].balance.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "documents" && (
          <Card className="border-[#E5E7EB]">
            <CardHeader><CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>المستندات المشتركة</CardTitle></CardHeader>
            <CardContent>
              {portalDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors px-2 rounded-md">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[#6B7280]" />
                    <div>
                      <div className="text-sm text-[#374151]" style={{ fontWeight: 500 }}>{doc.name}</div>
                      <div className="text-xs text-[#9CA3AF] font-english">{doc.date}</div>
                    </div>
                  </div>
                  <button className="rounded-md p-1.5 text-[#1276E3] hover:bg-[#EFF6FF] transition-colors"><Download className="h-4 w-4" /></button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Portal Footer */}
      <div className="text-center py-6 border-t border-[#E5E7EB] mt-12">
        <span className="text-xs text-[#9CA3AF]">مقدم من </span>
        <span className="text-xs text-[#9CA3AF] font-english" style={{ fontWeight: 600 }}>ENTIX.IO</span>
      </div>
    </div>
  );
}
