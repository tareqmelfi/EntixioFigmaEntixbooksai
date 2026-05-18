import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./components/LanguageContext";
import { ContactsProvider } from "./components/contacts-store";

export default function App() {
  return (
    <LanguageProvider>
      <ContactsProvider>
        <RouterProvider router={router} />
      </ContactsProvider>
    </LanguageProvider>
  );
}
