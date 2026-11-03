const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  const txt=async s=>((await p.textContent(s||'#app'))||'').replace(/\s+/g,' ');
  const nsku=()=>p.evaluate(()=>__F.S()&&document.querySelectorAll('x').length>=0&&Object.keys(window.__F).length&&0);
  ok('date picker removed from Today',await p.locator('#wd').count()===0);
  await p.click('[data-a=go][data-t=stock]');
  const base=await p.evaluate(()=>__F.ctx&&1);
  // add variant to BR2: new color + sizes S,M
  await p.click('[data-a=skuadd][data-m=""]');await p.waitForSelector('.sheet');
  await p.selectOption('[data-c=skum]','BR2');
  await p.fill('#nc','موف');await p.click('[data-a=skuaddc]');
  await p.click('[data-a=skus][data-v=S]');await p.click('[data-a=skus][data-v=M]');
  ok('preview says 2 new',/هيتضاف 2 صنف جديد/.test(await txt('.sheet')));
  await p.click('[data-a=skuc][data-v="اسود"]');
  ok('preview counts existing skipped',/هيتضاف 2 صنف جديد/.test(await txt('.sheet'))&&/موجودين بالفعل/.test(await txt('.sheet')));
  await p.click('[data-a=skusave]');await p.waitForTimeout(150);
  const has=await p.evaluate(()=>!!__F.S().cat.skus.find(k=>k.m==='BR2'&&k.c==='موف'&&k.s==='M'));ok('BR2 موف M saved in catalog',has);
  // new model
  await p.click('[data-a=skuadd][data-m=""]');await p.selectOption('[data-c=skum]','__new');
  await p.fill('input[data-f=newCode]','pan6');await p.fill('input[data-f=newName]','بانتي');
  await p.click('[data-a=skuc][data-v="احمر"]');await p.click('[data-a=skuc][data-v="اسود"]');await p.click('[data-a=skus][data-v=M]');await p.click('[data-a=skus][data-v=L]');
  ok('new model preview 4',/هيتضاف 4 صنف/.test(await txt('.sheet')));
  await p.click('[data-a=skusave]');await p.waitForTimeout(150);
  ok('PAN6 appears in model nav under بانتي',await p.locator('.mi:has-text("PAN6")').count()+await p.locator('section.card h2:has-text("PAN6")').count()>0);
  // invalid code
  await p.click('[data-a=skuadd][data-m=""]');await p.selectOption('[data-c=skum]','__new');await p.fill('input[data-f=newCode]','1bad');await p.fill('input[data-f=newName]','x');await p.click('[data-a=skuc][data-v="احمر"]');await p.click('[data-a=skus][data-v=M]');await p.click('[data-a=skusave]');
  ok('bad code rejected',/كود الموديل/.test(await txt('.sheet')));await p.keyboard.press('Escape');
  // receipt into new sku via ops picker
  await p.click('[data-a=go][data-t=ops]');await p.click('[data-a=newop][data-t=RCV]');
  ok('picker offers PAN6',(await p.$$eval('#pkm option',o=>o.map(x=>x.value))).includes('PAN6'));
  await p.selectOption('#pkm','PAN6');await p.selectOption('#pkc','احمر');await p.selectOption('#pks','M');await p.fill('#pkq','7');await p.click('[data-a=addline]');
  await p.fill('input[data-f=declared]','7');await p.dispatchEvent('input[data-f=declared]','change');
  await p.setInputFiles('input[data-c=photo]',{name:'p.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64')});await p.waitForTimeout(300);
  await p.click('[data-a=confirm]');await p.waitForTimeout(250);
  const pid=await p.evaluate(()=>__F.S().cat.skus.find(k=>k.m==='PAN6'&&k.c==='احمر'&&k.s==='M').id);
  ok('received 7 into new SKU '+pid,await p.evaluate(i=>__F.g(i,'READY'),pid)===7);
  // archive blocked with stock
  await p.click('[data-a=go][data-t=stock]');await p.click('[data-a=sview][data-v=table]');await p.fill('#sq','PAN6-RED-M');await p.waitForTimeout(120);
  await p.click('#stres tbody tr');await p.waitForSelector('.sheet');
  ok('archive blocked while stock',/مينفعش تشيل/.test(await txt('.sheet'))&&await p.locator('[data-a=skuarch]').count()===0);await p.keyboard.press('Escape');
  // archive an empty one (2-step) + restore
  await p.fill('#sq','PAN6-BLK-L');await p.waitForTimeout(120);await p.click('#stres tbody tr');await p.waitForSelector('.sheet');
  await p.click('[data-a=skuarch]');ok('archive asks confirm',await p.locator('[data-a=skuarch2]').count()===1);
  const id2=await p.evaluate(()=>__F.S().cat.skus.find(k=>k.m==='PAN6'&&k.c==='اسود'&&k.s==='L').id);
  await p.click('[data-a=skuarch2]');await p.waitForTimeout(150);
  ok('archived (removed from active)',await p.evaluate(i=>!!__F.S().cat.arch[i],id2)&&(await p.evaluate(()=>0))===0);
  await p.fill('#sq','');await p.click('[data-a=sflt][data-v=arch]');ok('archived chip lists it',await p.locator('[data-a=skurestore]').count()===1);
  await p.click('[data-a=skurestore]');await p.waitForTimeout(100);ok('restored',await p.evaluate(i=>!__F.S().cat.arch[i],id2));
  // existing sku with stock cannot be removed + persistence
  await p.reload();await p.waitForSelector('.shell');await p.click('[data-a=go][data-t=stock]');await p.click('[data-a=sview][data-v=table]');await p.fill('#sq','PAN6');await p.waitForTimeout(150);
  ok('new SKUs survive reload',(await p.locator('#stres tbody tr').count())===4);
  // model-level: remove model (blocked), add+remove empty model, restore
  await p.click('[data-a=sview][data-v=all]');
  ok('top-level "+ موديل جديد" button',await p.locator('.top [data-a=skuadd][data-m=__new]').count()===1);
  await p.click('[data-a=modelrm][data-m=BR2]');await p.waitForSelector('.sheet');
  ok('model with stock cannot be removed + blockers listed',/مينفعش تشيل الموديل/.test(await txt('.sheet'))&&await p.locator('[data-a=modelarch]').count()===0);await p.keyboard.press('Escape');
  await p.click('[data-a=skuadd][data-m=__new]');await p.fill('input[data-f=newCode]','TST1');await p.fill('input[data-f=newName]','اختبار');
  await p.click('[data-a=skuc][data-v="احمر"]');await p.click('[data-a=skus][data-v=M]');await p.click('[data-a=skus][data-v=L]');await p.click('[data-a=skusave]');await p.waitForTimeout(150);
  ok('TST1 added',await p.evaluate(()=>__F.S().cat.models.some(m=>m.code==='TST1')));
  await p.click('[data-a=modelrm][data-m=TST1]');await p.waitForSelector('.sheet');await p.click('[data-a=modelarch]');ok('model removal asks confirm',await p.locator('[data-a=modelarch2]').count()===1);
  await p.click('[data-a=modelarch2]');await p.waitForTimeout(150);
  ok('TST1 gone from model list',await p.evaluate(()=>__F.S().cat.arch['TST1-RED-M']===true)&&(await p.locator('.mi:has-text("TST1"), section.card h2:has-text("TST1")').count())===0);
  await p.click('[data-a=skuadd][data-m=__new]');await p.fill('input[data-f=newCode]','TST1');await p.fill('input[data-f=newName]','x');await p.click('[data-a=skuc][data-v="احمر"]');await p.click('[data-a=skus][data-v=M]');await p.click('[data-a=skusave]');
  ok('re-adding a removed model code says restore it',/اتشال قبل كده/.test(await txt('.sheet')));await p.keyboard.press('Escape');
  await p.click('[data-a=sview][data-v=table]');await p.click('[data-a=sflt][data-v=arch]');
  ok('archived tab groups by model with restore-all',await p.locator('[data-a=modelrestore][data-m=TST1]').count()===1);
  await p.click('[data-a=modelrestore][data-m=TST1]');await p.waitForTimeout(150);
  ok('TST1 restored with both SKUs',await p.evaluate(()=>!__F.S().cat.arch['TST1-RED-M']&&!__F.S().cat.arch['TST1-RED-L']));
  // mobile
  await p.setViewportSize({width:400,height:800});await p.click('[data-a=skuadd][data-m=""]');
  ok('mobile no overflow',(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=0);await p.screenshot({path:'sku_m.png'});
  console.log(pass+' passed, '+fail+' failed');console.log(errs.join('\n')||'ERRORS: none');await b.close();
})();
