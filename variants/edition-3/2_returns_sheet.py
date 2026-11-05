import pathlib
H=pathlib.Path(__file__).parent
T=H/'.work'
T.mkdir(exist_ok=True)
s=(T/'state2.html').read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a))
    s=s.replace(a,b)

rep("if(type==='RTN')d.hdr={channel:'VENDOOR',codes:'',counted:false,unk:[]};","if(type==='RTN')d.hdr={channel:'VENDOOR',codes:'',counted:false,unk:[],refs:[],sheet:null};")

fn=r"""/* ---- shipping-company return sheet (Revenue Report) ---- */
const rtnWhy=n=>/استبدال|التبديل/.test(n)?'استبدال':/رفض/.test(n)?'رفض الاستلام':/لاغى|الغاء|إلغاء/.test(n)?'ملغي':/لايرد|لا يرد/.test(n)?'لا يرد':/استرجاع|مرتجع/.test(n)?'استرجاع':/تاجيل|تأجيل/.test(n)?'تأجيل':'أخرى';
function rtnSheetParse(rows){
  const get=(r,k)=>{for(const key in r)if(String(key).trim().toLowerCase()===k)return r[key];return undefined};
  const out=[];let coll=0,hasType=false;
  rows.forEach(r=>{const t=get(r,'type');if(t===undefined)return;hasType=true;const type=String(t).trim().toLowerCase();
    if(type!=='return'){if(type)coll++;return}
    const m=String(get(r,'full name')||'').match(/-\s*([A-Za-z]{2}\d{3,5})\s*$/),note=String(get(r,'statusnote')||'').replace(/\s+/g,' ').trim();
    out.push({code:m?m[1].toLowerCase():'',serial:String(get(r,'serial')||'').trim(),st:String(get(r,'order delivery status')||'').trim(),note,why:rtnWhy(note),date:String(get(r,'return date')||'').slice(0,10)})});
  return {ok:hasType,rows:out,coll};
}
function rtnMatch(d,r){
  const H=d.hdr,o=S.orders.find(x=>(r.code&&x.ref.toLowerCase()===r.code)||(r.serial&&String(x.wb)===r.serial));
  const prev=new Set();S.docs.forEach(x=>{if(x.type==='RTN'&&x.status==='done'&&x.id!==d.id)(x.hdr.refs||[]).forEach(f=>prev.add(f))});
  if(r.st.toLowerCase()==='delivered')return {k:'manual',o};
  if(!o)return {k:'unk'};
  if((H.refs||[]).indexOf(o.ref)>=0)return {k:'added',o};
  if(prev.has(o.ref))return {k:'dup',o};
  if(o.st!=='done')return {k:'notdone',o};
  return {k:'ok',o};
}
function rtnSheetCard(d,draft){
  const H=d.hdr,sh=H.sheet;
  let h='<section class="card"><h2>شيت شركة الشحن <span class="hint">أوردرات المرتجع اللي رجعت للمخزن</span></h2>';
  if(draft)h+='<label class="f">ارفع شيت الشحن (Excel أو CSV)<input type="file" accept=".xlsx,.xls,.csv" data-c="rtnsheet"></label>';
  if(H.sheetErr)h+='<div class="msg crit" style="margin-top:8px">'+esc(H.sheetErr)+'</div>';
  if(!sh)return h+(draft?'<p class="muted" style="font-size:12px;margin-top:8px">بياخد صفوف النوع return بس، ويطابقها بالأوردرات بكود الأوردر اللي في آخر الاسم أو بالـ Serial.</p>':'<div class="empty">مفيش شيت اتربط بالعملية دي.</div>')+'</section>';
  const M=sh.rows.map(r=>({r,m:rtnMatch(d,r)})),c={};M.forEach(x=>c[x.m.k]=(c[x.m.k]||0)+1);
  const pcs=M.filter(x=>x.m.k==='ok').reduce((a,x)=>a+x.m.o.lines.length,0);
  h+='<p class="muted" style="font-size:12px;margin:8px 0">الملف: '+esc(sh.fname||'')+' · '+fmt(sh.rows.length+sh.coll)+' صف: '+fmt(sh.rows.length)+' مرتجع و'+fmt(sh.coll)+' تحصيل (التحصيل بيتتخطى).</p>';
  h+='<div class="kpis">'+kpi('مرتجع في الشيت',N(sh.rows.length),'')+kpi('جاهز للإضافة',N(c.ok||0),fmt(pcs)+' قطعة',c.ok?'good':'')+kpi('اتضاف',N(c.added||0),'')+kpi('محتاج مراجعة',N((c.manual||0)+(c.unk||0)+(c.notdone||0)+(c.dup||0)),'',((c.manual||0)+(c.unk||0)+(c.notdone||0)+(c.dup||0))?'warn':'')+'</div>';
  const why={};M.forEach(x=>why[x.r.why]=(why[x.r.why]||0)+1);
  h+='<div class="chips" style="margin:10px 0">'+Object.keys(why).sort((a,b)=>why[b]-why[a]).map(w=>'<span class="pill">'+esc(w)+' <span class="n">'+why[w]+'</span></span>').join('')+'</div>';
  const LB={ok:['good','هيتضاف'],added:['info','اتضاف'],manual:['warn','مراجعة يدوية'],unk:['crit','مش موجود في السيستم'],notdone:['warn','الأوردر ما اتشحنش'],dup:['warn','اتسجّل قبل كده']};
  h+='<div class="tw"><table class="t-sm"><thead><tr><th>الكود</th><th>السبب</th><th class="num">قطع</th><th>الحالة</th></tr></thead><tbody>'+M.map(x=>{const L=LB[x.m.k];return '<tr'+(x.m.o?' data-a="order" data-ref="'+esc(x.m.o.ref)+'"':'')+'><td class="mono">'+esc(x.r.code||x.r.serial)+'</td><td><span data-tip="'+esc(x.r.note)+'">'+esc(x.r.why)+'</span>'+(x.r.st.toLowerCase()==='delivered'?' <span class="muted" style="font-size:12px">· اتسلّم</span>':'')+'</td><td class="num">'+(x.m.o?N(x.m.o.lines.length):'<span class="muted">—</span>')+'</td><td>'+pill(L[0],L[1])+'</td></tr>'}).join('')+'</tbody></table></div>';
  if(c.manual)h+='<div class="msg warn" style="margin-top:8px">'+c.manual+' أوردر اتسلّم للعميل وفيه استبدال أو استرجاع. الشيت مش بيقول أنهي قطع رجعت، فضيفها يدويًا من الأصناف تحت.</div>';
  if(c.unk)h+='<div class="msg warn" style="margin-top:8px">'+c.unk+' كود مش لاقيه في الأوردرات. غالبًا البيك أب بتاعه لسه ما اترفعش.</div>';
  if(draft)h+='<div class="row" style="margin-top:10px"><button class="btn pri" data-a="rtnsheetadd" '+(c.ok?'':'disabled')+'>أضف '+(c.ok||0)+' أوردر ('+fmt(pcs)+' قطعة) للمتوقع</button></div>';
  return h+'</section>';
}
function stateSheet(l){"""
rep("function stateSheet(l){",fn)

