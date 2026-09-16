import { useLanguage } from "./LanguageContext";
import { displayLocale } from "../lib/number-display";

export function NumberPreferences() {
  const { t, language, setLanguage } = useLanguage();
  return <section className="rounded-lg border border-border p-4 space-y-3" aria-labelledby="number-preferences-title">
    <h2 id="number-preferences-title" className="text-sm font-semibold">{t("اللغة والأرقام", "Language and numbers")}</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-xs"><span>{t("لغة الواجهة", "Interface language")}</span>
        <select className="block w-full rounded-md border border-border bg-card px-3 py-2 text-sm" value={language} onChange={e => setLanguage(e.target.value as "ar" | "en")}>
          <option value="ar">العربية</option><option value="en">English</option>
        </select>
      </label>
      <div className="space-y-2 text-xs"><span>{t("نمط الأرقام", "Number style")}</span><p className="px-3 py-2" dir="ltr">0123456789</p></div>
    </div>
    <p className="text-sm font-english" dir="ltr">{(1234.5).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2 })} SAR</p>
    <p className="text-xs text-muted-foreground">{t("تُستخدم الأرقام 0123456789 في العرض والطباعة بجميع اللغات.", "Display and printing use 0123456789 in every language.")}</p>
  </section>;
}
