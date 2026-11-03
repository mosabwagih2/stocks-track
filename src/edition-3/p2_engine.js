(function(){
'use strict';
const D=__DATA__;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>Math.round(n).toLocaleString('en-US');
const N=n=>'<span class="n">'+fmt(n)+'</span>';
const pct=(a,b)=>'<span class="n">'+(b?Math.round(a/b*100):0)+'%</span>';

/* ---------- master data ---------- */
const SKU=new Map(D.skus.map(k=>[k.id,k])),MODEL=new Map(D.models.map(m=>[m.code,m]));
const IDX={};D.skus.forEach(k=>IDX[k.m+'|'+k.c+'|'+k.s]=k.id);
const SIZES=D.sizes,szi=s=>SIZES.indexOf(s);
const mkey=c=>{const m=/^([A-Z]+)(\d+)$/.exec(c);return m?m[1]+String(m[2]).padStart(3,'0'):c};
const MORDER=D.models.map(m=>m.code).sort((a,b)=>mkey(a)<mkey(b)?-1:1);
const mIdx=Object.fromEntries(MORDER.map((c,i)=>[c,i]));
const skuSort=(a,b)=>{const x=SKU.get(a),y=SKU.get(b);return(mIdx[x.m]-mIdx[y.m])||(MODEL.get(x.m).colors.indexOf(x.c)-MODEL.get(y.m).colors.indexOf(y.c))||(szi(x.s)-szi(y.s))};
const lineOf=m=>/^PAN/.test(m)?'بانتي':/^BR/.test(m)?'برا':/^SH/.test(m)?'شورت':'موديلات تانية';
const LINE_ORDER=['بانتي','برا','شورت','موديلات تانية'];
const HEX={'اسود':'#1e1b24','ابيض':'#ffffff','احمر':'#d9262e','بيج':'#ead9be','رمادي':'#bdbcc4','برتقالي':'#f07a2b','زيتى':'#6f7a3c','فوشيا':'#c2317a','اصفر':'#f2c230','مينت جرين':'#8fd3b6','بيبي بلو':'#a9cbe8','كحلي':'#1f2a5a','بينك':'#f4b6c8','سيمون':'#f3a28c','روز':'#e58fa8','احمر تطعيم اسود':'#a3262c'};
const sw=c=>'<i class="sw" style="background:'+(HEX[c]||'#cfc2ec')+'"></i>';
const skuName=(s,withModel=true)=>{const k=SKU.get(s);return k?(withModel?k.m+' · ':'')+k.c+' · '+k.s:s};
const imgOf=m=>{const I=S&&S.img;return(I&&(m in I))?I[m]:((D.img||{})[m]||'')};
const thumb=(m,px)=>{const u=imgOf(m);return u?'<img class="th" src="'+u+'" alt="'+esc(m)+'" style="width:'+px+'px;height:'+px+'px">':'<span class="th ph" style="width:'+px+'px;height:'+px+'px;font-size:'+Math.max(9,Math.round(px/4))+'px">'+esc(m)+'</span>'};
const mName=c=>{const m=MODEL.get(c);return m?c+' · '+m.name:c};

/* ---------- locations (Odoo-style) ---------- */
const INTERNAL=['READY','DIRTY','FACTORY','SCRAP','LOST'];
const LOC={READY:'جاهز للبيع',DIRTY:'هالك نظافة',FACTORY:'عند المصنع',SCRAP:'هالك نهائي',LOST:'مفقود',EXT_OPEN:'رصيد افتتاحي',EXT_FACTORY:'المصنع',EXT_CH:'القناة / العميل',EXT_SHOP:'المحل',EXT_ADJ:'تسوية جرد',EXT_OFF:'شطب نهائي'};
const LOCEN={READY:'WH/Stock',DIRTY:'WH/Cleaning',FACTORY:'Transit/Factory',SCRAP:'Virtual/Scrap',LOST:'Virtual/Inventory loss'};
const LCOL={READY:'var(--c-ready)',DIRTY:'var(--c-dirty)',FACTORY:'var(--c-factory)',SCRAP:'var(--c-scrap)',LOST:'var(--c-lost)'};
const LDESC={READY:'تقدر تبيعه',DIRTY:'بيتغسل ويرجع',FACTORY:'لسه راجع من المصنع',SCRAP:'مفيش علاج',LOST:'ضايع، مستني تسوية'};
const CHAN=[{id:'VENDOOR',name:'Vendoor · فيندور',ok:true},{id:'NOON',name:'Noon · نون',ok:false},{id:'AMAZON',name:'Amazon · أمازون',ok:false}];
const chanName=id=>(CHAN.find(c=>c.id===id)||{name:id}).name;

/* ---------- operation types ---------- */
const OT={
  RCV:{ar:'استلام توريد',en:'Receipts',grp:'دخول',pre:'RCV',d:'قطع جت من المصنع بورقة موقّعة',ic:'in'},
  RTN:{ar:'مرتجعات العملاء',en:'Customer Returns',grp:'دخول',pre:'RTN',d:'اللي رجع من القنوات: جاهز أو هالك، والناقص بيتسجل مفقود',ic:'back'},
  SCN:{ar:'أوردرات اتسكانت',en:'Delivery Orders',grp:'خروج',pre:'SCN',d:'الخروج الفعلي من ملف السكان',ic:'scan'},
  SHP:{ar:'توريد للمحل',en:'Shop Transfer',grp:'خروج',pre:'SHP',d:'قطع للمحل بورقة موقّعة',ic:'shop'},
  CLN:{ar:'تصنيف حالة',en:'Status Change',grp:'داخلي',pre:'CLN',d:'قطعة بقت هالك نظافة أو هالك نهائي',ic:'swap'},
  FSD:{ar:'إرسال للمصنع',en:'Factory Send',grp:'داخلي',pre:'FSD',d:'غسيل (هيرجع) أو هالك للتسليم',ic:'out'},
  FRC:{ar:'استلام من المصنع',en:'Factory Receipt',grp:'داخلي',pre:'FRC',d:'المغسول اللي رجع، وفيه المرفوض',ic:'in'},
  CNT:{ar:'جرد',en:'Inventory Adjustment',grp:'رقابة',pre:'CNT',d:'عدّ فعلي ومقارنة بالسيستم',ic:'count'},
  LOS:{ar:'معالجة المفقود',en:'Loss Resolution',grp:'رقابة',pre:'LOS',d:'لقيناه ولا نشطبه',ic:'search'},
  OPN:{ar:'رصيد افتتاحي',en:'Opening Balance',grp:'',pre:'OPN',d:'',ic:'in'}
};
const OPS_LIST=['RCV','RTN','SCN','SHP','CLN','FSD','FRC','CNT','LOS'];

/* ---------- supplies ---------- */
const SUP=[
  {id:'FLY',ar:'فلاير الشحن',unit:'قطعة',rule:'واحد لكل أوردر. عليه البوليصة'},
  {id:'PKS',ar:'تغليف فيميني S',unit:'قطعة',rule:'أوردرات صغيرة'},
  {id:'PKM',ar:'تغليف فيميني M',unit:'قطعة',rule:'أوردرات متوسطة'},
  {id:'PKL',ar:'تغليف فيميني L',unit:'قطعة',rule:'أوردرات كبيرة'},
  {id:'CUP',ar:'كاسات البرا',unit:'كاسة',rule:'كاستين لكل قطعة BR1. الكيس 24 كاسة'}
];

/* ---------- state ---------- */
const KEY='femini-stock-v3';
let S,_bal=null,_ctx=null,_t=null;
function seed(){
  const t0=Date.parse(D.asOf+'T10:00:00+02:00'),moves=[];let mid=1;
  D.skus.forEach(k=>{if(k.open>0)moves.push({id:mid++,t:t0,date:D.asOf,sku:k.id,q:k.open,from:'EXT_OPEN',to:'READY',type:'OPN',doc:'OPN-1',by:'النظام',note:'رصيد افتتاحي من جرد 29-10'})});
  const pickups=[],orders=[];
  D.pickups.forEach((p,i)=>{const id='P'+(i+1);pickups.push({id,label:p.label,date:D.today,channel:'VENDOOR',src:'ملف فيندور 2-11-2026'});
    p.orders.forEach(o=>orders.push({ref:o.ref,wb:o.wb,type:o.type,gov:o.gov,total:o.total,lines:o.lines.slice(),pk:id,st:'open',sc:null,bad:[]}))});
  const t=Date.parse(D.asOf+'T11:00:00+02:00');
  return {v:3,moves,mid,docs:[],did:1,seq:{},pickups,orders,emps:[],actor:'مصعب',date:D.today,
    sup:{log:[['FLY',2000],['PKS',600],['PKM',600],['PKL',300],['CUP',960]].map(x=>({t,date:D.asOf,item:x[0],q:x[1],why:'رصيد افتتاحي تجريبي. عدّله بجرد',doc:null}))},
    st:{lookback:14,cover:14,excess:60,target:30,packS:2,packM:5,cupBR1:2,flyPer:1},costs:{},alias:{},img:{}};
}
function load(){try{const r=localStorage.getItem(KEY);if(r){const s=JSON.parse(r);if(s&&s.v===3){S=s;return}}}catch(e){}S=seed()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function dirty(){_bal=null;_ctx=null;clearTimeout(_t);_t=setTimeout(save,250)}
function bal(){if(_bal)return _bal;const b={};for(const m of S.moves){const o=b[m.sku]||(b[m.sku]={});o[m.from]=(o[m.from]||0)-m.q;o[m.to]=(o[m.to]||0)+m.q}return _bal=b}
const g=(s,l)=>(bal()[s]||{})[l]||0;
const total=(s)=>INTERNAL.reduce((a,l)=>a+g(s,l),0);
const locSum=l=>D.skus.reduce((a,k)=>a+g(k.id,l),0);
const mSum=(m,l)=>D.skus.reduce((a,k)=>a+(k.m===m?g(k.id,l):0),0);
function post(list,doc,note){S.moves.push(...list.map(m=>({id:S.mid++,t:Date.now(),date:doc.date,sku:m.sku,q:m.q,from:m.from,to:m.to,type:doc.type,doc:doc.no||doc.id,by:S.actor,note:m.note||note||''})));dirty()}
const dayDiff=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
const addDays=(d,n)=>new Date(Date.parse(d)+n*864e5).toISOString().slice(0,10);

/* ---------- analysis ---------- */
function ctx(){
  if(_ctx)return _ctx;
  const pkIdx=Object.fromEntries(S.pickups.map((p,i)=>[p.id,i])),pkD=Object.fromEntries(S.pickups.map(p=>[p.id,p.date]));
  const open=S.orders.filter(o=>o.st==='open').sort((a,b)=>pkIdx[a.pk]-pkIdx[b.pk]);
  const demand={},blocked={},rem={},R=s=>(s in rem)?rem[s]:(rem[s]=g(s,'READY'));
  open.forEach(o=>{
    const need={};o.lines.forEach(s=>need[s]=(need[s]||0)+1);
    Object.keys(need).forEach(s=>demand[s]=(demand[s]||0)+need[s]);
    const miss=Object.keys(need).filter(s=>R(s)<need[s]);
    if(miss.length)blocked[o.ref]=miss.map(s=>[s,need[s]-Math.max(0,R(s))]);else Object.keys(need).forEach(s=>rem[s]-=need[s]);
  });
  const end=S.date,from=addDays(end,-(S.st.lookback-1)),dset={},vel={},hm={},hs={},hc={},hg={};
  let pcs=0;const combos={};
  S.orders.forEach(o=>{
    if(o.st==='cx')return;const d=pkD[o.pk];if(d>end||d<from)return;dset[d]=1;
    o.lines.forEach(s=>{const k=SKU.get(s);vel[s]=(vel[s]||0)+1;hm[k.m]=(hm[k.m]||0)+1;hs[k.s]=(hs[k.s]||0)+1;hc[k.c]=(hc[k.c]||0)+1;pcs++});
    if(o.gov)hg[o.gov]=(hg[o.gov]||0)+1;
    if(o.lines.length>=2){const sig=o.lines.map(s=>{const k=SKU.get(s);return k.m+'|'+k.c}).sort().join(' + ');(combos[sig]||(combos[sig]={n:0,lines:o.lines.slice(),ex:o.ref})).n++}
  });
  const days=Object.keys(dset).sort(),span=days.length?Math.max(1,Math.min(S.st.lookback,dayDiff(days[0],end)+1)):1;
  Object.keys(vel).forEach(s=>vel[s]/=span);
  const abc={};let tot=0,cum=0;Object.keys(hm).forEach(m=>tot+=hm[m]);
  Object.keys(hm).sort((a,b)=>hm[b]-hm[a]).forEach(m=>{abc[m]=cum/(tot||1)<.8?'A':cum/(tot||1)<.95?'B':'C';cum+=hm[m]});
  return _ctx={open,demand,blocked,vel,velOK:days.length>=3,days:days.length,span,hm,hs,hc,hg,abc,pcs,combos};
}
function info(s){
  const C=ctx(),k=SKU.get(s),R=g(s,'READY'),dm=C.demand[s]||0,v=C.vel[s]||0;
  const th=C.velOK?Math.ceil(v*S.st.cover):(k.min||0),after=R-dm;
  let cls='';if(dm>R||(C.velOK&&v>0&&R===0))cls='c';else if(th>0&&after<th)cls='w';
  return {R,dm,v,th,after,cls,cov:v>0?R/v:null};
}
function lowList(){
  const out=[];D.skus.forEach(k=>{const i=info(k.id);if(i.cls&&(mSum(k.m,'READY')>0||i.dm>0))out.push([k.id,i])});return out;
}

/* ---------- supplies ---------- */
const supBal=id=>S.sup.log.reduce((a,e)=>a+(e.item===id?e.q:0),0);
function supUse(id,days=7){const to=S.date,from=addDays(to,-(days-1));let u=0;S.sup.log.forEach(e=>{if(e.item===id&&e.q<0&&e.date>=from&&e.date<=to)u-=e.q});return u/days}
const supCover=id=>{const u=supUse(id);return u>0?supBal(id)/u:null};
function packOf(n){return n<=S.st.packS?'PKS':n<=S.st.packM?'PKM':'PKL'}
function consumption(o){
  const l=[['FLY',-S.st.flyPer],[packOf(o.lines.length),-1]],cups=o.lines.filter(s=>SKU.get(s).m==='BR1').length*S.st.cupBR1;
  if(cups)l.push(['CUP',-cups]);return l;
}

/* ---------- order import / scan parsing ---------- */
const COLS={ref:'كود الاوردر العشوائي',wb:'بوليصة الشحن',ty:'حالة الاوردر الجزئية',gov:'المحافظة',total:'المبلغ توتال بالشحن للاوردر',items:'المنتجات المطلوبة في الاوردر'};
const LINE_RE=/^(.*?) \( (.*?) \)-(.*)-(.*)-(\d+)$/;
function alias(code){return S.alias[code]||D.alias[code]||(/^FC-/.test(code)&&MODEL.has(code.slice(3))?code.slice(3):(MODEL.has(code)?code:null))}
function importRows(rows,channel,pkId){
  const H=rows[0].map(x=>String(x).trim()),ix={};for(const k in COLS)ix[k]=H.indexOf(COLS[k]);
  if(ix.ref<0||ix.items<0)throw new Error('الأعمدة المطلوبة مش موجودة (كود الاوردر / المنتجات). الملف لازم يكون بتنسيق فيندور.');
  const have={};S.orders.forEach(o=>have[o.ref]=1);const orders=[],dups=[],unk={};
  rows.slice(1).forEach(r=>{
    const ref=String(r[ix.ref]||'').trim();if(!ref)return;if(have[ref]){dups.push(ref);return}
    const o={ref,wb:r[ix.wb],type:String(r[ix.ty]).indexOf('استبدال')>=0?'استبدال':'جديد',gov:r[ix.gov],total:r[ix.total],lines:[],pk:pkId,st:'open',sc:null,bad:[]};
    String(r[ix.items]).split(', ').forEach(it=>{
      const m=LINE_RE.exec(it.trim());if(!m){o.bad.push([it,'','',1]);return}
      const code=m[1],size=m[3].trim(),color=m[4].trim(),q=+m[5],mc=alias(code),id=mc&&IDX[mc+'|'+color+'|'+size];
      if(id){for(let i=0;i<q;i++)o.lines.push(id)}else{o.bad.push([code,size,color,q]);if(!mc)unk[code]=1}
    });
    orders.push(o);have[ref]=1;
  });
  return {orders,dups,unk:Object.keys(unk)};
}
function parseCSVText(t){const rows=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===','){r.push(f);f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(f);f='';rows.push(r);r=[]}else f+=c}if(f!==''||r.length){r.push(f);rows.push(r)}return rows.filter(x=>x.some(y=>String(y).trim()!==''))}
function parseScan(rows){
  const re=/codecontent|^code$|content|الكود|^كود/;let hi=-1,H;
  for(let i=0;i<Math.min(rows.length,6);i++){H=rows[i].map(x=>String(x).trim().toLowerCase());if(H.some(h=>re.test(h))){hi=i;break}}
  if(hi<0)throw new Error('مش لاقي عمود الكود (CODECONTENT). الملف لازم يكون تصدير QRbot أو فيه عمود بكود الأوردر.');
  const ic=H.findIndex(h=>re.test(h)),idt=H.findIndex(h=>/^date|time|وقت|تاريخ/.test(h)),inm=H.findIndex(h=>/^name$|employee|موظف|^الاسم/.test(h)),out=[];
  rows.slice(hi+1).forEach(r=>{const c=String(r[ic]==null?'':r[ic]).trim();if(c)out.push({code:c,t:idt>=0?String(r[idt]||'').slice(0,19):'',name:inm>=0?String(r[inm]||'').trim():''})});
  return out;
}
function matchScans(scans){
  const idx={};S.orders.forEach(o=>{if(o.st==='cx')return;idx[String(o.ref).toLowerCase()]=o;if(o.wb)idx[String(o.wb)]=o});
  const seen={},matched=[],dups=[],already=[],unk=[],bad=[];
  scans.forEach(s=>{
    const k=s.code.toLowerCase();if(seen[k]){dups.push(s.code);return}seen[k]=1;
    const o=idx[k];if(!o){unk.push(s.code);return}
    if(o.st==='done'){already.push({ref:o.ref,by:o.sc&&o.sc.by});return}
    if(o.bad&&o.bad.length){bad.push(o.ref);return}
    if(!matched.some(m=>m.ref===o.ref))matched.push({ref:o.ref,t:s.t});
  });
  return {scans:scans.length,matched,dups,already,unk,bad};
}
const ordPieces=refs=>{let n=0;refs.forEach(r=>{const o=S.orders.find(x=>x.ref===r.ref||x.ref===r);if(o)n+=o.lines.length});return n};
const orderByRef=ref=>S.orders.find(o=>o.ref===ref);
