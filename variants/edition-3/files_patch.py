# executed from 5_redesign.py after shop_patch.py: keep the original of every uploaded file
ins_before("function vStock(){",(H/'redesign_files.js').read_text(encoding='utf-8')+"\n")
rep("indexedDB.open('femini-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('ph');","indexedDB.open('femini-v3',2);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('ph'))db.createObjectStore('ph');if(!db.objectStoreNames.contains('fl'))db.createObjectStore('fl')};")
rep("s.fname=file.name;s.err='';","s.fname=file.name;s.orig=file;s.err='';")
rep("s.res=null;s.err='';s.fname='';s.manual=false;render()","s.res=null;s.err='';s.fname='';s.orig=null;s.manual=false;render()")
rep("S.pickups.push({id,label:'بيك أب '+n,date:s.date,channel:s.channel,src:s.fname});","S.pickups.push({id,label:'بيك أب '+n,date:s.date,channel:s.channel,src:s.fname,file:s.orig?{name:s.orig.name,size:s.orig.size}:null});if(s.orig)flPut('pk:'+id,s.orig);")
rep("const d=makeScn(r.matched,s.emp.trim(),s.manual?'تسجيل يدوي':s.fname);d.date=S.date;","const d=makeScn(r.matched,s.emp.trim(),s.manual?'تسجيل يدوي':s.fname);d.date=S.date;if(s.orig&&!s.manual){d.hdr.file={name:s.orig.name,size:s.orig.size};flPut('dc:'+d.id,s.orig)}")
rep("esc(p.src||'—')+'</b></div>';","esc(p.src||'—')+'</b>'+(p.file?'<div style=\"margin-top:8px\">'+flBtn('pk:'+p.id,p.file)+'</div>':'')+'</div>';")
rep("esc(d.hdr.src||'—')+'</b></div>';","esc(d.hdr.src||'—')+'</b>'+(d.hdr.file?'<div style=\"margin-top:8px\">'+flBtn('dc:'+d.id,d.hdr.file)+'</div>':'')+'</div>';")
rep("<b style=\"font-size:15px;font-family:var(--f-ar)\">'+esc(H.src)+'</b></div>';","<b style=\"font-size:15px;font-family:var(--f-ar)\">'+esc(H.src)+'</b>'+(H.file?'<div style=\"margin-top:6px\">'+flBtn('dc:'+d.id,H.file)+'</div>':'')+'</div>';")
rep("phFromFile(f,data=>{PH[d.id]=data;phPut(d.id,data);d.photo={name:f.name,size:f.size};","flPut('ph:'+d.id,f);phFromFile(f,data=>{PH[d.id]=data;phPut(d.id,data);d.photo={name:f.name,size:f.size};")
rep("Object.assign(ACT,ACT_ACC,ACT_LG,ACT_RT,ACT_SH);","Object.assign(ACT,ACT_ACC,ACT_LG,ACT_RT,ACT_SH,ACT_FL);")
# photo download next to the receive-paper photo
rep("""<img src="'+PH[d.id]+'" alt="صورة الورقة" style="width:100%;border-radius:10px;border:1px solid var(--line)">'""","""<img src="'+PH[d.id]+'" alt="صورة الورقة" style="width:100%;border-radius:10px;border:1px solid var(--line)"><div style="margin-top:6px">'+flBtn('ph:'+d.id,d.photo||{name:'receipt-'+(d.no||d.id)+'.jpg'},'تنزيل الصورة')+'</div>'""")
# Files page: say the truth (originals are kept) and put a download next to every file
rep("ملف Excel أو CSV نفسه مش بيتخزّن. السيستم بيقراه وبيحفظ البيانات اللي طلعت منه (الأوردرات والكميات) واسم الملف كمرجع. صور الورق الموقّع بتتحفظ في المتصفح ده بس. تقدر تعدّل كل حاجة من الجداول اللي تحت.","كل ملف ترفعه (بيك أب، سكان، صور الورق الموقّع، صور الإلغاء) بيتحفظ بنسخته الأصلية زي ما هو، وتقدر تنزّله في أي وقت من زر ⬇. الملفات محفوظة في المتصفح ده على الجهاز ده، فلو غيّرت الجهاز أو مسحت بيانات المتصفح هتضيع. الملفات اللي اترفعت قبل الميزة دي اسمها بس هو المحفوظ.")
rep("""<td class="muted">'+esc(d.hdr.src||'')+'</td><td class="mono">'+d.date""","""<td class="muted">'+esc(d.hdr.src||'')+(d.hdr.file?'<div style="margin-top:4px">'+flBtn('dc:'+d.id,d.hdr.file,'تنزيل')+'</div>':'')+'</td><td class="mono">'+d.date""")
rep("""<td class="muted">'+esc(p.src||'')+'</td><td class="mono">'+esc(p.date)""","""<td class="muted">'+esc(p.src||'')+(p.file?'<div style="margin-top:4px">'+flBtn('pk:'+p.id,p.file,'تنزيل')+'</div>':'')+'</td><td class="mono">'+esc(p.date)""")
rep("""return '<button class="card flat" style="all:unset;box-sizing:border-box;cursor:pointer;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;gap:8px" data-a="opendoc2" data-id="'+d.id+'">'""","""return '<div style="display:grid;gap:6px"><button class="card flat" style="all:unset;box-sizing:border-box;cursor:pointer;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;gap:8px" data-a="opendoc2" data-id="'+d.id+'">'""")
rep("""+' قطعة</span></button>'}).join('')+'</div>':'<div class="card"><div class="empty">لسه مفيش استلام""","""+' قطعة</span></button>'+(u?flBtn('ph:'+d.id,d.photo||{name:'note-'+(d.no||d.id)+'.jpg'},'تنزيل الصورة'):'')+'</div>'}).join('')+'</div>':'<div class="card"><div class="empty">لسه مفيش استلام""")
rep("""<div class="row"><button class="btn sm" data-a="order" data-ref="'+esc(o.ref)+'">تفاصيل</button>""","""<div class="row">'+(u?flBtn('cx:'+o.ref,{name:'cancel-'+o.ref+'.jpg'},'تنزيل الصورة'):'')+'<button class="btn sm" data-a="order" data-ref="'+esc(o.ref)+'">تفاصيل</button>""")
rep("phFromFile(f,d=>{s.photo=d;s.pname=f.name;render()})","s.pfile=f;phFromFile(f,d=>{s.photo=d;s.pname=f.name;render()})")
rep("PH[cxKey(o.ref)]=s.photo;phPut(cxKey(o.ref),s.photo);","PH[cxKey(o.ref)]=s.photo;phPut(cxKey(o.ref),s.photo);if(s.pfile)flPut('cx:'+o.ref,s.pfile);")
# sheet body is a grid: scroll containers inside it (tables) were squeezed to a few pixels instead of letting the sheet scroll
rep(".sheet>div.body{padding:18px;",".hsc{border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden;margin-top:12px}.hsh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:var(--lav)}.hsn{text-align:center;line-height:1.1}.hsn b{font-size:20px;display:block}.hsn small{font-size:11px}.hsr{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px 10px;padding:11px 14px;border-top:1px solid var(--grid);cursor:pointer}.hsr:hover{background:var(--lav)}.hsr.dim{opacity:.6}.hsr>.pill{order:2}.hsc1{display:flex;align-items:center;gap:6px;font-weight:600;font-size:15px}.hsf{order:3;grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(60px,1fr));gap:6px}.hsf span{display:grid;line-height:1.25;background:var(--lav);border-radius:8px;padding:5px 7px}.hsf small{font-size:10.5px}.hsf small{font-size:11px;color:var(--muted)}.hsf b{font-size:14px}.hst-tot{margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--lav);font-size:14px}.lgb{border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden;margin-top:10px}.lgb-h{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--lav)}.lgb-r{display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid var(--grid);flex-wrap:wrap}.lgb-c{min-width:92px;display:flex;align-items:center;gap:6px;font-weight:600}.lgb-s{display:flex;gap:6px;flex-wrap:wrap;flex:1}.lgb-s span{display:inline-flex;gap:7px;align-items:baseline;background:var(--lav);border-radius:8px;padding:3px 10px;font:600 13px var(--f-mono)}.lgb-s span small{color:var(--muted);font:500 11.5px var(--f-ar);margin-inline-end:5px}.lgb-t{font:700 14px var(--f-mono);margin-inline-start:auto}input[type=color].cpick{-webkit-appearance:none;appearance:none;width:46px;height:46px;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px var(--line2);flex:none}input[type=color].cpick::-webkit-color-swatch-wrapper{padding:0}input[type=color].cpick::-webkit-color-swatch{border:0;border-radius:50%}input[type=color].cpick::-moz-color-swatch{border:0;border-radius:50%}.sheet .body>.seg{display:flex}.sheet .body>.seg button{flex:1;text-align:center}.t-sm tfoot td{border-top:2px solid var(--line2);font-weight:600;background:var(--lav)}.sheet .lgm{gap:4px;padding:10px 0}.sheet .lgn{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}.sheet>div.body{grid-auto-rows:max-content;padding:18px;")
# deleting a pickup also deletes its stored original; a delivered note's proof photo can no longer be swapped
rep("S.pickups=S.pickups.filter(x=>x!==p);UI.o.pk='';","S.pickups=S.pickups.filter(x=>x!==p);flDel('pk:'+p.id);UI.o.pk='';")
# stock: open on the matrices by default, bigger product pictures
rep("s:{m:'BR2',state:'READY',q:'',view:'list'}","s:{m:'BR2',state:'READY',q:'',view:'all'}")
rep("thumb(m.code,64)+'</button>","thumb(m.code,104)+'</button>")
rep("return '<button class=\"mi\" aria-current=\"'+(c===m.code)+'\" data-a=\"smodel\" data-m=\"'+c+'\">'+thumb(c,34)","return '<button class=\"mi\" aria-current=\"'+(c===m.code)+'\" data-a=\"smodel\" data-m=\"'+c+'\">'+thumb(c,48)")
rep("'+thumb(c,34)+'<span><b class=\"mono\">'+c+'</b> <span class=\"muted\">'+esc(MODEL.get(c).nam","'+thumb(c,56)+'<span><b class=\"mono\">'+c+'</b> <span class=\"muted\">'+esc(MODEL.get(c).nam")
# ---- dashboard cards open pop-ups
ins_before("function vStock(){",(H/'redesign_kpi.js').read_text(encoding='utf-8')+"\n")
rep("Object.assign(ACT,ACT_ACC,ACT_LG,ACT_RT,ACT_SH,ACT_FL);","Object.assign(ACT,ACT_ACC,ACT_LG,ACT_RT,ACT_SH,ACT_FL,ACT_DK,ACT_AR,ACT_HS);")
rep("  }else if(s.kind==='oos'){","  }else if(s.kind==='dk'){\n    const r=dkSheet(s);title=r.title;body=r.body;\n  }else if(s.kind==='oos'){")
rep("kpi('أوردرات مفتوحة (قيمة)',EGPh(Dd.openV),Dd.blk.length?'معطل منه '+EGP(Dd.blkV)+' · '+Dd.blk.length+' أوردر':Dd.open.length+' أوردر',Dd.blk.length?'crit':'','instab:stuck')","kpi('أوردرات مفتوحة (قيمة)',EGPh(Dd.openV),Dd.blk.length?'معطل منه '+EGP(Dd.blkV)+' · '+Dd.blk.length+' أوردر':Dd.open.length+' أوردر',Dd.blk.length?'crit':'','dk:open')")
rep("kpi('اتشحن',EGPh(M.shipV),dDelta(M.shipV,PM&&PM.shipV,hp)||M.shipO+' أوردر','good')","kpi('اتشحن',EGPh(M.shipV),dDelta(M.shipV,PM&&PM.shipV,hp)||M.shipO+' أوردر','good','dk:shipv')")
rep("PM&&PM.shipO?dDelta(M.shipV/Math.max(1,M.shipO),PM.shipV/PM.shipO,hp):'على اللي اتشحن')","PM&&PM.shipO?dDelta(M.shipV/Math.max(1,M.shipO),PM.shipV/PM.shipO,hp):'على اللي اتشحن','','dk:avg')")
rep("M.shipV&&M.retV/M.shipV>.15?'warn':'')\n   +(Dd.hasCosts","M.shipV&&M.retV/M.shipV>.15?'warn':'','dk:retv')\n   +(Dd.hasCosts")
rep("'هالك + مفقود: '+EGP(Dd.lossV),Dd.lossV?'warn':'')","'هالك + مفقود: '+EGP(Dd.lossV),Dd.lossV?'warn':'','dk:stockv')")
rep("kpi('طلب (بيك أب)',N(M.dem),dDelta(M.dem,PM&&PM.dem,hp)||M.demO+' أوردر')","kpi('طلب (بيك أب)',N(M.dem),dDelta(M.dem,PM&&PM.dem,hp)||M.demO+' أوردر','','dk:dem')")
rep("kpi('اتشحن',N(M.ship),dDelta(M.ship,PM&&PM.ship,hp)||'خروج فعلي','good')","kpi('اتشحن',N(M.ship),dDelta(M.ship,PM&&PM.ship,hp)||'خروج فعلي','good','dk:ship')")
rep("kpi('رجع',N(M.ret),M.ship?pc(M.ret,M.ship)+' من اللي اتشحن':'',M.ship&&M.ret/M.ship>.15?'warn':'')","kpi('رجع',N(M.ret),M.ship?pc(M.ret,M.ship)+' من اللي اتشحن':'',M.ship&&M.ret/M.ship>.15?'warn':'','dk:ret')")
rep("kpi('اتسلّم من المصنع (توريد)',N(M.rcv),'استلام توريد')","kpi('اتسلّم من المصنع (توريد)',N(M.rcv),'استلام توريد','','dk:rcv')")
rep("M.scrap+' هالك · '+M.lost+' مفقود',M.scrap+M.lost?'warn':'')","M.scrap+' هالك · '+M.lost+' مفقود',M.scrap+M.lost?'warn':'','dk:loss')")
# ---- no deleting: archive only
rep("deldoc:()=>{const d=curDoc();S.docs=S.docs.filter(x=>x!==d);UI.doc=null;dirty();toast('اتحذفت المسودة');render()}","deldoc:()=>{const d=curDoc();(S.archDocs||(S.archDocs=[])).push({d,at:Date.now(),by:S.actor});S.docs=S.docs.filter(x=>x!==d);UI.doc=null;audit('أرشفة مسودة');dirty();toast('اتأرشفت المسودة. هتلاقيها في الملفات ← المؤرشف');render()}")
rep('data-a="deldoc">حذف المسودة<','data-a="deldoc">أرشفة المسودة<')
rep("S.orders=S.orders.filter(o=>o.pk!==p.id);S.pickups=S.pickups.filter(x=>x!==p);flDel('pk:'+p.id);UI.o.pk='';dirty();UI.sheet=null;toast('اتحذف '+p.label);render()","(S.archPk||(S.archPk=[])).push({p,orders:S.orders.filter(o=>o.pk===p.id),at:Date.now(),by:S.actor});S.orders=S.orders.filter(o=>o.pk!==p.id);S.pickups=S.pickups.filter(x=>x!==p);audit('أرشفة بيك أب: '+p.label);UI.o.pk='';dirty();UI.sheet=null;toast('اتأرشف '+p.label+'. هتلاقيه في الملفات ← المؤرشف');render()")
rep("""<h2 style="font-size:15px">حذف البيك أب</h2>""","""<h2 style="font-size:15px">أرشفة البيك أب</h2>""")
rep("مينفعش تحذفه لأن فيه","مينفعش تأرشفه لأن فيه")
rep("""هتتمسح '+po.length+' أوردر من "'+esc(p.label)+'" ومش هيتحسبوا كطلب. متأكد؟""","""هيتأرشف '+po.length+' أوردر من "'+esc(p.label)+'" ومش هيتحسبوا كطلب. تقدر ترجّعه من الملفات ← المؤرشف. متأكد؟""")
rep('data-a="pkdel2">أيوه، احذف</button>','data-a="pkdel2">أيوه، أرشف</button>')
rep("""<p class="muted" style="margin-bottom:10px">بيمسح الأوردرات المفتوحة بتاعته. مش بيأثّر على المخزون لأن البيك أب مش بيخصم.</p><button class="btn danger sm" data-a="pkdel">حذف البيك أب</button>""","""<p class="muted" style="margin-bottom:10px">بينقل البيك أب وأوردراته المفتوحة للمؤرشف. مش بيأثّر على المخزون لأن البيك أب مش بيخصم.</p><button class="btn sm" data-a="pkdel">أرشفة البيك أب</button>""")
# settings: no 'reset everything' button
_i=s.index("""'<div class="gh">رجوع للأصل</div>'+(UI.confirmReset""");_j=s.index("""+'</section></div>';""",_i)
s=s[:_i]+"'<p class=\"muted\" style=\"margin-top:10px;font-size:12.5px\">مفيش مسح في السيستم. اللي مش عايزه بتأرشفه (من الملفات ← المؤرشف ترجّعه).</p>'"+s[_j:]
# model image: replace only, never remove
rep("""+(u?'<button class="btn danger" data-a="rmimg" data-m="'+s.m+'">إزالة</button>':'')""","")

