import { createBrowserRouter, Navigate } from "react-router";
import { Root } from "./layouts/root";
import { Landing } from "./pages/landing";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import { ForgotPassword } from "./pages/forgot-password";
import { ResetPassword } from "./pages/reset-password";
import { Features } from "./pages/features";
import { Integration } from "./pages/integration";
import { PricingPage } from "./pages/pricing-page";
import { Privacy } from "./pages/privacy";
import { Terms } from "./pages/terms";
import { Blog } from "./pages/blog";
import { Help } from "./pages/help";
import { Docs } from "./pages/docs";
import { Videos } from "./pages/videos";
import { About } from "./pages/about";
import { 
  SolutionsAccountants, 
  SolutionsSmallBusiness, 
  SolutionsEnterprises,
  SolutionsRestaurants,
  SolutionsEcommerce
} from "./pages/solutions";
import { 
  Team, 
  Careers, 
  Contact, 
  Partners, 
  Changelog, 
  Roadmap,
  CaseStudies,
  Glossary,
  Refund,
  SLA
} from "./pages/other-pages";
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
import { Employees } from "./pages/employees";
import { Contacts } from "./pages/contacts";
import { ContactDetail } from "./pages/contact-detail";
import { Reports } from "./pages/reports";
import { Settings } from "./pages/settings";
import { Notifications } from "./pages/notifications";
import { InboxPage } from "./pages/inbox";
import { AdminDashboard } from "./pages/admin";
import { ComingSoonApp } from "./pages/coming-soon-app";
import { InvoicePrintView } from "./pages/invoice-print-view";
import { FeatureRoadmap } from "./pages/feature-roadmap";
import { BankAccounts } from "./pages/bank-accounts";
import { BankReconciliation } from "./pages/bank-reconciliation";
import { FiscalPeriods } from "./pages/fiscal-periods";
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
  { path: "/forgot-password", element: <ForgotPassword />, errorElement: <ErrorBoundary /> },
  { path: "/reset-password", element: <ResetPassword />, errorElement: <ErrorBoundary /> },
  { path: "/features", element: <Features />, errorElement: <ErrorBoundary /> },
  { path: "/integration", element: <Integration />, errorElement: <ErrorBoundary /> },
  { path: "/pricing", element: <PricingPage />, errorElement: <ErrorBoundary /> },
  { path: "/privacy", element: <Privacy />, errorElement: <ErrorBoundary /> },
  { path: "/terms", element: <Terms />, errorElement: <ErrorBoundary /> },
  { path: "/blog", element: <Blog />, errorElement: <ErrorBoundary /> },
  { path: "/help", element: <Help />, errorElement: <ErrorBoundary /> },
  { path: "/docs", element: <Docs />, errorElement: <ErrorBoundary /> },
  { path: "/videos", element: <Videos />, errorElement: <ErrorBoundary /> },
  { path: "/about", element: <About />, errorElement: <ErrorBoundary /> },
  { path: "/solutions/accountants", element: <SolutionsAccountants />, errorElement: <ErrorBoundary /> },
  { path: "/solutions/small-business", element: <SolutionsSmallBusiness />, errorElement: <ErrorBoundary /> },
  { path: "/solutions/enterprises", element: <SolutionsEnterprises />, errorElement: <ErrorBoundary /> },
  { path: "/solutions/restaurants", element: <SolutionsRestaurants />, errorElement: <ErrorBoundary /> },
  { path: "/solutions/ecommerce", element: <SolutionsEcommerce />, errorElement: <ErrorBoundary /> },
  { path: "/team", element: <Team />, errorElement: <ErrorBoundary /> },
  { path: "/careers", element: <Careers />, errorElement: <ErrorBoundary /> },
  { path: "/contact", element: <Contact />, errorElement: <ErrorBoundary /> },
  { path: "/partners", element: <Partners />, errorElement: <ErrorBoundary /> },
  { path: "/changelog", element: <Changelog />, errorElement: <ErrorBoundary /> },
  { path: "/roadmap", element: <Roadmap />, errorElement: <ErrorBoundary /> },
  { path: "/case-studies", element: <CaseStudies />, errorElement: <ErrorBoundary /> },
  { path: "/glossary", element: <Glossary />, errorElement: <ErrorBoundary /> },
  { path: "/refund", element: <Refund />, errorElement: <ErrorBoundary /> },
  { path: "/sla", element: <SLA />, errorElement: <ErrorBoundary /> },
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
      { path: "invoices/new", element: <Invoices />, errorElement: <ErrorBoundary /> },
      { path: "invoices/:id", element: <Invoices />, errorElement: <ErrorBoundary /> },
      // legacy aliases used by older links
      { path: "sales/invoices", element: <Invoices />, errorElement: <ErrorBoundary /> },
      { path: "sales/invoices/new", element: <Invoices />, errorElement: <ErrorBoundary /> },
      { path: "sales/invoices/:id", element: <Invoices />, errorElement: <ErrorBoundary /> },
      { path: "sales/quotes", element: <Quotes />, errorElement: <ErrorBoundary /> },
      { path: "sales/quotes/new", element: <Quotes />, errorElement: <ErrorBoundary /> },
      { path: "sales/quotes/:id", element: <Quotes />, errorElement: <ErrorBoundary /> },
      { path: "quotes", element: <Quotes />, errorElement: <ErrorBoundary /> },
      { path: "quotes/new", element: <Quotes />, errorElement: <ErrorBoundary /> },
      { path: "quotes/:id", element: <Quotes />, errorElement: <ErrorBoundary /> },
      { path: "receipts", element: <Receipts />, errorElement: <ErrorBoundary /> },
      { path: "receipts/new", element: <Receipts />, errorElement: <ErrorBoundary /> },
      { path: "credit-notes", element: <CreditNotes />, errorElement: <ErrorBoundary /> },
      { path: "credit-notes/new", element: <CreditNotes />, errorElement: <ErrorBoundary /> },
      // Purchases
      { path: "purchases", element: <PurchasesDashboard />, errorElement: <ErrorBoundary /> },
      { path: "purchases/bills", element: <PurchaseBills />, errorElement: <ErrorBoundary /> },
      { path: "purchases/bills/new", element: <PurchaseBills />, errorElement: <ErrorBoundary /> },
      { path: "purchases/bills/:id", element: <PurchaseBills />, errorElement: <ErrorBoundary /> },
      { path: "payments", element: <Payments />, errorElement: <ErrorBoundary /> },
      { path: "payments/new", element: <Payments />, errorElement: <ErrorBoundary /> },
      { path: "expenses", element: <Expenses />, errorElement: <ErrorBoundary /> },
      { path: "expenses/new", element: <Expenses />, errorElement: <ErrorBoundary /> },
      { path: "inbox", element: <InboxPage />, errorElement: <ErrorBoundary /> },
      { path: "vouchers", element: <Receipts />, errorElement: <ErrorBoundary /> },
      { path: "vouchers/new", element: <Receipts />, errorElement: <ErrorBoundary /> },
      // Accounting
      { path: "chart-of-accounts", element: <ChartOfAccounts />, errorElement: <ErrorBoundary /> },
      { path: "journal-entries", element: <JournalEntries />, errorElement: <ErrorBoundary /> },
      { path: "journal-entries/new", element: <JournalEntries />, errorElement: <ErrorBoundary /> },
      { path: "taxes", element: <Taxes />, errorElement: <ErrorBoundary /> },
      // Bank Accounts
      { path: "bank-accounts", element: <BankAccounts />, errorElement: <ErrorBoundary /> },
      { path: "bank-accounts/new", element: <BankAccounts />, errorElement: <ErrorBoundary /> },
      { path: "bank-reconciliation", element: <BankReconciliation />, errorElement: <ErrorBoundary /> },
      { path: "fiscal-periods", element: <FiscalPeriods />, errorElement: <ErrorBoundary /> },
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
      // Payroll & Employees
      { path: "payroll", element: <Payroll />, errorElement: <ErrorBoundary /> },
      { path: "employees", element: <Employees />, errorElement: <ErrorBoundary /> },
      // Contacts (formerly العملاء والموردين)
      { path: "contacts", element: <Contacts />, errorElement: <ErrorBoundary /> },
      { path: "contacts/:id", element: <ContactDetail />, errorElement: <ErrorBoundary /> },
      // Developer
      { path: "integrations", element: <Integrations />, errorElement: <ErrorBoundary /> },
      { path: "templates", element: <Templates />, errorElement: <ErrorBoundary /> },
      // Analytics & Settings
      { path: "reports", element: <Reports />, errorElement: <ErrorBoundary /> },
      { path: "reports/cash-flow", element: <Reports />, errorElement: <ErrorBoundary /> },
      { path: "reports/profit-loss", element: <Reports />, errorElement: <ErrorBoundary /> },
      { path: "settings", element: <Settings />, errorElement: <ErrorBoundary /> },
      { path: "notifications", element: <Notifications />, errorElement: <ErrorBoundary /> },
      { path: "admin", element: <AdminDashboard />, errorElement: <ErrorBoundary /> },
      { path: "roadmap", element: <FeatureRoadmap />, errorElement: <ErrorBoundary /> },
      // Marketplace · stub until launch (UX-151)
      {
        path: "marketplace/accountants",
        element: (
          <ComingSoonApp
            title="التعاقد مع محاسب معتمد"
            description="قريباً · سوق محاسبين وموجِّهين ضريبيين معتمدين تتعاقد معهم مباشرة من داخل المنصة."
            features={[
              "محاسبون مرخّصون ومراجَعون من فريق ENSIDEX",
              "أسعار شهرية ثابتة · بدون مفاجآت",
              "دخول مباشر لحساباتك من قِبَل المحاسب بصلاحيات محدّدة",
              "تقارير ZATCA + إقرار VAT شهري/ربع سنوي",
            ]}
            ctaLabel="سجّل اهتمامك"
            ctaHref="mailto:hello@entix.io?subject=marketplace-accountants"
          />
        ),
        errorElement: <ErrorBoundary />,
      },
    ],
  },
  // Portal routes (standalone, no sidebar)
  { path: "/portal/login", element: <PortalLogin />, errorElement: <ErrorBoundary /> },
  { path: "/portal", element: <PortalHome />, errorElement: <ErrorBoundary /> },
  { path: "/print/invoice/:id", element: <InvoicePrintView />, errorElement: <ErrorBoundary /> },
  // Error handling
  { path: "*", element: <NotFound /> },
]);