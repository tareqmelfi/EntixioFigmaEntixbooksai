import { cn } from "./ui/utils";

const brandNavy = "#0B1B49";
const brandBlue = "#1276E3";
const brandCyan = "#05B6FA";

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
      aria-label="ENTIX.IO"
      style={{ fontSize: size, fontWeight: 850, letterSpacing: 0, lineHeight: 1 }}
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
      <span style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 800, letterSpacing: 0, lineHeight: 1 }}>
        E<span style={{ color: brandBlue }}>.IO</span>
      </span>
    </span>
  );
}
