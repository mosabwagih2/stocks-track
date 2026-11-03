const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T23:50:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  const txt=async s=>((await p.textContent(s||'#app'))||'').replace(/\s+/g,' ');
  const S=()=>p.evaluate(()=>__F.S().date);
  ok('day starts 2026-11-02 (23:50 Cairo)',(await S())==='2026-11-02');
  ok('Today shows 92 requested',/92/.test(await txt()));
  ok('no raw editable date on Today (view-only picker has max=today)',await p.getAttribute('#wd','max')==='2026-11-02');
  // 00:05 next day
  await p.evaluate(()=>{window.__fixed=new Date('2026-11-03T00:05:00+02:00').getTime();document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(150);
  ok('auto rollover to 2026-11-03',(await S())==='2026-11-03');
  ok('toast "يوم جديد"',/يوم جديد/.test(await txt('body')));
  ok('Today now has no pickup for the new day',/مفيش بيك أب في اليوم ده/.test(await txt()));
  ok('carried-over banner (92 orders from 2026-11-02)',/92/.test(await txt('.msg.warn'))&&/2026-11-02/.test(await txt('.msg.warn')));
  // upload sheet date locked to today
  await p.click('[data-a=upload][data-t=pickup]');
  ok('pickup date locked to today with "تغيير"',/2026-11-03/.test(await txt('.sheet'))&&await p.locator('.sheet input[type=date]').count()===0);
  await p.click('[data-a=updtunlock]');ok('unlock shows date input max=today',await p.getAttribute('.sheet input[type=date]','max')==='2026-11-03');
  await p.fill('.sheet input[type=date]','2026-11-05');await p.dispatchEvent('.sheet input[type=date]','change');
  ok('future date clamped to today',await p.inputValue('.sheet input[type=date]')==='2026-11-03');
  await p.keyboard.press('Escape');
  // view previous day (read-only)
  await p.click('[data-a=vdset]');ok('viewing previous day pill',/بتعرض يوم سابق/.test(await txt())&&/92/.test(await txt()));
  await p.click('[data-a=vdtoday]');ok('back to today',!/بتعرض يوم سابق/.test(await txt()));
  // scan on new day -> doc date is today
  await p.click('[data-a=go][data-t=orders]');await p.click('[data-a=upload][data-t=scan]');await p.setInputFiles('#upfile',require('path').resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv'));await p.fill('#upemp','عبدالله');await p.click('[data-a=scansave]');await p.waitForTimeout(250);
  ok('scan doc dated today (2026-11-03)',await p.evaluate(()=>__F.S().docs.filter(d=>d.type==='SCN')[0].date)==='2026-11-03');
  // doc date limits
  await p.click('[data-a=go][data-t=ops]');await p.click('[data-a=newop][data-t=CLN]');
  ok('doc date min/max attrs',await p.getAttribute('input[data-c=hdate]','max')==='2026-11-03'&&await p.getAttribute('input[data-c=hdate]','min')==='2026-10-31');
  await p.evaluate(()=>{document.querySelector('input[data-c=hdate]').value='2026-10-20';document.querySelector('input[data-c=hdate]').dispatchEvent(new Event('change',{bubbles:true}))});await p.waitForTimeout(100);
  ok('too-old doc date rejected',await p.evaluate(()=>__F.S().docs.slice(-1)[0].date)==='2026-11-03');
  // terminology
  await p.click('[data-a=backops]');await p.click('[data-a=go][data-t=orders]');ok('new term: اتشحن',/اتشحن/.test(await txt())&&!/اتسكّن/.test(await txt()));
  // mid-edit rollover is deferred
  await p.click('[data-a=go][data-t=ops]');await p.click('[data-a=newop][data-t=RCV]');
  await p.evaluate(()=>{window.__fixed=new Date('2026-11-04T00:01:00+02:00').getTime();document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(100);
  ok('date advanced but open document not wiped',(await S())==='2026-11-04'&&await p.locator('[data-a=addline]').count()===1);
  console.log(pass+' passed, '+fail+' failed');console.log(errs.join('\n')||'ERRORS: none');await b.close();
})();
