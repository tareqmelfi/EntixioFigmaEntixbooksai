import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, dir, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      dir={dir ?? "auto"}
      className={cn(
        "resize-y border-input placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full rounded-lg border bg-surface px-3 py-2 text-base transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