# ---- ops list: no "reversed" filter (there is no reversing any more)
rep("['done','مؤكدة'],['reversed','معكوسة']]","['done','مؤكدة']]")
# ---- supplies: no separate archive page (everything archived lives in the ledger)
rep("const items=S.sup.items.filter(i=>UI.supArch?i.arch:!i.arch),nArch=S.sup.items.filter(i=>i.arch).length;","const items=S.sup.items.filter(i=>!i.arch),nArch=0;UI.supArch=false;")
# ---- Today: every event opens a pop-up with the full detail
rep("  }else if(s.kind==='oos'){","  }else if(s.kind==='tev'){\n    const r=tevSheet(s);title=r.title;body=r.body;\n  }else if(s.kind==='oos'){")
# ---- new colours get a real swatch (picked or guessed), never the default lavender
rep("const sw=c=>'<i class=\"sw\" style=\"background:'+(HEX[c]||'#cfc2ec')+'\"></i>';","const sw=c=>'<i class=\"sw\" style=\"background:'+colHex(c)+'\"></i>';")
rep("""<input id="nc" placeholder="لون جديد" value="'+esc(s.newColor)+'" data-c="skuf" data-f="newColor" style="max-width:180px">""","""<input id="nc" placeholder="لون جديد" value="'+esc(s.newColor)+'" data-c="skuf" data-f="newColor" style="max-width:180px"><input type="color" class="cpick" id="nhx" data-c="skuf" data-f="newHex" value="'+(s.newHex||guessHex(s.newColor)||'#8a8a8a')+'" aria-label="درجة اللون" title="اختار درجة اللون" >""")
rep("""<input id="catnc" list="catcl" placeholder="لون جديد" value="'+esc(s.newC)+'" data-c="catf" data-f="newC" style="max-width:150px">""","""<input id="catnc" list="catcl" placeholder="لون جديد" value="'+esc(s.newC)+'" data-c="catf" data-f="newC" style="max-width:150px"><input type="color" class="cpick" id="nhx" data-c="catf" data-f="newHex" value="'+(s.newHex||guessHex(s.newC)||'#8a8a8a')+'" aria-label="درجة اللون" title="اختار درجة اللون" >""")
rep("if(s.colors.indexOf(v)<0)s.colors.push(v);s.newColor='';render()","if(s.colors.indexOf(v)<0)s.colors.push(v);hexSave(v,s.newHex);s.newColor='';s.newHex='';s.hexTouched=false;render()")
rep("catCells(s).sizes.forEach(z=>{if(!IDX[s.m+'|'+v+'|'+z])s.w[v+'|'+z]=true});s.newC='';render()","catCells(s).sizes.forEach(z=>{if(!IDX[s.m+'|'+v+'|'+z])s.w[v+'|'+z]=true});hexSave(v,s.newHex);s.newC='';s.newHex='';s.hexTouched=false;render()")
rep("Object.assign(INP,INP_LG,INP_SH);","Object.assign(INP,INP_LG,INP_SH);hexWrap();")

