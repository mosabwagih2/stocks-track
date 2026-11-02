const { chromium } = require('playwright');
const fs=require('fs');
const SP=require('path').resolve(__dirname,'../apps/task-first-edition')+'/';
const CSV=require('path').resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv');
const IMG=require('os').tmpdir()+'/femini_test_photo.png';fs.writeFileSync(IMG,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64'));
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:1000}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts|cdnjs|net::|Failed to load/.test(m.text()))errs.push('CONSOLE '+m.text())});
  await p.goto('file://'+SP+'index.html');await p.waitForSelector('.band');
  const txt=async()=>(await p.textContent('#app')).replace(/\s+/g,' ');
  const home=async()=>{await p.click('[data-a=goto][data-v=docs]');if(await p.locator('[data-a=backhome]').count())await p.click('[data-a=backhome]')};
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  let t=await txt();
  ok('desk strip shows scanned 0 of 48 / 44', /اتسجّل 0 من 48/.test(t)&&/اتسجّل 0 من 44/.test(t));
  ok('desk band: pending pieces 1,070', t.includes('1,070'));
  await p.click('[data-a=goto][data-v=docs]');t=await txt();
  ok('ops home has the Scanned Orders card', await p.locator('.op').filter({hasText:'سجّلت أوردرات بالسكان'}).count()===1&&await p.locator('.op').count()===10);
  // upload the real QRbot file
  await p.locator('.op').filter({hasText:'سجّلت أوردرات بالسكان'}).click();
  ok('scan drawer opens', (await txt()).includes('ملف السكان (QRbot)'));
  await p.fill('[data-i=upemp]','عبدالله');
  await p.setInputFiles('#upfile',CSV);await p.waitForSelector('.drawer .preview');
  t=await p.locator('.drawer').textContent();t=t.replace(/\s+/g,' ');
  ok('preview: 28 scans, 28 new orders, 456 pieces, 0 unknown', /سكانات في الملف28/.test(t)&&/28 · 456 قطعة/.test(t)&&/كود غير معروف0/.test(t));
  await p.click('[data-a=upsave]');t=await txt();
  ok('scan document opens as a draft with effect preview', t.includes('هيحصل إيه في المخزن')&&/جاهز\s*−456/.test(t));
  ok('statusbar ready to confirm', (await p.locator('.sbar li.on').textContent()).includes('جاهزة للتأكيد'));
  await p.locator('[data-a=confirm]').first().click();t=await txt();
  ok('scan confirmed', /اتسجّلت العملية SCN-/.test(t));
  await p.click('[data-a=goto][data-v=desk]');t=await txt();
  ok('ready dropped by 456 (43,407)', t.includes('43,407'));
  ok('strip: 11 of 48 and 17 of 44 scanned', /اتسجّل 11 من 48/.test(t)&&/اتسجّل 17 من 44/.test(t));
  ok('desk band shows remaining 614 pieces', t.includes('614'));
  // pickup screen statuses
  await p.locator('.pk').first().click();t=await txt();
  ok('pickup screen: statuses with employee', t.includes('اتسجّل')&&t.includes('عبدالله')&&t.includes('مستني السكان'));
  ok('pickup screen has no old confirm button', await p.locator('.sbar li.on').first().textContent().then(x=>x.includes('مفتوح')));
  await p.click('[data-a=pkf][data-v=pend]');
  const pendRows=await p.locator('tbody tr:has([data-sel])').count();ok('filter pending shows 37 orders in pickup 1', pendRows===37);
  // manual registration of 2 orders
  const boxes=await p.$$('[data-sel]');await boxes[0].check();await boxes[1].check();
  await p.click('[data-a=pkreg]');t=await txt();ok('manual register creates a scan draft for 2 orders', /أوردرات جديدة\s*2/.test(t));
  await p.fill('[data-k=emp]','حسام');await p.locator('[data-a=confirm]').first().click();t=await txt();ok('manual scan confirmed', /اتسجّلت العملية SCN-/.test(t));
  // re-upload same file: everything already registered
  await p.click('[data-a=backhome]');
  await p.locator('.op').filter({hasText:'سجّلت أوردرات بالسكان'}).click();await p.fill('[data-i=upemp]','عبدالله');await p.setInputFiles('#upfile',CSV);await p.waitForSelector('.drawer .preview');
  t=(await p.locator('.drawer').textContent()).replace(/\s+/g,' ');
  ok('re-upload: all 28 already registered, nothing new, save disabled', /اتسجلت قبل كده28/.test(t)&&await p.locator('[data-a=upsave]').isDisabled());
  await p.click('[data-a=closedrawer]');
  // analytics: team
  await p.click('[data-a=goto][data-v=analytics]');t=await txt();
  ok('analytics: per-employee scanned orders', /عبدالله\s*28\s*456/.test(t)&&/حسام\s*2/.test(t));
  // negative stock scan is allowed with a warning
  const data=JSON.parse(fs.readFileSync(require('path').resolve(__dirname,'../src/task-first-edition/data.json'),'utf8'));
  const scanned=new Set(fs.readFileSync(CSV,'utf8').split('\n').slice(1).map(l=>(l.split(',')[3]||'').replace(/"/g,'').trim()));
  const pk=data.pickups[0];const manual=new Set();
  // find a pickup-1 order not scanned, not among the first two manual ones, with a variant we can zero out
  const cand=pk.orders.filter(o=>!scanned.has(o.ref))[2];const sku=cand.lines[0];const k=data.skus.find(x=>x.id===sku);
  await home();await p.locator('.op').filter({hasText:'لقيت قطع'}).click();
  const [m,col,sz]=[k.m,k.c,k.s];await p.selectOption('#pk-m',m);await p.selectOption('#pk-c',col);await p.selectOption('#pk-z',sz);
  const sub=await p.inputValue('#qa-qty');await p.fill('#qa-qty',String(k.open));await p.fill('#qa-n','اختبار');
  await p.click('[data-a=qadd]');await p.locator('[data-a=confirm]').first().click();t=await txt();
  ok('moved '+k.open+' pieces of '+sku+' out of Ready (test setup)', /اتسجّلت العملية STS-/.test(t)||t.includes('اتسجّلت'));
  await p.click('[data-a=backhome]');await p.click('[data-a=goto][data-v=desk]');t=await txt();
  ok('exceptions: orders that will be stuck because of stock', /هيقف\s*\d+\s*أوردر/.test(t)||t.includes('هيقف بالمخزون'));
  await p.locator('.pk').first().click();
  const row=p.locator('tbody tr',{has:p.locator('td.en',{hasText:cand.ref})}).first();
  ok('the order is shown as will-stop with the missing variant', (await row.textContent()).includes('هيقف')&&(await row.textContent()).includes('ناقص'));
  await row.locator('[data-sel]').check();await p.click('[data-a=pkreg]');await p.fill('[data-k=emp]','عبدالله');await p.locator('[data-a=confirm]').first().click();t=await txt();
  ok('scanning is NOT blocked by stock: confirmed with a warning', /اتسجّلت SCN-\d+ لكن فيه رصيد بالسالب/.test(t));
  await p.click('[data-a=goto][data-v=desk]');t=await txt();
  ok('top pill and exception card show negative stock', t.includes('رصيد بالسالب'));
  // reverse the first scan: orders go back to pending
  await home();
  await p.locator('.oli.click').filter({hasText:'سكان عبدالله · 28'}).first().click();
  await p.click('[data-a=reverse]');t=await txt();ok('reversing a scan cancels it', /اتلغت العملية SCN-/.test(t));
  await p.click('[data-a=goto][data-v=desk]');t=await txt();
  ok('after reverse: pickup 1 keeps only the 3 manual scans, pickup 2 back to 0', /اتسجّل 3 من 48/.test(t)&&/اتسجّل 0 من 44/.test(t));
  // regression: receipt + status change + count still work
  await home();await p.locator('.op').filter({hasText:'استلمت بضاعة'}).click();
  await p.selectOption('#pk-m','BR2');await p.selectOption('#pk-c','احمر');await p.selectOption('#pk-z','2XL');await p.click('[data-a=qadd]');
  await p.setInputFiles('input[type=file][data-c=photo]',IMG);await p.locator('[data-a=confirm]').first().click();t=await txt();ok('regression: receipt', /اتسجّلت العملية RCV-/.test(t));
  await p.click('[data-a=backhome]');await p.locator('.op').filter({hasText:'عملت جرد'}).click();await p.check('[data-c=cntm][data-m=BR1]');await p.click('[data-a=cntstart]');
  const ci=await p.$$('[data-i=cn][data-f=r]');await ci[0].fill('3');await p.check('[data-c=ack]').catch(()=>{});t=await txt();ok('regression: count screen', t.includes('الفروق'));
  await p.emulateMedia({colorScheme:'dark'});await p.setViewportSize({width:390,height:800});
  ok('phone no horizontal overflow', (await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))<=0);
  console.log('\n'+pass+' passed, '+fail+' failed');console.log('ERRORS:',errs.length?errs:'none');await b.close();
})();
