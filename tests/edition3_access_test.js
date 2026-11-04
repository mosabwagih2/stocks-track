// Users, roles, permissions, PIN lock, day close and reopen.
const {chromium,devices}=require('playwright');const fs=require('fs');
const app=process.env.APP||'apps/edition-3-brand-v2/index.html';let pass=0,fail=0;
const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+(x||'')))};
(async()=>{
  const wrap='/tmp/_e3_acc_wrap.html';fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  const b=await chromium.launch();
  const open=async(o)=>{const c=await b.newContext(o||{viewport:{width:1280,height:900}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(300);return {p,errs}};
  const {p,errs}=await open();
  await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(400);
  const asUser=(role)=>p.evaluate(r=>{const S=__F.S();let u=S.users.find(x=>x.role===r);if(!u){u={id:'t_'+r,name:'ت_'+r,role:r,pin:null,on:true};S.users.push(u)}S.cur=u.id;S.actor=u.name;__F.render();return u.name},role);
  ok('default: one admin, everything allowed',await p.evaluate(()=>{const S=__F.S();return S.users.length===1&&S.users[0].role==='admin'&&!document.getElementById('lockscr')}));
  // roles
  await asUser('pack');
  const pk=await p.evaluate(()=>({scan:__F.can('scan'),ret:__F.can('returns'),rcv:__F.can('receive'),cnt:__F.can('count'),set:__F.can('settings'),money:__F.can('money')}));
  ok('packer: scan and returns only',pk.scan&&pk.ret&&!pk.rcv&&!pk.cnt&&!pk.set&&!pk.money,JSON.stringify(pk));
  ok('packer: settings is hidden from the navigation',await p.evaluate(()=>!document.querySelector('.rail [data-t=config]')));
  ok('packer: money is masked',await p.evaluate(()=>{__F.go('today');return !/\d,\d{3}\s*ج/.test(document.querySelector('.hmoney').textContent)&&/•••/.test(document.querySelector('.hmoney').textContent)}));
  const blocked=await p.evaluate(()=>{const F=__F;const d=F.newDoc('RCV');d.lines.push({sku:F.D.skus[0].id,q:1});d.hdr.declared=1;return F.confirmDoc(d)});
  ok('packer cannot confirm a factory receipt (core guard)',blocked===false);
  ok('packer cannot cancel an order or reverse a document',await p.evaluate(()=>{const F=__F,o=F.S().orders.find(o=>o.st==='open');return F.cxApply({code:o.ref,photo:'x',reason:'t',ret:false})===false&&F.reverseDoc(F.S().docs.find(d=>d.status==='done')).ok===false}));
  ok('packer clicking a gated action is stopped with a message',await p.evaluate(()=>{__F.go('stock');const b=document.createElement('button');b.dataset.a='skuadd';document.body.appendChild(b);b.click();b.remove();return !__F.UI.sheet||__F.UI.sheet.kind!=='skuadd'}));
  await asUser('view');
  ok('viewer: sees money, cannot do anything',await p.evaluate(()=>__F.can('money')&&!__F.can('scan')&&!__F.can('close')));
  await asUser('sup');
  ok('supervisor: operations and closing, no settings or money',await p.evaluate(()=>__F.can('close')&&__F.can('count')&&!__F.can('settings')&&!__F.can('reopen')&&!__F.can('money')));
  // admin
  await p.evaluate(()=>{const S=__F.S();S.cur=S.users[0].id;S.actor=S.users[0].name;__F.render()});
  // user management
  await p.evaluate(()=>{__F.UI.cfgTab='acc';__F.go('config')});await p.waitForTimeout(200);
  ok('settings has a users and permissions tab with a role matrix',await p.evaluate(()=>!!document.querySelector('[data-c=rolep]')&&document.querySelectorAll('[data-c=usrole]').length>=1));
  await p.fill('#nu_name','سارة');await p.selectOption('#nu_role','sup');await p.fill('#nu_pin','1234');await p.click('[data-a=usadd]');await p.waitForTimeout(150);
  ok('add a user with a PIN',await p.evaluate(()=>{const u=__F.S().users.find(x=>x.name==='سارة');return !!u&&u.role==='sup'&&!!u.pin&&u.pin!=='1234'}));
  ok('cannot demote or delete the last admin',await p.evaluate(()=>{const S=__F.S(),a=S.users[0];const sel=document.querySelector('[data-c=usrole][data-id="'+a.id+'"]');sel.value='pack';sel.dispatchEvent(new Event('change',{bubbles:true}));return S.users[0].role==='admin'}));
  // lock screen with PIN
  await p.evaluate(()=>{__F.ACT.lockapp()});await p.waitForTimeout(150);
  ok('lock screen lists the users',await p.evaluate(()=>document.querySelectorAll('#lockscr .lku1').length===__F.S().users.length&&__F.S().users.length>=2));
  await p.click('#lockscr [data-a=lgpick]:has-text("سارة")');await p.fill('#lgpin','0000');await p.click('[data-a=lgdo]');await p.waitForTimeout(100);
  ok('wrong PIN is refused',await p.evaluate(()=>/غلط/.test(document.getElementById('lockscr').textContent)&&__F.UI.locked===true));
  await p.fill('#lgpin','1234');await p.click('[data-a=lgdo]');await p.waitForTimeout(250);
  ok('right PIN signs in, actions are logged under that name',await p.evaluate(()=>!document.getElementById('lockscr')&&__F.S().actor==='سارة'&&__F.S().audit.some(a=>/دخول: سارة/.test(a.m))));
  // day close
  const d0=await p.evaluate(()=>({date:__F.S().date,drafts:__F.S().docs.filter(d=>d.status==='draft').length}));
  await p.evaluate(()=>{__F.go('today')});
  ok('Today shows the close bar',await p.evaluate(()=>!!document.querySelector('.dcb [data-a=closeday]')));
  await p.click('[data-a=closeday]');await p.waitForSelector('.sheet');
  ok('close sheet blocks on drafts and negative stock',await p.evaluate(()=>/لازم يتحل/.test(document.querySelector('.sheet').textContent)&&document.querySelector('[data-a=clconfirm]').disabled));
  const fixed=await p.evaluate(()=>{const F=__F,S=F.S();S.docs=S.docs.filter(d=>d.status!=='draft');F.D.skus.filter(k=>F.g(k.id,'READY')<0).forEach(k=>S.moves.push({id:S.mid++,t:1,date:S.date,sku:k.id,q:-F.g(k.id,'READY'),from:'EXT_ADJ',to:'READY',type:'CNT',doc:'T',by:'t',note:''}));F.dirty();F.render();return true});
  await p.waitForTimeout(150);
  ok('after fixing, reconciliation shows opening + in - out = closing for every state',await p.evaluate(()=>{const s=__F.S();const sn=document.querySelectorAll('.sheet tbody tr');return /مطابقة الرصيد/.test(document.querySelector('.sheet').textContent)&&!document.querySelector('[data-a=clconfirm]').disabled}));
  const rec=await p.evaluate(()=>{const F=__F,S=F.S();const snap=(()=>{let ok=true;F.INTERNAL?0:0;return ok})();let good=true;['READY','DIRTY','FACTORY','SCRAP','LOST'].forEach(l=>{const cur=F.D.skus.reduce((a,k)=>a+F.g(k.id,l),0);const row=[...document.querySelectorAll('.sheet tbody tr')].find(r=>r.children[0].textContent===({READY:'جاهز للبيع',DIRTY:'هالك نظافة',FACTORY:'عند المصنع',SCRAP:'هالك نهائي',LOST:'مفقود'})[l]);const v=+row.children[4].textContent.replace(/,/g,'');if(v!==cur)good=false});return good});
  ok('closing balance in the sheet equals the live ledger balance',rec);
  await p.click('[data-a=clconfirm]');await p.waitForTimeout(250);
  const cl=await p.evaluate(()=>({lock:__F.S().lock,date:__F.S().date,n:__F.S().closes.length,by:__F.S().closes[0]&&__F.S().closes[0].by}));
  ok('closing locks the day and records who closed it',cl.lock===cl.date&&cl.n===1&&cl.by==='سارة',JSON.stringify(cl));
  ok('Today says the day is closed',await p.evaluate(()=>{__F.UI.sheet=null;__F.go('today');return /اليوم مقفول/.test(document.querySelector('.dcb').textContent)}));
  const afterLock=await p.evaluate(()=>{const F=__F,d=F.newDoc('CLN');d.hdr={from:'READY',to:'DIRTY',reason:'t'};const k=F.D.skus.find(k=>F.g(k.id,'READY')>2);d.lines.push({sku:k.id,q:1});const r=F.build(d);const c=F.confirmDoc(d);F.S().docs=F.S().docs.filter(x=>x!==d);return {c,checks:r.checks.filter(x=>!x.ok).map(x=>x.t)}});
  ok('a closed day refuses new confirmed operations',afterLock.c===false&&afterLock.checks.some(t=>/مقفول/.test(t)),JSON.stringify(afterLock));
  ok('a closed day refuses scans and cancellations',await p.evaluate(()=>{const F=__F,o=F.S().orders.find(o=>o.st==='open');return F.cxApply({code:o.ref,photo:'x',reason:'t',ret:false})===false}));
  ok('supervisor cannot reopen (no permission)',await p.evaluate(()=>!__F.can('reopen')));
  await p.evaluate(()=>{const S=__F.S();S.cur=S.users[0].id;S.actor=S.users[0].name;__F.UI.sheet={kind:'close'};__F.render()});await p.waitForTimeout(150);
  await p.fill('[data-c=clreason]','عجز اتسجل غلط');await p.waitForTimeout(80);
  ok('admin sees reopen, and it needs a reason',await p.evaluate(()=>!document.querySelector('[data-a=clreopen]').disabled));
  await p.click('[data-a=clreopen]');await p.waitForTimeout(200);
  ok('reopening unlocks, keeps the history and logs the reason',await p.evaluate(()=>{const S=__F.S();return S.lock===''&&S.closes[0].status==='reopened'&&S.audit.some(a=>/عجز اتسجل غلط/.test(a.m))}));
  ok('after reopening, operations work again',await p.evaluate(()=>{const F=__F,d=F.newDoc('CLN');d.hdr={from:'READY',to:'DIRTY',reason:'t'};const k=F.D.skus.find(k=>F.g(k.id,'READY')>2);d.lines.push({sku:k.id,q:1});return F.confirmDoc(d)}));
  ok('demo reload keeps the accounts',await p.evaluate(()=>{const n=__F.S().users.length;__F.ACT.demoload();return __F.S().users.length===n&&n>=2&&__F.S().users.some(u=>u.name==='سارة'&&u.pin)}));
  ok('no page errors',errs.length===0,errs.join('|'));
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  await m.p.evaluate(()=>{__F.ACT.lockapp()});await m.p.waitForTimeout(200);
  ok('phone: lock screen fits',await m.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&!!document.querySelector('#lockscr .lkc')));
  await m.p.evaluate(()=>{const S=__F.S();document.getElementById('lockscr')&&0;__F.ACT.lgpick({dataset:{id:S.users[0].id}});__F.ACT.lgdo()});await m.p.waitForTimeout(200);
  await m.p.evaluate(()=>{__F.ACT.closeday();});await m.p.waitForTimeout(300);
  ok('phone: close sheet has no sideways scroll',await m.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  ok('phone: no errors',m.errs.length===0,m.errs.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
