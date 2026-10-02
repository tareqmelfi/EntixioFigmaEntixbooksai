import { assetDataUrl, embedReportFonts, normalizePdfColors } from './report-pagination';
import { waitForPrintReady } from './print-image';

/** Snapshot all already-paginated document sheets before async export. */
export async function downloadDocumentPdf(root: HTMLElement, selector: string, filename: string) {
  await waitForPrintReady();
  const documentCss = Array.from(document.querySelectorAll('style'), style => style.textContent || '').join('\n');
  const snapshot = root.cloneNode(true) as HTMLElement;
  snapshot.querySelectorAll('.no-print, .actions').forEach(el => el.remove());
  const mount = document.createElement('div');
  mount.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;width:210mm;';
  mount.append(snapshot); document.body.append(mount);
  try {
    const sheets = Array.from(snapshot.querySelectorAll<HTMLElement>(selector));
    if (!sheets.length) throw Error('document_not_ready');
    const fontCss = await embedReportFonts(snapshot);
    const images = new Map(await Promise.all([...new Set(Array.from(snapshot.querySelectorAll('img'), img => img.src))].map(async src => [src, await assetDataUrl(src)] as const)));
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const pdf = new jsPDF({ unit:'mm', format:'a4', compress:true });
    for (let index=0; index<sheets.length; index++) {
      const pageMount = snapshot.cloneNode(false) as HTMLElement;
      pageMount.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;width:210mm;';
      const sheet = sheets[index].cloneNode(true) as HTMLElement;
      pageMount.append(sheet); document.body.append(pageMount);
      sheet.style.setProperty('width','210mm'); sheet.style.setProperty('margin','0');
      if (sheet.scrollHeight > 1125) throw Error('document_page_overflow');
      let canvas: HTMLCanvasElement;
      try { canvas = await html2canvas(pageMount, { foreignObjectRendering:true, scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false,
        onclone(doc, element) {
          const styles = doc.createElement('style'); styles.textContent = documentCss; doc.head.append(styles);
          normalizePdfColors(element);
          element.style.cssText = 'position:static;width:210mm;height:297mm;margin:0;';
          doc.body.replaceChildren(element); doc.body.style.cssText='margin:0;padding:0;direction:ltr;';
          element.style.setProperty('margin','0','important');
          for (const img of element.querySelectorAll('img')) { img.src=images.get(img.src)||img.src; img.removeAttribute('srcset'); }
          const fonts = doc.createElement('style'); fonts.textContent=fontCss; element.prepend(fonts);
        },
      }); } finally { pageMount.remove(); }
      const pixels = canvas.getContext('2d', { willReadFrequently: true })?.getImageData(0, 0, canvas.width, canvas.height).data;
      let hasInk = false;
      if (pixels) for (let p = 0; p < pixels.length; p += 16) { if (pixels[p] < 180 || pixels[p + 1] < 180 || pixels[p + 2] < 180) { hasInk = true; break; } }
      if (!hasInk) throw Error('document_pdf_empty_page');
      if (index) pdf.addPage();
      pdf.addImage(canvas,'PNG',0,0,210,297,undefined,'FAST');
      canvas.width=canvas.height=0;
    }
    pdf.save(`${filename.replace(/[\\/:*?"<>|]/g,'-')}.pdf`);
  } finally { mount.remove(); }
}
