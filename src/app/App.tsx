import { RouterProvider } from "react-router";
import { router } from "./routes";
import { useEffect } from "react";
import { LanguageProvider } from "./components/LanguageContext";
import { ContactsProvider } from "./components/contacts-store";

// Suppress Recharts 2.15.2 internal duplicate key bug (Surface SVG component)
// This is a known issue: https://github.com/recharts/recharts/issues/3615
// Safe to remove when upgrading to a fixed version.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('Encountered two children with the same key') && 
      new Error().stack?.includes('recharts')) {
    return; // Suppress only Recharts internal duplicate key warnings
  }
  originalConsoleError.apply(console, args);
};

export default function App() {
  // Set document language and direction
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);

  return (
    <LanguageProvider>
      <ContactsProvider>
        <RouterProvider router={router} />
      </ContactsProvider>
    </LanguageProvider>
  );
}