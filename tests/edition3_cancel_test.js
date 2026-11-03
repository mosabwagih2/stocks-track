const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  const txt=async s=>((await p.textContent(s||'#app'))||'').replace(/\s+/g,' ');
  const PNG={name:'w.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64')};
  const ready=()=>p.evaluate(()=>__F.S().moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0));
  await p.click('[data-a=go][data-t=orders]');
  ok('"إلغاء أوردر" button on Orders',await p.locator('.top [data-a=cxopen]').count()===1);
  const n0=await p.evaluate(()=>__F.S().orders.filter(o=>o.st!=='cx').length);
  await p.click('.top [data-a=cxopen]');await p.waitForSelector('#cxcode');
  ok('confirm disabled at start',await p.isDisabled('#cxgo'));
  await p.fill('#cxcode','zzz999');ok('unknown code message',/مفيش أوردر بالكود ده/.test(await txt('#cxprev')));
  await p.fill('#cxcode','ed4298#');ok('preview of matching order (with # like the label)',/ed4298/.test(await txt('#cxprev'))&&/قطعة/.test(await txt('#cxprev')));
  ok('still disabled without photo',await p.isDisabled('#cxgo'));
  await p.setInputFiles('input[data-c=cxphoto]',PNG);await p.waitForTimeout(250);
  ok('photo shown + confirm enabled',await p.locator('.sheet img').count()===1&&!(await p.isDisabled('#cxgo')));
  await p.fill('#cxreason','العميل لغى');await p.dispatchEvent('#cxreason','change');
  await p.click('#cxgo');await p.waitForTimeout(200);
  ok('order removed from Orders list (one less)',(await p.evaluate(()=>__F.S().orders.filter(o=>o.st!=='cx').length))===n0-1&&!/ed4298/.test(await txt('#ordrows')));
  ok('"ملغي" chip appears with 1',/ملغي\s*1/.test(await txt('.chips')));
  await p.click('[data-a=of][data-v=cx]');ok('cancelled filter lists it',/ed4298/.test(await txt('#ordrows')));
  // by waybill number
  await p.click('[data-a=of][data-v=all]');await p.click('.top [data-a=cxopen]');await p.fill('#cxcode','23793621');ok('match by waybill',/fd8523/.test(await txt('#cxprev')));await p.keyboard.press('Escape');
  // Today requested count reflects cancel
  await p.click('[data-a=go][data-t=today]');ok('Today shows 91 requested',/91/.test(await txt('.kpis')));
  // files tab
  await p.click('[data-a=go][data-t=files]');await p.click('[data-a=fltab][data-v=cx]');ok('Files → الإلغاءات shows photo card',await p.locator('.grid.g3 img').count()===1&&/العميل لغى/.test(await txt()));
  // restore
  await p.click('[data-a=uncx]');await p.waitForTimeout(150);ok('restore returns order to open',await p.evaluate(()=>__F.S().orders.find(o=>o.ref==='ed4298').st)==='open');
  // cancel a shipped order: scan first
  await p.click('[data-a=go][data-t=orders]');await p.click('[data-a=upload][data-t=scan]');await p.setInputFiles('#upfile',require('path').resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv'));await p.fill('#upemp','عبدالله');await p.click('[data-a=scansave]');await p.waitForTimeout(250);
  const sref=await p.evaluate(()=>__F.S().orders.find(o=>o.st==='done').ref);const spcs=await p.evaluate(r=>__F.S().orders.find(o=>o.ref===r).lines.length,sref);
  const r0=await ready(),fly0=await p.evaluate(()=>__F.S().sup.log.filter(e=>e.item==='FLY').reduce((a,e)=>a+e.q,0));
  await p.click('.top [data-a=cxopen]');await p.fill('#cxcode',sref);ok('shipped order warns + return checkbox',/اتشحن بالفعل/.test(await txt('#cxprev'))&&await p.locator('[data-c=cxret]').isChecked());
  await p.setInputFiles('input[data-c=cxphoto]',PNG);await p.waitForTimeout(250);await p.click('#cxgo');await p.waitForTimeout(250);
  ok('pieces returned to READY (+'+spcs+')',(await ready())===r0+spcs);
  ok('flyer restored (+1)',(await p.evaluate(()=>__F.S().sup.log.filter(e=>e.item==='FLY').reduce((a,e)=>a+e.q,0)))===fly0+1);
  ok('ledger has CXL move',await p.evaluate(()=>__F.S().moves.some(m=>m.type==='CXL')));
  // cancel shipped order WITHOUT return
  const sref2=await p.evaluate(()=>__F.S().orders.find(o=>o.st==='done').ref);const r1=await ready();
  await p.click('.top [data-a=cxopen]');await p.fill('#cxcode',sref2);await p.uncheck('[data-c=cxret]');await p.setInputFiles('input[data-c=cxphoto]',PNG);await p.waitForTimeout(250);await p.click('#cxgo');await p.waitForTimeout(250);
  ok('unchecked return keeps stock as is',(await ready())===r1);
  // persistence of photo
  await p.waitForTimeout(400);await p.reload();await p.waitForSelector('.shell');await p.click('[data-a=go][data-t=files]');await p.click('[data-a=fltab][data-v=cx]');await p.waitForTimeout(500);
  ok('cancel photos survive reload',await p.locator('.grid.g3 img').count()===2);
  await p.setViewportSize({width:400,height:800});await p.click('[data-a=go][data-t=orders]');await p.click('.top [data-a=cxopen]');
  ok('mobile no overflow',(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=0);await p.screenshot({path:require('os').tmpdir()+'/cx_m.png'});
  console.log(pass+' passed, '+fail+' failed');console.log(errs.join('\n')||'ERRORS: none');await b.close();
})();
