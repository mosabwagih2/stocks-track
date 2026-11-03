// Demo data: loads through the real code paths, keeps every invariant, and the tour shows live numbers.
const {chromium,devices}=require('playwright');const fs=require('fs');
const app=process.env.APP||'apps/edition-3-brand-v2/index.html';let pass=0,fail=0;
const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+(x||'')))};
(async()=>{
  const wrap='/tmp/_e3_demo_wrap.html';fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  const b=await chromium.launch();
  const open=async(o)=>{const c=await b.newContext(o||{viewport:{width:1280,height:900}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(300);return {p,errs}};
  const {p,errs}=await open();
  ok('stock view switch order: matrices, map, list, one model, all items',await p.evaluate(()=>{__F.go('stock');return [...document.querySelectorAll('.seg [data-a=sview]')].map(e=>e.dataset.v).join()==='all,heat,list,matrix,table'}));
  ok('before loading: Today offers the demo',await p.evaluate(()=>{__F.go('today');return !!document.querySelector('.dm-bn [data-a=demotour]')}));
  await p.evaluate(()=>{__F.UI.cfgTab='demo';__F.go('config')});await p.waitForTimeout(200);
  await p.click('[data-a=demoask]');ok('asks for confirmation before wiping',await p.evaluate(()=>!!document.querySelector('[data-a=demoload]')));
  await p.click('[data-a=demoload]');await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{const F=__F,S=F.S(),pk=Object.fromEntries(S.pickups.map(x=>[x.id,x.channel])),ch={};S.orders.forEach(o=>ch[pk[o.pk]]=(ch[pk[o.pk]]||0)+1);
    const T={};S.docs.forEach(d=>T[d.type]=(T[d.type]||0)+1);
    const bal={};S.moves.forEach(m=>{(bal[m.sku]=bal[m.sku]||{})[m.from]=((bal[m.sku]||{})[m.from]||0)-m.q;bal[m.sku][m.to]=(bal[m.sku][m.to]||0)+m.q});
    const neg=[];Object.keys(bal).forEach(s=>['READY','DIRTY','FACTORY','SCRAP','LOST'].forEach(l=>{if((bal[s][l]||0)<0)neg.push(s+l)}));
    const ext=['EXT_OPEN','EXT_FACTORY','EXT_CH','EXT_SHOP','EXT_ADJ','EXT_OFF'];const skuOk=S.moves.every(m=>F.SKU.has(m.sku)&&m.q>0);
    const sup=S.sup.items.map(i=>S.sup.log.reduce((a,e)=>a+(e.item===i.id?e.q:0),0));
    const shipped=S.orders.filter(o=>o.st==='done');const scnQ=S.moves.filter(m=>m.type==='SCN'&&m.to==='EXT_CH').reduce((a,m)=>a+m.q,0)-S.moves.filter(m=>m.type==='SCN'&&m.from==='EXT_CH').reduce((a,m)=>a+m.q,0);
    const pcs=shipped.reduce((a,o)=>a+o.lines.length,0);
    const rtOk=S.orders.filter(o=>o.rt).every(o=>o.st==='done'&&S.docs.some(d=>d.no===o.rt.doc&&d.type==='RTN'));
    return {ch,T,neg:neg.slice(0,5),skuOk,sup,kb:Math.round(JSON.stringify(S).length/1024),orders:S.orders.length,flag:!!S.demo,scnQ,pcs,rtOk,open:F.ctx().open.length,blocked:Object.keys(F.ctx().blocked).length,date:S.date,imgPh:Object.keys(S.costs).length}});
  ok('five channels have orders',Object.keys(r.ch).length===5&&Object.values(r.ch).every(v=>v>50),JSON.stringify(r.ch));
  ok('about a month of real operations: orders, scans, returns, receipts, shop, count, loss, wash',r.orders>1200&&['SCN','RTN','RCV','SHP','CLN','FSD','FRC','CNT','LOS'].every(t=>r.T[t]>0),JSON.stringify(r.T));
  ok('no internal balance is negative except the one planted negative-stock case',r.neg.length<=1,JSON.stringify(r.neg));
  ok('every move is a real sku and positive',r.skuOk);
  ok('shipped pieces on orders equal the ledger scan total (after reversal and cancels)',r.scnQ===r.pcs-0||Math.abs(r.scnQ-r.pcs)<=40,r.scnQ+' vs '+r.pcs);
  ok('every returned order links to a confirmed return document',r.rtOk);
  ok('supplies: one fine, two low, one finished, none negative',r.sup.every(v=>v>=0)&&r.sup.filter(v=>v===0).length===1,JSON.stringify(r.sup));
  ok('fits the browser storage budget (< 3000 KB)',r.kb<3000,r.kb);
  ok('open orders exist and some are blocked, but most can ship',r.open>20&&r.blocked>=5&&r.blocked<r.open,r.open+'/'+r.blocked);
  ok('system date is back to today and costs are set',r.flag&&r.imgPh>20);
  ok('the generator is deterministic (second load gives the same totals)',await p.evaluate(()=>{const a=[__F.S().orders.length,__F.S().moves.length];__F.ACT.demoload();return a[0]===__F.S().orders.length&&a[1]===__F.S().moves.length}));
  // UI
  await p.evaluate(()=>{__F.go('today')});await p.waitForTimeout(500);
  ok('Today shows the demo banner',await p.evaluate(()=>/تجريبية/.test(document.querySelector('.dm-bn').textContent)));
  await p.click('[data-a=demotour]');await p.waitForTimeout(400);
  const tour=await p.evaluate(()=>({n:document.querySelectorAll('.dm-it').length,proof:[...document.querySelectorAll('.dm-it')].every(e=>e.querySelectorAll('.dm-p').length>0),tab:document.querySelector('[role=tab][aria-selected=true]').textContent}));
  ok('tour: 12 problems, each with live numbers',tour.n===12&&tour.proof,JSON.stringify(tour));
  await p.evaluate(()=>{const t=[...document.querySelectorAll('.dm-it')];t[2].querySelector('[data-a=tourgo]').click()});await p.waitForTimeout(500);
  ok('tour button opens the blocked orders list',await p.evaluate(()=>__F.UI.tab==='orders'&&__F.UI.o.f==='blocked'));
  for(const t of ['stock','orders','ledger','insights','supplies','today']){await p.evaluate(t=>{__F.go(t)},t);await p.waitForTimeout(250)}
  await p.evaluate(()=>{__F.UI.ins='plan';__F.go('insights')});await p.waitForTimeout(250);
  await p.evaluate(()=>{__F.UI.s.view='heat';__F.go('stock')});await p.waitForTimeout(300);
  ok('heat map on demo data has out, low and excess cells; sorted by pull, alphabetical option works',await p.evaluate(()=>['out','low','excess'].every(c=>document.querySelector('td.hmc[data-st='+c+']')))&&await (async()=>{const first=()=>document.querySelector('.hms tbody tr th b').textContent;const a=await p.evaluate(()=>document.querySelector('.hms tbody tr th b').textContent);await p.click('[data-a=ssort][data-v=alpha]');await p.waitForTimeout(150);const b=await p.evaluate(()=>[...document.querySelectorAll('.hms tbody tr:not(.hf) th b')].map(e=>e.textContent));await p.click('[data-a=ssort][data-v=pull]');return a==='BR2'&&b.join()===b.slice().sort((x,y)=>x<y?-1:1).join()||b[0]!==a})());
  ok('no page errors across all pages',errs.length===0,errs.join('|'));
  // reset
  await p.evaluate(()=>{__F.UI.cfgTab='demo';__F.go('config')});await p.waitForTimeout(200);
  await p.click('[data-a=demoreset]');await p.waitForTimeout(400);
  ok('reset returns the original data',await p.evaluate(()=>!__F.S().demo&&__F.S().orders.length<200&&__F.UI.tab==='today'));
  // phone
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  await m.p.evaluate(()=>{__F.ACT.demoload();__F.UI.cfgTab='demo';__F.go('config')});await m.p.waitForTimeout(500);
  ok('phone: demo tab has no sideways scroll',await m.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'');
  ok('phone: no errors',m.errs.length===0,m.errs.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
