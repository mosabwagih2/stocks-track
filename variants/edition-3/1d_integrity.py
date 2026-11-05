import pathlib
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'base.html').read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:80],s.count(a))
    s=s.replace(a,b)

# ---------- 1. ONE reorder engine (per SKU) used by alerts, plan, matrix colors and the rate tab ----------
rep("""  const C=ctx(),k=SKU.get(s),R=g(s,'READY'),dm=C.demand[s]||0,v=C.vel[s]||0;
  const th=C.velOK?Math.ceil(v*S.st.cover):(k.min||0),after=R-dm;""","""  const C=ctx(),k=SKU.get(s),R=g(s,'READY'),dm=C.demand[s]||0,E=skuStats().m[s]||{rd:0,rop:0},v=C.velOK?E.rd:(C.vel[s]||0);
  const th=C.velOK?Math.ceil(E.rop):(k.min||0),after=R-dm;""")
rep("target=C.velOK?Math.ceil(i.v*S.st.target):Math.max(","target=C.velOK?Math.ceil((skuStats().m[id]||{tgt:0}).tgt):Math.max(")
rep("function info(s){","""/* One engine: per-SKU recency-weighted daily rate, safety stock, reorder point and target. Alerts, the plan tab, matrix colors and the rate tab all read from here. */
function skuStats(){
  const C=ctx();if(C._sk)return C._sk;
  const end=S.date,MAXD=28,pkD={},cnt={};S.pickups.forEach(p=>pkD[p.id]=p.date);let first=null;
  S.orders.forEach(o=>{if(o.st==='cx')return;const d=pkD[o.pk];if(!d)return;const age=dayDiff(d,end);if(age<0)return;if(first===null||d<first)first=d;
    if(age<MAXD)o.lines.forEach(sk=>{(cnt[sk]||(cnt[sk]=Array(MAXD).fill(0)))[age]++})});
  const span=first===null?0:Math.min(MAXD,Math.max(1,dayDiff(first,end)+1));let ws=0;for(let i=0;i<span;i++)ws+=Math.pow(.5,i/7);
  const lead=+rv('leadW'),tgt=+rv('tgtW'),safe=+rv('safeW'),z=zOf(rv('svc')),L=lead*7,out={};
  D.skus.forEach(k=>{const dl=(cnt[k.id]||[]).slice(0,span);let w=0;dl.forEach((v,i)=>w+=v*Math.pow(.5,i/7));
    const rd=span&&dl.length?w/ws:0,mean=span&&dl.length?dl.reduce((a,v)=>a+v,0)/span:0,sd=span>=7&&dl.length?Math.sqrt(dl.reduce((a,v)=>a+(v-mean)*(v-mean),0)/(span-1)):null;
    const ss=rd>0?(sd!=null?z*sd*Math.sqrt(L):safe*7*rd):0;out[k.id]={rd,sd,ss,rop:rd*L+ss,tgt:rd*7*(lead+tgt)+ss}});
  return C._sk={span,m:out};
}
function info(s){""")
rep("s.st.cover","s.st.cover") if False else None
rep("d:C.velOK?'أقل من '+S.st.cover+' يوم سحب'","d:C.velOK?'تحت نقطة إعادة الطلب (مهلة المصنع '+rv('leadW')+' أسبوع + مخزون أمان)'")
rep("kpi('الهدف',N(S.st.target),'يوم تغطية')","kpi('الهدف',N(rv('tgtW')),'أسبوع تغطية')")
rep("المقترح = اللي يوصّل كل صنف لـ '+S.st.target+' يوم سحب بعد خصم الطلب المفتوح وإضافة اللي راجع من المصنع","المقترح = اللي يوصّل كل صنف لـ '+rv('tgtW')+' أسبوع سحب بعد مهلة المصنع ('+rv('leadW')+' أسبوع) ومخزون الأمان، وبعد خصم الطلب المفتوح وإضافة اللي راجع من المصنع")
rep("stf('cover','نبّهني لما التغطية أقل من','يوم')+stf('target','هدف التصنيع','يوم تغطية')+","")

