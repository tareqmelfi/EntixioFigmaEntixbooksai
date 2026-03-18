import { useRouteError, isRouteErrorResponse, Link } from "react-router";
import { AlertTriangle, Home, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

export function ErrorBoundary() {
  const error = useRouteError();
  
  let errorMessage: string;
  let errorStatus: number | undefined;

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
  } else {
    errorMessage = "حدث خطأ غير متوقع";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F4FCFF] to-white p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-[#DC2626]" />
          </div>

          {/* Status Code */}
          {errorStatus && (
            <div className="mb-4">
              <span className="font-english text-6xl text-[#0B1A47]" style={{ fontWeight: 800 }}>
                {errorStatus}
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-[#0B1A47] mb-3" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {errorStatus === 404 ? "الصفحة غير موجودة" : "حدث خطأ"}
          </h1>

          {/* Message */}
          <p className="text-[#6B7280] mb-8 leading-relaxed">
            {errorMessage}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full bg-[#1276E3] hover:bg-[#1060C0] text-white">
              <Link to="/app" className="flex items-center justify-center gap-2">
                <Home className="h-4 w-4" />
                <span>العودة للرئيسية</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]">
              <button onClick={() => window.history.back()} className="flex items-center justify-center gap-2">
                <ArrowRight className="h-4 w-4" />
                <span>رجوع</span>
              </button>
            </Button>
          </div>

          {/* Debug info in development */}
          {import.meta.env.DEV && error instanceof Error && (
            <details className="mt-8 text-start">
              <summary className="text-xs text-[#9CA3AF] cursor-pointer hover:text-[#6B7280] mb-2">
                تفاصيل الخطأ (Development Mode)
              </summary>
              <pre className="text-xs bg-[#F3F4F6] rounded-lg p-3 overflow-auto max-h-48 text-[#374151] font-english" dir="ltr">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
        </p>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F4FCFF] to-white p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-[#DBEAFE] flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-[#1276E3]" />
          </div>

          {/* 404 */}
          <div className="mb-4">
            <span className="font-english text-6xl text-[#0B1A47]" style={{ fontWeight: 800 }}>
              404
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[#0B1A47] mb-3" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            الصفحة غير موجودة
          </h1>

          {/* Message */}
          <p className="text-[#6B7280] mb-8 leading-relaxed">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى موقع آخر.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full bg-[#1276E3] hover:bg-[#1060C0] text-white">
              <Link to="/app" className="flex items-center justify-center gap-2">
                <Home className="h-4 w-4" />
                <span>العودة للرئيسية</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]">
              <Link to="/app/contacts" className="flex items-center justify-center gap-2">
                <span>جميع جهات الاتصال</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
