/**
 * FullPageForm · replaces the entire main content area while editing.
 *
 * Per طارق: "يجب ان يفتح الصفحة كاملة وليست جانبية ولا منبثقة"
 * Pattern: when editing/creating, the form takes ALL content area · table is hidden.
 * Click X (top-end corner) returns to the list view.
 *
 * Same pattern as Wafeq's "فاتورة جديدة" page (screenshots in conversation).
 *
 * Usage:
 *   {createOpen ? (
 *     <FullPageForm title="فاتورة جديدة" subtitle="..." onClose={...} footer={<>...</>}>
 *       {form fields}
 *     </FullPageForm>
 *   ) : (
 *     <>{KPI cards} {Table}</>
 *   )}
 */
import { useEffect, ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode; // required · place action buttons here (Save / Approve / Send)
  /** Optional toolbar row right under the header for filters/tabs/etc. */
  toolbar?: ReactNode;
  /** Disable Esc-to-close (e.g. while busy/saving). */
  disableEscape?: boolean;
}

export function FullPageForm({ title, subtitle, onClose, children, footer, toolbar, disableEscape }: Props) {
  // Esc closes the form
  useEffect(() => {
    if (disableEscape) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, disableEscape]);

  return (
    <div className="-m-6 sm:-m-8 min-h-[calc(100vh-4rem)] flex flex-col bg-[#F4FCFF] relative">
      {/* Header bar · NOT sticky · scrolls with content (fixes banner-cover bug) */}
      <div className="bg-white border-b border-[#E5E7EB] shadow-sm flex-shrink-0">
        <div className="px-6 sm:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49] transition-colors flex-shrink-0"
              aria-label="إغلاق وعودة للقائمة"
              title="إغلاق (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[#0B1B49] truncate" style={{ fontSize: "1.125rem", fontWeight: 700 }}>{title}</h1>
              {subtitle && <p className="text-[#6B7280] text-xs mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {/* Footer actions duplicated in header for fast access */}
          <div className="flex items-center gap-2 shrink-0">
            {footer}
          </div>
        </div>
        {toolbar && (
          <div className="px-6 sm:px-8 py-2 border-t border-[#F3F4F6] bg-[#F9FAFB]">
            {toolbar}
          </div>
        )}
      </div>

      {/* Body · normal flow · no overflow trap */}
      <div className="flex-1 px-6 sm:px-8 py-6">
        {children}
      </div>

      {/* Footer bar · sticky at bottom · contains action buttons */}
      <div className="sticky bottom-0 bg-white border-t border-[#E5E7EB] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <div className="px-6 sm:px-8 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}
