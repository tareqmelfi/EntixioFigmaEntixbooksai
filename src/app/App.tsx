import { RouterProvider } from "react-router";
import { router } from "./routes";
import { useEffect } from "react";
import { LanguageProvider } from "./components/LanguageContext";
import { ContactsProvider } from "./components/contacts-store";

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