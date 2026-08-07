/**
 * Receipt image enhancement · converts phone-captured photos into scanner-like
 * documents before AI extraction:
 *   - downscales oversized captures (max edge 2000px) to keep payloads sane
 *   - per-channel contrast stretch (1% histogram clip) so faint thermal-paper
 *     text and badly-lit shots stay readable
 *   - re-encodes as JPEG (photos lose nothing; AI OCR reads them better)
 *
 * Non-image files (PDF) and any failure fall back to `null` → caller uses the
 * original file untouched. The original is always kept alongside the enhanced
 * copy as a separate attachment downstream.
 */

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.92;
const CLIP = 0.01; // histogram clip per side

export type EnhancedReceipt = { base64: string; mimeType: string };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img_load_failed"));
    img.src = src;
  });
}

/** 1%/99% percentile per channel → linear stretch to [0,255]. */
function contrastStretch(data: Uint8ClampedArray): void {
  const channels = 3;
  const histograms: number[][] = [];
  for (let c = 0; c < channels; c++) histograms.push(new Array(256).fill(0));
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    histograms[0][data[i]]++;
    histograms[1][data[i + 1]]++;
    histograms[2][data[i + 2]]++;
  }
  const lo = new Array(channels).fill(0);
  const hi = new Array(channels).fill(255);
  for (let c = 0; c < channels; c++) {
    const clipCount = px * CLIP;
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += histograms[c][v]; if (acc >= clipCount) { lo[c] = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += histograms[c][v]; if (acc >= clipCount) { hi[c] = v; break; } }
  }
  const maps: number[][] = [];
  for (let c = 0; c < channels; c++) {
    const range = Math.max(1, hi[c] - lo[c]);
    const lut = new Array(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.min(255, Math.max(0, Math.round(((v - lo[c]) * 255) / range)));
    maps.push(lut);
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = maps[0][data[i]];
    data[i + 1] = maps[1][data[i + 1]];
    data[i + 2] = maps[2][data[i + 2]];
  }
}

/**
 * Enhance a captured receipt photo. Returns null for PDFs / non-raster input /
 * any processing failure — the caller then falls back to the original file.
 */
export async function enhanceReceiptImage(file: File): Promise<EnhancedReceipt | null> {
  try {
    if (!file.type.startsWith("image/") || file.type.includes("svg")) return null;
    const dataUrl = await readAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    contrastStretch(imageData.data);
    ctx.putImageData(imageData, 0, 0);
    const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (!out.startsWith("data:image/jpeg")) return null;
    return { base64: out.slice(out.indexOf(",") + 1), mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}
