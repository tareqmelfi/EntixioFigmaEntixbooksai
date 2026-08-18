import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  Building2,
  Calculator,
  CalendarDays,
  FolderKanban,
  GitBranch,
  Landmark,
  Scale,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { api, type DashboardSummary } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { NumericText } from "../components/bidi-text";

/**
 * Accounting home — the «المحاسبة» sidebar entry lands here (user direction
 * 2026-08-18: the menu item must open a dashboard of the important ledgers,
 * then route onward). Link directory + the accountant's daily KPIs.
 */

type Destination = {
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const GROUPS: Array<{ labelAr: string; labelEn: string; items: Destination[] }> = [
  {
    labelAr: "الدفاتر والضرائب",
    labelEn: "Ledgers & tax",
    items: [
      { titleAr: "القيود اليدوية", titleEn: "Journal entries", descAr: "قيود اليومية والترحيل", descEn: "Journal vouchers and posting", path: "/app/journal-entries", icon: Calculator },
      { titleAr: "شجرة الحسابات", titleEn: "Chart of accounts", descAr: "دليل الحسابات والأرصدة", descEn: "Accounts and balances", path: "/app/chart-of-accounts", icon: BookOpen },
      { titleAr: "الإقرار الضريبي", titleEn: "Tax return", descAr: "إقرار VAT وبنود ZATCA", descEn: "VAT return and ZATCA lines", path: "/app/taxes", icon: ShieldCheck },
    ],
  },
  {
    labelAr: "البنوك والفترات",
    labelEn: "Banking & periods",
    items: [
      { titleAr: "الحسابات البنكية", titleEn: "Bank accounts", descAr: "الأرصدة الدفترية", descEn: "Book balances", path: "/app/bank-accounts", icon: Landmark },
      { titleAr: "تسوية البنوك", titleEn: "Bank reconciliation", descAr: "الدفتري مقابل كشف البنك", descEn: "Book vs statement", path: "/app/bank-reconciliation", icon: Scale },
      { titleAr: "الفترات المالية", titleEn: "Fiscal periods", descAr: "الإقفال والفتح", descEn: "Close and open periods", path: "/app/fiscal-periods", icon: CalendarDays },
    ],
  },
  {
    labelAr: "التحليل والهيكل",
    labelEn: "Analysis & structure",
    items: [
      { titleAr: "الأصول الثابتة", titleEn: "Fixed assets", descAr: "الأصول والإهلاك", descEn: "Assets and depreciation", path: "/app/assets", icon: Building2 },
      { titleAr: "مراكز التكلفة", titleEn: "Cost centers", descAr: "تحليل الأقسام", descEn: "Department analysis", path: "/app/cost-centers", icon: Target },
      { titleAr: "المشاريع", titleEn: "Projects", descAr: "ربحية المشاريع", descEn: "Project profitability", path: "/app/projects", icon: FolderKanban },
      { titleAr: "الفروع", titleEn: "Branches", descAr: "فصل النتائج لكل فرع", descEn: "Per-branch results", path: "/app/branches", icon: GitBranch },
    ],
  },
];

const money = (value: number, currency: string) =>
  `${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export function AccountingHome() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    let alive = true;
    api.dashboard.summary().then((data) => { if (alive) setSummary(data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const currency = summary?.org.baseCurrency || "SAR";
  const kpis = summary
    ? [
        { labelAr: "صافي الضريبة المستحقة", labelEn: "Net tax position", value: money(summary.kpi.vatNet, currency) },
        { labelAr: "الذمم المدينة", labelEn: "Receivables", value: money(summary.kpi.accountsReceivable, currency) },
        { labelAr: "الذمم الدائنة", labelEn: "Payables", value: money(summary.kpi.accountsPayable, currency) },
        { labelAr: "النقدية المتاحة", labelEn: "Cash on hand", value: money(summary.kpi.cashOnHand, currency) },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المحاسبة", "Accounting")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("لوحة المحاسب: الدفاتر والضرائب والبنوك والهيكل التحليلي — اختر وجهتك.", "The accountant's home: ledgers, tax, banking, and analytical structure — pick your destination.")}
        </p>
      </div>

      {kpis.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.labelAr} className="border-border">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{t(kpi.labelAr, kpi.labelEn)}</div>
                <NumericText className="mt-1 block text-lg font-bold text-foreground">{kpi.value}</NumericText>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {GROUPS.map((group) => (
        <section key={group.labelAr}>
          <h2 className="mb-2 text-sm font-semibold text-foreground/80">{t(group.labelAr, group.labelEn)}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path}>
                  <Card className="h-full border-border transition hover:border-primary/40 hover:bg-primary/5">
                    <CardContent className="flex items-start gap-3 p-4">
                      <span className="rounded-lg border border-border bg-muted/50 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{t(item.titleAr, item.titleEn)}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{t(item.descAr, item.descEn)}</span>
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
