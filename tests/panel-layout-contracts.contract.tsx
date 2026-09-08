import assert from "node:assert/strict";

// FullPageForm reads the language context (bilingual chrome), and LanguageProvider touches
// window/localStorage during render — so the browser globals are shimmed before the
// components are imported, and every render goes through the provider.
const storage = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
};
const windowShim: any = {
  location: { pathname: "/app/invoices", href: "http://localhost/app/invoices" },
  addEventListener() {},
  removeEventListener() {},
  localStorage: localStorageShim,
};
// A getter, not a plain assignment: react-dom/server replaces globalThis.window while
// rendering, which would otherwise strip location out from under LanguageProvider.
Object.defineProperty(globalThis, "window", { configurable: true, get: () => windowShim, set: () => {} });
(globalThis as any).localStorage = localStorageShim;
(globalThis as any).history = { pushState() {}, replaceState() {}, back() {}, forward() {} };
(globalThis as any).document = { documentElement: { setAttribute() {}, style: {} }, body: { dir: "", style: {} } };

const { createElement } = await import("react");
const { renderToStaticMarkup: renderMarkup } = await import("react-dom/server");
const { LanguageProvider } = await import("../src/app/components/LanguageContext");
const { MemoryRouter } = await import("react-router");
const { FullPageForm } = await import("../src/app/components/full-page-form");
const { InlinePanel } = await import("../src/app/components/inline-panel");
const { InlineConfirm, SidePanel, ToastStack } = await import("../src/app/components/side-panel");

const element = createElement;
const renderToStaticMarkup = (node: any) =>
  renderMarkup(element(MemoryRouter as any, null, element(LanguageProvider as any, null, node)));
const rootClass = (markup: string) => markup.match(/^<[^>]+class="([^"]+)"/)?.[1] ?? "";
const forbiddenChrome = /\bbg-white\b|\bbg-primary(?:\/\d+)?\b|\brounded-(?:2xl|3xl)\b|\bshadow-(?:xl|2xl)\b|shadow-\[/;

const fullPage = renderToStaticMarkup(element(FullPageForm, {
  title: "New invoice",
  subtitle: "Complete the required fields",
  onClose: () => undefined,
  footer: element("button", null, "Save"),
  children: element("div", null, "Form fields"),
}));
assert.match(rootClass(fullPage), /\bbg-canvas\b/);
assert.match(fullPage, /\bbg-surface\b/);
assert.match(fullPage, /<h1[^>]*class="[^"]*\btext-section\b/);
assert.doesNotMatch(fullPage, forbiddenChrome);
assert.doesNotMatch(fullPage, /style="[^"]*font-size/);

const inlineCard = renderToStaticMarkup(element(InlinePanel, {
  title: "Quick add",
  description: "Add an item without leaving the page",
  onClose: () => undefined,
  footer: element("button", null, "Add"),
  children: element("div", null, "Fields"),
}));
assert.match(rootClass(inlineCard), /\brounded-lg\b/);
assert.match(rootClass(inlineCard), /\bborder\b/);
assert.match(rootClass(inlineCard), /\bbg-surface\b/);
assert.match(inlineCard, /\bbg-surface-subtle\b/);
assert.match(inlineCard, /<h2[^>]*class="[^"]*\btext-section\b/);
assert.doesNotMatch(inlineCard, /\bshadow-/);
assert.doesNotMatch(inlineCard, forbiddenChrome);
assert.doesNotMatch(inlineCard, /style="[^"]*font-size/);

const desktopPanel = renderToStaticMarkup(element(SidePanel, {
  open: true,
  onClose: () => undefined,
  title: "Details",
  children: element("div", null, "Panel content"),
}));
assert.match(rootClass(desktopPanel), /\bbg-surface\b/);
assert.match(rootClass(desktopPanel), /\bborder-e\b/);
assert.match(rootClass(desktopPanel), /\bshadow-popover\b/);
assert.match(desktopPanel, /<h2[^>]*class="[^"]*\btext-section\b/);
assert.doesNotMatch(desktopPanel, forbiddenChrome);
assert.doesNotMatch(desktopPanel, /style="[^"]*font-size/);

