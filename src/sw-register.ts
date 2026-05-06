/**
 * Service Worker registration · imported once from main.tsx
 *
 * Auto-checks for updates on every page load. When new SW is found,
 * shows a toast prompting the user to reload (or auto-reloads after 3s).
 */

const SW_PATH = "/sw.js";

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Skip in dev (Vite HMR conflicts) — only register in production
  if (import.meta.env.DEV) return;

  // iOS Safari with Lockdown Mode disables SW · gracefully bail
  // (registration just throws; we catch and continue without SW)

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });

      // Check for update on every page load (cheap · just HEAD request)
      reg.update().catch(() => {});

      // When a new worker is found and reaches "installed", trigger reload
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // A new SW is waiting · activate it on next tick
            newWorker.postMessage({ type: "SKIP_WAITING" });
            // Reload once the new SW takes control
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => {
                if ((window as any).__entix_reloaded) return;
                (window as any).__entix_reloaded = true;
                window.location.reload();
              },
              { once: true },
            );
          }
        });
      });
    } catch (e) {
      console.warn("[sw] registration skipped", e);
    }
  });
}
