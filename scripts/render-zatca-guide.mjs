/** Regenerate the public customer PDF from its editable HTML, without network access. */
import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith('file:') || request.url().startsWith('data:') ? request.continue() : request.abort());
  await page.goto(pathToFileURL(resolve(root, 'public/guides/zatca-onboarding-ar.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMediaType('print');
  const issues = await page.$$eval('.page', nodes => nodes.flatMap((node, index) => {
    const footer = node.querySelector('footer');
    const last = footer.previousElementSibling;
    return node.scrollHeight > node.clientHeight + 1 || last.getBoundingClientRect().bottom > footer.getBoundingClientRect().top - 8 ? [index + 1] : [];
  }));
  if (issues.length) throw new Error(`Guide content overlaps or overflows on pages ${issues.join(', ')}`);
  await page.pdf({ path: resolve(root, 'public/guides/zatca-onboarding-ar.pdf'), printBackground: true, preferCSSPageSize: true });
  await page.setViewport({ width: 390, height: 844 });
  await page.emulateMediaType('screen');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile guide overflows horizontally');
  console.log('Guide PDF regenerated; page boundaries and mobile width verified.');
} finally { await browser.close(); }
