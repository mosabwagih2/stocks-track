
/* ---------- icons ---------- */
const IP={today:'<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z"/>',orders:'<path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>',stock:'<path d="M12 3l8 4.5-8 4.5-8-4.5zM4 12l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/>',ops:'<path d="M7 7h13l-4-4M17 17H4l4 4"/>',supplies:'<path d="M5 8h14l-1 12H6zM9 8a3 3 0 016 0"/>',insights:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',ledger:'<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>',config:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>',
 in:'<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',out:'<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>',back:'<path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3"/>',scan:'<path d="M4 8V5h3M17 4h3v3M20 16v3h-3M7 20H4v-3M8 8v8M12 8v8M16 8v8"/>',shop:'<path d="M4 9l1-5h14l1 5M4 9v11h16V9M9 20v-6h6v6"/>',swap:'<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',count:'<path d="M9 11l2 2 4-4M5 4h14v16H5z"/>',search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'};
const ic=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(IP[n]||'')+'</svg>';

/* ---------- documents ---------- */
const UI={tab:'today',o:{f:'all',q:'',n:60,tab:'list'},s:{m:'BR2',state:'READY',q:'',view:'all'},opF:'all',doc:null,sheet:null,led:{q:'',type:'',tab:'moves',n:150},sel:{},msg:null,pk:{m:'BR2'},ins:'plan'};
const PH={};
const logE=m=>({t:Date.now(),by:S.actor,m});
const srcLoc=(d)=>d.type==='CLN'?d.hdr.from:d.type==='FSD'?(d.hdr.kind==='wash'?'DIRTY':'SCRAP'):d.type==='FRC'?'FACTORY':d.type==='LOS'?'LOST':d.type==='SHP'?'READY':null;
function newDoc(type,pre){
  pre=pre||{};
  const d={id:'d'+(S.did++),type,status:'draft',no:null,date:S.date,by:S.actor,hdr:{},lines:[],log:[logE('اتفتحت مسودة')]};
  if(type==='RCV')d.hdr={ref:'',declared:''};
  if(type==='RTN')d.hdr={channel:'VENDOOR',codes:'',counted:false,unk:[]};
  if(type==='SHP')d.hdr={note:''};
  if(type==='CLN')d.hdr={from:'READY',to:'DIRTY',reason:''};
  if(type==='FSD')d.hdr={kind:'wash'};
  if(type==='CNT')d.hdr={state:'READY',models:[],snap:{},cnt:{},reveal:false,ack:false,started:false};
  if(pre.sku)addLine(d,pre.sku,pre.q||1);
  if(pre.hdr)Object.assign(d.hdr,pre.hdr);
  S.docs.push(d);UI.doc=d.id;UI.msg=null;dirty();return d;
}
function addLine(d,sku,q){
  q=Math.max(1,+q||1);const l=d.lines.find(x=>x.sku===sku);
  if(l){if(d.type==='RTN')l.exp+=q;else l.q+=q;return}
  d.lines.push(d.type==='RTN'?{sku,exp:q,r:'',d:'',x:''}:d.type==='FRC'?{sku,q,rej:0}:d.type==='LOS'?{sku,q,res:'FOUND'}:{sku,q});
}
const num=v=>Math.max(0,Math.floor(+v||0));
function scnLines(d){const a={};d.hdr.refs.forEach(r=>{const o=orderByRef(r);if(o)o.lines.forEach(s=>a[s]=(a[s]||0)+1)});return Object.keys(a).sort(skuSort).map(s=>({sku:s,q:a[s]}))}
function build(d){
  const mv=[],checks=[],warn=[];
  const add=(sku,q,from,to,note)=>{if(q>0)mv.push({sku,q,from,to,note})};
  const chk=(ok,t)=>checks.push({ok:!!ok,t});
  const H=d.hdr,L=d.lines;
  if(d.type==='RCV'){
    L.forEach(l=>add(l.sku,num(l.q),'EXT_FACTORY','READY','استلام من المصنع'+(H.ref?' · إذن '+H.ref:'')));
    const tot=L.reduce((a,l)=>a+num(l.q),0);
    chk(tot>0,'فيه أصناف مضافة');chk(PH[d.id]||d.photo,'صورة الورقة الموقّعة مرفوعة');
    chk(H.declared!==''&&H.declared!=null,'إجمالي القطع المكتوب في الورقة متسجّل');
    if(H.declared!==''&&H.declared!=null)chk(+H.declared===tot,'المكتوب في الورقة ('+fmt(+H.declared)+') = المضاف ('+fmt(tot)+')');
  }else if(d.type==='SHP'){
    L.forEach(l=>add(l.sku,num(l.q),'READY','EXT_SHOP','توريد للمحل'+(H.note?' · '+H.note:'')));
    chk(L.length>0,'فيه أصناف مضافة');chk(PH[d.id]||d.photo,'صورة الورقة الموقّعة مرفوعة');
  }else if(d.type==='CLN'){
    L.forEach(l=>add(l.sku,num(l.q),H.from,H.to,'من '+LOC[H.from]+' إلى '+LOC[H.to]+(H.reason?' · '+H.reason:'')));
    chk(L.length>0,'فيه أصناف مضافة');
  }else if(d.type==='FSD'){
    L.forEach(l=>H.kind==='wash'?add(l.sku,num(l.q),'DIRTY','FACTORY','غسيل مجاني'):add(l.sku,num(l.q),'SCRAP','EXT_FACTORY','هالك اتسلّم للمصنع'));
    chk(L.length>0,'فيه أصناف مضافة');
  }else if(d.type==='FRC'){
    L.forEach(l=>{add(l.sku,num(l.q),'FACTORY','READY','رجع مغسول');add(l.sku,num(l.rej),'FACTORY','SCRAP','مرفوض بعد الغسيل')});
    chk(L.length>0,'فيه أصناف مضافة');
  }else if(d.type==='LOS'){
    L.forEach(l=>l.res==='FOUND'?add(l.sku,num(l.q),'LOST','READY','لقيناه'):add(l.sku,num(l.q),'LOST','EXT_OFF','تسوية: شطب المفقود'));
    chk(L.length>0,'فيه أصناف مضافة');
  }else if(d.type==='RTN'){
    let lostN=0,over=0;
    L.forEach(l=>{const r=num(l.r),dd=num(l.d),x=num(l.x),got=r+dd+x,exp=num(l.exp);
      add(l.sku,r,'EXT_CH','READY','مرتجع سليم');add(l.sku,dd,'EXT_CH','DIRTY','مرتجع محتاج نظافة');add(l.sku,x,'EXT_CH','SCRAP','مرتجع هالك نهائي');
      if(got<exp){add(l.sku,exp-got,'EXT_CH','LOST','ناقص من المرتجع');lostN+=exp-got}
      if(got>exp){over+=got-exp;warn.push(skuName(l.sku)+': استلمت أكتر من المتوقع بـ '+(got-exp)+' (هتتسجل زيادة)')}});
    chk(L.length>0,'فيه أصناف متوقعة');chk(H.counted,'خلّصت عدّ كل الأصناف');
    if(lostN)warn.push('الناقص '+fmt(lostN)+' قطعة هيتسجل مفقود ومربوط بالقناة');
  }else if(d.type==='SCN'){
    scnLines(d).forEach(l=>add(l.sku,l.q,'READY','EXT_CH','سكان: '+H.emp));
    chk(H.refs.length>0,'فيه أوردرات متسكّنة');chk((H.emp||'').trim(),'اسم الموظف متسجّل');
    scnLines(d).forEach(l=>{if(g(l.sku,'READY')<l.q)warn.push(skuName(l.sku)+': الرصيد '+g(l.sku,'READY')+' والمسكّن '+l.q+'. هيبقى بالسالب، راجع الجرد')});
  }else if(d.type==='CNT'){
    const keys=Object.keys(H.cnt).filter(s=>H.cnt[s]!==''&&H.cnt[s]!=null);
    let conflict=0;
    keys.forEach(s=>{const now=g(s,H.state),c=num(H.cnt[s]),diff=c-now;if(now!==(H.snap[s]!=null?H.snap[s]:now))conflict++;
      if(diff>0)add(s,diff,'EXT_ADJ',H.state,'زيادة جرد');else if(diff<0)add(s,-diff,H.state,'EXT_ADJ','عجز جرد')});
    chk(keys.length>0,'فيه أصناف اتعدّت');chk(H.reveal,'كشفت الفروق وراجعتها');
    if(conflict){chk(H.ack,conflict+' صنف الرصيد اتغيّر من وقت بداية الجرد. وافقت إن الفرق يتحسب على الرصيد الحالي');}
  }
  const err=[];
  if(d.type!=='SCN'){
    const sim={};
    mv.forEach(m=>{if(INTERNAL.indexOf(m.from)<0)return;const k=m.sku+'|'+m.from,cur=(k in sim)?sim[k]:g(m.sku,m.from);
      if(cur<m.q)err.push(skuName(m.sku)+': المتاح في '+LOC[m.from]+' هو '+cur+' والمطلوب '+m.q);sim[k]=cur-m.q;
      if(INTERNAL.indexOf(m.to)>=0){const k2=m.sku+'|'+m.to;sim[k2]=((k2 in sim)?sim[k2]:g(m.sku,m.to))+m.q}});
  }
  return {mv,checks,warn,err,ok:checks.every(c=>c.ok)&&!err.length&&mv.length>0};
}
function effects(mv){
  const by={};
  mv.forEach(m=>{const o=by[m.sku]||(by[m.sku]={});if(INTERNAL.indexOf(m.from)>=0)o[m.from]=(o[m.from]||0)-m.q;if(INTERNAL.indexOf(m.to)>=0)o[m.to]=(o[m.to]||0)+m.q});
  return Object.keys(by).sort(skuSort).map(s=>({sku:s,ch:Object.keys(by[s]).filter(l=>by[s][l]!==0).map(l=>({l,now:g(s,l),after:g(s,l)+by[s][l]}))}));
}
function confirmDoc(d){
  const r=build(d);if(!r.ok)return false;
  d.no=OT[d.type].pre+'-'+String(S.seq[d.type]=(S.seq[d.type]||0)+1).padStart(4,'0');
  d.status='done';d.confirmedAt=Date.now();d.nMoves=r.mv.length;
  post(r.mv,d);
  if(d.type==='SCN'){
    const agg={},nOrd=d.hdr.refs.length;
    d.hdr.refs.forEach(ref=>{const o=orderByRef(ref);if(!o)return;o.st='done';o.sc={by:d.hdr.emp.trim(),at:Date.now(),date:d.date,doc:d.no,t:(d.hdr.times||{})[ref]||''};
      consumption(o).forEach(c=>{agg[c[0]]=(agg[c[0]]||0)+c[1]})});
    Object.keys(agg).forEach(k=>supPush(k,agg[k],'auto','سكان '+d.hdr.emp.trim()+': '+nOrd+' أوردر',d.no,d.date));
    const e=d.hdr.emp.trim();if(e&&S.emps.indexOf(e)<0)S.emps.push(e);
  }
  d.log.push(logE('اتأكدت وسجّلت '+r.mv.length+' حركة'));dirty();return true;
}
function reverseDoc(d){
  if(d.status!=='done')return {ok:false,err:['العملية مش مؤكدة']};
  const orig=S.moves.filter(m=>m.doc===d.no&&m.type===d.type);
  const rev=orig.map(m=>({sku:m.sku,q:m.q,from:m.to,to:m.from,note:'عكس '+d.no}));
  if(d.type!=='SCN'){
    const sim={},err=[];rev.forEach(m=>{if(INTERNAL.indexOf(m.from)<0)return;const k=m.sku+'|'+m.from,cur=(k in sim)?sim[k]:g(m.sku,m.from);if(cur<m.q)err.push(skuName(m.sku)+': مش موجود في '+LOC[m.from]+' ('+cur+')');sim[k]=cur-m.q});
    if(err.length)return {ok:false,err};
  }
  post(rev,{type:d.type,date:S.date,no:d.no+' (عكس)',id:d.id});
  d.status='reversed';d.log.push(logE('اتعكست'));
  if(d.type==='SCN'){
    S.orders.forEach(o=>{if(o.sc&&o.sc.doc===d.no){o.st='open';o.sc=null}});
    S.sup.log.filter(e=>e.doc===d.no&&e.kind==='auto'&&!e.rev).forEach(e=>{supPush(e.item,-e.q,'rev','عكس '+d.no,d.no+' (عكس)',S.date,{of:e.id,ofKind:'auto'});e.rev=true});
  }
  dirty();return {ok:true};
}
function makeScn(matched,emp,src,times){
  const d=newDoc('SCN');d.hdr={emp:emp,src:src,refs:matched.map(m=>m.ref),times:Object.fromEntries(matched.map(m=>[m.ref,m.t||'']))};
  return d;
}
