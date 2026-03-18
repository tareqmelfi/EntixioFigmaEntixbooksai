import { useState } from "react";
import {
  Plug, Search, CheckCircle2, Clock, AlertCircle, ExternalLink,
  Zap, Globe, CreditCard, FileText, ShoppingCart, MessageSquare,
  Smartphone, Building2, Shield, Webhook
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

type IntegrationStatus = "connected" | "available" | "coming";

interface Integration {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  category: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  status: IntegrationStatus;
}

const integrations: Integration[] = [
  { id: "zatca", name: "ZATCA (FATOORA)", nameAr: "هيئة الزكاة والضريبة", description: "فوترة إلكترونية متوافقة مع المرحلة 2", category: "حكومي", icon: Shield, iconColor: "#0B1A47", iconBg: "#ECEEF5", status: "available" },
  { id: "gosi", name: "GOSI", nameAr: "التأمينات الاجتماعية", description: "ربط تلقائي مع نظام التأمينات", category: "حكومي", icon: Building2, iconColor: "#0B1A47", iconBg: "#ECEEF5", status: "coming" },
  { id: "plaid", name: "Plaid", nameAr: "الربط البنكي (US)", description: "ربط الحسابات البنكية الأمريكية تلقائياً", category: "بنكي", icon: CreditCard, iconColor: "#1276E3", iconBg: "#EFF6FF", status: "available" },
  { id: "lean", name: "Lean Technologies", nameAr: "الربط البنكي (GCC)", description: "Open Banking للبنوك الخليجية", category: "بنكي", icon: CreditCard, iconColor: "#1276E3", iconBg: "#EFF6FF", status: "coming" },
  { id: "stripe", name: "Stripe", nameAr: "بوابة الدفع", description: "قبول المدفوعات عبر الإنترنت", category: "مدفوعات", icon: Zap, iconColor: "#7C3AED", iconBg: "#F3E8FF", status: "available" },
  { id: "moyasar", name: "Moyasar", nameAr: "ميسّر", description: "بوابة دفع سعودية (مدى + فيزا)", category: "مدفوعات", icon: Zap, iconColor: "#7C3AED", iconBg: "#F3E8FF", status: "available" },
  { id: "salla", name: "Salla", nameAr: "سلة", description: "ربط مع متجر سلة الإلكتروني", category: "تجارة إلكترونية", icon: ShoppingCart, iconColor: "#349FC4", iconBg: "#E4F4F9", status: "available" },
  { id: "zid", name: "Zid", nameAr: "زد", description: "ربط مع متجر زد الإلكتروني", category: "تجارة إلكترونية", icon: ShoppingCart, iconColor: "#349FC4", iconBg: "#E4F4F9", status: "available" },
  { id: "shopify", name: "Shopify", nameAr: "شوبيفاي", description: "ربط مع متجر Shopify", category: "تجارة إلكترونية", icon: ShoppingCart, iconColor: "#349FC4", iconBg: "#E4F4F9", status: "coming" },
  { id: "whatsapp", name: "WhatsApp Business", nameAr: "واتساب أعمال", description: "إرسال الفواتير والتنبيهات عبر واتساب", category: "تواصل", icon: MessageSquare, iconColor: "#166534", iconBg: "#DCFCE7", status: "coming" },
  { id: "webhook", name: "Webhooks", nameAr: "ويب هوكس", description: "ربط مخصص مع أي نظام خارجي", category: "مطور", icon: Webhook, iconColor: "#374151", iconBg: "#F3F4F6", status: "available" },
  { id: "api", name: "REST API", nameAr: "واجهة برمجية", description: "API كامل للتكامل مع أنظمتك", category: "مطور", icon: Globe, iconColor: "#374151", iconBg: "#F3F4F6", status: "connected" },
];

const statusConfig: Record<IntegrationStatus, { label: string; color: string; bg: string }> = {
  connected: { label: "متصل", color: "text-[#0B1A47]", bg: "bg-[#ECEEF5]" },
  available: { label: "متاح", color: "text-[#1276E3]", bg: "bg-[#EFF6FF]" },
  coming: { label: "قريباً", color: "text-[#92400E]", bg: "bg-[#FEF3C7]" },
};

export function Integrations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const categories = [...new Set(integrations.map(i => i.category))];
  const filtered = integrations.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.nameAr.includes(searchQuery) || i.description.includes(searchQuery);
    const matchesCategory = !categoryFilter || i.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>التكاملات</h1>
          <p className="text-[#6B7280] mt-1">اربط Entix Books مع خدماتك المفضلة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><CheckCircle2 className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{integrations.filter(i => i.status === "connected").length}</div>
            <p className="text-xs text-[#6B7280] mt-1">متصل</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Plug className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#1276E3] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{integrations.filter(i => i.status === "available").length}</div>
            <p className="text-xs text-[#6B7280] mt-1">متاح للربط</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#FEF3C7] p-2.5"><Clock className="h-5 w-5 text-[#92400E]" /></div></div>
            <div className="text-[#92400E] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{integrations.filter(i => i.status === "coming").length}</div>
            <p className="text-xs text-[#6B7280] mt-1">قريباً</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input placeholder="بحث عن تكامل..." className="ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setCategoryFilter("")} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${!categoryFilter ? "bg-[#1276E3] text-white" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"}`} style={{ fontWeight: 600 }}>الكل</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${categoryFilter === c ? "bg-[#1276E3] text-white" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"}`} style={{ fontWeight: 600 }}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((integration) => {
          const cfg = statusConfig[integration.status];
          const Icon = integration.icon;
          return (
            <Card key={integration.id} className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl p-2.5" style={{ backgroundColor: integration.iconBg }}>
                      <Icon className="h-5 w-5" style={{ color: integration.iconColor }} />
                    </div>
                    <div>
                      <div className="font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{integration.name}</div>
                      <div className="text-xs text-[#6B7280]">{integration.nameAr}</div>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${cfg.bg} ${cfg.color}`} style={{ fontWeight: 600 }}>{cfg.label}</span>
                </div>
                <p className="text-sm text-[#6B7280] mb-3">{integration.description}</p>
                {integration.status === "connected" && (
                  <Button variant="outline" className="w-full border-[#0B1A47] text-[#0B1A47]" size="sm">إعدادات</Button>
                )}
                {integration.status === "available" && (
                  <Button className="w-full bg-[#1276E3] hover:bg-[#1060C0]" size="sm">ربط الآن</Button>
                )}
                {integration.status === "coming" && (
                  <Button variant="outline" className="w-full border-[#E5E7EB] text-[#9CA3AF]" size="sm" disabled>قريباً</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
