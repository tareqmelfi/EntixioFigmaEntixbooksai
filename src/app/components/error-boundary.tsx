import { useRouteError, isRouteErrorResponse, Link } from "react-router";
import { AlertTriangle, Home, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { clientErrorRef } from "../lib/api";
import { useLanguage } from "./LanguageContext";

export function ErrorBoundary() {
  const { t } = useLanguage();
  const error = useRouteError();
  
  let errorMessage: string;
  let errorStatus: number | undefined;
  let errorRef: string | undefined;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || "حدث خطأ غير متوقع";
    
    // Custom messages for common errors
    if (error.status === 404) {
      errorMessage = "الصفحة المطلوبة غير موجودة";
    } else if (error.status === 403) {
      errorMessage = "ليس لديك صلاحية للوصول إلى هذه الصفحة";
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
    // Render crash — attach a support reference and log the stack so it can be traced
    const ref = clientErrorRef();
    console.error(`[ui] ${ref} RENDER CRASH`, error);
    errorRef = ref;
  } else {
    errorMessage = "حدث خطأ غير متوقع";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-white p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-border p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>

          {/* Status Code */}
          {errorStatus && (
            <div className="mb-4">
              <span className="font-english text-6xl text-foreground" style={{ fontWeight: 800 }}>
                {errorStatus}
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-foreground mb-3" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {errorStatus === 404 ? "الصفحة غير موجودة" : "حدث خطأ"}
          </h1>

          {/* Message */}
          <p className="text-muted-foreground mb-4 leading-relaxed">
            {errorMessage}
          </p>

          {errorRef && (
            <p className="text-muted-foreground/70 mb-4 text-xs font-english" dir="ltr">
              Ref: {errorRef}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white">
              <Link to="/app" className="flex items-center justify-center gap-2">
                <Home className="h-4 w-4" />
                <span>{t("العودة للرئيسية", "Back to home")}</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full border-border text-muted-foreground hover:bg-muted">
              <button onClick={() => window.history.back()} className="flex items-center justify-center gap-2">
                <ArrowRight className="h-4 w-4" />
                <span>{t("رجوع", "Back")}</span>
              </button>
            </Button>
          </div>

          {/* Debug info in development */}
          {import.meta.env.DEV && error instanceof Error && (
            <details className="mt-8 text-start">
              <summary className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground mb-2">
                تفاصيل الخطأ (Development Mode)
              </summary>
              <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-48 text-foreground/80 font-english" dir="ltr">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
        </p>
      </div>
    </div>
  );
}

export function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-white p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-border p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-primary" />
          </div>

          {/* 404 */}
          <div className="mb-4">
            <span className="font-english text-6xl text-foreground" style={{ fontWeight: 800 }}>
              404
            </span>
          </div>

          {/* Title */}
          <h1 className="text-foreground mb-3" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            الصفحة غير موجودة
          </h1>

          {/* Message */}
          <p className="text-muted-foreground mb-8 leading-relaxed">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى موقع آخر.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white">
              <Link to="/app" className="flex items-center justify-center gap-2">
                <Home className="h-4 w-4" />
                <span>{t("العودة للرئيسية", "Back to home")}</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full border-border text-muted-foreground hover:bg-muted">
              <Link to="/app/contacts" className="flex items-center justify-center gap-2">
                <span>{t("جميع جهات الاتصال", "All contacts")}</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
