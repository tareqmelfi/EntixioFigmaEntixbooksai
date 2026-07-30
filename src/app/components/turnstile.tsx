/**
 * Cloudflare Turnstile widget (SEC-03 spam protection on public auth forms).
 *
 * - Loads https://challenges.cloudflare.com/turnstile/v0/api.js lazily.
 * - Sitekey from VITE_TURNSTILE_SITEKEY; when unset (local dev) renders nothing
 *   and calls onVerify(null) so forms stay usable.
 * - Token is sent to the API in the `x-captcha-response` header; better-auth's
 *   captcha plugin verifies it server-side (env-gated on TURNSTILE_SECRET_KEY).
 */
import { useEffect, useRef } from "react";

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

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileScriptPromise) return window.__turnstileScriptPromise;
  window.__turnstileScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile_script_failed"));
    document.head.appendChild(s);
  });
  return window.__turnstileScriptPromise;
}

export function Turnstile({ onVerify }: { onVerify: (token: string | null) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITEKEY) {
      onVerify(null);
      return;
    }
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: SITEKEY,
          callback: (token: string) => onVerify(token),
          "expired-callback": () => onVerify(null),
          "error-callback": () => onVerify(null),
        });
      })
      .catch(() => onVerify(null));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITEKEY) return null;
  return <div ref={hostRef} className="flex justify-center my-3" />;
}
