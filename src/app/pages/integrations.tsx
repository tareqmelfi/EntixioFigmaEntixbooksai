import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Plug, Search, CheckCircle2, Clock,
  Zap, Globe, CreditCard, ShoppingCart, MessageSquare,
  Building2, Shield, Webhook,
  type LucideIcon
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useOrgRegion } from "../lib/use-org-region";
import { useLanguage } from "../components/LanguageContext";
import { api } from "../lib/api";

type IntegrationStatus = "connected" | "available" | "coming";
type CategoryKey = "government" | "banking" | "payments" | "ecommerce" | "communication" | "developer";

interface Integration {
  id: string;
  name: string;
  nameAr: string;
  description: { ar: string; en: string };
  category: CategoryKey;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  status: IntegrationStatus;
  /** Where the card's action button actually goes — every card must DO something real */
  action?: { kind: "route"; to: string } | { kind: "external"; to: string };
}

const CATEGORY_LABELS: Record<CategoryKey, { ar: string; en: string }> = {
  government: { ar: "حكومي", en: "Government" },
  banking: { ar: "بنكي", en: "Banking" },
  payments: { ar: "مدفوعات", en: "Payments" },
  ecommerce: { ar: "تجارة إلكترونية", en: "E-commerce" },
  communication: { ar: "تواصل", en: "Communication" },
  developer: { ar: "مطور", en: "Developer" },
};

const statusConfig: Record<IntegrationStatus, { label: { ar: string; en: string }; color: string; bg: string }> = {
  connected: { label: { ar: "متصل", en: "Connected" }, color: "text-foreground", bg: "bg-muted" },
  available: { label: { ar: "متاح", en: "Available" }, color: "text-primary", bg: "bg-primary/5" },
  coming: { label: { ar: "قريباً", en: "Coming soon" }, color: "text-amber-800", bg: "bg-amber-100" },
};

