import { Link } from "react-router";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

export type AdminWorkspaceViewState = "loading" | "ready" | "session" | "forbidden" | "notFound" | "failed";

export function AdminWorkspaceLoading() {
  return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

export function AdminWorkspaceBackLink({ label }: { label: string }) {
  return (
    <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

export function AdminWorkspaceStateCard(props: {
  title: string;
  body: string;
  backLabel: string;
  notFoundId?: string;
}) {
  return (
    <Card className="border-border max-w-2xl">
      <CardHeader>
        <CardTitle className="text-foreground">{props.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{props.body}</p>
        {props.notFoundId ? <p className="text-sm text-muted-foreground font-english" dir="ltr">{props.notFoundId}</p> : null}
        <Link to="/admin" className="text-sm text-primary hover:underline">{props.backLabel}</Link>
      </CardContent>
    </Card>
  );
}

export function AdminWorkspaceFailedCard(props: {
  title: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-border max-w-2xl">
      <CardHeader>
        <CardTitle className="text-foreground">{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={props.onRetry}><RefreshCw className="h-4 w-4 me-2" />{props.retryLabel}</Button>
      </CardContent>
    </Card>
  );
}

export function UnavailableSection({ title, reason }: { title: string; reason: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      <div className="text-foreground" style={{ fontWeight: 600 }}>{title}</div>
      <div className="mt-1">{reason || "Unavailable"}</div>
    </div>
  );
}

export function EmptySection({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">{text}</div>;
}
