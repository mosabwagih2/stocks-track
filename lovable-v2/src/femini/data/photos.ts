/** Photos for the in-browser demo, kept in IndexedDB so they survive a reload. */
let dbp: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((res) => {
    try {
      const r = indexedDB.open('femini-web', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('photos')) r.result.createObjectStore('photos'); };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
const mem = new Map<string, Blob>();
export async function putPhoto(path: string, blob: Blob): Promise<void> {
  const db = await open(); if (!db) throw new Error('تعذر فتح مخزن الملفات؛ لم يتم تأكيد الحفظ.');
  await new Promise<void>((res, rej) => { try { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').put(blob, path); tx.oncomplete = () => res(); tx.onerror = () => rej(new Error('تعذر حفظ الملف؛ تحقق من مساحة المتصفح.')); tx.onabort = () => rej(new Error('توقف حفظ الملف.')); } catch (e) { rej(e); } });
  mem.set(path, blob);
}
export async function getPhoto(path: string): Promise<Blob | null> {
  const cached = mem.get(path); if (cached) return cached;
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
    const x = c.getContext('2d'); if (!x) return file; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.78));
  } catch { return file; }
}
export async function exportMedia(): Promise<Record<string, string>> {
  const db = await open(); if (!db) throw new Error('تعذر قراءة الملفات للنسخة الاحتياطية.');
  const rows = await new Promise<{ key: string; blob: Blob }[]>((res, rej) => {
    const result: { key: string; blob: Blob }[] = []; const r = db.transaction('photos').objectStore('photos').openCursor();
    r.onsuccess = () => { const c = r.result; if (!c) { res(result); return; } result.push({ key: String(c.key), blob: c.value }); c.continue(); }; r.onerror = () => rej(new Error('تعذر قراءة الملفات.'));
  });
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('تعذر قراءة ملف.')); r.readAsDataURL(row.blob); });
  return out;
}
export async function replaceMedia(media: Record<string, string>): Promise<void> {
  const rows = await Promise.all(Object.entries(media).map(async ([key,data])=>({key,blob:await (await fetch(data)).blob()})));
  const db=await open();if(!db)throw new Error('تعذر فتح مخزن الملفات للاسترجاع.');
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('photos','readwrite');const store=tx.objectStore('photos');store.clear();for(const row of rows)store.put(row.blob,row.key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('فشل استرجاع الملفات؛ لم تتغير الملفات المحفوظة.'));tx.onabort=()=>reject(new Error('توقف استرجاع الملفات.'));});
  mem.clear();for(const row of rows)mem.set(row.key,row.blob);
}
