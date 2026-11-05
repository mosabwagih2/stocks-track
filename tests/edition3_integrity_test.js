// Cross-module integrity: ledger, orders, supplies, returns, cancellations, alerts, persistence.
const { chromium } = require('playwright');
const fs=require('fs');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.route('**/xlsx.full.min.js',r=>r.fulfill({body:fs.readFileSync('/tmp/xlsx.min.js'),contentType:'application/javascript'}));
  const file=process.env.APP||require('path').resolve(__dirname,'../apps/edition-3/index.html');
  await p.goto('file://'+file);await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c,extra)=>{console.log((c?'PASS ':'FAIL ')+l+(c||!extra?'':'  -> '+extra));c?pass++:fail++};
  const ev=(f,a)=>p.evaluate(f,a);
  // invariants
  const inv=()=>ev(()=>{const F=__F,S=F.S(),bad=[];const tot={};
    S.moves.forEach(m=>{if(!(m.q>0)||!Number.isInteger(m.q))bad.push('q:'+m.id);tot[m.sku]=(tot[m.sku]||0);});
    const sum={};S.moves.forEach(m=>{const a=sum[m.sku]||(sum[m.sku]={});a[m.from]=(a[m.from]||0)-m.q;a[m.to]=(a[m.to]||0)+m.q});
    let nz=0;Object.keys(sum).forEach(k=>{const s=Object.values(sum[k]).reduce((a,v)=>a+v,0);if(s!==0)nz++});
    const supNeg=S.sup.items.filter(i=>S.sup.log.reduce((a,e)=>a+(e.item===i.id?e.q:0),0)<0).map(i=>i.id);
    const READY=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);
    const sup={};S.sup.log.forEach(e=>sup[e.item]=(sup[e.item]||0)+e.q);
    return {bad,nz,supNeg,READY,sup,nOrders:S.orders.length,nMoves:S.moves.length}});
  let I0=await inv();const SUP0=I0.sup;ok('start: ledger conserved (every move balanced)',I0.nz===0&&I0.bad.length===0);
  // ---- S1 ship 6 orders
  const S1=await ev(()=>{const F=__F,S=F.S();const open=S.orders.filter(o=>o.st==='open'&&!o.bad.length).slice(0,6);
    const pcs=open.reduce((a,o)=>a+o.lines.length,0);const sup0=Object.assign({},S.sup.log.reduce((a,e)=>(a[e.item]=(a[e.item]||0)+e.q,a),{}));
    const cons={};open.forEach(o=>F.consumption(o).forEach(c=>cons[c[0]]=(cons[c[0]]||0)+c[1]));
    const R0=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0),dem0=Object.values(F.ctx().demand).reduce((a,v)=>a+v,0);
    const d=F.newDoc('SCN');d.hdr={emp:'اختبار',src:'t',refs:open.map(o=>o.ref),times:{}};const okc=F.confirmDoc(d);
    window.__scn=d.no;window.__refs=open.map(o=>o.ref);
    const R1=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0),dem1=Object.values(F.ctx().demand).reduce((a,v)=>a+v,0);
    const sup1=S.sup.log.reduce((a,e)=>(a[e.item]=(a[e.item]||0)+e.q,a),{});
    const supOk=Object.keys(cons).every(k=>(sup0[k]||0)-(sup1[k]||0)===-cons[k]);
    return {okc,pcs,dR:R0-R1,dDem:dem0-dem1,supOk,done:open.every(o=>o.st==='done')}});
  ok('S1 scan confirms',S1.okc);ok('S1 READY drops by shipped pieces',S1.dR===S1.pcs,JSON.stringify(S1));
  ok('S1 open demand drops by shipped pieces',S1.dDem===S1.pcs);ok('S1 orders become done',S1.done);ok('S1 supplies auto-deducted exactly per rules',S1.supOk);
  // ---- S2 customer return of a shipped order (via codes), twice
  const S2=await ev(()=>{const F=__F,S=F.S();const ref=window.__refs[0],o=F.orderByRef(ref);
    const mk=()=>{const d=F.newDoc('RTN');d.hdr.codes=ref;F.ACT.rtnfill();d.hdr.counted=true;d.lines.forEach(l=>{l.r=l.exp;l.d=0;l.x=0});const c=F.confirmDoc(d);return {c,n:d.lines.reduce((a,l)=>a+l.exp,0),d}};
    const R0=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);
    const a=mk();const R1=S.moves.reduce((a2,m)=>a2+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);
    const b2=mk();const R2=S.moves.reduce((a2,m)=>a2+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);
    return {first:a.c,back1:R1-R0,pcs:o.lines.length,second:b2.c,back2:R2-R1,orderSt:o.st,flag:!!(o.rt||o.ret||o.returned)}});
  ok('S2 return of shipped order restores its pieces',S2.first&&S2.back1===S2.pcs,JSON.stringify(S2));
  ok('S2 order is marked as returned (links return to order)',S2.flag,'order stays plain "'+S2.orderSt+'" with no return marker');
  ok('S2 same order cannot be returned twice',!S2.second||S2.back2===0,'second return added '+S2.back2+' pieces again');
  // ---- S3 cancel an order that was already returned (ret=true) => double restore?
  const S3=await ev(()=>{const F=__F,S=F.S();const ref=window.__refs[0],o=F.orderByRef(ref);
    const R0=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);
    const r=F.cxApply({code:ref,photo:'data:x',ret:true,reason:'t'});
    const R1=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);return {r,back:R1-R0,pcs:o.lines.length}});
  ok('S3 cancelling an already-returned order must not restore stock again',!S3.r||S3.back===0,'restored '+S3.back+' pieces a second time');
  // cancel a second, not-returned order with stock restore
  const S3b=await ev(()=>{const F=__F,S=F.S();const ref=window.__refs[1],o=F.orderByRef(ref);
    const R0=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);const r=F.cxApply({code:ref,photo:'data:x',ret:true,reason:'t'});
    const R1=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);return {r,back:R1-R0,pcs:o.lines.length}});
  ok('S3b cancelling a shipped, not-returned order restores its pieces once',S3b.r&&S3b.back===S3b.pcs,JSON.stringify(S3b));
  // ---- S4 reverse the scan after orders were returned/cancelled
  const S4=await ev(()=>{const F=__F,S=F.S();const d=S.docs.find(x=>x.no===window.__scn);
    const R0=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);
    const r=F.reverseDoc(d);const R1=S.moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0);
    const reopened=window.__refs.map(r=>F.orderByRef(r).st);return {ok:r.ok,back:R1-R0,reopened}});
  const I1=await inv();
  ok('S4 ledger still conserved after all of the above',I1.nz===0&&I1.bad.length===0);
  ok('S4 READY never exceeds the starting stock after returns+cancel+reverse (no phantom stock)',I1.READY<=I0.READY,'READY '+I1.READY+' vs start '+I0.READY+' (+'+(I1.READY-I0.READY)+' phantom)');
  ok('S4 cancelled order is not reopened by reversing the scan',!S4.ok||S4.reopened[0]==='cx','order state after reverse: '+S4.reopened[0]);
  ok('S4 supplies never negative',I1.supNeg.length===0,I1.supNeg.join());
  ok('S4b stock is back to EXACTLY the start (nothing lost, nothing created)',I1.READY===I0.READY,'READY '+I1.READY+' vs '+I0.READY);
  const exp=await ev(()=>{const F=__F,o=F.orderByRef(window.__refs[0]),c={};F.consumption(o).forEach(x=>c[x[0]]=(c[x[0]]||0)+x[1]);return c});
  const supBad=Object.keys(Object.assign({},SUP0,I1.sup)).filter(k=>(I1.sup[k]||0)!==(SUP0[k]||0)+(exp[k]||0));
  ok('S4b supplies: only the returned order\'s packaging stays consumed (each restored exactly once)',supBad.length===0,supBad.map(k=>k+': '+(I1.sup[k]||0)+' vs '+((SUP0[k]||0)+(exp[k]||0))).join(' | '));
  const rtR=await ev(()=>{const F=__F,S=F.S(),o=S.orders.find(x=>x.st==='open'&&!x.bad.length);const sc=F.newDoc('SCN');sc.hdr={emp:'t',src:'t',refs:[o.ref],times:{}};F.confirmDoc(sc);const d=F.newDoc('RTN');d.hdr.codes=o.ref;F.ACT.rtnfill();d.hdr.counted=true;d.lines.forEach(l=>{l.r=l.exp});const c=F.confirmDoc(d);const had=!!o.rt;const rv=F.reverseDoc(d);return {c,had,rv:rv.ok,cleared:!o.rt}});
  ok('S4c reversing a return clears the order link',rtR.c&&rtR.had&&rtR.rv&&rtR.cleared,JSON.stringify(rtR));
  // ---- S5 shipped numbers: rate tab vs ledger
  const S5=await ev(()=>{const F=__F,S=F.S();const R=F.rateData();
    const wk=S.moves.filter(m=>m.type==='SCN'||m.type==='CXL'||m.type==='RTN').reduce((a,m)=>a+(m.from==='READY'&&m.to==='EXT_CH'?m.q:(m.to==='READY'&&m.from==='EXT_CH'?-m.q:0)),0);
    return {chart:R.shp[R.NW-1],net:wk}});
  ok('S5 weekly shipped on the rate tab is net of returns/cancels (matches ledger)',S5.chart===S5.net,'chart '+S5.chart+' vs ledger net '+S5.net);
  // ---- S6 alerts engine vs rate engine
  const S6=await ev(()=>{const F=__F,S=F.S();const add=(d,n)=>new Date(Date.parse(d)+n*864e5).toISOString().slice(0,10);
    const base=S.orders[0];const skus=['A6-BLK-L','S2-BLK-S','D2-FUC-S','BR4-BLK-M'];
    for(let age=1;age<=20;age++){const pid='PXI'+age;S.pickups.push({id:pid,date:add(S.date,-age),channel:'VENDOOR',name:'x'});
      for(let i=0;i<6;i++)S.orders.push(Object.assign(JSON.parse(JSON.stringify(base)),{ref:'qi'+age+'_'+i,wb:'8'+age+i,pk:pid,st:'done',lines:[skus[i%4]]}))}
    F.dirty();
    const low=new Set(F.lowList().map(x=>x[0].split('-')[0]));const plan=F.planRows();const planM=new Set(plan.map(r=>r.id.split('-')[0]));
    const R=F.rateData();const crit=R.rows.filter(r=>r.k==='crit'||r.k==='warn').map(r=>r.m);
    const alertsTxt=F.actions().map(a=>a.t+' | '+(a.d||'')).join(' || ');
    return {low:[...low],planM:[...planM],crit,planQ:plan.reduce((a,r)=>a+r.q,0),rateNeed:R.rows.reduce((a,r)=>a+r.need,0),alertsTxt}});
  ok('S6 every model the rate tab marks "order now" is also in the plan/alert list',S6.crit.filter(m=>S6.crit.length&&true).every(m=>S6.planM.indexOf(m)>=0),'rate tab: '+S6.crit.join()+' | plan: '+S6.planM.join());
  ok('S6 "needs manufacturing" quantity is one number everywhere',S6.planQ===S6.rateNeed,'plan tab '+S6.planQ+' vs rate tab '+S6.rateNeed);
  // ---- S7 persistence + storage budget
  await p.waitForTimeout(600);const S7=await ev(()=>({kb:Math.round(Object.keys(localStorage).reduce((a,k)=>a+k.length+localStorage.getItem(k).length,0)/1024),keys:Object.keys(localStorage)}));
  console.log('INFO state size in localStorage ≈ '+S7.kb+' KB (browser limit ≈ 5,000 KB)');
  ok('S7 state fits comfortably (< 2,000 KB) so saves never silently fail',S7.kb<2000,S7.kb+' KB');
  const before=await ev(()=>{const S=__F.S();return JSON.stringify({o:S.orders.length,m:S.moves.length,d:S.docs.length,s:S.sup.log.length})});
  await p.waitForTimeout(500);await p.reload();await p.waitForSelector('.shell');
  const after=await ev(()=>{const S=__F.S();return JSON.stringify({o:S.orders.length,m:S.moves.length,d:S.docs.length,s:S.sup.log.length})});
  ok('S7 everything survives a reload',before===after,before+' vs '+after);
  // ---- S8 cross-page totals
  const S8=await ev(()=>{const F=__F,S=F.S();const t={};['READY','DIRTY','FACTORY','SCRAP','LOST'].forEach(l=>t[l]=F.locSum(l));
    const openLines=S.orders.filter(o=>o.st==='open').reduce((a,o)=>a+o.lines.length,0),dem=Object.values(F.ctx().demand).reduce((a,v)=>a+v,0);
    const bar=document.createElement('div');bar.innerHTML=F.stateBar();const shown=[...bar.querySelectorAll('.srow b.n')].map(x=>+x.textContent.replace(/,/g,''));
    return {t,openLines,dem,shown}});
  ok('S8 open demand = lines of open orders',S8.openLines===S8.dem,S8.openLines+' vs '+S8.dem);
  ok('S8 "stock by state" tiles equal ledger totals',JSON.stringify(S8.shown)===JSON.stringify(Object.values(S8.t)),JSON.stringify(S8.shown)+' vs '+JSON.stringify(Object.values(S8.t)));
  const S9=await ev(()=>{const F=__F,out=[];['today','stock','supplies','ops','insights','orders','ledger','files','config'].forEach(tab=>{try{F.go(tab);out.push([tab,document.querySelector('#main').innerText.length])}catch(e){out.push([tab,'ERR '+e.message])}});
    ['over','rate','demand','plan','stuck','team','health'].forEach(it=>{try{F.UI.ins=it;F.go('insights');out.push(['ins:'+it,document.querySelector('#main').innerText.length])}catch(e){out.push(['ins:'+it,'ERR '+e.message])}});return out});
  ok('S9 every page and every insights tab renders',S9.every(x=>typeof x[1]==='number'&&x[1]>80),JSON.stringify(S9.filter(x=>!(typeof x[1]==='number'&&x[1]>80))));
  ok('no page errors',errs.length===0,errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
