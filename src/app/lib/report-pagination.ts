import { socialFooterHtml, socialFooterSettings, socialFooterOnPage } from './document-social';
import type { ReportPrintSettings } from './api';

/** Yield to input/rendering without the one-second timer clamp of background tabs. */
function yieldReportWork(): Promise<void> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

export function reportPaperSize(settings: ReportPrintSettings) {
  const portrait = ({ A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6] } as const)[settings.paper || 'A4'];
  const [width, height] = settings.orientation === 'landscape' ? [...portrait].reverse() : portrait;
  return { width, height };
}

/** Attach branding independently of the optional report legal footer. */
export function attachReportSocialFooter(article: HTMLElement, org: any, lang: string) {
  article.querySelector(':scope > .report-social-source')?.remove();
  const html = socialFooterHtml(org.socialLinks, org.socialFooter || org.brandTheme?.socialFooter, lang);
  if (!html) return;
  const footer = document.createElement('div');
  footer.className = 'report-social-source';
  footer.style.cssText = 'padding:2mm 6mm;color:inherit;flex-shrink:0';
  footer.innerHTML = html;
  article.append(footer);
}
export function applySocialFooterPages(pages: HTMLElement[]) {
  pages.forEach((page, index) => page.querySelectorAll<HTMLElement>('[data-social-pages]').forEach(footer => {
    const settings = socialFooterSettings({ pages: footer.dataset.socialPages });
    // Retain the measured band, so hiding links cannot change pagination.
    footer.style.visibility = socialFooterOnPage(settings, index + 1, pages.length) ? 'visible' : 'hidden';
  }));
}

/** Build physical sheets from rendered rows, never slice a tall screenshot through text. */
export async function paginateReport(source: HTMLElement, target: HTMLElement, settings: ReportPrintSettings, signal?: AbortSignal) {
  const { width, height } = reportPaperSize(settings);
  target.replaceChildren();
  const originalMain = source.querySelector(':scope > main') as HTMLElement | null;
  if (!originalMain) throw new Error('report_content_missing');
  const footer = source.querySelector(':scope > footer');
  const social = source.querySelector(':scope > .report-social-source');
  // Fonts/images have settled before pagination. Suspend source layout only
  // during measurement, restoring it even if this render is cancelled.
  const sourceVisibility = source.style.contentVisibility;
  source.style.contentVisibility = 'hidden';
  const pages: HTMLElement[] = [];
  let body: HTMLElement;
  const newPage = () => {
    // Finished pages retain their fixed dimensions but need no repeated layout
    // while measuring the next page's rows.
    if (pages.length) pages[pages.length - 1].style.contentVisibility = 'hidden';
    const sheet = source.cloneNode(false) as HTMLElement;
    sheet.classList.add('report-output-sheet');
    sheet.style.width = `${width}mm`;
    sheet.style.height = `${height}mm`;
    sheet.style.minHeight = '0';
    // Physical page dimensions are fixed. Isolate each row measurement from
    // the growing preview and the complete unpaginated source document.
    sheet.style.contain = 'size layout style';
    sheet.style.contentVisibility = 'visible';
    for (const child of Array.from(source.children)) {
      if (child === originalMain || child === footer || child === social) continue;
      if (pages.length === 0) sheet.append(child.cloneNode(true));
    }
    body = originalMain.cloneNode(false) as HTMLElement;
    body.classList.add('report-page-body');
    sheet.append(body);
    const pageFooter = document.createElement('div');
    pageFooter.className = 'report-page-footer';
    if (social) pageFooter.append(social.cloneNode(true));
    if (footer) pageFooter.append(footer.cloneNode(true));
    const counter = document.createElement('div');
    counter.className = 'report-page-counter';
    counter.textContent = '1 / 1'; // Reserve counter height before measuring the body.
    // Keep the code and page number in the same measured footer line.
    const footerLine = pageFooter.querySelector('footer') || pageFooter;
    footerLine.append(counter);
    sheet.append(pageFooter);
    target.append(sheet);
    pages.push(sheet);
  };
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  const requireFit = () => { if (!fits()) throw new Error('report_row_too_tall'); };
  try {
  newPage();
  let workedAt = performance.now();

  for (const block of Array.from(originalMain.children)) {
    const originalTable = block.querySelector(':scope > table');
    if (!originalTable) {
      const clone = block.cloneNode(true) as HTMLElement;
      const hadContent = body!.childElementCount > 0;
      body!.append(clone);
      if (!fits() && hadContent) {
        clone.remove();
        const previousSection = body!.lastElementChild as HTMLElement | null;
        const previousRows = previousSection?.querySelector('table > tbody');
        // Do not strand a short closing note on a page of its own. Carry the
        // final detail and total, while keeping the preceding page nonempty.
        const carry = clone.classList.contains('report-footer-note') && previousRows && previousRows.children.length > 2
          ? previousSection!.cloneNode(true) as HTMLElement : null;
        const carriedRows = carry ? Array.from(previousRows!.children).slice(-2) : [];
        if (carry) {
          for (const child of Array.from(carry.children)) if (child.tagName !== 'TABLE') child.remove();
          carry.querySelector('tbody')!.replaceChildren(...carriedRows);
        }
        newPage();
        if (carry) body!.append(carry);
        body!.append(clone);
        if (carry && !fits()) {
          // A long note still owns a page; never sacrifice or clip table rows.
          carry.remove(); previousRows!.append(...carriedRows);
        }
      }
      requireFit();
      continue;
    }
    const rows = Array.from(originalTable.querySelectorAll('tbody > tr'));
    let section: HTMLElement;
    let tbody: HTMLElement;
    const addSection = (continuation = false) => {
      section = block.cloneNode(false) as HTMLElement;
      for (const child of Array.from(block.children)) {
        if (child === originalTable) continue;
        if (!continuation) section.append(child.cloneNode(true));
      }
      const table = originalTable.cloneNode(false) as HTMLElement;
      for (const child of Array.from(originalTable.children)) {
        if (child.tagName !== 'TBODY') table.append(child.cloneNode(true));
      }
      tbody = document.createElement('tbody');
      table.append(tbody);
      section.append(table);
      body!.append(section);
    };
    addSection();
    for (const row of rows) {
      if (performance.now() - workedAt > 16) {
        await yieldReportWork();
        signal?.throwIfAborted();
        workedAt = performance.now();
      }
      const clone = row.cloneNode(true) as HTMLElement;
      tbody!.append(clone);
      if (fits()) continue;
      clone.remove();
      const emptySection = tbody!.childElementCount === 0;
      if (emptySection) section!.remove();
      // Do not manufacture an empty first page for a row larger than the paper.
      if (body!.childElementCount === 0) {
        if (emptySection) body!.append(section!);
        tbody!.append(clone);
        requireFit();
      } else {
        newPage(); addSection(!emptySection); tbody!.append(clone); requireFit();
      }
    }
  }
  pages.forEach((page, index) => {
    page.style.contentVisibility = 'visible';
    page.dataset.pageNumber = String(index + 1);
    page.querySelector('.report-page-counter')!.textContent = `${index + 1} / ${pages.length}`;
  });
  applySocialFooterPages(pages);
  return pages.length;
  } finally {
    source.style.contentVisibility = sourceVisibility;
  }
}

