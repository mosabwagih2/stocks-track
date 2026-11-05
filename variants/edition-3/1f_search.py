import pathlib
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'base.html').read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:80],s.count(a))
    s=s.replace(a,b)

# ---- shared matcher ----
helpers=r"""/* ---------- stock search (shared by all three views) ---------- */
const arN=x=>String(x==null?'':x).toLowerCase().replace(/[ً-ٟـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
const SZ_SET={s:1,m:1,l:1,xl:1,'2xl':1,'3xl':1,'4xl':1};
function stockQ(){const q=arN(UI.s.q||'').trim().split(/\s+/).filter(Boolean);return q.length?q:null}
function skuHit(k,q){const hay=arN(k.id+' '+k.c+' '+k.s+' '+MODEL.get(k.m).name);return q.every(w=>SZ_SET[w]?k.s.toLowerCase()===w:hay.indexOf(w)>=0)}
function modelHit(c,q){return D.skus.some(k=>k.m===c&&skuHit(k,q))}
function stockSearchBar(){
  const v=UI.s.q||'';
  return '<div class="srch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input type="search" id="sq" placeholder="ابحث: BR2 · احمر · L · بانتي" value="'+esc(v)+'" data-c="sq" autocomplete="off" enterkeyhint="search" aria-label="بحث في المخزون"><button type="button" class="srch-x" data-a="sqclear" aria-label="مسح البحث"'+(v?'':' hidden')+'>✕</button></div>';
}
function matrixHTML(m){"""
rep("function matrixHTML(m){",helpers)
# dim non-matching cells
rep("  const s=UI.s;let h='<div class=\"tw\" style=\"padding:8px\"><table class=\"mx\">","  const s=UI.s,sq=stockQ(),part=sq&&m.colors.some(c=>m.sizes.some(z=>{const i0=IDX[m.code+'|'+c+'|'+z];return i0&&!skuHit(SKU.get(i0),sq)}));let h='<div class=\"tw\" style=\"padding:8px\"><table class=\"mx\">")
rep("""h+='<td><button class="cell '+(v===0&&!cls?'z':cls)+'" data-a="sku\"""","""const hit=!sq||skuHit(SKU.get(id),sq);h+='<td><button class="cell '+(v===0&&!cls?'z':cls)+(sq&&part?(hit?' hit':' dim'):'')+'" data-a="sku\"""")

