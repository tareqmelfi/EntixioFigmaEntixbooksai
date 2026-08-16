import * as React from "react";
import { cn } from "./utils";

type CardDensity = "compact" | "default" | "comfortable";

type CardProps = React.ComponentProps<"div"> & {
  density?: CardDensity;
};

function Card({ className, density = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-density={density}
      className={cn(
        "group/card bg-card text-card-foreground flex flex-col rounded-lg border border-border",
        density === "compact" ? "gap-4" : density === "comfortable" ? "gap-6" : "gap-5",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-4 pt-4 group-data-[density=comfortable]/card:px-6 group-data-[density=comfortable]/card:pt-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4 group-data-[density=comfortable]/card:[.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <h4 data-slot="card-title" className={cn("leading-snug", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <p data-slot="card-description" className={cn("text-muted-foreground", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn("px-4 group-data-[density=comfortable]/card:px-6 [&:last-child]:pb-4 group-data-[density=comfortable]/card:[&:last-child]:pb-6", className)}
      {...props}
    />
  ),
);
CardContent.displayName = "CardContent";

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-4 pb-4 group-data-[density=comfortable]/card:px-6 group-data-[density=comfortable]/card:pb-6 [.border-t]:pt-4 group-data-[density=comfortable]/card:[.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
