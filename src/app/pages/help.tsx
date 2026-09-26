import { Link } from "react-router";
import { useLanguage } from "../components/LanguageContext";
export function Help() {
 const {t}=useLanguage();
 return <main className="mx-auto max-w-2xl space-y-6 px-6 py-16"><h1 className="text-3xl font-semibold">{t("دعم Entix Books", "Entix Books support")}</h1><p>{t("افتح محادثة الدعم من الزر أسفل الصفحة، أو ادخل حسابك لمتابعة طلباتك وردود الفريق.", "Open the support chat below, or sign in to track your requests and team replies.")}</p><Link className="inline-block rounded-full bg-primary px-6 py-3 text-primary-foreground" to="/app/help">{t("بوابة الدعم", "Support portal")}</Link><p><a href="mailto:support@entix.io">support@entix.io</a></p></main>;
}
