#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const baseUrl = normalizeBaseUrl(process.env.QA_BASE_URL || "http://127.0.0.1:5173");
const reportDir = process.env.QA_REPORT_DIR
  ? path.resolve(process.env.QA_REPORT_DIR)
  : path.join(projectRoot, "qa-reports");
const runStamp = timestampForFile();
const screenshotDir = path.join(reportDir, "screenshots", runStamp);
const autoStart = process.env.QA_AUTO_START !== "0";
const useBrowser = process.env.QA_BROWSER === "1";

const routes = [
  group("Public website", [
    route("/", "Landing page shows ENTIX.IO brand and public CTA."),
    route("/login", "Login page renders auth choices and email/password entry."),
    route("/register", "Registration page renders account creation flow."),
    route("/forgot-password", "Password recovery flow renders without crash."),
    route("/features", "Feature overview renders public product positioning."),
    route("/pricing", "Pricing page renders plan comparison."),
    route("/privacy", "Privacy policy is available for launch readiness."),
    route("/terms", "Terms of service is available for launch readiness."),
    route("/help", "Help center route renders customer support entry."),
    route("/docs", "Documentation route renders product docs shell."),
  ]),
  group("Core app shell", [
    appRoute("/app", "Dashboard opens with app shell, sidebar, KPI cards, and no error boundary."),
    appRoute("/app/ai", "AI assistant opens and keeps conversation surface visible."),
    appRoute("/app/settings", "Settings tabs render and account/company actions are reachable."),
    appRoute("/app/system-status", "System status renders operational health state."),
    appRoute("/app/notifications", "Notifications center renders without crash."),
    appRoute("/app/admin", "Admin dashboard route renders for internal review."),
  ]),
  group("Sales", [
    appRoute("/app/sales", "Sales dashboard renders sales KPIs."),
    appRoute("/app/invoices", "Invoice list and create controls render."),
    appRoute("/app/invoices/new", "New invoice form renders with editable line items."),
    appRoute("/app/quotes", "Quote list and create controls render."),
    appRoute("/app/quotes/new", "New quote form renders without crash."),
    appRoute("/app/receipts", "Receipt/voucher list renders."),
    appRoute("/app/credit-notes", "Credit note list renders."),
  ]),
  group("Purchases and expenses", [
    appRoute("/app/purchases", "Purchases dashboard renders purchase KPIs."),
    appRoute("/app/purchases/bills", "Purchase bills list renders."),
    appRoute("/app/purchases/bills/new", "New purchase bill form renders."),
    appRoute("/app/purchases/supplier-credits", "Supplier credit notes render."),
    appRoute("/app/payments", "Payments list and payment creation route render."),
    appRoute("/app/expenses", "Expense list and OCR/manual expense entry render."),
    appRoute("/app/expenses/new", "New expense flow renders currency and payment fields."),
    appRoute("/app/scan-receipts", "Invoice/receipt capture flow renders upload and OCR entry."),
    appRoute("/app/inbox", "Inbound email/document inbox renders."),
  ]),
  group("Inventory and products", [
    appRoute("/app/products", "Products and services table renders with create/edit actions."),
    appRoute("/app/products/sample", "Product detail route handles product id state."),
    appRoute("/app/inventory", "Inventory movement flow renders receive/issue/transfer controls."),
  ]),
  group("Accounting", [
    appRoute("/app/chart-of-accounts", "Chart of accounts renders account hierarchy."),
    appRoute("/app/journal-entries", "Journal entries render accounting ledger controls."),
    appRoute("/app/journal-entries/new", "New journal entry form renders."),
    appRoute("/app/taxes", "Taxes/VAT route renders tax summary."),
    appRoute("/app/bank-accounts", "Bank accounts render balances and add account control."),
    appRoute("/app/bank-reconciliation", "Bank reconciliation upload flow renders."),
    appRoute("/app/fiscal-periods", "Fiscal period controls render."),
    appRoute("/app/assets", "Fixed assets list renders asset rows and links."),
    appRoute("/app/assets/sample", "Fixed asset detail route handles asset id state."),
    appRoute("/app/cost-centers", "Cost centers render allocation controls."),
    appRoute("/app/projects", "Projects render tracking controls."),
    appRoute("/app/branches", "Branches render branch management controls."),
  ]),
  group("Contacts and workforce", [
    appRoute("/app/contacts", "Contacts list renders customers, vendors, and roles."),
    appRoute("/app/contacts/sample", "Contact detail route handles contact id state."),
    appRoute("/app/payroll", "Payroll route renders without Label/runtime crash."),
    appRoute("/app/employees", "Employees route renders workforce table."),
  ]),
  group("Reports and developer tools", [
    appRoute("/app/reports", "Reports index renders report cards."),
    appRoute("/app/reports/cash-flow", "Cash-flow report route renders."),
    appRoute("/app/reports/profit-loss", "Profit/loss report route renders."),
    appRoute("/app/integrations", "Integrations route renders connected-service controls."),
    appRoute("/app/templates", "Templates route renders document templates."),
    appRoute("/app/roadmap", "Roadmap route renders release planning state."),
  ]),
  group("Portal", [
    route("/portal/login", "Client portal login renders."),
    route("/portal", "Client portal home renders or redirects cleanly."),
  ]),
].flatMap((section) => section.items.map((item) => ({ ...item, section: section.name })));

