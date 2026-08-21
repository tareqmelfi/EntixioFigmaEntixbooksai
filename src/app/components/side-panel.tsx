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
import { useLanguageSafe } from "./LanguageContext";
import { X } from "lucide-react";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
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
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function SidePanel({ open, onClose, title, description, width = "md", children, footer }: SidePanelProps) {
  const { t } = useLanguageSafe();
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
    ? `fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border rounded-t-lg shadow-popover transition-transform duration-200 ease-out max-h-[85vh] ${open ? "translate-y-0" : "translate-y-full"}`
    : `fixed top-0 start-0 h-full z-40 bg-surface border-e border-border shadow-popover transition-transform duration-200 ease-out ${WIDTH_MAP[width]} w-full ${open ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"}`;

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
            <div className="h-1 w-10 rounded-full bg-muted" aria-hidden="true" />
          </div>
        )}
        <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <div className="min-w-0">
            {title && <h2 className="text-section font-semibold text-foreground truncate">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground shrink-0" aria-label={t("إغلاق", "Close")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>
        {footer && <div className="px-4 sm:px-6 py-3 border-t border-border bg-surface-subtle safe-area-inset-bottom">{footer}</div>}
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
          className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-popover flex items-start gap-3 ${
            t.kind === "success" ? "border-success-border bg-success-subtle text-success" :
            t.kind === "error" ? "border-danger-border bg-danger-subtle text-danger" :
            "border-info-border bg-info-subtle text-info"
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
export function InlineConfirm({ onConfirm, onCancel, label }: { onConfirm: () => void; onCancel: () => void; label?: string }) {
  const { t } = useLanguageSafe();
  useEffect(() => {
    const timer = setTimeout(onCancel, 4000);
    return () => clearTimeout(timer);
  }, [onCancel]);
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-danger-border bg-danger-subtle px-2 py-0.5 text-xs text-danger">
      <span>{label || t("تأكيد الحذف؟", "Confirm delete?")}</span>
      <button onClick={onConfirm} className="rounded-md bg-danger px-1.5 py-0.5 text-destructive-foreground hover:opacity-90">{t("نعم", "Yes")}</button>
      <button onClick={onCancel} className="rounded-md px-1.5 py-0.5 text-danger hover:bg-surface-hover">{t("لا", "No")}</button>
    </div>
  );
}
