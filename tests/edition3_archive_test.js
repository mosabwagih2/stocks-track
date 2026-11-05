// Dashboard cards open pop-ups; nothing is deleted anywhere (archive + restore only).
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{
  const b=await chromium.launch();const c=await b.newContext({viewport:{width:1360,height:900}});const p=await c.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0;const ok=(l,x,m)=>{console.log((x?'PASS ':'FAIL ')+l+(x?'':'  -> '+m));x?pass++:fail++};
  await p.goto('file://'+path.resolve(__dirname,'../apps/edition-3-brand-v2/index.html'));await p.waitForSelector('.shell');await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(700);
  // ---- dashboard cards
  await p.evaluate(()=>{__F.UI.ins='dash';__F.go('insights')});await p.waitForTimeout(400);
  const keys=['open','shipv','avg','retv','dem','ship','ret','rcv','loss','stockv'];
  for(const k of keys){
    const has=await p.locator('button.kpi[data-a=dk][data-v='+k+']').count();
    if(!has){ok('card "'+k+'" is clickable',false,'missing');continue}
    await p.click('button.kpi[data-a=dk][data-v='+k+']');await p.waitForSelector('.sheet');
    const r=await p.evaluate(()=>{const s=document.querySelector('.sheet');return {t:(s.querySelector('h2,h1,.sh-t')||{}).textContent||'',len:s.innerText.length,bad:/undefined|NaN|\[object/.test(s.innerText)}});
    ok('card "'+k+'" opens a pop-up with content',r.len>60&&!r.bad,JSON.stringify(r));
    await p.keyboard.press('Escape');await p.waitForTimeout(250);
    if(await p.locator('.sheet').count())await p.evaluate(()=>{__F.UI.sheet=null;__F.render()});
  }
  ok('a card shows the orders behind it and an order row opens the order',await (async()=>{await p.click('button.kpi[data-a=dk][data-v=shipv]');await p.waitForSelector('.sheet tr[data-a=order]');await p.click('.sheet tr[data-a=order] >> nth=0');await p.waitForTimeout(300);const t=await p.evaluate(()=>__F.UI.sheet&&__F.UI.sheet.kind);await p.evaluate(()=>{__F.UI.sheet=null;__F.render()});return t==='order'})());
  // ---- archive instead of delete
  ok('pickup: archive moves it (and its open orders) to the archive, nothing is lost',await p.evaluate(()=>{const F=__F,S=F.S();const base=S.orders.find(o=>o.st==='open');const pk={id:'PX9',label:'بيك أب اختبار',date:S.date,channel:'VENDOOR',src:'t'};S.pickups.push(pk);['edT001','edT002'].forEach(r=>S.orders.push(Object.assign({},base,{ref:r,pk:pk.id,st:'open',sc:null})));const n=S.orders.filter(o=>o.pk===pk.id).length,before=S.orders.length;F.UI.sheet={kind:'pkedit',id:pk.id,f:{label:pk.label,date:pk.date,channel:pk.channel},del:false,err:''};F.ACT.pkdel2();window.__pk={id:pk.id,n};return !S.pickups.some(x=>x.id===pk.id)&&S.archPk.length===1&&S.archPk[0].orders.length===n&&S.orders.length===before-n}));
  await p.evaluate(()=>{__F.go('files');__F.UI.fl='ar';__F.render()});await p.waitForTimeout(300);
  ok('the archive tab lists it',await p.evaluate(()=>/مؤرشف/.test(document.getElementById('main').innerText)&&!!document.querySelector('[data-a=restorepk]')));
  await p.click('[data-a=restorepk]');await p.waitForTimeout(250);
  ok('restoring brings the pickup and every order back',await p.evaluate(()=>{const S=__F.S();return S.pickups.some(x=>x.id===__pk.id)&&S.orders.filter(o=>o.pk===__pk.id).length===__pk.n&&S.archPk.length===0}));
  ok('draft: archive then restore',await p.evaluate(()=>{const F=__F,S=F.S(),d=F.newDoc('CLN');const n=S.docs.length;F.go('ops',()=>{F.UI.doc=d.id});F.ACT.deldoc();const a=S.archDocs.length===1&&!S.docs.some(x=>x.id===d.id);F.ACT.restoredoc({dataset:{id:d.id}});return a&&S.docs.some(x=>x.id===d.id)&&S.archDocs.length===0}));
  ok('user: archive blocks login and keeps the record; restore brings them back',await p.evaluate(()=>{const F=__F,S=F.S();S.users.push({id:'ux',name:'مؤقت',role:'pack',pin:null,on:true});F.ACT.usarch({dataset:{id:'ux'}});const u=S.users.find(x=>x.id==='ux');const a=u&&u.arch&&u.on===false;F.ACT.usrestore({dataset:{id:'ux'}});return a&&!u.arch&&u.on===true}));
  // ---- no delete/wipe buttons anywhere
  const bad=[];
  for(const t of ['today','stock','orders','ops','ledger','insights','files','settings','supplies']){
    await p.evaluate(t=>{try{__F.UI.fl='pk';__F.go(t)}catch(e){}},t);await p.waitForTimeout(200);
    const r=await p.evaluate(()=>[...document.querySelectorAll('button,[role=button]')].map(x=>x.textContent.trim()).filter(x=>/حذف|احذف|مسح|امسح|إزالة/.test(x)));
    r.forEach(x=>bad.push(t+':'+x));
  }
  ok('no button anywhere says delete / wipe / remove',bad.length===0,bad.join(' | '));
  ok('demo can be undone back to the work that was there before',await p.evaluate(()=>{const k='femini-stock-v3-pre-demo';return !!localStorage.getItem(k)}));
  ok('no page errors',errs.length===0,errs.join('|'));
  console.log(pass+' passed, '+fail+' failed');await b.close();process.exit(fail?1:0);
})();
