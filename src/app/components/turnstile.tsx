import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    __turnstileScriptPromise?: Promise<void>;
  }
}

const SITEKEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_TURNSTILE_SITEKEY) || "";
const SCRIPT_SELECTOR = 'script[data-entix-turnstile="true"]';
export const isTurnstileRequired = Boolean(SITEKEY);

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileScriptPromise) return window.__turnstileScriptPromise;
  const script = document.createElement("script");
  script.dataset.entixTurnstile = "true";
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  const promise = new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile_script_failed"));
    document.head.appendChild(script);
  }).catch(error => {
    if (window.__turnstileScriptPromise === promise) delete window.__turnstileScriptPromise;
    script.remove();
    throw error;
  });
  window.__turnstileScriptPromise = promise;
  return promise;
}

export type TurnstileStatus = "ready" | "expired" | "error";

interface TurnstileProps {
  onVerify: (token: string | null) => void;
  onStatusChange?: (status: TurnstileStatus) => void;
  resetKey?: number;
  language?: "ar" | "en";
}

export function Turnstile({ onVerify, onStatusChange, resetKey = 0, language = "ar" }: TurnstileProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const [failed, setFailed] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    if (!SITEKEY) {
      onVerify(null);
      return;
    }
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    const invalidate = (status: Exclude<TurnstileStatus, "ready">) => {
      if (!isCurrent()) return;
      onVerify(null);
      onStatusChange?.(status);
      if (status === "error") setFailed(true);
    };

    loadScript()
      .then(() => {
        if (!isCurrent() || !hostRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: SITEKEY,
          language,
          callback: (token: string) => {
            if (!isCurrent()) return;
            setFailed(false);
            onVerify(token);
            onStatusChange?.("ready");
          },
          "expired-callback": () => {
            if (!isCurrent()) return;
            invalidate("expired");
            if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
          },
          "error-callback": () => invalidate("error"),
          "timeout-callback": () => invalidate("error"),
          "unsupported-callback": () => invalidate("error"),
        });
      })
      .catch(() => invalidate("error"));

    return () => {
      generationRef.current += 1;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId && window.turnstile) {
        try { window.turnstile.remove(widgetId); } catch { /* noop */ }
      }
    };
  }, [language, renderKey]);

  useEffect(() => {
    if (!SITEKEY || resetKey === 0) return;
    onVerify(null);
    setFailed(false);
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    else setRenderKey(key => key + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!SITEKEY) return null;

  return (
    <div className="my-3">
      <div ref={hostRef} className="flex justify-center" />
      {failed && (
        <div data-testid="captcha-error" role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          <p>{language === "ar" ? "تعذر التحقق الأمني. يرجى المحاولة مرة أخرى." : "Security verification failed. Please try again."}</p>
          <button
            type="button"
            onClick={() => {
              onVerify(null);
              setFailed(false);
              if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
              else {
                document.querySelector(SCRIPT_SELECTOR)?.remove();
                delete window.__turnstileScriptPromise;
                setRenderKey(key => key + 1);
              }
            }}
            className="mt-2 font-semibold text-primary hover:underline"
          >
            {language === "ar" ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      )}
    </div>
  );
}
