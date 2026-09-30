/** Rasterize the selected company logo for Excel, preserving aspect ratio and transparency. */
export function workbookLogo(url: string): Promise<{ base64: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => { image.src = ''; reject(new Error('REPORT_LOGO_TIMEOUT')); }, 6000);
    const fail = () => { clearTimeout(timer); reject(new Error('REPORT_LOGO_UNAVAILABLE')); };
    image.crossOrigin = 'anonymous';
    image.onerror = fail;
    image.onload = () => {
      clearTimeout(timer);
      try {
        if (!image.naturalWidth || !image.naturalHeight) return fail();
        const scale = Math.min(120 / image.naturalWidth, 48 / image.naturalHeight);
        const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width * 3); canvas.height = Math.ceil(height * 3);
        const context = canvas.getContext('2d'); if (!context) return fail();
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ base64: canvas.toDataURL('image/png'), width, height });
      } catch { fail(); }
    };
    image.src = url;
  });
}
