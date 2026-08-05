/**
 * useLegalType — the active org's legal form.
 * 'JSC' (joint-stock) → shareholders register + share transactions.
 * Anything else (LLC / SOLE_PROP / PARTNERSHIP …) → owners registry, contact-linked.
 * Shared by the sidebar labels and the ownership pages.
 */
import { useEffect, useState } from "react";
import { api } from "./api";

export function useLegalType(): string | null {
  const [legalType, setLegalType] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.orgs.list().then((list) => {
      if (!alive) return;
      const storedId = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
      const active = (storedId ? list.find((o) => o.id === storedId) : null) || list[0];
      setLegalType(active?.legalType ?? null);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return legalType;
}
