import { useState } from "react";
import {
  CheckCircle, Clock, AlertCircle, Zap, Lock, Globe,
  FileText, Calculator, Users, BarChart3, CreditCard,
  Shield, Brain, Package, Building2, Wallet, Layers,
  Target, ChevronDown, ChevronRight, Star, Sparkles,
  ArrowRight, ExternalLink, GitBranch, Plug, Landmark,
  FolderKanban, Handshake, FileCode
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

// ── Types ──
type FeatureStatus = "live" | "partial" | "planned" | "phase2" | "phase3";

interface Feature {
  name: string;
  nameEn?: string;
  status: FeatureStatus;
  description: string;
  details?: string[];
  critical?: boolean;
}

interface FeatureModule {
  title: string;
  titleEn?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  features: Feature[];
}

const statusConfig: Record<FeatureStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  live: { label: "مفعّل", color: "text-[#166534]", bg: "bg-[#DCFCE7]", icon: CheckCircle },
  partial: { label: "جزئي", color: "text-[#92400E]", bg: "bg-[#FEF3C7]", icon: AlertCircle },
  planned: { label: "مخطط", color: "text-[#1E40AF]", bg: "bg-[#DBEAFE]", icon: Clock },
  phase2: { label: "المرحلة 2", color: "text-[#6B21A8]", bg: "bg-[#F3E8FF]", icon: Target },
  phase3: { label: "المرحلة 3", color: "text-[#9D174D]", bg: "bg-[#FCE7F3]", icon: Sparkles },
};

