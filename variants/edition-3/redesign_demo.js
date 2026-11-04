/* ---------- v2: demo data generator + guided tour ---------- */
const DEMO_DAYS=28;
const DEMO_CH=[
  {id:'VENDOOR',pre:'ed',short:'فيندور',share:.40,ret:.16,dirty:.18,miss:.06,x:.04,dow:[0,1,2,3,4,5,6]},
  {id:'NOON',pre:'nn',short:'نون',share:.22,ret:.22,dirty:.20,miss:.12,x:.05,dow:[0,1,3,4,6]},
  {id:'AMAZON',pre:'az',short:'أمازون',share:.16,ret:.27,dirty:.34,miss:.07,x:.06,dow:[0,2,4,5]},
  {id:'SHOPIFY',pre:'sh',short:'المتجر',share:.14,ret:.10,dirty:.14,miss:.04,x:.03,dow:[0,1,2,3,4,5,6]},
  {id:'FACEBOOK',pre:'fb',short:'فيسبوك',share:.08,ret:.13,dirty:.17,miss:.08,x:.04,dow:[1,3,5]}
];
const DEMO_MW={BR2:10,PAN5:7,A6:6,D2:5,BR1:5,PAN3:4,A5:4,S2:3.5,BR4:3,D1:3,PAN4:3,SH1:2.5,BR3:2.5,A1:2,PAN2:2,PAN1:2,SH2:1.8,A9:1.5,A8:1.2,A7:.4,D3:1,A12:.8,A11:.8,S1:.8,A2:0,A3:0,A4:0};
const DEMO_SZW={S:.12,M:.28,L:.28,XL:.17,'2XL':.09,'3XL':.04,'4XL':.02};
const DEMO_PHOTO='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#efeaf8"/><text x="60" y="44" font-size="11" text-anchor="middle" fill="#6b5a99">صورة تجريبية</text></svg>');
const DEMO_GOV=[['القاهرة',28],['الجيزة',18],['الإسكندرية',12],['القليوبية',6],['الغربية',6],['الدقهلية',6],['الشرقية',5],['المنوفية',3],['البحيرة',3],['أسيوط',3],['سوهاج',3],['الفيوم',2],['المنيا',2]];
function genDemo(){
  const realNow=Date.now,today=cairoToday(),days=[];for(let i=DEMO_DAYS-1;i>=0;i--)days.push(addDays(today,-i));
  let sv=20261102;const rnd=()=>{sv=(sv+0x6D2B79F5)|0;let t=Math.imul(sv^(sv>>>15),1|sv);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296};
  const pick=a=>a[Math.floor(rnd()*a.length)];
  let T=0;const at=(day,h,m)=>{T=Date.parse(day+'T00:00:00+02:00')+((h==null?12:h)*60+(m||0))*60000};
  Date.now=()=>T;
  const info={ch:{}};
  try{
    const _ka=(S&&S.users)?{users:S.users,cur:S.cur,roles:S.roles,audit:S.audit}:null;S=seed();ensureSup(S);if(_ka)Object.assign(S,_ka);S.moves=[];S.mid=1;S.docs=[];S.did=1;S.seq={};S.pickups=[];S.orders=[];S.emps=[];S.sup.log=[];S.sup.eid=0;S.costs={};phClear();_bal=null;_ctx=null;UI.doc=null;UI.sheet=null;UI.msg=null;
    const base={D:780,A:640,S:520,B:360,P:290,SH:430};
    D.models.forEach(m=>{const p=(base[m.code.replace(/\d+$/,'')]||base[m.code[0]]||450)+(m.code.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%5)*30;S.costs[m.code]={cost:Math.round(p*.42),price:p}});
    const price=s=>(S.costs[SKU.get(s).m]||{price:400}).price;
    const sk=D.skus,pho=id=>{PH[id]=DEMO_PHOTO;phPut(id,DEMO_PHOTO)};
    /* sampling weights per sku (with a rising BR2 and a fading PAN3) */
    const w0=sk.map(k=>{const m=MODEL.get(k.m),ci=Math.max(0,m.colors.indexOf(k.c));let w=(DEMO_MW[k.m]!=null?DEMO_MW[k.m]:1)*(1/(1+.45*ci))*(DEMO_SZW[k.s]||.05);if(k.m==='BR2'&&k.c==='احمر')w*=2;if(k.m==='PAN5'&&k.c==='اسود')w*=1.8;return w});
    const tw0=w0.reduce((a,b)=>a+b,0),perDay=56,avgL=2.35;
    const rate=k=>perDay*avgL*w0[sk.indexOf(k)]/tw0;   // pieces / day (average)
    const dayW=i=>{const t=w0.map((w,j)=>{const m=sk[j].m;return w*(m==='BR2'?1+.6*Math.max(0,i-17)/10:m==='PAN3'?1-.5*i/27:1)});let c=0;return{cum:t.map(x=>c+=x),tot:c}};
    const sample=dw=>{let r=rnd()*dw.tot,lo=0,hi=dw.cum.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(dw.cum[mid]>=r)hi=mid;else lo=mid+1}return sk[lo]};
    /* opening stock at day 0 */
    const hot={BR2:.8,PAN5:.8,A6:.85};
    at(days[0],8);
    sk.forEach(k=>{const mw=DEMO_MW[k.m]||0,C=rate(k)*DEMO_DAYS;let q;
      if(mw===0)q=k.s==='M'||k.s==='L'?18+Math.floor(rnd()*14):6+Math.floor(rnd()*6);
      else if(k.m==='BR4'||k.m==='SH2'||k.m==='A9')q=Math.round(C*3.2+8);
      else q=Math.round(C*(hot[k.m]||1.1)*(.7+.6*rnd()));
      if(q>0)S.moves.push({id:S.mid++,t:T,date:days[0],sku:k.id,q,from:'EXT_OPEN',to:'READY',type:'OPN',doc:'OPN-1',by:'النظام',note:'رصيد افتتاحي'})});
    _bal=null;
    const emps=['أحمد','منى','كريم'],reasons=['العميل غيّر رأيه','رقم العميل مش بيرد','العنوان غلط','العميل لقى أرخص'],planRet={},washB=[];
    const stat={orders:0,cx:0};let ordN=0;
    const dowOf=d=>new Date(d+'T00:00:00Z').getUTCDay();
    days.forEach((day,i)=>{
      S.date=day;at(day,9);_bal=null;
      /* 1. new orders (pickups) per channel */
      const dw=dayW(i),dowF=dowOf(day)===5?1.25:dowOf(day)===6?1.15:1,tot=perDay*dowF*(.88+.24*rnd());
      DEMO_CH.forEach(ch=>{if(ch.dow.indexOf(dowOf(day))<0)return;
        const n=Math.round(tot*ch.share*7/ch.dow.length);if(n<1)return;
        const id='P'+(S.pickups.length+1);S.pickups.push({id,label:'بيك أب '+ch.short+' '+day.slice(5),date:day,channel:ch.id,src:'ملف '+ch.short+' '+day});
        for(let j=0;j<n;j++){
          const r=rnd(),nl=r<.38?1:r<.68?2:r<.85?3:r<.94?4:5+Math.floor(rnd()*3),lines=[];
          for(let q=0;q<nl;q++){let k=sample(dw);
            if(q>0&&rnd()<.35){const m0=SKU.get(lines[0]),alt=sk.filter(x=>x.m===m0.m&&x.s===m0.s&&x.c!==m0.c);if(alt.length)k=pick(alt)}
            lines.push(k.id)}
          const gov=(()=>{let t=DEMO_GOV.reduce((a,b)=>a+b[1],0)*rnd();for(const x of DEMO_GOV){t-=x[1];if(t<=0)return x[0]}return 'القاهرة'})();
          ordN++;S.orders.push({ref:ch.pre+String(1000+ordN),wb:23800000+ordN*3,type:rnd()<.05?'استبدال':'جديد',gov,total:lines.reduce((a,s)=>a+price(s),0)+((gov==='القاهرة'||gov==='الجيزة')?60:75),lines,pk:id,st:'open',sc:null,bad:[]});stat.orders++}
      });
      /* 2. factory delivery of new production */
      if(i===7||i===14||i===21){at(day,10);
        const d=newDoc('RCV');let tt=0;
        sk.forEach(k=>{const mw=DEMO_MW[k.m]||0;if(mw<1)return;let q=rate(k)*7*(1.1+.4*rnd());
          if((k.m==='BR2'||k.m==='PAN5')&&i===21)q*=.35;if((k.m==='BR2'||k.m==='PAN5')&&i===14)q*=.75;
          q=Math.round(q);if(q>0){d.lines.push({sku:k.id,q});tt+=q}});
        d.hdr.ref='PO-'+(1040+i/7);d.hdr.declared=tt;pho(d.id);confirmDoc(d)}
      /* 3. customer returns that reached the warehouse today */
      DEMO_CH.forEach(ch=>{const L=(planRet[day]||[]).filter(x=>x.ch===ch.id);if(!L.length)return;at(day,13);
        const d=newDoc('RTN');d.hdr.channel=ch.id;d.hdr.refs=[];
        L.forEach(x=>{const o=orderByRef(x.ref);if(!o||o.st!=='done'||o.rt)return;d.hdr.refs.push(o.ref);o.lines.forEach(s=>addLine(d,s,1))});
        if(!d.hdr.refs.length){S.docs.splice(S.docs.indexOf(d),1);return}
        d.lines.forEach(l=>{let r=0,dd=0,xx=0;for(let p=0;p<l.exp;p++){const u=rnd();if(u<ch.miss)continue;if(u<ch.miss+ch.x)xx++;else if(u<ch.miss+ch.x+ch.dirty)dd++;else r++}l.r=r;l.d=dd;l.x=xx});
        d.hdr.codes=d.hdr.refs.join('\n');d.hdr.counted=true;confirmDoc(d)});
      /* 4. washing pipeline: send dirty to the factory, receive what came back */
      if(i%5===4&&i<DEMO_DAYS-1){at(day,11);const ls=sk.filter(k=>g(k.id,'DIRTY')>0).map(k=>({sku:k.id,q:g(k.id,'DIRTY')}));
        if(ls.length){const d=newDoc('FSD');d.hdr.kind='wash';d.lines=ls.map(l=>({sku:l.sku,q:l.q}));if(confirmDoc(d))washB.push({send:i,ls,late:i===19})}}
      washB.forEach(b=>{if(b.done||b.late||i!==b.send+5)return;at(day,12);const d=newDoc('FRC');
        d.lines=b.ls.map(l=>{let rej=0;for(let p=0;p<l.q;p++)if(rnd()<.08)rej++;return{sku:l.sku,q:l.q-rej,rej}});
        if(confirmDoc(d))b.done=true});
      if(i===17){at(day,14);const ls=sk.filter(k=>g(k.id,'SCRAP')>0).map(k=>({sku:k.id,q:g(k.id,'SCRAP')}));if(ls.length){const d=newDoc('FSD');d.hdr.kind='scrap';d.lines=ls;confirmDoc(d)}}
      /* 5. quality control finds some pieces in READY */
      if(i===10){at(day,15);const h=sk.filter(k=>g(k.id,'READY')>6&&DEMO_MW[k.m]>=2);
        let d=newDoc('CLN');d.hdr={from:'READY',to:'DIRTY',reason:'بقع وقت التغليف'};h.slice(3,9).forEach(k=>d.lines.push({sku:k.id,q:1+Math.floor(rnd()*2)}));confirmDoc(d);
        d=newDoc('CLN');d.hdr={from:'READY',to:'SCRAP',reason:'قماش بايظ'};h.slice(12,15).forEach(k=>d.lines.push({sku:k.id,q:1}));confirmDoc(d)}
      /* 6. transfers to the shop */
      if(i===9||i===22){at(day,16);const d=newDoc('SHP');d.hdr.note=i===9?'محل المعادي':'محل مدينة نصر';
        sk.filter(k=>g(k.id,'READY')>=8&&DEMO_MW[k.m]>=1).slice(i===9?0:20,i===9?26:46).forEach(k=>d.lines.push({sku:k.id,q:Math.min(6,Math.floor(g(k.id,'READY')*.2))||1}));pho(d.id);confirmDoc(d)}
      /* 7. stocktake of two models */
      if(i===19){at(day,17);const d=newDoc('CNT');d.hdr.state='READY';d.hdr.models=['A6','S2'];
        let n=0;sk.filter(k=>k.m==='A6'||k.m==='S2').forEach(k=>{const now=g(k.id,'READY');d.hdr.snap[k.id]=now;let diff=0;if(now>0&&rnd()<.14)diff=pick([-3,-2,-1,-1,1,2]);d.hdr.cnt[k.id]=Math.max(0,now+diff);if(diff)n++});
        d.hdr.started=true;d.hdr.reveal=true;confirmDoc(d)}
      /* 8. resolve part of the lost pieces */
      if(i===20){at(day,12);const ls=sk.filter(k=>g(k.id,'LOST')>0).map(k=>({sku:k.id,q:g(k.id,'LOST'),res:rnd()<.45?'FOUND':'OFF'}));if(ls.length){const d=newDoc('LOS');d.lines=ls;confirmDoc(d)}}
      /* 9. cancellations before shipping (with the waybill photo) */
      at(day,11);
      S.orders.filter(o=>o.st==='open'&&!o.bad.length).forEach(o=>{const pd=S.pickups.find(p=>p.id===o.pk).date,age=dayDiff(pd,day);
        if(age>=1&&(rnd()<.012||age>8)){if(cxApply({code:o.ref,reason:age>8?'العميل لغى بعد التأخير':pick(reasons),photo:DEMO_PHOTO,ret:false}))stat.cx++}});
      /* 10. a mistaken scan that gets reversed (then shipped for real below) */
      let shipNeg=null;
      const free={},have=s=>(s in free)?free[s]:(free[s]=g(s,'READY')),canShip=o=>{const n={};o.lines.forEach(s=>n[s]=(n[s]||0)+1);return Object.keys(n).every(s=>have(s)>=n[s])},take=o=>o.lines.forEach(s=>free[s]=have(s)-1);
      const pkD=Object.fromEntries(S.pickups.map(p=>[p.id,p.date]));
      if(i===26){const c=S.orders.filter(o=>o.st==='open'&&!o.bad.length&&pkD[o.pk]<day&&canShip(o)).slice(0,6);if(c.length){at(day,11,30);const d=makeScn(c.map(o=>({ref:o.ref,t:'11:2'+(c.indexOf(o)%10)})),'كريم','ملف سكان غلط');if(confirmDoc(d))reverseDoc(d);_bal=null}}
      /* 11. shipping: scan today's shippable orders, channel by channel */
      const open=S.orders.filter(o=>o.st==='open'&&!o.bad.length&&pkD[o.pk]<=day).sort((a,b)=>pkD[a.pk]<pkD[b.pk]?-1:pkD[a.pk]>pkD[b.pk]?1:0),ship={};
      Object.keys(free).forEach(k=>delete free[k]);
      open.forEach(o=>{const same=pkD[o.pk]===day;if(same&&rnd()<(i===DEMO_DAYS-1?.65:.25))return;if(!canShip(o))return;take(o);const ch=S.pickups.find(p=>p.id===o.pk).channel;(ship[ch]||(ship[ch]=[])).push(o)});
      Object.keys(ship).forEach((chid,ci)=>{at(day,17);let tm=11*60;const emp=emps[(i+ci)%3],d=makeScn(ship[chid].map(o=>({ref:o.ref,t:(tm+=1+Math.floor(rnd()*3),String(Math.floor(tm/60)).padStart(2,'0')+':'+String(tm%60).padStart(2,'0'))})),emp,'ملف سكان '+chanName(chid));
        if(confirmDoc(d)){const ch=DEMO_CH.find(c=>c.id===chid);ship[chid].forEach(o=>{if(ch&&rnd()<ch.ret){const rd=addDays(day,5+Math.floor(rnd()*8));if(rd<=today)(planRet[rd]||(planRet[rd]=[])).push({ref:o.ref,ch:chid})}})}});
      _bal=null;
      /* 12. one forced scan beyond the balance (shows the negative-stock alert) */
      if(i===26){const o=S.orders.find(o=>o.st==='open'&&!o.bad.length&&o.lines.some(s=>g(s,'READY')<=0)&&o.lines.length<=2);if(o){at(day,18);const d=makeScn([{ref:o.ref,t:'17:48'}],'كريم','ملف سكان');confirmDoc(d);_bal=null}}
      /* 13. cancellations after shipping (stock goes back through a cancel document) */
      if(i>=22&&i<=24){at(day,14);const o=S.orders.find(o=>o.st==='done'&&!o.rt&&o.sc&&o.sc.date===addDays(day,-1)&&!planRet[day]);if(o&&cxApply({code:o.ref,reason:'العميل رفض الاستلام',photo:DEMO_PHOTO,ret:true}))stat.cx++}
      /* 14. supplies deliveries and a count */
      at(day,13);
      if(i===12)supPush('PKM',400,'rcv','استلام من المورد',null,day);
      if(i===15)supPush('FLY',1500,'rcv','استلام من المطبعة',null,day);
      if(i===16)supPush('PKS',300,'rcv','استلام من المورد',null,day);
      if(i===20)supPush('PKM',-12,'count','جرد: الفعلي أقل من السيستم',null,day);
    });
    /* opening supplies chosen so the end balances tell a story: one nearly out, one finished */
    const target={FLY:460,PKS:520,PKM:85,PKL:34,CUP:0};
    S.sup.items.forEach(it=>{const cur=supBal(it.id),o=Math.max(0,(target[it.id]!=null?target[it.id]:300)-cur);if(o>0){const e={id:++S.sup.eid,t:Date.parse(days[0]+'T08:00:00+02:00'),date:days[0],item:it.id,q:o,kind:'open',why:'رصيد افتتاحي',doc:null,by:S.actor};S.sup.log.unshift(e)}});
    /* plant: unmapped codes + two unfinished drafts */
    at(today,10);
    for(let j=0;j<3;j++){const o=S.orders.filter(o=>o.st==='open'&&o.lines.length===1)[j];if(o)o.bad=[['XY'+(70+j),pick(['M','L']),pick(['احمر','بيج']),1]]}
    let d=newDoc('RCV');d.hdr.ref='PO-1044';sk.filter(k=>k.m==='BR2'&&k.s==='M').slice(0,3).forEach(k=>d.lines.push({sku:k.id,q:12}));
    d=newDoc('CLN');d.hdr={from:'READY',to:'DIRTY',reason:''};
    info.orders=S.orders.length;
  }finally{Date.now=realNow}
  S.date=today;UI.doc=null;UI.sheet=null;UI.msg=null;_bal=null;_ctx=null;
  S.demo={at:Date.now(),days:DEMO_DAYS,orders:S.orders.length};
  save();
  return S.demo;
}
function demoLoad(){
  try{genDemo()}catch(e){console.error(e);toast('حصلت مشكلة وأنا بحمّل الداتا: '+e.message);return}
  UI.demoAsk=false;UI.tab='today';UI.vd=null;UI.o.f='all';UI.o.tab='list';render();
  toast('اتحمّلت داتا تجريبية: '+fmt(S.orders.length)+' أوردر في '+DEMO_DAYS+' يوم');
}
/* ---------- guided tour: problem -> how the system solves it -> live proof ---------- */
function demoTour(){
  const C=ctx(),lows=lowList(),pr=planRows(),sup=S.sup.items.filter(i=>!i.arch);
  const cnt=o=>Object.keys(o).length,done=S.orders.filter(o=>o.st==='done'),rets=done.filter(o=>o.rt).length;
  const pkCh=Object.fromEntries(S.pickups.map(p=>[p.id,p.channel]));
  const byCh={};S.orders.forEach(o=>{if(o.st==='cx')return;const c=pkCh[o.pk],r=byCh[c]||(byCh[c]={n:0,r:0});r.n++;if(o.rt)r.r++});
  const chRows=CHAN.concat(DEMO_CH.filter(x=>!CHAN.some(c=>c.id===x.id)).map(x=>({id:x.id}))).filter(c=>byCh[c.id]).map(c=>({id:c.id,n:byCh[c.id].n,r:byCh[c.id].r,rate:byCh[c.id].n?byCh[c.id].r/byCh[c.id].n*100:0})).sort((a,b)=>b.n-a.n);
  const worst=chRows.slice().sort((a,b)=>b.rate-a.rate)[0];
  const neg=D.skus.filter(k=>g(k.id,'READY')<0),cxN=S.orders.filter(o=>o.st==='cx').length,revN=S.docs.filter(d=>d.status==='reversed').length;
  const blk=Object.keys(C.blocked),topB={};blk.forEach(r=>C.blocked[r].forEach(x=>topB[x[0]]=(topB[x[0]]||0)+x[1]));
  const topBk=Object.keys(topB).sort((a,b)=>topB[b]-topB[a])[0];
  const lostN=locSum('LOST'),dirtyN=locSum('DIRTY'),facN=locSum('FACTORY'),scrapN=locSum('SCRAP');
  const _st=UI.s.state;UI.s.state='READY';const cell=heatCells();UI.s.state=_st;const ex=Object.keys(cell).filter(k=>cell[k].st==='excess'),deadP=Object.keys(cell).reduce((a,k)=>a+(cell[k].dead?cell[k].R:0),0);
  const cnt1=S.docs.filter(d=>d.type==='CNT'&&d.status==='done').pop();let cd=0,cs=0;if(cnt1)S.moves.filter(m=>m.doc===cnt1.no).forEach(m=>{if(m.from==='EXT_ADJ')cs+=m.q;else cd+=m.q});
  const supBad=sup.filter(i=>supStatus(i)!=='good');
  const oldest=C.open.length?Math.max(...C.open.map(o=>dayDiff((S.pickups.find(p=>p.id===o.pk)||{date:S.date}).date,S.date))):0;
  const fp=(t,v)=>'<span class="dm-p"><b>'+v+'</b> '+t+'</span>';
  return [
   {t:'القطعة بتكون فين؟',p:'المخزون في إكسيل بيبقى رقم واحد لكل صنف. مفيش فرق بين القطعة الجاهزة والقطعة اللي محتاجة غسيل والقطعة اللي عند المصنع، فبتبيع حاجة مش موجودة فعلًا.',s:'كل قطعة دايمًا في حالة واحدة بس: جاهز للبيع، هالك نظافة، عند المصنع، هالك نهائي، مفقود. الرصيد مش رقم بتكتبه. هو ناتج من سجل حركات ما بيتمسحش، وكل حركة من مكان لمكان.',proof:[fp('جاهز للبيع',fmt(locSum('READY'))),fp('نظافة',fmt(dirtyN)),fp('عند المصنع',fmt(facN)),fp('هالك',fmt(scrapN)),fp('مفقود',fmt(lostN))],go:'stock',pre:()=>{UI.s.view='list';UI.s.state='READY'},b:'شوف المخزون'},
   {t:'الطلب غير الشحن',p:'الأوردر بيوصل الأول، والشحن بيحصل بعدها بساعات أو أيام. لو خصمت وقت الطلب هتلخبط الرصيد لو اتلغى، ولو ما حجزتش هتوعد عميل بقطعة مش موجودة.',s:'البيك أب = طلب (بيتحسب عليه "طلب مفتوح" من غير ما يخصم). السكان = شحن فعلي وهو اللي بيخصم. الاتنين منفصلين، فتعرف الطلب والمتاح كل واحد لوحده.',proof:[fp('أوردر مفتوح',fmt(C.open.length)),fp('قطعة محجوزة',fmt(Object.values(C.demand).reduce((a,b)=>a+b,0))),fp('أقدم أوردر مفتوح',oldest+' يوم')],go:'orders',pre:()=>{UI.o.f='wait';UI.o.tab='list'},b:'الأوردرات المستنية'},
   {t:'أوردر واقف عشان قطعة واحدة',p:'أوردر فيه 4 قطع، 3 منهم موجودين وواحدة لأ. محدش بيلاحظ والأوردر يفضل قاعد وبيتأخر.',s:'السيستم بيمشي على الأوردرات بالترتيب ويشوف مين ينفع يتشحن بالرصيد. اللي ناقصه قطعة بيتعلّم "معطل" وبيقولك بالظبط أنهي قطعة وكام ناقص.',proof:[fp('أوردر معطل',fmt(blk.length)),topBk?fp('أكتر صنف معطّل',esc(skuName(topBk))):''],go:'orders',pre:()=>{UI.o.f='blocked';UI.o.tab='list'},b:'شوف المعطل'},
   {t:'المرتجع بيرجع ناقص أو مبهدل',p:'المرتجعات بترجع من القنوات متلخبطة: سليم، محتاج غسيل، هالك، وساعات ناقص. من غير تتبع الناقص ده بيضيع ومحدش يعرف مين السبب.',s:'استلام المرتجع بيتعدّ قطعة قطعة: سليم يرجع جاهز، محتاج نضافة يروح لهالك النظافة، هالك نهائي، وأي ناقص بيتسجل مفقود ومربوط بالقناة والأوردر.',proof:[fp('أوردر اترجع',fmt(rets)),worst?fp('أعلى نسبة مرتجع: '+chanName(worst.id),worst.rate.toFixed(0)+'%'):'',fp('قطعة مفقودة',fmt(lostN))],go:'insights',pre:()=>{UI.ins='health'},b:'صحة المخزون والقنوات'},
   {t:'الهالك والغسيل عند المصنع',p:'القطع المتسخة بتتراكم، وبتتبعت للمصنع، وما حدش بيعرف إيه اللي لسه هناك من أسبوعين.',s:'مسار ثابت: هالك نظافة، إرسال للمصنع، استلام مغسول (والمرفوض يتحوّل هالك نهائي). ولو حاجة قعدت عند المصنع أكتر من اللازم بتظهر في "المعطل".',proof:[fp('محتاج غسيل',fmt(dirtyN)),fp('عند المصنع',fmt(facN)),fp('هالك نهائي',fmt(scrapN))],go:'insights',pre:()=>{UI.ins='stuck'},b:'شوف المعطل'},
   {t:'مين غيّر الرقم؟',p:'في إكسيل أي حد يعدّل أي خانة ومفيش أثر. وفي الشحن أحيانًا بيتعمل سكان غلط.',s:'مفيش تعديل. كل عملية ليها رقم ومسودة ثم تأكيد، وبتتقفل بعد 3 أيام. الغلط بيتصلّح بعملية عكسية بتظهر في السجل، والاستلام والتوريد للمحل لازم صورة الورقة الموقّعة.',proof:[fp('عملية متأكدة',fmt(S.docs.filter(d=>d.status==='done').length)),fp('عملية معكوسة',fmt(revN)),fp('أوردر ملغي بصورة بوليصة',fmt(cxN))],go:'ledger',pre:()=>{},b:'افتح السجل'},
   {t:'الجرد بيبوّظ الأرقام',p:'لما بتعد وتلاقي فرق بتكتب الرقم الجديد فوق القديم، فبتضيع معلومة إيه اللي اتفقد ومتى.',s:'الجرد عملية زي غيرها: بتعدّ، بتكشف الفروق، بتوافق، فيتسجل الفرق كحركة "تسوية جرد". الرصيد القديم والجديد والفرق كلهم محفوظين.',proof:cnt1?[fp('عجز',fmt(cd)),fp('زيادة',fmt(cs)),fp('في عملية',esc(cnt1.no))]:[fp('ما فيش جرد لسه','')],go:'ledger',pre:()=>{UI.led.type='CNT'},b:'عمليات الجرد'},
   {t:'أصنّع كام وإمتى؟',p:'القرار بيتاخد بالإحساس: ساعات بتصنّع حاجة واقفة، وساعات بتخلص الحاجة اللي بتتباع.',s:'لكل صنف سرعة سحب أسبوعية (الأحدث أهم)، وحد أمان حسب تذبذب الطلب، ونقطة إعادة طلب بتعتمد على مهلة المصنع. اللي نزل عن النقطة بيتقترح تصنيعه بالكمية، وخريطة المخزون بتوريك الناقص والزيادة بنظرة.',proof:[fp('صنف تحت النقطة',fmt(lows.filter(x=>x[1].cls==='w').length)),fp('قطعة مقترح تصنيعها',fmt(pr.reduce((a,r)=>a+r.q,0))),fp('خانة زيادة/راكدة',fmt(ex.length))],go:'stock',pre:()=>{UI.s.view='heat';UI.s.state='READY'},b:'خريطة المخزون'},
   {t:'مخزون راكد بياكل فلوس',p:'موديلات اتصنعت وما اتباعتش. محدش شايفها لأنها مدفونة وسط 600 صنف.',s:'أي صنف ما اتسحبش من آخر فترة أو تغطيته أطول من '+S.st.excess+' يوم بيتعلّم زيادة/راكد، وقيمته بتتحسب بالتكلفة.',proof:[fp('قطعة راكدة',fmt(deadP)),fp('خانة زيادة',fmt(ex.length))],go:'insights',pre:()=>{UI.ins='health'},b:'صحة المخزون'},
   {t:'الكراتين والفلاير بتخلص فجأة',p:'التغليف بيخلص يوم الذروة ومحدش حاسب استهلاكه.',s:'كل أوردر يتشحن بيخصم المستلزمات أوتوماتيك حسب عدد قطعه. والمستلزم بيحذّرك لما غطاه يقل عن أسبوع أو ينزل عن الحد الأدنى.',proof:supBad.map(i=>fp(esc(i.name),fmt(supBal(i.id))+' '+i.unit)),go:'supplies',pre:()=>{},b:'المستلزمات'},
   {t:'كل قناة ليها حال',p:'فيندور ونون وأمازون والمتجر بيبعتوا ملفات مختلفة، ونسب المرتجع والهالك بتختلف، لكن الكل متلخبط في ملف واحد.',s:'الأوردرات والمرتجعات متعلّمة بالقناة. فتشوف حجم كل قناة ونسبة مرتجعها وفين الخسارة.',proof:chRows.map(c=>fp(chanName(c.id),fmt(c.n)+' أوردر · '+c.rate.toFixed(0)+'% مرتجع')),go:'insights',pre:()=>{UI.ins='dash'},b:'لوحة القيادة'},
   {t:'الرصيد بالسالب والأكواد الغلط',p:'لو حد شحن أكتر من الموجود أو الكود في الملف مش في الكتالوج، الغلط بيمشي ومحدش يعرف.',s:'السالب بيظهر تنبيه أحمر في "النهارده" مع الصنف، والكود الغير مربوط بيتعلّم "كود غير مربوط" ومش بيتشحن لحد ما تربطه.',proof:[fp('صنف بالسالب',fmt(neg.length)),fp('أوردر كوده غير مربوط',fmt(S.orders.filter(o=>o.bad&&o.bad.length).length))],go:'orders',pre:()=>{UI.o.f='bad';UI.o.tab='list'},b:'شوف الأكواد'}
  ];
}
function vDemo(){
  const on=!!S.demo,T=demoTour();
  let h='<section class="card"><h2>داتا تجريبية <span class="hint">عشان تفرّج حد على السيستم</span></h2>'
   +'<p class="muted" style="margin:0 0 10px;line-height:1.8">بتملّى السيستم بـ '+DEMO_DAYS+' يوم تشغيل كامل: أوردرات من فيندور ونون وأمازون والمتجر وفيسبوك، شحن بالسكان، مرتجعات، غسيل ومصنع، جرد، مفقودات، توريد للمحل، ومستلزمات. الداتا مصغّرة عمدًا عشان متملاش تخزين المتصفح.</p>'
   +(on?'<div class="msg good" style="margin-bottom:10px">الداتا التجريبية شغّالة دلوقتي: <b>'+fmt(S.demo.orders)+'</b> أوردر · <b>'+fmt(S.docs.filter(d=>d.status==='done').length)+'</b> عملية · '+fmt(storeKB())+' KB في المتصفح.</div>':'')
   +'<div class="row" style="gap:8px;flex-wrap:wrap">'
   +(UI.demoAsk?'<button class="btn danger" data-a="demoload">أيوه، امسح الحالي وحمّل التجريبية</button><button class="btn" data-a="demoask">إلغاء</button><span class="muted" style="font-size:12.5px">ده بيمسح اللي في المتصفح ده دلوقتي.</span>':'<button class="btn pri" data-a="demoask">'+(on?'إعادة تحميل الداتا التجريبية':'تحميل داتا تجريبية')+'</button>')
   +(on?'<button class="btn" data-a="demoreset">رجوع للبيانات الأصلية</button>':'')+'</div></section>';
  h+='<section class="card"><h2>السيستم متصمم إزاي</h2><div class="dm-pr">'
   +[['سجل حركات واحد','الرصيد ناتج الحركات، مش رقم بتكتبه. فمفيش حاجة تتغيّر من غير أثر.'],['الطلب غير الشحن','البيك أب بيحجز، والسكان هو اللي بيخصم.'],['مسودة ثم تأكيد','أي عملية بتتراجع قبل التأكيد، وبعده بتتصحح بعكس ظاهر.'],['كل صنف = موديل × لون × مقاس','ومنه بيتحسب سحب كل صنف وحدّه الأدنى لوحده.']].map(x=>'<div><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('')+'</div></section>';
  h+='<section class="card"><h2>المشاكل اللي بيعالجها <span class="hint">كل بطاقة: المشكلة، الحل، والأرقام الحية من الداتا</span></h2>'+(on?'':'<div class="msg warn" style="margin-bottom:10px">الأرقام دي من البيانات الحالية. حمّل الداتا التجريبية الأول عشان تبقى كاملة.</div>')
   +'<div class="dm-list">'+T.map((x,i)=>'<article class="dm-it"><div class="dm-n">'+(i+1)+'</div><div class="dm-b"><h3>'+x.t+'</h3><p><span class="dm-k">المشكلة</span>'+x.p+'</p><p><span class="dm-k ok">الحل</span>'+x.s+'</p><div class="dm-pf">'+x.proof.join('')+'</div></div><button class="btn sm" data-a="tourgo" data-i="'+i+'">'+x.b+' ‹</button></article>').join('')+'</div></section>';
  return h;
}
function demoBanner(){
  if(S.demo)return '<div class="msg info dm-bn" style="margin-bottom:14px"><span><b>الداتا دي تجريبية.</b> مولّدة عشان تشوف السيستم شغال. الأرقام مش حقيقية.</span><span class="row" style="gap:8px"><button class="btn sm" data-a="demotour">جولة: السيستم بيحل إيه؟</button></span></div>';
  if(!S.docs.length&&!S.moves.some(m=>m.type!=='OPN'))return '<div class="msg info dm-bn" style="margin-bottom:14px"><span>عايز تفرّج حد أو تجرّب السيستم؟ حمّل داتا تجريبية فيها أوردرات ومرتجعات ومصنع وجرد.</span><span class="row"><button class="btn sm" data-a="demotour">افتح الجولة</button></span></div>';
  return '';
}
