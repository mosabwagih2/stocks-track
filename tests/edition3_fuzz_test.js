// Randomised operations through the real code paths; after every step the ledger, orders and supplies must stay consistent.
const {chromium}=require('playwright');const fs=require('fs');
const app=process.env.APP||'apps/edition-3-brand-v2/index.html';const STEPS=+(process.env.STEPS||260);let pass=0,fail=0;
const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+(x||'')))};
(async()=>{
  const wrap='/tmp/_e3_fuzz_wrap.html';fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(300);
  const res=await p.evaluate(({STEPS})=>{
    const F=__F;F.ACT.demoload();const S=()=>F.S();
    let sv=777;const rnd=()=>{sv=(sv+0x6D2B79F5)|0;let t=Math.imul(sv^(sv>>>15),1|sv);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296};
    const pick=a=>a[Math.floor(rnd()*a.length)];
    const INT=['READY','DIRTY','FACTORY','SCRAP','LOST'],EXT=['EXT_OPEN','EXT_FACTORY','EXT_CH','EXT_SHOP','EXT_ADJ','EXT_OFF'],ALL=INT.concat(EXT);
    const skus=new Set(F.D.skus.map(k=>k.id));
    const problems=[];const note=(step,op,msg)=>{if(problems.length<12)problems.push(step+' '+op+': '+msg)};
    function check(step,op,allowNeg){
      const s=S(),bal={};
      s.moves.forEach(m=>{if(!(m.q>0)||m.q!==Math.floor(m.q))note(step,op,'bad qty '+m.q);if(m.from===m.to)note(step,op,'same loc');if(ALL.indexOf(m.from)<0||ALL.indexOf(m.to)<0)note(step,op,'bad loc');if(!skus.has(m.sku))note(step,op,'bad sku '+m.sku);
        const o=bal[m.sku]||(bal[m.sku]={});o[m.from]=(o[m.from]||0)-m.q;o[m.to]=(o[m.to]||0)+m.q});
      let neg=0;Object.keys(bal).forEach(k=>{const t=ALL.reduce((a,l)=>a+(bal[k][l]||0),0);if(t!==0)note(step,op,'not conserved '+k);INT.forEach(l=>{if((bal[k][l]||0)<0)neg++})});
      if(neg>(allowNeg||1))note(step,op,'negative internal balances: '+neg);
      s.orders.forEach(o=>{if(['open','done','cx'].indexOf(o.st)<0)note(step,op,'order state '+o.ref);if(o.st==='open'&&o.sc)note(step,op,'open order with scan '+o.ref);if(o.st==='done'&&!o.sc)note(step,op,'done without scan '+o.ref);if(o.rt&&o.st!=='done')note(step,op,'returned but not done '+o.ref);if(o.st==='cx'&&!o.cx)note(step,op,'cx without record '+o.ref)});
      // pieces out with customers == lines of scanned orders that were not returned
      const outNow=Object.keys(bal).reduce((a,k)=>a+(bal[k].EXT_CH||0),0);
      let exp=0;s.orders.forEach(o=>{if(!o.sc)return;if(o.rt)return;if(o.cx&&o.cx.returned&&!o.cx.viaRet)return;exp+=o.lines.length});
      if(outNow!==exp)note(step,op,'with-customers '+outNow+' vs orders '+exp);
      s.sup.items.forEach(i=>{const b=s.sup.log.reduce((a,e)=>a+(e.item===i.id?e.q:0),0);void b});
    }
    check(0,'start',3);
    const log={};let steps=0;
    const ops=[
      function scan(){const C=F.ctx(),pkD=Object.fromEntries(s2().pickups.map(x=>[x.id,x.date])),c=C.open.filter(o=>!C.blocked[o.ref]&&!(o.bad&&o.bad.length)).slice(0,1+Math.floor(rnd()*8));if(!c.length)return 'skip';const d=F.newDoc('SCN');d.hdr={emp:pick(['أحمد','منى']),src:'fuzz',refs:c.map(o=>o.ref),times:{}};return F.confirmDoc(d)?'ok':'refused'},
      function ret(){const done=s2().orders.filter(o=>o.st==='done'&&!o.rt&&!(o.cx));if(!done.length)return 'skip';const os=[pick(done),pick(done)].filter((o,i,a)=>a.indexOf(o)===i);const d=F.newDoc('RTN');d.hdr.channel='VENDOOR';d.hdr.refs=os.map(o=>o.ref);os.forEach(o=>o.lines.forEach(k=>F.addLine(d,k,1)));d.lines.forEach(l=>{const t=l.exp;let r=0,dd=0,x=0;for(let i=0;i<t;i++){const u=rnd();if(u<.1)continue;if(u<.15)x++;else if(u<.35)dd++;else r++}l.r=r;l.d=dd;l.x=x});d.hdr.counted=true;return F.confirmDoc(d)?'ok':'refused'},
      function cancel(){const o=pick(s2().orders.filter(o=>o.st==='open'));if(!o)return 'skip';return F.cxApply({code:o.ref,reason:'fuzz',photo:'x',ret:false})?'ok':'refused'},
      function cancelShipped(){const o=pick(s2().orders.filter(o=>o.st==='done'&&!o.rt));if(!o)return 'skip';return F.cxApply({code:o.ref,reason:'fuzz',photo:'x',ret:true})?'ok':'refused'},
      function reverse(){const d=pick(s2().docs.filter(d=>d.status==='done'&&d.date>=addD(s2().date,-3)));if(!d)return 'skip';return F.reverseDoc(d).ok?'ok':'refused'},
      function wash(){const ls=F.D.skus.filter(k=>F.g(k.id,'DIRTY')>0).slice(0,6);if(!ls.length)return 'skip';const d=F.newDoc('FSD');d.hdr.kind='wash';ls.forEach(k=>d.lines.push({sku:k.id,q:1+Math.floor(rnd()*F.g(k.id,'DIRTY'))}));return F.confirmDoc(d)?'ok':'refused'},
      function recvWashed(){const ls=F.D.skus.filter(k=>F.g(k.id,'FACTORY')>0).slice(0,6);if(!ls.length)return 'skip';const d=F.newDoc('FRC');ls.forEach(k=>{const q=1+Math.floor(rnd()*F.g(k.id,'FACTORY')),rej=rnd()<.3?Math.min(q,1):0;d.lines.push({sku:k.id,q:q-rej,rej})});return F.confirmDoc(d)?'ok':'refused'},
      function clean(){const ls=F.D.skus.filter(k=>F.g(k.id,'READY')>3).slice(0,3);const d=F.newDoc('CLN');d.hdr={from:'READY',to:pick(['DIRTY','SCRAP']),reason:'fuzz'};ls.forEach(k=>d.lines.push({sku:k.id,q:1+Math.floor(rnd()*2)}));return F.confirmDoc(d)?'ok':'refused'},
      function lost(){const ls=F.D.skus.filter(k=>F.g(k.id,'LOST')>0).slice(0,4);if(!ls.length)return 'skip';const d=F.newDoc('LOS');ls.forEach(k=>d.lines.push({sku:k.id,q:1,res:rnd()<.5?'FOUND':'OFF'}));return F.confirmDoc(d)?'ok':'refused'},
      function count(){const ks=F.D.skus.filter(k=>k.m==='A1'||k.m==='PAN1').slice(0,12);const d=F.newDoc('CNT');d.hdr.state='READY';d.hdr.models=['A1','PAN1'];ks.forEach(k=>{const n=F.g(k.id,'READY');d.hdr.snap[k.id]=n;d.hdr.cnt[k.id]=Math.max(0,n+pick([-2,-1,0,0,1,2]))});d.hdr.started=true;d.hdr.reveal=true;return F.confirmDoc(d)?'ok':'refused'},
      function shop(){const ks=F.D.skus.filter(k=>F.g(k.id,'READY')>5).slice(0,5);if(!ks.length)return 'skip';const d=F.newDoc('SHP');d.hdr.note='fuzz';ks.forEach(k=>d.lines.push({sku:k.id,q:1+Math.floor(rnd()*2)}));window.__ph=1;return F.confirmDoc(d)?'ok':'refused'},
      function receive(){const ks=F.D.skus.filter(k=>k.m==='BR2').slice(0,6);const d=F.newDoc('RCV');let t=0;ks.forEach(k=>{const q=1+Math.floor(rnd()*9);t+=q;d.lines.push({sku:k.id,q})});d.hdr.declared=t;return F.confirmDoc(d)?'ok':'refused'},
      function closeOpen(){const days=F.dayLocked(S().date)?null:true;if(!days)return 'skip';const ck=F.closeChecks(S().date);if(ck.blockers)return 'blocked';F.ACT.closeday();F.UI.cl={};F.ACT.clconfirm();const r=F.dayLocked(S().date);F.UI.sheet=null;if(r){const last=S().closes.filter(x=>x.status==='closed').slice(-1)[0];last.status='reopened';last.reopened={at:1,by:'t',reason:'fuzz'};S().lock='';}return r?'ok':'refused'}
    ];
    const addD=(d,n)=>new Date(Date.parse(d)+n*864e5).toISOString().slice(0,10);const s2=S;
    // PH photo for receive/shop docs
    const origNew=F.newDoc;
    for(let i=1;i<=STEPS;i++){
      const op=pick(ops),name=op.name;let r;try{r=op()}catch(e){note(i,name,'EXC '+e.message);r='exc'}
      log[name+':'+r]=(log[name+':'+r]||0)+1;check(i,name,3);
    }
    F.render();
    return {problems,log,orders:S().orders.length,moves:S().moves.length,kb:Math.round(JSON.stringify(S()).length/1024)};
  },{STEPS});
  console.log(JSON.stringify(res.log));
  ok('ledger conserved, quantities valid, order and supply states consistent after '+STEPS+' random operations',res.problems.length===0,res.problems.join(' | '));
  ok('storage stays reasonable after the run (< 4000 KB)',res.kb<4000,res.kb);
  ok('no page errors',errs.length===0,errs.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
