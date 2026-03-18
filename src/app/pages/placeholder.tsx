import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { Construction, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <SharedNavbar />
      
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[#1276E3] to-[#349FC4] flex items-center justify-center shadow-2xl">
            <Construction className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800 }}>
            {title}
          </h1>
          <p className="text-[#6B7280] mb-8 text-lg" style={{ lineHeight: 1.8 }}>
            {description}
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 bg-[#1276E3] hover:bg-[#0B5FBF] text-white px-8 py-3.5 rounded-xl transition-all hover:shadow-xl cursor-pointer"
            style={{ fontSize: "15px", fontWeight: 600 }}
          >
            العودة للرئيسية
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      <SharedFooter />
    </div>
  );
}
