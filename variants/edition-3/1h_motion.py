import pathlib
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'base.html').read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:80],s.count(a))
    s=s.replace(a,b)

# ---- page enter flag + after-render hook (enter animation, changed-value flash) ----
rep("function go(tab,fn){UI.sheet=null;","function go(tab,fn){if(tab!==UI.tab)UI._enter=true;UI.sheet=null;")
rep("$('#mainw').innerHTML=mainH;_L.main=mainH;","$('#mainw').innerHTML=mainH;_L.main=mainH;uxAfterMain();")
rep("function render(){","""/* ---------- motion helpers ---------- */
let _K=null;
function uxAfterMain(){
  const m=$('#main');if(!m)return;
  if(UI._enter){m.classList.add('enter');UI._enter=false}
  const key=[UI.tab,UI.ins,UI.insP,UI.s&&UI.s.view,UI.s&&UI.s.state,UI.vd].join('|'),bs=[...m.querySelectorAll('.kpi b')],v=bs.map(b=>b.textContent);
  if(_K&&_K.key===key&&_K.v.length===v.length)v.forEach((x,i)=>{if(x!==_K.v[i])bs[i].classList.add('flash')});
  _K={key,v};
}
function render(){""")

# ---- sheet: scrim keeps its state while open; animated close ----
rep("const sh=$('.sheet',sw);if(sh)sh.classList.add('keep');","const sh=$('.sheet',sw);if(sh)sh.classList.add('keep');const sc2=$('.scrim',sw);if(sc2)sc2.classList.add('keep');")
rep("  closesheet:()=>{UI.sheet=null;render()},","""  closesheet:()=>{
    const sh=$('.sheet'),sc=$('.scrim');
    if(UI._closing)return;
    if(sh&&!matchMedia('(prefers-reduced-motion:reduce)').matches){UI._closing=true;sh.classList.add('out');if(sc)sc.classList.add('out');setTimeout(()=>{UI._closing=false;UI.sheet=null;render()},170)}
    else{UI.sheet=null;render()}
  },""")

# ---- toast: soft exit ----
rep("document.body.appendChild(t);setTimeout(()=>t.remove(),undoId?9000:3200)}","document.body.appendChild(t);setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),170)},undoId?9000:3200)}")

# ---- tooltip: short delay (no flicker when sweeping), instant when already showing ----
rep("""document.addEventListener('mouseover',e=>{
  const t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.hidden=true;return}
  tip.style.whiteSpace='pre-line';tip.textContent=t.getAttribute('data-tip');tip.hidden=false;
  const r=t.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,x=Math.min(Math.max(8,r.left+r.width/2-w/2),window.innerWidth-w-8);let y=r.top-h-8;if(y<8)y=r.bottom+8;tip.style.left=x+'px';tip.style.top=y+'px';
});""","""let _tipT=null;
document.addEventListener('mouseover',e=>{
  const t=e.target.closest&&e.target.closest('[data-tip]');clearTimeout(_tipT);if(!t){tip.hidden=true;return}
  const show=()=>{tip.style.whiteSpace='pre-line';tip.textContent=t.getAttribute('data-tip');tip.hidden=false;
    const r=t.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,x=Math.min(Math.max(8,r.left+r.width/2-w/2),window.innerWidth-w-8);let y=r.top-h-8;if(y<8)y=r.bottom+8;tip.style.left=x+'px';tip.style.top=y+'px'};
  if(!tip.hidden)show();else _tipT=setTimeout(show,260);
});
/* drag the bottom sheet down to dismiss (phones) */
(function(){let st=null;
  document.addEventListener('pointerdown',e=>{if(innerWidth>820||!e.target.closest)return;const h=e.target.closest('.sheet>header');if(!h||e.target.closest('button'))return;
    st={sh:h.parentElement,y:e.clientY,t:performance.now(),id:e.pointerId,dy:0};try{h.setPointerCapture(e.pointerId)}catch(_){}st.sh.style.transition='none'});
  document.addEventListener('pointermove',e=>{if(!st||e.pointerId!==st.id)return;st.dy=Math.max(0,e.clientY-st.y);st.sh.style.transform='translateY('+st.dy+'px)';const sc=document.querySelector('.scrim');if(sc)sc.style.opacity=String(Math.max(.2,1-st.dy/500))});
  const end=e=>{if(!st||e.pointerId!==st.id)return;const sh=st.sh,dy=st.dy,v=dy/Math.max(1,performance.now()-st.t);st=null;
    const sc=document.querySelector('.scrim');
    if(dy>110||v>.7){sh.style.transition='transform .2s cubic-bezier(.55,0,1,.45)';sh.style.transform='translateY(110%)';if(sc){sc.style.transition='opacity .2s';sc.style.opacity='0'}setTimeout(()=>{UI.sheet=null;render()},190)}
    else{sh.style.transition='transform .3s cubic-bezier(.16,1,.3,1)';sh.style.transform='';if(sc)sc.style.opacity='';setTimeout(()=>{sh.style.transition=''},320)}};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
})();""")