const originalWindow = globalThis.window;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  // Keep the base shim (location/localStorage) — LanguageProvider now wraps every render —
  // and add matchMedia so SidePanel takes its desktop branch.
  value: {
    ...windowShim,
    matchMedia: () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  },
});
const hydrationMarkup = renderToStaticMarkup(element(SidePanel, {
  open: true,
  onClose: () => undefined,
  title: "Details",
  children: element("div", null, "Panel content"),
}));
if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
assert.equal(hydrationMarkup, desktopPanel, "server and first client render must match before media-query effects")
assert.doesNotMatch(hydrationMarkup, forbiddenChrome);

const toastStack = renderToStaticMarkup(element(ToastStack, {
  toasts: [
    { id: 1, kind: "success", message: "Saved" },
    { id: 2, kind: "error", message: "Unable to save" },
    { id: 3, kind: "info", message: "Review changes" },
  ],
  onDismiss: () => undefined,
}));
assert.match(toastStack, /\bshadow-popover\b/);
assert.match(toastStack, /\bborder-success-border\b[^>]*\bbg-success-subtle\b[^>]*\btext-success\b/);
assert.match(toastStack, /\bborder-danger-border\b[^>]*\bbg-danger-subtle\b[^>]*\btext-danger\b/);
assert.match(toastStack, /\bborder-info-border\b[^>]*\bbg-info-subtle\b[^>]*\btext-info\b/);
assert.doesNotMatch(toastStack, /\b(?:bg|text|border)-(?:red|green|blue)-\d+\b/);

const inlineConfirm = renderToStaticMarkup(element(InlineConfirm, {
  onConfirm: () => undefined,
  onCancel: () => undefined,
}));
assert.match(inlineConfirm, /\bborder-danger-border\b/);
assert.match(inlineConfirm, /\bbg-danger-subtle\b/);
assert.doesNotMatch(inlineConfirm, /\b(?:bg|text|border)-red-\d+\b/);

const {
  AuthAlert,
  AuthPanel,
  AuthShell,
  FeatureItem,
  MarketingContainer,
  MarketingHeading,
  MarketingSection,
} = await import("../src/app/components/layout-contracts");

const marketing = [
  renderToStaticMarkup(element(MarketingContainer, { "aria-label": "Marketing content" }, "Content")),
  renderToStaticMarkup(element(MarketingSection, null, "Section content")),
  renderToStaticMarkup(element(MarketingHeading, {
    as: "h1",
    eyebrow: "Entix",
    title: "Run your books clearly",
    description: "A concise product description.",
  })),
  renderToStaticMarkup(element(FeatureItem, {
    icon: element("span", null, "Icon"),
    title: "Clear reporting",
    description: "Understand performance at a glance.",
  })),
].join("");
assert.match(marketing, /\bmax-w-7xl\b/);
assert.match(marketing, /<section[^>]*\bbg-background\b/);
assert.match(marketing, /<h1[^>]*\btext-page\b/);
assert.match(marketing, /<article[^>]*\brounded-lg\b[^>]*\bborder\b[^>]*\bbg-surface\b/);

const auth = [
  renderToStaticMarkup(element(AuthShell, null, element("div", null, "Sign in"))),
  renderToStaticMarkup(element(AuthPanel, {
    title: "Welcome back",
    description: "Use your account to continue.",
  }, element("form", null, "Fields"))),
  renderToStaticMarkup(element(AuthAlert, { tone: "critical", title: "Unable to sign in" }, "Try again.")),
  renderToStaticMarkup(element(AuthAlert, { tone: "info" }, "Check your inbox.")),
].join("");
assert.match(auth, /<main[^>]*\bbg-background\b/);
assert.match(auth, /<section[^>]*\brounded-lg\b[^>]*\bborder\b[^>]*\bbg-surface\b/);
assert.match(auth, /role="alert"[^>]*\bborder-danger-border\b[^>]*\bbg-danger-subtle\b/);
assert.match(auth, /role="status"[^>]*\bborder-info-border\b[^>]*\bbg-info-subtle\b/);
assert.doesNotMatch(auth, /\bshadow-/);

const allContracts = marketing + auth;
assert.doesNotMatch(allContracts, /gradient|\brounded-(?:2xl|3xl|full)\b|\bshadow-(?:xl|2xl)\b/);
assert.doesNotMatch(allContracts, /\b(?:bg|text|border)-(?:red|green|blue|gray|slate|zinc|neutral|stone)-\d+\b/);
assert.doesNotMatch(allContracts, /style="[^"]*font-size/);

console.log("panel and public/auth layout contracts passed");
