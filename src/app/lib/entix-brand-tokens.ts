/** Shared by the UI wordmark and exported documents. Never use the Arabic face for the logo. */
export const ENTIX_BRAND = {
  navy: "#0B1B49", blue: "#1276E3", cyan: "#05B6FA",
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
