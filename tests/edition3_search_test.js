const { chromium, devices } = require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();
  const app=process.env.APP||path.resolve(__dirname,'../apps/edition-3/index.html');
  const wrap='/tmp/_e3_search_wrap.html';
  fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  let pass=0,fail=0;const ok=(l,c,x)=>{console.log((c?'PASS ':'FAIL ')+l+(c||!x?'':'  -> '+x));c?pass++:fail++};
  const open=async(o)=>{const ctx=await b.newContext(o);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.evaluate(()=>__F.go('stock'));await p.waitForTimeout(250);return {p,errs}};
  const {p,errs}=await open({viewport:{width:1280,height:900}});
  const type=async t=>{await p.fill('#sq','');await p.type('#sq',t,{delay:15});await p.waitForTimeout(120)};
  const cards=()=>p.locator('#stres section.card h2').allInnerTexts();
  const total=(await cards()).length;ok('search bar shows in "all models"',(await p.locator('#sq').count())===1&&total>20,'cards '+total);
  await type('BR2');let c=await cards();ok('"BR2" leaves only BR2',c.length===1&&/BR2/.test(c[0]),JSON.stringify(c));
  ok('typing keeps focus and value',await p.evaluate(()=>document.activeElement.id==='sq'&&document.querySelector('#sq').value==='BR2'));
  await type('بانتي');c=await cards();ok('model name search ("بانتي") finds all PAN models',c.length>=5&&c.every(x=>/PAN/.test(x)),JSON.stringify(c));
  await type('BR2 احمر L');
  const hits=await p.evaluate(()=>({hit:[...document.querySelectorAll('.cell.hit')].map(e=>e.getAttribute('aria-label')),dim:document.querySelectorAll('.cell.dim').length,all:document.querySelectorAll('.mx .cell').length}));
  ok('"BR2 احمر L" highlights exactly one cell and dims the rest',hits.hit.length===1&&/BR2 · احمر · L/.test(hits.hit[0])&&hits.dim===hits.all-1,JSON.stringify(hits));
  await type('احمر');hits.x=await p.evaluate(()=>({n:[...document.querySelectorAll('#stres section.card')].length,hit:document.querySelectorAll('.cell.hit').length}));
  ok('a color alone finds every model that has it, highlighting that row',hits.x.n>5&&hits.x.hit>5,JSON.stringify(hits.x));
  await type('زيتي');c=await cards();ok('Arabic spelling variants match (زيتي = زيتى)',c.length>=2&&c.some(x=>/D1|D2|A12/.test(x)),JSON.stringify(c));
  await type('qqqqq');ok('no result shows a message and a clear button',/مفيش نتيجة/.test(await p.locator('#stres').innerText())&&(await p.locator('#stres [data-a=sqclear]').count())===1);
  await p.click('#stres [data-a=sqclear]');await p.waitForTimeout(200);
  ok('clear restores every model and refocuses the box',(await cards()).length===total&&await p.evaluate(()=>document.activeElement.id==='sq'));
  ok('clear (✕) button is hidden when the box is empty',await p.evaluate(()=>document.querySelector('.srch-x').hidden));
  await type('BR2');ok('clear (✕) button appears while typing',!(await p.evaluate(()=>document.querySelector('.srch-x').hidden)));
  // survives navigation (shared query) and other re-renders
  await p.evaluate(()=>{__F.UI.s.sort='alpha';__F.render()});await p.waitForTimeout(150);
  ok('query survives a re-render (sort change)',(await cards()).length===1&&await p.evaluate(()=>document.querySelector('#sq').value==='BR2'));
  // single-model view
  await p.fill('#sq','');await p.evaluate(()=>{__F.UI.s.q='';__F.UI.s.view='matrix';__F.render()});await p.waitForTimeout(150);
  const listAll=await p.locator('.mlist .mi').count();await type('SH2');
  const lst=await p.locator('.mlist .mi').allInnerTexts();const title=await p.locator('#stres section.card h2').first().innerText();
  ok('single-model view: list narrows and shows the first match',lst.length>=1&&lst.length<listAll&&/SH2/.test(title),lst.length+' of '+listAll+' | '+title);
  // table view
  await p.fill('#sq','');await p.evaluate(()=>{__F.UI.s.q='';__F.UI.s.view='table';__F.render()});await p.waitForTimeout(150);
  ok('table view has exactly one search box',(await p.locator('#sq').count())===1);
  await type('BR2 L');const rows=await p.locator('#stres tbody tr').allInnerTexts();
  ok('table: size "L" matches L only, not XL/2XL',rows.length>0&&rows.every(r=>/BR2/.test(r)&&/· L\b/.test(r.replace(/\s+/g,' '))&&!/XL/.test(r.split('\n')[0]||'')),rows.length+' rows; first: '+(rows[0]||'').replace(/\s+/g,' '));
  await type('BR2 احمر');const r2=await p.locator('#stres tbody tr').count();ok('table: model + color narrows to 7 sizes',r2===7,String(r2));
  ok('no page errors (desktop)',errs.length===0,errs.join(' | '));
  // phone
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  const box=await m.p.evaluate(()=>{const e=document.querySelector('#sq'),r=e.getBoundingClientRect();return {w:r.width,fs:parseFloat(getComputedStyle(e).fontSize),h:r.height,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}});
  ok('phone: search box is full width, 16px font, tall enough, no sideways scroll',box.w>330&&box.fs>=16&&box.h>=40&&box.sw<=box.cw,JSON.stringify(box));
  await m.p.fill('#sq','BR2 احمر L');await m.p.waitForTimeout(150);
  ok('phone: highlight works',(await m.p.locator('.cell.hit').count())===1);
  ok('no page errors (phone)',m.errs.length===0,m.errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
