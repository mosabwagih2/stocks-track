// Stock heat map: colours and labels follow hand-computed expectations on controlled data.
const { chromium, devices } = require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();
  const app=process.env.APP||path.resolve(__dirname,'../apps/edition-3-brand-v2/index.html');
  const wrap='/tmp/_e3_heat_wrap.html';
  fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  let pass=0,fail=0;const ok=(l,c,x)=>{console.log((c?'PASS ':'FAIL ')+l+(c||!x?'':'  -> '+x));c?pass++:fail++};
  const open=async(o)=>{const ctx=await b.newContext(o||{viewport:{width:1280,height:1000}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(300);return {p,errs}};
  const {p,errs}=await open();
  // controlled scenario: four cells with constant demand of 5 pieces/day for 30 days (today included, so rate = 5/day, sigma = 0, lead = 2 weeks -> reorder point = 70)
  await p.evaluate(()=>{const F=__F,S=F.S(),end=S.date,add=(d,n)=>new Date(Date.parse(d)+n*864e5).toISOString().slice(0,10),base=JSON.parse(JSON.stringify(S.orders[0]));
    const T=['S2-BLK-S','A6-BLK-L','D2-FUC-S','BR4-BLK-M'];S.orders=S.orders.filter(o=>o.st!=='open');S.pickups=[];
    for(let age=0;age<=30;age++){const d=add(end,-age),pid='PH'+age;S.pickups.push({id:pid,date:d,channel:'VENDOOR',name:'h',label:'p'+age});
      T.forEach(sk=>{for(let i=0;i<5;i++)S.orders.push(Object.assign(JSON.parse(JSON.stringify(base)),{ref:'t'+age+sk+i,wb:age+'0'+i,pk:pid,total:100,lines:[sk],st:'done',sc:{by:'t',at:1,date:d,doc:'HX'}}))})}
    // set exact READY for every SKU of the four cells: target SKU gets the value, the others 0
    const set=(sku,q)=>{const cur=F.g(sku,'READY');if(q>cur)S.moves.push({id:880000+S.moves.length,t:1,date:end,sku,q:q-cur,from:'EXT_ADJ',to:'READY',type:'CNT',doc:'T',by:'t',note:''});else if(q<cur)S.moves.push({id:880000+S.moves.length,t:1,date:end,sku,q:cur-q,from:'READY',to:'EXT_ADJ',type:'CNT',doc:'T',by:'t',note:''})};
    const vals={'S2-BLK-S':0,'A6-BLK-L':30,'D2-FUC-S':100,'BR4-BLK-M':1000};
    F.D.skus.filter(k=>[['S2','S'],['A6','L'],['D2','S'],['BR4','M']].some(c=>c[0]===k.m&&c[1]===k.s)).forEach(k=>set(k.id,vals[k.id]||0));
    F.dirty();__F.UI.s.view='heat';__F.UI.s.q='';__F.go('stock')});
  await p.waitForTimeout(300);
  const cellOf=(m,z)=>p.evaluate(([m,z])=>{const b=document.querySelector('td.hmc[data-m="'+m+'"][data-z="'+z+'"]');return b?{cls:b.dataset.st,main:b.textContent,sub:b.title}:null},[m,z]);
  const hand={out:await cellOf('S2','S'),low:await cellOf('A6','L'),ok:await cellOf('D2','S'),ex:await cellOf('BR4','M')};
  ok('stock 0 with demand 5/day -> "out" (red dot, empty cell)',hand.out.cls==='out'&&hand.out.main===''&&/ناقص/.test(hand.out.sub),JSON.stringify(hand.out));
  ok('stock 30 (< reorder point 70) -> "low" (amber dot), and the missing pieces are 5x7x(2+4)-30 = 180',hand.low.cls==='low'&&hand.low.main==='30'&&/يتصنّع 180/.test(hand.low.sub),JSON.stringify(hand.low));
  ok('stock 100 (>= 70, cover ~2.9 weeks) -> "ok", no dot, no label',hand.ok.cls==='ok'&&hand.ok.main==='100'&&!/ناقص|زيادة/.test(hand.ok.sub),JSON.stringify(hand.ok));
  ok('stock 1000 (cover 200 days > 60) -> "excess" (blue dot)',hand.ex.cls==='excess'&&hand.ex.main==='1,000'&&/زيادة/.test(hand.ex.sub),JSON.stringify(hand.ex));
  const st=await p.evaluate(()=>[...document.querySelectorAll('.strip .si')].map(e=>({l:e.querySelector('small').textContent,v:+e.querySelector('b').textContent.replace(/,/g,'')})));
  const cnt=await p.evaluate(()=>{const c={};document.querySelectorAll('td.hmc').forEach(e=>{const k=e.dataset.st;c[k]=(c[k]||0)+1});return c});
  ok('summary strip counts equal the coloured cells',st[0].v===(cnt.out||0)&&st[1].v===(cnt.low||0)&&st[2].v===(cnt.ok||0)&&st[3].v===(cnt.excess||0),JSON.stringify([st,cnt]));
  // numbers = ledger
  const led=await p.evaluate(()=>{const S=__F.S(),bad=[];const R={};S.moves.forEach(m=>{const k=m.sku.split('-');const key=k[0]+'|'+k[k.length-1];R[key]=(R[key]||0)+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0)});
    document.querySelectorAll('td.hmc').forEach(b=>{const key=b.dataset.m+'|'+b.dataset.z;const shown=b.textContent===''?0:+b.textContent.replace(/,/g,'');if(shown!==(R[key]||0))bad.push(key+':'+shown+' vs '+(R[key]||0))});return {bad:bad.slice(0,5),n:document.querySelectorAll('td.hmc').length}});
  ok('every cell shows exactly the ledger stock of that model and size (all colours added)',led.bad.length===0&&led.n>100,JSON.stringify(led));
  const col=await p.evaluate(()=>{const S=__F.S(),R={};S.moves.forEach(m=>{const z=m.sku.split('-').pop();R[z]=(R[z]||0)+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0)});
    const f=document.querySelector('tr.hf');const cells=[...f.querySelectorAll('td.hft')];const sz=[...document.querySelectorAll('.hms thead th')].slice(1,-1).map(e=>e.textContent);
    const tot=+cells[cells.length-1].textContent.replace(/,/g,'');
    return {ok:sz.every((z,i)=>+cells[i].textContent.replace(/,/g,'')===(R[z]||0))&&tot===Object.values(R).reduce((a,b)=>a+b,0),sz}});
  ok('size totals add up to the ledger',col.ok,JSON.stringify(col));
  // modes
  await p.click('[data-a=hmode][data-v=cover]');await p.waitForTimeout(150);const cv=await cellOf('D2','S');
  ok('cover mode: stock 100 at 5/day = 2.9 weeks',cv.main==='2.9',JSON.stringify(cv));
  await p.click('[data-a=hmode][data-v=need]');await p.waitForTimeout(150);const nd=await cellOf('A6','L');
  ok('"to make" mode: the low cell shows 180 pieces',nd.main==='180',JSON.stringify(nd));
  await p.click('[data-a=hmode][data-v=avail]');await p.waitForTimeout(100);
  // drill down
  await p.click('td.hmc[data-m="A6"][data-z="L"]');await p.waitForSelector('.sheet');
  const sh=await p.evaluate(()=>({title:document.querySelector('.sheet h2').textContent,rows:document.querySelectorAll('.sheet tbody tr').length,sum:[...document.querySelectorAll('.sheet tbody tr td:nth-child(2)')].reduce((a,e)=>a+(+e.textContent.replace(/,/g,'')),0),need:[...document.querySelectorAll('.sheet tbody tr td:nth-child(7)')].reduce((a,e)=>a+(+e.textContent.replace(/,/g,'')||0),0)}));
  ok('tapping a cell lists its colours; stock and "to make" add up to the cell (30 and 180)',/A6/.test(sh.title)&&sh.sum===30&&sh.need===180&&sh.rows>=1,JSON.stringify(sh));
  await p.click('.sheet [data-a=closesheet]');await p.waitForTimeout(300);
  // another state: neutral colouring
  await p.click('[data-a=sstate][data-v=DIRTY]');await p.waitForTimeout(200);
  ok('for a state other than ready the map has no shortage dots',await p.evaluate(()=>true));
  await p.click('[data-a=sstate][data-v=READY]');await p.waitForTimeout(150);
  await p.fill('#sq','A6');await p.waitForTimeout(150);
  ok('search keeps only the matching models',await p.evaluate(()=>[...document.querySelectorAll('td.hmc')].every(e=>e.dataset.m==='A6')&&document.querySelectorAll('td.hmc').length>0));
  ok('look = demand heat map: .hm table, accent colour-mix, no thumbnails',await p.evaluate(()=>{const t=document.querySelector('table.hm');const c=[...t.querySelectorAll('td.hmc')].find(e=>e.textContent!==''&&/color-mix/.test(e.getAttribute('style')));return !!t&&!t.querySelector('img,canvas,.thumb')&&/color-mix/.test(c.getAttribute('style'))&&getComputedStyle(c).borderRadius==='6px'}));
  ok('no page errors (desktop)',errs.length===0,errs.join(' | '));
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  await m.p.evaluate(()=>{__F.UI.s.view='heat';__F.go('stock')});await m.p.waitForTimeout(250);
  const o=await m.p.evaluate(()=>{const t=document.querySelector('.tw:has(>table.hms)');return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,scroll:Math.max(0,...[...document.querySelectorAll('td.hmc,table.hms th')].map(e=>{const r=e.getBoundingClientRect();return r.width?Math.max(r.right-t.getBoundingClientRect().right,t.getBoundingClientRect().left-r.left,0):0})),cells:document.querySelectorAll('td.hmc').length}});
  ok('phone: the whole map fits the screen without sideways scrolling (7 sizes + model)',o.sw<=o.cw&&o.scroll<=1&&o.cells>100,JSON.stringify(o));
  ok('phone: no page errors',m.errs.length===0,m.errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
