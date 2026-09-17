import type { ReportPrintSettings } from './api';

export function reportPaperSize(settings: ReportPrintSettings) {
  const portrait = settings.paper === 'Letter' ? [215.9, 279.4] : [210, 297];
  const [width, height] = settings.orientation === 'landscape' ? [...portrait].reverse() : portrait;
  return { width, height };
}

/** Build physical sheets from rendered rows, never slice a tall screenshot through text. */
export function paginateReport(source: HTMLElement, target: HTMLElement, settings: ReportPrintSettings) {
  const { width, height } = reportPaperSize(settings);
  target.replaceChildren();
  const originalMain = source.querySelector(':scope > main') as HTMLElement | null;
  if (!originalMain) throw new Error('report_content_missing');
  const footer = source.querySelector(':scope > footer');
  const pages: HTMLElement[] = [];
  let body: HTMLElement;
  const newPage = () => {
    const sheet = source.cloneNode(false) as HTMLElement;
    sheet.classList.add('report-output-sheet');
    sheet.style.width = `${width}mm`;
    sheet.style.height = `${height}mm`;
    sheet.style.minHeight = '0';
    for (const child of Array.from(source.children)) {
      if (child === originalMain || child === footer) continue;
      sheet.append(child.cloneNode(true));
    }
    body = originalMain.cloneNode(false) as HTMLElement;
    body.classList.add('report-page-body');
    sheet.append(body);
    const pageFooter = document.createElement('div');
    pageFooter.className = 'report-page-footer';
    if (footer) pageFooter.append(footer.cloneNode(true));
    const counter = document.createElement('div');
    counter.className = 'report-page-counter';
    counter.textContent = '1 / 1'; // Reserve counter height before measuring the body.
    pageFooter.append(counter);
    sheet.append(pageFooter);
    target.append(sheet);
    pages.push(sheet);
  };
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  const requireFit = () => { if (!fits()) throw new Error('report_row_too_tall'); };
  newPage();

  for (const block of Array.from(originalMain.children)) {
    const originalTable = block.querySelector(':scope > table');
    if (!originalTable) {
      const clone = block.cloneNode(true) as HTMLElement;
      const hadContent = body!.childElementCount > 0;
      body!.append(clone);
      if (!fits() && hadContent) { clone.remove(); newPage(); body!.append(clone); }
      requireFit();
      continue;
    }
    const rows = Array.from(originalTable.querySelectorAll('tbody > tr'));
    let section: HTMLElement;
    let tbody: HTMLElement;
    const addSection = () => {
      section = block.cloneNode(false) as HTMLElement;
      for (const child of Array.from(block.children)) {
        if (child === originalTable) continue;
        section.append(child.cloneNode(true));
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
        newPage(); addSection(); tbody!.append(clone); requireFit();
      }
    }
  }
  pages.forEach((page, index) => {
    page.dataset.pageNumber = String(index + 1);
    page.querySelector('.report-page-counter')!.textContent = `${index + 1} / ${pages.length}`;
  });
  return pages.length;
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

async function assetDataUrl(url: string) {
  if (url.startsWith('data:')) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error('report_asset_unavailable');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}

async function embedReportFonts(root: HTMLElement) {
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
  return (await Promise.all(rules.map(async ({ css, base }) => {
    const urls = Array.from(css.matchAll(/url\(["']?([^"')]+)["']?\)/g));
    for (const match of urls) {
      const data = await assetDataUrl(new URL(match[1], base).href);
      css = css.replace(match[0], `url("${data}")`);
    }
    return css;
  }))).join('\n');
}

export async function downloadReportPdf(root: HTMLElement, settings: ReportPrintSettings, filename: string) {
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
    if (index) pdf.addPage([width, height], width > height ? 'landscape' : 'portrait');
    const canvas = await html2canvas(pages[index], {
      ignoreElements: element => element.classList.contains('report-measure-source') || (element.classList.contains('report-output-sheet') && element !== pages[index]),
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
    pdf.addImage(canvas, 'PNG', 0, 0, width, height, undefined, 'FAST');
    canvas.width = canvas.height = 0;
  }
  pdf.save(`${filename.replace(/[\\/:*?"<>|]/g, '-')}.pdf`);
}