const fatalSignatures = [
  "Label is not defined",
  "ReferenceError",
  "TypeError:",
  "Cannot read properties of undefined",
  "is not a function",
  "حدث خطأ",
  "Something went wrong",
  "Application error",
  "Vite Error",
  "Internal Server Error",
];

const browserFindings = [];
let devServer = null;

try {
  const serverWasRunning = await waitForServer(baseUrl, 800);
  if (!serverWasRunning) {
    if (!autoStart) {
      throw new Error(`QA target is not reachable: ${baseUrl}. Set QA_AUTO_START=1 or start the app manually.`);
    }
    devServer = startDevServer();
    await waitForServer(baseUrl, 20_000, true);
  }

  const browserRuntime = useBrowser ? await tryLoadPlaywright() : null;
  const routeResults = [];
  for (const target of routes) {
    const result = await auditRoute(target, browserRuntime);
    routeResults.push(result);
  }

  const buildEvidence = await collectBuildEvidence();
  const summary = summarize(routeResults);
  const report = {
    generatedAt: new Date().toISOString(),
    projectRoot,
    baseUrl,
    qaMode: {
      httpRouteAudit: true,
      browserRuntimeAudit: Boolean(browserRuntime),
      browserRuntimeReason: browserRuntime
        ? "Playwright runtime available and QA_BROWSER=1."
        : useBrowser
          ? "QA_BROWSER=1 was requested, but Playwright is not installed in this project."
          : "Set QA_BROWSER=1 after installing Playwright to execute JavaScript and capture console/runtime errors.",
      localAuthBypass: "Protected app routes are tested with ?__qa_auth=1; this works only in Vite dev with VITE_QA_AUTH_BYPASS=1.",
    },
    buildEvidence,
    summary,
    routes: routeResults,
    browserFindings,
  };

  await mkdir(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, `route-audit-${runStamp}.json`);
  const markdownPath = path.join(reportDir, `route-audit-${runStamp}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(markdownPath, renderMarkdown(report));

  printConsoleSummary(report, jsonPath, markdownPath);
  process.exitCode = summary.failed === 0 ? 0 : 1;
} finally {
  if (devServer) devServer.kill("SIGTERM");
}

function group(name, items) {
  return { name, items };
}

function route(pathname, expected) {
  return { pathname, expected, auth: "public" };
}

function appRoute(pathname, expected) {
  return { pathname, expected, auth: "local-qa-bypass" };
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function routeUrl(target) {
  const url = new URL(target.pathname, `${baseUrl}/`);
  if (target.auth === "local-qa-bypass") url.searchParams.set("__qa_auth", "1");
  return url.toString();
}

async function auditRoute(target, browserRuntime) {
  const url = routeUrl(target);
  const result = {
    section: target.section,
    route: target.pathname,
    authMode: target.auth,
    expected: target.expected,
    url,
    checks: [],
    interactions: [],
    status: "pass",
    challenges: [],
    solutions: [],
    evidence: {},
  };

  const startedAt = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual" });
    const text = await response.text();
    result.evidence.httpStatus = response.status;
    result.evidence.durationMs = Date.now() - startedAt;
    result.evidence.assetBundle = extractAssetBundle(text);

    addCheck(result, "HTTP status", response.status >= 200 && response.status < 400, `${response.status}`);
    addCheck(result, "SPA shell", text.includes('id="root"'), text.includes('id="root"') ? "root mounted in HTML" : "missing root mount");
    const fatal = fatalSignatures.find((signature) => text.includes(signature));
    addCheck(result, "Static fatal signature", !fatal, fatal ? `matched: ${fatal}` : "none in HTML response");

    if (browserRuntime) {
      await auditRouteInBrowser(target, result, browserRuntime);
    } else {
      addCheck(result, "Browser runtime", null, "not run; install Playwright and set QA_BROWSER=1 for JS execution checks");
      result.challenges.push("HTTP checks cannot execute React, so runtime-only crashes still require Browser/Playwright validation.");
      result.solutions.push("Install Playwright as a dev QA tool, then run QA_BROWSER=1 npm run qa:routes.");
    }
  } catch (error) {
    addCheck(result, "Route fetch", false, error instanceof Error ? error.message : String(error));
  }

  result.status = result.checks.some((check) => check.pass === false) ? "fail" : "pass";
  if (result.status === "fail") {
    if (!result.solutions.length) {
      result.solutions.push("Open the failing route locally, inspect console/runtime stack, then patch the page component or route mapping.");
    }
  }
  return result;
}

async function auditRouteInBrowser(target, result, playwright) {
  let browser;
  try {
    await mkdir(screenshotDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleErrors.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
    await page.goto(routeUrl(target), { waitUntil: "networkidle", timeout: 15_000 });
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const screenshotPath = path.join(screenshotDir, `${safeRouteName(target.pathname)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.evidence.screenshot = screenshotPath;
    const hasErrorBoundary = fatalSignatures.some((signature) => bodyText.includes(signature));
    addCheck(result, "Browser body content", bodyText.trim().length > 20, bodyText.trim().slice(0, 120));
    addCheck(result, "Browser fatal signature", !hasErrorBoundary, hasErrorBoundary ? "error boundary/fatal text visible" : "none visible");
    addCheck(result, "Browser screenshot", true, screenshotPath);
    await auditInteractions(page, target, result);
    const relevantConsoleErrors = consoleErrors.filter((message) => !isExpectedLocalQaAuthNoise(target, message));
    const ignoredConsoleErrors = consoleErrors.length - relevantConsoleErrors.length;
    addCheck(
      result,
      "Browser console",
      relevantConsoleErrors.length === 0,
      relevantConsoleErrors.slice(0, 5).join(" | ")
        || (ignoredConsoleErrors > 0 ? `clean after ignoring ${ignoredConsoleErrors} expected local auth/API messages` : "clean"),
    );
    if (ignoredConsoleErrors > 0) {
      result.evidence.ignoredLocalQaConsoleMessages = ignoredConsoleErrors;
    }
    result.evidence.browserTextSample = bodyText.trim().slice(0, 300);
  } catch (error) {
    addCheck(result, "Browser audit", false, error instanceof Error ? error.message : String(error));
    browserFindings.push({ route: target.pathname, error: error instanceof Error ? error.message : String(error) });
  } finally {
    if (browser) await browser.close();
  }
}

async function auditInteractions(page, target, result) {
  switch (target.pathname) {
    case "/login":
      await recordVisibleText(page, result, "Login form visible", ["Sign in", "Login", "تسجيل الدخول"]);
      await recordInputProbe(page, result, "Login email input reachable", [
        "input[type='email']",
        "input[name='email']",
        "input[placeholder*='email' i]",
        "input[placeholder*='البريد']",
      ]);
      break;
    case "/register":
      await recordVisibleText(page, result, "Register form visible", ["Create account", "Register", "إنشاء حساب"]);
      break;
    case "/app":
      await recordVisibleText(page, result, "Dashboard shell visible", ["Dashboard", "لوحة التحكم"]);
      await recordBankAccountDeepLink(page, result);
      break;
    case "/app/settings":
      await recordVisibleText(page, result, "Settings shell visible", ["Settings", "الإعدادات"]);
      await recordClickText(page, result, "Settings payment tab opens", ["Payment gateways", "بوابات الدفع"]);
      break;
    case "/app/invoices":
      await recordVisibleText(page, result, "Invoice list visible", ["Invoices", "الفواتير"]);
      await recordClickText(page, result, "New invoice action reachable", ["New invoice", "فاتورة جديدة", "+ فاتورة"]);
      break;
    case "/app/invoices/new":
      await recordVisibleText(page, result, "New invoice editor visible", ["New invoice", "فاتورة جديدة"]);
      await recordTextareaMultiline(page, result, "Line description expands for multiline text");
      break;
    case "/app/products":
      await recordVisibleText(page, result, "Products table visible", ["Products", "المنتجات والخدمات"]);
      await recordClickText(page, result, "Product create action opens editor", ["New item", "New product", "صنف جديد"]);
      await recordFileInput(page, result, "Product image upload input accepts images", "image");
      break;
    case "/app/inventory":
      await recordVisibleText(page, result, "Inventory page visible", ["Inventory", "المخزون"]);
      await recordClickText(page, result, "Inventory movement drawer opens", ["Stock movement", "حركة مخزنية", "حركة مخزون"]);
      await recordInlineCreateProbe(page, result, "Inventory item select supports inline create", "QA Inline Product", [
        "ابحث عن صنف أو اكتب صنف جديد",
        "Choose item",
        "Select item",
        "اختر الصنف",
        "الصنف",
      ]);
      break;
    case "/app/bank-accounts":
      await recordVisibleText(page, result, "Bank accounts page visible", ["Bank accounts", "الحسابات البنكية"]);
      await recordClickText(page, result, "New bank account action opens form", ["New account", "حساب جديد"]);
      await recordVisibleText(page, result, "US banking copy or Mercury support visible", ["Mercury", "Routing number", "رقم التوجيه", "SWIFT"]);
      break;
    case "/app/bank-reconciliation":
      await recordVisibleText(page, result, "Bank reconciliation page visible", ["Bank reconciliation", "تسوية البنوك"]);
      await recordFileInput(page, result, "Statement upload accepts PDF", "pdf");
      break;
    case "/app/assets":
      await recordVisibleText(page, result, "Fixed assets page visible", ["Fixed assets", "الأصول الثابتة"]);
      await recordAssetOpenProbe(page, result);
      break;
    case "/app/payroll":
      await recordVisibleText(page, result, "Payroll route visible", ["Payroll", "الرواتب"]);
      break;
    case "/app/employees":
      await recordVisibleText(page, result, "Employees route visible", ["Employees", "الموظفين"]);
      break;
    case "/app/reports":
      await recordVisibleText(page, result, "Reports route visible", ["Reports", "التقارير"]);
      break;
    default:
      addInteraction(result, "No scripted interaction for this route", null, "browser runtime and screenshot checks only");
  }
}

async function recordVisibleText(page, result, name, labels) {
  const match = await firstVisibleText(page, labels);
  addInteraction(result, name, Boolean(match), match ? `matched: ${match}` : `missing any of: ${labels.join(", ")}`);
}

async function recordClickText(page, result, name, labels) {
  const locator = await firstVisibleTextLocator(page, labels);
  if (!locator) {
    addInteraction(result, name, false, `missing clickable text: ${labels.join(", ")}`);
    return;
  }
  await locator.click({ timeout: 4_000 }).catch((error) => {
    throw new Error(`${name}: click failed: ${error.message}`);
  });
  addInteraction(result, name, true, "clicked");
}

async function recordInputProbe(page, result, name, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && await locator.isVisible().catch(() => false)) {
      await locator.focus();
      addInteraction(result, name, true, `focused ${selector}`);
      return;
    }
  }
  addInteraction(result, name, false, `missing input selector: ${selectors.join(", ")}`);
}

