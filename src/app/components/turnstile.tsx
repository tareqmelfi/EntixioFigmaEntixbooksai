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
const SCRIPT_LOAD_TIMEOUT_MS = 3000;
const EXACT_RETRYABLE_ERROR_CODES = new Set(["110600", "110620", "200500"]);
export const isTurnstileRequired = Boolean(SITEKEY);

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileScriptPromise) return window.__turnstileScriptPromise;
  const existing = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
  const script = existing || document.createElement("script");
  if (!existing) {
    script.dataset.entixTurnstile = "true";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
  }
  const promise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;
    let pollId = 0;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(pollId);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if (error) reject(error);
      else resolve();
    };
    const handleLoad = () => finish(window.turnstile ? undefined : new Error("turnstile_sdk_missing"));
    const handleError = () => finish(new Error("turnstile_script_failed"));
    timeoutId = window.setTimeout(() => finish(new Error("turnstile_script_timeout")), SCRIPT_LOAD_TIMEOUT_MS);
    pollId = window.setInterval(() => {
      if (window.turnstile) finish();
    }, 50);
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (window.turnstile) finish();
    else if (!existing) document.head.appendChild(script);
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
  onStatusChange?: (status: TurnstileStatus, errorCode?: string) => void;
  resetKey?: number;
  language?: "ar" | "en";
}

export function Turnstile({ onVerify, onStatusChange, resetKey = 0, language = "ar" }: TurnstileProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const automaticRetryUsedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    if (!SITEKEY) {
      onVerify(null);
      return;
    }
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    const invalidate = (status: Exclude<TurnstileStatus, "ready">, code?: string) => {
      if (!isCurrent()) return;
      onVerify(null);
      onStatusChange?.(status, code);
      if (status === "error") {
        setErrorCode(code || null);
        setFailed(true);
      }
    };

    loadScript()
      .then(() => {
        if (!isCurrent() || !hostRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: SITEKEY,
          language,
          retry: "never",
          "retry-interval": 8000,
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
          callback: (token: string) => {
            if (!isCurrent()) return;
            automaticRetryUsedRef.current = false;
            setErrorCode(null);
            setFailed(false);
            onVerify(token);
            onStatusChange?.("ready");
          },
          "expired-callback": () => {
            if (!isCurrent()) return;
            invalidate("expired");
            if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
          },
          "error-callback": (code?: string) => {
            if (!isCurrent()) return;
            invalidate("error", code);
            const retryable = !code || EXACT_RETRYABLE_ERROR_CODES.has(code) || code.startsWith("300") || code.startsWith("600");
            if (retryable && !automaticRetryUsedRef.current && widgetIdRef.current && window.turnstile) {
              automaticRetryUsedRef.current = true;
              window.turnstile.reset(widgetIdRef.current);
            }
          },
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
    automaticRetryUsedRef.current = false;
    setErrorCode(null);
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
          <p>
            {errorCode === "110200"
              ? "Turnstile configuration error: this hostname is not authorized. خطأ في إعداد Turnstile: اسم النطاق غير مصرح به."
              : language === "ar"
                ? "تعذر التحقق الأمني. يرجى المحاولة مرة أخرى."
                : "Security verification failed. Please try again."}
          </p>
          {errorCode && <p className="mt-1 font-mono text-xs">{errorCode}</p>}
          <button
            type="button"
            onClick={() => {
              onVerify(null);
              automaticRetryUsedRef.current = false;
              setErrorCode(null);
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
