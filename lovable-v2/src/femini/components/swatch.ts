/** Colour name -> hex for the dots next to colours. One shared table; colours added with the picker are remembered in this browser. */
const BASE: Record<string, string> = { اسود: '#1e1b24', ابيض: '#ffffff', احمر: '#d9262e', بيج: '#ead9be', رمادي: '#bdbcc4', برتقالي: '#f07a2b', زيتى: '#6f7a3c', فوشيا: '#c2317a', اصفر: '#f2c230', 'مينت جرين': '#8fd3b6', 'بيبي بلو': '#a9cbe8', كحلي: '#1f2a5a', بينك: '#f4b6c8', سيمون: '#f3a28c', روز: '#e58fa8', 'احمر تطعيم اسود': '#a3262c' };
const KEY = 'femini-swatches';
const HEX = /^#[0-9a-f]{6}$/i;

function custom(): Record<string, string> {
  try { const o = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
export const swatchOf = (name: string): string => { const c = custom()[name]; return BASE[name] ?? (c && HEX.test(c) ? c : '#cfc2ec'); };
export function rememberSwatch(name: string, hex: string) {
  if (!name || !HEX.test(hex)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...custom(), [name]: hex })); } catch { /* storage blocked: the dot just stays neutral */ }
}
