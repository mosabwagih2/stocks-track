// Visits every screen in both themes, on desktop and phone, with empty and demo data. Looks for errors, NaN/undefined text, overflow, and unescaped HTML.
const {chromium,devices}=require('playwright');const fs=require('fs');
const app=process.env.APP||'apps/edition-3-brand-v2/index.html';let pass=0,fail=0;
const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+String(x).slice(0,600)))};
(async()=>{
  const wrap='/tmp/_e3_crawl_wrap.html';fs.writeFileSync(wrap,'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>\n'+fs.readFileSync(app,'utf8')+'\n</body></html>');
  const b=await chromium.launch();
  const SCREENS=[
    ['today',`__F.UI.vd=null;__F.go('today')`],['today-old',`__F.UI.vd=new Date(Date.parse(__F.S().date)-2*864e5).toISOString().slice(0,10);__F.go('today')`],
    ...['list','heat','all','matrix','table'].map(v=>['stock-'+v,`__F.UI.vd=null;__F.UI.s.view='${v}';__F.UI.s.state='READY';__F.go('stock')`]),
    ...['DIRTY','FACTORY','SCRAP','LOST'].map(st=>['stock-state-'+st,`__F.UI.s.view='list';__F.UI.s.state='${st}';__F.go('stock')`]),
    ['supplies',`__F.UI.s.state='READY';__F.go('supplies')`],['ops',`__F.UI.doc=null;__F.go('ops')`],
    ...['dash','demand','plan','stuck','health','team'].flatMap(t=>['all','7'].map(pp=>['ins-'+t+'-'+pp,`__F.UI.ins='${t}';__F.UI.insP='${pp}';__F.go('insights')`])),
    ...['all','wait','blocked','done','cx','bad'].map(f=>['orders-'+f,`__F.UI.o.f='${f}';__F.UI.o.tab='list';__F.go('orders')`]),['orders-prep',`__F.UI.o.tab='prep';__F.go('orders')`],
    ['ledger',`__F.UI.led.type='';__F.go('ledger')`],['files',`__F.go('files')`],
    ...['plan','sup','cost','acc','sys','demo'].map(t=>['config-'+t,`__F.UI.cfgTab='${t}';__F.go('config')`])
  ];
  const SHEETS=[`__F.ACT.closeday()`,`__F.ACT.recvmenu()`,`__F.ACT.whoami()`,`__F.ACT.upload({dataset:{t:'pickup'}})`,`__F.ACT.upload({dataset:{t:'scan'}})`,`__F.ACT.cxopen({dataset:{}})`,`__F.ACT.more()`];
  const OPS=['RCV','RTN','SHP','CLN','FSD','FRC','CNT','LOS'];
  const scan=async(p,label)=>{
    const bad=[];
    for(const [n,f] of SCREENS){await p.evaluate(c=>eval(c),f);await p.waitForTimeout(40);
      const r=await p.evaluate(()=>{const t=document.body.innerText;const m=t.match(/NaN|undefined|\[object|Infinity|null(?![a-z])/);return {bad:m?m[0]:null,ow:document.documentElement.scrollWidth-document.documentElement.clientWidth,empty:document.getElementById('main')?document.getElementById('main').innerText.trim().length<5:false}});
      if(r.bad)bad.push(label+' '+n+': text "'+r.bad+'"');if(r.ow>1)bad.push(label+' '+n+': overflow '+r.ow+'px');if(r.empty)bad.push(label+' '+n+': empty');}
    for(const [i,f] of SHEETS.entries()){await p.evaluate(c=>eval(c),f);await p.waitForTimeout(40);
      const r=await p.evaluate(()=>{const t=document.querySelector('.sheet')?document.querySelector('.sheet').innerText:'';const m=t.match(/NaN|undefined|\[object|Infinity/);return {bad:m?m[0]:null,open:!!document.querySelector('.sheet'),ow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
      if(r.bad)bad.push(label+' sheet'+i+': text "'+r.bad+'"');if(r.ow>1)bad.push(label+' sheet'+i+': overflow');await p.evaluate(()=>{__F.UI.sheet=null;__F.render()})}
    for(const t of OPS){await p.evaluate(t=>{__F.go('ops',()=>{__F.newDoc(t)})},t);await p.waitForTimeout(40);
      const r=await p.evaluate(()=>{const m=document.getElementById('main').innerText.match(/NaN|undefined|\[object|Infinity/);return {bad:m?m[0]:null,ow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
      if(r.bad)bad.push(label+' op '+t+': text "'+r.bad+'"');if(r.ow>1)bad.push(label+' op '+t+': overflow')}
    return bad;
  };
  for(const [vp,ctx] of [['desktop',{viewport:{width:1280,height:900}}],['phone',{...devices['iPhone 13']}]])for(const theme of ['light','dark'])for(const data of ['empty','demo']){
    const c=await b.newContext(ctx);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts|xlsx|net::/.test(m.text()))errs.push(m.text())});
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(250);
    await p.evaluate(t=>{document.documentElement.dataset.theme=t},theme);
    if(data==='demo'){await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(300)}
    const bad=await scan(p,vp+'/'+theme+'/'+data);
    ok(vp+' · '+theme+' · '+data+' data: every screen, sheet and document type renders clean',bad.length===0&&errs.length===0,bad.slice(0,6).join(' | ')+' '+errs.slice(0,3).join('|'));
    await c.close();
  }
  // HTML injection: hostile text typed anywhere must never execute or create elements
  {
    const c=await b.newContext({viewport:{width:1280,height:900}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file://'+wrap);await p.waitForSelector('.shell');await p.waitForTimeout(250);
    await p.evaluate(()=>__F.ACT.demoload());await p.waitForTimeout(300);
    const X='"><img src=x onerror="window.__xss=1"><b id=xssb>x</b>';
    await p.evaluate(X=>{const F=__F,S=F.S();window.__xss=0;
      S.users[0].name=X;S.actor=X;S.emps.push(X);S.pickups[0].label=X;S.orders[0].gov=X;S.orders[0].ref='r'+X;S.orders[5].gov=X;
      S.sup.items[0].name=X;S.sup.log.push({id:99999,t:1,date:S.date,item:S.sup.items[0].id,q:5,kind:'rcv',why:X,doc:null,by:X});
      S.docs.push({id:'dx',type:'CLN',status:'done',no:'CLN-9999',date:S.date,by:X,hdr:{from:'READY',to:'DIRTY',reason:X},lines:[],log:[{t:1,by:X,m:X}]});
      S.moves.push({id:S.mid++,t:1,date:S.date,sku:F.D.skus[0].id,q:1,from:'READY',to:'DIRTY',type:'CLN',doc:'CLN-9999',by:X,note:X});
      const o=S.orders.find(o=>o.st==='open');o.bad=[[X,X,X,1]];F.dirty()},X);
    for(const [n,f] of SCREENS){await p.evaluate(c=>eval(c),f);await p.waitForTimeout(25)}
    for(const f of SHEETS){await p.evaluate(c=>eval(c),f);await p.waitForTimeout(25);await p.evaluate(()=>{__F.UI.sheet=null;__F.render()})}
    await p.evaluate(()=>{__F.UI.ins='team';__F.go('insights')});
    const r=await p.evaluate(()=>({x:window.__xss,b:!!document.getElementById('xssb')}));
    ok('hostile text in names, notes, pickups, orders, supplies, documents and unmapped codes never executes or injects elements',!r.x&&!r.b&&errs.length===0,JSON.stringify(r)+errs.join('|'));
    await c.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0);
})();
