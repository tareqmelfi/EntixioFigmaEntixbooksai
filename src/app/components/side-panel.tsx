/**
 * SidePanel · slide-over component (UX-1 compliant · NOT a modal)
 *
 * Desktop (≥ sm/640px): slides from start edge (RTL=right · LTR=left), keeps page reachable.
 * Mobile (< sm/640px):   bottom-sheet · slides UP from bottom, max-h 85vh, drag-handle.
 *
 * Approved replacement for shadcn <Dialog>.
 *
 * Usage:
 *   <SidePanel open={open} onClose={() => setOpen(false)} title="فاتورة جديدة">
 *     <form>...</form>
 *   </SidePanel>
 */
import { useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { X } from "lucide-react";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  width?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
  footer?: ReactNode;
}

const WIDTH_MAP = {
  sm: "sm:w-[400px]",
  md: "sm:w-[520px]",
  lg: "sm:w-[640px]",
  xl: "sm:w-[800px]",
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function SidePanel({ open, onClose, title, description, width = "md", children, footer }: SidePanelProps) {
  const isMobile = useIsMobile();

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Mobile: bottom-sheet. Desktop: side slide-over.
  // Both: NO backdrop · page stays interactive (UX-1).
  const containerClass = isMobile
    ? `fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] rounded-t-2xl shadow-2xl transition-transform duration-200 ease-out max-h-[85vh] ${open ? "translate-y-0" : "translate-y-full"}`
    : `fixed top-0 start-0 h-full z-40 bg-white border-e border-[#E5E7EB] shadow-xl transition-transform duration-200 ease-out ${WIDTH_MAP[width]} w-full ${open ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"}`;

  return (
    <div
      aria-hidden={!open}
      className={containerClass}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <div className="flex h-full max-h-[85vh] sm:max-h-none flex-col">
        {/* Mobile drag-handle indicator */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" aria-hidden="true" />
          </div>
        )}
        <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#E5E7EB]">
          <div className="min-w-0">
            <h2 className="text-[#0B1B49] truncate" style={{ fontSize: "1.125rem", fontWeight: 600 }}>{title}</h2>
            {description && <p className="text-xs text-[#6B7280] mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49] shrink-0" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>
        {footer && <div className="px-4 sm:px-6 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB] safe-area-inset-bottom">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Toast · non-blocking notification at bottom-right.
 * Approved replacement for window.alert().
 */
export interface ToastState {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastState[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg flex items-start gap-3 ${
            t.kind === "success" ? "border-green-200 bg-green-50 text-green-800" :
            t.kind === "error" ? "border-red-200 bg-red-50 text-red-800" :
            "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          <span className="flex-1 text-sm">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="text-current opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

/**
 * Hook for managing toasts.
 *
 * Usage:
 *   const { toasts, push, dismiss } = useToasts();
 *   push("success", "تم الحفظ");
 *   <ToastStack toasts={toasts} onDismiss={dismiss} />
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((arr) => arr.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: ToastState["kind"], message: any, ms = 4000) => {
    const id = ++idRef.current;
    // Coerce non-strings safely · prevents "[object Object]" toasts
    let msg: string;
    if (typeof message === "string") msg = message;
    else if (message instanceof Error) msg = message.message;
    else if (message && typeof message === "object") {
      msg = (message as any).error || (message as any).message || (message as any).detail || JSON.stringify(message);
    } else msg = String(message ?? "—");
    setToasts((arr) => [...arr, { id, kind, message: msg }]);
    if (ms > 0) setTimeout(() => dismiss(id), ms);
  }, [dismiss]);
  return { toasts, push, dismiss };
}

/**
 * InlineConfirm · replaces window.confirm() for destructive actions.
 *
 * Usage:
 *   const [pendingDelete, setPendingDelete] = useState<string | null>(null);
 *   ...
 *   {pendingDelete === id ? (
 *     <InlineConfirm onConfirm={() => doDelete(id)} onCancel={() => setPendingDelete(null)} />
 *   ) : (
 *     <button onClick={() => setPendingDelete(id)}><Trash /></button>
 *   )}
 */
export function InlineConfirm({ onConfirm, onCancel, label = "تأكيد الحذف؟" }: { onConfirm: () => void; onCancel: () => void; label?: string }) {
  useEffect(() => {
    const t = setTimeout(onCancel, 4000);
    return () => clearTimeout(t);
  }, [onCancel]);
  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs">
      <span className="text-red-700">{label}</span>
      <button onClick={onConfirm} className="rounded px-1.5 py-0.5 bg-red-600 text-white hover:bg-red-700">نعم</button>
      <button onClick={onCancel} className="rounded px-1.5 py-0.5 text-red-700 hover:bg-red-100">لا</button>
    </div>
  );
}
