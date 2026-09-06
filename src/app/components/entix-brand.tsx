import { cn } from "./ui/utils";
import { ENTIX_BRAND } from "../lib/entix-brand-tokens";
import { ENTIX_LOGO_ACCENT_PATH, ENTIX_LOGO_INK_PATH, ENTIX_LOGO_VIEWBOX } from "../lib/entix-logo-paths";

const brandNavy = ENTIX_BRAND.navy;
const brandBlue = ENTIX_BRAND.blue;
const brandCyan = ENTIX_BRAND.cyan;

type EntixWordmarkProps = {
  className?: string;
  size?: number;
  light?: boolean;
};

/** Logo aspect from the traced vector (293 × 57). `size` keeps its old meaning:
 *  the cap height of the wordmark in px, so existing call sites stay visually sized. */
const LOGO_RATIO = 293 / 57;

export function EntixWordmark({ className, size = 20, light = false }: EntixWordmarkProps) {
  const baseColor = light ? ENTIX_BRAND.navyOnDark : brandNavy;
  const accentColor = light ? ENTIX_BRAND.blueOnDark : brandBlue;
  const height = Math.round(size * 1.15);

  return (
    <span
      className={cn("inline-flex items-center select-none", className)}
      dir="ltr"
      lang="en"
      role="img"
      aria-label="ENTIX.IO"
      style={{ height, lineHeight: 0 }}
    >
      {/* Vector wordmark: the production logo traced to paths. Rendering it as text drifted
          letterforms (serif I, wrong weight) between locales; paths are pixel-identical everywhere. */}
      <svg viewBox={ENTIX_LOGO_VIEWBOX} height={height} width={Math.round(height * LOGO_RATIO)} aria-hidden="true" focusable="false">
        <path fill={baseColor} fillRule="evenodd" d={ENTIX_LOGO_INK_PATH} />
        <path fill={accentColor} fillRule="evenodd" d={ENTIX_LOGO_ACCENT_PATH} />
      </svg>
    </span>
  );
}

type EntixAvatarMarkProps = {
  className?: string;
  sizeClass?: string;
  light?: boolean;
};

export function EntixAvatarMark({ className, sizeClass = "h-10 w-10", light = false }: EntixAvatarMarkProps) {
  return (
    <span
      className={cn(
        "font-english relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm",
        sizeClass,
        className
      )}
      style={{ backgroundColor: light ? "rgba(255,255,255,0.12)" : brandNavy }}
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: brandCyan }} />
      <span dir="ltr" lang="en" style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 700, letterSpacing: 0, lineHeight: 1 }}>
        E<span style={{ color: ENTIX_BRAND.blueOnDark }}>.IO</span>
      </span>
    </span>
  );
}
