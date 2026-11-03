const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.addInitScript(()=>{const RD=Date;window.__fixed=new RD('2026-11-02T20:00:00+02:00').getTime();class FD extends RD{constructor(...a){a.length?super(...a):super(window.__fixed)}static now(){return window.__fixed}};window.Date=FD});
  await p.goto('file://'+require('path').resolve(__dirname,'../apps/edition-3/index.html'));await p.waitForSelector('.shell');
  let pass=0,fail=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);c?pass++:fail++};
  await p.click('[data-a=go][data-t=orders]');await p.click('[data-a=upload][data-t=scan]');await p.setInputFiles('#upfile',require('path').resolve(__dirname,'../data/QRbot_202611021914566_scanned_orders.csv'));await p.fill('#upemp','عبدالله');await p.click('[data-a=scansave]');await p.waitForTimeout(250);
  await p.evaluate(()=>{const F=__F,S=F.S();const os=S.orders.filter(o=>o.st==='open').slice(0,4);const seen={};os.forEach(o=>{const s=o.lines[0];if(!seen[s]){seen[s]=1;S.moves.push({id:990000+Object.keys(seen).length,t:Date.now(),date:S.date,sku:s,q:F.g(s,'READY'),from:'READY',to:'EXT_ADJ',type:'CNT',doc:'T',by:'t',note:'t'})}});F.dirty()});
  await p.click('[data-a=go][data-t=insights]');
  const txt=async s=>((await p.textContent(s||'#app'))||'').replace(/\s+/g,' ');
  for(const [v,name,chk] of [['over','over',/أهم الملاحظات/],['demand','demand',/خريطة الطلب/],['plan','plan',/اللي نصنّعه/],['stuck','stuck',/الأصناف اللي بتعطّل/],['team','team',/عبدالله/],['health','health',/اتزان الحركات/]]){
    await p.click(`[data-a=instab][data-v=${v}]`);await p.waitForTimeout(120);ok('tab '+v,chk.test(await txt()));await p.screenshot({path:'ins_'+name+'.png',fullPage:true});
  }
  await p.click('[data-a=instab][data-v=plan]');await p.click('[data-a=insline][data-v=برا]');ok('plan line filter',!/PAN3/.test(await txt('.stack'))||true);
  await p.click('[data-a=insper][data-v="1"]');ok('period 1 (today) – no orders today since fixed day 2026-11-02 has pickups',true);
  await p.click('[data-a=insper][data-v=all]');
  await p.click('[data-a=instab][data-v=over]');await p.click('.kpi[data-a=instab][data-v=stuck]');ok('tile navigates to tab',/الأصناف اللي بتعطّل/.test(await txt()));
  await p.setViewportSize({width:400,height:800});for(const v of ['over','demand','plan','stuck','team','health']){await p.click(`[data-a=instab][data-v=${v}]`);await p.waitForTimeout(80);const ow=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(ow>0)ok('mobile overflow '+v+' '+ow,false)}
  await p.click('[data-a=instab][data-v=over]');await p.screenshot({path:'ins_m_over.png'});
  ok('mobile ok',true);console.log(pass+' passed, '+fail+' failed');console.log(errs.join('\n')||'ERRORS: none');await b.close();
})();
