
/* ---------- order cancellation (waybill photo) ---------- */
const cxKey=ref=>'cx_'+ref;
function cxFind(code){
  const c=String(code||'').trim().replace(/[#\s]/g,'').toLowerCase();if(!c)return null;
  return S.orders.find(o=>String(o.ref).toLowerCase()===c||String(o.wb).replace(/\s/g,'').toLowerCase()===c)||null;
}
function cxInit(code){return {kind:'cancel',code:code||'',reason:'',photo:null,pname:'',ret:true,err:''}}
function cxPreviewHTML(s){
  if(!String(s.code).trim())return '<div class="muted">اكتب كود الأوردر (زي mk3450) أو رقم الشحن (زي 23772996) من البوليصة.</div>';
  const o=cxFind(s.code);if(!o)return '<div class="msg crit">مفيش أوردر بالكود ده. اتأكد من الكود المكتوب على البوليصة.</div>';
  const pk=S.pickups.find(p=>p.id===o.pk)||{};
  let h='<div class="card flat" style="background:var(--lav)"><div class="row sp"><b class="mono">'+esc(o.ref)+'</b>'+ordPill(o)+'</div><div class="muted" style="font-size:13px;margin-top:4px">شحن '+esc(o.wb)+' · '+esc(o.gov||'')+' · '+o.lines.length+' قطعة · '+esc(pk.label||'')+'</div></div>';
  if(o.st==='cx')h+='<div class="msg warn">الأوردر ده اتلغى قبل كده'+(o.cx?' ('+esc(o.cx.date)+')':'')+'.</div>';
  else if(o.st==='done')h+='<div class="msg warn">الأوردر ده <b>اتشحن بالفعل</b> واتخصم من المخزون.<label class="row" style="margin-top:8px;gap:8px"><input type="checkbox" data-c="cxret" '+(s.ret?'checked':'')+'> رجّع القطع ('+o.lines.length+') للمخزون جاهز</label></div>';
  return h;
}
function cxSheet(s){
  const o=cxFind(s.code),can=o&&o.st!=='cx'&&s.photo;
  let body='<div class="msg">استخدمها لما يتطلب منك تلغي أوردر. سجّل كود البوليصة وصوّرها وهي متشطوبة، والأوردر هيتشال من الأوردرات ومن الطلب.</div>';
  body+='<label class="f">كود الأوردر أو رقم الشحن<input id="cxcode" value="'+esc(s.code)+'" data-c="cxcode" placeholder="mk3450 أو 23772996" style="direction:ltr;text-align:start;font-family:var(--f-mono)" autocomplete="off"></label>';
  body+='<div id="cxprev">'+cxPreviewHTML(s)+'</div>';
  body+='<div><label class="f">صورة البوليصة (المشطوبة)<input type="file" accept="image/*" data-c="cxphoto"></label>'+(s.photo?'<img src="'+s.photo+'" alt="صورة البوليصة" style="margin-top:8px;max-width:100%;max-height:240px;border-radius:10px;border:1px solid var(--line)">':'')+'</div>';
  body+='<label class="f">السبب (اختياري)<input id="cxreason" value="'+esc(s.reason)+'" data-c="cxreason" placeholder="مثلًا: العميل لغى من فيندور"></label>';
  if(s.err)body+='<div class="msg crit">'+esc(s.err)+'</div>';
  body+='<button class="btn danger" id="cxgo" data-a="cxgo" '+(can?'':'disabled')+'>تأكيد إلغاء الأوردر</button><p class="muted" style="font-size:12px">مطلوب كود صحيح وصورة. الأوردر الملغي بيتحفظ في "الملفات ← الإلغاءات" وتقدر ترجّعه.</p>';
  return {title:'إلغاء أوردر',body};
}
function cxApply(s){
  const o=cxFind(s.code);if(!o||o.st==='cx'||!s.photo)return false;
  const was=o.st,cx={at:Date.now(),date:S.date,by:S.actor,reason:String(s.reason||'').trim(),was,returned:false,doc:null};
  if(was==='done'&&s.ret){
    const n=(S.seq.CXL=(S.seq.CXL||0)+1),no='CXL-'+String(n).padStart(4,'0'),a={};
    o.lines.forEach(k=>a[k]=(a[k]||0)+1);
    post(Object.keys(a).sort(skuSort).map(k=>({sku:k,q:a[k],from:'EXT_CH',to:'READY',note:'إلغاء أوردر '+o.ref})),{type:'CXL',date:S.date,no,id:no});
    consumption(o).forEach(c=>supPush(c[0],-c[1],'rev','إلغاء أوردر '+o.ref,no,S.date,{ofKind:'auto'}));
    cx.returned=true;cx.doc=no;
  }
  o.st='cx';o.cx=cx;PH[cxKey(o.ref)]=s.photo;phPut(cxKey(o.ref),s.photo);dirty();return true;
}
function cxRestore(o){
  const c=o.cx||{};o.st=(c.was==='done'&&!c.returned)?'done':'open';delete o.cx;dirty();
}
