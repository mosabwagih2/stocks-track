const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  const bal=id=>p.evaluate(i=>__F.S().sup.log.reduce((a,e)=>a+(e.item===i?e.q:0),0),id);
  const txt=async s=>((await p.textContent(s||'#app'))||'').replace(/\s+/g,' ');
  await p.click('[data-a=go][data-t=supplies]');
  ok('5 supply cards',await p.locator('.grid.g3 > section.card').count()===5);
  ok('no inline count button / inline input on cards',(await p.locator('.grid.g3 input').count())===0&&!/>جرد</.test(await p.innerHTML('.grid.g3')));
  await p.screenshot({path:'sp_main.png'});
  // receive
  const f0=await bal('FLY');
  await p.click('[data-a=supopen][data-id=FLY][data-act=rcv]');await p.waitForSelector('#supq');
  ok('confirm disabled until qty',await p.isDisabled('#supgo'));
  await p.fill('#supq','100');ok('preview shows after',/هيبقى/.test(await txt('#supprev')));ok('confirm enabled',!(await p.isDisabled('#supgo')));
  await p.screenshot({path:'sp_sheet.png'});
  await p.click('#supgo');await p.waitForTimeout(150);
  ok('receive +100',(await bal('FLY'))===f0+100);
  ok('toast has undo',await p.locator('.toast [data-a=undoentry]').count()===1);
  await p.click('.toast [data-a=undoentry]');await p.waitForTimeout(100);
  ok('undo restores',(await bal('FLY'))===f0);
  // issue too much
  await p.click('[data-a=supopen][data-id=FLY][data-act=manage]');await p.click('[data-a=supact][data-v=issue]');
  await p.fill('#supq',String(f0+5));ok('issue > balance blocked',await p.isDisabled('#supgo')&&/مينفعش/.test(await txt('#supprev')));
  await p.fill('#supq','10');await p.click('#supgo');await p.waitForTimeout(100);ok('issue -10',(await bal('FLY'))===f0-10);
  // count
  await p.click('[data-a=supopen][data-id=FLY][data-act=manage]');await p.click('[data-a=supact][data-v=count]');
  ok('count warns',/بيستبدل الرصيد/.test(await txt('.sheet')));
  await p.fill('#supq',String(f0-10));ok('count same = disabled',await p.isDisabled('#supgo'));
  await p.fill('#supq','500');await p.click('#supgo');await p.waitForTimeout(100);ok('count sets 500',(await bal('FLY'))===500);
  // cups pack mode
  await p.click('[data-a=supopen][data-id=CUP][data-act=rcv]');await p.click('[data-a=supmode][data-v=pack]');await p.fill('#supq','2');
  ok('pack preview +48',/48/.test(await txt('#supprev')));await p.click('#supgo');await p.waitForTimeout(100);
  // add new item with rule
  await p.click('[data-a=supnew]');await p.fill('input[data-f=name]','شريط لاصق');await p.fill('input[data-f=unit]','لفة');await p.fill('input[data-f=open]','50');
  await p.selectOption('[data-c=supkind]','order');await p.fill('input[data-f=qty]','1');
  await p.click('[data-a=supsave]');await p.waitForTimeout(150);
  const newId=await p.evaluate(()=>__F.S().sup.items.slice(-1)[0].id);
  ok('new item added with opening 50',(await bal(newId))===50&&await p.locator('.grid.g3 > section.card').count()===6);
  // empty name validation
  await p.click('[data-a=supnew]');await p.click('[data-a=supsave]');ok('name validation',/اكتب اسم/.test(await txt('.sheet')));await p.click('[data-a=closesheet]');
  // scan consumes new item
  await p.click('[data-a=go][data-t=orders]');await p.click('[data-a=upload][data-t=scan]');await p.setInputFiles('#upfile',require('path').resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv'));await p.fill('#upemp','عبدالله');await p.click('[data-a=scansave]');await p.waitForTimeout(250);
  ok('scan consumed new item (50-28)',(await bal(newId))===22);
  const cup=await p.evaluate(()=>__F.S().sup.log.filter(e=>e.item==='CUP'&&e.kind==='auto').reduce((a,e)=>a+e.q,0));ok('cups auto consumed',cup<0);
  // edit rule then reverse scan restores
  await p.click('[data-a=go][data-t=supplies]');
  await p.click('[data-a=supopen][data-id='+newId+'][data-act=manage]');await p.click('[data-a=supedit]');await p.fill('input[data-f=name]','شريط لاصق شفاف');await p.click('[data-a=supsave]');await p.waitForTimeout(100);
  ok('rename saved',(await p.evaluate(i=>__F.S().sup.items.find(x=>x.id===i).name,newId))==='شريط لاصق شفاف');
  await p.click('[data-a=go][data-t=ops]');await p.click('tbody tr[data-a=opendoc]');await p.click('[data-a=reverse]');await p.waitForTimeout(150);
  ok('reverse scan restores supplies',(await bal(newId))===50);
  // archive two-step
  await p.click('[data-a=go][data-t=supplies]');await p.click('[data-a=supopen][data-id='+newId+'][data-act=manage]');await p.click('[data-a=supedit]');
  await p.click('[data-a=suparch]');ok('archive asks confirmation',await p.locator('[data-a=suparch2]').count()===1);
  await p.click('[data-a=suparch2]');await p.waitForTimeout(100);ok('archived hidden',await p.locator('.grid.g3 > section.card').count()===5);
  await p.click('[data-a=suparchview]');await p.click('[data-a=suprestore]');await p.waitForTimeout(100);
  ok('restored',await p.evaluate(i=>!__F.S().sup.items.find(x=>x.id===i).arch,newId));
  // log undo two-step
  await p.click('[data-a=supopen][data-id=FLY][data-act=manage]');await p.click('[data-a=suptab][data-v=log]');
  await p.click('[data-a=supundo]');ok('undo asks confirm',await p.locator('[data-a=supundo2]').count()===1);
  const fb=await bal('FLY');await p.click('[data-a=supundo2]');await p.waitForTimeout(100);ok('log undo changes balance',(await bal('FLY'))!==fb);
  await p.keyboard.press('Escape');await p.click('[data-a=go][data-t=supplies]');await p.click('[data-a=supopen][data-id=FLY][data-act=manage]');ok('no edit tab in tabs',!(await p.locator('.tabs [data-v=edit]').count())&&await p.locator('[data-a=supedit]').count()===1);await p.screenshot({path:'sp_gear.png'});await p.keyboard.press('Escape');
  await p.click('[data-a=go][data-t=config]');await p.click('[data-a=supconf][data-id=FLY]');ok('config opens edit form',await p.locator('input[data-f=name]').count()===1);await p.click('[data-a=closesheet]');
  // today alert + mobile
  await p.keyboard.press('Escape');
  await p.setViewportSize({width:400,height:800});await p.click('[data-a=go][data-t=supplies]');
  ok('mobile no overflow',(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=0);
  await p.click('[data-a=supnew]');await p.screenshot({path:'sp_m_new.png'});
  console.log(pass+' passed, '+fail+' failed');console.log(errs.join('\n')||'ERRORS: none');await b.close();
})();
