// Production-readiness: persistence, bad storage, quota, two tabs, date rollover, bad import files, double submit, speed.
const {chromium}=require('playwright');const fs=require('fs');
const app=process.env.APP||'apps/edition-3-brand-v2/index.html';let pass=0,fail=0;
const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+String(x).slice(0,500)))};
(async()=>{
  const wrap='/tmp/_e3_prod_wrap.html';fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  const b=await chromium.launch();
  const page=async(c)=>{const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(250);return {p,errs}};
  let c=await b.newContext({viewport:{width:1280,height:900}});
  let {p,errs}=await page(c);
  await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(700);
  const before=await p.evaluate(()=>{const S=__F.S();return {m:S.moves.length,o:S.orders.length,d:S.docs.length,sup:S.sup.log.length,u:S.users.length}});
  await p.reload();await p.waitForSelector('.shell');await p.waitForTimeout(300);
  const after=await p.evaluate(()=>{const S=__F.S();return {m:S.moves.length,o:S.orders.length,d:S.docs.length,sup:S.sup.log.length,u:S.users.length,demo:!!S.demo}});
  ok('everything survives a page reload (moves, orders, documents, supplies, users)',JSON.stringify(before)===JSON.stringify({m:after.m,o:after.o,d:after.d,sup:after.sup,u:after.u})&&after.demo,JSON.stringify([before,after]));
  // PIN after reload
  await p.evaluate(()=>{const S=__F.S();S.users[0].pin=(function(){return null})();__F.curUser().pin=null});
  await p.evaluate(()=>{__F.ACT.whoami()});await p.fill('#mypin','4321');await p.click('[data-a=mypin]');await p.waitForTimeout(700);
  await p.reload();await p.waitForTimeout(400);
  ok('a PIN set before reload locks the app on the next open',await p.evaluate(()=>!!document.querySelector('#lockscr .lku1')));
  await p.click('#lockscr .lku1');await p.fill('#lgpin','4321');await p.click('[data-a=lgdo]');await p.waitForTimeout(300);
  ok('the right PIN gets back in with all data',await p.evaluate(()=>!document.getElementById('lockscr')&&__F.S().orders.length>1000));
  await p.evaluate(()=>{__F.curUser().pin=null;__F.dirty()});await p.waitForTimeout(500);
  // corrupt storage
  await c.close();c=await b.newContext({viewport:{width:1280,height:900}});
  const key='femini-stock-v3';
  await c.addInitScript(k=>{try{if(!sessionStorage.__seeded){localStorage.setItem(k,'{not json');sessionStorage.__seeded='1'}}catch(e){}},key);
  ({p,errs}=await page(c));
  ok('corrupted saved data: the app still opens with a clean state',await p.evaluate(()=>!!document.querySelector('.shell')&&__F.S().moves.length>0)&&errs.length===0,errs.join('|'));
  await c.close();
  // old saved state without users/roles/closes (before access control existed)
  c=await b.newContext({viewport:{width:1280,height:900}});({p,errs}=await page(c));
  await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(600);
  await p.evaluate(k=>{const j=JSON.parse(localStorage.getItem(k));delete j.users;delete j.roles;delete j.closes;delete j.lock;delete j.audit;delete j.cur;localStorage.setItem(k,JSON.stringify(j))},key);
  await p.reload();await p.waitForSelector('.shell');await p.waitForTimeout(300);
  ok('an older saved state (no users, roles or closes) migrates cleanly to a single admin',await p.evaluate(()=>{const S=__F.S();return S.users.length===1&&S.users[0].role==='admin'&&Array.isArray(S.closes)&&S.lock<S.date&&!document.getElementById('lockscr')})&&errs.length===0,errs.join('|'));
  // quota exceeded
  await p.evaluate(()=>{window.__real=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};__F.dirty()});await p.waitForTimeout(500);
  await p.evaluate(()=>{__F.go('today')});
  ok('storage full: a red warning is shown instead of silently losing data',await p.evaluate(()=>/التخزين في المتصفح ممتلئ/.test(document.getElementById('main').innerText)));
  await p.evaluate(()=>{Storage.prototype.setItem=window.__real;__F.dirty()});await p.waitForTimeout(500);
  ok('the warning clears once saving works again',await p.evaluate(()=>!/ممتلئ/.test(document.getElementById('main').innerText)));
  // double submit
  const dbl=await p.evaluate(()=>{const F=__F,S=F.S();const k=F.D.skus.find(k=>F.g(k.id,'READY')>5);const d=F.newDoc('CLN');d.hdr={from:'READY',to:'DIRTY',reason:'t'};d.lines.push({sku:k.id,q:2});const n=S.moves.length;const a=F.confirmDoc(d),b2=F.confirmDoc(d);return {a,b2,added:S.moves.length-n}});
  ok('confirming the same document twice posts it once',dbl.a===true&&dbl.b2===false&&dbl.added===1,JSON.stringify(dbl));
  // two tabs
  const p2=(await page(c)).p;
  await p2.evaluate(()=>{__F.S().actor='تبويب 2';__F.dirty()});await p2.waitForTimeout(600);
  await p.evaluate(()=>{__F.S().actor='تبويب 1';__F.dirty()});await p.waitForTimeout(600);await p2.waitForTimeout(300);
  const ban=t=>t.evaluate(()=>/اتغيّرت البيانات من تبويب تاني/.test(document.getElementById('main').innerText));
  const b1=await ban(p),b2=await ban(p2),stored=await p2.evaluate(k=>JSON.parse(localStorage.getItem(k)).actor,key);
  ok('two tabs: the one that writes second is warned and stopped (no silent overwrite)',(b1!==b2)&&((b1&&stored==='تبويب 2')||(b2&&stored==='تبويب 1')),JSON.stringify({b1,b2,stored}));
  await p2.close();await c.close();
  // date rollover
  c=await b.newContext({viewport:{width:1280,height:900}});
  const p3=await c.newPage();const e3=[];p3.on('pageerror',e=>e3.push(e.message));
  await p3.clock.install({time:new Date('2026-11-02T21:59:50Z')});
  await p3.goto('file://'+wrap);await p3.waitForSelector('.shell');await p3.waitForTimeout(200);
  const d1=await p3.evaluate(()=>__F.S().date);
  await p3.clock.fastForward(30000);await p3.waitForTimeout(200);
  const d2=await p3.evaluate(()=>({d:__F.S().date,h:document.querySelector('.top h1').textContent}));
  ok('past midnight (Cairo) the app rolls to the new day by itself',d1==='2026-11-02'&&d2.d==='2026-11-03'&&/النهاردة/.test(d2.h),JSON.stringify([d1,d2])+e3.join('|'));
  await c.close();
  // bad import files
  c=await b.newContext({viewport:{width:1280,height:900}});({p,errs}=await page(c));
  const bads={'empty.csv':'','junk.csv':'hello,world\n1,2\n','headers-only.csv':'order id,items\n','binary.csv':'\u0000\u0001\u0002'};
  const results=[];
  for(const [name,content] of Object.entries(bads)){
    await p.evaluate(()=>{__F.UI.sheet=null;__F.ACT.upload({dataset:{t:'pickup'}})});await p.waitForTimeout(80);
    fs.writeFileSync('/tmp/'+name,content);
    await p.setInputFiles('#upfile','/tmp/'+name);await p.waitForTimeout(450);
    results.push(await p.evaluate(()=>({sheet:!!document.querySelector('.sheet'),msg:/مش|مفيش|مقدرتش|غلط|فاضي|ملف/.test(document.querySelector('.sheet')?document.querySelector('.sheet').innerText:''),save:!!document.querySelector('[data-a=pksave]:not([disabled])')})));
  }
  ok('empty, junk, headers-only and binary files give a message, never a crash or an import',results.every(r=>r.sheet&&r.msg&&!r.save)&&errs.length===0,JSON.stringify(results)+errs.join('|'));
  await c.close();
  // backup and restore
  c=await b.newContext({viewport:{width:1280,height:900},acceptDownloads:true});({p,errs}=await page(c));
  await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(500);
  await p.evaluate(()=>{__F.UI.cfgTab='sys';__F.go('config')});
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('[data-a=bkdl]')]);
  const bkPath='/tmp/bk_test.json';await dl.saveAs(bkPath);const bk=JSON.parse(fs.readFileSync(bkPath,'utf8'));
  ok('backup downloads a JSON file with the whole state',bk.app==='femini-stock'&&bk.state.v===3&&bk.state.moves.length>1000&&/femini-backup-\d{4}/.test(dl.suggestedFilename()),dl.suggestedFilename());
  const n0=await p.evaluate(()=>__F.S().moves.length);
  await p.evaluate(()=>{__F.ACT.reset2()});await p.waitForTimeout(300);
  ok('(after wiping to original data the demo is gone)',await p.evaluate(()=>!__F.S().demo));
  await p.evaluate(()=>{__F.UI.cfgTab='sys';__F.go('config')});
  fs.writeFileSync('/tmp/not_backup.json','{"hello":1}');
  await p.setInputFiles('[data-c=bkfile]','/tmp/not_backup.json');await p.waitForTimeout(250);
  ok('a file that is not a backup is refused with a message',await p.evaluate(()=>/مش نسخة احتياطية/.test(document.getElementById('main').innerText)&&!document.querySelector('[data-a=bkyes]')));
  await p.setInputFiles('[data-c=bkfile]',bkPath);await p.waitForTimeout(300);
  ok('a real backup asks for confirmation first, with a summary',await p.evaluate(()=>!!document.querySelector('[data-a=bkyes]')&&/حركة/.test(document.getElementById('main').innerText)));
  await p.click('[data-a=bkyes]');await p.waitForTimeout(400);
  ok('restoring brings back every move, order and document',await p.evaluate(n=>__F.S().moves.length===n&&!!__F.S().demo,n0));
  await p.reload();await p.waitForSelector('.shell');await p.waitForTimeout(300);
  ok('the restored data is saved (still there after reload)',await p.evaluate(n=>__F.S().moves.length===n,n0));
  ok('Today nudges about a missing backup, and stops after one is taken',await p.evaluate(()=>{const S=__F.S();S.bk=null;const dm=S.demo;S.demo=null;__F.go('today');const a=/لسه ما اتاخدتش نسخة احتياطية/.test(document.getElementById('main').innerText);S.bk=Date.now();__F.go('today');const b=!/نسخة احتياطية من/.test(document.getElementById('main').innerText);S.demo=dm;return a&&b}));
  await c.close();
  // speed
  c=await b.newContext({viewport:{width:1280,height:900}});({p,errs}=await page(c));
  await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(300);
  const perf=await p.evaluate(()=>{const out={};const t=(n,f)=>{const a=performance.now();f();out[n]=Math.round(performance.now()-a)};
    t('today',()=>__F.go('today'));t('stock-list',()=>{__F.UI.s.view='list';__F.go('stock')});t('stock-heat',()=>{__F.UI.s.view='heat';__F.go('stock')});t('stock-all',()=>{__F.UI.s.view='all';__F.go('stock')});t('stock-table',()=>{__F.UI.s.view='table';__F.go('stock')});
    t('orders',()=>{__F.UI.o.f='all';__F.go('orders')});t('ledger',()=>__F.go('ledger'));t('dash',()=>{__F.UI.ins='dash';__F.go('insights')});t('demand',()=>{__F.UI.ins='demand';__F.go('insights')});t('plan',()=>{__F.UI.ins='plan';__F.go('insights')});
    t('confirm-scan',()=>{const C=__F.ctx(),o=C.open.filter(o=>!C.blocked[o.ref]).slice(0,40);const d=__F.newDoc('SCN');d.hdr={emp:'x',src:'p',refs:o.map(x=>x.ref),times:{}};__F.confirmDoc(d)});return out});
  const slow=Object.entries(perf).filter(([k,v])=>v>600);
  ok('every main screen renders in under 600 ms with a month of data ('+JSON.stringify(perf)+')',slow.length===0,JSON.stringify(slow));
  ok('no page errors in the whole run',errs.length===0,errs.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
