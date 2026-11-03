import pathlib
H=pathlib.Path(__file__).parent
T=H/'.work'
T.mkdir(exist_ok=True)
s=(H/'base.html').read_text(encoding='utf-8')
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:60],s.count(a))
    s=s.replace(a,b)

# 1) clearer one-line meanings
rep("DIRTY:'بيتغسل ويرجع',FACTORY:'لسه راجع من المصنع'","DIRTY:'محتاج غسيل · لسه ما اتبعتش للمصنع',FACTORY:'اتبعت للمصنع · مستني يرجع'")

# 2) state rows become buttons
old="""INTERNAL.map(l=>'<div class="row sp"><span><i class="dot" style="background:'+LCOL[l]+'"></i> '+LOC[l]+' <span class="muted" style="font-size:12px">· '+LDESC[l]+'</span></span><b class="n">'+fmt(t[l])+'</b></div>').join('')+'</div>';"""
new="""INTERNAL.map(l=>{const n=D.skus.filter(k=>g(k.id,l)>0).length;return '<button type="button" class="srow" data-a="state" data-l="'+l+'"><span><i class="dot" style="background:'+LCOL[l]+'"></i> '+LOC[l]+' <span class="muted" style="font-size:12px">· '+LDESC[l]+(n?' · '+n+' صنف':'')+'</span></span><span class="row" style="gap:8px;flex-wrap:nowrap"><b class="n">'+fmt(t[l])+'</b><span class="muted" aria-hidden="true">‹</span></span></button>'}).join('')+'</div>';"""
rep(old,new)

# 3) css
rep(".hb{display:grid;",""".srow{all:unset;box-sizing:border-box;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 8px;margin-inline:-8px;border-radius:9px;width:calc(100% + 16px)}
.srow:hover{background:var(--lav)}
.srow:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.hb{display:grid;""")

# 4) the sheet
fn="""function stateSheet(l){
  const rows=D.skus.map(k=>[k.id,g(k.id,l)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]||skuSort(a[0],b[0])),tot=rows.reduce((a,x)=>a+x[1],0);
  const title=LOC[l]+' ('+fmt(tot)+' قطعة · '+rows.length+' صنف)';
  const INTRO={DIRTY:'قطع رجعت أو اتعلّمت إنها محتاجة غسيل ولسه ما اتبعتتش للمصنع. لما تبعتها بتتنقل لـ"عند المصنع".',FACTORY:'قطع اتبعتت للمصنع للغسيل المجاني ولسه ما رجعتش. لما ترجع بتتسجل في "استلام من المصنع": المغسول لـ"جاهز للبيع" والمرفوض لـ"هالك نهائي".',SCRAP:'قطع خلصت ومفيش علاج ليها.',LOST:'قطع ضايعة مستنية تسوية: لقيناها ولا نشطبها.',READY:'الرصيد اللي تقدر تبيعه دلوقتي (أكبر 40 صنف).'}[l];
  if(!rows.length)return {title,body:'<div class="msg good">مفيش قطع في الحالة دي دلوقتي.</div><p class="muted">'+INTRO+'</p>'};
  let sends=null;
  if(l==='FACTORY'){
    sends={};const ds=S.docs.filter(d=>d.type==='FSD'&&d.status==='done'&&d.hdr.kind==='wash').slice().reverse();
    rows.forEach(x=>{let rem=x[1],last=null;for(const d of ds){const q=d.lines.filter(y=>y.sku===x[0]).reduce((a,y)=>a+num(y.q),0);if(!q)continue;const t=Math.min(rem,q);rem-=t;last=d.date;if(rem<=0)break}sends[x[0]]=rem>0?(last?{d:last,part:1}:null):{d:last}});
  }
  const age=d=>d?dayDiff(d,S.date):null;
  let body='<div class="msg">'+INTRO+'</div>';
  const old=sends?rows.map(x=>sends[x[0]]&&sends[x[0]].d).filter(Boolean).sort()[0]:null;
  body+='<div class="kpis">'+kpi('قطع',N(tot),'')+kpi('أصناف',N(rows.length),'')+(l==='FACTORY'?kpi('أقدم إرسال',old?N(age(old))+' يوم':'—',old?old:'رصيد افتتاحي',old&&age(old)>=7?'warn':''):'')+'</div>';
  body+='<div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">القطع</th>'+(sends?'<th>اتبعت</th>':'')+'</tr></thead><tbody>'+rows.slice(0,l==='READY'?40:200).map(x=>{const k=SKU.get(x[0]);let c='';if(sends){const z=sends[x[0]];c='<td>'+(z?'<span class="n">'+z.d+'</span> '+pill(age(z.d)>=7?'warn':'',age(z.d)===0?'النهارده':'من '+age(z.d)+' يوم')+(z.part?' <span class="muted" style="font-size:12px">وجزء من رصيد قديم</span>':''):'<span class="muted">رصيد افتتاحي</span>')+'</td>'}
    return '<tr data-a="sku" data-sku="'+x[0]+'"><td>'+thumb(k.m,26)+' '+sw(k.c)+' '+esc(skuName(x[0]))+'</td><td class="num">'+N(x[1])+'</td>'+c+'</tr>'}).join('')+'</tbody></table></div>';
  const act={DIRTY:['FSD','إرسال الكل للمصنع للغسيل'],FACTORY:['FRC','استلام من المصنع'],LOST:['LOS','معالجة المفقود']}[l];
  if(act)body+='<button class="btn pri" data-a="stateop" data-l="'+l+'" data-t="'+act[0]+'">'+act[1]+'</button><p class="muted" style="font-size:12px">بيفتح مسودة فيها الأصناف دي بكمياتها. تقدر تعدّل أي كمية قبل التأكيد.</p>';
  return {title,body};
}
function flowSheet(w){"""
rep("function flowSheet(w){",fn)
rep("  }else if(s.kind==='flow'){","  }else if(s.kind==='state'){\n    const r=stateSheet(s.l);title=r.title;body=r.body;\n  }else if(s.kind==='flow'){")
rep("  flow:el=>{UI.sheet={kind:'flow',w:el.dataset.w};render()},","""  flow:el=>{UI.sheet={kind:'flow',w:el.dataset.w};render()},
  state:el=>{UI.sheet={kind:'state',l:el.dataset.l};render()},
  stateop:el=>{const l=el.dataset.l,t=el.dataset.t;UI.sheet=null;go('ops',()=>{const d=newDoc(t);D.skus.forEach(k=>{const q=g(k.id,l);if(q>0)addLine(d,k.id,q)});d.lines.sort((a,b)=>skuSort(a.sku,b.sku))})},""")
(T/'state.html').write_text(s,encoding='utf-8')
