const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  const txt=async s=>((await p.textContent(s||'#app'))||'').replace(/\s+/g,' ');
  // tiles
  ok('3 clickable tiles before scan (all, wait + none blocked)',await p.locator('button.kpi').count()===2);
  await p.click('button.kpi[data-w=all]');await p.waitForSelector('.sheet');ok('all tile opens with per-pickup table',/حسب البيك أب/.test(await txt('.sheet'))&&/بيك أب 1/.test(await txt('.sheet')));await p.keyboard.press('Escape');
  await p.click('button.kpi[data-w=wait]');await p.waitForSelector('.sheet');ok('wait tile lists needed variants',/القطع اللي لازم تتجهّز/.test(await txt('.sheet')));
  await p.click('.sheet tbody tr >> nth=0');ok('variant row opens sku',/جاهز للبيع/.test(await txt('.sheet')));await p.keyboard.press('Escape');
  // scan then done tile
  await p.click('[data-a=go][data-t=orders]');await p.click('[data-a=upload][data-t=scan]');await p.setInputFiles('#upfile',require('path').resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv'));await p.fill('#upemp','عبدالله');await p.click('[data-a=scansave]');await p.waitForTimeout(250);
  await p.click('[data-a=go][data-t=today]');
  await p.click('button.kpi[data-w=done]');await p.waitForSelector('.sheet');ok('done tile shows employee table',/حسب الموظف/.test(await txt('.sheet'))&&/عبدالله/.test(await txt('.sheet')));await p.keyboard.press('Escape');
  // files page
  const nav=await p.$$eval('.rail .nav span:first-of-type',e=>e.map(x=>x.textContent));console.log('nav:',nav.join(' | '));
  ok('files above settings',nav.indexOf('الملفات')===nav.length-2);
  await p.click('[data-a=go][data-t=files]');ok('where-saved note',/فين بتتحفظ ملفاتي/.test(await txt()));
  ok('pickup files listed (2)',await p.locator('tbody tr').count()===2);
  await p.screenshot({path:'fl_pk.png'});
  // edit pickup
  await p.click('[data-a=pkedit] >> nth=0');await p.waitForSelector('.sheet');
  await p.fill('input[data-f=label]','بيك أب معدّل');await p.fill('input[data-f=date]','2026-11-02');
  await p.click('[data-a=pksave2]');await p.waitForTimeout(100);ok('pickup renamed',/بيك أب معدّل/.test(await txt()));
  // delete blocked when scanned
  const idWithScan=await p.evaluate(()=>__F.S().pickups.find(pk=>__F.S().orders.some(o=>o.pk===pk.id&&o.st==='done')).id);
  await p.click('[data-a=pkedit][data-id='+idWithScan+']');ok('delete blocked if scanned',/مينفعش تحذفه/.test(await txt('.sheet'))&&(await p.locator('[data-a=pkdel]').count())===0);await p.keyboard.press('Escape');
  // delete an untouched pickup (2-step)
  const idNo=await p.evaluate(()=>__F.S().pickups.find(pk=>!__F.S().orders.some(o=>o.pk===pk.id&&o.st==='done'))&&__F.S().pickups.find(pk=>!__F.S().orders.some(o=>o.pk===pk.id&&o.st==='done')).id);
  if(idNo){await p.click('[data-a=pkedit][data-id='+idNo+']');await p.click('[data-a=pkdel]');ok('delete asks confirm',await p.locator('[data-a=pkdel2]').count()===1);await p.click('[data-a=pkdel2]');await p.waitForTimeout(100);ok('pickup deleted',await p.evaluate(i=>!__F.S().pickups.some(x=>x.id===i)&&!__F.S().orders.some(o=>o.pk===i),idNo))}
  // scan files
  await p.click('[data-a=fltab][data-v=sc]');ok('scan file listed',/عبدالله/.test(await txt())&&/QRbot_.*\.csv/.test(await txt()));
  await p.click('[data-a=scedit]');await p.fill('#scemp','حسام');await p.click('[data-a=scsave]');await p.waitForTimeout(100);
  ok('employee renamed on orders',await p.evaluate(()=>__F.S().orders.filter(o=>o.sc&&o.sc.by==='حسام').length)===28);
  await p.click('[data-a=scedit]');await p.click('[data-a=screv]');ok('reverse asks confirm',await p.locator('[data-a=screv2]').count()===1);
  const r0=await p.evaluate(()=>__F.S().orders.filter(o=>o.st==='done').length);await p.click('[data-a=screv2]');await p.waitForTimeout(150);
  ok('scan file reversed',r0===28&&await p.evaluate(()=>__F.S().orders.filter(o=>o.st==='done').length)===0);
  await p.click('[data-a=fltab][data-v=pk]');await p.click('[data-a=pkedit] >> nth=0');await p.click('[data-a=pkdel]');ok('delete asks confirm',await p.locator('[data-a=pkdel2]').count()===1);const n0=await p.evaluate(()=>__F.S().pickups.length);await p.click('[data-a=pkdel2]');await p.waitForTimeout(100);ok('pickup deleted with its orders',await p.evaluate(()=>__F.S().pickups.length)===n0-1);
  // photo persistence
  await p.click('[data-a=go][data-t=ops]');await p.click('[data-a=newop][data-t=RCV]');await p.selectOption('#pkm','PAN1');await p.fill('#pkq','4');await p.click('[data-a=addline]');
  await p.fill('input[data-f=declared]','4');await p.dispatchEvent('input[data-f=declared]','change');
  await p.setInputFiles('input[data-c=photo]',{name:'p.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64')});await p.waitForTimeout(300);
  await p.click('[data-a=confirm]');await p.waitForTimeout(250);
  ok('done doc shows photo + change control',await p.locator('.sum img').count()===1&&await p.locator('.sum input[type=file]').count()===1);
  await p.waitForTimeout(400);await p.reload();await p.waitForSelector('.shell');await p.click('[data-a=go][data-t=files]');await p.click('[data-a=fltab][data-v=ph]');await p.waitForTimeout(500);
  ok('photo survives reload (IndexedDB)',await p.locator('.grid.g3 img').count()===1);
  await p.screenshot({path:'fl_ph.png'});
  await p.setViewportSize({width:400,height:800});for(const tb of ['files','today']){await p.click('[data-a=go][data-t='+tb+']');await p.waitForTimeout(80);if(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)>0)ok('mobile overflow '+tb,false)}
  console.log(pass+' passed, '+fail+' failed');console.log(errs.join('\n')||'ERRORS: none');await b.close();
})();
