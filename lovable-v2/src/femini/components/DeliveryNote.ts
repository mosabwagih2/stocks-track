import type { Doc, Sku } from '@/femini/domain/types';

/** Shop delivery note (إذن تسليم): fixed A4 layout, header and signatures repeat, items flow over pages. */
type Row = { model: string; color: string; size: string; qty: number };
const rowsOf = (d: Doc, skus: Map<string, Sku>): Row[] =>
  d.lines.map((l) => { const k = skus.get(l.sku); return { model: k?.model ?? l.sku, color: k?.color ?? '', size: k?.size ?? '', qty: l.qty }; })
    .sort((a, b) => a.model.localeCompare(b.model, 'en', { numeric: true }) || a.color.localeCompare(b.color) || a.size.localeCompare(b.size));
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function deliveryNoteHtml(d: Doc, skus: Map<string, Sku>): string {
  const rows = rowsOf(d, skus); const total = rows.reduce((a, r) => a + r.qty, 0);
  const PER = 22; const pages: Row[][] = []; for (let i = 0; i < rows.length; i += PER) pages.push(rows.slice(i, i + PER)); if (!pages.length) pages.push([]);
  const time = d.hdr.at ? new Date(String(d.hdr.at)).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '';
  const page = (rs: Row[], p: number) => `<section class="pg">
  <header><div><div class="brand">Fémini</div><div class="sub">إذن تسليم بضاعة للمحل</div></div>
  <table class="meta"><tr><th>رقم الإذن</th><td>${esc(d.no)}</td></tr><tr><th>المحل</th><td>${esc(d.hdr.shop)}</td></tr><tr><th>التاريخ</th><td>${esc(d.date)} ${esc(time)}</td></tr><tr><th>إجمالي القطع</th><td>${total}</td></tr></table></header>
  ${d.hdr.note ? `<p class="note">ملاحظة: ${esc(d.hdr.note)}</p>` : ''}
  <table class="items"><thead><tr><th>#</th><th>الموديل</th><th>اللون</th><th>المقاس</th><th>الكمية</th></tr></thead><tbody>
  ${rs.map((r, i) => `<tr><td>${p * PER + i + 1}</td><td>${esc(r.model)}</td><td>${esc(r.color)}</td><td>${esc(r.size)}</td><td>${r.qty}</td></tr>`).join('')}
  </tbody>${p === pages.length - 1 ? `<tfoot><tr><td colspan="4">الإجمالي</td><td>${total}</td></tr></tfoot>` : ''}</table>
  <footer><div class="sig"><b>مستلم الاستور</b><span>الاسم والتوقيع</span></div><div class="sig"><b>أمين المخزن</b><span>${esc(d.by)}</span></div><div class="pn">صفحة ${p + 1} من ${pages.length}</div></footer></section>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(d.no)}</title>
<link href="${location.origin}/assets/fonts/fonts.css" rel="stylesheet">
<style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:'IBM Plex Sans Arabic',sans-serif;color:#2a1838;background:#eee;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{width:210mm;height:297mm;margin:0 auto 8mm;background:#fff;padding:16mm 14mm;display:flex;flex-direction:column;page-break-after:always}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5b2a86;padding-bottom:6mm;margin-bottom:6mm}
.brand{font-size:30px;font-weight:700;color:#5b2a86}.sub{font-size:14px;color:#6b5a78}
.meta{border-collapse:collapse;font-size:12px}.meta th{text-align:start;color:#6b5a78;font-weight:600;padding:2px 10px}.meta td{font-weight:700;padding:2px 0}
.note{font-size:12px;background:#f5effa;padding:3mm;border-radius:2mm}
.items{width:100%;border-collapse:collapse;font-size:12.5px}.items th{background:#5b2a86;color:#fff;padding:7px;text-align:start}.items td{border-bottom:1px solid #e6dcef;padding:6px 7px}
.items tbody tr:nth-child(even) td{background:#faf7fc}.items tfoot td{font-weight:700;border-top:2px solid #5b2a86;padding:8px 7px}
footer{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:12mm;padding-top:8mm}.sig{border-top:1px solid #2a1838;padding-top:3mm;display:grid;gap:1mm;font-size:12px}.sig span{color:#6b5a78}
.pn{grid-column:1/-1;text-align:center;font-size:10px;color:#999}@media print{body{background:#fff}.pg{margin:0}}</style></head>
<body>${pages.map(page).join('')}</body></html>`;
}

export function printDeliveryNote(d: Doc, skus: Map<string, Sku>) {
  const w = window.open('', '_blank'); if (!w) return false;
  w.document.write(deliveryNoteHtml(d, skus)); w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
  return true;
}

const timeOf = (d: Doc) => (d.hdr.at ? new Date(String(d.hdr.at)).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '');

export async function deliveryNoteExcel(d: Doc, skus: Map<string, Sku>) {
  const X = await import('xlsx'); const rows = rowsOf(d, skus); const total = rows.reduce((a, r) => a + r.qty, 0);
  const aoa: (string | number)[][] = [
    ['إذن تسليم بضاعة للمحل'], ['رقم الإذن', d.no], ['المحل', String(d.hdr.shop ?? '')], ['التاريخ', [d.date, timeOf(d)].filter(Boolean).join(' ')], ['إجمالي القطع', total], ['أمين المخزن', d.by],
    ...(d.hdr.note ? [['ملاحظة', String(d.hdr.note)]] : []), [],
    ['#', 'الموديل', 'اللون', 'المقاس', 'الكمية'], ...rows.map((r, i) => [i + 1, r.model, r.color, r.size, r.qty]), ['', 'الإجمالي', '', '', total], [],
    ['مستلم الاستور (الاسم والتوقيع)', '', '', 'أمين المخزن', d.by],
  ];
  const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, d.no); wb.Workbook = { Views: [{ RTL: true }] }; X.writeFile(wb, `${d.no}.xlsx`);
}

