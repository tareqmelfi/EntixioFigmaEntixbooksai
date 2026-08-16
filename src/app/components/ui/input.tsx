import * as React from "react";

import { cn } from "./utils";

const LTR_INPUT_TYPES = new Set(["email", "tel", "number", "date", "time", "datetime-local", "month", "week", "url"]);

function isExplicitLtrInput(type?: string, inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]) {
  return LTR_INPUT_TYPES.has(type || "text") || inputMode === "numeric" || inputMode === "decimal" || inputMode === "tel" || inputMode === "email" || inputMode === "url";
}

function Input({ className, type = "text", dir, inputMode, ...props }: React.ComponentProps<"input">) {
  const resolvedDir = dir ?? (isExplicitLtrInput(type, inputMode) ? "ltr" : "auto");
  return (
    <input
      type={type}
      dir={resolvedDir}
      inputMode={inputMode}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-9 w-full min-w-0 rounded-lg border bg-surface px-3 py-1 text-base transition-[border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
