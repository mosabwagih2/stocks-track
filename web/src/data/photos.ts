/** Photos for the in-browser demo, kept in IndexedDB so they survive a reload. */
let dbp: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((res) => {
    try {
      const r = indexedDB.open('femini-web', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos');
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
const mem = new Map<string, Blob>();
export async function putPhoto(path: string, blob: Blob): Promise<void> {
  mem.set(path, blob);
  const db = await open(); if (!db) return;
  await new Promise<void>((res) => { try { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').put(blob, path); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch { res(); } });
}
export async function getPhoto(path: string): Promise<Blob | null> {
  if (mem.has(path)) return mem.get(path)!;
  const db = await open(); if (!db) return null;
  return new Promise((res) => { try { const rq = db.transaction('photos').objectStore('photos').get(path); rq.onsuccess = () => res((rq.result as Blob) ?? null); rq.onerror = () => res(null); } catch { res(null); } });
}
export async function clearPhotos(): Promise<void> {
  mem.clear(); const db = await open(); if (!db) return;
  await new Promise<void>((res) => { try { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').clear(); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch { res(); } });
}
/** Shrinks a phone photo to a web-friendly JPEG before storing/uploading. */
export async function shrinkImage(file: File, max = 1400): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.78));
  } catch { return file; }
}