/**
 * Image / PDF of the note, drawn straight on a canvas with the same A4 layout as the printed page. (html2canvas cut Arabic
 * letters, dropped the spaces between words and stacked the title on its subtitle; the browser's own canvas text shapes
 * Arabic correctly.)
 */
export async function downloadDeliveryNote(d: Doc, skus: Map<string, Sku>, format: 'pdf' | 'png') {
  const FONT = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 16px "IBM Plex Sans Arabic"`).catch(() => []))); await document.fonts.ready;
  const rows = rowsOf(d, skus); const total = rows.reduce((a, r) => a + r.qty, 0);
  const PER = 22; const pages: Row[][] = []; for (let i = 0; i < rows.length; i += PER) pages.push(rows.slice(i, i + PER)); if (!pages.length) pages.push([]);
  const W = 1654, H = 2339, k = W / 210;   // A4 at 200 dpi; k = pixels per mm
  const mm = (v: number) => v * k; const L = mm(14), R = W - mm(14);
  const C = { ink: '#2a1838', muted: '#6b5a78', brand: '#5b2a86', line: '#e6dcef', zebra: '#faf7fc', soft: '#f5effa' };
  const time = timeOf(d);
  const draw = (rs: Row[], p: number) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.direction = 'rtl'; g.textBaseline = 'alphabetic';
    // size in CSS px of the printed page (1px = 0.2646mm)
    const text = (t: string, x: number, y: number, size: number, opt: { w?: number; color?: string; align?: CanvasTextAlign } = {}) => {
      g.font = `${opt.w ?? 400} ${mm(size * 0.2646)}px ${FONT}`; g.fillStyle = opt.color ?? C.ink; g.textAlign = opt.align ?? 'right'; g.fillText(t, x, y);
    };
    // header: brand on the right, the note's details on the left
    let y = mm(16);
    text('Fémini', R, y + mm(9), 30, { w: 700, color: C.brand });
    text('إذن تسليم بضاعة للمحل', R, y + mm(16), 14, { color: C.muted });
    const meta: [string, string][] = [['رقم الإذن', d.no], ['المحل', String(d.hdr.shop ?? '')], ['التاريخ', [d.date, time].filter(Boolean).join(' ')], ['إجمالي القطع', String(total)]];
    meta.forEach(([lbl, val], i) => { const yy = y + mm(4.5) + i * mm(6); text(lbl, L + mm(72), yy, 12, { w: 600, color: C.muted }); text(val, L + mm(48), yy, 12, { w: 700 }); });
    y += mm(28); g.fillStyle = C.brand; g.fillRect(L, y, R - L, mm(0.8)); y += mm(6);
    if (d.hdr.note) { g.fillStyle = C.soft; g.fillRect(L, y, R - L, mm(9)); text(`ملاحظة: ${String(d.hdr.note)}`, R - mm(3), y + mm(6), 12); y += mm(13); }
    // items: columns from the right
    const cols = [{ t: '#', w: 14 }, { t: 'الموديل', w: 46 }, { t: 'اللون', w: 46 }, { t: 'المقاس', w: 36 }, { t: 'الكمية', w: 40 }];
    const xs: number[] = []; let x = R; for (const c of cols) { xs.push(x); x -= mm(c.w); }
    const head = mm(10), rowH = mm(7.6);
    g.fillStyle = C.brand; g.fillRect(L, y, R - L, head); cols.forEach((c, i) => text(c.t, xs[i] - mm(2.5), y + mm(6.8), 12.5, { w: 600, color: '#fff' })); y += head;
    rs.forEach((r, i) => {
      if (i % 2) { g.fillStyle = C.zebra; g.fillRect(L, y, R - L, rowH); }
      [String(p * PER + i + 1), r.model, r.color, r.size, String(r.qty)].forEach((v, j) => text(v, xs[j] - mm(2.5), y + mm(5.3), 12.5));
      y += rowH; g.fillStyle = C.line; g.fillRect(L, y - 1, R - L, 2);
    });
    if (p === pages.length - 1) {
      g.fillStyle = C.brand; g.fillRect(L, y, R - L, mm(0.55));
      text('الإجمالي', xs[0] - mm(2.5), y + mm(6.5), 12.5, { w: 700 }); text(String(total), xs[4] - mm(2.5), y + mm(6.5), 12.5, { w: 700 });
      y += mm(9.5); g.fillStyle = C.line; g.fillRect(L, y - 1, R - L, 2);
    }
    // signatures and page number at the bottom of the page
    const fy = H - mm(16) - mm(22); const half = (R - L - mm(12)) / 2;
    ([[R, 'مستلم الاستور', 'الاسم والتوقيع'], [R - half - mm(12), 'أمين المخزن', d.by]] as [number, string, string][]).forEach(([xr, b, sub]) => {
      g.fillStyle = C.ink; g.fillRect(xr - half, fy, half, 2); text(b, xr, fy + mm(6.5), 12, { w: 700 }); text(sub, xr, fy + mm(12), 12, { color: C.muted });
    });
    text(`صفحة ${p + 1} من ${pages.length}`, W / 2, H - mm(16), 10, { color: '#999', align: 'center' });
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
