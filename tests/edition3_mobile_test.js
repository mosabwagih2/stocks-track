// Phone layout checks (390x844) and a desktop non-regression check, using the same viewport meta the artifact host adds.
const { chromium, devices } = require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();
  const app=process.env.APP||path.resolve(__dirname,'../apps/edition-3/index.html');
  const wrap='/tmp/_e3_mobile_wrap.html';
  fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  let pass=0,fail=0;const ok=(l,c,x)=>{console.log((c?'PASS ':'FAIL ')+l+(c||!x?'':'  -> '+x));c?pass++:fail++};
  const open=async(ctxOpts)=>{const ctx=await b.newContext(ctxOpts);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
    await p.route('**/xlsx.full.min.js',r=>r.fulfill({body:fs.existsSync('/tmp/xlsx.min.js')?fs.readFileSync('/tmp/xlsx.min.js'):'',contentType:'application/javascript'}));
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(500);return {p,errs}};
  // ---- phone
  const {p,errs}=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  const tabs=['today','stock','supplies','ops','insights','orders','ledger','files','config'];
  for(const t of tabs){await p.evaluate(t=>__F.go(t),t);await p.waitForTimeout(120);
    const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
    ok('phone: no sideways page scroll on '+t,o.sw<=o.cw,o.sw+' > '+o.cw)}
  for(const it of ['over','rate','demand','plan','stuck','team','health']){await p.evaluate(it=>{__F.UI.ins=it;__F.go('insights')},it);await p.waitForTimeout(100);
    const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));ok('phone: no sideways page scroll on insights/'+it,o.sw<=o.cw,o.sw+' > '+o.cw)}
  const vis=await p.evaluate(()=>[...document.querySelectorAll('.rail .nav')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.textContent.trim().replace(/\d+$/,'')));
  ok('phone: bottom bar has exactly 5 entries (4 main + More)',vis.length===5&&/المزيد/.test(vis[4]||''),JSON.stringify(vis));
  const bar=await p.evaluate(()=>{const r=document.querySelector('.rail').getBoundingClientRect();return {l:r.left,r:r.right,w:innerWidth}});ok('phone: bottom bar fits the screen',bar.l>=0&&bar.r<=bar.w+1,JSON.stringify(bar));
  await p.evaluate(()=>__F.go('today'));await p.click('.nav.more');await p.waitForSelector('.sheet.compact');
  const items=await p.locator('.sheet .op').allInnerTexts();ok('phone: More sheet lists supplies, analytics, ledger, files, settings',items.length===5,items.join('|'));
  await p.click('.sheet .op[data-t=insights]');await p.waitForTimeout(150);
  ok('phone: More -> Analytics navigates and closes the sheet',(await p.evaluate(()=>__F.UI.tab))==='insights'&&!(await p.locator('.sheet').count()));
  ok('phone: More is highlighted while on a secondary page',await p.evaluate(()=>document.querySelector('.nav.more').getAttribute('aria-current')==='page'));
  await p.evaluate(()=>{__F.UI.s.view='all';__F.go('stock')});await p.waitForTimeout(150);
  const mx=await p.evaluate(()=>[...document.querySelectorAll('.tw')].filter(t=>t.querySelector('.mx')).slice(0,6).map(t=>t.scrollWidth<=t.clientWidth+1));
  ok('phone: stock matrix shows all sizes without sideways scroll (first 6 models)',mx.length>0&&mx.every(Boolean),JSON.stringify(mx));
  const cells=await p.evaluate(()=>[...document.querySelectorAll('.mx .cell')].slice(0,40).map(c=>{const r=c.getBoundingClientRect();return [r.width,r.height]}));
  ok('phone: matrix cells are tappable (>=28 wide, >=40 tall)',cells.every(c=>c[0]>=28&&c[1]>=40),JSON.stringify(cells.find(c=>!(c[0]>=28&&c[1]>=40))));
  const fs16=await p.evaluate(()=>{__F.go('orders');return [...document.querySelectorAll('input:not([type=checkbox]):not([type=file]),select,textarea')].filter(e=>e.offsetParent).map(e=>parseFloat(getComputedStyle(e).fontSize))});
  ok('phone: form fields are 16px (iOS does not zoom on focus)',fs16.length>0&&fs16.every(v=>v>=16),JSON.stringify(fs16));
  const btn=await p.evaluate(()=>[...document.querySelectorAll('#main .btn')].filter(e=>e.offsetParent&&!e.classList.contains('sm')).map(e=>e.getBoundingClientRect().height));
  ok('phone: main buttons are at least 40px tall',btn.length>0&&btn.every(h=>h>=40),JSON.stringify(btn.filter(h=>h<40)));
  const cols=await p.evaluate(()=>{const t=document.querySelector('.ordtbl');return [...t.querySelectorAll('thead th')].filter(e=>getComputedStyle(e).display!=='none').length});
  ok('phone: orders table keeps code, pieces and status (4 columns incl. checkbox)',cols===4,String(cols));
  ok('phone: no page errors',errs.length===0,errs.join(' | '));
  // ---- desktop must stay the same
  const d=await open({viewport:{width:1280,height:800}});
  const dn=await d.p.evaluate(()=>({vis:[...document.querySelectorAll('.rail .nav')].filter(e=>getComputedStyle(e).display!=='none').length,more:getComputedStyle(document.querySelector('.nav.more')).display,rail:document.querySelector('.rail').getBoundingClientRect().width}));
  ok('desktop: all 9 sidebar entries, no More button, 224px sidebar',dn.vis===9&&dn.more==='none'&&Math.round(dn.rail)===224,JSON.stringify(dn));
  await d.p.evaluate(()=>__F.go('orders'));const dc=await d.p.evaluate(()=>[...document.querySelectorAll('.ordtbl thead th')].filter(e=>getComputedStyle(e).display!=='none').length);
  ok('desktop: orders table still has all 7 columns',dc===7,String(dc));
  ok('desktop: no page errors',d.errs.length===0,d.errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
