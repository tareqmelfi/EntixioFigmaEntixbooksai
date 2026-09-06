import { cn } from "./ui/utils";
import { ENTIX_BRAND } from "../lib/entix-brand-tokens";

const brandNavy = ENTIX_BRAND.navy;
const brandBlue = ENTIX_BRAND.blue;
const brandCyan = ENTIX_BRAND.cyan;

type EntixWordmarkProps = {
  className?: string;
  size?: number;
  light?: boolean;
};

export function EntixWordmark({ className, size = 20, light = false }: EntixWordmarkProps) {
  const baseColor = light ? "#FFFFFF" : brandNavy;
  const accentColor = light ? brandCyan : brandBlue;

  return (
    <span
      className={cn("font-english inline-flex items-baseline select-none", className)}
      dir="ltr"
      /* lang="en" is load-bearing: with <html lang="ar"> Chrome resolves the
       * Latin run against the Arabic-locale face even though font-family is
       * identical, so the wordmark rendered with different letterforms in the
       * Arabic UI. Pinning the run's locale keeps AR and EN pixel-identical. */
      lang="en"
      aria-label="ENTIX.IO"
      style={{ fontFamily: ENTIX_BRAND.fontFamily, fontSize: size, fontWeight: ENTIX_BRAND.fontWeight, letterSpacing: 0, lineHeight: 1 }}
    >
      <span style={{ color: baseColor }}>ENTIX</span>
      <span style={{ color: accentColor }}>.</span>
      <span style={{ color: accentColor }}>IO</span>
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
        "font-english relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm",
        sizeClass,
        className
      )}
      style={{ backgroundColor: light ? "rgba(255,255,255,0.12)" : brandNavy }}
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: brandCyan }} />
      <span dir="ltr" lang="en" style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 800, letterSpacing: 0, lineHeight: 1 }}>
        E<span style={{ color: brandBlue }}>.IO</span>
      </span>
    </span>
  );
}
