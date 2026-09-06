import { useLanguage } from "./LanguageContext";
import { useState } from "react";
import { displayLocale, type NumberingSystem } from "../lib/number-display";

export function NumberPreferences() {
  const { t, language, setLanguage, numberingSystem, setNumberingSystem } = useLanguage();
  const [saveFailed, setSaveFailed] = useState(false);
  return <section className="rounded-lg border border-border p-4 space-y-3" aria-labelledby="number-preferences-title">
    <h2 id="number-preferences-title" className="text-sm font-semibold">{t("اللغة والأرقام", "Language and numbers")}</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-xs"><span>{t("لغة الواجهة", "Interface language")}</span>
        <select className="block w-full rounded-md border border-border bg-card px-3 py-2 text-sm" value={language} onChange={e => setLanguage(e.target.value as "ar" | "en")}>
          <option value="ar">العربية</option><option value="en">English</option>
        </select>
      </label>
      <label className="space-y-2 text-xs"><span>{t("نمط الأرقام", "Number style")}</span>
        <select className="block w-full rounded-md border border-border bg-card px-3 py-2 text-sm" value={numberingSystem} onChange={e => setSaveFailed(!setNumberingSystem(e.target.value as NumberingSystem))}>
          <option value="latn">{t("0123456789 — الافتراضي", "0123456789 — Default")}</option>
          <option value="arab">{"\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"} — {t("الأرقام الهندية", "Arabic-Indic digits")}</option>
        </select>
      </label>
    </div>
    <p className="text-sm font-english" dir="ltr">{(1234.5).toLocaleString(displayLocale("en-US", numberingSystem), { minimumFractionDigits: 2 })} SAR</p>
    <p className="text-xs text-muted-foreground">{t("يُحفظ نمط الأرقام تلقائيًا في هذا المتصفح للعرض والطباعة، مستقلًا عن اللغة. تبقى أرقام المستندات والمعرّفات كما هي.", "Number style is saved automatically in this browser for display and printing, independently of language. Document numbers and identifiers stay unchanged.")}</p>
    {saveFailed && <p role="alert" className="text-xs text-warning">{t("تعذّر حفظ التفضيل. اسمح بالتخزين في المتصفح ثم حاول مجددًا.", "Could not save this preference. Allow browser storage and try again.")}</p>}
  </section>;
}
