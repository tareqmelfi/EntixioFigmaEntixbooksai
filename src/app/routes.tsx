import { createBrowserRouter, Navigate } from "react-router";
import { Root } from "./layouts/root";
import { Landing } from "./pages/landing";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import { Dashboard } from "./pages/dashboard";
import { AI } from "./pages/ai";
import { SalesDashboard } from "./pages/sales-dashboard";
import { Invoices } from "./pages/invoices";
import { Quotes } from "./pages/quotes";
import { Receipts } from "./pages/receipts";
import { CreditNotes } from "./pages/credit-notes";
import { PurchasesDashboard } from "./pages/purchases-dashboard";
import { PurchaseBills } from "./pages/purchase-bills";
import { Payments } from "./pages/payments";
import { Expenses } from "./pages/expenses";
import { ChartOfAccounts } from "./pages/chart-of-accounts";
import { JournalEntries } from "./pages/journal-entries";
import { Taxes } from "./pages/taxes";
import { FixedAssets } from "./pages/fixed-assets";
import { AssetDetail } from "./pages/asset-detail";
import { Inventory } from "./pages/inventory";
import { ProductDetail } from "./pages/product-detail";
import { Payroll } from "./pages/payroll";
import { Contacts } from "./pages/contacts";
import { ContactDetail } from "./pages/contact-detail";
import { Reports } from "./pages/reports";
import { Settings } from "./pages/settings";
import { FeatureRoadmap } from "./pages/feature-roadmap";
import { BankAccounts } from "./pages/bank-accounts";
import { CostCenters } from "./pages/cost-centers";
import { Projects } from "./pages/projects";
import { Branches } from "./pages/branches";
import { Integrations } from "./pages/integrations";
import { Templates } from "./pages/templates";
import { PortalLogin } from "./pages/portal-login";
import { PortalHome } from "./pages/portal-home";
import { AuthGuard } from "./components/auth-guard";
import { ErrorBoundary, NotFound } from "./components/error-boundary";

// Wrap app routes with auth guard
function ProtectedRoot() {
  return (
    <AuthGuard>
      <Root />
    </AuthGuard>
  );
}

export const router = createBrowserRouter([
  // Public routes - Landing as main page
  { path: "/", element: <Landing />, errorElement: <ErrorBoundary /> },
  { path: "/login", element: <Login />, errorElement: <ErrorBoundary /> },
  { path: "/register", element: <Register />, errorElement: <ErrorBoundary /> },
  // Protected app routes
  {
    path: "/app",
    element: <ProtectedRoot />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <Dashboard />, errorElement: <ErrorBoundary /> },
      { path: "ai", element: <AI />, errorElement: <ErrorBoundary /> },
      // Sales
      { path: "sales", element: <SalesDashboard />, errorElement: <ErrorBoundary /> },
      { path: "invoices", element: <Invoices />, errorElement: <ErrorBoundary /> },
      { path: "quotes", element: <Quotes />, errorElement: <ErrorBoundary /> },
      { path: "receipts", element: <Receipts />, errorElement: <ErrorBoundary /> },
      { path: "credit-notes", element: <CreditNotes />, errorElement: <ErrorBoundary /> },
      // Purchases
      { path: "purchases", element: <PurchasesDashboard />, errorElement: <ErrorBoundary /> },
      { path: "purchases/bills", element: <PurchaseBills />, errorElement: <ErrorBoundary /> },
      { path: "payments", element: <Payments />, errorElement: <ErrorBoundary /> },
      { path: "expenses", element: <Expenses />, errorElement: <ErrorBoundary /> },
      // Accounting
      { path: "chart-of-accounts", element: <ChartOfAccounts />, errorElement: <ErrorBoundary /> },
      { path: "journal-entries", element: <JournalEntries />, errorElement: <ErrorBoundary /> },
      { path: "taxes", element: <Taxes />, errorElement: <ErrorBoundary /> },
      // Bank Accounts
      { path: "bank-accounts", element: <BankAccounts />, errorElement: <ErrorBoundary /> },
      // Assets
      { path: "assets", element: <FixedAssets />, errorElement: <ErrorBoundary /> },
      { path: "assets/:id", element: <AssetDetail />, errorElement: <ErrorBoundary /> },
      // Cost Centers, Projects, Branches
      { path: "cost-centers", element: <CostCenters />, errorElement: <ErrorBoundary /> },
      { path: "projects", element: <Projects />, errorElement: <ErrorBoundary /> },
      { path: "branches", element: <Branches />, errorElement: <ErrorBoundary /> },
      // Products & Services
      { path: "products", element: <Inventory />, errorElement: <ErrorBoundary /> },
      { path: "products/:id", element: <ProductDetail />, errorElement: <ErrorBoundary /> },
      { path: "inventory", element: <Inventory />, errorElement: <ErrorBoundary /> },
      // Payroll
      { path: "payroll", element: <Payroll />, errorElement: <ErrorBoundary /> },
      // Contacts
      { path: "contacts", element: <Contacts />, errorElement: <ErrorBoundary /> },
      { path: "contacts/:id", element: <ContactDetail />, errorElement: <ErrorBoundary /> },
      // Developer
      { path: "integrations", element: <Integrations />, errorElement: <ErrorBoundary /> },
      { path: "templates", element: <Templates />, errorElement: <ErrorBoundary /> },
      // Analytics & Settings
      { path: "reports", element: <Reports />, errorElement: <ErrorBoundary /> },
      { path: "settings", element: <Settings />, errorElement: <ErrorBoundary /> },
      { path: "roadmap", element: <FeatureRoadmap />, errorElement: <ErrorBoundary /> },
    ],
  },
  // Portal routes (standalone, no sidebar)
  { path: "/portal/login", element: <PortalLogin />, errorElement: <ErrorBoundary /> },
  { path: "/portal", element: <PortalHome />, errorElement: <ErrorBoundary /> },
  // Error handling
  { path: "*", element: <NotFound /> },
]);