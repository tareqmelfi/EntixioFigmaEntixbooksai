
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

  // No service worker: the app has no offline requirement, and legacy SWs caused
  // two production incidents (stale cache · redirect loops). public/sw.js is now
  // a kill-switch that unregisters old workers and wipes their caches.
