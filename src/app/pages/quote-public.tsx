/**
 * Public proposal accept page (SPEC-04) · /q/:token — token only · no login.
 * View the standard proposal → موافق (name required · creates the project org-side)
 * or اعتذار (reason required · feeds the loss-reasons analysis).
 * UX-1: no dialogs — inline panels only.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Loader2, Printer, CheckCircle2, XCircle, BadgeCheck } from "lucide-react";
import { api, Quote } from "../lib/api";
import { ProposalDoc, ProposalOrg } from "../components/proposal-doc";

type PubQuote = Quote & { org?: ProposalOrg };

export function QuotePublic() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<PubQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "accept" | "reject">("view");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const lang: "ar" | "en" = "ar";
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const q = await api.quotes.publicGet(token);
        setQuote(q as PubQuote);
        if (q.status === "ACCEPTED" || q.status === "CONVERTED") setDone("accepted");
        if (q.status === "REJECTED") setDone("rejected");
      } catch {
        setError(t("الرابط غير صالح أو انتهت صلاحيته", "This link is invalid or has expired"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitAccept = async () => {
    if (!token) return;
    if (!name.trim()) { setFormError(t("اكتب اسمك لتأكيد الموافقة", "Type your name to confirm")); return; }
    setBusy(true); setFormError(null);
    try {
      await api.quotes.publicAccept(token, name.trim());
      setDone("accepted");
      setMode("view");
    } catch (e: any) {
      setFormError(e?.message || t("تعذر إتمام الموافقة", "Could not complete the approval"));
    } finally { setBusy(false); }
  };

  const submitReject = async () => {
    if (!token) return;
    if (!reason.trim()) { setFormError(t("فضلًا اذكر السبب — يساعدنا على التحسين", "Please tell us why — it helps us improve")); return; }
    setBusy(true); setFormError(null);
    try {
      await api.quotes.publicReject(token, reason.trim());
      setDone("rejected");
      setMode("view");
    } catch (e: any) {
      setFormError(e?.message || t("تعذر الإرسال", "Could not submit"));
    } finally { setBusy(false); }
  };

  if (loading) return <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4FCFF" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "#1276E3" }} /></div>;
  if (error || !quote) return (
    <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4FCFF", padding: 24 }}>
      <div style={{ background: "#fff", border: "1px solid #D6E4EE", borderRadius: 14, padding: "28px 32px", textAlign: "center", maxWidth: 420 }}>
        <XCircle style={{ width: 40, height: 40, color: "#E84B4B", margin: "0 auto 10px" }} />
        <div style={{ fontWeight: 700, color: "#0B1B49" }}>{error || "—"}</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>تواصل مع الجهة المرسلة للحصول على رابط جديد</div>
      </div>
    </div>
  );

  const expired = quote.validUntil && new Date(quote.validUntil) < new Date() && !done;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#F4FCFF", fontFamily: "'Noto Sans Arabic', 'Inter', sans-serif" }}>
      <style>{`
        .num { font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: embed; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .pub-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
        }
      `}</style>

      {/* Status / action bar */}
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0B1B49", color: "#fff", padding: "10px 16px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
            <BadgeCheck style={{ width: 18, height: 18, color: "#05B6FA" }} />
            {quote.org?.name} · <span className="num">{quote.quoteNumber}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(255,255,255,.35)", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer" }}>
              <Printer style={{ width: 15, height: 15 }} /> {t("تحميل PDF", "Download PDF")}
            </button>
            {!done && !expired && (
              <>
                <button onClick={() => { setMode("reject"); setFormError(null); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.35)", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer" }}>
                  {t("اعتذار عن العرض", "Decline")}
                </button>
                <button onClick={() => { setMode("accept"); setFormError(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1276E3", border: "none", color: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <CheckCircle2 style={{ width: 15, height: 15 }} /> {t("موافق على العرض", "Approve")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "18px 16px 60px" }}>
        {/* Result banners */}
        {done === "accepted" && (
          <div className="no-print" style={{ background: "#E8F8EF", border: "1px solid #34C77B", color: "#0B6B3A", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700 }}>
            <CheckCircle2 style={{ width: 18, height: 18 }} /> {t("تم اعتماد العرض بنجاح — سيتواصل معكم الفريق لبدء التنفيذ", "Proposal approved — the team will contact you to kick off")}
          </div>
        )}
        {done === "rejected" && (
          <div className="no-print" style={{ background: "#FDECEC", border: "1px solid #E84B4B", color: "#8A1F1F", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13.5, fontWeight: 700 }}>
            {t("تم تسجيل الاعتذار عن العرض — شكرًا لوقتكم", "Declination recorded — thank you for your time")}
          </div>
        )}
        {expired && !done && (
          <div className="no-print" style={{ background: "#FFF7E6", border: "1px solid #E7B549", color: "#7A5A1E", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, fontWeight: 700 }}>
            {t("انتهت صلاحية هذا العرض — تواصل مع الجهة المرسلة لتحديثه", "This proposal has expired — contact the sender for an update")}
          </div>
        )}

        {/* Accept / Reject inline panels */}
        {mode === "accept" && !done && (
          <div className="no-print" style={{ background: "#fff", border: "2px solid #1276E3", borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: "#0B1B49", marginBottom: 8 }}>{t("تأكيد الموافقة على العرض", "Confirm approval")}</div>
            <div style={{ fontSize: 12.5, color: "#4A5A6E", marginBottom: 10 }}>
              {t(`بالضغط على «تأكيد الموافقة» فإنكم توافقون على عرض السعر ${quote.quoteNumber} بقيمة ${Number(quote.total).toLocaleString()} ${quote.currency}.`,
                 `By confirming you approve proposal ${quote.quoteNumber} for ${Number(quote.total).toLocaleString()} ${quote.currency}.`)}
            </div>
            {formError && <div style={{ background: "#FDECEC", color: "#8A1F1F", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginBottom: 10 }}>{formError}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("الاسم الكامل + الصفة (مثال: م. خالد — مدير المشاريع)", "Full name + role")}
                style={{ flex: 1, minWidth: 220, border: "1px solid #D6E4EE", borderRadius: 8, padding: "9px 12px", fontSize: 13 }} />
              <button disabled={busy} onClick={submitAccept} style={{ background: "#1276E3", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "..." : t("تأكيد الموافقة ✓", "Confirm ✓")}
              </button>
              <button disabled={busy} onClick={() => setMode("view")} style={{ background: "transparent", color: "#4A5A6E", border: "1px solid #D6E4EE", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        )}
        {mode === "reject" && !done && (
          <div className="no-print" style={{ background: "#fff", border: "2px solid #E84B4B", borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: "#0B1B49", marginBottom: 8 }}>{t("الاعتذار عن العرض", "Decline this proposal")}</div>
            {formError && <div style={{ background: "#FDECEC", color: "#8A1F1F", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginBottom: 10 }}>{formError}</div>}
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder={t("سبب الاعتذار (إلزامي) — مثال: السعر أعلى من الميزانية · تم اختيار مورد آخر...", "Reason (required)")}
              style={{ width: "100%", border: "1px solid #D6E4EE", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy} onClick={submitReject} style={{ background: "#E84B4B", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "..." : t("إرسال الاعتذار", "Send")}
              </button>
              <button disabled={busy} onClick={() => setMode("view")} style={{ background: "transparent", color: "#4A5A6E", border: "1px solid #D6E4EE", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
                {t("رجوع", "Back")}
              </button>
            </div>
          </div>
        )}

        {/* The proposal document */}
        <div className="pub-sheet" style={{ background: "#fff", border: "1px solid #D6E4EE", borderRadius: 14, boxShadow: "0 8px 30px rgba(11,27,73,.06)", padding: "26px 28px" }}>
          <ProposalDoc quote={quote} org={quote.org || null} lang={lang} />
        </div>

        <div className="no-print" style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: "#8CA0B3" }}>
          Powered by <a href="https://entix.io" style={{ color: "#1276E3", textDecoration: "none", fontWeight: 700 }}>Entix Books</a> · entix.io
        </div>
      </div>
    </div>
  );
}