# the shipping side is always called "الشحن"
rep("EXT_CH:'القناة / العميل'","EXT_CH:'الشحن'")

# Today tiles: no hint text on the missing-items heading; totals under both tables
rep("""الأصناف الناقصة <span class="muted" style="font-weight:400">(بتعطّل أكتر أوردرات الأول)</span></h3>""","""الأصناف الناقصة</h3>""")
rep("""ordPill(o))+'</td></tr>').join('')+'</tbody></table></div>';""","""ordPill(o))+'</td></tr>').join('')+'</tbody><tfoot><tr><td><b>الإجمالي</b> <span class="muted">('+fmt(list.length)+' أوردر)</span></td><td class="num"><b class="n">'+fmt(pcs)+'</b></td><td class="muted">'+(missing?'قطعة ناقصة: <b class="n">'+fmt(list.reduce((a,o)=>a+(C.blocked[o.ref]||[]).reduce((b,x)=>b+x[1],0),0))+'</b>':'قطعة')+'</td></tr></tfoot></table></div>';""")
rep("""N(map[s].n)+'</td></tr>').join('')+'</tbody></table></div>'};""","""N(map[s].n)+'</td></tr>').join('')+'</tbody><tfoot><tr><td><b>الإجمالي</b> <span class="muted">('+fmt(ks.length)+' صنف)</span></td><td class="num"><b class="n">'+fmt(ks.reduce((a,s)=>a+g(s,'READY'),0))+'</b></td><td class="num"><b class="n">'+fmt(ks.reduce((a,s)=>a+map[s].q,0))+'</b></td><td class="num"><b class="n">'+fmt(ks.reduce((a,s)=>a+map[s].n,0))+'</b></td></tr></tfoot></table></div>'};""")

