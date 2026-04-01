import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowRight, Building2, User, Globe, ExternalLink, Mail, Phone, MapPin,
  FileText, Receipt, CreditCard, Clock, Users, Plus, Shield, Activity,
  Edit, Trash2, ChevronDown, Download, Eye, Send, Search, MoreVertical,
  Link2, PieChart, FolderKanban, ShoppingBag, Wallet, Scale, UserPlus,
  Briefcase
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Input } from "../components/ui/input";

// ── Types ──
type RoleType = "عميل" | "مورد" | "موظف" | "فري لانسر" | "مساهم" | "مستثمر";

const roleBadgeStyles: Record<RoleType, string> = {
  "عميل": "bg-[#DBEAFE] text-[#1E40AF]",
  "مورد": "bg-[#DCFCE7] text-[#166534]",
  "موظف": "bg-[#F3E8FF] text-[#6B21A8]",
  "فري لانسر": "bg-[#FEF3C7] text-[#92400E]",
  "مساهم": "bg-[#E0F2FE] text-[#075985]",
  "مستثمر": "bg-[#FCE7F3] text-[#9D174D]",
};

// ── Mock data ──
interface PartyDetail {
  id: string;
  name: string;
  nameEn?: string;
  type: "organization" | "person";
  roles: RoleType[];
  email: string;
  phone: string;
  taxNumber?: string;
  commercialReg?: string;
  address: string;
  website?: string;
  netBalance: number;
  asCustomer: { total: number; invoiceCount: number; paid: number; overdue: number };
  asVendor: { total: number; billCount: number; paid: number; overdue: number };
  contactPersons: { id: string; name: string; role: string; department: string; email: string; phone: string; lastActivity: string }[];
  transactions: { id: string; type: string; date: string; description: string; amount: number; status: string; person?: string }[];
  documents: { id: string; name: string; type: string; date: string; size: string }[];
  portalUsers: { id: string; name: string; email: string; level: string; lastLogin: string }[];
  activityLog: { id: string; date: string; action: string; user: string; details: string }[];
}