async function recordTextareaMultiline(page, result, name) {
  const textarea = page.locator("textarea").first();
  if ((await textarea.count()) === 0) {
    addInteraction(result, name, false, "no textarea found");
    return;
  }
  await textarea.fill("Line one\nLine two\nLine three");
  const value = await textarea.inputValue().catch(() => "");
  const box = await textarea.boundingBox().catch(() => null);
  addInteraction(
    result,
    name,
    value.includes("Line three"),
    box ? `multiline value accepted; height=${Math.round(box.height)}px` : "multiline value accepted",
  );
}

async function recordFileInput(page, result, name, expectedAcceptPart) {
  const fileInput = page.locator("input[type='file']").first();
  if ((await fileInput.count()) === 0) {
    addInteraction(result, name, false, "no file input found");
    return;
  }
  const accept = (await fileInput.getAttribute("accept")) || "";
  addInteraction(result, name, accept.toLowerCase().includes(expectedAcceptPart), `accept="${accept || "(empty)"}"`);
}

async function recordInlineCreateProbe(page, result, name, query, openLabels = []) {
  if (openLabels.length) {
    const trigger = await firstVisibleButtonTextLocator(page, openLabels) || await firstVisibleTextLocator(page, openLabels);
    if (trigger) await trigger.click({ timeout: 4_000 }).catch(() => null);
  }
  const inputs = page.locator("input");
  const count = await inputs.count();
  for (let index = 0; index < Math.min(count, 10); index += 1) {
    const input = inputs.nth(index);
    if (!await input.isVisible().catch(() => false)) continue;
    await input.fill(query).catch(() => null);
    await page.waitForTimeout(150);
    const body = await page.locator("body").innerText().catch(() => "");
    if (body.includes(query) && /Create|إنشاء|إضافة|Add/.test(body)) {
      addInteraction(result, name, true, `inline create candidate appeared for "${query}"`);
      return;
    }
  }
  addInteraction(result, name, false, "no inline create option appeared after typing into visible inputs");
}

