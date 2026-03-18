import { createBrowserRouter } from "react-router";
import { Root } from "./layouts/root";
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
// New pages
import { BankAccounts } from "./pages/bank-accounts";
import { CostCenters } from "./pages/cost-centers";
import { Projects } from "./pages/projects";
import { Branches } from "./pages/branches";
import { Integrations } from "./pages/integrations";
import { Templates } from "./pages/templates";
// Portal pages
import { PortalLogin } from "./pages/portal-login";
import { PortalHome } from "./pages/portal-home";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "ai", element: <AI /> },
      // Sales
      { path: "sales", element: <SalesDashboard /> },
      { path: "invoices", element: <Invoices /> },
      { path: "quotes", element: <Quotes /> },
      { path: "receipts", element: <Receipts /> },
      { path: "credit-notes", element: <CreditNotes /> },
      // Purchases
      { path: "purchases", element: <PurchasesDashboard /> },
      { path: "purchases/bills", element: <PurchaseBills /> },
      { path: "payments", element: <Payments /> },
      { path: "expenses", element: <Expenses /> },
      // Accounting
      { path: "chart-of-accounts", element: <ChartOfAccounts /> },
      { path: "journal-entries", element: <JournalEntries /> },
      { path: "taxes", element: <Taxes /> },
      // Bank Accounts
      { path: "bank-accounts", element: <BankAccounts /> },
      // Assets
      { path: "assets", element: <FixedAssets /> },
      { path: "assets/:id", element: <AssetDetail /> },
      // Cost Centers, Projects, Branches
      { path: "cost-centers", element: <CostCenters /> },
      { path: "projects", element: <Projects /> },
      { path: "branches", element: <Branches /> },
      // Products & Services
      { path: "products", element: <Inventory /> },
      { path: "products/:id", element: <ProductDetail /> },
      { path: "inventory", element: <Inventory /> },
      // Payroll
      { path: "payroll", element: <Payroll /> },
      // Contacts
      { path: "contacts", element: <Contacts /> },
      { path: "contacts/:id", element: <ContactDetail /> },
      // Developer
      { path: "integrations", element: <Integrations /> },
      { path: "templates", element: <Templates /> },
      // Analytics & Settings
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },
      { path: "roadmap", element: <FeatureRoadmap /> },
    ],
  },
  // Portal routes (standalone, no sidebar)
  { path: "/portal/login", element: <PortalLogin /> },
  { path: "/portal", element: <PortalHome /> },
]);