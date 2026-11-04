// Shop supplies: no photo needed, saved with day and time, delivery note export, delivered tracking, shop page; stock state filter.
const {chromium,devices}=require('playwright');const fs=require('fs');
const app=process.env.APP||'apps/edition-3-brand-v2/index.html';let pass=0,fail=0;
const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+String(x).slice(0,500)))};
(async()=>{
  const wrap='/tmp/_e3_shop_wrap.html';fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  const b=await chromium.launch();const c=await b.newContext({viewport:{width:1280,height:900},acceptDownloads:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/html2canvas*',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('/tmp/html2canvas.min.js')}));await p.route('**/jspdf*',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('/tmp/jspdf.umd.min.js')}));
  await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(500);
  // ---- stock state filter
  const f1=await p.evaluate(()=>{const F=__F;F.UI.s.view='list';F.UI.s.state='LOST';F.UI.s.q='';F.go('stock');const rows=[...document.querySelectorAll('.stkl .mrow')].map(r=>r.dataset.m);const want=F.D.models.map(m=>m.code).filter(m=>F.D.skus.some(k=>k.m===m&&F.g(k.id,'LOST')>0));return {rows:rows.sort().join(),want:want.sort().join(),n:rows.length}});
  ok('choosing "مفقود" lists only the models that have lost pieces',f1.n>0&&f1.rows===f1.want,JSON.stringify(f1));
  const f2=await p.evaluate(()=>{const F=__F;F.UI.s.state='FACTORY';F.go('stock');const rows=[...document.querySelectorAll('.stkl .mrow')].map(r=>r.dataset.m);const want=F.D.models.map(m=>m.code).filter(m=>F.D.skus.some(k=>k.m===m&&F.g(k.id,'FACTORY')>0));return {n:rows.length,same:rows.sort().join()===want.sort().join()}});
  ok('the same for "عند المصنع"',f2.n>0&&f2.same,JSON.stringify(f2));
  const f3=await p.evaluate(()=>{const F=__F;F.UI.s.state='SCRAP';F.UI.s.view='all';F.go('stock');const cards=document.querySelectorAll('.mxgrid>.card').length;const want=F.D.models.filter(m=>F.D.skus.some(k=>k.m===m.code&&F.g(k.id,'SCRAP')>0)).length;F.UI.s.view='table';F.go('stock');const rows=document.querySelectorAll('#main table.t-sm tbody tr').length;const wantRows=F.D.skus.filter(k=>F.g(k.id,'SCRAP')>0).length;return {cards,want,rows,wantRows}});
  ok('and in the matrices and all-items views (only pieces in that state)',f3.cards===f3.want&&f3.rows===f3.wantRows,JSON.stringify(f3));
  ok('an empty state says so',await p.evaluate(()=>{const F=__F;F.D.skus.forEach(k=>0);F.UI.s.view='list';F.UI.s.state='SCRAP';const S=F.S();const keep=S.moves.length;S.moves=S.moves.filter(m=>m.to!=='SCRAP'&&m.from!=='SCRAP');F.dirty();F.go('stock');const t=document.getElementById('main').innerText;return /مفيش قطع في هالك نهائي/.test(t)}));
  await p.evaluate(()=>{__F.ACT.demoload()});await p.waitForTimeout(400);await p.evaluate(()=>{__F.UI.s.state='READY';__F.UI.s.view='list'});
  // ---- a shop transfer
  await p.evaluate(()=>{__F.go('ops',()=>{__F.newDoc('SHP')})});await p.waitForTimeout(250);
  ok('the shop transfer form has a shop name and NO photo upload',await p.evaluate(()=>!!document.querySelector('[data-f=shop]')&&!document.querySelector('[data-c=photo]')));
  const pk=await p.evaluate(()=>{const F=__F,ks=F.D.skus.filter(k=>F.g(k.id,'READY')>=6).slice(0,4);const d=F.S().docs.find(x=>x.id===F.UI.doc);ks.forEach((k,i)=>F.addLine(d,k.id,2+i));F.dirty();F.render();return {ks:ks.map(k=>k.id),tot:2+3+4+5,pr:F.S().costs[ks[0].m]}});
  ok('confirm is locked until a shop name is written',await p.evaluate(()=>document.querySelector('[data-a=confirm]').disabled&&[...document.querySelectorAll('.chk .no')].some(e=>/اسم المحل/.test(e.textContent))));
  await p.fill('[data-f=shop]','محل الزمالك');await p.dispatchEvent('[data-f=shop]','change');await p.waitForTimeout(150);
  ok('with a shop name (and no photo) confirm opens',await p.evaluate(()=>!document.querySelector('[data-a=confirm]').disabled));
  const before=await p.evaluate(({ks})=>ks.map(k=>__F.g(k,'READY')),pk);
  await p.click('[data-a=confirm]');await p.waitForTimeout(300);
  const after=await p.evaluate(({ks})=>{const F=__F,d=F.S().docs.find(x=>x.id===F.UI.doc);return {st:d.status,no:d.no,t:d.confirmedAt,bal:ks.map(k=>F.g(k,'READY')),shops:F.S().shops}},pk);
  ok('confirming moves exactly the quantities out of ready, and remembers the shop',after.st==='done'&&after.bal.every((v,i)=>before[i]-v===2+i)&&after.shops.indexOf('محل الزمالك')>=0,JSON.stringify(after));
  ok('the document shows the day and the time it was saved, and the delivery card',await p.evaluate(()=>{const t=document.getElementById('main').innerText;return /\d{4}-\d{2}-\d{2} · \d{2}:\d{2}/.test(t)&&/التسليم للمحل/.test(t)&&/لسه ما اتسلّمش/.test(t)&&!!document.querySelector('[data-a=shpnote]')}));
  // ---- the delivery note
  await p.click('[data-a=shpnote]');await p.waitForSelector('.notef');await p.waitForTimeout(250);
  const note=await p.evaluate(({tot,ks})=>{const h=document.querySelector('.notef').getAttribute('srcdoc')||document.querySelector('.notef').srcdoc,d=new DOMParser().parseFromString(h,'text/html'),rows=[...d.querySelectorAll('.pg:first-child tbody tr')];
    return {no:/SHP-\d{4}/.test(h),shop:h.indexOf('محل الزمالك')>=0,date:/\d{4}-\d{2}-\d{2}/.test(h),rows:rows.length,qty:rows.reduce((a,r)=>a+(+r.querySelector('td.n').textContent||0),0),copies:d.querySelectorAll('.pg').length,noCopyLabels:!/نسخة المحل|نسخة المخزن/.test(h),logo:!!d.querySelector('header img[src^="data:image/png"]'),brand:h.indexOf('#43316f')>=0,sign:/توقيع مستلم الاستور/.test(h)&&/توقيع أمين المخزن/.test(h)&&d.querySelectorAll('.sg>div').length===2,footer:+d.querySelector('.pg:first-child tfoot td.n b').textContent,noPrice:!/<th class="n">السعر/.test(h)}},pk);
  ok('the note has number, date and time, the shop, one row per item, total, a single copy, the Fémini logo and brand colour, and the two signatures (store receiver, storekeeper)',note.no&&note.shop&&note.date&&note.rows===4&&note.qty===pk.tot&&note.footer===pk.tot&&note.copies===1&&note.noCopyLabels&&note.logo&&note.brand&&note.sign,JSON.stringify(note));
  ok('prices are hidden by default and a tick shows them (when prices exist)',note.noPrice&&await p.evaluate(()=>{const S=__F.S();const need=!!document.querySelector('[data-c=shpprices]');if(!need)return true;const cb=document.querySelector('[data-c=shpprices]');cb.checked=true;cb.dispatchEvent(new Event('change',{bubbles:true}));return /<th class="n">السعر/.test(document.querySelector('.notef').srcdoc||document.querySelector('.notef').getAttribute('srcdoc'))}));
  const aoa=await p.evaluate(()=>{const F=__F;return 0});
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('[data-a=shpdl]')]);const html=fs.readFileSync(await dl.path(),'utf8');
  ok('the download is a self-contained printable page named after the note',/delivery-note-SHP-\d{4}\.html/.test(dl.suggestedFilename())&&html.includes('<!doctype html>')&&html.includes('@page')&&html.includes('محل الزمالك'),dl.suggestedFilename());
  const [dpdf]=await Promise.all([p.waitForEvent('download',{timeout:60000}),p.click('[data-a=shppdf]')]);const pdf=fs.readFileSync(await dpdf.path());
  const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  ok('PDF export: a real A4 PDF named after the note',/delivery-note-SHP-\d{4}\.pdf/.test(dpdf.suggestedFilename())&&pdf.slice(0,5).toString()==='%PDF-'&&pages>=1&&pdf.length>8000,dpdf.suggestedFilename()+' pages '+pages+' bytes '+pdf.length);
  const [dpng]=await Promise.all([p.waitForEvent('download',{timeout:60000}),p.click('[data-a=shppng]')]);const png=fs.readFileSync(await dpng.path());
  const pw=png.readUInt32BE(16),ph=png.readUInt32BE(20);
  ok('image export: a PNG at print resolution with the note on it',/delivery-note-SHP-\d{4}\.png/.test(dpng.suggestedFilename())&&png.slice(1,4).toString()==='PNG'&&pw>=1500&&ph>=600&&png.length>15000,pw+'x'+ph+' '+png.length);
  ok('print and Excel actions do not error (print may be unavailable in a frame)',await p.evaluate(()=>{try{__F.ACT.shpprint();return true}catch(e){return false}})&&await p.evaluate(()=>{try{__F.ACT.shpxls();return true}catch(e){return false}}));
  await p.evaluate(()=>{__F.UI.sheet=null;__F.render()});
  // ---- delivery tracking
  await p.fill('[data-c=shprecv]','أستاذ هشام');await p.click('[data-a=shpdone]');await p.waitForTimeout(250);
  ok('marking it delivered stores who received it and when',await p.evaluate(()=>{const d=__F.S().docs.find(x=>x.id===__F.UI.doc);return !!d.hdr.delivered&&d.hdr.delivered.receiver==='أستاذ هشام'&&/اتسلّم للمحل/.test(document.getElementById('main').innerText)}));
  ok('the signed paper can still be attached afterwards (optional)',await p.evaluate(()=>!!document.querySelector('[data-c=photo]')));
  // ---- shop page
  await p.evaluate(()=>{__F.UI.doc=null;__F.go('ops')});await p.click('[data-a=optab][data-v=shop]');await p.waitForTimeout(250);
  const pg=await p.evaluate(()=>{const F=__F,all=F.S().docs.filter(d=>d.type==='SHP'&&d.status==='done');const rows=document.querySelectorAll('#shpres tbody tr').length;const tot=all.reduce((a,d)=>a+d.lines.reduce((x,l)=>x+(+l.q||0),0),0);return {rows,docs:all.length,strip:document.querySelector('.strip').innerText.replace(/,/g,''),tot,hasShop:/محل الزمالك/.test(document.getElementById('main').innerText)}});
  ok('the shop tab lists every transfer with its shop, and the strip totals add up',pg.rows===pg.docs&&pg.strip.indexOf(String(pg.tot))>=0&&pg.hasShop,JSON.stringify(pg));
  await p.click('[data-a=shpf][data-k=shop][data-v="محل الزمالك"]');await p.waitForTimeout(150);
  ok('filtering by a shop shows only its transfers',await p.evaluate(()=>[...document.querySelectorAll('#shpres tbody tr')].every(r=>/محل الزمالك/.test(r.textContent))&&document.querySelectorAll('#shpres tbody tr').length>=1));
  await p.click('[data-a=shpf][data-k=shop][data-v=""]');await p.click('[data-a=shpf][data-k=st][data-v=pend]');await p.waitForTimeout(150);
  ok('"not delivered yet" shows only the pending ones (the demo has one)',await p.evaluate(()=>{const r=[...document.querySelectorAll('#shpres tbody tr')];return r.length>=1&&r.every(x=>/لسه ما اتسلّمش/.test(x.textContent))}));
  await p.click('[data-a=shpf][data-k=st][data-v=all]');await p.fill('[data-c=shpq]','الزمالك');await p.waitForTimeout(200);
  ok('search narrows the list as you type',await p.evaluate(()=>[...document.querySelectorAll('#shpres tbody tr')].every(r=>/الزمالك/.test(r.textContent))));
  await p.click('#shpres [data-a=shpnote] >> nth=0');await p.waitForSelector('.notef');
  ok('a note can be opened again from the list',await p.evaluate(()=>!!document.querySelector('.notef')));
  await p.evaluate(()=>{__F.UI.sheet=null;__F.render()});
  ok('the log shows the shop supply with the shop name',await p.evaluate(()=>{__F.UI.led={q:'',type:'out',tab:'feed',n:150};__F.go('ledger');return /توريد للمحل \(محل الزمالك\)/.test(document.getElementById('main').innerText)}));
  ok('no page errors',errs.length===0,errs.join('|'));
  const m=await b.newContext({...devices['iPhone 13']});const mp=await m.newPage();const me=[];mp.on('pageerror',e=>me.push(e.message));
  await mp.goto('file://'+wrap);await mp.waitForSelector('.shell');await mp.evaluate(()=>__F.ACT.demoload());await mp.waitForTimeout(400);
  await mp.evaluate(()=>{__F.UI.opTab='shop';__F.go('ops')});await mp.waitForTimeout(300);
  ok('phone: the shop page fits',await mp.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  await mp.evaluate(()=>{const d=__F.S().docs.find(x=>x.type==='SHP'&&x.status==='done');__F.UI.sheet={kind:'shpnote',id:d.id};__F.render()});await mp.waitForTimeout(300);
  ok('phone: the note preview fits',await mp.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&document.querySelector('.notef').getBoundingClientRect().width<=document.documentElement.clientWidth));
  ok('phone: no errors',me.length===0,me.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
