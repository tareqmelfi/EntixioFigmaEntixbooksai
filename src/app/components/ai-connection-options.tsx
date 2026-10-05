import { useState } from "react";
import { Link } from "react-router";
import { Copy, ExternalLink } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { Button } from "./ui/button";

const MCP_URL = "https://api.entix.io/mcp";

/** Setup guidance only. Opening a provider is not an OAuth grant or a billing change. */
export function AiConnectionOptions() {
  const { t } = useLanguage();
  const [provider, setProvider] = useState<"chatgpt" | "claude" | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const name = provider === "chatgpt" ? "ChatGPT" : "Claude";

  return (
    <section aria-labelledby="ai-connections-title" className="min-w-0 space-y-4 border-b border-border pb-6">
      <div>
        <h3 id="ai-connections-title" className="text-base font-semibold">{t("استخدم حسابك في ChatGPT أو Claude", "Use your ChatGPT or Claude account")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("اربط دفاترك واعمل عليها من داخل ChatGPT أو Claude، دون مفتاح مزوّد. توفر الربط وحدود الاستخدام بحسب حسابك لديهم.", "Connect your books and work with them inside ChatGPT or Claude, without a provider API key. Availability and usage limits depend on your account there.")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["chatgpt", "claude"] as const).map(value => (
          <Button key={value} type="button" variant={provider === value ? "default" : "outline"}
            aria-expanded={provider === value} aria-controls="ai-connector-setup"
            onClick={() => { setProvider(provider === value ? null : value); setCopyState("idle"); }}>
            {value === "chatgpt" ? t("إعداد ربط ChatGPT", "Set up ChatGPT") : t("إعداد ربط Claude", "Set up Claude")}
          </Button>
        ))}
      </div>
      {provider && (
        <div id="ai-connector-setup" className="min-w-0 space-y-4 rounded-lg border border-border p-4">
          <h4 className="font-semibold">{t(`الربط من داخل ${name}`, `Connect from ${name}`)}</h4>
          <p className="text-sm text-muted-foreground">{t("يوافق مالك الشركة أو مديرها على الوصول. يبدأ الربط من حسابك لدى المزوّد، ثم تختار الشركة والصلاحيات في Entix.", "A company owner or admin authorizes access. Start in your provider account, then choose the company and permissions in Entix.")}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-3 border-y border-border py-3">
            <code dir="ltr" className="min-w-0 select-all break-all text-sm">{MCP_URL}</code>
            <Button type="button" variant="outline" size="sm" onClick={async () => {
              try { await navigator.clipboard.writeText(MCP_URL); setCopyState("copied"); }
              catch { setCopyState("failed"); }
            }}><Copy className="size-4" aria-hidden="true" />{t("نسخ عنوان الربط", "Copy connection URL")}</Button>
          </div>
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {copyState === "copied" ? t("تم نسخ العنوان", "URL copied") : copyState === "failed" ? t("تعذر النسخ. حدد العنوان الظاهر وانسخه يدويًا.", "Copy failed. Select the URL above and copy it manually.") : null}
          </p>
          <ol className="list-decimal space-y-2 ps-5 text-sm">
            <li>{provider === "chatgpt"
              ? t("في ChatGPT افتح الإعدادات ← التطبيقات، وفعّل وضع المطوّر من الإعدادات المتقدمة إذا كان متاحًا، ثم أنشئ تطبيقًا بعنوان الربط أعلاه واختر OAuth.", "In ChatGPT, open Settings → Apps, enable Developer mode in Advanced settings if available, then create an app with the URL above and OAuth authentication.")
              : t("في Claude افتح Customize ← Connectors، وأضف موصّلًا مخصصًا باسم Entix Books وعنوان الربط أعلاه، ثم اضغط Connect.", "In Claude, open Customize → Connectors, add a custom connector named Entix Books with the URL above, then choose Connect.")}</li>
            <li>{t("سجّل الدخول في Entix، وتحقق من الشركة، واختر القراءة فقط للبدء، ثم وافق على الربط.", "Sign in to Entix, verify the company, select read-only access to start, then approve the connection.")}</li>
            <li>{t(`ارجع إلى ${name} واستخدم موصّل Entix لعرض اسم الشركة وعملتها. تحقق من النتيجة قبل توسيع الصلاحيات.`, `Return to ${name} and use the Entix connector to show the company name and currency. Verify the result before granting more permissions.`)}</li>
          </ol>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button asChild variant="outline" size="sm"><a href={provider === "chatgpt" ? "https://chatgpt.com/" : "https://claude.ai/"} target="_blank" rel="noopener noreferrer">{t(`افتح ${name}`, `Open ${name}`)}<ExternalLink className="size-4" aria-hidden="true" /></a></Button>
            <a className="text-primary underline underline-offset-4" href={`/connect#${provider === "chatgpt" ? "chatgpt" : "claude-ai"}`} target="_blank" rel="noopener noreferrer">{t("دليل الربط", "Connection guide")}</a>
            <Link className="text-primary underline underline-offset-4" to="/app/settings?tab=api-keys">{t("إدارة صلاحيات الاتصالات وإلغاؤها", "Manage and revoke connection access")}</Link>
          </div>
          <p className="text-xs text-muted-foreground">{t("هذه خطوات إعداد؛ فتح المزوّد لا يؤكد اكتمال الربط. إلغاء مفتاح MCP من إعدادات Entix يوقف الوصول اللاحق.", "These are setup steps; opening the provider does not confirm a connection. Revoking its MCP key in Entix stops subsequent access.")}</p>
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-ring">{t("هل يمكن تشغيل مساعد Entix نفسه على اشتراكي؟", "Can my subscription power the assistant inside Entix?")}</summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          <p>{t("ChatGPT: الربط المباشر غير مفعّل في Entix حاليًا. يتيح OpenAI استخدام الخطة للتطبيقات التجارية المعتمدة؛ يلزم قبول Entix وتهيئة الربط أولًا.", "ChatGPT: direct plan usage is not enabled in Entix yet. OpenAI supports it for approved commercial apps; Entix needs acceptance and integration setup first.")} {" "}<a href="https://developers.openai.com/siwc/request-client-id" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("تفاصيل OpenAI", "OpenAI details")}</a></p>
          <p>{t("Claude: استخدام الاشتراك هنا عبر موصّل داخل Claude. تشغيل مساعد Entix على اشتراك Claude الشخصي ليس خيارًا مدعومًا؛ لا تطلب Entix بيانات الدخول أو رموز الجلسة الخاصة بك.", "Claude: use your account through a connector inside Claude. Powering the Entix assistant with a personal Claude subscription is not supported; Entix does not ask for your login credentials or session tokens.")} {" "}<a href="https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("تفاصيل Anthropic", "Anthropic details")}</a></p>
          <p>{t("إعداد الموصّل لا يغيّر باقة Entix أو مفتاح BYOK. مساعد Entix داخل المنصة يستخدم إعدادات الفوترة أدناه.", "Connector setup does not change your Entix plan or BYOK key. The assistant inside Entix uses the billing settings below.")}</p>
        </div>
      </details>
    </section>
  );
}
