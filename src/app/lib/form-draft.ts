/**
 * useFormDraft · "never lose what you typed" (CEO 2026-08-25)
 *
 * Problem: an accountant types an invoice for an hour, then presses Back by
 * mistake, the tab reloads, the session expires on Save, or the page bounces —
 * and everything is gone.
 *
 * Contract (generic · no page rewrite needed):
 *   const draft = useFormDraft({
 *     key: editing ? `invoice:${editing.id}` : 'invoice:new',
 *     open: createOpen,
 *     snapshot: { form, lines, taxMode },
 *     restore: (s) => { setForm(s.form); setLines(s.lines); setTaxMode(s.taxMode); },
 *   });
 *   <FullPageForm dirty={draft.dirty} draft={draft} …/>
 *   … on successful save → draft.clear()
 *
 * Behaviour
 *  - Baseline = the snapshot at the moment the form opened. `dirty` = snapshot
 *    differs from baseline AND (the user touched an input OR the form has been
 *    open > 3 s — async prefill like next-number/contact lookups is not "dirty").
 *  - While open + dirty → autosave to localStorage (debounced 400 ms) under
 *    entix:draft:v1:<orgId>:<key>. Survives reload · session expiry · crash.
 *  - On open, if a draft exists for the key → it is restored automatically and
 *    `restored` carries its timestamp so the form can show «استُعيدت مسودة» +
 *    a Discard action. Discard returns to the baseline.
 *  - clear() removes the stored draft (call after a successful save). Closing a
 *    form that is not dirty also clears it.
 *  - Storage is per company (orgId) so switching companies never leaks drafts.
 *
 * UX-1: no dialogs — the close/leave guards live in FullPageForm as inline bars.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrgId } from "./api";

const PREFIX = "entix:draft:v1";
const TOUCH_GRACE_MS = 3000;
const AUTOSAVE_MS = 400;
const MAX_DRAFT_AGE_MS = 14 * 86_400_000; // 2 weeks

export interface FormDraftState {
  /** Snapshot differs from the opening baseline (and the user actually interacted). */
  dirty: boolean;
  /** ISO timestamp of the last autosave, null when nothing stored. */
  savedAt: string | null;
  /** Set when a stored draft was restored on open (ISO of that draft). */
  restored: string | null;
  /** Remove the stored draft (after a successful save). */
  clear: () => void;
  /** Throw away the restored draft and return to the opening baseline. */
  discard: () => void;
  /** Re-baseline: treat the current snapshot as clean (e.g. after save-and-stay). */
  markClean: () => void;
}

function storageKey(key: string) {
  return `${PREFIX}:${getOrgId() || "no-org"}:${key}`;
}

function readDraft<T>(key: string): { savedAt: string; snapshot: T } | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.savedAt || !("snapshot" in parsed)) return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > MAX_DRAFT_AGE_MS) { localStorage.removeItem(storageKey(key)); return null; }
    return parsed;
  } catch { return null; }
}

function writeDraft<T>(key: string, snapshot: T): string | null {
  try {
    const savedAt = new Date().toISOString();
    localStorage.setItem(storageKey(key), JSON.stringify({ savedAt, snapshot }));
    return savedAt;
  } catch { return null; }
}

function removeDraft(key: string) {
  try { localStorage.removeItem(storageKey(key)); } catch { /* ignore */ }
}

/** Sweep drafts older than MAX_DRAFT_AGE_MS (cheap · runs once per page load). */
let swept = false;
function sweepOnce() {
  if (swept) return; swept = true;
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX + ":")) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(k) || "null");
        if (!parsed?.savedAt || now - new Date(parsed.savedAt).getTime() > MAX_DRAFT_AGE_MS) localStorage.removeItem(k);
      } catch { localStorage.removeItem(k); }
    }
  } catch { /* ignore */ }
}

