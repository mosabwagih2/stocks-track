/**
 * What a person types in a date box: day-month-year with "-", "/" or "." between the parts, Latin or Arabic-Indic digits
 * ("03-11-2026", "3/11/2026", "٠٣-١١-٢٠٢٦"). Gives back the yyyy-mm-dd of a day that really exists, or null. Pure.
 */
const INDIC = /[٠-٩۰-۹]/g;
export const latinDigits = (t: string): string => t.replace(INDIC, (c) => String(c.charCodeAt(0) - (c.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)));
export function parseDmy(text: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(latinDigits(text).trim()); if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d)); if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** yyyy-mm-dd → dd-mm-yyyy as plain text for a box (no direction marks); anything else comes back empty */
export const toDmyText = (iso: string): string => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
