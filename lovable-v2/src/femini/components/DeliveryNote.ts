import type { Doc, Model, Sku } from '@/femini/domain/types';
import { FEMINI_LOGO } from './logo';

/**
 * The shop notes, in the original Fémini design: the logo, the title in the middle, the number with its date and time,
 * the من / إلى / أعدّه boxes, the items table (with the model's description) and the two signatures. Header and
 * signatures repeat on every A4 page, items flow over pages.
 *  - SHP: «إذن تسليم بضاعة» (warehouse → shop)
 *  - SRT: «إذن استلام مرتجع» (shop → warehouse), with the state each piece came back in.
 */
type Row = { model: string; desc: string; color: string; size: string; state: string; qty: number };
const STATE_AR: Record<string, string> = { READY: 'سليم', DIRTY: 'نضافة', SCRAP: 'هالك' };
const isReturn = (d: Doc) => d.type === 'SRT';
const titleOf = (d: Doc) => (isReturn(d) ? 'إذن استلام مرتجع' : 'إذن تسليم بضاعة');
const sizeRank = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL'];
const bySize = (a: string, b: string) => { const x = sizeRank.indexOf(a), y = sizeRank.indexOf(b); return x >= 0 && y >= 0 ? x - y : a.localeCompare(b, 'en', { numeric: true }); };