# rate tab: same engine, net of open orders, net shipped
a=s.index("function rateData(){");b=s.index("function rateChip(m){")
new=r"""function rateData(){
  const end=S.date,NW=8,MAXD=28,pkD={};S.pickups.forEach(p=>pkD[p.id]=p.date);
  const wi=d=>{const k=Math.floor(dayDiff(d,end)/7);return(k>=0&&k<NW)?NW-1-k:-1};
  const dem=Array(NW).fill(0),shp=Array(NW).fill(0),M={};let first=null;
  const mm=m=>M[m]||(M[m]={daily:Array(MAXD).fill(0),out:0,inflow:0,net:0});
  S.orders.forEach(o=>{if(o.st==='cx')return;const d=pkD[o.pk];if(!d)return;const age=dayDiff(d,end);if(age<0)return;if(first===null||d<first)first=d;
    const w=wi(d);if(w>=0)dem[w]+=o.lines.length;
    if(age<MAXD)o.lines.forEach(sk=>{const k=SKU.get(sk);if(k)mm(k.m).daily[age]++})});
  S.moves.forEach(m=>{const w=wi(m.date);if(w<0)return;const k=SKU.get(m.sku);
    let q=0;if(m.from==='READY'&&m.to==='EXT_CH'&&(m.type==='SCN'||m.type==='CXL'||m.type==='RTN'))q=m.q;else if(m.from==='EXT_CH'&&m.to==='READY'&&(m.type==='SCN'||m.type==='CXL'||m.type==='RTN'))q=-m.q;
    shp[w]+=q;if(w===NW-1&&k){const x=mm(k.m);x.out+=q;if(m.to==='READY'){x.net+=m.q;if(m.from!=='EXT_CH')x.inflow+=m.q}if(m.from==='READY')x.net-=m.q}});
  const span=first===null?0:Math.min(MAXD,Math.max(1,dayDiff(first,end)+1)),avail=Math.min(7,span);
  const lead=+rv('leadW'),safe=+rv('safeW'),tgt=+rv('tgtW'),z=zOf(rv('svc')),C=ctx(),E=skuStats();
  let ws=0;for(let i=0;i<span;i++)ws+=Math.pow(.5,i/7);
  const needBy={},dmBy={},ropBy={},ssBy={};planRows().forEach(r=>{const mc=SKU.get(r.id).m;needBy[mc]=(needBy[mc]||0)+r.q});
  D.skus.forEach(k=>{const e=E.m[k.id]||{rop:0,ss:0};dmBy[k.m]=(dmBy[k.m]||0)+(C.demand[k.id]||0);ropBy[k.m]=(ropBy[k.m]||0)+e.rop;ssBy[k.m]=(ssBy[k.m]||0)+e.ss});
  const rows=MORDER.map(m=>{const x=M[m]||{daily:Array(MAXD).fill(0),out:0,inflow:0,net:0},dl=x.daily.slice(0,span),ready=mSum(m,'READY'),fac=mSum(m,'FACTORY'),dm=dmBy[m]||0,pos=ready-dm+fac;
    let wsum=0;dl.forEach((v,i)=>wsum+=v*Math.pow(.5,i/7));const rate=span?7*wsum/ws:0;
    const cur=dl.slice(0,7).reduce((a,v)=>a+v,0),prev=dl.slice(7,14).reduce((a,v)=>a+v,0);
    const mean=span?dl.reduce((a,v)=>a+v,0)/span:0,sd=span>=7?Math.sqrt(dl.reduce((a,v)=>a+(v-mean)*(v-mean),0)/(span-1)):null;
    const ss=rate>0?(ssBy[m]||0):0,rop=rate>0?(ropBy[m]||0):0,cv=(span>=14&&mean>0)?sd/mean:null,xyz=cv==null?null:cv<=.5?'X':cv<=1?'Y':'Z';
    const begin=ready-x.net,den=begin+x.inflow,st=den>0?Math.max(0,x.out)/den:null;
    const cover=rate>0?Math.max(0,ready-dm)/rate:null,coverAll=rate>0?Math.max(0,pos)/rate:null,need=needBy[m]||0;
    const trend=(span>=14&&prev>0)?(cur-prev)/prev:null,ssw=rate>0?ss/rate:0;
    let k='good',label='تمام';
    if(rate>0&&pos<=rop){k='crit';label='اطلب تصنيع دلوقتي'}
    else if(rate>0&&cover<lead+ssw){k='warn';label='هيخلص قبل ما الجديد يوصل'}
    else if(rate>0&&coverAll*7>S.st.excess){k='info';label='أكتر من اللازم'}
    else if(rate===0&&ready>0){k='';label='مفيش سحب'}
    else if(rate===0){k='';label='—'}
    return {m,rate,prev,trend,ready,fac,dm,cover,coverAll,rop,ss,need,st,den,cv,xyz,abc:(C.abc||{})[m]||'',out:Math.max(0,x.out),k,label}});
  return {NW,dem,shp,rows,avail,span,end,lead,safe,tgt,z,svc:+rv('svc'),tot:rows.reduce((a,r)=>a+r.rate,0),totReady:rows.reduce((a,r)=>a+r.ready,0)};
}
"""
s=s[:a]+new+s[b:]
rep("σ هو الانحراف المعياري للطلب اليومي للموديل.","σ هو الانحراف المعياري للطلب اليومي للصنف (لون/مقاس)، وبيتجمع للموديل.")
rep("['أسابيع التغطية','الجاهز للبيع ÷ معدل السحب الأسبوعي'","['أسابيع التغطية','(الجاهز − الطلب المفتوح) ÷ معدل السحب الأسبوعي'")
rep("'لو (الجاهز + اللي عند المصنع) نزل تحتها، اطلب تصنيع.'","'لو (الجاهز − الطلب المفتوح + اللي عند المصنع) نزل تحتها، اطلب تصنيع. بتتجمع من الأصناف.'")
rep("['الكمية المقترحة','معدل السحب × (المهلة + هدف التغطية) + مخزون الأمان − (الجاهز + عند المصنع)','متقفلة على صفر لو الرصيد كفاية.']","['الكمية المقترحة','معدل السحب × (المهلة + هدف التغطية) + مخزون الأمان − (الجاهز − الطلب المفتوح + عند المصنع)','بتتحسب لكل صنف وبتتجمع للموديل. هي نفس رقم تاب \"التصنيع\" وتنبيه \"قرب يخلص\".']")