rep("  if(d.type==='RTN'&&draft)h+='<section class=\"card\"><h2>المتوقع رجوعه</h2>","  if(d.type==='RTN'&&(draft||d.hdr.sheet))h+=rtnSheetCard(d,draft);\n  if(d.type==='RTN'&&draft)h+='<section class=\"card\"><h2>المتوقع رجوعه</h2>")

rep("  rtnfill:()=>{","""  rtnsheetadd:()=>{
    const d=curDoc(),H=d.hdr;if(!d||d.status!=='draft'||!H.sheet)return;H.refs=H.refs||[];let n=0,p=0;
    H.sheet.rows.forEach(r=>{const m=rtnMatch(d,r);if(m.k!=='ok')return;m.o.lines.forEach(sk=>addLine(d,sk,1));H.refs.push(m.o.ref);n++;p+=m.o.lines.length});
    if(n){d.log.push(logE('اتضافت '+n+' أوردر ('+p+' قطعة) من شيت الشحن'));toast('اتضاف '+n+' أوردر · '+p+' قطعة');dirty()}
    render();
  },
  rtnfill:()=>{""")

rep("  rtncodes:el=>{curDoc().hdr.codes=el.value;dirty()},","""  rtncodes:el=>{curDoc().hdr.codes=el.value;dirty()},
  rtnsheet:el=>{const d=curDoc(),f=el.files&&el.files[0];if(!d||!f||d.status!=='draft')return;
    const fr=new FileReader();fr.onerror=()=>{d.hdr.sheetErr='مقدرتش أقرا الملف.';render()};
    fr.onload=()=>{try{
      const wb=XLSX.read(fr.result,{type:'array',codepage:65001}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}),r=rtnSheetParse(rows);
      if(!r.ok){d.hdr.sheetErr='ده مش شيت شركة الشحن المعتاد: مفيش عمود Type.'}
      else if(!r.rows.length){d.hdr.sheetErr='الشيت مفيهوش أي أوردر من النوع return.';d.hdr.sheet=null}
      else{d.hdr.sheetErr='';d.hdr.sheet={fname:f.name,rows:r.rows,coll:r.coll};d.log.push(logE('اترفع شيت الشحن: '+r.rows.length+' مرتجع'))}
      dirty()}catch(e){d.hdr.sheetErr='مقدرتش أفتح الملف. اتأكد إنه Excel أو CSV.'}
      render()};
    fr.readAsArrayBuffer(f)},""")
(T/'base.html').write_text(s,encoding='utf-8')
