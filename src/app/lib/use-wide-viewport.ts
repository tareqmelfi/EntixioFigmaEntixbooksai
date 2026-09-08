import { useEffect, useState } from "react";

/**
 * Desktop-only split view · ≥1536px shows the paper preview beside a list.
 * The list needs ~800px next to a 380px+ panel, so the threshold is 2xl.
 * Same contract as the local hook in invoices.tsx (kept there verbatim).
 */
export function useWideViewport(query = "(min-width: 1536px)") {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return wide;
}
