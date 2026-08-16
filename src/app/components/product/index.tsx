import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "../ui/utils";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type HeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, eyebrow, leading, actions, className }: HeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {leading && <div className="mt-1 shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">
        {eyebrow && <div className="mb-1 text-label font-medium text-primary">{eyebrow}</div>}
        <h1 className="text-page font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, description, actions, className }: HeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-section font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type ToolbarProps = React.ComponentProps<"div">;

export function PageToolbar({ className, ...props }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      className={cn("flex flex-wrap items-center gap-2 rounded-lg border bg-surface p-2", className)}
      {...props}
    />
  );
}

type SearchFieldProps = React.ComponentProps<typeof Input> & {
  containerClassName?: string;
};

export function SearchField({ className, containerClassName, ...props }: SearchFieldProps) {
  return (
    <div className={cn("relative min-w-0 flex-1", containerClassName)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" className={cn("ps-9", className)} {...props} />
    </div>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "critical";

const toneClasses: Record<Tone, string> = {
  neutral: "border-border bg-surface-subtle text-content-secondary",
  info: "border-info-border bg-info-subtle text-info",
  success: "border-success-border bg-success-subtle text-success",
  warning: "border-warning-border bg-warning-subtle text-warning",
  critical: "border-danger-border bg-danger-subtle text-danger",
};

type StatusBadgeProps = React.ComponentProps<"span"> & {
  tone?: Tone;
  icon?: React.ReactNode;
  live?: boolean;
};

export function StatusBadge({ tone = "neutral", icon, live = false, className, children, ...props }: StatusBadgeProps) {
  return (
    <span
      role={live ? "status" : undefined}
      className={cn("inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", toneClasses[tone], className)}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

type MetricProps = React.ComponentProps<"div"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
};

const indicatorClasses: Record<Tone, string> = {
  neutral: "bg-content-secondary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-danger",
};

export function Metric({ label, value, hint, tone = "neutral", icon, className, ...props }: MetricProps) {
  return (
    <div className={cn("min-w-0 rounded-lg border bg-surface p-4", className)} {...props}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", indicatorClasses[tone])} aria-hidden="true" />
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div dir="auto" className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function MetricStrip({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)} {...props} />;
}

type InlineAlertProps = React.ComponentProps<"div"> & {
  tone?: Tone;
  title?: React.ReactNode;
  icon?: React.ReactNode;
};

export function InlineAlert({ tone = "neutral", title, icon, children, className, ...props }: InlineAlertProps) {
  return (
    <div role={tone === "critical" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-3 text-sm", toneClasses[tone], className)} {...props}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <div className="font-medium text-foreground">{title}</div>}
        <div className={cn(title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}

export const FeedbackBanner = InlineAlert;

type EmptyStateProps = React.ComponentProps<"div"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, icon, action, className, ...props }: EmptyStateProps) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed bg-surface px-6 py-10 text-center", className)} {...props}>
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-lg text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type FormFieldProps = {
  id: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactElement<Record<string, unknown>>;
  className?: string;
};

export function FormField({ id, label, help, error, required, children, className }: FormFieldProps) {
  const effectiveId = String(children.props.id ?? id);
  const generatedDescriptions = [help && `${effectiveId}-help`, error && `${effectiveId}-error`].filter(Boolean);
  const describedBy = [children.props["aria-describedby"], ...generatedDescriptions].filter(Boolean).join(" ") || undefined;
  const control = React.cloneElement(children, {
    id: effectiveId,
    required: required ?? children.props.required,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-describedby": describedBy,
  });

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={effectiveId} className="block text-sm font-medium text-foreground">
        {label}{required && <span className="ms-1 text-danger" aria-hidden="true">*</span>}
      </label>
      {control}
      {help && <p id={`${effectiveId}-help`} className="text-xs text-muted-foreground">{help}</p>}
      {error && <p id={`${effectiveId}-error`} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

type DataColumn<Row> = {
  key: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  numeric?: boolean;
  className?: string;
};

type DataTableProps<Row> = {
  columns: DataColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => React.Key;
  density?: "dense" | "default";
  stickyHeader?: boolean;
  loading?: boolean;
  error?: React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
};

export function DataTable<Row>({ columns, rows, rowKey, density = "default", stickyHeader, loading, error, empty, className }: DataTableProps<Row>) {
  const message = loading ? "Loading…" : empty ?? "No records";
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-surface", className)} aria-busy={loading || undefined}>
      {error && <InlineAlert tone="critical" className="m-3">{error}</InlineAlert>}
      <Table>
        <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-surface")}>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={cn(column.numeric && "text-end", column.className)}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">{message}</TableCell>
            </TableRow>
          ) : rows.map((row) => (
            <TableRow key={rowKey(row)} className={density === "dense" ? "h-9" : "h-11"}>
              {columns.map((column) => (
                <TableCell key={column.key} className={cn(column.numeric && "text-end", column.className)}>
                  {column.numeric ? <TableNumericCell>{column.cell(row)}</TableNumericCell> : column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TableNumericCell({ className, ...props }: React.ComponentProps<"span">) {
  return <span dir="ltr" className={cn("block text-end font-english tabular-nums", className)} {...props} />;
}

export function SettingsSection({ title, description, actions, children, className }: HeaderProps & { children?: React.ReactNode }) {
  return (
    <section className={cn("rounded-lg border bg-surface", className)}>
      <div className="border-b p-4 sm:p-5"><SectionHeader title={title} description={description} actions={actions} /></div>
      {children && <div className="p-4 sm:p-5">{children}</div>}
    </section>
  );
}