function rowsOf(d: Doc, skus: Map<string, Sku>, models?: Map<string, Model>): Row[] {
  const src = isReturn(d) && Array.isArray(d.hdr.moves) ? (d.hdr.moves as { sku: string; qty: number; to: string }[]).map((m) => ({ sku: m.sku, qty: m.qty, state: m.to })) : d.lines.map((l) => ({ sku: l.sku, qty: l.qty, state: '' }));
  const acc = new Map<string, Row>();
  for (const l of src) {
    const k = skus.get(l.sku); const key = `${l.sku}|${l.state}`; const cur = acc.get(key);
    if (cur) { cur.qty += l.qty; continue; }
    acc.set(key, { model: k?.model ?? l.sku, desc: models?.get(k?.model ?? '')?.name ?? '', color: k?.color ?? '', size: k?.size ?? '', state: STATE_AR[l.state] ?? '', qty: l.qty });
  }
  return [...acc.values()].filter((r) => r.qty > 0)
    .sort((a, b) => a.model.localeCompare(b.model, 'en', { numeric: true }) || a.color.localeCompare(b.color) || bySize(a.size, b.size) || a.state.localeCompare(b.state));
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const timeOf = (d: Doc) => (d.hdr.at ? new Date(String(d.hdr.at)).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '');
const parties = (d: Doc): [string, string][] => {
  const shop = String(d.hdr.shop ?? '') || '—';
  return isReturn(d) ? [['من', shop], ['إلى', 'مخزن Fémini'], ['استلمه', d.by]] : [['من', 'مخزن Fémini'], ['إلى', shop], ['أعدّه', d.by]];
};
const signs = (d: Doc): [string, string] => (isReturn(d) ? ['توقيع مندوب المحل', 'توقيع أمين المخزن (المستلم)'] : ['توقيع مستلم الاستور', 'توقيع أمين المخزن']);
/** pages of rows: full pages hold 22, the last one 18 (it also carries the total and the note) */
function paginate<T>(rows: T[]): T[][] {
  const FULL = 22, LAST = 18; const out: T[][] = []; let r = rows.slice();
  if (!r.length) return [[]];
  while (r.length > LAST) { let take = Math.min(FULL, r.length); if (r.length <= FULL) take = r.length - 4; out.push(r.slice(0, take)); r = r.slice(take); }
  out.push(r); return out;
}
/** the columns, right to left, with their widths in mm (190 mm in all) */
const columns = (ret: boolean) => ret
  ? [{ t: 'م', w: 9 }, { t: 'الموديل', w: 24 }, { t: 'الوصف', w: 44 }, { t: 'اللون', w: 32 }, { t: 'المقاس', w: 24 }, { t: 'الحالة', w: 26 }, { t: 'الكمية', w: 31, c: true }]
  : [{ t: 'م', w: 9 }, { t: 'الموديل', w: 24 }, { t: 'الوصف', w: 54 }, { t: 'اللون', w: 40 }, { t: 'المقاس', w: 30 }, { t: 'الكمية', w: 33, c: true }];
const cells = (r: Row, n: number, ret: boolean) => (ret ? [String(n), r.model, r.desc, r.color, r.size, r.state, String(r.qty)] : [String(n), r.model, r.desc, r.color, r.size, String(r.qty)]);

export function deliveryNoteHtml(d: Doc, skus: Map<string, Sku>, models?: Map<string, Model>): string {
  const rows = rowsOf(d, skus, models); const total = rows.reduce((a, r) => a + r.qty, 0); const pages = paginate(rows); const ret = isReturn(d); const cols = columns(ret);
  const [s1, s2] = signs(d); let n = 0;
  const head = `<header><div class="br"><img src="${FEMINI_LOGO}" alt="Fémini"></div><div class="tt"><h1>${titleOf(d)}</h1></div><div class="no"><b>${esc(d.no)}</b><small>${esc(d.date)}${timeOf(d) ? ' · ' + esc(timeOf(d)) : ''}</small></div></header>`
    + `<div class="meta">${parties(d).map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>`;
  const sheets = pages.map((pr, pi) => {
    const last = pi === pages.length - 1;
    const tr = pr.map((r) => { n++; return `<tr>${cells(r, n, ret).map((v, j) => `<td class="${j === 1 ? 'm' : ''}${cols[j].c ? ' n' : ''}">${j === cells(r, n, ret).length - 1 ? `<b>${esc(v)}</b>` : esc(v)}</td>`).join('')}</tr>`; }).join('');
    return `<section class="sheet">${head}<div class="mid"><table><colgroup>${cols.map((c) => `<col style="width:${c.w}mm">`).join('')}</colgroup><thead><tr>${cols.map((c) => `<th${c.c ? ' class="n"' : ''}>${c.t}</th>`).join('')}</tr></thead><tbody>${tr}</tbody>`
      + (last ? `<tfoot><tr><td colspan="${cols.length - 1}">الإجمالي · ${rows.length} صنف</td><td class="n"><b>${total}</b></td></tr></tfoot>` : '') + '</table>'
      + (last ? (d.hdr.note ? `<p class="nt"><b>ملاحظات:</b> ${esc(d.hdr.note)}</p>` : '') + '<p class="rv">راجع الكميات قبل التوقيع على الاستلام.</p>' : '<p class="rv">يتبع في الصفحة التالية ←</p>') + '</div>'
      + `<div class="sg"><div><small>${s1}</small></div><div><small>${s2}</small></div></div><div class="pn">صفحة ${pi + 1} من ${pages.length}</div></section>`;
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${titleOf(d)} ${esc(d.no)}</title>
<link href="${location.origin}/assets/fonts/fonts.css" rel="stylesheet">
<style>*{box-sizing:border-box}html,body{margin:0}body{color:#1f1738;font:13px/1.5 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}
header{position:absolute;top:9mm;left:10mm;right:10mm;height:24mm;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:2px solid #43316f}.br img{height:20mm;width:auto;display:block}.tt{text-align:center}.tt h1{margin:0;font-size:20px}.no{text-align:left}.no b{font:600 16px monospace;display:block;direction:ltr}.no small{color:#655e80}
.meta{position:absolute;top:36mm;left:10mm;right:10mm;height:14mm;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.meta div{border:1px solid #d3cbe6;border-radius:8px;padding:2px 10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.meta small{display:block;color:#655e80;font-size:10.5px;line-height:1.3}.meta b{line-height:1.3}
.mid{position:absolute;top:54mm;left:10mm;right:10mm;bottom:50mm}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #d3cbe6;padding:0 8px;text-align:right;height:7.4mm;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px}th{background:#f3f0f9;font-size:12px;height:8mm}.n{text-align:center}.m{font-family:monospace;font-weight:600}tfoot td{background:#f3f0f9;font-weight:600;height:8mm}
.nt{margin:8px 0 0}.rv{color:#655e80;font-size:12px;margin:8px 0 0}
.sg{position:absolute;left:10mm;right:10mm;bottom:14mm;height:30mm;display:grid;grid-template-columns:1fr 1fr;gap:40px}.sg>div{border-bottom:1px solid #1f1738;padding-top:2px}.sg small{display:block;color:#655e80;font-size:11px}
.pn{position:absolute;left:0;right:0;bottom:6mm;text-align:center;color:#a59cc0;font-size:10.5px}
@page{size:A4;margin:0}@media screen{body{background:#e9e6f0;padding:12px 0}.sheet{margin:0 auto 14px;box-shadow:0 2px 10px rgba(31,23,56,.18)}}@media print{body{background:#fff;padding:0}.sheet{margin:0;box-shadow:none}}</style></head>
<body>${sheets}</body></html>`;
}

export function printDeliveryNote(d: Doc, skus: Map<string, Sku>, models?: Map<string, Model>) {
  const w = window.open('', '_blank'); if (!w) return false;
  w.document.write(deliveryNoteHtml(d, skus, models)); w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
  return true;
}

export async function deliveryNoteExcel(d: Doc, skus: Map<string, Sku>, models?: Map<string, Model>) {
  const X = await import('xlsx'); const rows = rowsOf(d, skus, models); const total = rows.reduce((a, r) => a + r.qty, 0); const ret = isReturn(d);
  const [[l1, v1], [l2, v2], [l3, v3]] = parties(d);
  const aoa: (string | number)[][] = [
    [`${titleOf(d)} · Fémini`], ['الرقم', d.no, 'التاريخ', d.date, 'الوقت', timeOf(d)], [l1, v1, l2, v2, l3, v3], [],
    columns(ret).map((c) => c.t),
    ...rows.map((r, i) => cells(r, i + 1, ret).map((v, j, a) => (j === 0 || j === a.length - 1 ? Number(v) : v))),
    [...Array(columns(ret).length - 2).fill(''), 'إجمالي القطع', total],
    ...(d.hdr.note ? [[], ['ملاحظات', String(d.hdr.note)]] : []),
    [], [signs(d)[0], '', '', signs(d)[1]],
  ];
  const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = columns(ret).map((c) => ({ wch: Math.max(8, Math.round(c.w / 2.2)) }));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns(ret).length - 1 } }];
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, d.no); wb.Workbook = { Views: [{ RTL: true }] }; X.writeFile(wb, `${d.no}.xlsx`);
}

/**
 * Image / PDF of the note, drawn straight on a canvas in the same A4 layout as the printed page. (html2canvas cut Arabic
 * letters and dropped the spaces between words; the browser's own canvas text shapes Arabic correctly.)
 */
export async function downloadDeliveryNote(d: Doc, skus: Map<string, Sku>, format: 'pdf' | 'png', models?: Map<string, Model>) {
  const FONT = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 16px "IBM Plex Sans Arabic"`).catch(() => []))); await document.fonts.ready;
  const logo = await new Promise<HTMLImageElement | null>((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = FEMINI_LOGO; });
  const rows = rowsOf(d, skus, models); const total = rows.reduce((a, r) => a + r.qty, 0); const pages = paginate(rows); const ret = isReturn(d); const cols = columns(ret);
  const W = 1654, H = 2339, k = W / 210;   // A4 at 200 dpi; k = pixels per mm
  const mm = (v: number) => v * k; const px = (v: number) => mm(v * 0.2646);   // CSS px of the printed page → canvas px
  const L = mm(10), R = W - mm(10);
  const C = { ink: '#1f1738', muted: '#655e80', brand: '#43316f', line: '#d3cbe6', head: '#f3f0f9', pn: '#a59cc0' };
  const [s1, s2] = signs(d); let n = 0;
  const draw = (pr: Row[], pi: number) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.direction = 'rtl'; g.textBaseline = 'middle';
    const text = (t: string, x: number, y: number, size: number, opt: { w?: number; color?: string; align?: CanvasTextAlign; mono?: boolean; max?: number } = {}) => {
      g.font = `${opt.w ?? 400} ${px(size)}px ${opt.mono ? 'monospace' : FONT}`; g.fillStyle = opt.color ?? C.ink; g.textAlign = opt.align ?? 'right';
      let s = t; if (opt.max) while (s.length > 1 && g.measureText(s).width > opt.max) s = s.slice(0, -2) + '…';
      g.fillText(s, x, y);
    };
    const box = (x: number, y: number, w: number, h: number, r: number, fill?: string) => {
      g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } g.strokeStyle = C.line; g.lineWidth = 2; g.stroke();
    };
    // header: logo on the right, title in the middle, number and time on the left, a rule under it
    const hy = mm(9), hh = mm(24);
    if (logo) { const lh = mm(20); const lw = (logo.width / logo.height) * lh; g.drawImage(logo, R - lw, hy + (hh - lh) / 2, lw, lh); }
    text(titleOf(d), W / 2, hy + hh / 2, 20, { w: 700, align: 'center' });
    g.direction = 'ltr'; text(d.no, L, hy + hh / 2 - mm(2.5), 16, { w: 600, mono: true, align: 'left' }); g.direction = 'rtl';
    text(`${d.date}${timeOf(d) ? ' · ' + timeOf(d) : ''}`, L, hy + hh / 2 + mm(3.5), 13, { color: C.muted, align: 'left' });
    g.fillStyle = C.brand; g.fillRect(L, hy + hh - mm(0.53), R - L, mm(0.53));
    // من / إلى / أعدّه
    const gap = px(8), bw = (R - L - 2 * gap) / 3, my = mm(36), bh = mm(14);
    parties(d).forEach(([lbl, val], i) => { const xr = R - i * (bw + gap); box(xr - bw, my, bw, bh, px(8)); text(lbl, xr - px(10), my + mm(4.2), 10.5, { color: C.muted }); text(val, xr - px(10), my + mm(9.6), 13, { w: 700, max: bw - px(20) }); });
    // the table, columns from the right
    const xs: number[] = []; let x = R; for (const c of cols) { xs.push(x); x -= mm(c.w); }
    const cell = (j: number, y: number, h: number, t: string, o: { w?: number; mono?: boolean } = {}) => {
      const c = cols[j]; const w = mm(c.w);
      g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(xs[j] - w, y, w, h);
      text(t, c.c ? xs[j] - w / 2 : xs[j] - px(8), y + h / 2, 12.5, { ...o, align: c.c ? 'center' : 'right', max: w - px(14) });
    };
    let y = mm(54); const th = mm(8), rh = mm(7.4);
    g.fillStyle = C.head; g.fillRect(L, y, R - L, th); cols.forEach((c, j) => cell(j, y, th, c.t, { w: 600 })); y += th;
    for (const r of pr) { n++; cells(r, n, ret).forEach((v, j, a) => cell(j, y, rh, v, { mono: j === 1, w: j === 1 || j === a.length - 1 ? 600 : 400 })); y += rh; }
    const last = pi === pages.length - 1;
    if (last) {
      g.fillStyle = C.head; g.fillRect(L, y, R - L, th);
      const lw = cols.slice(0, -1).reduce((a, c) => a + mm(c.w), 0);
      g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(R - lw, y, lw, th); text(`الإجمالي · ${rows.length} صنف`, R - px(8), y + th / 2, 12.5, { w: 600 });
      cell(cols.length - 1, y, th, String(total), { w: 700 }); y += th;
      if (d.hdr.note) { y += px(8) + mm(3); text(`ملاحظات: ${String(d.hdr.note)}`, R, y, 13, { max: R - L }); }
      y += px(8) + mm(3); text('راجع الكميات قبل التوقيع على الاستلام.', R, y, 12, { color: C.muted });
    } else { y += px(8) + mm(3); text('يتبع في الصفحة التالية ←', R, y, 12, { color: C.muted }); }
    // signatures and page number
    const sgTop = H - mm(14) - mm(30), sgw = (R - L - px(40)) / 2;
    [s1, s2].forEach((s, i) => { const xr = R - i * (sgw + px(40)); text(s, xr, sgTop + mm(2.5), 11, { color: C.muted }); g.fillStyle = C.ink; g.fillRect(xr - sgw, sgTop + mm(30) - 2, sgw, 2); });
    text(`صفحة ${pi + 1} من ${pages.length}`, W / 2, H - mm(7.5), 10.5, { color: C.pn, align: 'center' });
    return cv;
  };
  const canvases = pages.map(draw);
  if (format === 'png') {
    canvases.forEach((cv, i) => { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = canvases.length > 1 ? `${d.no}-${i + 1}.png` : `${d.no}.png`; a.click(); });
    return;
  }
  const { jsPDF } = await import('jspdf'); const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  canvases.forEach((cv, i) => { if (i) pdf.addPage(); pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297); });
  pdf.save(`${d.no}.pdf`);
}
