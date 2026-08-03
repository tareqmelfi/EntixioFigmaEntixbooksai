
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);

  // Self-heal stale lazy chunks: after a deploy, old hashed chunks are gone, so a
  // long-lived tab hitting "Failed to fetch dynamically imported module" would
  // otherwise strand the user on an error page. Reload once to fetch the new shell.
  let chunkReloadArmed = true;
  const healStaleChunk = () => {
    if (!chunkReloadArmed) return;
    chunkReloadArmed = false; // reload once — never loop
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", healStaleChunk);
  window.addEventListener("unhandledrejection", (e) => {
    if (String(e?.reason?.message || e?.reason || "").includes("dynamically imported module")) healStaleChunk();
  });

  // Register the kill-switch service worker so that any legacy SW from a prior
  // deploy gets replaced, wipes all caches, unregisters itself, and reloads the
  // page clean. Without this registration, users with an old SW never receive the
  // kill-switch — the stale SW keeps intercepting fetch() calls and causes
  // "Failed to fetch" on API requests.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => { /* SW registration failed — app works without it */ })
    })
  }