const mockParties: Record<string, PartyDetail> = {
  "P-001": {
    id: "P-001",
    name: "شركة الاتصالات السعودية",
    nameEn: "STC",
    type: "organization",
    roles: ["عميل", "مورد"],
    email: "corporate@stc.com.sa",
    phone: "+966 11 218 0000",
    taxNumber: "300000000000003",
    commercialReg: "1010000001",
    address: "الرياض، طريق الملك فهد، حي العليا",
    website: "stc.com.sa",
    netBalance: 205000,
    asCustomer: { total: 250000, invoiceCount: 12, paid: 200000, overdue: 50000 },
    asVendor: { total: 45000, billCount: 6, paid: 30000, overdue: 15000 },
    contactPersons: [
      { id: "CP-1", name: "أحمد محمد", role: "مدير المشتريات", department: "المشتريات", email: "ahmed@stc.com.sa", phone: "+966 50 111 2222", lastActivity: "2026-03-01" },
      { id: "CP-2", name: "سارة العلي", role: "مدير الحسابات", department: "المالية", email: "sara@stc.com.sa", phone: "+966 50 333 4444", lastActivity: "2026-02-28" },
      { id: "CP-3", name: "خالد المطيري", role: "مدير المشاريع", department: "تقنية المعلومات", email: "khalid@stc.com.sa", phone: "+966 50 555 6666", lastActivity: "2026-02-25" },
    ],
    transactions: [
      { id: "INV-2026-001", type: "فاتورة مبيعات", date: "2026-03-01", description: "خدمات استشارية - الربع الأول", amount: 75000, status: "مدفوعة", person: "أحمد محمد" },
      { id: "INV-2026-003", type: "فاتورة مبيعات", date: "2026-02-15", description: "ترخيص برمجيات - سنوي", amount: 120000, status: "مدفوعة", person: "سارة العلي" },
      { id: "INV-2026-007", type: "فاتورة مبيعات", date: "2026-03-03", description: "صيانة شهرية - مارس", amount: 55000, status: "مرسلة", person: "أحمد محمد" },
      { id: "BILL-2026-004", type: "فاتورة مشتريات", date: "2026-02-20", description: "خدمات اتصالات - فبراير", amount: -18000, status: "مدفوعة" },
      { id: "BILL-2026-008", type: "فاتورة مشتريات", date: "2026-03-01", description: "خدمات اتصالات - مارس", amount: -15000, status: "معلقة" },
      { id: "REC-2026-002", type: "سند قبض", date: "2026-02-28", description: "تسوية فاتورة INV-2026-003", amount: 120000, status: "مكتمل" },
      { id: "PAY-2026-003", type: "سند دفع", date: "2026-02-25", description: "دفعة فاتورة BILL-2026-004", amount: -18000, status: "مكتمل" },
    ],
    documents: [
      { id: "D-1", name: "عقد خدمات استشارية 2026", type: "عقد", date: "2026-01-15", size: "2.4 MB" },
      { id: "D-2", name: "اتفاقية ترخيص البرمجيات", type: "اتفاقية", date: "2026-01-01", size: "1.8 MB" },
      { id: "D-3", name: "شهادة ضريبية", type: "مستند رسمي", date: "2025-12-20", size: "450 KB" },
      { id: "D-4", name: "السجل التجاري", type: "مستند رسمي", date: "2025-11-10", size: "320 KB" },
    ],
    portalUsers: [
      { id: "PU-1", name: "أحمد محمد", email: "ahmed@stc.com.sa", level: "قسم", lastLogin: "2026-03-04" },
      { id: "PU-2", name: "سارة العلي", email: "sara@stc.com.sa", level: "منظمة كاملة", lastLogin: "2026-03-03" },
    ],
    activityLog: [
      { id: "A-1", date: "2026-03-04 10:30", action: "إرسال فاتورة", user: "النظام", details: "تم إرسال الفاتورة INV-2026-007 إلى أحمد محمد" },
      { id: "A-2", date: "2026-03-03 14:15", action: "إنشاء فاتورة", user: "محمد أحمد", details: "تم إنشاء فاتورة جديدة INV-2026-007 بمبلغ 55,000 SR" },
      { id: "A-3", date: "2026-02-28 16:00", action: "استلام دفعة", user: "النظام", details: "تم استلام دفعة 120,000 SR - سند قبض REC-2026-002" },
      { id: "A-4", date: "2026-02-25 09:45", action: "دفع فاتورة", user: "محمد أحمد", details: "تم دفع فاتورة المشتريات BILL-2026-004 بمبلغ 18,000 SR" },
      { id: "A-5", date: "2026-02-20 11:00", action: "استلام فاتورة", user: "النظام", details: "تم استلام فاتورة مشتريات BILL-2026-004 من قسم المشتريات" },
      { id: "A-6", date: "2026-02-15 13:30", action: "تحديث بيانات", user: "سارة العلي", details: "تم تحديث البريد الإلكتروني وعنوان المراسلة" },
    ],
  },
};

// Fallback for other IDs
function getPartyById(id: string): PartyDetail {
  if (mockParties[id]) return mockParties[id];
  return {
    id,
    name: "شركة التقنية المتقدمة",
    nameEn: "Advanced Tech",
    type: "organization",
    roles: ["عميل"],
    email: "info@advanced-tech.sa",
    phone: "+966 11 222 3333",
    taxNumber: "300000000000015",
    commercialReg: "1010000022",
    address: "الرياض، حي العليا",
    netBalance: 150000,
    asCustomer: { total: 150000, invoiceCount: 5, paid: 120000, overdue: 30000 },
    asVendor: { total: 0, billCount: 0, paid: 0, overdue: 0 },
    contactPersons: [
      { id: "CP-10", name: "فهد السالم", role: "المدير العام", department: "الإدارة", email: "fahad@advanced-tech.sa", phone: "+966 50 888 9999", lastActivity: "2026-03-02" },
    ],
    transactions: [
      { id: "INV-2026-010", type: "فاتورة مبيعات", date: "2026-03-01", description: "خدمات تقنية", amount: 45000, status: "مدفوعة" },
      { id: "INV-2026-011", type: "فاتورة مبيعات", date: "2026-03-03", description: "دعم فني شهري", amount: 15000, status: "مرسلة" },
    ],
    documents: [
      { id: "D-10", name: "عقد صيانة سنوي", type: "عقد", date: "2026-01-10", size: "1.5 MB" },
    ],
    portalUsers: [],
    activityLog: [
      { id: "A-10", date: "2026-03-03 10:00", action: "إنشاء فاتورة", user: "النظام", details: "فاتورة INV-2026-011" },
    ],
  };
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) return parts[0].charAt(0) + parts[1].charAt(0);
  return name.substring(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = ["bg-[#0B1B49]", "bg-[#1276E3]", "bg-[#179FC5]", "bg-[#6B21A8]", "bg-[#166534]", "bg-[#92400E]"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

type TabKey = "overview" | "transactions" | "people" | "documents" | "portal" | "log";

const tabDefs: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: "overview", label: "نظرة عامة", icon: Eye },
  { key: "transactions", label: "العمليات", icon: Receipt },
  { key: "people", label: "الأشخاص", icon: Users },
  { key: "documents", label: "المستندات", icon: FileText },
  { key: "portal", label: "البوابة", icon: Shield },
  { key: "log", label: "السجل", icon: Activity },
];

