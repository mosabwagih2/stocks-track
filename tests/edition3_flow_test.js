const { chromium } = require('playwright');
const fs=require('fs');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts|cdnjs|net::|Failed to load/.test(m.text()))errs.push('CONSOLE '+m.text())});
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T10:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  const txt=async()=>(await p.textContent('#app')).replace(/\s+/g,' ');
  const nav=async t=>{await p.click(`[data-a=go][data-t=${t}]`)};
  const ready=()=>p.evaluate(()=>{const F=__F;return F.S().moves.reduce((a,m)=>a+(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0),0)});
  ok('start READY 43863',(await ready())===43863);
  // 1 scan upload
  await p.click('[data-a=upload][data-t=scan]');
  await p.setInputFiles('#upfile',require('path').resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv'));await p.waitForSelector('[data-a=scansave]');
  let t=await txt();ok('scan preview: 28 matched + 456 pieces',/28/.test(t)&&/456/.test(t));
  ok('save disabled without employee',await p.isDisabled('[data-a=scansave]'));
  await p.fill('#upemp','عبدالله');ok('save enabled after employee',!(await p.isDisabled('[data-a=scansave]')));
  await p.click('[data-a=scansave]');await p.waitForTimeout(200);
  ok('READY after scan = 43407',(await ready())===43407);
  t=await txt();ok('orders screen shows done filter',/اتشحن/.test(t));
  const doneN=await p.evaluate(()=>__F.S().orders.filter(o=>o.st==='done').length);ok('28 orders done',doneN===28);
  // 2 re-upload
  await p.click('[data-a=upload][data-t=scan]');await p.setInputFiles('#upfile',require('path').resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv'));await p.waitForSelector('.kpis');
  t=await txt();ok('re-upload: all already registered, save disabled',/اتسجّل قبل كده/.test(t)&&await p.isDisabled('[data-a=scansave]'));
  await p.click('[data-a=closesheet]');
  // 3 today
  await nav('today');t=await txt();ok('today shows 28 scanned',/28/.test(t)&&/عبدالله/.test(t));
  // 4 manual register with negative
  await p.evaluate(()=>{const F=__F,S=F.S();const o=S.orders.find(o=>o.st==='open');const sku=o.lines[0];const have=F.g(sku,'READY');S.moves.push({id:999999,t:Date.now(),date:S.date,sku,q:have,from:'READY',to:'EXT_ADJ',type:'CNT',doc:'TEST',by:'t',note:'t'});F.dirty();window.__neg=[o.ref,sku];F.go('orders')});
  await p.waitForTimeout(100);
  t=await txt();ok('blocked orders appear',/هيقف/.test(t));
  const ref=await p.evaluate(()=>__neg[0]);
  await p.click('[data-a=of][data-v=all]');await p.fill('#oq',ref);await p.waitForTimeout(100);
  await p.check('input[data-c=sel]');await p.click('[data-a=manual]');await p.waitForSelector('[data-a=scansave]');
  t=await txt();ok('manual scan shows negative warning but not blocked',/الرصيد مش كفاية/.test(t));
  await p.fill('#upemp','حسام');await p.click('[data-a=scansave]');await p.waitForTimeout(200);
  const negN=await p.evaluate(()=>__F.S().moves.length&&Object.keys(__F.S()).length&&(()=>{let n=0;for(const k of ['x']);return 1})());
  console.log('DBG',await p.evaluate(()=>JSON.stringify({neg:Object.keys(__F.S()).length,sku:__neg[1],r:__F.g(__neg[1],'READY'),docs:__F.S().docs.map(d=>d.type+':'+d.status)})));await nav('today');t=await txt();ok('negative stock exception card',/رصيد بالسالب/.test(t));
  // 5 reverse the manual scan
  await nav('ops');await p.click('tbody tr[data-a=opendoc]');await p.waitForTimeout(100);
  t=await txt();ok('doc screen shows hossam',/حسام/.test(t));
  await p.click('[data-a=reverse]');await p.waitForTimeout(100);
  const open1=await p.evaluate(()=>__F.S().orders.filter(o=>o.st==='done').length);ok('reverse reopens order',open1===28);
  // 6 receipt flow
  await p.click('[data-a=backops]');await p.click('[data-a=newop][data-t=RCV]');
  t=await txt();ok('receipt screen',/استلام توريد/.test(t));
  await p.selectOption('#pkm','PAN1');await p.fill('#pkq','10');await p.click('[data-a=addline]');
  ok('confirm disabled without photo/declared',await p.isDisabled('[data-a=confirm]'));
  await p.fill('input[data-f=declared]','10');await p.dispatchEvent('input[data-f=declared]','change');
  await p.setInputFiles('input[data-c=photo]',{name:'p.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64')});await p.waitForTimeout(200);
  ok('confirm enabled',!(await p.isDisabled('[data-a=confirm]')));
  const before=await ready();await p.click('[data-a=confirm]');await p.waitForTimeout(200);
  ok('receipt adds 10',(await ready())===before+10);
  // 7 mismatch declared
  await p.click('[data-a=backops]');await p.click('[data-a=newop][data-t=RCV]');await p.click('[data-a=addline]');
  await p.fill('input[data-f=declared]','99');await p.dispatchEvent('input[data-f=declared]','change');
  t=await txt();ok('declared mismatch flagged',/المكتوب في الورقة/.test(t));
  console.log('DBG1',await p.locator('[data-a=deldoc]').count(),await p.evaluate(()=>JSON.stringify(__F.S().docs.map(d=>d.id+d.type+d.status))));await p.click('[data-a=deldoc]');
  console.log('DBG2',errs.join('|'),await p.evaluate(()=>__F.UI.tab+'/'+__F.UI.doc),(await p.textContent('h1')));
  // 8 CLN to dirty then FSD
  await p.click('[data-a=newop][data-t=CLN]');await p.selectOption('#pkm','PAN1');await p.fill('#pkq','3');await p.click('[data-a=addline]');
  await p.click('[data-a=confirm]');await p.waitForTimeout(200);
  const dirtyN=await p.evaluate(()=>__F.D?0:__F.S().moves.filter(m=>m.to==='DIRTY').reduce((a,m)=>a+m.q,0));ok('3 moved to cleaning',dirtyN===3);
  // 9 too many
  await p.click('[data-a=backops]');await p.click('[data-a=newop][data-t=CLN]');await p.selectOption('#pkm','A2');await p.fill('#pkq','5');await p.click('[data-a=addline]');
  t=await txt();ok('insufficient stock blocked',/المتاح في جاهز للبيع/.test(t)&&await p.isDisabled('[data-a=confirm]'));
  await p.click('[data-a=deldoc]');
  // 10 return with codes of scanned order
  const code=await p.evaluate(()=>__F.S().orders.find(o=>o.st==='done').ref);
  await p.click('[data-a=newop][data-t=RTN]');await p.fill('textarea[data-c=rtncodes]',code);await p.dispatchEvent('textarea[data-c=rtncodes]','change');await p.click('[data-a=rtnfill]');await p.waitForTimeout(100);
  const lines=await p.evaluate(()=>__F.S().docs.find(d=>d.id===__F.UI.doc).lines.length);ok('return expected filled from order code',lines>=1);
  await p.check('[data-c=rtncounted]');
  const lostBefore=await p.evaluate(()=>__F.S().moves.filter(m=>m.to==='LOST').length);
  await p.click('[data-a=confirm]');await p.waitForTimeout(200);
  const lostAfter=await p.evaluate(()=>__F.S().moves.filter(m=>m.to==='LOST').reduce((a,m)=>a+m.q,0));ok('uncounted pieces became LOST',lostAfter>=1);
  await p.click('[data-a=backops]');
  // 11 count
  await p.click('[data-a=newop][data-t=CNT]');await p.click('[data-a=cntm][data-m=BR1]');await p.click('[data-a=cntstart]');
  const first=await p.evaluate(()=>document.querySelector('input[data-c=cnt]').dataset.sku);
  await p.fill('input[data-c=cnt]',String(await p.evaluate(s=>__F.g(s,'READY')+2,first)));await p.dispatchEvent('input[data-c=cnt]','change');
  await p.click('[data-a=cntreveal]');t=await txt();ok('count reveals +2 diff',/\+2/.test(t));
  const rb=await ready();await p.click('[data-a=confirm]');await p.waitForTimeout(200);ok('count applied',(await ready())===rb+2);
  await p.click('[data-a=backops]');
  // 12 supplies consumption
  await nav('supplies');t=await txt();
  const fly=await p.evaluate(()=>__F.S().sup.log.filter(e=>e.item==='FLY').reduce((a,e)=>a+e.q,0));ok('flyers consumed 28 (2000-28)',fly===1972);
  const cup=await p.evaluate(()=>__F.S().sup.log.filter(e=>e.item==='CUP').reduce((a,e)=>a+e.q,0));ok('cups consumed for BR1',cup<960);
  // 13 insights tabs
  await nav('insights');for(const v of ['plan','demand','kits','team','health']){await p.click(`[data-a=instab][data-v=${v}]`);}
  t=await txt();ok('health shows zero drift',/صفر/.test(t));
  await p.click('[data-a=instab][data-v=team]');t=await txt();ok('team table has عبدالله',/عبدالله/.test(t));
  // 14 stock table search
  await nav('stock');await p.click('[data-a=sview][data-v=table]');await p.fill('#sq','PAN1 احمر');await p.waitForTimeout(100);
  t=await p.textContent('#stres');ok('search filters',/PAN1/.test(t)&&!/BR2/.test(t));
  await p.click('#stres tbody tr');await p.waitForSelector('.sheet');t=await txt();ok('sku sheet opens',/جاهز للبيع/.test(t));
  await p.keyboard.press('Escape');
  // 15 reset
  // mobile
  await p.setViewportSize({width:400,height:800});for(const tb of ['today','orders','stock','ops','supplies','insights','ledger','config']){await nav(tb);await p.waitForTimeout(80);const ow=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(ow>0)ok('mobile overflow '+tb+' '+ow,false)}
  ok('mobile pass',true);
  await p.screenshot({path:'m_ops.png'});await nav('today');await p.screenshot({path:'m_today.png'});
  console.log(pass+' passed, '+fail+' failed');console.log(errs.length?errs.join('\n'):'ERRORS: none');
  await b.close();
})();
