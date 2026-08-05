import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./components/LanguageContext";
import { ContactsProvider } from "./components/contacts-store";
import { MarketingRegionProvider } from "./components/marketing-region";

export default function App() {
  return (
    <LanguageProvider>
      <MarketingRegionProvider>
        <ContactsProvider>
          <RouterProvider router={router} />
        </ContactsProvider>
      </MarketingRegionProvider>
    </LanguageProvider>
  );
}
