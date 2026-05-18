/**
 * use-keyboard-shortcuts · keyboard-first UX layer (UX-7)
 *
 * Product requirement: "خليه يعمل بسرعة الكي بورد · مثل Linear و Wafeq"
 *
 * Standard shortcuts that any list page can wire up:
 *
 *   N         · new document (open create form)
 *   /         · focus search input
 *   Esc       · close form / clear search / close preview
 *   J / K     · next / previous row in list
 *   Enter     · open selected row
 *   E         · edit selected row
 *   Cmd/Ctrl+S· save form
 *
 * Skip shortcuts when typing in inputs · check event.target.tagName.
 *
 * Usage:
 *   useKeyboardShortcuts({
 *     n: () => setCreateOpen(true),
 *     "/": () => searchRef.current?.focus(),
 *     escape: () => setPreviewId(null),
 *     j: () => moveSelection(1),
 *     k: () => moveSelection(-1),
 *   });
 */
import { useEffect } from "react";

export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface ShortcutMap {
  /** Key handlers · keys are normalized lowercase · use "escape" "enter" etc. */
  [key: string]: ShortcutHandler | undefined;
  // Common ones · TS hints
  n?: ShortcutHandler;
  e?: ShortcutHandler;
  j?: ShortcutHandler;
  k?: ShortcutHandler;
  "/"?: ShortcutHandler;
  escape?: ShortcutHandler;
  enter?: ShortcutHandler;
  "cmd+s"?: ShortcutHandler;
}

/** Returns true if the event target is a typing element · should skip shortcuts. */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    // Allow Esc + Cmd/Ctrl+S even inside inputs
    return !(e.key === "Escape" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"));
  }
  if (t.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(map: ShortcutMap, deps: any[] = []) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping(e)) {
        // Still allow Escape to bubble through · most components handle their own
        if (e.key !== "Escape" && !((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) return;
      }

      const key = e.key.toLowerCase();
      const isMod = e.ctrlKey || e.metaKey;

      // Cmd/Ctrl combos
      if (isMod && key === "s" && map["cmd+s"]) { e.preventDefault(); map["cmd+s"]!(e); return; }
      if (isMod && key === "k" && map["cmd+k"]) { e.preventDefault(); map["cmd+k"]!(e); return; }
      if (isMod) return; // skip other Cmd combos · don't hijack browser shortcuts

      // Single-key shortcuts
      if (key === "escape" && map.escape) { map.escape(e); return; }
      if (key === "enter" && map.enter) { map.enter(e); return; }
      if (key === "/" && map["/"]) { e.preventDefault(); map["/"]!(e); return; }
      if (key === "n" && map.n) { e.preventDefault(); map.n!(e); return; }
      if (key === "e" && map.e) { e.preventDefault(); map.e!(e); return; }
      if (key === "j" && map.j) { e.preventDefault(); map.j!(e); return; }
      if (key === "k" && map.k) { e.preventDefault(); map.k!(e); return; }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * useArrowSelection · J/K (and ArrowDown/ArrowUp) cycle through a list.
 *
 * Returns [selectedIdx, setSelectedIdx, helpers].
 * Wire helpers.next / helpers.prev to your shortcut map.
 */
import { useState, useCallback } from "react";

export function useArrowSelection(maxIdx: number) {
  const [idx, setIdx] = useState<number>(-1);

  const next = useCallback(() => {
    setIdx((i) => Math.min(i + 1, maxIdx));
  }, [maxIdx]);

  const prev = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  const reset = useCallback(() => setIdx(-1), []);

  return { idx, setIdx, next, prev, reset };
}
