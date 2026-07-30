/**
 * useReturnTo · "ارجع لمصدرك" — close-and-return for create forms
 *
 * Problem: create forms opened from another page (contact file · dashboard ·
 * another doc) dumped the user on the bare list when closed. Now callers link
 * with `?returnTo=/app/...` and the form's close handler calls goBack():
 *
 *   const { goBack } = useReturnTo();
 *   const closeCreate = () => { setCreateOpen(false); if (goBack()) return; ...fallback };
 *
 * The param is captured ONCE at mount (pages strip query params when the form
 * opens, so reading it lazily would lose it). Only /app paths are honored.
 */
import { useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";

export function useReturnTo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const captured = useRef<string | null>(null);
  if (captured.current === null) {
    const rt = searchParams.get("returnTo") || "";
    captured.current = rt.startsWith("/app") ? rt : "";
  }
  const returnTo = captured.current || null;

  /** Returns true when it navigated back to the source page. */
  const goBack = (): boolean => {
    if (!returnTo) return false;
    navigate(returnTo, { replace: true });
    return true;
  };

  return { returnTo, goBack };
}
