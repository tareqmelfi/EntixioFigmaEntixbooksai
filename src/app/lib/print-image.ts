/**
 * Print image prep — fixes Chrome's print-preview stall ("Saving…" until tab switch).
 *
 * Org branding (stamp/signature/logo) is stored as multi-MB base64 data URLs.
 * Chrome's print preview rasterizes the FULL source image before enabling Save,
 * which froze the dialog for seconds. We downscale raster data URLs once for
 * print and gate window.print() until every resource is actually ready.
 */

/** Downscale a raster data-URL for print (max edge 640px). SVG/remote/small files pass through. */
export function downscaleDataUrl(url: string, maxDim = 640, quality = 0.86): Promise<string> {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("data:image/") || url.startsWith("data:image/svg")) return resolve(url);
    // small files (< ~250KB base64) are cheap enough as-is
    if (url.length < 340_000) return resolve(url);
    const img = new Image();
    const done = (out: string) => resolve(out || url);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale >= 1) return resolve(url);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(url);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // keep alpha for stamps/signatures → webp w/ alpha, fallback jpeg on white
        const webp = canvas.toDataURL("image/webp", quality);
        if (webp.startsWith("data:image/webp")) return done(webp);
        ctx.fillStyle = "#ffffff";
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

/** Resolve when fonts are ready and every <img> in the document settled (loaded or errored) — capped. */
export function waitForPrintReady(timeoutMs = 6000): Promise<void> {
  const imgs = Array.from(document.images);
  const imgPromises = imgs.map(
    (img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
          }),
  );
  const all = Promise.all([document.fonts?.ready ?? Promise.resolve(), ...imgPromises]).then(() => undefined);
  const cap = new Promise<void>((res) => setTimeout(res, timeoutMs));
  return Promise.race([all, cap]);
}
