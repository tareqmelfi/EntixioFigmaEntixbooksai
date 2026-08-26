/**
 * GlobalToasts — one toast stack mounted in the app shell for messages raised
 * outside a page's own stack (`window.dispatchEvent(new CustomEvent("entix:toast",
 * { detail: { kind, message } }))`) · e.g. «draft kept» when leaving a form.
 */
import { useEffect } from "react";
import { ToastStack, useToasts } from "./side-panel";

export function GlobalToasts() {
  const { toasts, push, dismiss } = useToasts();
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent).detail || {}; push(d.kind || "info", d.message || "", d.ms || 4500); };
    window.addEventListener("entix:toast", on);
    return () => window.removeEventListener("entix:toast", on);
  }, [push]);
  return <ToastStack toasts={toasts} onDismiss={dismiss} />;
}
