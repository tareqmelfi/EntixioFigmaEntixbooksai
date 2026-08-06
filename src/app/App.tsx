import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./components/LanguageContext";
import { ContactsProvider } from "./components/contacts-store";
import { MarketingRegionProvider } from "./components/marketing-region";
import { CookieConsent } from "./components/cookie-consent";

export default function App() {
  return (
    <LanguageProvider>
      <MarketingRegionProvider>
        <ContactsProvider>
          <RouterProvider router={router} />
          <CookieConsent />
        </ContactsProvider>
      </MarketingRegionProvider>
    </LanguageProvider>
  );
}
