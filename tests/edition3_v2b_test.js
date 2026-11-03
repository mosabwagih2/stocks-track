// Redesign (v2): Today and Analytics. Numbers are checked against the raw data.
const { chromium, devices } = require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();
  const app=process.env.APP||path.resolve(__dirname,'../apps/edition-3-brand-v2/index.html');
  const wrap='/tmp/_e3_v2b_wrap.html';
  fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  let pass=0,fail=0;const ok=(l,c,x)=>{console.log((c?'PASS ':'FAIL ')+l+(c||!x?'':'  -> '+x));c?pass++:fail++};
  const open=async(o)=>{const ctx=await b.newContext(o||{viewport:{width:1280,height:1000}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(300);return {p,errs}};
  const {p,errs}=await open();
  const T=async()=>{await p.evaluate(()=>{__F.UI.vd=null;__F.go('today')});await p.waitForTimeout(150)};
  // ===== TODAY: the headline follows the situation =====
  await T();
  let hl=await p.evaluate(()=>({head:document.querySelector('.hhead').textContent,btn:(document.querySelector('.hmain .btn.pri')||{}).textContent,blk:Object.keys(__F.ctx().blocked).length}));
  ok('today: with nothing shipped and none blocked the next action is "upload the scan file"',hl.blk===0&&/مستنيين الشحن/.test(hl.head)&&/ملف السكان/.test(hl.btn||''),JSON.stringify(hl));
  // make an order blocked: zero the stock of one of its SKUs
  await p.evaluate(()=>{const F=__F,S=F.S(),o=S.orders.find(x=>x.st==='open'&&!x.bad.length),sku=o.lines[0];S.moves.push({id:990001,t:Date.now(),date:S.date,sku,q:F.g(sku,'READY'),from:'READY',to:'EXT_ADJ',type:'CNT',doc:'T',by:'t',note:''});F.dirty()});
  await T();hl=await p.evaluate(()=>({head:document.querySelector('.hhead').textContent,btn:(document.querySelector('.hmain .btn.pri')||{}).textContent}));
  ok('today: blocked orders take over the headline, with their EGP value and a "see what is blocked" button',/هيقف بالرصيد/.test(hl.head)&&/شوف الواقف/.test(hl.btn||''),JSON.stringify(hl));
  // real scan of 20 orders, return one, cancel one (for the timeline)
  await p.evaluate(()=>{const F=__F,S=F.S(),C=F.ctx();const open=S.orders.filter(o=>o.st==='open'&&!o.bad.length&&!C.blocked[o.ref]).slice(0,20);const d=F.newDoc('SCN');d.hdr={emp:'مريم',src:'t',refs:open.map(o=>o.ref),times:{}};F.confirmDoc(d);
    const r=F.newDoc('RTN');r.hdr.codes=open[0].ref;F.ACT.rtnfill();r.hdr.counted=true;r.lines.forEach(l=>l.r=l.exp);F.confirmDoc(r);
    const o2=S.orders.find(x=>x.st==='open'&&!x.bad.length&&!C.blocked[x.ref]);F.cxApply({code:o2.ref,photo:'data:x',ret:false,reason:'t'});F.dirty()});
  await T();
  const td=await p.evaluate(()=>{const F=__F,S=F.S(),C=F.ctx(),val=o=>parseFloat(String(o.total).replace(/[^\d.]/g,''))||0,date=S.date;
    const ids=S.pickups.filter(x=>x.date===date).map(x=>x.id),os=S.orders.filter(o=>ids.indexOf(o.pk)>=0&&o.st!=='cx'),done=os.filter(o=>o.st==='done'),open=os.filter(o=>o.st==='open'),blk=open.filter(o=>C.blocked[o.ref]),wait=open.filter(o=>!C.blocked[o.ref]);
    const pcs=a=>a.reduce((x,o)=>x+o.lines.length,0),v=a=>Math.round(a.reduce((x,o)=>x+val(o),0));
    const leg=[...document.querySelectorAll('.hl')].map(e=>e.textContent.replace(/,/g,'')),money=[...document.querySelectorAll('.hmoney b')].map(e=>+e.textContent.replace(/[^\d]/g,''));
    const sx=document.querySelector('.rc b').textContent;
    return {pct:sx,exp:Math.round(done.length/os.length*100)+'%',legOk:leg[0].includes(String(done.length))&&leg[0].includes(String(pcs(done)))&&leg[1].includes(String(wait.length))&&leg[1].includes(String(pcs(wait)))&&leg[2].includes(String(blk.length)),moneyOk:money[0]===v(os)&&money[1]===v(done)&&money[2]===v(blk),leg,money,exp2:[v(os),v(done),v(blk)]}});
  ok('today: ring % = shipped orders / demand orders',td.pct===td.exp,td.pct+' vs '+td.exp);
  ok('today: legend counts and pieces match the orders',td.legOk,JSON.stringify(td.leg));
  ok('today: demand / shipped / blocked EGP match the orders',td.moneyOk,JSON.stringify([td.money,td.exp2]));
  const tl=await p.evaluate(()=>{const S=__F.S(),G={};S.moves.filter(m=>m.date===S.date).forEach(m=>{G[m.doc+'|'+m.type]=(G[m.doc+'|'+m.type]||0)+m.q});
    const items=[...document.querySelectorAll('.tli')],pcs=items.map(e=>+e.querySelector('.tq').textContent.replace(/,/g,'')).sort((a,b)=>b-a),exp=Object.values(G).concat(S.orders.filter(o=>o.cx&&o.cx.date===S.date).map(o=>o.lines.length)).sort((a,b)=>b-a).slice(0,7);
    return {pcs,exp,txt:document.querySelector('.tl').textContent}});
  ok('today: "what happened" lists today\'s operations and the cancellation with exact pieces',JSON.stringify(tl.pcs)===JSON.stringify(tl.exp)&&/اتلغى أوردر/.test(tl.txt)&&/أوردر اتشحنوا/.test(tl.txt),JSON.stringify(tl));
  const sp=await p.evaluate(()=>{const S=__F.S(),sh=S.moves.filter(m=>m.type==='SCN'&&m.date===S.date).reduce((a,m)=>a+(m.from==='READY'?m.q:-m.q),0);return {bars:document.querySelectorAll('.spk .b').length,now:document.querySelector('.spk .b.now').getAttribute('data-tip'),sh}});
  ok('today: 7-day strip ends on today with today\'s shipped pieces',sp.bars===7&&sp.now.includes(String(sp.sh)),JSON.stringify(sp));
  ok('today: the action queue shows every action',(await p.locator('.queue .q').count())===(await p.evaluate(()=>__F.actions().length)));
  // empty day and fully shipped day
  const empty=await p.evaluate(()=>{__F.UI.vd='2026-01-01';__F.go('today');return {head:document.querySelector('.hmain .hhead').textContent,hasBtn:!!document.querySelector('.hmain .btn.pri')}});
  ok('today: a day with no pickup says so (and does not offer upload on a past day)',/مفيش بيك أب/.test(empty.head)&&!empty.hasBtn,JSON.stringify(empty));
  await p.evaluate(()=>{const S=__F.S();S.orders.forEach(o=>{if(o.st==='open')o.st='done',o.sc=o.sc||{by:'t',at:Date.now(),date:S.date,doc:'Z'}});__F.UI.vd=null;__F.dirty();__F.go('today')});await p.waitForTimeout(100);
  ok('today: when everything is shipped the headline says it',/اتشحن ✓/.test(await p.locator('.hhead').innerText()));
  // ===== ANALYTICS =====
  await p.evaluate(()=>{__F.UI.vd=null;__F.UI.ins='over';__F.UI.insP='all';__F.go('insights')});await p.waitForTimeout(150);
  const tabs=await p.locator('.tabs button').allInnerTexts();
  ok('analytics: six tabs, one per question',JSON.stringify(tabs.map(x=>x.trim()))===JSON.stringify(['لوحة القيادة','الطلب','التصنيع','الواقف','صحة المخزون','الفريق']),JSON.stringify(tabs));
  ok('analytics: an old link to "overview" lands on the dashboard',await p.evaluate(()=>__F.UI.ins==='dash'));
  await p.evaluate(()=>{__F.UI.ins='rate';__F.go('insights')});await p.waitForTimeout(100);ok('analytics: an old link to "rate" lands on manufacturing',await p.evaluate(()=>__F.UI.ins==='plan'));
  const per={};for(const t of ['dash','demand','plan','stuck','health','team']){per[t]=await p.evaluate(t=>{__F.UI.ins=t;__F.go('insights');const s=document.querySelector('.top .seg[aria-label="الفترة"]');return {seg:!!s&&!s.hidden,pill:/لقطة دلوقتي/.test(document.querySelector('.top').textContent)}},t);await p.waitForTimeout(60)}
  ok('analytics: the period selector shows only where a period matters; snapshot tabs say so',per.dash.seg&&per.demand.seg&&per.team.seg&&!per.plan.seg&&!per.stuck.seg&&!per.health.seg&&per.plan.pill&&per.stuck.pill&&per.health.pill&&!per.dash.pill,JSON.stringify(per));
  // demand
  await p.evaluate(()=>{__F.UI.ins='demand';__F.UI.insP='all';__F.go('insights')});await p.waitForTimeout(150);
  const dm=await p.evaluate(()=>{const F=__F,S=F.S(),pk={};S.pickups.forEach(x=>pk[x.id]=x.date);const os=S.orders.filter(o=>o.st!=='cx'&&pk[o.pk]);const strip=[...document.querySelectorAll('.strip .si b')].map(e=>+e.textContent.replace(/[^\d.]/g,''));
    const sizes=[...document.querySelectorAll('#main .card')].find(c=>/^المقاسات/.test(c.querySelector('h2').textContent));const sum=[...sizes.querySelectorAll('.hb .v')].reduce((a,v)=>a+(+v.textContent.split('·')[0].replace(/,/g,'')||0),0);
    return {o:strip[0],expO:os.length,sum,expP:os.reduce((a,o)=>a+o.lines.length,0),hasHeat:!!document.querySelector('.hm'),notes:document.querySelectorAll('.insn').length,trend:!!document.querySelector('.col')}});
  ok('demand: strip orders and the size bars add up to the real demand',dm.o===dm.expO&&dm.sum===dm.expP,JSON.stringify(dm));
  ok('demand: notes, daily chart and heat map are all on one page',dm.notes>=3&&dm.trend&&dm.hasHeat);
  // plan
  await p.evaluate(()=>{__F.UI.ins='plan';__F.UI.insL='all';__F.UI.insX={};__F.go('insights')});await p.waitForTimeout(150);
  const pl=await p.evaluate(()=>{const F=__F,R=F.rateData(),PR=F.planRows(),strip=[...document.querySelectorAll('.strip .si b')].map(e=>+e.textContent.replace(/[^\d.]/g,''));
    const rows=[...document.querySelectorAll('.plt tr.mrow')],pr={crit:0,warn:1,good:2,info:3,'':4},by={};R.rows.forEach(r=>by[r.m]=r);let sorted=true,prev=-1;rows.forEach(r=>{const k=pr[by[r.dataset.m].k];if(k<prev)sorted=false;prev=k});
    return {crit:strip[0],expCrit:R.rows.filter(r=>r.k==='crit').length,need:strip[1],expNeed:PR.reduce((a,r)=>a+r.q,0),sorted,n:rows.length,first:rows[0].dataset.m,charts:document.querySelectorAll('#main .wk').length>0,cover:!!document.querySelector('.hb .tr.m'),formulas:!!document.querySelector('details.dd'),copy:!!document.querySelector('[data-a=copyplan]'),capOk:![...document.querySelectorAll('.plt tr.mrow td:nth-child(5)')].some(t=>/\d{4,}%/.test(t.textContent))}});
  ok('manufacturing: strip numbers equal the engine (models to order now, suggested pieces = plan total)',pl.crit===pl.expCrit&&pl.need===pl.expNeed,JSON.stringify(pl));
  ok('manufacturing: most urgent models first; copy button, charts and formulas on the same page',pl.sorted&&pl.n>10&&pl.charts&&pl.cover&&pl.formulas&&pl.copy);
  ok('manufacturing: absurd trends are capped (">300%") instead of 2257%',pl.capOk);
  const ex=await p.evaluate(()=>{const F=__F,PR=F.planRows(),by={};PR.forEach(r=>{(by[F.S().orders&&r.id.split('-')[0]]||(by[r.id.split('-')[0]]=[])).push(r)});const m=Object.keys(by)[0];F.ACT.plx({dataset:{m}});
    const rows=[...document.querySelectorAll('.plt tr.mopen .skt tbody tr')];const exp=by[m].reduce((a,r)=>a+r.q,0),got=rows.reduce((a,r)=>a+(+r.children[4].textContent.replace(/,/g,'')),0);return {m,n:rows.length,expN:by[m].length,got,exp}});
  ok('manufacturing: opening a model lists its SKUs with the exact pieces to make',ex.n===ex.expN&&ex.got===ex.exp&&ex.n>0,JSON.stringify(ex));
  await p.evaluate(()=>{__F.UI.insL='بانتي';__F.render()});await p.waitForTimeout(80);
  ok('manufacturing: line filter keeps only that line',await p.evaluate(()=>[...document.querySelectorAll('.plt tr.mrow')].every(r=>/PAN/.test(r.dataset.m))&&document.querySelectorAll('.plt tr.mrow').length>0));
  ok('no page errors (desktop)',errs.length===0,errs.join(' | '));
  // phone
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  const bad=[];for(const [pg,tab] of [['today'],['insights','dash'],['insights','demand'],['insights','plan'],['insights','stuck'],['insights','health'],['insights','team']]){
    await m.p.evaluate(([pg,tab])=>{__F.UI.vd=null;__F.UI.insX={BR2:1,A6:1};if(tab)__F.UI.ins=tab;__F.go(pg)},[pg,tab]);await m.p.waitForTimeout(200);
    const o=await m.p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));if(o.sw>o.cw)bad.push((tab||pg)+':'+o.sw)}
  ok('phone: no sideways scroll on Today and on every analytics tab',bad.length===0,bad.join());
  ok('phone: no page errors',m.errs.length===0,m.errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
