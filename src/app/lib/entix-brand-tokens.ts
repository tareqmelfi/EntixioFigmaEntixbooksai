/** Shared by the UI wordmark and exported documents. Never use the Arabic face for the logo. */
export const ENTIX_BRAND = {
  /* Ledger design system (2026-09): logo ink + logo blue, taken from the production logo. */
  navy: "#1A1E48", blue: "#5B75DC", cyan: "#8FA3F0",
  /* On dark grounds (cover cards, dark headers) the wordmark flips to paper + lifted blue. */
  navyOnDark: "#F6F1E8", blueOnDark: "#8FA3F0",
  fontFamily: "Plus Jakarta Sans", fontWeight: 850,
} as const;

export async function drawEntixWordmark(ctx: CanvasRenderingContext2D, right: number, baseline: number, size: number) {
  const font = `${ENTIX_BRAND.fontWeight} ${size}px "${ENTIX_BRAND.fontFamily}"`;
  const faces = await document.fonts.load(font, "ENTIX.IO");
  if (!faces.length || !document.fonts.check(font, "ENTIX.IO")) throw new Error("brand_font_unavailable");
  ctx.save();
  const lang = ctx.canvas.lang;
  ctx.canvas.lang = "en";
  ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.font = font;
  const prefixWidth = ctx.measureText("ENTIX").width;
  const accentWidth = ctx.measureText(".").width + ctx.measureText("IO").width;
  const left = right - prefixWidth - accentWidth;
  ctx.fillStyle = ENTIX_BRAND.navy; ctx.fillText("ENTIX", left, baseline);
  ctx.fillStyle = ENTIX_BRAND.blue; ctx.fillText(".", left + prefixWidth, baseline);
  ctx.fillText("IO", left + prefixWidth + ctx.measureText(".").width, baseline);
  ctx.canvas.lang = lang;
  ctx.restore();
}