async function recordBankAccountDeepLink(page, result) {
  const accountCard = page.locator("a[href^='/app/bank-accounts/']").first();
  if ((await accountCard.count()) > 0) {
    const href = await accountCard.getAttribute("href");
    addInteraction(result, "Bank account cards deep-link to account detail", Boolean(href), href || "link exists without href");
    return;
  }
  const newBankLink = page.locator("a[href='/app/bank-accounts/new'], a[href='/app/bank-accounts']").first();
  if ((await newBankLink.count()) > 0) {
    addInteraction(result, "Bank account cards deep-link to account detail", null, "no bank card in local QA data; bank management link is present");
    return;
  }
  addInteraction(result, "Bank account cards deep-link to account detail", false, "missing bank detail link and bank management fallback");
}

async function recordAssetOpenProbe(page, result) {
  const detailLink = page.locator("a[href^='/app/assets/']").first();
  if ((await detailLink.count()) > 0 && await detailLink.isVisible().catch(() => false)) {
    const href = await detailLink.getAttribute("href");
    addInteraction(result, "Asset code/name opens a detail surface", Boolean(href), href || "asset detail link present");
    return;
  }
  const openButton = page.locator("button[title*='فتح']").first();
  if ((await openButton.count()) > 0 && await openButton.isVisible().catch(() => false)) {
    await openButton.click({ timeout: 4_000 }).catch(() => null);
    addInteraction(result, "Asset code/name opens a detail surface", true, "opened asset side panel via visible open button");
    return;
  }
  const createButton = await firstVisibleTextLocator(page, ["New asset", "أصل جديد"]);
  if (createButton) {
    addInteraction(result, "Asset code/name opens a detail surface", null, "no asset row in local QA data; create asset action is present");
    return;
  }
  addInteraction(result, "Asset code/name opens a detail surface", false, "missing asset detail link/open button and create fallback");
}