export function Integrations() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey | "">("");
  const { isSA } = useOrgRegion();

  // ── Live connection state (replaces the old static list) ──────────────
  const [oauth, setOauth] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    api.orgs.list().then(async (list) => {
      if (!alive) return;
      const storedId = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
      const active = (storedId ? list.find((o) => o.id === storedId) : null) || list[0];
      if (!active) return;
      try {
        const status = await (api as any).oauth.status(active.id);
        if (alive) setOauth(status);
      } catch { /* status chips fall back to org fields */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const stripeConnected = !!oauth?.stripe?.connected;
  const moyasarConnected = !!oauth?.moyasar?.connected;
  const integrations: Integration[] = [
    { id: "zatca", name: "ZATCA (FATOORA)", nameAr: "هيئة الزكاة والضريبة", description: { ar: "ZATCA Phase 2 — قيد التحقق · غير مفعّل للاعتماد الإنتاجي", en: "ZATCA Phase 2 — Under validation · not enabled for production reliance" }, category: "government", icon: Shield, iconColor: "#0B1B49", iconBg: "#ECEEF5", status: "coming", action: { kind: "route", to: "/app/settings?tab=zatca" } },
    { id: "gosi", name: "GOSI", nameAr: "التأمينات الاجتماعية", description: { ar: "ربط تلقائي مع نظام التأمينات", en: "Automatic sync with the social insurance system" }, category: "government", icon: Building2, iconColor: "#0B1B49", iconBg: "#ECEEF5", status: "coming" },
    { id: "plaid", name: "Plaid", nameAr: "الربط البنكي (US)", description: { ar: "ربط الحسابات البنكية الأمريكية تلقائياً", en: "Connect US bank accounts automatically" }, category: "banking", icon: CreditCard, iconColor: "#1276E3", iconBg: "#EFF6FF", status: "available", action: { kind: "route", to: "/app/integrations/plaid" } },
    { id: "lean", name: "Lean Technologies", nameAr: "الربط البنكي (GCC)", description: { ar: "Open Banking للبنوك الخليجية", en: "Open Banking for GCC banks" }, category: "banking", icon: CreditCard, iconColor: "#1276E3", iconBg: "#EFF6FF", status: "coming" },
    { id: "stripe", name: "Stripe", nameAr: "بوابة الدفع", description: { ar: "قبول المدفوعات عبر الإنترنت", en: "Accept online payments" }, category: "payments", icon: Zap, iconColor: "#7C3AED", iconBg: "#F3E8FF", status: stripeConnected ? "connected" : "available", action: { kind: "route", to: "/app/settings?tab=payments" } },
    { id: "moyasar", name: "Moyasar", nameAr: "ميسّر", description: { ar: "بوابة دفع سعودية (مدى + فيزا)", en: "Saudi payment gateway (mada + Visa)" }, category: "payments", icon: Zap, iconColor: "#7C3AED", iconBg: "#F3E8FF", status: moyasarConnected ? "connected" : "available", action: { kind: "route", to: "/app/settings?tab=payments" } },
    { id: "paypal", name: "PayPal", nameAr: "باي بال", description: { ar: "قبول المدفوعات الدولية", en: "Accept international payments" }, category: "payments", icon: Zap, iconColor: "#7C3AED", iconBg: "#F3E8FF", status: "coming" },
    { id: "salla", name: "Salla", nameAr: "سلة", description: { ar: "ربط مع متجر سلة الإلكتروني", en: "Connect your Salla online store" }, category: "ecommerce", icon: ShoppingCart, iconColor: "#349FC4", iconBg: "#E4F4F9", status: "coming" },
    { id: "zid", name: "Zid", nameAr: "زد", description: { ar: "ربط مع متجر زد الإلكتروني", en: "Connect your Zid online store" }, category: "ecommerce", icon: ShoppingCart, iconColor: "#349FC4", iconBg: "#E4F4F9", status: "coming" },
    { id: "shopify", name: "Shopify", nameAr: "شوبيفاي", description: { ar: "ربط مع متجر Shopify", en: "Connect your Shopify store" }, category: "ecommerce", icon: ShoppingCart, iconColor: "#349FC4", iconBg: "#E4F4F9", status: "coming" },
    { id: "whatsapp", name: "WhatsApp Business", nameAr: "واتساب أعمال", description: { ar: "إرسال الفواتير والتنبيهات عبر واتساب", en: "Send invoices and alerts via WhatsApp" }, category: "communication", icon: MessageSquare, iconColor: "#166534", iconBg: "#DCFCE7", status: "coming" },
    { id: "webhook", name: "Webhooks", nameAr: "ويب هوكس", description: { ar: "ربط مخصص مع أي نظام خارجي", en: "Custom integration with any external system" }, category: "developer", icon: Webhook, iconColor: "#374151", iconBg: "#F3F4F6", status: "coming" },
    { id: "api", name: "REST API", nameAr: "واجهة برمجية", description: { ar: "API كامل للتكامل مع أنظمتك", en: "Full API to integrate with your systems" }, category: "developer", icon: Globe, iconColor: "#374151", iconBg: "#F3F4F6", status: "connected", action: { kind: "external", to: "https://api.entix.io/health" } },
  ];

  const categories = [...new Set(integrations.map(i => i.category))];
  const filtered = integrations.filter(i => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = i.name.toLowerCase().includes(q) || i.nameAr.includes(searchQuery) || i.description.ar.includes(searchQuery) || i.description.en.toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || i.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const runAction = (integration: Integration) => {
    if (!integration.action) return;
    if (integration.action.kind === "route") navigate(integration.action.to);
    else window.open(integration.action.to, "_blank", "noopener");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("التكاملات", "Integrations")}</h1>
          <p className="text-muted-foreground mt-1">{t("اربط ENTIX.IO مع خدماتك المفضلة", "Connect ENTIX.IO with your favorite services")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-muted p-2.5"><CheckCircle2 className="h-5 w-5 text-foreground" /></div></div>
            <div className="text-foreground font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{integrations.filter(i => i.status === "connected").length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("متصل", "Connected")}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-primary/5 p-2.5"><Plug className="h-5 w-5 text-primary" /></div></div>
            <div className="text-primary font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{integrations.filter(i => i.status === "available").length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("متاح للربط", "Available")}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-amber-100 p-2.5"><Clock className="h-5 w-5 text-amber-800" /></div></div>
            <div className="text-amber-800 font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{integrations.filter(i => i.status === "coming").length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("قريباً", "Coming soon")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input placeholder={t("بحث عن تكامل...", "Search integrations...")} className="ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setCategoryFilter("")} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${!categoryFilter ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`} style={{ fontWeight: 600 }}>{t("الكل", "All")}</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${categoryFilter === c ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`} style={{ fontWeight: 600 }}>{isAr ? CATEGORY_LABELS[c].ar : CATEGORY_LABELS[c].en}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((integration) => {
          const regionLocked = integration.id === "zatca" && !isSA;
          const cfg = regionLocked
            ? { label: { ar: "للسعودية فقط", en: "Saudi only" }, color: "text-muted-foreground/70", bg: "bg-muted" }
            : statusConfig[integration.status];
          const Icon = integration.icon;
          return (
            <Card key={integration.id} className={`border-border transition-all ${regionLocked ? "opacity-60" : "hover:shadow-md hover:border-primary/30 cursor-pointer"}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl p-2.5" style={{ backgroundColor: integration.iconBg }}>
                      <Icon className="h-5 w-5" style={{ color: integration.iconColor }} />
                    </div>
                    <div>
                      <div className="font-english text-foreground" style={{ fontWeight: 600 }}>{integration.name}</div>
                      {isAr && <div className="text-xs text-muted-foreground">{integration.nameAr}</div>}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${cfg.bg} ${cfg.color}`} style={{ fontWeight: 600 }}>{isAr ? cfg.label.ar : cfg.label.en}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{isAr ? integration.description.ar : integration.description.en}</p>
                {integration.status === "connected" && (
                  <Button variant="outline" className="w-full border-foreground text-foreground" size="sm" onClick={() => runAction(integration)}>{t("إعدادات", "Settings")}</Button>
                )}
                {integration.status === "available" && !regionLocked && (
                  <Button className="w-full bg-primary hover:bg-primary/90" size="sm" onClick={() => runAction(integration)}>{t("ربط الآن", "Connect now")}</Button>
                )}
                {regionLocked && (
                  <Button variant="outline" className="w-full border-border text-muted-foreground/60" size="sm" disabled>
                    {t("متاح للمنشآت السعودية فقط", "Available for Saudi companies only")}
                  </Button>
                )}
                {integration.status === "coming" && (
                  <Button variant="outline" className="w-full border-border text-muted-foreground/60" size="sm" disabled>{t("قريباً", "Coming soon")}</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
