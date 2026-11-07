async function decode(file: File): Promise<{ width: number; height: number } & CanvasImageSource> {
  try { return await createImageBitmap(file); } catch { /* some formats only decode through <img> */ }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('الملف ليس صورة صالحة')); i.src = url; });
  } finally { URL.revokeObjectURL(url); }
}

/** Any photo -> square JPEG (600x600). The whole product stays visible; padding takes the color of the image corner. */
export async function squareImage(file: File, size = 600): Promise<Blob> {
  const bmp = await decode(file);
  const bw = (bmp as { width: number }).width, bh = (bmp as { height: number }).height;
  const k = Math.min(size / bw, size / bh), w = Math.round(bw * k), h = Math.round(bh * k);
  const probe = document.createElement('canvas'); probe.width = probe.height = 1;
  const px = probe.getContext('2d')!; px.drawImage(bmp, 0, 0, 1, 1, 0, 0, 1, 1); const [r, g, b] = px.getImageData(0, 0, 1, 1).data;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d')!; x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, size, size); x.drawImage(bmp, (size - w) / 2, (size - h) / 2, w, h);
  return new Promise((res, rej) => c.toBlob((bl) => (bl ? res(bl) : rej(new Error('encode'))), 'image/jpeg', 0.82));
}
export const blobToDataUrl = (b: Blob): Promise<string> => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