/** html2canvas 1.x cannot parse Tailwind's oklch colors; resolve them to sRGB in its clone. */
export function normalizePdfColors(root: HTMLElement) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const colors = new Map<string, string>();
  const color = (value: string) => {
    if (!context || !/(oklch|oklab|lab\(|lch\(|color\(|color-mix)/i.test(value)) return value;
    if (colors.has(value)) return colors.get(value)!;
    context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    const resolved = `rgba(${r},${g},${b},${a / 255})`; colors.set(value, resolved); return resolved;
  };
  for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    const style = element.ownerDocument.defaultView!.getComputedStyle(element);
    for (const property of ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color']) {
      element.style.setProperty(property, color(style.getPropertyValue(property)), 'important');
    }
    element.style.setProperty('box-shadow', 'none', 'important');
    element.style.setProperty('text-shadow', 'none', 'important');
  }
}

export async function assetDataUrl(url: string) {
  if (url.startsWith('data:')) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error('report_asset_unavailable');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}

export async function embedReportFonts(root: HTMLElement) {
  const families = new Set([root, ...root.querySelectorAll<HTMLElement>('*')].map(element => getComputedStyle(element).fontFamily));
  const rules: Array<{ css: string; base: string }> = [];
  const collect = (list: CSSRuleList, base: string) => {
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSFontFaceRule && [...families].some(family => family.includes(rule.style.fontFamily.replace(/["']/g, '')))) rules.push({ css: rule.cssText, base });
      else if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules, base);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { collect(sheet.cssRules, sheet.href || document.baseURI); } catch { /* Cross-origin stylesheets cannot expose rules. */ }
  }
  const assets = new Map<string, Promise<string>>();
  return (await Promise.all(rules.map(async ({ css, base }) => {
    const urls = Array.from(css.matchAll(/url\(["']?([^"')]+)["']?\)/g));
    for (const match of urls) {
      const url = new URL(match[1], base).href;
      if (!assets.has(url)) assets.set(url, assetDataUrl(url));
      const data = await assets.get(url)!;
      css = css.replace(match[0], `url("${data}")`);
    }
    return css;
  }))).join('\n');
}

export async function downloadReportPdf(root: HTMLElement, settings: ReportPrintSettings, filename: string, onProgress?: (page: number, total: number) => void) {
  // A settings/context refresh can replace preview sheets during async rasterization.
  // Keep a mounted snapshot for the entire export, including link measurements.
  const snapshot = root.cloneNode(true) as HTMLElement;
  for (const element of [snapshot, ...Array.from(snapshot.querySelectorAll<HTMLElement>('*'))]) {
    element.removeAttribute('id');
    element.removeAttribute('data-testid');
  }
  const inherited = getComputedStyle(root);
  for (const property of ['font-family', 'font-size', 'line-height', 'direction', 'color']) {
    snapshot.style.setProperty(property, inherited.getPropertyValue(property));
  }
  const mount = document.createElement('div');
  mount.setAttribute('aria-hidden', 'true');
  mount.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;width:max-content;';
  mount.append(snapshot);
  document.body.append(mount);
  try { await downloadReportSnapshot(snapshot, settings, filename, onProgress); }
  finally { mount.remove(); }
}

async function downloadReportSnapshot(root: HTMLElement, settings: ReportPrintSettings, filename: string, onProgress?: (page: number, total: number) => void) {
  const pages = Array.from(root.querySelectorAll<HTMLElement>('.report-output-sheet'));
  if (!pages.length) throw new Error('report_not_ready');
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const { width, height } = reportPaperSize(settings);
  const pdf = new jsPDF({ orientation: width > height ? 'landscape' : 'portrait', unit: 'mm', format: [width, height], compress: true });
  const fontCss = await embedReportFonts(root);
  const imageUrls = [...new Set(Array.from(root.querySelectorAll('img'), img => img.currentSrc || img.src))];
  const images = new Map(await Promise.all(imageUrls.map(async url => [url, await assetDataUrl(url)] as const)));
  pdf.setProperties({ title: filename, creator: 'Entix Books' });
  for (let index = 0; index < pages.length; index++) {
    onProgress?.(index + 1, pages.length);
    await yieldReportWork();
    if (index) pdf.addPage([width, height], width > height ? 'landscape' : 'portrait');
    // Render every sheet as the first child of its own mounted snapshot. Removing
    // preceding sheets only inside html2canvas's clone shifts later-page geometry.
    const pageMount = root.cloneNode(false) as HTMLElement;
    pageMount.style.cssText += ';position:fixed;left:-100000px;top:0;pointer-events:none;';
    const renderSheet = pages[index].cloneNode(true) as HTMLElement;
    pageMount.append(renderSheet);
    document.body.append(pageMount);
    let canvas: HTMLCanvasElement;
    try { canvas = await html2canvas(renderSheet, {
      // Exclude unrelated body subtrees before html2canvas clones them, not after.
      ignoreElements: element => document.body.contains(element) && element !== document.body && !element.contains(renderSheet) && !renderSheet.contains(element),
      foreignObjectRendering: true, scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
      onclone: (doc, element) => {
        normalizePdfColors(element);
        for (const img of Array.from(element.querySelectorAll('img'))) {
          img.src = images.get(img.currentSrc || img.src) || images.get(img.src) || img.src;
          img.removeAttribute('srcset');
        }
        // The native SVG renderer preserves Arabic shaping and text baselines.
        // Place the clone at the origin so scroll/RTL offsets never crop a page.
        doc.body.replaceChildren(element);
        doc.body.style.cssText = 'margin:0;padding:0;direction:ltr;';
        element.style.setProperty('margin', '0', 'important');
        const fonts = doc.createElement('style'); fonts.textContent = fontCss; element.prepend(fonts);
      },
    });
    } finally { pageMount.remove(); }
    pdf.addImage(canvas, 'PNG', 0, 0, width, height, undefined, 'FAST');
    // Rasterized text has no PDF annotations. Add the complete anchor rectangle
    // so the icon and label both remain clickable in a downloaded PDF.
    const sheet = pages[index], bounds = sheet.getBoundingClientRect();
    for (const anchor of sheet.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      if (!/^https?:\/\//i.test(anchor.href) || getComputedStyle(anchor).visibility === 'hidden') continue;
      for (const rect of Array.from(anchor.getClientRects())) {
        if (!rect.width || !rect.height || rect.left < bounds.left || rect.right > bounds.right + 1 || rect.top < bounds.top || rect.bottom > bounds.bottom + 1) continue;
        pdf.link((rect.left - bounds.left) / bounds.width * width, (rect.top - bounds.top) / bounds.height * height,
          rect.width / bounds.width * width, rect.height / bounds.height * height, { url: anchor.href });
      }
    }
    canvas.width = canvas.height = 0;
  }
  pdf.save(`${filename.replace(/[\\/:*?"<>|]/g, '-')}.pdf`);
}
