import * as React from "react";
import { cn } from "../ui/utils";

type MarketingContainerProps = React.ComponentProps<"div">;

export function MarketingContainer({ className, ...props }: MarketingContainerProps) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

type MarketingSectionProps = React.ComponentProps<"section">;

export function MarketingSection({ className, ...props }: MarketingSectionProps) {
  return <section className={cn("bg-background py-12 sm:py-16 lg:py-20", className)} {...props} />;
}

type MarketingHeadingProps = Omit<React.ComponentProps<"div">, "title"> & {
  as?: "h1" | "h2";
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "start" | "center";
};

export function MarketingHeading({
  as: Heading = "h2",
  eyebrow,
  title,
  description,
  align = "start",
  className,
  ...props
}: MarketingHeadingProps) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)} {...props}>
      {eyebrow && <p className="mb-2 text-label font-medium text-primary">{eyebrow}</p>}
      <Heading className={`${Heading === "h1" ? "text-page" : "text-section"} font-semibold text-foreground`}>{title}</Heading>
      {description && <p className="mt-3 text-body leading-7 text-muted-foreground">{description}</p>}
    </div>
  );
}

type FeatureItemProps = Omit<React.ComponentProps<"article">, "title"> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
};

export function FeatureItem({ icon, title, description, children, className, ...props }: FeatureItemProps) {
  return (
    <article className={cn("rounded-lg border border-border bg-surface p-5", className)} {...props}>
      {icon && <div className="mb-4 text-primary" aria-hidden="true">{icon}</div>}
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}
      {children}
    </article>
  );
}

type AuthShellProps = React.ComponentProps<"main">;

export function AuthShell({ className, ...props }: AuthShellProps) {
  return (
    <main
      className={cn("flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6", className)}
      {...props}
    />
  );
}

type AuthPanelProps = Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
};

export function AuthPanel({ title, description, children, className, ...props }: AuthPanelProps) {
  return (
    <section className={cn("w-full max-w-md rounded-lg border border-border bg-surface p-6 sm:p-8", className)} {...props}>
      {(title || description) && (
        <header className="mb-6">
          {title && <h1 className="text-section font-semibold text-foreground">{title}</h1>}
          {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

type AuthAlertTone = "neutral" | "info" | "success" | "warning" | "critical";

type AuthAlertProps = React.ComponentProps<"div"> & {
  tone?: AuthAlertTone;
  title?: React.ReactNode;
  icon?: React.ReactNode;
};

const authAlertToneClasses: Record<AuthAlertTone, string> = {
  neutral: "border-border bg-surface-subtle text-content-secondary",
  info: "border-info-border bg-info-subtle text-info",
  success: "border-success-border bg-success-subtle text-success",
  warning: "border-warning-border bg-warning-subtle text-warning",
  critical: "border-danger-border bg-danger-subtle text-danger",
};

export function AuthAlert({ tone = "neutral", title, icon, children, className, ...props }: AuthAlertProps) {
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border p-3 text-sm", authAlertToneClasses[tone], className)}
      {...props}
    >
      {icon && <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <div className={cn(title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}

export const AuthAlertWrapper = AuthAlert;