rep("  }else if(s.kind==='oos'){","  }else if(s.kind==='hst'){\n    const r=hstSheet(s);title=r.title;body=r.body;\n  }else if(s.kind==='oos'){")
# order status pill: say exactly which model/colour/size is missing
rep("pill('crit','معطل · ناقص '+esc(skuName(b[0][0],false))+(b.length>1?' +'+(b.length-1):''),","pill('crit','معطل · ناقص '+esc(skuName(b[0][0]))+(b[0][1]>1?' ×'+b[0][1]:'')+(b.length>1?' +'+(b.length-1)+' صنف':''),")

# wording / small fixes found in the v44 walkthrough
rep("من هنا تعدّلها أو تحذفها أو تلاقي مكانها.","من هنا تعدّلها أو تنزّلها أو تلاقي مكانها.")
_a='aria-label="حذف">حذف</button>'
assert s.count(_a)>=1
s=s.replace(_a,'aria-label="شيل البند">شيل</button>')
rep("  .sheet{width:100%;top:8%;border-radius:18px 18px 0 0;padding-top:0}","  .sheet{width:100%;top:8%;border-radius:18px 18px 0 0;padding-top:0}\n  .tabs{-webkit-mask-image:linear-gradient(to right,transparent,#000 14%);mask-image:linear-gradient(to right,transparent,#000 14%)}\n  .mxgrid .imgbtn .th,.mxgrid .imgbtn .ph{width:72px!important;height:72px!important}")
