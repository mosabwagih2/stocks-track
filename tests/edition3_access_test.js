// Users, roles, permissions and PIN lock (day close was removed).
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
  await p.evaluate(()=>{__F.go('today')});
  ok('Today has a receive button (factory receipt, returns) and a scrap button (classify, send to factory, receive from factory)',await p.evaluate(()=>{const b=document.querySelector('.top [data-a=recvmenu]'),s=document.querySelector('.top [data-a=scrapmenu]');if(!b||!s)return false;b.click();const r=[...document.querySelectorAll('.sheet [data-a=recvgo]')].map(e=>e.dataset.t).join();__F.UI.sheet=null;__F.render();document.querySelector('.top [data-a=scrapmenu]').click();const c=[...document.querySelectorAll('.sheet [data-a=recvgo]')].map(e=>e.dataset.t).join();__F.UI.sheet=null;__F.render();return r==='RCV,RTN'&&c==='CLN,FSD,FRC'}));
  await p.evaluate(()=>__F.ACT.recvmenu());await p.click('.sheet [data-a=recvgo][data-t=RTN]');await p.waitForTimeout(250);
  ok('choosing returns opens a new returns document in operations',await p.evaluate(()=>{const F=__F;return F.UI.tab==='ops'&&F.S().docs.some(d=>d.id===F.UI.doc&&d.type==='RTN'&&d.status==='draft')}));
  const subs=await p.evaluate(()=>{__F.go('today');return [...document.querySelectorAll('.top .sub')].map(e=>e.outerHTML.slice(0,200))});ok('Today has no subtitle line under the title',subs.length===0,JSON.stringify(subs));
  await p.evaluate(()=>{const S=__F.S();S.docs=S.docs.filter(d=>d.status!=='draft');__F.go('today')});
  await p.evaluate(()=>{__F.go('today')});
  ok('Today title is "النهاردة" with the date chip beside it',await p.evaluate(()=>{const h=document.querySelector('.top h1');return /^النهاردة/.test(h.textContent.trim())&&!!h.querySelector('.tdate')&&/نوفمبر/.test(h.querySelector('.tdate').textContent)}));
  const pick=await p.evaluate(()=>{const F=__F,t=F.S().date,i=document.querySelector('.dnav input[type=date]');const prev=new Date(Date.parse(t)-3*864e5).toISOString().slice(0,10);i.value=prev;i.dispatchEvent(new Event('change',{bubbles:true}));return {t,prev,vd:F.UI.vd,title:document.querySelector('.top h1').textContent.includes('يوم سابق'),val:document.querySelector('.dnav input[type=date]').value}});
  ok('picking an old date shows that day (read-only view) and keeps the picker on it',pick.vd===pick.prev&&pick.title&&pick.val===pick.prev,JSON.stringify(pick));
  const st=await p.evaluate(()=>{const F=__F;document.querySelector('.dnav [data-a=vdstep][data-n="1"]').click();const a=F.UI.vd;document.querySelector('.dnav [data-a=vdstep][data-n="-1"]').click();const b=F.UI.vd;return {a,b,t:F.S().date}});
  ok('arrows step a day forward and back',st.a&&st.b&&st.a>st.b);
  ok('stepping past today returns to the live day',await p.evaluate(()=>{const F=__F;F.UI.vd=F.S().date.slice(0,8)+'01';F.go('today');for(let i=0;i<40&&F.UI.vd;i++)document.querySelector('.dnav [data-a=vdstep][data-n="1"]').click();return F.UI.vd==null&&/النهاردة/.test(document.querySelector('.top h1').textContent)}));
  await p.evaluate(()=>{__F.UI.vd=null;__F.go('today')});
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
  ok('supervisor: operations, no settings or money',await p.evaluate(()=>__F.can('count')&&__F.can('scan')&&!__F.can('settings')&&!__F.can('money')));
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
  // day close was removed: no button, no lock, and an old locked state is unlocked on load
  await p.evaluate(()=>{__F.go('today')});
  ok('no day-close button or bar anywhere on Today',await p.evaluate(()=>!document.querySelector('[data-a=closeday]')&&!/تقفيل/.test(document.getElementById('main').innerText)));
  ok('operations are never refused because of a closed day',await p.evaluate(()=>{const F=__F;const d=F.newDoc('CLN');d.hdr={from:'READY',to:'DIRTY',reason:'t'};const k=F.D.skus.find(k=>F.g(k.id,'READY')>2);d.lines.push({sku:k.id,q:1});const r=F.build(d);const c=F.confirmDoc(d);return c===true&&!r.checks.some(x=>!x.ok&&/مقفول/.test(x.t))}));
  {const c2=await b.newContext({viewport:{width:1280,height:900}});const q=await c2.newPage();await q.goto('file://'+wrap);await q.waitForSelector('.shell');await q.evaluate(()=>__F.ACT.demoload());await q.waitForTimeout(500);
   await q.evaluate(()=>{const j=JSON.parse(localStorage.getItem('femini-stock-v3'));j.lock='2099-01-01';j.closes=[{date:'2026-11-01',status:'closed'}];localStorage.setItem('femini-stock-v3',JSON.stringify(j))});
   await q.reload();await q.waitForSelector('.shell');await q.waitForTimeout(300);
   ok('a state saved earlier with a locked day opens unlocked and operations work',await q.evaluate(()=>{const F=__F;const d=F.newDoc('CLN');d.hdr={from:'READY',to:'DIRTY',reason:'t'};const k=F.D.skus.find(k=>F.g(k.id,'READY')>2);d.lines.push({sku:k.id,q:1});return F.S().lock===''&&F.confirmDoc(d)===true}));await c2.close()}
  ok('demo reload keeps the accounts',await p.evaluate(()=>{const n=__F.S().users.length;__F.ACT.demoload();return __F.S().users.length===n&&n>=2&&__F.S().users.some(u=>u.name==='سارة'&&u.pin)}));
  ok('no page errors',errs.length===0,errs.join('|'));
  const m=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
  await m.p.evaluate(()=>{__F.ACT.lockapp()});await m.p.waitForTimeout(200);
  ok('phone: lock screen fits',await m.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&!!document.querySelector('#lockscr .lkc')));
  await m.p.evaluate(()=>{const S=__F.S();document.getElementById('lockscr')&&0;__F.ACT.lgpick({dataset:{id:S.users[0].id}});__F.ACT.lgdo()});await m.p.waitForTimeout(200);
  await m.p.evaluate(()=>{__F.ACT.whoami();});await m.p.waitForTimeout(300);
  ok('phone: account sheet has no sideways scroll',await m.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  ok('phone: no errors',m.errs.length===0,m.errs.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
