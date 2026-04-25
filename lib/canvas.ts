let html2canvasModule: typeof import('html2canvas') | null = null;

export async function useReactToHtml2Canvas() {
  if (!html2canvasModule) {
    try {
      html2canvasModule = await import('html2canvas');
    } catch {
      throw new Error('html2canvas not available');
    }
  }
  return html2canvasModule.default;
}

export async function toImageUrl(element: HTMLElement, options?: {
  backgroundColor?: string | null;
  scale?: number;
}): Promise<string> {
  const html2canvas = await useReactToHtml2Canvas();
  const canvas = await html2canvas(element, {
    backgroundColor: options?.backgroundColor ?? null,
    scale: options?.scale ?? 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
  });
  return canvas.toDataURL('image/png');
}

export async function toBlob(element: HTMLElement): Promise<Blob | null> {
  const html2canvas = await useReactToHtml2Canvas();
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
  });
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}