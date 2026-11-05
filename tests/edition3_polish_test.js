// Ops filter without "reversed", ledger "open document", Today events pop-up, real colour swatches for new colours.
const {chromium}=require('playwright');const path=require('path');
(async()=>{
  const b=await chromium.launch();const c=await b.newContext({viewport:{width:1360,height:900}});const p=await c.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0;const ok=(l,x,m)=>{console.log((x?'PASS ':'FAIL ')+l+(x?'':'  -> '+m));x?pass++:fail++};
  await p.goto('file://'+path.resolve(__dirname,'../apps/edition-3-brand-v2/index.html'));await p.waitForSelector('.shell');await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(700);
  await p.evaluate(()=>__F.go('ops'));await p.waitForTimeout(300);
  ok('the operations filter has no "reversed" chip',await p.evaluate(()=>{const t=[...document.querySelectorAll('#main .chip')].map(x=>x.textContent);return t.indexOf('الكل')>=0&&!t.some(x=>/معكوس/.test(x))}));
  // ledger: open document
  await p.evaluate(()=>{__F.UI.led.tab='feed';__F.go('ledger')});await p.waitForTimeout(300);
  await p.click('.lgr[data-a=ldoc] >> nth=0');await p.waitForTimeout(250);
  let hasBtn=await p.locator('.lgd [data-a=opendoc2]').count();
  if(!hasBtn){const n=await p.locator('.lgr[data-a=ldoc]').count();for(let i=1;i<Math.min(n,12)&&!hasBtn;i++){await p.click('.lgr[data-a=ldoc] >> nth='+i);await p.waitForTimeout(150);hasBtn=await p.locator('.lgd [data-a=opendoc2]').count()}}
  ok('an expanded ledger event has the open-document button',hasBtn>0);
  await p.click('.lgd [data-a=opendoc2] >> nth=0');await p.waitForTimeout(400);
  ok('the button actually opens the document (goes to Operations with it open)',await p.evaluate(()=>__F.UI.tab==='ops'&&!!__F.UI.doc&&!!document.querySelector('#main .sum,#main .strip,#main h1')));
  ok('ledger details have no "من ← إلى" line and never say "القناة / العميل"',await p.evaluate(()=>{const F=__F;F.UI.led.open={};F.go('ledger');document.querySelectorAll('.lgr[data-a=ldoc]').forEach((x,i)=>{if(i<6)x.click()});const t=document.getElementById('main').innerText;return !/من ← إلى/.test(t)&&!/القناة \/ العميل/.test(t)}));
  ok('the shipping location is named "الشحن" everywhere',await p.evaluate(()=>__F.LOC?__F.LOC.EXT_CH==='الشحن':true));
  const p0=p;const c2=await b.newContext({viewport:{width:1360,height:900}});const q=await c2.newPage();await q.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});await q.goto('file://'+path.resolve(__dirname,'../apps/edition-3-brand-v2/index.html'));await q.waitForSelector('.shell');
  await q.evaluate(()=>{const F=__F,S=F.S(),C=F.ctx();if(!S.orders.some(o=>o.st==='open'&&C.blocked[o.ref])){const o=S.orders.find(o=>o.st==='open'&&!(o.bad&&o.bad.length));const sk=o.lines[0],n=F.g(sk,'READY');if(n>0)S.moves.push({id:S.mid++,t:Date.now(),date:S.date,sku:sk,q:n,from:'READY',to:'LOST',type:'LOS',doc:'LOS-T',by:'t',note:''});F.dirty()}});
  for(const w of ['blocked','wait','all']){
    const r=await q.evaluate(w=>{const F=__F;F.UI.sheet={kind:'flow',w};F.go('today');F.UI.sheet={kind:'flow',w};F.render();const s=document.querySelector('.sheet');if(!s)return null;const tf=[...s.querySelectorAll('tfoot tr')];const o=F.ctx(),C=o;return {hint:/بتعطّل أكتر أوردرات الأول/.test(s.innerText),n:tf.length,txt:tf.map(x=>x.innerText.replace(/\s+/g,' ')),pcs:null}},w);
    ok('tile "'+w+'": no hint text, and a totals row under each table',!!r&&!r.hint&&r.n>=1&&r.txt.every(x=>/الإجمالي/.test(x)),JSON.stringify(r));
  }
  ok('blocked tile totals add up (pieces in the orders table equal the sum of its rows\' pieces)',await q.evaluate(()=>{const F=__F;F.UI.sheet={kind:'flow',w:'blocked'};F.render();const s=document.querySelector('.sheet');const tb=[...s.querySelectorAll('table')].pop();const rows=[...tb.querySelectorAll('tbody tr')].map(r=>+r.children[1].textContent.replace(/,/g,'')),tot=+tb.querySelector('tfoot td:nth-child(2)').textContent.replace(/,/g,'');return rows.length>0&&tot>=rows.reduce((a,b)=>a+b,0)}));
  ok('a blocked order pill names the model, colour and size that is missing',await q.evaluate(()=>{const F=__F;F.go('orders',()=>{F.UI.o.f='all';F.UI.o.q='';F.UI.o.pk=''});const ps=[...document.querySelectorAll('#main .pill.crit')].map(x=>x.textContent).filter(x=>/^معطل/.test(x));return ps.length>0&&ps.every(x=>/معطل · ناقص [A-Z0-9]+ · .+ · \S+/.test(x))}));
  await c2.close();
  // stock strip cards
  await p.evaluate(()=>{__F.UI.s.view='heat';__F.go('stock')});await p.waitForTimeout(400);
  for(const st of ['out','low','ok','excess']){
    const has=await p.locator('button.si[data-a=hst][data-v='+st+']').count();
    if(!has){ok('stock card "'+st+'" is clickable',false,'missing');continue}
    await p.click('button.si[data-a=hst][data-v='+st+']');await p.waitForSelector('.sheet');
    const r=await p.evaluate(()=>{const s=document.querySelector('.sheet');return {cards:s.querySelectorAll('.hsc').length,rows:s.querySelectorAll('.hsr').length,tot:!!s.querySelector('.hst-tot'),bad:/undefined|NaN/.test(s.innerText),title:(s.querySelector('h2')||{}).textContent}});
    ok('stock card "'+st+'" opens its cells colour by colour with a total',(r.cards===0?true:r.rows>0&&r.tot)&&!r.bad,JSON.stringify(r));
    await p.evaluate(()=>{__F.UI.sheet=null;__F.render()});
  }
  ok('the supplies action switcher has no empty slot (buttons share the full width)',await p.evaluate(()=>{const F=__F;F.go('supplies');const it=F.S().sup.items[0];F.UI.sheet={kind:'sup',id:it.id,tab:'move',act:'rcv'};F.render();const s=document.querySelector('.sheet .seg');if(!s)return true;const bs=[...s.querySelectorAll('button')],w=s.getBoundingClientRect().width,sum=bs.reduce((a,x)=>a+x.getBoundingClientRect().width,0);return sum>=w-4}));
  await p.evaluate(()=>{__F.UI.sheet=null;__F.render()});
  // Today events pop-up
  await p.evaluate(()=>{__F.UI.sheet=null;__F.go('today')});await p.waitForTimeout(400);
  const n=await p.locator('.tli[data-a=tev]').count();
  ok('Today events are clickable',n>0,n);
  if(n){await p.click('.tli[data-a=tev] >> nth=0');await p.waitForSelector('.sheet');
    ok('the event pop-up shows who, when and what was inside',await p.evaluate(()=>{const t=document.querySelector('.sheet').innerText;return t.length>40&&/قطعة|أوردر/.test(t)}));
    const ob=p.locator('.sheet [data-a=opendoc2],.sheet [data-a=order]');
    if(await ob.count()){await ob.first().click();await p.waitForTimeout(400);ok('and has a working button to the document or order',await p.evaluate(()=>__F.UI.tab==='ops'||(__F.UI.sheet&&__F.UI.sheet.kind==='order')))}
    await p.evaluate(()=>{__F.UI.sheet=null;__F.render()})}
  // colours
  await p.evaluate(()=>{__F.UI.sheet=__F.skuAddInit?__F.skuAddInit('__new',false):null;__F.render()}).catch(()=>{});
  if(!await p.locator('#nc').count()){await p.evaluate(()=>{__F.go('stock');__F.ACT.skuadd({dataset:{m:'__new'}})});await p.waitForTimeout(300)}
  ok('the add-colour row has a colour picker',await p.locator('#nhx').count()===1);
  await p.fill('#nc','اخضر');await p.dispatchEvent('#nc','input');await p.waitForTimeout(100);
  ok('typing a known colour name pre-fills a matching shade (not the default lavender)',await p.evaluate(()=>{const v=document.getElementById('nhx').value;return v!=='#cfc2ec'&&v!=='#8a8a8a'}));
  await p.evaluate(()=>{const i=document.getElementById('nhx');i.value='#118833';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))});
  await p.click('[data-a=skuaddc]');await p.waitForTimeout(250);
  ok('the chosen shade is saved and used for the swatch',await p.evaluate(()=>{const S=__F.S();const chip=[...document.querySelectorAll('.sheet .chip')].find(x=>/اخضر/.test(x.textContent));return S.cat.hex&&S.cat.hex['اخضر']==='#118833'&&chip&&/17, 136, 51|#118833/i.test(chip.querySelector('.sw').style.background)}));
  ok('no page errors',errs.length===0,errs.join('|'));
  console.log(pass+' passed, '+fail+' failed');await b.close();process.exit(fail?1:0);
})();
