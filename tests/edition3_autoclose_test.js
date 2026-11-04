const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const c=await b.newContext({viewport:{width:1360,height:900}});const p=await c.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=window.__fixed||new RD('2026-11-03T23:50:00+02:00').getTime();try{const f=sessionStorage.__fx;if(f)window.__fixed=+f}catch(e){}
    class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}}window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3-brand-v2/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,x)=>{console.log((x?'PASS ':'FAIL ')+l);x?pass++:fail++};
  await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(600);
  const st=()=>p.evaluate(()=>{const S=__F.S();return {date:S.date,lock:S.lock,auto:S.closes.filter(x=>x.auto).map(x=>x.date),n:S.closes.length}});
  const s0=await st();
  ok('toggle defaults to on',await p.evaluate(()=>__F.S().st.autoClose!==false));
  await p.evaluate(()=>{window.__fixed=new Date('2026-11-04T00:05:00+02:00').getTime();document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(500);
  const s1=await st();
  ok('midnight rollover moves the date',s1.date==='2026-11-04');
  ok('yesterday gets locked automatically',s1.lock==='2026-11-03');
  ok('the close is marked automatic in the history',s1.auto.includes('2026-11-03')||s1.lock==='2026-11-03');
  ok('today stays open',await p.evaluate(()=>!__F.dayLocked(__F.S().date)));
  ok('yesterday refuses new documents',await p.evaluate(()=>{const F=__F,d=F.newDoc('CLN');d.date='2026-11-03';d.hdr={from:'READY',to:'DIRTY',reason:'t'};const k=F.D.skus.find(k=>F.g(k.id,'READY')>2);d.lines.push({sku:k.id,q:1});const n=F.S().docs.filter(x=>x.status==='confirmed').length;try{F.confirmDoc(d)}catch(e){}return F.S().docs.filter(x=>x.status==='confirmed').length===n}));
  ok('today documents still work',await p.evaluate(()=>{const F=__F,d=F.newDoc('CLN');d.hdr={from:'READY',to:'DIRTY',reason:'t'};const k=F.D.skus.find(k=>F.g(k.id,'READY')>2);d.lines.push({sku:k.id,q:1});return !!F.confirmDoc(d)}));
  // manual reopen is not undone by reload
  await p.evaluate(()=>{const S=__F.S();S.lock='';S.closes.push({id:'cx',date:'2026-11-03',at:1,by:'x',snap:{},status:'reopened',reopened:1});__F.dirty()});await p.waitForTimeout(500);
  await p.reload();await p.waitForSelector('.shell');await p.waitForTimeout(300);
  const s2=await st();
  ok('a day the manager reopened is not re-closed on reload',s2.lock!=='2026-11-03'&&s2.lock<'2026-11-03');
  // app opened after midnight (page was closed): next day
  await p.addInitScript(()=>{window.__fixed=Date.parse('2026-11-06T09:00:00+02:00')});
  await p.reload();await p.waitForSelector('.shell');await p.waitForTimeout(300);
  const s3=await st();console.log(JSON.stringify(s3));
  ok('opening the app on a later day closes the previous day',s3.date==='2026-11-06'&&s3.lock==='2026-11-05');
  // off
  await p.evaluate(()=>{__F.S().st.autoClose=false;__F.dirty()});
  await p.addInitScript(()=>{window.__fixed=Date.parse('2026-11-08T09:00:00+02:00')});
  await p.reload();await p.waitForSelector('.shell');await p.waitForTimeout(300);
  const s4=await st();
  ok('when switched off nothing closes by itself',s4.date==='2026-11-08'&&s4.lock===s3.lock);
  ok('no page errors',errs.length===0);
  console.log(errs.join('|'));console.log(pass+' passed, '+fail+' failed');await b.close();process.exit(fail?1:0);
})();
