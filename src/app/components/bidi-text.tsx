import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "./ui/utils";

const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufefc]/u;

export function containsArabicScript(value: unknown): boolean {
  return ARABIC_SCRIPT.test(String(value ?? ""));
}

type BidiMode = "isolate" | "plaintext";

type BidiTextProps = Omit<HTMLAttributes<HTMLElement>, "children" | "dir"> & {
  children: ReactNode;
  mode?: BidiMode;
  compact?: boolean;
  title?: string;
};

export function BidiText({ children, className, compact = false, mode = "isolate", style, title, ...props }: BidiTextProps) {
  const plainText = typeof children === "string" || typeof children === "number" ? String(children) : "";
  const hasArabic = containsArabicScript(plainText);
  const bidiStyle: CSSProperties = mode === "plaintext"
    ? { unicodeBidi: "plaintext", ...style }
    : { unicodeBidi: "isolate", ...style };

  return (
    <bdi
      dir="auto"
      lang={hasArabic ? "ar" : undefined}
      className={cn("bidi-text", compact && "bidi-text-compact", className)}
      style={bidiStyle}
      title={title ?? (compact && plainText ? plainText : undefined)}
      {...props}
    >
      {children}
    </bdi>
  );
}

export function EntityText(props: BidiTextProps) {
  return <BidiText mode="plaintext" {...props} />;
}

export function NumericText({ children, className, style, ...props }: Omit<BidiTextProps, "mode" | "compact">) {
  return (
    <bdi
      dir="ltr"
      lang="en"
      className={cn("numeric-text", className)}
      style={{ unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums", ...style }}
      {...props}
    >
      {children}
    </bdi>
  );
}