const txStatusBadge = (status: string) => {
  switch (status) {
    case "مدفوعة": case "مكتمل": return "bg-[#DCFCE7] text-[#166534]";
    case "مرسلة": case "معلقة": return "bg-[#EFF6FF] text-[#1E40AF]";
    case "متأخرة": return "bg-[#FEE2E2] text-[#991B1B]";
    default: return "bg-[#F3F4F6] text-[#374151]";
  }
};

export function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [txFilter, setTxFilter] = useState("الكل");

  const party = getPartyById(id || "P-001");
  const hasCustomerRole = party.roles.includes("عميل");
  const hasVendorRole = party.roles.includes("مورد");

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate("/app/contacts")}
        className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#0B1B49] transition-colors"
        style={{ fontWeight: 500 }}
      >
        <ArrowRight className="h-4 w-4" />
        العودة إلى جهات الاتصال
      </button>

      {/* Party Header */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start gap-5">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className={`${getAvatarColor(party.name)} text-white text-xl`} style={{ fontWeight: 700 }}>
                {getInitials(party.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{party.name}</h1>
                {party.nameEn && <span className="text-sm text-[#9CA3AF] font-english">({party.nameEn})</span>}
                <div className="flex gap-1.5">
                  {party.roles.map((role) => (
                    <span key={role} className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${roleBadgeStyles[role]}`} style={{ fontWeight: 600 }}>{role}</span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-[#6B7280]">
                {party.taxNumber && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    ض: <span className="font-english">{party.taxNumber}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {party.address}
                </span>
                {party.website && (
                  <a href={`https://${party.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#1276E3] hover:underline">
                    <Globe className="h-3.5 w-3.5" />
                    <span className="font-english">{party.website}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-[#374151]">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-[#6B7280]" />
                  <span className="font-english">{party.email}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-[#6B7280]" />
                  <span className="font-english">{party.phone}</span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>
                <Edit className="h-4 w-4" />
                تعديل
              </button>
              <button className="rounded-lg border border-[#E5E7EB] p-2 text-[#EF4444] hover:bg-[#FEE2E2] transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards — unified navy+teal palette matching dashboard */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {hasCustomerRole && (
          <Card className="border-[#E5E7EB] overflow-hidden hover:shadow-md transition-all cursor-pointer relative">
            {/* Colored start strip — navy for customer */}
            <div className="absolute inset-y-0 start-0 w-1 bg-[#0B1B49] rounded-s-xl" />
            <CardContent className="pt-4 pb-4 ps-5 pe-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] text-[#6B7280]" style={{ fontWeight: 600 }}>كعميل لنا</p>
                <div className="rounded-lg bg-[#ECEEF5] p-1.5"><Receipt className="h-[18px] w-[18px] text-[#0B1B49]" /></div>
              </div>
              <div dir="ltr" className="flex items-baseline gap-1.5">
                <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{party.asCustomer.total.toLocaleString()}</span>
                <span className="text-sm text-[#6B7280] font-english" style={{ fontWeight: 500 }}>SR</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{party.asCustomer.invoiceCount}</span> فاتورة</p>
              {/* Progress bar — navy (paid) + teal (overdue) */}
              {party.asCustomer.total > 0 && (
                <div className="mt-3">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-[#F3F4F6]">
                    <div className="bg-[#0B1B49] rounded-s-full" style={{ width: `${(party.asCustomer.paid / party.asCustomer.total) * 100}%` }} />
                    {party.asCustomer.overdue > 0 && (
                      <div className="bg-[#179FC5] rounded-e-full" style={{ width: `${(party.asCustomer.overdue / party.asCustomer.total) * 100}%` }} />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] text-[#166534]" style={{ fontWeight: 600 }}>
                      لصالحنا ✓ <span dir="ltr" className="font-english">SR {party.asCustomer.paid.toLocaleString()}</span>
                    </span>
                    {party.asCustomer.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] text-[#991B1B]" style={{ fontWeight: 600 }}>
                        علينا <span dir="ltr" className="font-english">SR {party.asCustomer.overdue.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasVendorRole && (
          <Card className="border-[#E5E7EB] overflow-hidden hover:shadow-md transition-all cursor-pointer relative">
            {/* Colored start strip — teal for vendor */}
            <div className="absolute inset-y-0 start-0 w-1 bg-[#179FC5] rounded-s-xl" />
            <CardContent className="pt-4 pb-4 ps-5 pe-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] text-[#6B7280]" style={{ fontWeight: 600 }}>كمورد لنا</p>
                <div className="rounded-lg bg-[#E6F7FB] p-1.5"><ShoppingBag className="h-[18px] w-[18px] text-[#179FC5]" /></div>
              </div>
              <div dir="ltr" className="flex items-baseline gap-1.5">
                <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{party.asVendor.total.toLocaleString()}</span>
                <span className="text-sm text-[#6B7280] font-english" style={{ fontWeight: 500 }}>SR</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{party.asVendor.billCount}</span> فواتير</p>
              {party.asVendor.total > 0 && (
                <div className="mt-3">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-[#F3F4F6]">
                    <div className="bg-[#0B1B49] rounded-s-full" style={{ width: `${(party.asVendor.paid / party.asVendor.total) * 100}%` }} />
                    {party.asVendor.overdue > 0 && (
                      <div className="bg-[#179FC5] rounded-e-full" style={{ width: `${(party.asVendor.overdue / party.asVendor.total) * 100}%` }} />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] text-[#166534]" style={{ fontWeight: 600 }}>
                      لصالحنا ✓ <span dir="ltr" className="font-english">SR {party.asVendor.paid.toLocaleString()}</span>
                    </span>
                    {party.asVendor.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] text-[#991B1B]" style={{ fontWeight: 600 }}>
                        علينا <span dir="ltr" className="font-english">SR {party.asVendor.overdue.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-[#E5E7EB] overflow-hidden hover:shadow-md transition-all cursor-pointer relative">
          <div className="absolute inset-y-0 start-0 w-1 bg-[#0B1B49] rounded-s-xl" />
          <CardContent className="pt-4 pb-4 ps-5 pe-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] text-[#6B7280]" style={{ fontWeight: 600 }}>الرصيد الصافي</p>
              <div className="rounded-lg bg-[#ECEEF5] p-1.5"><Wallet className="h-[18px] w-[18px] text-[#0B1B49]" /></div>
            </div>
            <div dir="ltr" className="flex items-baseline gap-1.5">
              <span className={`font-english ${party.netBalance > 0 ? "text-[#22C55E]" : party.netBalance < 0 ? "text-[#EF4444]" : "text-[#6B7280]"}`} style={{ fontSize: "1.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {party.netBalance > 0 ? "+" : ""}{party.netBalance.toLocaleString()}
              </span>
              <span className="text-sm text-[#6B7280] font-english" style={{ fontWeight: 500 }}>SR</span>
            </div>
            <div className="mt-2">
              {party.netBalance > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] text-[#166534]" style={{ fontWeight: 600 }}>لصالحنا ✓</span>
              ) : party.netBalance < 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] text-[#991B1B]" style={{ fontWeight: 600 }}>علينا</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] text-[#6B7280]" style={{ fontWeight: 600 }}>متساوي</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <div className="flex gap-1 overflow-x-auto">
          {tabDefs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-[#1276E3] text-[#1276E3]"
                    : "border-transparent text-[#6B7280] hover:text-[#0B1B49]"
                }`}
                style={{ fontWeight: 500 }}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>معلومات الجهة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "النوع", value: party.type === "organization" ? "منظمة" : "فرد" },
                  { label: "الاسم", value: party.name },
                  ...(party.nameEn ? [{ label: "الاسم بالإنجليزية", value: party.nameEn }] : []),
                  { label: "البريد الإلكتروني", value: party.email, isEn: true },
                  { label: "الهاتف", value: party.phone, isEn: true },
                  ...(party.taxNumber ? [{ label: "الرقم الضريبي", value: party.taxNumber, isEn: true }] : []),
                  ...(party.commercialReg ? [{ label: "السجل التجاري", value: party.commercialReg, isEn: true }] : []),
                  { label: "العنوان", value: party.address },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                    <span className="text-xs text-[#6B7280]" style={{ fontWeight: 500 }}>{item.label}</span>
                    <span className={`text-sm text-[#374151] text-end max-w-[60%] ${item.isEn ? "font-english" : ""}`} style={{ fontWeight: 500 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>الأدوار والصلاحيات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {party.roles.map((role) => (
                  <div key={role} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${roleBadgeStyles[role]}`} style={{ fontWeight: 600 }}>{role}</span>
                    <span className="text-xs text-[#166534]">✓ نشط</span>
                  </div>
                ))}
                <button className="flex items-center gap-1.5 text-sm text-[#1276E3] hover:underline mt-2" style={{ fontWeight: 500 }}>
                  <Plus className="h-3.5 w-3.5" />
                  إضافة دور جديد
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "transactions" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>العمليات</CardTitle>
              <div className="flex items-center gap-2">
                {["الكل", "فواتير مبيعات", "فواتير مشتريات", "سندات"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setTxFilter(f)}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${
                      txFilter === f ? "bg-[#1276E3] text-white" : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "700px" }}>
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    {["الرقم", "النوع", "التاريخ", "الوصف", "المبلغ (SR)", "الحالة", "جهة التواصل"].map((h) => (
                      <th key={h} className="pb-3 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {party.transactions
                    .filter((tx) => {
                      if (txFilter === "الكل") return true;
                      if (txFilter === "فواتير مبيعات") return tx.type === "فاتورة مبيعات";
                      if (txFilter === "فواتير مشتريات") return tx.type === "فاتورة مشتريات";
                      return tx.type.includes("سند");
                    })
                    .map((tx) => (
                      <tr key={tx.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF]">
                        <td className="py-3 pe-3 text-sm font-english text-[#1276E3]" style={{ fontWeight: 500 }}>{tx.id}</td>
                        <td className="py-3 pe-3 text-xs text-[#374151]">{tx.type}</td>
                        <td className="py-3 pe-3 text-sm font-english text-[#374151]">{tx.date}</td>
                        <td className="py-3 pe-3 text-sm text-[#374151] max-w-[200px] truncate">{tx.description}</td>
                        <td className={`py-3 pe-3 text-sm font-english ${tx.amount >= 0 ? "text-[#0B1A47]" : "text-[#349FC4]"}`} style={{ fontWeight: 600 }}>
                          {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                        </td>
                        <td className="py-3 pe-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] ${txStatusBadge(tx.status)}`} style={{ fontWeight: 600 }}>{tx.status}</span>
                        </td>
                        <td className="py-3 pe-3 text-xs text-[#6B7280]">{tx.person || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "people" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>
                  الأشخاص المرتبطون <span className="text-[#6B7280] font-english" style={{ fontWeight: 400 }}>({party.contactPersons.length})</span>
                </CardTitle>
                <div className="relative">
                  <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                  <input type="text" placeholder="بحث بالاسم أو الدور..." className="rounded-md border border-[#E5E7EB] bg-white ps-8 pe-3 py-1.5 text-xs text-[#374151] placeholder:text-[#9CA3AF] w-60 focus:border-[#1276E3] focus:outline-none" />
                </div>
              </div>
              <button className="flex items-center gap-1.5 rounded-lg bg-[#1276E3] px-3 py-1.5 text-xs text-white hover:bg-[#0F63C3] transition-colors" style={{ fontWeight: 500 }}>
                <UserPlus className="h-3.5 w-3.5" />
                إضافة شخص
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {party.contactPersons.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-16 w-16 text-[#D1D5DB] mx-auto mb-3" />
                  <p className="text-sm text-[#6B7280]">لا يوجد أشخاص مرتبطين بهذه الجهة</p>
                  <button className="mt-3 flex items-center gap-1.5 mx-auto rounded-lg border border-[#1276E3] px-4 py-2 text-sm text-[#1276E3] hover:bg-[#EFF6FF] transition-colors" style={{ fontWeight: 500 }}>
                    <UserPlus className="h-4 w-4" />
                    إضافة أول شخص
                  </button>
                </div>
              ) : (
                party.contactPersons.map((cp, idx) => {
                  const mockPersonalRoles: string[][] = [
                    ["مساهم", "فري لانسر"],
                    ["عميل"],
                    [],
                  ];
                  const mockAssociations: { icon: React.ElementType; text: string; link: string }[][] = [
                    [
                      { icon: FolderKanban, text: "مشروع تطوير الموقع — مع سارة (موظفة)", link: "#" },
                    ],
                    [
                      { icon: Building2, text: "يمثّل: شركة الاتصالات السعودية (STC)", link: "#" },
                    ],
                    [
                      { icon: FolderKanban, text: "مشروع التحول الرقمي", link: "#" },
                      { icon: PieChart, text: "مساهم في شركتك بنسبة 5%", link: "#" },
                    ],
                  ];
                  const personalRoles = mockPersonalRoles[idx] || [];
                  const associations = mockAssociations[idx] || [];
                  const personalRoleBadgeColor: Record<string, string> = {
                    "مساهم": "bg-[#E0F2FE] text-[#075985]",
                    "فري لانسر": "bg-[#FEF3C7] text-[#92400E]",
                    "عميل": "bg-[#DBEAFE] text-[#1E40AF]",
                    "موظف": "bg-[#F3E8FF] text-[#6B21A8]",
                  };

                  return (
                    <div key={cp.id} className="rounded-xl border border-[#E5E7EB] p-4 hover:border-[#1276E3] hover:shadow-[0_2px_8px_rgba(18,118,227,0.1)] transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 mt-0.5 shrink-0">
                            <AvatarFallback className={`${getAvatarColor(cp.name)} text-white text-sm`} style={{ fontWeight: 600 }}>
                              {getInitials(cp.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <button className="text-[15px] text-[#0B1B49] hover:text-[#1276E3] hover:underline transition-colors" style={{ fontWeight: 700 }}>{cp.name}</button>
                              {hasCustomerRole && (
                                <span className="inline-flex rounded-md bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] text-[#1E40AF]" style={{ fontWeight: 600 }}>عميل</span>
                              )}
                            </div>
                            <div className="text-[13px] text-[#6B7280] mt-0.5">{cp.role} — {cp.department}</div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[#6B7280]">
                              <span className="flex items-center gap-1 font-english"><Mail className="h-3 w-3" />{cp.email}</span>
                              <span className="text-[#D1D5DB]">|</span>
                              <span className="flex items-center gap-1 font-english"><Phone className="h-3 w-3" />{cp.phone}</span>
                            </div>

                            {/* Personal roles */}
                            {personalRoles.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[11px] text-[#9CA3AF]">أدوار شخصية:</span>
                                {personalRoles.map((r) => (
                                  <span key={r} className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] ${personalRoleBadgeColor[r] || "bg-[#F3F4F6] text-[#6B7280]"}`} style={{ fontWeight: 600 }}>{r}</span>
                                ))}
                              </div>
                            )}

                            {/* Associations */}
                            {associations.length > 0 && (
                              <div className="mt-2 rounded-lg bg-[#F9FAFB] px-3 py-2 space-y-1">
                                {associations.map((assoc, ai) => {
                                  const AssocIcon = assoc.icon;
                                  return (
                                    <div key={ai} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                                      <Link2 className="h-3 w-3 text-[#9CA3AF] shrink-0" />
                                      <AssocIcon className="h-3 w-3 text-[#1276E3] shrink-0" />
                                      <span>{assoc.text}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action menu */}
                        <div className="relative">
                          <button className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><MoreVertical className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "documents" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>المستندات</CardTitle>
              <button className="flex items-center gap-1.5 rounded-lg bg-[#1276E3] px-3 py-1.5 text-xs text-white hover:bg-[#0F63C3] transition-colors" style={{ fontWeight: 500 }}>
                <Plus className="h-3.5 w-3.5" />
                رفع مستند
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    {["اسم المستند", "النوع", "التاريخ", "الحجم", "إجراءات"].map((h) => (
                      <th key={h} className="pb-3 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {party.documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF]">
                      <td className="py-3 pe-3 text-sm text-[#374151]" style={{ fontWeight: 500 }}>{doc.name}</td>
                      <td className="py-3 pe-3">
                        <span className="inline-flex rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[10px] text-[#374151]" style={{ fontWeight: 600 }}>{doc.type}</span>
                      </td>
                      <td className="py-3 pe-3 text-sm font-english text-[#6B7280]">{doc.date}</td>
                      <td className="py-3 pe-3 text-xs font-english text-[#6B7280]">{doc.size}</td>
                      <td className="py-3 pe-3">
                        <button className="rounded-md p-1 text-[#1276E3] hover:bg-[#EFF6FF] transition-colors">
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "portal" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>إدارة الوصول للبوابة</CardTitle>
                <p className="text-xs text-[#6B7280] mt-1">إدارة صلاحيات الوصول للأشخاص المرتبطين بهذه الجهة</p>
              </div>
              <button className="flex items-center gap-1.5 rounded-lg bg-[#1276E3] px-3 py-1.5 text-xs text-white hover:bg-[#0F63C3] transition-colors" style={{ fontWeight: 500 }}>
                <Send className="h-3.5 w-3.5" />
                دعوة شخص للبوابة
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {party.portalUsers.length === 0 ? (
              <div className="py-12 text-center">
                <Shield className="h-12 w-12 text-[#9CA3AF] mx-auto mb-3" />
                <p className="text-sm text-[#6B7280]">لا يوجد مستخدمون للبوابة بعد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      {["الاسم", "البريد", "مستوى الوصول", "آخر دخول", "إجراءات"].map((h) => (
                        <th key={h} className="pb-3 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {party.portalUsers.map((pu) => (
                      <tr key={pu.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF]">
                        <td className="py-3 pe-3 text-sm text-[#374151]" style={{ fontWeight: 500 }}>{pu.name}</td>
                        <td className="py-3 pe-3 text-sm font-english text-[#6B7280]">{pu.email}</td>
                        <td className="py-3 pe-3">
                          <span className="inline-flex rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[10px] text-[#1E40AF]" style={{ fontWeight: 600 }}>{pu.level}</span>
                        </td>
                        <td className="py-3 pe-3 text-sm font-english text-[#6B7280]">{pu.lastLogin}</td>
                        <td className="py-3 pe-3">
                          <button className="rounded-md px-2 py-1 text-xs text-[#EF4444] hover:bg-[#FEE2E2] transition-colors" style={{ fontWeight: 500 }}>إلغاء الوصول</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Access Levels Info */}
            <div className="mt-5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] p-4">
              <p className="text-xs text-[#6B7280] mb-2" style={{ fontWeight: 600 }}>مستويات الوصول</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  { level: "شخصي", desc: "عمليات الشخص فقط" },
                  { level: "قسم", desc: "عمليات القسم" },
                  { level: "منظمة كاملة", desc: "جميع عمليات المنظمة" },
                  { level: "مدقق", desc: "قراءة فقط - تدقيق" },
                ].map((l) => (
                  <div key={l.level} className="text-center">
                    <div className="text-xs text-[#0B1B49]" style={{ fontWeight: 600 }}>{l.level}</div>
                    <div className="text-[10px] text-[#6B7280]">{l.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "log" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem" }}>سجل النشاط</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute start-4 top-0 bottom-0 w-px bg-[#E5E7EB]" />

              <div className="space-y-6">
                {party.activityLog.map((log, i) => (
                  <div key={log.id} className="relative flex gap-4 ps-10">
                    {/* Dot */}
                    <div className={`absolute start-2 top-1 w-4 h-4 rounded-full border-2 ${
                      i === 0 ? "bg-[#1276E3] border-[#1276E3]" : "bg-white border-[#E5E7EB]"
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{log.action}</span>
                        <span className="text-xs text-[#9CA3AF] font-english shrink-0">{log.date}</span>
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5">{log.details}</p>
                      <span className="text-[10px] text-[#9CA3AF] mt-1 inline-block">بواسطة: {log.user}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}