// ── Feature Modules ──
const modules: FeatureModule[] = [
  {
    title: "المحاسبة العامة",
    titleEn: "General Ledger",
    icon: Calculator,
    color: "text-[#0B1B49]",
    bgColor: "bg-[#0B1B49]/10",
    features: [
      { name: "دليل الحسابات", status: "live", description: "شجرة حسابات متعددة المستويات مع إمكانية التوسيع والطي", details: ["هيكل شجري تفاعلي", "تصنيفات: أصل / التزام / حقوق ملكية / إيراد / مصروف", "بحث وفلترة متقدمة", "KPI cards قابلة للنقر مع فلترة الشجرة"] },
      { name: "قوالب GAAP / IFRS", status: "partial", description: "قوالب معيارية حسب نوع النشاط التجاري", details: ["قالب أساسي موجود", "يحتاج: قوالب جاهزة حسب القطاع (تقنية / تجزئة / مقاولات / خدمات)"], critical: true },
      { name: "قيود اليومية", status: "live", description: "إنشاء وإدارة قيود يدوية مع workflow كامل", details: ["مسودة → مرحّل → ملغي", "التحقق من التوازن (مدين = دائن)", "ربط بمراكز التكلفة", "عرض تفاصيل القيد"] },
      { name: "مراكز التكلفة", status: "live", description: "تتبع المصاريف والإيرادات حسب مركز التكلفة", details: ["متاح في كل سطر قيد", "تقارير حسب مركز التكلفة في التقارير"] },
      { name: "هيكل مراكز تكلفة متعدد المستويات", status: "planned", description: "هيكل هرمي لمراكز التكلفة مع تقارير مفصلة", critical: true },
      { name: "تعدد العملات", status: "partial", description: "دعم عملات متعددة مع تحويل سعر الصرف", details: ["تم: تعريف العملة لكل جهة اتصال (أجنبية)", "يحتاج: تحويل سعر الصرف التلقائي في الفواتير", "يحتاج: حسابات أرباح/خسائر فروق العملة"], critical: true },
      { name: "السنة المالية", status: "planned", description: "إدارة الفترات المالية مع إقفال وفتح الفترات", details: ["تعريف بداية ونهاية السنة", "إقفال الفترات (شهري/ربعي/سنوي)", "قيود الإقفال التلقائية"], critical: true },
    ],
  },
  {
    title: "المبيعات",
    titleEn: "Sales",
    icon: FileText,
    color: "text-[#1276E3]",
    bgColor: "bg-[#1276E3]/10",
    features: [
      { name: "فواتير المبيعات", status: "live", description: "إنشاء وإدارة فواتير المبيعات بالكامل", details: ["إنشاء / تعديل / عرض / حذف", "بنود ذكية مع ضريبة القيمة المضافة", "حالات: مسودة / مرسلة / مدفوعة / متأخرة", "بحث + فلتر بالحالة", "KPI cards قابلة للنقر"] },
      { name: "اقتراح ذكي للبنود", status: "planned", description: "اقتراح تلقائي من قاعدة المنتجات عند الكتابة", details: ["قاعدة بيانات المنتجات/الخدمات", "اقتراح السعر والوصف تلقائياً"] },
      { name: "عروض الأسعار", status: "live", description: "إنشاء عروض أسعار مع تحويلها لفواتير", details: ["إنشاء عرض سعر كامل", "حالات: مسودة / مرسل / مقبول / مرفوض / محوّل لفاتورة", "تحويل مباشر لفاتورة بضغطة"] },
      { name: "سندات القبض", status: "live", description: "تسجيل المدفوعات المستلمة من العملاء", details: ["ربط بالفاتورة", "طرق دفع متعددة", "KPI cards مع إجماليات"] },
      { name: "الإشعارات الدائنة", status: "live", description: "إصدار إشعارات دائنة للمرتجعات", details: ["ربط بالفاتورة الأصلية", "حالات: مسودة / صادر / مطبق"] },
      { name: "ترقيم تسلسلي مع بادئة قابلة للتخصيص", status: "partial", description: "ترقيم تلقائي مع إمكانية تعديل البادئة", details: ["ترقيم تسلسلي موجود (INV-2026-XXX)", "يحتاج: إعدادات تخصيص البادئة والصيغة"] },
    ],
  },
  {
    title: "المشتريات",
    titleEn: "Purchases",
    icon: Package,
    color: "text-[#166534]",
    bgColor: "bg-[#166534]/10",
    features: [
      { name: "فواتير المشتريات", status: "live", description: "إدارة فواتير الموردين مع ربط المورد", details: ["إنشاء / عرض / حذف", "ربط بالمورد مع بحث ذكي", "بنود مع ضريبة"] },
      { name: "سندات الدفع", status: "live", description: "تسجيل المدفوعات للموردين" },
      { name: "المصروفات النقدية", status: "live", description: "تسجيل المصاريف اليومية مع التصنيف" },
      { name: "ربط المشتريات بالمدفوعات", status: "partial", description: "تخصيص المدفوعات على فواتير الشراء", details: ["يحتاج: شاشة تخصيص مدفوعات على فواتير متعددة"] },
    ],
  },
  {
    title: "الفوترة الإلكترونية (ZATCA)",
    titleEn: "E-Invoicing",
    icon: Shield,
    color: "text-[#166534]",
    bgColor: "bg-[#166534]/10",
    features: [
      { name: "UUID 128-bit لكل فاتورة", status: "planned", description: "معرف فريد عالمي لكل فاتورة", critical: true },
      { name: "ربط تسلسلي مشفر (Sequential Hash)", status: "planned", description: "ربط كل فاتورة بالسابقة تشفيرياً", critical: true },
      { name: "رمز QR مع 9 عناصر TLV", status: "planned", description: "QR يحتوي بيانات البائع والضريبة بتشفير Base64", critical: true, details: ["اسم البائع", "الرقم الضريبي", "تاريخ الفاتورة", "إجمالي الفاتورة", "مبلغ الضريبة", "Hash الفاتورة", "التوقيع الرقمي", "المفتاح العام", "ختم CSID"] },
      { name: "ختم CSID التشفيري", status: "partial", description: "توقيع رقمي من هيئة الزكاة والضريبة", details: ["حقل CSID موجود في الإعدادات", "يحتاج: التطبيق الفعلي على الفواتير"] },
      { name: "عداد فواتير غير قابل لإعادة التعيين", status: "live", description: "عداد تسلسلي متطلب من ZATCA (موجود في الإعدادات)" },
      { name: "صيغة XML/UBL 2.1 + PDF/A-3", status: "planned", description: "تصدير الفواتير بالصيغة المعتمدة", critical: true },
      { name: "تكامل API مع منصة فاتورة", status: "partial", description: "ربط مع FATOORA platform", details: ["إعدادات الاتصال موجودة", "يحتاج: التكامل الفعلي للـ API"] },
      { name: "المرحلة 1 (الإصدار): QR للـ B2C", status: "planned", description: "رمز QR للمستهلكين + حفظ إلكتروني", critical: true },
      { name: "المرحلة 2 (التكامل): API للـ B2B", status: "planned", description: "اعتماد فوري B2B + إبلاغ B2C خلال 24 ساعة", critical: true },
      { name: "بيئة اختبار Sandbox", status: "planned", description: "بيئة اختبار للتحقق من التكامل قبل الإنتاج" },
    ],
  },
  {
    title: "التقارير المالية",
    titleEn: "Financial Reports",
    icon: BarChart3,
    color: "text-[#179FC5]",
    bgColor: "bg-[#179FC5]/10",
    features: [
      { name: "ميزان المراجعة", status: "live", description: "تقرير ميزان المراجعة" },
      { name: "قائمة الدخل", status: "live", description: "قائمة الأرباح والخسائر (P&L)", details: ["عادية / بحسب الفرع / بحسب مركز التكلفة / بحسب المشروع"] },
      { name: "قائمة المركز المالي", status: "live", description: "الميزانية العمومية (Balance Sheet)" },
      { name: "قائمة التدفقات النقدية", status: "live", description: "مباشرة وغير مباشرة", details: ["الطريقة المباشرة", "الطريقة غير المباشرة"] },
      { name: "إقرار ضريبة القيمة المضافة", status: "live", description: "تقرير VAT Return" },
      { name: "فلترة نطاق تاريخي", status: "live", description: "تحديد فترة زمنية مخصصة للتقارير" },
      { name: "تصدير PDF / Excel", status: "live", description: "تصدير جميع التقارير" },
      { name: "تقارير موحدة (Consolidated)", status: "live", description: "ميزانية ودخل وتدفق نقدي موحد لمتعدد الشركات" },
      { name: "تقارير الإدارة (PDF)", status: "live", description: "تقارير تنفيذية شاملة" },
    ],
  },
  {
    title: "جهات الاتصال (Party Model)",
    titleEn: "Contacts & CRM",
    icon: Users,
    color: "text-[#6B21A8]",
    bgColor: "bg-[#6B21A8]/10",
    features: [
      { name: "إدارة العملاء", status: "live", description: "إدارة كاملة مع بيانات الاتصال والأدوار المتعددة" },
      { name: "حدود ائتمانية للعملاء", status: "planned", description: "تعيين سقف ائتماني مع تنبيهات عند التجاوز", critical: true },
      { name: "إدارة الموردين", status: "live", description: "بيانات الموردين مع الأدوار والتصنيفات" },
      { name: "شروط الدفع للموردين", status: "partial", description: "تعيين شروط دفع افتراضية لكل مورد", details: ["موجود في الفواتير", "يحتاج: ربط مع ملف المورد"] },
      { name: "ملفات ال��ستقلين (Freelancers)", status: "live", description: "تسجيل وإدارة المتعاونين المستقلين" },
      { name: "خط زمني للنشاط", status: "live", description: "سجل كامل لتاريخ التفاعلات والمعاملات" },
      { name: "CRM خفيف", status: "partial", description: "ملاحظات وتصنيفات وآخر تفاعل", details: ["سجل النشاط موجود", "يحتاج: tags / ملاحظات حرة / تذكيرات"] },
      { name: "بحث ذكي وإنشاء فوري", status: "live", description: "اكتب اسم العميل في أي نموذج واختر أو أنشئ جديد بدون مغادرة الصفحة", details: ["بحث أثناء الكتابة (Autocomplete)", "إنشاء سريع مع نموذج مدمج", "تصنيف محلي / أجنبي", "بيانات ضريبية (VAT / ITN / LEI)", "ضريبة الاستقطاع للكيانات الأجنبية"] },
      { name: "كيانات أجنبية مع ضريبة استقطاع", status: "live", description: "تصنيف كيان أجنبي مع نسبة استقطاع وتصنيف المعاملة", details: ["عملة مختلفة تلقائياً", "ITN بدل سجل تجاري", "LEI Code مع رابط GLEIF", "ضريبة استقطاع % مع تصنيف", "يظهر في الإقرار الضريبي الشهري"] },
    ],
  },
  {
    title: "الأصول والمخزون",
    titleEn: "Assets & Inventory",
    icon: Building2,
    color: "text-[#92400E]",
    bgColor: "bg-[#92400E]/10",
    features: [
      { name: "الأصول الثابتة", status: "live", description: "إدارة الأصول مع الإهلاك والقيمة الدفترية", details: ["جدول الإهلاك", "رسوم بيانية", "حالات: نشط / مستبعد / قيد الصيانة"] },
      { name: "المخزون", status: "live", description: "إدارة المنتجات والمستودعات مع حد إعادة الطلب" },
      { name: "المنتجات والخدمات", status: "live", description: "قسم شامل للمنتجات والخدمات مع تغيير النوع ديناميكياً", details: ["منتج / خدمة / أصل", "صفحة تفصيلية لكل عنصر", "حركات مالية وحركات مخزون", "فلاتر متعددة + بحث + checkboxes"] },
    ],
  },
  {
    title: "الرواتب والموارد البشرية",
    titleEn: "Payroll & HR",
    icon: Wallet,
    color: "text-[#9D174D]",
    bgColor: "bg-[#9D174D]/10",
    features: [
      { name: "دورات الرواتب", status: "live", description: "تشغيل دورات رواتب شهرية مع قائمة الموظفين" },
      { name: "مسير الرواتب", status: "planned", description: "معالجة وتشغيل الرواتب الشهرية مع التفاصيل", critical: true },
      { name: "الموظفين", status: "planned", description: "إدارة بيانات الموظفين وعقودهم", critical: true },
      { name: "مطالبات الموظفين", status: "planned", description: "تقديم واعتماد مطالبات المصاريف" },
      { name: "الحضور والانصراف", status: "phase2", description: "تسجيل ومتابعة حضور الموظفين" },
      { name: "الإجازات", status: "phase2", description: "طلبات واعتمادات الإجازات" },
      { name: "امتثال GOSI", status: "phase2", description: "حساب تلقائي لاشتراكات التأمينات الاجتماعية", critical: true },
    ],
  },
  {
    title: "المشاريع",
    titleEn: "Projects",
    icon: Layers,
    color: "text-[#075985]",
    bgColor: "bg-[#075985]/10",
    features: [
      { name: "إدارة المشاريع", status: "phase2", description: "إنشاء مشاريع وربطها بالفواتير والمصروفات" },
      { name: "المهام", status: "phase2", description: "مهام فرعية مع تعيين موظفين ومواعيد" },
      { name: "تتبع الوقت", status: "phase2", description: "تسجيل ساعات العمل على المشاريع" },
      { name: "تحليل الربحية", status: "phase2", description: "مقارنة الإيرادات بالمصاريف لكل مشروع", critical: true },
    ],
  },
  {
    title: "الحسابات البنكية",
    titleEn: "Bank Accounts",
    icon: Landmark,
    color: "text-[#1E40AF]",
    bgColor: "bg-[#1E40AF]/10",
    features: [
      { name: "إدارة الحسابات البنكية", status: "live", description: "إنشاء وإدارة الحسابات البنكية والصناديق", details: ["حسابات جارية / توفير / صناديق", "أرصدة وعملات متعددة", "IBAN ومعلومات البنك"] },
      { name: "تحويلات بين الحسابات", status: "planned", description: "تحويل أرصدة بين الحسابات البنكية" },
      { name: "مطابقة بنكية", status: "planned", description: "مطابقة كشف الحساب مع الحركات", critical: true },
      { name: "استيراد كشوف بنكية (CSV/OFX)", status: "planned", description: "رفع كشوف الحساب لمطابقتها" },
    ],
  },
  {
    title: "مراكز التكلفة والفروع",
    titleEn: "Cost Centers & Branches",
    icon: Target,
    color: "text-[#075985]",
    bgColor: "bg-[#075985]/10",
    features: [
      { name: "مراكز التكلفة", status: "live", description: "إدارة مراكز التكلفة مع الميزانيات والمصروفات", details: ["ميزانيات ونسب استخدام", "هيكل أب-ابن", "ربط بالقيود والفواتير"] },
      { name: "الفروع", status: "live", description: "إدارة الفروع والمواقع", details: ["بيانات الفرع والعنوان", "المدير والموظفين", "إيرادات كل فرع"] },
      { name: "إقفال الفترات", status: "planned", description: "إقفال الفترات المالية ومنع التعديل بعد الإقفال", critical: true },
    ],
  },
  {
    title: "التكاملات والمطورين",
    titleEn: "Integrations & Developer",
    icon: Plug,
    color: "text-[#374151]",
    bgColor: "bg-[#374151]/10",
    features: [
      { name: "REST API", status: "live", description: "واجهة برمجية كاملة للتكامل مع أنظمة خارجية" },
      { name: "Webhooks", status: "live", description: "إشعارات فورية للأحداث" },
      { name: "قوالب المستندات", status: "live", description: "إدارة قوالب الفواتير والمستندات بتصاميم متعددة", details: ["فواتير بيع / عروض أسعار / سندات", "تحديد قالب افتراضي", "تصميمات: كلاسيك / حديث / مبسّط"] },
      { name: "ربط سلة (Salla)", status: "planned", description: "تكامل مع متجر سلة الإلكتروني" },
      { name: "ربط زد (Zid)", status: "planned", description: "تكامل مع متجر زد الإلكتروني" },
      { name: "ربط Stripe / Moyasar", status: "planned", description: "بوابات دفع إلكترونية" },
      { name: "ربط واتساب أعمال", status: "phase2", description: "إرسال الفواتير عبر WhatsApp Business" },
    ],
  },
  {
    title: "التغذية البنكية",
    titleEn: "Bank Feeds",
    icon: CreditCard,
    color: "text-[#1E40AF]",
    bgColor: "bg-[#1E40AF]/10",
    features: [
      { name: "المطابقة التلقائية", status: "phase3", description: "مطابقة تلقائية بين كشوف البنك والمعاملات" },
      { name: "Plaid (US)", status: "phase3", description: "ربط الحسابات البنكية الأمريكية عبر Plaid" },
      { name: "Open Banking (GCC)", status: "phase3", description: "ربط الحسابات البنكية الخليجية عبر Open Banking" },
    ],
  },
  {
    title: "البوابات الذاتية",
    titleEn: "Portals",
    icon: Globe,
    color: "text-[#075985]",
    bgColor: "bg-[#075985]/10",
    features: [
      { name: "بوابة العملاء", status: "phase3", description: "واجهة للعملاء لعرض فواتيرهم والدفع" },
      { name: "بوابة الموردين", status: "phase3", description: "واجهة للموردين لتتبع مستحقاتهم" },
      { name: "بوابة المساهمين", status: "phase3", description: "واجهة للمساهمين عرض التقارير المالية" },
    ],
  },
  {
    title: "الذكاء الاصطناعي",
    titleEn: "Smart AI",
    icon: Brain,
    color: "text-[#7C3AED]",
    bgColor: "bg-[#7C3AED]/10",
    features: [
      { name: "OCR - قراءة الفواتير", status: "partial", description: "استخراج بيانات الفواتير من صور وPDF تلقائياً", details: ["واجهة الرفع موجودة", "يحتاج: تكامل Google Vision API"] },
      { name: "التصنيف التلقائي", status: "phase3", description: "تصنيف المعاملات تلقائياً على الحسابات المناسبة" },
      { name: "توقعات التدفق النقدي", status: "phase3", description: "تنبؤ بالسيولة المستقبلية بناءً على الأنماط التاريخية" },
    ],
  },
];

