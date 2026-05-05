/**
 * InstallPrompt · PWA install banner (#57)
 *
 * Listens for `beforeinstallprompt` (Android/Chromium) and shows a custom prompt
 * with localStorage-based dismissal. iOS shows a manual instruction card since
 * Safari doesn't expose the install API.
 *
 * Renders nothing if:
 *   - already installed (display-mode: standalone)
 *   - user dismissed in the last 7 days
 *   - browser doesn't support PWA install
 */
import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

const DISMISSED_KEY = "entix_install_dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch { return false; }
}

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (window.navigator as any).standalone === true;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;
    if (isIOS()) {
      // iOS: show manual instructions card after a small delay
      const t = setTimeout(() => setShowIos(true), 5000);
      return () => clearTimeout(t);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    setDeferred(null);
    setShowIos(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      try { localStorage.removeItem(DISMISSED_KEY); } catch {}
    } else {
      dismiss();
    }
    setDeferred(null);
  };

  if (!deferred && !showIos) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 lg:bottom-6 lg:right-6 lg:left-auto lg:max-w-sm">
      <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-lg p-4 flex items-start gap-3">
        <div className="rounded-xl bg-[#0B1B49] p-2.5 flex-shrink-0">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[#0B1B49] mb-1" style={{ fontSize: "15px", fontWeight: 700 }}>تثبيت Entix Books</h3>
          {deferred ? (
            <p className="text-[#6B7280] mb-3" style={{ fontSize: "13px", lineHeight: 1.5 }}>
              ثبّت التطبيق ليعمل أوفلاين ويفتح من الشاشة الرئيسية مباشرة.
            </p>
          ) : (
            <p className="text-[#6B7280] mb-3" style={{ fontSize: "13px", lineHeight: 1.5 }}>
              لتثبيت التطبيق على iPhone: اضغط زر المشاركة <span className="font-english">⎙</span> ثم "إضافة إلى الشاشة الرئيسية".
            </p>
          )}
          {deferred && (
            <button
              onClick={install}
              className="bg-[#1276E3] hover:bg-[#0B5FBF] text-white px-4 py-2 rounded-lg flex items-center gap-1.5"
              style={{ fontSize: "13px", fontWeight: 600 }}
            >
              <Download className="h-4 w-4" />
              تثبيت
            </button>
          )}
        </div>
        <button onClick={dismiss} className="text-[#9CA3AF] hover:text-[#6B7280] flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
