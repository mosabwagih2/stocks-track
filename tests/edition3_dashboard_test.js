// Dashboard: every number is checked against an independent calculation on a long synthetic history.
const { chromium, devices } = require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();
  const app=process.env.APP||path.resolve(__dirname,'../apps/edition-3/index.html');
  const wrap='/tmp/_e3_dash_wrap.html';
  fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  let pass=0,fail=0;const ok=(l,c,x)=>{console.log((c?'PASS ':'FAIL ')+l+(c||!x?'':'  -> '+x));c?pass++:fail++};
  const open=async(o)=>{const ctx=await b.newContext(o||{viewport:{width:1280,height:900}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(300);return {p,errs}};
  const {p,errs}=await open();
  // ---- fresh state (one day of data): graceful, no blank charts
  await p.evaluate(()=>__F.go('insights'));await p.waitForTimeout(200);
  ok('dashboard is the first analytics tab and opens by default',await p.evaluate(()=>__F.UI.ins==='dash'&&document.querySelector('.tabs button[aria-selected=true]').textContent.trim()==='لوحة القيادة'));
  let txt=await p.locator('#main').innerText();
  ok('fresh data: explains the short history instead of drawing empty charts',/عندنا \d+ يوم بيانات/.test(txt));
  ok('fresh data: top-10 falls back to demand and says so',/الترتيب حسب الطلب/.test(txt)&&(await p.locator('#main .hb').count())>=8);
  const tiles=await p.locator('#main .kpi').count();ok('14 tiles in three groups (5 money, 5 movement, 4 health)',tiles===14,String(tiles));
  // ---- long history
  await p.evaluate(()=>{const F=__F,S=F.S(),end=S.date,add=(d,n)=>new Date(Date.parse(d)+n*864e5).toISOString().slice(0,10);
    const base=JSON.parse(JSON.stringify(S.orders[0]));let id=900000;const skus=['A6-BLK-L','S2-BLK-S','D2-FUC-S','BR4-BLK-M','SH2-RED-S','PAN5-WHT-L'];
    S.orders=S.orders.filter(o=>o.st!=='open'||true);
    for(let age=1;age<=100;age++){const d=add(end,-age),pid='PH'+age;S.pickups.push({id:pid,date:d,channel:'VENDOOR',name:'h'});
      const n=2+(age*3)%5;for(let i=0;i<n;i++){const o=Object.assign(JSON.parse(JSON.stringify(base)),{ref:'hh'+age+'_'+i,wb:'7'+age+i,pk:pid,total:200+((age*37+i*91)%400),gov:['القاهرة','الجيزة','الغربية','أسوان'][(age+i)%4],lines:[skus[(age+i)%6],skus[(age*2+i)%6]],st:'done',sc:{by:'t',at:Date.now(),date:d,doc:'HX'}});
        S.orders.push(o);o.lines.forEach(sk=>S.moves.push({id:id++,t:Date.now(),date:d,sku:sk,q:1,from:'READY',to:'EXT_CH',type:'SCN',doc:'HX',by:'t',note:''}))}}
    // one return 3 days ago and one 10 days ago
    const r1=S.orders.find(o=>o.ref==='hh3_0'),r2=S.orders.find(o=>o.ref==='hh10_0');
    [[r1,3],[r2,10]].forEach(([o,a])=>{o.rt={doc:'RT'+a,date:add(end,-a+1)};o.lines.forEach(sk=>S.moves.push({id:id++,t:Date.now(),date:add(end,-a+1),sku:sk,q:1,from:'EXT_CH',to:'READY',type:'RTN',doc:'RT'+a,by:'t',note:''}))});
    F.dirty()});
  const calc=(P)=>p.evaluate(P=>{const F=__F,S=F.S();__F.UI.insP=P;__F.dirty();const D=__F.dashData?null:null;return null},P);
  const run=async(P)=>p.evaluate(P=>{const F=__F,S=F.S();F.UI.insP=P;F.dirty();const d=F.dashData();
    // independent calculation straight from the raw data
    const end=S.date,N=P==='all'?d.spanAll:+P,from=P==='all'?d.first:new Date(Date.parse(end)-(N-1)*864e5).toISOString().slice(0,10);
    const pk={};S.pickups.forEach(x=>pk[x.id]=x.date);let dem=0,shipV=0,shipO=0,retV=0;
    S.orders.forEach(o=>{if(o.st!=='cx'&&pk[o.pk]>=from&&pk[o.pk]<=end)dem+=o.lines.length;if(o.sc&&o.st==='done'&&o.sc.date>=from&&o.sc.date<=end){shipV+=+o.total;shipO++}if(o.rt&&o.rt.date>=from&&o.rt.date<=end)retV+=+o.total});
    let ship=0,ret=0;S.moves.forEach(m=>{if(m.date<from||m.date>end)return;if(m.type==='SCN'&&m.from==='READY'&&m.to==='EXT_CH')ship+=m.q;if(m.type==='SCN'&&m.from==='EXT_CH')ship-=m.q;if(m.type==='RTN'&&m.from==='EXT_CH')ret+=m.q});
    return {d:{dem:d.M.dem,shipV:d.M.shipV,shipO:d.M.shipO,retV:d.M.retV,ship:d.M.ship,ret:d.M.ret,hasPrev:d.hasPrev,step:d.step,nb:d.bk.length},x:{dem,shipV,shipO,retV,ship,ret}}},P);
  for(const P of ['7','30','90','all']){const r=await run(P);ok('period '+P+': demand, shipped (pcs and EGP), returns match the raw data',JSON.stringify(r.d.dem)===JSON.stringify(r.x.dem)&&r.d.shipV===r.x.shipV&&r.d.shipO===r.x.shipO&&r.d.retV===r.x.retV&&r.d.ship===r.x.ship&&r.d.ret===r.x.ret,JSON.stringify(r))}
  const r7=await run('7'),r30=await run('30'),r90=await run('90'),rall=await run('all');
  ok('comparison with the previous period appears only when that period is fully covered (7:yes, 30:yes, 90:no, all:no)',r7.d.hasPrev&&r30.d.hasPrev&&!r90.d.hasPrev&&!rall.d.hasPrev,JSON.stringify([r7.d.hasPrev,r30.d.hasPrev,r90.d.hasPrev,rall.d.hasPrev]));
  ok('chart buckets: daily for 30 days, weekly beyond 60 days',r30.d.step===1&&r90.d.step===7&&r90.d.nb<=53,JSON.stringify([r30.d.step,r30.d.nb,r90.d.step,r90.d.nb]));
  // stock level series vs a direct replay of the ledger
  const lv=await p.evaluate(()=>{const F=__F,S=F.S();F.UI.insP='30';F.dirty();const d=F.dashData();
    const lvlAt=e=>S.moves.reduce((a,m)=>m.date<=e?a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0):a,0);
    return {bad:d.lvl.filter(x=>x.v!==lvlAt(x.e)).map(x=>x.e+':'+x.v+' vs '+lvlAt(x.e)),n:d.lvl.length,last:d.lvl[d.lvl.length-1].v,now:d.nowR}});
  ok('stock-level series equals a direct replay of the ledger on every bucket',lv.bad.length===0&&lv.n>10,JSON.stringify(lv));
  ok('latest bucket equals the current READY stock',lv.last===lv.now);
  // top 10
  const t10=await p.evaluate(()=>{const F=__F,S=F.S();F.UI.insP='30';F.dirty();const d=F.dashData();const end=S.date,from=new Date(Date.parse(end)-29*864e5).toISOString().slice(0,10);const sh={};
    S.moves.forEach(m=>{if(m.type==='SCN'&&m.date>=from&&m.date<=end)sh[m.sku]=(sh[m.sku]||0)+(m.from==='READY'?m.q:-m.q)});
    const exp=Object.entries(sh).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>x[1]);return {got:d.top10.map(x=>x[1]),exp,by:d.topBy}});
  ok('top 10 SKUs = independent ranking of pieces shipped, sorted',JSON.stringify(t10.got)===JSON.stringify(t10.exp)&&t10.by==='ship'&&t10.got.length===6,JSON.stringify(t10));
  // blocked value
  const bl=await p.evaluate(()=>{const F=__F,S=F.S();const o=S.orders.find(x=>x.st==='open'&&!x.bad.length);const sku=o.lines[0];const have=F.g(sku,'READY');
    S.moves.push({id:990001,t:Date.now(),date:S.date,sku,q:have,from:'READY',to:'EXT_ADJ',type:'CNT',doc:'T',by:'t',note:''});F.dirty();F.UI.insP='30';const d=F.dashData();const C=F.ctx();
    const exp=S.orders.filter(x=>x.st==='open'&&C.blocked[x.ref]).reduce((a,x)=>a+(+x.total||0),0);return {got:d.blkV,exp,n:d.blk.length,open:d.openV,openExp:S.orders.filter(x=>x.st==='open').reduce((a,x)=>a+(+x.total||0),0)}});
  ok('value of blocked orders and of all waiting orders match the orders',bl.got===bl.exp&&bl.n>0&&bl.open===bl.openExp,JSON.stringify(bl));
  // out-of-stock list == tile == sheet
  await p.evaluate(()=>{__F.UI.insP='30';__F.UI.ins='dash';__F.go('insights')});await p.waitForTimeout(250);
  const oosN=await p.evaluate(()=>__F.dashData().oos.length);
  const tile=await p.locator('#main button.kpi[data-a=oos] b').innerText();
  await p.click('#main button.kpi[data-a=oos]');await p.waitForSelector('.sheet');
  const rows=await p.locator('.sheet tbody tr').count();
  ok('"out of stock with demand": tile, sheet rows and the data agree',+tile===oosN&&rows===Math.min(60,oosN)&&oosN>0,tile+'/'+rows+'/'+oosN);
  await p.click('.sheet [data-a=oosplan]');await p.waitForTimeout(200);ok('sheet action opens the plan tab',await p.evaluate(()=>__F.UI.ins==='plan'&&!document.querySelector('.sheet')));
  // time always runs left (old) to right (new), in every time chart
  const dir=await p.evaluate(()=>{const F=__F;F.UI.ins='dash';F.UI.insP='30';F.dirty();F.go('insights');
    const bars=[...document.querySelectorAll('#main .wk .g,#main .cch .cb')].map(e=>e.getBoundingClientRect().left);
    const pts=[...document.querySelectorAll('#main svg circle[data-tip],#main svg.lnc rect[data-tip]')].map(c=>({x:c.getBoundingClientRect().left,t:c.getAttribute('data-tip').slice(0,10)}));
    const has=v=>!!document.querySelector('.tabs button[data-v="'+v+'"]');F.UI.ins=has('over')?'over':'demand';F.go('insights');const col=[...document.querySelectorAll('#main .col .b,#main .cch .cb')].map(e=>e.getBoundingClientRect().left);
    F.UI.ins=has('rate')?'rate':'plan';F.go('insights');const wk=[...document.querySelectorAll('#main .wk .g')].map(e=>e.getBoundingClientRect().left);
    const inc=a=>a.length>1&&a.every((v,i)=>i===0||v>a[i-1]);
    return {bars:inc(bars),line:inc(pts.map(p=>p.x))&&pts[0].t<pts[pts.length-1].t,col:inc(col),wk:inc(wk),nb:bars.length,np:pts.length}});
  ok('dashboard bars run old (left) to new (right)',dir.bars,JSON.stringify(dir));
  ok('dashboard line chart runs old (left) to new (right) with dates increasing',dir.line,JSON.stringify(dir));
  ok('overview daily chart runs old (left) to new (right)',dir.col,JSON.stringify(dir));
  ok('weekly rate chart runs old (left) to new (right)',dir.wk,JSON.stringify(dir));
  // costs -> stock value and value trend
  await p.evaluate(()=>{const F=__F,S=F.S();['BR2','PAN3','SH2','A6','S2','D2','BR4','PAN5'].forEach(m=>S.costs[m]={cost:100+m.length*7});F.UI.ins='dash';F.UI.insP='30';F.dirty();F.go('insights')});await p.waitForTimeout(250);
  const cv=await p.evaluate(()=>{const F=__F,S=F.S(),d=F.dashData();let exp=0;F.S();for(const k of D_skus()){}function D_skus(){return []}
    const per={};Object.keys(S.costs).forEach(m=>per[m]=S.costs[m].cost);let e=0;const rd=m=>0;
    return {stockV:d.stockV,last:d.lvl[d.lvl.length-1].val,has:d.hasCosts}});
  const exp=await p.evaluate(()=>{const F=__F,S=F.S();let e=0;S.moves.forEach(m=>{const c=+((S.costs[(m.sku.split('-')[0])]||{}).cost)||0;e+=c*((m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0))});return e});
  ok('with costs: stock value equals Σ cost × ready, and the value trend ends on the same number',cv.has&&cv.stockV===exp&&cv.last===exp,JSON.stringify(cv)+' exp '+exp);
  ok('with costs: the value-over-time chart appears',(await p.locator('#main svg').count())>=2);
  // live update: a real scan today changes the dashboard
  const live=await p.evaluate(()=>{const F=__F,S=F.S();const o=S.orders.find(x=>x.st==='open'&&!x.bad.length&&!F.ctx().blocked[x.ref]);F.UI.insP='1';F.dirty();const b0=F.dashData().M;const v0=b0.shipV,p0=b0.ship;
    const d=F.newDoc('SCN');d.hdr={emp:'t',src:'t',refs:[o.ref],times:{}};const ok1=F.confirmDoc(d);F.dirty();const b1=F.dashData().M;return {ok1,dV:b1.shipV-v0,exp:+o.total,dP:b1.ship-p0,pcs:o.lines.length}});
  ok('a real scan today moves "shipped" in EGP and pieces by exactly that order',live.ok1&&live.dV===live.exp&&live.dP===live.pcs,JSON.stringify(live));
  const live2=await p.evaluate(()=>{const F=__F,S=F.S();const o=S.orders.find(x=>x.st==='done'&&x.sc&&x.sc.doc&&x.sc.doc!=='HX'&&!x.rt);F.UI.insP='1';F.dirty();const r0=F.dashData().M;
    const d=F.newDoc('RTN');d.hdr.codes=o.ref;F.ACT.rtnfill();d.hdr.counted=true;d.lines.forEach(l=>l.r=l.exp);F.confirmDoc(d);F.dirty();const r1=F.dashData().M;return {dRet:r1.ret-r0.ret,dRetV:r1.retV-r0.retV,exp:+o.total,pcs:o.lines.length}});
  ok('a real return today moves "returned" pieces and EGP by exactly that order',live2.dRet===live2.pcs&&live2.dRetV===live2.exp,JSON.stringify(live2));
  // render check on every period + no errors
  let bad=[];for(const P of ['1','7','14','30','90','all']){await p.evaluate(P=>{__F.UI.ins='dash';__F.UI.insP=P;__F.dirty();__F.go('insights')},P);await p.waitForTimeout(120);const t=await p.locator('#main').innerText();if(t.length<400||/NaN|undefined|Infinity/.test(t))bad.push(P)}
  ok('every period renders without NaN/undefined',bad.length===0,bad.join());
  ok('no page errors (desktop)',errs.length===0,errs.join(' | '));
  // phone
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  await m.p.evaluate(()=>{__F.UI.ins='dash';__F.UI.insP='30';__F.go('insights')});await m.p.waitForTimeout(300);
  const ov=await m.p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,svgW:[...document.querySelectorAll('#main svg')].map(s=>s.getBoundingClientRect().width)}));
  ok('phone: no sideways scroll on the dashboard',ov.sw<=ov.cw,JSON.stringify(ov));
  ok('phone: no page errors',m.errs.length===0,m.errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
