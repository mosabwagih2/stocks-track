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
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
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

export function downloadDeliveryNoteHtml(d: Doc, skus: Map<string, Sku>) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([deliveryNoteHtml(d, skus)], { type: 'text/html' })); a.download = `${d.no}.html`; a.click();
}

export async function deliveryNoteExcel(d: Doc, skus: Map<string, Sku>) {
  const X = await import('xlsx'); const rows = rowsOf(d, skus);
  const aoa: (string | number)[][] = [['إذن تسليم للمحل', d.no], ['المحل', String(d.hdr.shop ?? '')], ['التاريخ', d.date], ['أمين المخزن', d.by], [], ['الموديل', 'اللون', 'المقاس', 'الكمية'], ...rows.map((r) => [r.model, r.color, r.size, r.qty]), ['الإجمالي', '', '', rows.reduce((a, r) => a + r.qty, 0)]];
  const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 10 }];
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, d.no); wb.Workbook = { Views: [{ RTL: true }] }; X.writeFile(wb, `${d.no}.xlsx`);
}
export async function downloadDeliveryNote(d: Doc, skus: Map<string, Sku>, format: 'pdf' | 'png') {
  const frame = document.createElement('iframe'); frame.style.position='fixed'; frame.style.left='-10000px'; frame.style.width='800px'; frame.style.height='1200px'; document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument; if (!doc) throw new Error('تعذر تجهيز إذن التسليم'); doc.open(); doc.write(deliveryNoteHtml(d,skus)); doc.close();
    await doc.fonts.ready;
    const { default: capture }=await import('html2canvas'); const { jsPDF }=await import('jspdf'); const pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    const pages = Array.from(doc.querySelectorAll<HTMLElement>('.pg'));
    for (let i=0;i<pages.length;i++) { const pg=pages[i]; if(!pg)continue; const canvas=await capture(pg,{scale:2,useCORS:true}); const data=canvas.toDataURL('image/png'); if(format==='pdf') {if(i)pdf.addPage();pdf.addImage(data,'PNG',0,0,210,297);} else {const a=document.createElement('a');a.href=data;a.download=`${d.no}-${i+1}.png`;a.click();} }
    if(format==='pdf')pdf.save(`${d.no}.pdf`);
  } finally { frame.remove(); }
}