# ---------- 2. returns are linked to orders ----------
rep("  d.log.push(logE('اتأكدت وسجّلت '+r.mv.length+' حركة'));dirty();return true;","  if(d.type==='RTN')(d.hdr.refs||[]).forEach(ref=>{const o=orderByRef(ref);if(o&&!o.rt)o.rt={doc:d.no,date:d.date}});\n  d.log.push(logE('اتأكدت وسجّلت '+r.mv.length+' حركة'));dirty();return true;")
rep("    codes.forEach(c=>{const o=S.orders.find(x=>x.ref.toLowerCase()===c.toLowerCase()||String(x.wb)===c);if(!o||o.st!=='done'){unk.push(c);return}o.lines.forEach(s=>addLine(d,s,1))});\n    d.hdr.unk=unk;","    const dup=[];d.hdr.refs=d.hdr.refs||[];\n    codes.forEach(c=>{const o=S.orders.find(x=>x.ref.toLowerCase()===c.toLowerCase()||String(x.wb)===c);if(!o||o.st!=='done'){unk.push(c);return}if(o.rt||d.hdr.refs.indexOf(o.ref)>=0){if(d.hdr.refs.indexOf(o.ref)<0)dup.push(c);return}d.hdr.refs.push(o.ref);o.lines.forEach(s=>addLine(d,s,1))});\n    d.hdr.dupr=dup;d.hdr.unk=unk;")
rep("""join('، ')+'</span></div>':'')+'</section>';""".replace("join('، ')+'</span></div>':'')+'</section>';","join('، ')+'</span></div>':'')+'</section>';"),"""join('، ')+'</span></div>':'')+(H.dupr&&H.dupr.length?'<div class="msg warn" style="margin-top:8px">أوردرات اتسجّلت مرتجع قبل كده ومش هتتضاف تاني: <span class="mono">'+H.dupr.slice(0,10).map(esc).join('، ')+'</span></div>':'')+'</section>';""") if False else None
rep("""أكواد مش متشحنة أو مش موجودة: <span class="mono">'+H.unk.slice(0,10).map(esc).join('، ')+'</span></div>':'')""","""أكواد مش متشحنة أو مش موجودة: <span class="mono">'+H.unk.slice(0,10).map(esc).join('، ')+'</span></div>':'')+(H.dupr&&H.dupr.length?'<div class="msg warn" style="margin-top:8px">أوردرات اتسجّلت مرتجع قبل كده ومش هتتضاف تاني: <span class="mono">'+H.dupr.slice(0,10).map(esc).join('، ')+'</span></div>':'')""")
rep("  if((H.refs||[]).indexOf(o.ref)>=0)return {k:'added',o};","  if((H.refs||[]).indexOf(o.ref)>=0)return {k:'added',o};\n  if(o.rt)return {k:'dup',o};")
rep("  if(o.st==='done')return pill('good','اتشحن · '","  if(o.st==='done'&&o.rt)return pill('warn','اتشحن · رجع','رجع في '+o.rt.doc+' ('+o.rt.date+')');\n  if(o.st==='done')return pill('good','اتشحن · '")

