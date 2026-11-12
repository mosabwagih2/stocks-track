export interface Backup { app: 'femini-stock-dashboard'; version: 1; at: string; state: Record<string, unknown>; media: Record<string, string> }
export function validateBackup(value: unknown): Backup {
  if (!value || typeof value !== 'object') throw new Error('الملف ليس نسخة احتياطية صالحة.');
  const b = value as Partial<Backup>;
  if ((value as { app?: string }).app === 'femini-stock') throw new Error('هذه نسخة Brand 2؛ افتحها من معاينة الاستيراد لتحويلها بأمان.');
  if (b.app !== 'femini-stock-dashboard' || b.version !== 1 || !b.state || b.state.v !== 2 || !b.media || typeof b.media !== 'object') throw new Error('صيغة النسخة أو إصدارها غير مدعوم.');
  for (const key of ['moves', 'orders', 'docs', 'pickups', 'supplies', 'log']) if (!Array.isArray(b.state[key])) throw new Error(`بيانات النسخة غير مكتملة: ${key}`);
  const cat = b.state.cat as Record<string, unknown> | undefined;
  if (!cat || !Array.isArray(cat.skus) || !Array.isArray(cat.models) || !cat.archived || !cat.names || !Array.isArray(cat.colors) || !Array.isArray(cat.sizes) || !b.state.images || !b.state.seq) throw new Error('كتالوج النسخة غير مكتمل.');
  const locs = ['READY', 'DIRTY', 'FACTORY', 'SCRAP', 'LOST', 'EXT_OPEN', 'EXT_FACTORY', 'EXT_CH', 'EXT_SHOP', 'EXT_ADJ', 'EXT_OFF', 'EXT_HOLD', 'EXT_COMP'];
  for (const m of b.state.moves as Record<string, unknown>[]) if (!m || !Number.isSafeInteger(m.id) || Number(m.id) < 1 || typeof m.sku !== 'string' || !m.sku || typeof m.qty !== 'number' || !Number.isInteger(m.qty) || m.qty < 0 || !locs.includes(String(m.from)) || !locs.includes(String(m.to)) || typeof m.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !Number.isFinite(Date.parse(m.date)) || typeof m.ts !== 'string' || !Number.isFinite(Date.parse(m.ts)) || typeof m.doc !== 'string' || typeof m.type !== 'string') throw new Error('توجد حركة مخزون غير صالحة في النسخة.');
  if (new Set((b.state.moves as { id: number }[]).map((m) => m.id)).size !== (b.state.moves as unknown[]).length) throw new Error('أرقام حركات المخزون مكررة.');
  for (const o of b.state.orders as Record<string, unknown>[]) if (!o || typeof o.ref !== 'string' || !Array.isArray(o.lines) || !Array.isArray(o.unmapped) || !['open', 'shipped', 'cancelled'].includes(String(o.status))) throw new Error('توجد بيانات أوردر غير صالحة.');
  for (const [path, data] of Object.entries(b.media)) if (!path || typeof data !== 'string' || !data.startsWith('data:')) throw new Error('ملفات النسخة غير صالحة.');
  return b as Backup;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}