// Returns by waybill: each parcel is matched to its order and counted piece by piece; the difference is shown and posted.
const {chromium,devices}=require('playwright');const fs=require('fs');
const app=process.env.APP||'apps/edition-3-brand-v2/index.html';let pass=0,fail=0;
const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+String(x).slice(0,500)))};
(async()=>{
  const wrap='/tmp/_e3_ret_wrap.html';fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  const b=await chromium.launch();const c=await b.newContext({viewport:{width:1280,height:900}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(500);
  const pick=await p.evaluate(()=>{const S=__F.S(),ok=S.orders.filter(o=>o.st==='done'&&!o.rt&&o.lines.length>=3).slice(0,3),open=S.orders.find(o=>o.st==='open'),cx=S.orders.find(o=>o.st==='cx'),ret=S.orders.find(o=>o.rt);
    return {a:ok[0].wb+'',b:ok[1].wb+'',c:ok[2].wb+'',ra:ok[0].ref,rb:ok[1].ref,open:open.wb+'',cx:cx&&cx.wb+'',ret:ret&&ret.wb+''}});
  await p.evaluate(()=>{__F.go('ops',()=>{__F.newDoc('RTN')})});await p.waitForTimeout(300);
  ok('a return document opens on the waybill box, no codes textarea',await p.evaluate(()=>!!document.getElementById('rtnwb')&&!document.querySelector('textarea[data-c=rtncodes]')));
  const send=async(v)=>{await p.fill('#rtnwb',v);await p.press('#rtnwb','Enter');await p.waitForTimeout(150)};
  await send('99999999');
  ok('an unknown waybill says so',await p.evaluate(()=>/مش لاقي أوردر/.test(document.querySelector('.msg.crit').textContent)));
  await send(pick.open);
  ok('an order that was never shipped is refused with the reason',await p.evaluate(()=>/ما اتشحنش/.test(document.querySelector('.msg.crit').textContent)));
  if(pick.cx){await send(pick.cx);ok('a cancelled order is refused',await p.evaluate(()=>/ملغي/.test(document.querySelector('.msg.crit').textContent)))}
  if(pick.ret){await send(pick.ret);ok('an order already returned says where',await p.evaluate(()=>/اتسجّل مرتجع قبل كده في RTN/.test(document.querySelector('.msg.warn').textContent)))}
  await send(pick.a);
  const card=await p.evaluate(a=>{const S=__F.S(),o=S.orders.find(x=>String(x.wb)===a),cd=document.querySelector('.rpc');return {has:!!cd,ref:cd&&cd.textContent.includes(o.ref),wb:cd&&cd.textContent.includes(a),pieces:document.querySelectorAll('.rpc .rpi').length,exp:o.lines.length}},pick.a);
  ok('the waybill finds the original order and lists every piece that was shipped',card.has&&card.ref&&card.wb&&card.pieces===card.exp,JSON.stringify(card));
  await send(pick.a);
  ok('adding the same waybill twice is refused',await p.evaluate(()=>/مضافة هنا بالفعل/.test(document.querySelector('.msg.warn').textContent)&&document.querySelectorAll('.rpc').length===1));
  await p.fill('#rtnwb',pick.b+' '+pick.c);await p.press('#rtnwb','Enter');await p.waitForTimeout(150);
  ok('several waybills can be pasted at once',await p.evaluate(()=>document.querySelectorAll('.rpc').length===3));
  ok('the confirm button is locked until every piece is counted',await p.evaluate(()=>document.querySelector('[data-a=confirm]').disabled&&/لسه ما اتعدش/.test(document.querySelector('.strip').textContent)));
  // count: parcel 1 -> first piece "ناقص", second "نضافة", third "هالك", rest سليم; parcels 2,3 -> all سليم
  const exp=await p.evaluate(()=>{const F=__F,S=F.S(),d=S.docs.find(x=>x.id===F.UI.doc);return d.hdr.parcels.map(q=>({ref:q.ref,items:q.items.map(i=>i.sku)}))});
  const before=await p.evaluate(()=>{const F=__F,o={};F.D.skus.forEach(k=>{o[k.id]=['READY','DIRTY','SCRAP','LOST'].map(l=>F.g(k.id,l))});return o});
  await p.click('.rpc >> nth=0 >> .rpi >> nth=0 >> .rs-m');await p.click('.rpc >> nth=0 >> .rpi >> nth=1 >> .rs-d');await p.click('.rpc >> nth=0 >> .rpi >> nth=2 >> .rs-x');
  await p.click('.rpc >> nth=0 >> [data-a=rtnall]');
  await p.click('[data-a=rtnallall]');await p.waitForTimeout(150);
  const diff=await p.evaluate(()=>{const t=document.querySelector('.msg.warn:not(.msg.crit)');const strip=document.querySelector('.strip').innerText;return {warn:[...document.querySelectorAll('.msg.warn')].some(m=>/فيه فرق/.test(m.textContent)),missing:/ناقص\s*\n?\s*1/.test(strip),confirm:!document.querySelector('[data-a=confirm]').disabled}});
  ok('the difference between shipped and received is shown per order, and confirm unlocks once everything is counted',diff.warn&&diff.confirm,JSON.stringify(diff));
  await p.click('[data-a=confirm]');await p.waitForTimeout(300);
  const post=await p.evaluate(({exp,before})=>{const F=__F,S=F.S(),o=S.orders.find(x=>x.ref===exp[0].ref),want={};
    const add=(sku,i,q)=>{(want[sku]=want[sku]||[0,0,0,0])[i]+=q};
    exp.forEach((p,pi)=>p.items.forEach((sku,ii)=>{if(pi===0&&ii===0)add(sku,3,1);else if(pi===0&&ii===1)add(sku,1,1);else if(pi===0&&ii===2)add(sku,2,1);else add(sku,0,1)}));
    let bad=[];Object.keys(want).forEach(sku=>{const now=['READY','DIRTY','SCRAP','LOST'].map(l=>F.g(sku,l));[0,1,2,3].forEach(i=>{if(now[i]-before[sku][i]!==want[sku][i])bad.push(sku+':'+i)})});
    return {rt:o.rt,bad:bad.slice(0,4),doc:S.docs.find(d=>d.no===o.rt.doc).status}},{exp,before});
  ok('confirming posts exactly: good back to ready, cleaning, scrap, and the missing piece to lost',post.bad.length===0&&post.doc==='done',JSON.stringify(post));
  ok('the order remembers what came back: received x of y, one missing',post.rt.exp===exp[0].items.length&&post.rt.got===exp[0].items.length-1&&post.rt.miss===1,JSON.stringify(post.rt));
  await p.evaluate(r=>{__F.UI.o.f='all';__F.UI.o.q=r;__F.go('orders')},exp[0].ref);await p.waitForTimeout(250);
  ok('the orders list flags it "رجع ناقص 1"',await p.evaluate(()=>/رجع ناقص 1/.test(document.getElementById('main').innerText)));
  await p.evaluate(r=>{__F.UI.sheet={kind:'order',ref:r};__F.render()},exp[0].ref);await p.waitForTimeout(250);
  ok('the order sheet shows the return: received x of y, with each piece',await p.evaluate(()=>{const t=document.querySelector('.sheet').innerText;return /استلمنا \d+ من \d+ قطعة/.test(t)&&/ناقص/.test(t)&&/نضافة/.test(t)&&/هالك/.test(t)}));
  await p.evaluate(()=>{__F.UI.sheet=null;__F.render()});
  // done document is read-only
  await p.evaluate(r=>{const d=__F.S().docs.find(x=>x.type==='RTN'&&x.status==='done'&&x.hdr.parcels&&x.hdr.parcels.length>=3);__F.go('ops',()=>{__F.UI.doc=d.id})},null);await p.waitForTimeout(250);
  ok('a confirmed return shows its parcels read-only (buttons disabled, no waybill box)',await p.evaluate(()=>!document.getElementById('rtnwb')&&[...document.querySelectorAll('.rps button')].every(b=>b.disabled)&&document.querySelectorAll('.rpc').length>=3));
  // manual count (no waybill), alone and together with a parcel
  await p.evaluate(()=>{__F.go('ops',()=>{__F.newDoc('RTN')})});await p.waitForTimeout(250);
  ok('the manual count (model, colour, size, quantities) is back inside the return',await p.evaluate(()=>!!document.getElementById('pkm')&&/جرد يدوي/.test(document.getElementById('main').innerText)));
  await p.selectOption('#pkm','BR2');await p.waitForTimeout(100);await p.selectOption('#pkc','احمر');await p.selectOption('#pks','M');await p.fill('#pkq','3');await p.click('[data-a=addline]');await p.waitForTimeout(200);
  const man=await p.evaluate(()=>{const d=__F.S().docs.find(x=>x.id===__F.UI.doc);const l=d.lines.find(x=>x.sku==='BR2-RED-M');return {n:d.lines.length,exp:l&&l.exp,rows:document.querySelectorAll('.t-sm [data-c=ln]').length}});
  ok('adding a manual line sets what was expected',man.n===1&&man.exp===3&&man.rows===3,JSON.stringify(man));
  const bef=await p.evaluate(()=>{const F=__F,id='BR2-RED-M';return ['READY','DIRTY','SCRAP','LOST'].map(l=>F.g(id,l))});
  await p.fill('[data-c=ln][data-f=r]','1');await p.dispatchEvent('[data-c=ln][data-f=r]','change');await p.fill('[data-c=ln][data-f=d]','1');await p.dispatchEvent('[data-c=ln][data-f=d]','change');await p.waitForTimeout(150);
  ok('confirm stays locked until the manual count is marked finished',await p.evaluate(()=>document.querySelector('[data-a=confirm]').disabled));
  await p.check('[data-c=rtnmc]');await p.waitForTimeout(150);
  ok('after marking it finished confirm opens, and the missing piece is shown',await p.evaluate(()=>!document.querySelector('[data-a=confirm]').disabled&&document.querySelector('[data-sync^=sh]').textContent.trim()==='1'));
  await p.click('[data-a=confirm]');await p.waitForTimeout(250);
  ok('a manual count posts: 1 good, 1 cleaning, and the 1 not received goes to lost',await p.evaluate(b=>{const F=__F,id='BR2-RED-M',n=['READY','DIRTY','SCRAP','LOST'].map(l=>F.g(id,l));return n[0]-b[0]===1&&n[1]-b[1]===1&&n[2]-b[2]===0&&n[3]-b[3]===1},bef));
  // manual together with a parcel
  await p.evaluate(()=>{__F.go('ops',()=>{__F.newDoc('RTN')})});await p.waitForTimeout(250);
  const o5=await p.evaluate(()=>{const o=__F.S().orders.find(o=>o.st==='done'&&!o.rt&&o.lines.length>=2);return o.wb+''});
  await send(o5);await p.click('.rpc >> [data-a=rtnall]');
  await p.selectOption('#pkm','BR2');await p.waitForTimeout(100);await p.selectOption('#pkc','احمر');await p.selectOption('#pks','M');await p.click('[data-a=addline]');await p.waitForTimeout(150);
  const both=await p.evaluate(()=>{const d=__F.S().docs.find(x=>x.id===__F.UI.doc);return {parcelLines:d.lines.filter(l=>l.par).length,manual:d.lines.filter(l=>!l.par).length,locked:document.querySelector('[data-a=confirm]').disabled}});
  ok('parcels and a manual line live together in one return; the manual count must be marked finished too',both.parcelLines>=1&&both.manual===1&&both.locked,JSON.stringify(both));
  await p.evaluate(()=>{const d=__F.S().docs.find(x=>x.id===__F.UI.doc);__F.S().docs=__F.S().docs.filter(x=>x!==d);__F.UI.doc=null});
  ok('no page errors',errs.length===0,errs.join('|'));
  const m=await b.newContext({...devices['iPhone 13']});const mp=await m.newPage();const me=[];mp.on('pageerror',e=>me.push(e.message));
  await mp.goto('file://'+wrap);await mp.waitForSelector('.shell');await mp.evaluate(()=>__F.ACT.demoload());await mp.waitForTimeout(400);
  await mp.evaluate(()=>{const o=__F.S().orders.find(o=>o.st==='done'&&!o.rt&&o.lines.length>=4);__F.go('ops',()=>{const d=__F.newDoc('RTN');__F.D;window.__wb=o.wb});});await mp.waitForTimeout(250);
  await mp.fill('#rtnwb',await mp.evaluate(()=>window.__wb+''));await mp.press('#rtnwb','Enter');await mp.waitForTimeout(250);
  ok('phone: a parcel card fits the screen and the buttons are tappable',await mp.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&document.querySelector('.rps button').getBoundingClientRect().height>=36));
  ok('phone: no errors',me.length===0,me.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