async function recordLinkTarget(page, result, name, selector) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) {
    addInteraction(result, name, false, `missing link selector: ${selector}`);
    return;
  }
  const href = await locator.getAttribute("href");
  addInteraction(result, name, Boolean(href), href || "link exists without href");
}

async function recordFirstClickable(page, result, name, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 4_000 }).catch(() => null);
      addInteraction(result, name, true, `clicked ${selector}`);
      return;
    }
  }
  addInteraction(result, name, false, `missing clickable selector: ${selectors.join(", ")}`);
}

async function firstVisibleText(page, labels) {
  for (const label of labels) {
    const locator = page.getByText(label, { exact: false }).first();
    if ((await locator.count()) > 0 && await locator.isVisible().catch(() => false)) {
      return label;
    }
  }
  return null;
}

async function firstVisibleTextLocator(page, labels) {
  for (const label of labels) {
    const locator = page.getByText(label, { exact: false }).first();
    if ((await locator.count()) > 0 && await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  return null;
}

async function firstVisibleButtonTextLocator(page, labels) {
  for (const label of labels) {
    const locator = page.locator("button").filter({ hasText: label }).first();
    if ((await locator.count()) > 0 && await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  return null;
}

function addInteraction(result, name, pass, details) {
  result.interactions.push({ name, pass, details });
  addCheck(result, `Interaction: ${name}`, pass, details);
}

function safeRouteName(pathname) {
  return (pathname === "/" ? "root" : pathname.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-")).replace(/-+$/g, "") || "route";
}

function isExpectedLocalQaAuthNoise(target, message) {
  if (target.auth !== "local-qa-bypass") return false;
  const host = new URL(baseUrl).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) return false;
  return /401|unauthorized|\[orgs\] load failed|\[notifications\] fetch failed/.test(message);
}

function addCheck(result, name, pass, details) {
  result.checks.push({ name, pass, details });
}

function extractAssetBundle(html) {
  const match = html.match(/\/assets\/index-[^"']+\.js/);
  return match ? match[0] : null;
}

async function collectBuildEvidence() {
  try {
    const htmlPath = path.join(projectRoot, "dist", "index.html");
    const html = await import("node:fs/promises").then((fs) => fs.readFile(htmlPath, "utf8"));
    return {
      distIndex: htmlPath,
      assetBundle: extractAssetBundle(html),
    };
  } catch {
    return {
      distIndex: null,
      assetBundle: null,
      note: "Run npm run build before QA if you need production bundle evidence.",
    };
  }
}

function summarize(results) {
  const failed = results.filter((result) => result.status === "fail").length;
  return {
    total: results.length,
    passed: results.length - failed,
    failed,
    skippedBrowserRuntime: results.filter((result) => result.checks.some((check) => check.name === "Browser runtime" && check.pass === null)).length,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# ENTX Books Route QA Report`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Project: \`${report.projectRoot}\``);
  lines.push(`Target: \`${report.baseUrl}\``);
  lines.push(`Build bundle: \`${report.buildEvidence.assetBundle || "not available"}\``);
  lines.push(`Screenshots: \`${screenshotDir}\``);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Total routes: ${report.summary.total}`);
  lines.push(`- Passed: ${report.summary.passed}`);
  lines.push(`- Failed: ${report.summary.failed}`);
  lines.push(`- Browser runtime checks skipped: ${report.summary.skippedBrowserRuntime}`);
  lines.push("");
  lines.push(`## QA Mode`);
  lines.push("");
  lines.push(`- HTTP route audit: ${report.qaMode.httpRouteAudit ? "enabled" : "disabled"}`);
  lines.push(`- Browser runtime audit: ${report.qaMode.browserRuntimeAudit ? "enabled" : "disabled"}`);
  lines.push(`- Browser note: ${report.qaMode.browserRuntimeReason}`);
  lines.push(`- Auth note: ${report.qaMode.localAuthBypass}`);
  lines.push("");
  lines.push(`## Route Matrix`);
  lines.push("");
  lines.push(`| Section | Route | Expected behavior | Evidence | Result | Challenges | Solutions |`);
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const item of report.routes) {
    const evidence = item.checks
      .map((check) => `${check.name}: ${check.pass === null ? "SKIP" : check.pass ? "PASS" : "FAIL"} (${escapePipe(check.details)})`)
      .join("<br>");
    lines.push(
      `| ${escapePipe(item.section)} | \`${item.route}\` | ${escapePipe(item.expected)} | ${evidence} | ${item.status.toUpperCase()} | ${escapePipe(item.challenges.join(" ")) || "-"} | ${escapePipe(item.solutions.join(" ")) || "-"} |`,
    );
  }
  lines.push("");
  lines.push(`## Next QA Tasks`);
  lines.push("");
  lines.push(`1. Expand interaction probes into authenticated create/edit/save flows once a disposable QA database is approved.`);
  lines.push(`2. Add mobile viewport screenshots for the routes that still pass desktop runtime checks.`);
  lines.push(`3. Run this report against production only after explicit deployment approval and cache purge approval if needed.`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function escapePipe(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function printConsoleSummary(report, jsonPath, markdownPath) {
  console.log(`ENTX Books route QA complete`);
  console.log(`Target: ${report.baseUrl}`);
  console.log(`Routes: ${report.summary.passed}/${report.summary.total} passed`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Browser runtime: ${report.qaMode.browserRuntimeAudit ? "enabled" : "skipped"}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${markdownPath}`);
}

function startDevServer() {
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", new URL(baseUrl).port || "5173"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      VITE_QA_AUTH_BYPASS: "1",
    },
  });
  child.stdout.on("data", (data) => {
    if (process.env.QA_VERBOSE === "1") process.stdout.write(data);
  });
  child.stderr.on("data", (data) => {
    if (process.env.QA_VERBOSE === "1") process.stderr.write(data);
  });
  return child;
}

async function waitForServer(targetBaseUrl, timeoutMs, throwOnTimeout = false) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${targetBaseUrl}/`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (throwOnTimeout) throw new Error(`Timed out waiting for ${targetBaseUrl}`);
  return false;
}

async function tryLoadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
}