# ---- restructure vStock into shell + body ----
a=s.index("function vStock(){");b=s.index("function stockTable(){")
old=s[a:b]
new=r"""function vStock(){
  const s=UI.s;
  const tools='<div class="seg"><button aria-pressed="'+(s.view==='all')+'" data-a="sview" data-v="all">كل الموديلات</button><button aria-pressed="'+(s.view==='matrix')+'" data-a="sview" data-v="matrix">موديل واحد</button><button aria-pressed="'+(s.view==='table')+'" data-a="sview" data-v="table">كل الأصناف</button></div>';
  let h=top('المخزون','<span class="hm">كل صنف (موديل × لون × مقاس) وحالته. اضغط أي خانة تفتح تفاصيلها.</span>',tools+'<button class="btn" data-a="catedit">تعديل</button><button class="btn pri" data-a="skuadd" data-m="__new" data-only="1">+ موديل جديد</button>');
  h+=stockSearchBar();
  h+='<div class="chips scrollx" style="margin-bottom:14px">'+INTERNAL.map(l=>'<button class="chip" aria-pressed="'+(s.state===l)+'" data-a="sstate" data-v="'+l+'"><i class="dot" style="background:'+LCOL[l]+'"></i>'+LOC[l]+' <span class="n">'+fmt(locSum(l))+'</span></button>').join('')+'</div>';
  return h+'<div id="stres">'+stockBody()+'</div>';
}
function stockBody(){
  const s=UI.s,sq=stockQ();let h='';
  if(s.view==='table'){
    h+='<div class="row" style="margin-bottom:12px"><div class="chips scrollx">'+[['all','الكل'],['low','قرب يخلص'],['neg','بالسالب'],['dem','عليه طلب مفتوح'],['arch','مؤرشف ('+Object.keys(S.cat.arch).filter(k=>S.cat.arch[k]).length+')']].map(f=>'<button class="chip" aria-pressed="'+((s.flt||'all')===f[0])+'" data-a="sflt" data-v="'+f[0]+'">'+f[1]+'</button>').join('')+'</div></div>'+stockTable();
    return h;
  }
  const groups={},OM=ordM().filter(c=>!sq||modelHit(c,sq));OM.forEach(c=>{(groups[lineOf(c)]||(groups[lineOf(c)]=[])).push(c)});
  const sortBtn='<div class="seg" role="group" aria-label="الترتيب"><button aria-pressed="'+(s.sort!=='alpha')+'" data-a="ssort" data-v="pull">الأكتر سحبًا</button><button aria-pressed="'+(s.sort==='alpha')+'" data-a="ssort" data-v="alpha">أبجدي</button></div><button type="button" class="sortbtn" data-a="ssort" data-v="'+(s.sort==='alpha'?'pull':'alpha')+'" aria-label="تغيير الترتيب">⇅ '+(s.sort==='alpha'?'أبجدي':'الأكتر سحبًا')+'</button>';
  const info1=sq?'<p class="muted srchinfo">'+(OM.length?'<b>'+OM.length+'</b> موديل · <b>'+D.skus.filter(k=>skuHit(k,sq)).length+'</b> صنف مطابق لـ "'+esc(UI.s.q.trim())+'"':'')+'</p>':'';
  const none=sq&&!OM.length?'<div class="card"><div class="empty">مفيش نتيجة لـ "'+esc(UI.s.q.trim())+'".<br>جرّب كود الموديل أو اللون أو المقاس، زي: BR2 أو احمر أو XL.<div style="margin-top:10px"><button class="btn sm" data-a="sqclear">مسح البحث</button></div></div></div>':'';
  if(s.view==='all'){
    const L=s.line||'all',ms=OM.filter(c=>L==='all'||lineOf(c)===L);
    h+='<div class="row" style="margin-bottom:14px"><div class="chips scrollx">'+[['all','كل الموديلات']].concat(LINE_ORDER.filter(l=>groups[l]).map(l=>[l,l])).map(f=>'<button class="chip" aria-pressed="'+(L===f[0])+'" data-a="sline" data-v="'+f[0]+'">'+f[1]+'</button>').join('')+'</div>'+sortBtn+'</div>'+info1;
    h+=none||('<div class="stack">'+ms.map(c=>'<section class="card">'+modelHead(MODEL.get(c))+matrixHTML(MODEL.get(c))+'</section>').join('')+'</div>'+matrixLegend);
    return h;
  }
  const m=(sq&&OM.length&&OM.indexOf(s.m)<0)?MODEL.get(OM[0]):(MODEL.get(s.m)||MODEL.get(MORDER[0]));
  const showList=s.list!==false;
  h+='<div class="row" style="margin-bottom:12px">'+sortBtn+'<button class="btn sm" data-a="slist" aria-pressed="'+showList+'">'+(showList?'إخفاء قايمة الموديلات':'إظهار قايمة الموديلات')+'</button>'+(showList?'':'<select data-c="smsel" aria-label="الموديل">'+OM.map(c=>'<option value="'+c+'" '+(c===m.code?'selected':'')+'>'+c+' · '+esc(MODEL.get(c).name)+(ctx().hm[c]?' ('+ctx().hm[c]+' قطعة مطلوبة)':'')+'</option>').join('')+'</select>')+'</div>'+info1;
  if(none)return h+none;
  h+='<div class="'+(showList?'wh':'')+'">';
  if(showList)h+='<nav class="card flat mlist" aria-label="الموديلات">'+LINE_ORDER.filter(l=>groups[l]).map(l=>'<div class="mgrp">'+l+'</div>'+groups[l].map(c=>{const r=mSum(c,'READY'),low=D.skus.some(k=>k.m===c&&info(k.id).cls==='c');
    return '<button class="mi" aria-current="'+(c===m.code)+'" data-a="smodel" data-m="'+c+'">'+thumb(c,34)+'<b>'+c+'</b><small>'+esc(MODEL.get(c).name)+'</small><span class="n">'+(low?'<i class="dot" style="background:var(--c-scrap)"></i> ':'')+fmt(s.state==='READY'?r:mSum(c,s.state))+'</span></button>'}).join('')).join('')+'</nav>';
  h+='<section class="card">'+modelHead(m)+matrixHTML(m)+matrixLegend+'</section></div>';
  return h;
}
"""
s=s[:a]+new+s[b:]

# ---- table view uses the shared matcher ----
rep("const s=UI.s,q=s.q.trim().toLowerCase().split(/\\s+/).filter(Boolean),f=s.flt||'all',C=ctx();","const s=UI.s,q=stockQ()||[],f=s.flt||'all',C=ctx();")
rep("    if(q.length){const hay=(k.id+' '+k.c+' '+k.s+' '+MODEL.get(k.m).name).toLowerCase();if(!q.every(w=>hay.indexOf(w)>=0))return false}\n","    if(q.length&&!skuHit(k,q))return false;\n")

# ---- handlers ----
rep("  sq:el=>{UI.s.q=el.value;$('#stres').innerHTML=stockTable()},","""  sq:el=>{UI.s.q=el.value;const r=$('#stres');if(r)r.innerHTML=stockBody();const x=$('.srch-x');if(x)x.hidden=!el.value;_L.main=null},""")
rep("  more:()=>{UI.sheet={kind:'more'};render()},","  more:()=>{UI.sheet={kind:'more'};render()},\n  sqclear:()=>{UI.s.q='';render();setTimeout(()=>{const e=$('#sq');if(e)e.focus()},30)},")

css=r"""<style>
.srch{position:relative;margin-bottom:12px;max-width:460px}
.srch svg{position:absolute;inset-inline-start:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;stroke:var(--muted);fill:none;stroke-width:1.8;stroke-linecap:round;pointer-events:none}
.srch input{width:100%;padding:10px 38px 10px 38px;border-radius:12px;background:var(--surface)}
.srch input::-webkit-search-cancel-button{display:none}
.srch-x{all:unset;cursor:pointer;position:absolute;inset-inline-end:6px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:99px;display:grid;place-items:center;color:var(--muted);font-size:13px}
.srch-x:hover{background:var(--lav);color:var(--ink)}
.srch-x[hidden]{display:none}
.srchinfo{margin:-2px 0 12px;font-size:13px}
.cell.dim{opacity:.2}
.cell.hit{outline:2px solid var(--accent);outline-offset:-1px}
@media (max-width:820px){.srch{max-width:none}}
</style>
"""
i=s.index('<div id="app"></div>')
s=s[:i]+css+s[i:]
(T/'base.html').write_text(s,encoding='utf-8')
print('1f ok')