# ---------- 3. cancel after return must not restore stock twice ----------
rep("  if(was==='done'&&s.ret){\n    const n=","  if(was==='done'&&s.ret&&o.rt){cx.returned=true;cx.viaRet=true;cx.doc=o.rt.doc}\n  else if(was==='done'&&s.ret){\n    const n=")
rep("o.st=(c.was==='done'&&!c.returned)?'done':'open'","o.st=(c.was==='done'&&(!c.returned||c.viaRet))?'done':'open'")
rep("  else if(o.st==='done')h+='<div class=\"msg warn\">الأوردر ده <b>اتشحن بالفعل</b>","  else if(o.st==='done'&&o.rt)h+='<div class=\"msg warn\">الأوردر ده اتشحن واتسجّل <b>مرتجع</b> ('+esc(o.rt.doc)+') والقطع رجعت المخزون. الإلغاء مش هيرجّعها تاني.</div>';\n  else if(o.st==='done')h+='<div class=\"msg warn\">الأوردر ده <b>اتشحن بالفعل</b>")

# ---------- 4. reversing a scan must not recreate stock for orders already settled ----------
rep("  const rev=orig.map(m=>({sku:m.sku,q:m.q,from:m.to,to:m.from,note:'عكس '+d.no}));","""  const skipO=d.type==='SCN'?S.orders.filter(o=>o.sc&&o.sc.doc===d.no&&(o.rt||(o.cx&&o.cx.returned))):[],sk={};skipO.forEach(o=>o.lines.forEach(x=>sk[x]=(sk[x]||0)+1));
  const rev=orig.map(m=>{const t=Math.min(m.q,sk[m.sku]||0);sk[m.sku]=(sk[m.sku]||0)-t;return {sku:m.sku,q:m.q-t,from:m.to,to:m.from,note:'عكس '+d.no}}).filter(m=>m.q>0);""")
rep("  d.status='reversed';d.log.push(logE('اتعكست'));","  d.status='reversed';d.log.push(logE('اتعكست'));\n  if(d.type==='RTN')S.orders.forEach(o=>{if(o.rt&&o.rt.doc===d.no)delete o.rt});")
rep("S.orders.forEach(o=>{if(o.sc&&o.sc.doc===d.no){o.st='open';o.sc=null}});","S.orders.forEach(o=>{if(o.sc&&o.sc.doc===d.no&&o.st==='done'&&!o.rt){o.st='open';o.sc=null}});")
rep("S.sup.log.filter(e=>e.doc===d.no&&e.kind==='auto'&&!e.rev).forEach(e=>{supPush(e.item,-e.q,'rev','عكس '+d.no,d.no+' (عكس)',S.date,{of:e.id,ofKind:'auto'});e.rev=true});","const skc={};skipO.forEach(o=>consumption(o).forEach(c=>skc[c[0]]=(skc[c[0]]||0)+(-c[1])));\n    S.sup.log.filter(e=>e.doc===d.no&&e.kind==='auto'&&!e.rev).forEach(e=>{const back=Math.max(0,-e.q-(skc[e.item]||0));if(back>0)supPush(e.item,back,'rev','عكس '+d.no,d.no+' (عكس)',S.date,{of:e.id,ofKind:'auto'});e.rev=true});")

# ---------- 5. storage: never fail silently ----------
rep("function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}","""let STORE_KB=0,SAVE_ERR=false;
function storeKB(){if(!STORE_KB)STORE_KB=Math.round(JSON.stringify(S).length/1024);return STORE_KB}
function save(){try{const j=JSON.stringify(S);STORE_KB=Math.round(j.length/1024);localStorage.setItem(KEY,j);if(SAVE_ERR){SAVE_ERR=false;render()}}catch(e){if(!SAVE_ERR){SAVE_ERR=true;render()}}}
function storeBanner(){
  if(SAVE_ERR)return '<div class="msg crit" style="margin-bottom:14px"><b>التخزين في المتصفح ممتلئ والبيانات الجديدة مش بتتحفظ.</b> متقفلش الصفحة ولا تعمل refresh. الحل الدائم هو قاعدة البيانات (نسخة Supabase).</div>';
  if(storeKB()>3500)return '<div class="msg warn" style="margin-bottom:14px">البيانات المحفوظة في المتصفح وصلت <b>'+fmt(storeKB())+' KB</b> من حوالي 5,000 KB. قرب تتملي، فالحفظ هيوقف. وقت النقل لقاعدة البيانات.</div>';
  return '';
}""")
rep("'<main class=\"main\" id=\"main\">'+(VIEWS[UI.tab]||vToday)()+'</main>'","'<main class=\"main\" id=\"main\">'+storeBanner()+(VIEWS[UI.tab]||vToday)()+'</main>'")
rep("في التحليلات.</p></section>'","في التحليلات.</p><p class=\"muted\" style=\"margin-top:4px;font-size:12px\">حجم البيانات المحفوظة في المتصفح: <b class=\"n\">'+fmt(storeKB())+'</b> KB من حوالي 5,000 KB.</p></section>'")
(T/'base.html').write_text(s,encoding='utf-8')
print('1d ok')
