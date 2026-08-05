import React, { Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Root } from "./layouts/root";
import { AuthGuard } from "./components/auth-guard";
import { ErrorBoundary, NotFound } from "./components/error-boundary";
import { Landing } from "./pages/landing";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import { ForgotPassword } from "./pages/forgot-password";
import { ResetPassword } from "./pages/reset-password";

// Route-level code splitting · every app/marketing page loads its own chunk on
// first visit instead of shipping one 2MB bundle (PERF rescue · original Bible §3.4)
function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function lazyElement(
  factory: () => Promise<Record<string, React.ComponentType<any> | undefined>>,
  name: string,
) {
  const C = React.lazy(async () => {
    const m = await factory();
    const comp = m[name];
    if (!comp) throw new Error(`lazyElement: missing export "${name}"`);
    return { default: comp };
  });
  return (
    <Suspense fallback={<RouteFallback />}>
      <C />
    </Suspense>
  );
}

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
  { path: "/features", element: lazyElement(() => import("./pages/features"), "Features"), errorElement: <ErrorBoundary /> },
  { path: "/integration", element: lazyElement(() => import("./pages/integration"), "Integration"), errorElement: <ErrorBoundary /> },
  { path: "/pricing", element: lazyElement(() => import("./pages/pricing-page"), "PricingPage"), errorElement: <ErrorBoundary /> },
  { path: "/privacy", element: lazyElement(() => import("./pages/privacy"), "Privacy"), errorElement: <ErrorBoundary /> },
  { path: "/terms", element: lazyElement(() => import("./pages/terms"), "Terms"), errorElement: <ErrorBoundary /> },
  { path: "/blog", element: lazyElement(() => import("./pages/blog"), "Blog"), errorElement: <ErrorBoundary /> },
  { path: "/help", element: lazyElement(() => import("./pages/help"), "Help"), errorElement: <ErrorBoundary /> },
  { path: "/docs", element: lazyElement(() => import("./pages/docs"), "Docs"), errorElement: <ErrorBoundary /> },
  { path: "/videos", element: lazyElement(() => import("./pages/videos"), "Videos"), errorElement: <ErrorBoundary /> },
  { path: "/about", element: lazyElement(() => import("./pages/about"), "About"), errorElement: <ErrorBoundary /> },
  { path: "/solutions/accountants", element: lazyElement(() => import("./pages/solutions"), "SolutionsAccountants"), errorElement: <ErrorBoundary /> },
  { path: "/solutions/small-business", element: lazyElement(() => import("./pages/solutions"), "SolutionsSmallBusiness"), errorElement: <ErrorBoundary /> },
  { path: "/solutions/enterprises", element: lazyElement(() => import("./pages/solutions"), "SolutionsEnterprises"), errorElement: <ErrorBoundary /> },
  { path: "/solutions/restaurants", element: lazyElement(() => import("./pages/solutions"), "SolutionsRestaurants"), errorElement: <ErrorBoundary /> },
  { path: "/solutions/ecommerce", element: lazyElement(() => import("./pages/solutions"), "SolutionsEcommerce"), errorElement: <ErrorBoundary /> },
  { path: "/team", element: lazyElement(() => import("./pages/other-pages"), "Team"), errorElement: <ErrorBoundary /> },
  { path: "/careers", element: lazyElement(() => import("./pages/other-pages"), "Careers"), errorElement: <ErrorBoundary /> },
  { path: "/contact", element: lazyElement(() => import("./pages/other-pages"), "Contact"), errorElement: <ErrorBoundary /> },
  { path: "/partners", element: lazyElement(() => import("./pages/other-pages"), "Partners"), errorElement: <ErrorBoundary /> },
  { path: "/changelog", element: lazyElement(() => import("./pages/other-pages"), "Changelog"), errorElement: <ErrorBoundary /> },
  { path: "/roadmap", element: lazyElement(() => import("./pages/other-pages"), "Roadmap"), errorElement: <ErrorBoundary /> },
  { path: "/case-studies", element: lazyElement(() => import("./pages/other-pages"), "CaseStudies"), errorElement: <ErrorBoundary /> },
  { path: "/glossary", element: lazyElement(() => import("./pages/other-pages"), "Glossary"), errorElement: <ErrorBoundary /> },
  { path: "/refund", element: lazyElement(() => import("./pages/other-pages"), "Refund"), errorElement: <ErrorBoundary /> },
  { path: "/sla", element: lazyElement(() => import("./pages/other-pages"), "SLA"), errorElement: <ErrorBoundary /> },
  // Protected app routes
  {
    path: "/app",
    element: <ProtectedRoot />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: lazyElement(() => import("./pages/dashboard"), "Dashboard"), errorElement: <ErrorBoundary /> },
      // Bookmarkable canonical path · same page as the index (also fixes the
      // unauthenticated-redirect smoke: /app/dashboard now hits AuthGuard)
      { path: "dashboard", element: lazyElement(() => import("./pages/dashboard"), "Dashboard"), errorElement: <ErrorBoundary /> },
      { path: "ai", element: lazyElement(() => import("./pages/ai"), "AI"), errorElement: <ErrorBoundary /> },
      // Sales
      { path: "sales", element: lazyElement(() => import("./pages/sales-dashboard"), "SalesDashboard"), errorElement: <ErrorBoundary /> },
      { path: "invoices", element: lazyElement(() => import("./pages/invoices"), "Invoices"), errorElement: <ErrorBoundary /> },
      { path: "invoices/new", element: lazyElement(() => import("./pages/invoices"), "Invoices"), errorElement: <ErrorBoundary /> },
      { path: "invoices/:id", element: lazyElement(() => import("./pages/invoices"), "Invoices"), errorElement: <ErrorBoundary /> },
      // legacy aliases used by older links
      { path: "sales/invoices", element: lazyElement(() => import("./pages/invoices"), "Invoices"), errorElement: <ErrorBoundary /> },
      { path: "sales/invoices/new", element: lazyElement(() => import("./pages/invoices"), "Invoices"), errorElement: <ErrorBoundary /> },
      { path: "sales/invoices/:id", element: lazyElement(() => import("./pages/invoices"), "Invoices"), errorElement: <ErrorBoundary /> },
      { path: "sales/quotes", element: lazyElement(() => import("./pages/quotes"), "Quotes"), errorElement: <ErrorBoundary /> },
      { path: "sales/quotes/new", element: lazyElement(() => import("./pages/quotes"), "Quotes"), errorElement: <ErrorBoundary /> },
      { path: "sales/quotes/:id", element: lazyElement(() => import("./pages/quotes"), "Quotes"), errorElement: <ErrorBoundary /> },
      { path: "quotes", element: lazyElement(() => import("./pages/quotes"), "Quotes"), errorElement: <ErrorBoundary /> },
      { path: "quotes/new", element: lazyElement(() => import("./pages/quotes"), "Quotes"), errorElement: <ErrorBoundary /> },
      { path: "quotes/:id", element: lazyElement(() => import("./pages/quotes"), "Quotes"), errorElement: <ErrorBoundary /> },
      { path: "receipts", element: lazyElement(() => import("./pages/receipts"), "Receipts"), errorElement: <ErrorBoundary /> },
      { path: "receipts/new", element: lazyElement(() => import("./pages/receipts"), "Receipts"), errorElement: <ErrorBoundary /> },
      { path: "receipts/:id", element: lazyElement(() => import("./pages/receipts"), "Receipts"), errorElement: <ErrorBoundary /> },
      { path: "credit-notes", element: lazyElement(() => import("./pages/credit-notes"), "CreditNotes"), errorElement: <ErrorBoundary /> },
      { path: "credit-notes/new", element: lazyElement(() => import("./pages/credit-notes"), "CreditNotes"), errorElement: <ErrorBoundary /> },
      { path: "credit-notes/:id", element: lazyElement(() => import("./pages/credit-notes"), "CreditNotes"), errorElement: <ErrorBoundary /> },
      // Purchases
      { path: "purchases", element: lazyElement(() => import("./pages/purchases-dashboard"), "PurchasesDashboard"), errorElement: <ErrorBoundary /> },
      { path: "purchases/bills", element: lazyElement(() => import("./pages/purchase-bills"), "PurchaseBills"), errorElement: <ErrorBoundary /> },
      { path: "purchases/bills/new", element: lazyElement(() => import("./pages/purchase-bills"), "PurchaseBills"), errorElement: <ErrorBoundary /> },
      { path: "purchases/bills/:id", element: lazyElement(() => import("./pages/purchase-bills"), "PurchaseBills"), errorElement: <ErrorBoundary /> },
      { path: "purchases/supplier-credits", element: lazyElement(() => import("./pages/supplier-credits"), "SupplierCredits"), errorElement: <ErrorBoundary /> },
      { path: "purchases/supplier-credits/new", element: lazyElement(() => import("./pages/supplier-credits"), "SupplierCredits"), errorElement: <ErrorBoundary /> },
      { path: "payments", element: lazyElement(() => import("./pages/payments"), "Payments"), errorElement: <ErrorBoundary /> },
      { path: "payments/new", element: lazyElement(() => import("./pages/payments"), "Payments"), errorElement: <ErrorBoundary /> },
      { path: "payments/:id", element: lazyElement(() => import("./pages/payments"), "Payments"), errorElement: <ErrorBoundary /> },
      { path: "expenses", element: lazyElement(() => import("./pages/expenses"), "Expenses"), errorElement: <ErrorBoundary /> },
      { path: "expenses/new", element: lazyElement(() => import("./pages/expenses"), "Expenses"), errorElement: <ErrorBoundary /> },
      { path: "expenses/:id", element: lazyElement(() => import("./pages/expenses"), "Expenses"), errorElement: <ErrorBoundary /> },
      { path: "scan-receipts", element: lazyElement(() => import("./pages/scan-receipts"), "ScanReceipts"), errorElement: <ErrorBoundary /> },
      { path: "inbox", element: lazyElement(() => import("./pages/inbox"), "InboxPage"), errorElement: <ErrorBoundary /> },
      { path: "vouchers", element: lazyElement(() => import("./pages/receipts"), "Receipts"), errorElement: <ErrorBoundary /> },
      { path: "vouchers/new", element: lazyElement(() => import("./pages/receipts"), "Receipts"), errorElement: <ErrorBoundary /> },
      // Accounting
      { path: "chart-of-accounts", element: lazyElement(() => import("./pages/chart-of-accounts"), "ChartOfAccounts"), errorElement: <ErrorBoundary /> },
      { path: "journal-entries", element: lazyElement(() => import("./pages/journal-entries"), "JournalEntries"), errorElement: <ErrorBoundary /> },
      { path: "journal-entries/new", element: lazyElement(() => import("./pages/journal-entries"), "JournalEntries"), errorElement: <ErrorBoundary /> },
      { path: "taxes", element: lazyElement(() => import("./pages/taxes"), "Taxes"), errorElement: <ErrorBoundary /> },
      // Bank Accounts
      { path: "bank-accounts", element: lazyElement(() => import("./pages/bank-accounts"), "BankAccounts"), errorElement: <ErrorBoundary /> },
      { path: "bank-accounts/new", element: lazyElement(() => import("./pages/bank-account-new"), "BankAccountNew"), errorElement: <ErrorBoundary /> },
      { path: "bank-accounts/:id", element: lazyElement(() => import("./pages/bank-accounts"), "BankAccounts"), errorElement: <ErrorBoundary /> },
      { path: "bank-reconciliation", element: lazyElement(() => import("./pages/bank-reconciliation"), "BankReconciliation"), errorElement: <ErrorBoundary /> },
      { path: "fiscal-periods", element: lazyElement(() => import("./pages/fiscal-periods"), "FiscalPeriods"), errorElement: <ErrorBoundary /> },
      // Assets
      { path: "assets", element: lazyElement(() => import("./pages/fixed-assets"), "FixedAssets"), errorElement: <ErrorBoundary /> },
      { path: "assets/new", element: lazyElement(() => import("./pages/asset-detail"), "AssetDetail"), errorElement: <ErrorBoundary /> },
      { path: "assets/:id", element: lazyElement(() => import("./pages/asset-detail"), "AssetDetail"), errorElement: <ErrorBoundary /> },
      // Investment wallets + shareholders register
      { path: "investments", element: lazyElement(() => import("./pages/investments"), "Investments"), errorElement: <ErrorBoundary /> },
      { path: "investments/new", element: lazyElement(() => import("./pages/investment-wallet-detail"), "InvestmentWalletDetail"), errorElement: <ErrorBoundary /> },
      { path: "investments/:id", element: lazyElement(() => import("./pages/investment-wallet-detail"), "InvestmentWalletDetail"), errorElement: <ErrorBoundary /> },
      { path: "investments/:id/transactions/new", element: lazyElement(() => import("./pages/wallet-transaction-new"), "WalletTransactionNew"), errorElement: <ErrorBoundary /> },
      { path: "shareholders", element: lazyElement(() => import("./pages/shareholders"), "Shareholders"), errorElement: <ErrorBoundary /> },
      { path: "shareholders/new", element: lazyElement(() => import("./pages/shareholder-detail"), "ShareholderDetail"), errorElement: <ErrorBoundary /> },
      { path: "shareholders/:id", element: lazyElement(() => import("./pages/shareholder-detail"), "ShareholderDetail"), errorElement: <ErrorBoundary /> },
      { path: "share-transactions/new", element: lazyElement(() => import("./pages/share-transaction-new"), "ShareTransactionNew"), errorElement: <ErrorBoundary /> },
      // Cost Centers, Projects, Branches
      { path: "cost-centers", element: lazyElement(() => import("./pages/cost-centers"), "CostCenters"), errorElement: <ErrorBoundary /> },
      { path: "cost-centers/new", element: lazyElement(() => import("./pages/cost-center-detail"), "CostCenterDetail"), errorElement: <ErrorBoundary /> },
      { path: "cost-centers/:id", element: lazyElement(() => import("./pages/cost-center-detail"), "CostCenterDetail"), errorElement: <ErrorBoundary /> },
      { path: "projects", element: lazyElement(() => import("./pages/projects"), "Projects"), errorElement: <ErrorBoundary /> },
      { path: "projects/new", element: lazyElement(() => import("./pages/project-detail"), "ProjectDetail"), errorElement: <ErrorBoundary /> },
      { path: "projects/:id", element: lazyElement(() => import("./pages/project-detail"), "ProjectDetail"), errorElement: <ErrorBoundary /> },
      // Contractors & work logs (freelancers · different from suppliers)
      { path: "contractors", element: lazyElement(() => import("./pages/contractors"), "Contractors"), errorElement: <ErrorBoundary /> },
      { path: "contractors/new", element: lazyElement(() => import("./pages/contractor-detail"), "ContractorDetail"), errorElement: <ErrorBoundary /> },
      { path: "contractors/:id", element: lazyElement(() => import("./pages/contractor-detail"), "ContractorDetail"), errorElement: <ErrorBoundary /> },
      { path: "contractors/:id/pay", element: lazyElement(() => import("./pages/contractor-payment-new"), "ContractorPaymentNew"), errorElement: <ErrorBoundary /> },
      { path: "work-logs/new", element: lazyElement(() => import("./pages/work-log-new"), "WorkLogNew"), errorElement: <ErrorBoundary /> },
      { path: "branches", element: lazyElement(() => import("./pages/branches"), "Branches"), errorElement: <ErrorBoundary /> },
      { path: "branches/new", element: lazyElement(() => import("./pages/branch-detail"), "BranchDetail"), errorElement: <ErrorBoundary /> },
      { path: "branches/:id", element: lazyElement(() => import("./pages/branch-detail"), "BranchDetail"), errorElement: <ErrorBoundary /> },
      // Products & Services
      { path: "products", element: lazyElement(() => import("./pages/products"), "Products"), errorElement: <ErrorBoundary /> },
      { path: "products/new", element: lazyElement(() => import("./pages/product-detail"), "ProductDetail"), errorElement: <ErrorBoundary /> },
      { path: "products/:id", element: lazyElement(() => import("./pages/product-detail"), "ProductDetail"), errorElement: <ErrorBoundary /> },
      { path: "inventory", element: lazyElement(() => import("./pages/inventory"), "Inventory"), errorElement: <ErrorBoundary /> },
      { path: "warehouses", element: lazyElement(() => import("./pages/inventory"), "Inventory"), errorElement: <ErrorBoundary /> },
      { path: "stock-movements", element: lazyElement(() => import("./pages/inventory"), "Inventory"), errorElement: <ErrorBoundary /> },
      { path: "inventory/warehouses/new", element: lazyElement(() => import("./pages/warehouse-new"), "WarehouseNew"), errorElement: <ErrorBoundary /> },
      { path: "inventory/movements/new", element: lazyElement(() => import("./pages/stock-movement-new"), "StockMovementNew"), errorElement: <ErrorBoundary /> },
      // Payroll & Employees
      { path: "payroll", element: lazyElement(() => import("./pages/payroll"), "Payroll"), errorElement: <ErrorBoundary /> },
      { path: "payroll/:id", element: lazyElement(() => import("./pages/payroll-detail"), "PayrollDetail"), errorElement: <ErrorBoundary /> },
      { path: "employees", element: lazyElement(() => import("./pages/employees"), "Employees"), errorElement: <ErrorBoundary /> },
      { path: "employees/new", element: lazyElement(() => import("./pages/employee-new"), "EmployeeNew"), errorElement: <ErrorBoundary /> },
      // Contacts (formerly العملاء والموردين)
      { path: "contacts", element: lazyElement(() => import("./pages/contacts"), "Contacts"), errorElement: <ErrorBoundary /> },
      { path: "contacts/:id", element: lazyElement(() => import("./pages/contact-detail"), "ContactDetail"), errorElement: <ErrorBoundary /> },
      // Developer
      { path: "integrations", element: lazyElement(() => import("./pages/integrations"), "Integrations"), errorElement: <ErrorBoundary /> },
      // Backward compatibility: old header/deep links point to this path.
      // Keep it working by redirecting to Settings > ZATCA tab.
      { path: "integrations/zatca", element: <Navigate to="/app/settings?tab=zatca" replace />, errorElement: <ErrorBoundary /> },
      { path: "templates", element: lazyElement(() => import("./pages/templates"), "Templates"), errorElement: <ErrorBoundary /> },
      { path: "templates/new", element: lazyElement(() => import("./pages/template-detail"), "TemplateDetail"), errorElement: <ErrorBoundary /> },
      { path: "templates/:id", element: lazyElement(() => import("./pages/template-detail"), "TemplateDetail"), errorElement: <ErrorBoundary /> },
      // Analytics & Settings
      { path: "reports", element: lazyElement(() => import("./pages/reports"), "Reports"), errorElement: <ErrorBoundary /> },
      { path: "reports/:id", element: lazyElement(() => import("./pages/report-view"), "ReportView"), errorElement: <ErrorBoundary /> },
      { path: "reports/:id/print", element: lazyElement(() => import("./pages/report-print-designer"), "ReportPrintDesigner"), errorElement: <ErrorBoundary /> },
      { path: "reports/cash-flow", element: lazyElement(() => import("./pages/reports"), "Reports"), errorElement: <ErrorBoundary /> },
      { path: "reports/profit-loss", element: lazyElement(() => import("./pages/reports"), "Reports"), errorElement: <ErrorBoundary /> },
      { path: "settings", element: lazyElement(() => import("./pages/settings"), "Settings"), errorElement: <ErrorBoundary /> },
      { path: "system-status", element: lazyElement(() => import("./pages/system-status"), "SystemStatus"), errorElement: <ErrorBoundary /> },
      { path: "notifications", element: lazyElement(() => import("./pages/notifications"), "Notifications"), errorElement: <ErrorBoundary /> },
      { path: "admin", element: lazyElement(() => import("./pages/admin"), "AdminDashboard"), errorElement: <ErrorBoundary /> },
      { path: "roadmap", element: lazyElement(() => import("./pages/feature-roadmap"), "FeatureRoadmap"), errorElement: <ErrorBoundary /> },
      { path: "marketplace/accountants", element: <Navigate to="/app/roadmap" replace />, errorElement: <ErrorBoundary /> },
    ],
  },
  // Portal routes (standalone, no sidebar)
  { path: "/portal/login", element: lazyElement(() => import("./pages/portal-login"), "PortalLogin"), errorElement: <ErrorBoundary /> },
  { path: "/portal/:token", element: lazyElement(() => import("./pages/portal-home"), "PortalHome"), errorElement: <ErrorBoundary /> },
  { path: "/portal", element: lazyElement(() => import("./pages/portal-home"), "PortalHome"), errorElement: <ErrorBoundary /> },
  { path: "/print/invoice/:id", element: lazyElement(() => import("./pages/invoice-print-view"), "InvoicePrintView"), errorElement: <ErrorBoundary /> },
  { path: "/print/voucher/:id", element: lazyElement(() => import("./pages/voucher-print-view"), "VoucherPrintView"), errorElement: <ErrorBoundary /> },
  // Error handling
  { path: "*", element: <NotFound /> },
]);
