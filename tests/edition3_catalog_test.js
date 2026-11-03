const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  const txt=async s=>((await p.textContent(s||'#app'))||'').replace(/\s+/g,' ');
  const cat=()=>p.evaluate(()=>JSON.parse(JSON.stringify(__F.S().cat)));
  await p.click('[data-a=go][data-t=stock]');
  ok('top has exactly two actions: تعديل + موديل جديد',await p.locator('.top [data-a=catedit]').count()===1&&await p.locator('.top [data-a=skuadd][data-only]').count()===1);
  ok('no per-model buttons',await p.locator('section.card [data-a=modelrm], section.card [data-a=skuadd]').count()===0);
  // new model
  await p.click('.top [data-a=skuadd]');await p.waitForSelector('.sheet');
  ok('new-model sheet has no model selector',await p.locator('select[data-c=skum]').count()===0&&/موديل جديد/.test(await txt('.sheet h2')));
  await p.fill('input[data-f=newCode]','tst1');await p.fill('input[data-f=newName]','اختبار');
  await p.click('[data-a=skuc][data-v="احمر"]');await p.click('[data-a=skus][data-v=M]');await p.click('[data-a=skus][data-v=L]');
  ok('preview 2 new',/هيتضاف 2 صنف جديد/.test(await txt('.sheet')));
  await p.click('[data-a=skusave]');await p.waitForTimeout(150);
  ok('TST1 saved',(await cat()).models.some(m=>m.code==='TST1'));
  // edit: add a color to BR2
  await p.click('.top [data-a=catedit]');await p.waitForSelector('.sheet');
  await p.selectOption('[data-c=catm]','BR2');
  ok('locked cells for stocked variants',await p.locator('.cell.tg.lock').count()>10);
  ok('save disabled with no changes',await p.isDisabled('[data-a=catsave]'));
  await p.fill('#catnc','موف');await p.click('[data-a=cataddc]');
  ok('new color auto-adds a cell per size (7)',/\+7/.test(await txt('.sheet .msg')));
  await p.click('[data-a=catsave]');await p.waitForTimeout(150);
  ok('BR2 موف x7 in catalog',(await cat()).skus.filter(k=>k.m==='BR2'&&k.c==='موف').length===7);
  // edit: uncheck one new (empty) cell -> removed ; locked cell cannot be toggled
  await p.click('.top [data-a=catedit]');await p.selectOption('[data-c=catm]','BR2');
  await p.click('.cell.tg.on >> nth=0');
  ok('unchecking marks "هيتشال"',/-1/.test(await txt('.sheet .msg')));
  await p.click('[data-a=catsave]');await p.waitForTimeout(150);
  ok('one SKU archived',Object.keys((await cat()).arch).length===1);
  // rename
  await p.click('.top [data-a=catedit]');await p.selectOption('[data-c=catm]','TST1');await p.fill('input[data-f=name]','اختبار تاني');await p.dispatchEvent('input[data-f=name]','change');
  ok('name change enables save',!(await p.isDisabled('[data-a=catsave]')));await p.click('[data-a=catsave]');await p.waitForTimeout(150);
  ok('model renamed',(await cat()).names.TST1==='اختبار تاني');
  // remove whole model from editor: blocked for BR2, allowed for TST1
  await p.click('.top [data-a=catedit]');await p.selectOption('[data-c=catm]','BR2');await p.click('[data-a=catrm]');
  ok('BR2 removal blocked (stock)',/مينفعش تشيل الموديل/.test(await txt('.sheet'))&&await p.locator('[data-a=modelarch]').count()===0);await p.keyboard.press('Escape');
  await p.click('.top [data-a=catedit]');await p.selectOption('[data-c=catm]','TST1');await p.click('[data-a=catrm]');await p.click('[data-a=modelarch]');
  ok('asks confirmation',await p.locator('[data-a=modelarch2]').count()===1);await p.click('[data-a=modelarch2]');await p.waitForTimeout(150);
  ok('TST1 removed',(await cat()).arch['TST1-RED-M']===true&&(await p.locator('.mi:has-text("TST1"), section.card h2:has-text("TST1")').count())===0);
  // restore
  await p.click('[data-a=sview][data-v=table]');await p.click('[data-a=sflt][data-v=arch]');
  ok('archived list has restore-all for TST1',await p.locator('[data-a=modelrestore][data-m=TST1]').count()===1);
  await p.click('[data-a=modelrestore][data-m=TST1]');await p.waitForTimeout(150);
  ok('TST1 back',!(await cat()).arch['TST1-RED-M']);
  // receipt into a new SKU via ops
  await p.click('[data-a=go][data-t=ops]');await p.click('[data-a=newop][data-t=RCV]');
  ok('ops picker lists TST1',(await p.$$eval('#pkm option',o=>o.map(x=>x.value))).includes('TST1'));
  await p.click('[data-a=backops]');
  // persistence
  await p.reload();await p.waitForSelector('.shell');await p.click('[data-a=go][data-t=stock]');
  ok('catalog survives reload',(await cat()).skus.length>=9&&(await p.evaluate(()=>__F.S().cat.names.TST1))==='اختبار تاني');
  await p.setViewportSize({width:400,height:800});await p.click('.top [data-a=catedit]');await p.waitForSelector('.sheet');
  ok('mobile no overflow',(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=0);await p.screenshot({path:'cat_m.png'});
  console.log(pass+' passed, '+fail+' failed');console.log(errs.join('\n')||'ERRORS: none');await b.close();
})();
