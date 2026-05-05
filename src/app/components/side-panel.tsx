/**
 * SidePanel · slide-over from the right edge (RTL: from the left edge)
 *
 * UX RULE UX-1: This is NOT a modal. It does NOT have a backdrop overlay
 * that blocks the rest of the UI. It pushes/floats over content but the
 * underlying page stays interactive (background scroll allowed).
 *
 * Approved replacement for shadcn <Dialog>.
 *
 * Usage:
 *   <SidePanel open={open} onClose={() => setOpen(false)} title="فاتورة جديدة">
 *     <form>...</form>
 *   </SidePanel>
 */
import { useEffect, ReactNode } from "react";
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
  sm: "w-[400px]",
  md: "w-[520px]",
  lg: "w-[640px]",
  xl: "w-[800px]",
};

export function SidePanel({ open, onClose, title, description, width = "md", children, footer }: SidePanelProps) {
  // Close on ESC · but no backdrop click (intentional — page must stay reachable)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed top-0 start-0 h-full z-40 bg-white border-e border-[#E5E7EB] shadow-xl transition-transform duration-200 ease-out ${WIDTH_MAP[width]} max-w-[92vw] ${open ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"}`}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="min-w-0">
            <h2 className="text-[#0B1B49] truncate" style={{ fontSize: "1.125rem", fontWeight: 600 }}>{title}</h2>
            {description && <p className="text-xs text-[#6B7280] mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49] shrink-0" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB]">{footer}</div>}
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
import { useState, useCallback, useRef } from "react";
export function useToasts() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((arr) => arr.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: ToastState["kind"], message: string, ms = 4000) => {
    const id = ++idRef.current;
    setToasts((arr) => [...arr, { id, kind, message }]);
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