css=r"""<style>
/* ---------- motion: short, purposeful, and off when the device asks (durations and curves follow common UI-motion guidance) ---------- */
:root{--e-out:cubic-bezier(0,.55,.45,1);--e-in:cubic-bezier(.55,0,1,.45);--e-expo:cubic-bezier(.16,1,.3,1);--e-io:cubic-bezier(.65,0,.35,1)}
button,[data-a],.chip,.nav{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#tip:not([hidden]){animation:tipIn .14s var(--e-out)}
@keyframes tipIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
@media (max-width:820px){
  .sheet>header{touch-action:none;position:relative;cursor:grab;padding-top:22px}
  .sheet>header::before{content:'';position:absolute;top:8px;left:50%;width:38px;height:4px;border-radius:4px;background:var(--line2);transform:translateX(-50%)}
}
@media (prefers-reduced-motion:no-preference){
  .btn,.chip,.seg button,.nav,.op,.cell,button.kpi,.mi,.srow,.sortbtn,.tabs button,.imgbtn{transition:transform .12s var(--e-out),background-color .2s var(--e-out),color .2s var(--e-out),border-color .2s var(--e-out),box-shadow .2s var(--e-out),filter .2s}
  .btn:active,.chip:active,.seg button:active,.nav:active,.op:active,.cell:active,button.kpi:active,.mi:active,.srow:active,.sortbtn:active,.imgbtn:active{transform:scale(.96)}
  .scrim{animation:scrimIn .2s var(--e-out) both}
  .sheet{animation:sheetIn .28s var(--e-expo) both}
  .sheet.keep,.scrim.keep{animation:none}
  @keyframes scrimIn{from{opacity:0}to{opacity:1}}
  @keyframes sheetIn{from{transform:translateX(-28px);opacity:0}to{transform:none;opacity:1}}
  @keyframes sheetUp{from{transform:translateY(36px);opacity:0}to{transform:none;opacity:1}}
  .sheet.out{animation:sheetOut .17s var(--e-in) both!important}.scrim.out{animation:scrimOut .17s var(--e-in) both!important}
  @keyframes sheetOut{to{transform:translateX(-28px);opacity:0}}
  @keyframes sheetDown{to{transform:translateY(40px);opacity:0}}
  @keyframes scrimOut{to{opacity:0}}
  @media (max-width:820px){.sheet{animation-name:sheetUp;animation-duration:.32s}.sheet.out{animation-name:sheetDown!important}}
  .main.enter>*{animation:rise .26s var(--e-out) both}
  .main.enter>*:nth-child(2){animation-delay:.03s}.main.enter>*:nth-child(3){animation-delay:.06s}.main.enter>*:nth-child(4){animation-delay:.09s}
  .main.enter>*:nth-child(5){animation-delay:.12s}.main.enter>*:nth-child(6){animation-delay:.15s}.main.enter>*:nth-child(n+7){animation-delay:.18s}
  @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .toast{animation:toastIn .3s var(--e-expo) both}.toast.out{animation:toastOut .17s var(--e-in) both}
  @keyframes toastIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
  @keyframes toastOut{to{opacity:0;transform:translateY(10px)}}
  .kpi b.flash{display:inline-block;border-radius:8px;animation:flash 1.1s var(--e-out)}
  @keyframes flash{0%{background:color-mix(in srgb,var(--accent) 24%,transparent);transform:scale(1.07)}100%{background:transparent;transform:none}}
  :root{interpolate-size:allow-keywords}
  details.dd::details-content{block-size:0;overflow:hidden;transition:block-size .3s var(--e-io),content-visibility .3s allow-discrete}
  details.dd[open]::details-content{block-size:auto}
  details.dd>summary::after{transition:transform .3s var(--e-io)}
}
@media (hover:hover) and (prefers-reduced-motion:no-preference){
  .op:hover,button.kpi:hover{transform:translateY(-2px)}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;animation-delay:0s!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
</style>
"""
i=s.index('<div id="app"></div>')
s=s[:i]+css+s[i:]
(T/'base.html').write_text(s,encoding='utf-8')
print('1h ok')
