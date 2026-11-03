const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:700}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  await p.click('[data-a=go][data-t=stock]');
  await p.evaluate(()=>window.scrollTo(0,500));const y0=await p.evaluate(()=>window.scrollY);
  await p.click('.top [data-a=catedit]');await p.waitForSelector('.sheet');await p.waitForTimeout(400);
  await p.evaluate(()=>window.scrollTo(0,400));const y1=await p.evaluate(()=>window.scrollY);
  await p.evaluate(()=>{document.querySelector('#main').__mark=1});
  await p.selectOption('[data-c=catm]','BR2');await p.waitForTimeout(100);
  // scroll sheet body down, then toggle a cell
  await p.evaluate(()=>{const b=document.querySelector('.sheet .body');b.scrollTop=300});const s0=await p.evaluate(()=>document.querySelector('.sheet .body').scrollTop);
  await p.evaluate(()=>{document.querySelector('.sheet').__mark=1});
  await p.fill('#catnc','موف');await p.click('[data-a=cataddc]');await p.waitForTimeout(150);
  const s1=await p.evaluate(()=>document.querySelector('.sheet .body').scrollTop);
  ok('sheet scroll position kept ('+s0+' -> '+s1+')',s0>0&&Math.abs(s1-s0)<=2);
  ok('animation not replayed (keep class)',await p.evaluate(()=>document.querySelector('.sheet').classList.contains('keep')));
  ok('background page not re-rendered (same #main node)',await p.evaluate(()=>!!document.querySelector('#main').__mark));
  ok('background scroll unchanged',y1>0&&Math.abs(await p.evaluate(()=>window.scrollY)-y1)<=2);
  // toggling a new cell keeps focus + scroll
  await p.focus('.cell.tg.new >> nth=0');await p.click('.cell.tg.new >> nth=0');await p.waitForTimeout(120);
  ok('focus restored on same control',await p.evaluate(()=>document.activeElement&&document.activeElement.matches('[data-a=catcell]')));
  ok('scroll still kept after toggle',Math.abs(await p.evaluate(()=>document.querySelector('.sheet .body').scrollTop)-s0)<=2);
  await p.keyboard.press('Escape');await p.waitForTimeout(100);
  ok('sheet closes',await p.locator('.sheet').count()===0);
  console.log(pass+' passed, '+fail+' failed');console.log(errs.join('\n')||'ERRORS: none');await b.close();
})();
