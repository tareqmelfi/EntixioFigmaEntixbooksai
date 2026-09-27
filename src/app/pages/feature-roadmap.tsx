import { useState } from "react";
import { CheckCircle, Clock, AlertCircle, Target, ChevronDown, ChevronRight, Star, Sparkles, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { api } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";
import { Metric, MetricStrip, PageHeader } from "../components/product";

import { modules, type FeatureStatus } from "../lib/feature-catalog";

const statusConfig: Record<FeatureStatus, { label: string; labelEn: string; color: string; bg: string; icon: LucideIcon }> = {
  live: { label: "مفعّل", labelEn: "Active", color: "text-success", bg: "bg-success-subtle", icon: CheckCircle },
  partial: { label: "جزئي", labelEn: "Partial", color: "text-warning", bg: "bg-warning-subtle", icon: AlertCircle },
  planned: { label: "مخطط", labelEn: "Planned", color: "text-primary", bg: "bg-info-subtle", icon: Clock },
  phase2: { label: "المرحلة 2", labelEn: "Phase 2", color: "text-primary", bg: "bg-primary/5", icon: Target },
  phase3: { label: "المرحلة 3", labelEn: "Phase 3", color: "text-danger", bg: "bg-danger-subtle", icon: Sparkles },
};

// ── Feature Modules ──

export function FeatureRoadmap() {
  const { language, t } = useLanguage();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules.map(m => m.title)));
  const [filterStatus, setFilterStatus] = useState<FeatureStatus | "all">("all");
  const { toasts, push, dismiss } = useToasts();
  const [reported, setReported] = useState<Set<string>>(new Set());

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
      <PageHeader
        eyebrow={t("الإعدادات", "Settings")}
        title={t("خارطة المزايا", "Feature Roadmap")}
        description={t("مراجعة شاملة لجميع مزايا المنصة وحالة التنفيذ", "Comprehensive review of all platform features and implementation status")}
      />

      {/* Summary figures · the ledger strip (click a figure to filter) */}
      <MetricStrip className="grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 [&_.ledger-figure-value]:text-[22px] sm:[&_.ledger-figure-value]:text-[26px]">
        <Metric
          role="button" tabIndex={0} aria-pressed={filterStatus === "all"} onClick={() => setFilterStatus("all")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFilterStatus("all"); } }}
          className={`cursor-pointer ${filterStatus === "all" ? "bg-surface-subtle" : ""}`}
          label={t("الإجمالي", "Total")} value={String(stats.total)}
          hint={(
            <>
              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle"><span className="block h-1.5 rounded-full bg-primary transition-all" style={{ width: `${completionRate}%` }} /></span>
              <span className="mt-1 block font-english tabular-nums">{completionRate}% {t("مكتمل", "complete")}</span>
            </>
          )}
        />
        {(["live", "partial", "planned", "phase2", "phase3"] as FeatureStatus[]).map(status => {
          const cfg = statusConfig[status];
          const count = stats[status];
          return (
            <Metric
              key={status}
              role="button" tabIndex={0} aria-pressed={filterStatus === status} onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFilterStatus(filterStatus === status ? "all" : status); } }}
              className={`cursor-pointer ${filterStatus === status ? "bg-surface-subtle" : ""}`}
              label={t(cfg.label, cfg.labelEn)} value={String(count)}
              hint={<span className={`inline-flex items-center gap-1 ${cfg.color}`}><cfg.icon className="h-3 w-3" strokeWidth={1.75} />{t(cfg.label, cfg.labelEn)}</span>}
            />
          );
        })}
        <Metric
          role="button" tabIndex={0} onClick={() => setFilterStatus("all")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFilterStatus("all"); } }}
          className="cursor-pointer" tone="warning"
          label={t("حرجة", "Critical")} value={`${stats.criticalDone}/${stats.critical}`}
          hint={<span className="inline-flex items-center gap-1 text-warning"><Star className="h-3 w-3" strokeWidth={1.75} />{t("أساسية", "Essential")}</span>}
        />
      </MetricStrip>

      {/* Modules */}
      <div className="space-y-3">
        {modules.map(mod => {
          const isExpanded = expandedModules.has(mod.title);
          const modFeatures = filterStatus === "all" ? mod.features : mod.features.filter(f => f.status === filterStatus);
          if (modFeatures.length === 0 && filterStatus !== "all") return null;
          const liveCount = mod.features.filter(f => f.status === "live").length;
          const totalCount = mod.features.length;

          return (
            <Card key={mod.title} className="border-border overflow-hidden">
              <button
                onClick={() => toggleModule(mod.title)}
                className="w-full text-start px-5 py-4 flex items-center justify-between hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${mod.bgColor}`}>
                    <mod.icon className={`h-5 w-5 ${mod.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground" style={{ fontWeight: 700 }}>{t(mod.title, mod.titleEn)}</span>
                      {language === "ar" && mod.titleEn && <span className="text-xs text-muted-foreground/60 font-english">{mod.titleEn}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-english">{liveCount}/{totalCount} {t("مفعّل", "active")}</span>
                      <div className="w-16 bg-muted rounded-full h-1">
                        <div className="bg-success h-1 rounded-full" style={{ width: `${(liveCount / totalCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground/60" /> : <ChevronRight className="h-5 w-5 text-muted-foreground/60" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border">
                  {(filterStatus === "all" ? mod.features : modFeatures).map((feature, i) => {
                    const cfg = statusConfig[feature.status];
                    return (
                      <div key={feature.name} className={`px-5 py-3.5 flex items-start gap-3 ${i > 0 ? "border-t border-border/50" : ""} hover:bg-muted transition-colors group`}>
                        <cfg.icon className={`h-4.5 w-4.5 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t(feature.name, feature.nameEn)}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${cfg.bg} ${cfg.color}`} style={{ fontWeight: 500 }}>{t(cfg.label, cfg.labelEn)}</span>
                            <button
                              onClick={async (e) => { e.stopPropagation(); if (reported.has(feature.name)) return; try { await api.notifications.create({ type: "feature_report", title: `${t("بلاغ على ميزة:", "Feature report:")} ${t(feature.name, feature.nameEn)}`, body: `${t("قسم:", "Module:")} ${t(mod.title, mod.titleEn)} · ${t("الحالة:", "Status:")} ${t(cfg.label, cfg.labelEn)}`, link: "/app/roadmap", refType: "feature", refId: feature.name }); setReported(prev => new Set(prev).add(feature.name)); push("success", `${t("تم استلام بلاغك على", "We received your report on")} «${t(feature.name, feature.nameEn)}»`); } catch { push("error", t("تعذر إرسال البلاغ", "Could not send the report")); } }}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${reported.has(feature.name) ? "border-success-border bg-success-subtle text-success" : "border-border text-muted-foreground/60 hover:text-destructive hover:border-destructive/40 opacity-0 group-hover:opacity-100"}`}
                              title={t("أبلغ عن مشكلة في هذه الميزة — يصل البلاغ لفريق التطوير", "Report an issue with this feature — the report reaches the dev team")}>
                              {reported.has(feature.name) ? t("✓ وصل البلاغ", "✓ Report received") : t("⚑ بلاغ", "⚑ Report")}
                            </button>
                            {feature.critical && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-subtle px-2 py-0.5 text-xs text-warning" style={{ fontWeight: 600 }}>
                                <Star className="h-3 w-3" />{t("حرج", "Critical")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{t(feature.description, feature.descEn)}</p>
                          {feature.details && feature.details.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {feature.details.map((d, j) => (
                                <li key={j} className="text-xs text-muted-foreground/60 flex items-start gap-1.5">
                                  <span className="mt-1.5 h-1 w-1 rounded-full bg-muted shrink-0" />
                                  {t(d, feature.detailsEn?.[j])}
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
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="text-foreground mb-3" style={{ fontWeight: 700 }}>{t("دليل الحالات", "Status legend")}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                <span className={`text-sm ${cfg.color}`} style={{ fontWeight: 500 }}>{t(cfg.label, cfg.labelEn)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-warning" />
              <span className="text-sm text-warning" style={{ fontWeight: 500 }}>{t("حرج — أساسي للإطلاق", "Critical — essential for launch")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