export function FeatureRoadmap() {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules.map(m => m.title)));
  const [filterStatus, setFilterStatus] = useState<FeatureStatus | "all">("all");

  const toggleModule = (title: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  // Stats
  const allFeatures = modules.flatMap(m => m.features);
  const stats = {
    total: allFeatures.length,
    live: allFeatures.filter(f => f.status === "live").length,
    partial: allFeatures.filter(f => f.status === "partial").length,
    planned: allFeatures.filter(f => f.status === "planned").length,
    phase2: allFeatures.filter(f => f.status === "phase2").length,
    phase3: allFeatures.filter(f => f.status === "phase3").length,
    critical: allFeatures.filter(f => f.critical).length,
    criticalDone: allFeatures.filter(f => f.critical && f.status === "live").length,
  };

  const completionRate = Math.round(((stats.live + stats.partial * 0.5) / stats.total) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>خارطة المزايا</h1>
        <p className="text-[#6B7280] mt-1">مراجعة شاملة لجميع مزايا المنصة وحالة التنفيذ</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <button onClick={() => setFilterStatus(filterStatus === "all" ? "all" : "all")} className="text-start">
          <Card className={`border-[#E5E7EB] hover:shadow-md transition-all ${filterStatus === "all" ? "ring-2 ring-[#1276E3]/20" : ""}`}>
            <CardContent className="p-4">
              <p className="text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الإجمالي</p>
              <p className="font-english text-[#0B1B49] mt-1" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.total}</p>
              <div className="w-full bg-[#E5E7EB] rounded-full h-1.5 mt-2">
                <div className="bg-[#1276E3] h-1.5 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
              </div>
              <p className="text-xs text-[#6B7280] mt-1 font-english">{completionRate}% مكتمل</p>
            </CardContent>
          </Card>
        </button>
        {(["live", "partial", "planned", "phase2", "phase3"] as FeatureStatus[]).map(status => {
          const cfg = statusConfig[status];
          const count = stats[status];
          return (
            <button key={status} onClick={() => setFilterStatus(filterStatus === status ? "all" : status)} className="text-start">
              <Card className={`border-[#E5E7EB] hover:shadow-md transition-all ${filterStatus === status ? "ring-2 ring-[#1276E3]/20" : ""}`}>
                <CardContent className="p-4">
                  <p className="text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>{cfg.label}</p>
                  <p className={`font-english mt-1 ${cfg.color}`} style={{ fontSize: "1.5rem", fontWeight: 700 }}>{count}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs mt-2 ${cfg.bg} ${cfg.color}`} style={{ fontWeight: 500 }}>
                    <cfg.icon className="h-3 w-3" />{cfg.label}
                  </span>
                </CardContent>
              </Card>
            </button>
          );
        })}
        <button onClick={() => setFilterStatus("all")} className="text-start">
          <Card className="border-[#FEF3C7] bg-[#FEF3C7]/20 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <p className="text-xs text-[#92400E]" style={{ fontWeight: 600 }}>حرجة</p>
              <p className="font-english text-[#92400E] mt-1" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.criticalDone}/{stats.critical}</p>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs mt-2 bg-[#FEF3C7] text-[#92400E]" style={{ fontWeight: 500 }}>
                <Star className="h-3 w-3" />أساسية
              </span>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Modules */}
      <div className="space-y-3">
        {modules.map(mod => {
          const isExpanded = expandedModules.has(mod.title);
          const modFeatures = filterStatus === "all" ? mod.features : mod.features.filter(f => f.status === filterStatus);
          if (modFeatures.length === 0 && filterStatus !== "all") return null;
          const liveCount = mod.features.filter(f => f.status === "live").length;
          const totalCount = mod.features.length;

          return (
            <Card key={mod.title} className="border-[#E5E7EB] overflow-hidden">
              <button
                onClick={() => toggleModule(mod.title)}
                className="w-full text-start px-5 py-4 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${mod.bgColor}`}>
                    <mod.icon className={`h-5 w-5 ${mod.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#0B1B49]" style={{ fontWeight: 700 }}>{mod.title}</span>
                      {mod.titleEn && <span className="text-xs text-[#9CA3AF] font-english">{mod.titleEn}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#6B7280] font-english">{liveCount}/{totalCount} مفعّل</span>
                      <div className="w-16 bg-[#E5E7EB] rounded-full h-1">
                        <div className="bg-[#22C55E] h-1 rounded-full" style={{ width: `${(liveCount / totalCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="h-5 w-5 text-[#9CA3AF]" /> : <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />}
              </button>

              {isExpanded && (
                <div className="border-t border-[#E5E7EB]">
                  {(filterStatus === "all" ? mod.features : modFeatures).map((feature, i) => {
                    const cfg = statusConfig[feature.status];
                    return (
                      <div key={feature.name} className={`px-5 py-3.5 flex items-start gap-3 ${i > 0 ? "border-t border-[#F3F4F6]" : ""} hover:bg-[#F9FAFB] transition-colors`}>
                        <cfg.icon className={`h-4.5 w-4.5 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{feature.name}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${cfg.bg} ${cfg.color}`} style={{ fontWeight: 500 }}>{cfg.label}</span>
                            {feature.critical && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs text-[#92400E]" style={{ fontWeight: 600 }}>
                                <Star className="h-3 w-3" />حرج
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#6B7280] mt-0.5">{feature.description}</p>
                          {feature.details && feature.details.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {feature.details.map((d, j) => (
                                <li key={j} className="text-xs text-[#9CA3AF] flex items-start gap-1.5">
                                  <span className="mt-1.5 h-1 w-1 rounded-full bg-[#D1D5DB] shrink-0" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-5">
          <h3 className="text-[#0B1B49] mb-3" style={{ fontWeight: 700 }}>دليل الحالات</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                <span className={`text-sm ${cfg.color}`} style={{ fontWeight: 500 }}>{cfg.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-[#92400E]" />
              <span className="text-sm text-[#92400E]" style={{ fontWeight: 500 }}>حرج — أساسي للإطلاق</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}