export function useFormDraft<T>(opts: {
  key: string;
  open: boolean;
  snapshot: T;
  restore: (snapshot: T) => void;
  /** Disable persistence (e.g. read-only view). Guards still work off `dirty`. */
  enabled?: boolean;
}): FormDraftState {
  const { key, open, snapshot, restore } = opts;
  const enabled = opts.enabled !== false;
  const serialized = useMemo(() => { try { return JSON.stringify(snapshot); } catch { return ""; } }, [snapshot]);

  const baselineRef = useRef<string>("");
  const openedAtRef = useRef<number>(0);
  const touchedRef = useRef(false);
  const restoreRef = useRef(restore); restoreRef.current = restore;
  const serializedRef = useRef(serialized); serializedRef.current = serialized;
  const keyRef = useRef(key);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // re-evaluate dirty after the touch grace period

  // ── open / close lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      touchedRef.current = false;
      setRestored(null);
      setSavedAt(null);
      return;
    }
    sweepOnce();
    openedAtRef.current = Date.now();
    touchedRef.current = false;
    // Baseline is captured on the next frame so the opener's setState batch is in.
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      baselineRef.current = serializedRef.current;
      const stored = enabled ? readDraft<T>(key) : null;
      if (stored && JSON.stringify(stored.snapshot) !== baselineRef.current) {
        restoreRef.current(stored.snapshot);
        setRestored(stored.savedAt);
        setSavedAt(stored.savedAt);
        touchedRef.current = true; // a restored draft is unsaved work by definition
      }
    });
    const graceTimer = setTimeout(() => setTick((n) => n + 1), TOUCH_GRACE_MS + 50);
    // Any real interaction inside the document marks the form as touched.
    const onTouch = () => { touchedRef.current = true; };
    document.addEventListener("input", onTouch, true);
    document.addEventListener("change", onTouch, true);
    document.addEventListener("paste", onTouch, true);
    document.addEventListener("keydown", onTouch, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(graceTimer);
      document.removeEventListener("input", onTouch, true);
      document.removeEventListener("change", onTouch, true);
      document.removeEventListener("paste", onTouch, true);
      document.removeEventListener("keydown", onTouch, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, enabled]);

  // Key changed while the form stayed open (new → saved id): the old draft is obsolete.
  useEffect(() => {
    const prev = keyRef.current;
    keyRef.current = key;
    if (open && prev !== key) {
      removeDraft(prev);
      baselineRef.current = serializedRef.current;
      setRestored(null);
      setSavedAt(null);
    }
  }, [key, open]);

  const dirty = open && serialized !== baselineRef.current && baselineRef.current !== "" &&
    (touchedRef.current || Date.now() - openedAtRef.current > TOUCH_GRACE_MS);
  void tick;
  // Last dirty value observed while open — read by the close effect (where `open` is already false).
  const lastDirtyRef = useRef(false);
  if (open) lastDirtyRef.current = dirty;

  // ── autosave ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !enabled) return;
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const at = writeDraft(key, snapshot);
      if (at) setSavedAt(at);
    }, AUTOSAVE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, dirty, open, enabled, key]);

  // Flush pending autosave synchronously when the page is being unloaded.
  useEffect(() => {
    if (!open || !enabled) return;
    const flush = () => { if (dirty) writeDraft(key, snapshot); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("beforeunload", flush); };
  }, [open, enabled, dirty, key, snapshot]);

  // Closing a clean form leaves no draft behind.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open && !lastDirtyRef.current) removeDraft(keyRef.current);
    wasOpen.current = open;
    if (!open) lastDirtyRef.current = false;
  }, [open]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    removeDraft(keyRef.current);
    baselineRef.current = serializedRef.current;
    touchedRef.current = false;
    setSavedAt(null);
    setRestored(null);
    setTick((n) => n + 1);
  }, []);

  const discard = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    removeDraft(keyRef.current);
    try {
      if (baselineRef.current) restoreRef.current(JSON.parse(baselineRef.current));
    } catch { /* ignore */ }
    touchedRef.current = false;
    setSavedAt(null);
    setRestored(null);
    setTick((n) => n + 1);
  }, []);

  const markClean = useCallback(() => {
    baselineRef.current = serializedRef.current;
    touchedRef.current = false;
    setTick((n) => n + 1);
  }, []);

  return { dirty, savedAt, restored, clear, discard, markClean };
}

/** Human time for banners · "قبل 3 دقائق" / "3 min ago" style, locale-safe. */
export function formatDraftTime(iso: string | null, lang: "ar" | "en"): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return lang === "ar" ? "قبل لحظات" : "moments ago";
  if (min < 60) return lang === "ar" ? `قبل ${min} دقيقة` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return lang === "ar" ? `قبل ${h} ساعة` : `${h} h ago`;
  try { return new Date(iso).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}
