// Original uploaded files are kept as-is and can be downloaded back; the shop delivery needs the signed photo.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900},acceptDownloads:true});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/xlsx.full.min.js',r=>r.fulfill({body:fs.readFileSync('/tmp/xlsx.min.js'),contentType:'application/javascript'}));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+path.resolve(__dirname,'../apps/edition-3-brand-v2/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c,x)=>{console.log((c?'PASS ':'FAIL ')+l+(c?'':'  -> '+x));c?pass++:fail++};
  const pk=path.resolve(__dirname,'../data/vendoor_pickups_2026-11-02_lines.csv'),sc=path.resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv');
  // pickup: needs XLSX, so convert the csv to a real xlsx first
  const xl='/tmp/_pk_orig.xlsx';
  await p.evaluate(()=>{});
  await p.click('[data-a=go][data-t=orders]');await p.click('[data-a=upload][data-t=pickup]');
  await p.waitForFunction(()=>!!window.XLSX);
  const xb=await p.evaluate(async()=>{const ws=XLSX.utils.aoa_to_sheet([['كود الاوردر العشوائي','بوليصة الشحن','حالة الاوردر الجزئية','المحافظة','المبلغ توتال بالشحن للاوردر','المنتجات المطلوبة في الاوردر'],['edZZ901','90000001','جديد','القاهرة',500,'XX1 - مقاس L - لون أحمر - 1']]),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'s');return Array.from(new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})))});
  fs.writeFileSync(xl,Buffer.from(xb));
  await p.setInputFiles('#upfile',xl);await p.waitForTimeout(600);
  console.log(await p.evaluate(()=>JSON.stringify({e:__F.UI.sheet&&__F.UI.sheet.err,f:__F.UI.sheet&&__F.UI.sheet.fname,o:__F.UI.sheet&&!!__F.UI.sheet.res})));
  const hasPk=await p.locator('[data-a=pksave]').count();
  if(hasPk){await p.click('[data-a=pksave]');await p.waitForTimeout(500)}
  ok('pickup saved with the file meta',await p.evaluate(()=>{const q=__F.S().pickups.slice(-1)[0];return !!q.file&&q.file.name==='_pk_orig.xlsx'&&q.file.size>0}));
  const pid=await p.evaluate(()=>__F.S().pickups.slice(-1)[0].id);
  const got=await p.evaluate(id=>new Promise(r=>{const rq=indexedDB.open('femini-v3');rq.onsuccess=()=>{const g=rq.result.transaction('fl').objectStore('fl').get('pk:'+id);g.onsuccess=()=>r(g.result?{n:g.result.name,s:g.result.size}:null)}}),pid);
  ok('the original bytes are stored byte-for-byte',!!got&&got.s===fs.statSync(xl).size,JSON.stringify(got));
  await p.click('[data-a=go][data-t=files]');
  const dlb=p.locator('[data-a=fldl][data-k="pk:'+pid+'"]');
  ok('the Files page has a download button for it',await dlb.count()>=1);
  const [dl]=await Promise.all([p.waitForEvent('download'),dlb.first().click()]);
  const f2='/tmp/_pk_back.xlsx';await dl.saveAs(f2);
  ok('the downloaded file is identical to the uploaded one',fs.readFileSync(f2).equals(fs.readFileSync(xl)));
  ok('download name keeps the original name',dl.suggestedFilename()==='_pk_orig.xlsx',dl.suggestedFilename());
  // still there after a reload
  await p.reload();await p.waitForSelector('.shell');await p.waitForTimeout(400);await p.click('[data-a=go][data-t=files]');
  const [dl2]=await Promise.all([p.waitForEvent('download'),p.locator('[data-a=fldl][data-k="pk:'+pid+'"]').first().click()]);
  await dl2.saveAs('/tmp/_pk_back2.xlsx');ok('and after a reload',fs.readFileSync('/tmp/_pk_back2.xlsx').equals(fs.readFileSync(xl)));
  // scan csv
  await p.click('[data-a=go][data-t=orders]');await p.click('[data-a=upload][data-t=scan]');await p.setInputFiles('#upfile',sc);await p.waitForTimeout(500);

  if(await p.locator('[data-a=scansave]:not([disabled])').count()){await p.click('[data-a=scansave]');await p.waitForTimeout(600)}
  const sd=await p.evaluate(()=>{const d=__F.S().docs.filter(x=>x.type==='SCN').slice(-1)[0];return d&&{id:d.id,f:d.hdr.file}});
  ok('the scan file is kept too',!!sd&&!!sd.f&&/QRbot/.test(sd.f.name),JSON.stringify(sd));
  await p.click('[data-a=go][data-t=files]');await p.click('[data-a=fltab][data-v=sc]');
  const [dl3]=await Promise.all([p.waitForEvent('download'),p.locator('[data-a=fldl][data-k="dc:'+sd.id+'"]').first().click()]);
  await dl3.saveAs('/tmp/_sc_back.csv');ok('scan file downloads identical',fs.readFileSync('/tmp/_sc_back.csv').equals(fs.readFileSync(sc)));
  // signed photo original
  fs.writeFileSync('/tmp/_note.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
  await p.evaluate(()=>{const d=__F.newDoc('SHP');d.hdr.shop='محل';const k=__F.D.skus.find(k=>__F.g(k.id,'READY')>3);d.lines.push({sku:k.id,q:1});__F.confirmDoc(d);__F.UI.sheet=null;__F.go('ops',()=>{__F.UI.doc=d.id})});await p.waitForTimeout(300);
  await p.setInputFiles('[data-c=photo]','/tmp/_note.png');await p.waitForTimeout(500);
  const [dl4]=await Promise.all([p.waitForEvent('download'),p.locator('[data-a=fldl][data-k^="ph:"]').first().click()]);
  await dl4.saveAs('/tmp/_note_back.png');ok('the signed-note photo downloads as the original file',fs.readFileSync('/tmp/_note_back.png').equals(fs.readFileSync('/tmp/_note.png')));
  ok('no page errors',errs.length===0,errs.join('|'));
  console.log(pass+' passed, '+fail+' failed');await b.close();process.exit(fail?1:0);
})();
