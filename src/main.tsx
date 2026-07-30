
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);

  // No service worker: the app has no offline requirement, and legacy SWs caused
  // two production incidents (stale cache · redirect loops). public/sw.js is now
  // a kill-switch that unregisters old workers and wipes their caches.
