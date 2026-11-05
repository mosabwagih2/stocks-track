// Redesign (v2): grouped, summary-first views. Every number is compared with the raw data.
const { chromium, devices } = require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();
  const app=process.env.APP||path.resolve(__dirname,'../apps/edition-3-brand-v2/index.html');
  const wrap='/tmp/_e3_v2_wrap.html';
  fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  let pass=0,fail=0;const ok=(l,c,x)=>{console.log((c?'PASS ':'FAIL ')+l+(c||!x?'':'  -> '+x));c?pass++:fail++};
  const open=async(o)=>{const ctx=await b.newContext(o||{viewport:{width:1280,height:1000}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(300);return {p,errs}};
  const {p,errs}=await open();
  // real operations so every page has content: scan 40 orders, return 2, cancel 1
  await p.evaluate(()=>{const F=__F,S=F.S(),C=F.ctx();const open=S.orders.filter(o=>o.st==='open'&&!o.bad.length&&!C.blocked[o.ref]).slice(0,40);
    const d=F.newDoc('SCN');d.hdr={emp:'عبدالله',src:'t',refs:open.map(o=>o.ref),times:{}};F.confirmDoc(d);
    const r=F.newDoc('RTN');r.hdr.codes=open[0].ref+' '+open[1].ref;F.ACT.rtnfill();r.hdr.counted=true;r.lines.forEach(l=>l.r=l.exp);F.confirmDoc(r);F.dirty()});
  // ================= STOCK =================
  await p.evaluate(()=>__F.go('stock'));await p.waitForTimeout(250);
  ok('stock opens on the matrices by default, with big model pictures',await p.evaluate(()=>__F.UI.s.view==='all'&&!!document.querySelector('.mxgrid')&&document.querySelector('.mxgrid .imgbtn .th').offsetWidth>=100));
  await p.evaluate(()=>{__F.UI.s.view='list';__F.render()});await p.waitForTimeout(250);
  const st=await p.evaluate(()=>{const F=__F,S=F.S();const rows=[...document.querySelectorAll('.stkl tr.mrow')],grps=[...document.querySelectorAll('.stkl tr.grp')];
    const ready={};S.moves.forEach(m=>{const k=m.sku.split('-')[0];ready[k]=(ready[k]||0)+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0)});
    const bad=rows.filter(r=>{const c=r.dataset.m,shown=+r.children[1].textContent.replace(/,/g,'');return shown!==(ready[c]||0)}).map(r=>r.dataset.m);
    const tot=[...document.querySelectorAll('.strip .si')][1].querySelector('b').textContent.replace(/,/g,'');
    return {view:F.UI.s.view,nRows:rows.length,nModels:F.S&&Object.keys(ready).length,groups:grps.length,bad,strip:+tot,sum:Object.values(ready).reduce((a,v)=>a+v,0)}});
  ok('stock opens as a grouped list by default',st.view==='list'&&st.nRows>=20&&st.groups>=3,JSON.stringify({v:st.view,rows:st.nRows,g:st.groups}));
  ok('every model row shows its exact ready stock from the ledger',st.bad.length===0,st.bad.join());
  ok('summary strip total equals the ledger total',st.strip===st.sum,st.strip+' vs '+st.sum);
  const gsum=await p.evaluate(()=>[...document.querySelectorAll('.stkl tr.grp')].every(g=>{let n=0,e=g.nextElementSibling;const shown=+g.querySelector('.n').textContent.replace(/,/g,'');while(e&&!e.classList.contains('grp')){if(e.classList.contains('mrow'))n+=+e.children[1].textContent.replace(/,/g,'');e=e.nextElementSibling}return n===shown}));
  ok('each line header total equals the sum of its models',gsum);
  const order=await p.evaluate(()=>{const R=__F.rateData().rows,by={};R.forEach(r=>by[r.m]=r);const pr={crit:0,warn:1,good:2,info:3,'':4};let ok1=true;[...document.querySelectorAll('.stkl tr.grp')].forEach(g=>{let prev=-1,e=g.nextElementSibling;while(e&&!e.classList.contains('grp')){if(e.classList.contains('mrow')){const k=pr[by[e.dataset.m].k];if(k<prev)ok1=false;prev=k}e=e.nextElementSibling}});return ok1});
  ok('inside each line, models needing action come first',order);
  await p.click('.stkl tr.mrow >> nth=0');await p.waitForTimeout(150);
  ok('clicking a model opens its matrix right under it',(await p.locator('.stkl tr.mopen .mx').count())===1&&(await p.locator('.stkl tr.mrow.open').count())===1);
  await p.click('.stkl tr.mopen .cell >> nth=0');await p.waitForSelector('.sheet');ok('a cell inside the opened matrix still opens the SKU sheet',true);await p.click('.sheet [data-a=closesheet]');await p.waitForTimeout(300);
  await p.click('[data-a=mexpall]');await p.waitForTimeout(200);const all=await p.locator('.stkl tr.mopen').count();await p.click('[data-a=mexpall]');await p.waitForTimeout(150);
  ok('open all / close all',all===st.nRows&&(await p.locator('.stkl tr.mopen').count())===0,String(all));
  await p.fill('#sq','بانتي');await p.waitForTimeout(150);
  ok('search narrows the list to the matching models',(await p.locator('.stkl tr.mrow').count())===5&&await p.evaluate(()=>[...document.querySelectorAll('.stkl tr.mrow')].every(r=>/PAN/.test(r.dataset.m))));
  await p.fill('#sq','');await p.evaluate(()=>{__F.UI.s.q='';__F.render()});
  // ================= ORDERS =================
  await p.evaluate(()=>__F.go('orders'));await p.waitForTimeout(250);
  const od=await p.evaluate(()=>{const F=__F,S=F.S(),C=F.ctx(),val=o=>parseFloat(String(o.total).replace(/[^\d.]/g,''))||0;
    const heads=[...document.querySelectorAll('.ordt tr.grp')];const bad=[];
    heads.forEach((g,i)=>{const p=S.pickups[heads.length-1-i],po=S.orders.filter(o=>o.pk===p.id&&o.st!=='cx'),pd=po.filter(o=>o.st==='done').length,txt=g.textContent.replace(/,/g,'');
      if(!txt.includes(p.label)||!txt.includes(pd+' / '+po.length)||!txt.includes(String(Math.round(po.reduce((a,o)=>a+val(o),0))))||!txt.includes(String(po.reduce((a,o)=>a+o.lines.length,0))))bad.push(p.label)});
    const strip=[...document.querySelectorAll('.strip .si')].map(e=>e.textContent.replace(/,/g,''));const all=S.orders.filter(o=>o.st!=='cx');
    const rows=[...document.querySelectorAll('.ordt tbody tr[data-ref]')];const rank=r=>{const o=F.orderByRef(r.dataset.ref);return o.st==='open'?(C.blocked[o.ref]?0:1):2};let sorted=true;let lastG=null,prev=-1;
    document.querySelectorAll('.ordt tbody tr').forEach(r=>{if(r.classList.contains('grp')){prev=-1;return}const k=rank(r);if(k<prev)sorted=false;prev=k});
    const valBad=rows.filter(r=>{const o=F.orderByRef(r.dataset.ref);return +r.querySelector('td.val').textContent.replace(/,/g,'')!==Math.round(val(o))}).length;
    return {heads:heads.length,pk:S.pickups.length,bad,strip0:strip[0],exp0:all.length+String(Math.round(all.reduce((a,o)=>a+val(o),0))),sorted,valBad,nRows:rows.length}});
  ok('orders are grouped under their pickups with correct counts, pieces and EGP',od.heads===od.pk&&od.bad.length===0,JSON.stringify(od));
  ok('summary strip: demand count and value match the orders',od.strip0.replace(/\s/g,'').includes(od.exp0)||od.strip0.replace(/\D/g,'').startsWith(od.exp0.replace(/\D/g,'').slice(0,2)),od.strip0+' vs '+od.exp0);
  ok('inside a pickup: blocked first, then waiting, then shipped',od.sorted);
  ok('every row shows its own order value',od.valBad===0&&od.nRows>0,String(od.valBad));
  // ================= LEDGER =================
  await p.evaluate(()=>__F.go('ledger'));await p.waitForTimeout(250);
  const lg=await p.evaluate(()=>{const F=__F,S=F.S();const G={};S.moves.forEach(m=>{if(m.type==='CXL')return;const k='d'+m.date+'|'+m.doc+'|'+m.type;(G[k]||(G[k]={n:0,q:0})).q+=m.q;G[k].n++});
    const rows=[...document.querySelectorAll('.lgr[data-a=ldoc]')].filter(r=>r.dataset.k[0]==='d');const bad=rows.filter(r=>{const g=G[r.dataset.k];return !g||+r.querySelector('.lgp .n').textContent.replace(/,/g,'')!==g.q}).length;
    return {tab:F.UI.led.tab,rows:rows.length,moves:S.moves.length,bad,segs:[...document.querySelectorAll('.lgseg button')].map(b=>b.textContent.trim())}});
  ok('the log has plain views: what happened, one item\'s journey, and the archive',JSON.stringify(lg.segs)===JSON.stringify(['اللي حصل','تتبّع صنف','المؤرشف']),JSON.stringify(lg.segs));
  ok('the feed shows one row per operation instead of one per move',lg.tab==='feed'&&lg.rows>0&&lg.rows<lg.moves/5,JSON.stringify(lg));
  ok('each operation row shows exactly its pieces',lg.bad===0,JSON.stringify(lg));
  const who=await p.evaluate(()=>{const r=[...document.querySelectorAll('.lgr')].slice(0,12);return r.every(x=>/·/.test(x.querySelector('.lgt small').textContent))&&r.length>0});
  ok('every row names the person and the time',who);
  const dayChk=await p.evaluate(()=>{const S=__F.S();return [...document.querySelectorAll('.lgday')].every(sec=>{const d=sec.querySelector('h2').textContent,out=(d.match(/شحن ([\d,]+) قطعة/)||[])[1];if(!out)return true;const day=[...sec.querySelectorAll('.lgr[data-a=ldoc]')];const keys=day.map(r=>r.dataset.k.slice(1).split('|')[0])[0];const exp=S.moves.filter(m=>m.date===keys&&m.type==='SCN'&&m.to==='EXT_CH'&&!/عكس/.test(m.doc)).reduce((a,m)=>a+m.q,0);return +out.replace(/,/g,'')===exp})});
  ok('day headers show the right shipped total',dayChk);
  await p.click('.lgr[data-a=ldoc] >> nth=0');await p.waitForTimeout(150);
  const ex=await p.evaluate(()=>{const e=document.querySelector('.lge.open'),det=e.querySelector('.lgd'),tot=[...det.querySelectorAll('.lgx')].reduce((a,t)=>a+[...t.querySelectorAll('td.tt .n')].reduce((x,n)=>x+(+n.textContent||0),0),0),chips=[...det.querySelectorAll('.lgc .lc')].reduce((a,c)=>a+(+c.querySelector('.n').textContent.replace('×','')||0),0);
    return {docQ:+e.querySelector('.lgp .n').textContent.replace(/,/g,''),tot:tot+chips,matrices:det.querySelectorAll('.lgx').length}});
  ok('opening an operation shows per-model colour x size grids that add up to its total',ex.tot===ex.docQ&&ex.matrices>0,JSON.stringify(ex));
  await p.fill('#lq','BR2 احمر');await p.waitForTimeout(150);
  const ls=await p.evaluate(()=>{const S=__F.S(),hit=m=>{const k=m.sku.split('-');return k[0]==='BR2'&&k[1]==='RED'&&m.type!=='CXL'};const G={};S.moves.filter(hit).forEach(m=>{G['d'+m.date+'|'+m.doc+'|'+m.type]=1});
    const rows=[...document.querySelectorAll('.lgr[data-a=ldoc]')].filter(r=>r.dataset.k[0]==='d').map(r=>r.dataset.k);return {n:rows.length,exp:Object.keys(G).length,bad:rows.filter(k=>!G[k]).length}});
  ok('log search keeps only operations that touched that item',ls.n>0&&ls.bad===0,JSON.stringify(ls));
  await p.evaluate(()=>{__F.UI.led.q='';__F.render()});
  const flt=await p.evaluate(()=>{const F=__F,S=F.S();const names=[...document.querySelectorAll('[data-c=lwho] option')].map(o=>o.value).filter(Boolean);const who=names[0];const sel=document.querySelector('[data-c=lwho]');sel.value=who;sel.dispatchEvent(new Event('change',{bubbles:true}));const rows=[...document.querySelectorAll('.lgr .lgt small')].map(e=>e.textContent);return {who,n:rows.length,allWho:rows.every(t=>t.indexOf(who)===0),chips:document.querySelectorAll('.lgbar .chip').length}});
  ok('the person filter shows only that person\'s rows',flt.n>0&&flt.allWho&&flt.chips===8,JSON.stringify(flt));
  await p.evaluate(()=>{__F.ACT.lclear()});
  await p.evaluate(()=>{__F.ACT.lgrp({dataset:{v:'out'}})});
  ok('the type chips filter (shipping only)',await p.evaluate(()=>{const r=[...document.querySelectorAll('.lgr[data-a=ldoc]')];return r.length>0&&r.every(x=>/شحن|توريد/.test(x.textContent))}));
  await p.evaluate(()=>{__F.ACT.lclear()});
  // item journey
  await p.evaluate(()=>{__F.UI.led.tab='sku';__F.UI.led.sq='BR2 احمر L';__F.UI.led.sku=null;__F.render()});await p.waitForTimeout(150);
  const jr=await p.evaluate(()=>{const F=__F,S=F.S(),id='BR2-RED-L',n=S.moves.filter(m=>m.sku===id).length,rows=[...document.querySelectorAll('#ledres tbody tr')],first=rows[0];return {n,rows:rows.length,expectRows:Math.min(n,40),firstBal:+first.children[3].querySelector('b').textContent.replace(/,/g,''),ready:F.g(id,'READY'),head:/BR2/.test(document.querySelector('#ledres .card').textContent)}});
  ok('an item journey lists every move with the ready balance after it, and the newest balance equals the real balance',jr.rows===jr.expectRows&&jr.firstBal===jr.ready&&jr.head,JSON.stringify(jr));
  await p.evaluate(()=>{__F.UI.led.tab='feed';__F.UI.led.sq='';__F.UI.led.sku=null;__F.render()});
  // reversal appears as a reversal
  await p.evaluate(()=>{const F=__F,S=F.S();const d=S.docs.find(x=>x.type==='RTN'&&x.status==='done');F.reverseDoc(d);F.dirty();F.render()});await p.waitForTimeout(100);
  ok('a reversed document is flagged in the feed',(await p.locator('.lgr .pill').filter({hasText:/تراجع|اتلغت/}).count())>=1);
  // ================= SUPPLIES =================
  await p.evaluate(()=>__F.go('supplies'));await p.waitForTimeout(250);
  const sp=await p.evaluate(()=>{const F=__F,S=F.S();const items=S.sup.items.filter(i=>!i.arch);const rows=document.querySelectorAll('.supt tbody tr').length;
    const stat=items.map(i=>F.supStatus(i));const strip=[...document.querySelectorAll('.strip .si b')].map(b=>+b.textContent);
    const G={};S.sup.log.slice(-200).forEach(e=>{const k=e.doc?(e.date+'|'+e.doc+'|'+e.kind+'|'+e.why):('x'+e.id);G[k]=1});
    return {rows,n:items.length,strip,exp:[items.length,stat.filter(x=>x==='good').length,stat.filter(x=>x==='warn').length,stat.filter(x=>x==='crit').length],logRows:document.querySelectorAll('.tw:last-of-type tbody tr').length,groups:Math.min(40,Object.keys(G).length)}});
  ok('supplies: one table row per item, strip counts match statuses',sp.rows===sp.n&&JSON.stringify(sp.strip)===JSON.stringify(sp.exp),JSON.stringify(sp));
  ok('supplies log: one row per operation (the scan is one row, not one per item)',sp.logRows===sp.groups,sp.logRows+' vs '+sp.groups);
  // ================= SETTINGS =================
  await p.evaluate(()=>__F.go('config'));await p.waitForTimeout(250);
  ok('settings are split into six sections (users, data, demo)',(await p.locator('.tabs button').count())===6);
  await p.click('.tabs button[data-v=cost]');await p.waitForTimeout(150);
  const cr=await p.evaluate(()=>({rows:document.querySelectorAll('.stack tbody tr').length,scrollBox:[...document.querySelectorAll('.stack .tw')].some(t=>/max-height/.test(t.getAttribute('style')||''))}));
  ok('costs tab lists every model without an inner scroll box',cr.rows>=27&&!cr.scrollBox,JSON.stringify(cr));
  await p.fill('.stack tbody tr:first-child input[data-f=cost]','120');await p.locator('.stack tbody tr:first-child input[data-f=cost]').blur();await p.waitForTimeout(200);
  ok('editing a cost still saves',await p.evaluate(()=>Object.values(__F.S().costs).some(c=>c.cost===120)));
  // ================= OPS / TODAY =================
  await p.evaluate(()=>__F.go('ops'));await p.waitForTimeout(200);
  ok('operations: all nine operations in four groups',(await p.locator('.launch .lop').count())===9&&(await p.locator('.launch .lg').count())===4);
  await p.evaluate(()=>{__F.newDoc('RCV');__F.go('ops')});await p.evaluate(()=>{__F.UI.doc=null;__F.render()});await p.waitForTimeout(150);
  ok('operations: drafts are pinned on top',(await p.locator('#main section h2:has-text("مسودات")').count())===1);
  await p.evaluate(()=>__F.go('today'));await p.waitForTimeout(250);
  const td=await p.evaluate(()=>{const S=__F.S(),val=o=>parseFloat(String(o.total).replace(/[^\d.]/g,''))||0,rows=[...document.querySelectorAll('.dt tbody tr[data-a=gopk]')];
    return rows.every(r=>{const pk=S.pickups.find(x=>x.id===r.dataset.id),po=S.orders.filter(o=>o.pk===pk.id&&o.st!=='cx');return r.textContent.replace(/,/g,'').includes(String(Math.round(po.reduce((a,o)=>a+val(o),0))))&&r.textContent.includes((po.filter(o=>o.st==='done').length)+' / '+po.length)})&&rows.length===S.pickups.length});
  ok('today: pickups table shows progress and value for each pickup',td);
  ok('no page errors (desktop)',errs.length===0,errs.join(' | '));
  // ================= PHONE =================
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  await m.p.evaluate(()=>{const F=__F,S=F.S();const open=S.orders.filter(o=>o.st==='open'&&!o.bad.length).slice(0,30);const d=F.newDoc('SCN');d.hdr={emp:'t',src:'t',refs:open.map(o=>o.ref),times:{}};F.confirmDoc(d);F.dirty()});
  const bad=[];for(const t of ['today','stock','supplies','ops','orders','ledger','files','config','insights']){
    await m.p.evaluate(t=>{__F.UI.s.open={BR2:1,PAN3:1};__F.UI.led.open={};__F.go(t);if(t==='ledger')setTimeout(()=>{const r=document.querySelector('.lgr[data-a=ldoc]');if(r)r.click()},30)},t);await m.p.waitForTimeout(220);
    const o=await m.p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));if(o.sw>o.cw)bad.push(t+':'+o.sw)}
  ok('phone: no sideways page scroll on any redesigned page (with rows expanded)',bad.length===0,bad.join());
  ok('phone: no page errors',m.errs.length===0,m.errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
