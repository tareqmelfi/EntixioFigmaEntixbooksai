import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./components/LanguageContext";
import { ContactsProvider } from "./components/contacts-store";
import { MarketingRegionProvider } from "./components/marketing-region";
import { CookieConsent } from "./components/cookie-consent";
import { SupportChatWidget } from "./components/support-chat-widget";

export default function App() {
  return (
    <LanguageProvider>
      <MarketingRegionProvider>
        <ContactsProvider>
          <RouterProvider router={router} />
          <CookieConsent />
          {/* One support thread across the whole site + app · the widget hides
              itself on auth, print and portal routes (see HIDDEN_PREFIXES). */}
          <SupportChatWidget />
        </ContactsProvider>
      </MarketingRegionProvider>
    </LanguageProvider>
  );
}
